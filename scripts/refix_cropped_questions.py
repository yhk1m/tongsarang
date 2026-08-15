# © 2026 김용현
"""문항 이미지 '잘림' 재추출 도구 (2026.08.15 한국지리 43건 교체에 사용).

배경
----
`fix_images.py`는 "무언가 더 지워야 하는" 결함(구분선/페이지번호/여백)만 처리하고,
내용이 잘려나간 결함은 `unfixable`로 남긴다. 잘린 픽셀은 추가 크롭으로 복구할 수
없고 원본 PDF에서 재추출해야 하기 때문이다. 이 스크립트가 그 재추출을 담당한다.

`fix_bottom_cutoff.crop_and_save()`를 그대로 쓰지 않고 재구현한 이유는 두 가지
지면 요소를 크롭에서 빼야 하기 때문이다.

1. 페이지번호 박스 — 지면 하단의 테두리 박스(1~3자리 숫자). 본문 컬럼보다 넓어서
   컬럼 크롭 경계에 걸려 잘리고, 그 잘린 박스가 "우측 일부 잘림"으로 보인다.
2. 컬럼 구분선 — 두 컬럼 사이의 얇은 세로선. 크롭 좌/우 립에 걸리면 여백이 0이 된다.

둘 다 픽셀 휴리스틱(`cleanup_crops.py`) 대신 PDF 기하로 판정한다. 휴리스틱은
선지 ⑤가 두 줄로 넘어갈 때 둘째 줄을 아티팩트로 오인해 잘라내는 오탐이 있다.

한계
----
- 연결문항([N~M] 공유지문)은 지원하지 않는다. 대상에 포함되면 건너뛴다.
- 텍스트가 없는 **스캔 PDF**는 문항 위치를 잡을 수 없어 처리 불가.
  (한국지리 기준 `2021_05_korgeo`, `2025_11_korgeo` 가 여기 해당)

대상 지정 방법 2가지
--------------------
- `--csv`   : 오류 목록 CSV 에서 '잘림'(`unfixable`) 유형만 자동 추출
- `--targets`: 이미지 파일명을 한 줄에 하나씩 적은 텍스트 파일

사용법
------
  python scripts/refix_cropped_questions.py --subject 한국지리 --csv "통사랑 png 수정사항 2.csv"
  python scripts/refix_cropped_questions.py --subject 한국지리 --targets targets.txt --apply

`--apply` 는 기본적으로 **결과가 개선된 파일만** 덮어쓴다(여백 4px 이상 확보).
개선되지 않은 건 건드리지 않고 목록으로 보고한다. `--force` 로 이 보호를 끌 수 있다.
"""
import argparse
import csv
import os
import sys

import fitz
import numpy as np
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_DIR)

import fix_bottom_cutoff as fbc  # noqa: E402
from fix_images import classify_error, get_filename  # noqa: E402


def page_items(page):
    """(텍스트 span, 그리기/이미지 박스) 목록."""
    texts, draws = [], []
    for block in page.get_text('dict')['blocks']:
        if 'lines' in block:
            for line in block['lines']:
                for span in line['spans']:
                    if span['text'].strip():
                        texts.append((tuple(span['bbox']), span['text'].strip()))
        elif block.get('type') == 1:
            draws.append(tuple(block['bbox']))
    for drawing in page.get_drawings():
        r = drawing['rect']
        # max() 로 판정하는 이유: 구형 시험(2017~2018 등)의 컬럼 구분선은 선 두께가
        # 0 인 벡터 선이라 rect 의 width 가 정확히 0.0 이다. `width > 0 and height > 0`
        # 로 거르면 이 구분선들이 통째로 안 보여서 크롭 립에 그대로 걸린다.
        if max(r.width, r.height) > 0.2:
            draws.append((r.x0, r.y0, r.x1, r.y1))
    return texts, draws


def find_page_number_box(texts, draws, page_h, y0, y1):
    """지면 하단의 쪽번호 박스 top 좌표. 없으면 None."""
    top = None
    for bx0, by0, bx1, by1 in draws:
        w, h = bx1 - bx0, by1 - by0
        if not (12 <= w <= 100 and 8 <= h <= 40):
            continue
        if by0 < page_h * 0.85 or by1 <= y0 or by0 >= y1:
            continue
        for (tx0, ty0, tx1, ty1), text in texts:
            if not (text.isdigit() and len(text) <= 3):
                continue
            if tx0 >= bx0 - 6 and tx1 <= bx1 + 6 and ty0 >= by0 - 6 and ty1 <= by1 + 6:
                top = by0 if top is None else min(top, by0)
                break
    return top


