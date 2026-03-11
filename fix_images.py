#!/usr/bin/env python
"""Fix image issues for 한국지리 based on CSV error report."""

import csv
import os
import shutil
from PIL import Image
import numpy as np
from collections import defaultdict

BASE_DIR = r'C:/Users/김용현/Desktop/vibecoding/tongsarang'
IMAGE_DIR = os.path.join(BASE_DIR, 'public/images/한국지리')
CSV_PATH = os.path.join(BASE_DIR, '통사랑 png 수정사항 2.csv')
BACKUP_DIR = os.path.join(BASE_DIR, 'backup_images_한국지리')

BUNRYU_TO_MONTH = {
    '수능': '11', '9모': '09', '6모': '06',
    '10월학평': '10', '7월학평': '07', '7월학펼': '07',
    '5월학평': '05', '4월학평': '04', '3월학평': '03'
}


def get_filename(year, bunryu, num):
    month = BUNRYU_TO_MONTH.get(bunryu)
    if not month:
        return None
    return f"{year}_{month}_korgeo_{int(num):02d}.jpg"


def classify_error(error):
    """Classify an error string into a fix category."""
    error = error.strip().rstrip('.')

    if '우측 구분선' in error or '우측 회색 선' in error:
        return 'right_line'
    elif '좌측 구분선' in error:
        return 'left_line'
    elif '과목명 텍스트박스' in error:
        return 'right_subject_box'
    elif '여백이 너무 큼' in error:
        return 'bottom_whitespace'
    elif '페이지 번호' in error:
        return 'bottom_crop'
    elif '확인사항' in error:
        return 'bottom_crop'
    elif '다음 문제 발문' in error:
        return 'bottom_crop'
    elif '잘림' in error or '잘못 크롭' in error:
        return 'unfixable'
    else:
        return 'unknown'


