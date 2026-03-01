"""
Download history subject exam PDFs from EBS and crop into per-question images.
Subjects: 한국사, 세계사, 동아시아사
"""
import os
import sys
import re
import json
import urllib.request
import time

sys.stdout.reconfigure(encoding='utf-8')

HOME = os.path.expanduser('~')
PROJECT_DIR = os.path.join(HOME, 'Desktop', 'vibecoding', 'tongsarang')
MOCK_DIR = os.path.join(PROJECT_DIR, '모의고사')
EBS_BASE = 'https://wdown.ebsi.co.kr/W61001/01exam'
EBS_API = 'https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperListAjax.ajax'

# Subject configs: EBS subj code, image code for filenames
HISTORY_SUBJECTS = {
    '한국사': {'ebs_subj': '4', 'code': 'korhis'},
    '동아시아사': {'ebs_subj': '5', 'code': 'eahis'},  # 사회탐구 내
    '세계사': {'ebs_subj': '5', 'code': 'worhis'},     # 사회탐구 내
}

# 시험 일정: (year, month_code, exam_name)
# EBS uses calendar year for beginYear, month is the actual test month
def get_exam_schedule():
    """Generate exam schedule from 2017 to 2025."""
    schedule = []
    for year in range(2017, 2026):
        # 수능 (November of prev year for that 학년도)
        schedule.append((year, '11', '수능'))
        # 6월/9월 모의평가
        if year >= 2018:
            schedule.append((year, '06', '6월'))
            schedule.append((year, '09', '9월'))
        # 학평 (3, 4, 7, 10)
        if year >= 2018:
            schedule.append((year, '03', '3월'))
        if year in [2018, 2019, 2021, 2022, 2023]:
            schedule.append((year, '04', '4월'))
        if year >= 2024:
            schedule.append((year, '05', '5월'))
        schedule.append((year, '07', '7월'))
        schedule.append((year, '10', '10월'))
    # 2026
    schedule.append((2025, '11', '수능'))  # 2026학년도 수능 = 2025.11
    schedule.append((2026, '06', '6월'))
    schedule.append((2026, '09', '9월'))
    return schedule


