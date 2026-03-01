const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// 먼저 2019 수능으로 테스트: 여러 과목코드 시도
const examSeq = 244; // 2019 수능 = examSeq 244 (2018.11 수능)
const testCodes = ['4121', '4120', '4119', '4122', '4123', '4124', '4125'];

function fetchRaw(examSeq, subCd) {
  try {
    const tmpDir = path.join(os.tmpdir(), 'mega');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `test_${subCd}_${examSeq}.bin`);
    execSync(`curl -s -X POST "https://www.megastudy.net/Entinfo/correctRate/main_rate_ax.asp" -d "grdFlg=3&examSeq=${examSeq}&tabNo=5&selSubCd=${subCd}" --output "${tmpFile}"`, { timeout: 15000 });
    const html = new TextDecoder('euc-kr').decode(fs.readFileSync(tmpFile));
    // 과목명 찾기
    const nameMatch = html.match(/<option[^>]*selected[^>]*>(.*?)<\/option>/);
    const hasData = html.includes('<td class="two">');
    const subjectNames = [];
    const optRe = /<option[^>]*value="(\d+)"[^>]*>(.*?)<\/option>/g;
    let m;
    while ((m = optRe.exec(html)) !== null) subjectNames.push({ code: m[1], name: m[2] });
    return { hasData, selectedName: nameMatch ? nameMatch[1] : null, subjects: subjectNames, htmlLen: html.length };
  } catch (e) { return { error: e.message }; }
}

console.log(`=== 2019 수능 (examSeq=${examSeq}) 과목코드 테스트 ===\n`);

// 먼저 subCd=4121 (정치와법)로 시도
for (const code of testCodes) {
  const result = fetchRaw(examSeq, code);
  if (result.error) { console.log(`subCd=${code}: 에러 - ${result.error}`); continue; }
  console.log(`subCd=${code}: data=${result.hasData}, selected=${result.selectedName}, htmlLen=${result.htmlLen}`);
  if (result.subjects.length > 0 && result.subjects.length < 15) {
    console.log(`  과목 목록: ${result.subjects.map(s => s.code + '=' + s.name).join(', ')}`);
  }
  if (result.hasData) break;
}

// tabNo=5에서 과목 목록 확인 (selSubCd 없이)
console.log('\n=== selSubCd 없이 과목 목록 확인 ===');
const result2 = fetchRaw(examSeq, '');
if (result2.subjects.length > 0) {
  console.log('과목 목록:');
  result2.subjects.forEach(s => console.log(`  ${s.code} = ${s.name}`));
}
