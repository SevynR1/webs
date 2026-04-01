#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class SEVYNAPITester:
    def __init__(self, base_url="https://gothic-chrome-shop.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_session = requests.Session()
        self.user_session = requests.Session()
        self.test_user_id = None
        self.test_product_id = None
        self.test_order_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # Test credentials
        self.admin_email = "admin@sevyn.com"
        self.admin_password = "admin123"
        self.test_user_email = f"testuser_{datetime.now().strftime('%H%M%S')}@test.com"
        self.test_user_password = "testpass123"
        self.test_user_name = "Test User"

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")
        
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append({"name": name, "details": details})

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    headers: Optional[Dict] = None, use_admin_auth: bool = False, 
                    use_user_auth: bool = False) -> tuple[bool, Dict[str, Any], int]:
        """Make HTTP request with error handling"""
        url = f"{self.api_url}/{endpoint.lstrip('/')}"
        
        # Setup headers
        req_headers = {"Content-Type": "application/json"}
        if headers:
            req_headers.update(headers)
            
        # Choose session based on auth requirement
        session = requests.Session()
        if use_admin_auth:
            session = self.admin_session
        elif use_user_auth:
            session = self.user_session
        
        try:
            if method.upper() == "GET":
                response = session.get(url, headers=req_headers, timeout=30)
            elif method.upper() == "POST":
                response = session.post(url, json=data, headers=req_headers, timeout=30)
            elif method.upper() == "PUT":
                response = session.put(url, json=data, headers=req_headers, timeout=30)
            elif method.upper() == "DELETE":
                response = session.delete(url, headers=req_headers, timeout=30)
            else:
                return False, {"error": f"Unsupported method: {method}"}, 0
            
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text}
                
            return response.status_code < 400, response_data, response.status_code
            
        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0

    def test_health_check(self):
        """Test basic API health"""
        print("\n🔍 Testing API Health...")
        
        # Test root endpoint
        success, data, status = self.make_request("GET", "/")
        self.log_test("API Root Endpoint", success and status == 200, 
                     f"Status: {status}, Response: {data}")
        
        # Test health endpoint
        success, data, status = self.make_request("GET", "/health")
        self.log_test("Health Check Endpoint", success and status == 200,
                     f"Status: {status}, Response: {data}")

    def test_admin_auth(self):
        """Test admin authentication"""
        print("\n🔍 Testing Admin Authentication...")
        
        # Test admin login
        login_data = {
            "email": self.admin_email,
            "password": self.admin_password
        }
        
        success, data, status = self.make_request("POST", "/auth/login", login_data)
        
        if success and status == 200 and "id" in data:
            # Store login response in admin session
            self.admin_session.post(f"{self.api_url}/auth/login", json=login_data)
            self.log_test("Admin Login", True, f"Admin logged in successfully: {data.get('email')}")
            
            # Test admin role verification
            success, user_data, status = self.make_request("GET", "/auth/me", use_admin_auth=True)
            admin_role_check = success and user_data.get("role") == "admin"
            self.log_test("Admin Role Verification", admin_role_check,
                         f"Role: {user_data.get('role', 'unknown')}")
        else:
            self.log_test("Admin Login", False, f"Status: {status}, Response: {data}")

    def test_user_registration_and_auth(self):
        """Test user registration and authentication"""
        print("\n🔍 Testing User Registration & Authentication...")
        
        # Test user registration
        register_data = {
            "email": self.test_user_email,
            "password": self.test_user_password,
            "name": self.test_user_name
        }
        
        success, data, status = self.make_request("POST", "/auth/register", register_data)
        
        if success and status == 200 and "id" in data:
            self.test_user_id = data["id"]
            # Store registration response in user session
            self.user_session.post(f"{self.api_url}/auth/register", json=register_data)
            self.log_test("User Registration", True, f"User registered: {data.get('email')}")
            
            # Test user login
            login_data = {
                "email": self.test_user_email,
                "password": self.test_user_password
            }
            
            success, login_response, status = self.make_request("POST", "/auth/login", login_data)
            
            if success and status == 200:
                # Store login response in user session
                self.user_session.post(f"{self.api_url}/auth/login", json=login_data)
                self.log_test("User Login", True, f"User logged in: {login_response.get('email')}")
                
                # Test /auth/me endpoint
                success, user_data, status = self.make_request("GET", "/auth/me", use_user_auth=True)
                self.log_test("Get Current User", success and status == 200,
                             f"User data: {user_data.get('name', 'unknown')}")
            else:
                self.log_test("User Login", False, f"Status: {status}, Response: {login_response}")
        else:
            self.log_test("User Registration", False, f"Status: {status}, Response: {data}")

    def test_product_management(self):
        """Test product CRUD operations (admin only)"""
        print("\n🔍 Testing Product Management...")
        
        # Test get products (public)
        success, data, status = self.make_request("GET", "/products")
        self.log_test("Get Products (Public)", success and status == 200,
                     f"Found {len(data) if isinstance(data, list) else 0} products")
        
        # Test get categories
        success, categories, status = self.make_request("GET", "/categories")
        self.log_test("Get Categories", success and status == 200,
                     f"Categories: {categories if isinstance(categories, list) else 'error'}")
        
        # Test create product (admin required)
        product_data = {
            "name": "Test Gothic Hoodie",
            "description": "A dark and edgy hoodie perfect for the gothic aesthetic",
            "price": 89.99,
            "tiktok_cost": 35.00,
            "tiktok_link": "https://tiktok.com/test-product",
            "images": ["https://images.unsplash.com/photo-1647540977003-9a9e6f3b5fb9?w=400"],
            "category": "Hoodies",
            "sizes": ["S", "M", "L", "XL"],
            "in_stock": True
        }
        
        success, product_response, status = self.make_request("POST", "/admin/products", 
                                                            product_data, use_admin_auth=True)
        
        if success and status == 200 and "id" in product_response:
            self.test_product_id = product_response["id"]
            self.log_test("Create Product (Admin)", True, 
                         f"Product created: {product_response.get('name')}")
            
            # Test get single product
            success, product, status = self.make_request("GET", f"/products/{self.test_product_id}")
            self.log_test("Get Single Product", success and status == 200,
                         f"Product: {product.get('name', 'unknown')}")
            
            # Test update product
            update_data = {"price": 99.99, "description": "Updated description"}
            success, updated_product, status = self.make_request("PUT", f"/admin/products/{self.test_product_id}",
                                                               update_data, use_admin_auth=True)
            self.log_test("Update Product (Admin)", success and status == 200,
                         f"Updated price: ${updated_product.get('price', 0)}")
        else:
            self.log_test("Create Product (Admin)", False, f"Status: {status}, Response: {product_response}")

    def test_cart_operations(self):
        """Test cart functionality"""
        print("\n🔍 Testing Cart Operations...")
        
        if not self.test_product_id:
            self.log_test("Cart Operations", False, "No test product available")
            return
        
        # Test get empty cart
        success, cart_data, status = self.make_request("GET", "/cart", use_user_auth=True)
        self.log_test("Get Empty Cart", success and status == 200,
                     f"Cart items: {len(cart_data.get('items', []))}")
        
        # Test add to cart
        cart_item = {
            "product_id": self.test_product_id,
            "quantity": 2,
            "size": "M"
        }
        
        success, add_response, status = self.make_request("POST", "/cart/add", cart_item, use_user_auth=True)
        self.log_test("Add to Cart", success and status == 200,
                     f"Response: {add_response.get('message', 'unknown')}")
        
        # Test get cart with items
        success, cart_data, status = self.make_request("GET", "/cart", use_user_auth=True)
        cart_has_items = success and len(cart_data.get('items', [])) > 0
        self.log_test("Get Cart with Items", cart_has_items,
                     f"Cart total: ${cart_data.get('total', 0)}")
        
        # Test update cart item
        update_data = {"quantity": 3}
        success, update_response, status = self.make_request("PUT", f"/cart/{self.test_product_id}",
                                                           update_data, use_user_auth=True)
        self.log_test("Update Cart Item", success and status == 200,
                     f"Response: {update_response.get('message', 'unknown')}")

    def test_order_operations(self):
        """Test order creation and management"""
        print("\n🔍 Testing Order Operations...")
        
        # Test create order
        order_data = {
            "shipping_address": "123 Gothic Street",
            "shipping_city": "Dark City",
            "shipping_zip": "12345",
            "shipping_country": "United States"
        }
        
        success, order_response, status = self.make_request("POST", "/orders", order_data, use_user_auth=True)
        
        if success and status == 200 and "id" in order_response:
            self.test_order_id = order_response["id"]
            self.log_test("Create Order", True,
                         f"Order total: ${order_response.get('total', 0)}")
            
            # Test get user orders
            success, orders, status = self.make_request("GET", "/orders", use_user_auth=True)
            self.log_test("Get User Orders", success and status == 200,
                         f"Found {len(orders) if isinstance(orders, list) else 0} orders")
            
            # Test get single order
            success, order, status = self.make_request("GET", f"/orders/{self.test_order_id}", use_user_auth=True)
            self.log_test("Get Single Order", success and status == 200,
                         f"Order status: {order.get('status', 'unknown')}")
        else:
            self.log_test("Create Order", False, f"Status: {status}, Response: {order_response}")

    def test_admin_operations(self):
        """Test admin-specific operations"""
        print("\n🔍 Testing Admin Operations...")
        
        # Test get admin stats
        success, stats, status = self.make_request("GET", "/admin/stats", use_admin_auth=True)
        self.log_test("Get Admin Stats", success and status == 200,
                     f"Total orders: {stats.get('total_orders', 0)}")
        
        # Test get all orders (admin)
        success, all_orders, status = self.make_request("GET", "/admin/orders", use_admin_auth=True)
        self.log_test("Get All Orders (Admin)", success and status == 200,
                     f"Found {len(all_orders) if isinstance(all_orders, list) else 0} orders")
        
        # Test update order status
        if self.test_order_id:
            status_data = {"status": "processing"}
            success, update_response, status = self.make_request("PUT", f"/admin/orders/{self.test_order_id}/status",
                                                               status_data, use_admin_auth=True)
            self.log_test("Update Order Status (Admin)", success and status == 200,
                         f"Response: {update_response.get('message', 'unknown')}")

    def test_paypal_integration(self):
        """Test PayPal integration endpoints"""
        print("\n🔍 Testing PayPal Integration...")
        
        if not self.test_order_id:
            self.log_test("PayPal Integration", False, "No test order available")
            return
        
        # Test create PayPal order
        paypal_data = {"order_id": self.test_order_id}
        success, paypal_response, status = self.make_request("POST", "/paypal/create-order",
                                                           paypal_data, use_user_auth=True)
        self.log_test("Create PayPal Order", success and status == 200,
                     f"PayPal order data: {paypal_response.get('id', 'unknown')}")

    def cleanup_test_data(self):
        """Clean up test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Delete test product
        if self.test_product_id:
            success, _, status = self.make_request("DELETE", f"/admin/products/{self.test_product_id}",
                                                  use_admin_auth=True)
            self.log_test("Delete Test Product", success and status == 200)
        
        # Clear cart
        success, _, status = self.make_request("DELETE", "/cart", use_user_auth=True)
        self.log_test("Clear Test Cart", success and status == 200)

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting SEVYN E-commerce API Tests")
        print("=" * 50)
        
        try:
            self.test_health_check()
            self.test_admin_auth()
            self.test_user_registration_and_auth()
            self.test_product_management()
            self.test_cart_operations()
            self.test_order_operations()
            self.test_admin_operations()
            self.test_paypal_integration()
            self.cleanup_test_data()
            
        except Exception as e:
            print(f"\n❌ Test suite failed with error: {str(e)}")
            self.failed_tests.append({"name": "Test Suite Execution", "details": str(e)})
        
        # Print summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"  - {test['name']}: {test['details']}")
        
        return len(self.failed_tests) == 0

def main():
    """Main test execution"""
    tester = SEVYNAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())