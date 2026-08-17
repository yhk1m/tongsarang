# © 2026 김용현
"""시험지에서 통째로 빠진 문항을 찾아 이미지와 데이터 행을 채운다.

문항 번호 글꼴 크기가 시험지 안에서 조금씩 달라, 기본 허용 오차(0.5)로 뽑을 때
검출에서 빠진 문항이 있다. 그 시험지의 다른 문항은 멀쩡히 들어와 있어서 눈에 잘
띄지 않는다. (총점이 50이 아닌 시험지를 훑다가 드러났다.)

허용 오차를 넓혀 다시 자르고, 답·배점·정답률·난이도는 메가스터디에서 가져온다.
어느 시험인지는 **이미 들어 있는 문항들의 정답**과 대조해 특정한다.

발문·문항내용은 비워 두므로 끝나면 ocr_subjects.cjs, 대단원은
classify_chapters_2026.cjs 를 돌린다.

    python scripts/fill_missing_questions.py --list
    python scripts/fill_missing_questions.py
"""
import os
import re
import sys
import json
import shutil
import argparse
import subprocess
import tempfile

import fitz
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

HOME = os.path.expanduser('~')
PROJECT_DIR = os.path.join(HOME, 'Desktop', 'vibecoding', 'tongsarang')
sys.path.insert(0, PROJECT_DIR)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fix_bottom_cutoff as cropper  # noqa: E402
from exam_calendar import (  # noqa: E402
    CATEGORY_TO_MONTH, MEGASTUDY_SUBJECT, image_code)

DATA_DIR = os.path.join(PROJECT_DIR, 'public', 'data')
IMG_DIR = os.path.join(PROJECT_DIR, 'public', 'images')
MOCK_DIR = os.path.join(PROJECT_DIR, '모의고사')
RATE_API = 'https://www.megastudy.net/Entinfo/correctRate/main_rate_ax.asp'
NAME_API = 'https://www.megastudy.net/Entinfo/correctRate/main_examNm_ax.asp'
TOLERANCES = [0.5, 0.8, 1.2, 1.6, 2.0]
JPEG_QUALITY = 80


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
        rows[int(v[i])] = {'답': v[i + 1], '난이도': v[i + 2],
                           '배점': v[i + 3], '정답률': v[i + 4].replace('%', '')}
    out = rows or None
    _cache[key] = out
    return out


def find_gaps(data, expected=20):
    """(학년도, 분류) → 빠진 번호 목록"""
    exams = {}
    for row in data:
        exams.setdefault((row['학년도'], row['분류']), []).append(row)
    gaps = {}
    for key, rows in exams.items():
        nums = {int(r['번호']) for r in rows}
        if not nums or max(nums) > expected:
            continue
        missing = [n for n in range(1, expected + 1) if n not in nums]
        if missing and len(rows) >= expected * 0.6:   # 통째로 없는 시험지는 대상 아님
            gaps[key] = missing
    return gaps


