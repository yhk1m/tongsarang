# © 2026 김용현
"""시험지 PDF를 기준으로 배점(및 통째로 어긋난 시험지의 답·정답률·난이도)을 바로잡는다.

## 왜 필요한가

- 생활과윤리·윤리와사상·세계지리·경제·사회문화·정치와법의 **모평·수능 배점이 전부 2점**
  으로 들어가 있다. 정상은 20문항 중 10개가 3점이다.
- 한국지리 `2026 수능` 행에는 **2025년 10월 학평의 답·배점·정답률**이 들어가 있었다.

## 어느 것을 진실로 보는가

사용자가 보는 것은 **이미지**이므로, 메타데이터를 이미지에 맞춘다.

1. 시험지 PDF에서 `[3점]`이 붙은 문항 번호를 뽑는다. (크롭 로직과 무관한 텍스트 순서 기반)
2. 라벨 연도 ±2년 범위의 메가스터디 시험 중, 3점 문항 집합이 **정확히 하나만** 일치하는
   시험을 찾는다. 20문항 중 10개의 위치가 통째로 같을 확률은 낮아 사실상 동일 시험이다.
3. 그 시험의 배점을 쓴다. 답이 과반 다르면 시험지 전체가 어긋난 것으로 보고
   답·정답률·난이도까지 교체한다.

답을 일괄 덮어쓰지는 않는다. 오류 제보를 반영해 손으로 고친 정답이 있기 때문이다
(예: 윤리와사상 2022 3월 11번). 단건 차이는 보고만 한다.

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
from exam_calendar import MEGASTUDY_SUBJECT, CATEGORY_TO_MONTH, image_code  # noqa: E402

DATA_DIR = os.path.join(PROJECT_DIR, 'public', 'data')
MOCK_DIR = os.path.join(PROJECT_DIR, '모의고사')
RATE_API = 'https://www.megastudy.net/Entinfo/correctRate/main_rate_ax.asp'
NAME_API = 'https://www.megastudy.net/Entinfo/correctRate/main_examNm_ax.asp'


def _post(url, body, name):
    tmp = os.path.join(tempfile.gettempdir(), name)
    subprocess.run(['curl', '-s', '-X', 'POST', url, '-d', body, '--output', tmp],
                   check=True, timeout=40)
    return open(tmp, 'rb').read().decode('euc-kr', errors='replace')


def exam_index():
    """메가스터디 고3 시험 목록 → {examSeq: 'YYYY.MM.DD ...'}"""
    out = {}
    for year in range(2016, 2028):
        try:
            html = _post(NAME_API, f'grdFlg=3&examYear={year}', f'nm_{year}.bin')
        except Exception:
            continue
        for m in re.finditer(r'fncSelExamSeq\((\d+),[^)]*\);">([^<]+)</li>', html):
            out[int(m.group(1))] = m.group(2).strip()
    return out


_rate_cache = {}


def megastudy(seq, tab, sub_cd):
    key = (seq, tab, sub_cd)
    if key in _rate_cache:
        return _rate_cache[key]
    body = f'examSeq={seq}&tabNo={tab}' + (f'&selSubCd={sub_cd}' if sub_cd else '')
    try:
        html = _post(RATE_API, body, f'mega_{seq}_{tab}_{sub_cd}.bin')
    except Exception:
        _rate_cache[key] = None
        return None
    values = [v.strip() for v in re.findall(r'<td class="two">(.*?)</td>', html)]
    rows = {}
    for i in range(0, len(values) - 9, 10):
        rows[int(values[i])] = {'답': values[i + 1], '난이도': values[i + 2],
                                '배점': values[i + 3], '정답률': values[i + 4].replace('%', '')}
    out = rows or None
    _rate_cache[key] = out
    return out


def pdf_three_point(pdf_path):
    """PDF 본문에서 [3점]이 붙은 문항 번호 집합."""
    doc = fitz.open(pdf_path)
    text = ''.join(page.get_text() for page in doc)
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
    ap.add_argument('--report', action='store_true')
    args = ap.parse_args()

    print('메가스터디 시험 목록 수집 중...')
    seq_date = exam_index()
    print(f'  시험 {len(seq_date)}개')

    fixed, replaced, answer_diffs, skipped = [], [], [], []

    for subject, (tab, sub_cd) in MEGASTUDY_SUBJECT.items():
        data_path = os.path.join(DATA_DIR, f'{subject}.json')
        data = json.load(open(data_path, encoding='utf-8'))
        exams = {}
        for row in data:
            exams.setdefault((row['학년도'], row['분류']), []).append(row)

        changed = False
        for (year, cat), rows in sorted(exams.items()):
            month = CATEGORY_TO_MONTH.get(cat)
            if not month:
                continue
            pdf_path = os.path.join(MOCK_DIR, subject, '작업완료',
                                    f'{year}_{month}_{image_code(subject)}.pdf')
            if not os.path.exists(pdf_path):
                skipped.append(f'{subject} {year} {cat} (PDF 없음)')
                continue
            pdf_three = pdf_three_point(pdf_path)
            if not pdf_three:
                skipped.append(f'{subject} {year} {cat} ([3점] 표시 없음)')
                continue

            # 라벨 연도 ±2년 안에서 3점 위치가 같은 시험을 찾는다
            hits = []
            for seq, date in seq_date.items():
                if abs(int(date[:4]) - int(year)) > 2 or date[5:7] != month:
                    continue
                mega = megastudy(seq, tab, sub_cd)
                if mega and {n for n, m in mega.items() if m['배점'].strip() == '3'} == pdf_three:
                    hits.append((seq, date, mega))
            if len(hits) != 1:
                skipped.append(f'{subject} {year} {cat} (일치 시험 {len(hits)}개)')
                continue
            seq, date, mega = hits[0]

            paired = [(r, mega[int(r['번호'])]) for r in rows if int(r['번호']) in mega]
            wrong = sum(1 for r, m in paired if str(r['답']).strip() != m['답'].strip())
            whole_wrong = bool(paired) and wrong > len(paired) / 2

            n_score = 0
            for row, m in paired:
                want = float(m['배점'])
                if float(row['배점'] or 0) != want:
                    if not args.report:
                        row['배점'] = want if isinstance(row['배점'], (int, float)) else str(int(want))
                    n_score += 1
                    changed = True
                if whole_wrong:
                    if not args.report:
                        row['답'] = int(m['답']) if isinstance(row['답'], (int, float)) else m['답']
                        row['정답률'] = m['정답률']
                        row['난이도'] = m['난이도']
                    changed = True
                elif str(row['답']).strip() != m['답'].strip():
                    answer_diffs.append(
                        f"{subject} {year} {cat} {row['번호']}번: 데이터 {row['답']} / 메가 {m['답']}")

            if whole_wrong:
                replaced.append(f'{subject} {year} {cat} → {date[:10]} ({wrong}/{len(paired)}문항 답 불일치)')
            if n_score:
                fixed.append(f'{subject} {year} {cat}: 배점 {n_score}문항 (={date[:10]})')

        if changed and not args.report:
            json.dump(data, open(data_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

    verb = '발견' if args.report else '수정'
    print(f'\n=== 배점 {verb}: {len(fixed)}개 시험지 ===')
    for s in fixed[:30]:
        print('  ' + s)
    if len(fixed) > 30:
        print(f'  ... 외 {len(fixed) - 30}개')
    print(f'\n=== 시험지 통째 교체: {len(replaced)}개 ===')
    for s in replaced:
        print('  ' + s)
    print(f'\n=== 답 단건 차이 (자동 수정 안 함): {len(answer_diffs)}건 ===')
    for s in answer_diffs:
        print('  ' + s)
    print(f'\n=== 검증 불가로 건너뜀: {len(skipped)}개 ===')
    for s in skipped[:10]:
        print('  ' + s)
    if len(skipped) > 10:
        print(f'  ... 외 {len(skipped) - 10}개')


if __name__ == '__main__':
    main()
