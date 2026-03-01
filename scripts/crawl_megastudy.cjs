const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dataPath = path.join(__dirname, '..', 'public', 'data', '한국지리.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const examMap = {
  '2026_수능': 349, '2025_수능': 334, '2024_수능': 319, '2023_수능': 304,
  '2022_수능': 289, '2021_수능': 274, '2020_수능': 259, '2019_수능': 244, '2018_수능': 229,
  '2026_6모': 341, '2025_6모': 326, '2024_6모': 311, '2023_6모': 296,
  '2022_6모': 281, '2021_6모': 266, '2020_6모': 251, '2019_6모': 236, '2018_6모': 220,
  '2026_9모': 345, '2025_9모': 330, '2024_9모': 315, '2023_9모': 300,
  '2022_9모': 285, '2021_9모': 270, '2020_9모': 255, '2019_9모': 240, '2018_9모': 225,
  '2025_3월학평': 337, '2025_5월학평': 338, '2025_7월학평': 342, '2025_10월학평': 348,
  '2024_3월학평': 322, '2024_5월학평': 323, '2024_7월학평': 327, '2024_10월학평': 333,
  '2023_3월학평': 307, '2023_4월학평': 308, '2023_7월학평': 312, '2023_10월학평': 316,
  '2022_3월학평': 292, '2022_4월학평': 293, '2022_7월학평': 297, '2022_10월학평': 301,
  '2021_3월학평': 277, '2021_4월학평': 278, '2021_7월학평': 282, '2021_10월학평': 286,
  '2020_3월학평': 263, '2020_7월학평': 267, '2020_10월학평': 271,
  '2019_3월학평': 247, '2019_4월학평': 248, '2019_7월학평': 252, '2019_10월학평': 256,
  '2018_3월학평': 232, '2018_4월학평': 233, '2018_7월학평': 237, '2018_10월학평': 241,
  '2017_4월학평': 217, '2017_7월학평': 222, '2017_10월학평': 226,
};

const SUB_CD = '4102';
const os = require('os');

function fetchExamData(examSeq) {
  try {
    const tmpDir = path.join(os.tmpdir(), 'mega');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, 'mega_' + examSeq + '.bin');

    // curl로 바이너리(EUC-KR) 다운로드
    execSync(`curl -s -X POST "https://www.megastudy.net/Entinfo/correctRate/main_rate_ax.asp" -d "grdFlg=3&examSeq=${examSeq}&tabNo=5&selSubCd=${SUB_CD}" --output "${tmpFile}"`, { timeout: 15000 });

    // EUC-KR → UTF-8 변환 (Node.js 내장)
    const buf = fs.readFileSync(tmpFile);
    const decoder = new TextDecoder('euc-kr');
    const html = decoder.decode(buf);

    if (!html.includes('한국지리')) {
      return null;
    }

    const tdRegex = /<td class="two">(.*?)<\/td>/g;
    const values = [];
    let match;
    while ((match = tdRegex.exec(html)) !== null) {
      values.push(match[1].trim());
    }

    const questions = [];
    for (let i = 0; i + 9 < values.length; i += 10) {
      questions.push({
        번호: values[i],
        답: values[i + 1],
        난이도: values[i + 2],
        배점: values[i + 3],
        정답률: values[i + 4].replace('%', ''),
      });
    }

    return questions;
  } catch (e) {
    console.error(`  Error: ${e.message.split('\n')[0]}`);
    return null;
  }
}

const examsNeeded = {};
data.forEach(item => {
  const key = item['학년도'] + '_' + item['분류'];
  if (!examsNeeded[key]) examsNeeded[key] = true;
});

console.log('=== 메가스터디 크롤링 시작 ===\n');

let totalUpdated = 0;
let totalSkipped = 0;
const examKeys = Object.keys(examsNeeded).sort();

for (const key of examKeys) {
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

  console.log(`${questions.length}문항 -> ${updated}문항 업데이트`);
  totalUpdated += updated;

  execSync('sleep 0.3');
}

console.log(`\n=== 결과 ===`);
console.log(`업데이트: ${totalUpdated}문항`);
console.log(`스킵: ${totalSkipped}시험`);

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
console.log('한국지리.json 저장 완료');

// 남은 빈 필드 확인
const fields = ['배점', '답', '정답률', '난이도'];
const stillMissing = {};
data.forEach(d => {
  fields.forEach(f => {
    if (!d[f] || d[f] === '') {
      const key = d['학년도'] + ' ' + d['분류'];
      if (!stillMissing[key]) stillMissing[key] = {};
      if (!stillMissing[key][f]) stillMissing[key][f] = 0;
      stillMissing[key][f]++;
    }
  });
});

if (Object.keys(stillMissing).length > 0) {
  console.log('\n아직 빈 필드:');
  Object.keys(stillMissing).sort().forEach(k => {
    console.log(`  ${k}: ${JSON.stringify(stillMissing[k])}`);
  });
} else {
  console.log('\n모든 필드 채워짐!');
}
