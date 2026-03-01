const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// 2026 수능 examSeq로 사회탐구 과목 목록 확인
const examSeq = 349; // 2026 수능

function fetchSubjectList(examSeq, tabNo, grdFlg) {
  try {
    const tmpDir = path.join(os.tmpdir(), 'mega');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `discover_${tabNo}_${grdFlg}.bin`);
    execSync(`curl -s -X POST "https://www.megastudy.net/Entinfo/correctRate/main_rate_ax.asp" -d "grdFlg=${grdFlg}&examSeq=${examSeq}&tabNo=${tabNo}&selSubCd=" --output "${tmpFile}"`, { timeout: 15000 });
    const html = new TextDecoder('euc-kr').decode(fs.readFileSync(tmpFile));
    const subjects = [];
    const optRe = /<option[^>]*value="(\d+)"[^>]*>(.*?)<\/option>/g;
    let m;
    while ((m = optRe.exec(html)) !== null) subjects.push({ code: m[1], name: m[2] });
    return subjects;
  } catch (e) { return []; }
}

// tabNo 1~8, grdFlg 1~3 조합으로 과목 목록 확인
console.log('=== 메가스터디 과목코드 탐색 ===\n');

for (const grdFlg of [3, 1, 2]) {
  for (const tabNo of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const subjects = fetchSubjectList(examSeq, tabNo, grdFlg);
    if (subjects.length > 0) {
      console.log(`grdFlg=${grdFlg}, tabNo=${tabNo}:`);
      subjects.forEach(s => {
        const marker = ['한국사', '동아시아사', '세계사'].some(n => s.name.includes(n)) ? ' ★' : '';
        console.log(`  ${s.code} = ${s.name}${marker}`);
      });
      console.log();
    }
  }
}

// 직접 코드 범위 테스트 (4100~4130)
console.log('=== 직접 코드 테스트 (tabNo=5, grdFlg=3) ===\n');
for (let code = 4100; code <= 4130; code++) {
  try {
    const tmpDir = path.join(os.tmpdir(), 'mega');
    const tmpFile = path.join(tmpDir, `test_${code}.bin`);
    execSync(`curl -s -X POST "https://www.megastudy.net/Entinfo/correctRate/main_rate_ax.asp" -d "grdFlg=3&examSeq=${examSeq}&tabNo=5&selSubCd=${code}" --output "${tmpFile}"`, { timeout: 10000 });
    const html = new TextDecoder('euc-kr').decode(fs.readFileSync(tmpFile));
    const hasData = html.includes('<td class="two">');
    const nameMatch = html.match(/<option[^>]*selected[^>]*>(.*?)<\/option>/);
    if (hasData || (nameMatch && nameMatch[1])) {
      console.log(`  ${code}: data=${hasData}, selected=${nameMatch ? nameMatch[1] : 'N/A'}`);
    }
  } catch {}
}
