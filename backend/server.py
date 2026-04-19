from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, BackgroundTasks
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
import json
import re
import uuid
import random
import string
import httpx
import bcrypt
import base64
from io import BytesIO
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest
)

try:
    from PyPDF2 import PdfReader
except ImportError:
    PdfReader = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']
emergent_key = os.environ['EMERGENT_LLM_KEY']
stripe_key = os.environ['STRIPE_API_KEY']
jwt_secret = os.environ['JWT_SECRET']

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── 4-Tier Subscription Model ───
SUBSCRIPTION_TIERS = {
    "free": {
        "name": "Free", "plan_limit": 0, "launch_kit_limit": 0,
        "price": 0.00, "description": "Starter hustles + 1 trial business plan",
        "features": ["Up to 12 hustle recommendations", "1 free trial business plan", "Community access"],
    },
    "starter": {
        "name": "Starter", "plan_limit": 10, "launch_kit_limit": 2,
        "price": 9.99, "description": "10 plans/mo + 2 kits + AI Mentor",
        "features": ["10 business plans/month", "2 launch kits with landing pages", "AI Mentor chat", "Priority support"],
    },
    "pro": {
        "name": "Pro", "plan_limit": 999999, "launch_kit_limit": 5,
        "price": 29.99, "description": "Unlimited plans + 5 kits + AI Agents",
        "features": ["Unlimited business plans", "5 launch kits", "AI Mentor + Marketing Agent", "Landing page customization"],
    },
    "empire": {
        "name": "Empire", "plan_limit": 999999, "launch_kit_limit": 999999,
        "price": 49.99, "description": "Unlimited everything + All AI Agents",
        "features": ["Unlimited everything", "All AI Agents (Marketing, Content, Finance)", "AI Mentor with page editing", "White-label landing pages", "Dedicated support"],
    },
}

ALACARTE_PLAN_PRICE = 4.99
ALACARTE_KIT_PRICE = 2.99
ALACARTE_AGENT_PRICES = {
    "marketing": {"price": 9.99, "name": "Marketing Agent"},
    "content": {"price": 9.99, "name": "Content Writer"},
    "finance": {"price": 9.99, "name": "Finance Advisor"},
}
ALACARTE_AGENT_PACK_PRICE = 19.99  # All 3 premium agents — 33% discount
REFERRAL_CREDIT = 5.00

# ─── Questionnaire Questions ───
QUESTIONNAIRE_QUESTIONS = [
    {"id": "profession", "question": "What's your current profession or field?", "type": "single_select",
     "options": ["Technology", "Business/Finance", "Creative/Design", "Healthcare", "Education", "Sales/Marketing", "Trades/Manual", "Student", "Other"]},
    {"id": "skills", "question": "Select your top skills", "type": "multi_select",
     "options": ["Writing", "Programming", "Design", "Marketing", "Sales", "Teaching", "Photography", "Video Editing", "Data Analysis", "Public Speaking", "Social Media", "Cooking", "Fitness Training", "Music", "Crafting/DIY", "Other"]},
    {"id": "hours_per_week", "question": "How many hours per week can you dedicate?", "type": "single_select",
     "options": ["Less than 5", "5-10", "10-20", "20-30", "30+"]},
    {"id": "budget", "question": "What's your startup budget?", "type": "single_select",
     "options": ["$0 - Free only", "$1-$100", "$100-$500", "$500-$1000", "$1000+"]},
    {"id": "income_goal", "question": "What's your monthly income goal?", "type": "single_select",
     "options": ["$100-$500", "$500-$1000", "$1000-$3000", "$3000-$5000", "$5000+"]},
    {"id": "interests", "question": "What areas interest you most?", "type": "multi_select",
     "options": ["E-commerce", "Freelancing", "Content Creation", "Consulting", "Digital Products", "Real Estate", "Investing", "Teaching/Tutoring", "App Development", "Physical Products", "Service Business", "Passive Income", "Other"]},
    {"id": "risk_tolerance", "question": "What's your risk tolerance?", "type": "single_select",
     "options": ["Very Low - I want guaranteed income", "Low - Minimal risk preferred", "Medium - Balanced approach", "High - Willing to take risks", "Very High - Go big or go home"]},
    {"id": "work_style", "question": "How do you prefer to work?", "type": "single_select",
     "options": ["Solo - I work best alone", "Team - I love collaboration", "Mix - Both solo and team work", "Client-facing - I enjoy direct interaction"]},
    {"id": "tech_comfort", "question": "How comfortable are you with technology?", "type": "single_select",
     "options": ["Beginner - I stick to basics", "Intermediate - I can learn new tools", "Advanced - I'm very tech-savvy", "Expert - I can build tech solutions"]},
    {"id": "timeline", "question": "When do you want to start seeing results?", "type": "single_select",
     "options": ["This week", "Within a month", "1-3 months", "3-6 months", "I'm patient - long term focus"]},
    {"id": "blue_collar", "question": "Do you have hands-on trade or blue collar skills?", "type": "multi_select",
     "options": ["Handyman/Home Repair", "Construction", "Painting/Drywall", "Plumbing", "Electrical", "Automotive/Mechanic", "Landscaping/Lawn Care", "Welding/Fabrication", "Carpentry/Woodwork", "HVAC", "Cleaning/Janitorial", "Moving/Hauling", "None of these", "Other"]},
]

# ─── Pydantic Models ───
class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    referral_code: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class QuestionnaireSubmission(BaseModel):
    answers: Dict[str, Any]
    additional_skills: Optional[str] = None
    resume_text: Optional[str] = None
    resume_file_b64: Optional[str] = None
    resume_filename: Optional[str] = None

class CheckoutRequest(BaseModel):
    plan: str
    origin_url: str
    hustle_id: Optional[str] = None

# ─── Helpers ───
def generate_referral_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

def parse_json_from_response(text: str):
    json_match = re.search(r'```(?:json)?\s*\n([\s\S]*?)\n```', text)
    if json_match:
        return json.loads(json_match.group(1))
    try:
        return json.loads(text)
    except Exception:
        for pattern in [r'\[[\s\S]*\]', r'\{[\s\S]*\}']:
            match = re.search(pattern, text)
            if match:
                try:
                    return json.loads(match.group())
                except Exception:
                    continue
    raise ValueError("Could not parse JSON from AI response")

def extract_text_from_file(file_data_b64: str, filename: str) -> str:
    data = base64.b64decode(file_data_b64)
    if filename.lower().endswith('.pdf') and PdfReader:
        reader = PdfReader(BytesIO(data))
        return "".join(page.extract_text() or "" for page in reader.pages)
    return data.decode('utf-8', errors='ignore')

def classify_hustle_income(potential_income: str) -> str:
    """Classify hustle as 'starter' or 'premium' based on income string."""
    nums = re.findall(r'[\d,]+', potential_income.replace(',', ''))
    if nums:
        max_val = max(int(n) for n in nums if n.isdigit())
        if max_val >= 1000:
            return "premium"
    return "starter"

async def get_current_user(request: Request):
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header.split(' ')[1]
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session.get('expires_at')
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def create_session_token():
    return f"sess_{uuid.uuid4().hex}"

