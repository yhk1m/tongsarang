import { icon } from './icons.js';

export function renderFilterPanel() {
  return `
    <section class="filter-section" aria-label="문항 찾기">
      <div class="filter-top">
        <div class="filter-search">
          <span class="filter-search-icon">${icon.search(18)}</span>
          <input type="search" id="searchKeyword" placeholder="발문, 내용으로 찾기" aria-label="키워드로 찾기">
        </div>
        <button type="button" class="filter-toggle" id="filterToggle" aria-expanded="true" aria-controls="filterGrid">
          ${icon.filter(18)}<span>조건</span><span class="filter-count num" id="filterCount" hidden></span>
          <span class="filter-toggle-arrow">${icon.chevronDown(18)}</span>
        </button>
      </div>
      <div class="filter-grid" id="filterGrid">
        <div class="filter-group">
          <label for="filterYear">학년도</label>
          <select id="filterYear"><option value="">전체</option></select>
        </div>
        <div class="filter-group" id="filterGradeGroup" style="display:none">
          <label for="filterGrade">학년</label>
          <select id="filterGrade"><option value="">전체</option></select>
        </div>
        <div class="filter-group">
          <label for="filterCategory">분류</label>
          <select id="filterCategory"><option value="">전체</option></select>
        </div>
        <div class="filter-group filter-group-wide">
          <label for="filterChapter">대단원</label>
          <select id="filterChapter"><option value="">전체</option></select>
        </div>
        <div class="filter-group">
          <label for="filterSubChapter">성취기준</label>
          <select id="filterSubChapter"><option value="">전체</option></select>
        </div>
        <div class="filter-group">
          <label for="filterDifficulty">난이도</label>
          <select id="filterDifficulty"><option value="">전체</option></select>
        </div>
        <div class="filter-group" id="filterGeoTesterGroup" style="display:none">
          <label for="filterGeoTester">GeoTester</label>
          <select id="filterGeoTester">
            <option value="">전체</option>
            <option value="yes">올린 문항</option>
            <option value="no">안 올린 문항</option>
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label" id="accuracyLabel">정답률</span>
          <div class="accuracy-dropdown">
            <button type="button" class="accuracy-selector" id="accuracySelector" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="accuracyLabel accuracySelectorText">
              <span class="accuracy-selector-text" id="accuracySelectorText">전체</span>
              <span class="accuracy-selector-arrow">${icon.chevronDown(18)}</span>
            </button>
            <div class="checkbox-group" id="filterAccuracyGroup">
              ${renderAccuracyCheckboxes()}
            </div>
          </div>
        </div>
        <div class="filter-group filter-group-action">
          <button type="button" class="btn btn-ghost" id="btnResetFilter">${icon.reset()}조건 지우기</button>
        </div>
      </div>
    </section>
  `;
}

function renderAccuracyCheckboxes() {
  const ranges = [
    { id: 'acc_0_20', value: '0-20', label: '20% 이하' },
    { id: 'acc_21_30', value: '21-30', label: '21~30%' },
    { id: 'acc_31_40', value: '31-40', label: '31~40%' },
    { id: 'acc_41_50', value: '41-50', label: '41~50%' },
    { id: 'acc_51_60', value: '51-60', label: '51~60%' },
    { id: 'acc_61_70', value: '61-70', label: '61~70%' },
    { id: 'acc_71_80', value: '71-80', label: '71~80%' },
    { id: 'acc_81_90', value: '81-90', label: '81~90%' },
    { id: 'acc_91_100', value: '91-100', label: '91~100%' }
  ];
  return ranges.map(r => `
    <label class="checkbox-item" for="${r.id}">
      <input type="checkbox" id="${r.id}" value="${r.value}">
      <span>${r.label}</span>
    </label>
  `).join('');
}

export function populateFilterOptions(options) {
  fillSelect('filterYear', options.학년도);
  fillSelect('filterGrade', options.학년);
  fillSelect('filterCategory', options.분류);
  fillSelect('filterChapter', options.대단원);
  fillSelect('filterSubChapter', options.성취기준);
  fillSelect('filterDifficulty', options.난이도);
}

function fillSelect(id, values) {
  const sel = document.getElementById(id);
  // Keep first "전체" option, remove the rest
  while (sel.options.length > 1) sel.remove(1);
  values.forEach(v => sel.add(new Option(v, v)));
}

export function getFilterValues() {
  const accChecked = document.querySelectorAll('#filterAccuracyGroup input:checked');
  return {
    학년도: document.getElementById('filterYear').value,
    학년: document.getElementById('filterGrade').value,
    분류: document.getElementById('filterCategory').value,
    대단원: document.getElementById('filterChapter').value,
    성취기준: document.getElementById('filterSubChapter').value,
    난이도: document.getElementById('filterDifficulty').value,
    GeoTester: document.getElementById('filterGeoTester').value,
    정답률범위: Array.from(accChecked).map(cb => cb.value),
    키워드: document.getElementById('searchKeyword').value
  };
}

