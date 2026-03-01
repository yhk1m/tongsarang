const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const dataPath = path.join(__dirname, '..', 'public', 'data', '정치와법.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const OLD_SUB_CD = '4119'; // 법과정치 (구 교육과정)

// 누락된 시험의 examSeq 매핑
const examMap = {
  '2020_수능': 259, '2020_6월': 251, '2020_9월': 255,
  '2019_수능': 244, '2019_6월': 236, '2019_9월': 240,
  '2019_3월': 247, '2019_4월': 248, '2019_7월': 252, '2019_10월': 256,
  '2018_수능': 229, '2018_6월': 220, '2018_9월': 225,
  '2018_3월': 232, '2018_4월': 233, '2018_7월': 237, '2018_10월': 241,
  '2017_4월': 217, '2017_7월': 222, '2017_10월': 226,
};

function fetchExamData(examSeq) {
  try {
    const tmpDir = path.join(os.tmpdir(), 'mega');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `pollaw_old_${examSeq}.bin`);
    execSync(`curl -s -X POST "https://www.megastudy.net/Entinfo/correctRate/main_rate_ax.asp" -d "grdFlg=3&examSeq=${examSeq}&tabNo=5&selSubCd=${OLD_SUB_CD}" --output "${tmpFile}"`, { timeout: 15000 });
    const html = new TextDecoder('euc-kr').decode(fs.readFileSync(tmpFile));
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

console.log('정치와법 (법과정치 subCd=4119) 크롤링\n');

let totalUpdated = 0;
for (const [key, examSeq] of Object.entries(examMap)) {
  process.stdout.write(`  ${key} (seq=${examSeq})... `);
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
  execSync('sleep 0.3');
}

console.log(`\n총 ${totalUpdated}문항 업데이트`);

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
console.log('정치와법.json 저장 완료');

// 최종 확인
const still = data.filter(d => !d['정답률'] || d['정답률'] === '');
if (still.length > 0) {
  console.log(`\n아직 정답률 빈 문항: ${still.length}`);
  const byExam = {};
  still.forEach(d => { const k = d['학년도'] + ' ' + d['분류']; byExam[k] = (byExam[k] || 0) + 1; });
  Object.keys(byExam).sort().forEach(k => console.log(`  ${k}: ${byExam[k]}`));
} else {
  console.log('\n모든 문항 정답률 완료!');
}
