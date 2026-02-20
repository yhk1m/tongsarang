"""
Fix bottom-cutoff issue in exam question images.

Problem: Original crop_questions.py uses ⑤ position as bottom boundary,
which cuts off maps extending below ⑤ and second lines of answer ⑤.

Fix: Use the next question number's y position (same column) as bottom boundary,
then trim bottom whitespace.
"""
import fitz
import os
import sys
import re
from pdf2image import convert_from_path
from PIL import Image
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

HOME = os.path.expanduser('~')
POPPLER_BIN = os.path.join(HOME, 'poppler', 'poppler-24.08.0', 'Library', 'bin')
PROJECT_DIR = os.path.join(HOME, 'Desktop', 'vibecoding', 'tongsarang')
DPI = 300
PADDING_TOP = 4
PADDING_LEFT = 10
TRIM_MARGIN = 10
PADDING_RIGHT = 30  # 오른쪽 여백 (과목 헤더 텍스트 제외용)
GAP_BETWEEN = 20
SIZE_TOLERANCE = 0.5
# Bottom padding: from next question boundary, step back a few pts
BOTTOM_GAP_FROM_NEXT_Q = 8  # pts gap before next question starts


def pdf_to_pixel(val, page_dim_pdf, page_dim_px):
    return int(val * page_dim_px / page_dim_pdf)


def detect_qnum_in_span(span, line_spans):
    text = span['text'].strip()
    if len(text) <= 3 and text.endswith('.') and text[:-1].isdigit():
        num = int(text[:-1])
        if 1 <= num <= 25:
            return num
    if len(text) <= 2 and text.isdecimal() and 1 <= int(text) <= 25:
        span_idx = line_spans.index(span)
        if span_idx + 1 < len(line_spans):
            next_text = line_spans[span_idx + 1]['text']
            if next_text.startswith('.'):
                return int(text)
    return None


def trim_horizontal(img):
    arr = np.array(img.convert('L'))
    col_has_content = np.any(arr < 240, axis=0)
    content_cols = np.where(col_has_content)[0]
    if len(content_cols) == 0:
        return img
    left = max(0, content_cols[0] - TRIM_MARGIN)
    right = min(img.width, content_cols[-1] + 1 + TRIM_MARGIN)
    return img.crop((left, 0, right, img.height))


def trim_bottom_whitespace(img, min_content_threshold=240, margin=15):
    """Trim whitespace from the bottom of the image."""
    arr = np.array(img.convert('L'))
    row_has_content = np.any(arr < min_content_threshold, axis=1)
    content_rows = np.where(row_has_content)[0]
    if len(content_rows) == 0:
        return img
    bottom = min(img.height, content_rows[-1] + 1 + margin)
    return img.crop((0, 0, img.width, bottom))


def detect_qnum_font_size(doc):
    from collections import Counter
    size_counter = Counter()
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        blocks = page.get_text('dict')['blocks']
        for block in blocks:
            if 'lines' not in block:
                continue
            for line in block['lines']:
                for span in line['spans']:
                    qnum = detect_qnum_in_span(span, line['spans'])
                    if qnum is not None:
                        size_counter[round(span['size'], 1)] += 1
    if not size_counter:
        return None
    sizes = sorted(size_counter.keys(), reverse=True)
    grouped = []
    used = set()
    for s in sizes:
        if s in used:
            continue
        nearby = [s2 for s2 in sizes if abs(s2 - s) <= SIZE_TOLERANCE and s2 not in used]
        total = sum(size_counter[s2] for s2 in nearby)
        rep = max(nearby, key=lambda s2: size_counter[s2])
        grouped.append((rep, total))
        used.update(nearby)
    grouped.sort(key=lambda x: (-x[0]))
    for rep, count in grouped:
        if count >= 10:
            return rep
    return max(grouped, key=lambda x: x[1])[0]


