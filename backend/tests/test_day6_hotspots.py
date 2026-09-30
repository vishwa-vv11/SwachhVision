import unittest
import io
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.incident import Incident
from app.models.department import Department
from app.models.hotspot import Hotspot
from app.services.routing_service import routing_service
from app.services.hotspot_service import hotspot_service

class TestDay6RoutingAndHotspots(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_department_routing_logic(self):
        db = SessionLocal()
        try:
            # Garbage routing
            dept_garbage = routing_service.determine_department(
                db, "GARBAGE_ACCUMULATION", 12.9716, 77.5946
            )
            self.assertIsNotNone(dept_garbage)
            self.assertEqual(dept_garbage.category, "GARBAGE")

            # Sewage routing
            dept_sewage = routing_service.determine_department(
                db, "SEWAGE_OVERFLOW", 12.9716, 77.5946
            )
            self.assertIsNotNone(dept_sewage)
            self.assertEqual(dept_sewage.category, "SEWAGE")
        finally:
            db.close()

    def test_spatial_hotspot_clustering_algorithm(self):
        # Create simulated incident objects close to each other (Bangalore City Center)
        inc1 = Incident(id=101, issue_type="GARBAGE_ACCUMULATION", latitude=12.97160, longitude=77.59460)
        inc2 = Incident(id=102, issue_type="GARBAGE_ACCUMULATION", latitude=12.97165, longitude=77.59465) # ~8m away
        inc3 = Incident(id=103, issue_type="GARBAGE_ACCUMULATION", latitude=12.97170, longitude=77.59470) # ~15m away
        inc_isolated = Incident(id=104, issue_type="GARBAGE_ACCUMULATION", latitude=12.99000, longitude=77.62000) # ~3.5km away

        clusters = hotspot_service.cluster_incidents([inc1, inc2, inc3, inc_isolated], eps_meters=100.0)
        
        # Expect 1 cluster of 3 incidents; isolated one not clustered
        self.assertEqual(len(clusters), 1)
        self.assertEqual(len(clusters[0]), 3)
        clustered_ids = [inc.id for inc in clusters[0]]
        self.assertIn(101, clustered_ids)
        self.assertIn(102, clustered_ids)
        self.assertIn(103, clustered_ids)
        self.assertNotIn(104, clustered_ids)

    def test_risk_level_tiering(self):
        self.assertEqual(hotspot_service.calculate_risk_level(2), "LOW")
        self.assertEqual(hotspot_service.calculate_risk_level(5), "MODERATE")
        self.assertEqual(hotspot_service.calculate_risk_level(8), "HIGH")
        self.assertEqual(hotspot_service.calculate_risk_level(15), "SEVERE")

    def test_hotspot_api_endpoints(self):
        # Trigger refresh endpoint
        resp_refresh = self.client.post("/api/v1/hotspots/refresh?radius_meters=200.0")
        self.assertEqual(resp_refresh.status_code, 200)
        
        # Query list endpoint
        resp_list = self.client.get("/api/v1/hotspots/")
        self.assertEqual(resp_list.status_code, 200)
        hotspots = resp_list.json()
        self.assertIsInstance(hotspots, list)

if __name__ == "__main__":
    unittest.main()
