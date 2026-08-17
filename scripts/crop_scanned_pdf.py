# © 2026 김용현
"""텍스트 레이어가 없는 스캔 PDF를 OCR로 문항 분할해 자른다.

fix_bottom_cutoff 는 PDF 안의 텍스트 좌표로 문항 번호를 찾는다. 스캔본은 그 좌표가
없어 '문항 0개'가 되므로, 페이지를 렌더링해 Tesseract 로 문항 번호의 위치를 잡는다.

문항 경계를 잡는 방식은 fix_bottom_cutoff 와 같다.
  - 두 단(段) 중 어느 쪽인지는 번호의 x 위치로 가른다
  - 아래 경계는 같은 단의 '다음 문항 번호' 바로 위
  - 마지막 문항은 지면 하단 여백까지

    python scripts/crop_scanned_pdf.py 세계사 2025_11_worhis
    python scripts/crop_scanned_pdf.py --all        # 스캔본 자동 탐지
"""
import os
import re
import sys
import csv
import argparse
import subprocess

import fitz
from PIL import Image
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

HOME = os.path.expanduser('~')
PROJECT_DIR = os.path.join(HOME, 'Desktop', 'vibecoding', 'tongsarang')
sys.path.insert(0, PROJECT_DIR)
import fix_bottom_cutoff as cropper  # noqa: E402

MOCK_DIR = os.path.join(PROJECT_DIR, '모의고사')
IMG_DIR = os.path.join(PROJECT_DIR, 'public', 'images')
TESSERACT = 'C:/Program Files/Tesseract-OCR/tesseract.exe'
TESSDATA = os.path.join(HOME, 'tessdata')

DPI = 300
PAD_TOP = 16        # px. 번호 위로 조금 남긴다
PAD_LEFT = 40
GAP_ABOVE_NEXT = 30  # px. 다음 문항 번호 위 여백


