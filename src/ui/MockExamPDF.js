import { jsPDF } from 'jspdf';
import { imageFileNameOf } from '../core/questionKey.js';

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
 * @param {Array} questions - selected question objects with _subject field (and _bundle when it is a bundle)
 * @param {Function} onProgress - callback(done, total)
 */
export async function generateMockExamPDF(questions, onProgress) {
  const fontData = await loadFontData();

  const imageDataList = await processQuestionImages(questions, onProgress);

  const ts = fileTimestamp();
  const label = subjectLabel(questions);
  generateQuestionPDF(imageDataList, questions, `${ts}_${label}_문제지.pdf`, fontData);
  generateAnswerPDF(questions, `${ts}_${label}_정답표.pdf`, fontData);
}

/** 문항 그림을 번호 바꾸기, 묶음 자료 정리까지 마친 { dataUrl, width, height } 목록으로 */
export async function processQuestionImages(questions, onProgress) {
  // 묶음 문항: 같은 묶음이 이어서 놓이면 자료는 첫 문항에만 넣고, 다음 문항은 자료 아래부터 자른다
  const plans = planBundles(questions);
  const list = [];
  for (let i = 0; i < questions.length; i++) {
    list.push(await loadAndProcessImage(questions[i], i + 1, plans[i]));
    if (onProgress) onProgress(i + 1, questions.length);
  }
  return list;
}

function examId(q) {
  return `${q._subject}|${q.학년도}|${q.분류}|${q.학년 || ''}`;
}

/**
 * 문항마다 그림을 어떻게 다룰지 정한다.
 *  - normal: 맨 위 번호를 새 번호로
 *  - lead:   묶음의 첫 문항. 머리 [17~18] 을 새 범위로 (range), 하나만 골랐으면 머리 줄을 잘라 낸다 (range 없음)
 *  - follow: 바로 앞 문항과 같은 묶음. 공통 자료를 잘라 내고 그 아래 문항만
 */
export function planBundles(questions) {
  const plans = questions.map(() => ({ kind: 'normal' }));
  const sameGroup = (p, q) => p && p._bundle && q._bundle && examId(p) === examId(q)
    && p._bundle.group.join() === q._bundle.group.join();
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q._bundle) continue;
    if (sameGroup(questions[i - 1], q)) {
      plans[i] = { kind: 'follow' };
      continue;
    }
    let j = i;
    while (sameGroup(questions[j + 1], q)) j++;
    plans[i] = j > i ? { kind: 'lead', range: [i + 1, j + 1] } : { kind: 'lead' };
  }
  return plans;
}

// ── 그림 속 글자 찾기 ──

const INK = 150;

/** 어두운 점 지도. 그림 높이 대부분을 지나는 세로줄(단 구분선)은 글자가 아니라서 지운다. */
function inkMap(ctx, w, h) {
  const px = ctx.getImageData(0, 0, w, h).data;
  const ink = new Uint8Array(w * h);
  const colCount = new Uint32Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      if ((px[k] * 0.299 + px[k + 1] * 0.587 + px[k + 2] * 0.114) < INK) {
        ink[y * w + x] = 1;
        colCount[x]++;
      }
    }
  }
  for (let x = 0; x < w; x++) {
    if (colCount[x] > h * 0.6) for (let y = 0; y < h; y++) ink[y * w + x] = 0;
  }
  return ink;
}

function rowInk(ink, w, y) {
  let n = 0;
  for (let x = 0; x < w; x++) n += ink[y * w + x];
  return n;
}

/** y0 아래 첫 글자 줄의 { top, bottom } */
function findLine(ink, w, h, y0) {
  let top = -1;
  for (let y = Math.max(0, y0); y < h; y++) {
    if (rowInk(ink, w, y) > 2) { top = y; break; }
  }
  if (top < 0) return null;
  let bottom = top;
  let blank = 0;
  for (let y = top; y < h && y < top + 200; y++) {
    if (rowInk(ink, w, y) > 0) { bottom = y; blank = 0; } else if (++blank >= 3) break;
  }
  return { top, bottom: bottom + 1 };
}

