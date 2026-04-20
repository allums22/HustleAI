"""
HustleAI Backend Retention Endpoints Test Suite
Tests all 10/10 retention feature endpoints using Empire tier session token
"""
import os
import sys
import json
import requests
from typing import Dict, Any

BACKEND_URL = None
with open("/app/frontend/.env", "r") as f:
    for line in f:
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BACKEND_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
            break

API = f"{BACKEND_URL}/api"
SESSION_TOKEN = "sess_02b7e25f5bf24900abc602309216532a"
HEADERS = {
    "Authorization": f"Bearer {SESSION_TOKEN}",
    "Content-Type": "application/json",
}
HUSTLE_ID = "hustle_704f65442468"

results = []

def log(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}")
    if detail:
        print(f"     -> {detail}")
    results.append({"name": name, "ok": ok, "detail": detail})

def _req(method, path, **kw):
    url = f"{API}{path}"
    kw.setdefault("headers", HEADERS)
    kw.setdefault("timeout", 60)
    try:
        return requests.request(method, url, **kw)
    except Exception as e:
        return e

print(f"Backend base URL: {API}")
print(f"Auth token: {SESSION_TOKEN}")
print("=" * 70)

# 1. INCOME TRACKER
print("\n[1] Income Tracker")
r = _req("POST", "/income/log", json={
    "hustle_id": HUSTLE_ID, "amount": 250, "note": "First client payment"
})
if isinstance(r, Exception):
    log("POST /api/income/log", False, f"Exception: {r}")
else:
    try:
        ok = r.status_code == 200 and r.json().get("status") == "ok"
    except Exception:
        ok = False
    log("POST /api/income/log", ok, f"HTTP {r.status_code} body={r.text[:200]}")

r = _req("GET", "/income/summary")
if isinstance(r, Exception):
    log("GET /api/income/summary", False, f"Exception: {r}")
else:
    try:
        j = r.json()
        keys_ok = all(k in j for k in ["total", "this_month", "entries", "by_hustle"])
        ok = r.status_code == 200 and keys_ok
        log("GET /api/income/summary", ok,
            f"HTTP {r.status_code} total={j.get('total')} this_month={j.get('this_month')} "
            f"entries={len(j.get('entries', []))} by_hustle={len(j.get('by_hustle', []))}")
    except Exception as e:
        log("GET /api/income/summary", False, f"Parse error: {e}")

# 2. DAILY TASK
print("\n[2] Daily Task")
plan_id_for_daily = None
day_for_daily = None
r = _req("GET", "/daily-task")
if isinstance(r, Exception):
    log("GET /api/daily-task", False, f"Exception: {r}")
else:
    try:
        j = r.json()
        ok = r.status_code == 200
        if j.get("task") is None:
            log("GET /api/daily-task", ok, f"HTTP {r.status_code} no plans exist -> {{task: null}}")
        else:
            task = j["task"]
            plan_id_for_daily = j.get("plan_id")
            day_for_daily = task.get("day")
            ok2 = ok and "day" in task and "tasks" in task and plan_id_for_daily
            log("GET /api/daily-task", ok2,
                f"HTTP {r.status_code} day={day_for_daily} plan_id={plan_id_for_daily} hustle={j.get('hustle_name')}")
    except Exception as e:
        log("GET /api/daily-task", False, f"Parse error: {e}")

if plan_id_for_daily and day_for_daily is not None:
    r = _req("POST", "/daily-task/complete", json={
        "plan_id": plan_id_for_daily, "day": day_for_daily
    })
    if isinstance(r, Exception):
        log("POST /api/daily-task/complete", False, f"Exception: {r}")
    else:
        try:
            ok = r.status_code == 200 and r.json().get("status") == "ok"
        except Exception:
            ok = False
        log("POST /api/daily-task/complete", ok, f"HTTP {r.status_code} body={r.text[:200]}")
else:
    log("POST /api/daily-task/complete (skipped)", True,
        "SKIPPED - no active plan with daily tasks for this user")

# 3. TASKS & STREAK
print("\n[3] Tasks & Streak")
r = _req("POST", f"/tasks/{HUSTLE_ID}/complete", json={
    "day": 1, "task_index": 0, "completed": True
})
if isinstance(r, Exception):
    log(f"POST /api/tasks/{HUSTLE_ID}/complete", False, f"Exception: {r}")
else:
    try:
        ok = r.status_code == 200 and r.json().get("status") == "ok"
    except Exception:
        ok = False
    log(f"POST /api/tasks/{HUSTLE_ID}/complete", ok, f"HTTP {r.status_code} body={r.text[:200]}")

r = _req("GET", "/tasks/streak")
if isinstance(r, Exception):
    log("GET /api/tasks/streak", False, f"Exception: {r}")
