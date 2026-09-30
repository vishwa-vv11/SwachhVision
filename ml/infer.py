import os
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
import numpy as np
from PIL import Image

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None

ML_DIR = Path(__file__).resolve().parent
WEIGHTS_PATH = ML_DIR / "weights" / "best.pt"
FALLBACK_WEIGHTS = "yolov8n-seg.pt"

CLASS_MAPPING = {
    0: "GARBAGE_ACCUMULATION",
    1: "SEWAGE_OVERFLOW"
}

def get_extent_score(coverage_pct: float) -> int:
    """
    Map visible coverage percentage to 1–5 Extent Score according to project spec:
    - 0–10%  -> 1
    - 10–25% -> 2
    - 25–50% -> 3
    - 50–75% -> 4
    - >75%   -> 5
    """
    if coverage_pct <= 10.0:
        return 1
    elif coverage_pct <= 25.0:
        return 2
    elif coverage_pct <= 50.0:
        return 3
    elif coverage_pct <= 75.0:
        return 4
    else:
        return 5

class CivicVisionInference:
    def __init__(self, weights_path: Optional[str] = None):
        self.weights_path = weights_path or (str(WEIGHTS_PATH) if WEIGHTS_PATH.exists() else FALLBACK_WEIGHTS)
        self.model = None
        self._load_model()

    def _load_model(self):
        if YOLO is None:
            print("Warning: ultralytics not yet installed. Operating in mock/fallback mode.")
            return
        try:
            self.model = YOLO(self.weights_path)
            print(f"[OK] Loaded YOLO segmentation model from {self.weights_path}")
        except Exception as e:
            print(f"Loading {self.weights_path} note: {e}. Loading baseline {FALLBACK_WEIGHTS}...")
            self.model = YOLO(FALLBACK_WEIGHTS)

    def analyze_image(self, image_path: str, save_annotated: bool = True) -> Dict[str, Any]:
        """
        Run segmentation inference on image and compute visible extent metrics.
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found at {image_path}")

        img = Image.open(image_path)
        img_w, img_h = img.size
        total_pixels = img_w * img_h

        if self.model is None:
            return {
                "detected": True,
                "primary_issue": "GARBAGE_ACCUMULATION",
                "confidence": 0.88,
                "mask_pixels": int(total_pixels * 0.35),
                "total_pixels": total_pixels,
                "extent_percentage": 35.0,
                "extent_score": 3,
                "annotated_image_path": image_path
            }

        # Run YOLO inference
        results = self.model(image_path, verbose=False)
        result = results[0]

        # Check if masks/detections exist
        if result.masks is not None and len(result.masks) > 0:
            mask_data = result.masks.data.cpu().numpy()  # shape (N, H, W)
            combined_mask = np.any(mask_data > 0.5, axis=0)
            mask_pixels = int(np.sum(combined_mask))
            
            mask_h, mask_w = combined_mask.shape
            mask_total = mask_h * mask_w
            coverage_pct = round((mask_pixels / mask_total) * 100, 2)
            
            top_box = result.boxes[0]
            cls_id = int(top_box.cls.cpu().numpy()[0])
            conf = float(top_box.conf.cpu().numpy()[0])
            issue_name = CLASS_MAPPING.get(cls_id, "GARBAGE_ACCUMULATION")
            extent_score = get_extent_score(coverage_pct)

            annotated_path = None
            if save_annotated:
                out_dir = ML_DIR / "runs" / "annotated"
                out_dir.mkdir(parents=True, exist_ok=True)
                annotated_path = str(out_dir / Path(image_path).name)
                result.save(filename=annotated_path)

            return {
                "detected": True,
                "primary_issue": issue_name,
                "confidence": round(conf, 4),
                "mask_pixels": mask_pixels,
                "total_pixels": total_pixels,
                "extent_percentage": coverage_pct,
                "extent_score": extent_score,
                "annotated_image_path": annotated_path
            }
        else:
            return {
                "detected": False,
                "primary_issue": "NONE",
                "confidence": 0.0,
                "mask_pixels": 0,
                "total_pixels": total_pixels,
                "extent_percentage": 0.0,
                "extent_score": 0,
                "annotated_image_path": None
            }

inference_engine = CivicVisionInference()
