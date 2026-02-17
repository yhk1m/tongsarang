import { renderHeader } from './Header.js';
import { renderSubjectNav, bindSubjectNav } from './SubjectNav.js';
import { renderFilterPanel, populateFilterOptions, bindFilterEvents, getFilterValues, resetFilterValues, updateSubChapterOptions, setGeoTesterFilterVisible } from './FilterPanel.js';
import { renderStatsBar, updateStats, updateResultCount } from './StatsBar.js';
import { renderTableShell, renderTableRows, showLoading, bindTableEvents, updateSortIndicators, GEOTESTER_SUBJECTS } from './DataTable.js';
import { renderModal, bindModalEvents, showImage } from './ImageModal.js';
import { Pagination } from './Pagination.js';
import { DataManager } from '../core/DataManager.js';
import { FilterManager } from '../core/FilterManager.js';

export class App {
  constructor(root) {
    this.root = root;
    this.dm = new DataManager();
    this.fm = new FilterManager();
    this.pagination = new Pagination();
    this.currentSubject = '한국지리';
    this.allData = [];
    this.filteredData = [];
  }

  async init() {
    this.render();
    this.bindEvents();
    await this.loadSubject(this.currentSubject);
  }

  render() {
    const subjects = this.dm.getSubjects();

    this.root.innerHTML = `
      <div class="container">
        ${renderHeader()}
        <div class="main-card">
          ${renderSubjectNav(subjects, this.currentSubject)}
          <div class="content">
            ${renderFilterPanel()}
            <div class="table-container">
              ${renderStatsBar()}
              <div id="tableShellContainer">${renderTableShell(this.currentSubject)}</div>
              <div id="paginationContainer"></div>
            </div>
          </div>
        </div>
      </div>
      ${renderModal()}
    `;
  }

  bindEvents() {
    bindSubjectNav(subject => this.switchSubject(subject));

    bindFilterEvents({
      onApply: () => this.applyFilters(),
      onReset: () => this.resetFilters(),
      onChapterChange: () => {
        const chapter = document.getElementById('filterChapter').value;
        updateSubChapterOptions(this.allData, chapter);
      }
    });

    this.bindTableDelegation();
    bindModalEvents();
  }

  bindTableDelegation() {
    bindTableEvents({
      onSort: col => this.handleSort(col),
      onViewQuestion: (y, c, n) => showImage(this.currentSubject, y, c, n)
    });
  }

  async switchSubject(subject) {
    this.currentSubject = subject;
    this.fm.resetSort();

    // Update active tab
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.subject === subject);
    });

    // Re-render table shell (GeoTester column may change)
    document.getElementById('tableShellContainer').innerHTML = renderTableShell(subject);
    this.bindTableDelegation();

    // Toggle GeoTester filter visibility
    const showGeo = GEOTESTER_SUBJECTS.has(subject);
    setGeoTesterFilterVisible(showGeo);

    resetFilterValues();
    await this.loadSubject(subject);
  }

  async loadSubject(subject) {
    showLoading();
    const showGeo = GEOTESTER_SUBJECTS.has(subject);
    setGeoTesterFilterVisible(showGeo);

    try {
      this.allData = await this.dm.loadSubject(subject);
      this.filteredData = this.allData;

      const options = this.dm.getFilterOptions(this.allData);
      populateFilterOptions(options);

      const stats = this.dm.getStats(this.allData);
      updateStats(stats, showGeo);

      this.pagination.reset(this.filteredData.length);
      this.renderData();
    } catch (err) {
      const cols = showGeo ? 13 : 12;
      document.getElementById('tableBody').innerHTML =
        `<tr><td colspan="${cols}" class="no-data">데이터 로드 실패: ${err.message}</td></tr>`;
    }
  }

  applyFilters() {
    const filters = getFilterValues();
    this.filteredData = this.fm.applyFilters(this.allData, filters);
    this.pagination.reset(this.filteredData.length);
    this.renderData();
  }

  resetFilters() {
    resetFilterValues();
    this.fm.resetSort();
    updateSortIndicators(null, null);
    updateSubChapterOptions(this.allData, '');
    this.filteredData = this.allData;
    this.pagination.reset(this.filteredData.length);
    this.renderData();
  }

  handleSort(column) {
    this.fm.toggleSort(column);
    updateSortIndicators(this.fm.sortColumn, this.fm.sortOrder);
    this.renderData();
  }

  renderData() {
    const sorted = this.fm.applySorting(this.filteredData);
    const pageData = this.pagination.getPageData(sorted);

    renderTableRows(pageData, this.currentSubject);
    updateResultCount(this.filteredData.length);

    // Pagination
    const pagContainer = document.getElementById('paginationContainer');
    pagContainer.innerHTML = this.pagination.render();
    this.pagination.bind(pagContainer, () => this.renderData());
  }
}
