export function renderStatsBar() {
  return `
    <div class="table-header">
      <div class="table-title">&#128203; 문제 목록</div>
      <div class="table-stats">
        <span class="stat-item">총 문제 수: <strong id="totalCount">-</strong></span>
        <span class="geotester-stat">
          GeoTester 탑재: <strong id="geoTesterCount">-</strong>
        </span>
        <span class="result-count" id="resultCount">검색 결과: 0개</span>
      </div>
    </div>
  `;
}

export function updateStats(stats) {
  document.getElementById('totalCount').textContent = stats.총문제수;
  document.getElementById('geoTesterCount').textContent = stats.GeoTester탑재수;
}

export function updateResultCount(count) {
  document.getElementById('resultCount').textContent = `검색 결과: ${count}개`;
}
