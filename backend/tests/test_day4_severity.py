import unittest
from app.services.severity_engine import severity_engine, SeverityScoringEngine
from app.services.geo_service import geo_service, haversine_distance_meters, REFERENCE_SENSITIVE_POIS

class TestDay4SeverityEngine(unittest.TestCase):
    def test_documented_example_calculation(self):
        """
        Test exact example from project documentation:
        Garbage coverage 60% -> Extent 4/5
        Location near drainage -> Impact 5/5
        Expected: (4/5 * 60) + (5/5 * 40) = 48 + 40 = 88 -> CRITICAL
        """
        res = severity_engine.compute_severity(extent_score=4, location_impact_score=5, location_reason="Near drain")
        self.assertEqual(res["severity_score"], 88.0)
        self.assertEqual(res["severity_tier"], "CRITICAL")
        self.assertEqual(res["extent_contribution"], 48.0)
        self.assertEqual(res["location_contribution"], 40.0)

    def test_all_severity_tiers(self):
        # LOW Tier (<= 25)
        res_low = severity_engine.compute_severity(extent_score=1, location_impact_score=1)
        # (1/5 * 60) + (1/5 * 40) = 12 + 8 = 20
        self.assertEqual(res_low["severity_score"], 20.0)
        self.assertEqual(res_low["severity_tier"], "LOW")

        # MEDIUM Tier (26–50)
        res_med = severity_engine.compute_severity(extent_score=2, location_impact_score=2)
        # (2/5 * 60) + (2/5 * 40) = 24 + 16 = 40
        self.assertEqual(res_med["severity_score"], 40.0)
        self.assertEqual(res_med["severity_tier"], "MEDIUM")

        # HIGH Tier (51–75)
        res_high = severity_engine.compute_severity(extent_score=3, location_impact_score=4)
        # (3/5 * 60) + (4/5 * 40) = 36 + 32 = 68
        self.assertEqual(res_high["severity_score"], 68.0)
        self.assertEqual(res_high["severity_tier"], "HIGH")

        # CRITICAL Tier (76–100)
        res_crit = severity_engine.compute_severity(extent_score=5, location_impact_score=5)
        # (5/5 * 60) + (5/5 * 40) = 60 + 40 = 100
        self.assertEqual(res_crit["severity_score"], 100.0)
        self.assertEqual(res_crit["severity_tier"], "CRITICAL")

    def test_haversine_distance(self):
        # Distance between identical points is 0
        d = haversine_distance_meters(12.9716, 77.5946, 12.9716, 77.5946)
        self.assertAlmostEqual(d, 0.0, places=1)

        # Distance between Bangalore coordinates ~400m
        d2 = haversine_distance_meters(12.9716, 77.5946, 12.9750, 77.5946)
        self.assertGreater(d2, 300)
        self.assertLess(d2, 500)

    def test_location_impact_poi_proximity(self):
        # Directly at Central Drainage Canal (impact 5)
        drain_lat, drain_lon = 12.9716, 77.5946
        score, reason = geo_service.analyze_location_impact(drain_lat, drain_lon)
        self.assertEqual(score, 5)
        self.assertIn("Drainage", reason)

        # Directly at Hospital (impact 4)
        hosp_lat, hosp_lon = 12.9750, 77.5990
        score2, reason2 = geo_service.analyze_location_impact(hosp_lat, hosp_lon)
        self.assertEqual(score2, 4)
        self.assertIn("Hospital", reason2)

    def test_reverse_geocoding(self):
        address = geo_service.reverse_geocode(12.9716, 77.5946)
        self.assertIsInstance(address, str)
        self.assertTrue(len(address) > 0)

if __name__ == "__main__":
    unittest.main()
