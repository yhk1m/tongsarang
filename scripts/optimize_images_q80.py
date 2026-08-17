# © 2026 김용현
"""문항 이미지를 JPEG 품질 80으로 다시 저장해 배포 용량을 줄인다.

해상도는 그대로 두고 압축률만 높인다. 실측(표본 132장): 평균 326KB → 207KB,
전체 약 4.06GB → 2.68GB (37% 절감). GitHub Pages 배포 아티팩트가 1GB 권장치를
크게 넘고 있어 배포 실패 위험을 줄이기 위한 조치다.

되돌릴 수 없는 손실 압축이므로 크기가 줄어드는 파일만 교체하고, 가로·세로 픽셀이
바뀌지 않았는지 확인한다.

    python scripts/optimize_images_q80.py --dry
    python scripts/optimize_images_q80.py
"""
import os
import io
import sys
import argparse

from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

HOME = os.path.expanduser('~')
IMG_DIR = os.path.join(HOME, 'Desktop', 'vibecoding', 'tongsarang', 'public', 'images')
QUALITY = 80


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--quality', type=int, default=QUALITY)
    args = ap.parse_args()

    total_before = total_after = 0
    changed = skipped = failed = 0

    for subject in sorted(os.listdir(IMG_DIR)):
        sub_dir = os.path.join(IMG_DIR, subject)
        if not os.path.isdir(sub_dir):
            continue
        s_before = s_after = s_changed = 0
        for name in sorted(os.listdir(sub_dir)):
            if not name.lower().endswith('.jpg'):
                continue
            path = os.path.join(sub_dir, name)
            before = os.path.getsize(path)
            try:
                img = Image.open(path)
                size = img.size
                buf = io.BytesIO()
                img.convert('RGB').save(buf, 'JPEG', quality=args.quality, optimize=True)
            except Exception as e:
                print(f'  ! {subject}/{name}: {e}')
                failed += 1
                continue

            after = buf.tell()
            total_before += before
            s_before += before
            if after >= before:            # 이미 더 작으면 그대로 둔다
                total_after += before
                s_after += before
                skipped += 1
                continue

            if not args.dry:
                data = buf.getvalue()
                with open(path, 'wb') as f:
                    f.write(data)
                # 픽셀 크기가 그대로인지 확인
                if Image.open(path).size != size:
                    print(f'  ! {subject}/{name}: 크기 변경됨 {size} → {Image.open(path).size}')
                    failed += 1
            total_after += after
            s_after += after
            changed += 1
            s_changed += 1
        if s_before:
            print(f'{subject:<8} {s_changed:>5}장 교체  '
                  f'{s_before / 1024**2:>8.0f}MB → {s_after / 1024**2:>8.0f}MB')

    verb = '예상' if args.dry else '완료'
    print(f'\n총 {total_before / 1024**3:.2f}GB → {total_after / 1024**3:.2f}GB '
          f'({(1 - total_after / total_before) * 100:.0f}% 절감, {verb})')
    print(f'교체 {changed}장 / 유지 {skipped}장 / 실패 {failed}장')


if __name__ == '__main__':
    main()
