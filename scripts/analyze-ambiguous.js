import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('public/data/한국지리.json', 'utf-8'));

const ambiguous = [
  '1-2. 국토 인식의 변화와 지리 정보',
  '2-2. 하천 지형과 해안 지형',
  '3-1. 우리나라의 기후 특성과 주민 생활',
  '6-2. 인구 문제와 다문화 공간의 확대',
  '7-1. 지역의 의미와 북한 지역',
  '7-2. 수도권과 강원 지방',
  '중단원통합출제'
];

ambiguous.forEach(sub => {
  const items = data.filter(d => d.중단원 === sub);
  console.log(`\n=== ${sub} (${items.length}문항) ===`);
  items.slice(0, 5).forEach(item => {
    console.log(`  [${item.학년도} ${item.분류} ${item.번호}번] 발문: ${(item.발문 || '').substring(0, 60)}`);
    console.log(`    내용: ${(item.문항내용 || '').substring(0, 80)}`);
  });
});
