import unittest
import os
import io
from pathlib import Path
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app

class TestDay8Portals(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def _create_dummy_image(self) -> bytes:
        img = Image.new("RGB", (200, 200), color=(120, 80, 40))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        return buf.getvalue()

    def test_portal_html_endpoints(self):
        """Verify that dashboard, citizen portal, and worker action portal routes return HTTP 200 HTML content."""
        # Dashboard
        dash_res = self.client.get("/dashboard")
        self.assertEqual(dash_res.status_code, 200)
        self.assertIn("SwachhVision", dash_res.text)

        # Citizen Portal
        citizen_res = self.client.get("/citizen")
        self.assertEqual(citizen_res.status_code, 200)
        self.assertIn("SwachhVision", citizen_res.text)

        # Worker Portal
        worker_res = self.client.get("/worker")
        self.assertEqual(worker_res.status_code, 200)
        self.assertIn("Field Worker", worker_res.text)

        # Track route
        track_res = self.client.get("/track/1")
        self.assertEqual(track_res.status_code, 200)

    def test_citizen_report_and_worker_lifecycle(self):
        """Simulate end-to-end citizen reporting followed by worker status progression."""
        img_bytes = self._create_dummy_image()

        # 1. Citizen reports issue
        report_res = self.client.post(
            "/api/v1/incidents/report",
            data={
                "latitude": "12.9720",
                "longitude": "77.5950",
                "citizen_phone": "+919876543210",
                "citizen_name": "Citizen Ramesh",
                "description": "Garbage dump near hospital boundary"
            },
            files={"image": ("report.jpg", img_bytes, "image/jpeg")}
        )
        self.assertEqual(report_res.status_code, 201)
        data = report_res.json()
        incident_id = data["id"]
        self.assertIsNotNone(incident_id)
        self.assertIn("severity_score", data)
        self.assertIn("department_name", data)

        # 2. Worker fetches assigned tasks
        tasks_res = self.client.get("/api/v1/incidents")
        self.assertEqual(tasks_res.status_code, 200)
        tasks = tasks_res.json()
        self.assertTrue(any(t["id"] == incident_id for t in tasks))

        # 3. Worker marks task IN_PROGRESS
        progress_res = self.client.patch(
            f"/api/v1/incidents/{incident_id}/status",
            json={"status": "IN_PROGRESS"}
        )
        self.assertEqual(progress_res.status_code, 200)
        self.assertEqual(progress_res.json()["status"], "IN_PROGRESS")

        # 4. Worker marks task RESOLVED
        resolve_res = self.client.patch(
            f"/api/v1/incidents/{incident_id}/status",
            json={"status": "RESOLVED"}
        )
        self.assertEqual(resolve_res.status_code, 200)
        self.assertEqual(resolve_res.json()["status"], "RESOLVED")

        # 5. Citizen tracks ticket status
        track_res = self.client.get(f"/api/v1/incidents/{incident_id}")
        self.assertEqual(track_res.status_code, 200)
        self.assertEqual(track_res.json()["status"], "RESOLVED")

if __name__ == "__main__":
    unittest.main()
