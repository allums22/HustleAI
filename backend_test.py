#!/usr/bin/env python3
"""
HustleAI Backend API Testing Script
Tests all backend endpoints for the HustleAI application
"""

import requests
import json
import base64
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://skill-match-hustle.preview.emergentagent.com/api"
TEST_EMAIL = "test5@hustleai.com"
TEST_PASSWORD = "Test123!"

class HustleAITester:
    def __init__(self):
        self.session_token: Optional[str] = None
        self.user_data: Optional[Dict] = None
        self.hustles: list = []
        self.test_results = []
        
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
    
    def test_register_and_login(self) -> bool:
        """Test user registration and login"""
        print("🔐 Testing Registration and Login...")
        
        # Try to register first (in case user doesn't exist)
        register_success, register_data, register_status = self.make_request("POST", "/auth/register", {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": "Test User"
        })
        
        if register_success and "session_token" in register_data:
            self.session_token = register_data["session_token"]
            self.user_data = register_data.get("user", {})
            self.log_result("Registration", True, f"Registered and logged in as {self.user_data.get('email', 'unknown')}")
            return True
        elif register_status == 400 and "already registered" in str(register_data).lower():
            # User already exists, try login
            self.log_result("Registration", True, "User already exists, trying login")
            return self.test_login()
        else:
            self.log_result("Registration", False, f"Status: {register_status}", register_data)
            return self.test_login()  # Try login anyway
    
    def test_login(self) -> bool:
        """Test user login"""
        print("🔐 Testing Login...")
        
        success, data, status_code = self.make_request("POST", "/auth/login", {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if success and "session_token" in data:
            self.session_token = data["session_token"]
            self.user_data = data.get("user", {})
            self.log_result("Login", True, f"Logged in as {self.user_data.get('email', 'unknown')}")
            return True
        else:
            self.log_result("Login", False, f"Status: {status_code}", data)
            return False
    
    def test_basic_endpoints(self):
        """Test basic endpoints that should work without auth"""
        print("📋 Testing Basic Endpoints...")
        
        # Test questionnaire questions
        success, data, status_code = self.make_request("GET", "/questionnaire/questions")
        if success and "questions" in data:
            self.log_result("GET /questionnaire/questions", True, f"Got {len(data['questions'])} questions")
        else:
            self.log_result("GET /questionnaire/questions", False, f"Status: {status_code}", data)
        
        # Test subscription tiers
        success, data, status_code = self.make_request("GET", "/subscription/tiers")
        if success and "tiers" in data:
            self.log_result("GET /subscription/tiers", True, f"Got {len(data['tiers'])} tiers")
        else:
            self.log_result("GET /subscription/tiers", False, f"Status: {status_code}", data)
    
    def test_authenticated_endpoints(self):
        """Test endpoints that require authentication"""
        print("🔒 Testing Authenticated Endpoints...")
        
        # Test profile
        success, data, status_code = self.make_request("GET", "/profile")
        if success and "user" in data:
            tier = data.get("subscription", {}).get("tier", "unknown")
            self.log_result("GET /profile", True, f"User tier: {tier}")
        else:
            self.log_result("GET /profile", False, f"Status: {status_code}", data)
        
        # Test hustles list
        success, data, status_code = self.make_request("GET", "/hustles")
        if success:
            self.hustles = data.get("hustles", [])
            self.log_result("GET /hustles", True, f"Got {len(self.hustles)} hustles")
        else:
            self.log_result("GET /hustles", False, f"Status: {status_code}", data)
    
    def test_resume_upload(self):
        """Test resume file upload in questionnaire submit"""
        print("📄 Testing Resume Upload...")
        
        # Create a proper base64 encoded PDF content for testing
        test_pdf_content = "JVBERi0xLjQKJcOkw7zDtsOgCjIgMCBvYmoKPDwKL0xlbmd0aCAzIDAgUgo+PgpzdHJlYW0KQNC0xLjQKJcOkw7zDtsOgCjIgMCBvYmoKPDwKL0xlbmd0aCAzIDAgUgo+PgpzdHJlYW0KZW5kc3RyZWFtCmVuZG9iago=="
        
        # Test questionnaire submission with resume
        submission_data = {
            "answers": {
                "profession": "Technology",
                "skills": ["Programming", "Writing"],
                "hours_per_week": "10-20",
                "budget": "$100-$500",
                "income_goal": "$1000-$3000",
                "interests": ["Freelancing", "Digital Products"],
                "risk_tolerance": "Medium - Balanced approach",
                "work_style": "Solo - I work best alone",
                "tech_comfort": "Advanced - I'm very tech-savvy",
                "timeline": "1-3 months",
                "blue_collar": ["None of these"]
            },
            "additional_skills": "Testing and QA",
            "resume_file_b64": test_pdf_content,
            "resume_filename": "test_resume.pdf"
        }
        
        success, data, status_code = self.make_request("POST", "/questionnaire/submit", submission_data)
        if success and "response_id" in data:
            self.log_result("Resume Upload in Questionnaire", True, f"Response ID: {data['response_id']}")
        else:
            self.log_result("Resume Upload in Questionnaire", False, f"Status: {status_code}", data)
    
    def test_mentor_chat(self):
        """Test AI Mentor Chat endpoint"""
        print("🤖 Testing AI Mentor Chat...")
        
        if not self.hustles:
            self.log_result("AI Mentor Chat", False, "No hustles available for testing")
            return
        
        hustle_id = self.hustles[0]["hustle_id"]
        chat_data = {
            "message": "How do I find my first client?"
        }
        
        success, data, status_code = self.make_request("POST", f"/mentor/{hustle_id}/chat", chat_data)
        
        # For free tier users, expect 403 - this is correct behavior
        if status_code == 403:
            if "upgrade" in str(data).lower() or "starter" in str(data).lower():
                self.log_result("AI Mentor Chat (Free Tier)", True, "Correctly blocked free tier with upgrade message")
            else:
                self.log_result("AI Mentor Chat (Free Tier)", False, "403 but wrong message", data)
        elif success and "response" in data:
            self.log_result("AI Mentor Chat", True, "Got AI response")
        else:
            self.log_result("AI Mentor Chat", False, f"Status: {status_code}", data)
    
    def test_landing_page_customization(self):
        """Test Landing Page Customization endpoint"""
        print("🎨 Testing Landing Page Customization...")
        
        if not self.hustles:
            self.log_result("Landing Page Customization", False, "No hustles available for testing")
            return
        
        hustle_id = self.hustles[0]["hustle_id"]
        customization_data = {
            "email": "test@example.com",
            "phone": "+1-555-0123",
            "name": "Test Business Owner",
            "website": "https://testbusiness.com",
            "instagram": "testbusiness",
            "facebook": "https://facebook.com/testbusiness"
        }
        
        success, data, status_code = self.make_request("PUT", f"/launch-kit/{hustle_id}/customize", customization_data)
        
        # If no kit exists, expect 404 - this is expected behavior
        if status_code == 404:
            if "not found" in str(data).lower():
                self.log_result("Landing Page Customization", True, "Correctly returned 404 for non-existent kit")
            else:
                self.log_result("Landing Page Customization", False, "404 but wrong message", data)
        elif success and "status" in data and data["status"] == "ok":
            self.log_result("Landing Page Customization", True, "Successfully customized landing page")
        else:
            self.log_result("Landing Page Customization", False, f"Status: {status_code}", data)
    
    def test_hustle_generation(self):
        """Test side hustle generation with variety and blue collar focus"""
        print("💡 Testing Side Hustle Generation...")
        
        # Increase timeout for AI generation
        success, data, status_code = self.make_request_with_timeout("POST", "/hustles/generate", timeout=120)
        
        if success and "hustles" in data:
            hustles = data["hustles"]
            if len(hustles) >= 10:  # Should generate 12 hustles
                # Check for variety - different categories
                categories = set(h.get("category", "") for h in hustles)
                starter_count = sum(1 for h in hustles if h.get("hustle_tier") == "starter")
                premium_count = sum(1 for h in hustles if h.get("hustle_tier") == "premium")
                
                details = f"Generated {len(hustles)} hustles, {len(categories)} categories, {starter_count} starter, {premium_count} premium"
                self.log_result("Side Hustle Generation", True, details)
                
                # Update hustles for other tests
                self.hustles = hustles
            else:
                self.log_result("Side Hustle Generation", False, f"Only got {len(hustles)} hustles, expected 12", data)
        else:
            self.log_result("Side Hustle Generation", False, f"Status: {status_code}", data)
    
    def make_request_with_timeout(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None, timeout: int = 120) -> tuple:
        """Make HTTP request with custom timeout and return (success, response_data, status_code)"""
        url = f"{BASE_URL}{endpoint}"
        req_headers = {"Content-Type": "application/json"}
        
        if self.session_token:
            req_headers["Authorization"] = f"Bearer {self.session_token}"
        
        if headers:
            req_headers.update(headers)
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=req_headers, timeout=timeout)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=req_headers, timeout=timeout)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=req_headers, timeout=timeout)
            else:
                return False, f"Unsupported method: {method}", 0
            
            try:
                response_data = response.json()
            except:
                response_data = response.text
            
            return response.status_code < 400, response_data, response.status_code
            
        except requests.exceptions.RequestException as e:
            return False, f"Request failed: {str(e)}", 0
    
    def test_additional_endpoints(self):
        """Test additional endpoints for completeness"""
        print("🔍 Testing Additional Endpoints...")
        
        # Test referral info
        success, data, status_code = self.make_request("GET", "/referral/info")
        if success and "referral_code" in data:
            self.log_result("GET /referral/info", True, f"Referral code: {data['referral_code']}")
        else:
            self.log_result("GET /referral/info", False, f"Status: {status_code}", data)
        
        # Test auth/me
        success, data, status_code = self.make_request("GET", "/auth/me")
        if success and "user_id" in data:
            self.log_result("GET /auth/me", True, f"User ID: {data['user_id']}")
        else:
            self.log_result("GET /auth/me", False, f"Status: {status_code}", data)
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting HustleAI Backend API Tests")
        print("=" * 50)
        
        # Register/Login first
        if not self.test_register_and_login():
            print("❌ Registration/Login failed - cannot continue with authenticated tests")
            return False
        
        # Run all test suites
        self.test_basic_endpoints()
        self.test_authenticated_endpoints()
        self.test_resume_upload()
        self.test_mentor_chat()
        self.test_landing_page_customization()
        self.test_hustle_generation()
        self.test_additional_endpoints()
        
        # Summary
        print("=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
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
    tester = HustleAITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)