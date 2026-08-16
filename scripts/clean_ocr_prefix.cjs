/**
 * 발문 맨 앞에 남은 문항 번호 OCR 찌꺼기를 지운다.
 *
 * 크롭 이미지에 문항 번호가 포함돼 있어 OCR이 "1." 을 "7." / "12." 를 "72." / "18." 을 "78"
 * 처럼 잘못 읽으면 ocr_subjects.cjs 의 번호 제거 패턴이 빗나가 발문 앞에 그대로 남는다.
 *
 * "A ~ C 지형에 대한..." 같은 정상 발문을 건드리지 않도록, 숫자·기호로만 이루어진
 * 1~4자 토큰 뒤에 공백이 오는 경우만 지운다. (A~E, ⑴, ㈎ 등 보기 기호는 걸리지 않는다)
 *
 *   node scripts/clean_ocr_prefix.cjs --dry           # 미리보기
 *   node scripts/clean_ocr_prefix.cjs 2026,2027       # 해당 학년도만 적용
 *   node scripts/clean_ocr_prefix.cjs --all           # 전체 적용
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const SUBJECTS = ['한국지리', '세계지리', '통합사회', '한국사', '정치와법', '경제',
  '사회문화', '생활과윤리', '윤리와사상', '동아시아사', '세계사'];

const NOISE_PREFIX = /^\s*[0-9.,:;/\\&%<>@#*^~()[\]{}|_+=ㅇㅁㆍ·'"`-]{1,4}\s+/;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const all = args.includes('--all');
const yearArg = args.find(a => !a.startsWith('--'));
const yearFilter = yearArg ? new Set(yearArg.split(',')) : null;

if (!all && !yearFilter) {
  console.error('학년도를 지정하거나 --all 을 쓰세요. 예: node scripts/clean_ocr_prefix.cjs 2026,2027');
  process.exit(1);
}

let changed = 0;
const samples = [];

for (const subject of SUBJECTS) {
  const dataPath = path.join(DATA_DIR, `${subject}.json`);
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  let subjectChanged = 0;

  for (const row of data) {
    if (yearFilter && !yearFilter.has(String(row['학년도']))) continue;
    const before = row['발문'] || '';
    if (!before) continue;

    // 찌꺼기가 겹쳐 붙는 경우가 있어 최대 2번까지 벗겨낸다 ("./6. 밑줄 친" 등)
    let after = before;
    for (let i = 0; i < 2; i++) {
      const stripped = after.replace(NOISE_PREFIX, '');
      if (stripped === after) break;
      after = stripped;
    }
    after = after.trim();

    if (after && after !== before.trim()) {
      if (samples.length < 20) samples.push(`${subject}: ${JSON.stringify(before.slice(0, 45))} → ${JSON.stringify(after.slice(0, 45))}`);
      if (!dryRun) row['발문'] = after;
      subjectChanged++;
    }
  }

  if (!dryRun && subjectChanged) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
  }
  if (subjectChanged) console.log(`${subject}: ${subjectChanged}건`);
  changed += subjectChanged;
}

console.log(`\n총 ${changed}건 ${dryRun ? '변경 예정' : '정리 완료'}`);
console.log('\n=== 샘플 ===');
samples.forEach(s => console.log('  ' + s));
