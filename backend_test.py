#!/usr/bin/env python3
"""
Backend API Testing for Attendance Control System
Tests all endpoints including auth, file upload, dashboard, and reports
"""

import requests
import sys
import json
import os
from datetime import datetime
from pathlib import Path

class AttendanceSystemTester:
    def __init__(self, base_url="https://time-sync-hub-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.report_id = None
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, cookies=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}" if not endpoint.startswith('http') else endpoint
        
        self.tests_run += 1
        self.log(f"Testing {name}...")
        
        try:
            if method == 'GET':
                response = self.session.get(url)
            elif method == 'POST':
                if files:
                    response = self.session.post(url, files=files, data=data)
                else:
                    response = self.session.post(url, json=data)
            elif method == 'PUT':
                response = self.session.put(url, json=data)
            elif method == 'DELETE':
                response = self.session.delete(url)
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    self.log(f"   Error: {error_detail}")
                except:
                    self.log(f"   Error: {response.text}")
                return False, {}
                
        except Exception as e:
            self.log(f"❌ {name} - Exception: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_login(self, email="admin@empresa.com", password="Admin2024!", remember_me=True):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST", 
            "auth/login",
            200,
            data={"email": email, "password": password, "remember_me": remember_me}
        )
        
        if success and 'id' in response:
            self.log(f"   Logged in as: {response.get('name')} ({response.get('email')})")
            return True
        return False

    def test_auth_me(self):
        """Test getting current user info"""
        return self.run_test("Get Current User", "GET", "auth/me", 200)

    def test_settings_get(self):
        """Test getting settings"""
        return self.run_test("Get Settings", "GET", "settings", 200)

    def test_settings_update(self):
        """Test updating settings"""
        settings_data = {
            "entry_time": "09:00",
            "tolerance_minutes": 30,
            "work_hours": 9
        }
        return self.run_test("Update Settings", "PUT", "settings", 200, data=settings_data)

    def test_version_info(self):
        """Test version endpoint"""
        return self.run_test("Get Version", "GET", "version", 200)

    def test_check_updates(self):
        """Test check updates endpoint"""
        return self.run_test("Check Updates", "POST", "check-updates", 200)

    def test_dashboard_stats_empty(self):
        """Test dashboard stats when no data"""
        success, response = self.run_test("Dashboard Stats (Empty)", "GET", "dashboard/stats", 200)
        if success:
            has_data = response.get('has_data', True)
            if not has_data:
                self.log("   ✅ Correctly shows no data available")
            else:
                self.log("   ℹ️  Data already exists in system")
        return success

    def test_excel_upload(self):
        """Test Excel file upload"""
        sample_file = Path("/app/sample_report.xls")
        if not sample_file.exists():
            self.log("❌ Sample Excel file not found at /app/sample_report.xls")
            return False
            
        try:
            with open(sample_file, 'rb') as f:
                files = {'file': ('sample_report.xls', f, 'application/vnd.ms-excel')}
                success, response = self.run_test(
                    "Excel Upload", 
                    "POST", 
                    "upload/excel", 
                    200, 
                    files=files
                )
                
            if success and 'report_id' in response:
                self.report_id = response['report_id']
                self.log(f"   Report ID: {self.report_id}")
                self.log(f"   Employees processed: {len(response.get('employees', []))}")
                self.log(f"   Attendance records: {len(response.get('attendance_records', []))}")
                return True
            return success
            
        except Exception as e:
            self.log(f"❌ Excel Upload - Exception: {str(e)}")
            return False

    def test_dashboard_stats_with_data(self):
        """Test dashboard stats after uploading data"""
        success, response = self.run_test("Dashboard Stats (With Data)", "GET", "dashboard/stats", 200)
        if success:
            has_data = response.get('has_data', False)
            if has_data:
                stats = response.get('statistics', {})
                self.log(f"   Total Employees: {stats.get('total_employees', 0)}")
                self.log(f"   Total Absences: {stats.get('total_absences', 0)}")
                self.log(f"   Total Delays: {stats.get('total_delays', 0)}")
                self.log(f"   Alerts: {len(response.get('alerts', []))}")
            else:
                self.log("   ⚠️  No data found after upload")
        return success

    def test_reports_list(self):
        """Test getting reports list"""
        success, response = self.run_test("Get Reports List", "GET", "reports", 200)
        if success:
            self.log(f"   Found {len(response)} reports")
        return success

    def test_report_details(self):
        """Test getting specific report details"""
        if not self.report_id:
            self.log("⚠️  Skipping report details test - no report ID")
            return True
            
        return self.run_test(f"Get Report Details", "GET", f"reports/{self.report_id}", 200)

    def test_excel_preview(self):
        """Test Excel preview functionality"""
        if not self.report_id:
            self.log("⚠️  Skipping Excel preview test - no report ID")
            return True
            
        success, response = self.run_test(
            "Excel Preview", 
            "GET", 
            f"reports/{self.report_id}/excel-preview", 
            200
        )
        if success:
            sheets = response.get('sheets', {})
            self.log(f"   Sheets found: {list(sheets.keys())}")
        return success

    def test_pdf_export(self):
        """Test PDF export functionality"""
        if not self.report_id:
            self.log("⚠️  Skipping PDF export test - no report ID")
            return True
            
        try:
            url = f"{self.base_url}/api/reports/{self.report_id}/pdf"
            response = self.session.get(url)
            
            success = response.status_code == 200
            if success:
                self.tests_passed += 1
                content_type = response.headers.get('content-type', '')
                if 'application/pdf' in content_type:
                    self.log("✅ PDF Export - PDF generated successfully")
                else:
                    self.log(f"⚠️  PDF Export - Unexpected content type: {content_type}")
            else:
                self.log(f"❌ PDF Export - Status: {response.status_code}")
                
            self.tests_run += 1
            return success
            
        except Exception as e:
            self.log(f"❌ PDF Export - Exception: {str(e)}")
            self.tests_run += 1
            return False

    def test_employees_list(self):
        """Test getting employees list"""
        return self.run_test("Get Employees", "GET", "employees", 200)

    def test_employee_history(self):
        """Test getting employee history"""
        # First get employees to get an ID
        success, response = self.run_test("Get Employees for History", "GET", "employees", 200)
        if success and response:
            if len(response) > 0:
                employee_id = response[0].get('employee_id')
                if employee_id:
                    return self.run_test(
                        f"Employee History", 
                        "GET", 
                        f"employees/{employee_id}/history", 
                        200
                    )
        
        self.log("⚠️  Skipping employee history test - no employees found")
        return True

    def test_logout(self):
        """Test logout"""
        return self.run_test("Logout", "POST", "auth/logout", 200)

    def test_auth_after_logout(self):
        """Test that auth is required after logout"""
        success, response = self.run_test("Auth Check After Logout", "GET", "auth/me", 401)
        # For this test, we expect 401, so success means we got 401
        return success

    def run_all_tests(self):
        """Run all backend tests in sequence"""
        self.log("🚀 Starting Backend API Tests")
        self.log(f"Base URL: {self.base_url}")
        
        # Test sequence
        tests = [
            ("Root Endpoint", self.test_root_endpoint),
            ("Admin Login", self.test_login),
            ("Current User Info", self.test_auth_me),
            ("Get Settings", self.test_settings_get),
            ("Update Settings", self.test_settings_update),
            ("Version Info", self.test_version_info),
            ("Check Updates", self.test_check_updates),
            ("Dashboard Stats (Empty)", self.test_dashboard_stats_empty),
            ("Excel Upload", self.test_excel_upload),
            ("Dashboard Stats (With Data)", self.test_dashboard_stats_with_data),
            ("Reports List", self.test_reports_list),
            ("Report Details", self.test_report_details),
            ("Excel Preview", self.test_excel_preview),
            ("PDF Export", self.test_pdf_export),
            ("Employees List", self.test_employees_list),
            ("Employee History", self.test_employee_history),
            ("Logout", self.test_logout),
            ("Auth After Logout", self.test_auth_after_logout),
        ]
        
        for test_name, test_func in tests:
            try:
                test_func()
            except Exception as e:
                self.log(f"❌ {test_name} - Unexpected error: {str(e)}")
                self.tests_run += 1
        
        # Print summary
        self.log("=" * 50)
        self.log(f"📊 Backend Tests Summary:")
        self.log(f"   Tests Run: {self.tests_run}")
        self.log(f"   Tests Passed: {self.tests_passed}")
        self.log(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            self.log("🎉 All backend tests passed!")
            return 0
        else:
            self.log(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return 1

def main():
    tester = AttendanceSystemTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())