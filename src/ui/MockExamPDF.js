import { jsPDF } from 'jspdf';

// 과목 → 이미지 코드 매핑 (ImageModal과 동일)
const SUBJECT_CODE = {
  '한국지리': 'korgeo',
  '세계지리': 'wgeo',
  '통합사회': 'iss',
  '한국사': 'korhis',
  '정치와법': 'pol',
  '경제': 'econ',
  '사회문화': 'socul',
  '생활과윤리': 'leth',
  '윤리와사상': 'ethth',
  '동아시아사': 'eahis',
  '세계사': 'whis'
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

/**
 * Generate mock exam PDF (question sheet + answer sheet)
 * @param {Array} questions - selected question objects with _subject field
 * @param {Function} onProgress - callback(done, total)
 */
export async function generateMockExamPDF(questions, onProgress) {
  const total = questions.length;

  // Load and process all images
  const imageDataList = [];
  for (let i = 0; i < total; i++) {
    const q = questions[i];
    const imgData = await loadAndProcessImage(q, i + 1);
    imageDataList.push(imgData);
    if (onProgress) onProgress(i + 1, total);
  }

  // Generate question PDF
  generateQuestionPDF(imageDataList, questions);

  // Generate answer PDF
  generateAnswerPDF(questions);
}

/**
 * Load image, replace number overlay, return { dataUrl, width, height }
 */
function loadAndProcessImage(question, newNumber) {
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

      // Cover original number area with white rectangle
      // Number area is approximately top-left, sized proportionally
      const coverW = Math.round(canvas.width * 0.1);
      const coverH = Math.round(canvas.height * 0.04);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, coverW, coverH);

      // Draw new number
      const fontSize = Math.round(coverH * 0.8);
      ctx.fillStyle = '#000000';
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(`${newNumber}.`, 4, coverH / 2);

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
function generateQuestionPDF(imageDataList, questions) {
  const doc = new jsPDF('p', 'mm', 'a4');
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
    yPos += finalH + 2; // 2mm gap between images
  }

  doc.save('모의고사_문제지.pdf');
}

/**
 * Draw page header
 */
function drawPageHeader(doc, pageNum) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 31);
  doc.text('Mock Exam', MARGIN, MARGIN + 6);

  doc.setFont('helvetica', 'normal');
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
function generateAnswerPDF(questions) {
  const doc = new jsPDF('p', 'mm', 'a4');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 30, 31);
  doc.text('Answer Sheet', PAGE_W / 2, MARGIN + 10, { align: 'center' });

  // Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 115);
  const dateStr = new Date().toLocaleDateString('ko-KR');
  doc.text(dateStr, PAGE_W / 2, MARGIN + 18, { align: 'center' });

  // Table
  const tableTop = MARGIN + 28;
  const colWidths = [20, 25, 25, 25, 85]; // No, Answer, Score, Subject(if multi), Source
  const multiSubject = new Set(questions.map(q => q._subject)).size > 1;

  const headers = ['No.', 'Answer', 'Score'];
  if (multiSubject) headers.push('Subject');
  headers.push('Source');

  const rowH = 7;
  let y = tableTop;

  // Header row
  doc.setFont('helvetica', 'bold');
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
  doc.setFont('helvetica', 'normal');
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

  doc.save('모의고사_정답표.pdf');
}
