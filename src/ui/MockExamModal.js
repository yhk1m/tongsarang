import { generateMockExamPDF } from './MockExamPDF.js';

let SUBJECTS_WITH_DATA = [];

const ME_PAGE_SIZE = 20;

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
  currentSubject: null,
  // Step 2 filter/pagination state
  checkedSet: new Set(),
  meFilters: {},
  mePage: 1,
  meFilteredQuestions: []
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

export async function openMockExam(currentSubject, dm, linkerStore) {
  state = {
    step: 1,
    type: null,
    subjects: [],
    subjectData: {},
    selectedQuestions: [],
    dm,
    linkerStore,
    currentSubject,
    checkedSet: new Set(),
    meFilters: {},
    mePage: 1,
    meFilteredQuestions: []
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
  if (state.step === 1) {
    const preview = document.getElementById('mePreview');
    if (preview) preview.innerHTML = '';
    renderStep1();
  }
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

// ── Step 2: Filter bar + flat table + pagination ──
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

  // Build allQuestions
  const allQuestions = [];
  for (const subj of state.subjects) {
    const data = state.subjectData[subj];
    for (const q of data) {
      allQuestions.push({ ...q, _subject: subj });
    }
  }
  state.selectedQuestions = allQuestions;
  state.checkedSet = new Set();
  state.meFilters = {};
  state.mePage = 1;
  state.meFilteredQuestions = [...allQuestions];

  renderStep2Combined();
}

function renderStep2Combined() {
  const body = document.getElementById('meBody');
  const allQuestions = state.selectedQuestions;
  const showSubject = state.subjects.length > 1;

  if (allQuestions.length === 0) {
    body.innerHTML = '<div class="me-no-data">문항 데이터가 없습니다</div>';
    renderFooter('', '<button class="btn btn-secondary" id="meBackTo1">이전</button>');
    document.getElementById('meBackTo1').addEventListener('click', () => {
      state.step = 1;
      renderStep();
    });
    return;
  }

  // Build filter options
  const filterOpts = buildMeFilterOptions(allQuestions);

  // Filter bar HTML
  let filterHtml = `<div class="me-filter-bar">`;
  filterHtml += buildSelectHtml('meFilterYear', '학년도', filterOpts.years);
  if (showSubject) {
    filterHtml += buildSelectHtml('meFilterSubject', '과목', filterOpts.subjects);
  }
  filterHtml += buildSelectHtml('meFilterCategory', '분류', filterOpts.categories);
  filterHtml += buildSelectHtml('meFilterChapter', '대단원', filterOpts.chapters);
  filterHtml += buildSelectHtml('meFilterStandard', '성취기준', filterOpts.standards);
  filterHtml += buildSelectHtml('meFilterDifficulty', '난이도', filterOpts.difficulties);
  filterHtml += `<select id="meFilterAccuracy">
    <option value="">정답률</option>
    <option value="0-30">~30%</option>
    <option value="31-50">31~50%</option>
    <option value="51-70">51~70%</option>
    <option value="71-100">71~100%</option>
  </select>`;
  filterHtml += `<input id="meFilterKeyword" type="text" placeholder="키워드 검색">`;
  filterHtml += `<button id="meFilterReset">초기화</button>`;
  filterHtml += `</div>`;

  // Table header
  let theadHtml = `<table class="me-question-table me-flat-table">
    <thead><tr>
      <th><input type="checkbox" id="meSelectAll"></th>
      ${showSubject ? '<th>과목</th>' : ''}
      <th>학년도</th>
      <th>분류</th>
      <th>대단원</th>
      <th>번호</th>
      <th>발문</th>
      <th>배점</th>
      <th>답</th>
    </tr></thead>
    <tbody id="meTbody"></tbody>
  </table>`;

  // Pagination
  let paginationHtml = `<div class="me-pagination" id="mePagination"></div>`;

  body.innerHTML = filterHtml + theadHtml + paginationHtml;

  // Preview panel (fixed at bottom, outside body scroll)
  let preview = document.getElementById('mePreview');
  if (!preview) {
    preview = document.createElement('div');
    preview.id = 'mePreview';
    preview.className = 'me-preview';
    // Insert before footer inside the wizard
    const footer = document.getElementById('meFooter');
    footer.parentNode.insertBefore(preview, footer);
  }

  // Apply initial filters and render
  applyMeFilters();

  // Footer
  renderFooter(
    `<span class="me-select-count" id="meSelCount">선택: <strong>${state.checkedSet.size}</strong> / ${allQuestions.length}문항</span>`,
    `<button class="btn btn-secondary" id="meBackTo1">이전</button>
     <button class="btn btn-primary" id="meGenPDF">PDF 생성</button>`
  );

  // Bind filter events
  bindMeFilterEvents(showSubject);

  // Back button
  document.getElementById('meBackTo1').addEventListener('click', () => {
    state.step = 1;
    renderStep();
  });

  // PDF generation
  document.getElementById('meGenPDF').addEventListener('click', () => {
    if (state.checkedSet.size === 0) return;
    const selected = Array.from(state.checkedSet).sort((a, b) => a - b).map(i => state.selectedQuestions[i]);
    startPDFGeneration(selected);
  });
}

function buildMeFilterOptions(questions) {
  const years = new Set();
  const subjects = new Set();
  const categories = new Set();
  const chapters = new Set();
  const standards = new Set();
  const difficulties = new Set();
  const { linkerStore } = state;

  for (const q of questions) {
    if (q.학년도) years.add(String(q.학년도));
    if (q._subject) subjects.add(q._subject);
    if (q.분류) categories.add(q.분류);
    if (q.대단원) chapters.add(q.대단원);
    if (linkerStore) {
      const std = linkerStore.getMapping(q._subject, q);
      if (std) standards.add(std);
    }
    if (q.난이도) difficulties.add(String(q.난이도));
  }

  const sortSet = s => Array.from(s).sort();
  return {
    years: sortSet(years),
    subjects: sortSet(subjects),
    categories: sortSet(categories),
    chapters: sortSet(chapters),
    standards: sortSet(standards),
    difficulties: sortSet(difficulties)
  };
}

function buildSelectHtml(id, label, options) {
  let html = `<select id="${id}"><option value="">${escHtml(label)}</option>`;
  for (const opt of options) {
    html += `<option value="${escHtml(opt)}">${escHtml(opt)}</option>`;
  }
  html += `</select>`;
  return html;
}

function applyMeFilters() {
  const filters = state.meFilters;
  const allQuestions = state.selectedQuestions;
  const result = [];

  for (let idx = 0; idx < allQuestions.length; idx++) {
    const q = allQuestions[idx];
    if (filters.year && String(q.학년도) !== filters.year) continue;
    if (filters.subject && q._subject !== filters.subject) continue;
    if (filters.category && (q.분류 || '') !== filters.category) continue;
    if (filters.chapter && (q.대단원 || '') !== filters.chapter) continue;
    if (filters.standard) {
      const std = state.linkerStore ? state.linkerStore.getMapping(q._subject, q) : null;
      if ((std || '') !== filters.standard) continue;
    }
    if (filters.difficulty && String(q.난이도 || '') !== filters.difficulty) continue;
    if (filters.accuracy) {
      const rate = parseFloat(q.정답률);
      if (isNaN(rate)) continue;
      const [lo, hi] = filters.accuracy.split('-').map(Number);
      if (rate < lo || rate > hi) continue;
    }
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      const text = ((q.발문 || '') + ' ' + (q.문항내용 || '')).toLowerCase();
      if (!text.includes(kw)) continue;
    }
    result.push({ ...q, _origIdx: idx });
  }

  state.meFilteredQuestions = result;
  state.mePage = 1;
  renderMeTablePage();
  updateMeFilterOptions();
}

