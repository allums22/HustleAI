"""
Backend test for Resend email integration + critical regression.
"""
import os
import sys
import time
import asyncio
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://skill-match-hustle.preview.emergentagent.com").rstrip("/") + "/api"
EMPIRE_TOKEN = "sess_02b7e25f5bf24900abc602309216532a"

H_EMPIRE = {"Authorization": f"Bearer {EMPIRE_TOKEN}"}

results = []

def record(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}: {detail}")
    results.append({"name": name, "ok": ok, "detail": detail})

def t1_test_send_empire():
    r = requests.post(f"{BASE}/admin/email/test-send", headers=H_EMPIRE, timeout=30)
    try:
        body = r.json()
    except Exception:
        body = {"raw": r.text}
    ok = (r.status_code == 200
          and body.get("status") == "ok"
          and body.get("provider_id")
          and body.get("error") in (None, "")
          and body.get("to"))
    record("1. POST /admin/email/test-send (Empire)", ok,
           f"status={r.status_code} body={body}")
    return body

def t2_test_send_no_auth():
    r = requests.post(f"{BASE}/admin/email/test-send", timeout=15)
    ok = r.status_code == 401
    record("2. /admin/email/test-send no auth → 401", ok,
           f"status={r.status_code} body={r.text[:200]}")

def make_free_user():
    ts = int(time.time())
    email = f"free_test_{ts}@hustleai.com"
    payload = {"email": email, "password": "Test123!", "name": "Free Tester"}
    r = requests.post(f"{BASE}/auth/register", json=payload, timeout=30)
    if r.status_code != 200:
        return None, None, email, r
    body = r.json()
    return body.get("session_token"), body.get("user", {}).get("user_id"), email, r

def t3_test_send_free():
    token, uid, email, reg_r = make_free_user()
    if not token:
        record("3. /admin/email/test-send free user → 403", False,
               f"could not create free user: status={reg_r.status_code} body={reg_r.text[:200]}")
        return None, None, None
    r = requests.post(f"{BASE}/admin/email/test-send",
                      headers={"Authorization": f"Bearer {token}"}, timeout=15)
    ok = r.status_code == 403 and "Empire" in r.text
    record("3. /admin/email/test-send free user → 403", ok,
           f"status={r.status_code} body={r.text[:200]}")
    # Park welcome emails for this free user too (cleanup)
    if uid:
        async def park():
            from motor.motor_asyncio import AsyncIOMotorClient
            client = AsyncIOMotorClient(os.environ["MONGO_URL"])
            db = client[os.environ["DB_NAME"]]
            await db.email_queue.update_many(
                {"user_id": uid, "status": "pending"},
                {"$set": {"scheduled_for": "2099-01-01T00:00:00+00:00"}}
            )
        asyncio.run(park())
    return token, uid, email

def t4_dispatch_empire():
    r = requests.post(f"{BASE}/admin/email/dispatch-now", headers=H_EMPIRE, timeout=120)
    try:
        body = r.json()
    except Exception:
        body = {"raw": r.text}
    ok = (r.status_code == 200
          and body.get("status") == "ok"
          and isinstance(body.get("sent"), int))
    record("4. POST /admin/email/dispatch-now (Empire)", ok,
           f"status={r.status_code} body={body}")
    return body

def t5_dispatch_no_auth():
    r = requests.post(f"{BASE}/admin/email/dispatch-now", timeout=15)
    ok = r.status_code == 401
    record("5. /admin/email/dispatch-now no auth → 401", ok,
           f"status={r.status_code} body={r.text[:200]}")

def t6_register_and_verify_queue():
    ts = int(time.time())
    email = f"email_test_{ts}@hustleai.com"
    payload = {"email": email, "password": "Test123!", "name": "Email Test User"}
    r = requests.post(f"{BASE}/auth/register", json=payload, timeout=30)
    if r.status_code != 200:
        record("6a. register fresh user", False, f"status={r.status_code} body={r.text[:200]}")
        return None, None
    body = r.json()
    user_id = body.get("user", {}).get("user_id")
    record("6a. register fresh user", bool(user_id), f"user_id={user_id} email={email}")

    async def verify():
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        return await db.email_queue.find(
            {"user_id": user_id}, {"_id": 0}
        ).sort("scheduled_for", 1).to_list(20)
    rows = asyncio.run(verify())
    types = sorted([r.get("type") for r in rows])
    expected = sorted(["welcome_day_0", "welcome_day_3", "welcome_day_7", "welcome_day_14"])
    types_ok = (types == expected and len(rows) == 4)
    record("6b. 4 email_queue rows (welcome_day_0/3/7/14)", types_ok,
           f"got types={types} count={len(rows)}")

    day0 = next((r for r in rows if r.get("type") == "welcome_day_0"), None)
    day0_ok = False
    detail = ""
    if day0:
        try:
            sched = datetime.fromisoformat(day0["scheduled_for"].replace("Z", "+00:00"))
            delta = abs((datetime.now(timezone.utc) - sched).total_seconds())
            day0_ok = delta < 30
            detail = f"scheduled_for={day0['scheduled_for']} delta={delta:.1f}s status={day0.get('status')}"
        except Exception as e:
            detail = f"parse error: {e}"
    record("6c. Day 0 scheduled_for ~ now", day0_ok, detail)
    return user_id, email

