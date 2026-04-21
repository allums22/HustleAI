"""
HustleAI Launch Polish Backend Tests
Tests: Waitlist, Analytics, Rate Limiting, Welcome Email Queue, Regression
"""
import requests
import time
import sys

BASE = "https://skill-match-hustle.preview.emergentagent.com/api"
EMPIRE_TOKEN = "sess_02b7e25f5bf24900abc602309216532a"
EMPIRE_HEADERS = {"Authorization": f"Bearer {EMPIRE_TOKEN}"}

results = []

def log(name, ok, detail=""):
    icon = "✅" if ok else "❌"
    line = f"{icon} {name}: {detail}"
    print(line)
    results.append((ok, name, detail))

# ═══ 1. WAITLIST ═══
print("\n=== 1. WAITLIST ===")

try:
    r = requests.get(f"{BASE}/waitlist/count", timeout=15)
    data = r.json()
    total = data.get("total", 0)
    log("GET /waitlist/count", r.status_code == 200 and total >= 47,
        f"status={r.status_code}, total={total} (should be >=47)")
except Exception as e:
    log("GET /waitlist/count", False, f"Error: {e}")

ts = int(time.time())
waitlist_email = f"newuser+test{ts}@hustleai.com"
first_pos = None
try:
    r = requests.post(f"{BASE}/waitlist/subscribe",
                      json={"email": waitlist_email, "source": "landing"}, timeout=15)
    data = r.json()
    first_pos = data.get("position")
    first_total = data.get("total_joined")
    ok = r.status_code == 200 and data.get("status") == "subscribed" and isinstance(first_pos, int)
    log("POST /waitlist/subscribe (new)", ok,
        f"status={data.get('status')}, position={first_pos}, total_joined={first_total}")
except Exception as e:
    log("POST /waitlist/subscribe (new)", False, f"Error: {e}")

try:
    r = requests.post(f"{BASE}/waitlist/subscribe",
                      json={"email": waitlist_email, "source": "landing"}, timeout=15)
    data = r.json()
    pos2 = data.get("position")
    ok = (r.status_code == 200 and data.get("status") == "already_subscribed"
          and pos2 == first_pos)
    log("POST /waitlist/subscribe (duplicate)", ok,
        f"status={data.get('status')}, position={pos2} (should match {first_pos})")
except Exception as e:
    log("POST /waitlist/subscribe (duplicate)", False, f"Error: {e}")

try:
    r = requests.post(f"{BASE}/waitlist/subscribe",
                      json={"email": "notanemail"}, timeout=15)
    detail = ""
    try:
        detail = r.json().get("detail", "")
    except Exception:
        detail = r.text
    ok = r.status_code == 400 and "valid email" in str(detail).lower()
    log("POST /waitlist/subscribe (invalid email)", ok,
        f"status={r.status_code}, detail={detail}")
except Exception as e:
    log("POST /waitlist/subscribe (invalid email)", False, f"Error: {e}")

try:
    r = requests.post(f"{BASE}/waitlist/subscribe", json={}, timeout=15)
    ok = r.status_code in (400, 422)
    log("POST /waitlist/subscribe (empty body)", ok, f"status={r.status_code}")
except Exception as e:
    log("POST /waitlist/subscribe (empty body)", False, f"Error: {e}")

# ═══ 2. ANALYTICS ═══
print("\n=== 2. ANALYTICS ===")

try:
    r = requests.post(f"{BASE}/analytics/track",
                      json={"event": "landing_view", "properties": {"path": "/"}}, timeout=15)
    data = r.json()
    ok = r.status_code == 200 and data.get("status") == "ok"
    log("POST /analytics/track landing_view (no auth)", ok,
        f"status={r.status_code}, body={data}")
except Exception as e:
    log("POST /analytics/track landing_view (no auth)", False, f"Error: {e}")

try:
    r = requests.post(f"{BASE}/analytics/track",
                      json={"event": "beta_invite_view"}, timeout=15)
    data = r.json()
    ok = r.status_code == 200 and data.get("status") == "ok"
    log("POST /analytics/track beta_invite_view", ok,
        f"status={r.status_code}, body={data}")
except Exception as e:
    log("POST /analytics/track beta_invite_view", False, f"Error: {e}")

try:
    r = requests.post(f"{BASE}/analytics/track",
                      headers=EMPIRE_HEADERS,
                      json={"event": "register_submitted"}, timeout=15)
    data = r.json()
    ok = r.status_code == 200 and data.get("status") == "ok"
    log("POST /analytics/track (with Bearer)", ok,
        f"status={r.status_code}, body={data}")
