import { renderHeader, renderFooter } from './Header.js';
import { renderSubjectNav, renderSubjectMenuButton, renderSubjectSheet, bindSubjectNav, setActiveSubject } from './SubjectNav.js';
import { renderFilterPanel, populateFilterOptions, bindFilterEvents, getFilterValues, resetFilterValues, updateSubChapterOptions, setGeoTesterFilterVisible, setGradeFilterVisible } from './FilterPanel.js';
import { renderStatsBar, updateStats, updateResultCount } from './StatsBar.js';
import { renderTableShell, renderTableRows, showLoading, bindTableEvents, updateSortIndicators, GEOTESTER_SUBJECTS, columnCount } from './DataTable.js';
import { renderModal, bindModalEvents, showImage, setNavList } from './ImageModal.js';
import { renderMockExamModal, bindMockExamEvents, openMockExam } from './MockExamModal.js';
import { renderLinkerModal, bindLinkerEvents, openLinkerForItem } from './LinkerModal.js';
import { renderReportModal, bindReportEvents, openReport } from './ReportModal.js';
import { Pagination } from './Pagination.js';
import { DataManager } from '../core/DataManager.js';
import { FilterManager } from '../core/FilterManager.js';
import { findQuestion, keyOf, GRADED_SUBJECTS } from '../core/questionKey.js';
import { LinkerStore } from '../core/LinkerStore.js';
import { EditStore } from '../core/EditStore.js';
import { renderDevToolbar, bindDevToolbarEvents, updateDevEditCount } from './DevToolbar.js';
import { trackVisit } from '../core/VisitorCounter.js';

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
    trackVisit();
  }

  _checkAdminMode() {
    const params = new URLSearchParams(window.location.search);
    const isAdmin = params.get('mode') === 'admin' || params.get('p') === 'admin';
    if (isAdmin) {
      const pw = prompt('관리자 비밀번호를 적어 주세요');
      if (pw === 'rs21') {
        this.adminMode = true;
      } else if (pw !== null) {
        alert('비밀번호가 맞지 않아요. 일반 화면으로 열게요.');
      }
    }
  }

  render() {
    const subjects = this.dm.getSubjects();

    this.root.innerHTML = `
      <div class="topbar">
        ${renderHeader(renderSubjectMenuButton(subjects, this.currentSubject))}
        ${renderSubjectNav(subjects, this.currentSubject)}
      </div>
      <main class="content">
        ${this.adminMode ? renderDevToolbar() : ''}
        ${renderFilterPanel()}
        <section class="table-container" aria-label="문항 목록">
          ${renderStatsBar()}
          <div id="tableShellContainer">${renderTableShell(this.currentSubject)}</div>
          <div id="paginationContainer"></div>
        </section>
      </main>
      ${renderFooter()}
      ${renderSubjectSheet(subjects, this.currentSubject)}
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
      onViewQuestion: ref => {
        const sorted = this.fm.applySorting(this.filteredData);
        setNavList(this.currentSubject, sorted);
        showImage(this.currentSubject, ref.year, ref.cat, ref.num, ref.grade);
      },
      onEditField: this.adminMode ? (ref, field) => {
        this._handleEditField(ref, field);
      } : null,
      onEditStandard: this.adminMode ? ref => {
        openLinkerForItem(this.currentSubject, ref);
      } : null,
      onResetField: this.adminMode ? (ref, field) => {
        this._handleResetField(ref, field);
      } : null
    });
  }

  _handleEditField(ref, field) {
    const item = findQuestion(this.allData, ref.year, ref.cat, ref.num, ref.grade);
    if (!item) return;

    const key = keyOf(ref.year, ref.cat, ref.num, ref.grade);
    const td = document.querySelector(`[data-edit-key="${key}_${field}"]`);
    if (!td || td.querySelector('.dev-edit-area')) return;

    const currentValue = this.editStore.getFieldValue(this.currentSubject, item, field);
    const isShortField = field === '배점' || field === '답';

    if (isShortField) {
      td.innerHTML = `
        <div class="dev-edit-area dev-edit-inline">
          <input type="text" class="dev-edit-input" value="${escapeHtmlForTextarea(String(currentValue))}" />
          <div class="dev-edit-actions">
            <button class="dev-edit-save">저장</button>
            <button class="dev-edit-cancel">취소</button>
          </div>
        </div>
      `;

      const input = td.querySelector('.dev-edit-input');
      input.focus();
      input.select();

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          td.querySelector('.dev-edit-save').click();
        } else if (e.key === 'Escape') {
          td.querySelector('.dev-edit-cancel').click();
        }
      });

      td.querySelector('.dev-edit-save').addEventListener('click', () => {
        const newValue = input.value.trim();
        this.editStore.setEdit(this.currentSubject, item, field, newValue);
        this.renderData();
        updateDevEditCount(this.editStore, this.linkerStore, this.currentSubject);
      });

      td.querySelector('.dev-edit-cancel').addEventListener('click', () => {
        this.renderData();
      });
    } else {
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
  }

  _handleResetField(ref, field) {
    const item = findQuestion(this.allData, ref.year, ref.cat, ref.num, ref.grade);
    if (!item) return;
    this.editStore.removeEdit(this.currentSubject, item, field);
    this.renderData();
  }

  async switchSubject(subject) {
    this.currentSubject = subject;
    this.fm.resetSort();

    // 탭, 휴대폰 과목 목록, 햄버거 버튼 이름
    const subj = this.dm.getSubjects().find(s => s.id === subject);
    setActiveSubject(subject, subj?.label);

    // Re-render table shell (GeoTester column may change)
    document.getElementById('tableShellContainer').innerHTML = renderTableShell(subject);
    this.bindTableDelegation();

    // Toggle GeoTester / 학년 filter visibility
    const showGeo = GEOTESTER_SUBJECTS.has(subject);
    setGeoTesterFilterVisible(showGeo);
    setGradeFilterVisible(GRADED_SUBJECTS.has(subject));

    resetFilterValues();
    await this.loadSubject(subject);
  }

  async loadSubject(subject) {
    showLoading();
    const showGeo = GEOTESTER_SUBJECTS.has(subject);
    setGeoTesterFilterVisible(showGeo);
    setGradeFilterVisible(GRADED_SUBJECTS.has(subject));

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
      const cols = columnCount(subject);
      document.getElementById('tableBody').innerHTML =
        `<tr><td colspan="${cols}" class="no-data"><strong>문항을 불러오지 못했어요</strong><span>인터넷 연결을 확인하고 다른 과목을 눌렀다가 다시 눌러 주세요.</span></td></tr>`;
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
