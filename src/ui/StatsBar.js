// © 2026 김용현
export function renderStatsBar() {
  return `
    <div class="table-header">
      <p class="table-summary">
        전체 <strong id="totalCount" class="num">-</strong>문항 중
        <strong id="resultCount" class="num">0</strong>문항을 보고 있어요
      </p>
      <span class="geotester-stat" id="geoTesterStat" style="display:none">
        GeoTester에 올린 문항 <strong id="geoTesterCount" class="num">-</strong>개
      </span>
    </div>
  `;
}

export function updateStats(stats, showGeoTester) {
  document.getElementById('totalCount').textContent = stats.총문제수.toLocaleString();
  const geoStat = document.getElementById('geoTesterStat');
  if (showGeoTester) {
    geoStat.style.display = '';
    document.getElementById('geoTesterCount').textContent = stats.GeoTester탑재수.toLocaleString();
  } else {
    geoStat.style.display = 'none';
  }
}

export function updateResultCount(count) {
  document.getElementById('resultCount').textContent = count.toLocaleString();
}
