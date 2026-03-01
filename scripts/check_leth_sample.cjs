const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/생활과윤리.json', 'utf8'));

// 2017~2019 문항 샘플 출력
console.log('=== 생활과윤리 2017~2019 문항 샘플 ===');
['2017_4월', '2017_7월', '2017_10월', '2018_3월', '2018_수능', '2019_3월', '2019_4월'].forEach(key => {
  const [y, c] = key.split('_');
  const items = data.filter(d => d['학년도'] === y && d['분류'] === c);
  console.log(`\n--- ${key} (${items.length}문항) ---`);
  items.slice(0, 3).forEach(d => {
    console.log(`  ${d['번호']}번: 성취기준=${d['성취기준']} | 대단원=${d['대단원']}`);
  });
});

// 윤리와사상도 확인
const ethData = JSON.parse(fs.readFileSync('public/data/윤리와사상.json', 'utf8'));
console.log('\n\n=== 윤리와사상 샘플 ===');
['2026_수능', '2025_3월', '2020_수능'].forEach(key => {
  const [y, c] = key.split('_');
  const items = ethData.filter(d => d['학년도'] === y && d['분류'] === c);
  console.log(`\n--- ${key} (${items.length}문항) ---`);
  items.slice(0, 3).forEach(d => {
    console.log(`  ${d['번호']}번: 성취기준=${d['성취기준']} | 대단원=${d['대단원']}`);
  });
});
