// © 2026 김용현
import { generateMockExamPDF, planBundles } from './MockExamPDF.js';
import { imageFileNameOf, questionKey } from '../core/questionKey.js';
import { icon } from './icons.js';

/*
  모의고사 만들기: 한 화면에서 과목을 오가며 문항을 고르고 PDF로 만든다.
  - 과목은 칩으로 한 번에 바꾼다. 고른 문항은 과목을 바꿔도, 창을 닫았다 열어도 남는다.
  - 조건 칸의 목록은 "자기 칸을 뺀 나머지 조건"으로 좁힌다. 그래서 고른 값을 다른 값으로
    바로 바꿀 수 있고, 다른 조건과 겹치는 문항이 없는 값은 목록에 나오지 않는다.
  - 다른 조건을 바꿔서 고른 값이 목록에서 사라지면 그 조건은 저절로 풀린다.
*/

const PAGE_SIZE = 20;

const CATEGORY_ORDER = { '수능': 12, '11월': 11, '10월': 10, '10월학평': 10, '9월': 9, '9모': 9, '7월': 7, '7월학평': 7, '6월': 6, '6모': 6, '5월': 5, '5월학평': 5, '4월': 4, '4월학평': 4, '3월': 3, '3월학평': 3 };
const DIFFICULTY_ORDER = ['최상', '상', '중상', '중', '중하', '하', '최하'];
const ACCURACY_RANGES = [
  { value: '0-30', label: '30% 이하' },
  { value: '31-50', label: '31~50%' },
  { value: '51-70', label: '51~70%' },
  { value: '71-100', label: '71% 이상' },
];

// 조건 칸: key 는 state.filters 의 이름, get 은 문항에서 값을 꺼내는 방법
const FIELDS = [
  { key: 'year', label: '학년도', get: q => String(q.학년도 || ''), sort: (a, b) => b.localeCompare(a, 'ko', { numeric: true }) },
  { key: 'grade', label: '학년', get: q => q.학년 || '', sort: (a, b) => a.localeCompare(b, 'ko', { numeric: true }) },
  { key: 'category', label: '분류', get: q => q.분류 || '', sort: (a, b) => (CATEGORY_ORDER[b] ?? 0) - (CATEGORY_ORDER[a] ?? 0) },
  { key: 'chapter', label: '대단원', get: q => q.대단원 || '', sort: (a, b) => a.localeCompare(b, 'ko', { numeric: true }) },
  { key: 'standard', label: '성취기준', get: q => q._std || '', sort: (a, b) => a.localeCompare(b, 'ko', { numeric: true }) },
  { key: 'difficulty', label: '난이도', get: q => String(q.난이도 || ''), sort: (a, b) => rank(DIFFICULTY_ORDER, a) - rank(DIFFICULTY_ORDER, b) },
];

function rank(list, v) {
  const i = list.indexOf(v);
  return i < 0 ? list.length : i;
}

// 문항 전체(과목 11개)와 고른 문항은 창을 닫아도 남겨 둔다
let ALL = [];
let SUBJECTS = [];
const checked = new Set(); // ALL 의 _idx

let state = {
  subject: '',   // '' = 모든 과목
  filters: {},   // year, grade, category, chapter, standard, difficulty, accuracy, keyword
  page: 1,
  view: [],      // 지금 조건에 맞는 문항
};