def vertical_rules(draws, y0, y1):
    """밴드를 가로지르는 얇고 긴 세로선 [(x0, x1), ...]."""
    band_h = y1 - y0
    return [(a, c) for a, b, c, d in draws
            if (c - a) <= 3.0 and (d - b) >= band_h * 0.35 and not (d <= y0 or b >= y1)]


def find_right_rule(draws, x_end, y0, y1):
    cands = [a for a, _ in vertical_rules(draws, y0, y1) if x_end - 25 <= a <= x_end + 30]
    return min(cands) if cands else None


def find_left_rule(draws, x_start, y0, y1):
    cands = [b for _, b in vertical_rules(draws, y0, y1) if x_start - 6 <= b <= x_start + 25]
    return max(cands) if cands else None


def margins(img):
    arr = np.array(img.convert('L'))
    h, w = arr.shape
    cols = np.where(np.any(arr < 240, axis=0))[0]
    rows = np.where(np.any(arr < 240, axis=1))[0]
    if len(cols) == 0 or len(rows) == 0:
        return None
    return int(cols[0]), int(w - 1 - cols[-1]), int(rows[0]), int(h - 1 - rows[-1])


def find_pdf(subject, stem):
    """작업완료/ 우선, 없으면 과목 폴더 루트에서 원본 PDF 를 찾는다."""
    for cand in (os.path.join(PROJECT_DIR, '모의고사', subject, '작업완료', stem + '.pdf'),
                 os.path.join(PROJECT_DIR, '모의고사', subject, stem + '.pdf')):
        if os.path.isfile(cand):
            return cand
    return None


def targets_from_list(list_path):
    """이미지 파일명 목록 파일 -> {시험stem: [문항번호]}"""
    by_exam = {}
    with open(list_path, encoding='utf-8') as f:
        for raw in f:
            name = raw.strip()
            if not name or name.startswith('#'):
                continue
            stem, num = name[:-4].rsplit('_', 1) if name.endswith('.jpg') else name.rsplit('_', 1)
            by_exam.setdefault(stem, set()).add(int(num))
    return {k: sorted(v) for k, v in sorted(by_exam.items())}


