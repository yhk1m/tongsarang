# © 2026 김용현
"""이미지가 없는 문항을 찾아 EBSi에서 해당 시험지를 받아 채운다.

과목마다 학년도 표기 규칙이 달라 라벨 → 시행 연·월 변환은 exam_calendar 에 맡긴다.
발문·문항내용은 비워 두므로, 끝나면 ocr_subjects.cjs 를 돌려 채운다.

    python scripts/fetch_missing_images.py --list   # 빠진 시험지 목록만
    python scripts/fetch_missing_images.py          # 받아서 크롭·교체
"""
import os
import re
import sys
import json
import time
import shutil
import argparse
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

HOME = os.path.expanduser('~')
PROJECT_DIR = os.path.join(HOME, 'Desktop', 'vibecoding', 'tongsarang')
sys.path.insert(0, PROJECT_DIR)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from exam_calendar import SUBJECT_EBSI, CATEGORY_TO_MONTH, to_ebsi, image_name, image_code  # noqa: E402

DATA_DIR = os.path.join(PROJECT_DIR, 'public', 'data')
IMG_DIR = os.path.join(PROJECT_DIR, 'public', 'images')
MOCK_DIR = os.path.join(PROJECT_DIR, '모의고사')
LIST_API = 'https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperListAjax.ajax'
PDF_BASE = 'https://wdown.ebsi.co.kr/W61001/01exam'


def fetch_list(target_cd, year, month, ar_ord, subj_id):
    body = (f'targetCd={target_cd}&yearList={year}&monthList={month}'
            f'&arOrd={ar_ord}&subjIdList={subj_id}&sort=recent&currentPage=1')
    req = urllib.request.Request(
        LIST_API, data=body.encode('utf-8'),
        headers={'User-Agent': 'Mozilla/5.0',
                 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                 'Referer': 'https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperList.ebs',
                 'X-Requested-With': 'XMLHttpRequest'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode('utf-8', errors='replace')


def pick(html, want_moc):
    for block in html.split('<div class="qus_box')[1:]:
        m_title = re.search(r'<div class="qus_tit">(.*?)</div>', block, re.DOTALL)
        m_pdf = re.search(r"goDownLoadP\('([^']+\.pdf)'", block)
        if not m_title or not m_pdf:
            continue
        title = ' '.join(m_title.group(1).split()).replace('&nbsp;', ' ').strip()
        if '짝수' in title:
            continue
        if want_moc and '모평' not in title:
            continue
        if not want_moc and '모평' in title:
            continue
        return title, m_pdf.group(1)
    return None, None


def download(url, path):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    if len(data) < 10000 or not data.startswith(b'%PDF'):
        return False
    open(path, 'wb').write(data)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--list', action='store_true')
    args = ap.parse_args()

    if not args.list:
        import fix_bottom_cutoff as cropper
        from PIL import Image

    # 1) 이미지가 없는 (과목, 학년도, 분류, 학년) 조합 수집
    gaps = {}
    for subject in [s for s in SUBJECT_EBSI if not s.endswith('_고2')]:
        data = json.load(open(os.path.join(DATA_DIR, f'{subject}.json'), encoding='utf-8'))
        files = set(os.listdir(os.path.join(IMG_DIR, subject)))
        for row in data:
            grade = row.get('학년', '')
            name = image_name(subject, row['학년도'], row['분류'], row['번호'], grade)
            if name + '.jpg' not in files:
                gaps.setdefault((subject, row['학년도'], row['분류'], grade), 0)
                gaps[(subject, row['학년도'], row['분류'], grade)] += 1

    print(f'=== 이미지가 빠진 시험지 {len(gaps)}개 ===')
    for (subject, year, cat, grade), n in sorted(gaps.items()):
        exam_year, months = to_ebsi(subject, year, cat)
        print(f'  {subject} {year} {grade} {cat}: {n}문항  ← EBSi {exam_year}.{months[0] if months else "?"}')
    if args.list:
        return

    filled, failed = [], []
    for (subject, year, cat, grade), _n in sorted(gaps.items()):
        exam_year, months = to_ebsi(subject, year, cat)
        if not exam_year:
            failed.append(f'{subject} {year} {cat} (분류 해석 불가)')
            continue
        key = '통합사회_고2' if (subject == '통합사회' and grade == '고2') else subject
        code, target_cd, ar_ord, subj_id = SUBJECT_EBSI[key]
        want_moc = cat in ('수능', '6모', '9모', '6월', '9월', '11월') and cat != '수능'

        title = path = None
        for mm in months:
            try:
                html = fetch_list(target_cd, exam_year, mm, ar_ord, subj_id)
            except Exception:
                continue
            # 수능은 '수능' 키워드, 모평은 '모평', 학평은 '학평'
            for moc_flag in ([True, False] if cat == '수능' else [want_moc]):
                title, path = pick(html, moc_flag)
                if path:
                    break
            if path:
                break
        if not path:
            print(f'  ! {subject} {year} {cat}: EBSi {exam_year}년 자료 없음')
            failed.append(f'{subject} {year} {cat}')
            continue

        month = CATEGORY_TO_MONTH[cat]
        stem = f'{year}_{month}_{image_code(subject, grade)}'
        subject_dir = os.path.join(MOCK_DIR, subject)
        pdf_dir = os.path.join(subject_dir, '작업완료')
        os.makedirs(pdf_dir, exist_ok=True)
        pdf_path = os.path.join(pdf_dir, stem + '.pdf')
        print(f'  {stem}  <- {exam_year} {title}')
        if not download(PDF_BASE + path, pdf_path):
            failed.append(stem)
            continue

        out_dir = os.path.join(subject_dir, stem)
        if os.path.isdir(out_dir):
            shutil.rmtree(out_dir)
        expected = 25 if subject == '통합사회' else 20
        count = 0
        for tol in [0.5, 0.8, 1.2]:
            cropper.SIZE_TOLERANCE = tol
            if os.path.isdir(out_dir):
                shutil.rmtree(out_dir)
            count = cropper.crop_and_save(pdf_path, subject_dir)
            if count >= expected:
                break
        cropper.SIZE_TOLERANCE = 0.5

        public_dir = os.path.join(IMG_DIR, subject)
        copied = 0
        for png in sorted(os.listdir(out_dir)):
            if png.lower().endswith('.png'):
                Image.open(os.path.join(out_dir, png)).convert('RGB').save(
                    os.path.join(public_dir, os.path.splitext(png)[0] + '.jpg'),
                    'JPEG', quality=92)
                copied += 1
        print(f'      {copied}문항')
        filled.append((subject, year, cat, copied))
        time.sleep(0.3)

    print(f'\n=== {len(filled)}개 시험지 / {sum(c for *_, c in filled)}문항 채움 ===')
    if failed:
        print(f'실패 {len(failed)}건: {failed}')


if __name__ == '__main__':
    main()
