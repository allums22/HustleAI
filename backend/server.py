from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
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
    },
    "starter": {
        "name": "Starter", "plan_limit": 10, "launch_kit_limit": 2,
        "price": 9.99, "description": "10 plans/mo + 2 launch kits",
    },
    "pro": {
        "name": "Pro", "plan_limit": 999999, "launch_kit_limit": 5,
        "price": 29.99, "description": "Unlimited plans + 5 launch kits",
    },
    "empire": {
        "name": "Empire", "plan_limit": 999999, "launch_kit_limit": 999999,
        "price": 49.99, "description": "Unlimited everything",
    },
}

ALACARTE_PLAN_PRICE = 4.99
ALACARTE_KIT_PRICE = 2.99
REFERRAL_CREDIT = 5.00

# ─── Questionnaire Questions ───
QUESTIONNAIRE_QUESTIONS = [
    {"id": "profession", "question": "What's your current profession or field?", "type": "single_select",
     "options": ["Technology", "Business/Finance", "Creative/Design", "Healthcare", "Education", "Sales/Marketing", "Trades/Manual", "Student", "Other"]},
    {"id": "skills", "question": "Select your top skills", "type": "multi_select",
     "options": ["Writing", "Programming", "Design", "Marketing", "Sales", "Teaching", "Photography", "Video Editing", "Data Analysis", "Public Speaking", "Social Media", "Cooking", "Fitness Training", "Music", "Crafting/DIY"]},
    {"id": "hours_per_week", "question": "How many hours per week can you dedicate?", "type": "single_select",
     "options": ["Less than 5", "5-10", "10-20", "20-30", "30+"]},
    {"id": "budget", "question": "What's your startup budget?", "type": "single_select",
     "options": ["$0 - Free only", "$1-$100", "$100-$500", "$500-$1000", "$1000+"]},
    {"id": "income_goal", "question": "What's your monthly income goal?", "type": "single_select",
     "options": ["$100-$500", "$500-$1000", "$1000-$3000", "$3000-$5000", "$5000+"]},
    {"id": "interests", "question": "What areas interest you most?", "type": "multi_select",
     "options": ["E-commerce", "Freelancing", "Content Creation", "Consulting", "Digital Products", "Real Estate", "Investing", "Teaching/Tutoring", "App Development", "Physical Products", "Service Business", "Passive Income"]},
    {"id": "risk_tolerance", "question": "What's your risk tolerance?", "type": "single_select",
     "options": ["Very Low - I want guaranteed income", "Low - Minimal risk preferred", "Medium - Balanced approach", "High - Willing to take risks", "Very High - Go big or go home"]},
    {"id": "work_style", "question": "How do you prefer to work?", "type": "single_select",
     "options": ["Solo - I work best alone", "Team - I love collaboration", "Mix - Both solo and team work", "Client-facing - I enjoy direct interaction"]},
    {"id": "tech_comfort", "question": "How comfortable are you with technology?", "type": "single_select",
     "options": ["Beginner - I stick to basics", "Intermediate - I can learn new tools", "Advanced - I'm very tech-savvy", "Expert - I can build tech solutions"]},
    {"id": "timeline", "question": "When do you want to start seeing results?", "type": "single_select",
     "options": ["This week", "Within a month", "1-3 months", "3-6 months", "I'm patient - long term focus"]},
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

def make_user_doc(user_id, email, name, auth_type, picture="", password_hash=None):
    doc = {
        "user_id": user_id, "email": email, "name": name, "picture": picture,
        "auth_type": auth_type, "subscription_tier": "free",
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

    prompt = f"""Based on the following user profile, generate exactly 8 personalized side hustle recommendations.

IMPORTANT: Generate TWO categories:
- First 3 hustles must be "starter" tier: Low/no startup cost, earning $100-$500/week. These are beginner-friendly.
- Next 5 hustles must be "premium" tier: Higher earning $1000-$5000/week potential. May require some investment or advanced skills.

User Profile:
- Profession: {answers.get('profession', 'Not specified')}
- Skills: {answers.get('skills', 'Not specified')}
- Available hours: {answers.get('hours_per_week', 'Not specified')}/week
- Budget: {answers.get('budget', 'Not specified')}
- Income goal: {answers.get('income_goal', 'Not specified')}/month
- Interests: {answers.get('interests', 'Not specified')}
- Risk tolerance: {answers.get('risk_tolerance', 'Not specified')}
- Work style: {answers.get('work_style', 'Not specified')}
- Tech comfort: {answers.get('tech_comfort', 'Not specified')}
- Timeline: {answers.get('timeline', 'Not specified')}
- Additional skills: {additional_skills or 'None'}
- Resume: {resume_text[:500] if resume_text else 'None'}

Return ONLY a JSON array of 8 objects. Each must have:
- "name": string
- "description": string (2-3 sentences)
- "potential_income": string (e.g. "$200-$400/week" for starter, "$1500-$3000/week" for premium)
- "difficulty": "Easy"|"Medium"|"Hard"
- "time_required": string (e.g. "5-10 hours/week")
- "category": string
- "why_good_fit": string
- "hustle_tier": "starter"|"premium"

Return ONLY valid JSON array."""

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
            "selected": False, "business_plan_generated": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.side_hustles.insert_one(doc)
        del doc["_id"]
        created.append(doc)
    await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"hustle_count": len(created)}})
    return {"hustles": created}

