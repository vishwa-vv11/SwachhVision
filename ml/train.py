import os
from pathlib import Path
from ultralytics import YOLO

ML_DIR = Path(__file__).resolve().parent
DATASET_YAML = ML_DIR / "dataset.yaml"
WEIGHTS_DIR = ML_DIR / "weights"

def train_segmentation_model(epochs: int = 3, img_size: int = 640):
    """
    Train / Fine-tune YOLOv8 segmentation model on SwachhVision dataset.
    """
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Starting YOLO segmentation training with {epochs} epochs...")

    # Initialize YOLOv8 segmentation baseline model
    model = YOLO("yolov8n-seg.pt")

    # Train model
    results = model.train(
        data=str(DATASET_YAML),
        epochs=epochs,
        imgsz=img_size,
        plots=False,
        project=str(ML_DIR / "runs"),
        name="swachhvision_seg",
        exist_ok=True
    )

    # Save best weights
    best_pt_src = ML_DIR / "runs" / "swachhvision_seg" / "weights" / "best.pt"
    best_pt_dest = WEIGHTS_DIR / "best.pt"
    
    if best_pt_src.exists():
        import shutil
        shutil.copy(best_pt_src, best_pt_dest)
        print(f"[OK] Successfully exported best weights to {best_pt_dest}")
    else:
        # Fallback to model save
        model.save(str(best_pt_dest))
        print(f"[OK] Saved baseline segmentation weights to {best_pt_dest}")

    return results

if __name__ == "__main__":
    train_segmentation_model(epochs=3)
