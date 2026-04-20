"""
Backend tests for HustleAI BREAKOUT endpoints.
Tests the 9 new endpoints with Empire tier session token.
"""
import requests
import json

BASE = "https://skill-match-hustle.preview.emergentagent.com/api"
TOKEN = "sess_02b7e25f5bf24900abc602309216532a"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

results = []

def log(name, ok, detail=""):
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name}")
    if detail:
        print(f"   {detail}")
    results.append((name, ok, detail))


def truncate(obj, n=400):
    s = json.dumps(obj, default=str) if not isinstance(obj, str) else obj
    return s if len(s) <= n else s[:n] + "..."


# ==================== 1) LIVE ACTIVITY FEED (NO AUTH) ====================
print("\n========== 1. Live Activity Feed (public) ==========")
try:
    r = requests.get(f"{BASE}/activity/live", timeout=30)
    if r.status_code == 200:
        data = r.json()
        activities = data.get("activities", [])
        types = set(a.get("type") for a in activities)
        has_required_fields = all(
            all(k in a for k in ("type", "text", "emoji", "created_at"))
            for a in activities
        )
        sorted_desc = all(
            activities[i].get("created_at", "") >= activities[i + 1].get("created_at", "")
            for i in range(len(activities) - 1)
        )
        ok = (
            isinstance(activities, list)
            and has_required_fields
            and sorted_desc
        )
        log(
            "GET /activity/live (no auth)",
            ok,
            f"status=200, count={len(activities)}, types={types}, sorted_desc={sorted_desc}, sample={truncate(activities[0] if activities else {})}",
        )
    else:
        log("GET /activity/live (no auth)", False, f"status={r.status_code}, body={truncate(r.text)}")
except Exception as e:
    log("GET /activity/live (no auth)", False, f"exc={e}")


# ==================== 2) MONTHLY LEADERBOARD ====================
print("\n========== 2. Monthly Leaderboard ==========")
try:
    r = requests.get(f"{BASE}/leaderboard", headers=HEADERS, timeout=30)
    if r.status_code == 200:
        data = r.json()
        board = data.get("leaderboard", [])
        rank = data.get("your_rank")
        month = data.get("month", "")
        top = board[0] if board else {}
        adrian_ok = "Adrian" in top.get("name", "") and top.get("total") == 600
        schema_ok = all(
            all(k in e for k in ("rank", "name", "tier", "total", "earnings_count", "is_you"))
            for e in board
        )
        log(
            "GET /leaderboard",
            schema_ok and bool(month) and rank is not None,
            f"month={month}, your_rank={rank}, entries={len(board)}, top={truncate(top)}, adrian_top_600={adrian_ok}",
        )
    else:
        log("GET /leaderboard", False, f"status={r.status_code}, body={truncate(r.text)}")
except Exception as e:
    log("GET /leaderboard", False, f"exc={e}")


# ==================== 3) DAILY AI CHECK-IN COACH ====================
print("\n========== 3. Daily AI Check-In Coach ==========")
try:
    r = requests.get(f"{BASE}/coach/checkin/today", headers=HEADERS, timeout=30)
    if r.status_code == 200:
        data = r.json()
        ok = "checked_in" in data and "checkin" in data
        log(
            "GET /coach/checkin/today",
            ok,
            f"checked_in={data.get('checked_in')}, checkin_present={data.get('checkin') is not None}",
        )
    else:
        log("GET /coach/checkin/today", False, f"status={r.status_code}, body={truncate(r.text)}")
except Exception as e:
    log("GET /coach/checkin/today", False, f"exc={e}")

first_response = None
try:
    body = {"feeling": "good", "blocker": "feeling tired"}
    r = requests.post(f"{BASE}/coach/checkin", headers=HEADERS, json=body, timeout=120)
    if r.status_code == 200:
        data = r.json()
        response_text = data.get("response", "")
        first_response = response_text
        word_count = len(response_text.split())
        has_markdown = any(ch in response_text for ch in ("**", "`"))
        already = data.get("already_checked_in")
        fallback_signal = response_text.startswith("You've got this! Focus on one thing today")
        ok = (
            "date" in data
            and isinstance(response_text, str)
            and len(response_text) > 0
        )
        log(
            "POST /coach/checkin (first)",
            ok,
            f"already={already}, date={data.get('date')}, words={word_count}, has_markdown={has_markdown}, is_fallback={fallback_signal}, response={truncate(response_text, 300)}",
        )
    else:
        log("POST /coach/checkin (first)", False, f"status={r.status_code}, body={truncate(r.text)}")
