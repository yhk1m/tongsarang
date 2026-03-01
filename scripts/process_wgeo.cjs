const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const dataPath = path.join(__dirname, '..', 'public', 'data', '세계지리.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// ===== PART 1: 대단원 분류 =====
const rules = [
  {
    chapter: '1. 세계화와 지역 이해',
    keywords: [
      '세계화', '지역화', '세계 지도', '세계지도', '지도 투영', '투영법',
      '메르카토르', '몰바이데', '정거.*도법', '경위선', '경선', '위선', '본초 자오선',
      '시차', '표준시', '날짜 변경선', '시간대',
      '곤여만국전도', '알 이드리시', '혼일강리', 'TO 지도', '프톨레마이오스',
      '지역 구분', '지역 이해', '문화권', '문화 지역', '문화 경관',
      '공정 무역', '다국적 기업', '세계 도시',
      '대륙별', '대륙.*면적', '지역화 전략',
    ],
  },
  {
    chapter: '2. 세계의 자연환경과 인간 생활',
    keywords: [
      '기후', '기온', '강수', '강수량', '기후 그래프', '기후.*구분',
      '열대', '건조', '온대', '냉대', '한대', '툰드라', '타이가', '스텝', '사바나', '사막',
      '열대 우림', '열대 몬순', '열대 기후', '서안 해양성', '지중해성', '대륙성',
      '쾨펜', '기후 구분',
      '판.*경계', '조산대', '환태평양', '알프스.*히말라야', '화산', '지진',
      '대륙판', '해양판', '수렴.*경계', '발산.*경계', '보존.*경계',
      '카르스트', '석회암', '빙하', '피오르', 'U자.*곡', '빙퇴석', '모레인', '에스커',
      '하천.*지형', '삼각주', '선상지', '범람원', '사구', '사막화',
      '침식.*지형', '퇴적.*지형',
      '자연재해', '홍수', '태풍', '허리케인', '사이클론', '가뭄', '지진해일', '쓰나미',
      '기후 변화', '온난화', '해수면 상승', '사막화',
      '편서풍', '무역풍', '계절풍', '몬순',
      '수목 한계', '설선', '해발 고도', '고도별',
      '대륙 빙하', '산악 빙하', '빙기', '간빙기',
      '종유석', '석순', '석주', '돌리네',
    ],
  },
  {
    chapter: '3. 세계의 인문환경과 인문 경관',
    keywords: [
      '인구', '인구 분포', '인구 구조', '인구 밀도', '인구 이동', '인구 피라미드',
      '도시화', '도시 화율', '종주 도시', '종주.*지수', '슬럼', '스프롤',
      '산업', '산업 구조', '1차 산업', '2차 산업', '3차 산업',
      '농업', '벼농사', '밀', '옥수수', '목축', '플랜테이션', '이동식 화전',
      '혼합 농업', '낙농업', '원예 농업', '기업적 농업', '유목',
      '에너지', '석유', '석탄', '천연가스', '원자력', '발전',
      '신.*재생 에너지', '태양광', '풍력', '수력', '지열',
      '종교', '크리스트교', '이슬람', '불교', '힌두교', '유대교',
      '모스크', '성당', '사원', '교회',
      '언어', '어족', '공용어', '인도유럽', '게르만', '로만스',
      '식량', '식량 자급률', '식량 안보', '식량 문제',
      '자원', '광물 자원', '철광석', '구리', '보크사이트',
      '무역', '수출', '수입', '무역.*의존도',
      '세계.*도시', '메갈로폴리스', '선진국', '개발도상국',
      '출생률', '사망률', '합계 출산율', '자연 증가율',
    ],
  },
  {
    chapter: '4. 몬순 아시아와 오세아니아',
    keywords: [
      '몬순 아시아', '오세아니아', '동아시아', '동남아시아', '남부 아시아', '남아시아',
      '인도', '중국', '일본', '베트남', '태국', '인도네시아', '필리핀', '미얀마', '말레이시아',
      '방글라데시', '파키스탄', '네팔', '스리랑카', '캄보디아', '라오스', '싱가포르',
      '호주', '뉴질랜드', '오스트레일리아', '폴리네시아', '멜라네시아', '미크로네시아',
      '몬순', '계절풍.*아시아',
      '갠지스', '메콩', '양쯔', '황하', '인더스',
      '히말라야', '데칸 고원', '티베트 고원',
      '벼.*재배', '쌀.*생산', '차.*재배', '향신료',
      '아세안', 'ASEAN', 'APEC',
      '원주민', '애버리지니', '마오리',
      '산호초', '환초', '그레이트 배리어',
    ],
  },
  {
    chapter: '5. 건조 아시아와 북부 아프리카',
    keywords: [
      '건조 아시아', '서남아시아', '서아시아', '중앙아시아', '북부 아프리카', '북아프리카',
      '중동', '이란', '이라크', '사우디아라비아', '사우디', '아랍 에미리트', 'UAE',
      '터키', '튀르키예', '이집트', '리비아', '알제리', '모로코', '튀니지',
      '카자흐스탄', '우즈베키스탄', '투르크메니스탄', '아프가니스탄',
      '이슬람.*문화', '이슬람 세계', '무슬림', '라마단', '메카', '모스크.*건조',
      '오아시스', '와디', '사막.*건조', '유목.*건조',
      '석유.*매장', 'OPEC', '석유 수출',
      '수에즈', '페르시아만', '홍해',
      '관개 농업', '대추야자',
      '쿠르드', '팔레스타인', '분쟁.*중동',
      '아랄해', '사해', '나일',
      '카스피해', '흑해',
    ],
  },
  {
    chapter: '6. 유럽과 북부 아메리카',
    keywords: [
      '유럽', '북부 아메리카', '북아메리카',
      '영국', '프랑스', '독일', '이탈리아', '스페인', '포르투갈', '네덜란드',
      '스웨덴', '노르웨이', '핀란드', '덴마크', '아이슬란드', '스위스', '오스트리아',
      '폴란드', '체코', '헝가리', '루마니아', '그리스', '벨기에',
      '러시아', '우크라이나',
      '미국', '캐나다', '멕시코',
      'EU', '유럽 연합', '유로화', 'NAFTA', 'USMCA', '셴겐',
      '알프스', '스칸디나비아', '피레네', '라인강', '도나우강', '미시시피',
      '피오르.*유럽', '빙하.*유럽',
      '지중해.*농업', '혼합 농업.*유럽', '낙농업.*유럽',
      '실리콘 밸리', '선벨트', '러스트벨트', '스노벨트',
      '오대호', '로키산맥', '애팔래치아',
      '히스패닉', '다문화.*미국',
      '브렉시트',
    ],
  },
  {
    chapter: '7. 사하라 이남 아프리카와 중·남부 아메리카',
    keywords: [
      '사하라 이남', '중남부 아메리카', '중.*남부 아메리카', '남아메리카', '중앙아메리카',
      '라틴 아메리카', '라틴아메리카',
      '나이지리아', '에티오피아', '케냐', '남아프리카', '콩고', '가나', '탄자니아',
      '소말리아', '수단', '모잠비크', '마다가스카르', '카메룬', '코트디부아르',
      '브라질', '아르헨티나', '칠레', '페루', '콜롬비아', '베네수엘라', '볼리비아',
      '쿠바', '파나마', '자메이카', '아이티',
      '아마존', '안데스', '파타고니아', '팜파스', '셀바스', '라노스', '카리브해',
      '파나마 운하',
      '아파르트헤이트', '부족.*분쟁', '내전', '분쟁.*아프리카',
      '플랜테이션.*아프리카', '카카오', '커피.*재배', '다이아몬드', '콜탄',
      '열대림.*파괴', '삼림.*파괴', '개발.*환경',
      '메스티소', '물라토', '원주민.*라틴',
      'AU', '아프리카 연합', 'MERCOSUR', '메르코수르',
      '사헬', '기아', '빈곤.*아프리카',
    ],
  },
  {
    chapter: '8. 평화와 공존의 세계',
    keywords: [
      '평화', '공존', '분쟁', '갈등', '영토 분쟁', '경계.*분쟁',
      '국제 사회', '국제 기구', 'UN', '유엔', 'UNESCO',
      '환경 협약', '파리 협약', '교토 의정서', '몬트리올', '람사르', '바젤',
      '지구 온난화.*대책', '탄소.*배출', '온실가스', '탄소 중립',
      '난민', '이주', '강제 이주', '분리 독립',
      '독도', '센카쿠', '쿠릴', '남사.*군도', '카슈미르', '크림',
      '지속 가능.*발전', '지속가능', 'SDGs',
      '생태 관광', '에코 투어리즘',
      '국제.*협력', '공적 개발 원조', 'ODA',
      '인권', '빈부.*격차', '공정.*무역',
    ],
  },
];

function getTextScore(text, rule) {
  let score = 0;
  for (const kw of rule.keywords) {
    try {
      if (new RegExp(kw, 'i').test(text)) score += 1;
    } catch (e) {
      if (text.includes(kw)) score += 1;
    }
  }
  return score;
}

function classifyItem(item) {
  const text = ((item['발문'] || '') + ' ' + (item['문항내용'] || '')).replace(/\r?\n/g, ' ');
  let bestChapter = null;
  let bestScore = 0;
  for (const rule of rules) {
    const score = getTextScore(text, rule);
    if (score > bestScore) { bestScore = score; bestChapter = rule.chapter; }
  }
  if (bestScore === 0) {
    const num = parseInt(item['번호']);
    if (num <= 2) bestChapter = '1. 세계화와 지역 이해';
    else if (num <= 8) bestChapter = '2. 세계의 자연환경과 인간 생활';
    else if (num <= 11) bestChapter = '3. 세계의 인문환경과 인문 경관';
    else if (num <= 13) bestChapter = '4. 몬순 아시아와 오세아니아';
    else if (num <= 15) bestChapter = '5. 건조 아시아와 북부 아프리카';
    else if (num <= 17) bestChapter = '6. 유럽과 북부 아메리카';
    else if (num <= 19) bestChapter = '7. 사하라 이남 아프리카와 중·남부 아메리카';
    else bestChapter = '8. 평화와 공존의 세계';
  }
  return { chapter: bestChapter, score: bestScore };
}

console.log('===== PART 1: 대단원 분류 =====\n');
let classifiedCount = 0;
let byNumberCount = 0;
data.forEach(item => {
  if (!item['대단원'] || item['대단원'] === '') {
    const { chapter, score } = classifyItem(item);
    item['대단원'] = chapter;
    classifiedCount++;
    if (score === 0) byNumberCount++;
  }
});
console.log(`${classifiedCount}문항 분류 (키워드: ${classifiedCount - byNumberCount}, 번호추론: ${byNumberCount})`);

// 대단원별 통계
const chapterStats = {};
data.forEach(d => {
  if (!chapterStats[d['대단원']]) chapterStats[d['대단원']] = 0;
  chapterStats[d['대단원']]++;
});
Object.keys(chapterStats).sort().forEach(k => console.log(`  ${k}: ${chapterStats[k]}문항`));

// ===== PART 2: 메가스터디 크롤링 =====
console.log('\n===== PART 2: 메가스터디 크롤링 =====\n');

// 세계지리 분류명 → 한국지리식 매핑
// 세계지리: "수능", "6월", "9월", "3월", "4월", "5월", "7월", "10월"
const examMap = {
  '2026_수능': 349, '2025_수능': 334, '2024_수능': 319, '2023_수능': 304,
  '2022_수능': 289, '2021_수능': 274, '2020_수능': 259, '2019_수능': 244, '2018_수능': 229, '2017_수능': 213,
  '2026_6월': 341, '2025_6월': 326, '2024_6월': 311, '2023_6월': 296,
  '2022_6월': 281, '2021_6월': 266, '2020_6월': 251, '2019_6월': 236, '2018_6월': 220,
  '2026_9월': 345, '2025_9월': 330, '2024_9월': 315, '2023_9월': 300,
  '2022_9월': 285, '2021_9월': 270, '2020_9월': 255, '2019_9월': 240, '2018_9월': 225,
  '2025_3월': 337, '2025_5월': 338, '2025_7월': 342, '2025_10월': 348,
  '2024_3월': 322, '2024_5월': 323, '2024_7월': 327, '2024_10월': 333,
  '2023_3월': 307, '2023_4월': 308, '2023_7월': 312, '2023_10월': 316,
  '2022_3월': 292, '2022_4월': 293, '2022_7월': 297, '2022_10월': 301,
  '2021_3월': 277, '2021_4월': 278, '2021_7월': 282, '2021_10월': 286,
  '2020_3월': 263, '2020_7월': 267, '2020_10월': 271,
  '2019_3월': 247, '2019_4월': 248, '2019_7월': 252, '2019_10월': 256,
  '2018_3월': 232, '2018_4월': 233, '2018_7월': 237, '2018_10월': 241,
  '2017_4월': 217, '2017_7월': 222, '2017_10월': 226,
};

const SUB_CD = '4103'; // 세계지리

function fetchExamData(examSeq) {
  try {
    const tmpDir = path.join(os.tmpdir(), 'mega');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, 'wgeo_' + examSeq + '.bin');
    execSync(`curl -s -X POST "https://www.megastudy.net/Entinfo/correctRate/main_rate_ax.asp" -d "grdFlg=3&examSeq=${examSeq}&tabNo=5&selSubCd=${SUB_CD}" --output "${tmpFile}"`, { timeout: 15000 });
    const buf = fs.readFileSync(tmpFile);
    const html = new TextDecoder('euc-kr').decode(buf);
    if (!html.includes('세계지리')) return null;
    const tdRegex = /<td class="two">(.*?)<\/td>/g;
    const values = [];
    let m;
    while ((m = tdRegex.exec(html)) !== null) values.push(m[1].trim());
    const questions = [];
    for (let i = 0; i + 9 < values.length; i += 10) {
      questions.push({ 번호: values[i], 답: values[i+1], 난이도: values[i+2], 배점: values[i+3], 정답률: values[i+4].replace('%','') });
    }
    return questions;
  } catch (e) {
    return null;
  }
}

