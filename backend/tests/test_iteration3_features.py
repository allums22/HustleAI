"""
Backend API Tests for Iteration 3 Features
Tests: 4-tier pricing (Empire), hustle locking (starter vs premium), launch kits, referral system
"""
import pytest
import requests
import time

# Global variables to store session tokens and data across tests
session_token_free = None
session_token_referrer = None
user_data_free = None
user_data_referrer = None
hustle_id_starter = None
hustle_id_premium = None
referral_code = None

class TestFourTierSubscription:
    """Test 4-tier subscription model: Free, Starter, Pro, Empire"""

    def test_get_four_tiers(self, api_client, base_url):
        """Test GET /api/subscription/tiers returns 4 tiers with correct pricing"""
        response = api_client.get(f"{base_url}/api/subscription/tiers")
        
        assert response.status_code == 200, f"Get tiers failed: {response.text}"
        
        data = response.json()
        assert "tiers" in data
        
        tiers = data["tiers"]
        
        # Check all 4 tiers exist
        assert "free" in tiers, "Missing free tier"
        assert "starter" in tiers, "Missing starter tier"
        assert "pro" in tiers, "Missing pro tier"
        assert "empire" in tiers, "Missing empire tier"
        
        # Validate Free tier
        assert tiers["free"]["name"] == "Free"
        assert tiers["free"]["price"] == 0.00
        assert tiers["free"]["plan_limit"] == 0
        assert tiers["free"]["launch_kit_limit"] == 0
        
        # Validate Starter tier
        assert tiers["starter"]["name"] == "Starter"
        assert tiers["starter"]["price"] == 9.99
        assert tiers["starter"]["plan_limit"] == 10
        assert tiers["starter"]["launch_kit_limit"] == 2
        
        # Validate Pro tier
        assert tiers["pro"]["name"] == "Pro"
        assert tiers["pro"]["price"] == 29.99
        assert tiers["pro"]["plan_limit"] == 999999
        assert tiers["pro"]["launch_kit_limit"] == 5
        
        # Validate Empire tier
        assert tiers["empire"]["name"] == "Empire"
        assert tiers["empire"]["price"] == 49.99
        assert tiers["empire"]["plan_limit"] == 999999
        assert tiers["empire"]["launch_kit_limit"] == 999999
        
        # Check à la carte pricing
        assert "alacarte_plan_price" in data
        assert data["alacarte_plan_price"] == 4.99
        assert "alacarte_kit_price" in data
        assert data["alacarte_kit_price"] == 2.99
        
        print(f"✓ All 4 tiers validated: Free ($0), Starter ($9.99), Pro ($29.99), Empire ($49.99)")
        print(f"✓ À la carte pricing: Plan=$4.99, Kit=$2.99")


class TestReferralSystem:
    """Test referral system: registration with code, credits, referral info"""

    def test_register_referrer_gets_code(self, api_client, base_url):
        """Test registration creates referral_code for new user"""
        global session_token_referrer, user_data_referrer, referral_code
        
        unique_email = f"referrer_{int(time.time())}@hustleai.com"
        
        response = api_client.post(f"{base_url}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123!",
            "name": "Referrer User"
        })
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        assert "session_token" in data
        assert "user" in data
        assert "referral_code" in data["user"], "Missing referral_code in user data"
        
        session_token_referrer = data["session_token"]
        user_data_referrer = data["user"]
        referral_code = data["user"]["referral_code"]
        
        assert len(referral_code) == 8, f"Referral code should be 8 characters, got {len(referral_code)}"
        
        print(f"✓ Referrer registered with code: {referral_code}")

    def test_register_with_referral_code(self, api_client, base_url):
        """Test POST /api/auth/register with referral_code creates referral and credits referrer"""
        global session_token_free, user_data_free, referral_code
        
        if not referral_code:
            pytest.skip("No referral code available")
        
        unique_email = f"referred_{int(time.time())}@hustleai.com"
        
        response = api_client.post(f"{base_url}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123!",
            "name": "Referred User",
            "referral_code": referral_code
        })
        
        assert response.status_code == 200, f"Registration with referral failed: {response.text}"
        
        data = response.json()
        session_token_free = data["session_token"]
        user_data_free = data["user"]
        
        print(f"✓ User registered with referral code: {referral_code}")
        
        # Check referrer got credited
        referrer_profile = api_client.get(
            f"{base_url}/api/profile",
            headers={"Authorization": f"Bearer {session_token_referrer}"}
        )
        
        assert referrer_profile.status_code == 200
        referrer_data = referrer_profile.json()
        
        assert "stats" in referrer_data
        assert "referral_credits" in referrer_data["stats"]
        assert referrer_data["stats"]["referral_credits"] == 5.00, f"Expected $5 credit, got ${referrer_data['stats']['referral_credits']}"
        
        print(f"✓ Referrer credited: ${referrer_data['stats']['referral_credits']}")

    def test_get_referral_info(self, api_client, base_url):
        """Test GET /api/referral/info returns referral code and stats"""
        global session_token_referrer
        
        if not session_token_referrer:
            pytest.skip("No referrer session token available")
        
        response = api_client.get(
            f"{base_url}/api/referral/info",
            headers={"Authorization": f"Bearer {session_token_referrer}"}
        )
        
        assert response.status_code == 200, f"Get referral info failed: {response.text}"
        
        data = response.json()
        
        # Validate response structure
        assert "referral_code" in data, "Missing referral_code"
        assert "credits" in data, "Missing credits"
        assert "total_referrals" in data, "Missing total_referrals"
        assert "credit_per_referral" in data, "Missing credit_per_referral"
        
        # Validate values
        assert data["referral_code"] == referral_code
        assert data["credits"] == 5.00
        assert data["total_referrals"] == 1
        assert data["credit_per_referral"] == 5.00
        
        print(f"✓ Referral info: code={data['referral_code']}, credits=${data['credits']}, referrals={data['total_referrals']}")


