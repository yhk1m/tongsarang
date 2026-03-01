const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'public', 'data', '생활과윤리.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const chapters = [
  { ch: '1. 현대의 삶과 실천 윤리', kw: ['실천 윤리', '윤리학.*분류', '메타 윤리', '기술 윤리', '규범 윤리', '응용 윤리', '이론 윤리', '윤리적 성찰', '도덕적 탐구', '윤리.*학문', '토론.*윤리', '윤리적 쟁점'] },
  { ch: '2. 생명과 윤리', kw: ['생명', '출생', '죽음', '낙태', '안락사', '뇌사', '장기 이식', '생명 존엄', '생명 윤리', '유전자', '동물 실험', '동물 권리', '동물.*복지', '인간 배아', '인공 수정', '생식', '자살', '연명.*치료', '사형'] },
  { ch: '3. 사회와 윤리', kw: ['정의', '분배', '분배적 정의', '공정', '공리주의', '자유주의', '공동체주의', '롤스', '노직', '매킨타이어', '왈저', '사회 정의', '직업 윤리', '청렴', '부패', '공직자', '기업 윤리', '노동', '노동자', '근로', '시민 불복종', '사회.*정의', '교정적 정의'] },
  { ch: '4. 과학과 윤리', kw: ['과학', '기술', '과학 기술', '정보', '정보 사회', '사이버', '개인 정보', '저작권', '지식 재산', '인공 지능', 'AI', '자율 주행', '빅 데이터', '사물 인터넷', '핵무기', '핵.*발전', '원자력', '책임 윤리', '요나스', '기술.*윤리'] },
  { ch: '5. 문화와 윤리', kw: ['문화', '예술', '대중문화', '미적 가치', '의식주', '다문화', '문화 상대주의', '보편 윤리', '종교', '소비', '소비 윤리', '유행', '매체', '미디어', '윤리적 소비', '문화.*다양성', '종교 갈등'] },
  { ch: '6. 평화와 공존의 윤리', kw: ['평화', '전쟁', '정의로운 전쟁', '국제 관계', '국제 사회', '남북', '통일', '해외 원조', '공존', '지구촌', '국제 평화', '난민', '세계 시민', '민족', '이산가족', '통일 비용', '해외.*원조', '지속 가능'] },
];

function getScore(text, keywords) {
  let score = 0;
  for (const kw of keywords) {
    try { if (new RegExp(kw, 'i').test(text)) score++; } catch { if (text.includes(kw)) score++; }
  }
  return score;
}

console.log('=== 재분류 전 ===');
const before = {};
data.forEach(d => { before[d['대단원']] = (before[d['대단원']] || 0) + 1; });
Object.keys(before).sort().forEach(k => console.log(`  ${k}: ${before[k]}`));

let byKeyword = 0, byNum = 0;
data.forEach(item => {
  const text = ((item['발문'] || '') + ' ' + (item['문항내용'] || '')).replace(/\r?\n/g, ' ');
  let best = null, bestScore = 0;
  for (const rule of chapters) {
    const s = getScore(text, rule.kw);
    if (s > bestScore) { bestScore = s; best = rule.ch; }
  }
  if (bestScore > 0) {
    item['대단원'] = best;
    byKeyword++;
  } else {
    const num = parseInt(item['번호']);
    const perChapter = Math.ceil(20 / chapters.length);
    const idx = Math.min(Math.floor((num - 1) / perChapter), chapters.length - 1);
    item['대단원'] = chapters[idx].ch;
    byNum++;
  }
});

console.log(`\n=== 재분류 후 (키워드:${byKeyword}, 번호:${byNum}) ===`);
const after = {};
data.forEach(d => { after[d['대단원']] = (after[d['대단원']] || 0) + 1; });
Object.keys(after).sort().forEach(k => console.log(`  ${k}: ${after[k]}`));

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
console.log('\n생활과윤리.json 저장 완료');