export function renderMockExamModal() {
  return `
    <div id="mockExamModal" class="mockexam-modal">
      <div class="mockexam-wizard" role="dialog" aria-modal="true" aria-labelledby="meTitle">
        <div class="me-header">
          <h2 id="meTitle">모의고사 만들기</h2>
          <button class="me-close" id="meClose" aria-label="닫기">${icon.close(20)}</button>
        </div>
        <div class="me-body" id="meBody"></div>
        <div class="me-preview" id="mePreview"></div>
        <div class="me-footer" id="meFooter"></div>
      </div>
    </div>
  `;
}

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
  document.getElementById('mockExamModal').classList.add('open');
  document.body.style.overflow = 'hidden';

  const body = document.getElementById('meBody');
  body.innerHTML = '<div class="me-progress-overlay"><div class="spinner"></div><div class="me-progress-text">문항을 불러오고 있어요</div></div>';
  document.getElementById('meFooter').innerHTML = '';
  document.getElementById('mePreview').innerHTML = '';

  try {
    if (ALL.length === 0) {
      SUBJECTS = await dm.getSubjectsWithData();
      const bundles = await loadBundles();
      for (const subj of SUBJECTS) {
        const data = await dm.loadSubject(subj);
        const sb = bundles[subj] || {};
        for (const q of data) {
          // 묶음 문항이면 { group: [17, 18], end: 자료가 끝나는 줄(px) }
          ALL.push({ ...q, _subject: subj, _idx: ALL.length, _bundle: sb[questionKey(q)] || null });
        }
      }
    }
  } catch {
    body.innerHTML = '<div class="me-no-data"><strong>문항을 불러오지 못했어요</strong><span>인터넷 연결을 확인하고 창을 닫았다가 다시 열어 주세요.</span></div>';
    return;
  }

  // 성취기준 연결은 관리자가 바꿀 수 있으니 열 때마다 다시 읽는다
  for (const q of ALL) {
    q._std = (linkerStore ? linkerStore.getMapping(q._subject, q) : null) || q.성취기준 || '';
  }

  // 조건은 처음으로, 과목은 본 화면에서 보던 과목으로. 고른 문항은 그대로 둔다.
  state = {
    subject: SUBJECTS.includes(currentSubject) ? currentSubject : '',
    filters: {},
    page: 1,
    view: [],
  };
  renderPicker();
}

