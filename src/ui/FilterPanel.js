export function renderFilterPanel() {
  return `
    <div class="filter-section">
      <div class="filter-title">
        <div class="filter-title-text">
          <span class="filter-icon">&#128269;</span> 필터 및 검색
        </div>
        <div class="filter-title-buttons">
          <button class="btn btn-primary" id="btnApplyFilter">&#10003; 필터 적용</button>
          <button class="btn btn-secondary" id="btnResetFilter">&#8634; 초기화</button>
        </div>
      </div>
      <div class="filter-grid">
        <div class="filter-group">
          <label>학년도</label>
          <select id="filterYear"><option value="">전체</option></select>
        </div>
        <div class="filter-group">
          <label>분류</label>
          <select id="filterCategory"><option value="">전체</option></select>
        </div>
        <div class="filter-group">
          <label>대단원</label>
          <select id="filterChapter"><option value="">전체</option></select>
        </div>
        <div class="filter-group">
          <label>중단원</label>
          <select id="filterSubChapter"><option value="">전체</option></select>
        </div>
        <div class="filter-group">
          <label>난이도</label>
          <select id="filterDifficulty"><option value="">전체</option></select>
        </div>
        <div class="filter-group" id="filterGeoTesterGroup" style="display:none">
          <label>GeoTester</label>
          <select id="filterGeoTester">
            <option value="">전체</option>
            <option value="yes">탑재됨</option>
            <option value="no">미탑재</option>
          </select>
        </div>
        <div class="filter-group">
          <label>정답률</label>
          <div class="accuracy-dropdown">
            <div class="accuracy-selector" id="accuracySelector">
              <span class="accuracy-selector-text" id="accuracySelectorText">선택 안 함</span>
              <span class="accuracy-selector-arrow">&#9660;</span>
            </div>
            <div class="checkbox-group" id="filterAccuracyGroup">
              ${renderAccuracyCheckboxes()}
            </div>
          </div>
        </div>
        <div class="filter-group">
          <label>키워드 검색</label>
          <input type="text" id="searchKeyword" placeholder="발문, 문항 내용 검색...">
        </div>
      </div>
    </div>
  `;
}

function renderAccuracyCheckboxes() {
  const ranges = [
    { id: 'acc_0_20', value: '0-20', label: '20% 이하' },
    { id: 'acc_21_30', value: '21-30', label: '21-30%' },
    { id: 'acc_31_40', value: '31-40', label: '31-40%' },
    { id: 'acc_41_50', value: '41-50', label: '41-50%' },
    { id: 'acc_51_60', value: '51-60', label: '51-60%' },
    { id: 'acc_61_70', value: '61-70', label: '61-70%' },
    { id: 'acc_71_80', value: '71-80', label: '71-80%' },
    { id: 'acc_81_90', value: '81-90', label: '81-90%' },
    { id: 'acc_91_100', value: '91-100', label: '91-100%' }
  ];
  return ranges.map(r => `
    <div class="checkbox-item">
      <input type="checkbox" id="${r.id}" value="${r.value}">
      <label for="${r.id}">${r.label}</label>
    </div>
  `).join('');
}

export function populateFilterOptions(options) {
  fillSelect('filterYear', options.학년도);
  fillSelect('filterCategory', options.분류);
  fillSelect('filterChapter', options.대단원);
  fillSelect('filterSubChapter', options.중단원);
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
    분류: document.getElementById('filterCategory').value,
    대단원: document.getElementById('filterChapter').value,
    중단원: document.getElementById('filterSubChapter').value,
    난이도: document.getElementById('filterDifficulty').value,
    GeoTester: document.getElementById('filterGeoTester').value,
    정답률범위: Array.from(accChecked).map(cb => cb.value),
    키워드: document.getElementById('searchKeyword').value
  };
}

export function resetFilterValues() {
  document.getElementById('filterYear').value = '';
  document.getElementById('filterCategory').value = '';
  document.getElementById('filterChapter').value = '';
  document.getElementById('filterSubChapter').value = '';
  document.getElementById('filterDifficulty').value = '';
  document.getElementById('filterGeoTester').value = '';
  document.getElementById('searchKeyword').value = '';
  document.querySelectorAll('#filterAccuracyGroup input').forEach(cb => cb.checked = false);
  updateAccuracyText();
}

export function bindFilterEvents({ onApply, onReset, onChapterChange }) {
  document.getElementById('btnApplyFilter').addEventListener('click', onApply);
  document.getElementById('btnResetFilter').addEventListener('click', onReset);
  document.getElementById('filterChapter').addEventListener('change', onChapterChange);

  // Accuracy dropdown toggle
  document.getElementById('accuracySelector').addEventListener('click', () => {
    document.getElementById('filterAccuracyGroup').classList.toggle('open');
    document.getElementById('accuracySelector').classList.toggle('open');
  });

  // Update accuracy text on check
  document.getElementById('filterAccuracyGroup').addEventListener('change', updateAccuracyText);

  // Close accuracy dropdown on outside click
  document.addEventListener('click', e => {
    const dd = document.querySelector('.accuracy-dropdown');
    if (dd && !dd.contains(e.target)) {
      document.getElementById('filterAccuracyGroup').classList.remove('open');
      document.getElementById('accuracySelector').classList.remove('open');
    }
  });
}

function updateAccuracyText() {
  const checked = document.querySelectorAll('#filterAccuracyGroup input:checked');
  const textEl = document.getElementById('accuracySelectorText');
  if (checked.length === 0) {
    textEl.textContent = '선택 안 함';
    textEl.classList.remove('selected');
  } else if (checked.length === 1) {
    textEl.textContent = document.querySelector(`label[for="${checked[0].id}"]`).textContent;
    textEl.classList.add('selected');
  } else {
    textEl.textContent = `${checked.length}개 선택됨`;
    textEl.classList.add('selected');
  }
}

export function setGeoTesterFilterVisible(visible) {
  const group = document.getElementById('filterGeoTesterGroup');
  if (group) group.style.display = visible ? '' : 'none';
  if (!visible) document.getElementById('filterGeoTester').value = '';
}

export function updateSubChapterOptions(allData, selectedChapter) {
  const sel = document.getElementById('filterSubChapter');
  while (sel.options.length > 1) sel.remove(1);

  let items;
  if (selectedChapter) {
    items = [...new Set(
      allData.filter(d => d.대단원 === selectedChapter).map(d => d.중단원).filter(Boolean)
    )].sort();
  } else {
    items = [...new Set(allData.map(d => d.중단원).filter(Boolean))].sort();
  }
  items.forEach(v => sel.add(new Option(v, v)));
  sel.value = '';
}
