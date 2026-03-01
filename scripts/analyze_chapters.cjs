const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/한국지리.json', 'utf8'));

const noChapter = data.filter(d => d['대단원'] === '' || !d['대단원']);
const hasChapter = data.filter(d => d['대단원'] && d['대단원'] !== '');

console.log('Total items:', data.length);
console.log('With 대단원:', hasChapter.length);
console.log('Without 대단원:', noChapter.length);

// Group missing by 학년도+분류
const groups = {};
noChapter.forEach(d => {
  const key = d['학년도'] + ' ' + d['분류'];
  if (!groups[key]) groups[key] = 0;
  groups[key]++;
});
console.log('\n=== Missing 대단원 by exam ===');
Object.keys(groups).sort().forEach(k => console.log(k + ': ' + groups[k] + '문항'));

// Show unique 대단원 values
const chapters = [...new Set(hasChapter.map(d => d['대단원']))].sort();
console.log('\n=== Existing 대단원 categories ===');
chapters.forEach(c => {
  const count = hasChapter.filter(d => d['대단원'] === c).length;
  console.log(c + ' (' + count + '문항)');
});

// Show keyword patterns for each chapter
console.log('\n=== Sample keywords per 대단원 ===');
chapters.forEach(ch => {
  const items = hasChapter.filter(d => d['대단원'] === ch);
  console.log('\n--- ' + ch + ' ---');
  items.slice(0, 5).forEach((d, i) => {
    const text = ((d['발문'] || '') + ' ' + (d['문항내용'] || '')).replace(/\r?\n/g, ' ').substring(0, 150);
    console.log(`  [${d['학년도']} ${d['분류']} ${d['번호']}] ${text}`);
  });
});
