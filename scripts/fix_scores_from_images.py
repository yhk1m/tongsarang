# © 2026 김용현
"""문항 이미지에서 [3점] 표시를 읽어 배점을 채운다.

메가스터디에 자료가 없거나 시험지 PDF에 [3점] 이 텍스트로 안 들어 있는 시험지가 있다.
그런 경우 20문항이 전부 2점(총점 40)으로 들어가 있는데, 사탐은 20문항 중 10개가
3점이라 명백히 틀린 값이다.

[3점] 은 발문 끝에 붙으므로 **문항 이미지의 위쪽 띠만** 잘라 Tesseract 로 읽는다.
저장된 발문·문항내용 텍스트는 이 표시를 자주 놓쳐서 근거로 못 쓴다.

정확히 10개를 찾았을 때만 반영하고, 아니면 보고만 한다.

    python scripts/fix_scores_from_images.py --report
    python scripts/fix_scores_from_images.py
"""
import os
import re
import sys
import json
import argparse
import subprocess

from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

HOME = os.path.expanduser('~')
PROJECT_DIR = os.path.join(HOME, 'Desktop', 'vibecoding', 'tongsarang')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from exam_calendar import CATEGORY_TO_MONTH, image_code  # noqa: E402

DATA_DIR = os.path.join(PROJECT_DIR, 'public', 'data')
IMG_DIR = os.path.join(PROJECT_DIR, 'public', 'images')
TESSERACT = 'C:/Program Files/Tesseract-OCR/tesseract.exe'
TESSDATA = os.path.join(HOME, 'tessdata')

SUBJECTS = ['한국지리', '세계지리', '한국사', '정치와법', '경제',
            '사회문화', '생활과윤리', '윤리와사상', '동아시아사', '세계사']
EXPECTED_TOTAL = 50      # 사탐 20문항 = 10×2 + 10×3
EXPECTED_THREE = 10
TOP_BAND = 0.22          # 발문은 조각 위쪽에 있다


def has_three_point(path):
    """이미지 위쪽 띠에서 [3점] 표시를 찾는다."""
    try:
        img = Image.open(path)
    except Exception:
        return False
    w, h = img.size
    band = img.crop((0, 0, w, max(1, int(h * TOP_BAND))))
    tmp = os.path.join(os.environ.get('TEMP', '.'), 'score_band.png')
    band.save(tmp)
    try:
        out = subprocess.run(
            [TESSERACT, tmp, 'stdout', '--tessdata-dir', TESSDATA, '-l', 'kor', '--psm', '6'],
            capture_output=True, timeout=120)
    except Exception:
        return False
    return bool(re.search(r'3\s*점', out.stdout.decode('utf-8', 'replace')))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--report', action='store_true')
    args = ap.parse_args()

    fixed, unresolved = [], []
    for subject in SUBJECTS:
        data_path = os.path.join(DATA_DIR, f'{subject}.json')
        data = json.load(open(data_path, encoding='utf-8'))
        exams = {}
        for row in data:
            exams.setdefault((row['학년도'], row['분류']), []).append(row)

        changed = False
        for (year, cat), rows in sorted(exams.items()):
            if len(rows) != 20:
                continue
            total = sum(float(r['배점'] or 0) for r in rows)
            if total == EXPECTED_TOTAL:
                continue

            month = CATEGORY_TO_MONTH.get(cat)
            if not month:
                continue
            img_dir = os.path.join(IMG_DIR, subject)
            three = []
            for row in rows:
                name = f"{year}_{month}_{image_code(subject)}_{int(row['번호']):02d}.jpg"
                if has_three_point(os.path.join(img_dir, name)):
                    three.append(int(row['번호']))

            label = f'{subject} {year} {cat} (총점 {total:g})'
            if len(three) != EXPECTED_THREE:
                print(f'  ? {label}: 3점 {len(three)}개 {sorted(three)} — 건너뜀')
                unresolved.append(label)
                continue

            print(f'  + {label}: 3점 {sorted(three)}')
            if not args.report:
                for row in rows:
                    want = 3 if int(row['번호']) in three else 2
                    row['배점'] = want if isinstance(row['배점'], (int, float)) else str(want)
                changed = True
            fixed.append(label)

        if changed and not args.report:
            json.dump(data, open(data_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

    verb = '확인' if args.report else '수정'
    print(f'\n=== 배점 {verb}: {len(fixed)}개 시험지 / 미해결 {len(unresolved)}개 ===')
    for u in unresolved:
        print('   ' + u)


if __name__ == '__main__':
    main()