else:
    try:
        j = r.json()
        keys_ok = all(k in j for k in ["current_streak", "longest_streak", "total_completed"])
        ok = r.status_code == 200 and keys_ok
        log("GET /api/tasks/streak", ok,
            f"HTTP {r.status_code} current={j.get('current_streak')} longest={j.get('longest_streak')} total={j.get('total_completed')}")
    except Exception as e:
        log("GET /api/tasks/streak", False, f"Parse error: {e}")

r = _req("GET", f"/tasks/{HUSTLE_ID}/progress")
if isinstance(r, Exception):
    log(f"GET /api/tasks/{HUSTLE_ID}/progress", False, f"Exception: {r}")
else:
    try:
        j = r.json()
        keys_ok = all(k in j for k in ["completed_keys", "completed_count", "total_tasks", "percent"])
        ok = r.status_code == 200 and keys_ok
        log(f"GET /api/tasks/{HUSTLE_ID}/progress", ok,
            f"HTTP {r.status_code} completed={j.get('completed_count')}/{j.get('total_tasks')} percent={j.get('percent')}%")
    except Exception as e:
        log(f"GET /api/tasks/{HUSTLE_ID}/progress", False, f"Parse error: {e}")

# 4. EARNINGS TRACKER
print("\n[4] Earnings Tracker")
earning_id = None
r = _req("POST", "/earnings/log", json={
    "amount": 500, "hustle_id": HUSTLE_ID, "note": "Week 1 sales"
})
if isinstance(r, Exception):
    log("POST /api/earnings/log", False, f"Exception: {r}")
else:
    try:
        j = r.json()
        earning_id = j.get("earning_id")
        ok = r.status_code == 200 and earning_id and j.get("status") == "ok"
        log("POST /api/earnings/log", ok, f"HTTP {r.status_code} earning_id={earning_id}")
    except Exception as e:
        log("POST /api/earnings/log", False, f"Parse error: {e}")

r = _req("GET", "/earnings")
if isinstance(r, Exception):
    log("GET /api/earnings", False, f"Exception: {r}")
else:
    try:
        j = r.json()
        earnings_list = j.get("earnings") if isinstance(j, dict) else j
        ok = r.status_code == 200 and isinstance(earnings_list, list)
        log("GET /api/earnings", ok,
            f"HTTP {r.status_code} count={len(earnings_list) if isinstance(earnings_list, list) else 'N/A'}")
    except Exception as e:
        log("GET /api/earnings", False, f"Parse error: {e}")

r = _req("GET", "/earnings/summary")
if isinstance(r, Exception):
    log("GET /api/earnings/summary", False, f"Exception: {r}")
else:
    try:
        j = r.json()
        keys_ok = all(k in j for k in ["total", "today", "this_week", "this_month", "count"])
        ok = r.status_code == 200 and keys_ok
        log("GET /api/earnings/summary", ok,
            f"HTTP {r.status_code} total={j.get('total')} today={j.get('today')} "
            f"week={j.get('this_week')} month={j.get('this_month')} count={j.get('count')}")
    except Exception as e:
        log("GET /api/earnings/summary", False, f"Parse error: {e}")

# 5. ACHIEVEMENTS
print("\n[5] Achievements")
r = _req("GET", "/achievements")
if isinstance(r, Exception):
    log("GET /api/achievements", False, f"Exception: {r}")
else:
    try:
        j = r.json()
        achs = j.get("achievements", [])
        newly = j.get("newly_unlocked", [])
        count_ok = len(achs) == 12
        schema_ok = all(all(k in a for k in ["id", "name", "desc", "icon", "condition", "unlocked"]) for a in achs)
        ach_map = {a["id"]: a for a in achs}
        first_earning_ok = ach_map.get("first_earning", {}).get("unlocked") is True
        unlocked_ids = [a["id"] for a in achs if a.get("unlocked")]
        ok = r.status_code == 200 and count_ok and schema_ok and first_earning_ok
        log("GET /api/achievements", ok,
            f"HTTP {r.status_code} count={len(achs)}/12 schema_ok={schema_ok} "
            f"first_earning_unlocked={first_earning_ok} unlocked={unlocked_ids} newly={newly}")
    except Exception as e:
        log("GET /api/achievements", False, f"Parse error: {e}")

# 6. COMMUNITY WINS BOARD
print("\n[6] Community Wins Board")
post_id = None
r = _req("POST", "/community/posts", json={
    "content": "Just earned my first $500!",
    "amount": 500,
    "milestone": "First $100",
})
if isinstance(r, Exception):
    log("POST /api/community/posts", False, f"Exception: {r}")
