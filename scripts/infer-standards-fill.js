/**
 * 발문/문항내용 텍스트 기반 성취기준 추론 스크립트
 *
 * 사용법:
 *   ANTHROPIC_API_KEY=sk-... node scripts/infer-standards-fill.js 세계지리
 *   ANTHROPIC_API_KEY=sk-... node scripts/infer-standards-fill.js 세계지리 15   # 동시 요청 수
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { ACHIEVEMENT_STANDARDS } from '../src/data/achievementStandards.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ── CLI args ──
const subject = process.argv[2];
const concurrency = parseInt(process.argv[3]) || 10;

if (!subject || !ACHIEVEMENT_STANDARDS[subject]) {
  console.error(`사용법: node scripts/infer-standards-fill.js <과목> [동시요청수]`);
  console.error(`가능한 과목: ${Object.keys(ACHIEVEMENT_STANDARDS).join(', ')}`);
  process.exit(1);
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY 환경변수를 설정하세요.');
  process.exit(1);
}

const client = new Anthropic({ apiKey });
const MODEL = 'claude-haiku-4-5-20251001';
let fatalError = false;

const DATA_PATH = join(ROOT, 'public', 'data', `${subject}.json`);
const PROGRESS_PATH = join(ROOT, `.infer-std-progress-${subject}.json`);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── 성취기준 후보 텍스트 생성 ──
function getStandardsList(item) {
  const subjectData = ACHIEVEMENT_STANDARDS[subject];
  const areas = subjectData.areas;

  // 대단원 번호로 축소 시도
  const chapterMatch = item.대단원 ? item.대단원.match(/^(\d+)\./) : null;
  const chapterNum = chapterMatch ? parseInt(chapterMatch[1]) : null;

  if (chapterNum) {
    const area = areas.find(a => {
      const areaMatch = a.area.match(/^(\d+)\./);
      return areaMatch && parseInt(areaMatch[1]) === chapterNum;
    });
    if (area) return area.standards.map(s => `${s.id}: ${s.text}`).join('\n');
  }

  return areas.map(a =>
    a.standards.map(s => `${s.id}: ${s.text}`).join('\n')
  ).join('\n');
}

// ── Claude API 호출 ──
async function inferStandard(item) {
  const standardsList = getStandardsList(item);
  const textContext = `발문: ${item.발문 || '(없음)'}\n문항내용: ${(item.문항내용 || '(없음)').slice(0, 800)}`;

  const promptText = `다음 한국 수능/모의고사 문제의 성취기준을 판단하세요.
과목: ${subject}, 학년도: ${item.학년도}, 분류: ${item.분류}, 번호: ${item.번호}번
${item.대단원 ? `대단원: ${item.대단원}` : ''}

${textContext}

[성취기준 후보]
${standardsList}

위 후보 중 이 문제에 가장 적합한 성취기준 ID를 하나만 선택하세요. 분석 없이 JSON만 출력하세요.`;

  let retries = 0;
  const maxRetries = 5;

  while (retries <= maxRetries) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 64,
        messages: [
          { role: 'user', content: promptText },
          { role: 'assistant', content: '{"성취기준": "' }
        ]
      });

      const text = response.content[0].text.trim();
      const fullJson = '{"성취기준": "' + text;
      const jsonMatch = fullJson.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`  JSON 파싱 실패 (${item.학년도} ${item.분류} ${item.번호}번): ${text.slice(0, 80)}`);
        return null;
      }
      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      if ((err.status === 429 || err.status === 529) && retries < maxRetries) {
        const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
        console.warn(`  Rate limited, ${(delay / 1000).toFixed(1)}s 후 재시도...`);
        await sleep(delay);
        retries++;
        continue;
      }
      if (err.status === 400 && err.message && err.message.includes('credit balance')) {
        console.error(`\n  ✖ API 크레딧 부족!`);
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

// ── 진행상황 ──
async function loadProgress() {
  if (existsSync(PROGRESS_PATH)) return JSON.parse(await readFile(PROGRESS_PATH, 'utf8'));
  return {};
}
async function saveProgress(progress) {
  await writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf8');
}

// ── 메인 ──
async function main() {
  console.log(`\n=== 성취기준 추론: ${subject} ===`);
  console.log(`모델: ${MODEL}, 동시 요청: ${concurrency}\n`);

  const data = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  console.log(`총 문항 수: ${data.length}`);

  const itemsToProcess = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item.발문 && !item.문항내용) continue;
    const hasStd = item.성취기준 && /^\[/.test(item.성취기준);
    if (hasStd) continue;
    itemsToProcess.push({ index: i, item });
  }

  console.log(`추론 필요: ${itemsToProcess.length}개\n`);
  if (itemsToProcess.length === 0) { console.log('처리할 항목 없음.'); return; }

  const progress = await loadProgress();
  let processed = 0, succeeded = 0, failed = 0, skippedProgress = 0;

  const tasks = itemsToProcess.map(({ index, item }) => async () => {
    const key = `${item.학년도}_${item.분류}_${item.번호}`;

    if (progress[key]) {
      skippedProgress++;
      processed++;
      item.성취기준 = progress[key];
      data[index] = item;
      return;
    }

    const result = await inferStandard(item);
    processed++;

    if (result && result.성취기준) {
      succeeded++;
      item.성취기준 = result.성취기준;
      data[index] = item;
      progress[key] = result.성취기준;

      if (succeeded % 20 === 0) {
        await saveProgress(progress);
        console.log(`  [${processed}/${itemsToProcess.length}] 저장 (성공 ${succeeded}건)`);
      }
      if (succeeded % 100 === 0 || succeeded <= 3) {
        console.log(`  [${processed}/${itemsToProcess.length}] OK ${key} → ${result.성취기준}`);
      }
    } else {
      failed++;
      if (failed <= 10) console.log(`  [${processed}/${itemsToProcess.length}] FAIL ${key}`);
    }
  });

  await runWithConcurrency(tasks, concurrency);
  await saveProgress(progress);
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');

  console.log(`\n=== 완료 ===`);
  console.log(`성공: ${succeeded}, 실패: ${failed}, 재사용: ${skippedProgress}`);
  console.log(`저장: ${DATA_PATH}\n`);
}

main().catch(err => { console.error('치명적 오류:', err); process.exit(1); });
