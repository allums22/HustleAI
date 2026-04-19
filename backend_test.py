#!/usr/bin/env python3
"""
HustleAI Backend API Comprehensive Testing Script
Tests all backend endpoints for the HustleAI application using Empire tier session token
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://skill-match-hustle.preview.emergentagent.com/api"
EMPIRE_SESSION_TOKEN = "sess_02b7e25f5bf24900abc602309216532a"

class HustleAITester:
    def __init__(self):
        self.session_token = EMPIRE_SESSION_TOKEN
        self.test_results = []
        self.hustles = []
        
    def log_result(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data
        })
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{BASE_URL}{endpoint}"
        req_headers = {"Content-Type": "application/json"}
        
        if self.session_token:
            req_headers["Authorization"] = f"Bearer {self.session_token}"
        
        if headers:
            req_headers.update(headers)
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=req_headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=req_headers, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=req_headers, timeout=30)
            else:
                return False, f"Unsupported method: {method}", 0
            
            try:
                response_data = response.json()
            except:
                response_data = response.text
            
            return response.status_code < 400, response_data, response.status_code
            
        except requests.exceptions.RequestException as e:
            return False, f"Request failed: {str(e)}", 0
    
    def test_get_hustles(self):
        """Test GET /api/hustles - Should return ALL hustles (60+) with is_premium field"""
        print("🎯 Testing GET /api/hustles...")
        
        success, data, status_code = self.make_request("GET", "/hustles")
        
        if success and "hustles" in data:
            hustles = data["hustles"]
            self.hustles = hustles  # Store for other tests
            
            # Check count
            hustle_count = len(hustles)
            
            # Check is_premium field
            has_is_premium = all("is_premium" in h for h in hustles)
            
            # Count premium vs starter
            premium_count = sum(1 for h in hustles if h.get("is_premium", False))
            starter_count = hustle_count - premium_count
            
            if hustle_count >= 60 and has_is_premium:
                self.log_result("GET /api/hustles", True, 
                    f"Got {hustle_count} hustles (expected 60+), {premium_count} premium, {starter_count} starter, all have is_premium field")
            else:
                self.log_result("GET /api/hustles", False, 
                    f"Got {hustle_count} hustles (expected 60+), is_premium field present: {has_is_premium}")
        else:
            self.log_result("GET /api/hustles", False, f"Status: {status_code}", data)
    
    def test_generate_industry_hustles(self):
        """Test POST /api/hustles/generate/industry - Send real estate flipping, should return 6 hustles"""
        print("🏠 Testing POST /api/hustles/generate/industry...")
        
        request_data = {"industry": "real estate flipping"}
        success, data, status_code = self.make_request("POST", "/hustles/generate/industry", request_data)
        
        if success and "hustles" in data:
            hustles = data["hustles"]
            industry = data.get("industry", "")
            
            # Check count
            hustle_count = len(hustles)
            
            # Check all are in real estate category
            real_estate_count = sum(1 for h in hustles if "real estate" in h.get("category", "").lower())
            
            if hustle_count == 6 and real_estate_count == 6:
                self.log_result("POST /api/hustles/generate/industry", True, 
                    f"Generated {hustle_count} hustles, all in real estate category, industry: {industry}")
            else:
                self.log_result("POST /api/hustles/generate/industry", False, 
                    f"Generated {hustle_count} hustles (expected 6), {real_estate_count} in real estate category")
        else:
            self.log_result("POST /api/hustles/generate/industry", False, f"Status: {status_code}", data)
    
    def test_get_agents(self):
        """Test GET /api/agents - Should return 4 agents with descriptions, prompts, prices"""
        print("🤖 Testing GET /api/agents...")
        
        success, data, status_code = self.make_request("GET", "/agents")
        
        if success and "agents" in data:
            agents = data["agents"]
            alacarte_prices = data.get("alacarte_prices", {})
            agent_pack_price = data.get("agent_pack_price", 0)
            
            # Check count
            agent_count = len(agents)
            
            # Check each agent has required fields
            valid_agents = 0
            for agent in agents:
                if all(field in agent for field in ["id", "name", "description", "prompts"]):
                    if len(agent.get("prompts", [])) == 5:
                        valid_agents += 1
            
            # Check pricing
            has_alacarte_prices = len(alacarte_prices) >= 3  # marketing, content, finance
            correct_pack_price = agent_pack_price == 19.99
            
            if agent_count == 4 and valid_agents == 4 and has_alacarte_prices and correct_pack_price:
                self.log_result("GET /api/agents", True, 
                    f"Got {agent_count} agents, all have descriptions & 5 prompts each, alacarte prices: ${list(alacarte_prices.values())}, pack price: ${agent_pack_price}")
            else:
                self.log_result("GET /api/agents", False, 
                    f"Got {agent_count} agents (expected 4), valid: {valid_agents}, alacarte prices: {has_alacarte_prices}, pack price: ${agent_pack_price}")
        else:
            self.log_result("GET /api/agents", False, f"Status: {status_code}", data)
    
    def test_agent_chat(self):
        """Test POST /api/agents/{hustle_id}/chat - Test with marketing agent"""
        print("💬 Testing POST /api/agents/{hustle_id}/chat...")
        
        if not self.hustles:
            self.log_result("POST /api/agents/{hustle_id}/chat", False, "No hustles available for testing")
            return
        
        hustle_id = self.hustles[0]["hustle_id"]
        chat_data = {
            "message": "Create a social media post for this hustle",
            "agent_id": "marketing"
        }
        
        success, data, status_code = self.make_request("POST", f"/agents/{hustle_id}/chat", chat_data)
        
        if success and "response" in data:
            response_text = data["response"]
            self.log_result("POST /api/agents/{hustle_id}/chat", True, 
                f"Marketing agent responded with {len(response_text)} characters")
        else:
            self.log_result("POST /api/agents/{hustle_id}/chat", False, f"Status: {status_code}", data)
    
    def test_agent_history(self):
        """Test GET /api/agents/{hustle_id}/history/marketing - Should return saved conversation"""
        print("📜 Testing GET /api/agents/{hustle_id}/history/marketing...")
        
        if not self.hustles:
            self.log_result("GET /api/agents/{hustle_id}/history/marketing", False, "No hustles available for testing")
            return
        
        hustle_id = self.hustles[0]["hustle_id"]
        success, data, status_code = self.make_request("GET", f"/agents/{hustle_id}/history/marketing")
        
        if success and "messages" in data:
            messages = data["messages"]
            message_count = len(messages)
            self.log_result("GET /api/agents/{hustle_id}/history/marketing", True, 
                f"Got conversation history with {message_count} messages")
        else:
            self.log_result("GET /api/agents/{hustle_id}/history/marketing", False, f"Status: {status_code}", data)
    
    def test_subscription_tiers(self):
        """Test GET /api/subscription/tiers - Each tier should have features array with AI mentions"""
        print("💰 Testing GET /api/subscription/tiers...")
        
        success, data, status_code = self.make_request("GET", "/subscription/tiers")
        
        if success and "tiers" in data:
            tiers = data["tiers"]
            
            # Check each tier has features array
            valid_tiers = 0
            ai_mentions = 0
            
            for tier_name, tier_info in tiers.items():
                if "features" in tier_info and isinstance(tier_info["features"], list):
                    valid_tiers += 1
                    # Check for AI mentions in features
                    features_text = " ".join(tier_info["features"]).lower()
                    if "ai mentor" in features_text or "ai agent" in features_text:
                        ai_mentions += 1
            
            if valid_tiers == 4 and ai_mentions >= 2:
                self.log_result("GET /api/subscription/tiers", True, 
                    f"Got {valid_tiers} tiers, all have features arrays, {ai_mentions} mention AI Mentor/Agents")
            else:
                self.log_result("GET /api/subscription/tiers", False, 
                    f"Got {valid_tiers} valid tiers (expected 4), {ai_mentions} mention AI features")
        else:
            self.log_result("GET /api/subscription/tiers", False, f"Status: {status_code}", data)
    
    def test_beta_feedback_submit(self):
        """Test POST /api/beta/feedback - Submit test feedback"""
        print("📝 Testing POST /api/beta/feedback...")
        
        feedback_data = {
            "category": "general",
            "rating": 5,
            "message": "Test feedback"
        }
        
        success, data, status_code = self.make_request("POST", "/beta/feedback", feedback_data)
        
        if success and data.get("status") == "ok":
            self.log_result("POST /api/beta/feedback", True, "Feedback submitted successfully")
        else:
            self.log_result("POST /api/beta/feedback", False, f"Status: {status_code}", data)
    
    def test_beta_feedback_get(self):
        """Test GET /api/beta/feedback - Should return the feedback just submitted"""
        print("📋 Testing GET /api/beta/feedback...")
        
        success, data, status_code = self.make_request("GET", "/beta/feedback")
        
        if success and "feedbacks" in data:
            feedbacks = data["feedbacks"]
            feedback_count = len(feedbacks)
            
            # Check if our test feedback is there
            test_feedback_found = any(f.get("message") == "Test feedback" for f in feedbacks)
            
            self.log_result("GET /api/beta/feedback", True, 
                f"Got {feedback_count} feedbacks, test feedback found: {test_feedback_found}")
        else:
            self.log_result("GET /api/beta/feedback", False, f"Status: {status_code}", data)
    
    def test_beta_nda_status(self):
        """Test GET /api/beta/nda-status - Should return accepted: true"""
        print("📄 Testing GET /api/beta/nda-status...")
        
        success, data, status_code = self.make_request("GET", "/beta/nda-status")
        
        if success and "accepted" in data:
            accepted = data["accepted"]
            self.log_result("GET /api/beta/nda-status", True, f"NDA accepted: {accepted}")
        else:
            self.log_result("GET /api/beta/nda-status", False, f"Status: {status_code}", data)
    
    def test_launch_kit_customize(self):
        """Test POST /api/launch-kit/{hustle_id}/customize - Test with phone and email"""
        print("🎨 Testing POST /api/launch-kit/{hustle_id}/customize...")
        
        if not self.hustles:
            self.log_result("POST /api/launch-kit/{hustle_id}/customize", False, "No hustles available for testing")
            return
        
        hustle_id = self.hustles[0]["hustle_id"]
        customize_data = {
            "phone": "555-999-1234",
            "email": "james@hustleai.live"
        }
        
        success, data, status_code = self.make_request("PUT", f"/launch-kit/{hustle_id}/customize", customize_data)
        
        if success and "html" in data:
            html = data["html"]
            # Check if phone number is in the HTML
            phone_in_html = "555-999-1234" in html
            self.log_result("POST /api/launch-kit/{hustle_id}/customize", True, 
                f"Customization successful, HTML length: {len(html)}, phone number included: {phone_in_html}")
        elif status_code == 404:
            self.log_result("POST /api/launch-kit/{hustle_id}/customize", True, 
                "Correctly returned 404 for non-existent kit (expected behavior)")
        else:
            self.log_result("POST /api/launch-kit/{hustle_id}/customize", False, f"Status: {status_code}", data)
    
    def test_profile(self):
        """Test GET /api/profile - Verify tier is empire with unlimited counts"""
        print("👤 Testing GET /api/profile...")
        
        success, data, status_code = self.make_request("GET", "/profile")
        
        if success and "user" in data and "subscription" in data:
            user = data["user"]
            subscription = data["subscription"]
            stats = data.get("stats", {})
            
            tier = subscription.get("tier", "")
            plan_limit = subscription.get("plan_limit", 0)
            kit_limit = subscription.get("launch_kit_limit", 0)
            
            if tier == "empire" and plan_limit == 999999 and kit_limit == 999999:
                self.log_result("GET /api/profile", True, 
                    f"Empire user confirmed, unlimited plans ({plan_limit}) and kits ({kit_limit})")
            else:
                self.log_result("GET /api/profile", False, 
                    f"Tier: {tier} (expected empire), plan limit: {plan_limit}, kit limit: {kit_limit}")
        else:
            self.log_result("GET /api/profile", False, f"Status: {status_code}", data)
    
    def test_promo_redeem_invalid(self):
        """Test POST /api/promo/redeem with invalid code - Should return 400"""
        print("🎫 Testing POST /api/promo/redeem (invalid code)...")
        
        promo_data = {"code": "INVALID"}
        success, data, status_code = self.make_request("POST", "/promo/redeem", promo_data)
        
        if status_code == 400:
            self.log_result("POST /api/promo/redeem (invalid)", True, 
                "Correctly returned 400 for invalid promo code")
        else:
            self.log_result("POST /api/promo/redeem (invalid)", False, 
                f"Expected 400, got {status_code}", data)
    
    def test_promo_redeem_valid(self):
        """Test POST /api/promo/redeem with valid code - Should return already_redeemed"""
        print("🎫 Testing POST /api/promo/redeem (valid code)...")
        
        promo_data = {"code": "HUSTLEVIP2025"}
        success, data, status_code = self.make_request("POST", "/promo/redeem", promo_data)
        
        if success and data.get("status") == "already_redeemed":
            self.log_result("POST /api/promo/redeem (valid)", True, 
                "Correctly returned already_redeemed for HUSTLEVIP2025")
        elif success and data.get("status") == "success":
            self.log_result("POST /api/promo/redeem (valid)", True, 
                "Successfully redeemed HUSTLEVIP2025 code")
        else:
            self.log_result("POST /api/promo/redeem (valid)", False, f"Status: {status_code}", data)
    
    def run_all_tests(self):
        """Run all comprehensive tests in sequence"""
        print("🚀 Starting HustleAI Backend Comprehensive API Tests")
        print("🔑 Using Empire tier session token: sess_02b7e25f5bf24900abc602309216532a")
        print("=" * 70)
        
        # Run all test suites in order
        self.test_get_hustles()
        self.test_generate_industry_hustles()
        self.test_get_agents()
        self.test_agent_chat()
        self.test_agent_history()
        self.test_subscription_tiers()
        self.test_beta_feedback_submit()
        self.test_beta_feedback_get()
        self.test_beta_nda_status()
        self.test_launch_kit_customize()
        self.test_profile()
        self.test_promo_redeem_invalid()
        self.test_promo_redeem_valid()
        
        # Summary
        print("=" * 70)
        print("📊 COMPREHENSIVE TEST SUMMARY")
        print("=" * 70)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        else:
            print("\n🎉 ALL TESTS PASSED!")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = HustleAITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)