import unittest
from pathlib import Path
from app.services.cv_service import calculate_extent_score, cv_service, CLASS_MAPPING

class TestDay3ExtentService(unittest.TestCase):
    def test_extent_score_formula_tiers(self):
        # Tier 1 (0–10%): Minimal
        score, label = calculate_extent_score(0.0)
        self.assertEqual(score, 1)
        self.assertEqual(label, "MINIMAL")
        score, label = calculate_extent_score(9.9)
        self.assertEqual(score, 1)

        # Tier 2 (10–25%): Minor
        score, label = calculate_extent_score(10.1)
        self.assertEqual(score, 2)
        self.assertEqual(label, "MINOR")
        score, label = calculate_extent_score(25.0)
        self.assertEqual(score, 2)

        # Tier 3 (25–50%): Moderate
        score, label = calculate_extent_score(25.1)
        self.assertEqual(score, 3)
        self.assertEqual(label, "MODERATE")
        score, label = calculate_extent_score(50.0)
        self.assertEqual(score, 3)

        # Tier 4 (50–75%): Large
        score, label = calculate_extent_score(50.1)
        self.assertEqual(score, 4)
        self.assertEqual(label, "LARGE")
        score, label = calculate_extent_score(75.0)
        self.assertEqual(score, 4)

        # Tier 5 (>75%): Critical / Massive
        score, label = calculate_extent_score(75.1)
        self.assertEqual(score, 5)
        self.assertEqual(label, "CRITICAL/MASSIVE")
        score, label = calculate_extent_score(99.0)
        self.assertEqual(score, 5)

    def test_cv_service_analysis(self):
        test_img = Path(__file__).resolve().parent.parent.parent / "ml" / "test_images" / "tier3_moderate.jpg"
        self.assertTrue(test_img.exists(), "Benchmark image must exist")

        result = cv_service.analyze_image_file(str(test_img))
        self.assertIn("detected", result)
        self.assertIn("primary_issue", result)
        self.assertIn("extent_score", result)
        self.assertIn("extent_percentage", result)
        self.assertIn("total_pixels", result)
        self.assertEqual(result["total_pixels"], 640 * 640)

    def test_class_mappings(self):
        self.assertEqual(CLASS_MAPPING[0], "GARBAGE_ACCUMULATION")
        self.assertEqual(CLASS_MAPPING[1], "GARBAGE_ACCUMULATION")

if __name__ == "__main__":
    unittest.main()