function updateMeFilterOptions() {
  const filtered = state.meFilteredQuestions;
  const { linkerStore } = state;

  const years = new Set();
  const subjects = new Set();
  const categories = new Set();
  const chapters = new Set();
  const standards = new Set();
  const difficulties = new Set();

  for (const q of filtered) {
    if (q.학년도) years.add(String(q.학년도));
    if (q._subject) subjects.add(q._subject);
    if (q.분류) categories.add(q.분류);
    if (q.대단원) chapters.add(q.대단원);
    if (linkerStore) {
      const std = linkerStore.getMapping(q._subject, q);
      if (std) standards.add(std);
    }
    if (q.난이도) difficulties.add(String(q.난이도));
  }

  const map = {
    meFilterYear: { opts: years, label: '학년도', key: 'year' },
    meFilterSubject: { opts: subjects, label: '과목', key: 'subject' },
    meFilterCategory: { opts: categories, label: '분류', key: 'category' },
    meFilterChapter: { opts: chapters, label: '대단원', key: 'chapter' },
    meFilterStandard: { opts: standards, label: '성취기준', key: 'standard' },
    meFilterDifficulty: { opts: difficulties, label: '난이도', key: 'difficulty' },
  };

  for (const [id, { opts, label, key }] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (!el) continue;
    const current = state.meFilters[key] || '';
    const sorted = Array.from(opts).sort();
    let html = `<option value="">${escHtml(label)}</option>`;
    for (const o of sorted) {
      html += `<option value="${escHtml(o)}"${o === current ? ' selected' : ''}>${escHtml(o)}</option>`;
    }
    // 현재 선택값이 목록에 없으면 유지 (자기 자신 필터이므로)
    if (current && !opts.has(current)) {
      html += `<option value="${escHtml(current)}" selected>${escHtml(current)}</option>`;
    }
    el.innerHTML = html;
  }
}

