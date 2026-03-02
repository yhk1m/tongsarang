import { renderHeader } from './Header.js';
import { renderSubjectNav, bindSubjectNav } from './SubjectNav.js';
import { renderFilterPanel, populateFilterOptions, bindFilterEvents, getFilterValues, resetFilterValues, updateSubChapterOptions, setGeoTesterFilterVisible } from './FilterPanel.js';
import { renderStatsBar, updateStats, updateResultCount } from './StatsBar.js';
import { renderTableShell, renderTableRows, showLoading, bindTableEvents, updateSortIndicators, GEOTESTER_SUBJECTS } from './DataTable.js';
import { renderModal, bindModalEvents, showImage, setNavList } from './ImageModal.js';
import { renderMockExamModal, bindMockExamEvents, openMockExam } from './MockExamModal.js';
import { renderLinkerModal, bindLinkerEvents, openLinkerForItem } from './LinkerModal.js';
import { renderReportModal, bindReportEvents, openReport } from './ReportModal.js';
import { Pagination } from './Pagination.js';
import { DataManager } from '../core/DataManager.js';
import { FilterManager } from '../core/FilterManager.js';
import { LinkerStore } from '../core/LinkerStore.js';
import { EditStore } from '../core/EditStore.js';
import { renderDevToolbar, bindDevToolbarEvents, updateDevEditCount } from './DevToolbar.js';