except Exception as e:
    log("POST /analytics/track (with Bearer)", False, f"Error: {e}")

try:
    r = requests.get(f"{BASE}/analytics/funnel", headers=EMPIRE_HEADERS, timeout=15)
    data = r.json() if r.status_code == 200 else {}
    required_keys = ["landing_view", "beta_invite_view", "register_submitted",
                     "quiz_completed", "ai_chat_started", "checkout_started",
                     "checkout_completed", "conversion_rates"]
    missing = [k for k in required_keys if k not in data]
    ok = r.status_code == 200 and not missing
    log("GET /analytics/funnel (Empire)", ok,
        f"status={r.status_code}, missing={missing}, landing_view={data.get('landing_view')}, beta_invite_view={data.get('beta_invite_view')}")
except Exception as e:
    log("GET /analytics/funnel (Empire)", False, f"Error: {e}")

try:
    r = requests.get(f"{BASE}/analytics/funnel", timeout=15)
    ok = r.status_code in (401, 403)
    log("GET /analytics/funnel (no auth)", ok, f"status={r.status_code}")
except Exception as e:
    log("GET /analytics/funnel (no auth)", False, f"Error: {e}")

# Login test5@hustleai.com for free-tier test
free_token = None
try:
    r = requests.post(f"{BASE}/auth/login",
                      json={"email": "test5@hustleai.com", "password": "Test123!"}, timeout=15)
    if r.status_code == 200:
        d = r.json()
        free_token = d.get("session_token")
        tier = d.get("user", {}).get("subscription_tier")
        log("Login test5@hustleai.com (for free-tier test)", bool(free_token),
            f"status={r.status_code}, tier={tier}")
    else:
        log("Login test5@hustleai.com (for free-tier test)", False,
            f"status={r.status_code}, body={r.text[:200]}")
except Exception as e:
    log("Login test5@hustleai.com (for free-tier test)", False, f"Error: {e}")

if free_token:
    try:
        r = requests.get(f"{BASE}/analytics/funnel",
                         headers={"Authorization": f"Bearer {free_token}"}, timeout=15)
        detail = ""
        try:
            detail = r.json().get("detail", "")
        except Exception:
            pass
        ok = r.status_code == 403 and "empire" in str(detail).lower()
        log("GET /analytics/funnel (free tier → 403)", ok,
            f"status={r.status_code}, detail={detail}")
    except Exception as e:
        log("GET /analytics/funnel (free tier → 403)", False, f"Error: {e}")

# ═══ 3. RATE LIMITING ═══
print("\n=== 3. RATE LIMITING ===")

rl_email = f"ratelimit+{ts}@test.com"
first_10 = []
last_2 = []
try:
    for i in range(12):
        r = requests.post(f"{BASE}/auth/login",
                          json={"email": rl_email, "password": "wrong"}, timeout=15)
        if i < 10:
            first_10.append(r.status_code)
        else:
            last_2.append(r.status_code)
    ok_first = all(s == 401 for s in first_10)
    ok_last = all(s == 429 for s in last_2)
    log("Rate limit: first 10 attempts = 401", ok_first, f"statuses={first_10}")
    log("Rate limit: attempts 11-12 = 429", ok_last, f"statuses={last_2}")
except Exception as e:
    log("Rate limit test", False, f"Error: {e}")

# ═══ 4. WELCOME EMAIL QUEUE ═══
print("\n=== 4. WELCOME EMAIL QUEUE ===")

new_user_email = f"launch_test_{ts}@hustleai.com"
new_user_id = None
try:
    r = requests.post(f"{BASE}/auth/register",
                      json={"name": "Test Launch", "email": new_user_email,
                            "password": "Test123!", "beta_code": "HUSTLEVIP2025"},
                      timeout=20)
    if r.status_code == 200:
        d = r.json()
        new_user_token = d.get("session_token")
        new_user_id = d.get("user", {}).get("user_id")
        log("POST /auth/register (new user for email queue)", bool(new_user_token),
            f"status={r.status_code}, user_id={new_user_id}, tier={d.get('user', {}).get('subscription_tier')}")
    else:
        log("POST /auth/register (new user for email queue)", False,
            f"status={r.status_code}, body={r.text[:200]}")
except Exception as e:
    log("POST /auth/register (new user for email queue)", False, f"Error: {e}")

# GET /admin/email-queue/pending with Empire
try:
    r = requests.get(f"{BASE}/admin/email-queue/pending",
                     headers=EMPIRE_HEADERS, timeout=15)
    data = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and "pending" in data and "count" in data
    log("GET /admin/email-queue/pending (Empire)", ok,
        f"status={r.status_code}, pending_count={data.get('count')} (emails scheduled Day 1/3/7/14 are FUTURE; pending filter is <=now)")