function renderMeTablePage() {
  const filtered = state.meFilteredQuestions;
  const totalPages = Math.max(1, Math.ceil(filtered.length / ME_PAGE_SIZE));
  if (state.mePage > totalPages) state.mePage = totalPages;

  const start = (state.mePage - 1) * ME_PAGE_SIZE;
  const pageItems = filtered.slice(start, start + ME_PAGE_SIZE);
  const showSubject = state.subjects.length > 1;

  // Render tbody
  const tbody = document.getElementById('meTbody');
  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${showSubject ? 9 : 8}" style="text-align:center;padding:20px;color:#86868b;">조건에 맞는 문항이 없습니다</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(q => {
      const idx = q._origIdx;
      const checked = state.checkedSet.has(idx) ? 'checked' : '';
      const balm = (q.발문 || '').slice(0, 50) + ((q.발문 || '').length > 50 ? '...' : '');
      return `<tr>
        <td><input type="checkbox" class="me-q-check" data-idx="${idx}" ${checked}></td>
        ${showSubject ? `<td>${escHtml(q._subject)}</td>` : ''}
        <td>${escHtml(String(q.학년도 || ''))}</td>
        <td>${escHtml(q.분류 || '')}</td>
        <td>${escHtml(q.대단원 || '')}</td>
        <td>${escHtml(String(q.번호 || ''))}</td>
        <td class="me-balm-cell" title="${escHtml(q.발문 || '')}">${escHtml(balm)}</td>
        <td>${escHtml(String(q.배점 || ''))}</td>
        <td>${escHtml(String(q.답 || ''))}</td>
      </tr>`;
    }).join('');
  }

  // Update select-all checkbox state
  const selectAll = document.getElementById('meSelectAll');
  if (selectAll) {
    const pageIdxs = pageItems.map(q => q._origIdx);
    const allChecked = pageIdxs.length > 0 && pageIdxs.every(i => state.checkedSet.has(i));
    const someChecked = pageIdxs.some(i => state.checkedSet.has(i));
    selectAll.checked = allChecked;
    selectAll.indeterminate = !allChecked && someChecked;
  }

  // Render pagination
  renderMePagination(totalPages);

  // Bind checkbox events on this page
  bindMeCheckboxEvents();

  // Update count
  updateMeCount();
}

function renderMePagination(totalPages) {
  const container = document.getElementById('mePagination');
  if (totalPages <= 1) {
    container.innerHTML = `<span class="me-page-info">${state.meFilteredQuestions.length}문항</span>`;
    return;
  }

  let html = '';
  html += `<button class="me-page-btn" data-mepage="prev" ${state.mePage === 1 ? 'disabled' : ''}>&laquo;</button>`;

  const start = Math.max(1, state.mePage - 3);
  const end = Math.min(totalPages, state.mePage + 3);

  if (start > 1) {
    html += `<button class="me-page-btn" data-mepage="1">1</button>`;
    if (start > 2) html += `<span class="me-page-dots">...</span>`;
  }

  for (let i = start; i <= end; i++) {
    const active = i === state.mePage ? ' active' : '';
    html += `<button class="me-page-btn${active}" data-mepage="${i}">${i}</button>`;
  }

  if (end < totalPages) {
    if (end < totalPages - 1) html += `<span class="me-page-dots">...</span>`;
    html += `<button class="me-page-btn" data-mepage="${totalPages}">${totalPages}</button>`;
  }

  html += `<button class="me-page-btn" data-mepage="next" ${state.mePage === totalPages ? 'disabled' : ''}>&raquo;</button>`;
  html += `<span class="me-page-info">${state.meFilteredQuestions.length}문항</span>`;

  container.innerHTML = html;

  // Bind page click events
  container.addEventListener('click', handleMePageClick);
}

function handleMePageClick(e) {
  const btn = e.target.closest('.me-page-btn');
  if (!btn || btn.disabled) return;

  const totalPages = Math.max(1, Math.ceil(state.meFilteredQuestions.length / ME_PAGE_SIZE));
  const page = btn.dataset.mepage;

  if (page === 'prev') {
    state.mePage = Math.max(1, state.mePage - 1);
  } else if (page === 'next') {
    state.mePage = Math.min(totalPages, state.mePage + 1);
  } else {
    state.mePage = parseInt(page);
  }
  renderMeTablePage();
}

