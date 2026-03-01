import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('public/data/한국지리.json', 'utf-8'));
const mappings = JSON.parse(readFileSync('scripts/한국지리_mappings.json', 'utf-8'))['한국지리'];

// Find unmapped items WITH 중단원
const unmapped = data.filter(d => {
  const key = `${d.학년도}_${d.분류}_${d.번호}`;
  return d.중단원 && !mappings[key];
});

console.log(`미매핑 문항 (중단원 있음): ${unmapped.length}개\n`);
unmapped.forEach(d => {
  console.log(`[${d.학년도} ${d.분류} ${d.번호}번] 중단원: ${d.중단원}`);
  console.log(`  발문: ${(d.발문||'(없음)').substring(0, 120)}`);
  console.log(`  내용: ${(d.문항내용||'(없음)').substring(0, 120)}`);
  console.log('');
});
