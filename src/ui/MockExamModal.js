import { generateMockExamPDF } from './MockExamPDF.js';

let SUBJECTS_WITH_DATA = [];

export function renderMockExamModal() {
  return `
    <div id="mockExamModal" class="mockexam-modal">
      <div class="mockexam-wizard">
        <div class="me-header">
          <h2>모의고사 만들기</h2>
          <button class="me-close" id="meClose">&times;</button>
        </div>
        <div class="me-step-indicator" id="meStepIndicator"></div>
        <div class="me-body" id="meBody"></div>
        <div class="me-footer" id="meFooter"></div>
      </div>
    </div>
  `;
}

let state = {
  step: 1,
  type: null, // 'single' | 'multi'
  subjects: [],
  subjectData: {},
  selectedQuestions: [],
  dm: null,
  currentSubject: null
};

export function bindMockExamEvents() {
  const modal = document.getElementById('mockExamModal');
  document.getElementById('meClose').addEventListener('click', closeMockExam);
  modal.addEventListener('click', e => {
    if (e.target === modal) closeMockExam();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeMockExam();
  });
  document.querySelector('.mockexam-wizard').addEventListener('click', e => e.stopPropagation());
}

export async function openMockExam(currentSubject, dm) {
  state = {
    step: 1,
    type: null,
    subjects: [],
    subjectData: {},
    selectedQuestions: [],
    dm,
    currentSubject
  };
  document.getElementById('mockExamModal').classList.add('open');
  document.body.style.overflow = 'hidden';

  // 데이터가 있는 과목 목록을 동적으로 로드
  const body = document.getElementById('meBody');
  body.innerHTML = '<div class="me-progress-overlay"><div class="spinner"></div><div class="me-progress-text">과목 확인 중...</div></div>';
  renderFooter('', '');
  SUBJECTS_WITH_DATA = await dm.getSubjectsWithData();

  renderStep();
}

function closeMockExam() {
  document.getElementById('mockExamModal').classList.remove('open');
  document.body.style.overflow = '';
}

function renderStep() {
  renderStepIndicator();
  if (state.step === 1) renderStep1();
  else if (state.step === 2) renderStep2Combined();
}

function renderStepIndicator() {
  const steps = ['유형 선택', '문항 선택'];
  document.getElementById('meStepIndicator').innerHTML = steps.map((label, i) => {
    const num = i + 1;
    let cls = 'me-step';
    if (num < state.step) cls += ' done';
    else if (num === state.step) cls += ' active';
    const arrow = i < steps.length - 1 ? '<span class="me-step-arrow">&#9654;</span>' : '';
    return `<span class="${cls}"><span class="me-step-num">${num}</span>${label}</span>${arrow}`;
  }).join('');
}

function renderFooter(leftHtml, buttons) {
  document.getElementById('meFooter').innerHTML = `
    <div class="me-footer-left">${leftHtml}</div>
    <div class="me-footer-right">${buttons}</div>
  `;
}

// ── Step 1: Type selection ──
function renderStep1() {
  const body = document.getElementById('meBody');
  body.innerHTML = `
    <div class="me-type-cards">
      <div class="me-type-card" id="meTypeSingle">
        <h3>과목별 모의고사</h3>
        <p>과목을 선택하여<br>문항을 선택합니다</p>
      </div>
      <div class="me-type-card" id="meTypeMulti">
        <h3>통합 모의고사</h3>
        <p>모든 과목의 문항을 모아<br>통합 모의고사를 만듭니다</p>
      </div>
    </div>
    <div id="meSubjectPicker" style="display:none">
      <div class="me-subject-list" id="meSubjectList"></div>
    </div>
  `;

  renderFooter('', '');

  document.getElementById('meTypeSingle').addEventListener('click', () => {
    state.type = 'single';
    showSubjectPicker();
  });

  document.getElementById('meTypeMulti').addEventListener('click', () => {
    state.type = 'multi';
    state.subjects = [...SUBJECTS_WITH_DATA];
    goStep2();
  });
}

function showSubjectPicker() {
  const picker = document.getElementById('meSubjectPicker');
  picker.style.display = '';
  const list = document.getElementById('meSubjectList');
  list.innerHTML = SUBJECTS_WITH_DATA.map(s => `
    <label>
      <input type="radio" name="meSingleSubject" value="${escHtml(s)}" ${s === state.currentSubject ? 'checked' : ''}>
      ${escHtml(s)}
    </label>
  `).join('');

  renderFooter('', '<button class="btn btn-primary" id="meSubjectNext">다음</button>');
  document.getElementById('meSubjectNext').addEventListener('click', () => {
    const selected = list.querySelector('input[name="meSingleSubject"]:checked');
    if (!selected) return;
    state.subjects = [selected.value];
    goStep2();
  });
}

