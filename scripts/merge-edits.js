#!/usr/bin/env node
/**
 * merge-edits.js
 * 개발자 모드에서 내보낸 JSON을 소스 데이터에 병합
 *
 * 사용법: node scripts/merge-edits.js <export.json>
 *
 * - edits (발문/문항내용) → public/data/{과목}.json 에 반영
 * - mappings (성취기준)  → public/data/default_mappings.json 에 반영
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'public', 'data');

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('사용법: node scripts/merge-edits.js <export.json>');
    process.exit(1);
  }

  const exportPath = resolve(args[0]);
  if (!existsSync(exportPath)) {
    console.error(`파일을 찾을 수 없습니다: ${exportPath}`);
    process.exit(1);
  }

  const raw = readFileSync(exportPath, 'utf-8');
  const data = JSON.parse(raw);

  let editCount = 0;
  let mappingCount = 0;

  // 1. 발문/문항내용 수정 반영
  if (data.edits) {
    for (const [subject, items] of Object.entries(data.edits)) {
      const jsonPath = resolve(DATA_DIR, `${subject}.json`);
      if (!existsSync(jsonPath)) {
        console.warn(`[경고] ${subject}.json 파일 없음, 건너뜀`);
        continue;
      }

      const subjectData = JSON.parse(readFileSync(jsonPath, 'utf-8'));

      for (const [key, fields] of Object.entries(items)) {
        // key = "2026_수능_1"
        const [year, cat, num] = key.split('_');
        const item = subjectData.find(
          i => String(i.학년도) === year && i.분류 === cat && String(i.번호) === num
        );

        if (!item) {
          console.warn(`[경고] ${subject}: ${key} 문항을 찾을 수 없음`);
          continue;
        }

        for (const [field, value] of Object.entries(fields)) {
          if (item[field] !== value) {
            console.log(`[수정] ${subject} ${key} ${field}: "${item[field]?.slice(0, 30)}..." → "${value.slice(0, 30)}..."`);
            item[field] = value;
            editCount++;
          }
        }
      }

      writeFileSync(jsonPath, JSON.stringify(subjectData, null, 2), 'utf-8');
      console.log(`[저장] ${subject}.json`);
    }
  }

  // 2. 성취기준 매핑 반영
  if (data.mappings) {
    const mappingsPath = resolve(DATA_DIR, 'default_mappings.json');
    let existing = {};
    if (existsSync(mappingsPath)) {
      existing = JSON.parse(readFileSync(mappingsPath, 'utf-8'));
    }

    for (const [subject, mappings] of Object.entries(data.mappings)) {
      if (!existing[subject]) existing[subject] = {};
      for (const [key, value] of Object.entries(mappings)) {
        if (existing[subject][key] !== value) {
          mappingCount++;
        }
        existing[subject][key] = value;
      }
    }

    writeFileSync(mappingsPath, JSON.stringify(existing, null, 2), 'utf-8');
    console.log(`[저장] default_mappings.json`);
  }

  console.log(`\n완료: 발문/문항내용 ${editCount}건, 성취기준 ${mappingCount}건 반영`);
}

main();
