const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ===== 역사 과목 설정 =====
const subjects = [
  {
    name: '한국사', subCd: '4113',
    chapters: [
      { ch: '1. 전근대 한국사의 이해', kw: ['고조선', '삼국', '고구려', '백제', '신라', '가야', '통일 신라', '발해', '고려', '조선', '세종', '성리학', '과거제', '골품', '호족', '무신', '몽골', '공민왕', '위화도', '훈민정음', '사림', '붕당', '영조', '정조', '탕평', '환국', '임진왜란', '병자호란', '왜란', '호란', '삼국.*통일', '원.*간섭', '신분제', '토지 제도', '관료제', '불교.*수용', '유교.*정치', '과전법', '직전법', '대동법', '균역법', '전시과', '과전법', '경국대전', '비변사', '향약', '서원', '세도 정치', '청동기', '철기', '신석기', '선사', '구석기', '반만년', '단군', '근초고왕', '광개토대왕', '장수왕', '진흥왕', '김춘추', '왕건', '후삼국', '광종', '성종', '태조', '정도전', '이성계', '집현전', '의정부', '6조', '3사', '승정원', '한글', '실학'] },
      { ch: '2. 근대 국민 국가 수립 운동', kw: ['개항', '강화도 조약', '운요호', '개화', '개화파', '위정척사', '갑신정변', '동학', '갑오개혁', '을미사변', '아관파천', '대한제국', '광무', '독립협회', '만민공동회', '을사조약', '을사늑약', '헤이그', '국채 보상', '의병', '안중근', '신민회', '간도', '개화.*운동', '근대.*학교', '만세', '국권.*피탈', '통상.*조약', '조일.*수호', '조미.*수호', '임오군란', '척화비', '흥선 대원군', '통상 수교 거부'] },
      { ch: '3. 일제 식민지 지배와 민족 운동의 전개', kw: ['일제', '식민지', '식민.*지배', '3·1 운동', '3.1', '삼일', '대한민국 임시 정부', '임시 정부', '독립운동', '독립.*운동', '항일', '의열단', '한인 애국단', '봉오동', '청산리', '광복군', '만주', '무장.*투쟁', '신간회', '물산 장려', '6·10 만세', '광주 학생', '민족 말살', '황국 신민', '창씨개명', '토지 조사', '산미 증식', '위안부', '징용', '징병', '국가 총동원', '문화 통치', '무단 통치', '헌병 경찰', '민족.*자결', '파리.*강화', '카이로', '포츠담'] },
      { ch: '4. 대한민국의 발전', kw: ['광복', '8·15', '해방', '미군정', '38선', '대한민국 정부 수립', '제헌', '6·25', '한국 전쟁', '이승만', '4·19', '4.19', '5·16', '5.16', '박정희', '유신', '5·18', '5.18', '광주', '민주화', '6월 민주', '6월 항쟁', '민주 항쟁', '남북', '통일', '금강산', '개성 공단', '경제 성장', '경제 개발', '새마을', 'IMF', '외환 위기', '촛불', '노태우', '김영삼', '김대중', '전두환', '남북 정상', '햇볕 정책', '반공', '반탁', '신탁 통치', '좌우 합작', '모스크바.*회의', '제주 4·3', '여순', '분단', '국제 연합'] },
    ]
  },
  {
    name: '동아시아사', subCd: '4116',
    chapters: [
      { ch: '1. 동아시아 역사의 시작', kw: ['신석기', '청동기', '선사', '벼농사', '국가.*형성', '고조선', '야요이', '조몬', '은', '주', '춘추', '전국', '흉노', '유목', '유목 민족', '선사.*문화', '농경', '목축', '비파형 동검', '세형 동검'] },
      { ch: '2. 동아시아 세계의 성립과 변화', kw: ['율령', '유교', '불교.*전파', '불교.*수용', '한자', '조공', '책봉', '조공.*책봉', '진', '한', '수', '당', '송', '거란', '여진', '북방 민족', '돌궐', '위구르', '발해', '율령.*국가', '과거제', '유학', '주자학', '성리학', '교류', '동아시아.*질서', '중화', '책봉.*체제'] },
      { ch: '3. 동아시아의 사회 변동과 문화 교류', kw: ['은.*유통', '교역', '무역', '서학', '천주교', '기독교.*전파', '도시.*발달', '인구 증가', '사회 변동', '서민 문화', '출판', '인쇄', '왜구', '임진왜란', '병자호란', '정묘호란', '명.*청', '에도', '도쿠가와', '쇄국', '데시마', '난학', '양명학', '고증학', '국학', '실학'] },
      { ch: '4. 동아시아의 근대화 운동과 반제국주의 민족 운동', kw: ['개항', '근대화', '근대.*운동', '제국주의', '침략', '아편 전쟁', '난징 조약', '메이지', '양무운동', '변법', '신해혁명', '5·4 운동', '국공', '항일', '중일 전쟁', '태평양 전쟁', '의화단', '러일 전쟁', '청일 전쟁', '강화도 조약', '불평등 조약', '개화', '자강', '민족 운동', '독립.*운동', '식민지', '전쟁.*책임', '위안부', '징용'] },
      { ch: '5. 오늘날의 동아시아', kw: ['냉전', '탈냉전', '경제 성장', '경제.*발전', '갈등', '화해', '역사.*분쟁', '영토.*분쟁', '평화', '6·25', '한국 전쟁', '베트남 전쟁', '일본국 헌법', '중화인민공화국', '타이완', '대만', '한일.*조약', '국교 정상화', '개혁 개방', '한류', '올림픽', '전후', '샌프란시스코', '동아시아.*협력', '북한', '핵.*문제'] },
    ]
  },
  {
    name: '세계사', subCd: '4107',
    chapters: [
      { ch: '1. 인류의 출현과 문명의 발생', kw: ['메소포타미아', '이집트', '인더스', '황하', '문명.*발생', '신석기', '청동기', '도시.*국가', '함무라비', '피라미드', '파라오', '카스트', '갑골문', '은', '주', '철기', '페니키아', '헤브라이', '아시리아', '페르시아', '아케메네스', '수메르', '바빌로니아'] },
      { ch: '2. 동아시아 지역의 역사', kw: ['진', '한.*제국', '수.*당', '송', '원', '명', '청', '춘추 전국', '진시황', '한 무제', '균전제', '조용조', '과거제', '주자학', '몽골.*제국', '쿠빌라이', '정화', '변법.*자강', '신해혁명', '국공.*내전', '문화 대혁명', '대약진', '야마토', '율령.*국가', '헤이안', '가마쿠라', '무로마치', '에도', '메이지.*유신', '태평천국', '양무운동', '5·4 운동'] },
      { ch: '3. 서아시아·인도 지역의 역사', kw: ['이슬람', '무함마드', '우마이야', '아바스', '오스만', '무굴', '셀주크', '술탄', '칼리프', '쿠란', '모스크', '마우리아', '쿠샨', '굽타', '힌두', '델리.*술탄', '사파비', '아크바르', '티무르', '십자군', '카스트', '자이나교', '간디', '인도.*독립', '이슬람.*세계', '오스만.*제국'] },
      { ch: '4. 유럽·아메리카 지역의 역사', kw: ['그리스', '로마', '아테네', '스파르타', '알렉산드로스', '헬레니즘', '크리스트교', '게르만', '프랑크', '봉건', '십자군', '르네상스', '종교 개혁', '루터', '칼뱅', '대항해', '절대 왕정', '시민 혁명', '프랑스 혁명', '산업 혁명', '미국 독립', '영국.*혁명', '나폴레옹', '자유주의', '국민주의', '라틴 아메리카', '남북 전쟁', '러시아 혁명', '의회', '마그나 카르타', '중세', '장원', '교황', '카를', '비잔티움'] },
      { ch: '5. 제국주의와 두 차례 세계 대전', kw: ['제국주의', '식민지', '열강', '아프리카.*분할', '세계 대전', '1차 세계', '2차 세계', '베르사유', '파시즘', '나치', '히틀러', '무솔리니', '대공황', '홀로코스트', '국제 연맹', '국제 연합', '민족 자결', '윌슨', '3국.*동맹', '3국.*협상', '전체주의'] },
      { ch: '6. 현대 세계의 변화', kw: ['냉전', '탈냉전', '미소.*대립', '자본주의.*진영', '공산주의.*진영', '제3 세계', '비동맹', '세계화', '유럽 연합', 'EU', '지역 통합', '다극화', '마셜', '트루먼', '쿠바.*위기', '베를린.*장벽', '소련.*해체', '독립.*운동', '아시아.*아프리카', '반둥', '석유 위기', '테러', '환경.*문제'] },
    ]
  },
];

