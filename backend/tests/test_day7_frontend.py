import unittest
from fastapi.testclient import TestClient
from app.main import app

class TestDay7FrontendDashboard(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_dashboard_endpoint_serves_html(self):
        response = self.client.get("/dashboard")
        self.assertEqual(response.status_code, 200)
        self.assertIn("SwachhVision", response.text)
        self.assertIn("Admin", response.text)

    def test_root_endpoint_serves_dashboard(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("SwachhVision", response.text)

if __name__ == "__main__":
    unittest.main()
