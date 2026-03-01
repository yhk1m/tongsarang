const fs = require('fs');
const { execSync } = require('child_process');
const subjects = ['한국지리', '세계지리', '통합사회', '경제', '사회문화', '생활과윤리', '윤리와사상', '정치와법'];

subjects.forEach(subj => {
  // Working copy
  const working = JSON.parse(fs.readFileSync('public/data/' + subj + '.json', 'utf8'));

  // Git committed version
  let gitData;
  try {
    const gitContent = execSync('git show HEAD:"public/data/' + subj + '.json"', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    gitData = JSON.parse(gitContent);
  } catch { gitData = []; }

  const fields = ['배점', '답', '대단원', '발문', '문항내용', '정답률', '난이도'];

  const workingFilled = {};
  const gitFilled = {};
  fields.forEach(f => {
    workingFilled[f] = working.filter(d => d[f] && d[f] !== '').length;
    gitFilled[f] = gitData.filter(d => d[f] && d[f] !== '').length;
  });

  console.log(subj + ' (working:' + working.length + ' / git:' + gitData.length + '):');
  fields.forEach(f => {
    const w = workingFilled[f];
    const g = gitFilled[f];
    if (w !== g) {
      const diff = w - g;
      console.log('  ' + f + ': working=' + w + ' git=' + g + ' (' + (diff > 0 ? '+' : '') + diff + ')');
    }
  });
  console.log();
});