# ─── Async Generation Background Tasks ───
async def _bg_generate_plan(hustle_id: str, user_id: str, hustle: dict, answers: dict, tier: str, trial_used: bool):
    """Background task to generate a business plan."""
    job_id = f"job_plan_{hustle_id}"
    try:
        await db.generation_jobs.update_one({"job_id": job_id}, {"$set": {"status": "generating"}})
        prompt = f"""30-day business plan for "{hustle['name']}" ({hustle['description'][:80]}). {answers.get('hours_per_week', '10-20')} hrs/week, {answers.get('budget', '$100-$500')} budget, goal: {answers.get('income_goal', '$1000-$3000')}/mo.

Return ONLY JSON with: "title", "overview" (1 paragraph), "daily_tasks" (array of 30: day/title/tasks array of 2-3 strings/estimated_hours), "milestones" (4 items for days 7,14,21,30: day/title/description/expected_outcome), "resources_needed" (3-5 items), "total_estimated_cost".
Keep task descriptions SHORT (under 10 words each). Be specific and actionable."""

        max_retries = 3
        plan_data = None
        for attempt in range(max_retries):
            try:
                chat = LlmChat(api_key=emergent_key,
                    session_id=f"plan_{user_id}_{hustle_id}_{uuid.uuid4().hex[:4]}",
                    system_message="Expert business strategist. Return valid JSON only. Be concise.")
                chat.with_model("openai", "gpt-5.2")
                response = await chat.send_message(UserMessage(text=prompt))
                plan_data = parse_json_from_response(response)
                break
            except Exception as e:
                logger.warning(f"Plan gen attempt {attempt+1} failed: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2)
        if not plan_data:
            raise ValueError("All retries failed")

        plan_id = f"plan_{uuid.uuid4().hex[:12]}"
        plan_doc = {
            "plan_id": plan_id, "hustle_id": hustle_id, "user_id": user_id,
            "title": plan_data.get("title", f"30-Day Plan: {hustle['name']}"),
            "overview": plan_data.get("overview", ""), "daily_tasks": plan_data.get("daily_tasks", []),
            "milestones": plan_data.get("milestones", []),
            "resources_needed": plan_data.get("resources_needed", []),
            "total_estimated_cost": plan_data.get("total_estimated_cost", "Varies"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.business_plans.insert_one(plan_doc)
        await db.side_hustles.update_one({"hustle_id": hustle_id}, {"$set": {"selected": True, "business_plan_generated": True}})
        update_fields: Dict[str, Any] = {"$inc": {"plans_generated": 1}}
        if tier == "free" and not trial_used:
            update_fields["$set"] = {"trial_plan_used": True}
        await db.users.update_one({"user_id": user_id}, update_fields)
        await db.generation_jobs.update_one({"job_id": job_id}, {"$set": {"status": "complete"}})
    except Exception as e:
        logger.error(f"BG plan gen error: {e}")
        await db.generation_jobs.update_one({"job_id": job_id}, {"$set": {"status": "failed", "error": str(e)}})

async def _bg_generate_kit(hustle_id: str, user_id: str, hustle: dict):
    """Background task to generate a launch kit in 2 stages for speed."""
    job_id = f"job_kit_{hustle_id}"
    try:
        await db.generation_jobs.update_one({"job_id": job_id}, {"$set": {"status": "generating"}})

        # ── Stage 1: Fast deliverables (~15s) ──
        prompt1 = f"""Create a Hustle Launch Kit for:
Business: {hustle['name']}
Description: {hustle['description']}
Category: {hustle.get('category', 'General')}

Return ONLY JSON:
- "business_name": a SHORT, memorable, premium brand name (1-2 words max, like "Apex", "Rivian", "Stripe", "Notion"). Must sound like a real funded startup — no generic phrases, no "Pro Solutions" type names. Think Y Combinator company names.
- "tagline": punchy tagline under 8 words that creates urgency or aspiration
- "elevator_pitch": 30-second pitch (~80 words) — confident, specific, results-oriented
- "social_posts": array of 5 social media captions with emojis/hashtags — each should sound like a real brand posting, not AI-generated
- "brand_colors": {{"primary": "#hex", "accent": "#hex"}} — choose bold, modern colors that feel premium (avoid generic blue/orange combos)
- "target_audience": 1-2 sentences on ideal customer with specific demographics
- "marketing_strategy": array of 3 key strategies with specific tactics (not vague advice)
- "launch_checklist": array of 8 actionable launch steps with clear deliverables
- "pricing_tiers": array of 3 objects each with "name", "price", "features" (array of 3-4 strings) representing service packages — use creative tier names (not just Basic/Pro/Premium)"""

        kit_data = None
        for attempt in range(3):
            try:
                chat = LlmChat(api_key=emergent_key,
                    session_id=f"kit1_{user_id}_{hustle_id}_{uuid.uuid4().hex[:4]}",
                    system_message="You are a top-tier Silicon Valley brand strategist who has named companies like Stripe, Notion, and Linear. Create premium, venture-backed quality brand assets. Return valid JSON only. Be specific and bold.")
                chat.with_model("openai", "gpt-5.2")
                response = await chat.send_message(UserMessage(text=prompt1))
                kit_data = parse_json_from_response(response)
                break
            except Exception as e:
                logger.warning(f"Kit stage1 attempt {attempt+1} failed: {e}")
                if attempt < 2:
                    await asyncio.sleep(2)
        if not kit_data:
            raise ValueError("Stage 1 failed after retries")

        # Save partial kit immediately so user sees progress
        kit_id = f"kit_{uuid.uuid4().hex[:12]}"
        # Clean up AI-generated text (remove trailing periods from names/taglines)
        clean_biz_name = kit_data.get("business_name", hustle['name']).rstrip(".")
        clean_tagline = kit_data.get("tagline", "").rstrip(".")
        kit_doc = {
            "kit_id": kit_id, "hustle_id": hustle_id, "user_id": user_id,
            "business_name": clean_biz_name,
            "tagline": clean_tagline,
            "elevator_pitch": kit_data.get("elevator_pitch", ""),
            "social_posts": kit_data.get("social_posts", []),
            "brand_colors": kit_data.get("brand_colors", {}),
            "target_audience": kit_data.get("target_audience", ""),
            "marketing_strategy": kit_data.get("marketing_strategy", []),
            "launch_checklist": kit_data.get("launch_checklist", []),
            "pricing_tiers": kit_data.get("pricing_tiers", []),
            "landing_page_html": "",
            "landing_page_status": "generating",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.launch_kits.insert_one(kit_doc)
        await db.users.update_one({"user_id": user_id}, {"$inc": {"launch_kits_generated": 1}})
        # Mark job complete so user sees stage 1 results immediately
        await db.generation_jobs.update_one({"job_id": job_id}, {"$set": {"status": "complete"}})

        # ── Stage 2: Premium Landing Page (5 unique template variants) ──
        from templates import get_template
        biz_name = kit_data.get("business_name", hustle['name'])
        primary = kit_data.get("brand_colors", {}).get("primary", "#6366F1")
        accent = kit_data.get("brand_colors", {}).get("accent", "#EC4899")
        tagline = kit_data.get("tagline", hustle['name'])
        pitch = kit_data.get("elevator_pitch", hustle['description'])
        target = kit_data.get("target_audience", "")
        strategies = kit_data.get("marketing_strategy", [])
        pricing_tiers = kit_data.get("pricing_tiers", [])

        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "email": 1, "name": 1, "phone": 1})
        user_email = user_doc.get("email", "") if user_doc else ""
        user_name = user_doc.get("name", "") if user_doc else ""
        user_phone = user_doc.get("phone", "") if user_doc else ""

        # Pick template variant based on hustle name hash (deterministic but varied)
        variant = sum(ord(c) for c in hustle_id) % 5

        html = get_template(variant, {
            "biz_name": biz_name, "tagline": tagline, "pitch": pitch,
            "target": target, "primary": primary, "accent": accent,
            "email": user_email, "phone": user_phone, "name": user_name,
            "strategies": strategies, "pricing_tiers": pricing_tiers,
        })

        await db.launch_kits.update_one(
            {"kit_id": kit_id},
            {"$set": {"landing_page_html": html, "landing_page_status": "complete"}}
        )

    except Exception as e:
        logger.error(f"BG kit gen error: {e}")
        await db.generation_jobs.update_one({"job_id": job_id}, {"$set": {"status": "failed", "error": str(e)}})

def make_user_doc(user_id, email, name, auth_type, picture="", password_hash=None):
    doc = {
        "user_id": user_id, "email": email, "name": name, "picture": picture,
        "auth_type": auth_type, "subscription_tier": "free",
        "phone": "",
        "hustle_count": 0, "plans_generated": 0, "launch_kits_generated": 0,
        "trial_plan_used": False, "alacarte_plans_purchased": 0,
        "referral_code": generate_referral_code(),
        "referral_credits": 0.0, "referred_by": None,
        "questionnaire_completed": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if password_hash:
        doc["password_hash"] = password_hash
    return doc

# ─── AUTH ENDPOINTS ───
@api_router.post("/auth/register")
async def register(req: RegisterRequest):
    existing = await db.users.find_one({"email": req.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    password_hash = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = make_user_doc(user_id, req.email, req.name, "email", password_hash=password_hash)

    # Handle referral
    if req.referral_code:
        referrer = await db.users.find_one({"referral_code": req.referral_code}, {"_id": 0})
        if referrer:
            user_doc["referred_by"] = referrer["user_id"]
            user_doc["trial_plan_used"] = False  # gets 1 free plan via referral
            await db.users.update_one(
                {"user_id": referrer["user_id"]},
                {"$inc": {"referral_credits": REFERRAL_CREDIT}}
            )
            await db.referrals.insert_one({
                "referral_id": f"ref_{uuid.uuid4().hex[:12]}",
                "referrer_id": referrer["user_id"],
                "referred_id": user_id,
                "credit_amount": REFERRAL_CREDIT,
                "status": "completed",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

    await db.users.insert_one(user_doc)
    session_token = create_session_token()
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "session_token": session_token,
        "user": {"user_id": user_id, "email": req.email, "name": req.name,
                 "subscription_tier": "free", "questionnaire_completed": False,
                 "referral_code": user_doc["referral_code"]},
    }

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.get("auth_type") == "google":
        raise HTTPException(status_code=400, detail="This account uses Google sign-in")
    stored_hash = user.get("password_hash", "")
    if not stored_hash or not bcrypt.checkpw(req.password.encode('utf-8'), stored_hash.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    session_token = create_session_token()
    await db.user_sessions.insert_one({
        "user_id": user["user_id"], "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "session_token": session_token,
        "user": {"user_id": user["user_id"], "email": user["email"], "name": user["name"],
                 "subscription_tier": user.get("subscription_tier", "free"),
                 "questionnaire_completed": user.get("questionnaire_completed", False),
                 "referral_code": user.get("referral_code", "")},
    }

@api_router.get("/auth/session")
async def exchange_session(session_id: str):
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = resp.json()
    email, name, picture = data.get("email"), data.get("name", ""), data.get("picture", "")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name, "picture": picture}})
        user_data = existing
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_data = make_user_doc(user_id, email, name, "google", picture=picture)
        await db.users.insert_one(user_data)
    session_token = create_session_token()
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "session_token": session_token,
        "user": {"user_id": user_id, "email": email, "name": name, "picture": picture,
                 "subscription_tier": user_data.get("subscription_tier", "free"),
                 "questionnaire_completed": user_data.get("questionnaire_completed", False),
                 "referral_code": user_data.get("referral_code", "")},
    }

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

@api_router.post("/auth/logout")
async def logout(request: Request):
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        await db.user_sessions.delete_one({"session_token": auth_header.split(' ')[1]})
    return {"message": "Logged out"}

# ─── QUESTIONNAIRE ───
@api_router.get("/questionnaire/questions")
async def get_questions():
    return {"questions": QUESTIONNAIRE_QUESTIONS}

@api_router.post("/questionnaire/submit")
async def submit_questionnaire(submission: QuestionnaireSubmission, user: dict = Depends(get_current_user)):
    resume_extracted = ""
    if submission.resume_file_b64 and submission.resume_filename:
        try:
            resume_extracted = extract_text_from_file(submission.resume_file_b64, submission.resume_filename)
        except Exception as e:
            logger.error(f"Resume extraction error: {e}")
    final_resume = submission.resume_text or resume_extracted or ""
    response_id = f"qr_{uuid.uuid4().hex[:12]}"
    await db.questionnaire_responses.insert_one({
        "response_id": response_id, "user_id": user["user_id"],
        "answers": submission.answers, "additional_skills": submission.additional_skills or "",
        "resume_text": final_resume, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"questionnaire_completed": True}})
    return {"response_id": response_id, "message": "Questionnaire submitted"}

# ─── SIDE HUSTLE ENDPOINTS (Tiered: starter vs premium) ───
@api_router.post("/hustles/generate")
async def generate_hustles(user: dict = Depends(get_current_user)):
    qr = await db.questionnaire_responses.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not qr:
        raise HTTPException(status_code=400, detail="Complete the questionnaire first")
    answers = qr.get("answers", {})
    additional_skills = qr.get("additional_skills", "")
    resume_text = qr.get("resume_text", "")

    # Check if user has blue collar skills
    blue_collar_skills = answers.get('blue_collar', [])
    has_blue_collar = isinstance(blue_collar_skills, list) and len(blue_collar_skills) > 0 and 'None of these' not in blue_collar_skills
    if isinstance(blue_collar_skills, str):
        has_blue_collar = blue_collar_skills and blue_collar_skills != 'None of these'

    blue_collar_instruction = ""
    if has_blue_collar:
        skills_str = ', '.join(blue_collar_skills) if isinstance(blue_collar_skills, list) else blue_collar_skills
        blue_collar_instruction = f"""
MANDATORY BLUE COLLAR REQUIREMENT:
The user has these trade skills: {skills_str}
You MUST include AT LEAST 5 hustles that are DIRECTLY hands-on trade/labor businesses using these exact skills.
Examples: "Residential Bathroom Remodeling", "Emergency Plumbing Service", "Custom Deck Building", "Mobile Auto Detailing", "Commercial Painting Crew", "Appliance Repair Service", "Landscape Design & Installation", "Welding & Metal Fabrication Shop"
These must NOT be digital or online businesses. They must be physical, hands-on work.
"""

    prompt = f"""Generate exactly 12 UNIQUE side hustle recommendations for this user.

{blue_collar_instruction}

RULES:
- Every hustle must be completely different — no overlapping business models
- Mix of service, product, digital, and physical hustles
- Be SPECIFIC with business names (not generic like "Consulting" — say "SaaS Onboarding Audit Service")

Categories:
- First 5: "starter" tier — $100-$500/week, low startup cost
- Next 7: "premium" tier — $1000-$5000/week, may need investment

User Profile:
- Profession: {answers.get('profession', 'Not specified')}
- Skills: {answers.get('skills', 'Not specified')}
- Hours: {answers.get('hours_per_week', 'Not specified')}/week
- Budget: {answers.get('budget', 'Not specified')}
- Income goal: {answers.get('income_goal', 'Not specified')}/month
- Interests: {answers.get('interests', 'Not specified')}
- Risk: {answers.get('risk_tolerance', 'Not specified')}
- Work style: {answers.get('work_style', 'Not specified')}
- Tech: {answers.get('tech_comfort', 'Not specified')}
- Timeline: {answers.get('timeline', 'Not specified')}
- Trade skills: {answers.get('blue_collar', 'None')}
- Extra skills: {additional_skills or 'None'}
{f'- Resume: {resume_text[:300]}' if resume_text else ''}

Return ONLY JSON array of 12 objects with: "name", "description" (2 sentences), "potential_income", "difficulty" (Easy/Medium/Hard), "time_required", "category", "why_good_fit", "hustle_tier" (starter/premium)."""

    try:
        chat = LlmChat(
            api_key=emergent_key,
            session_id=f"hustle_gen_{user['user_id']}_{uuid.uuid4().hex[:6]}",
            system_message="You are an expert side hustle advisor. Always respond with valid JSON only."
        )
        chat.with_model("openai", "gpt-5.2")
        response = await chat.send_message(UserMessage(text=prompt))
        hustles_data = parse_json_from_response(response)
    except Exception as e:
        logger.error(f"AI generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate side hustles. Please try again.")

    created = []
    for h in hustles_data:
        hustle_id = f"hustle_{uuid.uuid4().hex[:12]}"
        tier_label = h.get("hustle_tier", classify_hustle_income(h.get("potential_income", "")))
        doc = {
            "hustle_id": hustle_id, "user_id": user["user_id"],
            "name": h.get("name", "Untitled"), "description": h.get("description", ""),
            "potential_income": h.get("potential_income", "Varies"),
            "difficulty": h.get("difficulty", "Medium"),
            "time_required": h.get("time_required", "Varies"),
            "category": h.get("category", "General"),
            "why_good_fit": h.get("why_good_fit", ""),
            "hustle_tier": tier_label,
            "is_premium": tier_label == "premium",
            "selected": False, "business_plan_generated": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.side_hustles.insert_one(doc)
        del doc["_id"]
        created.append(doc)
    await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"hustle_count": len(created)}})
    return {"hustles": created}

class IndustryRequest(BaseModel):
    industry: str

@api_router.post("/hustles/generate/industry")
async def generate_industry_hustles(req: IndustryRequest, user: dict = Depends(get_current_user)):
    """Generate hustles for a specific industry/niche."""
    industry = req.industry.strip()
    if not industry:
        raise HTTPException(status_code=400, detail="Industry required")
    qr = await db.questionnaire_responses.find_one({"user_id": user["user_id"]}, {"_id": 0})
    answers = qr.get("answers", {}) if qr else {}
    
    prompt = f"""Generate exactly 6 side hustle recommendations specifically within the "{industry}" industry/niche.

User Profile:
- Skills: {answers.get('skills', 'Not specified')}
- Hours: {answers.get('hours_per_week', '10-20')}/week
- Budget: {answers.get('budget', '$100-$500')}
- Income goal: {answers.get('income_goal', '$1000-$3000')}/mo

RULES:
- ALL 6 hustles must be directly related to {industry}
- Be creative and specific — don't give generic answers
- First 2: "starter" tier ($100-$500/week)
- Next 4: "premium" tier ($1000-$5000/week)

Return ONLY JSON array of 6 objects with: "name", "description" (2 sentences), "potential_income", "difficulty", "time_required", "category" (set to "{industry}"), "why_good_fit", "hustle_tier" (starter/premium)."""

    try:
        chat = LlmChat(api_key=emergent_key,
            session_id=f"ind_{user['user_id']}_{uuid.uuid4().hex[:6]}",
            system_message="Expert side hustle advisor. Return valid JSON only.")
        chat.with_model("openai", "gpt-5.2")
        response = await chat.send_message(UserMessage(text=prompt))
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        hustles_data = json.loads(cleaned.strip())
        if not isinstance(hustles_data, list):
            hustles_data = hustles_data.get("hustles", [])
    except Exception as e:
        logger.error(f"Industry generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate. Try again.")

    created = []
    for h in hustles_data:
        hustle_id = f"hustle_{uuid.uuid4().hex[:12]}"
        tier_label = h.get("hustle_tier", "starter")
        doc = {
            "hustle_id": hustle_id, "user_id": user["user_id"],
            "name": h.get("name", "Untitled"), "description": h.get("description", ""),
            "potential_income": h.get("potential_income", "Varies"),
            "difficulty": h.get("difficulty", "Medium"),
            "time_required": h.get("time_required", "Varies"),
            "category": industry,
            "why_good_fit": h.get("why_good_fit", ""),
            "hustle_tier": tier_label,
            "is_premium": tier_label == "premium",
            "industry_request": industry,
            "selected": False, "business_plan_generated": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.side_hustles.insert_one(doc)
        del doc["_id"]
        created.append(doc)
    return {"hustles": created, "industry": industry}

@api_router.get("/hustles")
async def get_hustles(user: dict = Depends(get_current_user)):
    hustles = await db.side_hustles.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    tier = user.get("subscription_tier", "free")
    result = []
    for h in hustles:
        h_copy = {**h}
        htier = h_copy.get("hustle_tier", classify_hustle_income(h_copy.get("potential_income", "")))
        h_copy["is_premium"] = htier == "premium"
        if tier == "free" and htier == "premium":
            h_copy["locked"] = True
            h_copy["original_name"] = h_copy["name"]
            h_copy["name"] = "Premium High-Revenue Hustle"
            h_copy["description"] = "Upgrade to unlock this high-revenue opportunity"
            h_copy["why_good_fit"] = ""
        else:
            h_copy["locked"] = False
        result.append(h_copy)
    # Sort: starter first, then premium
    result.sort(key=lambda x: (0 if x.get("hustle_tier") == "starter" else 1, x.get("created_at", "")))
    return {"hustles": result}

@api_router.get("/hustles/{hustle_id}")
async def get_hustle_detail(hustle_id: str, user: dict = Depends(get_current_user)):
    hustle = await db.side_hustles.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    if not hustle:
        raise HTTPException(status_code=404, detail="Side hustle not found")
    tier = user.get("subscription_tier", "free")
    htier = hustle.get("hustle_tier", classify_hustle_income(hustle.get("potential_income", "")))
    if tier == "free" and htier == "premium":
        hustle["locked"] = True
        hustle["name"] = "Premium High-Revenue Hustle"
        hustle["description"] = "Upgrade to unlock this high-revenue opportunity"
        hustle["why_good_fit"] = ""
    else:
        hustle["locked"] = False
    plan = await db.business_plans.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    return {"hustle": hustle, "business_plan": plan}

@api_router.post("/hustles/{hustle_id}/select")
async def select_hustle(hustle_id: str, user: dict = Depends(get_current_user)):
    hustle = await db.side_hustles.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    if not hustle:
        raise HTTPException(status_code=404, detail="Side hustle not found")
    await db.side_hustles.update_one({"hustle_id": hustle_id}, {"$set": {"selected": True}})
    return {"message": "Side hustle selected"}

# ─── BUSINESS PLAN ENDPOINTS ───
@api_router.get("/plans/access/{hustle_id}")
async def check_plan_access(hustle_id: str, user: dict = Depends(get_current_user)):
    tier = user.get("subscription_tier", "free")
    trial_used = user.get("trial_plan_used", False)
    plans_generated = user.get("plans_generated", 0)
    existing = await db.business_plans.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    if existing:
        return {"has_access": True, "reason": "already_generated", "plan_exists": True}
    alacarte = await db.payment_transactions.find_one(
        {"user_id": user["user_id"], "hustle_id": hustle_id, "payment_status": "paid", "plan_name": "alacarte"}, {"_id": 0})
    if alacarte:
        return {"has_access": True, "reason": "alacarte_purchased", "plan_exists": False}
    if tier in ("pro", "empire"):
        return {"has_access": True, "reason": f"{tier}_plan", "plan_exists": False}
    if tier == "starter":
        ti = SUBSCRIPTION_TIERS["starter"]
        if plans_generated < ti["plan_limit"]:
            return {"has_access": True, "reason": "starter_plan", "plan_exists": False, "remaining": ti["plan_limit"] - plans_generated}
        return {"has_access": False, "reason": "starter_limit_reached"}
    if not trial_used:
        return {"has_access": True, "reason": "free_trial", "plan_exists": False, "is_trial": True}
    return {"has_access": False, "reason": "free_plan_locked", "alacarte_price": ALACARTE_PLAN_PRICE}

@api_router.post("/plans/generate/{hustle_id}")
async def generate_business_plan(hustle_id: str, user: dict = Depends(get_current_user)):
    hustle = await db.side_hustles.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    if not hustle:
        raise HTTPException(status_code=404, detail="Side hustle not found")
    existing = await db.business_plans.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    if existing:
        return {"plan": existing, "status": "complete"}
    tier = user.get("subscription_tier", "free")
    trial_used = user.get("trial_plan_used", False)
    plans_generated = user.get("plans_generated", 0)
    if tier == "free":
        alacarte = await db.payment_transactions.find_one(
            {"user_id": user["user_id"], "hustle_id": hustle_id, "payment_status": "paid", "plan_name": "alacarte"}, {"_id": 0})
        if not alacarte and trial_used:
            raise HTTPException(status_code=403, detail="Upgrade or purchase à la carte ($4.99) to unlock.")
    elif tier == "starter" and plans_generated >= SUBSCRIPTION_TIERS["starter"]["plan_limit"]:
        raise HTTPException(status_code=403, detail="Starter limit reached. Upgrade to Pro or Empire!")

    # Check if already generating
    job_id = f"job_plan_{hustle_id}"
    existing_job = await db.generation_jobs.find_one({"job_id": job_id}, {"_id": 0})
    if existing_job and existing_job.get("status") == "generating":
        return {"status": "generating", "job_id": job_id}
    # If previously failed, allow retry
    if existing_job and existing_job.get("status") == "failed":
        await db.generation_jobs.delete_one({"job_id": job_id})

    # Start async generation
    qr = await db.questionnaire_responses.find_one({"user_id": user["user_id"]}, {"_id": 0})
    answers = qr.get("answers", {}) if qr else {}
    await db.generation_jobs.update_one(
        {"job_id": job_id},
        {"$set": {"job_id": job_id, "type": "plan", "hustle_id": hustle_id, "user_id": user["user_id"], "status": "generating", "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    asyncio.create_task(_bg_generate_plan(hustle_id, user["user_id"], hustle, answers, tier, trial_used))
    return {"status": "generating", "job_id": job_id}

@api_router.get("/generation/status/{job_id}")
async def get_generation_status(job_id: str, user: dict = Depends(get_current_user)):
    job = await db.generation_jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        return {"status": "not_found"}
    if job["status"] == "complete":
        # Return the generated result
        if job_id.startswith("job_plan_"):
            hustle_id = job_id.replace("job_plan_", "")
            plan = await db.business_plans.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
            return {"status": "complete", "plan": plan}
        elif job_id.startswith("job_kit_"):
            hustle_id = job_id.replace("job_kit_", "")
            kit = await db.launch_kits.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
            return {"status": "complete", "kit": kit}
    return {"status": job["status"], "error": job.get("error", "")}

@api_router.get("/plans/{hustle_id}")
async def get_business_plan(hustle_id: str, user: dict = Depends(get_current_user)):
    plan = await db.business_plans.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Business plan not found")
    return {"plan": plan}

# ─── LAUNCH KIT ENDPOINTS ───
@api_router.get("/launch-kit/access/{hustle_id}")
async def check_kit_access(hustle_id: str, user: dict = Depends(get_current_user)):
    existing = await db.launch_kits.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    if existing:
        return {"has_access": True, "reason": "already_generated", "kit_exists": True}
    tier = user.get("subscription_tier", "free")
    kits_generated = user.get("launch_kits_generated", 0)
    tier_info = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free"])
    if tier == "empire":
        return {"has_access": True, "reason": "empire_plan", "kit_exists": False}
    if tier in ("starter", "pro") and kits_generated < tier_info["launch_kit_limit"]:
        return {"has_access": True, "reason": f"{tier}_plan", "kit_exists": False, "remaining": tier_info["launch_kit_limit"] - kits_generated}
    alacarte = await db.payment_transactions.find_one(
        {"user_id": user["user_id"], "hustle_id": hustle_id, "payment_status": "paid", "plan_name": "alacarte_kit"}, {"_id": 0})
    if alacarte:
        return {"has_access": True, "reason": "alacarte_purchased", "kit_exists": False}
    return {"has_access": False, "reason": "upgrade_required", "alacarte_price": ALACARTE_KIT_PRICE}

@api_router.post("/launch-kit/generate/{hustle_id}")
async def generate_launch_kit(hustle_id: str, user: dict = Depends(get_current_user)):
    hustle = await db.side_hustles.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    if not hustle:
        raise HTTPException(status_code=404, detail="Hustle not found")
    existing = await db.launch_kits.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    if existing and existing.get("landing_page_html"):
        return {"kit": existing, "status": "complete"}
    # If kit exists but LP is missing, regenerate LP only
    if existing and not existing.get("landing_page_html"):
        try:
            from templates import get_template
            biz_name = existing.get("business_name", hustle.get("name", ""))
            variant = sum(ord(c) for c in hustle_id) % 5
            html = get_template(variant, {
                "biz_name": biz_name, "tagline": existing.get("tagline", ""),
                "pitch": existing.get("elevator_pitch", ""), "target": existing.get("target_audience", ""),
                "primary": existing.get("brand_colors", {}).get("primary", "#6366F1"),
                "accent": existing.get("brand_colors", {}).get("accent", "#EC4899"),
                "email": user.get("email", ""), "phone": user.get("phone", ""),
                "name": user.get("name", ""),
                "strategies": existing.get("marketing_strategy", []),
                "pricing_tiers": existing.get("pricing_tiers", []),
            })
            await db.launch_kits.update_one(
                {"hustle_id": hustle_id, "user_id": user["user_id"]},
                {"$set": {"landing_page_html": html, "landing_page_status": "complete"}}
            )
            existing["landing_page_html"] = html
            existing["landing_page_status"] = "complete"
            return {"kit": existing, "status": "complete"}
        except Exception as e:
            logger.error(f"LP regen error: {e}")
    # Access check
    tier = user.get("subscription_tier", "free")
    kits_gen = user.get("launch_kits_generated", 0)
    tier_info = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free"])
    if tier == "free":
        alacarte = await db.payment_transactions.find_one(
            {"user_id": user["user_id"], "hustle_id": hustle_id, "payment_status": "paid", "plan_name": "alacarte_kit"}, {"_id": 0})
        if not alacarte:
            raise HTTPException(status_code=403, detail="Purchase a Launch Kit ($2.99) or upgrade your plan.")
    elif tier != "empire" and kits_gen >= tier_info["launch_kit_limit"]:
        alacarte = await db.payment_transactions.find_one(
            {"user_id": user["user_id"], "hustle_id": hustle_id, "payment_status": "paid", "plan_name": "alacarte_kit"}, {"_id": 0})
        if not alacarte:
            raise HTTPException(status_code=403, detail="Launch kit limit reached. Buy à la carte ($2.99) or upgrade.")

    # Check if already generating
    job_id = f"job_kit_{hustle_id}"
    existing_job = await db.generation_jobs.find_one({"job_id": job_id}, {"_id": 0})
    if existing_job and existing_job.get("status") == "generating":
        return {"status": "generating", "job_id": job_id}
    # If previously failed, allow retry
    if existing_job and existing_job.get("status") == "failed":
        await db.generation_jobs.delete_one({"job_id": job_id})

    # Start async generation
    await db.generation_jobs.update_one(
        {"job_id": job_id},
        {"$set": {"job_id": job_id, "type": "kit", "hustle_id": hustle_id, "user_id": user["user_id"], "status": "generating", "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    asyncio.create_task(_bg_generate_kit(hustle_id, user["user_id"], hustle))
    return {"status": "generating", "job_id": job_id}

@api_router.get("/launch-kit/{hustle_id}")
async def get_launch_kit(hustle_id: str, user: dict = Depends(get_current_user)):
    kit = await db.launch_kits.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    if not kit:
        raise HTTPException(status_code=404, detail="Launch kit not found")
    return {"kit": kit}

# ─── REFERRAL ENDPOINTS ───
@api_router.get("/referral/info")
async def get_referral_info(user: dict = Depends(get_current_user)):
    code = user.get("referral_code", "")
    credits = user.get("referral_credits", 0.0)
    count = await db.referrals.count_documents({"referrer_id": user["user_id"]})
    return {"referral_code": code, "credits": credits, "total_referrals": count,
            "credit_per_referral": REFERRAL_CREDIT}

# ─── PAYMENT ENDPOINTS ───
@api_router.post("/payments/create-checkout")
async def create_checkout(req: CheckoutRequest, user: dict = Depends(get_current_user)):
    valid = ["starter", "pro", "empire", "alacarte", "alacarte_kit"]
    if req.plan not in valid:
        raise HTTPException(status_code=400, detail="Invalid plan")
    origin_url = req.origin_url.rstrip('/')

    if req.plan == "alacarte":
        if not req.hustle_id:
            raise HTTPException(status_code=400, detail="hustle_id required")
        amount = float(ALACARTE_PLAN_PRICE)
        success_url = f"{origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}&type=alacarte&hustle_id={req.hustle_id}"
        metadata = {"user_id": user["user_id"], "plan": "alacarte", "plan_name": "alacarte", "hustle_id": req.hustle_id}
    elif req.plan == "alacarte_kit":
        if not req.hustle_id:
            raise HTTPException(status_code=400, detail="hustle_id required")
        amount = float(ALACARTE_KIT_PRICE)
        success_url = f"{origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}&type=alacarte_kit&hustle_id={req.hustle_id}"
        metadata = {"user_id": user["user_id"], "plan": "alacarte_kit", "plan_name": "alacarte_kit", "hustle_id": req.hustle_id}
    else:
        tier = SUBSCRIPTION_TIERS[req.plan]
        amount = float(tier["price"])
        success_url = f"{origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}&type=subscription"
        metadata = {"user_id": user["user_id"], "plan": req.plan, "plan_name": tier["name"]}

    cancel_url = f"{origin_url}/pricing"
    webhook_url = f"{origin_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_key, webhook_url=webhook_url)
    checkout_req = CheckoutSessionRequest(amount=amount, currency="usd", success_url=success_url, cancel_url=cancel_url, metadata=metadata)
    session = await stripe_checkout.create_checkout_session(checkout_req)

    txn = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}", "user_id": user["user_id"],
        "session_id": session.session_id, "amount": amount, "currency": "usd",
        "plan_name": req.plan, "status": "initiated", "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if req.hustle_id:
        txn["hustle_id"] = req.hustle_id
    await db.payment_transactions.insert_one(txn)
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, user: dict = Depends(get_current_user)):
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.get("payment_status") == "paid":
        return {"status": "complete", "payment_status": "paid", "plan": txn.get("plan_name")}
    try:
        sc = StripeCheckout(api_key=stripe_key, webhook_url="https://placeholder.com/api/webhook/stripe")
        sr = await sc.get_checkout_status(session_id)
        await db.payment_transactions.update_one({"session_id": session_id}, {"$set": {"status": sr.status, "payment_status": sr.payment_status, "updated_at": datetime.now(timezone.utc).isoformat()}})
        if sr.payment_status == "paid":
            pn = txn.get("plan_name", "starter")
            if pn in ("alacarte", "alacarte_kit"):
                inc_field = "alacarte_plans_purchased" if pn == "alacarte" else "launch_kits_generated"
                await db.users.update_one({"user_id": txn["user_id"]}, {"$inc": {inc_field: 0}})  # just mark paid
            else:
                await db.users.update_one({"user_id": txn["user_id"]}, {"$set": {"subscription_tier": pn}})
        return {"status": sr.status, "payment_status": sr.payment_status, "plan": txn.get("plan_name")}
    except Exception as e:
        logger.error(f"Payment status error: {e}")
        return {"status": txn.get("status", "unknown"), "payment_status": txn.get("payment_status", "unknown"), "plan": txn.get("plan_name")}

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        sc = StripeCheckout(api_key=stripe_key, webhook_url=str(request.base_url) + "api/webhook/stripe")
        wr = await sc.handle_webhook(body, sig)
        if wr and wr.payment_status == "paid":
            sid = wr.session_id
            meta = wr.metadata or {}
            txn = await db.payment_transactions.find_one({"session_id": sid}, {"_id": 0})
            if txn and txn.get("payment_status") != "paid":
                await db.payment_transactions.update_one({"session_id": sid}, {"$set": {"status": "complete", "payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}})
                pn = meta.get("plan", txn.get("plan_name", "starter"))
                uid = meta.get("user_id", txn.get("user_id"))
                if uid:
                    if pn in ("alacarte", "alacarte_kit"):
                        pass  # already tracked
                    else:
                        await db.users.update_one({"user_id": uid}, {"$set": {"subscription_tier": pn}})
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}

# ─── PROFILE ───
@api_router.get("/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    tier = user.get("subscription_tier", "free")
    ti = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free"])
    hustle_count = await db.side_hustles.count_documents({"user_id": user["user_id"]})
    plan_count = await db.business_plans.count_documents({"user_id": user["user_id"]})
    kit_count = await db.launch_kits.count_documents({"user_id": user["user_id"]})
    trial_used = user.get("trial_plan_used", False)
    plans_gen = user.get("plans_generated", 0)
    kits_gen = user.get("launch_kits_generated", 0)
    referral_count = await db.referrals.count_documents({"referrer_id": user["user_id"]})

    if tier in ("pro", "empire"):
        remaining_plans = 999999
    elif tier == "starter":
        remaining_plans = max(0, ti["plan_limit"] - plans_gen)
    else:
        remaining_plans = 0 if trial_used else 1

    if tier == "empire":
        remaining_kits = 999999
    elif tier in ("starter", "pro"):
        remaining_kits = max(0, ti["launch_kit_limit"] - kits_gen)
    else:
        remaining_kits = 0

    return {
        "user": user,
        "subscription": {"tier": tier, "name": ti["name"], "plan_limit": ti["plan_limit"],
                         "launch_kit_limit": ti["launch_kit_limit"], "price": ti["price"], "description": ti.get("description", "")},
        "stats": {"total_hustles": hustle_count, "plans_generated": plan_count, "kits_generated": kit_count,
                  "remaining_plans": remaining_plans, "remaining_kits": remaining_kits,
                  "trial_used": trial_used, "referral_code": user.get("referral_code", ""),
                  "referral_credits": user.get("referral_credits", 0), "referral_count": referral_count},
        "alacarte_plan_price": ALACARTE_PLAN_PRICE, "alacarte_kit_price": ALACARTE_KIT_PRICE,
    }

@api_router.get("/subscription/tiers")
async def get_tiers():
    return {"tiers": SUBSCRIPTION_TIERS, "alacarte_plan_price": ALACARTE_PLAN_PRICE, "alacarte_kit_price": ALACARTE_KIT_PRICE}

# ─── PROFILE UPDATE (phone) ───
@api_router.put("/profile/phone")
async def update_phone(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    phone = body.get("phone", "")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"phone": phone}})
    return {"status": "ok"}

# ─── LANDING PAGE CUSTOMIZATION ───
@api_router.put("/launch-kit/{hustle_id}/customize")
async def customize_landing_page(hustle_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Let users update their landing page contact links and info."""
    body = await request.json()
    kit = await db.launch_kits.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    if not kit:
        raise HTTPException(status_code=404, detail="Launch kit not found")
    
    email = body.get("email", "") or user.get("email", "")
    phone = body.get("phone", "")
    name = body.get("name", "") or user.get("name", "")
    website = body.get("website", "")
    instagram = body.get("instagram", "")
    facebook = body.get("facebook", "")
    
    # Update user profile
    profile_updates: Dict[str, Any] = {}
    if phone:
        profile_updates["phone"] = phone
    if name and name != user.get("name"):
        profile_updates["name"] = name
    if profile_updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": profile_updates})
    
    # Save custom links
    custom_links = {"email": email, "phone": phone, "name": name, "website": website, "instagram": instagram, "facebook": facebook}
    
    # Regenerate the landing page from template with updated contact info
    hustle = await db.side_hustles.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    from templates import get_template
    biz_name = kit.get("business_name", hustle.get("name", "") if hustle else "")
    variant = sum(ord(c) for c in hustle_id) % 5
    html = get_template(variant, {
        "biz_name": biz_name, "tagline": kit.get("tagline", ""),
        "pitch": kit.get("elevator_pitch", ""), "target": kit.get("target_audience", ""),
        "primary": kit.get("brand_colors", {}).get("primary", "#6366F1"),
        "accent": kit.get("brand_colors", {}).get("accent", "#EC4899"),
        "email": email, "phone": phone, "name": name,
        "strategies": kit.get("marketing_strategy", []),
        "pricing_tiers": kit.get("pricing_tiers", []),
    })
    
    await db.launch_kits.update_one(
        {"hustle_id": hustle_id, "user_id": user["user_id"]},
        {"$set": {"landing_page_html": html, "custom_links": custom_links}}
    )
    return {"status": "ok", "html": html}

# ─── BETA NDA & FEEDBACK ───

# Serve the launch guide PDF
@api_router.get("/launch-guide")
async def download_launch_guide():
    return FileResponse("/app/frontend/assets/HustleAI_Launch_Guide.pdf", media_type="application/pdf", filename="HustleAI_Launch_Guide.pdf")

@api_router.post("/beta/accept-nda")
async def accept_nda(user: dict = Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"nda_accepted": True, "nda_accepted_at": datetime.now(timezone.utc).isoformat()}})
    return {"status": "ok"}

@api_router.get("/beta/nda-status")
async def nda_status(user: dict = Depends(get_current_user)):
    return {"accepted": bool(user.get("nda_accepted", False))}

class FeedbackRequest(BaseModel):
    category: str = "general"
    rating: int = 5
    message: str

@api_router.post("/beta/feedback")
async def submit_feedback(req: FeedbackRequest, user: dict = Depends(get_current_user)):
    feedback = {
        "user_id": user["user_id"],
        "email": user.get("email", ""),
        "name": user.get("name", ""),
        "category": req.category,
        "rating": req.rating,
        "message": req.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.beta_feedback.insert_one(feedback)
    return {"status": "ok"}

@api_router.get("/beta/feedback")
async def get_feedback(user: dict = Depends(get_current_user)):
    feedbacks = await db.beta_feedback.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"feedbacks": feedbacks}

# ─── PROMO CODE (Beta Testing) ───
BETA_PROMO_CODE = "HUSTLEVIP2025"

class PromoRequest(BaseModel):
    code: str

@api_router.post("/promo/redeem")
async def redeem_promo(req: PromoRequest, user: dict = Depends(get_current_user)):
    code = req.code.strip().upper()
    if code != BETA_PROMO_CODE:
        raise HTTPException(status_code=400, detail="Invalid promo code")
    # Check if already redeemed
    existing = await db.promo_redemptions.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if existing:
        return {"status": "already_redeemed", "message": "You've already redeemed this code!", "tier": "empire"}
    # Upgrade user to empire
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"subscription_tier": "empire"}})
    await db.promo_redemptions.insert_one({
        "user_id": user["user_id"],
        "code": code,
        "redeemed_at": datetime.now(timezone.utc).isoformat(),
    })
    logger.info(f"Beta promo redeemed by {user['user_id']} ({user.get('email', '')})")
    return {"status": "success", "message": "Welcome to the beta! You now have full Empire access.", "tier": "empire"}

# ─── AI AGENTS SYSTEM ───
AI_AGENTS = {
    "mentor": {
        "name": "AI Mentor",
        "icon": "sparkles",
        "description": "Your personal business coach — ask about strategy, growth, or any business question",
        "color": "#E5A93E",
        "min_tier": "starter",
        "system_prefix": "You are an expert business mentor.",
        "prompts": [
            "How do I find my first client?",
            "What should I charge for my services?",
            "How do I stand out from competitors?",
            "What's the fastest path to $1000/month?",
            "How do I scale beyond a one-person operation?",
        ],
    },
    "marketing": {
        "name": "Marketing Agent",
        "icon": "megaphone",
        "description": "Expert in social media, paid ads, SEO, and customer acquisition strategies",
        "color": "#EC4899",
        "min_tier": "pro",
        "system_prefix": "You are a world-class digital marketing strategist specializing in small business growth.",
        "prompts": [
            "Write me 5 social media posts for this week",
            "Create a 30-day content calendar",
            "What's the best paid ad strategy on a $200 budget?",
            "How do I get my first 100 followers?",
            "Write an email sequence to convert leads",
        ],
    },
    "content": {
        "name": "Content Writer",
        "icon": "create",
        "description": "Creates blog posts, email campaigns, ad copy, and SEO-optimized content",
        "color": "#8B5CF6",
        "min_tier": "empire",
        "system_prefix": "You are an expert content writer and copywriter who creates engaging, conversion-optimized content.",
        "prompts": [
            "Write a blog post introducing my business",
            "Create an elevator pitch I can use at events",
            "Write a cold outreach email template",
            "Create a compelling About page for my website",
            "Draft 3 testimonial request emails",
        ],
    },
    "finance": {
        "name": "Finance Advisor",
        "icon": "calculator",
        "description": "Helps with pricing strategy, revenue projections, budgets, and financial planning",
        "color": "#22C55E",
        "min_tier": "empire",
        "system_prefix": "You are a financial advisor specializing in small business and side hustle economics.",
        "prompts": [
            "Create a monthly budget breakdown for my hustle",
            "What pricing model maximizes my revenue?",
            "Project my revenue for the next 6 months",
            "What tax deductions can I claim?",
            "How much should I reinvest vs take home?",
        ],
    },
}

@api_router.get("/agents")
async def get_agents(user: dict = Depends(get_current_user)):
    tier = user.get("subscription_tier", "free")
    tier_order = ["free", "starter", "pro", "empire"]
    user_level = tier_order.index(tier) if tier in tier_order else 0
    agents = []
    for key, agent in AI_AGENTS.items():
        min_level = tier_order.index(agent["min_tier"]) if agent["min_tier"] in tier_order else 4
        # Check a la carte purchase
        alacarte_purchased = (user.get("alacarte_agents") or [])
        has_access = user_level >= min_level or key in alacarte_purchased or key == "mentor"
        agents.append({
            "id": key,
            "name": agent["name"],
            "icon": agent["icon"],
            "description": agent["description"],
            "color": agent["color"],
            "locked": not has_access,
            "min_tier": agent["min_tier"],
            "prompts": agent.get("prompts", []),
            "alacarte_price": ALACARTE_AGENT_PRICES.get(key, {}).get("price"),
        })
    return {"agents": agents, "alacarte_prices": ALACARTE_AGENT_PRICES, "agent_pack_price": ALACARTE_AGENT_PACK_PRICE}

# Save agent conversation to DB after each message
async def _save_agent_message(user_id: str, hustle_id: str, agent_id: str, role: str, text: str):
    await db.agent_conversations.update_one(
        {"user_id": user_id, "hustle_id": hustle_id, "agent_id": agent_id},
        {"$push": {"messages": {"role": role, "text": text, "ts": datetime.now(timezone.utc).isoformat()}}},
        upsert=True
    )

@api_router.get("/agents/{hustle_id}/history/{agent_id}")
async def get_agent_history(hustle_id: str, agent_id: str, user: dict = Depends(get_current_user)):
    conv = await db.agent_conversations.find_one(
        {"user_id": user["user_id"], "hustle_id": hustle_id, "agent_id": agent_id},
        {"_id": 0, "messages": 1}
    )
    return {"messages": conv.get("messages", []) if conv else []}

class AgentChatRequest(BaseModel):
    message: str
    agent_id: str = "mentor"

@api_router.post("/agents/{hustle_id}/chat")
async def agent_chat(hustle_id: str, req: AgentChatRequest, user: dict = Depends(get_current_user)):
    tier = user.get("subscription_tier", "free")
    tier_order = ["free", "starter", "pro", "empire"]
    user_level = tier_order.index(tier) if tier in tier_order else 0

    agent = AI_AGENTS.get(req.agent_id)
    if not agent:
        raise HTTPException(status_code=400, detail="Unknown agent")

    min_level = tier_order.index(agent["min_tier"]) if agent["min_tier"] in tier_order else 4
    alacarte_purchased = (user.get("alacarte_agents") or [])
    has_access = user_level >= min_level or req.agent_id in alacarte_purchased or req.agent_id == "mentor"
    if not has_access:
        price = ALACARTE_AGENT_PRICES.get(req.agent_id, {}).get("price", 4.99)
        raise HTTPException(status_code=403, detail=f"{agent['name']} requires {agent['min_tier'].title()} plan or higher. Or purchase a la carte for ${price}/mo!")

    message = req.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message required")

    hustle = await db.side_hustles.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    if not hustle:
        raise HTTPException(status_code=404, detail="Hustle not found")

    plan = await db.business_plans.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    kit = await db.launch_kits.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})

    system = f"""{agent['system_prefix']}

You are helping with: {hustle['name']} — {hustle.get('description', '')}
Category: {hustle.get('category', '')}
Potential income: {hustle.get('potential_income', '')}
User's name: {user.get('name', '')}
{'Business plan: ' + plan.get('overview', '')[:300] if plan else ''}
{'Brand: ' + kit.get('business_name', '') + ' | Tagline: ' + kit.get('tagline', '') if kit else ''}

Give specific, actionable advice. Be concise (2-3 paragraphs max). End with a specific action item.

IMPORTANT: Write in plain conversational text. No asterisks, hashtags, backticks, or markdown. Use line breaks between paragraphs."""

    try:
        chat = LlmChat(api_key=emergent_key,
            session_id=f"agent_{req.agent_id}_{user['user_id']}_{hustle_id}_{uuid.uuid4().hex[:4]}",
            system_message=system)
        chat.with_model("openai", "gpt-5.2")
        response = await chat.send_message(UserMessage(text=message))
        import re
        clean = re.sub(r'\*{1,3}([^*]+)\*{1,3}', r'\1', response)
        clean = re.sub(r'^#{1,6}\s*', '', clean, flags=re.MULTILINE)
        clean = re.sub(r'`([^`]+)`', r'\1', clean)
        # Save conversation to DB
        await _save_agent_message(user["user_id"], hustle_id, req.agent_id, "user", message)
        await _save_agent_message(user["user_id"], hustle_id, req.agent_id, "ai", clean)
        return {"response": clean, "agent_id": req.agent_id, "agent_name": agent["name"]}
    except Exception as e:
        logger.error(f"Agent {req.agent_id} error: {e}")
        raise HTTPException(status_code=500, detail="Agent is temporarily unavailable. Please try again.")

# ─── AI MENTOR ───
class MentorRequest(BaseModel):
    message: str

@api_router.post("/mentor/{hustle_id}/chat")
async def mentor_chat(hustle_id: str, req: MentorRequest, user: dict = Depends(get_current_user)):
    tier = user.get("subscription_tier", "free")
    if tier == "free":
        raise HTTPException(status_code=403, detail="AI Mentor is available on Starter, Pro, and Empire plans. Upgrade to get personalized coaching!")
    message = req.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message required")
    hustle = await db.side_hustles.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    if not hustle:
        raise HTTPException(status_code=404, detail="Hustle not found")
    plan = await db.business_plans.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    qr = await db.questionnaire_responses.find_one({"user_id": user["user_id"]}, {"_id": 0})

    system = f"""You are an expert AI business mentor for {hustle['name']} — a {hustle.get('category', '')} side hustle.
Business description: {hustle.get('description', '')}
Potential income: {hustle.get('potential_income', '')}
User's name: {user.get('name', '')}
{'Business plan overview: ' + plan.get('overview', '')[:300] if plan else ''}
{'User skills: ' + str(qr.get('answers', {}).get('skills', '')) if qr else ''}
{'Blue collar skills: ' + str(qr.get('answers', {}).get('blue_collar', '')) if qr else ''}

You are a hands-on, experienced mentor. Give specific, actionable advice. Be encouraging but realistic. If asked about pricing, give specific numbers. If asked about finding clients, give specific strategies. Keep responses concise (2-3 paragraphs max). End with a specific action item the user should do TODAY.

IMPORTANT: Do NOT use any markdown formatting. No asterisks, no hashtags, no backticks, no bullet points with dashes. Write in plain conversational text only. Use line breaks between paragraphs."""

    try:
        chat = LlmChat(api_key=emergent_key,
            session_id=f"mentor_{user['user_id']}_{hustle_id}_{uuid.uuid4().hex[:4]}",
            system_message=system)
        chat.with_model("openai", "gpt-5.2")
        response = await chat.send_message(UserMessage(text=message))
        # Strip markdown formatting (asterisks, hashtags) for clean display
        import re
        clean = re.sub(r'\*{1,3}([^*]+)\*{1,3}', r'\1', response)  # Remove bold/italic markers
        clean = re.sub(r'^#{1,6}\s*', '', clean, flags=re.MULTILINE)  # Remove heading markers
        clean = re.sub(r'`([^`]+)`', r'\1', clean)  # Remove inline code markers
        return {"response": clean}
    except Exception as e:
        logger.error(f"Mentor error: {e}")
        raise HTTPException(status_code=500, detail="Mentor is temporarily unavailable. Try again.")

# ─── ACHIEVEMENT DEFINITIONS ───
ACHIEVEMENTS = [
    {"id": "first_hustle", "name": "Side Hustle Explorer", "desc": "Generated your first side hustle recommendations", "icon": "rocket", "condition": "hustles >= 1"},
    {"id": "five_hustles", "name": "Opportunity Hunter", "desc": "Discovered 5+ side hustles", "icon": "search", "condition": "hustles >= 5"},
    {"id": "first_plan", "name": "Strategist", "desc": "Generated your first business plan", "icon": "document-text", "condition": "plans >= 1"},
    {"id": "first_kit", "name": "Launch Ready", "desc": "Created your first Launch Kit", "icon": "briefcase", "condition": "kits >= 1"},
    {"id": "first_earning", "name": "First Dollar", "desc": "Logged your first earning", "icon": "cash", "condition": "earnings >= 1"},
    {"id": "hundred_earned", "name": "Benjamin Club", "desc": "Earned $100+ from side hustles", "icon": "trophy", "condition": "total_earned >= 100"},
    {"id": "thousand_earned", "name": "4-Figure Hustler", "desc": "Earned $1,000+ from side hustles", "icon": "diamond", "condition": "total_earned >= 1000"},
    {"id": "streak_3", "name": "On Fire", "desc": "Completed tasks 3 days in a row", "icon": "flame", "condition": "streak >= 3"},
    {"id": "streak_7", "name": "Unstoppable", "desc": "7-day task completion streak", "icon": "flash", "condition": "streak >= 7"},
    {"id": "streak_30", "name": "Legend", "desc": "30-day streak — you're a machine", "icon": "star", "condition": "streak >= 30"},
    {"id": "first_post", "name": "Community Voice", "desc": "Shared your first win with the community", "icon": "megaphone", "condition": "posts >= 1"},
    {"id": "referrer", "name": "Growth Agent", "desc": "Referred your first friend", "icon": "people", "condition": "referrals >= 1"},
]

MOTIVATION_MESSAGES = [
    "You're leaving ${weekly} this week on the table if you skip today. Let's get to work! 💰",
    "People in your niche are earning ${monthly}/month right now. Complete today's tasks and join them! 🔥",
    "${weekly}/week doesn't happen by accident. It takes {tasks} tasks today — you've got this! 💪",
    "Day {day} of 30 — you're {percent}% to your first ${monthly} month. Don't stop now! 🚀",
    "The top 1% of hustlers show up daily. ${weekly}/week is {tasks} tasks away. Let's go! ⚡",
    "Imagine depositing ${monthly} this month from your side hustle. Today's tasks make it real. 💎",
    "Every day you skip costs you ${weekly} this week. Crush today's {tasks} tasks in {minutes} minutes! 🎯",
]

# ─── TASK COMPLETION ENDPOINTS ───
@api_router.post("/tasks/{hustle_id}/complete")
async def complete_task(hustle_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    day = body.get("day")
    task_index = body.get("task_index")
    completed = body.get("completed", True)
    if day is None or task_index is None:
        raise HTTPException(status_code=400, detail="day and task_index required")
    key = f"{hustle_id}_{day}_{task_index}"
    if completed:
        await db.task_completions.update_one(
            {"user_id": user["user_id"], "key": key},
            {"$set": {"user_id": user["user_id"], "key": key, "hustle_id": hustle_id,
                      "day": day, "task_index": task_index, "completed_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True)
    else:
        await db.task_completions.delete_one({"user_id": user["user_id"], "key": key})
    return {"status": "ok"}

@api_router.get("/tasks/{hustle_id}/progress")
async def get_task_progress(hustle_id: str, user: dict = Depends(get_current_user)):
    completions = await db.task_completions.find(
        {"user_id": user["user_id"], "hustle_id": hustle_id}, {"_id": 0}).to_list(500)
    completed_keys = {c["key"] for c in completions}
    plan = await db.business_plans.find_one({"hustle_id": hustle_id, "user_id": user["user_id"]}, {"_id": 0})
    total_tasks = sum(len(d.get("tasks", [])) for d in (plan or {}).get("daily_tasks", []))
    completed_count = len(completed_keys)
    return {"completed_keys": list(completed_keys), "completed_count": completed_count,
            "total_tasks": total_tasks, "percent": round(completed_count / max(total_tasks, 1) * 100)}

@api_router.get("/tasks/streak")
async def get_streak(user: dict = Depends(get_current_user)):
    completions = await db.task_completions.find(
        {"user_id": user["user_id"]}, {"_id": 0}).sort("completed_at", -1).to_list(1000)
    if not completions:
        return {"current_streak": 0, "longest_streak": 0, "total_completed": 0}
    dates = set()
    for c in completions:
        try:
            dt = datetime.fromisoformat(c["completed_at"]).date()
            dates.add(dt)
        except Exception:
            pass
    today = datetime.now(timezone.utc).date()
    streak = 0
    d = today
    while d in dates:
        streak += 1
        d = d - timedelta(days=1)
    if today not in dates and (today - timedelta(days=1)) in dates:
        streak = 0
        d = today - timedelta(days=1)
        while d in dates:
            streak += 1
            d = d - timedelta(days=1)
    sorted_dates = sorted(dates)
    longest = 1 if sorted_dates else 0
    current_run = 1
    for i in range(1, len(sorted_dates)):
        if (sorted_dates[i] - sorted_dates[i-1]).days == 1:
            current_run += 1
            longest = max(longest, current_run)
        else:
            current_run = 1
    return {"current_streak": streak, "longest_streak": longest, "total_completed": len(completions)}

# ─── EARNINGS TRACKER ENDPOINTS ───
@api_router.post("/earnings/log")
async def log_earning(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    amount = body.get("amount", 0)
    hustle_id = body.get("hustle_id")
    note = body.get("note", "")
    date = body.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    if not amount or amount <= 0:
        raise HTTPException(status_code=400, detail="Valid amount required")
    earning_id = f"earn_{uuid.uuid4().hex[:12]}"
    await db.earnings.insert_one({
        "earning_id": earning_id, "user_id": user["user_id"], "hustle_id": hustle_id,
        "amount": float(amount), "note": note, "date": date,
        "created_at": datetime.now(timezone.utc).isoformat()})
    return {"earning_id": earning_id, "status": "ok"}

@api_router.get("/earnings")
async def get_earnings(user: dict = Depends(get_current_user)):
    earnings = await db.earnings.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).to_list(500)
    return {"earnings": earnings}

@api_router.get("/earnings/summary")
async def get_earnings_summary(user: dict = Depends(get_current_user)):
    earnings = await db.earnings.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    total = sum(e.get("amount", 0) for e in earnings)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    this_week_start = (datetime.now(timezone.utc) - timedelta(days=datetime.now(timezone.utc).weekday())).strftime("%Y-%m-%d")
    this_month = datetime.now(timezone.utc).strftime("%Y-%m")
    week_total = sum(e["amount"] for e in earnings if e.get("date", "") >= this_week_start)
    month_total = sum(e["amount"] for e in earnings if e.get("date", "").startswith(this_month))
    today_total = sum(e["amount"] for e in earnings if e.get("date", "") == today)
    return {"total": total, "today": today_total, "this_week": week_total, "this_month": month_total, "count": len(earnings)}

# ─── ACHIEVEMENTS ENDPOINTS ───
@api_router.get("/achievements")
async def get_achievements(user: dict = Depends(get_current_user)):
    unlocked = await db.user_achievements.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(50)
    unlocked_ids = {a["achievement_id"] for a in unlocked}
    hustle_count = await db.side_hustles.count_documents({"user_id": user["user_id"]})
    plan_count = await db.business_plans.count_documents({"user_id": user["user_id"]})
    kit_count = await db.launch_kits.count_documents({"user_id": user["user_id"]})
    earnings = await db.earnings.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    total_earned = sum(e.get("amount", 0) for e in earnings)
    streak_data = await get_streak.__wrapped__(user) if hasattr(get_streak, '__wrapped__') else {"current_streak": 0}
    streak = streak_data.get("current_streak", 0) if isinstance(streak_data, dict) else 0
    post_count = await db.community_posts.count_documents({"user_id": user["user_id"]})
    ref_count = await db.referrals.count_documents({"referrer_id": user["user_id"]})
    metrics = {"hustles": hustle_count, "plans": plan_count, "kits": kit_count,
               "earnings": len(earnings), "total_earned": total_earned, "streak": streak,
               "posts": post_count, "referrals": ref_count}
    newly_unlocked = []
    for ach in ACHIEVEMENTS:
        if ach["id"] in unlocked_ids:
            continue
        cond = ach["condition"]
        parts = cond.split(" ")
        if len(parts) == 3:
            metric_val = metrics.get(parts[0], 0)
            threshold = float(parts[2])
            if parts[1] == ">=" and metric_val >= threshold:
                await db.user_achievements.insert_one({
                    "user_id": user["user_id"], "achievement_id": ach["id"],
                    "unlocked_at": datetime.now(timezone.utc).isoformat()})
                unlocked_ids.add(ach["id"])
                newly_unlocked.append(ach["id"])
    result = []
    for ach in ACHIEVEMENTS:
        result.append({**ach, "unlocked": ach["id"] in unlocked_ids})
    return {"achievements": result, "newly_unlocked": newly_unlocked}

# ─── COMMUNITY WINS BOARD ───
@api_router.post("/community/posts")
async def create_community_post(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    content = body.get("content", "").strip()
    milestone = body.get("milestone", "")
    amount = body.get("amount")
    if not content:
        raise HTTPException(status_code=400, detail="Content required")
    post_id = f"post_{uuid.uuid4().hex[:12]}"
    await db.community_posts.insert_one({
        "post_id": post_id, "user_id": user["user_id"],
        "author_name": user.get("name", "Anonymous"),
        "author_tier": user.get("subscription_tier", "free"),
        "content": content, "milestone": milestone,
        "amount": float(amount) if amount else None,
        "reactions": 0, "reacted_by": [],
        "created_at": datetime.now(timezone.utc).isoformat()})
    return {"post_id": post_id}

@api_router.get("/community/posts")
async def get_community_posts(user: dict = Depends(get_current_user)):
    posts = await db.community_posts.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"posts": posts}

@api_router.post("/community/posts/{post_id}/react")
async def react_to_post(post_id: str, user: dict = Depends(get_current_user)):
    post = await db.community_posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    reacted = post.get("reacted_by", [])
    if user["user_id"] in reacted:
        await db.community_posts.update_one({"post_id": post_id},
            {"$inc": {"reactions": -1}, "$pull": {"reacted_by": user["user_id"]}})
    else:
        await db.community_posts.update_one({"post_id": post_id},
            {"$inc": {"reactions": 1}, "$push": {"reacted_by": user["user_id"]}})
    return {"status": "ok"}

# ─── DAILY MOTIVATION ───
@api_router.get("/motivation/daily")
async def get_daily_motivation(user: dict = Depends(get_current_user)):
    hustles = await db.side_hustles.find(
        {"user_id": user["user_id"], "selected": True}, {"_id": 0}).to_list(10)
    income_str = hustles[0].get("potential_income", "$500/week") if hustles else "$500/week"
    nums = re.findall(r'[\d,]+', income_str.replace(',', ''))
    weekly_est = int(nums[0]) if nums else 500
    monthly_est = weekly_est * 4
    streak_data = await db.task_completions.find(
        {"user_id": user["user_id"]}, {"_id": 0}).sort("completed_at", -1).to_list(1)
    plan = await db.business_plans.find_one(
        {"user_id": user["user_id"]}, {"_id": 0, "daily_tasks": 1})
    today_tasks = 0
    current_day = 1
    if plan and plan.get("daily_tasks"):
        completions = await db.task_completions.count_documents({"user_id": user["user_id"]})
        total_plan_tasks = sum(len(d.get("tasks", [])) for d in plan["daily_tasks"])
        if total_plan_tasks > 0:
            progress_ratio = completions / total_plan_tasks
            current_day = min(30, max(1, int(progress_ratio * 30) + 1))
        for d in plan["daily_tasks"]:
            if d.get("day") == current_day:
                today_tasks = len(d.get("tasks", []))
                break
    percent = min(100, round((current_day / 30) * 100))
    idx = hash(datetime.now(timezone.utc).strftime("%Y-%m-%d") + user["user_id"]) % len(MOTIVATION_MESSAGES)
    msg = MOTIVATION_MESSAGES[idx]
    msg = msg.replace("{weekly}", str(weekly_est)).replace("{monthly}", f"{monthly_est:,}")
    msg = msg.replace("{day}", str(current_day))
    msg = msg.replace("{percent}", str(percent)).replace("{tasks}", str(today_tasks))
    msg = msg.replace("{minutes}", str(max(today_tasks * 15, 15)))
    return {"message": msg, "weekly_estimate": weekly_est, "monthly_estimate": monthly_est,
            "current_day": current_day, "today_tasks": today_tasks, "percent": percent}

# ─── REAL STATS FOR LANDING PAGE ───
@api_router.get("/stats/public")
async def get_public_stats():
    user_count = await db.users.count_documents({})
    hustle_count = await db.side_hustles.count_documents({})
    plan_count = await db.business_plans.count_documents({})
    kit_count = await db.launch_kits.count_documents({})
    return {"users": user_count, "hustles": hustle_count, "plans": plan_count, "kits": kit_count}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
