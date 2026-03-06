import { isGeoTesterLoaded } from '../core/DataManager.js';
import { ACHIEVEMENT_STANDARDS } from '../data/achievementStandards.js';

const GEOTESTER_SUBJECTS = new Set(['한국지리', '세계지리', '통합사회']);

export function renderTableShell(subject) {
  const showGeo = GEOTESTER_SUBJECTS.has(subject);
  const cols = showGeo ? 13 : 12;
  return `
    <div class="table-wrapper">
      <table id="dataTable" data-cols="${cols}">
        <thead>
          <tr>
            <th>학년도</th>
            <th>분류</th>
            <th>번호</th>
            <th>배점</th>
            <th>답</th>
            <th>대단원</th>
            <th>성취기준</th>
            <th>발문</th>
            <th>문항 내용</th>
            <th class="sortable" data-sort="정답률">정답률(%)</th>
            <th>난이도</th>
            <th>문제보기</th>
            ${showGeo ? '<th>GeoTester</th>' : ''}
          </tr>
        </thead>
        <tbody id="tableBody">
          <tr><td colspan="${cols}" class="loading">
            <div class="spinner"></div>
            데이터를 불러오는 중...
          </td></tr>
        </tbody>
      </table>
    </div>
  `;
}

export function renderTableRows(data, currentSubject, linkerStore, devMode, editStore) {
  const tbody = document.getElementById('tableBody');
  const showGeo = GEOTESTER_SUBJECTS.has(currentSubject);
  const cols = showGeo ? 13 : 12;

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${cols}" class="no-data">검색 결과가 없습니다</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(item => {
    const chapterNum = getChapterNumber(item.대단원);
    const safeYear = escapeHtml(String(item.학년도));
    const safeCat = escapeHtml(item.분류);
    const safeNum = escapeHtml(String(item.번호));
    const editKey = `${safeYear}_${safeCat}_${safeNum}`;

    // use edited values if available (both admin and regular mode)
    const balmValue = editStore ? editStore.getFieldValue(currentSubject, item, '발문') : item.발문;
    const contentValue = editStore ? editStore.getFieldValue(currentSubject, item, '문항내용') : item.문항내용;
    const safeBalm = escapeHtml(balmValue);
    const safeContent = escapeHtml(contentValue);

    const balmEdited = devMode && editStore && editStore.hasEdit(currentSubject, item, '발문');
    const contentEdited = devMode && editStore && editStore.hasEdit(currentSubject, item, '문항내용');

    const standardId = (linkerStore ? linkerStore.getMapping(currentSubject, item) : null) || item.성취기준 || null;
    const standardText = standardId ? lookupStandardText(currentSubject, standardId) : '';
    const standardDisplay = standardId || '미연결';

    // dev mode edit buttons
    const balmEditBtn = devMode ? `<button class="btn-edit-field" data-year="${safeYear}" data-cat="${safeCat}" data-num="${safeNum}" data-field="발문" title="발문 수정">&#9998;</button>` : '';
    const contentEditBtn = devMode ? `<button class="btn-edit-field" data-year="${safeYear}" data-cat="${safeCat}" data-num="${safeNum}" data-field="문항내용" title="문항내용 수정">&#9998;</button>` : '';
    const stdEditBtn = devMode ? `<button class="btn-edit-std" data-year="${safeYear}" data-cat="${safeCat}" data-num="${safeNum}" title="성취기준 수정">&#9998;</button>` : '';
    const balmResetBtn = balmEdited ? `<button class="btn-reset-field" data-year="${safeYear}" data-cat="${safeCat}" data-num="${safeNum}" data-field="발문" title="원래대로">↩</button>` : '';
    const contentResetBtn = contentEdited ? `<button class="btn-reset-field" data-year="${safeYear}" data-cat="${safeCat}" data-num="${safeNum}" data-field="문항내용" title="원래대로">↩</button>` : '';

    return `
      <tr data-subject="${escapeHtml(currentSubject)}" data-chapter-num="${chapterNum}">
        <td><strong>${safeYear}</strong></td>
        <td><span class="badge badge-${safeCat}">${safeCat}</span></td>
        <td>${safeNum}</td>
        <td><strong>${escapeHtml(String(item.배점))}</strong></td>
        <td><strong>${escapeHtml(String(item.답))}</strong></td>
        <td>${escapeHtml(item.대단원)}</td>
        <td class="cell-expandable">${stdEditBtn}${escapeHtml(standardDisplay)}${standardText ? `<div class="std-detail">${escapeHtml(standardText)}</div><button class="btn-expand-std">더보기</button>` : ''}</td>
        <td class="cell-expandable${balmEdited ? ' cell-edited' : ''}" data-edit-key="${editKey}_발문"><div class="cell-text">${safeBalm}</div>${balmEditBtn}${balmResetBtn}<button class="btn-expand">더보기</button></td>
        <td class="cell-expandable${contentEdited ? ' cell-edited' : ''}" data-edit-key="${editKey}_문항내용"><div class="cell-text">${safeContent}</div>${contentEditBtn}${contentResetBtn}<button class="btn-expand">더보기</button></td>
        <td class="${getAccuracyClass(item.정답률)}">${escapeHtml(String(item.정답률))}</td>
        <td class="${getDifficultyClass(item.난이도)}">${escapeHtml(item.난이도)}</td>
        <td><button class="btn-view" data-year="${safeYear}" data-cat="${safeCat}" data-num="${safeNum}">&#128196; 보기</button></td>
        ${showGeo ? `<td>${getGeoTesterBadge(item.GeoTester)}</td>` : ''}
      </tr>
    `;
  }).join('');

  initExpandButtons();
}

