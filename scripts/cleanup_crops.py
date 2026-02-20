"""
Post-processing script to clean up cropped exam question images.

Fixes three types of artifacts:
1. Right-side vertical dividing lines (PDF column separators)
2. Page number boxes at bottom corners
3. "확인 사항" footer sections, copyright text at bottom

Usage:
  python scripts/cleanup_crops.py                          # Dry run
  python scripts/cleanup_crops.py --apply                  # Apply to all
  python scripts/cleanup_crops.py --apply --subject 세계지리  # Single subject
"""

from PIL import Image
import numpy as np
import os
import sys
import argparse

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.join(os.path.expanduser('~'), 'Desktop', 'vibecoding', 'tongsarang', 'public', 'images')


def _longest_run(bool_arr):
    max_run = 0
    current = 0
    for val in bool_arr:
        if val:
            current += 1
            if current > max_run:
                max_run = current
        else:
            current = 0
    return max_run


def detect_right_vertical_line(gray_arr):
    """
    Detect thin vertical dividing line near the right edge.
    Returns the new right x boundary, or None.
    """
    h, w = gray_arr.shape
    if w < 100 or h < 100:
        return None

    search_start = max(0, w - int(w * 0.06))

    for col in range(w - 1, search_start, -1):
        dark_ratio = np.sum(gray_arr[:, col] < 150) / h

        if dark_ratio >= 0.40:
            line_left = col
            line_right = col

            while line_left > search_start:
                if np.sum(gray_arr[:, line_left - 1] < 150) / h >= 0.25:
                    line_left -= 1
                else:
                    break

            while line_right < w - 1:
                if np.sum(gray_arr[:, line_right + 1] < 150) / h >= 0.25:
                    line_right += 1
                else:
                    break

            line_width = line_right - line_left + 1

            if line_width <= 10:
                center_col = (line_left + line_right) // 2
                max_run = _longest_run(gray_arr[:, center_col] < 150)

                if max_run >= h * 0.75:
                    if line_right + 1 < w:
                        right_area = gray_arr[:, line_right + 1:]
                        # Check area is blank: either mostly white (PNG)
                        # or has no dark text content (JPEG with artifacts)
                        is_white = np.mean(right_area > 220) > 0.80
                        has_no_text = np.mean(right_area < 150) < 0.05
                        if is_white or has_no_text:
                            return max(0, line_left - 2)
                    else:
                        return max(0, line_left - 2)
            break

    return None


def _compute_row_density(gray_arr, exclude_edge_pct=0.10):
    h, w = gray_arr.shape
    x_start = int(w * exclude_edge_pct)
    x_end = int(w * (1 - exclude_edge_pct))
    if x_end <= x_start + 10:
        x_start, x_end = 0, w
    region = gray_arr[:, x_start:x_end]
    return np.sum(region < 200, axis=1).astype(float) / region.shape[1]


