# © 2026 김용현
"""묶음 문항([17~18] 처럼 자료 하나에 문항 여럿)을 문항 그림으로 찾아 public/data/bundles.json 에 적는다.

묶음 문항은 그림마다 공통 자료가 위에 똑같이 들어 있다(자르기가 몇 픽셀씩 어긋날 뿐).
그래서 같은 시험의 이웃한 두 문항(n, n+1) 그림을 위치를 맞춰 겹쳐 보고,
윗부분 글자가 거의 겹치면 묶음으로 본다. 겹침이 끝나는 줄이 공통 자료의 끝이다.

결과 (과목별, 키는 questionKey 와 같은 학년도_분류_[고2_]번호):
  { "정치와법": { "2026_수능_17": { "group": [17, 18], "end": 1342 }, ... } }
  end = 그 문항 그림에서 공통 자료가 끝나는 줄(px). 그 아래부터 그 문항의 번호와 발문이다.

쓰는 법: python scripts/detect_bundles.py [과목 ...]   (과목을 안 주면 전부)
"""
import json, os, sys
from collections import defaultdict
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'public', 'data')
IMAGES = os.path.join(ROOT, 'public', 'images')

SUBJECT_CODE = {
    '한국지리': 'korgeo', '세계지리': 'wgeo', '통합사회': 'iss', '한국사': 'korhis', '정치와법': 'pollaw',
    '경제': 'econ', '사회문화': 'socul', '생활과윤리': 'leth', '윤리와사상': 'ethth', '동아시아사': 'eahis', '세계사': 'worhis',
}
MONTH = {'수능': '11', '9모': '09', '6모': '06', '10월학평': '10', '7월학평': '07', '5월학평': '05', '4월학평': '04',
         '3월학평': '03', '11월': '11', '10월': '10', '9월': '09', '7월': '07', '6월': '06', '5월': '05', '4월': '04', '3월': '03'}

DS = 4            # 맞춰 보기는 1/4 크기에서
BAND = 420        # 윗부분 몇 px 를 비교할지 (원래 크기)
SHIFT = 10        # 1/4 크기에서 ±10 칸 = 원래 크기 ±40px
IOU_MIN = 0.5     # 이만큼 겹치면 묶음


def key_of(q):
    g = '고2_' if q.get('학년') == '고2' else ''
    return f"{q['학년도']}_{q['분류']}_{g}{q['번호']}"


def image_path(subject, q):
    code = SUBJECT_CODE[subject]
    if code == 'iss' and q.get('학년') == '고2':
        code = 'iss2'
    name = f"{q['학년도']}_{MONTH.get(q['분류'], '00')}_{code}_{int(q['번호']):02d}"
    for ext in ('.jpg', '.png'):
        p = os.path.join(IMAGES, subject, name + ext)
        if os.path.exists(p):
            return p
    return None


def load_ink(path):
    """글자(어두운 점)만 True. 그림 높이 대부분을 지나는 세로줄(단 구분선)은 지운다."""
    g = np.asarray(Image.open(path).convert('L'))
    ink = g < 150
    tall = ink.mean(axis=0) > 0.6
    ink[:, tall] = False
    return ink