def find_midpoint_x(doc, qnum_size):
    x_positions = []
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        blocks = page.get_text('dict')['blocks']
        for block in blocks:
            if 'lines' not in block:
                continue
            for line in block['lines']:
                for span in line['spans']:
                    size = round(span['size'], 1)
                    if abs(size - qnum_size) <= SIZE_TOLERANCE:
                        qnum = detect_qnum_in_span(span, line['spans'])
                        if qnum is not None:
                            x_positions.append(span['bbox'][0])
    if len(x_positions) < 2:
        return doc[0].rect.width / 2
    x_positions.sort()
    max_gap = 0
    split_idx = 0
    for i in range(len(x_positions) - 1):
        gap = x_positions[i + 1] - x_positions[i]
        if gap > max_gap:
            max_gap = gap
            split_idx = i
    return x_positions[split_idx + 1] - 8


def find_linked_groups(doc, midpoint_x):
    pw = doc[0].rect.width
    groups = {}
    q_to_group = {}
    # Match various tilde characters: ~ ～ ∼ 〜
    tilde_pattern = re.compile(r'\[\s*(\d+)\s*[~～∼〜]\s*(\d+)\s*\]')

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        blocks = page.get_text('dict')['blocks']
        for block in blocks:
            if 'lines' not in block:
                continue
            for line in block['lines']:
                # Check individual spans first (fast path)
                found = False
                for span in line['spans']:
                    text = span['text'].strip()
                    match = tilde_pattern.search(text)
                    if match:
                        start_q = int(match.group(1))
                        end_q = int(match.group(2))
                        bbox = span['bbox']
                        found = True
                        break

                # If not found in individual spans, try concatenated line text
                # (handles cases where [, N, ~, M, ] are in separate spans)
                if not found:
                    line_text = ''.join(s['text'] for s in line['spans'])
                    match = tilde_pattern.search(line_text)
                    if match:
                        start_q = int(match.group(1))
                        end_q = int(match.group(2))
                        # Use the first span's bbox for position
                        bbox = line['spans'][0]['bbox']
                        found = True

                if found:
                    col = 'L' if bbox[0] < midpoint_x else 'R'
                    if col == 'L':
                        x_start = max(0, bbox[0] - PADDING_LEFT)
                        x_end = midpoint_x - 2
                    else:
                        x_start = midpoint_x + 2
                        x_end = min(pw, pw - PADDING_RIGHT)

                    groups[start_q] = {
                        'questions': list(range(start_q, end_q + 1)),
                        'page_idx': page_idx,
                        'col': col,
                        'res_y_start': bbox[1] - PADDING_TOP,
                        'x_start': x_start,
                        'x_end': x_end,
                    }
                    for q in range(start_q, end_q + 1):
                        q_to_group[q] = start_q
                    print(f"  Linked group [{start_q}~{end_q}] on page {page_idx+1} col {col}")

    return groups, q_to_group


def find_confirm_section_y(doc, midpoint_x):
    """Find the y-position of '확인 사항' sections on the last page.

    Returns dict: {(page_idx, col): y_top} where y_top is the top of the
    확인 사항 section. Only searches the last page, bottom 30%.
    """
    confirm_positions = {}
    last_page_idx = len(doc) - 1
    page = doc[last_page_idx]
    ph = page.rect.height
    y_threshold = ph * 0.70  # bottom 30% only
    blocks = page.get_text('dict')['blocks']
    for block in blocks:
        if 'lines' not in block:
            continue
        for line in block['lines']:
            line_text = ''.join(s['text'] for s in line['spans'])
            if '확인' in line_text:
                for span in line['spans']:
                    if '확인' in span['text']:
                        bbox = span['bbox']
                        if bbox[1] < y_threshold:
                            continue
                        col = 'L' if bbox[0] < midpoint_x else 'R'
                        key = (last_page_idx, col)
                        if key not in confirm_positions or bbox[1] < confirm_positions[key]:
                            confirm_positions[key] = bbox[1]
                        break
    return confirm_positions