// ── Step 2: Combined accordion (대단원 아코디언 + 문항 테이블) ──
async function goStep2() {
  state.step = 2;
  renderStepIndicator();

  const body = document.getElementById('meBody');
  body.innerHTML = '<div class="me-progress-overlay"><div class="spinner"></div><div class="me-progress-text">데이터 로드 중...</div></div>';
  renderFooter('', '');

  // Load data for all selected subjects
  for (const subj of state.subjects) {
    if (!state.subjectData[subj]) {
      state.subjectData[subj] = await state.dm.loadSubject(subj);
    }
  }

  renderStep2Combined();
}

function renderStep2Combined() {
  const body = document.getElementById('meBody');
  const allQuestions = [];
  let html = '';
  let accordionCount = 0;
  const showSubject = state.subjects.length > 1;

  for (const subj of state.subjects) {
    const data = state.subjectData[subj];
    const tree = buildChapterTree(data, subj);
    const hasMinorData = tree.some(t => t.hasMinor);

    if (showSubject) {
      html += `<div class="me-subject-separator">${escHtml(subj)}</div>`;
    }

    if (tree.length === 0) {
      html += '<div class="me-no-data">데이터가 없습니다</div>';
      continue;
    }

    for (const major of tree) {
      const majorQuestions = data.filter(item => item.대단원 === major.name);
      const startIdx = allQuestions.length;
      const questionIndexMap = new Map();
      majorQuestions.forEach((q, i) => {
        allQuestions.push({ ...q, _subject: subj });
        questionIndexMap.set(q, startIdx + i);
      });

      const accId = `me_acc_${accordionCount++}`;

      // Accordion header
      html += `<div class="me-accordion-group">`;
      html += `<div class="me-accordion-header" data-target="${accId}">`;
      html += `<input type="checkbox" class="me-major-check">`;
      html += `<span class="me-accordion-title">${escHtml(major.name)}</span>`;
      html += `<span class="me-count">(${major.count}문항)</span>`;
      html += `<span class="me-accordion-arrow">▶</span>`;
      html += `</div>`;

      // Accordion body
      html += `<div class="me-accordion-body" id="${accId}">`;

      if (hasMinorData) {
        for (const minor of major.minors) {
          const minorQuestions = majorQuestions.filter(q => (q.중단원 || '(미분류)') === minor.name);
          if (minorQuestions.length === 0) continue;

          html += `<div class="me-minor-header">${escHtml(minor.name)} <span class="me-count">(${minor.count})</span></div>`;
          html += `<table class="me-question-table"><tbody>`;
          for (const q of minorQuestions) {
            const idx = questionIndexMap.get(q);
            const balm = (q.발문 || '').slice(0, 50) + ((q.발문 || '').length > 50 ? '...' : '');
            html += `<tr>
              <td><input type="checkbox" class="me-q-check" data-idx="${idx}"></td>
              ${showSubject ? `<td>${escHtml(subj)}</td>` : ''}
              <td>${escHtml(String(q.학년도 || ''))}</td>
              <td>${escHtml(q.분류 || '')}</td>
              <td>${escHtml(String(q.번호 || ''))}</td>
              <td class="me-balm-cell" title="${escHtml(q.발문 || '')}">${escHtml(balm)}</td>
              <td>${escHtml(String(q.배점 || ''))}</td>
              <td>${escHtml(String(q.답 || ''))}</td>
            </tr>`;
          }
          html += `</tbody></table>`;
        }
      } else {
        html += `<table class="me-question-table"><tbody>`;
        for (let i = 0; i < majorQuestions.length; i++) {
          const q = majorQuestions[i];
          const idx = startIdx + i;
          const balm = (q.발문 || '').slice(0, 50) + ((q.발문 || '').length > 50 ? '...' : '');
          html += `<tr>
            <td><input type="checkbox" class="me-q-check" data-idx="${idx}"></td>
            ${showSubject ? `<td>${escHtml(subj)}</td>` : ''}
            <td>${escHtml(String(q.학년도 || ''))}</td>
            <td>${escHtml(q.분류 || '')}</td>
            <td>${escHtml(String(q.번호 || ''))}</td>
            <td class="me-balm-cell" title="${escHtml(q.발문 || '')}">${escHtml(balm)}</td>
            <td>${escHtml(String(q.배점 || ''))}</td>
            <td>${escHtml(String(q.답 || ''))}</td>
          </tr>`;
        }
        html += `</tbody></table>`;
      }

      html += `</div>`; // accordion-body
      html += `</div>`; // accordion-group
    }
  }

  if (allQuestions.length === 0) {
    html = '<div class="me-no-data">문항 데이터가 없습니다</div>';
  }

  body.innerHTML = html;
  state.selectedQuestions = allQuestions;

  const updateCount = () => {
    const checked = body.querySelectorAll('.me-q-check:checked').length;
    const el = document.getElementById('meSelCount');
    if (el) el.innerHTML = `선택: <strong>${checked}</strong> / ${allQuestions.length}문항`;
  };

  renderFooter(
    `<span class="me-select-count" id="meSelCount">선택: <strong>0</strong> / ${allQuestions.length}문항</span>`,
    `<button class="btn btn-secondary" id="meBackTo1">이전</button>
     <button class="btn btn-primary" id="meGenPDF">PDF 생성</button>`
  );

  // Accordion toggle (click header, but not the checkbox)
  body.querySelectorAll('.me-accordion-header').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.tagName === 'INPUT') return;
      const targetId = header.dataset.target;
      const bodyEl = document.getElementById(targetId);
      const arrow = header.querySelector('.me-accordion-arrow');
      bodyEl.classList.toggle('open');
      arrow.textContent = bodyEl.classList.contains('open') ? '▼' : '▶';
    });
  });

  // Major checkbox → select/deselect all questions in this chapter
  body.querySelectorAll('.me-major-check').forEach(majCb => {
    majCb.addEventListener('change', () => {
      const group = majCb.closest('.me-accordion-group');
      group.querySelectorAll('.me-q-check').forEach(cb => cb.checked = majCb.checked);
      updateCount();
    });
  });

  // Individual question checkbox → update major checkbox state
  body.querySelectorAll('.me-q-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const group = cb.closest('.me-accordion-group');
      const majCb = group.querySelector('.me-major-check');
      const qChecks = group.querySelectorAll('.me-q-check');
      const allChecked = Array.from(qChecks).every(c => c.checked);
      const someChecked = Array.from(qChecks).some(c => c.checked);
      majCb.checked = allChecked;
      majCb.indeterminate = !allChecked && someChecked;
      updateCount();
    });
  });

  document.getElementById('meBackTo1').addEventListener('click', () => {
    state.step = 1;
    renderStep();
  });

  document.getElementById('meGenPDF').addEventListener('click', () => {
    const checkedIdxs = Array.from(body.querySelectorAll('.me-q-check:checked')).map(cb => parseInt(cb.dataset.idx));
    if (checkedIdxs.length === 0) return;
    const selected = checkedIdxs.map(i => state.selectedQuestions[i]);
    startPDFGeneration(selected);
  });
}