else:
    try:
        j = r.json()
        post_id = j.get("post_id")
        ok = r.status_code == 200 and post_id
        log("POST /api/community/posts", ok, f"HTTP {r.status_code} post_id={post_id}")
    except Exception as e:
        log("POST /api/community/posts", False, f"Parse error: {e}")

r = _req("GET", "/community/posts")
if isinstance(r, Exception):
    log("GET /api/community/posts", False, f"Exception: {r}")
else:
    try:
        j = r.json()
        posts = j.get("posts") if isinstance(j, dict) else j
        found = any(p.get("post_id") == post_id for p in posts) if post_id else True
        ok = r.status_code == 200 and isinstance(posts, list) and found
        log("GET /api/community/posts", ok,
            f"HTTP {r.status_code} count={len(posts) if isinstance(posts, list) else 'N/A'} new_post_found={found}")
    except Exception as e:
        log("GET /api/community/posts", False, f"Parse error: {e}")

if post_id:
    before_r = _req("GET", "/community/posts")
    before_reactions = 0
    try:
        for p in before_r.json().get("posts", []):
            if p.get("post_id") == post_id:
                before_reactions = p.get("reactions", 0)
                break
    except Exception:
        pass
    r = _req("POST", f"/community/posts/{post_id}/react")
    if isinstance(r, Exception):
        log("POST /api/community/posts/<id>/react", False, f"Exception: {r}")
    else:
        try:
            ok = r.status_code == 200 and r.json().get("status") == "ok"
        except Exception:
            ok = False
        after_r = _req("GET", "/community/posts")
        after_reactions = 0
        try:
            for p in after_r.json().get("posts", []):
                if p.get("post_id") == post_id:
                    after_reactions = p.get("reactions", 0)
                    break
        except Exception:
            pass
        incremented = after_reactions > before_reactions
        log("POST /api/community/posts/<id>/react", ok and incremented,
            f"HTTP {r.status_code} reactions {before_reactions} -> {after_reactions}")
else:
    log("POST /api/community/posts/<id>/react", False, "No post_id captured")

# 7. MOTIVATION
print("\n[7] Motivation")
r = _req("GET", "/motivation/daily")
if isinstance(r, Exception):
    log("GET /api/motivation/daily", False, f"Exception: {r}")
else:
    try:
        j = r.json()
        keys_ok = all(k in j for k in ["message", "weekly_estimate", "monthly_estimate",
                                         "current_day", "today_tasks", "percent"])
        ok = r.status_code == 200 and keys_ok
        log("GET /api/motivation/daily", ok,
            f"HTTP {r.status_code} day={j.get('current_day')}/30 tasks={j.get('today_tasks')} "
            f"weekly=${j.get('weekly_estimate')} monthly=${j.get('monthly_estimate')} "
            f"percent={j.get('percent')}% msg={j.get('message','')[:60]}")
    except Exception as e:
        log("GET /api/motivation/daily", False, f"Parse error: {e}")

# 8. REGRESSION
print("\n[8] Regression (core endpoints)")
for path, check in [
    ("/profile", lambda j: j.get("email")),
    ("/hustles", lambda j: isinstance(j.get("hustles") if isinstance(j, dict) else j, list)),
    ("/agents", lambda j: len((j.get("agents") if isinstance(j, dict) else j) or []) >= 4),
    ("/referral/info", lambda j: isinstance(j, dict) and len(j.keys()) >= 1),
]:
    r = _req("GET", path)
    if isinstance(r, Exception):
        log(f"GET /api{path}", False, f"Exception: {r}")
        continue
    try:
        j = r.json()
        ok = r.status_code == 200 and check(j)
        detail = f"HTTP {r.status_code}"
        if path == "/profile":
            detail += f" email={j.get('email')} tier={j.get('subscription_tier')}"
        elif path == "/hustles":
            lst = j.get("hustles") if isinstance(j, dict) else j
            detail += f" count={len(lst) if isinstance(lst, list) else 'N/A'}"
        elif path == "/agents":
            lst = j.get("agents") if isinstance(j, dict) else j
            detail += f" count={len(lst) if isinstance(lst, list) else 'N/A'}"
        elif path == "/referral/info":
            detail += f" keys={list(j.keys()) if isinstance(j, dict) else type(j).__name__}"
        log(f"GET /api{path}", ok, detail)
    except Exception as e:
        log(f"GET /api{path}", False, f"Parse error: {e} body={r.text[:200]}")

# Summary
print("\n" + "=" * 70)
passed = sum(1 for r in results if r["ok"])
total = len(results)
print(f"RESULTS: {passed}/{total} passed")
for r in results:
    if not r["ok"]:
        print(f"  FAIL: {r['name']}: {r['detail']}")
sys.exit(0 if passed == total else 1)