def ocr_words(img):
    """페이지 전체 + 좌·우 단을 따로 OCR해 합친다.

    2단 지면을 통째로 넘기면 단 경계에서 줄을 잘못 묶어 문항 번호를 통째로 놓치는
    일이 있다(실측: 한국사 2025 수능 5번). 반쪽씩 다시 읽어 보완한다.
    """
    w, h = img.size
    words = list(_ocr_image(img))
    seen = {(t, x0, y0) for t, x0, y0, _x1, _y1, _c in words}
    for x_off, half in ((0, img.crop((0, 0, w // 2, h))),
                        (w // 2, img.crop((w // 2, 0, w, h)))):
        for t, x0, y0, x1, y1, conf in _ocr_image(half):
            key = (t, x0 + x_off, y0)
            if key not in seen:
                seen.add(key)
                words.append((t, x0 + x_off, y0, x1 + x_off, y1, conf))
    return words


def _ocr_image(img):
    """Tesseract TSV로 (텍스트, x0, y0, x1, y1, conf) 목록을 얻는다."""
    tmp = os.path.join(os.environ.get('TEMP', '.'), f'scan_{img.size[0]}x{img.size[1]}.png')
    img.save(tmp, 'PNG')
    # tessdata-dir 를 따로 주면 configs/tsv 를 못 찾으므로 파라미터로 직접 켠다
    out = subprocess.run(
        [TESSERACT, tmp, 'stdout', '--tessdata-dir', TESSDATA, '-l', 'kor', '--psm', '6',
         '-c', 'tessedit_create_tsv=1'],
        capture_output=True, timeout=300)
    words = []
    reader = csv.DictReader(out.stdout.decode('utf-8', 'replace').splitlines(), delimiter='\t',
                            quoting=csv.QUOTE_NONE)
    for row in reader:
        try:
            text = (row.get('text') or '').strip()
            conf = float(row.get('conf') or -1)
            if not text or conf < 0:
                continue
            x, y = int(row['left']), int(row['top'])
            w, h = int(row['width']), int(row['height'])
        except (ValueError, KeyError, TypeError):
            continue
        words.append((text, x, y, x + w, y + h, conf))
    return words


#  OCR이 숫자를 자주 헷갈린다(3→9, 1→7, 0↔O, 1↔l). 판독값을 믿지 않고
#  '단 왼쪽 기준선에 있는 번호처럼 생긴 낱말'만 후보로 모은 뒤, 읽기 순서로 번호를 준다.
NUM_LIKE = re.compile(r'[0-9OoIl|]{1,2}\s*[.,·]')


def trim_page_number_box(img):
    """조각 맨 아래에 홀로 떨어져 있는 작은 덩어리(페이지 번호 박스)를 잘라낸다.

    본문과 넓은 흰 띠(>=50px)로 분리돼 있고 가로 폭이 조각의 20% 미만일 때만 자른다.
    두 줄로 넘어간 ⑤ 선지는 본문과 붙어 있어 이 조건에 걸리지 않는다.
    """
    a = np.array(img.convert('L'))
    h, w = a.shape
    rows = np.any(a < 240, axis=1)
    ink = np.where(rows)[0]
    if len(ink) == 0:
        return img

    # 아래에서 위로 올라가며 첫 번째 큰 공백을 찾는다
    last = ink[-1]
    gap_start = None
    run = 0
    for y in range(last, max(0, last - int(h * 0.30)), -1):
        if not rows[y]:
            run += 1
            if run >= 50:
                gap_start = y + run
                break
        else:
            run = 0
    if gap_start is None or gap_start >= last:
        return img

    tail = a[gap_start:last + 1]
    cols = np.where(np.any(tail < 240, axis=0))[0]
    if len(cols) == 0:
        return img
    if (cols[-1] - cols[0] + 1) < w * 0.20:
        return img.crop((0, 0, w, max(1, gap_start - 50)))
    return img


def page_number_y(words, page_h):
    """지면 하단의 페이지 번호(1~3자리 숫자) 윗변 y. 없으면 None."""
    ys = [y0 for text, x0, y0, x1, y1, conf in words
          if re.fullmatch(r'\d{1,3}', text.strip()) and y0 > page_h * 0.88]
    return min(ys) if ys else None


def confirm_section_y(words, page_h, page_w):
    """마지막 장 아래의 '확인 사항' 안내 박스 윗변 y를 단별로 찾는다."""
    out = {}
    for text, x0, y0, x1, y1, conf in words:
        if '확인' not in text or y0 < page_h * 0.60:
            continue
        col = 'L' if x0 < page_w / 2 else 'R'
        out[col] = min(out.get(col, y0), y0)
    return out


def find_question_numbers(words, page_w):
    """각 단 왼쪽 기준선에 있는 '번호처럼 생긴' 낱말의 위치를 모은다."""
    cands = []
    for text, x0, y0, x1, y1, conf in words:
        if not NUM_LIKE.fullmatch(text.replace(' ', '')):
            continue
        if not 20 <= (y1 - y0) <= 90:      # 본문 글씨 크기대
            continue
        m = re.fullmatch(r'(\d{1,2})[.,·]', text.replace(' ', ''))
        n = int(m.group(1)) if m else None
        if n is not None and not 1 <= n <= 25:
            n = None                       # '0.' 처럼 범위 밖이면 위치만 쓴다
        cands.append((n, x0, y0, x1, y1))
    if not cands:
        return [], {}

    xs = sorted(c[1] for c in cands)
    # 가장 큰 x 간격을 단 경계로 본다
    mid = page_w / 2
    if len(xs) >= 2:
        gaps = [(xs[i + 1] - xs[i], (xs[i] + xs[i + 1]) / 2) for i in range(len(xs) - 1)]
        gap, center = max(gaps)
        if gap > page_w * 0.15:
            mid = center

    # 단별 왼쪽 기준선 근처만 남긴다 (본문 안의 숫자를 걸러낸다)
    kept, bases = [], {}
    for col, sel in (('L', lambda x: x < mid), ('R', lambda x: x >= mid)):
        col_c = [c for c in cands if sel(c[1])]
        if not col_c:
            continue
        base = min(c[1] for c in col_c)
        bases[col] = base
        taken_y = set()
        for c in col_c:
            # 문항 번호는 단 기준선에 딱 붙어 있다. 선지(①②) 등은 들여쓰기가 있어 빠진다.
            if c[1] <= base + 25:
                kept.append((c[0], col, c[1], c[2], c[3], c[4]))
                taken_y.add(c[2])

        # OCR이 '3.'을 '3'으로, '8.'을 '&.'로 읽는 일이 잦다. 기준선에 정확히 걸린
        # 짧은 토큰은 판독값과 무관하게 문항 번호 자리로 받는다.
        for text, x0, y0, x1, y1, conf in words:
            if not sel(x0) or not (base - 8 <= x0 <= base + 8):
                continue
            if y0 in taken_y or len(text.strip()) > 3:
                continue
            if not 20 <= (y1 - y0) <= 90:
                continue
            m = re.fullmatch(r'(\d{1,2})[.,·]?', text.strip())
            n = int(m.group(1)) if m else None
            kept.append((n if (n is not None and 1 <= n <= 25) else None,
                         col, x0, y0, x1, y1))
            taken_y.add(y0)

    # 페이지 전체 OCR과 단별 OCR이 같은 번호를 몇 px 어긋나게 잡는다. 붙어 있는 건 합친다.
    merged = []
    for c in sorted(kept, key=lambda c: (c[1], c[3])):
        prev = merged[-1] if merged else None
        if prev and prev[1] == c[1] and abs(prev[3] - c[3]) <= 25:
            if prev[0] is None and c[0] is not None:   # 판독값이 있는 쪽을 남긴다
                merged[-1] = c
            continue
        merged.append(c)
    return merged, bases


# kept 원소는 (판독숫자|None, 단, x0, y0, x1, y1)


def crop_page_questions(pdf_path, expected=20):
    """읽기 순서(페이지 → 왼쪽 단 → 오른쪽 단 → 위에서 아래)로 문항 번호를 배정한다."""
    doc = fitz.open(pdf_path)
    pages, slots = [], []
    for page_idx, page in enumerate(doc):
        pix = page.get_pixmap(dpi=DPI)
        img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
        pages.append(img)
        words = ocr_words(img)
        cands, bases = find_question_numbers(words, img.width)
        foot_y = page_number_y(words, img.height)
        confirm = confirm_section_y(words, img.height, img.width)
        for col in ('L', 'R'):
            col_c = sorted([c for c in cands if c[1] == col], key=lambda c: c[3])
            for read_n, _c, x0, y0, x1, y1 in col_c:
                slots.append({'page': page_idx, 'col': col, 'x0': x0, 'y0': y0,
                              'read': read_n, 'bases': bases,
                              'foot': foot_y, 'confirm': confirm.get(col)})
    doc.close()

    found = {}
    if len(slots) == expected:
        # 읽은 숫자가 아니라 순서로 번호를 준다
        mismatch = [(i + 1, s['read']) for i, s in enumerate(slots)
                    if s['read'] is not None and s['read'] != i + 1]
        if mismatch:
            print(f'  주의: 순서와 판독값이 다른 자리 {mismatch}')
        for i, s in enumerate(slots):
            found[i + 1] = (s['page'], s['col'], s['x0'], s['y0'], s['bases'], s['foot'], s['confirm'])
    else:
        # 개수가 안 맞으면 판독값이 확실한 것만 쓴다
        for s in slots:
            if s['read'] is not None and s['read'] not in found:
                found[s['read']] = (s['page'], s['col'], s['x0'], s['y0'], s['bases'], s['foot'], s['confirm'])
        print(f'  후보 {len(slots)}개 (기대 {expected}개) — 판독값으로만 배정')
    return found, pages


def build_crops(found, pages, expected=20):
    """문항별 (page_idx, box) 계산. 아래 경계는 같은 단의 다음 번호 위."""
    by_page_col = {}
    for n, (pi, col, x0, y0, bases, foot, confirm) in found.items():
        by_page_col.setdefault((pi, col), []).append((y0, n))
    for key in by_page_col:
        by_page_col[key].sort()

    crops = {}
    for n, (pi, col, x0, y0, bases, foot, confirm) in sorted(found.items()):
        img = pages[pi]
        iw, ih = img.size
        same = by_page_col[(pi, col)]
        below = [yy for yy, nn in same if yy > y0]
        if below:
            y_end = min(below) - GAP_ABOVE_NEXT
        else:
            # 단의 마지막 문항: 확인 사항 박스 / 페이지 번호 박스 위에서 끊는다
            # '확인 사항'은 글자보다 박스 테두리가 위에 있어 여유를 더 둔다
            limits = [v - m for v, m in ((confirm, 80), (foot, 25)) if v]
            y_end = min(limits) if limits else int(ih * 0.93)
        x_start = max(0, x0 - PAD_LEFT)
        if col == 'L':
            # 왼쪽 단의 오른쪽 끝은 '오른쪽 단이 시작하는 자리' 바로 앞이다.
            right_base = bases.get('R')
            x_end = (right_base - PAD_LEFT - 20) if right_base else int(iw * 0.48)
        else:
            x_end = int(iw * 0.96)
        box = (x_start, max(0, y0 - PAD_TOP), x_end, min(ih, y_end))
        crops[n] = (pi, box)
    return crops


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('subject', nargs='?')
    ap.add_argument('stem', nargs='?')
    ap.add_argument('--expected', type=int, default=20)
    args = ap.parse_args()

    if not args.subject or not args.stem:
        ap.error('과목과 파일 이름을 지정하세요. 예: 세계사 2025_11_worhis')

    pdf_path = os.path.join(MOCK_DIR, args.subject, '작업완료', args.stem + '.pdf')
    found, pages = crop_page_questions(pdf_path, args.expected)
    missing = [n for n in range(1, args.expected + 1) if n not in found]
    print(f'{args.stem}: 문항 번호 {len(found)}개 인식'
          + (f', 누락 {missing}' if missing else ''))
    if missing:
        print('  → 누락이 있어 저장하지 않습니다. OCR 인식 개선 필요.')
        return 1

    crops = build_crops(found, pages, args.expected)
    out_dir = os.path.join(MOCK_DIR, args.subject, args.stem)
    os.makedirs(out_dir, exist_ok=True)
    public_dir = os.path.join(IMG_DIR, args.subject)
    for n, (pi, box) in sorted(crops.items()):
        tile = pages[pi].crop(box)
        tile = trim_page_number_box(tile)
        tile = cropper.trim_bottom_whitespace(cropper.trim_horizontal(tile))
        name = f'{args.stem}_{n:02d}'
        tile.save(os.path.join(out_dir, name + '.png'), 'PNG')
        tile.convert('RGB').save(os.path.join(public_dir, name + '.jpg'), 'JPEG', quality=92)
        print(f'  {name}  page{pi + 1}  {tile.size[0]}x{tile.size[1]}')
    print(f'{len(crops)}문항 저장')
    return 0


if __name__ == '__main__':
    sys.exit(main())