def fetch_paper_list(ebs_subj, year, month):
    """Fetch paper list from EBS API."""
    data = f'targetCd=D300&beginYear={year}&endYear={year}&monthList={month}&subjList={ebs_subj}&sort=recent&pageSize=50'
    req = urllib.request.Request(
        EBS_API,
        data=data.encode('utf-8'),
        headers={
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        return ''


def extract_pdf_urls(html, subject_name):
    """Extract PDF download URLs from paper list HTML."""
    # Find goDownLoadP calls with PDF paths
    pattern = r"goDownLoadP\('([^']+)',"
    matches = re.findall(pattern, html)

    results = []
    # Also extract title to identify the subject
    title_pattern = r'<p class="tit">(.*?)</p>'
    titles = re.findall(title_pattern, html, re.DOTALL)

    for i, url_path in enumerate(matches):
        # Check if this is a PDF (ends with extension or looks like one)
        if url_path.startswith('/'):
            title = titles[i].strip().replace('&nbsp;', ' ') if i < len(titles) else ''
            # Filter by subject name
            if subject_name in title:
                # Prefer 홀수형 (type 1)
                if '짝수' not in title:
                    results.append({
                        'path': url_path,
                        'title': title,
                        'url': EBS_BASE + url_path
                    })

    return results


def download_pdf(url, save_path):
    """Download PDF from URL."""
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read()
            if len(content) < 1000:
                return False
            with open(save_path, 'wb') as f:
                f.write(content)
            return True
    except Exception as e:
        print(f'    Download error: {e}')
        return False


def main():
    # Import cropping module
    sys.path.insert(0, PROJECT_DIR)
    from fix_bottom_cutoff import crop_and_save, copy_to_public, SUBJECTS

    for subj_name, config in HISTORY_SUBJECTS.items():
        print(f"\n{'#'*60}")
        print(f"# {subj_name}")
        print(f"{'#'*60}")

        subj_dir = os.path.join(MOCK_DIR, subj_name)
        pdf_dir = os.path.join(subj_dir, '작업완료')
        os.makedirs(pdf_dir, exist_ok=True)

        code = config['code']
        ebs_subj = config['ebs_subj']

        # Download PDFs for each exam
        downloaded = 0

        for year in range(2017, 2027):
            for month in ['03', '04', '05', '06', '07', '09', '10', '11']:
                # Map to 학년도
                if month == '11':
                    haknyeondo = year + 1
                else:
                    haknyeondo = year

                pdf_name = f'{haknyeondo}_{month}_{code}'
                pdf_path = os.path.join(pdf_dir, f'{pdf_name}.pdf')

                # Skip if already downloaded
                if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 1000:
                    continue

                # Fetch paper list from EBS
                html = fetch_paper_list(ebs_subj, str(year), month)
                if not html:
                    continue

                # Extract PDF URLs matching this subject
                pdfs = extract_pdf_urls(html, subj_name)

                if not pdfs:
                    # For 사회탐구 subjects (동아시아사, 세계사), need more specific search
                    if ebs_subj == '5':
                        # Also search without exact name match - grab all social studies PDFs
                        pattern = r"goDownLoadP\('([^']+)',"
                        all_matches = re.findall(pattern, html)
                        title_pattern = r'<p class="tit">(.*?)</p>'
                        all_titles = re.findall(title_pattern, html, re.DOTALL)

                        for idx, path in enumerate(all_matches):
                            if idx < len(all_titles):
                                title = all_titles[idx].strip().replace('&nbsp;', ' ')
                                if subj_name in title and '짝수' not in title and path.startswith('/'):
                                    pdfs.append({'path': path, 'title': title, 'url': EBS_BASE + path})

                if not pdfs:
                    continue

                # Download first matching PDF
                pdf_info = pdfs[0]
                sys.stdout.write(f'  {pdf_name} ({pdf_info["title"][:40]})... ')
                sys.stdout.flush()

                if download_pdf(pdf_info['url'], pdf_path):
                    size_kb = os.path.getsize(pdf_path) // 1024
                    print(f'OK ({size_kb}KB)')
                    downloaded += 1
                else:
                    print('FAIL')
                    if os.path.exists(pdf_path):
                        os.remove(pdf_path)

                time.sleep(0.3)

        print(f'\n  {subj_name}: {downloaded} PDFs downloaded')

        # Count total PDFs
        all_pdfs = [f for f in os.listdir(pdf_dir) if f.endswith('.pdf')]
        print(f'  Total PDFs in 작업완료: {len(all_pdfs)}')

        # Crop all PDFs
        print(f'\n  Cropping {len(all_pdfs)} PDFs...')
        total_questions = 0
        for pdf_file in sorted(all_pdfs):
            pdf_path = os.path.join(pdf_dir, pdf_file)
            pdf_name = os.path.splitext(pdf_file)[0]
            out_dir = os.path.join(subj_dir, pdf_name)

            # Skip if already cropped
            if os.path.isdir(out_dir) and len([f for f in os.listdir(out_dir) if f.endswith('.png')]) >= 15:
                total_questions += len([f for f in os.listdir(out_dir) if f.endswith('.png')])
                continue

            try:
                count = crop_and_save(pdf_path, subj_dir)
                total_questions += count
            except Exception as e:
                print(f'  ERROR: {pdf_file}: {e}')

        print(f'\n  {subj_name}: {total_questions} questions cropped')

        # Copy to public/images/
        public_dir = os.path.join(PROJECT_DIR, 'public', 'images', subj_name)
        os.makedirs(public_dir, exist_ok=True)

        # Add to SUBJECTS dict for copy function
        if subj_name not in SUBJECTS:
            SUBJECTS[subj_name] = code

        copied = copy_to_public(subj_name, code)
        print(f'  Copied {copied} images to public/images/{subj_name}/')


if __name__ == '__main__':
    main()
