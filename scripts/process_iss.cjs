const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const dataPath = path.join(__dirname, '..', 'public', 'data', '통합사회.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log(`통합사회: ${data.length}문항`);

// ===== 대단원 정의 (2015 개정 교육과정) =====
const chapters = [
  { ch: '1. 인간, 사회, 환경과 행복', code: '01', kw: ['행복', '통합적 관점', '시간적 관점', '공간적 관점', '사회적 관점', '윤리적 관점', '질 높은 삶', '행복.*조건', '삶의 목적', '행복 지수', '삶의 질', '주관적 안녕'] },
  { ch: '2. 자연환경과 인간', code: '02', kw: ['자연환경', '기후', '지형', '열대', '온대', '냉대', '건조', '자연재해', '지진', '화산', '태풍', '홍수', '인간.*자연', '안전', '자연.*재난', '몬순', '사막', '스텝', '빙하', '해안', '하천', '산지'] },
  { ch: '3. 생활 공간과 사회', code: '03', kw: ['도시', '농촌', '산업화', '도시화', '교통', '통신', '정보화', '지역.*변화', '공간.*변화', '생활 공간', '인구.*이동', '교외화', '역도시화', '도시.*문제', '지역 조사', '위성 사진', '토지 이용', '간척'] },
  { ch: '4. 인권 보장과 헌법', code: '04', kw: ['인권', '헌법', '기본권', '시민 혁명', '세계 인권 선언', '인권.*보장', '법치주의', '준법', '시민.*참여', '사회 참여', '시민 불복종', '인권.*침해', '자유권', '평등권', '참정권', '청구권', '사회권'] },
  { ch: '5. 시장 경제와 금융', code: '05', kw: ['시장', '수요', '공급', '가격', '금융', '자산 관리', '저축', '투자', '보험', '신용', '합리적 소비', '시장 경제', '기업', '소비자', '생산자', '이자', '주식', '예금', '적금', '합리적 선택', '기회비용'] },
  { ch: '6. 사회 정의와 불평등', code: '06', kw: ['정의', '불평등', '공정', '분배', '차별', '사회 정의', '사회.*불평등', '양성평등', '사회 보장', '복지', '편견', '정의로운 사회', '롤스', '공리주의', '사회 보험', '공공 부조'] },
  { ch: '7. 문화와 다양성', code: '07', kw: ['문화', '다양성', '문화 상대주의', '자문화 중심주의', '문화 사대주의', '다문화', '보편 윤리', '문화.*다양', '관용', '다문화 사회', '문화 변동', '문화 전파', '문화 동화', '문화 병존', '문화 융합', '이주민', '문화.*차이'] },
  { ch: '8. 세계화와 평화', code: '08', kw: ['세계화', '평화', '국제', '전쟁', '갈등', '난민', '테러', '국제기구', '국제 사회', '분쟁', '남북', '통일', '외교', '안보', '국제 평화', '국제 분쟁'] },
  { ch: '9. 미래와 지속 가능한 삶', code: '09', kw: ['지속 가능', '미래 사회', '환경', '기후 변화', '생태', '저출산', '고령화', '인구.*문제', '에너지', '자원 고갈', '세대.*갈등', '미래.*지구', '온실가스', '탄소', '신재생'] },
];

// ===== 대단원 분류 =====
function getScore(text, keywords) {
  let score = 0;
  for (const kw of keywords) {
    try { if (new RegExp(kw, 'i').test(text)) score++; } catch { if (text.includes(kw)) score++; }
  }
  return score;
}

let classified = 0, byCriteria = 0, byKeyword = 0, byNum = 0;
data.forEach(item => {
  if (item['대단원'] && item['대단원'] !== '') return;

  // 1) 성취기준으로 분류 (가장 정확)
  const criteria = item['성취기준'] || '';
  const criteriaMatch = criteria.match(/10통사(\d{2})/);
  if (criteriaMatch) {
    const unitCode = criteriaMatch[1];
    const chapter = chapters.find(c => c.code === unitCode);
    if (chapter) {
      item['대단원'] = chapter.ch;
      classified++;
      byCriteria++;
      return;
    }
  }

  // 2) 키워드 매칭
  const text = ((item['발문'] || '') + ' ' + (item['문항내용'] || '')).replace(/\r?\n/g, ' ');
  let best = null, bestScore = 0;
  for (const rule of chapters) {
    const s = getScore(text, rule.kw);
    if (s > bestScore) { bestScore = s; best = rule.ch; }
  }
  if (bestScore > 0) {
    item['대단원'] = best;
    classified++;
    byKeyword++;
    return;
  }

  // 3) 번호 기반 추론 (최후 수단)
  const num = parseInt(item['번호']);
  const perChapter = Math.ceil(20 / chapters.length);
  const idx = Math.min(Math.floor((num - 1) / perChapter), chapters.length - 1);
  item['대단원'] = chapters[idx].ch;
  classified++;
  byNum++;
});

console.log(`\n[대단원] ${classified}문항 분류 (성취기준:${byCriteria}, 키워드:${byKeyword}, 번호:${byNum})`);
const stats = {};
data.forEach(d => { stats[d['대단원']] = (stats[d['대단원']] || 0) + 1; });
Object.keys(stats).sort().forEach(k => console.log(`  ${k}: ${stats[k]}`));

// ===== 메가스터디 크롤링 (grdFlg=1, tabNo=5, selSubCd 없음) =====
const examMap = {
  '2025_3월': 335, '2025_6월': 339, '2025_9월': 343, '2025_10월': 346,
  '2024_3월': 320, '2024_6월': 324, '2024_9월': 328, '2024_10월': 331,
  '2023_3월': 305, '2023_6월': 309, '2023_9월': 313, '2023_11월': 317,
  '2022_3월': 290, '2022_6월': 294, '2022_9월': 298, '2022_10월': 302,
  '2021_3월': 275, '2021_6월': 279, '2021_9월': 283, '2021_10월': 287,
  '2020_6월': 264, '2020_9월': 268, '2020_10월': 272,
  '2019_3월': 245, '2019_6월': 249, '2019_9월': 253, '2019_10월': 257,
  '2018_3월': 230, '2018_6월': 234, '2018_9월': 238, '2018_10월': 242,
};

function fetchExamData(examSeq) {
  try {
    const tmpDir = path.join(os.tmpdir(), 'mega');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `iss_${examSeq}.bin`);
    execSync(`curl -s -X POST "https://www.megastudy.net/Entinfo/correctRate/main_rate_ax.asp" -d "grdFlg=1&examSeq=${examSeq}&tabNo=5&selSubCd=" --output "${tmpFile}"`, { timeout: 15000 });
    const buf = fs.readFileSync(tmpFile);
    const html = new TextDecoder('euc-kr').decode(buf);
    if (!html.includes('<td class="two">')) return null;
    const values = [];
    let m;
    const re = /<td class="two">(.*?)<\/td>/g;
    while ((m = re.exec(html)) !== null) values.push(m[1].trim());
    const questions = [];
    for (let i = 0; i + 9 < values.length; i += 10)
      questions.push({ 번호: values[i], 답: values[i+1], 난이도: values[i+2], 배점: values[i+3], 정답률: values[i+4].replace('%','') });
    return questions;
  } catch { return null; }
}