@api_router.get("/hustles")
async def get_hustles(user: dict = Depends(get_current_user)):
    hustles = await db.side_hustles.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    tier = user.get("subscription_tier", "free")
    result = []
    for h in hustles:
        h_copy = {**h}
        htier = h_copy.get("hustle_tier", classify_hustle_income(h_copy.get("potential_income", "")))
        if tier == "free" and htier == "premium":
            h_copy["locked"] = True
            h_copy["original_name"] = h_copy["name"]
            h_copy["name"] = "Premium High-Revenue Hustle"
            h_copy["description"] = "Upgrade to unlock this high-revenue opportunity"
            h_copy["why_good_fit"] = ""
        else:
            h_copy["locked"] = False
        result.append(h_copy)
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
        return {"plan": existing}
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

    qr = await db.questionnaire_responses.find_one({"user_id": user["user_id"]}, {"_id": 0})
    answers = qr.get("answers", {}) if qr else {}
    prompt = f"""Create a detailed 30-day business plan for:
Side Hustle: {hustle['name']}
Description: {hustle['description']}
Hours: {answers.get('hours_per_week', '10-20')}/week
Budget: {answers.get('budget', '$100-$500')}
Goal: {answers.get('income_goal', '$1000-$3000')}/month
Tech: {answers.get('tech_comfort', 'Intermediate')}

Return ONLY JSON with: "title", "overview", "daily_tasks" (array of 30 with day/title/tasks/estimated_hours), "milestones" (4 for days 7,14,21,30 with day/title/description/expected_outcome), "resources_needed" (array), "total_estimated_cost"."""

    try:
        chat = LlmChat(api_key=emergent_key,
            session_id=f"plan_{user['user_id']}_{hustle_id}_{uuid.uuid4().hex[:6]}",
            system_message="Expert business strategist. Respond with valid JSON only.")
        chat.with_model("openai", "gpt-5.2")
        response = await chat.send_message(UserMessage(text=prompt))
        plan_data = parse_json_from_response(response)
    except Exception as e:
        logger.error(f"Plan generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate business plan.")

    plan_id = f"plan_{uuid.uuid4().hex[:12]}"
    plan_doc = {
        "plan_id": plan_id, "hustle_id": hustle_id, "user_id": user["user_id"],
        "title": plan_data.get("title", f"30-Day Plan: {hustle['name']}"),
        "overview": plan_data.get("overview", ""), "daily_tasks": plan_data.get("daily_tasks", []),
        "milestones": plan_data.get("milestones", []),
        "resources_needed": plan_data.get("resources_needed", []),
        "total_estimated_cost": plan_data.get("total_estimated_cost", "Varies"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.business_plans.insert_one(plan_doc)
    del plan_doc["_id"]
    await db.side_hustles.update_one({"hustle_id": hustle_id}, {"$set": {"selected": True, "business_plan_generated": True}})
    update_fields: Dict[str, Any] = {"$inc": {"plans_generated": 1}}
    if tier == "free" and not trial_used:
        update_fields["$set"] = {"trial_plan_used": True}
    await db.users.update_one({"user_id": user["user_id"]}, update_fields)
    return {"plan": plan_doc}

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
    if existing:
        return {"kit": existing}
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

    prompt = f"""Create a complete Hustle Launch Kit for:
Business: {hustle['name']}
Description: {hustle['description']}
Category: {hustle['category']}

Return ONLY JSON with:
- "tagline": string (catchy business tagline, max 10 words)
- "elevator_pitch": string (30-second pitch script, ~100 words)
- "social_posts": array of 5 strings (ready-to-post social media captions with emojis and hashtags)
- "landing_page_html": string (complete single-page HTML website with inline CSS, modern design, blue/orange theme, mobile-responsive, includes hero section, about, services, CTA, contact form placeholder)
- "brand_colors": object with "primary" and "accent" hex codes
- "target_audience": string (1-2 sentences describing ideal customer)"""

    try:
        chat = LlmChat(api_key=emergent_key,
            session_id=f"kit_{user['user_id']}_{hustle_id}_{uuid.uuid4().hex[:6]}",
            system_message="Expert brand strategist and web designer. Return valid JSON only.")
        chat.with_model("openai", "gpt-5.2")
        response = await chat.send_message(UserMessage(text=prompt))
        kit_data = parse_json_from_response(response)
    except Exception as e:
        logger.error(f"Launch kit error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate launch kit.")

    kit_id = f"kit_{uuid.uuid4().hex[:12]}"
    kit_doc = {
        "kit_id": kit_id, "hustle_id": hustle_id, "user_id": user["user_id"],
        "tagline": kit_data.get("tagline", ""), "elevator_pitch": kit_data.get("elevator_pitch", ""),
        "social_posts": kit_data.get("social_posts", []),
        "landing_page_html": kit_data.get("landing_page_html", ""),
        "brand_colors": kit_data.get("brand_colors", {}),
        "target_audience": kit_data.get("target_audience", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.launch_kits.insert_one(kit_doc)
    del kit_doc["_id"]
    await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"launch_kits_generated": 1}})
    return {"kit": kit_doc}

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

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
