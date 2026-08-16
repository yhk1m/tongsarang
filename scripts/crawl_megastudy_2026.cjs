/**
 * 2026년 시행 사회탐구 기출을 메가스터디 정답률 페이지에서 받아 public/data/*.json 에 병합한다.
 *
 * 연도 표기는 기존 규칙을 따른다: 학평은 시행연도(2026), 모평은 학년도(2027).
 * 통합사회는 고1/고2를 모두 넣고 `학년` 필드로 구분한다.
 *
 *   node scripts/crawl_megastudy_2026.cjs           # 병합
 *   node scripts/crawl_megastudy_2026.cjs --dry     # 크롤링 결과만 출력
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const RATE_API = 'https://www.megastudy.net/Entinfo/correctRate/main_rate_ax.asp';

// 고3 사회탐구/한국사: examSeq는 시행일 순서
const G3_EXAMS = [
  { seq: 352, month: '03', moc: false },
  { seq: 353, month: '05', moc: false },
  { seq: 356, month: '06', moc: true },
  { seq: 357, month: '07', moc: false },
];
const ISS_EXAMS = {
  고1: [{ seq: 350, month: '03', moc: false }, { seq: 354, month: '06', moc: false }],
  고2: [{ seq: 351, month: '03', moc: false }, { seq: 355, month: '06', moc: false }],
};

// 과목 → 메가스터디 조회 정보. catStyle: 한국지리만 '학평/모' 접미사를 쓴다.
const SUBJECTS = {
  생활과윤리: { tab: 5, subCd: '4117', catStyle: 'plain' },
  윤리와사상: { tab: 5, subCd: '4118', catStyle: 'plain' },
  한국지리: { tab: 5, subCd: '4102', catStyle: 'hakpyeong' },
  세계지리: { tab: 5, subCd: '4103', catStyle: 'plain' },
  동아시아사: { tab: 5, subCd: '4116', catStyle: 'plain' },
  세계사: { tab: 5, subCd: '4107', catStyle: 'plain' },
  경제: { tab: 5, subCd: '4110', catStyle: 'plain' },
  정치와법: { tab: 5, subCd: '4121', catStyle: 'plain' },
  사회문화: { tab: 5, subCd: '4111', catStyle: 'plain' },
  한국사: { tab: 4, subCd: null, catStyle: 'plain' },
};

function category(month, moc, catStyle) {
  const n = String(Number(month));
  if (catStyle === 'hakpyeong') return moc ? `${n}모` : `${n}월학평`;
  return `${n}월`;
}

function schoolYear(moc) {
  return moc ? '2027' : '2026';
}

/** 메가스터디 정답률 표를 긁는다. <td class="two">가 10칸(번호,정답,난이도,배점,정답률,선지1~5) 단위. */
function fetchRates(seq, tab, subCd) {
  const tmpDir = path.join(os.tmpdir(), 'mega2026');
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, `m_${seq}_${tab}_${subCd || 'none'}.bin`);

  let body = `examSeq=${seq}&tabNo=${tab}`;
  if (subCd) body += `&selSubCd=${subCd}`;
  execSync(`curl -s -X POST "${RATE_API}" -d "${body}" --output "${tmpFile}"`, { timeout: 20000 });

  const html = new TextDecoder('euc-kr').decode(fs.readFileSync(tmpFile));
  const title = (html.match(/<h4[^>]*>(.*?)<\/h4>/) || [, ''])[1].replace(/&nbsp;/g, ' ').trim();
  const values = [...html.matchAll(/<td class="two">(.*?)<\/td>/g)].map(m => m[1].trim());

  const rows = [];
  for (let i = 0; i + 9 < values.length; i += 10) {
    rows.push({
      번호: values[i],
      답: values[i + 1],
      난이도: values[i + 2],
      배점: values[i + 3],
      정답률: values[i + 4].replace('%', ''),
    });
  }
  return { title, rows };
}

/** 기존 행의 타입(문자열/숫자)에 맞춰 값을 변환한다. */
function coerce(sample, key, value) {
  return typeof sample[key] === 'number' ? Number(value) : String(value);
}