function bindMeCheckboxEvents() {
  const tbody = document.getElementById('meTbody');
  tbody.querySelectorAll('.me-q-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.idx);
      if (cb.checked) {
        state.checkedSet.add(idx);
      } else {
        state.checkedSet.delete(idx);
      }
      // Update select-all state
      const selectAll = document.getElementById('meSelectAll');
      if (selectAll) {
        const pageCbs = tbody.querySelectorAll('.me-q-check');
        const allChecked = pageCbs.length > 0 && Array.from(pageCbs).every(c => c.checked);
        const someChecked = Array.from(pageCbs).some(c => c.checked);
        selectAll.checked = allChecked;
        selectAll.indeterminate = !allChecked && someChecked;
      }
      updateMeCount();
    });
  });
}

function bindMeFilterEvents(showSubject) {
  const ids = ['meFilterYear', 'meFilterCategory', 'meFilterChapter', 'meFilterStandard', 'meFilterDifficulty', 'meFilterAccuracy'];
  const keys = ['year', 'category', 'chapter', 'standard', 'difficulty', 'accuracy'];
  if (showSubject) {
    ids.splice(1, 0, 'meFilterSubject');
    keys.splice(1, 0, 'subject');
  }

  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        state.meFilters[keys[i]] = el.value || undefined;
        applyMeFilters();
      });
    }
  });

  // Keyword input with debounce
  const keywordInput = document.getElementById('meFilterKeyword');
  let keywordTimer = null;
  keywordInput.addEventListener('input', () => {
    clearTimeout(keywordTimer);
    keywordTimer = setTimeout(() => {
      state.meFilters.keyword = keywordInput.value.trim() || undefined;
      applyMeFilters();
    }, 300);
  });

  // Reset button
  document.getElementById('meFilterReset').addEventListener('click', () => {
    state.meFilters = {};
    // Reset all select/input values
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    keywordInput.value = '';
    applyMeFilters();
  });

  // Select-all checkbox: toggles ALL filtered questions (not just current page)
  document.getElementById('meSelectAll').addEventListener('change', (e) => {
    const checked = e.target.checked;
    if (checked) {
      for (const q of state.meFilteredQuestions) {
        state.checkedSet.add(q._origIdx);
      }
    } else {
      for (const q of state.meFilteredQuestions) {
        state.checkedSet.delete(q._origIdx);
      }
    }
    // Re-render current page to update checkboxes
    renderMeTablePage();
  });
}

function updateMeCount() {
  const el = document.getElementById('meSelCount');
  if (el) {
    el.innerHTML = `선택: <strong>${state.checkedSet.size}</strong> / ${state.selectedQuestions.length}문항`;
  }
  renderMePreview();
}

const ME_SUBJECT_CODE = {
  '한국지리': 'korgeo', '세계지리': 'wgeo', '통합사회': 'iss',
  '한국사': 'korhis', '정치와법': 'pollaw', '경제': 'econ',
  '사회문화': 'socul', '생활과윤리': 'leth', '윤리와사상': 'ethth',
  '동아시아사': 'eahis', '세계사': 'worhis'
};
const ME_CAT_MONTH = {
  '수능': '11', '9모': '09', '6모': '06',
  '10월학평': '10', '7월학평': '07', '5월학평': '05', '4월학평': '04', '3월학평': '03',
  '11월': '11', '10월': '10', '9월': '09', '7월': '07',
  '6월': '06', '5월': '05', '4월': '04', '3월': '03'
};

function getQuestionImageUrl(q) {
  const code = ME_SUBJECT_CODE[q._subject] || q._subject;
  const month = ME_CAT_MONTH[q.분류] || '00';
  const num = String(q.번호).padStart(2, '0');
  return `${import.meta.env.BASE_URL}images/${encodeURIComponent(q._subject)}/${q.학년도}_${month}_${code}_${num}.jpg`;
}

function renderMePreview() {
  const container = document.getElementById('mePreview');
  if (!container) return;

  if (state.checkedSet.size === 0) {
    container.innerHTML = '';
    return;
  }

  const sorted = Array.from(state.checkedSet).sort((a, b) => a - b);
  const showSubject = state.subjects.length > 1;

  container.innerHTML = `
    <div class="me-preview-header">선택한 문항 미리보기 (${sorted.length}문항)</div>
    <div class="me-preview-list">
      ${sorted.map(idx => {
        const q = state.selectedQuestions[idx];
        const label = showSubject
          ? `${q._subject} ${q.학년도} ${q.분류} ${q.번호}번`
          : `${q.학년도} ${q.분류} ${q.번호}번`;
        return `<div class="me-preview-item" data-idx="${idx}">
          <div class="me-preview-item-header">
            <span class="me-preview-label">${escHtml(label)}</span>
            <button class="me-preview-remove" data-idx="${idx}" title="선택 해제">&times;</button>
          </div>
          <img src="${getQuestionImageUrl(q)}" alt="${escHtml(label)}" loading="lazy">
        </div>`;
      }).join('')}
    </div>
  `;

  container.querySelectorAll('.me-preview-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      state.checkedSet.delete(idx);
      renderMeTablePage();
    });
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
    hasMinor
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
