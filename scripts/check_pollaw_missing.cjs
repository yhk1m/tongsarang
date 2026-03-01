const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/정치와법.json', 'utf8'));

const missing = {};
data.forEach(d => {
  if (!d['정답률'] || d['정답률'] === '' || !d['난이도'] || d['난이도'] === '') {
    const k = d['학년도'] + ' ' + d['분류'];
    if (!missing[k]) missing[k] = 0;
    missing[k]++;
  }
});

console.log('정답률/난이도 없는 시험:');
Object.keys(missing).sort().forEach(k => console.log(`  ${k}: ${missing[k]}문항`));
console.log(`\n총 ${Object.values(missing).reduce((a,b)=>a+b,0)}문항`);
