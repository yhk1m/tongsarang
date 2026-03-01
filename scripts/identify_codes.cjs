const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const examSeq = 349; // 2026 수능
const unknownCodes = [4107, 4113, 4116];

for (const code of unknownCodes) {
  try {
    const tmpDir = path.join(os.tmpdir(), 'mega');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `id_${code}.bin`);
    execSync(`curl -s -X POST "https://www.megastudy.net/Entinfo/correctRate/main_rate_ax.asp" -d "grdFlg=3&examSeq=${examSeq}&tabNo=5&selSubCd=${code}" --output "${tmpFile}"`, { timeout: 15000 });
    const html = new TextDecoder('euc-kr').decode(fs.readFileSync(tmpFile));

    // 과목명 추출 시도
    const optRe = /<option[^>]*value="(\d+)"[^>]*>(.*?)<\/option>/g;
    let m;
    const opts = [];
    while ((m = optRe.exec(html)) !== null) opts.push({ code: m[1], name: m[2] });

    // 데이터 첫 줄 추출
    const values = [];
    const re = /<td class="two">(.*?)<\/td>/g;
    while ((m = re.exec(html)) !== null) values.push(m[1].trim());

    // 선택된 과목 찾기
    const selMatch = html.match(/<option[^>]*value="(\d+)"[^>]*selected[^>]*>(.*?)<\/option>/);

    console.log(`\nCode ${code}:`);
    if (selMatch) console.log(`  Selected: ${selMatch[2]} (${selMatch[1]})`);
    if (opts.length > 0) {
      console.log(`  All options: ${opts.map(o => o.code + '=' + o.name).join(', ')}`);
    }
    console.log(`  Data values (first 10): ${values.slice(0, 10).join(', ')}`);

    // HTML에서 과목명 힌트 찾기
    const titleMatch = html.match(/과목[^<]*<[^>]*>([^<]+)/);
    if (titleMatch) console.log(`  Title hint: ${titleMatch[1]}`);

    // 더 넓은 범위 검색
    const allText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const keywords = ['한국사', '동아시아', '세계사', '역사'];
    keywords.forEach(kw => {
      const idx = allText.indexOf(kw);
      if (idx >= 0) console.log(`  Found "${kw}" at pos ${idx}: ...${allText.substring(Math.max(0,idx-20), idx+30)}...`);
    });
  } catch (e) {
    console.log(`Code ${code}: error - ${e.message}`);
  }
}

// 한국사는 필수과목이라 tabNo가 다를 수 있음. tabNo=3 또는 다른 값 시도
console.log('\n=== 한국사 별도 탭 탐색 ===');
for (const tabNo of [1, 2, 3, 4, 6]) {
  for (const grdFlg of [3, 1]) {
    try {
      const tmpDir = path.join(os.tmpdir(), 'mega');
      const tmpFile = path.join(tmpDir, `tab_${tabNo}_${grdFlg}.bin`);
      execSync(`curl -s -X POST "https://www.megastudy.net/Entinfo/correctRate/main_rate_ax.asp" -d "grdFlg=${grdFlg}&examSeq=${examSeq}&tabNo=${tabNo}&selSubCd=" --output "${tmpFile}"`, { timeout: 10000 });
      const html = new TextDecoder('euc-kr').decode(fs.readFileSync(tmpFile));
      const hasData = html.includes('<td class="two">');

      const allText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      const hasHistory = allText.includes('한국사') || allText.includes('역사');

      if (hasData || hasHistory) {
        console.log(`  tabNo=${tabNo}, grdFlg=${grdFlg}: data=${hasData}, hasHistory=${hasHistory}`);
        // 과목 옵션 출력
        const optRe = /<option[^>]*value="(\d+)"[^>]*>(.*?)<\/option>/g;
        let m;
        while ((m = optRe.exec(html)) !== null) {
          console.log(`    ${m[1]} = ${m[2]}`);
        }
      }
    } catch {}
  }
}
