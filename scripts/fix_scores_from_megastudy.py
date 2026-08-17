# © 2026 김용현
"""배점(그리고 통째로 어긋난 시험지의 답·정답률·난이도)을 메가스터디 기준으로 바로잡는다.

## 왜 필요한가

- 생활과윤리·윤리와사상·세계지리·경제·사회문화·정치와법의 **모평·수능 시험지 배점이
  전부 2점**으로 들어가 있다. 정상은 20문항 중 10개가 3점이다. (학평은 정상)
- 한국지리 `2026 수능` 행에는 **2025년 10월 학평의 답·배점·정답률**이 복사돼 있었다.

## 안전장치

메가스터디를 그대로 믿고 덮어쓰지 않는다. **시험지 PDF에서 [3점] 표시가 붙은 문항
번호**를 제3의 근거로 뽑아, 메가스터디의 3점 문항과 일치할 때만 그 시험지를 갱신한다.
PDF가 없거나 두 근거가 어긋나면 건너뛰고 보고만 한다.

답은 일괄 덮어쓰지 않는다. 오류 제보를 반영해 손으로 고친 정답이 있기 때문이다
(예: 윤리와사상 2022 3월 11번). 시험지 전체가 다른 시험의 복사본일 때만 교체한다.

    python scripts/fix_scores_from_megastudy.py --report   # 진단만
    python scripts/fix_scores_from_megastudy.py            # 적용
"""
import os
import re
import sys
import json
import argparse
import subprocess
import tempfile

import fitz

sys.stdout.reconfigure(encoding='utf-8')

HOME = os.path.expanduser('~')
PROJECT_DIR = os.path.join(HOME, 'Desktop', 'vibecoding', 'tongsarang')
sys.path.insert(0, PROJECT_DIR)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from exam_calendar import (  # noqa: E402
    MEGASTUDY_SUBJECT, CATEGORY_TO_MONTH as CAT_MONTH, megastudy_seq, image_code)

DATA_DIR = os.path.join(PROJECT_DIR, 'public', 'data')
MOCK_DIR = os.path.join(PROJECT_DIR, '모의고사')
RATE_API = 'https://www.megastudy.net/Entinfo/correctRate/main_rate_ax.asp'

_mega_cache = {}


def megastudy(seq, tab, sub_cd):
    key = (seq, tab, sub_cd)
    if key in _mega_cache:
        return _mega_cache[key]
    body = f'examSeq={seq}&tabNo={tab}'
    if sub_cd:
        body += f'&selSubCd={sub_cd}'
    tmp = os.path.join(tempfile.gettempdir(), f'mega_{seq}_{tab}_{sub_cd}.bin')
    try:
        subprocess.run(['curl', '-s', '-X', 'POST', RATE_API, '-d', body, '--output', tmp],
                       check=True, timeout=30)
        html = open(tmp, 'rb').read().decode('euc-kr', errors='replace')
    except Exception:
        _mega_cache[key] = None
        return None
    values = [v.strip() for v in re.findall(r'<td class="two">(.*?)</td>', html)]
    rows = {}
    for i in range(0, len(values) - 9, 10):
        rows[int(values[i])] = {
            '답': values[i + 1], '난이도': values[i + 2],
            '배점': values[i + 3], '정답률': values[i + 4].replace('%', ''),
        }
    out = rows or None
    _mega_cache[key] = out
    return out


