import unittest
import os
from pathlib import Path
from ml.prepare_dataset import generate_sample_dataset, DATA_DIR
from ml.infer import get_extent_score, CivicVisionInference, CLASS_MAPPING

class TestDay2MLPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Prepare sample dataset
        generate_sample_dataset()

    def test_dataset_structure_created(self):
        self.assertTrue((DATA_DIR / "images" / "train").exists())
        self.assertTrue((DATA_DIR / "images" / "val").exists())
        self.assertTrue((DATA_DIR / "labels" / "train").exists())
        self.assertTrue((DATA_DIR / "labels" / "val").exists())

    def test_samples_exist_and_valid(self):
        train_images = list((DATA_DIR / "images" / "train").glob("*.jpg"))
        train_labels = list((DATA_DIR / "labels" / "train").glob("*.txt"))
        self.assertGreaterEqual(len(train_images), 3)
        self.assertEqual(len(train_images), len(train_labels))

        # Check label format
        sample_label = train_labels[0].read_text().strip().split()
        class_id = int(sample_label[0])
        self.assertIn(class_id, [0, 1])
        # Coordinates should be pairs
        coords = [float(x) for x in sample_label[1:]]
        self.assertGreaterEqual(len(coords), 6)  # at least 3 points (x, y)

    def test_extent_score_formula(self):
        self.assertEqual(get_extent_score(5.0), 1)
        self.assertEqual(get_extent_score(15.0), 2)
        self.assertEqual(get_extent_score(35.0), 3)
        self.assertEqual(get_extent_score(60.0), 4)
        self.assertEqual(get_extent_score(85.0), 5)

    def test_class_mapping(self):
        self.assertEqual(CLASS_MAPPING[0], "GARBAGE_ACCUMULATION")
        self.assertEqual(CLASS_MAPPING[1], "SEWAGE_OVERFLOW")

if __name__ == "__main__":
    unittest.main()
