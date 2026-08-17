# © 2026 김용현
"""한국지리 2021 5월학평(=2020.05.21 시행) 이미지 재생성.

스캔본이라 텍스트 좌표도, OCR 자동 분할도 신뢰할 수 없어 4개 지면을 눈으로 확인해
문항 시작 y를 직접 적었다. 좌표는 300dpi 픽셀 기준(지면 3508x4961).
"""
import os, sys, io
import fitz
from PIL import Image

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BASE = r'C:/Users/김용현/Desktop/vibecoding/tongsarang'
sys.path.insert(0, BASE)
import fix_bottom_cutoff as cropper
sys.path.insert(0, os.path.join(BASE, 'scripts'))
from crop_scanned_pdf import trim_page_number_box

PDF = os.path.join(BASE, '모의고사/한국지리/작업완료/2021_05_korgeo.pdf')
OUT_DIR = os.path.join(BASE, '모의고사/한국지리/2021_05_korgeo')
PUB = os.path.join(BASE, 'public/images/한국지리')
STEM = '2021_05_korgeo'

COL = {'L': (330, 1745), 'R': (1770, 3175)}   # 단별 x 범위
TOP_PAD, GAP = 40, 60
# 지면 머리글 아래 구분선(실측 1쪽 992~998, 2~4쪽 674~678)이 딸려 오지 않게 하는 상한
MIN_TOP = {0: 1002, 1: 682, 2: 682, 3: 682}
# (문항, 페이지index, 단, 시작 y)
LAYOUT = [
    (1, 0, 'L', 1048), (2, 0, 'L', 3240),
    (3, 0, 'R', 1049), (4, 0, 'R', 3049),
    (5, 1, 'L', 715), (6, 1, 'L', 1913), (7, 1, 'L', 3215),
    (8, 1, 'R', 720), (9, 1, 'R', 2865),
    (10, 2, 'L', 720), (11, 2, 'L', 1860), (12, 2, 'L', 3189),
    (13, 2, 'R', 720), (14, 2, 'R', 2019), (15, 2, 'R', 3360),
    (16, 3, 'L', 714), (17, 3, 'L', 2367), (18, 3, 'L', 3444),
    (19, 3, 'R', 720), (20, 3, 'R', 2154),
]
# 단의 마지막 문항 아래 경계 (페이지번호 박스 / 확인 사항 위)
# 실측: 선지 ⑤는 y=4483 에서 끝나고 페이지번호 박스는 4505~4600 에 있다.
# 4쪽 오른쪽은 '확인 사항' 박스가 y=4185 부터라 따로 준다.
LAST_BOTTOM = {(0, 'L'): 4500, (0, 'R'): 4500, (1, 'L'): 4500, (1, 'R'): 4500,
               (2, 'L'): 4500, (2, 'R'): 4500, (3, 'L'): 4500, (3, 'R'): 4150}

doc = fitz.open(PDF)
pages = {}
for pi in sorted({r[1] for r in LAYOUT}):
    pix = doc[pi].get_pixmap(dpi=cropper.DPI)
    pages[pi] = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
doc.close()
print('지면 크기:', pages[0].size)

by_col = {}
for q, pi, col, y in LAYOUT:
    by_col.setdefault((pi, col), []).append((y, q))
for k in by_col:
    by_col[k].sort()

os.makedirs(OUT_DIR, exist_ok=True)
for q, pi, col, y in LAYOUT:
    img = pages[pi]
    x0, x1 = COL[col]
    below = [yy for yy, _ in by_col[(pi, col)] if yy > y]
    y_end = (min(below) - GAP) if below else LAST_BOTTOM[(pi, col)]
    y_start = max(y - TOP_PAD, MIN_TOP[pi])
    tile = img.crop((x0, y_start, x1, min(img.height, y_end)))
    tile = cropper.trim_bottom_whitespace(cropper.trim_horizontal(tile))
    name = f'{STEM}_{q:02d}'
    tile.save(os.path.join(OUT_DIR, name + '.png'), 'PNG')
    tile.convert('RGB').save(os.path.join(PUB, name + '.jpg'), 'JPEG', quality=80)
    print(f'  {name}  p{pi+1}{col}  {tile.size[0]}x{tile.size[1]}')
print(f'{len(LAYOUT)}문항 저장')
