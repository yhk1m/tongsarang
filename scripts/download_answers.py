"""
통합사회 해설/문제 PDF를 EBSi에서 다운로드하고,
정답/배점 데이터를 추출하여 public/data/통합사회.json에 반영하는 스크립트
"""

import re
import os
import json
import sys
import urllib.request
import pdfplumber

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(BASE_DIR, 'temp_pdfs')
JSON_PATH = os.path.join(BASE_DIR, 'public', 'data', '통합사회.json')

PAPERS = [
    # 2025
    (2025, '10',
     'https://wdown.ebsi.co.kr/W61001/01exam/20251014/go1/s_soc_hsj_3M9Y1UF8_1.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20251014/go1/s_soc_mun_B2LWS32Q_1.pdf'),
    (2025, '09',
     'https://wdown.ebsi.co.kr/W61001/01exam/20250903/go1/s_soc_hsj_81697BTR_1.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20250903/go1/s_soc_mun_D21CIK67_1.pdf'),
    (2025, '06',
     'https://wdown.ebsi.co.kr/W61001/01exam/20250604/go1/s_soc_hsj_R9XFK188.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20250604/go1/s_soc_mun_XZ75N63B.pdf'),
    (2025, '03',
     'https://wdown.ebsi.co.kr/W61001/01exam/20250326/go1/s_soc_hsj_F8FAU198.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20250326/go1/s_soc_mun_853LV882.pdf'),
    # 2024
    (2024, '10',
     'https://wdown.ebsi.co.kr/W61001/01exam/20241015/go1/s_soc_hsj_E3IP933W.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20241015/go1/s_soc_mun_586NNK98.pdf'),
    (2024, '09',
     'https://wdown.ebsi.co.kr/W61001/01exam/20240904/go1/s_soc_hsj_M6A5179Z.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20240904/go1/s_soc_mun_8FPH649V.pdf'),
    (2024, '06',
     'https://wdown.ebsi.co.kr/W61001/01exam/20240604/go1/s_soc_hsj_J47A4N47.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20240604/go1/s_soc_mun_4Q2293L6.pdf'),
    (2024, '03',
     'https://wdown.ebsi.co.kr/W61001/01exam/20240328/go1/s_soc_hsj_F4214G5T.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20240328/go1/s_soc_mun_7MHACK3R.pdf'),
    # 2023
    (2023, '11',
     'https://wdown.ebsi.co.kr/W61001/01exam/20231219/go1/s_soc_hsj_9512V2AA.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20231219/go1/s_soc_mun_3UHD5I12.pdf'),
    (2023, '09',
     'https://wdown.ebsi.co.kr/W61001/01exam/20230906/go1/s_soc_hsj_XSEFXPBZ.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20230906/go1/s_soc_mun_4LELD2S7.pdf'),
    (2023, '06',
     'https://wdown.ebsi.co.kr/W61001/01exam/20230601/go1/s_soc_hsj_96CA2L6I.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20230601/go1/s_soc_mun_RE5J3BL2.pdf'),
    (2023, '03',
     'https://wdown.ebsi.co.kr/W61001/01exam/20230323/go1/s_soc_hsj_J4169716.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20230323/go1/s_soc_mun_J52V136D.pdf'),
    # 2022 (EBSi: 11월 학평 → 우리 JSON: 10월)
    (2022, '11',
     'https://wdown.ebsi.co.kr/W61001/01exam/20221123/go1/s_soc_hsj_2A5367A5.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20221123/go1/s_soc_mun_722X2374.pdf'),
    (2022, '09',
     'https://wdown.ebsi.co.kr/W61001/01exam/20220901/go1/s_soc_hsj_223FZ2J4.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20220901/go1/s_soc_mun_1TW8LJ5Q.pdf'),
    (2022, '06',
     'https://wdown.ebsi.co.kr/W61001/01exam/20220609/go1/s_soc_hsj_82M2E1LN.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20220609/go1/s_soc_mun_JG121419.pdf'),
    (2022, '03',
     'https://wdown.ebsi.co.kr/W61001/01exam/20220324/go1/s_soc_hsj_H1TBN3WX.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20220324/go1/s_soc_mun_486T2R8B.pdf'),
    # 2021
    (2021, '11',
     'https://wdown.ebsi.co.kr/W61001/01exam/20211124/go1/s_soc_hsj_9966AF7X.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20211124/go1/s_soc_mun_L42HVALL.pdf'),
    (2021, '09',
     'https://wdown.ebsi.co.kr/W61001/01exam/20210831/go1/s_soc_hsj_55U5HS19.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20210831/go1/s_soc_mun_Y9Q55823.pdf'),
    (2021, '06',
     'https://wdown.ebsi.co.kr/W61001/01exam/20210603/go1/s_soc_hsj_S1NUN31E.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20210603/go1/s_soc_mun_73ECO445.pdf'),
    (2021, '03',
     'https://wdown.ebsi.co.kr/W61001/01exam/20210325/go1/s_soc_hsj_G6BIZ8WM.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20210325/go1/s_soc_mun_U17C4646.pdf'),
    # 2020
    (2020, '11',
     'https://wdown.ebsi.co.kr/W61001/01exam/20201118/go1/s_soc_hsj_Y8B47598.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20201118/go1/s_soc_mun_1J5YJYZ1.pdf'),
    (2020, '09',
     'https://wdown.ebsi.co.kr/W61001/01exam/20200916/go1/s_soc_hsj_72WGGF8Z.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20200916/go1/s_soc_mun_24QWIJLJ.pdf'),
    (2020, '06',
     'https://wdown.ebsi.co.kr/W61001/01exam/20200618/go1/s_soc_hsj_3WH3748S.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20200618/go1/s_soc_mun_7Z29R7J3.pdf'),
    (2020, '03',
     'https://wdown.ebsi.co.kr/W61001/01exam/20200312/go1/s_soc_hsj_I35TLYK6.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20200312/go1/s_soc_mun_5HU318U3.pdf'),
    # 2019
    (2019, '11',
     'https://wdown.ebsi.co.kr/W61001/01exam/20191120/go1/s_soc_hsj_B3994L71_11.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20191120/go1/s_soc_mun_188Q1C3K_11.pdf'),
    (2019, '09',
     'https://wdown.ebsi.co.kr/W61001/01exam/20190904/go1/s_soc_hsj_P34N3LF8_10.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20190904/go1/s_soc_mun_188Q1C3K_11.pdf'),
    (2019, '06',
     'https://wdown.ebsi.co.kr/W61001/01exam/20190604/go1/s_soc_hsj_c99ir3wS_10.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20190604/go1/s_soc_mun_8QVjp3b6_10.pdf'),
    (2019, '03',
     'https://wdown.ebsi.co.kr/W61001/01exam/20190307/go1/s_soc_hsj_naHJveIn_12.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20190307/go1/s_soc_mun_FU8wO9Wa_2_10.pdf'),
    # 2018
    (2018, '11',
     'https://wdown.ebsi.co.kr/W61001/01exam/20181121/go1/s_soc_hsj_V6uPDVni_01_10.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20181121/go1/s_soc_mun_cOrBLSAQ_01_10.pdf'),
    (2018, '09',
     'https://wdown.ebsi.co.kr/W61001/01exam/20180905/go1/s_soc_hsj_MObBWu5t_12.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20180905/go1/s_soc_mun_29ToukzU_01_10.pdf'),
    (2018, '06',
     'https://wdown.ebsi.co.kr/W61001/01exam/20180607/go1/s_soc_hsj_DT6Z3Lst_02_10.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20180607/go1/s_soc_mun_QIWDO3hR_02_10.pdf'),
    (2018, '03',
     'https://wdown.ebsi.co.kr/W61001/01exam/20180308/go1/s_soc_hsj_HxwgxSc6_12.pdf',
     'https://wdown.ebsi.co.kr/W61001/01exam/20180308/go1/s_soc_mun_5i5Qy2Lf_01_10.pdf'),
]