def crop_missing(pdf_path, subject_dir, stem, wanted):
    """필요한 번호가 모두 나올 때까지 허용 오차를 넓혀 자른다. {번호: PIL.Image}"""
    for tol in TOLERANCES:
        cropper.SIZE_TOLERANCE = tol
        doc = fitz.open(pdf_path)
        try:
            questions, groups, q_to_group = cropper.extract_question_regions(doc)
        except Exception:
            doc.close()
            continue
        found = {q[0] for q in questions}
        if not set(wanted) <= found:
            doc.close()
            continue

        ph = doc[0].rect.height
        pw = doc[0].rect.width
        out, cache = {}, {}
        for q_num, page_idx, x0, y0, x1, y1 in questions:
            if q_num not in wanted:
                continue
            nx0, ny0, nx1, ny1, _acts = cropper.exclude_page_furniture(
                doc[page_idx], ph, x0, y0, x1, y1)
            if page_idx not in cache:
                pix = doc[page_idx].get_pixmap(dpi=cropper.DPI)
                cache[page_idx] = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
            img = cache[page_idx]
            iw, ih = img.size
            tile = img.crop((cropper.pdf_to_pixel(nx0, pw, iw), cropper.pdf_to_pixel(ny0, ph, ih),
                             cropper.pdf_to_pixel(nx1, pw, iw), cropper.pdf_to_pixel(ny1, ph, ih)))
            out[q_num] = cropper.trim_bottom_whitespace(cropper.trim_horizontal(tile))
        doc.close()
        cropper.SIZE_TOLERANCE = 0.5
        return out, tol
    cropper.SIZE_TOLERANCE = 0.5
    return {}, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--list', action='store_true')
    args = ap.parse_args()

    seq_date = {} if args.list else exam_index()
    filled, failed = 0, []

    for subject, (tab, sub_cd) in MEGASTUDY_SUBJECT.items():
        data_path = os.path.join(DATA_DIR, f'{subject}.json')
        data = json.load(open(data_path, encoding='utf-8'))
        gaps = find_gaps(data)
        if not gaps:
            continue

        changed = False
        for (year, cat), missing in sorted(gaps.items()):
            month = CATEGORY_TO_MONTH.get(cat)
            stem = f'{year}_{month}_{image_code(subject)}'
            print(f'\n=== {subject} {year} {cat}: 빠진 번호 {missing}')
            if args.list:
                continue

            pdf_path = os.path.join(MOCK_DIR, subject, '작업완료', stem + '.pdf')
            if not os.path.exists(pdf_path):
                print('   ! PDF 없음')
                failed.append(f'{subject} {year} {cat} (PDF 없음)')
                continue

            # 이미 있는 문항들의 정답으로 메가스터디 시험을 특정한다
            present = {int(r['번호']): str(r['답']).strip()
                       for r in data if r['학년도'] == year and r['분류'] == cat}
            hit = None
            for seq, date in seq_date.items():
                mega = megastudy(seq, tab, sub_cd)
                if not mega:
                    continue
                same = sum(1 for n, a in present.items() if n in mega and mega[n]['답'] == a)
                if same == len(present) and len(mega) >= max(missing):
                    hit = (seq, date, mega)
                    break
            if not hit:
                print('   ! 메가스터디에서 같은 시험을 찾지 못함')
                failed.append(f'{subject} {year} {cat} (시험 특정 실패)')
                continue
            _seq, date, mega = hit
            print(f'   ← {date[:10]}')

            tiles, tol = crop_missing(pdf_path, os.path.join(MOCK_DIR, subject), stem, missing)
            if not tiles:
                print('   ! 문항 검출 실패')
                failed.append(f'{subject} {year} {cat} (크롭 실패)')
                continue
            print(f'   글꼴 허용 오차 {tol} 로 검출')

            sample = next(r for r in data if r['학년도'] == year and r['분류'] == cat)
            out_dir = os.path.join(MOCK_DIR, subject, stem)
            os.makedirs(out_dir, exist_ok=True)
            for n in missing:
                name = f'{stem}_{n:02d}'
                tiles[n].save(os.path.join(out_dir, name + '.png'), 'PNG')
                tiles[n].convert('RGB').save(
                    os.path.join(IMG_DIR, subject, name + '.jpg'), 'JPEG', quality=JPEG_QUALITY)
                m = mega[n]
                row = {}
                for k in sample:
                    if k == '순번':
                        row[k] = 0
                    elif k == '학년도':
                        row[k] = year
                    elif k == '분류':
                        row[k] = cat
                    elif k == '번호':
                        row[k] = n if isinstance(sample[k], (int, float)) else str(n)
                    elif k in ('답', '배점'):
                        row[k] = float(m[k]) if isinstance(sample[k], (int, float)) else str(int(float(m[k]))) if k == '답' else str(int(float(m[k])))
                    elif k in ('정답률', '난이도'):
                        row[k] = m[k]
                    else:
                        row[k] = 0 if isinstance(sample[k], (int, float)) else ''
                data.append(row)
                print(f'      {name}  {tiles[n].size[0]}x{tiles[n].size[1]}  답={m["답"]} 배점={m["배점"]} 정답률={m["정답률"]}')
                filled += 1
                changed = True

        if changed:
            order = {'수능': 8, '11월': 8, '10월': 7, '10월학평': 7, '9월': 6, '9모': 6,
                     '7월': 5, '7월학평': 5, '6월': 4, '6모': 4, '5월': 3, '5월학평': 3,
                     '4월': 2, '4월학평': 2, '3월': 1, '3월학평': 1}
            data.sort(key=lambda r: (-int(r['학년도']), -order.get(r['분류'], 0), int(r['번호'])))
            for i, r in enumerate(data):
                r['순번'] = i + 1
            json.dump(data, open(data_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

    print(f'\n=== {filled}문항 채움 / 실패 {len(failed)} ===')
    for f in failed:
        print('   ' + f)


if __name__ == '__main__':
    main()
