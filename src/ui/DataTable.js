import { isGeoTesterLoaded } from '../core/DataManager.js';

export function renderTableShell() {
  return `
    <div class="table-wrapper">
      <table id="dataTable">
        <thead>
          <tr>
            <th>학년도</th>
            <th>분류</th>
            <th>번호</th>
            <th>배점</th>
            <th>답</th>
            <th>대단원</th>
            <th>중단원</th>
            <th>발문</th>
            <th>문항 내용</th>
            <th class="sortable" data-sort="정답률">정답률(%)</th>
            <th>난이도</th>
            <th>문제보기</th>
            <th>GeoTester</th>
          </tr>
        </thead>
        <tbody id="tableBody">
          <tr><td colspan="13" class="loading">
            <div class="spinner"></div>
            데이터를 불러오는 중...
          </td></tr>
        </tbody>
      </table>
    </div>
  `;
}

export function renderTableRows(data, currentSubject) {
  const tbody = document.getElementById('tableBody');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="13" class="no-data">검색 결과가 없습니다</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(item => {
    const chapterNum = getChapterNumber(item.대단원);
    // Escape HTML to prevent XSS
    const safeBalm = escapeHtml(item.발문);
    const safeContent = escapeHtml(item.문항내용);
    const safeYear = escapeHtml(String(item.학년도));
    const safeCat = escapeHtml(item.분류);
    const safeNum = escapeHtml(String(item.번호));

    return `
      <tr data-subject="${escapeHtml(currentSubject)}" data-chapter-num="${chapterNum}">
        <td><strong>${safeYear}</strong></td>
        <td><span class="badge badge-${safeCat}">${safeCat}</span></td>
        <td>${safeNum}</td>
        <td><strong>${escapeHtml(String(item.배점))}</strong></td>
        <td><strong>${escapeHtml(String(item.답))}</strong></td>
        <td>${escapeHtml(item.대단원)}</td>
        <td>${escapeHtml(item.중단원)}</td>
        <td>${safeBalm}</td>
        <td>${safeContent}</td>
        <td class="${getAccuracyClass(item.정답률)}">${escapeHtml(String(item.정답률))}</td>
        <td class="${getDifficultyClass(item.난이도)}">${escapeHtml(item.난이도)}</td>
        <td><button class="btn-view" data-year="${safeYear}" data-cat="${safeCat}" data-num="${safeNum}">&#128196; 보기</button></td>
        <td>${getGeoTesterBadge(item.GeoTester)}</td>
      </tr>
    `;
  }).join('');
}

export function showLoading() {
  const tbody = document.getElementById('tableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="13" class="loading"><div class="spinner"></div>데이터를 불러오는 중...</td></tr>';
  }
}

export function bindTableEvents({ onSort, onViewQuestion }) {
  // Sort header click
  document.querySelector('#dataTable thead').addEventListener('click', e => {
    const th = e.target.closest('th.sortable');
    if (th) onSort(th.dataset.sort);
  });

  // View question button
  document.querySelector('#dataTable').addEventListener('click', e => {
    const btn = e.target.closest('.btn-view');
    if (btn) {
      onViewQuestion(btn.dataset.year, btn.dataset.cat, btn.dataset.num);
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
