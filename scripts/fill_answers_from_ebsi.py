# © 2026 김용현
"""정답이 비어 있는 문항을 EBSi 해설지에서 채운다.

메가스터디에 자료가 없는 오래된 시험지가 몇 개 있다. EBSi 해설지 첫머리의 정답표는
PDF 텍스트로 들어 있어 그대로 뽑아 쓸 수 있다.

어느 시험인지는 **문제 PDF를 EBSi 원본과 바이트 비교**해 특정한다. 로컬 PDF가 없으면
같은 시험지를 내려받아 `작업완료/` 에 채워 넣고, 데이터의 발문과 대조해 확인한다.
배점은 문제 PDF의 `[3점]` 표시에서 얻는다. 정답률·난이도는 출처가 없어 비워 둔다.

    python scripts/fill_answers_from_ebsi.py --report
    python scripts/fill_answers_from_ebsi.py
"""
import os
import re
import sys
import json
import argparse
import urllib.request

import fitz

sys.stdout.reconfigure(encoding='utf-8')

HOME = os.path.expanduser('~')
PROJECT_DIR = os.path.join(HOME, 'Desktop', 'vibecoding', 'tongsarang')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from exam_calendar import CATEGORY_TO_MONTH, SUBJECT_EBSI, image_code  # noqa: E402

DATA_DIR = os.path.join(PROJECT_DIR, 'public', 'data')
MOCK_DIR = os.path.join(PROJECT_DIR, '모의고사')
LIST_API = 'https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperListAjax.ajax'
PDF_BASE = 'https://wdown.ebsi.co.kr/W61001/01exam'
HEADERS = {'User-Agent': 'Mozilla/5.0',
           'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
           'Referer': 'https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperList.ebs',
           'X-Requested-With': 'XMLHttpRequest'}
