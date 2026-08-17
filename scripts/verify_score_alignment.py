# © 2026 김용현
"""시험지 PDF와 데이터 행이 같은 시험인지 배점으로 교차 검증한다.

정답·정답률은 메가스터디에서, 이미지는 EBSi PDF에서 온다. 두 출처가 어긋나면
(모평 이미지가 한 해씩 밀렸던 사고처럼) 정답은 맞는데 문제는 다른 시험이 된다.

PDF 안에서 [3점] 표시가 붙은 문항 번호를 뽑아, 데이터의 배점 3점 문항과 비교한다.
두 집합이 같으면 같은 시험지로 본다. 사탐은 보통 20문항 중 3~5문항이 3점이라
우연히 일치할 확률이 낮다.

    python scripts/verify_score_alignment.py              # 전 과목
    python scripts/verify_score_alignment.py 세계사        # 한 과목만
"""
import os
import re
import sys
import json

import fitz

sys.stdout.reconfigure(encoding='utf-8')

HOME = os.path.expanduser('~')
PROJECT_DIR = os.path.join(HOME, 'Desktop', 'vibecoding', 'tongsarang')
sys.path.insert(0, PROJECT_DIR)
import fix_bottom_cutoff as cropper  # noqa: E402

MOCK_DIR = os.path.join(PROJECT_DIR, '모의고사')
DATA_DIR = os.path.join(PROJECT_DIR, 'public', 'data')

CODES = {
    '한국지리': 'korgeo', '세계지리': 'wgeo', '통합사회': 'iss', '한국사': 'korhis',
    '정치와법': 'pollaw', '경제': 'econ', '사회문화': 'socul', '생활과윤리': 'leth',
    '윤리와사상': 'ethth', '동아시아사': 'eahis', '세계사': 'worhis',
}
CATEGORY_TO_MONTH = {
    '수능': '11', '9모': '09', '6모': '06', '10월학평': '10', '7월학평': '07',
    '5월학평': '05', '4월학평': '04', '3월학평': '03', '11월': '11', '10월': '10',
    '9월': '09', '7월': '07', '6월': '06', '5월': '05', '4월': '04', '3월': '03',
}


def pdf_three_point_questions(pdf_path):
    """PDF에서 [3점] 이 붙은 문항 번호 집합을 뽑는다."""
    doc = fitz.open(pdf_path)
    try:
        questions, _groups, _map = cropper.extract_question_regions(doc)
    except Exception:
        doc.close()
        return None
    bands = {}
    for q_num, page_idx, x0, y0, x1, y1 in questions:
        bands.setdefault(page_idx, []).append((q_num, x0, y0, x1, y1))

    three = set()
    for page_idx, page in enumerate(doc):
        if page_idx not in bands:
            continue
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                text = ''.join(s['text'] for s in line['spans'])
                if '3점' not in text:
                    continue
                bx0, by0, bx1, by1 = line['bbox']
                cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
                for q_num, x0, y0, x1, y1 in bands[page_idx]:
                    if x0 <= cx <= x1 and y0 <= cy <= y1:
                        three.add(q_num)
                        break
    doc.close()
    return three


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    subjects = [only] if only else list(CODES)

    mismatches, checked, skipped = [], 0, 0
    for subject in subjects:
        code = CODES[subject]
        data = json.load(open(os.path.join(DATA_DIR, f'{subject}.json'), encoding='utf-8'))
        exams = {}
        for row in data:
            exams.setdefault((row['학년도'], row['분류'], row.get('학년', '')), []).append(row)

        for (year, cat, grade), rows in sorted(exams.items()):
            month = CATEGORY_TO_MONTH.get(cat)
            if not month:
                continue
            stem_code = 'iss2' if code == 'iss' and grade == '고2' else code
            pdf_path = os.path.join(MOCK_DIR, subject, '작업완료', f'{year}_{month}_{stem_code}.pdf')
            if not os.path.exists(pdf_path):
                skipped += 1
                continue

            pdf_three = pdf_three_point_questions(pdf_path)
            if pdf_three is None or not pdf_three:
                skipped += 1
                continue
            data_three = {int(r['번호']) for r in rows if str(r['배점']).strip() in ('3', '3.0')}
            if not data_three:
                skipped += 1
                continue

            checked += 1
            if pdf_three != data_three:
                mismatches.append({
                    'subject': subject, 'exam': f'{year} {grade} {cat}'.replace('  ', ' '),
                    'pdf': sorted(pdf_three), 'data': sorted(data_three),
                })

    print(f'\n=== 검증 {checked}개 시험지 / 불일치 {len(mismatches)}개 (PDF 없음 등 건너뜀 {skipped}) ===')
    for m in mismatches:
        print(f"  {m['subject']} {m['exam']}")
        print(f"     PDF  3점 문항: {m['pdf']}")
        print(f"     데이터 3점 문항: {m['data']}")
    return 1 if mismatches else 0


if __name__ == '__main__':
    sys.exit(main())
