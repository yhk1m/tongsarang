const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'public', 'data', '윤리와사상.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const chapters = [
  { ch: '1. 인간과 윤리 사상', kw: ['인간.*본성', '인간의 본성', '인간.*특성', '윤리 사상.*의의', '인간.*존재', '인간다운 삶', '윤리.*필요성', '인간.*사회적 존재', '도덕적 인간'] },
  { ch: '2. 동양과 한국 윤리 사상', kw: ['유교', '불교', '도교', '도가', '공자', '맹자', '순자', '노자', '장자', '주자', '주희', '왕양명', '이황', '이이', '정약용', '최제우', '동학', '원효', '의천', '지눌', '성리학', '양명학', '실학', '인의예지', '사단', '칠정', '사단칠정', '인', '예', '도덕경', '사성제', '팔정도', '해탈', '열반', '중도', '연기', '자비', '무위자연', '상생', '성선설', '성악설', '사덕', '오륜', '수양', '격물치지', '대동 사회', '화엄', '선종', '교종', '이기론', '천도교', '천인합일', '거경궁리', '지행합일', '이기심성', '묵자', '겸애', '양주', '위아'] },
  { ch: '3. 서양 윤리 사상', kw: ['소크라테스', '플라톤', '아리스토텔레스', '에피쿠로스', '스토아', '칸트', '벤담', '밀', '공리주의', '의무론', '덕 윤리', '결과론', '목적론', '자연법', '아퀴나스', '홉스', '로크', '루소', '사회 계약', '자유주의', '배려 윤리', '담론 윤리', '하버마스', '실존주의', '실용주의', '키르케고르', '사르트르', '니체', '듀이', '정언 명령', '가언 명령', '행복주의', '쾌락주의', '이성', '자연법 윤리', '보편.*법칙', '최대 다수.*최대 행복', '공리.*원리', '길리건', '나딩스', '매킨타이어', '롤스', '노직'] },
  { ch: '4. 사회사상', kw: ['자본주의', '사회주의', '민주주의', '자유민주주의', '국가', '시민', '공화주의', '자유 방임', '수정 자본주의', '복지 국가', '마르크스', '시장 경제', '계획 경제', '혼합 경제', '공산주의', '이상 국가', '이상 사회', '유토피아', '다원주의', '민족주의', '세계 시민주의', '평화', '전쟁', '분배 정의', '정의로운 전쟁', '영구 평화'] },
];

function getScore(text, keywords) {
  let score = 0;
  for (const kw of keywords) {
    try { if (new RegExp(kw, 'i').test(text)) score++; } catch { if (text.includes(kw)) score++; }
  }
  return score;
}

// 기존 분류 현황
console.log('=== 재분류 전 ===');
const before = {};
data.forEach(d => { before[d['대단원']] = (before[d['대단원']] || 0) + 1; });
Object.keys(before).sort().forEach(k => console.log(`  ${k}: ${before[k]}`));

// 모든 항목 대단원 초기화 후 재분류
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
    // 번호 기반 추론
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
console.log('\n윤리와사상.json 저장 완료');
