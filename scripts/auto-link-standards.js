import { readFileSync, writeFileSync, existsSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('ANTHROPIC_API_KEY 환경변수를 설정하세요.');
  process.exit(1);
}

const client = new Anthropic({ apiKey: API_KEY });
const data = JSON.parse(readFileSync('public/data/한국지리.json', 'utf-8'));
const SUBJECT = '한국지리';
const IMG_DIR = 'public/images/한국지리';

// === 성취기준 목록 ===
const STANDARDS = [
  { id: '[12한지01-01]', text: '한국의 위치 특성과 영토의 특징을 설명한다.' },
  { id: '[12한지01-02]', text: '고지도와 현대 지도에 나타난 세계관과 국토관의 변화를 비교한다.' },
  { id: '[12한지01-03]', text: '다양한 지리 정보의 수집·분석·표현 방법을 이해하고 활용한다.' },
  { id: '[12한지02-01]', text: '한반도의 형성 과정을 지체 구조와 지질 시대별 특성으로 설명한다.' },
  { id: '[12한지02-02]', text: '하천 지형의 형성 과정을 이해하고 하천이 인간 생활에 미치는 영향을 분석한다.' },
  { id: '[12한지02-03]', text: '해안 지형의 형성 과정을 이해하고 해안이 인간 생활에 미치는 영향을 분석한다.' },
  { id: '[12한지02-04]', text: '화산 지형과 카르스트 지형의 특성을 이해하고 주민 생활과의 관계를 설명한다.' },
  { id: '[12한지03-01]', text: '우리나라의 기후 특성과 주민 생활과의 관계를 분석한다.' },
  { id: '[12한지03-02]', text: '기온과 강수의 지역 차이를 이해하고 그 원인을 설명한다.' },
  { id: '[12한지03-03]', text: '자연재해 및 기후 변화의 원인과 영향을 파악하고 대응 방안을 탐색한다.' },
  { id: '[12한지04-01]', text: '촌락의 형성과 변화 과정을 이해하고 도시와 촌락의 상호 관계를 설명한다.' },
  { id: '[12한지04-02]', text: '도시의 지역 분화와 내부 구조를 이해하고 대도시권의 형성과 변화를 분석한다.' },
  { id: '[12한지04-03]', text: '도시 계획과 지역 개발의 특성을 이해하고 살기 좋은 국토를 위한 방안을 모색한다.' },
  { id: '[12한지04-04]', text: '주거 문화의 변화와 주거 공간의 변화를 파악한다.' },
  { id: '[12한지05-01]', text: '자원의 의미와 특성을 파악하고 주요 자원의 분포와 이동을 분석한다.' },
  { id: '[12한지05-02]', text: '농업 구조의 변화와 농업 문제를 이해하고 해결 방안을 모색한다.' },
  { id: '[12한지05-03]', text: '공업의 발달과 구조 변화를 파악하고 공업 입지의 변화를 설명한다.' },
  { id: '[12한지05-04]', text: '서비스 산업의 성장과 교통·통신의 발달로 인한 변화를 파악한다.' },
  { id: '[12한지06-01]', text: '인구 분포의 특성과 인구 구조의 변화를 파악한다.' },
  { id: '[12한지06-02]', text: '인구 문제와 공간적 영향을 이해하고 대책을 모색한다.' },
  { id: '[12한지06-03]', text: '외국인 이주자 및 다문화 가정의 증가와 이에 따른 변화를 파악한다.' },
  { id: '[12한지07-01]', text: '지역의 의미와 지역 구분의 목적 및 방법을 이해한다.' },
  { id: '[12한지07-02]', text: '북한의 자연환경과 인문 환경의 특성을 이해하고 통일 국토의 미래상을 탐색한다.' },
  { id: '[12한지07-03]', text: '수도권의 특성과 문제점을 파악하고 해결 방안을 모색한다.' },
  { id: '[12한지07-04]', text: '강원·충청·호남·영남·제주 지역의 특성을 파악하고 각 지역의 주요 이슈를 분석한다.' },
];

const STANDARDS_TEXT = STANDARDS.map(s => `${s.id}: ${s.text}`).join('\n');

// === 분류 → 월 코드 매핑 ===
const CAT_TO_MONTH = {
  '수능': '11', '9모': '09', '6모': '06',
  '10월학평': '10', '7월학평': '07', '5월학평': '05',
  '4월학평': '04', '3월학평': '03',
};

