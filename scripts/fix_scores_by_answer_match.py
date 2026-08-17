# © 2026 김용현
"""정답 문자열로 시험을 특정해 배점을 채운다.

이미지 OCR로도 [3점] 을 10개 못 찾는 시험지가 남는다. 그런 경우 **20문항 정답
문자열**로 메가스터디의 어느 시험인지 찾는다. 20자리가 통째로 같을 확률은 사실상
없으므로 유일하게 일치하면 같은 시험으로 본다.

정답은 이미 EBSi 해설지·메가스터디로 검증된 값이라 근거로 쓸 수 있다.
총점이 50이 아닌 20문항 시험지만 손댄다.

    python scripts/fix_scores_by_answer_match.py --report
    python scripts/fix_scores_by_answer_match.py
"""
import os
import re
import sys
import json
import argparse
import subprocess
import tempfile

sys.stdout.reconfigure(encoding='utf-8')

HOME = os.path.expanduser('~')
PROJECT_DIR = os.path.join(HOME, 'Desktop', 'vibecoding', 'tongsarang')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from exam_calendar import MEGASTUDY_SUBJECT  # noqa: E402

DATA_DIR = os.path.join(PROJECT_DIR, 'public', 'data')
RATE_API = 'https://www.megastudy.net/Entinfo/correctRate/main_rate_ax.asp'
NAME_API = 'https://www.megastudy.net/Entinfo/correctRate/main_examNm_ax.asp'
EXPECTED_TOTAL = 50


def _post(url, body, name):
    tmp = os.path.join(tempfile.gettempdir(), name)
    subprocess.run(['curl', '-s', '-X', 'POST', url, '-d', body, '--output', tmp],
                   check=True, timeout=40)
    return open(tmp, 'rb').read().decode('euc-kr', errors='replace')


def exam_index():
    out = {}
    for year in range(2016, 2028):
        try:
            html = _post(NAME_API, f'grdFlg=3&examYear={year}', f'nm_{year}.bin')
        except Exception:
            continue
        for m in re.finditer(r'fncSelExamSeq\((\d+),[^)]*\);">([^<]+)</li>', html):
            out[int(m.group(1))] = m.group(2).strip()
    return out


_cache = {}


def megastudy(seq, tab, sub_cd):
    key = (seq, tab, sub_cd)
    if key in _cache:
        return _cache[key]
    body = f'examSeq={seq}&tabNo={tab}' + (f'&selSubCd={sub_cd}' if sub_cd else '')
    try:
        html = _post(RATE_API, body, f'mega_{seq}_{tab}_{sub_cd}.bin')
    except Exception:
        _cache[key] = None
        return None
    v = [x.strip() for x in re.findall(r'<td class="two">(.*?)</td>', html)]
    rows = {}
    for i in range(0, len(v) - 9, 10):
        rows[int(v[i])] = {'답': v[i + 1], '배점': v[i + 3]}
    out = rows or None
    _cache[key] = out
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--report', action='store_true')
    args = ap.parse_args()

    print('메가스터디 시험 목록 수집...')
    seq_date = exam_index()
    print(f'  {len(seq_date)}개')

    fixed, unresolved = [], []
    for subject, (tab, sub_cd) in MEGASTUDY_SUBJECT.items():
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
            rows.sort(key=lambda r: int(r['번호']))
            key = ''.join(str(r['답']).strip() for r in rows)
            if len(key) != 20:
                continue

            hits = []
            for seq, date in seq_date.items():
                mega = megastudy(seq, tab, sub_cd)
                if not mega or len(mega) != 20:
                    continue
                if ''.join(mega[i]['답'] for i in range(1, 21)) == key:
                    hits.append((seq, date, mega))
            label = f'{subject} {year} {cat} (총점 {total:g})'
            if len(hits) != 1:
                print(f'  ? {label}: 일치 시험 {len(hits)}개 — 건너뜀')
                unresolved.append(label)
                continue

            seq, date, mega = hits[0]
            three = sorted(n for n, m in mega.items() if m['배점'].strip() == '3')
            if len(three) != 10:
                print(f'  ? {label}: {date[:10]} 이지만 3점 {len(three)}개 — 건너뜀')
                unresolved.append(label)
                continue

            print(f'  + {label} → {date[:10]}  3점 {three}')
            if not args.report:
                for row in rows:
                    want = float(mega[int(row['번호'])]['배점'])
                    row['배점'] = want if isinstance(row['배점'], (int, float)) else str(int(want))
                changed = True
            fixed.append(label)

        if changed and not args.report:
            json.dump(data, open(data_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

    verb = '확인' if args.report else '수정'
    print(f'\n=== 배점 {verb}: {len(fixed)}개 / 미해결 {len(unresolved)}개 ===')
    for u in unresolved:
        print('   ' + u)


if __name__ == '__main__':
    main()