function escapeHtmlForTextarea(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class App {
  constructor(root) {
    this.root = root;
    this.dm = new DataManager();
    this.fm = new FilterManager();
    this.pagination = new Pagination();
    this.linkerStore = new LinkerStore();
    this.editStore = new EditStore();
    this.currentSubject = '통합사회';
    this.allData = [];
    this.filteredData = [];
    this.adminMode = false;
  }

  async init() {
    this._checkAdminMode();
    this.render();
    this.bindEvents();
    await this.linkerStore.loadDefaults();
    await this.loadSubject(this.currentSubject);
  }

  _checkAdminMode() {
    const params = new URLSearchParams(window.location.search);
    const isAdmin = params.get('mode') === 'admin' || params.get('p') === 'admin';
    if (isAdmin) {
      const pw = prompt('관리자 모드 비밀번호를 입력하세요');
      if (pw === 'rs21') {
        this.adminMode = true;
      } else if (pw !== null) {
        alert('비밀번호가 틀렸습니다.');
      }
    }
  }

  render() {
    const subjects = this.dm.getSubjects();

    this.root.innerHTML = `
      <div class="container">
        ${renderHeader()}
        <div class="main-card">
          ${renderSubjectNav(subjects, this.currentSubject)}
          <div class="content">
            ${this.adminMode ? renderDevToolbar() : ''}
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
      ${renderMockExamModal()}
      ${renderLinkerModal()}
      ${renderReportModal()}
    `;
  }

  bindEvents() {
    bindSubjectNav(subject => this.switchSubject(subject));

    bindFilterEvents({
      onApply: () => this.applyFilters(),
      onReset: () => this.resetFilters(),
      onChapterChange: () => {
        const chapter = document.getElementById('filterChapter').value;
        updateSubChapterOptions(this.allData, chapter, this.linkerStore, this.currentSubject);
      }
    });

    this.bindTableDelegation();
    bindModalEvents();
    bindMockExamEvents();
    bindLinkerEvents(this.linkerStore, this.dm, () => this.onLinkerClose());
    bindReportEvents(this.adminMode);

    document.getElementById('btnMockExam').addEventListener('click', () => {
      openMockExam(this.currentSubject, this.dm, this.linkerStore);
    });

    document.getElementById('btnReport').addEventListener('click', () => {
      openReport();
    });

    if (this.adminMode) {
      bindDevToolbarEvents(this.editStore, this.linkerStore, () => {
        this.onLinkerClose();
        updateDevEditCount(this.editStore, this.linkerStore, this.currentSubject);
      }, () => this.currentSubject);
    }
  }

  bindTableDelegation() {
    bindTableEvents({
      onSort: col => this.handleSort(col),
      onViewQuestion: (y, c, n) => {
        const sorted = this.fm.applySorting(this.filteredData);
        setNavList(this.currentSubject, sorted);
        showImage(this.currentSubject, y, c, n);
      },
      onEditField: this.adminMode ? (year, cat, num, field) => {
        this._handleEditField(year, cat, num, field);
      } : null,
      onEditStandard: this.adminMode ? (year, cat, num) => {
        openLinkerForItem(this.currentSubject, year, cat, num);
      } : null,
      onResetField: this.adminMode ? (year, cat, num, field) => {
        this._handleResetField(year, cat, num, field);
      } : null
    });
  }

  _handleEditField(year, cat, num, field) {
    const item = this.allData.find(
      i => String(i.학년도) === year && i.분류 === cat && String(i.번호) === num
    );
    if (!item) return;

    const key = `${year}_${cat}_${num}`;
    const td = document.querySelector(`[data-edit-key="${key}_${field}"]`);
    if (!td || td.querySelector('.dev-edit-area')) return;

    const currentValue = this.editStore.getFieldValue(this.currentSubject, item, field);

    td.innerHTML = `
      <div class="dev-edit-area">
        <textarea class="dev-edit-textarea">${escapeHtmlForTextarea(currentValue)}</textarea>
        <div class="dev-edit-actions">
          <button class="dev-edit-save">저장</button>
          <button class="dev-edit-cancel">취소</button>
        </div>
      </div>
    `;

    const textarea = td.querySelector('.dev-edit-textarea');
    textarea.focus();

    td.querySelector('.dev-edit-save').addEventListener('click', () => {
      const newValue = textarea.value;
      this.editStore.setEdit(this.currentSubject, item, field, newValue);
      this.renderData();
      updateDevEditCount(this.editStore, this.linkerStore, this.currentSubject);
    });

    td.querySelector('.dev-edit-cancel').addEventListener('click', () => {
      this.renderData();
    });
  }

  _handleResetField(year, cat, num, field) {
    const item = this.allData.find(
      i => String(i.학년도) === year && i.분류 === cat && String(i.번호) === num
    );
    if (!item) return;
    this.editStore.removeEdit(this.currentSubject, item, field);
    this.renderData();
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

      const options = this.dm.getFilterOptions(this.allData, this.linkerStore, this.currentSubject);
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
    this.filteredData = this.fm.applyFilters(this.allData, filters, this.linkerStore, this.currentSubject);
    this.pagination.reset(this.filteredData.length);
    this.renderData();
  }

  resetFilters() {
    resetFilterValues();
    this.fm.resetSort();
    updateSortIndicators(null, null);
    updateSubChapterOptions(this.allData, '', this.linkerStore, this.currentSubject);
    this.filteredData = this.allData;
    this.pagination.reset(this.filteredData.length);
    this.renderData();
  }

  handleSort(column) {
    this.fm.toggleSort(column);
    updateSortIndicators(this.fm.sortColumn, this.fm.sortOrder);
    this.renderData();
  }

  onLinkerClose() {
    // 성취기준 연결 변경 반영: 필터 옵션 갱신 + 테이블 다시 렌더
    const options = this.dm.getFilterOptions(this.allData, this.linkerStore, this.currentSubject);
    populateFilterOptions(options);
    const chapter = document.getElementById('filterChapter').value;
    updateSubChapterOptions(this.allData, chapter, this.linkerStore, this.currentSubject);
    this.applyFilters();
  }

  renderData() {
    const sorted = this.fm.applySorting(this.filteredData);
    const pageData = this.pagination.getPageData(sorted);

    renderTableRows(pageData, this.currentSubject, this.linkerStore, this.adminMode, this.editStore);
    updateResultCount(this.filteredData.length);

    if (this.adminMode) {
      updateDevEditCount(this.editStore, this.linkerStore, this.currentSubject);
    }

    // Pagination
    const pagContainer = document.getElementById('paginationContainer');
    pagContainer.innerHTML = this.pagination.render();
    this.pagination.bind(pagContainer, () => this.renderData());
  }
}
