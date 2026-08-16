# © 2026 김용현
"""
Download 2026-administered exam PDFs from EBSi and crop them into per-question images.

EBSi changed its paper-list API: the old beginYear/endYear/subjList parameters now
return 0 results. Current contract is yearList/monthList/arOrd/subjIdList.

Usage:
    python scripts/fetch_ebsi_2026.py            # download + crop + copy to public/
    python scripts/fetch_ebsi_2026.py --list     # just print what EBSi offers
    python scripts/fetch_ebsi_2026.py --no-crop  # download only
"""
import os
import re
import sys
import time
import argparse
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

HOME = os.path.expanduser('~')
PROJECT_DIR = os.path.join(HOME, 'Desktop', 'vibecoding', 'tongsarang')
MOCK_DIR = os.path.join(PROJECT_DIR, '모의고사')
PUBLIC_IMG_DIR = os.path.join(PROJECT_DIR, 'public', 'images')

LIST_API = 'https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperListAjax.ajax'
PDF_BASE = 'https://wdown.ebsi.co.kr/W61001/01exam'

# 과목 → (이미지 코드, targetCd, arOrd, subjId, 학년)
# 학년은 통합사회에서만 쓰인다. 나머지 과목은 ''.
SUBJECTS = {
    '생활과윤리': ('leth', 'D300', '5', '63002', ''),
    '윤리와사상': ('ethth', 'D300', '5', '63003', ''),
    '한국지리': ('korgeo', 'D300', '5', '141', ''),
    '세계지리': ('wgeo', 'D300', '5', '142', ''),
    '동아시아사': ('eahis', 'D300', '5', '63001', ''),
    '세계사': ('worhis', 'D300', '5', '146', ''),
    '정치와법': ('pollaw', 'D300', '5', '140112', ''),
    '경제': ('econ', 'D300', '5', '66002', ''),
    '사회문화': ('socul', 'D300', '5', '66001', ''),
    '한국사': ('korhis', 'D300', '4', '63004', ''),
    '통합사회_고1': ('iss', 'D100', '5', '140072', '고1'),
    '통합사회_고2': ('iss2', 'D200', '5', '140220', '고2'),
}

# 데이터 폴더명은 학년 접미사 없이 '통합사회' 하나를 쓴다.
def data_subject(key):
    return key.split('_')[0]


MONTHS = ['03', '05', '06', '07']
EBS_YEAR = '2026'


def label_year(month, is_moc):
    """모평·수능은 학년도, 학평은 시행연도로 표기하는 기존 규칙."""
    if is_moc or month == '11':
        return str(int(EBS_YEAR) + 1)
    return EBS_YEAR


