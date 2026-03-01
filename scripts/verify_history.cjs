const fs = require('fs');

['한국사', '동아시아사', '세계사'].forEach(subj => {
  const data = JSON.parse(fs.readFileSync('public/data/' + subj + '.json', 'utf8'));
  const exams = new Set();
  data.forEach(d => exams.add(d['학년도'] + ' ' + d['분류']));
  const emptyBalmun = data.filter(d => !d['발문'] || d['발문'] === '').length;
  const emptyDap = data.filter(d => !d['답'] || d['답'] === '').length;
  const emptyRate = data.filter(d => !d['정답률'] || d['정답률'] === '').length;
  const hasDae = data.filter(d => d['대단원'] && d['대단원'] !== '').length;
  const hasCrit = data.filter(d => d['성취기준'] && d['성취기준'] !== '').length;
  console.log(subj + ':');
  console.log('  총 문항: ' + data.length + ' (' + exams.size + '개 시험)');
  console.log('  답/배점: ' + (data.length - emptyDap) + '/' + data.length);
  console.log('  정답률: ' + (data.length - emptyRate) + '/' + data.length);
  console.log('  대단원: ' + hasDae + '/' + data.length);
  console.log('  성취기준: ' + hasCrit + '/' + data.length);
  console.log('  발문: ' + (data.length - emptyBalmun) + '/' + data.length);
  const years = {};
  data.forEach(d => { years[d['학년도']] = years[d['학년도']] || new Set(); years[d['학년도']].add(d['분류']); });
  Object.keys(years).sort().reverse().forEach(y => {
    console.log('    ' + y + ': ' + [...years[y]].join(', '));
  });
  console.log();
});

const mappings = JSON.parse(fs.readFileSync('public/data/default_mappings.json', 'utf8'));
console.log('default_mappings.json:');
Object.keys(mappings).forEach(k => console.log('  ' + k + ': ' + Object.keys(mappings[k]).length));