// === Phase 1: 규칙 기반 매핑 ===
const CLEAR_MAP = {
  '1-1. 우리나라의 위치 특성과 영토': '[12한지01-01]',
  '2-1. 한반도의 형성과 산지 지형': '[12한지02-01]',
  '2-3. 화산 지형과 카르스트 지형': '[12한지02-04]',
  '3-2. 자연재해와 기후 변화': '[12한지03-03]',
  '4-1. 촌락의 변화와 도시 발달': '[12한지04-01]',
  '4-2. 도시 구조와 대도시권': '[12한지04-02]',
  '4-3. 도시 계획과 지역 개발': '[12한지04-03]',
  '5-1. 자원의 의미와 자원 문제': '[12한지05-01]',
  '5-2. 농업의 변화': '[12한지05-02]',
  '5-3. 공업 발달': '[12한지05-03]',
  '5-4. 교통통신의 발달과 서비스업의 변화': '[12한지05-04]',
  '6-1. 인구 분포와 인구 구조의 변화': '[12한지06-01]',
  '7-3. 충청, 호남, 영남 지방과 제주도': '[12한지07-04]',
};

// === Phase 2: 키워드 기반 매핑 ===
const KEYWORD_RULES = {
  '1-2. 국토 인식의 변화와 지리 정보': [
    { keywords: ['고지도', '대동여지도', '혼일강리', '천하도', '지리지', '세계관', '국토관', '조선', '고산자', '김정호', '청구도', '동국지도', '팔도도', '지도 제작', '축척'], standard: '[12한지01-02]' },
    { keywords: ['GIS', '지리 정보', '지리정보', '원격탐사', '위성', 'GPS', '통계지도', '주제도', '조건', '인구 밀도', '면적', '도로 연장', '마트', '후보지', '입지'], standard: '[12한지01-03]' },
  ],
  '2-2. 하천 지형과 해안 지형': [
    { keywords: ['하천', '하곡', '범람원', '선상지', '하안단구', '삼각주', '감입곡류', '자유곡류', '유로', '하중도', '충적', '직강', '부채', '협곡', '자연제방', '배후습지', '우각호', '구하도', '유역', '상류', '중류', '하류', '퇴적평야'], standard: '[12한지02-02]' },
    { keywords: ['해안', '석호', '갯벌', '사빈', '사구', '리아스', '해식', '해안단구', '조류', '파랑', '간석지', '방파제', '모래사장', '모래 이동', '해수욕', '포구', '곶', '만', '연안', '시스택', '해식동굴', '해식애', '간척', '방조제', '조력', '서해안', '동해안', '남해안'], standard: '[12한지02-03]' },
  ],
  '3-1. 우리나라의 기후 특성과 주민 생활': [
    { keywords: ['기후 특성', '주민 생활', '계절풍', '풍향', '바람', '전통 가옥', '온돌', '마루', '겨울', '여름', '계절', '일기', '기압', '태풍', '장마', '황사', '열섬', '도시 기후'], standard: '[12한지03-01]' },
    { keywords: ['지역 차이', '기온 차이', '강수량 차이', '위도', '수륙 분포', '해발고도', '기후 요인', '연교차', '최한월', '최난월', '무상일수', '연강수량', '평년', '기온의 연교차', '기온 연교차', '남북 차이', '동서 차이', '대륙성'], standard: '[12한지03-02]' },
  ],
  '6-2. 인구 문제와 다문화 공간의 확대': [
    { keywords: ['인구 문제', '고령화', '저출산', '인구 감소', '소멸', '노령화', '합계출산율', '인구 피라미드', '유소년', '중위 연령', '인구 절벽'], standard: '[12한지06-02]' },
    { keywords: ['외국인', '다문화', '이주', '결혼 이민', '근로자', '귀화', '외국인 주민', '이주 노동'], standard: '[12한지06-03]' },
  ],
  '7-1. 지역의 의미와 북한 지역': [
    { keywords: ['지역 의미', '지역 구분', '등질', '기능', '경계', '동질', '결절'], standard: '[12한지07-01]' },
    { keywords: ['북한', '평양', '신의주', '청진', '나선', '관북', '관서', '중강진', '개성', '통일', '비무장', 'DMZ', '남북', '압록강', '두만강', '경의선', '분단'], standard: '[12한지07-02]' },
  ],
  '7-2. 수도권과 강원 지방': [
    { keywords: ['수도권', '서울', '인천', '경기', '과밀', '수도권 집중', '수도권 규제', '1기 신도시', '2기 신도시', '베드타운', '교외화'], standard: '[12한지07-03]' },
    { keywords: ['강원', '춘천', '원주', '속초', '영동', '정선', '태백', '영서', '강릉', '평창', '양양', '횡성', '동계 올림픽', '폐광', '레일바이크', '영동 고속'], standard: '[12한지07-04]' },
  ],
};

