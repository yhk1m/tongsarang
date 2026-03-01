/**
 * Phase 2: Claude API 텍스트 전용 성취기준 추론 (이미지 없음, ~$3)
 * Phase 1 (Tesseract OCR) 실행 후 사용
 *
 * 사용법:
 *   ANTHROPIC_API_KEY=sk-... node scripts/infer-standards.js [과목|all] [동시요청수]
 *
 * 예:
 *   ANTHROPIC_API_KEY=sk-... node scripts/infer-standards.js 한국지리 5
 *   ANTHROPIC_API_KEY=sk-... node scripts/infer-standards.js all 10
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ── 성취기준 데이터 ──
const ACHIEVEMENT_STANDARDS = {
  '한국지리': [
    { area: '1. 국토 인식과 지리 정보', standards: [
      { id: '[12한지01-01]', text: '한국의 위치 특성과 영토의 특징을 설명한다.' },
      { id: '[12한지01-02]', text: '고지도와 현대 지도에 나타난 세계관과 국토관의 변화를 비교한다.' },
      { id: '[12한지01-03]', text: '다양한 지리 정보의 수집·분석·표현 방법을 이해하고 활용한다.' },
    ]},
    { area: '2. 지형 환경과 인간 생활', standards: [
      { id: '[12한지02-01]', text: '한반도의 형성 과정을 지체 구조와 지질 시대별 특성으로 설명한다.' },
      { id: '[12한지02-02]', text: '하천 지형의 형성 과정을 이해하고 하천이 인간 생활에 미치는 영향을 분석한다.' },
      { id: '[12한지02-03]', text: '해안 지형의 형성 과정을 이해하고 해안이 인간 생활에 미치는 영향을 분석한다.' },
      { id: '[12한지02-04]', text: '화산 지형과 카르스트 지형의 특성을 이해하고 주민 생활과의 관계를 설명한다.' },
    ]},
    { area: '3. 기후 환경과 인간 생활', standards: [
      { id: '[12한지03-01]', text: '우리나라의 기후 특성과 주민 생활과의 관계를 분석한다.' },
      { id: '[12한지03-02]', text: '기온과 강수의 지역 차이를 이해하고 그 원인을 설명한다.' },
      { id: '[12한지03-03]', text: '자연재해 및 기후 변화의 원인과 영향을 파악하고 대응 방안을 탐색한다.' },
    ]},
    { area: '4. 거주 공간의 변화와 지역 개발', standards: [
      { id: '[12한지04-01]', text: '촌락의 형성과 변화 과정을 이해하고 도시와 촌락의 상호 관계를 설명한다.' },
      { id: '[12한지04-02]', text: '도시의 지역 분화와 내부 구조를 이해하고 대도시권의 형성과 변화를 분석한다.' },
      { id: '[12한지04-03]', text: '도시 계획과 지역 개발의 특성을 이해하고 살기 좋은 국토를 위한 방안을 모색한다.' },
      { id: '[12한지04-04]', text: '주거 문화의 변화와 주거 공간의 변화를 파악한다.' },
    ]},
    { area: '5. 생산과 소비의 공간', standards: [
      { id: '[12한지05-01]', text: '자원의 의미와 특성을 파악하고 주요 자원의 분포와 이동을 분석한다.' },
      { id: '[12한지05-02]', text: '농업 구조의 변화와 농업 문제를 이해하고 해결 방안을 모색한다.' },
      { id: '[12한지05-03]', text: '공업의 발달과 구조 변화를 파악하고 공업 입지의 변화를 설명한다.' },
      { id: '[12한지05-04]', text: '서비스 산업의 성장과 교통·통신의 발달로 인한 변화를 파악한다.' },
    ]},
    { area: '6. 인구 변화와 다문화 공간', standards: [
      { id: '[12한지06-01]', text: '인구 분포의 특성과 인구 구조의 변화를 파악한다.' },
      { id: '[12한지06-02]', text: '인구 문제와 공간적 영향을 이해하고 대책을 모색한다.' },
      { id: '[12한지06-03]', text: '외국인 이주자 및 다문화 가정의 증가와 이에 따른 변화를 파악한다.' },
    ]},
    { area: '7. 우리나라의 지역 이해', standards: [
      { id: '[12한지07-01]', text: '지역의 의미와 지역 구분의 목적 및 방법을 이해한다.' },
      { id: '[12한지07-02]', text: '북한의 자연환경과 인문 환경의 특성을 이해하고 통일 국토의 미래상을 탐색한다.' },
      { id: '[12한지07-03]', text: '수도권의 특성과 문제점을 파악하고 해결 방안을 모색한다.' },
      { id: '[12한지07-04]', text: '강원·충청·호남·영남·제주 지역의 특성을 파악하고 각 지역의 주요 이슈를 분석한다.' },
    ]},
  ],
  '세계지리': [
    { area: '1. 세계화와 지역 이해', standards: [
      { id: '[12세지01-01]', text: '세계화가 공간적·경제적으로 미치는 영향을 파악한다.' },
      { id: '[12세지01-02]', text: '지리 정보와 공간 인식의 변화 과정을 이해한다.' },
      { id: '[12세지01-03]', text: '세계의 지역 구분과 각 지역의 특성을 파악한다.' },
    ]},
    { area: '2. 세계의 자연환경과 인간 생활', standards: [
      { id: '[12세지02-01]', text: '열대 기후의 특성과 열대 지역 주민 생활의 특징을 분석한다.' },
      { id: '[12세지02-02]', text: '온대 기후의 특성과 온대 지역 주민 생활의 특징을 분석한다.' },
      { id: '[12세지02-03]', text: '건조 및 냉·한대 기후의 특성과 주민 생활의 특징을 분석한다.' },
      { id: '[12세지02-04]', text: '세계의 주요 대지형의 분포와 형성 과정을 설명한다.' },
      { id: '[12세지02-05]', text: '독특한 지형과 그에 따른 주민 생활의 특징을 설명한다.' },
    ]},
    { area: '3. 세계의 인문 환경과 인문 경관', standards: [
      { id: '[12세지03-01]', text: '세계의 주요 종교의 전파와 종교 경관의 특징을 비교한다.' },
      { id: '[12세지03-02]', text: '세계 주요 문화 지역의 특징과 문화 변동을 이해한다.' },
      { id: '[12세지03-03]', text: '세계 주요 식량 자원과 에너지 자원의 생산과 소비 특성을 비교한다.' },
    ]},
    { area: '4. 몬순 아시아와 오세아니아', standards: [
      { id: '[12세지04-01]', text: '몬순 아시아와 오세아니아의 자연환경 특성을 분석한다.' },
      { id: '[12세지04-02]', text: '주요 국가의 산업 구조와 경제 성장의 특성을 비교한다.' },
      { id: '[12세지04-03]', text: '민족(인종)·종교적 차이에 의한 갈등과 해결 노력을 파악한다.' },
    ]},
    { area: '5. 건조 아시아와 북부 아프리카', standards: [
      { id: '[12세지05-01]', text: '건조 아시아와 북부 아프리카의 자연환경 특성을 분석한다.' },
      { id: '[12세지05-02]', text: '주요 자원의 분포와 이동, 자원을 둘러싼 갈등을 파악한다.' },
      { id: '[12세지05-03]', text: '사막화의 진행과 영향 및 지역 변화를 이해한다.' },
    ]},
    { area: '6. 유럽과 북부 아메리카', standards: [
      { id: '[12세지06-01]', text: '유럽과 북부 아메리카의 자연환경과 인문 환경의 특성을 비교한다.' },
      { id: '[12세지06-02]', text: '주요 공업 지역의 형성과 최근 변화를 분석한다.' },
      { id: '[12세지06-03]', text: '인구 이동과 다문화 사회의 특징 및 영향을 분석한다.' },
    ]},
    { area: '7. 사하라 이남 아프리카와 중·남부 아메리카', standards: [
      { id: '[12세지07-01]', text: '사하라 이남 아프리카와 중·남부 아메리카의 자연환경 특성을 비교한다.' },
      { id: '[12세지07-02]', text: '도시화에 따른 도시 구조의 특징과 변화를 파악한다.' },
      { id: '[12세지07-03]', text: '자원 개발과 환경 문제 및 지역 분쟁의 특성을 분석한다.' },
    ]},
    { area: '8. 평화와 공존의 세계', standards: [
      { id: '[12세지08-01]', text: '경제의 세계화에 따른 환경, 자원, 영토 등을 둘러싼 국제적 분쟁과 해결 과정을 분석한다.' },
      { id: '[12세지08-02]', text: '세계 평화와 정의를 위한 지구촌의 노력을 파악한다.' },
    ]},
  ],
  '통합사회': [
    { area: '1. 인간, 사회, 환경과 행복', standards: [
      { id: '[10통사01-01]', text: '시간적, 공간적, 사회적, 윤리적 관점의 특징을 이해하고 통합적 관점으로 탐구한다.' },
      { id: '[10통사01-02]', text: '사례를 통해 시대와 지역에 따라 다르게 나타나는 행복의 기준을 비교하여 평가한다.' },
      { id: '[10통사01-03]', text: '행복한 삶을 실현하기 위한 조건을 탐색하고 삶에 적용한다.' },
    ]},
    { area: '2. 자연환경과 인간', standards: [
      { id: '[10통사02-01]', text: '자연환경이 인간 생활에 미치는 영향을 분석하고 인간과 자연의 바람직한 관계를 모색한다.' },
      { id: '[10통사02-02]', text: '자연에 대한 인간의 다양한 관점을 사례를 통해 설명하고 윤리적 관점에서 평가한다.' },
      { id: '[10통사02-03]', text: '환경 문제 해결을 위한 정부, 시민사회, 기업 등의 다양한 노력을 조사하고 지속가능한 발전 방안을 모색한다.' },
    ]},
    { area: '3. 생활 공간과 사회', standards: [
      { id: '[10통사03-01]', text: '산업화, 도시화에 따른 생활 공간과 생활양식의 변화를 조사하고 평가한다.' },
      { id: '[10통사03-02]', text: '교통·통신의 발달과 정보화가 생활 공간과 생활양식에 미친 영향을 분석한다.' },
      { id: '[10통사03-03]', text: '공간 불평등 현상과 정의로운 지역 차이의 의미를 탐색한다.' },
    ]},
    { area: '4. 인권 보장과 헌법', standards: [
      { id: '[10통사04-01]', text: '근대 시민 혁명 등을 통해 확립되어 온 인권의 의미와 변화 양상을 이해한다.' },
      { id: '[10통사04-02]', text: '인권 보장을 위한 헌법의 역할을 탐색하고 기본권의 의미와 유형을 분석한다.' },
      { id: '[10통사04-03]', text: '사회적 소수자 차별, 청소년의 노동권 등 국내 인권 문제와 인권 지수를 통해 확인할 수 있는 세계 인권 문제의 양상을 조사하고 해결 방안을 제시한다.' },
    ]},
    { area: '5. 시장 경제와 금융', standards: [
      { id: '[10통사05-01]', text: '자본주의의 역사적 전개 과정과 그 특징을 조사하고 시장경제에서 합리적 선택의 의미를 탐색한다.' },
      { id: '[10통사05-02]', text: '시장에서의 수요와 공급에 영향을 미치는 요인을 분석하고 시장 균형의 의미를 이해한다.' },
      { id: '[10통사05-03]', text: '시장 경제의 한계와 이를 보완하기 위한 정부의 역할을 이해하고 평가한다.' },
      { id: '[10통사05-04]', text: '금융 생활의 중요성을 인식하고 금융 환경 변화에 맞는 합리적인 금융 생활을 위한 계획을 세운다.' },
    ]},
    { area: '6. 사회 정의와 불평등', standards: [
      { id: '[10통사06-01]', text: '정의의 의미와 실질적 기준을 탐색하고 다양한 정의관을 비교한다.' },
      { id: '[10통사06-02]', text: '다양한 불평등 양상을 조사하고 정의로운 사회를 위해 다양한 제도와 실천 방안을 탐색한다.' },
      { id: '[10통사06-03]', text: '사회 및 공간 불평등 현상의 사례를 조사하고 이에 대한 다양한 해결 방안을 탐색한다.' },
    ]},
    { area: '7. 문화와 다양성', standards: [
      { id: '[10통사07-01]', text: '자연환경과 인문 환경의 영향을 받아 형성된 다양한 문화권의 특징과 삶의 방식을 탐구한다.' },
      { id: '[10통사07-02]', text: '문화 변동의 다양한 양상을 이해하고 현대 사회에서 전통문화가 갖는 의의를 파악한다.' },
      { id: '[10통사07-03]', text: '문화적 차이에 대한 상대주의적 태도의 필요성을 이해하고 보편 윤리의 차원에서 자문화와 타문화를 성찰한다.' },
      { id: '[10통사07-04]', text: '다문화 사회에서 나타나는 갈등을 해결하기 위한 방안을 모색하고 문화적 다양성을 존중하는 태도를 갖는다.' },
    ]},
    { area: '8. 세계화와 평화', standards: [
      { id: '[10통사08-01]', text: '세계화의 양상을 다양한 측면에서 파악하고 세계화 시대에 나타나는 문제의 해결 방안을 탐색한다.' },
      { id: '[10통사08-02]', text: '국제 사회의 모습을 이해하고 국제 사회 행위 주체의 역할을 분석한다.' },
      { id: '[10통사08-03]', text: '남북 분단과 동아시아의 역사 갈등 상황을 분석하고 우리나라가 국제 사회의 평화에 기여할 수 있는 방안을 탐색한다.' },
    ]},
    { area: '9. 미래와 지속 가능한 삶', standards: [
      { id: '[10통사09-01]', text: '세계의 인구 분포와 구조 등의 변화를 파악하고 그에 따른 문제점과 대책을 제시한다.' },
      { id: '[10통사09-02]', text: '지구적 차원에서 사용 가능한 자원의 분포와 소비 실태를 파악하고 지속가능한 발전을 위한 개인적 노력과 제도적 방안을 탐색한다.' },
      { id: '[10통사09-03]', text: '미래 지구촌의 모습을 다양한 측면에서 예측하고 이를 대비하기 위한 노력과 방안을 제시한다.' },
    ]},
  ],
  '생활과윤리': [
    { area: '1. 현대의 삶과 실천윤리', standards: [
      { id: '[12생윤01-01]', text: '인간의 삶에서 나타나는 다양한 문제를 윤리적 관점에서 이해하고, 이를 학문으로서 다루는 윤리학의 성격과 특징을 설명할 수 있다.' },
      { id: '[12생윤01-02]', text: '현대의 윤리 문제를 다루는 새로운 접근법 및 동서양의 다양한 윤리 이론들을 비교·분석하고, 이를 다양한 윤리 문제에 적용하여 윤리적 해결 방안을 도출할 수 있다.' },
      { id: '[12생윤01-03]', text: '윤리적 삶을 살기 위한 다양한 도덕적 탐구와 윤리적 성찰 과정의 중요성을 인식하고, 도덕적 탐구와 윤리적 성찰을 일상의 윤리 문제에 적용할 수 있다.' },
    ]},
    { area: '2. 생명과 윤리', standards: [
      { id: '[12생윤02-01]', text: '삶과 죽음에 대한 다양한 윤리적 문제를 인식하고, 이에 대한 여러 윤리적 입장을 비교·분석하여 인공임신중절, 자살, 안락사, 뇌사의 문제를 설명할 수 있다.' },
      { id: '[12생윤02-02]', text: '생명의 존엄성에 대한 여러 윤리적 관점을 비교·분석하고, 생명 복제, 유전자 치료, 동물의 권리 문제를 윤리적 관점에서 설명하며 자신의 관점을 정당화할 수 있다.' },
      { id: '[12생윤02-03]', text: '사랑과 성의 의미를 양성 평등의 관점에서 분석하고, 성과 관련된 문제를 여러 윤리 이론을 통해 설명할 수 있으며 가족윤리의 관점에서 가족 해체 현상을 탐구할 수 있다.' },
    ]},
    { area: '3. 사회와 윤리', standards: [
      { id: '[12생윤03-01]', text: '직업의 의의를 행복의 관점에서 이해하고, 다양한 직업군에 따른 직업윤리를 제시할 수 있으며 공동체 발전을 위한 청렴한 삶의 필요성을 설명할 수 있다.' },
      { id: '[12생윤03-02]', text: '공정한 분배를 이룰 수 있는 방안으로서 우대 정책과 역차별 문제를 분배 정의 이론을 통해 평가하고, 사형 제도를 교정적 정의의 관점에서 논할 수 있다.' },
      { id: '[12생윤03-03]', text: '국가의 권위와 의무, 시민의 권리와 의무를 동서양의 다양한 관점에서 설명하고, 민주시민의 자세인 참여의 필요성을 제시할 수 있다.' },
    ]},
    { area: '4. 과학과 윤리', standards: [
      { id: '[12생윤04-01]', text: '과학 기술 연구에 대한 다양한 관점을 조사하여 비교·설명할 수 있으며 과학 기술의 사회적 책임 문제에 적용할 수 있다.' },
      { id: '[12생윤04-02]', text: '정보기술과 매체의 발달에 따른 윤리적 문제들을 제시할 수 있으며 이에 대한 해결 방안을 정보윤리와 매체윤리의 관점에서 제시할 수 있다.' },
      { id: '[12생윤04-03]', text: '자연을 바라보는 동서양의 관점을 비교·설명할 수 있으며 환경 문제의 사례와 심각성을 조사하고 해결 방안을 제시할 수 있다.' },
    ]},
    { area: '5. 문화와 윤리', standards: [
      { id: '[12생윤05-01]', text: '미적 가치와 윤리적 가치를 예술과 윤리의 관계 차원에서 설명할 수 있으며 대중문화의 문제점을 윤리적으로 비판할 수 있다.' },
      { id: '[12생윤05-02]', text: '의식주 생활과 관련된 윤리적 문제들을 제시하고 윤리적으로 평가하며 윤리적 소비 실천의 필요성을 설명할 수 있다.' },
      { id: '[12생윤05-03]', text: '문화의 다양성을 존중해야 하는 이유를 다문화 이론의 관점에서 설명하고, 종교 갈등을 극복하기 위한 방안을 제시할 수 있다.' },
    ]},
    { area: '6. 평화와 공존의 윤리', standards: [
      { id: '[12생윤06-01]', text: '사회에서 일어나는 다양한 갈등의 양상을 제시하고, 사회 통합을 위한 구체적인 방안을 제안하며 담론윤리의 관점에서 소통 행위를 설명할 수 있다.' },
      { id: '[12생윤06-02]', text: '통일 문제를 둘러싼 다양한 쟁점들을 이해하고, 각 쟁점에 대한 자신의 관점을 설명하며 남북한 화해를 위한 노력을 제시할 수 있다.' },
      { id: '[12생윤06-03]', text: '국제 사회의 분쟁들과 국가 간 빈부격차 문제를 윤리적 관점에서 설명하고, 국제 사회에 대한 책임 문제를 정당화하며 실천 방안을 제시할 수 있다.' },
    ]},
  ],
  '윤리와사상': [
    { area: '1. 인간과 윤리사상', standards: [
      { id: '[12윤사01-01]', text: '인간에 대한 다양한 관점을 비교하고, 우리의 삶에서 윤리사상과 사회사상이 필요한 이유를 탐구할 수 있다.' },
      { id: '[12윤사01-02]', text: '우리의 도덕적 삶에서 한국 및 동·서양의 윤리사상과 사회사상이 하는 역할에 대한 실제적인 사례들을 탐구하고, 윤리사상과 사회사상의 관계를 토론할 수 있다.' },
    ]},
    { area: '2. 동양과 한국윤리사상', standards: [
      { id: '[12윤사02-01]', text: '동양과 한국의 연원적 윤리사상들을 탐구하고, 이를 인간의 행복 및 사회적 질서와 관련시켜 토론할 수 있다.' },
      { id: '[12윤사02-02]', text: '선진유학의 전개 과정을 설명하고 도덕 성립의 근거로서 성리학과 양명학의 도덕법칙 탐구 방법을 비교할 수 있다.' },
      { id: '[12윤사02-03]', text: '이황과 이이의 심성론과 수양론을 비교하고, 정약용의 사상을 통해 조선 성리학의 전개 과정과 특징을 분석할 수 있다.' },
      { id: '[12윤사02-04]', text: '초기불교의 가르침과 대승불교의 중관·유식사상을 이해하고, 교종과 선종의 깨달음에 이르는 방법을 비교할 수 있다.' },
      { id: '[12윤사02-05]', text: '한국불교의 주요 사상들을 이해하고, 이를 통해 한국불교의 윤리적 특징과 현대적 의의를 설명할 수 있다.' },
      { id: '[12윤사02-06]', text: '노자와 장자의 사상을 핵심 개념을 중심으로 설명하고, 도교의 성립과 도가·도교 사상이 한국 전통문화에 미친 영향을 파악할 수 있다.' },
      { id: '[12윤사02-07]', text: '근대 격변기에 나타난 한국 전통윤리사상의 대응 노력과 동양의 이상적 인간상의 현대적 의의를 탐구할 수 있다.' },
    ]},
    { area: '3. 서양윤리사상', standards: [
      { id: '[12윤사03-01]', text: '고대 그리스 사상과 헤브라이즘의 특징을 서양윤리사상의 연원으로서 이해하고, 소피스트와 소크라테스의 윤리사상을 비교할 수 있다.' },
      { id: '[12윤사03-02]', text: '플라톤의 영혼의 정의와 아리스토텔레스의 탁월성 강조를 이해하고, 양자의 관점을 비교할 수 있다.' },
      { id: '[12윤사03-03]', text: '행복에 이를 수 있는 방법으로서 쾌락의 추구와 금욕의 삶을 강조하는 윤리적 입장을 비교할 수 있다.' },
      { id: '[12윤사03-04]', text: '그리스도교 윤리사상의 특징을 탐구하고, 고대 그리스 사상과 결합하여 발전한 자연법 윤리사상을 이해할 수 있다.' },
      { id: '[12윤사03-05]', text: '도덕적 판단과 행동에서 이성과 감정의 역할을 규명하려는 노력을 탐구할 수 있다.' },
      { id: '[12윤사03-06]', text: '의무론과 칸트의 정언명령, 결과론과 공리주의의 장점과 문제점을 비교할 수 있다.' },
      { id: '[12윤사03-07]', text: '현대의 실존주의, 실용주의가 주장하는 윤리적 입장들을 이해하고, 도덕적 삶에 기여하는 바를 설명할 수 있다.' },
    ]},
    { area: '4. 사회사상', standards: [
      { id: '[12윤사04-01]', text: '동·서양의 이상사회론을 비교하여 그 현대 사회에 주는 시사점을 탐구할 수 있다.' },
      { id: '[12윤사04-02]', text: '국가의 개념과 존재 근거에 대한 주요 사상가들의 주장과 다양한 국가관을 비교할 수 있다.' },
      { id: '[12윤사04-03]', text: '자유주의와 공화주의의 개인·공동체·권리·자유에 대한 관점을 비교할 수 있다.' },
      { id: '[12윤사04-04]', text: '민주주의의 사상적 기원과 참여민주주의·심의민주주의 등 현대 민주주의 사상의 특징을 탐구할 수 있다.' },
      { id: '[12윤사04-05]', text: '자본주의의 규범적 특징과 기여 및 이에 대한 비판들을 조사하고, 인간의 존엄과 품격을 보장하는 자본주의 사회로의 발전 방향을 탐구할 수 있다.' },
      { id: '[12윤사04-06]', text: '동·서양의 평화사상들을 탐구하여 세계시민주의와 세계시민윤리의 원칙 및 지향을 이해할 수 있다.' },
    ]},
  ],
};

const ALL_SUBJECTS = ['한국지리', '세계지리', '통합사회', '생활과윤리', '윤리와사상'];

// ── CLI ──
const subjectArg = process.argv[2] || '한국지리';
const concurrency = parseInt(process.argv[3]) || 10;
const subjects = subjectArg === 'all' ? ALL_SUBJECTS : [subjectArg];

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY 환경변수를 설정하세요.');
  process.exit(1);
}

const client = new Anthropic({ apiKey });
const MODEL = 'claude-haiku-4-5-20251001';
let fatalError = false;

// ── 대단원 기반 후보 축소 ──
function getCandidateStandards(subject, item) {
  const standards = ACHIEVEMENT_STANDARDS[subject];
  if (!standards) return null;

  const chapterMatch = item.대단원 ? item.대단원.match(/^(\d+)\./) : null;
  const chapterNum = chapterMatch ? parseInt(chapterMatch[1]) : null;

  if (chapterNum) {
    const area = standards.find(a => {
      const m = a.area.match(/^(\d+)\./);
      return m && parseInt(m[1]) === chapterNum;
    });
    if (area) return area;
  }
  return null; // 전체 후보 사용
}

// ── Claude API 호출 (텍스트만) ──
async function inferStandard(subject, item) {
  const standards = ACHIEVEMENT_STANDARDS[subject];
  if (!standards) return null;

  const candidateArea = getCandidateStandards(subject, item);

  let standardsPrompt;
  if (candidateArea) {
    standardsPrompt = `[후보 - ${candidateArea.area}]\n` +
      candidateArea.standards.map(s => `${s.id}: ${s.text}`).join('\n');
  } else {
    standardsPrompt = '[전체 후보]\n' +
      standards.map(a => a.standards.map(s => `${s.id}: ${s.text}`).join('\n')).join('\n');
  }

  const balm = (item.발문 || '').slice(0, 150);
  const content = (item.문항내용 || '').slice(0, 400);

  const prompt = `한국 수능/모의고사 문제의 성취기준을 판단하세요.
과목: ${subject}, 대단원: ${item.대단원 || '(미상)'}
발문: ${balm || '(없음)'}
내용: ${content || '(없음)'}

${standardsPrompt}

위 후보 중 가장 적합한 성취기준 ID 하나만 답하세요. JSON 형식:
{"성취기준":"[ID]"}`;

  let retries = 0;
  while (retries <= 3) {
    try {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 64,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = res.content[0].text.trim();
      const match = text.match(/\{[\s\S]*?\}/);
      if (!match) return null;
      const parsed = JSON.parse(match[0]);
      return parsed.성취기준 || null;
    } catch (err) {
      if ((err.status === 429 || err.status === 529) && retries < 3) {
        const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
        await new Promise(r => setTimeout(r, delay));
        retries++;
        continue;
      }
      if (err.status === 400 && err.message && err.message.includes('credit balance')) {
        console.error(`\n  ✖ API 크레딧 부족! https://console.anthropic.com/settings/billing`);
        fatalError = true;
        return null;
      }
      console.error(`  API 에러 (${item.학년도} ${item.분류} ${item.번호}번):`, err.message);
      return null;
    }
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Progress ──
function progressPath(subject) {
  return join(ROOT, `.standards-progress-${subject}.json`);
}

async function loadProgress(subject) {
  const p = progressPath(subject);
  if (existsSync(p)) return JSON.parse(await readFile(p, 'utf8'));
  return {};
}

async function saveProgress(subject, progress) {
  await writeFile(progressPath(subject), JSON.stringify(progress, null, 2), 'utf8');
}

// ── 동시 실행 ──
async function runWithConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length && !fatalError) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

// ── 과목 처리 ──
async function processSubject(subject) {
  const dataPath = join(ROOT, 'public', 'data', `${subject}.json`);
  if (!existsSync(dataPath)) {
    console.log(`  ⚠ ${subject}: 데이터 없음`);
    return;
  }

  const data = JSON.parse(await readFile(dataPath, 'utf8'));
  const progress = await loadProgress(subject);

  const items = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    // 성취기준이 이미 올바른 형태면 건너뜀 (예: [12한지01-01])
    if (item.성취기준 && /^\[[\d\w가-힣]+-\d+\]$/.test(item.성취기준)) continue;

    const key = `${item.학년도}_${item.분류}_${item.번호}`;
    if (progress[key]) {
      item.성취기준 = progress[key];
      data[i] = item;
      continue;
    }

    // 발문이나 문항내용이 있어야 추론 가능
    if (!item.발문 && !item.문항내용) continue;

    items.push({ index: i, item, key });
  }

  console.log(`  ${subject}: 총 ${data.length}개, 추론 대상 ${items.length}개 (이미 완료: ${Object.keys(progress).length}개)`);

  if (items.length === 0) {
    await writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8');
    return;
  }

  let processed = 0;
  let succeeded = 0;

  const tasks = items.map(({ index, item, key }) => async () => {
    const std = await inferStandard(subject, item);
    processed++;

    if (std) {
      item.성취기준 = std;
      data[index] = item;
      progress[key] = std;
      succeeded++;
    }

    if (processed % 50 === 0 || processed === items.length) {
      console.log(`    [${processed}/${items.length}] 성공: ${succeeded}`);
      await saveProgress(subject, progress);
    }
  });

  await runWithConcurrency(tasks, concurrency);
  await saveProgress(subject, progress);
  await writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8');

  console.log(`  ✓ ${subject} 완료: ${succeeded}/${items.length} 성취기준 매핑`);
}

// ── Main ──
async function main() {
  console.log(`\n=== 성취기준 추론 (Phase 2 - 텍스트 전용, ~$3) ===`);
  console.log(`대상: ${subjects.join(', ')}, 동시 요청: ${concurrency}개\n`);

  for (const subject of subjects) {
    if (fatalError) break;
    await processSubject(subject);
    console.log();
  }

  if (fatalError) {
    console.log('⚠ 크레딧 부족으로 중단됨. 충전 후 다시 실행하면 이어서 처리합니다.\n');
  } else {
    console.log('=== 전체 완료 ===\n');
  }
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
