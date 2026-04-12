"""
Backend API Tests for Side Hustle AI
Tests: Auth, Questionnaire, Hustles, Profile, Subscription endpoints
"""
import pytest
import requests
import time

# Global variable to store session token across tests
session_token = None
user_data = None

class TestAuthEndpoints:
    """Authentication endpoint tests"""

    def test_register_new_user(self, api_client, base_url, test_user_credentials):
        """Test user registration with unique email"""
        global session_token, user_data
        
        # Use timestamp to create unique email
        unique_email = f"test_{int(time.time())}@hustleai.com"
        
        response = api_client.post(f"{base_url}/api/auth/register", json={
            "email": unique_email,
            "password": test_user_credentials["password"],
            "name": test_user_credentials["name"]
        })
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        assert "session_token" in data, "No session_token in response"
        assert "user" in data, "No user data in response"
        assert data["user"]["email"] == unique_email
        assert data["user"]["subscription_tier"] == "free"
        assert data["user"]["questionnaire_completed"] == False
        
        # Store for other tests
        session_token = data["session_token"]
        user_data = data["user"]
        
        print(f"✓ User registered successfully: {unique_email}")

    def test_login_with_credentials(self, api_client, base_url, test_user_credentials):
        """Test login with email/password"""
        # First register a user
        unique_email = f"login_test_{int(time.time())}@hustleai.com"
        
        register_response = api_client.post(f"{base_url}/api/auth/register", json={
            "email": unique_email,
            "password": test_user_credentials["password"],
            "name": test_user_credentials["name"]
        })
        assert register_response.status_code == 200
        
        # Now login
        login_response = api_client.post(f"{base_url}/api/auth/login", json={
            "email": unique_email,
            "password": test_user_credentials["password"]
        })
        
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        assert "session_token" in data
        assert "user" in data
        assert data["user"]["email"] == unique_email
        
        print(f"✓ Login successful for: {unique_email}")

    def test_get_current_user(self, api_client, base_url):
        """Test GET /api/auth/me with valid token"""
        global session_token
        
        if not session_token:
            pytest.skip("No session token available from registration")
        
        response = api_client.get(
            f"{base_url}/api/auth/me",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        assert response.status_code == 200, f"Get user failed: {response.text}"
        
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert "subscription_tier" in data
        
        print(f"✓ Get current user successful: {data['email']}")

    def test_get_user_without_token(self, api_client, base_url):
        """Test GET /api/auth/me without token returns 401"""
        response = api_client.get(f"{base_url}/api/auth/me")
        
        assert response.status_code == 401, "Should return 401 without token"
        print("✓ Unauthorized access blocked correctly")


class TestQuestionnaireEndpoints:
    """Questionnaire endpoint tests"""

    def test_get_questions(self, api_client, base_url):
        """Test GET /api/questionnaire/questions returns 10 questions"""
        response = api_client.get(f"{base_url}/api/questionnaire/questions")
        
        assert response.status_code == 200, f"Get questions failed: {response.text}"
        
        data = response.json()
        assert "questions" in data
        assert len(data["questions"]) == 10, f"Expected 10 questions, got {len(data['questions'])}"
        
        # Validate question structure
        for q in data["questions"]:
            assert "id" in q
            assert "question" in q
            assert "type" in q
            assert "options" in q
            assert isinstance(q["options"], list)
        
        print(f"✓ Retrieved {len(data['questions'])} questions successfully")

    def test_submit_questionnaire(self, api_client, base_url):
        """Test POST /api/questionnaire/submit with answers"""
        global session_token
        
        if not session_token:
            pytest.skip("No session token available")
        
        # Sample answers for all 10 questions
        answers = {
            "profession": "Technology",
            "skills": ["Programming", "Writing"],
            "hours_per_week": "10-20",
            "budget": "$100-$500",
            "income_goal": "$1000-$3000",
            "interests": ["Freelancing", "Content Creation"],
            "risk_tolerance": "Medium - Balanced approach",
            "work_style": "Solo - I work best alone",
            "tech_comfort": "Advanced - I'm very tech-savvy",
            "timeline": "Within a month"
        }
        
        response = api_client.post(
            f"{base_url}/api/questionnaire/submit",
            json={"answers": answers},
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        assert response.status_code == 200, f"Submit questionnaire failed: {response.text}"
        
        data = response.json()
        assert "response_id" in data
        assert "message" in data
        
        print(f"✓ Questionnaire submitted successfully: {data['response_id']}")


class TestHustleEndpoints:
    """Side hustle endpoint tests"""

    def test_get_hustles_empty(self, api_client, base_url):
        """Test GET /api/hustles returns empty list initially"""
        global session_token
        
        if not session_token:
            pytest.skip("No session token available")
        
        response = api_client.get(
            f"{base_url}/api/hustles",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        assert response.status_code == 200, f"Get hustles failed: {response.text}"
        
        data = response.json()
        assert "hustles" in data
        assert isinstance(data["hustles"], list)
        
        print(f"✓ Get hustles successful: {len(data['hustles'])} hustles")


class TestProfileEndpoints:
    """Profile endpoint tests"""

    def test_get_profile(self, api_client, base_url):
        """Test GET /api/profile returns user profile with subscription info"""
        global session_token
        
        if not session_token:
            pytest.skip("No session token available")
        
        response = api_client.get(
            f"{base_url}/api/profile",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        assert response.status_code == 200, f"Get profile failed: {response.text}"
        
        data = response.json()
        assert "user" in data
        assert "subscription" in data
        assert "stats" in data
        
        # Validate subscription structure
        sub = data["subscription"]
        assert "tier" in sub
        assert "name" in sub
        assert "hustle_limit" in sub
        assert "price" in sub
        
        # Validate stats structure
        stats = data["stats"]
        assert "total_hustles" in stats
        assert "selected_hustles" in stats
        assert "remaining" in stats
        
        print(f"✓ Profile retrieved: {data['user']['email']}, Tier: {sub['tier']}")


class TestSubscriptionEndpoints:
    """Subscription tier endpoint tests"""

    def test_get_subscription_tiers(self, api_client, base_url):
        """Test GET /api/subscription/tiers returns all 3 tiers"""
        response = api_client.get(f"{base_url}/api/subscription/tiers")
        
        assert response.status_code == 200, f"Get tiers failed: {response.text}"
        
        data = response.json()
        assert "tiers" in data
        
        tiers = data["tiers"]
        assert "free" in tiers
        assert "starter" in tiers
        assert "pro" in tiers
        
        # Validate free tier
        assert tiers["free"]["name"] == "Free"
        assert tiers["free"]["hustle_limit"] == 2
        assert tiers["free"]["price"] == 0.00
        
        # Validate starter tier
        assert tiers["starter"]["name"] == "Starter"
        assert tiers["starter"]["hustle_limit"] == 10
        assert tiers["starter"]["price"] == 9.99
        
        # Validate pro tier
        assert tiers["pro"]["name"] == "Pro"
        assert tiers["pro"]["hustle_limit"] == 999999
        assert tiers["pro"]["price"] == 29.99
        
        print("✓ All 3 subscription tiers validated successfully")
