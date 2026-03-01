import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('public/data/한국지리.json', 'utf-8'));

console.log('총 문항수:', data.length);
console.log('중단원 있는 문항:', data.filter(d => d.중단원).length);
console.log('중단원 없는 문항:', data.filter(d => !d.중단원).length);
console.log('대단원 있는 문항:', data.filter(d => d.대단원).length);
console.log('대단원 없는 문항:', data.filter(d => !d.대단원).length);

// Questions with 대단원 but no 중단원
const noSub = data.filter(d => d.대단원 && !d.중단원);
console.log('\n대단원 있지만 중단원 없는 문항:', noSub.length);

// Group by 대단원 for questions without 중단원
const byChapter = {};
noSub.forEach(d => {
  byChapter[d.대단원] = (byChapter[d.대단원] || 0) + 1;
});
console.log('\n=== 중단원 없는 문항의 대단원 분포 ===');
Object.entries(byChapter).sort().forEach(([k, v]) => console.log(`  ${k} (${v}문항)`));

// Questions with neither
const neither = data.filter(d => !d.대단원 && !d.중단원);
console.log('\n대단원도 중단원도 없는 문항:', neither.length);
if (neither.length > 0) {
  neither.slice(0, 3).forEach(d => {
    console.log(`  ${d.학년도} ${d.분류} ${d.번호}번: 발문=${(d.발문||'').substring(0,50)}`);
  });
}

// Check 발문/문항내용 availability
const noText = data.filter(d => !d.발문 && !d.문항내용);
console.log('\n발문+문항내용 둘 다 없는 문항:', noText.length);

// Sample of questions without text
const ambiguousNoText = noText.filter(d => ['1-2', '2-2', '3-1', '6-2', '7-1', '7-2'].some(p => (d.중단원||'').startsWith(p)));
console.log('  그 중 애매한 중단원:', ambiguousNoText.length);