def extract_question_regions(doc):
    """Extract question regions using NEXT QUESTION boundary instead of ⑤."""
    page_rect = doc[0].rect
    pw, ph = page_rect.width, page_rect.height

    qnum_size = detect_qnum_font_size(doc)
    print(f"  Question number font size: {qnum_size}")

    midpoint_x = find_midpoint_x(doc, qnum_size)
    print(f"  Column boundary: x={midpoint_x:.1f} (page width={pw:.0f})")

    groups, q_to_group = find_linked_groups(doc, midpoint_x)

    confirm_y_map = find_confirm_section_y(doc, midpoint_x)
    if confirm_y_map:
        print(f"  확인 사항 detected: {confirm_y_map}")

    # Collect all question number positions across all pages
    all_q_positions = []  # (qnum, page_idx, x, y_top, y_bottom, col)

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        blocks = page.get_text('dict')['blocks']

        for block in blocks:
            if 'lines' not in block:
                continue
            for line in block['lines']:
                for span in line['spans']:
                    if abs(round(span['size'], 1) - qnum_size) <= SIZE_TOLERANCE:
                        qnum = detect_qnum_in_span(span, line['spans'])
                        if qnum is not None:
                            bbox = span['bbox']
                            col = 'L' if bbox[0] < midpoint_x else 'R'
                            all_q_positions.append((qnum, page_idx, bbox[0], bbox[1], bbox[3], col))

    # Build per-page-per-column sorted question lists
    all_questions = []

    # Group by (page_idx, col)
    page_col_qs = {}
    for qnum, page_idx, x, y_top, y_bot, col in all_q_positions:
        key = (page_idx, col)
        if key not in page_col_qs:
            page_col_qs[key] = []
        page_col_qs[key].append((qnum, x, y_top, y_bot, col))

    # Also find bottom content boundary per page/col
    # We'll look for all text content to find the lowest content in each column
    # Skip content at or below 확인 사항 section
    page_col_max_y = {}
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        blocks = page.get_text('dict')['blocks']
        for block in blocks:
            if 'lines' in block:
                for line in block['lines']:
                    for span in line['spans']:
                        bbox = span['bbox']
                        col = 'L' if bbox[0] < midpoint_x else 'R'
                        key = (page_idx, col)
                        # Skip content in 확인 사항 section
                        if key in confirm_y_map and bbox[1] >= confirm_y_map[key] - 5:
                            continue
                        if key not in page_col_max_y:
                            page_col_max_y[key] = 0
                        page_col_max_y[key] = max(page_col_max_y[key], bbox[3])
            elif block.get('type') == 1:  # image block
                bbox = block['bbox']
                col = 'L' if bbox[0] < midpoint_x else 'R'
                key = (page_idx, col)
                # Skip images in 확인 사항 section
                if key in confirm_y_map and bbox[1] >= confirm_y_map[key] - 5:
                    continue
                if key not in page_col_max_y:
                    page_col_max_y[key] = 0
                page_col_max_y[key] = max(page_col_max_y[key], bbox[3])

    for key in sorted(page_col_qs.keys()):
        page_idx, col = key
        col_qs = sorted(page_col_qs[key], key=lambda q: q[2])  # sort by y_top

        for qi, q in enumerate(col_qs):
            q_num, x, y_top, y_bot, c = q

            # Top boundary: question number position - padding
            y_start = y_top - PADDING_TOP

            # Bottom boundary: next question's y position - gap
            if qi + 1 < len(col_qs):
                next_q_num = col_qs[qi + 1][0]
                next_q_y = col_qs[qi + 1][2]
                # If next question is first in a linked group [N~M],
                # use the group header's y position as bottom boundary
                # so the shared passage is NOT included in this question
                if next_q_num in q_to_group:
                    grp_key = q_to_group[next_q_num]
                    grp = groups[grp_key]
                    if (grp['questions'][0] == next_q_num
                            and grp['page_idx'] == page_idx
                            and grp.get('col') == col):
                        next_q_y = grp['res_y_start']
                y_end = next_q_y - BOTTOM_GAP_FROM_NEXT_Q
            else:
                # Last question in this column on this page
                # Use the maximum content y in this column, or page bottom
                max_content_y = page_col_max_y.get(key, ph - 50)
                if key in confirm_y_map:
                    # Use 확인 사항 position as upper bound
                    # Subtract 25pt to clear the box border above the text
                    confirm_y = confirm_y_map[key]
                    y_end = min(confirm_y - 25, max_content_y + 10)
                else:
                    # Don't go past the page footer area
                    y_end = min(max_content_y + 10, ph - 30)

            # Column boundaries
            if col == 'L':
                x_start = max(0, x - PADDING_LEFT)
                x_end = midpoint_x - 2
            else:
                x_start = midpoint_x + 2
                x_end = min(pw, pw - PADDING_RIGHT)

            y_start = max(0, y_start)
            y_end = min(ph, y_end)

            all_questions.append((q_num, page_idx, x_start, y_start, x_end, y_end))

    all_questions.sort(key=lambda q: q[0])

    # Update linked group y_end
    q_y_map = {q[0]: q[3] for q in all_questions}
    for start_q, grp in groups.items():
        grp['res_y_end'] = q_y_map.get(start_q, grp['res_y_start'])

    return all_questions, groups, q_to_group


