import unittest
import io
from pathlib import Path
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.incident import Incident

class TestDay5IncidentEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def _create_sample_image_bytes(self) -> io.BytesIO:
        img = Image.new("RGB", (300, 300), color=(150, 100, 70))
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='JPEG')
        img_byte_arr.seek(0)
        return img_byte_arr

    def test_report_incident_endpoint(self):
        img_bytes = self._create_sample_image_bytes()
        
        response = self.client.post(
            "/api/v1/incidents/report",
            data={
                "latitude": 12.9716,
                "longitude": 77.5946,
                "reporter_contact": "+91-9876543210"
            },
            files={"image": ("street_garbage.jpg", img_bytes, "image/jpeg")}
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        
        self.assertIn("id", data)
        self.assertIn("ticket_number", data)
        self.assertTrue(data["ticket_number"].startswith("CIV-"))
        self.assertIn("severity_score", data)
        self.assertIn("severity_tier", data)
        self.assertIn("address", data)
        self.assertEqual(data["status"], "REPORTED")
        self.assertIn("/uploads/", data["before_image_url"])

        # Save ID for follow up tests
        self.incident_id = data["id"]

    def test_list_incidents_and_filters(self):
        # Create an incident first
        img_bytes = self._create_sample_image_bytes()
        self.client.post(
            "/api/v1/incidents/report",
            data={"latitude": 12.9750, "longitude": 77.5990, "reporter_contact": "citizen@test.com"},
            files={"image": ("sample.jpg", img_bytes, "image/jpeg")}
        )

        # Test listing all
        resp = self.client.get("/api/v1/incidents")
        self.assertEqual(resp.status_code, 200)
        incidents = resp.json()
        self.assertGreaterEqual(len(incidents), 1)

        # Test filter by status
        resp_status = self.client.get("/api/v1/incidents?status=REPORTED")
        self.assertEqual(resp_status.status_code, 200)
        for inc in resp_status.json():
            self.assertEqual(inc["status"], "REPORTED")

        # Test bounding box filter
        resp_bbox = self.client.get("/api/v1/incidents?min_lat=12.0&max_lat=13.5&min_lon=77.0&max_lon=78.0")
        self.assertEqual(resp_bbox.status_code, 200)
        self.assertGreaterEqual(len(resp_bbox.json()), 1)

    def test_get_and_patch_incident_status(self):
        # Create incident
        img_bytes = self._create_sample_image_bytes()
        create_resp = self.client.post(
            "/api/v1/incidents/report",
            data={"latitude": 12.9800, "longitude": 77.5850},
            files={"image": ("test.jpg", img_bytes, "image/jpeg")}
        )
        inc_id = create_resp.json()["id"]

        # Get single incident
        get_resp = self.client.get(f"/api/v1/incidents/{inc_id}")
        self.assertEqual(get_resp.status_code, 200)
        self.assertEqual(get_resp.json()["id"], inc_id)

        # Patch status to ASSIGNED
        patch_resp = self.client.patch(
            f"/api/v1/incidents/{inc_id}/status",
            json={"status": "ASSIGNED", "assigned_worker_name": "Ramesh Kumar (Field Unit 3)"}
        )
        self.assertEqual(patch_resp.status_code, 200)
        updated = patch_resp.json()
        self.assertEqual(updated["status"], "ASSIGNED")
        self.assertEqual(updated["assigned_worker_name"], "Ramesh Kumar (Field Unit 3)")

if __name__ == "__main__":
    unittest.main()
