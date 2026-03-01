const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TESSDATA_DIR = 'C:/Users/김용현/tessdata';
const TESSERACT = 'C:/Program Files/Tesseract-OCR/tesseract.exe';

// 과목 설정
const subjectArg = process.argv[2] || '생활과윤리';
const subjectConfig = {
  '생활과윤리': { code: 'leth' },
  '윤리와사상': { code: 'ethth' },
  '정치와법': { code: 'pollaw' },
  '한국지리': { code: 'korgeo' },
  '세계지리': { code: 'wgeo' },
  '통합사회': { code: 'iss' },
  '경제': { code: 'econ' },
  '사회문화': { code: 'socul' },
};
const config = subjectConfig[subjectArg];
if (!config) { console.error('Unknown subject:', subjectArg); process.exit(1); }

// 분류 → 이미지 월 코드
const classToMonth = {
  '수능': '11', '6월': '06', '9월': '09', '3월': '03',
  '4월': '04', '5월': '05', '7월': '07', '10월': '10',
  '6모': '06', '9모': '09',
  '3월학평': '03', '4월학평': '04', '5월학평': '05', '7월학평': '07', '10월학평': '10',
  '11월': '11',
};

const dataPath = path.join(__dirname, '..', 'public', 'data', `${subjectArg}.json`);
const imgDir = path.join(__dirname, '..', 'public', 'images', subjectArg);
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// 빈 발문/문항내용 찾기
const needOcr = data.filter(d => !d['발문'] || d['발문'] === '' || !d['문항내용'] || d['문항내용'] === '');
console.log(`${subjectArg}: ${data.length}문항 중 ${needOcr.length}문항 OCR 필요\n`);

function getImagePath(item) {
  const month = classToMonth[item['분류']];
  if (!month) return null;
  const num = String(item['번호']).padStart(2, '0');
  return path.join(imgDir, `${item['학년도']}_${month}_${config.code}_${num}.jpg`);
}

function ocrImage(imgPath) {
  try {
    const result = execSync(
      `"${TESSERACT}" "${imgPath}" stdout --tessdata-dir "${TESSDATA_DIR}" -l kor --psm 6`,
      { timeout: 30000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return result.trim();
  } catch (e) {
    return null;
  }
}

function parseQuestion(rawText, questionNum) {
  let text = rawText.replace(/\f/g, '').trim();

  // 문제 번호 앞부분 제거 (예: "15. ")
  const numStr = String(questionNum);
  const numPatterns = [
    new RegExp(`^${numStr}[.。]\\s*`, 'm'),
    new RegExp(`^[\\s]*${numStr}[.。]\\s*`),
  ];
  for (const pat of numPatterns) {
    const m = text.match(pat);
    if (m) {
      text = text.substring(m.index + m[0].length);
      break;
    }
  }

  // 발문 추출: 첫 번째 "?" 까지 (배점 표시 포함)
  // 발문은 보통 "~것은?" 또는 "~것은? [3점]" 형태
  const qMatch = text.match(/^([\s\S]*?\?)\s*(\[\d점\])?\s*/);
  if (qMatch) {
    let 발문 = qMatch[1].replace(/\s+/g, ' ').trim();
    let 문항내용 = text.substring(qMatch[0].length).trim();

    // 페이지 번호 제거 (끝에 있는 1-3자리 숫자)
    문항내용 = 문항내용.replace(/\n\d{1,3}\s*$/, '').trim();

    // 선지 번호 정리 (①②③④⑤)
    문항내용 = 문항내용.replace(/\n\d{1,3}\s*$/, '').trim();

    return { 발문, 문항내용 };
  }

  // Fallback: 첫 줄을 발문으로
  const lines = text.split('\n');
  return {
    발문: lines[0].replace(/\s+/g, ' ').trim(),
    문항내용: lines.slice(1).join('\n').trim()
  };
}

// OCR 실행
let success = 0, failed = 0;
const startTime = Date.now();

for (let i = 0; i < needOcr.length; i++) {
  const item = needOcr[i];
  const imgPath = getImagePath(item);

  if (!imgPath || !fs.existsSync(imgPath)) {
    process.stdout.write(`  [${i+1}/${needOcr.length}] ${item['학년도']} ${item['분류']} ${item['번호']}번 - 이미지 없음\n`);
    failed++;
    continue;
  }

  const rawText = ocrImage(imgPath);
  if (!rawText) {
    process.stdout.write(`  [${i+1}/${needOcr.length}] ${item['학년도']} ${item['분류']} ${item['번호']}번 - OCR 실패\n`);
    failed++;
    continue;
  }

  const { 발문, 문항내용 } = parseQuestion(rawText, item['번호']);

  // 데이터에서 해당 아이템 찾아서 업데이트
  const idx = data.findIndex(d =>
    d['학년도'] === item['학년도'] && d['분류'] === item['분류'] && d['번호'] === item['번호']
  );
  if (idx >= 0) {
    if (!data[idx]['발문'] || data[idx]['발문'] === '') data[idx]['발문'] = 발문;
    if (!data[idx]['문항내용'] || data[idx]['문항내용'] === '') data[idx]['문항내용'] = 문항내용;
    success++;
  }

  if ((i + 1) % 20 === 0 || i === needOcr.length - 1) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = ((i + 1) / elapsed * 60).toFixed(0);
    console.log(`  [${i+1}/${needOcr.length}] ${elapsed}초 경과 (${rate}문항/분) - 성공:${success} 실패:${failed}`);
  }
}

// 저장
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n완료: ${success}문항 OCR 성공, ${failed}문항 실패 (${totalTime}초)`);

// 최종 확인
const still빈발문 = data.filter(d => !d['발문'] || d['발문'] === '').length;
const still빈문항 = data.filter(d => !d['문항내용'] || d['문항내용'] === '').length;
console.log(`남은 빈 발문: ${still빈발문}, 빈 문항내용: ${still빈문항}`);