export function resetFilterValues() {
  document.getElementById('filterYear').value = '';
  document.getElementById('filterGrade').value = '';
  document.getElementById('filterCategory').value = '';
  document.getElementById('filterChapter').value = '';
  document.getElementById('filterSubChapter').value = '';
  document.getElementById('filterDifficulty').value = '';
  document.getElementById('filterGeoTester').value = '';
  document.getElementById('searchKeyword').value = '';
  document.querySelectorAll('#filterAccuracyGroup input').forEach(cb => cb.checked = false);
  updateAccuracyText();
  updateFilterCount();
}

export function bindFilterEvents({ onApply: apply, onReset: reset, onChapterChange }) {
  // 조건을 바꿀 때마다 접힌 막대의 '조건 n개' 도 맞춘다
  const onApply = () => { apply(); updateFilterCount(); };
  const onReset = () => { reset(); updateFilterCount(); };

  // 조건 접기: 휴대폰에서는 처음에 접어 둔다
  const toggle = document.getElementById('filterToggle');
  const setFiltersOpen = open => {
    document.getElementById('filterGrid').hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.classList.toggle('open', open);
  };
  setFiltersOpen(!window.matchMedia('(max-width: 768px)').matches);
  toggle.addEventListener('click', () => setFiltersOpen(toggle.getAttribute('aria-expanded') !== 'true'));

  document.getElementById('btnResetFilter').addEventListener('click', onReset);

  // 고르는 즉시 결과에 반영한다
  ['filterYear', 'filterGrade', 'filterCategory', 'filterSubChapter', 'filterDifficulty', 'filterGeoTester']
    .forEach(id => document.getElementById(id).addEventListener('change', onApply));
  document.getElementById('filterChapter').addEventListener('change', () => {
    onChapterChange();
    onApply();
  });

  const keyword = document.getElementById('searchKeyword');
  let keywordTimer = null;
  keyword.addEventListener('input', () => {
    clearTimeout(keywordTimer);
    keywordTimer = setTimeout(onApply, 250);
  });
  keyword.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(keywordTimer);
      onApply();
    }
  });

  // 정답률 펼침 목록
  const selector = document.getElementById('accuracySelector');
  const group = document.getElementById('filterAccuracyGroup');
  const setOpen = open => {
    group.classList.toggle('open', open);
    selector.classList.toggle('open', open);
    selector.setAttribute('aria-expanded', String(open));
  };
  selector.addEventListener('click', () => setOpen(!group.classList.contains('open')));
  group.addEventListener('change', () => {
    updateAccuracyText();
    onApply();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && group.classList.contains('open')) {
      setOpen(false);
      selector.focus();
    }
  });
  document.addEventListener('click', e => {
    const dd = document.querySelector('.accuracy-dropdown');
    if (dd && !dd.contains(e.target)) setOpen(false);
  });
}

/** 고른 조건 수 (검색어 제외) */
export function updateFilterCount() {
  const ids = ['filterYear', 'filterGrade', 'filterCategory', 'filterChapter', 'filterSubChapter', 'filterDifficulty', 'filterGeoTester'];
  let n = ids.filter(id => document.getElementById(id)?.value).length;
  if (document.querySelector('#filterAccuracyGroup input:checked')) n++;
  const el = document.getElementById('filterCount');
  if (!el) return;
  el.hidden = n === 0;
  el.textContent = `${n}개`;
}

function updateAccuracyText() {
  const checked = document.querySelectorAll('#filterAccuracyGroup input:checked');
  const textEl = document.getElementById('accuracySelectorText');
  if (checked.length === 0) {
    textEl.textContent = '전체';
    textEl.classList.remove('selected');
  } else if (checked.length === 1) {
    textEl.textContent = document.querySelector(`label[for="${checked[0].id}"]`).textContent.trim();
    textEl.classList.add('selected');
  } else {
    textEl.textContent = `${checked.length}개 구간`;
    textEl.classList.add('selected');
  }
}

export function setGeoTesterFilterVisible(visible) {
  const group = document.getElementById('filterGeoTesterGroup');
  if (group) group.style.display = visible ? '' : 'none';
  if (!visible) document.getElementById('filterGeoTester').value = '';
}

export function setGradeFilterVisible(visible) {
  const group = document.getElementById('filterGradeGroup');
  if (group) group.style.display = visible ? '' : 'none';
  if (!visible) document.getElementById('filterGrade').value = '';
}

export function updateSubChapterOptions(allData, selectedChapter, linkerStore, subject) {
  const sel = document.getElementById('filterSubChapter');
  while (sel.options.length > 1) sel.remove(1);

  const filtered = selectedChapter
    ? allData.filter(d => d.대단원 === selectedChapter)
    : allData;

  const items = [...new Set(
    filtered.map(d => {
      if (linkerStore && subject) return linkerStore.getMapping(subject, d);
      return null;
    }).filter(Boolean)
  )].sort();

  items.forEach(v => sel.add(new Option(v, v)));
  sel.value = '';
}