except Exception as e:
    log("POST /coach/checkin (first)", False, f"exc={e}")

try:
    body = {"feeling": "good", "blocker": "feeling tired"}
    r = requests.post(f"{BASE}/coach/checkin", headers=HEADERS, json=body, timeout=30)
    if r.status_code == 200:
        data = r.json()
        already = data.get("already_checked_in")
        same = data.get("response") == first_response if first_response else False
        ok = already is True and same
        log(
            "POST /coach/checkin (dedup)",
            ok,
            f"already_checked_in={already}, same_response_as_first={same}",
        )
    else:
        log("POST /coach/checkin (dedup)", False, f"status={r.status_code}, body={truncate(r.text)}")
except Exception as e:
    log("POST /coach/checkin (dedup)", False, f"exc={e}")


# ==================== 4) SHAREABLE PUBLIC SCORECARD ====================
print("\n========== 4. Shareable Public Scorecard ==========")
scorecard_id = None
try:
    r = requests.post(f"{BASE}/scorecard/generate", headers=HEADERS, timeout=30)
    if r.status_code == 200:
        data = r.json()
        scorecard_id = data.get("scorecard_id")
        share = data.get("share_url_path", "")
        ok = (
            bool(scorecard_id)
            and scorecard_id.startswith("sc_")
            and bool(data.get("archetype"))
            and share == f"/s/{scorecard_id}"
        )
        log(
            "POST /scorecard/generate",
            ok,
            f"scorecard_id={scorecard_id}, archetype={data.get('archetype')}, share_url={share}",
        )
    else:
        log("POST /scorecard/generate", False, f"status={r.status_code}, body={truncate(r.text)}")
except Exception as e:
    log("POST /scorecard/generate", False, f"exc={e}")

if scorecard_id:
    try:
        r1 = requests.get(f"{BASE}/scorecard/public/{scorecard_id}", timeout=30)
        if r1.status_code == 200:
            data = r1.json()
            views1 = data.get("views")
            has_user_id = "user_id" in data
            required_keys = [
                "scorecard_id", "user_name_first", "archetype", "archetype_emoji",
                "archetype_desc", "hours_per_week", "income_goal", "top_hustles",
            ]
            missing = [k for k in required_keys if k not in data]
            top_h = data.get("top_hustles", [])
            r2 = requests.get(f"{BASE}/scorecard/public/{scorecard_id}", timeout=30)
            views2 = r2.json().get("views")
            ok = (
                not has_user_id
                and not missing
                and len(top_h) == 3
                and (views2 or 0) > (views1 or 0)
            )
            log(
                "GET /scorecard/public/{id} (no auth + views inc)",
                ok,
                f"views={views1}->{views2}, user_id_hidden={not has_user_id}, missing={missing}, top_hustles_count={len(top_h)}, archetype={data.get('archetype')}, user_name_first={data.get('user_name_first')}",
            )
        else:
            log("GET /scorecard/public/{id}", False, f"status={r1.status_code}, body={truncate(r1.text)}")
    except Exception as e:
        log("GET /scorecard/public/{id}", False, f"exc={e}")
else:
    log("GET /scorecard/public/{id}", False, "skipped — no scorecard_id")

try:
    r = requests.get(f"{BASE}/scorecard/mine", headers=HEADERS, timeout=30)
    if r.status_code == 200:
        data = r.json()
        sc = data.get("scorecard")
        ok = sc is not None and sc.get("scorecard_id") == scorecard_id
        log(
            "GET /scorecard/mine",
            ok,
            f"id_matches={sc.get('scorecard_id') == scorecard_id if sc else False}, archetype={sc.get('archetype') if sc else None}",
        )
    else:
        log("GET /scorecard/mine", False, f"status={r.status_code}, body={truncate(r.text)}")
except Exception as e:
    log("GET /scorecard/mine", False, f"exc={e}")


