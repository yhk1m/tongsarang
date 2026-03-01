const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/한국지리.json', 'utf8'));
const empty = data.filter(d => !d['대단원'] || d['대단원'] === '');
const filled = data.filter(d => d['대단원'] && d['대단원'] !== '');
console.log('Total:', data.length);
console.log('대단원 있음:', filled.length);
console.log('대단원 없음:', empty.length);

// 2022 10월학평 이후 분류된 문항 샘플
const targets = data.filter(d => {
  const y = parseInt(d['학년도']);
  return d['대단원'] && d['대단원'] !== '' &&
    ((y === 2022 && d['분류'] === '10월학평') || y > 2022);
});
console.log('\n2022 10월학평부터 분류된 문항:', targets.length);
targets.slice(0, 5).forEach(d => {
  console.log(`  ${d['학년도']} ${d['분류']} ${d['번호']}번 → ${d['대단원']}`);
});