def pdf_three_point(pdf_path):
    """PDF 본문에서 [3점]이 붙은 문항 번호. 텍스트 순서만 쓰므로 크롭 로직과 독립적이다."""
    doc = fitz.open(pdf_path)
    text = ''
    for page in doc:
        text += page.get_text()
    doc.close()
    text = re.sub(r'\s+', ' ', text)
    pos = {}
    for m in re.finditer(r'(?<![0-9])(\d{1,2})\.\s', text):
        n = int(m.group(1))
        if 1 <= n <= 25 and n not in pos:
            pos[n] = m.start()
    three = set()
    for n, start in pos.items():
        later = [p for p in pos.values() if p > start]
        end = min(later) if later else len(text)
        if '3점' in text[start:end]:
            three.add(n)
    return three


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--report', action='store_true', help='진단만 하고 쓰지 않음')
    args = ap.parse_args()

    fixed_scores, replaced_exams, answer_diffs, skipped = [], [], [], []

    for subject, (tab, sub_cd) in MEGASTUDY_SUBJECT.items():
        data_path = os.path.join(DATA_DIR, f'{subject}.json')
        data = json.load(open(data_path, encoding='utf-8'))
        exams = {}
        for row in data:
            exams.setdefault((row['학년도'], row['분류']), []).append(row)

        changed = False
        for (year, cat), rows in sorted(exams.items()):
            seq = megastudy_seq(subject, year, cat)
            if not seq:
                continue
            mega = megastudy(seq, tab, sub_cd)
            if not mega:
                continue
            month = CAT_MONTH.get(cat)
            code = image_code(subject)
            pdf_path = os.path.join(MOCK_DIR, subject, '작업완료', f'{year}_{month}_{code}.pdf')
            if not os.path.exists(pdf_path):
                skipped.append(f'{subject} {year} {cat} (PDF 없음)')
                continue

            pdf_three = pdf_three_point(pdf_path)
            mega_three = {n for n, m in mega.items() if m['배점'].strip() == '3'}
            if not pdf_three or pdf_three != mega_three:
                skipped.append(f'{subject} {year} {cat} (PDF {sorted(pdf_three)} ≠ 메가 {sorted(mega_three)})')
                continue

            # 시험지 전체가 다른 시험의 복사본인가? (답이 과반 불일치)
            paired = [(r, mega[int(r['번호'])]) for r in rows if int(r['번호']) in mega]
            wrong_ans = sum(1 for r, m in paired if str(r['답']).strip() != m['답'].strip())
            whole_exam_wrong = paired and wrong_ans > len(paired) / 2

            n_score = 0
            for row, m in paired:
                want = float(m['배점'])
                if float(row['배점'] or 0) != want:
                    if not args.report:
                        row['배점'] = want if isinstance(row['배점'], (int, float)) else str(int(want))
                    n_score += 1
                    changed = True
                if whole_exam_wrong:
                    if not args.report:
                        row['답'] = int(m['답']) if isinstance(row['답'], (int, float)) else m['답']
                        row['정답률'] = m['정답률']
                        row['난이도'] = m['난이도']
                    changed = True
                elif str(row['답']).strip() != m['답'].strip():
                    answer_diffs.append(f"{subject} {year} {cat} {row['번호']}번: 데이터 {row['답']} / 메가 {m['답']}")

            if whole_exam_wrong:
                replaced_exams.append(f'{subject} {year} {cat} ({wrong_ans}/{len(paired)}문항 답 불일치 → 전체 교체)')
            if n_score:
                fixed_scores.append(f'{subject} {year} {cat}: 배점 {n_score}문항')

        if changed and not args.report:
            json.dump(data, open(data_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

    verb = '발견' if args.report else '수정'
    print(f'=== 배점 {verb}: {len(fixed_scores)}개 시험지 ===')
    for s in fixed_scores[:40]:
        print('  ' + s)
    if len(fixed_scores) > 40:
        print(f'  ... 외 {len(fixed_scores) - 40}개')

    print(f'\n=== 시험지 통째 교체: {len(replaced_exams)}개 ===')
    for s in replaced_exams:
        print('  ' + s)

    print(f'\n=== 답 단건 차이 (자동 수정 안 함, 확인 필요): {len(answer_diffs)}건 ===')
    for s in answer_diffs:
        print('  ' + s)

    print(f'\n=== 검증 불가로 건너뜀: {len(skipped)}개 ===')
    for s in skipped[:15]:
        print('  ' + s)
    if len(skipped) > 15:
        print(f'  ... 외 {len(skipped) - 15}개')


if __name__ == '__main__':
    main()