function buildRow(sample, meta, r) {
  const row = {};
  for (const key of Object.keys(sample)) {
    switch (key) {
      case '순번': row[key] = 0; break;
      case '학년도': row[key] = meta.학년도; break;
      case '분류': row[key] = meta.분류; break;
      case '번호': row[key] = coerce(sample, '번호', r.번호); break;
      case '배점': row[key] = coerce(sample, '배점', r.배점); break;
      case '답': row[key] = coerce(sample, '답', r.답); break;
      case '정답률': row[key] = coerce(sample, '정답률', r.정답률); break;
      case '난이도': row[key] = r.난이도; break;
      case '학년': row[key] = meta.학년 || ''; break;
      default: row[key] = typeof sample[key] === 'number' ? 0 : '';
    }
  }
  return row;
}

function loadData(subject) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${subject}.json`), 'utf8'));
}

function saveData(subject, data) {
  data.forEach((d, i) => { d['순번'] = i + 1; });
  fs.writeFileSync(path.join(DATA_DIR, `${subject}.json`), JSON.stringify(data, null, 2), 'utf8');
}

function hasExam(data, 학년도, 분류, 학년) {
  return data.some(d => d['학년도'] === 학년도 && d['분류'] === 분류 &&
    (학년 === undefined || d['학년'] === 학년));
}

const dryRun = process.argv.includes('--dry');
let grandTotal = 0;

// ---- 고3 사회탐구 9과목 + 한국사 ----
for (const [subject, cfg] of Object.entries(SUBJECTS)) {
  const data = loadData(subject);
  const sample = data[0];
  const newRows = [];

  // 최신 시험이 앞에 오도록 시행 역순으로 만든다.
  for (const ex of [...G3_EXAMS].reverse()) {
    const 학년도 = schoolYear(ex.moc);
    const 분류 = category(ex.month, ex.moc, cfg.catStyle);
    const { title, rows } = fetchRates(ex.seq, cfg.tab, cfg.subCd);
    if (rows.length === 0) {
      console.log(`  ! ${subject} ${학년도} ${분류}: 데이터 없음 (${title})`);
      continue;
    }
    if (hasExam(data, 학년도, 분류)) {
      console.log(`  - ${subject} ${학년도} ${분류}: 이미 존재, 건너뜀`);
      continue;
    }
    rows.forEach(r => newRows.push(buildRow(sample, { 학년도, 분류 }, r)));
    console.log(`  + ${subject} ${학년도} ${분류}: ${rows.length}문항 (${title})`);
  }

  if (newRows.length && !dryRun) {
    saveData(subject, [...newRows, ...data]);
  }
  grandTotal += newRows.length;
}

// ---- 통합사회 (고1 + 고2) ----
{
  const subject = '통합사회';
  const data = loadData(subject);

  // 기존 655행은 전부 고1 학력평가다. 학년 필드를 학년도 뒤에 채워 넣는다.
  const withGrade = data.map(d => {
    if (d['학년'] !== undefined) return d;
    const out = {};
    for (const k of Object.keys(d)) {
      out[k] = d[k];
      if (k === '학년도') out['학년'] = '고1';
    }
    return out;
  });

  const sample = withGrade[0];
  const newRows = [];
  // 3월 → 6월 순으로 만들되 최신이 앞에 오도록 역순, 같은 시험은 고1 → 고2 순
  for (const ex of [{ month: '06' }, { month: '03' }]) {
    for (const grade of ['고1', '고2']) {
      const info = ISS_EXAMS[grade].find(e => e.month === ex.month);
      const 학년도 = '2026';
      const 분류 = `${Number(ex.month)}월`;
      const { title, rows } = fetchRates(info.seq, 5, null);
      if (rows.length === 0) {
        console.log(`  ! 통합사회 ${grade} ${학년도} ${분류}: 데이터 없음 (${title})`);
        continue;
      }
      if (hasExam(withGrade, 학년도, 분류, grade)) {
        console.log(`  - 통합사회 ${grade} ${학년도} ${분류}: 이미 존재, 건너뜀`);
        continue;
      }
      rows.forEach(r => newRows.push(buildRow(sample, { 학년도, 분류, 학년: grade }, r)));
      console.log(`  + 통합사회 ${grade} ${학년도} ${분류}: ${rows.length}문항 (${title})`);
    }
  }

  if (!dryRun) saveData(subject, [...newRows, ...withGrade]);
  grandTotal += newRows.length;
}

console.log(`\n총 ${grandTotal}문항 ${dryRun ? '확인' : '추가'}`);
