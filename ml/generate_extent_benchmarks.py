import os
from pathlib import Path
from PIL import Image, ImageDraw

BENCHMARK_DIR = Path(__file__).resolve().parent / "test_images"

def generate_extent_benchmarks():
    """
    Generate benchmark test images representing the 5 project extent tiers:
    - Tier 1: ~6% coverage (Minimal)
    - Tier 2: ~18% coverage (Minor)
    - Tier 3: ~36% coverage (Moderate)
    - Tier 4: ~62% coverage (Large)
    - Tier 5: ~82% coverage (Critical/Massive)
    - Clean: 0% coverage (Baseline)
    """
    BENCHMARK_DIR.mkdir(parents=True, exist_ok=True)
    img_size = (640, 640)
    total_area = 640 * 640

    tiers = [
        {"name": "clean_road.jpg", "rect": None, "color": None, "target_tier": 0},
        {"name": "tier1_minimal.jpg", "rect": (280, 280, 360, 360), "color": (120, 80, 50), "target_tier": 1},
        {"name": "tier2_minor.jpg", "rect": (200, 200, 440, 440), "color": (130, 85, 55), "target_tier": 2},
        {"name": "tier3_moderate.jpg", "rect": (140, 140, 500, 500), "color": (140, 90, 60), "target_tier": 3},
        {"name": "tier4_large.jpg", "rect": (70, 70, 570, 570), "color": (150, 95, 65), "target_tier": 4},
        {"name": "tier5_critical.jpg", "rect": (20, 20, 620, 620), "color": (160, 100, 70), "target_tier": 5},
    ]

    for item in tiers:
        img = Image.new("RGB", img_size, color=(170, 170, 170))
        draw = ImageDraw.Draw(img)
        # Background pavement markings
        draw.line([(0, 150), (640, 150)], fill=(210, 210, 210), width=2)
        draw.line([(0, 490), (640, 490)], fill=(140, 140, 140), width=3)

        if item["rect"]:
            draw.rectangle(item["rect"], fill=item["color"], outline=(255, 50, 50), width=2)

        file_path = BENCHMARK_DIR / item["name"]
        img.save(file_path)

    print(f"[OK] Generated {len(tiers)} extent benchmark test images in {BENCHMARK_DIR}")

if __name__ == "__main__":
    generate_extent_benchmarks()
