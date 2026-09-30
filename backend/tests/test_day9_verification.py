import unittest
import os
import io
from pathlib import Path
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.services.verification_service import verification_service, VerificationResult

class TestDay9Verification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def _create_clean_image(self) -> bytes:
        # Create a plain clean pavement image (no garbage/sewage colors or masks)
        img = Image.new("RGB", (200, 200), color=(200, 200, 200))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        return buf.getvalue()

    def _create_report_image(self) -> bytes:
        img = Image.new("RGB", (200, 200), color=(120, 80, 40))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        return buf.getvalue()

    def test_tracker_html_endpoints(self):
        """Verify that tracker HTML endpoints return HTTP 200."""
        res1 = self.client.get("/tracker")
        self.assertEqual(res1.status_code, 200)
        self.assertIn("Resolution Proof", res1.text)

        res2 = self.client.get("/tracker/1")
        self.assertEqual(res2.status_code, 200)

    def test_verification_service_logic(self):
        """Verify standalone verification service behavior."""
        test_dir = Path(__file__).resolve().parent / "temp_verify"
        test_dir.mkdir(exist_ok=True)
        clean_img_path = test_dir / "clean_test.jpg"
        
        img = Image.new("RGB", (200, 200), color=(220, 220, 220))
        img.save(clean_img_path)

        res = verification_service.verify_resolution(
            before_image_path="",
            after_image_path=str(clean_img_path)
        )
        self.assertTrue(res["is_verified"])
        self.assertEqual(res["verification_status"], VerificationResult.VERIFIED)
        self.assertIn("Clean area confirmed", res["notes"])

    def test_full_resolution_and_verification_pipeline(self):
        """Test reporting an incident, submitting a clean after photo, and verifying resolution."""
        # 1. Report incident
        report_img = self._create_report_image()
        report_res = self.client.post(
            "/api/v1/incidents/report",
            data={
                "latitude": "12.9716",
                "longitude": "77.5946",
                "citizen_phone": "+919900011223",
                "description": "Garbage dump near gate"
            },
            files={"image": ("before_dump.jpg", report_img, "image/jpeg")}
        )
        self.assertEqual(report_res.status_code, 201)
        incident_id = report_res.json()["id"]

        # 2. Worker marks in progress
        self.client.patch(
            f"/api/v1/incidents/{incident_id}/status",
            json={"status": "IN_PROGRESS", "assigned_worker_name": "Field Unit 04"}
        )

        # 3. Worker submits AFTER photo to resolve endpoint
        clean_img = self._create_clean_image()
        resolve_res = self.client.post(
            f"/api/v1/incidents/{incident_id}/resolve",
            data={"notes": "Cleared 300kg waste and disinfected ground."},
            files={"image": ("after_clean.jpg", clean_img, "image/jpeg")}
        )
        self.assertEqual(resolve_res.status_code, 200)
        res_data = resolve_res.json()

        self.assertEqual(res_data["status"], "VERIFIED")
        self.assertEqual(res_data["verification_status"], "VERIFIED")
        self.assertIsNotNone(res_data["after_image_url"])
        self.assertTrue(bool(res_data["verification_notes"]))
        self.assertIn("Cleared 300kg", res_data["verification_notes"])

if __name__ == "__main__":
    unittest.main()