CIRCLE_MAP = {'①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5}

# 이미지 기반 해설 PDF → 정답표 이미지에서 직접 읽은 값
MANUAL_ANSWERS = {
    (2023, '11'): {
        1: 2, 2: 5, 3: 2, 4: 3, 5: 3,
        6: 1, 7: 3, 8: 3, 9: 3, 10: 5,
        11: 2, 12: 4, 13: 1, 14: 5, 15: 5,
        16: 4, 17: 5, 18: 1, 19: 4, 20: 1
    },
    (2019, '03'): {
        1: 3, 2: 1, 3: 5, 4: 3, 5: 5,
        6: 4, 7: 4, 8: 3, 9: 1, 10: 3,
        11: 2, 12: 2, 13: 1, 14: 2, 15: 3,
        16: 2, 17: 3, 18: 4, 19: 4, 20: 1
    },
    (2018, '09'): {
        1: 1, 2: 5, 3: 2, 4: 4, 5: 5,
        6: 3, 7: 3, 8: 4, 9: 4, 10: 1,
        11: 4, 12: 4, 13: 5, 14: 3, 15: 1,
        16: 2, 17: 3, 18: 2, 19: 1, 20: 3
    },
    (2018, '03'): {
        1: 4, 2: 2, 3: 1, 4: 4, 5: 5,
        6: 5, 7: 3, 8: 4, 9: 3, 10: 5,
        11: 1, 12: 3, 13: 2, 14: 4, 15: 3,
        16: 5, 17: 3, 18: 1, 19: 1, 20: 2
    },
}


def download_file(url, filepath):
    if os.path.exists(filepath):
        return True
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Referer': 'https://www.ebsi.co.kr/'
        })
        with urllib.request.urlopen(req, timeout=30) as resp:
            with open(filepath, 'wb') as f:
                f.write(resp.read())
            return True
    except Exception as e:
        print(f'    Download failed: {e}')
        return False


