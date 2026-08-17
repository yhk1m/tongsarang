# © 2026 김용현
"""2026년 시행 학평의 학년도 라벨을 각 과목 파일의 기존 관행에 맞춘다.

## 배경

학평의 학년도 표기는 과목마다, 심지어 **월마다** 다르다. 규칙을 가정하지 않고,
메가스터디 정답과 정확히 일치하는 시험을 찾아 649개 시험지를 전수 역추적한 결과
(2021년 이후 관행):

    과목                                      3월   5월   7월
    한국지리·한국사·동아시아사·세계사·통합사회        시행   시행   시행
    세계지리·생활과윤리·윤리와사상·경제·정치와법·사회문화  학년도  시행   시행

'시행'은 라벨 = 시행연도, '학년도'는 라벨 = 시행연도 + 1 이다.
(모평·수능은 전 과목 예외 없이 학년도 표기다.)

2026년 시행 학평(3·5·7월)을 넣을 때 전 과목을 '2026'으로 했는데, 위 표에서 '학년도'인
칸만 '2027'이어야 한다. 데이터의 학년도와 이미지 파일 이름을 함께 옮긴다.

    python scripts/relabel_2026_hakpyeong.py --dry
    python scripts/relabel_2026_hakpyeong.py
"""
import os
import sys
import json
import argparse

sys.stdout.reconfigure(encoding='utf-8')

HOME = os.path.expanduser('~')
PROJECT_DIR = os.path.join(HOME, 'Desktop', 'vibecoding', 'tongsarang')
DATA_DIR = os.path.join(PROJECT_DIR, 'public', 'data')
IMG_DIR = os.path.join(PROJECT_DIR, 'public', 'images')

EXAM_YEAR = '2026'      # 2026년 3·5·7월 시행
SCHOOL_YEAR = '2027'    # 2027학년도

# 과목 → {분류: 있어야 할 학년도}
CODES = {'세계지리': 'wgeo', '생활과윤리': 'leth', '윤리와사상': 'ethth',
         '경제': 'econ', '정치와법': 'pollaw', '사회문화': 'socul'}
WANT = {cat: (SCHOOL_YEAR if cat == '3월' else EXAM_YEAR) for cat in ('3월', '5월', '7월')}
MONTHS = {'3월': '03', '5월': '05', '7월': '07'}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true')
    args = ap.parse_args()

    total_rows = total_imgs = 0
    for subject, code in CODES.items():
        data_path = os.path.join(DATA_DIR, f'{subject}.json')
        data = json.load(open(data_path, encoding='utf-8'))
        img_dir = os.path.join(IMG_DIR, subject)

        moved_rows = 0
        for cat, want_year in WANT.items():
            month = MONTHS[cat]
            wrong = [r for r in data
                     if r['분류'] == cat and r['학년도'] != want_year
                     and r['학년도'] in (EXAM_YEAR, SCHOOL_YEAR)]
            if not wrong:
                continue
            have_year = wrong[0]['학년도']
            if any(r['분류'] == cat and r['학년도'] == want_year for r in data):
                print(f'  ! {subject} {cat}: {want_year} 가 이미 있음 — 건너뜀')
                continue

            if not args.dry:
                for r in wrong:
                    r['학년도'] = want_year
            moved_rows += len(wrong)

            renamed = 0
            old_prefix = f'{have_year}_{month}_{code}_'
            for f in sorted(os.listdir(img_dir)):
                if f.startswith(old_prefix):
                    if not args.dry:
                        os.replace(os.path.join(img_dir, f),
                                   os.path.join(img_dir, f'{want_year}_{month}_{code}_' + f[len(old_prefix):]))
                    renamed += 1
            print(f'  {subject} {cat}: {len(wrong)}행 / 이미지 {renamed}장  {have_year} → {want_year}')
            total_imgs += renamed

        if moved_rows and not args.dry:
            # 학년도 내림차순 유지 + 순번 재부여
            def sort_key(r):
                order = {'수능': 8, '11월': 8, '10월': 7, '10월학평': 7, '9월': 6, '9모': 6,
                         '7월': 5, '7월학평': 5, '6월': 4, '6모': 4, '5월': 3, '5월학평': 3,
                         '4월': 2, '4월학평': 2, '3월': 1, '3월학평': 1}
                return (-int(r['학년도']), -order.get(r['분류'], 0), int(r['번호']))
            data.sort(key=sort_key)
            for i, r in enumerate(data):
                r['순번'] = i + 1
            json.dump(data, open(data_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        total_rows += moved_rows

    verb = '변경 예정' if args.dry else '변경 완료'
    print(f'\n총 {total_rows}행 / 이미지 {total_imgs}장 {verb}')


if __name__ == '__main__':
    main()
