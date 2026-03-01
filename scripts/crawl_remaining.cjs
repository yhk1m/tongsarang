const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const dataPath = path.join(__dirname, '..', 'public', 'data', '한국지리.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const SUB_CD = '4102';

function fetchExamData(examSeq) {
  const tmpDir = path.join(os.tmpdir(), 'mega');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, 'mega_' + examSeq + '.bin');
  execSync(`curl -s -X POST "https://www.megastudy.net/Entinfo/correctRate/main_rate_ax.asp" -d "grdFlg=3&examSeq=${examSeq}&tabNo=5&selSubCd=${SUB_CD}" --output "${tmpFile}"`, { timeout: 15000 });
  const buf = fs.readFileSync(tmpFile);
  const html = new TextDecoder('euc-kr').decode(buf);
  if (!html.includes('한국지리')) return null;
  const tdRegex = /<td class="two">(.*?)<\/td>/g;
  const values = [];
  let m;
  while ((m = tdRegex.exec(html)) !== null) values.push(m[1].trim());
  const questions = [];
  for (let i = 0; i + 9 < values.length; i += 10) {
    questions.push({ 번호: values[i], 답: values[i+1], 난이도: values[i+2], 배점: values[i+3], 정답률: values[i+4].replace('%','') });
  }
  return questions;
}

// 2017 수능 = 2016.11.17 (examSeq=213)
console.log('2017 수능 (examSeq=213) 크롤링...');
const q2017 = fetchExamData(213);
if (q2017) {
  let updated = 0;
  data.forEach(item => {
    if (item['학년도'] === '2017' && item['분류'] === '수능') {
      const q = q2017.find(q => q['번호'] === item['번호']);
      if (q) {
        // 기존 배점/답이 있으면 유지, 없으면 메가스터디 데이터 사용
        if (!item['배점'] || item['배점'] === '') item['배점'] = q['배점'];
        if (!item['답'] || item['답'] === '') item['답'] = q['답'];
        item['정답률'] = q['정답률'];
        item['난이도'] = q['난이도'];
        updated++;
      }
    }
  });
  console.log(`${q2017.length}문항 크롤링, ${updated}문항 업데이트`);
} else {
  console.log('데이터 없음');
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
console.log('저장 완료');

// 최종 확인
const fields = ['배점', '답', '정답률', '난이도'];
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