console.log('\n[크롤링]');
const exams = {};
data.forEach(d => { exams[d['학년도'] + '_' + d['분류']] = true; });
let totalUpdated = 0;

for (const key of Object.keys(exams).sort()) {
  const examSeq = examMap[key];
  if (!examSeq) { console.log(`  ${key}... (매핑없음)`); continue; }
  process.stdout.write(`  ${key}... `);
  const questions = fetchExamData(examSeq);
  if (!questions || !questions.length) { console.log('X'); continue; }
  let updated = 0;
  const [y, c] = key.split('_');
  data.forEach(item => {
    if (item['학년도'] === y && item['분류'] === c) {
      const q = questions.find(q => q['번호'] === item['번호']);
      if (q) {
        item['정답률'] = q['정답률'];
        item['난이도'] = q['난이도'];
        if (!item['배점'] || item['배점'] === '') item['배점'] = q['배점'];
        if (!item['답'] || item['답'] === '') item['답'] = q['답'];
        updated++;
      }
    }
  });
  console.log(`${updated}문항`);
  totalUpdated += updated;
  execSync('sleep 0.2');
}
console.log(`  총 ${totalUpdated}문항 업데이트`);

// ===== 저장 =====
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
console.log('\n통합사회.json 저장 완료');

// ===== 최종 확인 =====
const fields = ['배점', '답', '정답률', '난이도', '대단원'];
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
