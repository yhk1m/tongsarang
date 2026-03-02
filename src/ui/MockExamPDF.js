import { jsPDF } from 'jspdf';

// ── 한글 폰트 캐시 ──
let _fontCache = null;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunks = [];
  for (let i = 0; i < bytes.length; i += 0x8000) {
    chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)));
  }
  return btoa(chunks.join(''));
}

async function loadFontData() {
  if (_fontCache) return _fontCache;
  const baseUrl = import.meta.env.BASE_URL;
  const [regularResp, boldResp] = await Promise.all([
    fetch(`${baseUrl}fonts/NanumGothic-Regular.ttf`),
    fetch(`${baseUrl}fonts/NanumGothic-Bold.ttf`)
  ]);
  const [regularBuf, boldBuf] = await Promise.all([
    regularResp.arrayBuffer(),
    boldResp.arrayBuffer()
  ]);
  _fontCache = {
    regular: arrayBufferToBase64(regularBuf),
    bold: arrayBufferToBase64(boldBuf)
  };
  return _fontCache;
}

function registerFont(doc, fontData) {
  doc.addFileToVFS('NanumGothic-Regular.ttf', fontData.regular);
  doc.addFont('NanumGothic-Regular.ttf', 'NanumGothic', 'normal');
  doc.addFileToVFS('NanumGothic-Bold.ttf', fontData.bold);
  doc.addFont('NanumGothic-Bold.ttf', 'NanumGothic', 'bold');
}

// 과목 → 이미지 코드 매핑 (ImageModal과 동일)
const SUBJECT_CODE = {
  '한국지리': 'korgeo',
  '세계지리': 'wgeo',
  '통합사회': 'iss',
  '한국사': 'korhis',
  '정치와법': 'pollaw',
  '경제': 'econ',
  '사회문화': 'socul',
  '생활과윤리': 'leth',
  '윤리와사상': 'ethth',
  '동아시아사': 'eahis',
  '세계사': 'worhis'
};

const CATEGORY_TO_MONTH = {
  '수능': '11', '9모': '09', '6모': '06',
  '10월학평': '10', '7월학평': '07', '5월학평': '05', '4월학평': '04', '3월학평': '03',
  '11월': '11', '10월': '10', '9월': '09', '7월': '07',
  '6월': '06', '5월': '05', '4월': '04', '3월': '03'
};

// A4 layout constants (mm)
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const COL_GAP = 5;
const COL_W = (PAGE_W - MARGIN * 2 - COL_GAP) / 2; // ~87.5mm
const HEADER_H = 12;
const USABLE_H = PAGE_H - MARGIN * 2 - HEADER_H;

/** timestamp for filenames: YYYYMMDD_HHmm */
function fileTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** subject label for filenames */
function subjectLabel(questions) {
  const subjects = [...new Set(questions.map(q => q._subject))];
  return subjects.length === 1 ? subjects[0] : subjects.join('_');
}

/**
 * Generate mock exam PDF (question sheet + answer sheet)
 * @param {Array} questions - selected question objects with _subject field
 * @param {Function} onProgress - callback(done, total)
 */
export async function generateMockExamPDF(questions, onProgress) {
  const total = questions.length;

  // Load Korean font data and common passage config
  const [fontData, commonPassages] = await Promise.all([
    loadFontData(),
    loadCommonPassages()
  ]);

  // Build set of common passage question keys
  const cpSet = new Set();
  for (const [subject, exams] of Object.entries(commonPassages)) {
    for (const [examKey, groups] of Object.entries(exams)) {
      for (const range of groups) {
        const [start, end] = range.split('-').map(Number);
        for (let n = start; n <= end; n++) {
          cpSet.add(`${subject}_${examKey}_${n}`);
        }
      }
    }
  }

  // Load and process all images
  const imageDataList = [];
  for (let i = 0; i < total; i++) {
    const q = questions[i];
    const qKey = `${q._subject}_${q.학년도}_${q.분류}_${q.번호}`;
    const skipNumber = cpSet.has(qKey);
    const imgData = await loadAndProcessImage(q, i + 1, skipNumber);
    imageDataList.push({ ...imgData, skipNumber });
    if (onProgress) onProgress(i + 1, total);
  }

  const ts = fileTimestamp();
  const label = subjectLabel(questions);

  // Generate question PDF
  generateQuestionPDF(imageDataList, questions, `${ts}_${label}_문제지.pdf`, fontData);

  // Generate answer PDF
  generateAnswerPDF(questions, `${ts}_${label}_정답표.pdf`, fontData);
}