def extract_answers_from_hsj(filepath):
    """해설 PDF에서 정답표 추출"""
    try:
        with pdfplumber.open(filepath) as pdf:
            # 테이블 추출 시도
            for page_num in range(min(2, len(pdf.pages))):
                tables = pdf.pages[page_num].extract_tables()
                for table in tables:
                    parsed = parse_horizontal_answer_table(table)
                    if len(parsed) >= 15:
                        return parsed

            # 텍스트에서 추출
            for page_num in range(min(2, len(pdf.pages))):
                text = pdf.pages[page_num].extract_text()
                if text:
                    parsed = parse_answer_from_text(text)
                    if len(parsed) >= 15:
                        return parsed
    except Exception as e:
        print(f'    HSJ parse error: {e}')
    return {}


def parse_horizontal_answer_table(table):
    """가로형 정답표: ['1', '⑤', '2', '①', ...]"""
    answers = {}
    for row in table:
        if not row:
            continue
        cells = [str(c).strip() if c else '' for c in row]
        i = 0
        while i < len(cells) - 1:
            if cells[i].isdigit():
                num = int(cells[i])
                ans_str = cells[i + 1]
                if 1 <= num <= 25:
                    ans = CIRCLE_MAP.get(ans_str, 0)
                    if not ans and ans_str.isdigit() and 1 <= int(ans_str) <= 5:
                        ans = int(ans_str)
                    if ans:
                        answers[num] = ans
            i += 2
    return answers


def parse_answer_from_text(text):
    """텍스트에서 정답 추출"""
    answers = {}
    for match in re.finditer(r'(\d{1,2})\s+([①②③④⑤])', text):
        num = int(match.group(1))
        ans = CIRCLE_MAP.get(match.group(2), 0)
        if 1 <= num <= 25 and ans:
            answers[num] = ans
    return answers


