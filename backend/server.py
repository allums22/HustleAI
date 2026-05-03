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

# ─── 4-Tier Subscription Model (with Annual Pricing) ───
# Annual = ~40% discount (8 months of value at 12-month price = 33% off, round to 40%)
SUBSCRIPTION_TIERS = {
    "free": {
        "name": "Free", "plan_limit": 0, "launch_kit_limit": 0,
        "price": 0.00, "annual_price": 0.00, "description": "Starter hustles + 1 trial business plan",
        "features": ["Up to 12 hustle recommendations", "1 free trial business plan", "Community access"],
    },
    "starter": {
        "name": "Starter", "plan_limit": 10, "launch_kit_limit": 2,
        "price": 9.99, "annual_price": 71.88,  # ~$5.99/mo equivalent, save $48/yr
        "description": "10 plans/mo + 2 kits + AI Mentor",
        "features": ["10 business plans/month", "2 launch kits with landing pages", "AI Mentor chat", "Priority support", "30-day money-back guarantee"],
    },
    "pro": {
        "name": "Pro", "plan_limit": 999999, "launch_kit_limit": 5,
        "price": 29.99, "annual_price": 215.88,  # ~$17.99/mo equivalent, save $144/yr
        "description": "Unlimited plans + 5 kits + AI Agents",
        "features": ["Unlimited business plans", "5 launch kits", "AI Mentor + Marketing Agent", "Landing page customization", "30-day money-back guarantee"],
    },
    "empire": {
        "name": "Empire", "plan_limit": 999999, "launch_kit_limit": 999999,
        "price": 79.99, "annual_price": 575.88,  # BUMP to $79.99 (whale pricing), save $384/yr
        "description": "Unlimited everything + All AI Agents",
        "features": ["Unlimited everything", "All AI Agents (Marketing, Content, Finance)", "AI Mentor with page editing", "White-label landing pages", "Dedicated support", "30-day money-back guarantee"],
    },
}

ALACARTE_PLAN_PRICE = 4.99
# ALACARTE_KIT_PRICE removed — folded into Starter tier to raise perceived value
ALACARTE_AGENT_PRICES = {
    "marketing": {"price": 9.99, "name": "Marketing Agent"},
    "content": {"price": 9.99, "name": "Content Writer"},
    "finance": {"price": 9.99, "name": "Finance Advisor"},
}
ALACARTE_AGENT_PACK_PRICE = 19.99  # All 3 premium agents — 33% discount
REFERRAL_CREDIT = 5.00

# ─── FOUNDERS LAUNCH OFFERS ───
FOUNDERS_LIFETIME_PRICE = 149.00
FOUNDERS_LIFETIME_SEAT_LIMIT = 100
INSTANT_KIT_PRICE = 29.00

# First-month promo codes (50% off)
FIRST_MONTH_PROMO_CODES = {
    "HUSTLE50": {"discount_pct": 50, "description": "50% off first month"},
    "BETA50": {"discount_pct": 50, "description": "Beta tester 50% off first month"},
}

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
    billing: Optional[str] = "monthly"  # "monthly" or "annual"
    promo_code: Optional[str] = None

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
    # 🔒 Normalize email to lowercase to prevent duplicate accounts from case variations
    req.email = (req.email or "").strip().lower()
    req.name = (req.name or "").strip()
    if not req.email or not req.password or not req.name:
        raise HTTPException(status_code=400, detail="Email, password, and name are required")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
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
    # Schedule retention emails (Day 1/3/7/14)
    try:
        await schedule_welcome_emails(user_id, req.email, req.name)
    except Exception as e:
        logger.warning(f"Failed to schedule welcome emails: {e}")
    return {
        "session_token": session_token,
        "user": {"user_id": user_id, "email": req.email, "name": req.name,
                 "subscription_tier": "free", "questionnaire_completed": False,
                 "referral_code": user_doc["referral_code"]},
    }

