const fs = require('fs');
const subjects = ['한국지리', '세계지리', '통합사회', '경제', '사회문화'];

subjects.forEach(subj => {
  const data = JSON.parse(fs.readFileSync(`public/data/${subj}.json`, 'utf8'));
  const empty발 = data.filter(d => !d['발문'] || d['발문'] === '').length;
  const empty문 = data.filter(d => !d['문항내용'] || d['문항내용'] === '').length;
  console.log(`${subj}: ${data.length}문항 | 빈 발문: ${empty발} | 빈 문항내용: ${empty문}`);
});
