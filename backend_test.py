"""Backend test for Push Notification endpoints + regression."""
import requests
import json

BASE = "https://skill-match-hustle.preview.emergentagent.com/api"
TOKEN = "sess_02b7e25f5bf24900abc602309216532a"
TRIGGER_SECRET = "sidehustle-jwt-secret-key-2026-secure"
H_AUTH = {"Authorization": f"Bearer {TOKEN}"}

FAKE_SUB = {
    "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint-abc123",
    "keys": {
        "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtZ1hntAo8s1uD9Qh2iZ_7fMF8BH2M9YRn5yH7GqWQxZJGCdLE-rN_0LhLGvmQA",
        "auth": "tBHItJI5svbpez7KI4CCXg",
    },
}

results = []

def check(name, cond, detail=""):
    mark = "PASS" if cond else "FAIL"
    print(f"[{mark}] {name} — {detail}")
    results.append((name, cond, detail))

# 1. VAPID public key (public)
r = requests.get(f"{BASE}/push/vapid-public-key")
data = r.json() if r.status_code == 200 else {}
pk = data.get("public_key", "")
check("1a. GET /push/vapid-public-key 200", r.status_code == 200, f"status={r.status_code}")
check("1b. public_key ~87 chars starts with BH",
      isinstance(pk, str) and pk.startswith("BH") and 80 <= len(pk) <= 95,
      f"len={len(pk)} starts_BH={pk.startswith('BH')} key={pk[:25]}...")
check("1c. enabled=True", data.get("enabled") is True, f"enabled={data.get('enabled')}")

# 2. Push Subscribe
r = requests.post(f"{BASE}/push/subscribe", json=FAKE_SUB)
check("2a. subscribe without auth -> 401", r.status_code == 401, f"status={r.status_code}")
r = requests.post(f"{BASE}/push/subscribe", json=FAKE_SUB, headers=H_AUTH)
data = r.json() if r.status_code == 200 else {}
check("2b. subscribe with auth 200", r.status_code == 200, f"status={r.status_code} body={data}")
check("2c. status=subscribed", data.get("status") == "subscribed", f"got={data.get('status')}")

# 4. Send Test (before unsub so fake sub exists)
r = requests.post(f"{BASE}/push/send-test")
check("4a. send-test without auth -> 401", r.status_code == 401, f"status={r.status_code}")
r = requests.post(f"{BASE}/push/send-test", headers=H_AUTH)
data = r.json() if r.status_code == 200 else {}
check("4b. send-test with auth 200 (not 500)", r.status_code == 200,
      f"status={r.status_code} body={r.text[:200]}")
check("4c. shape {status:ok, devices_notified:int}",
      data.get("status") == "ok" and isinstance(data.get("devices_notified"), int),
      f"body={data}")

# 3. Push Unsubscribe
r = requests.post(f"{BASE}/push/unsubscribe", json=FAKE_SUB)
check("3a. unsubscribe without auth -> 401", r.status_code == 401, f"status={r.status_code}")
r = requests.post(f"{BASE}/push/unsubscribe", json=FAKE_SUB, headers=H_AUTH)
data = r.json() if r.status_code == 200 else {}
check("3b. unsubscribe with auth 200", r.status_code == 200, f"status={r.status_code} body={data}")
check("3c. status=unsubscribed", data.get("status") == "unsubscribed", f"got={data.get('status')}")

# 5. Daily Reminders Trigger
r = requests.post(f"{BASE}/push/triggers/daily-reminders")
check("5a. trigger without secret -> 403", r.status_code == 403, f"status={r.status_code}")
check("5b. error message 'Invalid trigger secret'",
      "Invalid trigger secret" in r.text, f"body={r.text[:150]}")

r = requests.post(
    f"{BASE}/push/triggers/daily-reminders",
    headers={"x-trigger-secret": "wrong-secret-xyz"},
)
check("5c. trigger with wrong secret -> 403", r.status_code == 403, f"status={r.status_code}")

r = requests.post(
    f"{BASE}/push/triggers/daily-reminders",
    headers={"x-trigger-secret": TRIGGER_SECRET},
)
data = r.json() if r.status_code == 200 else {}
check("5d. trigger with valid secret -> 200", r.status_code == 200,
      f"status={r.status_code} body={r.text[:200]}")
check("5e. shape {status:ok, total_sent:int}",
      data.get("status") == "ok" and isinstance(data.get("total_sent"), int),
      f"body={data}")

# 6. Regression
r = requests.get(f"{BASE}/profile", headers=H_AUTH)
data = r.json() if r.status_code == 200 else {}
tier = None
if isinstance(data, dict):
    if isinstance(data.get("subscription"), dict):
        tier = data["subscription"].get("tier")
    tier = tier or data.get("subscription_tier")
check("6a. /profile empire tier", r.status_code == 200 and tier == "empire",
      f"status={r.status_code} tier={tier}")

r = requests.get(f"{BASE}/subscription/tiers")
data = r.json() if r.status_code == 200 else {}
tiers = data.get("tiers", {}) if isinstance(data, dict) else {}
empire = tiers.get("empire", {}) if isinstance(tiers, dict) else {}
check("6b. /subscription/tiers empire=$79.99",
      empire.get("price") == 79.99, f"empire.price={empire.get('price')}")

r = requests.get(f"{BASE}/challenges/first-100", headers=H_AUTH)
data = r.json() if r.status_code == 200 else {}
check("6c. /challenges/first-100 completed=true",
      r.status_code == 200 and data.get("completed") is True,
      f"status={r.status_code} completed={data.get('completed')} current={data.get('current')}")

r = requests.get(f"{BASE}/waitlist/count")
data = r.json() if r.status_code == 200 else {}
count = data.get("count") or data.get("total_joined") or data.get("total") or 0
check("6d. /waitlist/count >=47", r.status_code == 200 and count >= 47,
      f"status={r.status_code} count={count}")

r = requests.post(f"{BASE}/analytics/track", json={"event": "test_event"})
data = r.json() if r.status_code == 200 else {}
check("6e. /analytics/track status=ok",
      r.status_code == 200 and data.get("status") == "ok",
      f"status={r.status_code} body={data}")

# 6f. login rate limit - 12 attempts from X-Forwarded-For 198.51.100.99
ip_header = {"X-Forwarded-For": "198.51.100.99"}
statuses = []
bad_payload = {"email": "notreal-rl-test@example.com", "password": "definitelywrong!!"}
for i in range(12):
    r = requests.post(f"{BASE}/auth/login", json=bad_payload, headers=ip_header)
    statuses.append(r.status_code)
check("6f. login: attempts 11-12 should return 429",
      statuses[10] == 429 and statuses[11] == 429,
      f"statuses={statuses}")

# Summary
print("\n===== SUMMARY =====")
passed = sum(1 for _, ok, _ in results if ok)
failed = len(results) - passed
print(f"PASSED: {passed}/{len(results)}")
if failed:
    print("FAILURES:")
    for n, ok, d in results:
        if not ok:
            print(f" ❌ {n} — {d}")