@api_router.post("/auth/login")
async def login(req: LoginRequest, request: Request):
    # 🔒 Normalize email to lowercase so it matches registration
    req.email = (req.email or "").strip().lower()
    # 🔒 Rate limit: 10 login attempts per 5 minutes per IP (using X-Forwarded-For for K8s ingress)
    fwd = request.headers.get("x-forwarded-for", "")
    client_ip = fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")
    if not await check_rate_limit(f"login_{client_ip}", 10, 300):
        raise HTTPException(status_code=429, detail="Too many login attempts. Please try again in a few minutes.")
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
    instant_credits = user.get("instant_kit_credits", 0)
    tier_info = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free"])
    if tier == "empire" or user.get("lifetime_access"):
        return {"has_access": True, "reason": "empire_plan", "kit_exists": False}
    if tier in ("starter", "pro") and kits_generated < tier_info["launch_kit_limit"]:
        return {"has_access": True, "reason": f"{tier}_plan", "kit_exists": False, "remaining": tier_info["launch_kit_limit"] - kits_generated}
    if instant_credits > 0:
        return {"has_access": True, "reason": "instant_kit_credit", "kit_exists": False, "remaining": instant_credits}
    alacarte = await db.payment_transactions.find_one(
        {"user_id": user["user_id"], "hustle_id": hustle_id, "payment_status": "paid",
         "plan_name": {"$in": ["alacarte_kit", "instant_kit"]}}, {"_id": 0})
    if alacarte:
        return {"has_access": True, "reason": "alacarte_purchased", "kit_exists": False}
    return {"has_access": False, "reason": "upgrade_required", "instant_kit_price": INSTANT_KIT_PRICE}

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
    instant_credits = user.get("instant_kit_credits", 0)
    tier_info = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free"])
    used_instant_credit = False

    def _has_alacarte_or_instant():
        return db.payment_transactions.find_one(
            {"user_id": user["user_id"], "hustle_id": hustle_id, "payment_status": "paid",
             "plan_name": {"$in": ["alacarte_kit", "instant_kit"]}}, {"_id": 0})

    if user.get("lifetime_access") or tier == "empire":
        pass  # full access
    elif tier == "free":
        if instant_credits > 0:
            used_instant_credit = True
        else:
            alacarte = await _has_alacarte_or_instant()
            if not alacarte:
                raise HTTPException(status_code=403, detail=f"Purchase the Instant Hustle Kit (${INSTANT_KIT_PRICE:.0f}) or upgrade your plan.")
    elif tier != "empire" and kits_gen >= tier_info["launch_kit_limit"]:
        if instant_credits > 0:
            used_instant_credit = True
        else:
            alacarte = await _has_alacarte_or_instant()
            if not alacarte:
                raise HTTPException(status_code=403, detail=f"Launch kit limit reached. Buy the Instant Hustle Kit (${INSTANT_KIT_PRICE:.0f}) or upgrade.")

    # Burn the instant kit credit (atomic) if we plan to use it
    if used_instant_credit:
        result = await db.users.update_one(
            {"user_id": user["user_id"], "instant_kit_credits": {"$gt": 0}},
            {"$inc": {"instant_kit_credits": -1}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=403, detail="No Instant Kit credits available.")

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
    valid = ["starter", "pro", "empire", "alacarte", "lifetime", "instant_kit"]
    if req.plan not in valid:
        raise HTTPException(status_code=400, detail="Invalid plan")
    origin_url = req.origin_url.rstrip('/')
    billing = (req.billing or "monthly").lower()
    if billing not in ("monthly", "annual"):
        billing = "monthly"

    promo_applied = None
    promo_discount_pct = 0

    if req.plan == "lifetime":
        # Check seat availability
        sold = await db.payment_transactions.count_documents(
            {"plan_name": "lifetime", "payment_status": "paid"})
        if sold >= FOUNDERS_LIFETIME_SEAT_LIMIT:
            raise HTTPException(status_code=400, detail="Founders Lifetime is sold out. Thank you for being part of this journey.")
        amount = float(FOUNDERS_LIFETIME_PRICE)
        success_url = f"{origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}&type=lifetime"
        metadata = {"user_id": user["user_id"], "plan": "lifetime", "plan_name": "lifetime"}
    elif req.plan == "instant_kit":
        if not req.hustle_id:
            raise HTTPException(status_code=400, detail="hustle_id required for Instant Kit")
        amount = float(INSTANT_KIT_PRICE)
        success_url = f"{origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}&type=instant_kit&hustle_id={req.hustle_id}"
        metadata = {"user_id": user["user_id"], "plan": "instant_kit", "plan_name": "instant_kit", "hustle_id": req.hustle_id}
    elif req.plan == "alacarte":
        if not req.hustle_id:
            raise HTTPException(status_code=400, detail="hustle_id required")
        amount = float(ALACARTE_PLAN_PRICE)
        success_url = f"{origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}&type=alacarte&hustle_id={req.hustle_id}"
        metadata = {"user_id": user["user_id"], "plan": "alacarte", "plan_name": "alacarte", "hustle_id": req.hustle_id}
    else:
        tier = SUBSCRIPTION_TIERS[req.plan]
        # Annual or monthly amount
        base_amount = float(tier["annual_price"]) if billing == "annual" else float(tier["price"])
        amount = base_amount
        # First-month promo (only applies to monthly subs, not annual or alacarte)
        if req.promo_code and billing == "monthly":
            code = req.promo_code.strip().upper()
            if code in FIRST_MONTH_PROMO_CODES:
                promo = FIRST_MONTH_PROMO_CODES[code]
                # Check if user already used this code
                existing = await db.promo_usage.find_one({
                    "user_id": user["user_id"], "code": code
                })
                if not existing:
                    promo_discount_pct = promo["discount_pct"]
                    amount = round(base_amount * (1 - promo_discount_pct / 100), 2)
                    promo_applied = code
        success_url = f"{origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}&type=subscription"
        metadata = {
            "user_id": user["user_id"], "plan": req.plan, "plan_name": tier["name"],
            "billing": billing, "base_amount": str(base_amount),
            "promo_code": promo_applied or "", "discount_pct": str(promo_discount_pct),
        }

    cancel_url = f"{origin_url}/pricing"
    webhook_url = f"{origin_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_key, webhook_url=webhook_url)
    checkout_req = CheckoutSessionRequest(amount=amount, currency="usd", success_url=success_url, cancel_url=cancel_url, metadata=metadata)
    session = await stripe_checkout.create_checkout_session(checkout_req)

    txn = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}", "user_id": user["user_id"],
        "session_id": session.session_id, "amount": amount, "currency": "usd",
        "plan_name": req.plan, "billing": billing, "promo_code": promo_applied,
        "discount_pct": promo_discount_pct,
        "status": "initiated", "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if req.hustle_id:
        txn["hustle_id"] = req.hustle_id
    await db.payment_transactions.insert_one(txn)
    # Record promo usage (prevents reuse)
    if promo_applied:
        await db.promo_usage.insert_one({
            "user_id": user["user_id"], "code": promo_applied,
            "session_id": session.session_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return {"url": session.url, "session_id": session.session_id, "amount": amount,
            "promo_applied": promo_applied, "discount_pct": promo_discount_pct}


# First-month promo code validation (no charge yet — just check validity)
@api_router.post("/promo/validate-checkout")
async def validate_checkout_promo(req: dict, user: dict = Depends(get_current_user)):
    code = (req.get("code", "") or "").strip().upper()
    if not code:
        return {"valid": False, "reason": "Enter a code"}
    if code not in FIRST_MONTH_PROMO_CODES:
        return {"valid": False, "reason": "Invalid promo code"}
    existing = await db.promo_usage.find_one({"user_id": user["user_id"], "code": code})
    if existing:
        return {"valid": False, "reason": "You've already used this code"}
    promo = FIRST_MONTH_PROMO_CODES[code]
    return {"valid": True, "discount_pct": promo["discount_pct"],
            "description": promo["description"]}

async def _grant_plan_access(user_id: str, plan_name: str, txn: Optional[Dict[str, Any]] = None):
    """Apply user-level entitlements after a successful payment."""
    if not user_id:
        return
    if plan_name == "lifetime":
        # Founders Lifetime: empire tier forever + flag
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"subscription_tier": "empire", "lifetime_access": True,
                      "lifetime_purchased_at": datetime.now(timezone.utc).isoformat()}}
        )
    elif plan_name == "instant_kit":
        # Grant 1 instant kit credit redeemable for a launch kit
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"instant_kit_credits": 1}}
        )
    elif plan_name in ("alacarte", "alacarte_kit"):
        pass  # already tracked via payment_transactions row
    else:
        # Starter/Pro/Empire subscription
        await db.users.update_one(
            {"user_id": user_id}, {"$set": {"subscription_tier": plan_name}}
        )

    # Fire receipt email (non-blocking — don't fail the webhook if email fails)
    try:
        amount = float((txn or {}).get("amount", 0)) if txn else 0.0
        billing = (txn or {}).get("billing", "monthly")
        hustle_id = (txn or {}).get("hustle_id")
        if plan_name in ("lifetime", "instant_kit", "starter", "pro", "empire"):
            asyncio.create_task(send_payment_receipt(user_id, plan_name, amount, billing, hustle_id))
    except Exception as e:
        logger.warning(f"[receipt] failed to schedule receipt email: {e}")


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
            await _grant_plan_access(txn["user_id"], pn, txn)
        return {"status": sr.status, "payment_status": sr.payment_status, "plan": txn.get("plan_name")}
    except Exception as e:
        logger.error(f"Payment status error: {e}")
        return {"status": txn.get("status", "unknown"), "payment_status": txn.get("payment_status", "unknown"), "plan": txn.get("plan_name")}

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    try:
        sc = StripeCheckout(api_key=stripe_key,
                            webhook_url=str(request.base_url) + "api/webhook/stripe",
                            webhook_secret=webhook_secret or None)
        wr = await sc.handle_webhook(body, sig)
        if wr and wr.payment_status == "paid":
            sid = wr.session_id
            meta = wr.metadata or {}
            txn = await db.payment_transactions.find_one({"session_id": sid}, {"_id": 0})
            if txn and txn.get("payment_status") != "paid":
                await db.payment_transactions.update_one({"session_id": sid}, {"$set": {"status": "complete", "payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}})
                pn = meta.get("plan", txn.get("plan_name", "starter"))
                uid = meta.get("user_id", txn.get("user_id"))
                await _grant_plan_access(uid, pn, txn)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}


# ─── FOUNDERS LIFETIME — public seat counter for scarcity ───
@api_router.get("/founders/seats")
async def founders_seats():
    """Public endpoint — returns Founders Lifetime seats sold/remaining for scarcity counter."""
    sold = await db.payment_transactions.count_documents(
        {"plan_name": "lifetime", "payment_status": "paid"}
    )
    remaining = max(0, FOUNDERS_LIFETIME_SEAT_LIMIT - sold)
    return {
        "sold": sold,
        "limit": FOUNDERS_LIFETIME_SEAT_LIMIT,
        "remaining": remaining,
        "price": FOUNDERS_LIFETIME_PRICE,
        "instant_kit_price": INSTANT_KIT_PRICE,
        "available": remaining > 0,
    }

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
        "alacarte_plan_price": ALACARTE_PLAN_PRICE,
    }

@api_router.get("/subscription/tiers")
async def get_tiers():
    return {"tiers": SUBSCRIPTION_TIERS, "alacarte_plan_price": ALACARTE_PLAN_PRICE,
            "promo_codes_available": list(FIRST_MONTH_PROMO_CODES.keys())}

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
    custom_primary = body.get("primary_color", "")
    custom_accent = body.get("accent_color", "")
    custom_tagline = body.get("tagline", "")
    custom_biz_name = body.get("biz_name", "")
    
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
        "biz_name": custom_biz_name or biz_name,
        "tagline": custom_tagline or kit.get("tagline", ""),
        "pitch": kit.get("elevator_pitch", ""), "target": kit.get("target_audience", ""),
        "primary": custom_primary or kit.get("brand_colors", {}).get("primary", "#6366F1"),
        "accent": custom_accent or kit.get("brand_colors", {}).get("accent", "#EC4899"),
        "email": email, "phone": phone, "name": name,
        "strategies": kit.get("marketing_strategy", []),
        "pricing_tiers": kit.get("pricing_tiers", []),
    })
    
    # Save customization + update kit branding if changed
    kit_updates: Dict[str, Any] = {"landing_page_html": html, "custom_links": custom_links}
    if custom_biz_name:
        kit_updates["business_name"] = custom_biz_name
    if custom_tagline:
        kit_updates["tagline"] = custom_tagline
    if custom_primary or custom_accent:
        bc = kit.get("brand_colors", {})
        if custom_primary:
            bc["primary"] = custom_primary
        if custom_accent:
            bc["accent"] = custom_accent
        kit_updates["brand_colors"] = bc
    
    await db.launch_kits.update_one(
        {"hustle_id": hustle_id, "user_id": user["user_id"]},
        {"$set": kit_updates}
    )
    return {"status": "ok", "html": html}