/** 줄 맨 왼쪽 낱말(번호, [17~18])의 상자. next = 그 뒤 글자가 시작하는 x */
function findToken(ink, w, line) {
  const lineH = line.bottom - line.top;
  const col = x => {
    for (let y = line.top; y < line.bottom; y++) if (ink[y * w + x]) return true;
    return false;
  };
  let x0 = -1;
  for (let x = 0; x < w; x++) if (col(x)) { x0 = x; break; }
  if (x0 < 0) return null;
  const gapMin = Math.max(5, Math.round(lineH * 0.3));
  let x1 = x0;
  let gap = 0;
  for (let x = x0; x < w && x < x0 + lineH * 7; x++) {
    if (col(x)) { x1 = x; gap = 0; } else if (++gap >= gapMin) break;
  }
  // [17~18] 처럼 대괄호로 시작하면 닫는 대괄호까지를 한 낱말로 본다 (글자 사이가 넓은 시험지가 있다)
  const glyphs = glyphRuns(ink, w, line, x0, Math.min(w, x0 + lineH * 7));
  const isBracket = glyphs.length > 1 && glyphs[0].span >= lineH * 0.8 && glyphs[0].width <= lineH * 0.35;
  if (isBracket) {
    const close = glyphs.slice(1).find(g => g.span >= glyphs[0].span * 0.9 && g.width <= lineH * 0.35);
    if (close) x1 = close.x1 - 1;
  }
  let next = x1 + 1;
  while (next < w && !col(next)) next++;
  // 낱말의 실제 위아래 (숫자 높이로 글자 크기를, 아래 끝으로 기준선을 맞춘다)
  let tTop = line.bottom;
  let tBot = line.top;
  for (let y = line.top; y < line.bottom; y++) {
    for (let xx = x0; xx <= x1; xx++) {
      if (ink[y * w + xx]) { if (y < tTop) tTop = y; if (y > tBot) tBot = y; break; }
    }
  }
  return { x0, x1: x1 + 1, top: tTop, bottom: tBot + 1, next, lineH, isBracket };
}

/** 줄 안의 글자 조각(잉크 세로줄이 이어진 구간)마다 너비와 위아래 길이 */
function glyphRuns(ink, w, line, from, to) {
  const runs = [];
  let cur = null;
  for (let x = from; x < to; x++) {
    let lo = -1;
    let hi = -1;
    for (let y = line.top; y < line.bottom; y++) {
      if (ink[y * w + x]) { if (lo < 0) lo = y; hi = y; }
    }
    if (lo >= 0) {
      if (!cur) cur = { x0: x, lo, hi };
      cur.lo = Math.min(cur.lo, lo);
      cur.hi = Math.max(cur.hi, hi);
      cur.x1 = x + 1;
    } else if (cur) {
      runs.push({ ...cur, width: cur.x1 - cur.x0, span: cur.hi - cur.lo + 1 });
      cur = null;
    }
  }
  if (cur) runs.push({ ...cur, width: cur.x1 - cur.x0, span: cur.hi - cur.lo + 1 });
  return runs;
}

/** 낱말을 흰색으로 덮고 새 글자를 같은 크기, 같은 기준선으로 쓴다 */
function replaceToken(ctx, tok, text, kind) {
  const pad = Math.max(2, Math.round(tok.lineH * 0.08));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(tok.x0 - pad, tok.top - pad, tok.x1 - tok.x0 + pad * 2, tok.bottom - tok.top + pad * 2);
  const h = tok.bottom - tok.top;
  const family = kind === 'number'
    ? '"Times New Roman", "Batang", serif'
    : '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
  // 100px 로 그려 보고 실제 글자 높이가 원래 낱말 높이와 같아지게 크기를 정한다
  ctx.font = `bold 100px ${family}`;
  ctx.textBaseline = 'alphabetic';
  const probe = ctx.measureText(text);
  const probeH = (probe.actualBoundingBoxAscent + probe.actualBoundingBoxDescent) || 70;
  const size = Math.max(10, Math.round(100 * h / probeH));
  ctx.font = `bold ${size}px ${family}`;
  const m = ctx.measureText(text);
  ctx.fillStyle = '#000000';
  const room = tok.next - tok.x0 - Math.round(tok.lineH * 0.25);
  const textW = m.width;
  // 새 글자의 위 끝을 원래 낱말의 위 끝에 맞춘다
  const y = tok.top + (m.actualBoundingBoxAscent || size * 0.7);
  ctx.save();
  // 새 번호가 원래보다 길어 뒤 글자에 닿으면 가로로만 살짝 줄인다
  if (textW > room && room > 0) {
    ctx.translate(tok.x0, 0);
    ctx.scale(room / textW, 1);
    ctx.fillText(text, 0, y);
  } else {
    ctx.fillText(text, tok.x0, y);
  }
  ctx.restore();
}