function buildChapterTree(data, subj) {
  const tree = new Map();
  let hasMinor = false;
  for (const item of data) {
    if (!item.대단원) continue;
    if (!tree.has(item.대단원)) tree.set(item.대단원, new Map());
    const minors = tree.get(item.대단원);
    const minorKey = item.중단원 || '';
    if (minorKey) hasMinor = true;
    minors.set(minorKey || '(미분류)', (minors.get(minorKey || '(미분류)') || 0) + 1);
  }

  return Array.from(tree.entries()).map(([major, minors]) => ({
    name: major,
    count: Array.from(minors.values()).reduce((a, b) => a + b, 0),
    minors: Array.from(minors.entries()).map(([name, count]) => ({ name, count })),
    hasMinor // 중단원 데이터가 있는 과목인지
  }));
}

async function startPDFGeneration(questions) {
  const body = document.getElementById('meBody');
  body.innerHTML = '<div class="me-progress-overlay"><div class="spinner"></div><div class="me-progress-text" id="mePdfProgress">PDF 생성 중... (0/' + questions.length + ')</div></div>';
  renderFooter('', '');

  try {
    await generateMockExamPDF(questions, (done, total) => {
      const el = document.getElementById('mePdfProgress');
      if (el) el.textContent = `PDF 생성 중... (${done}/${total})`;
    });
    closeMockExam();
  } catch (err) {
    body.innerHTML = `<div class="me-no-data">PDF 생성 실패: ${escHtml(err.message)}</div>`;
    renderFooter('', '<button class="btn btn-secondary" id="meBackToQuestions">이전</button>');
    document.getElementById('meBackToQuestions').addEventListener('click', () => {
      state.step = 2;
      renderStep();
    });
  }
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
