# © 2026 김용현
"""GeoTester 에 있는 문항을 통사랑 자료(public/data/*.json)의 GeoTester 칸에 표시한다.

문항 목록은 GeoTester 저장소(../geotester-v2/src/lib/constants.ts)의 PROBLEM_CATEGORIES 에서 읽는다.
  - 문항 id: 202606_k_10 = 2026학년도 6월(6모) 한국지리 10번. w = 세계지리, k = 한국지리
  - 지도 편집기는 설명에 적힌 기출(예: 2025학년도 수능 세계지리 7번)을 문항으로 본다
  - 예시문항(250415_s_*)은 통사랑에 없는 문항이라 건너뛴다
GeoTester 에 없는 문항의 표시는 지운다. GeoTesterID 칸에는 바로가기에 쓰는 문항 id 를 적는다. 쓰는 법: python scripts/sync_geotester.py [--dry]
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GT = os.path.join(os.path.dirname(ROOT), 'geotester-v2', 'src', 'lib', 'constants.ts')
SUBJ = {'w': '세계지리', 'k': '한국지리'}
# 분류 표기: 한국지리만 6모/9모, 나머지는 6월/9월. 11월 = 수능
CAT = {
    '한국지리': {'06': '6모', '09': '9모', '11': '수능'},
    '세계지리': {'06': '6월', '09': '9월', '11': '수능'},
}
KO_CAT = {'수능': '11', '6모': '06', '9모': '09'}

src = open(GT, encoding='utf-8').read()
block = src[src.index('problems: {'):src.index('} as Record<string, { id: string; title: string; description: string }[]>')]
targets, skipped = set(), []
for pid, title, desc in re.findall(r"id: '([^']+)', title: '([^']+)', description: '([^']+)'", block):
    m = re.fullmatch(r'(\d{4})(\d{2})_([wk])_(\d+)', pid)
    if m:
        y, mm, s, n = m.groups()
        targets.add((SUBJ[s], y, CAT[SUBJ[s]][mm], n, pid))
        continue
    m = re.fullmatch(r'(\d{4})학년도 (수능|6모|9모) (세계지리|한국지리) (\d+)번', desc)
    if pid.startswith('map_editor') and m:
        y, c, subj, n = m.groups()
        targets.add((subj, y, CAT[subj][KO_CAT[c]], n, pid))
        continue
    skipped.append(f'{pid} ({title})')

dry = '--dry' in sys.argv
found = set()
for subj in ('한국지리', '세계지리'):
    path = os.path.join(ROOT, 'public', 'data', f'{subj}.json')
    data = json.load(open(path, encoding='utf-8'))
    want = {(t[1], t[2], t[3]): t[4] for t in targets if t[0] == subj}
    added = removed = 0
    for q in data:
        key = (str(q['학년도']), q['분류'], str(q['번호']))
        on = key in want
        if on:
            found.add(want[key])
        old = q.get('GeoTester', '')
        new = 'Y' if on else ''
        if old != new:
            added += on
            removed += (not on)
            q['GeoTester'] = new
        # 바로가기 주소에 쓰는 GeoTester 문항 id (https://geotester.bgnl.kr/?problem=<id>)
        if on:
            q['GeoTesterID'] = want[key]
        else:
            q.pop('GeoTesterID', None)
    print(f'{subj}: 표시 {sum(1 for q in data if q.get("GeoTester") == "Y")}개 (새로 {added}, 지움 {removed})')
    if not dry:
        # 원래 파일처럼 CRLF 줄바꿈, 끝 줄바꿈 없이
        with open(path, 'w', encoding='utf-8', newline='\r\n') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

missing = sorted(t[4] + f' ({t[0]} {t[1]} {t[2]} {t[3]}번)' for t in targets if t[4] not in found)
print('GeoTester 문항', len(targets), '개 중 통사랑에서 찾음', len(found), '개')
if missing:
    print('통사랑에 없는 문항:', *missing, sep='\n  ')
if skipped:
    print('건너뜀:', *skipped, sep='\n  ')
