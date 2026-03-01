const fs = require('fs');

['생활과윤리', '윤리와사상'].forEach(subj => {
  const data = JSON.parse(fs.readFileSync(`public/data/${subj}.json`, 'utf8'));
  const has = data.filter(d => d['성취기준'] && d['성취기준'] !== '');
  const empty = data.filter(d => !d['성취기준'] || d['성취기준'] === '');

  console.log(`\n========== ${subj} ==========`);
  console.log(`총: ${data.length} | 성취기준 있음: ${has.length} | 없음: ${empty.length}`);

  // 기존 성취기준 목록
  const codes = {};
  has.forEach(d => {
    const c = d['성취기준'];
    if (!codes[c]) codes[c] = 0;
    codes[c]++;
  });
  console.log('\n기존 성취기준:');
  Object.keys(codes).sort().forEach(k => console.log(`  ${k}: ${codes[k]}문항`));

  // 빈 항목 시험별 분포
  const byExam = {};
  empty.forEach(d => {
    const k = d['학년도'] + ' ' + d['분류'];
    if (!byExam[k]) byExam[k] = 0;
    byExam[k]++;
  });
  console.log('\n성취기준 빈 시험:');
  Object.keys(byExam).sort().forEach(k => console.log(`  ${k}: ${byExam[k]}문항`));
});