// ===== examSeq 매핑 =====
const examMap = {
  '2026_수능': 349, '2025_수능': 334, '2024_수능': 319, '2023_수능': 304,
  '2022_수능': 289, '2021_수능': 274, '2020_수능': 259, '2019_수능': 244, '2018_수능': 229, '2017_수능': 213,
  '2026_6월': 341, '2025_6월': 326, '2024_6월': 311, '2023_6월': 296,
  '2022_6월': 281, '2021_6월': 266, '2020_6월': 251, '2019_6월': 236, '2018_6월': 220,
  '2026_9월': 345, '2025_9월': 330, '2024_9월': 315, '2023_9월': 300,
  '2022_9월': 285, '2021_9월': 270, '2020_9월': 255, '2019_9월': 240, '2018_9월': 225,
  '2025_3월': 337, '2025_5월': 338, '2025_7월': 342, '2025_10월': 348,
  '2024_3월': 322, '2024_5월': 323, '2024_7월': 327, '2024_10월': 333,
  '2023_3월': 307, '2023_4월': 308, '2023_7월': 312, '2023_10월': 316,
  '2022_3월': 292, '2022_4월': 293, '2022_7월': 297, '2022_10월': 301,
  '2021_3월': 277, '2021_4월': 278, '2021_7월': 282, '2021_10월': 286,
  '2020_3월': 263, '2020_7월': 267, '2020_10월': 271,
  '2019_3월': 247, '2019_4월': 248, '2019_7월': 252, '2019_10월': 256,
  '2018_3월': 232, '2018_4월': 233, '2018_7월': 237, '2018_10월': 241,
  '2017_4월': 217, '2017_7월': 222, '2017_10월': 226,
};

