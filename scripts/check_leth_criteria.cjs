const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/생활과윤리.json', 'utf8'));

// 시험별 성취기준 현황
const exams = {};
data.forEach(d => {
  const key = d['학년도'] + ' ' + d['분류'];
  if (!exams[key]) exams[key] = { total: 0, has: 0, empty: 0, samples: [] };
  exams[key].total++;
  const c = d['성취기준'] || '';
  if (c && c !== '') {
    exams[key].has++;
  } else {
    exams[key].empty++;
    if (exams[key].samples.length < 2) exams[key].samples.push(d['번호'] + '번');
  }
});

Object.keys(exams).sort().forEach(k => {
  const e = exams[k];
  const mark = e.empty > 0 ? ' *** 빈 항목 있음 ***' : '';
  console.log(`${k}: ${e.total}문항 (있음:${e.has}, 없음:${e.empty})${mark}`);
  if (e.samples.length > 0) console.log(`  샘플: ${e.samples.join(', ')}`);
});

// 2017~2019 문항 성취기준 상세
console.log('\n=== 2017~2019 문항 성취기준 상세 ===');
data.filter(d => {
  const y = parseInt(d['학년도']);
  return y >= 2017 && y <= 2019;
}).forEach(d => {
  const c = d['성취기준'] || '(빈값)';
  if (!c || c === '' || c === '(빈값)') {
    console.log(`  ${d['학년도']} ${d['분류']} ${d['번호']}번: ${c} | 대단원: ${d['대단원'] || '없음'}`);
  }
});

// 성취기준 값 분포 확인 (빈 문자열 등)
console.log('\n=== 성취기준 값 유형 ===');
const types = {};
data.forEach(d => {
  const c = d['성취기준'];
  const type = c === undefined ? 'undefined' : c === null ? 'null' : c === '' ? '빈문자열' : typeof c === 'string' && c.startsWith('[12') ? '정상코드' : `기타: ${c}`;
  types[type] = (types[type] || 0) + 1;
});
Object.keys(types).forEach(k => console.log(`  ${k}: ${types[k]}`));
