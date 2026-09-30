import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.department import Department
from app.models.incident import Incident
from app.models.hotspot import Hotspot

class TestDay1Setup(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_root_endpoint(self):
        response = self.client.get("/", headers={"Accept": "application/json"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("docs", data)
        self.assertIn("health", data)

    def test_health_endpoint(self):
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "HEALTHY")
        self.assertTrue(data["database_connected"])

    def test_departments_endpoint(self):
        response = self.client.get("/api/v1/departments/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreaterEqual(len(data), 2)
        names = [d["name"] for d in data]
        self.assertIn("Sanitation & Solid Waste Management Authority", names)
        self.assertIn("Water Supply & Sewerage Board", names)

    def test_database_models_exist(self):
        db = SessionLocal()
        try:
            depts = db.query(Department).count()
            self.assertGreaterEqual(depts, 2)
            incidents = db.query(Incident).count()
            self.assertGreaterEqual(incidents, 0)
            hotspots = db.query(Hotspot).count()
            self.assertGreaterEqual(hotspots, 0)
        finally:
            db.close()

if __name__ == "__main__":
    unittest.main()