def small(ink, rows):
    h = min(rows, ink.shape[0]) // DS * DS
    w = ink.shape[1] // DS * DS
    return ink[:h, :w].reshape(h // DS, DS, w // DS, DS).mean(axis=(1, 3)) > 0.12


def best_shift(a, b):
    """b 를 (dy, dx) 만큼 옮겨 a 와 가장 잘 겹칠 때의 IoU"""
    best = (0.0, 0, 0)
    for dy in range(-SHIFT, SHIFT + 1):
        for dx in range(-SHIFT, SHIFT + 1):
            ya0, yb0 = max(0, -dy), max(0, dy)
            xa0, xb0 = max(0, -dx), max(0, dx)
            h = min(a.shape[0] - ya0, b.shape[0] - yb0)
            w = min(a.shape[1] - xa0, b.shape[1] - xb0)
            if h < 20 or w < 50:
                continue
            A = a[ya0:ya0 + h, xa0:xa0 + w]
            B = b[yb0:yb0 + h, xb0:xb0 + w]
            inter = np.logical_and(A, B).sum()
            union = np.logical_or(A, B).sum()
            if union < 80:
                continue
            iou = inter / union
            if iou > best[0]:
                best = (iou, dy, dx)
    return best


def refine(a, b, dy0, dx0, rows=BAND):
    """원래 크기에서 ±DS px 다시 맞춘다"""
    best = (0.0, dy0, dx0)
    for dy in range(dy0 - DS, dy0 + DS + 1):
        for dx in range(dx0 - DS, dx0 + DS + 1):
            ya0, yb0 = max(0, -dy), max(0, dy)
            xa0, xb0 = max(0, -dx), max(0, dx)
            h = min(rows, a.shape[0] - ya0, b.shape[0] - yb0)
            w = min(a.shape[1] - xa0, b.shape[1] - xb0)
            A = a[ya0:ya0 + h, xa0:xa0 + w]
            B = b[yb0:yb0 + h, xb0:xb0 + w]
            union = np.logical_or(A, B).sum()
            if union == 0:
                continue
            iou = np.logical_and(A, B).sum() / union
            if iou > best[0]:
                best = (iou, dy, dx)
    return best


def _lines(a):
    """글자 줄(잉크가 있는 줄이 이어진 구간)을 (위, 아래) 로. 2줄 이하 틈은 이어 본다."""
    rows = a.sum(axis=1) > 2
    out, y, H = [], 0, a.shape[0]
    while y < H:
        if not rows[y]:
            y += 1
            continue
        top = y
        while y < H and (rows[y] or (y + 2 < H and (rows[y + 1] or rows[y + 2]))):
            y += 1
        # 상자, 그림처럼 키 큰 덩어리는 60줄씩 나눠서 따로 맞춘다
        for s in range(top, y, 60):
            out.append((s, min(y, s + 60)))
    return out


def _dilate(m):
    d = m.copy()
    d[1:] |= m[:-1]; d[:-1] |= m[1:]
    d[:, 1:] |= m[:, :-1]; d[:, :-1] |= m[:, 1:]
    return d


def _line_iou(a, b, top, bot, dy, dx, ry, rx, step):
    """a 의 [top, bot) 줄을 b 의 (dy, dx) 근처에서 찾는다. 1px 번짐은 같은 것으로 본다."""
    A = a[top:bot]
    Ad = _dilate(A)
    best = (0.0, dy, dx)
    for y in range(dy - ry, dy + ry + 1, step):
        yb = top + y
        if yb < 0 or yb + A.shape[0] > b.shape[0]:
            continue
        for x in range(dx - rx, dx + rx + 1, step):
            xa0, xb0 = max(0, -x), max(0, x)
            w = min(a.shape[1] - xa0, b.shape[1] - xb0)
            if w < 50:
                continue
            Aw, Adw = A[:, xa0:xa0 + w], Ad[:, xa0:xa0 + w]
            B = b[yb:yb + A.shape[0], xb0:xb0 + w]
            Bd = _dilate(B)
            na, nb = Aw.sum(), B.sum()
            if na + nb == 0:
                continue
            hit = (np.logical_and(Aw, Bd).sum() + np.logical_and(B, Adw).sum()) / (na + nb)
            if hit > best[0]:
                best = (hit, y, x)
    return best


def passage_end(a, b, dy, dx):
    """a 와 b 의 글자 줄을 위에서부터 하나씩 맞춰 본다. 처음으로 b 에 없는 줄이 문항의 시작이고,
    그 위 틈이 공통 자료의 끝이다. 자료를 이어 붙여 중간에 어긋난 그림은 줄마다 다시 맞춘다."""
    lines = _lines(a)
    prev_bot = 0
    for top, bot in lines:
        # 테두리 조각처럼 잉크가 거의 없는 줄은 건너뛴다
        if bot - top < 4 or a[top:bot].sum() < 150:
            prev_bot = bot
            continue
        hit, y, x = _line_iou(a, b, top, bot, dy, dx, 6, 6, 1)
        if hit < 0.7:
            hit, y, x = _line_iou(a, b, top, bot, dy, dx, 90, 30, 3)
            if hit >= 0.75:
                hit, y, x = _line_iou(a, b, top, bot, y, x, 3, 3, 1)
        if hit >= 0.7:
            dy, dx = y, x
            prev_bot = bot
            continue
        if top == lines[0][0]:
            return None
        # 끝 줄과, 그때 b 를 맞춘 위치 차이 (b 의 끝 = 끝 + dy)
        return (prev_bot + top) // 2, dy
    return None


def detect(subject):
    data = json.load(open(os.path.join(DATA, f'{subject}.json'), encoding='utf-8'))
    exams = defaultdict(dict)
    for q in data:
        try:
            exams[(str(q['학년도']), q['분류'], q.get('학년') or '')][int(q['번호'])] = q
        except (ValueError, TypeError):
            pass
    found = {}
    pairs = 0
    for exam, by_num in exams.items():
        cache = {}

        def get(n):
            if n not in cache:
                p = image_path(subject, by_num[n])
                cache[n] = load_ink(p) if p else None
            return cache[n]

        for n in sorted(by_num):
            if n + 1 not in by_num:
                continue
            a, b = get(n), get(n + 1)
            cache.pop(n - 1, None)
            if a is None or b is None:
                continue
            pairs += 1
            sa, sb = small(a, BAND), small(b, BAND)
            if sa.sum() < 60 or sb.sum() < 60:
                continue
            iou, dy, dx = best_shift(sa, sb)
            if iou < IOU_MIN:
                continue
            iou2, dy, dx = refine(a, b, dy * DS, dx * DS)
            ra = passage_end(a, b, dy, dx)
            if ra is None or ra[0] < 60:
                continue
            end_a, dy_end = ra
            # b 의 끝은 a 에서 찾은 끝을 옮겨 쓴다. b 쪽에서 따로 세면 테두리 차이로 중간에 끊기는 일이 있다.
            end_b = end_a + dy_end
            qa, qb = by_num[n], by_num[n + 1]
            ka, kb = key_of(qa), key_of(qb)
            group = sorted(set(found.get(ka, {}).get('group', [n]) + [n, n + 1]))
            found.setdefault(ka, {'end': int(end_a)})
            found[kb] = {'end': int(end_b)}
            for m in group:
                k = key_of(by_num[m])
                if k in found:
                    found[k]['group'] = group
            print(f'  {subject} {ka} + {n + 1}  겹침 {iou:.2f}/{iou2:.2f}  자료 끝 {end_a}px / {end_b}px', flush=True)
    return found, pairs


def main():
    subjects = sys.argv[1:] or list(SUBJECT_CODE)
    out_path = os.path.join(DATA, 'bundles.json')
    result = json.load(open(out_path, encoding='utf-8')) if os.path.exists(out_path) else {}
    for s in subjects:
        found, pairs = detect(s)
        result[s] = dict(sorted(found.items()))
        groups = {tuple(v['group']) + (k.rsplit('_', 1)[0],) for k, v in found.items()}
        print(f'{s}: 이웃 문항 {pairs}쌍 중 묶음 {len(groups)}개', flush=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(result, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