def targets_from_csv(csv_path, subject):
    """CSV에서 'unfixable'(=잘림) 대상만 뽑아 {시험stem: [문항번호]} 로 반환."""
    by_exam = {}
    # utf-8-sig: CSV 선두에 BOM 이 있어 그냥 utf-8 로 열면 첫 칼럼명이 '﻿과목명' 이 된다
    with open(csv_path, encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            if row.get('과목명') != subject:
                continue
            if classify_error(row['오류사항']) != 'unfixable':
                continue
            filename = get_filename(row['학년도'], row['분류'], row['문항번호'])
            if not filename:
                print(f"  경고: 분류 '{row['분류']}' 를 월로 변환 못함")
                continue
            stem = filename.rsplit('_', 1)[0]
            by_exam.setdefault(stem, set()).add(int(row['문항번호']))
    return {k: sorted(v) for k, v in sorted(by_exam.items())}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--subject', required=True, help='예: 한국지리')
    ap.add_argument('--csv', help='오류 목록 CSV 경로 (잘림 유형만 자동 추출)')
    ap.add_argument('--targets', help='이미지 파일명 목록 파일 (한 줄에 하나)')
    ap.add_argument('--apply', action='store_true', help='public/images/ 에 실제 반영')
    ap.add_argument('--out', help='배포본을 건드리지 않고 이 디렉터리에 PNG 로 저장 (검증용)')
    ap.add_argument('--force', action='store_true', help='개선 여부와 무관하게 덮어쓰기')
    ap.add_argument('--quality', type=int, default=92, help='JPEG 품질 (파이프라인 기본 92)')
    args = ap.parse_args()
    if bool(args.csv) == bool(args.targets):
        ap.error('--csv 와 --targets 중 정확히 하나를 지정하세요.')

    live_dir = os.path.join(PROJECT_DIR, 'public', 'images', args.subject)
    if args.targets:
        p = args.targets if os.path.isabs(args.targets) else os.path.join(PROJECT_DIR, args.targets)
        by_exam = targets_from_list(p)
    else:
        p = args.csv if os.path.isabs(args.csv) else os.path.join(PROJECT_DIR, args.csv)
        by_exam = targets_from_csv(p, args.subject)

    total = sum(len(v) for v in by_exam.values())
    print(f"=== {'적용' if args.apply else '미리보기'} | {args.subject} | "
          f"{len(by_exam)}개 시험 / {total}개 문항 ===\n")

    done = skipped = tight = 0
    not_improved = []
    for stem, qnums in by_exam.items():
        pdf_path = find_pdf(args.subject, stem)
        if pdf_path is None:
            print(f'  원본 PDF 없음, 건너뜀: {stem}.pdf ({len(qnums)}건)')
            skipped += len(qnums)
            continue

        doc = fitz.open(pdf_path)
        pw, ph = doc[0].rect.width, doc[0].rect.height
        questions, _, q_to_group = fbc.extract_question_regions(doc)
        if not questions:
            print(f'  문항 추출 실패(텍스트 없는 스캔 PDF로 보임), 건너뜀: {stem} ({len(qnums)}건)')
            skipped += len(qnums)
            doc.close()
            continue
        qmap = {q[0]: q for q in questions}
        pixcache = {}

        for qnum in qnums:
            name = f'{stem}_{qnum:02d}.jpg'
            if qnum not in qmap:
                print(f'  {name}: 추출 결과에 문항 없음, 건너뜀')
                skipped += 1
                continue
            if qnum in q_to_group:
                print(f'  {name}: 연결문항이라 미지원, 건너뜀')
                skipped += 1
                continue

            _, pidx, x0, y0, x1, y1 = qmap[qnum]
            page = doc[pidx]
            texts, draws = page_items(page)
            acts = []

            box_top = find_page_number_box(texts, draws, ph, y0, y1)
            if box_top is not None and box_top - 3 > y0 + 20:
                y1 = box_top - 3
                acts.append('페이지번호박스 제외')

            left_rule = find_left_rule(draws, x0, y0, y1)
            if left_rule is not None and left_rule + 1 < x1 - 20:
                x0 = left_rule + 1
                acts.append('좌측 구분선 제외')

            right_rule = find_right_rule(draws, x1, y0, y1)
            if right_rule is not None and right_rule < x1 - 0.5:
                x1 = right_rule - 1.0
                acts.append('우측 구분선 제외')

            if pidx not in pixcache:
                pm = page.get_pixmap(dpi=fbc.DPI)
                pixcache[pidx] = Image.frombytes('RGB', (pm.width, pm.height), pm.samples)
            src = pixcache[pidx]
            iw, ih = src.size
            crop = src.crop((
                fbc.pdf_to_pixel(x0, pw, iw), fbc.pdf_to_pixel(y0, ph, ih),
                fbc.pdf_to_pixel(x1, pw, iw), fbc.pdf_to_pixel(y1, ph, ih),
            ))
            final = fbc.trim_bottom_whitespace(fbc.trim_horizontal(crop))

            m = margins(final)
            improved = bool(m) and m[1] >= 4 and m[3] >= 4
            note = ''
            if not improved:
                note = '  <-- 여백 미확보'
                tight += 1
                not_improved.append(name)

            if args.out:
                os.makedirs(args.out, exist_ok=True)
                final.save(os.path.join(args.out, name[:-4] + '.png'), 'PNG')

            dst = os.path.join(live_dir, name)
            old = Image.open(dst).size if os.path.exists(dst) else None
            wrote = False
            if args.apply and (improved or args.force):
                final.convert('RGB').save(dst, 'JPEG', quality=args.quality)
                wrote = True
            done += 1
            print(f"  {name}: {f'{old[0]}x{old[1]}' if old else '(신규)'} -> "
                  f"{final.size[0]}x{final.size[1]}  여백(L,R,T,B)={m}  "
                  f"{', '.join(acts) or '-'}{note}"
                  f"{'' if not args.apply else ('  [기록]' if wrote else '  [보존]')}")

        doc.close()

    print(f'\n=== 처리 {done} / 건너뜀 {skipped} / 여백 미확보 {tight} ===')
    if not_improved:
        print('여백 미확보 (기본 설정에서는 덮어쓰지 않음):')
        for n in not_improved:
            print(f'  {n}')
    if not args.apply and done:
        print('\n실제 반영하려면 --apply 를 붙여 다시 실행하세요.')


if __name__ == '__main__':
    main()
