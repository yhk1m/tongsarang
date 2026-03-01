const fs = require('fs');
const path = require('path');

const mappingsPath = path.join(__dirname, '..', 'public', 'data', 'default_mappings.json');
const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));

// 처리할 과목 목록
const subjects = ['생활과윤리', '윤리와사상', '정치와법'];

subjects.forEach(subj => {
  const dataPath = path.join(__dirname, '..', 'public', 'data', `${subj}.json`);
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  if (!mappings[subj]) mappings[subj] = {};

  let added = 0, existing = 0, noCode = 0;
  data.forEach(item => {
    const key = `${item['학년도']}_${item['분류']}_${item['번호']}`;
    const code = item['성취기준'] || '';

    // 유효한 성취기준 코드인지 확인
    if (!code || !code.startsWith('[12')) {
      noCode++;
      return;
    }

    if (mappings[subj][key]) {
      existing++;
    } else {
      mappings[subj][key] = code;
      added++;
    }
  });

  const total = Object.keys(mappings[subj]).length;
  console.log(`${subj}: 추가 ${added}, 기존 ${existing}, 코드없음 ${noCode} → 총 ${total} 매핑`);
});

fs.writeFileSync(mappingsPath, JSON.stringify(mappings, null, 2), 'utf8');
console.log('\ndefault_mappings.json 저장 완료');

// 최종 확인
const final = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
Object.keys(final).forEach(s => console.log(`  ${s}: ${Object.keys(final[s]).length}`));
