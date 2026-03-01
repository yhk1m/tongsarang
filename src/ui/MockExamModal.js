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
  selectedChapters: new Set(),
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
    selectedChapters: new Set(),
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
  else if (state.step === 2) renderStep2();
  else if (state.step === 3) renderStep3();
}

function renderStepIndicator() {
  const steps = ['유형 선택', '성취기준', '문항 선택'];
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
        <p>과목을 선택하여<br>성취기준별로 문항을 선택합니다</p>
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

// ── Step 2: Chapter tree ──
async function goStep2() {
  state.step = 2;
  state.selectedChapters.clear();
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

  renderStep2();
}

function renderStep2() {
  const body = document.getElementById('meBody');
  let html = '';

  for (const subj of state.subjects) {
    const data = state.subjectData[subj];
    const tree = buildChapterTree(data, subj);

    if (state.subjects.length > 1) {
      html += `<div class="me-subject-separator">${escHtml(subj)}</div>`;
    }

    if (tree.length === 0) {
      html += '<div class="me-no-data">성취기준 데이터가 없습니다</div>';
      continue;
    }

    const hasMinorData = tree.some(t => t.hasMinor);
    html += '<div class="me-chapter-tree">';
    for (const major of tree) {
      const majorId = `me_maj_${subj}_${major.name}`;

      if (hasMinorData) {
        // 중단원이 있는 과목: 대단원 > 중단원 트리
        const minorHtml = major.minors.map(m => {
          const minorId = `me_min_${subj}_${m.name}`;
          return `
            <label class="me-chapter-minor">
              <input type="checkbox" data-subject="${escHtml(subj)}" data-minor="${escHtml(m.name)}" id="${escHtml(minorId)}">
              ${escHtml(m.name)}
              <span class="me-count">(${m.count})</span>
            </label>
          `;
        }).join('');

        html += `
          <div class="me-chapter-group">
            <label class="me-chapter-major">
              <input type="checkbox" data-subject="${escHtml(subj)}" data-major="${escHtml(major.name)}" id="${escHtml(majorId)}">
              ${escHtml(major.name)}
              <span class="me-count">(${major.count})</span>
            </label>
            <div class="me-chapter-minors">${minorHtml}</div>
          </div>
        `;
      } else {
        // 중단원이 없는 과목: 대단원만 바로 선택
        html += `
          <div class="me-chapter-group">
            <label class="me-chapter-major">
              <input type="checkbox" data-subject="${escHtml(subj)}" data-major="${escHtml(major.name)}" data-minor="(미분류)" id="${escHtml(majorId)}">
              ${escHtml(major.name)}
              <span class="me-count">(${major.count})</span>
            </label>
          </div>
        `;
      }
    }
    html += '</div>';
  }

  body.innerHTML = html;
  renderFooter('', `
    <button class="btn btn-secondary" id="meBackTo1">이전</button>
    <button class="btn btn-primary" id="meNextTo3">다음</button>
  `);

  // Major checkbox toggles all minors
  body.querySelectorAll('input[data-major]').forEach(maj => {
    maj.addEventListener('change', () => {
      const group = maj.closest('.me-chapter-group');
      group.querySelectorAll('input[data-minor]').forEach(min => {
        min.checked = maj.checked;
      });
    });
  });

  // Minor checkbox updates major state
  body.querySelectorAll('input[data-minor]').forEach(min => {
    min.addEventListener('change', () => {
      const group = min.closest('.me-chapter-group');
      const majCb = group.querySelector('input[data-major]');
      const minors = group.querySelectorAll('input[data-minor]');
      const allChecked = Array.from(minors).every(m => m.checked);
      const someChecked = Array.from(minors).some(m => m.checked);
      majCb.checked = allChecked;
      majCb.indeterminate = !allChecked && someChecked;
    });
  });

  document.getElementById('meBackTo1').addEventListener('click', () => {
    state.step = 1;
    renderStep();
  });

  document.getElementById('meNextTo3').addEventListener('click', () => {
    collectSelectedChapters();
    if (state.selectedChapters.size === 0) return;
    state.step = 3;
    renderStep();
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

function collectSelectedChapters() {
  state.selectedChapters.clear();
  document.querySelectorAll('#meBody input[data-minor]:checked').forEach(cb => {
    state.selectedChapters.add(`${cb.dataset.subject}||${cb.dataset.minor}`);
  });
}

// ── Step 3: Question selection ──
function renderStep3() {
  const body = document.getElementById('meBody');
  const questions = [];

  for (const subj of state.subjects) {
    const data = state.subjectData[subj];
    for (const item of data) {
      const minorKey = item.중단원 || '(미분류)';
      const key = `${subj}||${minorKey}`;
      if (state.selectedChapters.has(key)) {
        questions.push({ ...item, _subject: subj });
      }
    }
  }

  if (questions.length === 0) {
    body.innerHTML = '<div class="me-no-data">선택한 성취기준에 해당하는 문항이 없습니다</div>';
    renderFooter('', '<button class="btn btn-secondary" id="meBackTo2">이전</button>');
    document.getElementById('meBackTo2').addEventListener('click', () => {
      state.step = 2;
      renderStep();
    });
    return;
  }

  const showSubject = state.subjects.length > 1;

  let tableHtml = `
    <table class="me-question-table">
      <thead>
        <tr>
          <th><input type="checkbox" id="meSelectAll" checked></th>
          ${showSubject ? '<th>과목</th>' : ''}
          <th>학년도</th>
          <th>분류</th>
          <th>번호</th>
          <th>발문</th>
          <th>배점</th>
          <th>정답</th>
        </tr>
      </thead>
      <tbody>
  `;

  questions.forEach((q, idx) => {
    const balm = (q.발문 || '').slice(0, 50) + ((q.발문 || '').length > 50 ? '...' : '');
    tableHtml += `
      <tr>
        <td><input type="checkbox" class="me-q-check" data-idx="${idx}" checked></td>
        ${showSubject ? `<td>${escHtml(q._subject)}</td>` : ''}
        <td>${escHtml(String(q.학년도))}</td>
        <td>${escHtml(q.분류)}</td>
        <td>${escHtml(String(q.번호))}</td>
        <td class="me-balm-cell" title="${escHtml(q.발문 || '')}">${escHtml(balm)}</td>
        <td>${escHtml(String(q.배점))}</td>
        <td>${escHtml(String(q.답))}</td>
      </tr>
    `;
  });

  tableHtml += '</tbody></table>';
  body.innerHTML = tableHtml;

  state.selectedQuestions = questions;

  const updateCount = () => {
    const checked = body.querySelectorAll('.me-q-check:checked').length;
    document.getElementById('meSelCount').innerHTML = `선택: <strong>${checked}</strong> / ${questions.length}문항`;
  };

  renderFooter(
    `<span class="me-select-count" id="meSelCount">선택: <strong>${questions.length}</strong> / ${questions.length}문항</span>`,
    `<button class="btn btn-secondary" id="meBackTo2">이전</button>
     <button class="btn btn-primary" id="meGenPDF">PDF 생성</button>`
  );

  // Select all
  document.getElementById('meSelectAll').addEventListener('change', e => {
    body.querySelectorAll('.me-q-check').forEach(cb => cb.checked = e.target.checked);
    updateCount();
  });

  body.querySelectorAll('.me-q-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const allCbs = body.querySelectorAll('.me-q-check');
      const allChecked = Array.from(allCbs).every(c => c.checked);
      document.getElementById('meSelectAll').checked = allChecked;
      updateCount();
    });
  });

  document.getElementById('meBackTo2').addEventListener('click', () => {
    state.step = 2;
    renderStep();
  });

  document.getElementById('meGenPDF').addEventListener('click', () => {
    const checkedIdxs = Array.from(body.querySelectorAll('.me-q-check:checked')).map(cb => parseInt(cb.dataset.idx));
    if (checkedIdxs.length === 0) return;
    const selected = checkedIdxs.map(i => state.selectedQuestions[i]);
    startPDFGeneration(selected);
  });
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
    renderFooter('', '<button class="btn btn-secondary" id="meBackTo3">이전</button>');
    document.getElementById('meBackTo3').addEventListener('click', () => {
      state.step = 3;
      renderStep();
    });
  }
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
