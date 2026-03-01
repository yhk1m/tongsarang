/**
 * 특정 시험의 문항내용을 OCR로 교체하는 스크립트
 *
 * 대상: 한국지리 2024 9모/6모, 2023 수능/9모/6모, 2022 수능/9모/6모, 2021 수능/9모/6모
 * - 기존 문항내용 (수동 키워드) → OCR 전체 텍스트로 교체
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Tesseract from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const CATEGORY_TO_MONTH = {
  '수능': '11', '9모': '09', '6모': '06',
  '10월학평': '10', '7월학평': '07', '5월학평': '05', '4월학평': '04', '3월학평': '03'
};

// 대상 시험
const TARGETS = [
  { 학년도: '2024', 분류: '9모' }, { 학년도: '2024', 분류: '6모' },
  { 학년도: '2023', 분류: '수능' }, { 학년도: '2023', 분류: '9모' }, { 학년도: '2023', 분류: '6모' },
  { 학년도: '2022', 분류: '수능' }, { 학년도: '2022', 분류: '9모' }, { 학년도: '2022', 분류: '6모' },
  { 학년도: '2021', 분류: '수능' }, { 학년도: '2021', 분류: '9모' }, { 학년도: '2021', 분류: '6모' }
];

function isTarget(item) {
  return TARGETS.some(t => String(item.학년도) === t.학년도 && item.분류 === t.분류);
}

function getImagePath(item) {
  const month = CATEGORY_TO_MONTH[item.분류];
  if (!month) return null;
  const num = String(item.번호).padStart(2, '0');
  const year = String(item.학년도);
  const dir = join(ROOT, 'public', 'images', '한국지리');

  const jpgPath = join(dir, `${year}_${month}_korgeo_${num}.jpg`);
  if (existsSync(jpgPath)) return jpgPath;
  const pngPath = join(dir, `${year}_${month}_korgeo_${num}.png`);
  if (existsSync(pngPath)) return pngPath;
  return null;
}

function cleanOCRText(raw) {
  if (!raw || raw.trim().length < 5) return '';
  // 기본 정리: 연속 공백 축소, 앞뒤 trim
  let text = raw.replace(/\r\n/g, '\n').trim();
  return text;
}

async function main() {
  const dataPath = join(ROOT, 'public', 'data', '한국지리.json');
  const data = JSON.parse(await readFile(dataPath, 'utf8'));

  // 대상 문항 필터
  const items = [];
  for (let i = 0; i < data.length; i++) {
    if (isTarget(data[i])) {
      const imagePath = getImagePath(data[i]);
      if (imagePath) {
        items.push({ index: i, item: data[i], imagePath });
      } else {
        console.warn(`이미지 없음: ${data[i].학년도} ${data[i].분류} ${data[i].번호}번`);
      }
    }
  }

  console.log(`\n=== 한국지리 문항내용 OCR 교체 ===`);
  console.log(`대상: ${items.length}문항\n`);

  // Tesseract 워커 생성 (4개)
  const NUM_WORKERS = 4;
  const actualWorkers = Math.min(NUM_WORKERS, items.length);
  console.log(`워커 ${actualWorkers}개 생성 중...`);

  const workers = [];
  for (let i = 0; i < actualWorkers; i++) {
    const worker = await Tesseract.createWorker('kor', Tesseract.OEM.DEFAULT);
    workers.push(worker);
  }
  console.log('워커 준비 완료\n');

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let idx = 0;

  async function workerLoop(worker) {
    while (idx < items.length) {
      const i = idx++;
      const { index, item, imagePath } = items[i];
      const key = `${item.학년도} ${item.분류} ${item.번호}번`;

      try {
        const result = await worker.recognize(imagePath);
        const raw = result.data.text;
        const cleaned = cleanOCRText(raw);

        if (cleaned.length > 0) {
          data[index].문항내용 = cleaned;
          succeeded++;
        } else {
          console.warn(`  빈 결과: ${key}`);
          data[index].문항내용 = '';
          failed++;
        }
      } catch (err) {
        console.warn(`  실패 ${key}: ${err.message}`);
        failed++;
      }

      processed++;
      if (processed % 20 === 0 || processed === items.length) {
        console.log(`  [${processed}/${items.length}] 완료 (성공: ${succeeded}, 실패: ${failed})`);
      }
    }
  }

  await Promise.all(workers.map(w => workerLoop(w)));

  // 워커 정리
  for (const w of workers) await w.terminate();

  // 저장
  await writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8');

  console.log(`\n=== 완료 ===`);
  console.log(`성공: ${succeeded}, 실패: ${failed}`);
  console.log(`한국지리.json 저장됨\n`);
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
