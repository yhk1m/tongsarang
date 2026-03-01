const fs = require('fs');
const subjects = ['한국지리', '세계지리', '통합사회', '경제', '사회문화', '생활과윤리', '윤리와사상', '정치와법'];

subjects.forEach(subj => {
  const data = JSON.parse(fs.readFileSync('public/data/' + subj + '.json', 'utf8'));
  const fields = ['순번', '학년도', '분류', '번호', '배점', '답', '대단원', '발문', '문항내용', '정답률', '난이도'];
  const empty = {};
  fields.forEach(f => {
    empty[f] = data.filter(d => !d[f] && d[f] !== 0).length;
  });
  const nonEmpty = fields.filter(f => empty[f] < data.length);
  const emptyFields = fields.filter(f => empty[f] === data.length);
  const partialFields = fields.filter(f => empty[f] > 0 && empty[f] < data.length);
  console.log(subj + ' (' + data.length + '):');
  if (emptyFields.length > 0) console.log('  ALL empty: ' + emptyFields.join(', '));
  if (partialFields.length > 0) partialFields.forEach(f => console.log('  partial: ' + f + ' (' + empty[f] + '/' + data.length + ' empty)'));
  console.log();
});
