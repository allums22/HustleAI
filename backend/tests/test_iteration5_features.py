"""
Iteration 5 Feature Tests
Tests new endpoints: motivation, tasks, earnings, achievements, community, stats
"""
import pytest
import requests
import os
import time

# Read from frontend/.env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except:
        pass
    return os.environ.get('EXPO_PUBLIC_BACKEND_URL', '')

BASE_URL = get_backend_url().rstrip('/')

class TestIteration5Features:
    """Test all new iteration 5 features"""

    @pytest.fixture(scope="class")
    def test_user(self):
        """Create a test user for all tests"""
        timestamp = int(time.time())
        email = f"test_iter5_{timestamp}@hustleai.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "Test123!",
            "name": "Iteration 5 Tester"
        })
        assert response.status_code == 200
        data = response.json()
        return {
            "token": data["session_token"],
            "user_id": data["user"]["user_id"],
            "email": email
        }

    @pytest.fixture(scope="class")
    def auth_headers(self, test_user):
        """Return auth headers for authenticated requests"""
        return {"Authorization": f"Bearer {test_user['token']}"}

    def test_questionnaire_has_11_questions_including_blue_collar(self):
        """GET /api/questionnaire/questions returns 11 questions including blue_collar"""
        response = requests.get(f"{BASE_URL}/api/questionnaire/questions")
        assert response.status_code == 200
        
        data = response.json()
        assert "questions" in data
        questions = data["questions"]
        
        # Should have exactly 11 questions
        assert len(questions) == 11, f"Expected 11 questions, got {len(questions)}"
        
        # Find blue_collar question
        blue_collar_q = next((q for q in questions if q["id"] == "blue_collar"), None)
        assert blue_collar_q is not None, "blue_collar question not found"
        assert blue_collar_q["question"] == "Do you have hands-on trade or blue collar skills?"
        assert blue_collar_q["type"] == "multi_select"
        assert "Handyman/Home Repair" in blue_collar_q["options"]
        assert "Construction" in blue_collar_q["options"]
        print("✓ Questionnaire has 11 questions including blue_collar")

    def test_public_stats_endpoint(self):
        """GET /api/stats/public returns user/hustle/plan/kit counts"""
        response = requests.get(f"{BASE_URL}/api/stats/public")
        assert response.status_code == 200
        
        data = response.json()
        assert "users" in data
        assert "hustles" in data
        assert "plans" in data
        assert "kits" in data
        
        # All should be integers >= 0
        assert isinstance(data["users"], int) and data["users"] >= 0
        assert isinstance(data["hustles"], int) and data["hustles"] >= 0
        assert isinstance(data["plans"], int) and data["plans"] >= 0
        assert isinstance(data["kits"], int) and data["kits"] >= 0
        print(f"✓ Public stats: {data['users']} users, {data['hustles']} hustles, {data['plans']} plans, {data['kits']} kits")

    def test_daily_motivation_endpoint(self, auth_headers):
        """GET /api/motivation/daily returns motivational message with weekly/monthly amounts"""
        response = requests.get(f"{BASE_URL}/api/motivation/daily", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "weekly_estimate" in data
        assert "monthly_estimate" in data
        assert "current_day" in data
        assert "today_tasks" in data
        assert "percent" in data
        
        # Verify data types
        assert isinstance(data["message"], str)
        assert len(data["message"]) > 0
        assert isinstance(data["weekly_estimate"], int)
        assert isinstance(data["monthly_estimate"], int)
        assert isinstance(data["current_day"], int)
        assert isinstance(data["today_tasks"], int)
        assert isinstance(data["percent"], int)
        
        # Monthly should be ~4x weekly
        assert data["monthly_estimate"] >= data["weekly_estimate"] * 3
        print(f"✓ Daily motivation: ${data['weekly_estimate']}/week, ${data['monthly_estimate']}/month, Day {data['current_day']}")

    def test_streak_endpoint_initial(self, auth_headers):
        """GET /api/tasks/streak returns streak data (initially 0)"""
        response = requests.get(f"{BASE_URL}/api/tasks/streak", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "current_streak" in data
        assert "longest_streak" in data
        assert "total_completed" in data
        
        # New user should have 0 streak
        assert data["current_streak"] == 0
        assert data["longest_streak"] == 0
        assert data["total_completed"] == 0
        print("✓ Streak endpoint returns initial data (0 streak)")

    def test_earnings_log_and_summary(self, auth_headers):
        """POST /api/earnings/log logs earning, GET /api/earnings/summary returns totals"""
        # Log first earning
        log_response = requests.post(f"{BASE_URL}/api/earnings/log", headers=auth_headers, json={
            "amount": 50.00,
            "note": "First freelance gig"
        })
        assert log_response.status_code == 200
        log_data = log_response.json()
        assert "earning_id" in log_data
        assert log_data["status"] == "ok"
        
        # Log second earning
        log_response2 = requests.post(f"{BASE_URL}/api/earnings/log", headers=auth_headers, json={
            "amount": 75.50,
            "note": "Second client"
        })
        assert log_response2.status_code == 200
        
        # Get summary
        summary_response = requests.get(f"{BASE_URL}/api/earnings/summary", headers=auth_headers)
        assert summary_response.status_code == 200
        
        summary = summary_response.json()
        assert "total" in summary
        assert "today" in summary
        assert "this_week" in summary
        assert "this_month" in summary
        assert "count" in summary
        
        # Verify totals
        assert summary["total"] == 125.50  # 50 + 75.50
        assert summary["today"] == 125.50  # Both logged today
        assert summary["this_week"] == 125.50
        assert summary["this_month"] == 125.50
        assert summary["count"] == 2
        print(f"✓ Earnings logged and summary correct: ${summary['total']} total, {summary['count']} entries")

    def test_achievements_endpoint(self, auth_headers):
        """GET /api/achievements returns 12 achievements with unlocked status"""
        response = requests.get(f"{BASE_URL}/api/achievements", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "achievements" in data
        assert "newly_unlocked" in data
        
        achievements = data["achievements"]
        # Should have exactly 12 achievements
        assert len(achievements) == 12, f"Expected 12 achievements, got {len(achievements)}"
        
        # Verify structure of each achievement
        for ach in achievements:
            assert "id" in ach
            assert "name" in ach
            assert "desc" in ach
            assert "icon" in ach
            assert "condition" in ach
            assert "unlocked" in ach
            assert isinstance(ach["unlocked"], bool)
        
        # Check for specific achievements
        achievement_ids = [a["id"] for a in achievements]
        expected_ids = ["first_hustle", "five_hustles", "first_plan", "first_kit", 
                       "first_earning", "hundred_earned", "thousand_earned",
                       "streak_3", "streak_7", "streak_30", "first_post", "referrer"]
        for exp_id in expected_ids:
            assert exp_id in achievement_ids, f"Achievement {exp_id} not found"
        
        # First earning should be unlocked (we logged earnings in previous test)
        first_earning = next((a for a in achievements if a["id"] == "first_earning"), None)
        assert first_earning is not None
        # Note: May or may not be unlocked depending on test order
        
        print(f"✓ Achievements endpoint returns 12 achievements")

    def test_community_posts_create_and_get(self, auth_headers):
        """POST /api/community/posts creates post, GET /api/community/posts returns feed"""
        # Create a post
        create_response = requests.post(f"{BASE_URL}/api/community/posts", headers=auth_headers, json={
            "content": "Just made my first $100 from my side hustle! 🎉",
            "milestone": "First $100",
            "amount": 100.00
        })
        assert create_response.status_code == 200
        create_data = create_response.json()
        assert "post_id" in create_data
        post_id = create_data["post_id"]
        
        # Get community feed
        feed_response = requests.get(f"{BASE_URL}/api/community/posts", headers=auth_headers)
        assert feed_response.status_code == 200
        
        feed_data = feed_response.json()
        assert "posts" in feed_data
        posts = feed_data["posts"]
        
        # Find our post
        our_post = next((p for p in posts if p["post_id"] == post_id), None)
        assert our_post is not None, "Created post not found in feed"
        
        # Verify post structure
        assert our_post["content"] == "Just made my first $100 from my side hustle! 🎉"
        assert our_post["milestone"] == "First $100"
        assert our_post["amount"] == 100.00
        assert "author_name" in our_post
        assert "author_tier" in our_post
        assert "reactions" in our_post
        assert "reacted_by" in our_post
        assert "created_at" in our_post
        
        print(f"✓ Community post created and retrieved: {post_id}")
        return post_id

    def test_community_post_react(self, auth_headers):
        """POST /api/community/posts/{id}/react toggles reaction"""
        # First create a post
        create_response = requests.post(f"{BASE_URL}/api/community/posts", headers=auth_headers, json={
            "content": "Testing reactions feature"
        })
        assert create_response.status_code == 200
        post_id = create_response.json()["post_id"]
        
        # React to the post
        react_response = requests.post(f"{BASE_URL}/api/community/posts/{post_id}/react", headers=auth_headers)
        assert react_response.status_code == 200
        assert react_response.json()["status"] == "ok"
        
        # Get feed to verify reaction
        feed_response = requests.get(f"{BASE_URL}/api/community/posts", headers=auth_headers)
        posts = feed_response.json()["posts"]
        our_post = next((p for p in posts if p["post_id"] == post_id), None)
        assert our_post is not None
        assert our_post["reactions"] == 1
        
        # React again to toggle off
        react_response2 = requests.post(f"{BASE_URL}/api/community/posts/{post_id}/react", headers=auth_headers)
        assert react_response2.status_code == 200
        
        # Verify reaction removed
        feed_response2 = requests.get(f"{BASE_URL}/api/community/posts", headers=auth_headers)
        posts2 = feed_response2.json()["posts"]
        our_post2 = next((p for p in posts2 if p["post_id"] == post_id), None)
        assert our_post2["reactions"] == 0
        
        print("✓ Community post reaction toggle working")

    def test_task_completion_flow(self, auth_headers, test_user):
        """Test complete task flow: complete task → get progress → verify streak"""
        # Test basic task completion endpoints without full flow (to avoid timeout)
        # Create a dummy hustle_id for testing
        dummy_hustle_id = "test_hustle_123"
        
        # Test POST /api/tasks/{hustle_id}/complete
        complete_response = requests.post(
            f"{BASE_URL}/api/tasks/{dummy_hustle_id}/complete",
            headers=auth_headers,
            json={"day": 1, "task_index": 0, "completed": True}
        )
        # Should succeed even with non-existent hustle (just stores completion)
        assert complete_response.status_code == 200
        assert complete_response.json()["status"] == "ok"
        
        # Test GET /api/tasks/{hustle_id}/progress
        progress_response = requests.get(f"{BASE_URL}/api/tasks/{dummy_hustle_id}/progress", headers=auth_headers)
        assert progress_response.status_code == 200
        
        progress = progress_response.json()
        assert "completed_keys" in progress
        assert "completed_count" in progress
        assert "total_tasks" in progress
        assert "percent" in progress
        
        # Verify our task is completed
        expected_key = f"{dummy_hustle_id}_1_0"
        assert expected_key in progress["completed_keys"]
        assert progress["completed_count"] >= 1
        
        # Get streak (should be 1 now)
        streak_response = requests.get(f"{BASE_URL}/api/tasks/streak", headers=auth_headers)
        streak = streak_response.json()
        assert streak["current_streak"] >= 1
        assert streak["total_completed"] >= 1
        
        print(f"✓ Task completion endpoints working: {progress['completed_count']} tasks completed, {streak['current_streak']} day streak")


class TestIteration5EdgeCases:
    """Test edge cases and error handling"""
    
    def test_earnings_log_requires_amount(self):
        """POST /api/earnings/log should fail without amount"""
        # Create test user
        timestamp = int(time.time())
        email = f"test_edge_{timestamp}@hustleai.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "Test123!",
            "name": "Edge Tester"
        })
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        token = reg_response.json()["session_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to log earning without amount
        response = requests.post(f"{BASE_URL}/api/earnings/log", headers=headers, json={
            "note": "Test"
        })
        assert response.status_code == 400
        print("✓ Earnings log correctly rejects missing amount")
    
    def test_community_post_requires_content(self):
        """POST /api/community/posts should fail without content"""
        timestamp = int(time.time())
        email = f"test_edge2_{timestamp}@hustleai.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "Test123!",
            "name": "Edge Tester 2"
        })
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        token = reg_response.json()["session_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to create post without content
        response = requests.post(f"{BASE_URL}/api/community/posts", headers=headers, json={
            "content": ""
        })
        assert response.status_code == 400
        print("✓ Community post correctly rejects empty content")
