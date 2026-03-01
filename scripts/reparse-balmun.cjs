/**
 * 문항내용에서 발문을 재파싱하여 분리
 * 이미 문항내용이 있지만 발문이 없는 항목들을 처리
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const subjects = process.argv[2] === 'all'
  ? ['한국지리','세계지리','통합사회','경제','사회문화','생활과윤리','윤리와사상','정치와법','한국사','동아시아사','세계사']
  : process.argv.slice(2);

if (subjects.length === 0) {
  console.log('Usage: node scripts/reparse-balmun.cjs <과목|all>');
  process.exit(1);
}

// 발문 끝 패턴 (한국 수능 문제에서 흔한 질문 종결 패턴)
const QUESTION_END_PATTERNS = [
  /것은\s*\?/,
  /것만을[^?]*\?/,
  /무엇인가\s*\?/,
  /어느 것인가\s*\?/,
  /설명으로[^?]*\?/,
  /서술로[^?]*\?/,
  /내용으로[^?]*\?/,
  /분석으로[^?]*\?/,
  /추론으로[^?]*\?/,
  /이해로[^?]*\?/,
  /판단으로[^?]*\?/,
  /있는가\s*\?/,
  /하는가\s*\?/,
  /인가\s*\?/,
  /는가\s*\?/,
  /까\s*\?/,
  /\?\s/,  // 물음표 뒤에 공백
];

// 선지/보기 시작 패턴
const CONTENT_START = /[①②③④⑤]|\(가\)|\(나\)|<보기>|<조건>|\[보기\]|\[조건\]/;

function extractBalmun(text) {
  if (!text || text.length < 10) return { 발문: '', 문항내용: text || '' };

  // 문항번호, 배점 제거
  let cleaned = text.replace(/^\s*\d+\.\s*/, '').replace(/\[\d점\]\s*/g, '').trim();

  // 선지/보기 시작 위치 찾기
  const contentMatch = cleaned.match(CONTENT_START);
  const contentIdx = contentMatch ? cleaned.indexOf(contentMatch[0]) : -1;

  // 선지 앞 부분에서 질문 끝 찾기
  const searchArea = contentIdx > 0 ? cleaned.substring(0, contentIdx) : cleaned;

  // 물음표 기반 분리 (가장 신뢰도 높음)
  const lastQ = searchArea.lastIndexOf('?');
  if (lastQ > 10) {
    return {
      발문: cleaned.substring(0, lastQ + 1).trim(),
      문항내용: cleaned.substring(lastQ + 1).trim()
    };
  }

  // "것은" 패턴 기반 분리
  for (const pattern of QUESTION_END_PATTERNS) {
    const match = searchArea.match(pattern);
    if (match && match.index > 10) {
      const endIdx = match.index + match[0].length;
      return {
        발문: cleaned.substring(0, endIdx).trim(),
        문항내용: cleaned.substring(endIdx).trim()
      };
    }
  }

  // "것은" (물음표 없이) - 마지막 발생 위치
  const geotIdx = searchArea.lastIndexOf('것은');
  if (geotIdx > 10) {
    const endIdx = geotIdx + 2;
    return {
      발문: cleaned.substring(0, endIdx).trim(),
      문항내용: cleaned.substring(endIdx).trim()
    };
  }

  // 선지 시작 위치로 분리 (fallback)
  if (contentIdx > 20) {
    return {
      발문: cleaned.substring(0, contentIdx).trim(),
      문항내용: cleaned.substring(contentIdx).trim()
    };
  }

  return { 발문: '', 문항내용: cleaned };
}

let totalUpdated = 0;

for (const subj of subjects) {
  const dataPath = path.join(ROOT, 'public', 'data', `${subj}.json`);
  if (!fs.existsSync(dataPath)) {
    console.log(`${subj}: 파일 없음, 건너뜀`);
    continue;
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  let updated = 0;
  let alreadyHas = 0;

  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    // 이미 발문이 있으면 스킵
    if (item['발문'] && item['발문'].length > 5) {
      alreadyHas++;
      continue;
    }

    // 문항내용이 없으면 스킵
    if (!item['문항내용'] || item['문항내용'].length < 10) continue;

    const result = extractBalmun(item['문항내용']);
    if (result['발문'] && result['발문'].length > 5) {
      item['발문'] = result['발문'];
      item['문항내용'] = result['문항내용'];
      data[i] = item;
      updated++;
    }
  }

  if (updated > 0) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
  }

  const total = data.length;
  const finalBalmun = data.filter(x => x['발문'] && x['발문'].length > 0).length;
  const finalMunhang = data.filter(x => x['문항내용'] && x['문항내용'].length > 0).length;
  console.log(`${subj}: 재파싱 ${updated}건, 기존 ${alreadyHas}건 → 발문 ${finalBalmun}/${total}, 문항내용 ${finalMunhang}/${total}`);
  totalUpdated += updated;
}

console.log(`\n총 ${totalUpdated}건 발문 추출 완료`);