def extract_points_from_mun(filepath, total_questions=20, new_format=False):
    """
    문제 PDF에서 배점 추출 (좌표 기반, 2단 레이아웃 대응).

    old format (2025-03 이전): [3점] 표시가 있으면 3점, 없으면 2점
    new format (2025-06 이후): 모든 문항에 [1.5점], [2점], [2.5점] 표시
    """
    # 1단계: 모든 문항번호 후보와 배점 마커를 좌표와 함께 수집
    raw_q_candidates = []  # (page_idx, question_num, x, y)
    pt_markers = []        # (page_idx, point_value, x, y)

    try:
        with pdfplumber.open(filepath) as pdf:
            for pi, page in enumerate(pdf.pages):
                words = page.extract_words(use_text_flow=False)

                for w in words:
                    m = re.match(r'^(\d{1,2})\.(?!\d)', w['text'])
                    if m:
                        num = int(m.group(1))
                        if 1 <= num <= total_questions:
                            raw_q_candidates.append((pi, num, w['x0'], w['top']))

                    if new_format:
                        m2 = re.search(r'\[\s*(\d+\.?\d*)\s*점\s*\]', w['text'])
                        if m2:
                            val = float(m2.group(1))
                            if val in (1.5, 2, 2.5):
                                pt_markers.append((pi, val, w['x0'], w['top']))
                    else:
                        if re.search(r'\[\s*3\s*점\s*\]', w['text']):
                            pt_markers.append((pi, 3, w['x0'], w['top']))

    except Exception as e:
        print(f'    MUN parse error: {e}')

    # 2단계: 빈도 기반 칼럼 경계 결정
    # x좌표를 20px 단위로 그룹화하고 가장 빈번한 2개를 좌/우 칼럼으로 사용
    from collections import Counter
    x_counts = Counter(round(x / 20) * 20 for _, _, x, _ in raw_q_candidates)
    top_two = x_counts.most_common(2)
    if len(top_two) >= 2:
        pos_a, pos_b = top_two[0][0], top_two[1][0]
        right_col_x = max(pos_a, pos_b)
        col_boundary = right_col_x - 15
    else:
        col_boundary = 9999  # 단일 칼럼

    # 3단계: 칼럼별 필터링 (각 칼럼의 왼쪽 가장자리 근처만 유지)
    left_cands = [(p, n, x, y) for p, n, x, y in raw_q_candidates if x < col_boundary]
    right_cands = [(p, n, x, y) for p, n, x, y in raw_q_candidates if x >= col_boundary]

    q_markers = []
    if left_cands:
        left_min_x = min(x for _, _, x, _ in left_cands)
        for p, n, x, y in left_cands:
            if x < left_min_x + 15:
                q_markers.append((p, n, x, y))
    if right_cands:
        right_min_x = min(x for _, _, x, _ in right_cands)
        for p, n, x, y in right_cands:
            if x < right_min_x + 15:
                q_markers.append((p, n, x, y))

    # 4단계: 배점 마커를 같은 페이지·같은 칼럼의 가장 가까운 위 문항에 매핑
    mapped = {}  # question_num → point_value
    for pi, pt_val, pt_x, pt_y in pt_markers:
        page_qs = [(n, x, y) for p, n, x, y in q_markers if p == pi]
        best_q = None
        best_dist = float('inf')
        for n, qx, qy in page_qs:
            same_col = (pt_x < col_boundary and qx < col_boundary) or \
                       (pt_x >= col_boundary and qx >= col_boundary)
            if not same_col:
                continue
            if qy <= pt_y:
                dist = pt_y - qy
                if dist < best_dist:
                    best_dist = dist
                    best_q = n
        if best_q is not None:
            mapped[best_q] = pt_val

    # 최종 배점 딕셔너리 생성
    points = {}
    if new_format:
        # 새 형식: 매핑 안 된 문항은 2점 (기본값)
        for q in range(1, total_questions + 1):
            points[q] = mapped.get(q, 2)
    else:
        # 구 형식: [3점] 매핑된 문항만 3점, 나머지 2점
        for q in range(1, total_questions + 1):
            points[q] = 3 if q in mapped else 2

    three_pt = set(q for q, v in mapped.items() if v == 3) if not new_format else set()
    return points, three_pt


