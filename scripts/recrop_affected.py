# © 2026 김용현
"""지면 요소 제외 규칙이 새로 걸리는 문항만 골라 다시 자른다.

시험지 전체를 다시 렌더링하면 몇 시간이 걸린다. 규칙이 실제로 적용되는 문항은
시험지당 한두 개뿐이므로, 해당 문항이 있는 페이지만 렌더링해 그 조각만 교체한다.

    python scripts/recrop_affected.py --list                  # 대상만 출력
    python scripts/recrop_affected.py --action '과목명 탭 제외'  # 특정 규칙만
    python scripts/recrop_affected.py                          # 전부 교체
"""
import os
import sys
import argparse

import fitz
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

HOME = os.path.expanduser('~')
PROJECT_DIR = os.path.join(HOME, 'Desktop', 'vibecoding', 'tongsarang')
sys.path.insert(0, PROJECT_DIR)
import fix_bottom_cutoff as cropper  # noqa: E402

MOCK_DIR = os.path.join(PROJECT_DIR, '모의고사')
IMG_DIR = os.path.join(PROJECT_DIR, 'public', 'images')
JPEG_QUALITY = 80   # 저장소 전체가 q80 이라 새로 만드는 것도 맞춘다


def affected_questions(doc, want_action):
    """(문항번호, page_idx, 조정된 box, 적용된 조치) 목록."""
    ph = doc[0].rect.height
    questions, groups, q_to_group = cropper.extract_question_regions(doc)
    out = []
    for q_num, page_idx, x0, y0, x1, y1 in questions:
        nx0, ny0, nx1, ny1, acts = cropper.exclude_page_furniture(
            doc[page_idx], ph, x0, y0, x1, y1)
        if not acts:
            continue
        if want_action and want_action not in acts:
            continue
        out.append((q_num, page_idx, (nx0, ny0, nx1, ny1), acts, groups, q_to_group))
    return out


def render(doc, page_idx, cache):
    if page_idx not in cache:
        pix = doc[page_idx].get_pixmap(dpi=cropper.DPI)
        cache[page_idx] = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    return cache[page_idx]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--list', action='store_true')
    ap.add_argument('--action', default='과목명 탭 제외',
                    help="이 조치가 걸리는 문항만 대상. 빈 문자열이면 모든 조치")
    ap.add_argument('--subject', help='한 과목만')
    args = ap.parse_args()
    want = args.action or None

    total_pdfs = total_q = replaced = 0
    for subject in sorted(os.listdir(MOCK_DIR)):
        if args.subject and subject != args.subject:
            continue
        pdf_dir = os.path.join(MOCK_DIR, subject, '작업완료')
        img_dir = os.path.join(IMG_DIR, subject)
        if not os.path.isdir(pdf_dir) or not os.path.isdir(img_dir):
            continue

        for pdf_name in sorted(os.listdir(pdf_dir)):
            if not pdf_name.lower().endswith('.pdf'):
                continue
            stem = os.path.splitext(pdf_name)[0]
            path = os.path.join(pdf_dir, pdf_name)
            try:
                doc = fitz.open(path)
                targets = affected_questions(doc, want)
            except Exception as e:
                print(f'  ! {subject}/{stem}: {e}')
                continue
            total_pdfs += 1
            if not targets:
                doc.close()
                continue

            nums = [t[0] for t in targets]
            print(f'  {subject}/{stem}: 문항 {nums}')
            total_q += len(targets)
            if args.list:
                doc.close()
                continue

            pw, ph = doc[0].rect.width, doc[0].rect.height
            cache = {}
            for q_num, page_idx, box, acts, groups, q_to_group in targets:
                jpg = os.path.join(img_dir, f'{stem}_{q_num:02d}.jpg')
                if not os.path.exists(jpg):
                    print(f'      ! {os.path.basename(jpg)} 없음 — 건너뜀')
                    continue
                img = render(doc, page_idx, cache)
                iw, ih = img.size
                nx0, ny0, nx1, ny1 = box
                crop = img.crop((cropper.pdf_to_pixel(nx0, pw, iw),
                                 cropper.pdf_to_pixel(ny0, ph, ih),
                                 cropper.pdf_to_pixel(nx1, pw, iw),
                                 cropper.pdf_to_pixel(ny1, ph, ih)))

                # 공통지문이 붙는 문항은 자료 영역을 위에 이어 붙인다
                if q_num in q_to_group:
                    grp = groups[q_to_group[q_num]]
                    res_page = grp['page_idx']
                    rx0, ry0, rx1, ry1, _a = cropper.exclude_page_furniture(
                        doc[res_page], ph, grp['x_start'], max(0, grp['res_y_start']),
                        grp['x_end'], grp['res_y_end'])
                    rimg = render(doc, res_page, cache)
                    riw, rih = rimg.size
                    res = rimg.crop((cropper.pdf_to_pixel(rx0, pw, riw),
                                     cropper.pdf_to_pixel(ry0, ph, rih),
                                     cropper.pdf_to_pixel(rx1, pw, riw),
                                     cropper.pdf_to_pixel(ry1, ph, rih)))
                    w = max(res.width, crop.width)
                    combined = Image.new('RGB', (w, res.height + cropper.GAP_BETWEEN + crop.height),
                                         (255, 255, 255))
                    combined.paste(res, (0, 0))
                    combined.paste(crop, (0, res.height + cropper.GAP_BETWEEN))
                    crop = combined

                final = cropper.trim_bottom_whitespace(cropper.trim_horizontal(crop))
                before = Image.open(jpg).size
                final.save(jpg, 'JPEG', quality=JPEG_QUALITY)
                print(f'      {os.path.basename(jpg)} {before} → {final.size}  {acts}')
                replaced += 1
            doc.close()

    print(f'\n시험지 {total_pdfs}개 검사 / 대상 문항 {total_q}개 / '
          f'{"교체 " + str(replaced) + "장" if not args.list else "목록만"}')


if __name__ == '__main__':
    main()
