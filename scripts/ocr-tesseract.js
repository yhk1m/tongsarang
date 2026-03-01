/**
 * Phase 1: Tesseract.js 로컬 OCR (무료)
 * 이미지에서 텍스트를 추출하여 발문/문항내용을 채움
 *
 * 사용법:
 *   node scripts/ocr-tesseract.js [과목] [워커수]
 *
 * 예:
 *   node scripts/ocr-tesseract.js 한국지리 4
 *   node scripts/ocr-tesseract.js 세계지리 2
 *   node scripts/ocr-tesseract.js all 4        # 5개 과목 전부
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Tesseract from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ── 매핑 상수 ──
const SUBJECT_CODE = {
  '한국지리': 'korgeo', '세계지리': 'wgeo', '통합사회': 'iss',
  '한국사': 'korhis', '정치와법': 'pollaw', '경제': 'econ',
  '사회문화': 'socul', '생활과윤리': 'leth', '윤리와사상': 'ethth',
  '동아시아사': 'eahis', '세계사': 'worhis'
};

const CATEGORY_TO_MONTH = {
  '수능': '11', '9모': '09', '6모': '06',
  '10월학평': '10', '7월학평': '07', '5월학평': '05', '4월학평': '04', '3월학평': '03',
  '11월': '11', '10월': '10', '9월': '09', '7월': '07',
  '6월': '06', '5월': '05', '4월': '04', '3월': '03'
};

const ALL_SUBJECTS = ['한국지리', '세계지리', '통합사회', '생활과윤리', '윤리와사상'];

// ── CLI args ──
const subjectArg = process.argv[2] || '한국지리';
const numWorkers = parseInt(process.argv[3]) || 4;
const subjects = subjectArg === 'all' ? ALL_SUBJECTS : [subjectArg];

// ── 이미지 경로 ──
function getImagePath(subject, item) {
  const code = SUBJECT_CODE[subject];
  if (!code) return null;
  const month = CATEGORY_TO_MONTH[item.분류];
  if (!month) return null;
  const num = String(item.번호).padStart(2, '0');
  const year = String(item.학년도);
  const dir = join(ROOT, 'public', 'images', subject);

  const jpgPath = join(dir, `${year}_${month}_${code}_${num}.jpg`);
  if (existsSync(jpgPath)) return jpgPath;
  const pngPath = join(dir, `${year}_${month}_${code}_${num}.png`);
  if (existsSync(pngPath)) return pngPath;
  return null;
}

// ── OCR 텍스트 → 발문/문항내용 파싱 ──
function parseOCRText(raw) {
  if (!raw || raw.trim().length < 10) return { 발문: '', 문항내용: '' };

  // 문항번호, 배점 제거
  let text = raw.replace(/^\s*\d+\.\s*/, '').replace(/\[\d점\]\s*/g, '').trim();

  // 선지 시작 위치 (①②③④⑤)
  const choiceIdx = text.search(/[①②]/);
  // <보기>, <조건> 등 부가 정보 시작 위치
  const extraIdx = text.search(/<보기>|<조건>|\(가\)|\(나\)/);

  // 발문과 문항내용 분리 지점 결정
  let splitTarget = -1;
  if (extraIdx > 0 && (choiceIdx < 0 || extraIdx < choiceIdx)) {
    splitTarget = extraIdx;
  } else if (choiceIdx > 0) {
    splitTarget = choiceIdx;
  }

  if (splitTarget <= 0) {
    // 분리 불가 → 전체를 문항내용으로
    return { 발문: '', 문항내용: text };
  }

  // splitTarget 앞쪽에서 질문 끝("?" 또는 "것은" 등) 찾기
  const before = text.substring(0, splitTarget);
  // 마지막 물음표 또는 질문 패턴 찾기
  const qMarkIdx = before.lastIndexOf('?');
  const geotIdx = before.search(/것은\s*$/);

  let 발문End;
  if (qMarkIdx > 0) {
    발문End = qMarkIdx + 1;
  } else if (geotIdx > 0) {
    발문End = geotIdx + 2; // "것은" 길이
  } else {
    발문End = splitTarget;
  }

  return {
    발문: text.substring(0, 발문End).trim(),
    문항내용: text.substring(발문End).trim()
  };
}

