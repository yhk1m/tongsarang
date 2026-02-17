"""PNG 이미지를 JPEG로 변환하여 크기를 줄임 (시험 문제 이미지용)"""
import os
from pathlib import Path
from PIL import Image

IMAGES_DIR = Path(__file__).parent.parent / "public" / "images"
QUALITY = 85

def convert_subject(subject_dir):
    if not subject_dir.exists():
        return 0

    count = 0
    for png_file in sorted(subject_dir.glob("*.png")):
        jpg_file = png_file.with_suffix(".jpg")
        try:
            img = Image.open(png_file)
            # Convert RGBA to RGB (JPEG doesn't support alpha)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img.save(jpg_file, "JPEG", quality=QUALITY, optimize=True)
            # Remove original PNG
            png_file.unlink()
            count += 1
        except Exception as e:
            print(f"  Error: {png_file.name}: {e}")

    return count

subjects = ["한국지리", "세계지리", "통합사회"]
for subj in subjects:
    d = IMAGES_DIR / subj
    n = convert_subject(d)
    if n > 0:
        print(f"  {subj}: {n} images converted to JPEG")

print("Done")
