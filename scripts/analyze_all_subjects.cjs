const fs = require('fs');
const subjects = ['통합사회', '생활과윤리', '윤리와사상', '정치와법', '경제', '사회문화'];

subjects.forEach(subj => {
  const data = JSON.parse(fs.readFileSync(`public/data/${subj}.json`, 'utf8'));
  const hasChapter = data.filter(d => d['대단원'] && d['대단원'] !== '').length;
  const noRate = data.filter(d => !d['정답률'] || d['정답률'] === '').length;
  const noAnswer = data.filter(d => !d['답'] || d['답'] === '').length;
  const noDiff = data.filter(d => !d['난이도'] || d['난이도'] === '').length;

  // 분류 naming
  const classes = [...new Set(data.map(d => d['분류']))].sort();

  // 대단원 목록
  const chapters = [...new Set(data.filter(d => d['대단원'] && d['대단원'] !== '').map(d => d['대단원']))].sort();

  console.log(`\n========== ${subj} ==========`);
  console.log(`총: ${data.length}문항 | 대단원있음: ${hasChapter} | 정답률빈: ${noRate} | 답빈: ${noAnswer} | 난이도빈: ${noDiff}`);
  console.log(`분류: ${classes.join(', ')}`);
  if (chapters.length > 0) {
    console.log(`대단원: ${chapters.join(' | ')}`);
  } else {
    console.log('대단원: (없음)');
  }
});
