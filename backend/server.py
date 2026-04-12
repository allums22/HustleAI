from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
import uuid
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

# Config
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

# ─── Subscription Tiers ───
# Free: Unlimited hustle discovery, 1 trial business plan, then locked
# Starter: 10 business plans/month
# Pro: Unlimited business plans
SUBSCRIPTION_TIERS = {
    "free": {"name": "Free", "plan_limit": 0, "price": 0.00, "description": "Discover side hustles, 1 free trial plan"},
    "starter": {"name": "Starter", "plan_limit": 10, "price": 9.99, "description": "10 business plans/month"},
    "pro": {"name": "Pro", "plan_limit": 999999, "price": 29.99, "description": "Unlimited business plans"},
}

# À la carte pricing for individual business plans
ALACARTE_PLAN_PRICE = 4.99

# ─── Questionnaire Questions ───
QUESTIONNAIRE_QUESTIONS = [
    {
        "id": "profession",
        "question": "What's your current profession or field?",
        "type": "single_select",
        "options": ["Technology", "Business/Finance", "Creative/Design", "Healthcare", "Education", "Sales/Marketing", "Trades/Manual", "Student", "Other"]
    },
    {
        "id": "skills",
        "question": "Select your top skills",
        "type": "multi_select",
        "options": ["Writing", "Programming", "Design", "Marketing", "Sales", "Teaching", "Photography", "Video Editing", "Data Analysis", "Public Speaking", "Social Media", "Cooking", "Fitness Training", "Music", "Crafting/DIY"]
    },
    {
        "id": "hours_per_week",
        "question": "How many hours per week can you dedicate?",
        "type": "single_select",
        "options": ["Less than 5", "5-10", "10-20", "20-30", "30+"]
    },
    {
        "id": "budget",
        "question": "What's your startup budget?",
        "type": "single_select",
        "options": ["$0 - Free only", "$1-$100", "$100-$500", "$500-$1000", "$1000+"]
    },
    {
        "id": "income_goal",
        "question": "What's your monthly income goal?",
        "type": "single_select",
        "options": ["$100-$500", "$500-$1000", "$1000-$3000", "$3000-$5000", "$5000+"]
    },
    {
        "id": "interests",
        "question": "What areas interest you most?",
        "type": "multi_select",
        "options": ["E-commerce", "Freelancing", "Content Creation", "Consulting", "Digital Products", "Real Estate", "Investing", "Teaching/Tutoring", "App Development", "Physical Products", "Service Business", "Passive Income"]
    },
    {
        "id": "risk_tolerance",
        "question": "What's your risk tolerance?",
        "type": "single_select",
        "options": ["Very Low - I want guaranteed income", "Low - Minimal risk preferred", "Medium - Balanced approach", "High - Willing to take risks", "Very High - Go big or go home"]
    },
    {
        "id": "work_style",
        "question": "How do you prefer to work?",
        "type": "single_select",
        "options": ["Solo - I work best alone", "Team - I love collaboration", "Mix - Both solo and team work", "Client-facing - I enjoy direct interaction"]
    },
    {
        "id": "tech_comfort",
        "question": "How comfortable are you with technology?",
        "type": "single_select",
        "options": ["Beginner - I stick to basics", "Intermediate - I can learn new tools", "Advanced - I'm very tech-savvy", "Expert - I can build tech solutions"]
    },
    {
        "id": "timeline",
        "question": "When do you want to start seeing results?",
        "type": "single_select",
        "options": ["This week", "Within a month", "1-3 months", "3-6 months", "I'm patient - long term focus"]
    }
]

# ─── Pydantic Models ───
class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

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
    plan: str  # "starter", "pro", or "alacarte"
    origin_url: str
    hustle_id: Optional[str] = None  # Required for à la carte purchase

class HustleSelectRequest(BaseModel):
    hustle_id: str

# ─── Helpers ───
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
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text
    return data.decode('utf-8', errors='ignore')


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
    user = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0, "password_hash": 0}
    )
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def create_session_token():
    return f"sess_{uuid.uuid4().hex}"


# ─── AUTH ENDPOINTS ───
@api_router.post("/auth/register")
async def register(req: RegisterRequest):
    existing = await db.users.find_one({"email": req.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    password_hash = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": req.email,
        "name": req.name,
        "picture": "",
        "password_hash": password_hash,
        "auth_type": "email",
        "subscription_tier": "free",
        "hustle_count": 0,
        "plans_generated": 0,
        "trial_plan_used": False,
        "alacarte_plans_purchased": 0,
        "questionnaire_completed": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    session_token = create_session_token()
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "session_token": session_token,
        "user": {
            "user_id": user_id,
            "email": req.email,
            "name": req.name,
            "subscription_tier": "free",
            "questionnaire_completed": False,
        }
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
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "session_token": session_token,
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user["name"],
            "subscription_tier": user.get("subscription_tier", "free"),
            "questionnaire_completed": user.get("questionnaire_completed", False),
        }
    }