class TestHustleLocking:
    """Test hustle tier classification and locking for free users"""

    def test_hustles_locked_for_free_user(self, api_client, base_url):
        """Test GET /api/hustles returns locked=true for premium hustles when free user"""
        global session_token_free, hustle_id_starter, hustle_id_premium
        
        if not session_token_free:
            pytest.skip("No free user session token available")
        
        # Submit questionnaire first
        answers = {
            "profession": "Technology",
            "skills": ["Programming"],
            "hours_per_week": "10-20",
            "budget": "$100-$500",
            "income_goal": "$1000-$3000",
            "interests": ["Freelancing"],
            "risk_tolerance": "Medium - Balanced approach",
            "work_style": "Solo - I work best alone",
            "tech_comfort": "Advanced - I'm very tech-savvy",
            "timeline": "Within a month"
        }
        
        submit_response = api_client.post(
            f"{base_url}/api/questionnaire/submit",
            json={"answers": answers},
            headers={"Authorization": f"Bearer {session_token_free}"}
        )
        assert submit_response.status_code == 200
        
        # Generate hustles
        generate_response = api_client.post(
            f"{base_url}/api/hustles/generate",
            headers={"Authorization": f"Bearer {session_token_free}"}
        )
        assert generate_response.status_code == 200
        
        # Get hustles
        hustles_response = api_client.get(
            f"{base_url}/api/hustles",
            headers={"Authorization": f"Bearer {session_token_free}"}
        )
        
        assert hustles_response.status_code == 200, f"Get hustles failed: {hustles_response.text}"
        
        data = hustles_response.json()
        assert "hustles" in data
        hustles = data["hustles"]
        
        assert len(hustles) > 0, "No hustles returned"
        
        # Check for locked and unlocked hustles
        locked_hustles = [h for h in hustles if h.get("locked") == True]
        unlocked_hustles = [h for h in hustles if h.get("locked") == False]
        
        assert len(locked_hustles) > 0, "Expected some locked premium hustles for free user"
        assert len(unlocked_hustles) > 0, "Expected some unlocked starter hustles"
        
        # Validate locked hustle structure
        for h in locked_hustles:
            assert h["locked"] == True
            assert "potential_income" in h, "Locked hustles should still show potential_income"
            # Name should be masked
            assert h["name"] == "Premium High-Revenue Hustle" or "original_name" in h
            hustle_id_premium = h["hustle_id"]
        
        # Validate unlocked hustle structure
        for h in unlocked_hustles:
            assert h["locked"] == False
            assert "name" in h
            assert "description" in h
            assert "potential_income" in h
            hustle_id_starter = h["hustle_id"]
        
        print(f"✓ Hustles locked correctly: {len(locked_hustles)} locked, {len(unlocked_hustles)} unlocked")
        print(f"✓ Locked hustles show revenue: {locked_hustles[0].get('potential_income')}")


