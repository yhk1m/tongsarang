import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('public/data/한국지리.json', 'utf-8'));

// Questions with no 대단원
const empty = data.filter(d => !d.대단원);
console.log('=== 대단원 없는 900문항 학년도/분류 분포 ===');
const byYearCat = {};
empty.forEach(d => {
  const key = `${d.학년도} ${d.분류}`;
  byYearCat[key] = (byYearCat[key] || 0) + 1;
});
Object.entries(byYearCat).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}문항`));

// Questions WITH 대단원 - year/cat distribution
console.log('\n=== 대단원 있는 360문항 학년도/분류 분포 ===');
const filled = data.filter(d => d.대단원);
const byYearCat2 = {};
filled.forEach(d => {
  const key = `${d.학년도} ${d.분류}`;
  byYearCat2[key] = (byYearCat2[key] || 0) + 1;
});
Object.entries(byYearCat2).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}문항`));

// Check if question images exist
console.log('\n=== 이미지 경로 패턴 확인 ===');
// Check sample image paths
console.log('샘플 데이터 (대단원 없는 첫 5개):');
empty.slice(0, 5).forEach(d => {
  console.log(`  ${d.학년도}/${d.분류}/${d.번호}번 - 배점:${d.배점} 답:${d.답} 정답률:${d.정답률} 난이도:${d.난이도}`);
});