@api_router.get("/auth/session")
async def exchange_session(session_id: str):
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = resp.json()
    email = data.get("email")
    name = data.get("name", "")
    picture = data.get("picture", "")
    _ = data.get("session_token", "")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
        user_data = existing
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_data = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "auth_type": "google",
            "subscription_tier": "free",
            "hustle_count": 0,
            "plans_generated": 0,
            "trial_plan_used": False,
            "alacarte_plans_purchased": 0,
            "questionnaire_completed": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user_data)
    session_token = create_session_token()
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "session_token": session_token,
        "user": {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "subscription_tier": user_data.get("subscription_tier", "free"),
            "questionnaire_completed": user_data.get("questionnaire_completed", False),
        }
    }


@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def logout(request: Request):
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        await db.user_sessions.delete_one({"session_token": token})
    return {"message": "Logged out"}


# ─── QUESTIONNAIRE ENDPOINTS ───
@api_router.get("/questionnaire/questions")
async def get_questions():
    return {"questions": QUESTIONNAIRE_QUESTIONS}


@api_router.post("/questionnaire/submit")
async def submit_questionnaire(
    submission: QuestionnaireSubmission,
    user: dict = Depends(get_current_user)
):
    resume_extracted = ""
    if submission.resume_file_b64 and submission.resume_filename:
        try:
            resume_extracted = extract_text_from_file(
                submission.resume_file_b64, submission.resume_filename
            )
        except Exception as e:
            logger.error(f"Resume extraction error: {e}")

    final_resume = submission.resume_text or resume_extracted or ""
    response_id = f"qr_{uuid.uuid4().hex[:12]}"
    await db.questionnaire_responses.insert_one({
        "response_id": response_id,
        "user_id": user["user_id"],
        "answers": submission.answers,
        "additional_skills": submission.additional_skills or "",
        "resume_text": final_resume,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"questionnaire_completed": True}}
    )
    return {"response_id": response_id, "message": "Questionnaire submitted"}


# ─── SIDE HUSTLE ENDPOINTS ───
@api_router.post("/hustles/generate")
async def generate_hustles(user: dict = Depends(get_current_user)):
    # Side hustle discovery is FREE for all plans - no limits
    qr = await db.questionnaire_responses.find_one(
        {"user_id": user["user_id"]},
        {"_id": 0},
    )
    if not qr:
        raise HTTPException(status_code=400, detail="Complete the questionnaire first")

    answers = qr.get("answers", {})
    additional_skills = qr.get("additional_skills", "")
    resume_text = qr.get("resume_text", "")
    num_to_generate = 5

    prompt = f"""Based on the following user profile, generate exactly {num_to_generate} personalized side hustle recommendations.

User Profile:
- Profession: {answers.get('profession', 'Not specified')}
- Skills: {answers.get('skills', 'Not specified')}
- Available hours per week: {answers.get('hours_per_week', 'Not specified')}
- Startup budget: {answers.get('budget', 'Not specified')}
- Monthly income goal: {answers.get('income_goal', 'Not specified')}
- Interests: {answers.get('interests', 'Not specified')}
- Risk tolerance: {answers.get('risk_tolerance', 'Not specified')}
- Work style: {answers.get('work_style', 'Not specified')}
- Tech comfort: {answers.get('tech_comfort', 'Not specified')}
- Timeline: {answers.get('timeline', 'Not specified')}
- Additional skills: {additional_skills if additional_skills else 'None provided'}
- Resume summary: {resume_text[:500] if resume_text else 'None provided'}

Return ONLY a JSON array with exactly {num_to_generate} objects. Each object must have:
- "name": string (creative hustle name)
- "description": string (2-3 sentences)
- "potential_income": string (e.g. "$500-$1000/month")
- "difficulty": string (one of "Easy", "Medium", "Hard")
- "time_required": string (e.g. "5-10 hours/week")
- "category": string (e.g. "Freelancing", "E-commerce", etc.)
- "why_good_fit": string (1-2 sentences why this suits the user)

Return ONLY valid JSON array, no other text."""

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

    created_hustles = []
    for h in hustles_data:
        hustle_id = f"hustle_{uuid.uuid4().hex[:12]}"
        hustle_doc = {
            "hustle_id": hustle_id,
            "user_id": user["user_id"],
            "name": h.get("name", "Untitled Hustle"),
            "description": h.get("description", ""),
            "potential_income": h.get("potential_income", "Varies"),
            "difficulty": h.get("difficulty", "Medium"),
            "time_required": h.get("time_required", "Varies"),
            "category": h.get("category", "General"),
            "why_good_fit": h.get("why_good_fit", ""),
            "selected": False,
            "business_plan_generated": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.side_hustles.insert_one(hustle_doc)
        del hustle_doc["_id"]
        created_hustles.append(hustle_doc)

    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"hustle_count": len(created_hustles)}}
    )
    return {"hustles": created_hustles}