let _commonPassagesCache = null;
async function loadCommonPassages() {
  if (_commonPassagesCache) return _commonPassagesCache;
  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}data/common_passages.json`);
    _commonPassagesCache = resp.ok ? await resp.json() : {};
  } catch {
    _commonPassagesCache = {};
  }
  return _commonPassagesCache;
}

/**
 * Load image, replace number overlay, return { dataUrl, width, height }
 */
function loadAndProcessImage(question, newNumber, skipNumber = false) {
  return new Promise((resolve) => {
    const subject = question._subject;
    const code = SUBJECT_CODE[subject] || subject;
    const month = CATEGORY_TO_MONTH[question.분류] || '00';
    const paddedNum = String(question.번호).padStart(2, '0');
    const fileName = `${question.학년도}_${month}_${code}_${paddedNum}`;
    const basePath = `${import.meta.env.BASE_URL}images/${encodeURIComponent(subject)}`;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const processImage = (loadedImg) => {
      const canvas = document.createElement('canvas');
      canvas.width = loadedImg.naturalWidth;
      canvas.height = loadedImg.naturalHeight;
      const ctx = canvas.getContext('2d');

      // Draw original image
      ctx.drawImage(loadedImg, 0, 0);

      // Cover original number area (skip for common passage questions)
      if (!skipNumber) {
        const scale = COL_W / canvas.width; // mm per px
        const coverW = Math.round(5.5 / scale);
        const coverH = Math.round(4.5 / scale);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, coverW, coverH);
      }

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({
        dataUrl,
        width: canvas.width,
        height: canvas.height
      });
    };

    // Try .jpg first, then .png, then create placeholder
    img.onload = () => processImage(img);
    img.onerror = () => {
      const img2 = new Image();
      img2.crossOrigin = 'anonymous';
      img2.onload = () => processImage(img2);
      img2.onerror = () => {
        // Create placeholder
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, 400, 300);
        ctx.fillStyle = '#86868b';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${newNumber}. 이미지 없음`, 200, 140);
        ctx.fillText(`(${subject} ${question.학년도} ${question.분류} ${question.번호}번)`, 200, 165);
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', 0.85),
          width: 400,
          height: 300
        });
      };
      img2.src = `${basePath}/${encodeURIComponent(fileName)}.png`;
    };
    img.src = `${basePath}/${encodeURIComponent(fileName)}.jpg`;
  });
}

/**
 * Generate the question sheet PDF with 2-column layout
 */
function generateQuestionPDF(imageDataList, questions, fileName, fontData) {
  const doc = new jsPDF('p', 'mm', 'a4');
  registerFont(doc, fontData);

  let pageNum = 1;
  let col = 0; // 0=left, 1=right
  let yPos = 0; // current y position within the column (relative to content start)

  drawPageHeader(doc, pageNum);

  for (let i = 0; i < imageDataList.length; i++) {
    const img = imageDataList[i];

    // Calculate image height when fitted to column width
    const ratio = img.height / img.width;
    const imgW = COL_W;
    const imgH = imgW * ratio;

    // Check if image fits in remaining space
    if (yPos + imgH > USABLE_H) {
      if (col === 0) {
        // Move to right column
        col = 1;
        yPos = 0;
      } else {
        // New page
        doc.addPage();
        pageNum++;
        drawPageHeader(doc, pageNum);
        col = 0;
        yPos = 0;
      }
    }

    // If still doesn't fit (very tall image), force it
    if (yPos + imgH > USABLE_H && col === 1) {
      doc.addPage();
      pageNum++;
      drawPageHeader(doc, pageNum);
      col = 0;
      yPos = 0;
    }

    const x = MARGIN + col * (COL_W + COL_GAP);
    const y = MARGIN + HEADER_H + yPos;

    // Clamp image height to usable area if very tall
    const finalH = Math.min(imgH, USABLE_H);
    const finalW = finalH === imgH ? imgW : imgW * (finalH / imgH);

    doc.addImage(img.dataUrl, 'JPEG', x, y, finalW, finalH);

    // Draw question number on PDF (skip for common passage questions)
    if (!img.skipNumber) {
      doc.setFont('NanumGothic', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(`${i + 1}.`, x + 0.5, y + 3.2);
    }

    yPos += finalH + 3.5; // ~4px gap between images
  }

  // Draw column divider on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const dividerX = MARGIN + COL_W + COL_GAP / 2;
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.3);
    doc.line(dividerX, MARGIN + HEADER_H, dividerX, PAGE_H - MARGIN);
  }

  doc.save(fileName);
}

