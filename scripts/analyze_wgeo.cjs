const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/세계지리.json', 'utf8'));

console.log('=== 세계지리 데이터 현황 ===');
console.log('Total:', data.length);

// 구조 확인
console.log('\nFirst item keys:', Object.keys(data[0]).join(', '));

// 대단원 현황
const hasChapter = data.filter(d => d['대단원'] && d['대단원'] !== '');
const noChapter = data.filter(d => !d['대단원'] || d['대단원'] === '');
console.log('\n대단원 있음:', hasChapter.length);
console.log('대단원 없음:', noChapter.length);

const chapters = [...new Set(hasChapter.map(d => d['대단원']))].sort();
console.log('\n대단원 목록:');
chapters.forEach(c => {
  const count = hasChapter.filter(d => d['대단원'] === c).length;
  console.log(`  ${c} (${count}문항)`);
});

// 빈 필드 현황
const fields = ['배점', '답', '정답률', '난이도'];
fields.forEach(f => {
  const empty = data.filter(d => !d[f] || d[f] === '').length;
  console.log(`\n${f} 빈 항목: ${empty}/${data.length}`);
});

// 시험별 현황
console.log('\n=== 시험 목록 ===');
const exams = {};
data.forEach(d => {
  const key = d['학년도'] + ' ' + d['분류'];
  if (!exams[key]) exams[key] = { total: 0, noChapter: 0, noScore: 0 };
  exams[key].total++;
  if (!d['대단원'] || d['대단원'] === '') exams[key].noChapter++;
  if (!d['정답률'] || d['정답률'] === '') exams[key].noScore++;
});
Object.keys(exams).sort().forEach(k => {
  const e = exams[k];
  console.log(`${k}: ${e.total}문항 (대단원빈:${e.noChapter}, 정답률빈:${e.noScore})`);
});

// 대단원 샘플
if (chapters.length > 0) {
  console.log('\n=== 대단원별 샘플 ===');
  chapters.forEach(ch => {
    const items = hasChapter.filter(d => d['대단원'] === ch);
    console.log(`\n--- ${ch} ---`);
    items.slice(0, 3).forEach(d => {
      const text = ((d['발문'] || '') + ' ' + (d['문항내용'] || '')).replace(/\r?\n/g, ' ').substring(0, 120);
      console.log(`  [${d['학년도']} ${d['분류']} ${d['번호']}] ${text}`);
    });
  });
}
