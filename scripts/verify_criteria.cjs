const fs = require('fs');

['생활과윤리', '윤리와사상'].forEach(subj => {
  const data = JSON.parse(fs.readFileSync(`public/data/${subj}.json`, 'utf8'));
  const has = data.filter(d => d['성취기준'] && d['성취기준'] !== '');
  const empty = data.filter(d => !d['성취기준'] || d['성취기준'] === '');

  console.log(`\n===== ${subj} =====`);
  console.log(`총: ${data.length} | 성취기준 있음: ${has.length} | 없음: ${empty.length}`);

  const codes = {};
  has.forEach(d => { codes[d['성취기준']] = (codes[d['성취기준']] || 0) + 1; });
  Object.keys(codes).sort().forEach(k => console.log(`  ${k}: ${codes[k]}`));

  if (empty.length > 0) {
    console.log('\n빈 문항 샘플:');
    empty.slice(0, 3).forEach(d => console.log(`  ${d['학년도']} ${d['분류']} ${d['번호']}번`));
  }
});
