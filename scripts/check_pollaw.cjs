const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/정치와법.json', 'utf8'));

const empty발문 = data.filter(d => !d['발문'] || d['발문'] === '');
const empty문항 = data.filter(d => !d['문항내용'] || d['문항내용'] === '');
const both = data.filter(d => (!d['발문'] || d['발문'] === '') && (!d['문항내용'] || d['문항내용'] === ''));

console.log(`총: ${data.length}`);
console.log(`빈 발문: ${empty발문.length}, 빈 문항내용: ${empty문항.length}, 둘 다 빈: ${both.length}`);

// 시험별 빈 현황
const byExam = {};
both.forEach(d => {
  const k = d['학년도'] + ' ' + d['분류'];
  byExam[k] = (byExam[k] || 0) + 1;
});
console.log('\n빈 시험:');
Object.keys(byExam).sort().forEach(k => console.log(`  ${k}: ${byExam[k]}`));