def t6d_dispatch_flush_day0(user_id):
    if not user_id:
        record("6d. Day 0 flushes via dispatch-now", False, "no user_id")
        return
    async def bump():
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        await db.email_queue.update_many(
            {"user_id": user_id, "type": {"$in": ["welcome_day_3", "welcome_day_7", "welcome_day_14"]}},
            {"$set": {"scheduled_for": "2099-01-01T00:00:00+00:00"}}
        )
    asyncio.run(bump())

    r = requests.post(f"{BASE}/admin/email/dispatch-now", headers=H_EMPIRE, timeout=120)
    body = r.json() if r.ok else {"raw": r.text}
    print(f"  dispatch-now after bump: status={r.status_code} body={body}")

    async def fetch_day0():
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        return await db.email_queue.find_one(
            {"user_id": user_id, "type": "welcome_day_0"}, {"_id": 0}
        )
    day0 = asyncio.run(fetch_day0())
    ok = bool(day0 and day0.get("status") == "sent" and day0.get("provider_id"))
    record("6d. Day 0 flushed → status=sent + provider_id", ok,
           f"status={day0.get('status') if day0 else None} provider_id={day0.get('provider_id') if day0 else None} error={day0.get('error') if day0 else None}")

def t6e_park_remaining(user_id):
    if not user_id:
        return
    async def park():
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        res = await db.email_queue.update_many(
            {"user_id": user_id, "status": "pending"},
            {"$set": {"scheduled_for": "2099-01-01T00:00:00+00:00"}}
        )
        return res.modified_count
    n = asyncio.run(park())
    record("6e. Day 3/7/14 parked at 2099", True, f"updated_count={n}")

def t7_regression():
    r = requests.get(f"{BASE}/founders/seats", timeout=15)
    j = r.json() if r.ok else {}
    ok = (r.status_code == 200 and j.get("limit") == 100 and j.get("price") == 149.0
          and j.get("instant_kit_price") == 29.0 and "remaining" in j and "sold" in j and "available" in j)
    record("7a. GET /founders/seats", ok, f"status={r.status_code} body={j}")

    payload = {"plan": "lifetime", "origin_url": "https://example.com"}
    r = requests.post(f"{BASE}/payments/create-checkout", json=payload, headers=H_EMPIRE, timeout=30)
    j = r.json() if r.ok else {}
    ok = r.status_code == 200 and j.get("amount") == 149.0 and j.get("session_id") and j.get("url")
    record("7b. /payments/create-checkout lifetime → 149.0", ok,
           f"status={r.status_code} amount={j.get('amount')}")

    payload = {"plan": "instant_kit", "hustle_id": "hustle_704f65442468", "origin_url": "https://example.com"}
    r = requests.post(f"{BASE}/payments/create-checkout", json=payload, headers=H_EMPIRE, timeout=30)
    j = r.json() if r.ok else {}
    ok = r.status_code == 200 and j.get("amount") == 29.0 and j.get("session_id")
    record("7c. /payments/create-checkout instant_kit → 29.0", ok,
           f"status={r.status_code} amount={j.get('amount')}")

    r = requests.get(f"{BASE}/subscription/tiers", timeout=15)
    j = r.json() if r.ok else {}
    tiers = j.get("tiers", {})
    promos = j.get("promo_codes_available", [])
    ok = (r.status_code == 200 and len(tiers) == 4 and set(promos) == {"HUSTLE50", "BETA50"})
    record("7d. GET /subscription/tiers (4 tiers + promos)", ok,
           f"tiers={list(tiers.keys())} promos={promos}")

    r = requests.get(f"{BASE}/profile", headers=H_EMPIRE, timeout=15)
    j = r.json() if r.ok else {}
    tier = (j.get("subscription") or {}).get("tier") or j.get("tier")
    ok = r.status_code == 200 and tier == "empire"
    record("7e. GET /profile → empire", ok, f"tier={tier}")

    payload = {"code": "HUSTLE50"}
    r = requests.post(f"{BASE}/promo/validate-checkout", json=payload, headers=H_EMPIRE, timeout=15)
    j = r.json() if r.ok else {}
    ok = r.status_code == 200 and j.get("valid") is True and j.get("discount_pct") == 50
    record("7f. POST /promo/validate-checkout HUSTLE50", ok, f"body={j}")

    r = requests.get(f"{BASE}/leaderboard", headers=H_EMPIRE, timeout=15)
    j = r.json() if r.ok else {}
    top = j.get("top") or j.get("leaderboard") or []
    name = top[0].get("name") if top else None
    ok = r.status_code == 200 and name and "Adrian" in name
    record("7g. GET /leaderboard → Adrian A. #1", ok, f"top0_name={name}")


def main():
    print(f"Testing against: {BASE}")
    print(f"Empire token: {EMPIRE_TOKEN[:20]}...")
    print()
    print("=== EMAIL ENDPOINTS ===")
    t1_test_send_empire()
    t2_test_send_no_auth()
    t3_test_send_free()
    t4_dispatch_empire()
    t5_dispatch_no_auth()

    print("\n=== EMAIL QUEUE ON REGISTER ===")
    user_id, email = t6_register_and_verify_queue()
    t6d_dispatch_flush_day0(user_id)
    t6e_park_remaining(user_id)

    print("\n=== REGRESSION ===")
    t7_regression()

    print("\n" + "="*60)
    passed = sum(1 for r in results if r["ok"])
    total = len(results)
    print(f"RESULT: {passed}/{total} passed")
    for r in results:
        marker = "PASS" if r["ok"] else "FAIL"
        print(f"  [{marker}] {r['name']}")
    print("="*60)
    sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    main()