const examsNeeded = {};
data.forEach(item => {
  const key = item['학년도'] + '_' + item['분류'];
  if (!examsNeeded[key]) examsNeeded[key] = true;
});

let totalUpdated = 0;
let totalSkipped = 0;

for (const key of Object.keys(examsNeeded).sort()) {
  const examSeq = examMap[key];
  if (!examSeq) {
    console.log(`[SKIP] ${key} - 매핑 없음`);
    totalSkipped++;
    continue;
  }

  process.stdout.write(`[CRAWL] ${key} (${examSeq})... `);
  const questions = fetchExamData(examSeq);
  if (!questions || questions.length === 0) {
    console.log('데이터 없음');
    totalSkipped++;
    continue;
  }

  let updated = 0;
  const [학년도, 분류] = key.split('_');
  data.forEach(item => {
    if (item['학년도'] === 학년도 && item['분류'] === 분류) {
      const q = questions.find(q => q['번호'] === item['번호']);
      if (q) {
        item['배점'] = q['배점'];
        item['답'] = q['답'];
        item['정답률'] = q['정답률'];
        item['난이도'] = q['난이도'];
        updated++;
      }
    }
  });

  console.log(`${questions.length}문항 -> ${updated}문항`);
  totalUpdated += updated;
  execSync('sleep 0.3');
}

console.log(`\n업데이트: ${totalUpdated}문항, 스킵: ${totalSkipped}시험`);

// 저장
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
console.log('세계지리.json 저장 완료');

// 최종 확인
const fields = ['대단원', '배점', '답', '정답률', '난이도'];
const missing = {};
data.forEach(d => {
  fields.forEach(f => {
    if (!d[f] || d[f] === '') {
      const k = d['학년도'] + ' ' + d['분류'];
      if (!missing[k]) missing[k] = {};
      if (!missing[k][f]) missing[k][f] = 0;
      missing[k][f]++;
    }
  });
});
if (Object.keys(missing).length > 0) {
  console.log('\n아직 빈 필드:');
  Object.keys(missing).sort().forEach(k => console.log(`  ${k}: ${JSON.stringify(missing[k])}`));
} else {
  console.log('\n모든 필드 완료!');
}
