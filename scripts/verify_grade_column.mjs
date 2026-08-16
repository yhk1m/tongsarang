// 학년 구분(통합사회 고1/고2)과 2026 시행분 추가에 대한 회귀 검증
// 실행: node scripts/verify_grade_column.mjs  (프로젝트 루트에서)
import { keyOf, questionKey, imageFileNameOf, findQuestion, GRADED_SUBJECTS } from '../src/core/questionKey.js';
import { FilterManager } from '../src/core/FilterManager.js';
import { DataManager } from '../src/core/DataManager.js';
import fs from 'fs';

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`}`);
};

const g1 = { 학년도: '2026', 학년: '고1', 분류: '3월', 번호: '1' };
const g2 = { 학년도: '2026', 학년: '고2', 분류: '3월', 번호: '1' };
const plain = { 학년도: '2027', 학년: '', 분류: '6모', 번호: '1' };

// 1. 키: 고1/기존 데이터는 예전 형식 그대로, 고2만 세그먼트 추가
eq('고1 키는 기존 형식 유지', questionKey(g1), '2026_3월_1');
eq('고2 키는 학년 세그먼트 포함', questionKey(g2), '2026_3월_고2_1');
eq('학년 없는 과목도 기존 형식', questionKey(plain), '2027_6모_1');
eq('고1/고2 키 충돌 없음', questionKey(g1) !== questionKey(g2), true);
eq('keyOf 와 questionKey 일치', keyOf('2026', '3월', '1', '고2'), questionKey(g2));

// 2. 이미지 파일명: 고2만 iss2
eq('고1 이미지 코드는 iss', imageFileNameOf('통합사회', g1), '2026_03_iss_01');
eq('고2 이미지 코드는 iss2', imageFileNameOf('통합사회', g2), '2026_03_iss2_01');
eq('2027 6모 이미지', imageFileNameOf('한국지리', plain), '2027_06_korgeo_01');

// 3. findQuestion 이 학년으로 구분하는지
const data = [g1, g2];
eq('findQuestion 고1', findQuestion(data, '2026', '3월', '1', '고1'), g1);
eq('findQuestion 고2', findQuestion(data, '2026', '3월', '1', '고2'), g2);

// 4. 실제 데이터로 필터 검증
const iss = JSON.parse(fs.readFileSync('./public/data/통합사회.json', 'utf8'));
const fm = new FilterManager();
const only2 = fm.applyFilters(iss, { 학년: '고2' }, null, '통합사회');
const only1 = fm.applyFilters(iss, { 학년: '고1' }, null, '통합사회');
eq('학년 필터 고2 = 50문항', only2.length, 50);
eq('학년 필터 고1 = 705문항', only1.length, 705);
eq('학년 + 분류 조합', fm.applyFilters(iss, { 학년: '고2', 분류: '3월' }, null, '통합사회').length, 25);
eq('학년 미지정이면 전체', fm.applyFilters(iss, {}, null, '통합사회').length, iss.length);

// 5. 정렬: 학년(문자) / 정답률(숫자)
fm.toggleSort('학년');
const sortedAsc = fm.applySorting(iss);
eq('학년 오름차순 첫 행', sortedAsc[0].학년, '고1');
eq('학년 오름차순 끝 행', sortedAsc[sortedAsc.length - 1].학년, '고2');
fm.toggleSort('학년');
eq('학년 내림차순 첫 행', fm.applySorting(iss)[0].학년, '고2');

fm.resetSort();
fm.toggleSort('정답률');
// 정답률이 빈 행(기존 15건)은 기존 동작대로 -1로 취급된다
const rateAsc = fm.applySorting(iss).map(r => (isNaN(parseFloat(r.정답률)) ? -1 : parseFloat(r.정답률)));
eq('정답률 오름차순 유지', rateAsc.every((v, i) => i === 0 || rateAsc[i - 1] <= v), true);
eq('정답률 빈 행이 맨 앞', rateAsc.slice(0, 15).every(v => v === -1), true);
fm.toggleSort('정답률');
const rateDesc = fm.applySorting(iss).map(r => (isNaN(parseFloat(r.정답률)) ? -1 : parseFloat(r.정답률)));
eq('정답률 내림차순 유지', rateDesc.every((v, i) => i === 0 || rateDesc[i - 1] >= v), true);

// 6. 필터 옵션에 학년이 포함되는지
const dm = new DataManager();
eq('필터 옵션 학년', dm.getFilterOptions(iss, null, '통합사회').학년, ['고1', '고2']);
eq('학년 구분 과목은 통합사회뿐', [...GRADED_SUBJECTS], ['통합사회']);

// 7. 신규 학년도 라벨이 필터 옵션에 뜨는지
const kor = JSON.parse(fs.readFileSync('./public/data/한국지리.json', 'utf8'));
const opts = dm.getFilterOptions(kor, null, '한국지리');
eq('한국지리 학년도에 2027 포함', opts.학년도.slice(0, 2), ['2027', '2026']);
eq('한국지리 분류에 신규 학평 포함', ['3월학평', '5월학평', '7월학평', '6모'].every(c => opts.분류.includes(c)), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
