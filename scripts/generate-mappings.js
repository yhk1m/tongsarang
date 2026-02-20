/**
 * JSON 데이터의 성취기준 필드에서 default_mappings.json 생성
 * + 대괄호 누락 수정
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SUBJECTS = [
  '한국지리', '세계지리', '통합사회', '정치와법',
  '경제', '사회문화', '생활과윤리', '윤리와사상'
];

const mappings = {};

for (const subject of SUBJECTS) {
  const dataPath = join(ROOT, 'public', 'data', `${subject}.json`);
  if (!existsSync(dataPath)) continue;

  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const subjectMap = {};
  let fixed = 0;

  for (const item of data) {
    if (!item.성취기준) continue;

    let std = item.성취기준;
    // 대괄호 없으면 추가
    if (!std.startsWith('[')) {
      std = `[${std}]`;
      item.성취기준 = std;
      fixed++;
    }

    const key = `${item.학년도}_${item.분류}_${item.번호}`;
    subjectMap[key] = std;
  }

  if (Object.keys(subjectMap).length > 0) {
    mappings[subject] = subjectMap;
  }

  // 수정된 데이터 저장
  if (fixed > 0) {
    writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`${subject}: ${Object.keys(subjectMap).length}개 매핑, ${fixed}개 대괄호 수정`);
  } else {
    console.log(`${subject}: ${Object.keys(subjectMap).length}개 매핑`);
  }
}

// default_mappings.json 생성
const mappingsPath = join(ROOT, 'public', 'data', 'default_mappings.json');

// 기존 매핑이 있으면 merge
let existing = {};
if (existsSync(mappingsPath)) {
  existing = JSON.parse(readFileSync(mappingsPath, 'utf8'));
}

for (const [subject, map] of Object.entries(mappings)) {
  if (!existing[subject]) existing[subject] = {};
  Object.assign(existing[subject], map);
}

writeFileSync(mappingsPath, JSON.stringify(existing, null, 2), 'utf8');

const totalMappings = Object.values(existing).reduce((sum, m) => sum + Object.keys(m).length, 0);
console.log(`\ndefault_mappings.json 저장: ${totalMappings}개 매핑`);
console.log(`경로: ${mappingsPath}`);
