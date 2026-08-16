/**
 * 대단원이 비어 있는 문항을, 같은 과목에서 이미 분류된 문항들과의 텍스트 유사도로 분류한다.
 *
 * 과목마다 키워드 규칙을 새로 쓰는 대신 기존 12,800여 문항의 분류 결과를 학습 데이터로 쓴다.
 * 문자 바이그램 TF-IDF 코사인 유사도 → 상위 K개 이웃의 가중 투표.
 *
 *   node scripts/classify_chapters_2026.cjs --dry          # 결과만 출력
 *   node scripts/classify_chapters_2026.cjs                # 적용 + 검수 리포트 출력
 *   node scripts/classify_chapters_2026.cjs --audit 2026,2027
 *       이미 분류된 문항을 다시 채점해 검수 목록만 다시 뽑는다 (파일은 건드리지 않음)
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const SUBJECTS = ['한국지리', '세계지리', '통합사회', '한국사', '정치와법', '경제',
  '사회문화', '생활과윤리', '윤리와사상', '동아시아사', '세계사'];

const TOP_K = 7;
// 이 아래는 자동 분류를 믿기 어려우니 검수 목록에 올린다.
const REVIEW_THRESHOLD = 0.45;

const auditIdx = process.argv.indexOf('--audit');
const auditYears = auditIdx >= 0 && process.argv[auditIdx + 1]
  ? new Set(process.argv[auditIdx + 1].split(','))
  : null;
const dryRun = process.argv.includes('--dry') || !!auditYears;

/** 문자 바이그램. 한글·영숫자만 남기고 공백을 지운 뒤 2글자씩 자른다. */
function bigrams(text) {
  const s = String(text || '').replace(/[^가-힣a-zA-Z0-9]/g, '');
  const out = [];
  for (let i = 0; i + 1 < s.length; i++) out.push(s.slice(i, i + 2));
  return out;
}

function docText(row) {
  return `${row['발문'] || ''} ${row['문항내용'] || ''}`;
}

/** 용어 빈도 맵 */
function termFreq(tokens) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

/** TF-IDF 가중치를 매기고 L2 정규화한 벡터 */
function tfidfVector(tf, idf) {
  const vec = new Map();
  let norm = 0;
  for (const [term, count] of tf) {
    const w = (1 + Math.log(count)) * (idf.get(term) || 0);
    if (w <= 0) continue;
    vec.set(term, w);
    norm += w * w;
  }
  norm = Math.sqrt(norm) || 1;
  for (const [term, w] of vec) vec.set(term, w / norm);
  return vec;
}

function cosine(a, b) {
  // 더 짧은 쪽을 순회한다
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let sum = 0;
  for (const [term, w] of small) {
    const other = large.get(term);
    if (other) sum += w * other;
  }
  return sum;
}

let totalAssigned = 0;
const review = [];

for (const subject of SUBJECTS) {
  const dataPath = path.join(DATA_DIR, `${subject}.json`);
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  // 감사 모드에서는 지정한 학년도를 대상으로 삼고, 나머지 문항만 학습 데이터로 쓴다.
  const isTarget = auditYears
    ? d => auditYears.has(String(d['학년도']))
    : d => !d['대단원'];

  const labeled = data.filter(d => d['대단원'] && !isTarget(d) && docText(d).trim().length > 30);
  const targets = data.filter(d => isTarget(d) && docText(d).trim().length > 30);
  const noText = data.filter(d => isTarget(d) && docText(d).trim().length <= 30);

  if (targets.length === 0) {
    console.log(`${subject}: 분류할 문항 없음 (본문 없는 미분류 ${noText.length}건)`);
    continue;
  }

  // IDF는 학습 문항 기준으로 만든다
  const labeledTf = labeled.map(d => termFreq(bigrams(docText(d))));
  const df = new Map();
  for (const tf of labeledTf) {
    for (const term of tf.keys()) df.set(term, (df.get(term) || 0) + 1);
  }
  const idf = new Map();
  for (const [term, count] of df) idf.set(term, Math.log(labeled.length / count));

  const labeledVecs = labeledTf.map(tf => tfidfVector(tf, idf));

  let assigned = 0;
  for (const row of targets) {
    const vec = tfidfVector(termFreq(bigrams(docText(row))), idf);

    // 상위 K개 이웃
    const scored = [];
    for (let i = 0; i < labeledVecs.length; i++) {
      const s = cosine(vec, labeledVecs[i]);
      if (s > 0) scored.push([s, i]);
    }
    scored.sort((x, y) => y[0] - x[0]);
    const top = scored.slice(0, TOP_K);
    if (top.length === 0) continue;

    // 유사도 가중 투표
    const votes = new Map();
    let totalWeight = 0;
    for (const [s, i] of top) {
      const ch = labeled[i]['대단원'];
      votes.set(ch, (votes.get(ch) || 0) + s);
      totalWeight += s;
    }
    const [chapter, weight] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    const confidence = weight / totalWeight;

    if (!dryRun) {
      row['대단원'] = chapter;
      // 중단원을 쓰는 과목이면, 1순위 이웃이 같은 대단원일 때만 따라 쓴다
      const best = labeled[top[0][1]];
      if (best['대단원'] === chapter && best['중단원']) row['중단원'] = best['중단원'];
    }
    assigned++;

    if (confidence < REVIEW_THRESHOLD) {
      review.push({
        subject,
        위치: `${row['학년도']} ${row['학년'] || ''} ${row['분류']} ${row['번호']}번`.replace(/\s+/g, ' '),
        대단원: chapter,
        확신도: confidence.toFixed(2),
      });
    }
  }

  if (!dryRun) fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
  totalAssigned += assigned;
  console.log(`${subject}: ${assigned}문항 분류 (학습 ${labeled.length}문항)${noText.length ? `, 본문 없어 건너뜀 ${noText.length}건` : ''}`);
}

console.log(`\n총 ${totalAssigned}문항 ${dryRun ? '분류 예정' : '분류 완료'}`);
console.log(`\n=== 검수 권장 (확신도 ${REVIEW_THRESHOLD} 미만): ${review.length}건 ===`);
for (const r of review) {
  console.log(`  [${r.확신도}] ${r.subject} ${r.위치} → ${r.대단원}`);
}
