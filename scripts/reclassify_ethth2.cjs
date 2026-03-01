const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'public', 'data', '윤리와사상.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// 고유명사 기반 분류 (가장 신뢰할 수 있음)
const easternNames = ['공자', '맹자', '순자', '노자', '장자', '주자', '주희', '왕양명', '이황', '이이', '정약용', '최제우', '원효', '의천', '지눌', '묵자', '양주', '한비자', '혜능', '혜시', '세종', '정도전', '율곡', '퇴계'];
const easternConcepts = ['성리학', '양명학', '실학', '동학', '천도교', '사단칠정', '이기론', '사성제', '팔정도', '열반', '해탈', '연기', '무위자연', '겸애', '위아', '도덕경', '천인합일', '거경궁리', '지행합일', '격물치지', '대동사회', '대동 사회', '화엄', '선종', '교종', '인의예지', '오륜', '사덕', '성선설', '성악설', '중용', '천명', '수기치인', '수양', '상생'];
const westernNames = ['소크라테스', '플라톤', '아리스토텔레스', '에피쿠로스', '칸트', '벤담', '밀', '홉스', '로크', '루소', '아퀴나스', '하버마스', '키르케고르', '사르트르', '니체', '듀이', '매킨타이어', '길리건', '나딩스', '스피노자', '헤겔', '베이컨', '데카르트', '흄', '피히테', '하이데거', '레비나스', '스토아'];
const westernConcepts = ['공리주의', '의무론', '덕 윤리', '자연법', '사회 계약', '정언 명령', '가언 명령', '실존주의', '실용주의', '담론 윤리', '배려 윤리', '쾌락주의', '금욕주의', '행복주의', '이데아', '에우다이모니아', '중용.*아리스토', '아타락시아', '아파테이아'];
const socialConcepts = ['자본주의', '사회주의', '민주주의', '공화주의', '자유 방임', '수정 자본주의', '복지 국가', '마르크스', '시장 경제', '계획 경제', '혼합 경제', '공산주의', '이상 국가', '이상 사회', '유토피아', '다원주의', '민족주의', '세계 시민주의', '평화', '정의로운 전쟁', '영구 평화', '분배 정의', '국제 정의', '해외 원조', '롤스', '노직', '왈저'];
const ch1Concepts = ['윤리학.*분류', '메타 윤리', '응용 윤리', '규범 윤리', '기술 윤리', '이론 윤리', '윤리.*학문', '윤리적 성찰', '인간.*본성', '인간의 특성', '도덕적 탐구', '윤리.*필요성', '인간다운', '도덕적 존재'];

function countMatches(text, keywords) {
  let count = 0;
  for (const kw of keywords) {
    try { if (new RegExp(kw).test(text)) count++; } catch { if (text.includes(kw)) count++; }
  }
  return count;
}

let stats = { ch1: 0, ch2: 0, ch3: 0, ch4: 0, byName: 0, byConcept: 0, byNum: 0 };

data.forEach(item => {
  const text = ((item['발문'] || '') + ' ' + (item['문항내용'] || '')).replace(/\r?\n/g, ' ');

  // 점수 계산
  const ch1Score = countMatches(text, ch1Concepts);
  const eastNameScore = countMatches(text, easternNames);
  const eastConceptScore = countMatches(text, easternConcepts);
  const westNameScore = countMatches(text, westernNames);
  const westConceptScore = countMatches(text, westernConcepts);
  const socialScore = countMatches(text, socialConcepts);

  const eastTotal = eastNameScore * 2 + eastConceptScore;  // 고유명사는 가중치 2배
  const westTotal = westNameScore * 2 + westConceptScore;
  const ch4Total = socialScore;

  // 분류 우선순위:
  // 1) ch1: 윤리학 분류/메타윤리 등 인간과 윤리 사상 고유 키워드
  // 2) 동양 vs 서양: 고유명사가 있으면 해당 분류
  // 3) 사회사상: 사회사상 고유 키워드
  // 4) 비교 문항: 동양/서양 모두 나오면 점수 비교

  if (ch1Score > 0 && eastTotal === 0 && westTotal === 0 && ch4Total === 0) {
    item['대단원'] = '1. 인간과 윤리 사상';
    stats.ch1++;
  } else if (ch4Total > 0 && ch4Total >= eastTotal && ch4Total >= westTotal) {
    // 사회사상 키워드가 가장 많으면 사회사상
    item['대단원'] = '4. 사회사상';
    stats.ch4++;
  } else if (eastTotal > 0 && westTotal === 0) {
    item['대단원'] = '2. 동양과 한국 윤리 사상';
    stats.ch2++;
    stats.byName++;
  } else if (westTotal > 0 && eastTotal === 0) {
    item['대단원'] = '3. 서양 윤리 사상';
    stats.ch3++;
    stats.byName++;
  } else if (eastTotal > 0 && westTotal > 0) {
    // 비교 문항: 점수 비교
    if (eastTotal > westTotal) {
      item['대단원'] = '2. 동양과 한국 윤리 사상';
      stats.ch2++;
    } else {
      item['대단원'] = '3. 서양 윤리 사상';
      stats.ch3++;
    }
    stats.byConcept++;
  } else if (ch1Score > 0) {
    item['대단원'] = '1. 인간과 윤리 사상';
    stats.ch1++;
  } else {
    // 번호 기반 (최후 수단)
    const num = parseInt(item['번호']);
    if (num <= 2) item['대단원'] = '1. 인간과 윤리 사상';
    else if (num <= 10) item['대단원'] = '2. 동양과 한국 윤리 사상';
    else if (num <= 18) item['대단원'] = '3. 서양 윤리 사상';
    else item['대단원'] = '4. 사회사상';

    if (num <= 2) stats.ch1++;
    else if (num <= 10) stats.ch2++;
    else if (num <= 18) stats.ch3++;
    else stats.ch4++;
    stats.byNum++;
  }
});

console.log('=== 재분류 결과 ===');
const result = {};
data.forEach(d => { result[d['대단원']] = (result[d['대단원']] || 0) + 1; });
Object.keys(result).sort().forEach(k => console.log(`  ${k}: ${result[k]}`));
console.log(`\n방법: 고유명사:${stats.byName}, 개념비교:${stats.byConcept}, 번호:${stats.byNum}`);
console.log(`단원별: ch1=${stats.ch1}, ch2=${stats.ch2}, ch3=${stats.ch3}, ch4=${stats.ch4}`);

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
console.log('\n윤리와사상.json 저장 완료');