// ── Progress 관리 ──
function progressPath(subject) {
  return join(ROOT, `.tesseract-progress-${subject}.json`);
}

async function loadProgress(subject) {
  const p = progressPath(subject);
  if (existsSync(p)) return JSON.parse(await readFile(p, 'utf8'));
  return {};
}

async function saveProgress(subject, progress) {
  await writeFile(progressPath(subject), JSON.stringify(progress, null, 2), 'utf8');
}

// ── 메인 처리 ──
async function processSubject(subject) {
  const dataPath = join(ROOT, 'public', 'data', `${subject}.json`);
  if (!existsSync(dataPath)) {
    console.log(`  ⚠ ${subject}: 데이터 파일 없음, 건너뜀`);
    return;
  }

  const data = JSON.parse(await readFile(dataPath, 'utf8'));
  const progress = await loadProgress(subject);

  // OCR 필요한 항목 필터
  const items = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (item.발문 || item.문항내용) continue; // 이미 있음
    const key = `${item.학년도}_${item.분류}_${item.번호}`;
    if (progress[key]) {
      // Progress에서 복원
      if (progress[key].발문) item.발문 = progress[key].발문;
      if (progress[key].문항내용) item.문항내용 = progress[key].문항내용;
      data[i] = item;
      continue;
    }
    const imagePath = getImagePath(subject, item);
    if (!imagePath) continue;
    items.push({ index: i, item, imagePath, key });
  }

  console.log(`  ${subject}: 총 ${data.length}개, OCR 대상 ${items.length}개 (이미 완료: ${Object.keys(progress).length}개)`);

  if (items.length === 0) {
    // Progress 복원한 데이터 저장
    await writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8');
    return;
  }

  // Tesseract 워커 생성
  const actualWorkers = Math.min(numWorkers, items.length);
  console.log(`  워커 ${actualWorkers}개 생성 중... (한국어 데이터 첫 실행 시 다운로드 ~4MB)`);

  const workers = [];
  for (let i = 0; i < actualWorkers; i++) {
    const worker = await Tesseract.createWorker('kor', Tesseract.OEM.DEFAULT);
    workers.push(worker);
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  // 워커별 작업 분배
  let idx = 0;
  async function workerLoop(worker) {
    while (idx < items.length) {
      const i = idx++;
      const { index, item, imagePath, key } = items[i];

      try {
        const result = await worker.recognize(imagePath);
        const raw = result.data.text;
        const parsed = parseOCRText(raw);

        if (parsed.발문 || parsed.문항내용) {
          item.발문 = parsed.발문;
          item.문항내용 = parsed.문항내용;
          data[index] = item;
          progress[key] = { 발문: parsed.발문, 문항내용: parsed.문항내용, raw };
          succeeded++;
        } else {
          // OCR은 됐지만 파싱 실패 → raw 텍스트라도 저장
          item.문항내용 = raw.trim();
          data[index] = item;
          progress[key] = { 발문: '', 문항내용: raw.trim(), raw };
          succeeded++;
        }
      } catch (err) {
        failed++;
        console.warn(`    FAIL ${key}: ${err.message}`);
      }

      processed++;
      if (processed % 20 === 0 || processed === items.length) {
        console.log(`    [${processed}/${items.length}] 완료 (성공: ${succeeded}, 실패: ${failed})`);
        await saveProgress(subject, progress);
      }
    }
  }

  await Promise.all(workers.map(w => workerLoop(w)));

  // 워커 정리
  for (const w of workers) await w.terminate();

  // 최종 저장
  await saveProgress(subject, progress);
  await writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8');

  console.log(`  ✓ ${subject} 완료: 성공 ${succeeded}, 실패 ${failed}`);
}

async function main() {
  console.log(`\n=== Tesseract OCR (Phase 1 - 무료) ===`);
  console.log(`대상: ${subjects.join(', ')}, 워커: ${numWorkers}개\n`);

  const start = Date.now();

  for (const subject of subjects) {
    await processSubject(subject);
    console.log();
  }

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  console.log(`=== 전체 완료 (${elapsed}분) ===`);
  console.log(`\n다음 단계: Phase 2 성취기준 추론`);
  console.log(`  ANTHROPIC_API_KEY=sk-... node scripts/infer-standards.js [과목|all]\n`);
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
