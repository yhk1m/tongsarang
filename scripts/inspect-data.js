import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('public/data/한국지리.json', 'utf-8'));
console.log('총 문항수:', data.length);
console.log('\n=== 고유 중단원 목록 ===');
const subs = [...new Set(data.map(d => d.중단원).filter(Boolean))].sort();
subs.forEach(s => {
  const count = data.filter(d => d.중단원 === s).length;
  console.log(`  ${s} (${count}문항)`);
});