def fetch_list(target_cd, ar_ord, subj_id):
    body = (
        f'targetCd={target_cd}&yearList={EBS_YEAR}'
        f'&monthList={",".join(MONTHS)}'
        f'&arOrd={ar_ord}&subjIdList={subj_id}&sort=recent&currentPage=1'
    )
    req = urllib.request.Request(
        LIST_API,
        data=body.encode('utf-8'),
        headers={
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Referer': 'https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperList.ebs',
            'X-Requested-With': 'XMLHttpRequest',
        },
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read().decode('utf-8', errors='replace')


def parse_list(html):
    """목록 HTML에서 (제목, 월, 모평여부, PDF경로)를 뽑는다."""
    papers = []
    for block in html.split('<div class="qus_box')[1:]:
        m_title = re.search(r'<div class="qus_tit">(.*?)</div>', block, re.DOTALL)
        m_pdf = re.search(r"goDownLoadP\('([^']+\.pdf)'", block)
        if not m_title or not m_pdf:
            continue
        title = ' '.join(m_title.group(1).split()).replace('&nbsp;', ' ').strip()
        if '짝수' in title:
            continue
        m_month = re.search(r'고[123]\s*(\d{1,2})월', title)
        if not m_month:
            continue
        papers.append({
            'title': title,
            'month': m_month.group(1).zfill(2),
            'is_moc': '모평' in title,
            'path': m_pdf.group(1),
        })
    return papers


def download(url, save_path):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as resp:
        content = resp.read()
    if len(content) < 10000 or not content.startswith(b'%PDF'):
        return False
    with open(save_path, 'wb') as f:
        f.write(content)
    return True


def collect(list_only=False):
    """모든 과목의 2026 시행 시험지를 내려받고 (과목키, pdf이름) 목록을 돌려준다."""
    fetched = []
    for subj_key, (code, target_cd, ar_ord, subj_id, _grade) in SUBJECTS.items():
        try:
            papers = parse_list(fetch_list(target_cd, ar_ord, subj_id))
        except Exception as e:
            print(f'  {subj_key}: 목록 조회 실패 - {e}')
            continue

        print(f'\n## {subj_key} ({len(papers)}건)')
        pdf_dir = os.path.join(MOCK_DIR, data_subject(subj_key), '작업완료')
        os.makedirs(pdf_dir, exist_ok=True)

        for p in papers:
            year = label_year(p['month'], p['is_moc'])
            pdf_name = f"{year}_{p['month']}_{code}"
            pdf_path = os.path.join(pdf_dir, pdf_name + '.pdf')
            print(f"   {pdf_name}  <- {p['title']}")
            if list_only:
                continue
            if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 10000:
                fetched.append((subj_key, pdf_name))
                continue
            if download(PDF_BASE + p['path'], pdf_path):
                print(f'      다운로드 OK ({os.path.getsize(pdf_path)//1024}KB)')
                fetched.append((subj_key, pdf_name))
            else:
                print('      다운로드 실패')
                if os.path.exists(pdf_path):
                    os.remove(pdf_path)
            time.sleep(0.3)
    return fetched


EXPECTED_QUESTIONS = {'통합사회': 25}

# 문항 번호 글꼴 크기가 시험지 안에서 미세하게 달라(예: 13.4pt / 14.0pt) 일부 문항이
# 검출에서 빠지는 경우가 있다. 기본 허용 오차부터 시작해 필요할 때만 넓혀 다시 자른다.
SIZE_TOLERANCES = [0.5, 0.8, 1.2]


def png_count(out_dir):
    if not os.path.isdir(out_dir):
        return 0
    return len([f for f in os.listdir(out_dir) if f.lower().endswith('.png')])


def crop_with_retry(pdf_path, subject_dir, out_dir, pdf_name, expected):
    import shutil
    import fix_bottom_cutoff as cropper

    original = cropper.SIZE_TOLERANCE
    try:
        for tol in SIZE_TOLERANCES:
            if os.path.isdir(out_dir):
                shutil.rmtree(out_dir)
            cropper.SIZE_TOLERANCE = tol
            count = cropper.crop_and_save(pdf_path, subject_dir)
            if count >= expected:
                return count
            print(f'  {pdf_name}: {count}/{expected}문항 — 글꼴 허용 오차 {tol} 로는 부족')
        print(f'  ! {pdf_name}: {png_count(out_dir)}/{expected}문항만 추출됨. 수동 확인 필요')
        return png_count(out_dir)
    finally:
        cropper.SIZE_TOLERANCE = original


def crop_all(fetched):
    sys.path.insert(0, PROJECT_DIR)
    from PIL import Image

    total = 0
    for subj_key, pdf_name in fetched:
        subject = data_subject(subj_key)
        subject_dir = os.path.join(MOCK_DIR, subject)
        pdf_path = os.path.join(subject_dir, '작업완료', pdf_name + '.pdf')
        out_dir = os.path.join(subject_dir, pdf_name)

        expected = EXPECTED_QUESTIONS.get(subject, 20)
        if os.path.isdir(out_dir) and png_count(out_dir) >= expected:
            print(f'  {pdf_name}: 이미 크롭됨, 건너뜀')
        else:
            try:
                crop_with_retry(pdf_path, subject_dir, out_dir, pdf_name, expected)
            except Exception as e:
                print(f'  ERROR {pdf_name}: {e}')
                continue

        # PNG -> JPG 복사 (이 시험지 것만)
        public_dir = os.path.join(PUBLIC_IMG_DIR, subject)
        os.makedirs(public_dir, exist_ok=True)
        copied = 0
        for png in sorted(os.listdir(out_dir)):
            if not png.lower().endswith('.png'):
                continue
            img = Image.open(os.path.join(out_dir, png)).convert('RGB')
            img.save(os.path.join(public_dir, os.path.splitext(png)[0] + '.jpg'), 'JPEG', quality=92)
            copied += 1
        print(f'  {pdf_name}: {copied}문항 -> public/images/{subject}/')
        total += copied
    return total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--list', action='store_true', help='목록만 출력')
    ap.add_argument('--no-crop', action='store_true', help='다운로드만')
    args = ap.parse_args()

    fetched = collect(list_only=args.list)
    if args.list:
        return
    print(f'\n=== PDF {len(fetched)}건 확보 ===')
    if args.no_crop:
        return
    total = crop_all(fetched)
    print(f'\n=== 이미지 {total}개 생성 ===')


if __name__ == '__main__':
    main()
