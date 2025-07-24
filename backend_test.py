#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Messenger Application
Tests all endpoints defined in server.py
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class MessengerAPITester:
    def __init__(self, base_url: str = "https://84822c60-63dd-4e8a-8e0c-8ba29f21094a.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details
        })

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    expected_status: int = 200, use_auth: bool = False) -> tuple[bool, Dict]:
        """Make HTTP request and return success status and response data"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if use_auth and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}

            return success, response_data

        except Exception as e:
            return False, {"error": str(e)}

    def test_health_check(self):
        """Test health endpoint"""
        success, response = self.make_request("GET", "health")
        self.log_test("Health Check", success, f"Status: {response.get('status', 'unknown')}")
        return success

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime("%H%M%S")
        user_data = {
            "username": f"testuser_{timestamp}",
            "email": f"test_{timestamp}@example.com",
            "password": "TestPass123!",
            "display_name": f"Test User {timestamp}"
        }
        
        success, response = self.make_request("POST", "register", user_data, 200)
        
        if success and "access_token" in response:
            self.token = response["access_token"]
            self.user_data = response["user"]
            self.user_id = self.user_data["id"]
            self.log_test("User Registration", True, f"User ID: {self.user_id}")
            return True
        else:
            self.log_test("User Registration", False, f"Response: {response}")
            return False

    def test_user_login(self):
        """Test user login with registered credentials"""
        if not self.user_data:
            self.log_test("User Login", False, "No user data available for login test")
            return False

        # Extract username from user_data for login
        login_data = {
            "username": self.user_data["username"],
            "password": "TestPass123!"
        }
        
        success, response = self.make_request("POST", "login", login_data, 200)
        
        if success and "access_token" in response:
            self.token = response["access_token"]  # Update token
            self.log_test("User Login", True, f"Token received")
            return True
        else:
            self.log_test("User Login", False, f"Response: {response}")
            return False

    def test_get_current_user(self):
        """Test getting current user profile"""
        success, response = self.make_request("GET", "me", use_auth=True)
        self.log_test("Get Current User", success, f"User: {response.get('username', 'unknown')}")
        return success

    def test_update_profile(self):
        """Test updating user profile"""
        update_data = {
            "display_name": "Updated Test User",
            "theme": "dark",
            "notifications_enabled": False
        }
        
        success, response = self.make_request("PUT", "me", update_data, use_auth=True)
        self.log_test("Update Profile", success, f"Updated display_name: {response.get('display_name', 'unknown')}")
        return success

    def test_get_users(self):
        """Test getting list of users"""
        success, response = self.make_request("GET", "users", use_auth=True)
        user_count = len(response) if isinstance(response, list) else 0
        self.log_test("Get Users", success, f"Found {user_count} users")
        return success

    def test_search_users(self):
        """Test user search functionality"""
        success, response = self.make_request("GET", "users/search?query=test", use_auth=True)
        user_count = len(response) if isinstance(response, list) else 0
        self.log_test("Search Users", success, f"Found {user_count} users matching 'test'")
        return success

    def test_create_conversation(self):
        """Test creating a conversation"""
        # First get users to create conversation with
        users_success, users_response = self.make_request("GET", "users", use_auth=True)
        
        if not users_success or not users_response:
            self.log_test("Create Conversation", False, "No users available to create conversation")
            return False

        # Create conversation with first available user
        target_user_id = users_response[0]["id"] if users_response else None
        if not target_user_id:
            self.log_test("Create Conversation", False, "No target user found")
            return False

        conv_data = {
            "participant_ids": [target_user_id],
            "is_group": False
        }
        
        success, response = self.make_request("POST", "conversations", conv_data, use_auth=True)
        
        if success and "id" in response:
            self.conversation_id = response["id"]
            self.log_test("Create Conversation", True, f"Conversation ID: {self.conversation_id}")
            return True
        else:
            self.log_test("Create Conversation", False, f"Response: {response}")
            return False

    def test_get_conversations(self):
        """Test getting user's conversations"""
        success, response = self.make_request("GET", "conversations", use_auth=True)
        conv_count = len(response) if isinstance(response, list) else 0
        self.log_test("Get Conversations", success, f"Found {conv_count} conversations")
        return success

    def test_send_message(self):
        """Test sending a message"""
        if not hasattr(self, 'conversation_id'):
            self.log_test("Send Message", False, "No conversation available")
            return False

        message_data = {
            "content": "Hello, this is a test message!",
            "conversation_id": self.conversation_id
        }
        
        success, response = self.make_request("POST", "messages", message_data, use_auth=True)
        
        if success and "id" in response:
            self.message_id = response["id"]
            self.log_test("Send Message", True, f"Message ID: {self.message_id}")
            return True
        else:
            self.log_test("Send Message", False, f"Response: {response}")
            return False

    def test_get_messages(self):
        """Test getting messages from conversation"""
        if not hasattr(self, 'conversation_id'):
            self.log_test("Get Messages", False, "No conversation available")
            return False

        success, response = self.make_request("GET", f"conversations/{self.conversation_id}/messages", use_auth=True)
        message_count = len(response) if isinstance(response, list) else 0
        self.log_test("Get Messages", success, f"Found {message_count} messages")
        return success

    def test_create_group(self):
        """Test creating a group chat"""
        # Get users for group
        users_success, users_response = self.make_request("GET", "users", use_auth=True)
        
        if not users_success or not users_response:
            self.log_test("Create Group", False, "No users available for group")
            return False

        # Take first available user for group
        participant_ids = [users_response[0]["id"]] if users_response else []
        
        group_data = {
            "name": "Test Group Chat",
            "description": "A test group for API testing",
            "participant_ids": participant_ids
        }
        
        success, response = self.make_request("POST", "groups", group_data, use_auth=True)
        
        if success and "id" in response:
            self.group_id = response["id"]
            self.log_test("Create Group", True, f"Group ID: {self.group_id}")
            return True
        else:
            self.log_test("Create Group", False, f"Response: {response}")
            return False

    def test_logout(self):
        """Test user logout"""
        success, response = self.make_request("POST", "logout", use_auth=True)
        self.log_test("User Logout", success, f"Message: {response.get('message', 'unknown')}")
        return success

    def run_all_tests(self):
        """Run all API tests in sequence"""
        print("🚀 Starting Messenger API Tests...")
        print(f"📡 Testing against: {self.base_url}")
        print("=" * 60)

        # Test sequence
        test_methods = [
            self.test_health_check,
            self.test_user_registration,
            self.test_user_login,
            self.test_get_current_user,
            self.test_update_profile,
            self.test_get_users,
            self.test_search_users,
            self.test_create_conversation,
            self.test_get_conversations,
            self.test_send_message,
            self.test_get_messages,
            self.test_create_group,
            self.test_logout
        ]

        for test_method in test_methods:
            try:
                test_method()
            except Exception as e:
                test_name = test_method.__name__.replace('test_', '').replace('_', ' ').title()
                self.log_test(test_name, False, f"Exception: {str(e)}")

        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        # Print failed tests
        failed_tests = [test for test in self.test_results if not test["success"]]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['name']}: {test['details']}")

        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = MessengerAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())