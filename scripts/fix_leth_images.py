"""생활과윤리 이미지 일괄 보정: 오른쪽 구분선 제거 + 아래 여백 트리밍"""
from PIL import Image
import numpy as np
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

IMG_DIR = os.path.join(os.path.expanduser('~'), 'Desktop', 'vibecoding', 'tongsarang', 'public', 'images', '생활과윤리')
DIST_DIR = os.path.join(os.path.expanduser('~'), 'Desktop', 'vibecoding', 'tongsarang', 'dist', 'images', '생활과윤리')
BOTTOM_PADDING = 15  # 콘텐츠 아래 여백 (px)
RIGHT_PADDING = 10   # 콘텐츠 오른쪽 여백 (px)
VLINE_THRESHOLD = 0.5  # 세로선 판정: 이미지 높이의 50% 이상 어두운 픽셀
DARK_PIXEL = 200       # 어두운 픽셀 기준값
CONTENT_PIXEL = 240    # 콘텐츠 판정 기준값
WS_THRESHOLD = 0.10    # 아래 여백이 10% 이상이면 트리밍


def detect_vline_col(arr):
    """오른쪽 끝에서 세로 구분선 시작 열을 찾는다."""
    h, w = arr.shape
    # 오른쪽 30px 범위에서 탐색
    search_w = min(30, w // 4)
    for c in range(w - 1, w - search_w - 1, -1):
        dark_count = np.sum(arr[:, c] < DARK_PIXEL)
        if dark_count > h * VLINE_THRESHOLD:
            return c
    return None


def fix_image(img):
    """이미지를 보정하여 반환. 변경 없으면 None 반환."""
    arr = np.array(img.convert('L'))
    h, w = arr.shape
    changed = False

    # 1) 오른쪽 구분선 감지 및 제거
    vline_col = detect_vline_col(arr)
    right_crop = w
    if vline_col is not None:
        # 구분선 시작점에서 왼쪽으로 이동하여 연속된 선 영역 찾기
        line_start = vline_col
        for c in range(vline_col, max(0, vline_col - 15), -1):
            if np.sum(arr[:, c] < DARK_PIXEL) > h * VLINE_THRESHOLD:
                line_start = c
            else:
                break
        right_crop = line_start
        changed = True

    # 2) 아래 여백 감지 (구분선 영역 제외하고 분석)
    clean_right = min(right_crop, w - 10) if vline_col else w
    arr_clean = arr[:, 5:clean_right]
    row_has_content = np.any(arr_clean < CONTENT_PIXEL, axis=1)
    content_rows = np.where(row_has_content)[0]

    if len(content_rows) == 0:
        return None

    last_content_row = content_rows[-1]
    bottom_ws = h - last_content_row - 1
    bottom_pct = bottom_ws / h

    bottom_crop = h
    if bottom_pct > WS_THRESHOLD:
        bottom_crop = min(h, last_content_row + 1 + BOTTOM_PADDING)
        changed = True

    if not changed:
        return None

    # 3) 오른쪽 콘텐츠 경계 찾기 (구분선 제거 후)
    cropped_arr = arr[:bottom_crop, :right_crop]
    col_has_content = np.any(cropped_arr < CONTENT_PIXEL, axis=0)
    content_cols = np.where(col_has_content)[0]
    if len(content_cols) > 0:
        right_content = min(right_crop, content_cols[-1] + 1 + RIGHT_PADDING)
    else:
        right_content = right_crop

    result = img.crop((0, 0, right_content, bottom_crop))
    return result


def main():
    files = sorted([f for f in os.listdir(IMG_DIR) if f.endswith(('.jpg', '.png'))])
    print(f"Scanning {len(files)} images in {IMG_DIR}")

    fixed = 0
    for f in files:
        path = os.path.join(IMG_DIR, f)
        img = Image.open(path)
        result = fix_image(img)
        if result is not None:
            # 원본과 같은 포맷으로 저장
            ext = os.path.splitext(f)[1].lower()
            if ext == '.jpg':
                result.save(path, 'JPEG', quality=95)
            else:
                result.save(path, 'PNG')
            # dist에도 복사
            dist_path = os.path.join(DIST_DIR, f)
            if os.path.isdir(DIST_DIR):
                if ext == '.jpg':
                    result.save(dist_path, 'JPEG', quality=95)
                else:
                    result.save(dist_path, 'PNG')
            fixed += 1
            old_size = img.size
            new_size = result.size
            print(f"  Fixed: {f}  {old_size[0]}x{old_size[1]} -> {new_size[0]}x{new_size[1]}")

    print(f"\nDone: {fixed}/{len(files)} images fixed")


if __name__ == '__main__':
    main()
