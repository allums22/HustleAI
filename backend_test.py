"""
Backend test for the 3-Offer Launch Stack endpoints.
Tests: founders/seats, lifetime/instant_kit checkout, regression on existing flows.
"""
import requests
import os
from pymongo import MongoClient

BASE = "https://skill-match-hustle.preview.emergentagent.com/api"
EMPIRE_TOKEN = "sess_02b7e25f5bf24900abc602309216532a"
HUSTLE_ID = "hustle_704f65442468"
ORIGIN = "https://example.com"

H_AUTH = {"Authorization": f"Bearer {EMPIRE_TOKEN}", "Content-Type": "application/json"}
H_NOAUTH = {"Content-Type": "application/json"}

# MongoDB direct connection for verification
MONGO_URL = "mongodb://localhost:27017"
db_name = "test_database"
try:
    with open("/app/backend/.env") as f:
        for line in f:
            line = line.strip()
            if line.startswith("DB_NAME="):
                db_name = line.split("=", 1)[1].strip().strip('"').strip("'")
            if line.startswith("MONGO_URL="):
                MONGO_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
except Exception:
    pass
mongo = MongoClient(MONGO_URL)
db = mongo[db_name]

results = []
def report(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    line = f"[{status}] {name}: {detail}"
    print(line)
    results.append((name, ok, detail))

print(f"\n=== Testing against {BASE} ===")
print(f"=== Mongo db: {db_name} ===\n")

# ---------- 1. GET /api/founders/seats (PUBLIC) ----------
print("--- 1. GET /api/founders/seats (public) ---")
r = requests.get(f"{BASE}/founders/seats", timeout=20)
if r.status_code == 200:
    data = r.json()
    expected_keys = {"sold", "limit", "remaining", "price", "instant_kit_price", "available"}
    keys_ok = expected_keys.issubset(data.keys())
    sold = data.get("sold")
    limit = data.get("limit")
    price = data.get("price")
    instant_price = data.get("instant_kit_price")
    available = data.get("available")
    remaining = data.get("remaining")
    detail = f"sold={sold} limit={limit} remaining={remaining} price={price} instant_kit_price={instant_price} available={available}"
    all_ok = (keys_ok and limit == 100 and price == 149.0 and instant_price == 29.0
              and isinstance(sold, int) and (sold + remaining == limit)
              and available == (remaining > 0))
    report("founders/seats public", all_ok, detail)
else:
    report("founders/seats public", False, f"status={r.status_code} body={r.text[:200]}")

# ---------- 2. lifetime checkout (auth) ----------
print("\n--- 2. lifetime checkout (auth) ---")
body = {"plan": "lifetime", "origin_url": ORIGIN}
r = requests.post(f"{BASE}/payments/create-checkout", headers=H_AUTH, json=body, timeout=30)
lifetime_session_id = None
if r.status_code == 200:
    d = r.json()
    url = d.get("url", "")
    sid = d.get("session_id")
    amount = d.get("amount")
    promo = d.get("promo_applied")
    disc = d.get("discount_pct")
    lifetime_session_id = sid
    cond = (amount == 149.00 and isinstance(url, str) and url.startswith("http")
            and "stripe" in url.lower() and isinstance(sid, str)
            and promo is None and disc == 0)
    report("lifetime checkout payload",
           cond, f"amount={amount} url_prefix={url[:60]} session_id={sid} promo_applied={promo} discount_pct={disc}")
    # Verify mongo row
    txn = db.payment_transactions.find_one({"session_id": sid})
    if txn:
        txn_ok = (txn.get("plan_name") == "lifetime"
                  and float(txn.get("amount", 0)) == 149.0
                  and txn.get("payment_status") == "pending")
        report("lifetime payment_transactions row",
               txn_ok,
               f"plan_name={txn.get('plan_name')} amount={txn.get('amount')} payment_status={txn.get('payment_status')}")
    else:
        report("lifetime payment_transactions row", False, "no row found")
else:
    report("lifetime checkout (auth)", False, f"status={r.status_code} body={r.text[:300]}")

# ---------- 3. instant_kit WITHOUT hustle_id → 400 ----------
print("\n--- 3. instant_kit without hustle_id → 400 ---")
body = {"plan": "instant_kit", "origin_url": ORIGIN}
r = requests.post(f"{BASE}/payments/create-checkout", headers=H_AUTH, json=body, timeout=20)
detail_text = ""
try:
    detail_text = r.json().get("detail", "")
except Exception:
    detail_text = r.text[:200]
ok = r.status_code == 400 and "hustle_id required" in detail_text and "Instant Kit" in detail_text
report("instant_kit no hustle_id → 400", ok, f"status={r.status_code} detail={detail_text}")

# ---------- 4. instant_kit with hustle_id ----------
print("\n--- 4. instant_kit with hustle_id ---")
body = {"plan": "instant_kit", "hustle_id": HUSTLE_ID, "origin_url": ORIGIN}
r = requests.post(f"{BASE}/payments/create-checkout", headers=H_AUTH, json=body, timeout=30)
if r.status_code == 200:
    d = r.json()
    url = d.get("url", "")
    sid = d.get("session_id")
    amount = d.get("amount")
    cond = (amount == 29.00 and isinstance(url, str) and url.startswith("http")
            and "stripe" in url.lower() and isinstance(sid, str))
    report("instant_kit checkout payload",
           cond, f"amount={amount} url_prefix={url[:60]} session_id={sid}")
    txn = db.payment_transactions.find_one({"session_id": sid})
    if txn:
        txn_ok = (txn.get("plan_name") == "instant_kit"
                  and float(txn.get("amount", 0)) == 29.0
                  and txn.get("payment_status") == "pending"
                  and txn.get("hustle_id") == HUSTLE_ID)
        report("instant_kit payment_transactions row",
               txn_ok,
               f"plan_name={txn.get('plan_name')} amount={txn.get('amount')} hustle_id={txn.get('hustle_id')} payment_status={txn.get('payment_status')}")
    else:
        report("instant_kit payment_transactions row", False, "no row found")
else:
    report("instant_kit checkout with hustle_id", False, f"status={r.status_code} body={r.text[:300]}")

# ---------- 5. lifetime WITHOUT auth → 401 ----------
print("\n--- 5. lifetime without auth → 401 ---")
body = {"plan": "lifetime", "origin_url": ORIGIN}
r = requests.post(f"{BASE}/payments/create-checkout", headers=H_NOAUTH, json=body, timeout=20)
ok = r.status_code == 401
report("lifetime no-auth → 401", ok, f"status={r.status_code} body={r.text[:150]}")

# ---------- REGRESSION ----------
print("\n=== REGRESSION ===")

# 6. starter monthly
body = {"plan": "starter", "billing": "monthly", "origin_url": ORIGIN}
r = requests.post(f"{BASE}/payments/create-checkout", headers=H_AUTH, json=body, timeout=30)
if r.status_code == 200:
    d = r.json()
    report("starter monthly amount=9.99", d.get("amount") == 9.99, f"amount={d.get('amount')}")
else:
    report("starter monthly", False, f"status={r.status_code} body={r.text[:200]}")

# 7. empire annual
body = {"plan": "empire", "billing": "annual", "origin_url": ORIGIN}
r = requests.post(f"{BASE}/payments/create-checkout", headers=H_AUTH, json=body, timeout=30)
if r.status_code == 200:
    d = r.json()
    report("empire annual amount=575.88", d.get("amount") == 575.88, f"amount={d.get('amount')}")
else:
    report("empire annual", False, f"status={r.status_code} body={r.text[:200]}")

# 8. alacarte
body = {"plan": "alacarte", "hustle_id": HUSTLE_ID, "origin_url": ORIGIN}
r = requests.post(f"{BASE}/payments/create-checkout", headers=H_AUTH, json=body, timeout=30)
if r.status_code == 200:
    d = r.json()
    report("alacarte amount=4.99", d.get("amount") == 4.99, f"amount={d.get('amount')}")
else:
    report("alacarte", False, f"status={r.status_code} body={r.text[:200]}")

# 9. /subscription/tiers
r = requests.get(f"{BASE}/subscription/tiers", headers=H_AUTH, timeout=15)
if r.status_code == 200:
    d = r.json()
    tiers = d.get("tiers", {})
    promos = d.get("promo_codes_available", [])
    expected_tiers = {"free", "starter", "pro", "empire"}
    has_annual = all("annual_price" in tiers.get(k, {}) for k in expected_tiers if k in tiers)
    promo_ok = "HUSTLE50" in promos and "BETA50" in promos
    cond = expected_tiers.issubset(set(tiers.keys())) and has_annual and promo_ok
    report("/subscription/tiers shape", cond,
           f"tiers={sorted(tiers.keys())} promos={promos} all_have_annual={has_annual}")
else:
    report("/subscription/tiers", False, f"status={r.status_code}")

# 10. promo/validate-checkout HUSTLE50
r = requests.post(f"{BASE}/promo/validate-checkout", headers=H_AUTH, json={"code": "HUSTLE50"}, timeout=15)
if r.status_code == 200:
    d = r.json()
    cond = d.get("valid") is True and d.get("discount_pct") == 50
    report("HUSTLE50 valid", cond, f"resp={d}")
else:
    report("/promo/validate-checkout HUSTLE50", False, f"status={r.status_code}")

# 11. launch-kit/access (empire)
r = requests.get(f"{BASE}/launch-kit/access/{HUSTLE_ID}", headers=H_AUTH, timeout=15)
if r.status_code == 200:
    d = r.json()
    report("empire has_access=true", d.get("has_access") is True, f"resp={d}")
else:
    report("/launch-kit/access empire", False, f"status={r.status_code} body={r.text[:200]}")

# 12. profile empire
r = requests.get(f"{BASE}/profile", headers=H_AUTH, timeout=15)
if r.status_code == 200:
    d = r.json()
    sub = d.get("subscription", {})
    user = d.get("user", {})
    tier = sub.get("tier") or user.get("subscription_tier") or d.get("tier")
    report("profile tier=empire", tier == "empire", f"tier={tier} top_keys={list(d.keys())}")
else:
    report("/profile", False, f"status={r.status_code}")

# 13. challenges/first-100
r = requests.get(f"{BASE}/challenges/first-100", headers=H_AUTH, timeout=15)
if r.status_code == 200:
    d = r.json()
    report("first-100 current=600 completed=true",
           d.get("current") == 600 and d.get("completed") is True,
           f"current={d.get('current')} completed={d.get('completed')}")
else:
    report("/challenges/first-100", False, f"status={r.status_code}")

# 14. leaderboard
r = requests.get(f"{BASE}/leaderboard", headers=H_AUTH, timeout=15)
if r.status_code == 200:
    d = r.json()
    top = d.get("top") or d.get("leaderboard") or []
    rank1 = top[0] if top else {}
    name = rank1.get("name", "")
    report("Adrian A. rank #1",
           "Adrian A." in name and rank1.get("rank") == 1,
           f"top[0].name={name} rank={rank1.get('rank')}")
else:
    report("/leaderboard", False, f"status={r.status_code}")

# Summary
print("\n\n=== SUMMARY ===")
total = len(results)
passed = sum(1 for _, ok, _ in results if ok)
print(f"Total: {total}  Passed: {passed}  Failed: {total - passed}")
for name, ok, detail in results:
    if not ok:
        print(f"  FAIL: {name} :: {detail}")
print(f"\nlifetime_session_id captured: {lifetime_session_id}")
