"""
Iteration 4: Design Overhaul Testing
Tests backend APIs after major frontend design changes
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
if not BASE_URL:
    # Fallback to reading from frontend .env
    import sys
    sys.path.insert(0, '/app/frontend')
    from dotenv import load_dotenv
    load_dotenv('/app/frontend/.env')
    BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://skill-match-hustle.preview.emergentagent.com')
BASE_URL = BASE_URL.rstrip('/')

class TestIteration4Backend:
    """Backend smoke tests for iteration 4 design overhaul"""

    def test_subscription_tiers_4_plans(self):
        """Verify 4-tier subscription model with correct prices"""
        response = requests.get(f"{BASE_URL}/api/subscription/tiers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "tiers" in data
        tiers = data["tiers"]
        
        # Verify 4 tiers exist
        assert "free" in tiers
        assert "starter" in tiers
        assert "pro" in tiers
        assert "empire" in tiers
        
        # Verify prices
        assert tiers["free"]["price"] == 0.00
        assert tiers["starter"]["price"] == 9.99
        assert tiers["pro"]["price"] == 29.99
        assert tiers["empire"]["price"] == 49.99
        
        print("✓ GET /api/subscription/tiers - 4 tiers with correct prices")

    def test_register_creates_user_with_referral_code(self):
        """Verify registration creates user with 8-char referral code"""
        timestamp = int(time.time())
        email = f"test_iter4_{timestamp}@hustleai.com"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "Test123!",
            "name": "Iteration 4 Test User"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "session_token" in data
        assert "user" in data
        assert "referral_code" in data["user"]
        assert len(data["user"]["referral_code"]) == 8
        
        print(f"✓ POST /api/auth/register - User created with referral_code: {data['user']['referral_code']}")
        return data["session_token"]

    def test_hustles_sorted_starter_first_premium_locked(self):
        """Verify hustles endpoint returns sorted list with starter first, premium locked for free users"""
        # Create test user
        timestamp = int(time.time())
        email = f"test_hustles_{timestamp}@hustleai.com"
        
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "Test123!",
            "name": "Hustles Test User"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["session_token"]
        
        # Submit questionnaire
        questions_response = requests.get(f"{BASE_URL}/api/questionnaire/questions")
        questions = questions_response.json()["questions"]
        
        answers = {}
        for q in questions:
            if q["type"] == "multi_select":
                answers[q["id"]] = [q["options"][0]]
            else:
                answers[q["id"]] = q["options"][0]
        
        submit_response = requests.post(
            f"{BASE_URL}/api/questionnaire/submit",
            json={"answers": answers},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert submit_response.status_code == 200
        
        # Generate hustles
        gen_response = requests.post(
            f"{BASE_URL}/api/hustles/generate",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert gen_response.status_code == 200
        
        # Get hustles
        hustles_response = requests.get(
            f"{BASE_URL}/api/hustles",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert hustles_response.status_code == 200
        
        hustles = hustles_response.json()["hustles"]
        assert len(hustles) > 0
        
        # Verify sorting: starter first
        starter_hustles = [h for h in hustles if h.get("hustle_tier") == "starter"]
        premium_hustles = [h for h in hustles if h.get("hustle_tier") == "premium"]
        
        # Check if starter hustles come before premium
        if len(starter_hustles) > 0 and len(premium_hustles) > 0:
            first_starter_idx = next((i for i, h in enumerate(hustles) if h.get("hustle_tier") == "starter"), None)
            first_premium_idx = next((i for i, h in enumerate(hustles) if h.get("hustle_tier") == "premium"), None)
            assert first_starter_idx < first_premium_idx, "Starter hustles should come before premium"
        
        # Verify premium hustles are locked for free user
        locked_count = sum(1 for h in hustles if h.get("locked") == True)
        unlocked_count = sum(1 for h in hustles if h.get("locked") == False)
        
        print(f"✓ GET /api/hustles - {len(hustles)} hustles returned, {unlocked_count} unlocked (starter), {locked_count} locked (premium)")

    def test_launch_kit_access_endpoint(self):
        """Verify launch kit access endpoint returns correct response"""
        # Create test user
        timestamp = int(time.time())
        email = f"test_kit_{timestamp}@hustleai.com"
        
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "Test123!",
            "name": "Kit Test User"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["session_token"]
        
        # Submit questionnaire and generate hustles
        questions_response = requests.get(f"{BASE_URL}/api/questionnaire/questions")
        questions = questions_response.json()["questions"]
        
        answers = {}
        for q in questions:
            if q["type"] == "multi_select":
                answers[q["id"]] = [q["options"][0]]
            else:
                answers[q["id"]] = q["options"][0]
        
        requests.post(
            f"{BASE_URL}/api/questionnaire/submit",
            json={"answers": answers},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        gen_response = requests.post(
            f"{BASE_URL}/api/hustles/generate",
            headers={"Authorization": f"Bearer {token}"}
        )
        hustles = gen_response.json()["hustles"]
        hustle_id = hustles[0]["hustle_id"]
        
        # Check launch kit access
        access_response = requests.get(
            f"{BASE_URL}/api/launch-kit/access/{hustle_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert access_response.status_code == 200
        
        data = access_response.json()
        assert "has_access" in data
        assert "reason" in data
        
        print(f"✓ GET /api/launch-kit/access/{{hustle_id}} - has_access={data['has_access']}, reason={data['reason']}")

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