def detect_bottom_artifact(gray_arr):
    """
    Detect bottom artifacts using three strategies:

    Strategy 1 (확인 사항 box):
      Narrow density spikes (≤5 rows, density > 0.30) = box border lines.
      Must be preceded by a gap, followed by mostly empty box interior.

    Strategy 2 (page footer sections):
      Very large gaps (≥100 rows) in the bottom 30% followed by sparse
      content (page number + copyright text).

    Strategy 3 (corner page number box):
      Small isolated content block at the very bottom, narrow (<20% width),
      located in a corner (left 40% or right 60%), with gap ≥20 rows above.
    """
    h, w = gray_arr.shape
    if h < 200:
        return None

    row_dark = _compute_row_density(gray_arr)

    # ── Strategy 1: 확인 사항 box border detection ─────────────────
    search_s1 = int(h * 0.70)
    y = search_s1

    while y < h:
        if row_dark[y] > 0.30:
            spike_start = y
            spike_end = y

            while spike_start > search_s1 and row_dark[spike_start - 1] > 0.20:
                spike_start -= 1
            while spike_end < h - 1 and row_dark[spike_end + 1] > 0.20:
                spike_end += 1

            spike_width = spike_end - spike_start + 1

            if spike_width <= 5:
                # Spike must span most of image width (box borders are full-width)
                spike_row = gray_arr[(spike_start + spike_end) // 2, :]
                spike_dark_cols = int(np.sum(spike_row < 200))
                if spike_dark_cols < w * 0.70:
                    y = spike_end + 1
                    continue

                gy = spike_start - 1
                while gy >= search_s1 and row_dark[gy] < 0.01:
                    gy -= 1
                gap_size = spike_start - gy - 1

                if gap_size >= 2:
                    above = row_dark[max(0, gy - 80):gy + 1]
                    if np.sum(above > 0.01) >= 5:
                        below_win = row_dark[spike_end + 1:min(h, spike_end + 150)]
                        far_below = row_dark[min(h, spike_end + 150):min(h, spike_end + 300)]

                        if len(below_win) > 0:
                            empty_ratio = np.sum(below_win < 0.01) / len(below_win)
                            far_content = int(np.sum(far_below > 0.01)) if len(far_below) > 0 else 0

                            # Box bottom border: very empty below, but content further down
                            if empty_ratio > 0.80 and far_content > 5:
                                return gy + 3
                            # Box top border: some content inside box, very large gap above
                            if empty_ratio < 0.80 and gap_size >= 100:
                                return gy + 3

            y = spike_end + 1
            continue

        y += 1

    # ── Strategy 2: Large gap + sparse content (page footers) ─────
    search_s2 = int(h * 0.70)

    gaps = []
    in_gap = False
    gap_begin = 0

    for y2 in range(search_s2, h):
        if row_dark[y2] < 0.003:
            if not in_gap:
                gap_begin = y2
                in_gap = True
        else:
            if in_gap:
                if y2 - gap_begin >= 100:
                    gaps.append((gap_begin, y2))
                in_gap = False

    for g_start, g_end in gaps:
        above = row_dark[max(0, g_start - 100):g_start]
        if np.sum(above > 0.01) < 5:
            continue

        below = row_dark[g_end:]
        content_rows_below = int(np.sum(below > 0.005))
        remaining_rows = h - g_end

        if content_rows_below < 4:
            continue

        if content_rows_below < 50:
            total_ink_below = float(np.sum(below))
            total_ink_above = float(np.sum(row_dark[:g_start]))
            if total_ink_above > 0 and total_ink_below / total_ink_above < 0.10:
                return g_start + 3

    # ── Strategy 3: Corner page number box ──────────────────────
    check_h = min(140, int(h * 0.12))
    bottom_start = h - check_h
    full_row_dark = np.sum(gray_arr < 200, axis=1).astype(float) / w

    content_end = None
    content_start = None
    gap_above_start = None

    for y3 in range(h - 1, bottom_start - 1, -1):
        if full_row_dark[y3] > 0.003:
            if content_end is None:
                content_end = y3
            content_start = y3
        elif content_end is not None:
            gap_count = 0
            for gy in range(y3, max(bottom_start - 1, y3 - 60), -1):
                if full_row_dark[gy] < 0.003:
                    gap_count += 1
                else:
                    break
            if gap_count >= 20:
                gap_above_start = y3 - gap_count + 1
                break
            content_start = y3

    if content_end is not None and content_start is not None and gap_above_start is not None:
        block_region = gray_arr[content_start:content_end + 1, :]
        col_has = np.any(block_region < 200, axis=0)
        dark_cols = np.where(col_has)[0]

        if len(dark_cols) > 0:
            content_width = dark_cols[-1] - dark_cols[0] + 1
            is_narrow = content_width < w * 0.20
            is_right_corner = dark_cols[0] > w * 0.60
            is_left_corner = dark_cols[-1] < w * 0.40

            if is_narrow and (is_left_corner or is_right_corner):
                return gap_above_start + 3

    # ── Strategy 4: Bottom-edge page number (small gap) ──────────
    # Handles page numbers right below answer text with minimal gap.
    # Only triggers when the page number block is clearly isolated.
    check_h4 = min(80, int(h * 0.08))
    bottom_region = gray_arr[h - check_h4:, :]
    bh, bw = bottom_region.shape
    row_has_dark = np.any(bottom_region < 150, axis=1)

    last_content = -1
    first_content = bh
    for r in range(bh - 1, -1, -1):
        if row_has_dark[r]:
            if last_content == -1:
                last_content = r
            first_content = r

    if last_content >= 0 and first_content < last_content:
        block_h = last_content - first_content + 1
        if block_h <= 50:
            block = bottom_region[first_content:last_content + 1, :]
            col_has = np.any(block < 150, axis=0)
            dark_cols = np.where(col_has)[0]
            if len(dark_cols) > 0:
                cw = dark_cols[-1] - dark_cols[0] + 1
                is_narrow = cw < bw * 0.15
                is_left = dark_cols[-1] < bw * 0.30
                is_right = dark_cols[0] > bw * 0.70
                if is_narrow and (is_left or is_right):
                    abs_first = h - check_h4 + first_content
                    gap = 0
                    for gy in range(abs_first - 1, max(0, abs_first - 30), -1):
                        if np.sum(gray_arr[gy, :] < 150) < 5:
                            gap += 1
                        else:
                            break
                    if gap >= 3:
                        return abs_first - 1

    return None


def process_image(filepath, dry_run=True):
    try:
        img = Image.open(filepath)
        gray = np.array(img.convert('L'))
        h, w = gray.shape

        fixes = []
        crop_right = w
        crop_bottom = h

        new_right = detect_right_vertical_line(gray)
        if new_right is not None and new_right < w - 5:
            crop_right = new_right
            fixes.append(f"right_line({w}->{new_right})")

        new_bottom = detect_bottom_artifact(gray)
        if new_bottom is not None and new_bottom < h - 15:
            crop_bottom = new_bottom
            fixes.append(f"bottom({h}->{new_bottom})")

        if not fixes:
            return None

        if not dry_run:
            cropped = img.crop((0, 0, crop_right, crop_bottom))

            gray_c = np.array(cropped.convert('L'))
            col_content = np.any(gray_c < 240, axis=0)
            row_content = np.any(gray_c < 240, axis=1)
            cc = np.where(col_content)[0]
            rc = np.where(row_content)[0]

            if len(cc) > 0 and len(rc) > 0:
                final = cropped.crop((
                    max(0, cc[0] - 5),
                    max(0, rc[0] - 5),
                    min(cropped.width, cc[-1] + 1 + 5),
                    min(cropped.height, rc[-1] + 1 + 5),
                ))
            else:
                final = cropped

            ext = os.path.splitext(filepath)[1].lower()
            if ext in ['.jpg', '.jpeg']:
                final.save(filepath, 'JPEG', quality=95)
            else:
                final.save(filepath, 'PNG')

        return fixes

    except Exception as e:
        print(f"  ERROR: {filepath}: {e}")
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--subject', type=str)
    args = parser.parse_args()

    dry_run = not args.apply
    print(f"=== {'DRY RUN' if dry_run else 'APPLYING FIXES'} ===\n")

    subjects = sorted(d for d in os.listdir(BASE_DIR) if os.path.isdir(os.path.join(BASE_DIR, d)))
    if args.subject:
        subjects = [s for s in subjects if s == args.subject]
        if not subjects:
            print(f"Subject '{args.subject}' not found.")
            return

    total_processed = 0
    total_fixed = 0
    counts = {'right_line': 0, 'bottom': 0}

    for subject in subjects:
        subject_dir = os.path.join(BASE_DIR, subject)
        files = sorted(f for f in os.listdir(subject_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png')))

        print(f"{'='*55}")
        print(f" {subject} ({len(files)} images)")
        print(f"{'='*55}")

        subject_fixed = 0
        for filename in files:
            filepath = os.path.join(subject_dir, filename)
            result = process_image(filepath, dry_run=dry_run)
            total_processed += 1

            if result:
                subject_fixed += 1
                total_fixed += 1
                action = "WOULD FIX" if dry_run else "FIXED"
                print(f"  {action}: {filename} -> {', '.join(result)}")
                for fix in result:
                    for key in counts:
                        if fix.startswith(key):
                            counts[key] += 1

        print(f"  >> {subject_fixed}/{len(files)} {'need fixes' if dry_run else 'fixed'}\n")

    print(f"\n{'='*55}")
    print(f" SUMMARY: {total_fixed}/{total_processed} {'need fixes' if dry_run else 'fixed'}")
    print(f"   Right vertical line: {counts['right_line']}")
    print(f"   Bottom artifact:     {counts['bottom']}")
    if dry_run and total_fixed > 0:
        print(f"\nRun with --apply to save changes.")


if __name__ == '__main__':
    main()