# ─── PLANS LIST ───
@api_router.get("/plans")
async def get_plans_list(user: dict = Depends(get_current_user)):
    plans = await db.business_plans.find(
        {"user_id": user["user_id"]}, {"_id": 0, "plan_id": 1, "hustle_id": 1, "title": 1, "overview": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(100)
    # Batch-fetch all hustles in one query (avoids N+1)
    hustle_ids = list({p.get("hustle_id", "") for p in plans if p.get("hustle_id")})
    hustle_map = {}
    if hustle_ids:
        hustles_cursor = db.side_hustles.find(
            {"hustle_id": {"$in": hustle_ids}},
            {"_id": 0, "hustle_id": 1, "name": 1, "category": 1}
        )
        async for h in hustles_cursor:
            hustle_map[h["hustle_id"]] = h
    for p in plans:
        h = hustle_map.get(p.get("hustle_id"))
        p["hustle_name"] = h.get("name", "Unknown") if h else "Unknown"
        p["hustle_category"] = h.get("category", "General") if h else "General"
    return {"plans": plans}

# ─── HUSTLE RESEARCH TRACKING ───
@api_router.post("/hustles/{hustle_id}/research")
async def mark_researched(hustle_id: str, user: dict = Depends(get_current_user)):
    await db.side_hustles.update_one(
        {"hustle_id": hustle_id, "user_id": user["user_id"]},
        {"$set": {"researched": True, "researched_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "ok"}

# ─── INCOME TRACKER ───
class IncomeEntry(BaseModel):
    hustle_id: str
    amount: float
    note: str = ""
    date: str = ""

@api_router.post("/income/log")
async def log_income(req: IncomeEntry, user: dict = Depends(get_current_user)):
    entry = {
        "user_id": user["user_id"],
        "hustle_id": req.hustle_id,
        "amount": req.amount,
        "note": req.note,
        "date": req.date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.income_entries.insert_one(entry)
    return {"status": "ok"}

@api_router.get("/income/summary")
async def income_summary(user: dict = Depends(get_current_user)):
    entries = await db.income_entries.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).to_list(200)
    total = sum(e.get("amount", 0) for e in entries)
    this_month = sum(e.get("amount", 0) for e in entries if e.get("date", "").startswith(datetime.now(timezone.utc).strftime("%Y-%m")))
    # Group by hustle
    by_hustle: Dict[str, float] = {}
    for e in entries:
        hid = e.get("hustle_id", "")
        by_hustle[hid] = by_hustle.get(hid, 0) + e.get("amount", 0)
    # Batch-fetch all hustle names in one query (avoids N+1)
    hustle_name_map: Dict[str, str] = {}
    hustle_ids = [hid for hid in by_hustle.keys() if hid]
    if hustle_ids:
        async for h in db.side_hustles.find(
            {"hustle_id": {"$in": hustle_ids}}, {"_id": 0, "hustle_id": 1, "name": 1}
        ):
            hustle_name_map[h["hustle_id"]] = h.get("name", "Unknown")
    hustle_breakdown = [
        {"hustle_id": hid, "name": hustle_name_map.get(hid, "Unknown"), "total": amt}
        for hid, amt in sorted(by_hustle.items(), key=lambda x: -x[1])
    ]
    return {"total": total, "this_month": this_month, "entries": entries[:20], "by_hustle": hustle_breakdown}

# ─── DAILY TASK (from 30-day plan) ───
@api_router.get("/daily-task")
async def get_daily_task(user: dict = Depends(get_current_user)):
    # Find the most recent plan with daily tasks
    plans = await db.business_plans.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(5)
    for plan in plans:
        daily_tasks = plan.get("daily_tasks", [])
        if not daily_tasks:
            continue
        # Find completed tasks
        completions = await db.task_completions.find({"user_id": user["user_id"], "plan_id": plan.get("plan_id", "")}, {"_id": 0, "day": 1}).to_list(100)
        completed_days = set(c.get("day", 0) for c in completions)
        # Find the next uncompleted task
        for task in daily_tasks:
            day = task.get("day", 0)
            if day not in completed_days:
                hustle = await db.side_hustles.find_one({"hustle_id": plan.get("hustle_id", "")}, {"_id": 0, "name": 1})
                return {
                    "task": task,
                    "plan_title": plan.get("title", ""),
                    "hustle_name": hustle.get("name", "") if hustle else "",
                    "hustle_id": plan.get("hustle_id", ""),
                    "plan_id": plan.get("plan_id", ""),
                    "total_days": len(daily_tasks),
                    "completed_days": len(completed_days),
                    "progress": len(completed_days) / max(len(daily_tasks), 1),
                }
    return {"task": None}

@api_router.post("/daily-task/complete")
async def complete_daily_task(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    await db.task_completions.update_one(
        {"user_id": user["user_id"], "plan_id": body.get("plan_id", ""), "day": body.get("day", 0)},
        {"$set": {"completed_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"status": "ok"}

# ─── BETA NDA & FEEDBACK ───

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

# ─── 🚀 BREAKOUT FEATURES ───

# 1) LIVE ACTIVITY FEED — anonymized recent wins for social proof
@api_router.get("/activity/live")
async def get_live_activity():
    """Public social-proof feed. Returns last 30 earnings + completions + signups (anonymized)."""
    activities = []
    # Recent earnings
    earnings = await db.earnings.find({}, {"_id": 0}).sort("created_at", -1).to_list(20)
    for e in earnings:
        user = await db.users.find_one({"user_id": e.get("user_id")}, {"_id": 0, "name": 1})
        if not user:
            continue
        name = (user.get("name", "Someone") or "Someone").split(" ")[0]
        initial = name[:1].upper() + "."
        # Try to get hustle name
        h = await db.side_hustles.find_one({"hustle_id": e.get("hustle_id", "")}, {"_id": 0, "name": 1})
        activities.append({
            "type": "earning",
            "text": f"{name[0]}{initial[0] if len(initial)>1 else ''}. just earned ${e.get('amount', 0):.0f}" + (f" from {h['name'][:30]}" if h else ""),
            "emoji": "💰",
            "amount": e.get("amount", 0),
            "created_at": e.get("created_at", ""),
        })
    # Recent community posts
    posts = await db.community_posts.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    for p in posts:
        name = (p.get("author_name", "Someone") or "Someone").split(" ")[0]
        text = f"{name} shared: {p.get('content', '')[:60]}"
        if p.get("milestone"):
            text = f"{name} hit milestone: {p['milestone']}"
        activities.append({
            "type": "post",
            "text": text + ("..." if len(p.get("content", "")) > 60 else ""),
            "emoji": "🎉",
            "created_at": p.get("created_at", ""),
        })
    # Recent signups (last 48 hrs)
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    recent_users = await db.users.find({"created_at": {"$gte": cutoff}}, {"_id": 0, "name": 1, "created_at": 1}).sort("created_at", -1).to_list(5)
    for u in recent_users:
        name = (u.get("name", "Someone") or "Someone").split(" ")[0]
        activities.append({
            "type": "signup",
            "text": f"{name} just joined HustleAI",
            "emoji": "🚀",
            "created_at": u.get("created_at", ""),
        })
    # Sort by time and return top 20
    activities.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"activities": activities[:20]}


# 2) MONTHLY LEADERBOARD — top earners this month (competitive retention)
@api_router.get("/leaderboard")
async def get_leaderboard(user: dict = Depends(get_current_user)):
    """Returns top 10 earners this month with tier, total, and rank."""
    this_month = datetime.now(timezone.utc).strftime("%Y-%m")
    # Aggregate earnings this month per user
    pipeline = [
        {"$match": {"date": {"$regex": f"^{this_month}"}}},
        {"$group": {"_id": "$user_id", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": 20},
    ]
    results = await db.earnings.aggregate(pipeline).to_list(20)
    board = []
    user_rank = None
    for rank, r in enumerate(results, start=1):
        u = await db.users.find_one({"user_id": r["_id"]}, {"_id": 0, "name": 1, "subscription_tier": 1})
        if not u:
            continue
        name = u.get("name", "Anonymous") or "Anonymous"
        display = name.split(" ")[0] + " " + (name.split(" ")[1][:1].upper() + "." if len(name.split(" ")) > 1 else "")
        entry = {
            "rank": rank,
            "name": display,
            "tier": u.get("subscription_tier", "free"),
            "total": round(r["total"], 2),
            "earnings_count": r["count"],
            "is_you": r["_id"] == user["user_id"],
        }
        board.append(entry)
        if r["_id"] == user["user_id"]:
            user_rank = rank
    # If user not in top 20, get their rank
    if user_rank is None:
        user_total = sum(e.get("amount", 0) for e in
            await db.earnings.find({"user_id": user["user_id"], "date": {"$regex": f"^{this_month}"}}).to_list(200))
        if user_total > 0:
            higher = await db.earnings.aggregate([
                {"$match": {"date": {"$regex": f"^{this_month}"}}},
                {"$group": {"_id": "$user_id", "total": {"$sum": "$amount"}}},
                {"$match": {"total": {"$gt": user_total}}},
                {"$count": "cnt"},
            ]).to_list(1)
            user_rank = (higher[0]["cnt"] if higher else 0) + 1
    return {"leaderboard": board[:10], "your_rank": user_rank, "month": this_month}


# 3) DAILY AI CHECK-IN COACH — habit formation + personalized nudges
class CheckinRequest(BaseModel):
    feeling: str  # "great", "good", "stuck", "overwhelmed"
    blocker: Optional[str] = ""

@api_router.post("/coach/checkin")
async def daily_checkin(req: CheckinRequest, user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # Check if already checked in today
    existing = await db.checkins.find_one({"user_id": user["user_id"], "date": today})
    if existing:
        return {"already_checked_in": True, "response": existing.get("response", ""), "date": today}
    # Get user context
    streak_data = await db.task_completions.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(200)
    hustle = await db.side_hustles.find_one({"user_id": user["user_id"], "selected": True}, {"_id": 0})
    earnings_total = sum(e.get("amount", 0) for e in await db.earnings.find({"user_id": user["user_id"]}).to_list(500))
    hustle_name = hustle.get("name", "your hustle") if hustle else "your hustle"
    # Generate AI response
    try:
        chat = LlmChat(api_key=emergent_key,
            session_id=f"checkin_{user['user_id']}_{today}",
            system_message=f"""You are a supportive, high-energy daily check-in coach for side hustle entrepreneurs. 
User: {user.get('name', 'Hustler')} | Hustle: {hustle_name} | Total earned so far: ${earnings_total:.0f} | Task completions: {len(streak_data)}.

The user feels: {req.feeling}. {f"Blocker: {req.blocker}" if req.blocker else ""}

Respond in 2-3 SHORT sentences (max 60 words total). Be specific to their situation, acknowledge their feeling, give ONE concrete action for today. Use plain text only — no markdown, no asterisks. End with a single emoji.""")
        chat.with_model("openai", "gpt-5.2")
        response = await chat.send_message(UserMessage(text=f"My check-in: I feel {req.feeling}. {req.blocker}"))
        clean = re.sub(r'\*{1,3}([^*]+)\*{1,3}', r'\1', response)
        clean = re.sub(r'`([^`]+)`', r'\1', clean).strip()
    except Exception as e:
        logger.error(f"Checkin AI error: {e}")
        clean = f"You've got this! Focus on one thing today — even 15 minutes moves you forward. 💪"
    await db.checkins.insert_one({
        "user_id": user["user_id"], "date": today, "feeling": req.feeling,
        "blocker": req.blocker, "response": clean,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"already_checked_in": False, "response": clean, "date": today}

@api_router.get("/coach/checkin/today")
async def get_today_checkin(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    c = await db.checkins.find_one({"user_id": user["user_id"], "date": today}, {"_id": 0})
    return {"checked_in": c is not None, "checkin": c}


# 4) SHAREABLE PUBLIC SCORECARD — viral growth loop
@api_router.post("/scorecard/generate")
async def generate_scorecard(user: dict = Depends(get_current_user)):
    """Create a shareable public scorecard from user's quiz + results. Returns scorecard_id."""
    qr = await db.questionnaire_responses.find_one({"user_id": user["user_id"]}, {"_id": 0})
    hustles = await db.side_hustles.find({"user_id": user["user_id"]}, {"_id": 0}).limit(12).to_list(12)
    if not qr or not hustles:
        raise HTTPException(status_code=400, detail="Complete the questionnaire first")
    # Generate personality type
    answers = qr.get("answers", {})
    skills = answers.get("skills", [])
    hours = answers.get("hours_per_week", "10-20")
    goal = answers.get("income_goal", "$1000-$3000")
    risk = answers.get("risk_tolerance", "Medium - Balanced approach")
    # Derive archetype
    if "Creative" in str(skills) or "Design" in str(skills):
        archetype = "Creative Hustler"
        archetype_emoji = "🎨"
        archetype_desc = "Your superpower is turning ideas into income."
    elif "Technical" in str(skills) or "Tech" in str(skills):
        archetype = "Tech Builder"
        archetype_emoji = "💻"
        archetype_desc = "You solve real problems with code and systems."
    elif "Trade" in str(skills) or "Physical" in str(skills) or answers.get("blue_collar"):
        archetype = "Skilled Craftsperson"
        archetype_emoji = "🔨"
        archetype_desc = "Your hands-on skills are in high demand."
    elif "Sales" in str(skills) or "Marketing" in str(skills):
        archetype = "People Connector"
        archetype_emoji = "🤝"
        archetype_desc = "You turn relationships into revenue."
    else:
        archetype = "Opportunity Spotter"
        archetype_emoji = "🎯"
        archetype_desc = "You see value where others see obstacles."
    scorecard_id = f"sc_{uuid.uuid4().hex[:10]}"
    top_hustles = [{"name": h.get("name", ""), "category": h.get("category", ""),
                     "potential_income": h.get("potential_income", "")} for h in hustles[:3]]
    scorecard = {
        "scorecard_id": scorecard_id,
        "user_id": user["user_id"],
        "user_name_first": (user.get("name", "Hustler") or "Hustler").split(" ")[0],
        "archetype": archetype,
        "archetype_emoji": archetype_emoji,
        "archetype_desc": archetype_desc,
        "hours_per_week": hours,
        "income_goal": goal,
        "risk_tolerance": risk,
        "top_hustles": top_hustles,
        "total_hustles": len(hustles),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "views": 0,
        "signups_from": 0,
    }
    await db.scorecards.update_one(
        {"user_id": user["user_id"]}, {"$set": scorecard}, upsert=True)
    return {"scorecard_id": scorecard_id, "archetype": archetype,
            "share_url_path": f"/s/{scorecard_id}"}

@api_router.get("/scorecard/public/{scorecard_id}")
async def get_public_scorecard(scorecard_id: str):
    """NO AUTH — public endpoint for viral sharing."""
    sc = await db.scorecards.find_one({"scorecard_id": scorecard_id}, {"_id": 0, "user_id": 0})
    if not sc:
        raise HTTPException(status_code=404, detail="Scorecard not found")
    # Increment view count
    await db.scorecards.update_one({"scorecard_id": scorecard_id}, {"$inc": {"views": 1}})
    sc["views"] = sc.get("views", 0) + 1
    return sc

@api_router.get("/scorecard/mine")
async def get_my_scorecard(user: dict = Depends(get_current_user)):
    sc = await db.scorecards.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"scorecard": sc}


# 5) FIRST $100 CHALLENGE — activation funnel
@api_router.get("/challenges/first-100")
async def first_100_challenge(user: dict = Depends(get_current_user)):
    """Returns challenge progress toward first $100. Key activation metric."""
    earnings = await db.earnings.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", 1).to_list(500)
    total = sum(e.get("amount", 0) for e in earnings)
    # Start date = first earning OR user creation
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "created_at": 1})
    created_str = user_doc.get("created_at", datetime.now(timezone.utc).isoformat()) if user_doc else datetime.now(timezone.utc).isoformat()
    try:
        start = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
    except Exception:
        start = datetime.now(timezone.utc)
    days_in = (datetime.now(timezone.utc) - start).days
    days_remaining = max(0, 30 - days_in)
    percent = min(100, (total / 100) * 100) if total < 100 else 100
    completed = total >= 100
    return {
        "target": 100.00,
        "current": round(total, 2),
        "percent": round(percent),
        "completed": completed,
        "days_in": days_in,
        "days_remaining": days_remaining,
        "first_earning_date": earnings[0].get("date") if earnings else None,
        "earnings_count": len(earnings),
        "message": (
            "🎉 You crushed it! First $100 unlocked — you're officially a hustler." if completed
            else f"${100 - total:.2f} to go — you've got {days_remaining} days. Log your first win to break the seal!"
            if total == 0 else
            f"${100 - total:.2f} away from your first $100. Keep the momentum!"
        ),
    }


# 6) PAUSE / RESUME / SWAP HUSTLE — retention recovery
class HustleStatusReq(BaseModel):
    reason: Optional[str] = ""

@api_router.post("/hustles/{hustle_id}/pause")
async def pause_hustle(hustle_id: str, req: HustleStatusReq, user: dict = Depends(get_current_user)):
    await db.side_hustles.update_one(
        {"hustle_id": hustle_id, "user_id": user["user_id"]},
        {"$set": {"status": "paused", "paused_at": datetime.now(timezone.utc).isoformat(),
                   "pause_reason": req.reason}})
    return {"status": "ok", "message": "Plan paused. Resume anytime — we saved your progress. 💙"}

@api_router.post("/hustles/{hustle_id}/resume")
async def resume_hustle(hustle_id: str, user: dict = Depends(get_current_user)):
    await db.side_hustles.update_one(
        {"hustle_id": hustle_id, "user_id": user["user_id"]},
        {"$set": {"status": "active"}, "$unset": {"paused_at": "", "pause_reason": ""}})
    return {"status": "ok", "message": "Welcome back! You've got this. 🚀"}


# ─── 📊 ANALYTICS FUNNEL (Tier 3) ───
class AnalyticsEvent(BaseModel):
    event: str  # e.g. "landing_view", "beta_invite_view", "register_submitted", "quiz_completed", "ai_chat_started", "checkout_started", "checkout_completed"
    properties: Optional[Dict[str, Any]] = None
    session_id: Optional[str] = None

@api_router.post("/analytics/track")
async def track_event(req: AnalyticsEvent, request: Request):
    """Public — tracks events for funnel analysis. No auth required (anonymous users too)."""
    user_id = None
    # If auth header present, try to attach user
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "")
        sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0, "user_id": 1})
        if sess:
            user_id = sess.get("user_id")
    await db.analytics_events.insert_one({
        "event_id": f"evt_{uuid.uuid4().hex[:12]}",
        "event": req.event[:80],
        "properties": req.properties or {},
        "session_id": req.session_id or "",
        "user_id": user_id,
        "ip": request.client.host if request.client else "",
        "user_agent": request.headers.get("user-agent", "")[:200],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"status": "ok"}

@api_router.get("/analytics/funnel")
async def get_funnel_stats(user: dict = Depends(get_current_user)):
    """Admin/owner funnel stats — counts for each step over last 30 days."""
    # Only allow Empire tier to see analytics (dashboard for app owner)
    if user.get("subscription_tier") != "empire":
        raise HTTPException(status_code=403, detail="Empire tier only")
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    steps = ["landing_view", "beta_invite_view", "register_submitted",
             "quiz_completed", "ai_chat_started", "checkout_started", "checkout_completed"]
    result = {}
    for step in steps:
        count = await db.analytics_events.count_documents({
            "event": step, "created_at": {"$gte": cutoff},
        })
        result[step] = count
    # Calculate conversion rates
    total_visits = result.get("landing_view", 0) or 1
    result["conversion_rates"] = {
        "landing_to_invite": round(100 * result.get("beta_invite_view", 0) / total_visits, 2),
        "invite_to_register": round(100 * result.get("register_submitted", 0) / max(result.get("beta_invite_view", 1), 1), 2),
        "register_to_quiz": round(100 * result.get("quiz_completed", 0) / max(result.get("register_submitted", 1), 1), 2),
        "quiz_to_chat": round(100 * result.get("ai_chat_started", 0) / max(result.get("quiz_completed", 1), 1), 2),
        "chat_to_checkout": round(100 * result.get("checkout_started", 0) / max(result.get("ai_chat_started", 1), 1), 2),
        "checkout_to_paid": round(100 * result.get("checkout_completed", 0) / max(result.get("checkout_started", 1), 1), 2),
    }
    return result


# ─── 📬 WAITLIST (Tier 1) ───
class WaitlistSignup(BaseModel):
    email: str
    source: Optional[str] = "landing"

@api_router.post("/waitlist/subscribe")
async def waitlist_subscribe(req: WaitlistSignup):
    """Public — captures pre-launch leads."""
    email = (req.email or "").strip().lower()
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email")
    existing = await db.waitlist.find_one({"email": email}, {"_id": 0})
    if existing:
        count = await db.waitlist.count_documents({})
        return {"status": "already_subscribed", "position": existing.get("position", count),
                "total_joined": count}
    count = await db.waitlist.count_documents({})
    position = count + 1
    await db.waitlist.insert_one({
        "email": email, "source": req.source or "landing",
        "position": position,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"status": "subscribed", "position": position, "total_joined": position}

@api_router.get("/waitlist/count")
async def waitlist_count():
    """Public — shows social proof count on landing page."""
    count = await db.waitlist.count_documents({})
    return {"total": count}


# ─── 🔒 RATE LIMITING (Tier 3 security pass) ───
async def check_rate_limit(key: str, max_requests: int, window_seconds: int):
    """Simple in-memory-ish rate limiting via MongoDB. Prevents brute force."""
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=window_seconds)
    count = await db.rate_limit_events.count_documents({
        "key": key, "created_at": {"$gte": cutoff.isoformat()},
    })
    if count >= max_requests:
        return False
    await db.rate_limit_events.insert_one({
        "key": key, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return True


# ─── 📧 WELCOME EMAIL QUEUE (Tier 3) ───
# Queues emails for Day 1/3/7/14 — a background worker can later read this collection
@api_router.get("/admin/email-queue/pending")
async def email_queue_pending(user: dict = Depends(get_current_user)):
    """Admin view of pending welcome/retention emails."""
    if user.get("subscription_tier") != "empire":
        raise HTTPException(status_code=403, detail="Empire tier only")
    now = datetime.now(timezone.utc).isoformat()
    pending = await db.email_queue.find(
        {"status": "pending", "scheduled_for": {"$lte": now}},
        {"_id": 0}
    ).sort("scheduled_for", 1).to_list(50)
    return {"pending": pending, "count": len(pending)}


# Admin: send a test email to the current user (verifies Resend is wired)
@api_router.post("/admin/email/test-send")
async def admin_email_test_send(user: dict = Depends(get_current_user)):
    if user.get("subscription_tier") != "empire":
        raise HTTPException(status_code=403, detail="Empire tier only")
    from emailer import send_email, EMAIL_ENABLED, render_day1
    if not EMAIL_ENABLED:
        raise HTTPException(status_code=503, detail="RESEND_API_KEY not configured")
    first = (user.get("name", "Hustler") or "Hustler").split(" ")[0]
    tpl = render_day1(first)
    result = await send_email(
        to_email=user.get("email", ""),
        to_name=user.get("name", ""),
        subject="[TEST] " + tpl["subject"],
        html=tpl["html"],
    )
    return {"status": "ok" if result.get("ok") else "error",
            "provider_id": result.get("id"),
            "error": result.get("error"),
            "to": user.get("email")}


# Admin: force-run the dispatcher one cycle (no waiting for the 60s loop)
@api_router.post("/admin/email/dispatch-now")
async def admin_email_dispatch_now(user: dict = Depends(get_current_user)):
    if user.get("subscription_tier") != "empire":
        raise HTTPException(status_code=403, detail="Empire tier only")
    sent = await _dispatch_pending_emails()
    return {"status": "ok", "sent": sent}


# Admin: Full funnel + revenue dashboard
@api_router.get("/admin/funnel")
async def admin_funnel(user: dict = Depends(get_current_user)):
    if user.get("subscription_tier") != "empire":
        raise HTTPException(status_code=403, detail="Empire tier only")
    now = datetime.now(timezone.utc)
    today_iso = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_iso = (now - timedelta(days=7)).isoformat()
    month_iso = (now - timedelta(days=30)).isoformat()

    # User counts
    total_users = await db.users.count_documents({})
    users_today = await db.users.count_documents({"created_at": {"$gte": today_iso}})
    users_7d = await db.users.count_documents({"created_at": {"$gte": week_iso}})
    users_30d = await db.users.count_documents({"created_at": {"$gte": month_iso}})

    # Tier breakdown
    tier_breakdown = {}
    for t in ["free", "starter", "pro", "empire"]:
        tier_breakdown[t] = await db.users.count_documents({"subscription_tier": t})
    lifetime_users = await db.users.count_documents({"lifetime_access": True})

    # Funnel steps
    visitors = await db.analytics_events.count_documents({"event": "landing_view"})
    signups = total_users
    questionnaire_done = await db.users.count_documents({"questionnaire_completed": True})
    has_hustles_users = len(await db.side_hustles.distinct("user_id"))
    plans_generated_users = len(await db.business_plans.distinct("user_id"))
    paid_users = await db.users.count_documents({
        "$or": [{"subscription_tier": {"$in": ["starter", "pro", "empire"]}},
                {"lifetime_access": True}]
    })

    # Revenue
    paid_txns = await db.payment_transactions.find(
        {"payment_status": "paid"}, {"_id": 0}
    ).to_list(2000)
    total_revenue = sum(float(t.get("amount", 0)) for t in paid_txns)
    revenue_today = sum(float(t.get("amount", 0)) for t in paid_txns
                        if (t.get("updated_at") or t.get("created_at", "")) >= today_iso)
    revenue_7d = sum(float(t.get("amount", 0)) for t in paid_txns
                     if (t.get("updated_at") or t.get("created_at", "")) >= week_iso)
    revenue_30d = sum(float(t.get("amount", 0)) for t in paid_txns
                      if (t.get("updated_at") or t.get("created_at", "")) >= month_iso)

    # Revenue by plan
    revenue_by_plan = {}
    txn_count_by_plan = {}
    for t in paid_txns:
        plan = t.get("plan_name", "unknown")
        revenue_by_plan[plan] = revenue_by_plan.get(plan, 0) + float(t.get("amount", 0))
        txn_count_by_plan[plan] = txn_count_by_plan.get(plan, 0) + 1

    # Recent transactions
    recent_txns = await db.payment_transactions.find(
        {"payment_status": "paid"}, {"_id": 0}
    ).sort("updated_at", -1).limit(20).to_list(20)
    recent_txns_sanitized = []
    for t in recent_txns:
        u = await db.users.find_one({"user_id": t.get("user_id")},
                                     {"_id": 0, "email": 1, "name": 1})
        recent_txns_sanitized.append({
            "amount": t.get("amount"),
            "plan": t.get("plan_name"),
            "billing": t.get("billing"),
            "user_email": (u or {}).get("email", "—"),
            "user_name": (u or {}).get("name", "—"),
            "at": t.get("updated_at") or t.get("created_at"),
        })

    # Founders seats
    seats_sold = await db.payment_transactions.count_documents(
        {"plan_name": "lifetime", "payment_status": "paid"}
    )

    # Email queue status
    email_pending = await db.email_queue.count_documents({"status": "pending"})
    email_sent = await db.email_queue.count_documents({"status": "sent"})
    email_failed = await db.email_queue.count_documents({"status": "failed"})

    # Waitlist
    waitlist_count = await db.waitlist.count_documents({})

    return {
        "as_of": now.isoformat(),
        "users": {
            "total": total_users, "today": users_today,
            "last_7d": users_7d, "last_30d": users_30d,
            "by_tier": tier_breakdown, "lifetime": lifetime_users,
        },
        "funnel": {
            "visitors": visitors, "signups": signups,
            "questionnaire": questionnaire_done,
            "first_hustle": has_hustles_users,
            "first_plan": plans_generated_users,
            "paid": paid_users,
            "signup_rate": round((signups / visitors * 100) if visitors else 0, 1),
            "paid_rate": round((paid_users / signups * 100) if signups else 0, 1),
        },
        "revenue": {
            "total": round(total_revenue, 2),
            "today": round(revenue_today, 2),
            "last_7d": round(revenue_7d, 2),
            "last_30d": round(revenue_30d, 2),
            "by_plan": {k: round(v, 2) for k, v in revenue_by_plan.items()},
            "txn_count_by_plan": txn_count_by_plan,
            "txn_total": len(paid_txns),
        },
        "founders_seats": {
            "sold": seats_sold,
            "limit": FOUNDERS_LIFETIME_SEAT_LIMIT,
            "remaining": max(0, FOUNDERS_LIFETIME_SEAT_LIMIT - seats_sold),
        },
        "recent_transactions": recent_txns_sanitized,
        "email_queue": {"pending": email_pending, "sent": email_sent, "failed": email_failed},
        "waitlist_count": waitlist_count,
    }

async def schedule_welcome_emails(user_id: str, email: str, name: str):
    """Queue Day 1/3/7/14 emails. Day 1 fires immediately; rest are queued for the worker."""
    from emailer import render_day1, render_day3, render_day7, render_day14
    now = datetime.now(timezone.utc)
    first = (name or "Hustler").split(" ")[0] or "Hustler"
    series = [
        (0, render_day1(first)),    # Day 1 — immediate
        (3, render_day3(first)),
        (7, render_day7(first)),
        (14, render_day14(first)),
    ]
    for offset_days, tpl in series:
        scheduled = (now + timedelta(days=offset_days)).isoformat()
        await db.email_queue.insert_one({
            "email_id": f"email_{uuid.uuid4().hex[:10]}",
            "user_id": user_id, "to_email": email, "to_name": name,
            "subject": tpl["subject"], "body": tpl["html"],
            "type": f"welcome_day_{offset_days}",
            "scheduled_for": scheduled, "status": "pending",
            "created_at": now.isoformat(),
        })


# ─── 📧 Background email dispatcher ───
async def _dispatch_pending_emails():
    """Reads email_queue for due rows and sends via Resend. Marks status."""
    from emailer import send_email, EMAIL_ENABLED
    if not EMAIL_ENABLED:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    cursor = db.email_queue.find(
        {"status": "pending", "scheduled_for": {"$lte": now}}
    ).limit(50)
    sent = 0
    async for row in cursor:
        # Atomic claim — set to 'sending' so dupe workers don't double-send
        claim = await db.email_queue.update_one(
            {"email_id": row["email_id"], "status": "pending"},
            {"$set": {"status": "sending", "sending_at": now}}
        )
        if claim.modified_count == 0:
            continue
        result = await send_email(
            to_email=row.get("to_email", ""),
            subject=row.get("subject", ""),
            html=row.get("body", ""),
            to_name=row.get("to_name", ""),
        )
        await db.email_queue.update_one(
            {"email_id": row["email_id"]},
            {"$set": {
                "status": "sent" if result.get("ok") else "failed",
                "provider_id": result.get("id"),
                "error": result.get("error"),
                "sent_at": datetime.now(timezone.utc).isoformat(),
            }}
        )
        if result.get("ok"):
            sent += 1
    return sent


async def _email_worker_loop():
    """Run forever, dispatching pending emails every 60s."""
    while True:
        try:
            count = await _dispatch_pending_emails()
            if count:
                logger.info(f"[email worker] sent {count} email(s)")
        except Exception as e:
            logger.error(f"[email worker] loop error: {e}")
        await asyncio.sleep(60)


async def send_payment_receipt(user_id: str, plan_name: str, amount: float,
                                billing: str = "monthly", hustle_id: Optional[str] = None):
    """Fire a receipt email for the appropriate purchase type."""
    from emailer import (render_lifetime_receipt, render_instant_kit_receipt,
                          render_subscription_receipt, send_email)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        return
    email = user.get("email", "")
    name = (user.get("name", "Hustler") or "Hustler")
    first = name.split(" ")[0] or "Hustler"
    if plan_name == "lifetime":
        tpl = render_lifetime_receipt(first, amount)
    elif plan_name == "instant_kit":
        hustle_name = ""
        if hustle_id:
            hustle = await db.side_hustles.find_one({"hustle_id": hustle_id}, {"_id": 0, "name": 1})
            if hustle:
                hustle_name = hustle.get("name", "")
        tpl = render_instant_kit_receipt(first, amount, hustle_name)
    elif plan_name in ("starter", "pro", "empire"):
        tpl = render_subscription_receipt(first, plan_name.capitalize(), amount, billing)
    else:
        return
    await send_email(to_email=email, to_name=name,
                     subject=tpl["subject"], html=tpl["html"])


# ─── 🔔 PUSH NOTIFICATIONS ───
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").replace("\\n", "\n")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:support@hustleai.live")

try:
    from pywebpush import webpush, WebPushException
    PUSH_ENABLED = bool(VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY)
except Exception:
    PUSH_ENABLED = False
    logger.warning("pywebpush not available — push notifications disabled")


class PushSubscription(BaseModel):
    endpoint: str
    keys: Dict[str, str]  # {p256dh, auth}

@api_router.get("/push/vapid-public-key")
async def get_vapid_public_key():
    return {"public_key": VAPID_PUBLIC_KEY, "enabled": PUSH_ENABLED}

@api_router.post("/push/subscribe")
async def push_subscribe(sub: PushSubscription, user: dict = Depends(get_current_user)):
    await db.push_subscriptions.update_one(
        {"user_id": user["user_id"], "endpoint": sub.endpoint},
        {"$set": {
            "user_id": user["user_id"], "endpoint": sub.endpoint,
            "p256dh": sub.keys.get("p256dh"), "auth": sub.keys.get("auth"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }}, upsert=True)
    return {"status": "subscribed"}

@api_router.post("/push/unsubscribe")
async def push_unsubscribe(sub: PushSubscription, user: dict = Depends(get_current_user)):
    await db.push_subscriptions.delete_one(
        {"user_id": user["user_id"], "endpoint": sub.endpoint})
    return {"status": "unsubscribed"}

async def send_push_to_user(user_id: str, title: str, body: str, url: str = "/") -> int:
    if not PUSH_ENABLED:
        return 0
    subs = await db.push_subscriptions.find({"user_id": user_id}).to_list(10)
    sent = 0
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                },
                data=json.dumps({"title": title, "body": body, "url": url}),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
            )
            sent += 1
        except WebPushException as e:
            if hasattr(e, 'response') and e.response is not None and e.response.status_code in (404, 410):
                await db.push_subscriptions.delete_one({"_id": sub["_id"]})
            logger.warning(f"Push failed for {user_id}: {e}")
        except Exception as e:
            logger.error(f"Push error for {user_id}: {e}")
    return sent

@api_router.post("/push/send-test")
async def push_send_test(user: dict = Depends(get_current_user)):
    if not PUSH_ENABLED:
        raise HTTPException(status_code=503, detail="Push notifications not configured")
    sent = await send_push_to_user(
        user["user_id"],
        "🚀 HustleAI notifications are ON",
        "You'll get daily check-in reminders, streak warnings, and win alerts.",
        "/dashboard",
    )
    return {"status": "ok", "devices_notified": sent}

@api_router.post("/push/triggers/daily-reminders")
async def trigger_daily_reminders(request: Request):
    secret = request.headers.get("x-trigger-secret", "")
    if secret != os.environ.get("JWT_SECRET", ""):
        raise HTTPException(status_code=403, detail="Invalid trigger secret")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    sent_total = 0
    cursor = db.users.find({"questionnaire_completed": True}, {"_id": 0, "user_id": 1, "name": 1})
    async for u in cursor:
        uid = u["user_id"]
        already = await db.checkins.find_one({"user_id": uid, "date": today})
        if already:
            continue
        streak = await db.task_completions.count_documents({"user_id": uid})
        if streak < 3:
            continue
        name = (u.get("name", "Hustler") or "Hustler").split(" ")[0]
        sent = await send_push_to_user(
            uid, f"☀️ Ready, {name}?",
            "Quick 5-second check-in to keep your streak alive.", "/dashboard",
        )
        sent_total += sent
    return {"status": "ok", "total_sent": sent_total}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def _start_email_worker():
    """Kick off the background email dispatcher loop."""
    try:
        asyncio.create_task(_email_worker_loop())
        logger.info("[email worker] started")
    except Exception as e:
        logger.error(f"[email worker] failed to start: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