function initExpandButtons() {
  document.querySelectorAll('#dataTable .cell-expandable').forEach(td => {
    const textDiv = td.querySelector('.cell-text');
    const btn = td.querySelector('.btn-expand');
    if (!textDiv || !btn) return;
    if (textDiv.scrollHeight > textDiv.clientHeight + 1) {
      btn.classList.add('visible');
    }
  });

  document.querySelectorAll('#dataTable .btn-expand-std').forEach(btn => {
    btn.classList.add('visible');
  });
}

export function showLoading() {
  const tbody = document.getElementById('tableBody');
  if (tbody) {
    const cols = document.getElementById('dataTable')?.dataset.cols || 13;
    tbody.innerHTML = `<tr><td colspan="${cols}" class="loading"><div class="spinner"></div>데이터를 불러오는 중...</td></tr>`;
  }
}

export function bindTableEvents({ onSort, onViewQuestion, onEditField, onEditStandard, onResetField }) {
  document.querySelector('#dataTable thead').addEventListener('click', e => {
    const th = e.target.closest('th.sortable');
    if (th) onSort(th.dataset.sort);
  });

  document.querySelector('#dataTable').addEventListener('click', e => {
    // Dev mode: reset field button
    if (onResetField) {
      const resetBtn = e.target.closest('.btn-reset-field');
      if (resetBtn) {
        onResetField(resetBtn.dataset.year, resetBtn.dataset.cat, resetBtn.dataset.num, resetBtn.dataset.field);
        return;
      }
    }

    // Dev mode: edit field button
    if (onEditField) {
      const editBtn = e.target.closest('.btn-edit-field');
      if (editBtn) {
        onEditField(editBtn.dataset.year, editBtn.dataset.cat, editBtn.dataset.num, editBtn.dataset.field);
        return;
      }
    }

    // Dev mode: edit standard button
    if (onEditStandard) {
      const stdEditBtn = e.target.closest('.btn-edit-std');
      if (stdEditBtn) {
        onEditStandard(stdEditBtn.dataset.year, stdEditBtn.dataset.cat, stdEditBtn.dataset.num);
        return;
      }
    }

    const btn = e.target.closest('.btn-view');
    if (btn) {
      onViewQuestion(btn.dataset.year, btn.dataset.cat, btn.dataset.num);
      return;
    }

    const expandBtn = e.target.closest('.btn-expand');
    if (expandBtn) {
      const td = expandBtn.closest('.cell-expandable');
      const isExpanded = td.classList.toggle('expanded');
      expandBtn.textContent = isExpanded ? '접기' : '더보기';
      return;
    }

    const stdBtn = e.target.closest('.btn-expand-std');
    if (stdBtn) {
      const td = stdBtn.closest('.cell-expandable');
      const isExpanded = td.classList.toggle('expanded');
      stdBtn.textContent = isExpanded ? '접기' : '더보기';
      return;
    }
  });
}

export function updateSortIndicators(column, order) {
  document.querySelectorAll('#dataTable thead th.sortable').forEach(th => {
    th.classList.remove('asc', 'desc');
    if (column && order && th.dataset.sort === column) {
      th.classList.add(order);
    }
  });
}

// Helpers
function lookupStandardText(subject, standardId) {
  const subjectData = ACHIEVEMENT_STANDARDS[subject];
  if (!subjectData || !standardId) return '';
  for (const area of subjectData.areas) {
    for (const s of area.standards) {
      if (s.id === standardId) return s.text;
    }
  }
  return '';
}

function getChapterNumber(chapter) {
  if (!chapter) return '';
  const match = chapter.match(/^(\d+)\./);
  return match ? match[1] : '';
}

function getAccuracyClass(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return '';
  if (num >= 80) return 'accuracy-high';
  if (num >= 50) return 'accuracy-medium';
  return 'accuracy-low';
}

function getDifficultyClass(val) {
  if (!val) return '';
  if (val.includes('상')) return 'difficulty-high';
  if (val.includes('중')) return 'difficulty-medium';
  if (val.includes('하')) return 'difficulty-low';
  return '';
}

function getGeoTesterBadge(value) {
  if (isGeoTesterLoaded(value)) {
    return '<span class="geotester-badge geotester-yes">&#10003; 탑재</span>';
  }
  return '<span class="geotester-badge geotester-no">-</span>';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export { GEOTESTER_SUBJECTS };