/** 예전 방식(왼쪽 위 고정 크기 덮기). 번호를 못 찾았을 때만 */
function fallbackNumber(ctx, w, number) {
  const scale = COL_W / w;
  const coverW = Math.round(5.5 / scale);
  const coverH = Math.round(4.5 / scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, coverW, coverH);
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(coverH * 0.75)}px "Times New Roman", serif`;
  ctx.textBaseline = 'top';
  ctx.fillText(`${number}.`, 2, 2);
}

function plausible(tok, maxWidthEm) {
  return tok && tok.lineH > 8 && tok.lineH < 160 && (tok.x1 - tok.x0) < tok.lineH * maxWidthEm;
}

/** 그림을 불러와 번호를 바꾸고 (묶음이면 자료를 다루고) { dataUrl, width, height } 로 */
function loadAndProcessImage(question, newNumber, plan = { kind: 'normal' }) {
  return new Promise((resolve) => {
    const subject = question._subject;
    const fileName = imageFileNameOf(subject, question);
    const basePath = `${import.meta.env.BASE_URL}images/${encodeURIComponent(subject)}`;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const processImage = (loadedImg) => {
      const W = loadedImg.naturalWidth;
      const H = loadedImg.naturalHeight;
      const src = document.createElement('canvas');
      src.width = W;
      src.height = H;
      const sctx = src.getContext('2d', { willReadFrequently: true });
      sctx.fillStyle = '#ffffff';
      sctx.fillRect(0, 0, W, H);
      sctx.drawImage(loadedImg, 0, 0);
      const ink = inkMap(sctx, W, H);
      const end = question._bundle ? Math.min(H - 1, Math.max(0, question._bundle.end)) : 0;

      // 1. 잘라 낼 위쪽 (follow: 공통 자료, 하나만 고른 lead: 머리 줄)
      let cropTop = 0;
      if (plan.kind === 'follow') {
        cropTop = end;
      } else if (plan.kind === 'lead' && !plan.range) {
        // 머리 글([1~2] 다음 자료를 보고 ...)은 두세 줄일 수 있다. 줄 사이가 좁으면 같은 문단으로 보고 다 잘라 낸다.
        let head = findLine(ink, W, H, 0);
        let after = head && findLine(ink, W, H, head.bottom);
        const lineH = head ? head.bottom - head.top : 0;
        while (head && after && after.top - head.bottom < lineH * 0.6 && after.bottom - after.top < lineH * 1.6) {
          head = after;
          after = findLine(ink, W, H, head.bottom);
        }
        if (head && after && after.top < end) cropTop = Math.round((head.bottom + after.top) / 2);
      }

      // 2. 번호 바꾸기 (원본 좌표에서)
      if (plan.kind === 'lead' && plan.range) {
        const head = findLine(ink, W, H, 0);
        const htok = head && findToken(ink, W, head);
        if (plausible(htok, 7)) replaceToken(sctx, htok, `[${plan.range[0]}~${plan.range[1]}]`, 'bracket');
      }
      const line = findLine(ink, W, H, plan.kind === 'normal' ? 0 : end);
      const tok = line && findToken(ink, W, line);
      if (plausible(tok, 3.5)) {
        replaceToken(sctx, tok, `${newNumber}.`, 'number');
      } else if (plan.kind === 'normal') {
        fallbackNumber(sctx, W, newNumber);
      }

      // 3. 잘라서 내보내기
      const out = document.createElement('canvas');
      out.width = W;
      out.height = H - cropTop;
      out.getContext('2d').drawImage(src, 0, cropTop, W, H - cropTop, 0, 0, W, H - cropTop);
      resolve({ dataUrl: out.toDataURL('image/jpeg', 0.85), width: out.width, height: out.height });
    };

    // Try .jpg first, then .png, then create placeholder
    img.onload = () => processImage(img);
    img.onerror = () => {
      const img2 = new Image();
      img2.crossOrigin = 'anonymous';
      img2.onload = () => processImage(img2);
      img2.onerror = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, 400, 300);
        ctx.fillStyle = '#86868b';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${newNumber}. 그림 없음`, 200, 140);
        ctx.fillText(`(${subject} ${question.학년도} ${question.분류} ${question.번호}번)`, 200, 165);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: 400, height: 300 });
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

    // 번호는 그림 안에서 바꿨다 (loadAndProcessImage)

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
