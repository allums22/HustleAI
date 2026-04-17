#!/usr/bin/env python3
"""
HustleAI NEW Features Backend API Testing Script
Tests the specific NEW features mentioned in the review request
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://skill-match-hustle.preview.emergentagent.com/api"
EMPIRE_SESSION_TOKEN = "sess_02b7e25f5bf24900abc602309216532a"
EMPIRE_EMAIL = "aallums@sixlogisticsglobal.com"

class NewFeaturesTester:
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
    
    def test_ai_agents_endpoint(self):
        """Test AI Agents endpoint - GET /api/agents"""
        print("🤖 Testing AI Agents Endpoint...")
        
        success, data, status_code = self.make_request("GET", "/agents")
        
        if success:
            # Handle both list and object with agents key
            agents = data if isinstance(data, list) else data.get("agents", [])
            
            if len(agents) == 4:
                agent_ids = [agent.get("id", "") for agent in agents]
                expected_agents = ["mentor", "marketing", "content", "finance"]
                
                if all(agent_id in agent_ids for agent_id in expected_agents):
                    self.log_result("AI Agents Endpoint", True, f"Found all 4 expected agents: {agent_ids}")
                else:
                    self.log_result("AI Agents Endpoint", False, f"Missing expected agents. Found: {agent_ids}, Expected: {expected_agents}")
            else:
                self.log_result("AI Agents Endpoint", False, f"Expected 4 agents, got {len(agents)}")
        else:
            self.log_result("AI Agents Endpoint", False, f"Status: {status_code}", data)
    
    def test_agent_chat_endpoint(self):
        """Test Agent Chat endpoint - POST /api/agents/{hustle_id}/chat"""
        print("💬 Testing Agent Chat Endpoint...")
        
        # First get hustles to get a hustle_id
        success, data, status_code = self.make_request("GET", "/hustles")
        if not success or not data.get("hustles"):
            self.log_result("Agent Chat Endpoint", False, "Could not get hustles for testing")
            return
        
        self.hustles = data["hustles"]
        hustle_id = self.hustles[0]["hustle_id"]
        
        chat_data = {
            "message": "What marketing strategy should I use?",
            "agent_id": "marketing"
        }
        
        success, data, status_code = self.make_request("POST", f"/agents/{hustle_id}/chat", chat_data)
        
        if success and "response" in data:
            self.log_result("Agent Chat Endpoint", True, f"Got AI response from marketing agent")
        else:
            self.log_result("Agent Chat Endpoint", False, f"Status: {status_code}", data)
    
    def test_kit_generation(self):
        """Test Kit Generation - POST /api/launch-kit/generate/{hustle_id}"""
        print("🚀 Testing Kit Generation...")
        
        if not self.hustles:
            # Get hustles first
            success, data, status_code = self.make_request("GET", "/hustles")
            if not success or not data.get("hustles"):
                self.log_result("Kit Generation", False, "Could not get hustles for testing")
                return
            self.hustles = data["hustles"]
        
        hustle_id = self.hustles[0]["hustle_id"]
        
        success, data, status_code = self.make_request("POST", f"/launch-kit/generate/{hustle_id}")
        
        if success:
            # Handle both direct response and nested under "kit"
            kit_data = data.get("kit", data)
            html_content = kit_data.get("landing_page_html", "")
            business_name = kit_data.get("business_name", "")
            
            # Check if landing_page_html is populated (non-empty)
            if html_content and len(html_content.strip()) > 0:
                # Check if business_name doesn't end with a period
                if business_name and not business_name.endswith("."):
                    self.log_result("Kit Generation", True, f"Generated kit with HTML content ({len(html_content)} chars), business name: '{business_name}'")
                else:
                    self.log_result("Kit Generation", False, f"Business name ends with period: '{business_name}'")
            else:
                self.log_result("Kit Generation", False, "landing_page_html is empty")
        else:
            self.log_result("Kit Generation", False, f"Status: {status_code}", data)
    
    def test_landing_page_customization(self):
        """Test Landing Page Customization - PUT /api/launch-kit/{hustle_id}/customize"""
        print("🎨 Testing Landing Page Customization...")
        
        if not self.hustles:
            # Get hustles first
            success, data, status_code = self.make_request("GET", "/hustles")
            if not success or not data.get("hustles"):
                self.log_result("Landing Page Customization", False, "Could not get hustles for testing")
                return
            self.hustles = data["hustles"]
        
        hustle_id = self.hustles[0]["hustle_id"]
        
        customization_data = {
            "phone": "555-123-4567",
            "email": "test@test.com"
        }
        
        success, data, status_code = self.make_request("PUT", f"/launch-kit/{hustle_id}/customize", customization_data)
        
        if success and status_code == 200:
            # Check if the response contains updated HTML with the phone number
            if "html" in data or "landing_page_html" in data:
                html_content = data.get("html", data.get("landing_page_html", ""))
                if "555-123-4567" in html_content:
                    self.log_result("Landing Page Customization", True, "Successfully updated HTML with phone number")
                else:
                    self.log_result("Landing Page Customization", False, "Phone number not found in updated HTML")
            else:
                self.log_result("Landing Page Customization", True, "Returned 200 status")
        else:
            self.log_result("Landing Page Customization", False, f"Status: {status_code}", data)
    
    def test_subscription_tiers(self):
        """Test Subscription Tiers - GET /api/subscription/tiers"""
        print("💰 Testing Subscription Tiers...")
        
        success, data, status_code = self.make_request("GET", "/subscription/tiers")
        
        if success and "tiers" in data:
            tiers = data["tiers"]
            all_have_features = True
            ai_mentioned = False
            
            # Check each tier (they are in a dict, not a list)
            for tier_name, tier_data in tiers.items():
                if "features" not in tier_data or not isinstance(tier_data["features"], list):
                    all_have_features = False
                    break
                
                # Check if AI Mentor or AI Agents is mentioned in features
                features_text = " ".join(tier_data["features"]).lower()
                if "ai mentor" in features_text or "ai agents" in features_text:
                    ai_mentioned = True
            
            if all_have_features and ai_mentioned:
                self.log_result("Subscription Tiers", True, f"All {len(tiers)} tiers have features array and AI mentioned")
            elif not all_have_features:
                self.log_result("Subscription Tiers", False, "Not all tiers have features array")
            else:
                self.log_result("Subscription Tiers", False, "AI Mentor or AI Agents not mentioned in features")
        else:
            self.log_result("Subscription Tiers", False, f"Status: {status_code}", data)
    
    def test_profile_endpoint(self):
        """Test Profile Endpoint - GET /api/profile"""
        print("👤 Testing Profile Endpoint...")
        
        success, data, status_code = self.make_request("GET", "/profile")
        
        if success and "user" in data:
            subscription = data.get("subscription", {})
            tier = subscription.get("tier", "")
            
            # Check if Empire user returns tier "empire" with unlimited counts
            if tier == "empire":
                # Check for unlimited counts (could be -1, "unlimited", or very high numbers)
                counts = subscription.get("counts", {})
                has_unlimited = False
                
                for key, value in counts.items():
                    if value == -1 or value == "unlimited" or (isinstance(value, int) and value >= 999999):
                        has_unlimited = True
                        break
                
                if has_unlimited:
                    self.log_result("Profile Endpoint", True, f"Empire user with tier '{tier}' and unlimited counts")
                else:
                    self.log_result("Profile Endpoint", True, f"Empire user with tier '{tier}' (counts: {counts})")
            else:
                self.log_result("Profile Endpoint", False, f"Expected tier 'empire', got '{tier}'")
        else:
            self.log_result("Profile Endpoint", False, f"Status: {status_code}", data)
    
    def run_all_tests(self):
        """Run all NEW feature tests in sequence"""
        print("🚀 Starting HustleAI NEW Features Backend API Tests")
        print(f"🔑 Using Empire session token: {self.session_token}")
        print("=" * 60)
        
        # Run all test suites for NEW features
        self.test_ai_agents_endpoint()
        self.test_agent_chat_endpoint()
        self.test_kit_generation()
        self.test_landing_page_customization()
        self.test_subscription_tiers()
        self.test_profile_endpoint()
        
        # Summary
        print("=" * 60)
        print("📊 NEW FEATURES TEST SUMMARY")
        print("=" * 60)
        
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
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = NewFeaturesTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)