def main():
    os.makedirs(PDF_DIR, exist_ok=True)

    print('=== 1단계: PDF 다운로드 ===')
    for year, month, hsj_url, mun_url in PAPERS:
        hsj_file = os.path.join(PDF_DIR, f'{year}_{month}_hsj.pdf')
        mun_file = os.path.join(PDF_DIR, f'{year}_{month}_mun.pdf')
        if not os.path.exists(hsj_file):
            print(f'  Downloading {year}_{month}_hsj.pdf ...')
            download_file(hsj_url, hsj_file)
        if not os.path.exists(mun_file):
            print(f'  Downloading {year}_{month}_mun.pdf ...')
            download_file(mun_url, mun_file)

    print('\n=== 2단계: 정답/배점 추출 ===')
    all_data = {}

    for year, month, hsj_url, mun_url in PAPERS:
        hsj_file = os.path.join(PDF_DIR, f'{year}_{month}_hsj.pdf')
        mun_file = os.path.join(PDF_DIR, f'{year}_{month}_mun.pdf')
        print(f'\n  [{year}년 {month}월]')

        # 2025년 6월부터 25문항 (2025년 3월은 아직 20문항)
        total_q = 25 if (year > 2025 or (year == 2025 and month != '03')) else 20

        # 정답 추출
        key = (year, month)
        if key in MANUAL_ANSWERS:
            answers = MANUAL_ANSWERS[key]
            print(f'    정답: {len(answers)}개 (수동 입력)')
        elif os.path.exists(hsj_file):
            answers = extract_answers_from_hsj(hsj_file)
            print(f'    정답: {len(answers)}개 추출')
        else:
            answers = {}
            print(f'    정답: 파일 없음')

        # 배점 추출
        new_fmt = (year > 2025 or (year == 2025 and month != '03'))
        if os.path.exists(mun_file):
            points, three_pt = extract_points_from_mun(mun_file, total_q, new_format=new_fmt)
            total_pts = sum(points.values())
            if new_fmt:
                print(f'    배점: 총={total_pts}점 (1.5/2/2.5점 형식)')
            else:
                print(f'    배점: 3점={sorted(three_pt)}, 총={total_pts}점')
        else:
            points = {q: 2 for q in range(1, total_q + 1)}
            three_pt = set()
            print(f'    배점: 파일 없음 (기본 2점)')

        # 합치기
        if answers:
            combined = {}
            for num in range(1, total_q + 1):
                if num in answers:
                    combined[num] = {
                        '답': answers[num],
                        '배점': points.get(num, 2)
                    }
            all_data[key] = combined
            total = sum(d['배점'] for d in combined.values())
            print(f'    결과: {len(combined)}문항, 총 {total}점')
        else:
            print(f'    WARNING: 정답 추출 실패!')

    print(f'\n=== 3단계: JSON 업데이트 ===')

    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    cat_to_month = {
        '3월': '03', '6월': '06', '9월': '09',
        '10월': '10', '11월': '11'
    }

    updated = 0
    for item in data:
        year = item.get('학년도')
        cat = item.get('분류', '')
        num = item.get('번호')
        if not year or not num:
            continue
        month = cat_to_month.get(cat)
        if not month:
            continue

        year_int = int(year)
        num_int = int(num)

        # 2018-2022: 우리 JSON의 10월 = EBSi의 11월 학평
        # 2023: 11월 = 11월 그대로
        # 2024+: 10월 = 10월 그대로
        ebsi_month = month
        if month == '10' and year_int <= 2022:
            ebsi_month = '11'

        key = (year_int, ebsi_month)
        if key in all_data and num_int in all_data[key]:
            d = all_data[key][num_int]
            item['답'] = d['답']
            item['배점'] = d['배점']
            updated += 1

    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f'  Updated {updated}/{len(data)} items')

    # 미처리 항목 분석
    missing = {}
    for item in data:
        if item.get('답', '') == '' or item.get('배점', '') == '':
            key = (item.get('학년도', '?'), item.get('분류', '?'))
            missing[key] = missing.get(key, 0) + 1
    if missing:
        print(f'\n  미처리 항목:')
        for k, v in sorted(missing.items()):
            print(f'    {k[0]}_{k[1]}: {v}개')

    print('\nDone!')


if __name__ == '__main__':
    main()
