import os
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np

DATA_DIR = Path(__file__).resolve().parent / "data"

def create_directories():
    """Create YOLO segmentation dataset folder structure."""
    dirs = [
        DATA_DIR / "images" / "train",
        DATA_DIR / "images" / "val",
        DATA_DIR / "labels" / "train",
        DATA_DIR / "labels" / "val",
    ]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
    print(f"[OK] Created dataset directories at {DATA_DIR}")

def generate_sample_dataset():
    """
    Generate initial benchmark images & YOLO polygon segmentation labels
    for Class 0 (Garbage Accumulation) and Class 1 (Sewage / Wastewater Overflow).
    """
    create_directories()
    
    # Define sample images to generate for training and validation
    samples = [
        # Train samples - Garbage Accumulation (Class 0)
        {"split": "train", "name": "garbage_01", "class_id": 0, "color": (120, 90, 60), "points": [(0.2, 0.4), (0.8, 0.35), (0.85, 0.85), (0.15, 0.8)]},
        {"split": "train", "name": "garbage_02", "class_id": 0, "color": (140, 100, 70), "points": [(0.3, 0.3), (0.7, 0.25), (0.75, 0.75), (0.25, 0.7)]},
        {"split": "train", "name": "garbage_03", "class_id": 0, "color": (100, 80, 50), "points": [(0.1, 0.5), (0.9, 0.45), (0.85, 0.95), (0.05, 0.9)]},
        
        # Train samples - Sewage Overflow (Class 1)
        {"split": "train", "name": "sewage_01", "class_id": 1, "color": (30, 80, 120), "points": [(0.15, 0.3), (0.85, 0.35), (0.9, 0.8), (0.1, 0.75)]},
        {"split": "train", "name": "sewage_02", "class_id": 1, "color": (25, 70, 110), "points": [(0.25, 0.2), (0.75, 0.25), (0.8, 0.85), (0.2, 0.8)]},
        
        # Val samples - Garbage & Sewage
        {"split": "val", "name": "garbage_val_01", "class_id": 0, "color": (130, 95, 65), "points": [(0.25, 0.35), (0.75, 0.3), (0.8, 0.8), (0.2, 0.75)]},
        {"split": "val", "name": "sewage_val_01", "class_id": 1, "color": (35, 85, 125), "points": [(0.2, 0.25), (0.8, 0.3), (0.85, 0.75), (0.15, 0.7)]},
    ]
    
    img_size = (640, 640)

    for item in samples:
        split = item["split"]
        name = item["name"]
        class_id = item["class_id"]
        color = item["color"]
        points = item["points"]
        
        # Create base realistic background (road/pavement)
        img = Image.new("RGB", img_size, color=(160, 160, 160))
        draw = ImageDraw.Draw(img)
        
        # Draw background texture (curb, road lines)
        draw.line([(0, 200), (640, 200)], fill=(200, 200, 200), width=3)
        draw.line([(0, 440), (640, 440)], fill=(130, 130, 130), width=4)
        
        # Convert normalized polygon points to pixel coordinates
        pixel_points = [(int(p[0] * img_size[0]), int(p[1] * img_size[1])) for p in points]
        
        # Draw the civic issue polygon
        draw.polygon(pixel_points, fill=color, outline=(255, 0, 0) if class_id == 0 else (0, 200, 255))
        
        # Save image
        img_path = DATA_DIR / "images" / split / f"{name}.jpg"
        img.save(img_path)
        
        # Format YOLO segmentation label line: <class-index> <x1> <y1> <x2> <y2> ... <xn> <yn>
        poly_str = " ".join([f"{p[0]:.4f} {p[1]:.4f}" for p in points])
        label_line = f"{class_id} {poly_str}\n"
        
        # Save label
        label_path = DATA_DIR / "labels" / split / f"{name}.txt"
        with open(label_path, "w") as f:
            f.write(label_line)
            
    print(f"[OK] Generated {len(samples)} benchmark training and validation samples with polygon segmentation labels.")

if __name__ == "__main__":
    generate_sample_dataset()