function fetchExamData(examSeq, subCd) {
  try {
    const tmpDir = path.join(os.tmpdir(), 'mega');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `hist_${subCd}_${examSeq}.bin`);
    execSync(`curl -s -X POST "https://www.megastudy.net/Entinfo/correctRate/main_rate_ax.asp" -d "grdFlg=3&examSeq=${examSeq}&tabNo=5&selSubCd=${subCd}" --output "${tmpFile}"`, { timeout: 15000 });
    const html = new TextDecoder('euc-kr').decode(fs.readFileSync(tmpFile));
    if (!html.includes('<td class="two">')) return null;
    const values = [];
    let m;
    const re = /<td class="two">(.*?)<\/td>/g;
    while ((m = re.exec(html)) !== null) values.push(m[1].trim());
    const questions = [];
    for (let i = 0; i + 9 < values.length; i += 10)
      questions.push({ 번호: values[i], 답: values[i+1], 난이도: values[i+2], 배점: values[i+3], 정답률: values[i+4].replace('%','') });
    return questions.length > 0 ? questions : null;
  } catch { return null; }
}

function getScore(text, keywords) {
  let score = 0;
  for (const kw of keywords) {
    try { if (new RegExp(kw, 'i').test(text)) score++; } catch { if (text.includes(kw)) score++; }
  }
  return score;
}

function classifyItem(item, chapterRules) {
  const text = ((item['발문'] || '') + ' ' + (item['문항내용'] || '')).replace(/\r?\n/g, ' ');
  let best = null, bestScore = 0;
  for (const rule of chapterRules) {
    const s = getScore(text, rule.kw);
    if (s > bestScore) { bestScore = s; best = rule.ch; }
  }
  // 발문/문항내용이 없으면 번호 기반 추정
  if (bestScore === 0) {
    const num = parseInt(item['번호']);
    const total = chapterRules.length;
    const perChapter = Math.ceil(20 / total);
    const idx = Math.min(Math.floor((num - 1) / perChapter), total - 1);
    best = chapterRules[idx].ch;
  }
  return best;
}

// ===== 처리 시작 =====
for (const subj of subjects) {
  const dataPath = path.join(__dirname, '..', 'public', 'data', `${subj.name}.json`);
  let data = [];

  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${subj.name} 크롤링 시작`);
  console.log('='.repeat(50));

  // 1) 모든 시험 크롤링 → 데이터 생성
  let totalQuestions = 0;
  const examResults = {};

  for (const [key, examSeq] of Object.entries(examMap).sort()) {
    process.stdout.write(`  ${key}... `);
    const questions = fetchExamData(examSeq, subj.subCd);
    if (!questions || !questions.length) { console.log('X'); continue; }

    const [year, classification] = key.split('_');
    let count = 0;
    for (const q of questions) {
      data.push({
        순번: 0, // 나중에 설정
        학년도: year,
        분류: classification,
        번호: q['번호'],
        배점: q['배점'],
        답: q['답'],
        대단원: '',
        중단원: '',
        발문: '',
        문항내용: '',
        정답률: q['정답률'],
        난이도: q['난이도'],
      });
      count++;
    }
    console.log(`${count}문항`);
    totalQuestions += count;
    examResults[key] = count;
    execSync('sleep 0.2');
  }

  console.log(`\n  총 ${totalQuestions}문항 크롤링 완료 (${Object.keys(examResults).length}개 시험)`);

  // 2) 순번 정렬 및 부여
  // 학년도 내림차순, 분류 순서, 번호 오름차순
  const classOrder = { '수능': 0, '6월': 1, '9월': 2, '3월': 3, '4월': 4, '5월': 5, '7월': 6, '10월': 7 };
  data.sort((a, b) => {
    if (a['학년도'] !== b['학년도']) return b['학년도'].localeCompare(a['학년도']);
    const ca = classOrder[a['분류']] ?? 99;
    const cb = classOrder[b['분류']] ?? 99;
    if (ca !== cb) return ca - cb;
    return parseInt(a['번호']) - parseInt(b['번호']);
  });
  data.forEach((d, i) => d['순번'] = i + 1);

  // 3) 대단원 분류 (발문/문항내용 없으므로 번호 기반)
  data.forEach(item => {
    item['대단원'] = classifyItem(item, subj.chapters);
  });

  const stats = {};
  data.forEach(d => { stats[d['대단원']] = (stats[d['대단원']] || 0) + 1; });
  console.log(`\n  [대단원 분류]`);
  Object.keys(stats).sort().forEach(k => console.log(`    ${k}: ${stats[k]}`));

  // 4) 저장
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\n  ${subj.name}.json 저장 완료 (${data.length}문항)`);
}

