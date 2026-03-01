const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/생활과윤리.json', 'utf8'));

// 빈 문항내용 확인
const empty = data.filter(d => {
  return (!d['문항내용'] || d['문항내용'] === '');
});
console.log('빈 문항내용:', empty.length);
empty.forEach(d => console.log('  ', d['학년도'], d['분류'], d['번호'] + '번', '발문:', (d['발문'] || '').substring(0, 50)));

console.log('\n--- OCR 샘플 확인 ---');
// 2023 3월 15번
const sample1 = data.find(d => d['학년도'] === '2023' && d['분류'] === '3월' && d['번호'] === '15');
if (sample1) {
  console.log('\n2023 3월 15번:');
  console.log('발문:', sample1['발문']);
  console.log('문항내용(앞200자):', (sample1['문항내용'] || '').substring(0, 200));
}

// 2019 4월 10번
const sample2 = data.find(d => d['학년도'] === '2019' && d['분류'] === '4월' && d['번호'] === '10');
if (sample2) {
  console.log('\n2019 4월 10번:');
  console.log('발문:', sample2['발문']);
  console.log('문항내용(앞200자):', (sample2['문항내용'] || '').substring(0, 200));
}