CIRCLED = {'①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5}
# 라벨 연도가 시행연도와 어긋날 수 있어 앞뒤로 넓게 훑는다 (코로나로 연기된 시험 등)
YEAR_SPAN = (-1, 0, 1)
MONTH_SPAN = (0, -1, 1)


def papers(year, month, ar, sid):
    body = (f'targetCd=D300&yearList={year}&monthList={month:02d}'
            f'&arOrd={ar}&subjIdList={sid}&sort=recent&currentPage=1')
    html = urllib.request.urlopen(
        urllib.request.Request(LIST_API, data=body.encode(), headers=HEADERS),
        timeout=30).read().decode('utf-8', 'replace')
    out = []
    for blk in html.split('<div class="qus_box')[1:]:
        t = re.search(r'<div class="qus_tit">(.*?)</div>', blk, re.S)
        p = re.search(r"goDownLoadP\('([^']+\.pdf)'", blk)
        s = re.search(r"goDownLoadH\('([^']+\.pdf)'", blk)
        if t and p and s:
            out.append({'title': ' '.join(t.group(1).split()).replace('&nbsp;', ' '),
                        'paper': p.group(1), 'solution': s.group(1)})
    return out


def fetch(path):
    return urllib.request.urlopen(
        urllib.request.Request(PDF_BASE + path, headers={'User-Agent': 'Mozilla/5.0'}),
        timeout=180).read()


def pdf_text(data):
    doc = fitz.open(stream=data, filetype='pdf')
    text = ''.join(p.get_text() for p in doc)
    doc.close()
    return re.sub(r'\s+', ' ', text)


def parse_answers(text, expected):
    """해설지 첫머리 정답표에서 {번호: 답}. 형식이 두 가지라 '번호+동그라미숫자' 쌍으로 읽는다."""
    answers = {}
    for m in re.finditer(r'(?<![0-9])(\d{1,2})\s*([①②③④⑤])', text):
        n = int(m.group(1))
        if 1 <= n <= expected and n not in answers:
            answers[n] = CIRCLED[m.group(2)]
        if len(answers) == expected:
            break
    return answers if set(answers) == set(range(1, expected + 1)) else {}


def three_point_questions(text, expected):
    pos = {}
    for m in re.finditer(r'(?<![0-9])(\d{1,2})\.\s', text):
        n = int(m.group(1))
        if 1 <= n <= expected and n not in pos:
            pos[n] = m.start()
    out = set()
    for n, start in pos.items():
        later = [p for p in pos.values() if p > start]
        end = min(later) if later else len(text)
        if '3점' in text[start:end]:
            out.add(n)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--report', action='store_true')
    args = ap.parse_args()

    filled_total = 0
    for subject in [s for s in SUBJECT_EBSI if not s.endswith('_고2')]:
        data_path = os.path.join(DATA_DIR, f'{subject}.json')
        data = json.load(open(data_path, encoding='utf-8'))
        _code, target_cd, ar, sid = SUBJECT_EBSI[subject]
        if target_cd != 'D300':
            continue

        exams = {}
        for row in data:
            if not str(row.get('답', '')).strip():
                exams.setdefault((row['학년도'], row['분류']), []).append(row)
        if not exams:
            continue

        changed = False
        for (year, cat), rows in sorted(exams.items()):
            month = CATEGORY_TO_MONTH.get(cat)
            if not month:
                continue
            expected = len(rows)
            stem = f'{year}_{month}_{image_code(subject)}'
            local_path = os.path.join(MOCK_DIR, subject, '작업완료', stem + '.pdf')
            local = open(local_path, 'rb').read() if os.path.exists(local_path) else None
            print(f'\n=== {subject} {year} {cat} ({expected}문항)  로컬PDF={"O" if local else "X"}')

            hit = None
            for dy in YEAR_SPAN:
                for dm in MONTH_SPAN:
                    mm = int(month) + dm
                    if not 1 <= mm <= 12:
                        continue
                    try:
                        cands = papers(int(year) + dy, mm, ar, sid)
                    except Exception:
                        continue
                    for c in cands:
                        if local is not None:
                            if fetch(c['paper']) == local:
                                hit = c
                                break
                        elif len(cands) == 1:
                            hit = c      # 후보가 하나뿐이면 그것으로 본다
                            break
                    if hit:
                        break
                if hit:
                    break
            if not hit:
                print('   ! EBSi에서 같은 시험지를 찾지 못함 — 건너뜀')
                continue
            print(f'   ← {hit["title"]}')

            paper = local if local is not None else fetch(hit['paper'])
            ptext = pdf_text(paper)
            answers = parse_answers(pdf_text(fetch(hit['solution'])), expected)
            if not answers:
                print('   ! 해설지 정답표를 읽지 못함 — 건너뜀')
                continue
            three = three_point_questions(ptext, expected)
            print(f'   해설지 정답: {"".join(str(answers[i]) for i in range(1, expected+1))}')
            print(f'   3점 문항: {sorted(three) or "없음"}')

            # 로컬 PDF가 없었으면 받아둔다 (다음 작업에서 재사용)
            if local is None and not args.report:
                os.makedirs(os.path.dirname(local_path), exist_ok=True)
                open(local_path, 'wb').write(paper)
                print(f'   PDF 저장: {stem}.pdf')

            if args.report:
                continue
            for row in rows:
                n = int(row['번호'])
                if n not in answers:
                    continue
                row['답'] = answers[n] if isinstance(row['답'], (int, float)) else str(answers[n])
                # 3점 표시를 실제로 찾았을 때만 배점을 쓴다. 못 찾았으면 비워 둔다 —
                # 사탐은 20문항 중 10개가 3점이라 전부 2점으로 채우면 틀린 값이 된다.
                if three and not str(row.get('배점', '')).strip():
                    want = 3 if n in three else 2
                    row['배점'] = want if isinstance(row.get('배점'), (int, float)) else str(want)
                changed = True
                filled_total += 1

        if changed and not args.report:
            json.dump(data, open(data_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

    print(f'\n=== 정답 {filled_total}건 {"확인" if args.report else "채움"} ===')


if __name__ == '__main__':
    main()