class TestLaunchKitEndpoints:
    """Test launch kit access check, generate, and get endpoints"""

    def test_launch_kit_access_check(self, api_client, base_url):
        """Test GET /api/launch-kit/access/{hustle_id} returns access check"""
        global session_token_free, hustle_id_starter
        
        if not session_token_free or not hustle_id_starter:
            pytest.skip("No session token or hustle_id available")
        
        response = api_client.get(
            f"{base_url}/api/launch-kit/access/{hustle_id_starter}",
            headers={"Authorization": f"Bearer {session_token_free}"}
        )
        
        assert response.status_code == 200, f"Launch kit access check failed: {response.text}"
        
        data = response.json()
        
        # Validate response structure
        assert "has_access" in data, "Missing has_access field"
        assert "reason" in data, "Missing reason field"
        
        # Free user should not have access to launch kits
        assert data["has_access"] == False, "Free user should not have access to launch kits"
        assert data["reason"] == "upgrade_required"
        
        if "alacarte_price" in data:
            assert data["alacarte_price"] == 2.99
        
        print(f"✓ Launch kit access check: has_access={data['has_access']}, reason={data['reason']}")


class TestAlacarteKitCheckout:
    """Test POST /api/payments/create-checkout with alacarte_kit plan"""

    def test_create_alacarte_kit_checkout(self, api_client, base_url):
        """Test POST /api/payments/create-checkout supports 'alacarte_kit' plan type"""
        global session_token_free, hustle_id_starter
        
        if not session_token_free or not hustle_id_starter:
            pytest.skip("No session token or hustle_id available")
        
        response = api_client.post(
            f"{base_url}/api/payments/create-checkout",
            json={
                "plan": "alacarte_kit",
                "origin_url": "https://skill-match-hustle.preview.emergentagent.com",
                "hustle_id": hustle_id_starter
            },
            headers={"Authorization": f"Bearer {session_token_free}"}
        )
        
        assert response.status_code == 200, f"Create alacarte_kit checkout failed: {response.text}"
        
        data = response.json()
        
        # Validate response
        assert "url" in data, "Missing checkout url"
        assert "session_id" in data, "Missing session_id"
        
        # URL should be a Stripe checkout URL
        assert "stripe" in data["url"].lower() or "checkout" in data["url"].lower(), "URL doesn't look like a Stripe checkout URL"
        
        print(f"✓ À la carte kit checkout created: session_id={data['session_id']}")


class TestUpdatedProfileStats:
    """Test GET /api/profile returns updated stats with kits_generated, referral fields"""

    def test_profile_has_kit_and_referral_stats(self, api_client, base_url):
        """Test GET /api/profile returns kits_generated, referral_code, referral_credits, remaining_kits"""
        global session_token_free
        
        if not session_token_free:
            pytest.skip("No session token available")
        
        response = api_client.get(
            f"{base_url}/api/profile",
            headers={"Authorization": f"Bearer {session_token_free}"}
        )
        
        assert response.status_code == 200, f"Get profile failed: {response.text}"
        
        data = response.json()
        assert "stats" in data, "Missing stats field"
        
        stats = data["stats"]
        
        # Check new fields
        assert "kits_generated" in stats, "Missing kits_generated field"
        assert "referral_code" in stats, "Missing referral_code field"
        assert "referral_credits" in stats, "Missing referral_credits field"
        assert "remaining_kits" in stats, "Missing remaining_kits field"
        
        # Validate values for free user
        assert stats["kits_generated"] == 0, f"Expected kits_generated=0, got {stats['kits_generated']}"
        assert stats["remaining_kits"] == 0, f"Free user should have 0 remaining_kits, got {stats['remaining_kits']}"
        assert len(stats["referral_code"]) == 8, "Referral code should be 8 characters"
        
        # Check alacarte_kit_price
        assert "alacarte_kit_price" in data, "Missing alacarte_kit_price field"
        assert data["alacarte_kit_price"] == 2.99, f"Expected alacarte_kit_price=2.99, got {data['alacarte_kit_price']}"
        
        print(f"✓ Profile stats: kits_generated={stats['kits_generated']}, remaining_kits={stats['remaining_kits']}, referral_code={stats['referral_code']}, referral_credits=${stats['referral_credits']}")