function keywordMatch(subChapter, text) {
  const rules = KEYWORD_RULES[subChapter];
  if (!rules) return null;

  const scores = rules.map(rule => {
    const score = rule.keywords.filter(kw => text.includes(kw)).length;
    return { standard: rule.standard, score };
  });

  scores.sort((a, b) => b.score - a.score);
  if (scores[0].score > 0 && scores[0].score > (scores[1]?.score || 0)) {
    return scores[0].standard;
  }
  // If tied or no match, return null (need API)
  return null;
}

function questionKey(item) {
  return `${item.학년도}_${item.분류}_${item.번호}`;
}

function getImagePath(item) {
  const month = CAT_TO_MONTH[item.분류];
  if (!month) return null;
  const num = String(item.번호).padStart(2, '0');
  const fileName = `${item.학년도}_${month}_korgeo_${num}.jpg`;
  const fullPath = `${IMG_DIR}/${fileName}`;
  return existsSync(fullPath) ? fullPath : null;
}

// === Claude API 호출 (텍스트) ===
async function classifyByText(questions) {
  const questionList = questions.map((q, i) => {
    return `[${i+1}] 학년도:${q.학년도}, 분류:${q.분류}, 번호:${q.번호}, 대단원:${q.대단원||''}, 중단원:${q.중단원||''}\n    발문: ${q.발문||'(없음)'}\n    문항내용: ${q.문항내용||'(없음)'}`;
  }).join('\n\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `다음은 한국지리 수능/모의고사 문항입니다. 각 문항에 가장 적합한 성취기준 ID를 하나만 선택하세요.

=== 성취기준 목록 ===
${STANDARDS_TEXT}

=== 문항 목록 ===
${questionList}

각 문항에 대해 반드시 다음 형식으로만 답하세요 (다른 설명 없이):
[번호] 성취기준ID

예시:
[1] [12한지02-03]
[2] [12한지01-01]`
    }]
  });

  const text = response.content[0].text;
  const results = {};
  const lines = text.split('\n').filter(l => l.trim());
  lines.forEach(line => {
    const match = line.match(/\[(\d+)\]\s*(\[12한지\d+-\d+\])/);
    if (match) {
      const idx = parseInt(match[1]) - 1;
      if (idx >= 0 && idx < questions.length) {
        results[questionKey(questions[idx])] = match[2];
      }
    }
  });
  return results;
}

// === Claude API 호출 (이미지) ===
async function classifyByImage(questions) {
  const content = [];

  questions.forEach((q, i) => {
    const imgPath = getImagePath(q);
    if (imgPath) {
      const imgData = readFileSync(imgPath);
      const base64 = imgData.toString('base64');
      content.push({
        type: 'text',
        text: `[${i+1}] ${q.학년도}학년도 ${q.분류} ${q.번호}번:`
      });
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: base64 }
      });
    }
  });

  if (content.length === 0) return {};

  content.push({
    type: 'text',
    text: `위 이미지들은 한국지리 수능/모의고사 문항입니다. 각 문항에 가장 적합한 성취기준 ID를 하나만 선택하세요.

=== 성취기준 목록 ===
${STANDARDS_TEXT}

각 문항에 대해 반드시 다음 형식으로만 답하세요 (다른 설명 없이):
[번호] 성취기준ID

예시:
[1] [12한지02-03]
[2] [12한지01-01]`
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content }]
  });

  const text = response.content[0].text;
  const results = {};
  const lines = text.split('\n').filter(l => l.trim());
  lines.forEach(line => {
    const match = line.match(/\[(\d+)\]\s*(\[12한지\d+-\d+\])/);
    if (match) {
      const idx = parseInt(match[1]) - 1;
      if (idx >= 0 && idx < questions.length) {
        results[questionKey(questions[idx])] = match[2];
      }
    }
  });
  return results;
}

// === 메인 실행 ===
async function main() {
  const mapping = {};
  const outputPath = 'scripts/한국지리_mappings.json';

  // Load existing progress if any
  if (existsSync(outputPath)) {
    const existing = JSON.parse(readFileSync(outputPath, 'utf-8'));
    Object.assign(mapping, existing['한국지리'] || {});
    console.log(`기존 매핑 ${Object.keys(mapping).length}개 로드`);
  }

  // ==========================================
  // Phase 1: 규칙 기반 매핑 (API 불필요)
  // ==========================================
  console.log('\n=== Phase 1: 규칙 기반 매핑 ===');
  let clearCount = 0;
  let keywordCount = 0;
  const needTextApi = [];

  data.forEach(item => {
    const key = questionKey(item);
    if (mapping[key]) return; // already mapped

    const sub = item.중단원;
    if (!sub) return; // no 중단원 → Phase 3

    // Clear 1:1 mapping
    if (CLEAR_MAP[sub]) {
      mapping[key] = CLEAR_MAP[sub];
      clearCount++;
      return;
    }

    // Keyword matching for ambiguous
    const text = (item.발문 || '') + ' ' + (item.문항내용 || '');
    if (sub !== '중단원통합출제') {
      const result = keywordMatch(sub, text);
      if (result) {
        mapping[key] = result;
        keywordCount++;
        return;
      }
    }

    // Need API
    needTextApi.push(item);
  });

  console.log(`  명확한 매핑: ${clearCount}개`);
  console.log(`  키워드 매핑: ${keywordCount}개`);
  console.log(`  API 필요 (텍스트): ${needTextApi.length}개`);

  // ==========================================
  // Phase 2: Claude API 텍스트 분석
  // ==========================================
  if (needTextApi.length > 0) {
    console.log('\n=== Phase 2: Claude API 텍스트 분석 ===');
    // Batch by 10
    for (let i = 0; i < needTextApi.length; i += 10) {
      const batch = needTextApi.slice(i, i + 10);
      console.log(`  배치 ${Math.floor(i/10)+1}/${Math.ceil(needTextApi.length/10)} (${batch.length}문항)...`);
      try {
        const results = await classifyByText(batch);
        Object.assign(mapping, results);
        console.log(`    → ${Object.keys(results).length}개 매핑 성공`);
      } catch (err) {
        console.error(`    → 오류: ${err.message}`);
      }
      // Save progress
      writeFileSync(outputPath, JSON.stringify({ '한국지리': mapping }, null, 2));
      // Rate limit delay
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // ==========================================
  // Phase 3: Claude API 이미지 분석 (900문항)
  // ==========================================
  const needImageApi = data.filter(item => {
    const key = questionKey(item);
    return !mapping[key] && !item.중단원;
  });

  console.log(`\n=== Phase 3: Claude API 이미지 분석 ===`);
  console.log(`  이미지 분석 필요: ${needImageApi.length}문항`);

  // Batch by 5 (image API is heavier)
  for (let i = 0; i < needImageApi.length; i += 5) {
    const batch = needImageApi.slice(i, i + 5);
    const batchNum = Math.floor(i/5) + 1;
    const totalBatches = Math.ceil(needImageApi.length / 5);
    console.log(`  배치 ${batchNum}/${totalBatches} (${batch.length}문항)...`);

    // Check which have images
    const withImages = batch.filter(q => getImagePath(q));
    if (withImages.length === 0) {
      console.log(`    → 이미지 없음, 건너뜀`);
      continue;
    }

    try {
      const results = await classifyByImage(withImages);
      Object.assign(mapping, results);
      console.log(`    → ${Object.keys(results).length}개 매핑 성공`);
    } catch (err) {
      console.error(`    → 오류: ${err.message}`);
    }

    // Save progress after each batch
    writeFileSync(outputPath, JSON.stringify({ '한국지리': mapping }, null, 2));

    // Rate limit delay
    await new Promise(r => setTimeout(r, 1500));

    // Progress report every 20 batches
    if (batchNum % 20 === 0) {
      console.log(`  === 진행률: ${batchNum}/${totalBatches} (${Object.keys(mapping).length}개 완료) ===`);
    }
  }

  // ==========================================
  // 최종 결과
  // ==========================================
  console.log('\n=== 최종 결과 ===');
  console.log(`총 매핑: ${Object.keys(mapping).length}/${data.length}개`);

  // Save final result in LinkerStore format
  const linkerData = { '한국지리': mapping };
  writeFileSync(outputPath, JSON.stringify(linkerData, null, 2));
  console.log(`저장 완료: ${outputPath}`);

  // Statistics
  const standardCounts = {};
  Object.values(mapping).forEach(v => {
    standardCounts[v] = (standardCounts[v] || 0) + 1;
  });
  console.log('\n=== 성취기준별 문항 수 ===');
  Object.entries(standardCounts).sort().forEach(([k, v]) => {
    console.log(`  ${k}: ${v}문항`);
  });
}

main().catch(console.error);