# ==================== 5) FIRST $100 CHALLENGE ====================
print("\n========== 5. First $100 Challenge ==========")
try:
    r = requests.get(f"{BASE}/challenges/first-100", headers=HEADERS, timeout=30)
    if r.status_code == 200:
        data = r.json()
        ok = (
            data.get("target") == 100.00
            and data.get("current") == 600.00
            and data.get("percent") == 100
            and data.get("completed") is True
            and data.get("earnings_count") == 2
            and "days_in" in data
            and "days_remaining" in data
            and "first_earning_date" in data
            and bool(data.get("message"))
        )
        log(
            "GET /challenges/first-100",
            ok,
            f"target={data.get('target')}, current={data.get('current')}, percent={data.get('percent')}, completed={data.get('completed')}, count={data.get('earnings_count')}, days_in={data.get('days_in')}, days_rem={data.get('days_remaining')}, first_date={data.get('first_earning_date')}, msg={truncate(data.get('message'), 120)}",
        )
    else:
        log("GET /challenges/first-100", False, f"status={r.status_code}, body={truncate(r.text)}")
except Exception as e:
    log("GET /challenges/first-100", False, f"exc={e}")


# ==================== 6) PAUSE / RESUME HUSTLE ====================
print("\n========== 6. Pause / Resume Hustle ==========")
HUSTLE_ID = "hustle_704f65442468"
try:
    r = requests.post(f"{BASE}/hustles/{HUSTLE_ID}/pause",
                      headers=HEADERS, json={"reason": "busy this week"}, timeout=30)
    if r.status_code == 200:
        data = r.json()
        ok = data.get("status") == "ok" and bool(data.get("message"))
        log("POST /hustles/{id}/pause", ok, f"status={data.get('status')}, msg={truncate(data.get('message'), 150)}")
    else:
        log("POST /hustles/{id}/pause", False, f"status={r.status_code}, body={truncate(r.text)}")
except Exception as e:
    log("POST /hustles/{id}/pause", False, f"exc={e}")

try:
    r = requests.post(f"{BASE}/hustles/{HUSTLE_ID}/resume", headers=HEADERS, timeout=30)
    if r.status_code == 200:
        data = r.json()
        ok = data.get("status") == "ok" and bool(data.get("message"))
        log("POST /hustles/{id}/resume", ok, f"status={data.get('status')}, msg={truncate(data.get('message'), 150)}")
    else:
        log("POST /hustles/{id}/resume", False, f"status={r.status_code}, body={truncate(r.text)}")
except Exception as e:
    log("POST /hustles/{id}/resume", False, f"exc={e}")


# ==================== REGRESSION ====================
print("\n========== Regression Checks ==========")
try:
    r = requests.get(f"{BASE}/profile", headers=HEADERS, timeout=30)
    if r.status_code == 200:
        data = r.json()
        tier = (
            (data.get("subscription", {}) or {}).get("tier")
            or data.get("tier")
            or (data.get("user", {}) or {}).get("subscription_tier")
        )
        ok = "empire" in str(tier).lower()
        log("GET /profile (Empire tier)", ok, f"tier={tier}")
    else:
        log("GET /profile", False, f"status={r.status_code}")
except Exception as e:
    log("GET /profile", False, f"exc={e}")

try:
    r = requests.get(f"{BASE}/earnings/summary", headers=HEADERS, timeout=30)
    if r.status_code == 200:
        data = r.json()
        ok = data.get("total") == 600
        log(
            "GET /earnings/summary ($600)",
            ok,
            f"total={data.get('total')}, this_month={data.get('this_month')}, count={data.get('count')}",
        )
    else:
        log("GET /earnings/summary", False, f"status={r.status_code}")
except Exception as e:
    log("GET /earnings/summary", False, f"exc={e}")

try:
    r = requests.get(f"{BASE}/achievements", headers=HEADERS, timeout=30)
    if r.status_code == 200:
        data = r.json()
        achievements = data.get("achievements", []) if isinstance(data, dict) else data
        ok = isinstance(achievements, list) and len(achievements) == 12
        unlocked = sum(1 for a in achievements if a.get("unlocked"))
        log("GET /achievements (12 badges)", ok, f"count={len(achievements)}, unlocked={unlocked}")
    else:
        log("GET /achievements", False, f"status={r.status_code}")
except Exception as e:
    log("GET /achievements", False, f"exc={e}")


# ==================== SUMMARY ====================
print("\n" + "=" * 60)
passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
print(f"SUMMARY: {passed}/{total} tests passed")
for name, ok, _ in results:
    mark = "PASS" if ok else "FAIL"
    print(f"  [{mark}] {name}")