def crop_and_save(pdf_path, output_dir, pdf_name_override=None):
    pdf_name = pdf_name_override or os.path.splitext(os.path.basename(pdf_path))[0]
    out_dir = os.path.join(output_dir, pdf_name)
    os.makedirs(out_dir, exist_ok=True)

    print(f"\n{'='*50}")
    print(f"Processing: {pdf_name}")
    print(f"{'='*50}")

    doc = fitz.open(pdf_path)
    page_rect = doc[0].rect
    pw, ph = page_rect.width, page_rect.height

    questions, groups, q_to_group = extract_question_regions(doc)
    print(f"  Found {len(questions)} questions")

    if len(questions) == 0:
        print(f"  WARNING: No questions found, skipping")
        doc.close()
        return 0

    print("  Converting PDF to images...")
    images = convert_from_path(pdf_path, dpi=DPI, poppler_path=POPPLER_BIN)
    img_w, img_h = images[0].size
    print(f"  Image size: {img_w}x{img_h}")

    count = 0
    for q_num, page_idx, x0, y0, x1, y1 in questions:
        if page_idx >= len(images):
            print(f"  WARNING: Q{q_num} references page {page_idx+1} but only {len(images)} pages")
            continue

        img = images[page_idx]
        iw, ih = img.size

        px0 = pdf_to_pixel(x0, pw, iw)
        py0 = pdf_to_pixel(y0, ph, ih)
        px1 = pdf_to_pixel(x1, pw, iw)
        py1 = pdf_to_pixel(y1, ph, ih)
        q_crop = img.crop((px0, py0, px1, py1))

        tag = ""
        if q_num in q_to_group:
            grp = groups[q_to_group[q_num]]
            res_page = grp['page_idx']
            if res_page < len(images):
                res_img = images[res_page]
                riw, rih = res_img.size

                rpx0 = pdf_to_pixel(grp['x_start'], pw, riw)
                rpy0 = pdf_to_pixel(max(0, grp['res_y_start']), ph, rih)
                rpx1 = pdf_to_pixel(grp['x_end'], pw, riw)
                rpy1 = pdf_to_pixel(grp['res_y_end'], ph, rih)
                res_crop = res_img.crop((rpx0, rpy0, rpx1, rpy1))

                target_w = max(res_crop.width, q_crop.width)
                total_h = res_crop.height + GAP_BETWEEN + q_crop.height
                combined = Image.new('RGB', (target_w, total_h), (255, 255, 255))
                combined.paste(res_crop, (0, 0))
                combined.paste(q_crop, (0, res_crop.height + GAP_BETWEEN))
                final = trim_bottom_whitespace(trim_horizontal(combined))
                tag = " +resource"
            else:
                final = trim_bottom_whitespace(trim_horizontal(q_crop))
        else:
            final = trim_bottom_whitespace(trim_horizontal(q_crop))

        filename = f"{pdf_name}_{q_num:02d}.png"
        save_path = os.path.join(out_dir, filename)
        final.save(save_path, 'PNG')
        count += 1
        print(f"    {filename} (page {page_idx+1}, {final.size[0]}x{final.size[1]}){tag}")

    doc.close()
    print(f"  Done: {count} questions -> {out_dir}")
    return count


# Subject folders and their codes
SUBJECTS = {
    '한국지리': 'korgeo',
    '세계지리': 'wgeo',
    '통합사회': 'iss',
    '생활과윤리': 'leth',
    '윤리와사상': 'ethth',
    '정치와법': 'pollaw',
    '경제': 'econ',
    '사회문화': 'socul',
}


