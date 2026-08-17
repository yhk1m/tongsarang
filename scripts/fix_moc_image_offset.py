# © 2026 김용현
"""한국사·동아시아사·세계사의 모평(6월·9월) 이미지가 한 해씩 밀린 것을 바로잡는다.

## 무엇이 잘못됐나

이 세 과목은 `download_and_crop_history.py`로 추가됐는데, 그 스크립트는 파일 이름을
"11월(수능)만 시행연도+1, 나머지는 시행연도"로 만든다. 학평은 데이터도 시행연도
표기라 맞지만, **모평(6·9월)은 데이터가 학년도 표기**라 한 칸 어긋난다.

    데이터 행 '2025 6월' = 2025학년도 6월 모평 = 2024년 6월 시행
    붙어 있던 이미지 2025_06_worhis = 2025년 6월 시행   ← 한 해 뒤 시험지

EBSi 원본과 로컬 PDF를 sha1로 대조해 확정했다. 나머지 8개 과목은 정상이다.
정답·정답률은 메가스터디에서 따로 받아 맞으므로, 이미지와 그 이미지에서 OCR한
발문·문항내용만 틀려 있다.

## 무엇을 하나

라벨 학년도 Y의 모평 이미지를 EBSi의 (Y-1)년 시험지에서 다시 만든다.
발문·문항내용은 비워서 ocr_subjects.cjs가 다시 채우게 한다.

    python scripts/fix_moc_image_offset.py --list   # 대상만 출력
    python scripts/fix_moc_image_offset.py          # 재수집 + 재크롭 + 텍스트 비우기
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
MOCK_DIR = os.path.join(PROJECT_DIR, '모의고사')
PUBLIC_IMG_DIR = os.path.join(PROJECT_DIR, 'public', 'images')
DATA_DIR = os.path.join(PROJECT_DIR, 'public', 'data')

LIST_API = 'https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperListAjax.ajax'
PDF_BASE = 'https://wdown.ebsi.co.kr/W61001/01exam'

# 과목 → (이미지 코드, arOrd, subjId)
SUBJECTS = {
    '한국사': ('korhis', '4', '63004'),
    '동아시아사': ('eahis', '5', '63001'),
    '세계사': ('worhis', '5', '146'),
}
# 라벨 학년도 범위. 2027 6월은 이번에 새로 넣으면서 이미 올바르게 만들었다.
LABEL_YEARS = range(2018, 2027)
# EBSi는 시행일 기준 월로 분류한다. 2023학년도 9월 모평은 2022.08.31 시행이라 08에 있다.
MONTHS = {'6월': ('06', ['06', '05']), '9월': ('09', ['09', '08', '10'])}
EXPECTED = 20


def fetch_list(ebs_year, month, ar_ord, subj_id):
    body = (f'targetCd=D300&yearList={ebs_year}&monthList={month}'
            f'&arOrd={ar_ord}&subjIdList={subj_id}&sort=recent&currentPage=1')
    req = urllib.request.Request(
        LIST_API, data=body.encode('utf-8'),
        headers={'User-Agent': 'Mozilla/5.0',
                 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                 'Referer': 'https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperList.ebs',
                 'X-Requested-With': 'XMLHttpRequest'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode('utf-8', errors='replace')


def pick_paper(html):
    """모평 문제지(홀수형) 하나를 고른다."""
    for block in html.split('<div class="qus_box')[1:]:
        m_title = re.search(r'<div class="qus_tit">(.*?)</div>', block, re.DOTALL)
        m_pdf = re.search(r"goDownLoadP\('([^']+\.pdf)'", block)
        if not m_title or not m_pdf:
            continue
        title = ' '.join(m_title.group(1).split()).replace('&nbsp;', ' ').strip()
        if '짝수' in title or '모평' not in title:
            continue
        return title, m_pdf.group(1)
    return None, None


def download(url, save_path):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=90) as resp:
        content = resp.read()
    if len(content) < 10000 or not content.startswith(b'%PDF'):
        return False
    with open(save_path, 'wb') as f:
        f.write(content)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--list', action='store_true', help='대상만 출력')
    args = ap.parse_args()

    sys.path.insert(0, PROJECT_DIR)
    if not args.list:
        import fix_bottom_cutoff as cropper
        from PIL import Image

    done, failed = [], []
    for subject, (code, ar_ord, subj_id) in SUBJECTS.items():
        subject_dir = os.path.join(MOCK_DIR, subject)
        pdf_dir = os.path.join(subject_dir, '작업완료')
        os.makedirs(pdf_dir, exist_ok=True)
        public_dir = os.path.join(PUBLIC_IMG_DIR, subject)

        print(f'\n{"#" * 60}\n# {subject}\n{"#" * 60}')
        for label_year in LABEL_YEARS:
            for cat, (month, candidates) in MONTHS.items():
                ebs_year = label_year - 1
                stem = f'{label_year}_{month}_{code}'
                title = path = found_month = None
                try:
                    for mm in candidates:
                        title, path = pick_paper(fetch_list(ebs_year, mm, ar_ord, subj_id))
                        if path:
                            found_month = mm
                            break
                except Exception as e:
                    print(f'  {stem}: 목록 조회 실패 - {e}')
                    failed.append(stem)
                    continue
                if not path:
                    print(f'  {stem}: EBSi에 {ebs_year}년 {cat} 모평 없음')
                    failed.append(stem)
                    continue
                print(f'  {stem}  <- {ebs_year}.{found_month} {title}')
                if args.list:
                    continue

                pdf_path = os.path.join(pdf_dir, stem + '.pdf')
                if not download(PDF_BASE + path, pdf_path):
                    print('      다운로드 실패')
                    failed.append(stem)
                    continue

                out_dir = os.path.join(subject_dir, stem)
                if os.path.isdir(out_dir):
                    shutil.rmtree(out_dir)
                count = 0
                for tol in [0.5, 0.8, 1.2, 1.6]:
                    cropper.SIZE_TOLERANCE = tol
                    if os.path.isdir(out_dir):
                        shutil.rmtree(out_dir)
                    count = cropper.crop_and_save(pdf_path, subject_dir)
                    if count >= EXPECTED:
                        break
                cropper.SIZE_TOLERANCE = 0.5
                if count < EXPECTED:
                    print(f'      ! {count}/{EXPECTED}문항만 추출됨')

                copied = 0
                for png in sorted(os.listdir(out_dir)):
                    if not png.lower().endswith('.png'):
                        continue
                    img = Image.open(os.path.join(out_dir, png)).convert('RGB')
                    img.save(os.path.join(public_dir, os.path.splitext(png)[0] + '.jpg'),
                             'JPEG', quality=92)
                    copied += 1
                print(f'      {copied}문항 교체')
                done.append((subject, str(label_year), cat, copied))
                time.sleep(0.3)

    if args.list:
        return

    # 잘못된 이미지에서 뽑았던 발문·문항내용을 비운다 (ocr_subjects.cjs가 다시 채운다)
    cleared = 0
    for subject in SUBJECTS:
        data_path = os.path.join(DATA_DIR, f'{subject}.json')
        data = json.load(open(data_path, encoding='utf-8'))
        targets = {(y, c) for s, y, c, _n in done if s == subject}
        for row in data:
            if (row['학년도'], row['분류']) in targets:
                row['발문'] = ''
                row['문항내용'] = ''
                cleared += 1
        json.dump(data, open(data_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

    print(f'\n=== 시험지 {len(done)}개 교체, {sum(n for *_, n in done)}문항 ===')
    print(f'=== 발문·문항내용 {cleared}행 비움 → ocr_subjects.cjs 재실행 필요 ===')
    if failed:
        print(f'\n실패 {len(failed)}건: {failed}')


if __name__ == '__main__':
    main()