/**
 * Draw page header
 */
function drawPageHeader(doc, pageNum) {
  doc.setFont('NanumGothic', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 31);
  doc.text('모의고사 문제지', MARGIN, MARGIN + 6);

  doc.setFont('NanumGothic', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 115);
  doc.text(`- ${pageNum} -`, PAGE_W / 2, PAGE_H - MARGIN + 5, { align: 'center' });

  // Header line
  doc.setDrawColor(229, 229, 229);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, MARGIN + HEADER_H - 2, PAGE_W - MARGIN, MARGIN + HEADER_H - 2);
}

/**
 * Generate the answer sheet PDF
 */
function generateAnswerPDF(questions, fileName, fontData) {
  const doc = new jsPDF('p', 'mm', 'a4');
  registerFont(doc, fontData);

  // Title
  doc.setFont('NanumGothic', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 30, 31);
  doc.text('정답표', PAGE_W / 2, MARGIN + 10, { align: 'center' });

  // Date
  doc.setFont('NanumGothic', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 115);
  const dateStr = new Date().toLocaleDateString('ko-KR');
  doc.text(dateStr, PAGE_W / 2, MARGIN + 18, { align: 'center' });

  // Table
  const tableTop = MARGIN + 28;
  const colWidths = [20, 25, 25, 25, 85]; // 번호, 정답, 배점, 과목(복수 시), 출처
  const multiSubject = new Set(questions.map(q => q._subject)).size > 1;

  const headers = ['번호', '정답', '배점'];
  if (multiSubject) headers.push('과목');
  headers.push('출처');

  const rowH = 7;
  let y = tableTop;

  // Header row
  doc.setFont('NanumGothic', 'bold');
  doc.setFontSize(9);
  doc.setFillColor(250, 250, 250);
  doc.setTextColor(30, 30, 31);

  let x = MARGIN;
  const usedWidths = multiSubject ? colWidths : [colWidths[0], colWidths[1], colWidths[2], colWidths[4]];

  doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, rowH, 'F');
  doc.setDrawColor(229, 229, 229);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y + rowH, PAGE_W - MARGIN, y + rowH);

  x = MARGIN;
  headers.forEach((h, i) => {
    doc.text(h, x + usedWidths[i] / 2, y + rowH / 2 + 1, { align: 'center' });
    x += usedWidths[i];
  });
  y += rowH;

  // Data rows
  doc.setFont('NanumGothic', 'normal');
  doc.setFontSize(8);

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    if (y + rowH > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN + 10;
    }

    // Alternating row background
    if (i % 2 === 0) {
      doc.setFillColor(252, 252, 252);
      doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, rowH, 'F');
    }

    doc.setDrawColor(240, 240, 240);
    doc.line(MARGIN, y + rowH, PAGE_W - MARGIN, y + rowH);

    doc.setTextColor(66, 66, 69);
    x = MARGIN;

    const cells = [`${i + 1}`, String(q.답), String(q.배점)];
    if (multiSubject) cells.push(q._subject);
    cells.push(`${q.학년도} ${q.분류} ${q.번호}번`);

    cells.forEach((cell, ci) => {
      doc.text(cell, x + usedWidths[ci] / 2, y + rowH / 2 + 1, { align: 'center' });
      x += usedWidths[ci];
    });

    y += rowH;
  }

  // Border around table
  doc.setDrawColor(229, 229, 229);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, tableTop, PAGE_W - MARGIN * 2, y - tableTop);

  doc.save(fileName);
}