@api_router.get("/hustles")
async def get_hustles(user: dict = Depends(get_current_user)):
    hustles = await db.side_hustles.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"hustles": hustles}


@api_router.get("/hustles/{hustle_id}")
async def get_hustle_detail(hustle_id: str, user: dict = Depends(get_current_user)):
    hustle = await db.side_hustles.find_one(
        {"hustle_id": hustle_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    if not hustle:
        raise HTTPException(status_code=404, detail="Side hustle not found")
    plan = await db.business_plans.find_one(
        {"hustle_id": hustle_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    return {"hustle": hustle, "business_plan": plan}


@api_router.post("/hustles/{hustle_id}/select")
async def select_hustle(hustle_id: str, user: dict = Depends(get_current_user)):
    hustle = await db.side_hustles.find_one(
        {"hustle_id": hustle_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    if not hustle:
        raise HTTPException(status_code=404, detail="Side hustle not found")
    await db.side_hustles.update_one(
        {"hustle_id": hustle_id},
        {"$set": {"selected": True}}
    )
    return {"message": "Side hustle selected"}


# ─── BUSINESS PLAN ENDPOINTS ───
@api_router.get("/plans/access/{hustle_id}")
async def check_plan_access(hustle_id: str, user: dict = Depends(get_current_user)):
    """Check if user can access/generate a business plan for this hustle."""
    tier = user.get("subscription_tier", "free")
    trial_used = user.get("trial_plan_used", False)
    plans_generated = user.get("plans_generated", 0)

    # Check if plan already exists for this hustle
    existing = await db.business_plans.find_one(
        {"hustle_id": hustle_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    if existing:
        return {"has_access": True, "reason": "already_generated", "plan_exists": True}

    # Check if this hustle was purchased à la carte
    alacarte_purchase = await db.payment_transactions.find_one(
        {"user_id": user["user_id"], "hustle_id": hustle_id, "payment_status": "paid", "plan_name": "alacarte"},
        {"_id": 0}
    )
    if alacarte_purchase:
        return {"has_access": True, "reason": "alacarte_purchased", "plan_exists": False}

    if tier == "pro":
        return {"has_access": True, "reason": "pro_plan", "plan_exists": False}

    if tier == "starter":
        tier_info = SUBSCRIPTION_TIERS["starter"]
        if plans_generated < tier_info["plan_limit"]:
            return {"has_access": True, "reason": "starter_plan", "plan_exists": False, "remaining": tier_info["plan_limit"] - plans_generated}
        return {"has_access": False, "reason": "starter_limit_reached", "plan_exists": False}

    # Free tier
    if not trial_used:
        return {"has_access": True, "reason": "free_trial", "plan_exists": False, "is_trial": True}

    return {
        "has_access": False,
        "reason": "free_plan_locked",
        "plan_exists": False,
        "alacarte_price": ALACARTE_PLAN_PRICE,
    }


@api_router.post("/plans/generate/{hustle_id}")
async def generate_business_plan(hustle_id: str, user: dict = Depends(get_current_user)):
    hustle = await db.side_hustles.find_one(
        {"hustle_id": hustle_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    if not hustle:
        raise HTTPException(status_code=404, detail="Side hustle not found")

    existing_plan = await db.business_plans.find_one(
        {"hustle_id": hustle_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    if existing_plan:
        return {"plan": existing_plan}

    # ── Paywall check ──
    tier = user.get("subscription_tier", "free")
    trial_used = user.get("trial_plan_used", False)
    plans_generated = user.get("plans_generated", 0)

    if tier == "free":
        # Check for à la carte purchase
        alacarte_purchase = await db.payment_transactions.find_one(
            {"user_id": user["user_id"], "hustle_id": hustle_id, "payment_status": "paid", "plan_name": "alacarte"},
            {"_id": 0}
        )
        if not alacarte_purchase and trial_used:
            raise HTTPException(
                status_code=403,
                detail="Your free trial plan has been used. Upgrade to Starter/Pro or purchase this plan à la carte ($4.99)."
            )
    elif tier == "starter":
        tier_info = SUBSCRIPTION_TIERS["starter"]
        if plans_generated >= tier_info["plan_limit"]:
            raise HTTPException(
                status_code=403,
                detail="You've reached your Starter plan limit of 10 business plans this month. Upgrade to Pro for unlimited!"
            )
    # Pro tier has no limits

    qr = await db.questionnaire_responses.find_one(
        {"user_id": user["user_id"]},
        {"_id": 0}
    )
    answers = qr.get("answers", {}) if qr else {}

    prompt = f"""Create a detailed 30-day business plan for the following side hustle:

Side Hustle: {hustle['name']}
Description: {hustle['description']}
User's available hours: {answers.get('hours_per_week', '10-20')} per week
User's budget: {answers.get('budget', '$100-$500')}
User's income goal: {answers.get('income_goal', '$1000-$3000')}/month
User's tech comfort: {answers.get('tech_comfort', 'Intermediate')}

Return ONLY a JSON object with:
- "title": string (plan title)
- "overview": string (2-3 paragraph strategy overview)
- "daily_tasks": array of 30 objects, each with:
  - "day": number (1-30)
  - "title": string (day's focus area)
  - "tasks": array of strings (2-3 specific actionable tasks)
  - "estimated_hours": number (hours needed)
- "milestones": array of 4 objects for days 7, 14, 21, 30, each with:
  - "day": number
  - "title": string
  - "description": string
  - "expected_outcome": string
- "resources_needed": array of strings
- "total_estimated_cost": string

Return ONLY valid JSON, no other text."""

    try:
        chat = LlmChat(
            api_key=emergent_key,
            session_id=f"plan_gen_{user['user_id']}_{hustle_id}_{uuid.uuid4().hex[:6]}",
            system_message="You are an expert business strategist. Always respond with valid JSON only."
        )
        chat.with_model("openai", "gpt-5.2")
        response = await chat.send_message(UserMessage(text=prompt))
        plan_data = parse_json_from_response(response)
    except Exception as e:
        logger.error(f"Plan generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate business plan. Please try again.")

    plan_id = f"plan_{uuid.uuid4().hex[:12]}"
    plan_doc = {
        "plan_id": plan_id,
        "hustle_id": hustle_id,
        "user_id": user["user_id"],
        "title": plan_data.get("title", f"30-Day Plan: {hustle['name']}"),
        "overview": plan_data.get("overview", ""),
        "daily_tasks": plan_data.get("daily_tasks", []),
        "milestones": plan_data.get("milestones", []),
        "resources_needed": plan_data.get("resources_needed", []),
        "total_estimated_cost": plan_data.get("total_estimated_cost", "Varies"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.business_plans.insert_one(plan_doc)
    del plan_doc["_id"]

    await db.side_hustles.update_one(
        {"hustle_id": hustle_id},
        {"$set": {"selected": True, "business_plan_generated": True}}
    )

    # Track plan generation usage
    update_fields: Dict[str, Any] = {"$inc": {"plans_generated": 1}}
    if tier == "free" and not trial_used:
        update_fields["$set"] = {"trial_plan_used": True}
    await db.users.update_one({"user_id": user["user_id"]}, update_fields)

    return {"plan": plan_doc}


@api_router.get("/plans/{hustle_id}")
async def get_business_plan(hustle_id: str, user: dict = Depends(get_current_user)):
    plan = await db.business_plans.find_one(
        {"hustle_id": hustle_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Business plan not found")
    return {"plan": plan}


# ─── PAYMENT ENDPOINTS ───
@api_router.post("/payments/create-checkout")
async def create_checkout(req: CheckoutRequest, user: dict = Depends(get_current_user)):
    valid_plans = ["starter", "pro", "alacarte"]
    if req.plan not in valid_plans:
        raise HTTPException(status_code=400, detail="Invalid plan")

    origin_url = req.origin_url.rstrip('/')

    if req.plan == "alacarte":
        if not req.hustle_id:
            raise HTTPException(status_code=400, detail="hustle_id required for à la carte purchase")
        amount = float(ALACARTE_PLAN_PRICE)
        success_url = f"{origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}&type=alacarte&hustle_id={req.hustle_id}"
        metadata = {
            "user_id": user["user_id"],
            "plan": "alacarte",
            "plan_name": "alacarte",
            "hustle_id": req.hustle_id,
        }
    else:
        tier = SUBSCRIPTION_TIERS[req.plan]
        amount = float(tier["price"])
        success_url = f"{origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}&type=subscription"
        metadata = {
            "user_id": user["user_id"],
            "plan": req.plan,
            "plan_name": tier["name"],
        }

    cancel_url = f"{origin_url}/pricing"
    webhook_url = f"{origin_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_key, webhook_url=webhook_url)

    checkout_req = CheckoutSessionRequest(
        amount=amount,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await stripe_checkout.create_checkout_session(checkout_req)

    txn_doc = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "session_id": session.session_id,
        "amount": amount,
        "currency": "usd",
        "plan_name": req.plan,
        "status": "initiated",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if req.plan == "alacarte" and req.hustle_id:
        txn_doc["hustle_id"] = req.hustle_id
    await db.payment_transactions.insert_one(txn_doc)

    return {"url": session.url, "session_id": session.session_id}


@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, user: dict = Depends(get_current_user)):
    txn = await db.payment_transactions.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if txn.get("payment_status") == "paid":
        return {"status": "complete", "payment_status": "paid", "plan": txn.get("plan_name")}

    try:
        webhook_url = "https://placeholder.com/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=stripe_key, webhook_url=webhook_url)
        status_resp = await stripe_checkout.get_checkout_status(session_id)

        new_status = status_resp.status
        new_payment_status = status_resp.payment_status

        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": new_status,
                "payment_status": new_payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )

        if new_payment_status == "paid":
            plan_name = txn.get("plan_name", "starter")
            if plan_name == "alacarte":
                # À la carte: increment purchased count
                await db.users.update_one(
                    {"user_id": txn["user_id"]},
                    {"$inc": {"alacarte_plans_purchased": 1}}
                )
            else:
                # Subscription upgrade
                await db.users.update_one(
                    {"user_id": txn["user_id"]},
                    {"$set": {"subscription_tier": plan_name}}
                )

        return {
            "status": new_status,
            "payment_status": new_payment_status,
            "plan": txn.get("plan_name")
        }
    except Exception as e:
        logger.error(f"Payment status check error: {e}")
        return {"status": txn.get("status", "unknown"), "payment_status": txn.get("payment_status", "unknown"), "plan": txn.get("plan_name")}


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    try:
        webhook_url = str(request.base_url) + "api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=stripe_key, webhook_url=webhook_url)
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        if webhook_response and webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id
            metadata = webhook_response.metadata or {}
            txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
            if txn and txn.get("payment_status") != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "status": "complete",
                        "payment_status": "paid",
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }}
                )
                plan_name = metadata.get("plan", txn.get("plan_name", "starter"))
                user_id = metadata.get("user_id", txn.get("user_id"))
                if user_id:
                    if plan_name == "alacarte":
                        await db.users.update_one(
                            {"user_id": user_id},
                            {"$inc": {"alacarte_plans_purchased": 1}}
                        )
                    else:
                        await db.users.update_one(
                            {"user_id": user_id},
                            {"$set": {"subscription_tier": plan_name}}
                        )
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}


# ─── PROFILE ENDPOINTS ───
@api_router.get("/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    tier = user.get("subscription_tier", "free")
    tier_info = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free"])
    hustle_count = await db.side_hustles.count_documents({"user_id": user["user_id"]})
    plan_count = await db.business_plans.count_documents({"user_id": user["user_id"]})
    trial_used = user.get("trial_plan_used", False)
    plans_generated = user.get("plans_generated", 0)
    alacarte_purchased = user.get("alacarte_plans_purchased", 0)

    # Calculate remaining plans
    if tier == "pro":
        remaining_plans = 999999
    elif tier == "starter":
        remaining_plans = max(0, tier_info["plan_limit"] - plans_generated)
    else:
        remaining_plans = 0 if trial_used else 1

    return {
        "user": user,
        "subscription": {
            "tier": tier,
            "name": tier_info["name"],
            "plan_limit": tier_info["plan_limit"],
            "price": tier_info["price"],
            "description": tier_info.get("description", ""),
        },
        "stats": {
            "total_hustles": hustle_count,
            "plans_generated": plan_count,
            "remaining_plans": remaining_plans,
            "trial_used": trial_used,
            "alacarte_purchased": alacarte_purchased,
        },
        "alacarte_price": ALACARTE_PLAN_PRICE,
    }


@api_router.get("/subscription/tiers")
async def get_tiers():
    return {"tiers": SUBSCRIPTION_TIERS}


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
