import unittest
import io
from pathlib import Path
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app

class TestDay10EndToEndSystem(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def _generate_test_image(self, color=(140, 80, 40)) -> bytes:
        img = Image.new("RGB", (250, 250), color=color)
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        return buf.getvalue()

    def test_complete_closed_loop_lifecycle(self):
        """
        Validate the complete 7-stage closed-loop civic resolution flow:
        1. Citizen Reports (Image + GPS)
        2. AI Analyzes Extent (60%) & Location POI Proximity (40%)
        3. Automated Routing to Municipality
        4. Officer Triage & Worker Assignment
        5. Field Worker Navigation & Cleanup Execution
        6. AFTER Photo Submission & AI Verification
        7. Verified Resolution & Public Transparency Certificate
        """
        # --- STAGE 1: Citizen Submission ---
        raw_photo = self._generate_test_image(color=(130, 85, 30))
        report_res = self.client.post(
            "/api/v1/incidents/report",
            data={
                "latitude": "12.9784",
                "longitude": "77.6408",
                "citizen_phone": "+91 98450 12345",
                "citizen_name": "Deepak Kumar",
                "description": "Critical garbage overflow spilling near storm drain"
            },
            files={"image": ("incident_garbage.jpg", raw_photo, "image/jpeg")}
        )
        self.assertEqual(report_res.status_code, 201)
        ticket = report_res.json()
        incident_id = ticket["id"]

        # --- STAGE 2: AI Vision & Severity Verification ---
        self.assertIn("severity_score", ticket)
        self.assertGreater(ticket["severity_score"], 0)
        self.assertIn(ticket["severity_tier"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        self.assertIsNotNone(ticket["department_name"])

        # --- STAGE 3: Officer Triage & Assignment ---
        assign_res = self.client.patch(
            f"/api/v1/incidents/{incident_id}/status",
            json={
                "status": "ASSIGNED",
                "assigned_worker_name": "Rapid Response Unit #07"
            }
        )
        self.assertEqual(assign_res.status_code, 200)
        self.assertEqual(assign_res.json()["status"], "ASSIGNED")
        self.assertEqual(assign_res.json()["assigned_worker_name"], "Rapid Response Unit #07")

        # --- STAGE 4: Field Worker Execution ---
        start_res = self.client.patch(
            f"/api/v1/incidents/{incident_id}/status",
            json={"status": "IN_PROGRESS"}
        )
        self.assertEqual(start_res.status_code, 200)
        self.assertEqual(start_res.json()["status"], "IN_PROGRESS")

        # --- STAGE 5: Hotspots Integration ---
        hotspots_res = self.client.get("/api/v1/hotspots/")
        self.assertEqual(hotspots_res.status_code, 200)
        self.assertIsInstance(hotspots_res.json(), list)

        # --- STAGE 6: Resolution Submission & AI Verification ---
        clean_after_photo = self._generate_test_image(color=(210, 210, 210))
        resolve_res = self.client.post(
            f"/api/v1/incidents/{incident_id}/resolve",
            data={"notes": "Waste cleared, area disinfected, drain gate cleared."},
            files={"image": ("clean_after.jpg", clean_after_photo, "image/jpeg")}
        )
        self.assertEqual(resolve_res.status_code, 200)
        resolved_ticket = resolve_res.json()
        self.assertEqual(resolved_ticket["status"], "VERIFIED")
        self.assertEqual(resolved_ticket["verification_status"], "VERIFIED")
        self.assertIsNotNone(resolved_ticket["after_image_url"])
        self.assertIsNotNone(resolved_ticket["resolved_at"])

        # --- STAGE 7: Public Transparency & Tracker Inspection ---
        track_res = self.client.get(f"/api/v1/incidents/{incident_id}")
        self.assertEqual(track_res.status_code, 200)
        final_data = track_res.json()
        self.assertTrue(bool(final_data["verification_notes"]))
        self.assertIn("Waste cleared", final_data["verification_notes"])

if __name__ == "__main__":
    unittest.main()
