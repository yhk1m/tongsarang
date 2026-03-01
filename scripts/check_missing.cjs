const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/한국지리.json', 'utf8'));

// Check which fields are missing
const fields = ['배점', '답', '정답률', '난이도'];
const missing = {};

data.forEach(d => {
  const key = d['학년도'] + ' ' + d['분류'];
  if (!missing[key]) missing[key] = { total: 0, 배점: 0, 답: 0, 정답률: 0, 난이도: 0 };
  missing[key].total++;
  fields.forEach(f => {
    if (!d[f] || d[f] === '') missing[key][f]++;
  });
});

console.log('학년도/분류별 빈 필드 현황:');
console.log('시험                | 총문항 | 배점빈 | 답빈 | 정답률빈 | 난이도빈');
console.log('-'.repeat(70));
Object.keys(missing).sort().forEach(k => {
  const m = missing[k];
  if (m['배점'] > 0 || m['답'] > 0 || m['정답률'] > 0 || m['난이도'] > 0) {
    console.log(`${k.padEnd(18)} | ${String(m.total).padStart(4)} | ${String(m['배점']).padStart(5)} | ${String(m['답']).padStart(3)} | ${String(m['정답률']).padStart(7)} | ${String(m['난이도']).padStart(7)}`);
  }
});
