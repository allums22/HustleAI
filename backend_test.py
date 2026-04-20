"""HustleAI Pricing Restructure Backend Tests"""
import requests
import sys

BASE_URL = "https://skill-match-hustle.preview.emergentagent.com/api"
TOKEN = "sess_02b7e25f5bf24900abc602309216532a"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

results = []

def log(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    results.append((name, passed, detail))
    print(f"[{status}] {name}")
    if detail:
        print(f"        {detail}")


def test_subscription_tiers():
    print("\n=== 1. Subscription Tiers with Annual Prices ===")
    r = requests.get(f"{BASE_URL}/subscription/tiers", headers=HEADERS)
    if r.status_code != 200:
        log("GET /subscription/tiers", False, f"HTTP {r.status_code}: {r.text[:200]}")
        return
    data = r.json()
    tiers = data.get("tiers", {})

    expected = {
        "free":    {"price": 0.00, "annual_price": 0.00},
        "starter": {"price": 9.99, "annual_price": 71.88},
        "pro":     {"price": 29.99, "annual_price": 215.88},
        "empire":  {"price": 79.99, "annual_price": 575.88},
    }
    for tier_name, exp in expected.items():
        t = tiers.get(tier_name, {})
        p_ok = t.get("price") == exp["price"]
        ap_ok = t.get("annual_price") == exp["annual_price"]
        log(f"Tier '{tier_name}' price={exp['price']} annual={exp['annual_price']}",
            p_ok and ap_ok,
            f"got price={t.get('price')} annual_price={t.get('annual_price')}")

    empire_bumped = tiers.get("empire", {}).get("price") == 79.99
    log("Empire tier BUMPED to $79.99 (not $49.99)", empire_bumped,
        f"empire.price={tiers.get('empire', {}).get('price')}")

    pcs = data.get("promo_codes_available", [])
    pc_ok = set(pcs) == {"HUSTLE50", "BETA50"}
    log("promo_codes_available = ['HUSTLE50', 'BETA50']", pc_ok, f"got {pcs}")

    apl = data.get("alacarte_plan_price")
    log("alacarte_plan_price = 4.99", apl == 4.99, f"got {apl}")

    akp_gone = "alacarte_kit_price" not in data
    log("alacarte_kit_price NOT in response (killed)", akp_gone,
        f"keys={list(data.keys())}")


def test_promo_validate():
    print("\n=== 2. Promo Code Validation ===")
    cases = [
        ("HUSTLE50", True, 50, "50% off first month"),
        ("hustle50", True, 50, "50% off first month"),
        ("BADCODE", False, None, "Invalid promo code"),
        ("", False, None, "Enter a code"),
    ]
    for code, exp_valid, exp_pct, exp_text in cases:
        r = requests.post(f"{BASE_URL}/promo/validate-checkout",
                          headers=HEADERS, json={"code": code})
        if r.status_code != 200:
            log(f"Promo validate '{code}'", False, f"HTTP {r.status_code}: {r.text[:200]}")
            continue
        d = r.json()
        if exp_valid:
            if d.get("valid") is False and "already used" in (d.get("reason") or "").lower():
                log(f"Promo validate '{code}' (valid code)", True,
                    f"Already used (dedupe working): {d}")
            else:
                ok = (d.get("valid") is True and d.get("discount_pct") == exp_pct
                      and d.get("description") == exp_text)
                log(f"Promo validate '{code}' -> valid=True pct={exp_pct}", ok, f"got {d}")
        else:
            ok = (d.get("valid") is False and d.get("reason") == exp_text)
            log(f"Promo validate '{code}' -> valid=False reason='{exp_text}'", ok, f"got {d}")


def test_checkout_annual():
    print("\n=== 3. Checkout with Annual Billing ===")
    cases = [
        ("starter", 71.88),
        ("pro", 215.88),
        ("empire", 575.88),
    ]
    for plan, exp_amount in cases:
        r = requests.post(f"{BASE_URL}/payments/create-checkout", headers=HEADERS, json={
            "plan": plan, "origin_url": "https://hustleai.live", "billing": "annual"
        })
        if r.status_code != 200:
            log(f"Annual checkout '{plan}'", False, f"HTTP {r.status_code}: {r.text[:200]}")
            continue
        d = r.json()
        ok = (d.get("amount") == exp_amount
              and d.get("promo_applied") is None
              and d.get("discount_pct") == 0
              and d.get("url") and d.get("session_id"))
        log(f"Annual checkout '{plan}' amount={exp_amount}", ok,
            f"got amount={d.get('amount')} promo={d.get('promo_applied')} pct={d.get('discount_pct')}")


def test_checkout_monthly_promo():
    print("\n=== 4. Checkout Monthly + HUSTLE50 Promo ===")
    r = requests.post(f"{BASE_URL}/payments/create-checkout", headers=HEADERS, json={
        "plan": "pro", "origin_url": "https://hustleai.live",
        "billing": "monthly", "promo_code": "HUSTLE50"
    })
    if r.status_code != 200:
        log("Monthly + HUSTLE50 promo", False, f"HTTP {r.status_code}: {r.text[:200]}")
        return
    d = r.json()
    if d.get("promo_applied") == "HUSTLE50":
        ok = (abs(d.get("amount", 0) - 15.0) < 0.02
              and d.get("discount_pct") == 50)
        log("Monthly + HUSTLE50 (fresh): amount ~= 14.995, promo_applied=HUSTLE50", ok,
            f"got {d}")
    elif d.get("promo_applied") is None and d.get("amount") == 29.99:
        log("Monthly + HUSTLE50 (already used — dedupe): full price 29.99", True,
            f"Dedupe working: {d}")
        print("  -> HUSTLE50 already used; trying BETA50 as fresh code...")
        r2 = requests.post(f"{BASE_URL}/payments/create-checkout", headers=HEADERS, json={
            "plan": "pro", "origin_url": "https://hustleai.live",
            "billing": "monthly", "promo_code": "BETA50"
        })
        if r2.status_code == 200:
            d2 = r2.json()
            if d2.get("promo_applied") == "BETA50":
                ok2 = abs(d2.get("amount", 0) - 15.0) < 0.02 and d2.get("discount_pct") == 50
                log("Monthly + BETA50 (fresh): amount ~= 14.995, promo_applied=BETA50", ok2,
                    f"got {d2}")
            elif d2.get("promo_applied") is None:
                log("Monthly + BETA50 (also already used): full price", True,
                    f"Both promos used: {d2}")
            else:
                log("Monthly + BETA50", False, f"unexpected: {d2}")
        else:
            log("Monthly + BETA50", False, f"HTTP {r2.status_code}")
    else:
        log("Monthly + HUSTLE50 promo", False, f"unexpected response: {d}")


def test_checkout_annual_ignores_promo():
    print("\n=== 5. Checkout Annual + Promo (should IGNORE promo) ===")
    r = requests.post(f"{BASE_URL}/payments/create-checkout", headers=HEADERS, json={
        "plan": "pro", "origin_url": "https://hustleai.live",
        "billing": "annual", "promo_code": "BETA50"
    })
    if r.status_code != 200:
        log("Annual + BETA50 (ignore promo)", False, f"HTTP {r.status_code}: {r.text[:200]}")
        return
    d = r.json()
    ok = (d.get("amount") == 215.88
          and d.get("promo_applied") is None
          and d.get("discount_pct") == 0)
    log("Annual + BETA50: amount=215.88, promo_applied=None", ok, f"got {d}")


def test_kill_alacarte_kit():
    print("\n=== 6. Kill Alacarte Kit ===")
    r = requests.post(f"{BASE_URL}/payments/create-checkout", headers=HEADERS, json={
        "plan": "alacarte_kit", "origin_url": "https://hustleai.live",
        "hustle_id": "hustle_704f65442468"
    })
    ok = r.status_code == 400
    detail = ""
    try:
        detail = r.json().get("detail", "")
    except Exception:
        detail = r.text[:200]
    log("alacarte_kit -> 400 Invalid plan", ok,
        f"HTTP {r.status_code}, detail='{detail}'")


def test_regression():
    print("\n=== 7. Regression ===")
    r = requests.get(f"{BASE_URL}/profile", headers=HEADERS)
    if r.status_code == 200:
        d = r.json()
        tier = (d.get("subscription_tier")
                or d.get("subscription", {}).get("tier")
                or d.get("user", {}).get("subscription_tier"))
        log("GET /profile returns subscription_tier", tier is not None,
            f"tier={tier}")
    else:
        log("GET /profile", False, f"HTTP {r.status_code}")

    r = requests.get(f"{BASE_URL}/challenges/first-100", headers=HEADERS)
    if r.status_code == 200:
        d = r.json()
        log("GET /challenges/first-100 -> $600 earned", d.get("current") == 600.0,
            f"current={d.get('current')} completed={d.get('completed')}")
    else:
        log("GET /challenges/first-100", False, f"HTTP {r.status_code}")

    r = requests.get(f"{BASE_URL}/leaderboard", headers=HEADERS)
    if r.status_code == 200:
        d = r.json()
        top = (d.get("top") or d.get("leaderboard") or [])
        first_name = top[0].get("name") if top else ""
        ok = top and "Adrian" in (first_name or "")
        log("GET /leaderboard -> Adrian #1", ok,
            f"top[0].name={first_name}, your_rank={d.get('your_rank')}")
    else:
        log("GET /leaderboard", False, f"HTTP {r.status_code}")

    r = requests.post(f"{BASE_URL}/payments/create-checkout", headers=HEADERS, json={
        "plan": "alacarte", "origin_url": "https://hustleai.live",
        "hustle_id": "hustle_704f65442468"
    })
    if r.status_code == 200:
        d = r.json()
        log("alacarte checkout still works: amount=4.99", d.get("amount") == 4.99,
            f"amount={d.get('amount')}")
    else:
        log("alacarte checkout", False, f"HTTP {r.status_code}: {r.text[:200]}")


def main():
    print(f"Testing: {BASE_URL}")
    print(f"Token: {TOKEN[:20]}...\n")
    test_subscription_tiers()
    test_promo_validate()
    test_checkout_annual()
    test_checkout_monthly_promo()
    test_checkout_annual_ignores_promo()
    test_kill_alacarte_kit()
    test_regression()

    print("\n" + "="*60)
    passed = sum(1 for _, p, _ in results if p)
    total = len(results)
    print(f"RESULT: {passed}/{total} passed")
    failed = [(n, d) for n, p, d in results if not p]
    if failed:
        print("\nFAILURES:")
        for n, d in failed:
            print(f"  FAIL: {n}")
            if d:
                print(f"      {d}")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