// ===== 한국사 tabNo=4 추가 크롤링 (필수과목) =====
console.log(`\n${'='.repeat(50)}`);
console.log('  한국사 tabNo=4 (필수과목 탭) 추가 확인');
console.log('='.repeat(50));

// 한국사가 tabNo=4에서도 데이터가 있는지 확인
const korHistPath = path.join(__dirname, '..', 'public', 'data', '한국사.json');
const korHistData = JSON.parse(fs.readFileSync(korHistPath, 'utf8'));
const existingExams = new Set();
korHistData.forEach(d => existingExams.add(d['학년도'] + '_' + d['분류']));

let additionalCount = 0;
for (const [key, examSeq] of Object.entries(examMap).sort()) {
  if (existingExams.has(key)) continue;
  try {
    const tmpDir = path.join(os.tmpdir(), 'mega');
    const tmpFile = path.join(tmpDir, `korhist_tab4_${examSeq}.bin`);
    execSync(`curl -s -X POST "https://www.megastudy.net/Entinfo/correctRate/main_rate_ax.asp" -d "grdFlg=3&examSeq=${examSeq}&tabNo=4&selSubCd=" --output "${tmpFile}"`, { timeout: 15000 });
    const html = new TextDecoder('euc-kr').decode(fs.readFileSync(tmpFile));
    if (!html.includes('<td class="two">')) continue;
    const values = [];
    let m;
    const re = /<td class="two">(.*?)<\/td>/g;
    while ((m = re.exec(html)) !== null) values.push(m[1].trim());
    const questions = [];
    for (let i = 0; i + 9 < values.length; i += 10)
      questions.push({ 번호: values[i], 답: values[i+1], 난이도: values[i+2], 배점: values[i+3], 정답률: values[i+4].replace('%','') });
    if (questions.length > 0) {
      const [year, classification] = key.split('_');
      for (const q of questions) {
        korHistData.push({
          순번: 0,
          학년도: year,
          분류: classification,
          번호: q['번호'],
          배점: q['배점'],
          답: q['답'],
          대단원: '',
          중단원: '',
          발문: '',
          문항내용: '',
          정답률: q['정답률'],
          난이도: q['난이도'],
        });
      }
      console.log(`  ${key} (tabNo=4): ${questions.length}문항 추가`);
      additionalCount += questions.length;
    }
    execSync('sleep 0.2');
  } catch {}
}

if (additionalCount > 0) {
  // 재정렬 및 순번 부여
  const classOrder = { '수능': 0, '6월': 1, '9월': 2, '3월': 3, '4월': 4, '5월': 5, '7월': 6, '10월': 7 };
  korHistData.sort((a, b) => {
    if (a['학년도'] !== b['학년도']) return b['학년도'].localeCompare(a['학년도']);
    const ca = classOrder[a['분류']] ?? 99;
    const cb = classOrder[b['분류']] ?? 99;
    if (ca !== cb) return ca - cb;
    return parseInt(a['번호']) - parseInt(b['번호']);
  });
  korHistData.forEach((d, i) => d['순번'] = i + 1);

  // 대단원 분류
  const korChapters = subjects[0].chapters;
  korHistData.forEach(item => {
    if (!item['대단원'] || item['대단원'] === '') {
      item['대단원'] = classifyItem(item, korChapters);
    }
  });

  fs.writeFileSync(korHistPath, JSON.stringify(korHistData, null, 2), 'utf8');
  console.log(`  한국사 추가 ${additionalCount}문항 저장 (총 ${korHistData.length}문항)`);
} else {
  console.log('  추가 데이터 없음');
}

// ===== 최종 요약 =====
console.log(`\n${'='.repeat(50)}`);
console.log('  최종 결과');
console.log('='.repeat(50));
for (const subj of subjects) {
  const dataPath = path.join(__dirname, '..', 'public', 'data', `${subj.name}.json`);
  const d = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const exams = new Set();
  d.forEach(item => exams.add(item['학년도'] + '_' + item['분류']));
  console.log(`  ${subj.name}: ${d.length}문항 (${exams.size}개 시험)`);
}
