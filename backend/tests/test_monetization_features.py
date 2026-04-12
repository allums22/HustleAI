"""
Backend API Tests for Monetization Features (Iteration 2)
Tests: Updated registration fields, plan access endpoint, updated profile stats, à la carte checkout
"""
import pytest
import requests
import time

# Global variable to store session token across tests
session_token = None
user_data = None
hustle_id = None

class TestUpdatedRegistration:
    """Test updated registration with new monetization fields"""

    def test_register_creates_new_fields(self, api_client, base_url):
        """Test POST /api/auth/register creates user with trial_plan_used=False, plans_generated=0"""
        global session_token, user_data
        
        unique_email = f"test_monetization_{int(time.time())}@hustleai.com"
        
        response = api_client.post(f"{base_url}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123!",
            "name": "Test Monetization User"
        })
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        assert "session_token" in data
        assert "user" in data
        
        session_token = data["session_token"]
        user_data = data["user"]
        
        # Now get full user data to check new fields
        me_response = api_client.get(
            f"{base_url}/api/auth/me",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        assert me_response.status_code == 200
        user_full = me_response.json()
        
        # Check new fields
        assert "trial_plan_used" in user_full, "Missing trial_plan_used field"
        assert user_full["trial_plan_used"] == False, "trial_plan_used should be False for new user"
        
        assert "plans_generated" in user_full, "Missing plans_generated field"
        assert user_full["plans_generated"] == 0, "plans_generated should be 0 for new user"
        
        assert "alacarte_plans_purchased" in user_full, "Missing alacarte_plans_purchased field"
        assert user_full["alacarte_plans_purchased"] == 0, "alacarte_plans_purchased should be 0 for new user"
        
        print(f"✓ Registration creates new fields: trial_plan_used={user_full['trial_plan_used']}, plans_generated={user_full['plans_generated']}, alacarte_plans_purchased={user_full['alacarte_plans_purchased']}")


class TestUpdatedSubscriptionTiers:
    """Test updated subscription tiers with plan_limit field"""

    def test_tiers_have_plan_limit(self, api_client, base_url):
        """Test GET /api/subscription/tiers returns tiers with plan_limit field"""
        response = api_client.get(f"{base_url}/api/subscription/tiers")
        
        assert response.status_code == 200, f"Get tiers failed: {response.text}"
        
        data = response.json()
        assert "tiers" in data
        
        tiers = data["tiers"]
        
        # Check free tier - plan_limit should be 0 (unlimited discovery, but 0 plans without trial)
        assert "plan_limit" in tiers["free"], "Free tier missing plan_limit"
        assert tiers["free"]["plan_limit"] == 0, f"Free tier plan_limit should be 0, got {tiers['free']['plan_limit']}"
        
        # Check starter tier - plan_limit should be 10
        assert "plan_limit" in tiers["starter"], "Starter tier missing plan_limit"
        assert tiers["starter"]["plan_limit"] == 10, f"Starter tier plan_limit should be 10, got {tiers['starter']['plan_limit']}"
        
        # Check pro tier - plan_limit should be 999999 (unlimited)
        assert "plan_limit" in tiers["pro"], "Pro tier missing plan_limit"
        assert tiers["pro"]["plan_limit"] == 999999, f"Pro tier plan_limit should be 999999, got {tiers['pro']['plan_limit']}"
        
        print(f"✓ Subscription tiers have plan_limit: Free={tiers['free']['plan_limit']}, Starter={tiers['starter']['plan_limit']}, Pro={tiers['pro']['plan_limit']}")


class TestPlanAccessEndpoint:
    """Test new GET /api/plans/access/{hustle_id} endpoint"""

    def test_plan_access_free_trial_available(self, api_client, base_url):
        """Test plan access check for free user with trial available"""
        global session_token, hustle_id
        
        if not session_token:
            pytest.skip("No session token available")
        
        # First, submit questionnaire
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
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert submit_response.status_code == 200
        
        # Generate hustles
        generate_response = api_client.post(
            f"{base_url}/api/hustles/generate",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert generate_response.status_code == 200
        
        hustles = generate_response.json()["hustles"]
        assert len(hustles) > 0, "No hustles generated"
        hustle_id = hustles[0]["hustle_id"]
        
        # Check plan access
        access_response = api_client.get(
            f"{base_url}/api/plans/access/{hustle_id}",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        assert access_response.status_code == 200, f"Plan access check failed: {access_response.text}"
        
        access_data = access_response.json()
        
        # Validate response structure
        assert "has_access" in access_data, "Missing has_access field"
        assert "reason" in access_data, "Missing reason field"
        assert "plan_exists" in access_data, "Missing plan_exists field"
        
        # For free user with trial available, should have access
        assert access_data["has_access"] == True, "Free user should have access to trial plan"
        assert access_data["reason"] == "free_trial", f"Expected reason 'free_trial', got '{access_data['reason']}'"
        assert access_data["plan_exists"] == False, "Plan should not exist yet"
        
        if "is_trial" in access_data:
            assert access_data["is_trial"] == True, "Should be marked as trial"
        
        print(f"✓ Plan access check: has_access={access_data['has_access']}, reason={access_data['reason']}, plan_exists={access_data['plan_exists']}")


class TestUpdatedProfileStats:
    """Test updated GET /api/profile with new stats fields"""

    def test_profile_has_updated_stats(self, api_client, base_url):
        """Test GET /api/profile returns remaining_plans, trial_used, alacarte_purchased"""
        global session_token
        
        if not session_token:
            pytest.skip("No session token available")
        
        response = api_client.get(
            f"{base_url}/api/profile",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        assert response.status_code == 200, f"Get profile failed: {response.text}"
        
        data = response.json()
        assert "stats" in data, "Missing stats field"
        
        stats = data["stats"]
        
        # Check new fields
        assert "remaining_plans" in stats, "Missing remaining_plans field"
        assert "trial_used" in stats, "Missing trial_used field"
        assert "alacarte_purchased" in stats, "Missing alacarte_purchased field"
        
        # For new free user with trial not used, remaining_plans should be 1
        assert stats["remaining_plans"] == 1, f"Expected remaining_plans=1 for free user with trial, got {stats['remaining_plans']}"
        assert stats["trial_used"] == False, f"Expected trial_used=False, got {stats['trial_used']}"
        assert stats["alacarte_purchased"] == 0, f"Expected alacarte_purchased=0, got {stats['alacarte_purchased']}"
        
        # Check alacarte_price field
        assert "alacarte_price" in data, "Missing alacarte_price field"
        assert data["alacarte_price"] == 4.99, f"Expected alacarte_price=4.99, got {data['alacarte_price']}"
        
        print(f"✓ Profile stats: remaining_plans={stats['remaining_plans']}, trial_used={stats['trial_used']}, alacarte_purchased={stats['alacarte_purchased']}, alacarte_price={data['alacarte_price']}")


class TestAlacarteCheckout:
    """Test POST /api/payments/create-checkout with à la carte plan"""

    def test_create_alacarte_checkout(self, api_client, base_url):
        """Test POST /api/payments/create-checkout accepts 'alacarte' plan with hustle_id"""
        global session_token, hustle_id
        
        if not session_token:
            pytest.skip("No session token available")
        
        if not hustle_id:
            pytest.skip("No hustle_id available")
        
        response = api_client.post(
            f"{base_url}/api/payments/create-checkout",
            json={
                "plan": "alacarte",
                "origin_url": "https://skill-match-hustle.preview.emergentagent.com",
                "hustle_id": hustle_id
            },
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        assert response.status_code == 200, f"Create checkout failed: {response.text}"
        
        data = response.json()
        
        # Validate response
        assert "url" in data, "Missing checkout url"
        assert "session_id" in data, "Missing session_id"
        
        # URL should be a Stripe checkout URL
        assert "stripe" in data["url"].lower() or "checkout" in data["url"].lower(), "URL doesn't look like a Stripe checkout URL"
        
        print(f"✓ À la carte checkout created: session_id={data['session_id']}, url={data['url'][:50]}...")
    
    def test_alacarte_checkout_requires_hustle_id(self, api_client, base_url):
        """Test that à la carte checkout fails without hustle_id"""
        global session_token
        
        if not session_token:
            pytest.skip("No session token available")
        
        response = api_client.post(
            f"{base_url}/api/payments/create-checkout",
            json={
                "plan": "alacarte",
                "origin_url": "https://skill-match-hustle.preview.emergentagent.com"
                # Missing hustle_id
            },
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        # Should fail with 400
        assert response.status_code == 400, f"Expected 400 for missing hustle_id, got {response.status_code}"
        
        error_data = response.json()
        assert "detail" in error_data
        assert "hustle_id" in error_data["detail"].lower(), "Error message should mention hustle_id"
        
        print(f"✓ À la carte checkout correctly requires hustle_id: {error_data['detail']}")