except Exception as e:
    log("GET /admin/email-queue/pending (Empire)", False, f"Error: {e}")

# Direct DB verification: check that 4 email_queue entries exist for new user via backend DB
# We can't query mongo directly here, but we can verify indirectly: try the endpoint,
# and also make a raw call to count emails by the given email (via admin endpoint if exists).
# Since admin/email-queue/pending filters scheduled_for<=now, none of our 4 future-scheduled emails show.
# That's expected. Let's verify via mongo directly if available.
try:
    import subprocess
    # Load MONGO_URL from backend env
    import os
    mongo_url = None
    db_name = None
    with open("/app/backend/.env") as f:
        for line in f:
            if line.startswith("MONGO_URL="):
                mongo_url = line.split("=", 1)[1].strip().strip('"').strip("'")
            if line.startswith("DB_NAME="):
                db_name = line.split("=", 1)[1].strip().strip('"').strip("'")
    if mongo_url and db_name and new_user_id:
        from pymongo import MongoClient
        mc = MongoClient(mongo_url)
        mdb = mc[db_name]
        queued = list(mdb.email_queue.find({"user_id": new_user_id}))
        ok = len(queued) == 4
        offsets = sorted([
            # derive day offset from scheduled_for - created_at if present
        ])
        subjects = [q.get("subject", "") for q in queued]
        log("DB: 4 welcome emails queued for new user", ok,
            f"count={len(queued)}, subjects={subjects}")
        mc.close()
except Exception as e:
    log("DB: 4 welcome emails queued for new user", False, f"Error: {e}")

# ═══ 5. REGRESSION ═══
print("\n=== 5. REGRESSION ===")

try:
    r = requests.get(f"{BASE}/profile", headers=EMPIRE_HEADERS, timeout=15)
    data = r.json() if r.status_code == 200 else {}
    tier = data.get("subscription", {}).get("tier")
    ok = r.status_code == 200 and tier == "empire"
    log("GET /profile (Empire)", ok, f"status={r.status_code}, tier={tier}")
except Exception as e:
    log("GET /profile (Empire)", False, f"Error: {e}")

try:
    r = requests.get(f"{BASE}/challenges/first-100", headers=EMPIRE_HEADERS, timeout=15)
    data = r.json() if r.status_code == 200 else {}
    current = data.get("current")
    completed = data.get("completed")
    ok = r.status_code == 200 and float(current or 0) >= 600 and completed is True
    log("GET /challenges/first-100", ok,
        f"status={r.status_code}, current=${current}, completed={completed}")
except Exception as e:
    log("GET /challenges/first-100", False, f"Error: {e}")

try:
    r = requests.get(f"{BASE}/leaderboard", headers=EMPIRE_HEADERS, timeout=15)
    data = r.json() if r.status_code == 200 else {}
    top = data.get("top", [])
    top_name = top[0]["name"] if top else ""
    ok = r.status_code == 200 and "Adrian" in top_name
    log("GET /leaderboard (Adrian #1)", ok,
        f"status={r.status_code}, top[0]={top_name}")
except Exception as e:
    log("GET /leaderboard (Adrian #1)", False, f"Error: {e}")

try:
    r = requests.get(f"{BASE}/activity/live", timeout=15)
    data = r.json() if r.status_code == 200 else {}
    acts = data.get("activities", [])
    ok = r.status_code == 200 and isinstance(acts, list) and len(acts) > 0
    log("GET /activity/live", ok, f"status={r.status_code}, count={len(acts)}")
except Exception as e:
    log("GET /activity/live", False, f"Error: {e}")

try:
    r = requests.get(f"{BASE}/subscription/tiers", timeout=15)
    data = r.json() if r.status_code == 200 else {}
    empire_price = data.get("tiers", {}).get("empire", {}).get("price")
    ok = r.status_code == 200 and float(empire_price or 0) == 79.99
    log("GET /subscription/tiers (Empire=$79.99)", ok,
        f"status={r.status_code}, empire.price={empire_price}")
except Exception as e:
    log("GET /subscription/tiers", False, f"Error: {e}")

# ═══ SUMMARY ═══
print("\n" + "="*60)
passed = sum(1 for ok, _, _ in results if ok)
total = len(results)
print(f"TOTAL: {passed}/{total} passed")
print("="*60)
for ok, name, detail in results:
    if not ok:
        print(f"  ❌ {name}: {detail}")
sys.exit(0 if passed == total else 1)
