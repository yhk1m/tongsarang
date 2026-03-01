/**
 * OCR로 모든 과목의 발문/문항내용 채우기
 *
 * 8개 과목을 순차 처리하며, 각 문항 이미지를 Claude Haiku로 OCR하여
 * 발문과 문항내용을 추출·저장한다.
 *
 * 사용법:
 *   ANTHROPIC_API_KEY=sk-... node scripts/ocr-fill.js
 *   ANTHROPIC_API_KEY=sk-... node scripts/ocr-fill.js 세계지리      # 특정 과목만
 *   ANTHROPIC_API_KEY=sk-... node scripts/ocr-fill.js all 15        # 동시 요청 수 지정
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ── 과목 목록 (처리 대상 8개) ──
const ALL_SUBJECTS = [
  '한국지리', '세계지리', '통합사회', '정치와법',
  '경제', '사회문화', '생활과윤리', '윤리와사상'
];

const SUBJECT_CODE = {
  '한국지리': 'korgeo',
  '세계지리': 'wgeo',
  '통합사회': 'iss',
  '한국사': 'korhis',
  '정치와법': 'pollaw',
  '경제': 'econ',
  '사회문화': 'socul',
  '생활과윤리': 'leth',
  '윤리와사상': 'ethth',
  '동아시아사': 'eahis',
  '세계사': 'worhis'
};

const CATEGORY_TO_MONTH = {
  '수능': '11',
  '9모': '09',
  '6모': '06',
  '10월학평': '10',
  '7월학평': '07',
  '5월학평': '05',
  '4월학평': '04',
  '3월학평': '03',
  '11월': '11',
  '10월': '10',
  '9월': '09',
  '7월': '07',
  '6월': '06',
  '5월': '05',
  '4월': '04',
  '3월': '03'
};

// ── CLI args ──
const argSubject = process.argv[2] || 'all';
const concurrency = parseInt(process.argv[3]) || 10;

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY 환경변수를 설정하세요.');
  process.exit(1);
}

const client = new Anthropic({ apiKey });
const MODEL = 'claude-haiku-4-5-20251001';
let fatalError = false;

// ── 유틸리티 ──
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getImagePath(subject, imagesDir, item) {
  const code = SUBJECT_CODE[subject];
  if (!code) return null;

  const month = CATEGORY_TO_MONTH[item.분류];
  if (!month) return null;

  const num = String(item.번호).padStart(2, '0');
  const year = String(item.학년도);

  const jpgPath = join(imagesDir, `${year}_${month}_${code}_${num}.jpg`);
  if (existsSync(jpgPath)) return jpgPath;

  const pngPath = join(imagesDir, `${year}_${month}_${code}_${num}.png`);
  if (existsSync(pngPath)) return pngPath;

  return null;
}

// ── Claude API 호출 (OCR 전용) ──
async function ocrItem(item, imagePath, subject) {
  const imageData = await readFile(imagePath);
  const base64 = imageData.toString('base64');
  const mediaType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  const content = [
    {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64 }
    },
    {
      type: 'text',
      text: `이 한국 수능/모의고사 문제 이미지에서 텍스트를 추출하세요.
과목: ${subject}, ${item.학년도}학년도 ${item.분류} ${item.번호}번

다음 두 필드를 JSON으로 반환하세요:
1. "발문": 문항번호("1." 등)와 배점("[3점]" 등)을 제외한 질문 부분. 밑줄이나 <보기> 참조 지시도 포함.
2. "문항내용": 발문 이외의 모든 텍스트 (조건, <보기>, 선지 ①~⑤ 등). 줄바꿈은 \\n으로.

반드시 아래 형식의 JSON만 출력하세요:
{"발문": "...", "문항내용": "..."}`
    }
  ];

  let retries = 0;
  const maxRetries = 5;

  while (retries <= maxRetries) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content }]
      });

      const text = response.content[0].text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`  JSON 파싱 실패 (${item.학년도} ${item.분류} ${item.번호}번): ${text.slice(0, 100)}`);
        return null;
      }
      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      if ((err.status === 429 || err.status === 529) && retries < maxRetries) {
        const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
        console.warn(`  Rate limited (${err.status}), ${(delay / 1000).toFixed(1)}s 후 재시도...`);
        await sleep(delay);
        retries++;
        continue;
      }
      if (err.status === 400 && err.message && err.message.includes('credit balance')) {
        console.error(`\n  ✖ API 크레딧 부족! https://console.anthropic.com/settings/billing 에서 충전하세요.`);
        fatalError = true;
        return null;
      }
      console.error(`  API 에러 (${item.학년도} ${item.분류} ${item.번호}번):`, err.message);
      return null;
    }
  }
  return null;
}

// ── 동시 실행 제한 ──
async function runWithConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length && !fatalError) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── 진행상황 관리 ──
function progressPath(subject) {
  return join(ROOT, `.ocr-fill-progress-${subject}.json`);
}

async function loadProgress(subject) {
  const p = progressPath(subject);
  if (existsSync(p)) {
    return JSON.parse(await readFile(p, 'utf8'));
  }
  return {};
}

async function saveProgress(subject, progress) {
  await writeFile(progressPath(subject), JSON.stringify(progress, null, 2), 'utf8');
}

// ── 과목 하나 처리 ──
async function processSubject(subject) {
  const dataPath = join(ROOT, 'public', 'data', `${subject}.json`);
  const imagesDir = join(ROOT, 'public', 'images', subject);

  if (!existsSync(dataPath)) {
    console.log(`  데이터 파일 없음, 건너뜀: ${dataPath}`);
    return;
  }

  const data = JSON.parse(await readFile(dataPath, 'utf8'));
  console.log(`  총 문항 수: ${data.length}`);

  // 처리 대상 필터링: 발문 또는 문항내용이 이미 있으면 스킵
  const itemsToProcess = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (item.발문 || item.문항내용) continue; // 이미 데이터 있으면 스킵
    itemsToProcess.push({ index: i, item });
  }

  console.log(`  OCR 필요: ${itemsToProcess.length}개, 스킵: ${data.length - itemsToProcess.length}개`);

  if (itemsToProcess.length === 0) {
    console.log('  처리할 항목 없음.\n');
    return;
  }

  const progress = await loadProgress(subject);
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let noImage = 0;
  let skippedProgress = 0;

  const tasks = itemsToProcess.map(({ index, item }) => async () => {
    const key = `${item.학년도}_${item.분류}_${item.번호}`;

    // 이전 진행상황에서 재사용
    if (progress[key]) {
      skippedProgress++;
      processed++;
      const prev = progress[key];
      if (prev.발문) item.발문 = prev.발문;
      if (prev.문항내용) item.문항내용 = prev.문항내용;
      data[index] = item;
      return;
    }

    const imagePath = getImagePath(subject, imagesDir, item);
    if (!imagePath) {
      processed++;
      noImage++;
      if (noImage <= 5) console.log(`  [${processed}/${itemsToProcess.length}] SKIP (이미지 없음): ${key}`);
      if (noImage === 6) console.log(`  ... 이미지 없음 추가 건 생략`);
      return;
    }

    const result = await ocrItem(item, imagePath, subject);
    processed++;

    if (result) {
      succeeded++;
      if (result.발문) item.발문 = result.발문;
      if (result.문항내용) item.문항내용 = result.문항내용;
      data[index] = item;

      progress[key] = {};
      if (result.발문) progress[key].발문 = result.발문;
      if (result.문항내용) progress[key].문항내용 = result.문항내용;

      // 매 20건마다 progress 저장
      if (succeeded % 20 === 0) {
        await saveProgress(subject, progress);
        console.log(`  [${processed}/${itemsToProcess.length}] 진행상황 저장 (성공 ${succeeded}건)`);
      }

      if (succeeded % 50 === 0 || succeeded <= 3) {
        console.log(`  [${processed}/${itemsToProcess.length}] OK ${key}`);
      }
    } else {
      failed++;
      if (failed <= 10) console.log(`  [${processed}/${itemsToProcess.length}] FAIL ${key}`);
    }
  });

  await runWithConcurrency(tasks, concurrency);

  // 최종 저장
  await saveProgress(subject, progress);
  await writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8');

  console.log(`  ── 결과: 성공 ${succeeded}, 실패 ${failed}, 이미지없음 ${noImage}, 재사용 ${skippedProgress}`);
  console.log(`  저장: ${dataPath}\n`);

  return { succeeded, failed, noImage, skippedProgress };
}

// ── 메인 ──
async function main() {
  const subjects = argSubject === 'all'
    ? ALL_SUBJECTS
    : [argSubject];

  // 과목 유효성 체크
  for (const s of subjects) {
    if (!SUBJECT_CODE[s]) {
      console.error(`알 수 없는 과목: ${s}`);
      console.error(`사용 가능: ${ALL_SUBJECTS.join(', ')}`);
      process.exit(1);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`  OCR 발문/문항내용 채우기`);
  console.log(`  모델: ${MODEL}`);
  console.log(`  동시 요청: ${concurrency}`);
  console.log(`  대상 과목: ${subjects.join(', ')}`);
  console.log(`${'='.repeat(50)}\n`);

  const totals = { succeeded: 0, failed: 0, noImage: 0, skippedProgress: 0 };

  for (const subject of subjects) {
    if (fatalError) {
      console.log(`치명적 에러로 중단합니다.`);
      break;
    }

    console.log(`\n── ${subject} ──`);
    const result = await processSubject(subject);
    if (result) {
      totals.succeeded += result.succeeded;
      totals.failed += result.failed;
      totals.noImage += result.noImage;
      totals.skippedProgress += result.skippedProgress;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`  전체 완료`);
  console.log(`  성공: ${totals.succeeded}`);
  console.log(`  실패: ${totals.failed}`);
  console.log(`  이미지 없음: ${totals.noImage}`);
  console.log(`  이전 결과 재사용: ${totals.skippedProgress}`);
  console.log(`${'='.repeat(50)}\n`);
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