/** 묶음 문항 목록 (scripts/detect_bundles.py 가 만든다). 없거나 못 받으면 묶음 없이 동작한다. */
async function loadBundles() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/bundles.json`);
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

function bundleRange(q) {
  const g = q._bundle?.group;
  return g ? `${g[0]}~${g[g.length - 1]}` : '';
}

function bundleBadge(q) {
  if (!q._bundle) return '';
  return `<span class="me-bundle" title="${bundleRange(q)}번이 같은 자료를 써요. 함께 고르면 자료는 한 번만 들어가요.">${bundleRange(q)} 묶음</span>`;
}

function closeMockExam() {
  document.getElementById('mockExamModal').classList.remove('open');
  document.body.style.overflow = '';
}

// ── 거르기 ──

function matches(q, skipKey) {
  const f = state.filters;
  if (skipKey !== 'subject' && state.subject && q._subject !== state.subject) return false;
  for (const fd of FIELDS) {
    if (fd.key === skipKey || !f[fd.key]) continue;
    if (fd.get(q) !== f[fd.key]) return false;
  }
  if (skipKey !== 'accuracy' && f.accuracy) {
    const rate = parseFloat(q.정답률);
    const [lo, hi] = f.accuracy.split('-').map(Number);
    if (isNaN(rate) || rate < lo || rate > hi) return false;
  }
  if (skipKey !== 'keyword' && f.keyword) {
    const text = `${q.발문 || ''} ${q.문항내용 || ''}`.toLowerCase();
    if (!text.includes(f.keyword.toLowerCase())) return false;
  }
  return true;
}

/** 칸마다 고를 수 있는 값. 자기 칸을 뺀 나머지 조건으로 좁힌다. */
function facetOptions(fd) {
  const set = new Set();
  for (const q of ALL) {
    if (!matches(q, fd.key)) continue;
    const v = fd.get(q);
    if (v) set.add(v);
  }
  return Array.from(set).sort(fd.sort);
}

// 과목마다 값이 다른 조건 (과목을 바꾸면 맞지 않을 수 있다)
const SUBJECT_BOUND = ['grade', 'category', 'chapter', 'standard'];

/** 과목 칩 옆 숫자: 과목에 딸리지 않은 조건(학년도, 난이도, 정답률, 검색어)에 맞는 문항 수.
    과목에 딸린 조건은 과목을 바꾸면 풀리므로 세지 않는다. 칩은 잠그지 않는다. */
function subjectCounts() {
  const saved = state.filters;
  state.filters = Object.fromEntries(Object.entries(saved).filter(([k]) => !SUBJECT_BOUND.includes(k)));
  const counts = Object.fromEntries(SUBJECTS.map(s => [s, 0]));
  let total = 0;
  for (const q of ALL) {
    if (!matches(q, 'subject')) continue;
    counts[q._subject]++;
    total++;
  }
  state.filters = saved;
  return { counts, total };
}

function applyFilters() {
  // 다른 조건이 바뀌어 고른 값이 목록에서 사라지면 그 조건을 푼다.
  // 과목에 딸린 조건(대단원 등)을 먼저 푼다. 같이 따지면 맞지 않는 대단원 때문에
  // 학년도처럼 새 과목에도 있는 값까지 풀려 버린다.
  for (let round = 0; round <= FIELDS.length; round++) {
    const invalid = FIELDS.filter(fd => {
      const v = state.filters[fd.key];
      return v && !facetOptions(fd).includes(v);
    });
    if (invalid.length === 0) break;
    const bound = invalid.filter(fd => SUBJECT_BOUND.includes(fd.key));
    for (const fd of (bound.length ? bound : invalid)) delete state.filters[fd.key];
  }
  state.view = ALL.filter(q => matches(q));
  state.page = 1;
}

// ── 그리기 ──

function renderPicker() {
  applyFilters();
  const body = document.getElementById('meBody');
  body.innerHTML = `
    <div class="me-subject-chips" id="meSubjectChips" role="radiogroup" aria-label="과목"></div>
    <div class="me-filter-bar" id="meFilterBar"></div>
    <div class="me-list-head" id="meListHead"></div>
    <div class="me-table-wrap">
      <table class="me-question-table" id="meTable"></table>
    </div>
    <div class="me-pagination" id="mePagination"></div>
  `;
  bindPickerEvents();
  refresh();
}

/** 조건이 바뀔 때마다 칩, 조건 칸, 표, 쪽 번호를 다시 그린다 (입력 칸은 그대로 둔다) */
function refresh() {
  renderChips();
  renderFilterBar();
  renderTable();
  renderFooter();
  renderPreview();
}

function renderChips() {
  const { counts, total } = subjectCounts();
  const chip = (value, label, count) => {
    const on = state.subject === value;
    return `<button type="button" class="me-chip${on ? ' active' : ''}" role="radio" aria-checked="${on}" data-subject="${escHtml(value)}">
      ${escHtml(label)}<span class="me-chip-count num">${count.toLocaleString()}</span>
    </button>`;
  };
  document.getElementById('meSubjectChips').innerHTML =
    chip('', '모든 과목', total) + SUBJECTS.map(s => chip(s, s, counts[s])).join('');
}

function renderFilterBar() {
  const bar = document.getElementById('meFilterBar');
  const keywordEl = document.getElementById('meFilterKeyword');
  const keepKeyword = keywordEl && document.activeElement === keywordEl;

  const selects = FIELDS.map(fd => {
    const opts = facetOptions(fd);
    const cur = state.filters[fd.key] || '';
    // 학년처럼 지금 과목에 없는 칸은 숨긴다
    if (opts.length === 0 && !cur) return '';
    return `<label class="me-field${cur ? ' is-set' : ''}">
      <span class="me-field-label">${fd.label}</span>
      <select data-key="${fd.key}">
        <option value="">전체</option>
        ${opts.map(o => `<option value="${escHtml(o)}"${o === cur ? ' selected' : ''}>${escHtml(o)}</option>`).join('')}
      </select>
    </label>`;
  }).join('');

  const acc = state.filters.accuracy || '';
  const accSelect = `<label class="me-field${acc ? ' is-set' : ''}">
    <span class="me-field-label">정답률</span>
    <select data-key="accuracy">
      <option value="">전체</option>
      ${ACCURACY_RANGES.map(r => `<option value="${r.value}"${r.value === acc ? ' selected' : ''}>${r.label}</option>`).join('')}
    </select>
  </label>`;

  const active = Object.values(state.filters).filter(Boolean).length;

  if (keepKeyword) {
    // 검색어를 치는 중에는 입력 칸을 다시 만들지 않는다 (글자, 커서가 날아가지 않게)
    bar.querySelectorAll('.me-field').forEach(el => el.remove());
    bar.querySelector('.me-filter-reset')?.remove();
    bar.querySelector('.me-search').insertAdjacentHTML('afterend', selects + accSelect + resetButton(active));
    return;
  }

  bar.innerHTML = `
    <div class="me-search">
      ${icon.search(16)}
      <input id="meFilterKeyword" type="search" placeholder="발문, 내용으로 찾기" aria-label="발문, 내용으로 찾기" value="${escHtml(state.filters.keyword || '')}">
    </div>
    ${selects}${accSelect}${resetButton(active)}
  `;
}

function resetButton(active) {
  return active > 0
    ? `<button type="button" class="btn btn-ghost me-filter-reset" id="meFilterReset">${icon.reset()}조건 지우기</button>`
    : '';
}

function renderTable() {
  const view = state.view;
  const totalPages = Math.max(1, Math.ceil(view.length / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;
  const pageItems = view.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

  const showSubject = !state.subject;
  const showGrade = view.some(q => q.학년);

  // 찾은 문항 중 몇 개를 골랐는지
  const pickedInView = view.reduce((n, q) => n + (checked.has(q._idx) ? 1 : 0), 0);
  document.getElementById('meListHead').innerHTML = `
    <span>찾은 문항 <strong class="num">${view.length.toLocaleString()}</strong>개${pickedInView ? `, 그중 <strong class="num">${pickedInView}</strong>개 고름` : ''}</span>
  `;

  const allOn = view.length > 0 && pickedInView === view.length;
  const someOn = pickedInView > 0 && !allOn;
  const head = `<thead><tr>
    <th><input type="checkbox" id="meSelectAll" aria-label="찾은 문항 ${view.length}개 모두 고르기" title="찾은 문항 모두 고르기" ${allOn ? 'checked' : ''}${view.length === 0 ? ' disabled' : ''}></th>
    ${showSubject ? '<th>과목</th>' : ''}
    <th>학년도</th>
    ${showGrade ? '<th>학년</th>' : ''}
    <th>분류</th>
    <th>번호</th>
    <th>대단원</th>
    <th>발문</th>
    <th>배점</th>
    <th>답</th>
    <th>정답률</th>
  </tr></thead>`;

  const colCount = 9 + (showSubject ? 1 : 0) + (showGrade ? 1 : 0);
  const rows = pageItems.length === 0
    ? `<tr><td colspan="${colCount}" class="me-empty-row">조건에 맞는 문항이 없어요. 조건을 하나씩 빼 보세요.</td></tr>`
    : pageItems.map(q => {
      const on = checked.has(q._idx);
      const label = `${q._subject} ${q.학년도} ${q.학년 ? q.학년 + ' ' : ''}${q.분류} ${q.번호}번`;
      return `<tr class="me-row${on ? ' is-checked' : ''}" data-idx="${q._idx}">
        <td><input type="checkbox" class="me-q-check" data-idx="${q._idx}" ${on ? 'checked' : ''} aria-label="${escHtml(label)} 고르기"></td>
        ${showSubject ? `<td>${escHtml(q._subject)}</td>` : ''}
        <td>${escHtml(String(q.학년도 || ''))}</td>
        ${showGrade ? `<td>${escHtml(q.학년 || '-')}</td>` : ''}
        <td>${escHtml(q.분류 || '')}</td>
        <td>${escHtml(String(q.번호 || ''))}${bundleBadge(q)}</td>
        <td class="me-chapter-cell" title="${escHtml(q.대단원 || '')}">${escHtml(q.대단원 || '')}</td>
        <td class="me-balm-cell" title="${escHtml(q.발문 || '')}">${escHtml(q.발문 || '')}</td>
        <td>${escHtml(String(q.배점 || ''))}</td>
        <td>${escHtml(String(q.답 || ''))}</td>
        <td>${escHtml(String(q.정답률 ?? ''))}</td>
      </tr>`;
    }).join('');

  const table = document.getElementById('meTable');
  table.innerHTML = head + `<tbody>${rows}</tbody>`;
  const selectAll = document.getElementById('meSelectAll');
  if (selectAll) selectAll.indeterminate = someOn;

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const el = document.getElementById('mePagination');
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  const p = state.page;
  let html = `<button class="me-page-btn" data-page="${p - 1}" aria-label="이전 쪽" ${p === 1 ? 'disabled' : ''}>${icon.chevronLeft()}</button>`;
  const start = Math.max(1, p - 3);
  const end = Math.min(totalPages, p + 3);
  if (start > 1) html += `<button class="me-page-btn" data-page="1">1</button>${start > 2 ? '<span class="me-page-dots">...</span>' : ''}`;
  for (let i = start; i <= end; i++) {
    html += `<button class="me-page-btn${i === p ? ' active' : ''}" data-page="${i}"${i === p ? ' aria-current="page"' : ''}>${i}</button>`;
  }
  if (end < totalPages) html += `${end < totalPages - 1 ? '<span class="me-page-dots">...</span>' : ''}<button class="me-page-btn" data-page="${totalPages}">${totalPages}</button>`;
  html += `<button class="me-page-btn" data-page="${p + 1}" aria-label="다음 쪽" ${p === totalPages ? 'disabled' : ''}>${icon.chevronRight()}</button>`;
  el.innerHTML = html;
}

function renderFooter() {
  const n = checked.size;
  const subjectsPicked = new Set([...checked].map(i => ALL[i]._subject)).size;
  document.getElementById('meFooter').innerHTML = `
    <div class="me-footer-left">
      <span class="me-select-count">${n === 0
        ? '문항을 고르면 PDF를 만들 수 있어요'
        : `<strong class="num">${n}</strong>문항을 골랐어요${subjectsPicked > 1 ? ` (${subjectsPicked}과목)` : ''}`}</span>
    </div>
    <div class="me-footer-right">
      ${n > 0 ? `<button class="btn btn-ghost" id="meClearAll">다 빼기</button>` : ''}
      <button class="btn btn-primary" id="meGenPDF" ${n === 0 ? 'disabled' : ''}>${icon.download()}${n === 0 ? 'PDF 만들기' : `${n}문항 PDF 만들기`}</button>
    </div>
  `;
}

function getQuestionImageUrl(q) {
  const fileName = imageFileNameOf(q._subject, q);
  return `${import.meta.env.BASE_URL}images/${encodeURIComponent(q._subject)}/${fileName}.jpg`;
}

function pickedSorted() {
  return [...checked].sort((a, b) => a - b).map(i => ALL[i]);
}

function renderPreview() {
  const container = document.getElementById('mePreview');
  if (checked.size === 0) { container.innerHTML = ''; return; }
  const items = pickedSorted();
  const multi = new Set(items.map(q => q._subject)).size > 1;
  const plans = planBundles(items);
  // 묶음 문항이 어떻게 들어가는지 짧게 알린다
  const note = (q, i) => {
    const p = plans[i];
    if (p.kind === 'follow') return '자료는 앞 문항과 함께';
    if (p.kind === 'lead' && !p.range) return `${bundleRange(q)} 묶음 중 1문항`;
    if (p.kind === 'lead') return `${bundleRange(q)} 묶음 자료`;
    return '';
  };
  container.innerHTML = `
    <div class="me-preview-header">고른 문항 ${items.length}개 <span>PDF에 이 순서로 들어가요</span></div>
    <div class="me-preview-list">
      ${items.map((q, i) => {
        const label = `${multi ? q._subject + ' ' : ''}${q.학년도} ${q.학년 ? q.학년 + ' ' : ''}${q.분류} ${q.번호}번`;
        return `<div class="me-preview-item">
          <div class="me-preview-item-header">
            <span class="me-preview-label" title="${escHtml(label)}">${escHtml(label)}</span>
            <button class="me-preview-remove" data-idx="${q._idx}" aria-label="${escHtml(label)} 빼기">${icon.close(14)}</button>
          </div>
          ${note(q, i) ? `<div class="me-preview-note">${note(q, i)}</div>` : ''}
          <img src="${getQuestionImageUrl(q)}" alt="${escHtml(label)}" loading="lazy">
        </div>`;
      }).join('')}
    </div>
  `;
}

// ── 이벤트 (한 번만 걸고, 안쪽 내용은 다시 그려도 그대로 동작) ──

function toggle(idx, on) {
  if (on) checked.add(idx); else checked.delete(idx);
}

/** 고르기만 바뀌었을 때: 표는 그 줄만, 머리, 바닥, 미리보기만 다시 */
function refreshSelection() {
  const body = document.getElementById('meBody');
  const keepScroll = body.scrollTop;
  renderTable();
  renderFooter();
  renderPreview();
  body.scrollTop = keepScroll;
}

function bindPickerEvents() {
  const body = document.getElementById('meBody');

  body.querySelector('#meSubjectChips').addEventListener('click', e => {
    const chip = e.target.closest('.me-chip');
    if (!chip || chip.dataset.subject === state.subject) return;
    state.subject = chip.dataset.subject;
    // 대단원, 성취기준처럼 과목에 딸린 조건은 새 과목에 맞지 않으면 아래 applyFilters 가 푼다
    applyFilters();
    refresh();
  });

  const bar = body.querySelector('#meFilterBar');
  bar.addEventListener('change', e => {
    const sel = e.target.closest('select[data-key]');
    if (!sel) return;
    if (sel.value) state.filters[sel.dataset.key] = sel.value;
    else delete state.filters[sel.dataset.key];
    applyFilters();
    refresh();
  });

  let timer = null;
  bar.addEventListener('input', e => {
    if (e.target.id !== 'meFilterKeyword') return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const v = e.target.value.trim();
      if (v) state.filters.keyword = v; else delete state.filters.keyword;
      applyFilters();
      refresh();
    }, 250);
  });

  bar.addEventListener('click', e => {
    if (!e.target.closest('#meFilterReset')) return;
    state.filters = {};
    applyFilters();
    refresh();
  });

  // 줄 아무 곳이나 누르면 고르기/빼기
  body.querySelector('#meTable').addEventListener('click', e => {
    if (e.target.id === 'meSelectAll') {
      const on = e.target.checked;
      for (const q of state.view) toggle(q._idx, on);
      refreshSelection();
      return;
    }
    const row = e.target.closest('tr.me-row');
    if (!row) return;
    const idx = Number(row.dataset.idx);
    const cb = row.querySelector('.me-q-check');
    const on = e.target === cb ? cb.checked : !checked.has(idx);
    toggle(idx, on);
    refreshSelection();
  });

  body.querySelector('#mePagination').addEventListener('click', e => {
    const btn = e.target.closest('.me-page-btn');
    if (!btn || btn.disabled) return;
    state.page = Number(btn.dataset.page);
    renderTable();
    document.getElementById('meListHead')?.scrollIntoView({ block: 'nearest' });
  });

  // 바닥과 미리보기는 renderPicker 바깥에 있어서 한 번만 건다
  const footer = document.getElementById('meFooter');
  if (!footer.dataset.bound) {
    footer.dataset.bound = '1';
    footer.addEventListener('click', e => {
      if (e.target.closest('#meClearAll')) {
        checked.clear();
        refreshSelection();
      } else if (e.target.closest('#meGenPDF')) {
        if (checked.size > 0) startPDFGeneration(pickedSorted());
      }
    });
    document.getElementById('mePreview').addEventListener('click', e => {
      const btn = e.target.closest('.me-preview-remove');
      if (!btn) return;
      checked.delete(Number(btn.dataset.idx));
      refreshSelection();
    });
  }
}

async function startPDFGeneration(questions) {
  const body = document.getElementById('meBody');
  body.innerHTML = `<div class="me-progress-overlay">
    <div class="me-progress-text">PDF를 만들고 있어요</div>
    <div class="me-progress-bar"><div class="me-progress-fill" id="mePdfBar"></div></div>
    <div class="me-progress-count num" id="mePdfProgress">0 / ${questions.length}</div>
  </div>`;
  document.getElementById('meFooter').innerHTML = '';
  document.getElementById('mePreview').innerHTML = '';

  try {
    await generateMockExamPDF(questions, (done, total) => {
      const el = document.getElementById('mePdfProgress');
      if (el) el.textContent = `${done} / ${total}`;
      const bar = document.getElementById('mePdfBar');
      if (bar) bar.style.width = `${Math.round((done / total) * 100)}%`;
    });
    // 다 만들었으면 고른 문항을 비우고 닫는다
    checked.clear();
    closeMockExam();
  } catch (err) {
    body.innerHTML = `<div class="me-no-data"><strong>PDF를 만들지 못했어요</strong><span>고른 문항은 그대로 있어요. 문항 고르기로 돌아가 다시 만들어 주세요.</span><small>${escHtml(err.message)}</small><button type="button" class="btn btn-secondary" id="meBackToPicker">문항 고르기로 돌아가기</button></div>`;
    document.getElementById('meBackToPicker').addEventListener('click', renderPicker);
  }
}

function escHtml(str) {
  if (str === null || str === undefined || str === '') return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