def fix_right_line(img):
    """Remove thin vertical separator/gray line from right edge.

    Handles two patterns:
    1. Line at the very edge (0-2px white padding)
    2. Line with white padding to its right (up to 20px)
    """
    arr = np.array(img.convert('L'))
    h, w = arr.shape

    scan_width = min(30, w // 10)

    # Phase 1: skip pure white padding from right edge
    first_non_white = None
    for offset in range(scan_width):
        col = w - 1 - offset
        mean_val = np.mean(arr[:, col])
        if mean_val < 250:
            first_non_white = offset
            break

    if first_non_white is None:
        return img  # All white within scan range

    # Phase 2: check if non-white area is a separator line
    crop_x = w
    found_line = False

    for offset in range(first_non_white, scan_width):
        col = w - 1 - offset
        column = arr[:, col]
        dark_ratio = np.sum(column < 200) / h
        mean_val = np.mean(column)

        if dark_ratio > 0.15 or (mean_val < 240 and offset - first_non_white < 5):
            found_line = True
            crop_x = col
        elif found_line:
            break

    if found_line and crop_x < w:
        return img.crop((0, 0, crop_x, h))
    return img


def fix_left_line(img):
    """Remove thin vertical separator line from left edge."""
    arr = np.array(img.convert('L'))
    h, w = arr.shape

    scan_width = min(30, w // 10)

    # Phase 1: skip pure white padding from left edge
    first_non_white = None
    for offset in range(scan_width):
        col = offset
        mean_val = np.mean(arr[:, col])
        if mean_val < 250:
            first_non_white = offset
            break

    if first_non_white is None:
        return img

    # Phase 2: check if non-white area is a separator line
    crop_x = 0
    found_line = False

    for offset in range(first_non_white, scan_width):
        col = offset
        column = arr[:, col]
        dark_ratio = np.sum(column < 200) / h
        mean_val = np.mean(column)

        if dark_ratio > 0.15 or (mean_val < 240 and offset - first_non_white < 5):
            found_line = True
            crop_x = col + 1
        elif found_line:
            break

    if found_line and crop_x > 0:
        return img.crop((crop_x, 0, w, h))
    return img


def fix_right_subject_box(img):
    """Remove gray subject name text box from right side."""
    arr = np.array(img.convert('L'))
    h, w = arr.shape

    scan_width = min(100, w // 4)

    # Column-wise mean brightness in the right region
    right_region = arr[:, w - scan_width:]
    col_means = np.mean(right_region, axis=0)

    # Find where the gray area starts (scanning from right edge inward)
    gray_start_offset = None
    consecutive_gray = 0

    for i in range(scan_width - 1, -1, -1):
        if 130 < col_means[i] < 232:
            consecutive_gray += 1
            if consecutive_gray >= 15:
                gray_start_offset = i
        else:
            if consecutive_gray >= 15:
                break
            consecutive_gray = 0

    if gray_start_offset is not None:
        crop_x = w - scan_width + gray_start_offset
        return img.crop((0, 0, crop_x, h))

    return img


def fix_bottom_whitespace(img, margin=5):
    """Trim excessive whitespace from bottom."""
    arr = np.array(img.convert('L'))
    h, w = arr.shape

    for row in range(h - 1, h // 2, -1):
        if np.mean(arr[row, :]) < 245 or np.sum(arr[row, :] < 200) > max(w * 0.005, 2):
            new_h = min(row + margin + 1, h)
            if h - new_h > 15:  # Only crop if removing > 15 rows
                return img.crop((0, 0, w, new_h))
            return img

    return img


def fix_bottom_content(img):
    """Remove trailing content from bottom (page number, notice, next question).

    Finds the significant whitespace gap between main content and trailing content,
    crops at the top of the gap.
    """
    arr = np.array(img.convert('L'))
    h, w = arr.shape

    # Ignore leftmost/rightmost 35px to exclude border lines from content detection
    margin = min(35, w // 20)
    content_threshold = max(w * 0.003, 2)
    is_content = np.array([np.sum(arr[r, margin:w-margin] < 235) > content_threshold for r in range(h)])

    # Find all significant gaps (>= 6 rows) in the bottom 50%
    min_gap = 6
    search_start = h // 2
    gaps = []

    i = search_start
    while i < h:
        if not is_content[i]:
            start = i
            while i < h and not is_content[i]:
                i += 1
            gap_size = i - start
            if gap_size >= min_gap:
                gaps.append((start, i - 1, gap_size))
        else:
            i += 1

    if not gaps:
        return img

    # From the bottom, find the first gap where trailing content is small
    for start, end, size in reversed(gaps):
        trailing_content_rows = int(np.sum(is_content[end + 1:]))

        if trailing_content_rows < h * 0.2:
            # Verify there's substantial content above
            content_above = int(np.sum(is_content[:start]))
            if content_above > h * 0.2:
                crop_y = start + min(3, size)
                return img.crop((0, 0, w, crop_y))

    return img


def process_image(filepath, fix_categories, backup_dir):
    """Process a single image with the given fix categories."""
    try:
        img = Image.open(filepath)
    except Exception as e:
        return f"ERROR opening: {e}"

    original_size = img.size
    changes = []

    # Apply fixes in order: edge fixes first, then bottom fixes

    if 'right_subject_box' in fix_categories:
        new_img = fix_right_subject_box(img)
        if new_img.size != img.size:
            img = new_img
            changes.append(f"right subject box (-{original_size[0] - img.size[0]}px)")

    if 'right_line' in fix_categories:
        old_w = img.size[0]
        new_img = fix_right_line(img)
        if new_img.size[0] != old_w:
            img = new_img
            changes.append(f"right line (-{old_w - img.size[0]}px)")

    if 'left_line' in fix_categories:
        old_w = img.size[0]
        new_img = fix_left_line(img)
        if new_img.size[0] != old_w:
            img = new_img
            changes.append(f"left line (-{old_w - img.size[0]}px)")

    if 'bottom_crop' in fix_categories:
        old_h = img.size[1]
        new_img = fix_bottom_content(img)
        if new_img.size[1] != old_h:
            img = new_img
            changes.append(f"bottom content (-{old_h - img.size[1]}px)")

    if 'bottom_whitespace' in fix_categories:
        old_h = img.size[1]
        new_img = fix_bottom_whitespace(img)
        if new_img.size[1] != old_h:
            img = new_img
            changes.append(f"bottom whitespace (-{old_h - img.size[1]}px)")
        else:
            # Fallback: try bottom content removal (whitespace might include trailing text)
            new_img = fix_bottom_content(img)
            if new_img.size[1] != old_h:
                img = new_img
                changes.append(f"bottom content fallback (-{old_h - img.size[1]}px)")

    if changes:
        # Backup original
        os.makedirs(backup_dir, exist_ok=True)
        backup_path = os.path.join(backup_dir, os.path.basename(filepath))
        if not os.path.exists(backup_path):
            shutil.copy2(filepath, backup_path)

        # Save fixed image
        img.save(filepath, 'JPEG', quality=95)
        return f"FIXED [{img.size[0]}x{img.size[1]}]: {', '.join(changes)}"

    return "NO CHANGE"


def main():
    # Parse CSV
    entries = []
    with open(CSV_PATH, encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            entries.append(row)

    # Group by filename, classify errors
    file_fixes = defaultdict(set)
    file_errors = defaultdict(list)
    unfixable = []

    for entry in entries:
        year = entry['학년도']
        bunryu = entry['분류']
        num = entry['문항번호']
        error = entry['오류사항'].strip()

        filename = get_filename(year, bunryu, num)
        if not filename:
            print(f"WARNING: Unknown bunryu '{bunryu}'")
            continue

        category = classify_error(error)
        filepath = os.path.join(IMAGE_DIR, filename)

        if category == 'unfixable':
            unfixable.append((filename, error))
        elif category == 'unknown':
            print(f"WARNING: Unknown error type: '{error}' for {filename}")
        else:
            file_fixes[filepath].add(category)
            file_errors[filepath].append(error)

    # Process fixable images
    print(f"Processing {len(file_fixes)} images with fixable errors...\n")

    fixed = 0
    no_change = 0
    errors = 0

    for filepath in sorted(file_fixes.keys()):
        filename = os.path.basename(filepath)
        categories = file_fixes[filepath]

        if not os.path.exists(filepath):
            print(f"  MISSING: {filename}")
            errors += 1
            continue

        result = process_image(filepath, categories, BACKUP_DIR)

        if result.startswith("FIXED"):
            print(f"  OK {filename}: {result}")
            fixed += 1
        elif result == "NO CHANGE":
            print(f"  SKIP {filename}: ({', '.join(file_errors[filepath])})")
            no_change += 1
        else:
            print(f"  ERR {filename}: {result}")
            errors += 1

    print(f"\n=== Summary ===")
    print(f"Fixed: {fixed}, Skipped: {no_change}, Errors: {errors}")

    if unfixable:
        print(f"\n=== Unfixable ({len(unfixable)}) - need re-extraction from original PDF ===")
        for fn, err in unfixable:
            print(f"  {fn}: {err}")


if __name__ == '__main__':
    main()