def process_subject(subject_name):
    """Process all PDFs for a single subject."""
    subject_dir = os.path.join(PROJECT_DIR, '모의고사', subject_name)
    pdf_dir = os.path.join(subject_dir, '작업완료')

    if not os.path.isdir(pdf_dir):
        print(f"\nNo 작업완료 directory for {subject_name}")
        return 0

    pdf_files = sorted([f for f in os.listdir(pdf_dir) if f.lower().endswith('.pdf')])
    print(f"\n{'#'*60}")
    print(f"# Subject: {subject_name} ({len(pdf_files)} PDFs)")
    print(f"{'#'*60}")

    total = 0
    for pdf_file in pdf_files:
        pdf_path = os.path.join(pdf_dir, pdf_file)
        try:
            count = crop_and_save(pdf_path, subject_dir)
            total += count
        except Exception as e:
            print(f"  ERROR processing {pdf_file}: {e}")

    return total


def copy_to_public(subject_name, code):
    """Copy re-extracted PNG images to public/images/{subject}/ as JPG."""
    subject_dir = os.path.join(PROJECT_DIR, '모의고사', subject_name)
    public_dir = os.path.join(PROJECT_DIR, 'public', 'images', subject_name)

    if not os.path.isdir(public_dir):
        print(f"  Public dir not found: {public_dir}")
        return 0

    copied = 0
    # Walk through all subdirectories in subject_dir
    for folder_name in sorted(os.listdir(subject_dir)):
        folder_path = os.path.join(subject_dir, folder_name)
        if not os.path.isdir(folder_path) or folder_name == '작업완료' or folder_name == 'temp_pdfs':
            continue

        for png_file in sorted(os.listdir(folder_path)):
            if not png_file.lower().endswith('.png'):
                continue

            src = os.path.join(folder_path, png_file)
            # Convert filename: 2026_09_wgeo_03.png -> 2026_09_wgeo_03.jpg
            jpg_name = os.path.splitext(png_file)[0] + '.jpg'
            dst = os.path.join(public_dir, jpg_name)

            img = Image.open(src)
            img = img.convert('RGB')
            img.save(dst, 'JPEG', quality=92)
            copied += 1

    return copied


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Fix bottom-cutoff in exam question images')
    parser.add_argument('--subject', type=str, help='Process only this subject (e.g., 세계지리)')
    parser.add_argument('--pdf', type=str, help='Process only this PDF file (e.g., 2026_09_wgeo.pdf)')
    parser.add_argument('--copy', action='store_true', help='Copy re-extracted images to public/ as JPG')
    parser.add_argument('--all', action='store_true', help='Process all subjects')
    args = parser.parse_args()

    if args.pdf and args.subject:
        # Process a single PDF
        subject_dir = os.path.join(PROJECT_DIR, '모의고사', args.subject)
        pdf_path = os.path.join(subject_dir, '작업완료', args.pdf)
        if not os.path.isfile(pdf_path):
            print(f"PDF not found: {pdf_path}")
            return
        crop_and_save(pdf_path, subject_dir)

    elif args.subject:
        process_subject(args.subject)
        if args.copy:
            code = SUBJECTS.get(args.subject, '')
            n = copy_to_public(args.subject, code)
            print(f"\nCopied {n} images to public/images/{args.subject}/")

    elif args.all:
        grand_total = 0
        for subj in SUBJECTS:
            total = process_subject(subj)
            grand_total += total

        print(f"\n{'#'*60}")
        print(f"# GRAND TOTAL: {grand_total} questions re-extracted")
        print(f"{'#'*60}")

        if args.copy:
            for subj, code in SUBJECTS.items():
                n = copy_to_public(subj, code)
                print(f"Copied {n} images for {subj}")

    else:
        print("Usage:")
        print("  python fix_bottom_cutoff.py --subject 세계지리 --pdf 2026_09_wgeo.pdf")
        print("  python fix_bottom_cutoff.py --subject 세계지리")
        print("  python fix_bottom_cutoff.py --all")
        print("  python fix_bottom_cutoff.py --all --copy  (also copy to public/)")


if __name__ == '__main__':
    main()
