import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const XLSX_PATH = join(ROOT, 'data', '지리 기출문제 현황.xlsx');
const OUTPUT_DIR = join(ROOT, 'public', 'data');
const IMAGES_DIR = join(ROOT, 'public', 'images');

// 과목 목록 (시트 이름과 매핑)
const SUBJECTS = [
  '한국지리', '세계지리', '통합사회', '한국사',
  '정치와법', '경제', '사회문화', '생활과윤리',
  '윤리와사상', '동아시아사', '세계사'
];

// 과목 → 이미지 코드 매핑
const SUBJECT_CODE = {
  '한국지리': 'korgeo',
  '세계지리': 'wgeo',
  '통합사회': 'iss'
};

// 월 → 분류 매핑
const MONTH_TO_CATEGORY = {
  '03': '3월학평',
  '04': '4월학평',
  '05': '5월학평',
  '06': '6모',
  '07': '7월학평',
  '09': '9모',
  '10': '10월학평',
  '11': '수능'
};

// 이미지 폴더에서 시험 정보 스캔
async function scanImageEntries(subject) {
  const code = SUBJECT_CODE[subject];
  if (!code) return [];

  const imgDir = join(IMAGES_DIR, subject);
  if (!existsSync(imgDir)) return [];

  const files = await readdir(imgDir);
  // 파일명 패턴: YYYY_MM_code_NN.png
  const regex = new RegExp(`^(\\d{4})_(\\d{2})_${code}_(\\d{2})\\.(png|jpg)$`);

  const entries = [];
  for (const f of files) {
    const m = f.match(regex);
    if (!m) continue;
    const [, year, month, num] = m;
    const category = MONTH_TO_CATEGORY[month];
    if (!category) continue;
    entries.push({
      학년도: year,
      분류: category,
      번호: String(parseInt(num, 10)) // "01" → "1"
    });
  }

  return entries;
}

async function convert() {
  // 출력 디렉토리 생성
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  // Excel 파일 읽기
  const buf = await readFile(XLSX_PATH);
  const workbook = XLSX.read(buf, { type: 'buffer' });

  console.log('시트 목록:', workbook.SheetNames);

  let converted = 0;

  for (const subject of SUBJECTS) {
    // 시트 이름에서 정확히 일치하거나 포함하는 것 찾기
    const sheetName = workbook.SheetNames.find(
      name => name === subject || name.trim() === subject
    );

    let data = [];

    if (sheetName) {
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      // 데이터 정규화: 헤더 이름 통일
      data = rawData
        .filter(row => row['대단원'] || row['배점'])
        .map((row, idx) => ({
          순번: row['순번'] || idx + 1,
          학년도: String(row['학년도'] || '').replace(/\.0$/, ''),
          분류: String(row['분류'] || ''),
          번호: String(row['번호'] || '').replace(/\.0$/, ''),
          배점: String(row['배점'] || '').replace(/\.0$/, ''),
          답: String(row['답'] || '').replace(/\.0$/, ''),
          대단원: String(row['대단원'] || ''),
          중단원: String(row['중단원'] || ''),
          발문: String(row['발문'] || ''),
          문항내용: String(row['문항 내용'] || row['문항내용'] || ''),
          정답률: row['정답률(%)'] !== '' && row['정답률(%)'] !== undefined
            ? String(row['정답률(%)'])
            : '',
          난이도: String(row['난이도'] || ''),
          GeoTester: String(row['GeoTester'] || '')
        }));
    }

    // 이미지 폴더 스캔하여 Excel에 없는 문항 추가
    const imageEntries = await scanImageEntries(subject);
    const existingKeys = new Set(
      data.map(d => `${d.학년도}_${d.분류}_${d.번호}`)
    );

    let added = 0;
    const nextSeq = data.length > 0
      ? Math.max(...data.map(d => typeof d.순번 === 'number' ? d.순번 : parseInt(d.순번) || 0)) + 1
      : 1;

    for (const entry of imageEntries) {
      const key = `${entry.학년도}_${entry.분류}_${entry.번호}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);

      data.push({
        순번: nextSeq + added,
        학년도: entry.학년도,
        분류: entry.분류,
        번호: entry.번호,
        배점: '',
        답: '',
        대단원: '',
        중단원: '',
        발문: '',
        문항내용: '',
        정답률: '',
        난이도: '',
        GeoTester: ''
      });
      added++;
    }

    // 정렬: 학년도 내림차순 → 분류 → 번호 오름차순
    const catOrder = { '수능': 0, '9모': 1, '6모': 2, '10월학평': 3, '7월학평': 4, '5월학평': 5, '4월학평': 6, '3월학평': 7 };
    data.sort((a, b) => {
      const yDiff = Number(b.학년도) - Number(a.학년도);
      if (yDiff !== 0) return yDiff;
      const cDiff = (catOrder[a.분류] ?? 99) - (catOrder[b.분류] ?? 99);
      if (cDiff !== 0) return cDiff;
      return Number(a.번호) - Number(b.번호);
    });

    // 순번 재부여
    data.forEach((d, i) => d.순번 = i + 1);

    const outPath = join(OUTPUT_DIR, `${subject}.json`);
    await writeFile(outPath, JSON.stringify(data, null, 2), 'utf-8');

    if (added > 0) {
      console.log(`✓ ${subject}: Excel ${data.length - added}문항 + 이미지 ${added}문항 = ${data.length}문항`);
    } else if (data.length > 0) {
      console.log(`✓ ${subject}: ${data.length}문항`);
    } else {
      console.log(`⚠ ${subject}: 데이터 없음 → 빈 배열`);
    }
    converted++;
  }

  console.log(`\n완료: ${converted}개 과목 처리됨`);
}

convert().catch(err => {
  console.error('변환 실패:', err);
  process.exit(1);
});
