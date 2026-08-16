// © 2026 김용현
// 문항 식별 키와 이미지 파일 이름 규칙을 한곳에 모은다.
//
// 2026년부터 통합사회에 고2 문항이 들어오면서 (학년도, 분류, 번호)만으로는
// 고1 문항과 구분되지 않는다. 고2일 때만 학년 세그먼트를 붙여, 기존 12,000여 문항의
// 키와 이미지 파일명(그리고 default_mappings.json의 성취기준 매핑)을 그대로 둔다.

export const SUBJECT_CODE = {
  '한국지리': 'korgeo',
  '세계지리': 'wgeo',
  '통합사회': 'iss',
  '한국사': 'korhis',
  '정치와법': 'pollaw',
  '경제': 'econ',
  '사회문화': 'socul',
  '생활과윤리': 'leth',
  '윤리와사상': 'ethth',
  '동아시아사': 'eahis',
  '세계사': 'worhis'
};

// 분류 → 이미지 파일명의 월 코드
export const CATEGORY_TO_MONTH = {
  '수능': '11',
  '9모': '09',
  '6모': '06',
  '10월학평': '10',
  '7월학평': '07',
  '5월학평': '05',
  '4월학평': '04',
  '3월학평': '03',
  // 통합사회 등 월 이름만 쓰는 과목
  '11월': '11',
  '10월': '10',
  '9월': '09',
  '7월': '07',
  '6월': '06',
  '5월': '05',
  '4월': '04',
  '3월': '03'
};

/** 학년 구분이 필요한 과목 (통합사회만 고1/고2가 공존한다) */
export const GRADED_SUBJECTS = new Set(['통합사회']);

/** 키에 학년 세그먼트를 붙이는 학년 값 */
const KEYED_GRADE = '고2';

export function keyOf(year, category, number, grade) {
  const g = grade === KEYED_GRADE ? `${KEYED_GRADE}_` : '';
  return `${year}_${category}_${g}${number}`;
}

export function questionKey(item) {
  return keyOf(item.학년도, item.분류, item.번호, item.학년);
}

/** 과목·학년에 대응하는 이미지 코드. 고2 통합사회만 iss2를 쓴다. */
export function imageCode(subject, grade) {
  const code = SUBJECT_CODE[subject] || subject;
  return code === 'iss' && grade === KEYED_GRADE ? 'iss2' : code;
}

/** 확장자를 뺀 이미지 파일 이름 (예: 2026_03_iss2_01) */
export function imageFileName(subject, year, category, number, grade) {
  const month = CATEGORY_TO_MONTH[category] || '00';
  return `${year}_${month}_${imageCode(subject, grade)}_${String(number).padStart(2, '0')}`;
}

export function imageFileNameOf(subject, item) {
  return imageFileName(subject, item.학년도, item.분류, item.번호, item.학년);
}

/** 테이블/모달에서 넘어온 (학년도, 분류, 번호, 학년)로 원본 문항을 찾는다. */
export function findQuestion(data, year, category, number, grade) {
  return data.find(i =>
    String(i.학년도) === String(year) &&
    String(i.분류) === String(category) &&
    String(i.번호) === String(number) &&
    (i.학년 || '') === (grade || '')
  );
}
