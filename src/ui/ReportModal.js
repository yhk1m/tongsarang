import { submitReport, fetchReports } from '../core/ReportAPI.js';

const SUBJECTS = [
  '한국지리', '세계지리', '통합사회', '정치와법', '사회문화',
  '경제', '생활과윤리', '윤리와사상', '동아시아사', '세계사', '한국사'
];

export function renderReportModal() {
  return `
    <div id="reportModal" class="report-modal">
      <div class="report-card">
        <div class="report-header">
          <h2>오류 제보</h2>
          <button class="report-close" id="reportClose">&times;</button>
        </div>
        <div class="report-tabs">
          <button class="report-tab active" data-tab="form">오류 제보</button>
          <button class="report-tab" data-tab="list">제보 내역</button>
        </div>
        <div class="report-body" id="reportBody"></div>
      </div>
    </div>
  `;
}

let adminMode = false;

export function bindReportEvents(isAdmin) {
  adminMode = isAdmin;
  const modal = document.getElementById('reportModal');
  document.getElementById('reportClose').addEventListener('click', closeReport);
  modal.addEventListener('click', e => {
    if (e.target === modal) closeReport();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeReport();
  });
  document.querySelector('.report-card').addEventListener('click', e => e.stopPropagation());

  // Tab switching
  modal.querySelectorAll('.report-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      modal.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'form') renderFormTab();
      else renderListTab();
    });
  });
}

export function openReport() {
  document.getElementById('reportModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Reset to form tab
  const modal = document.getElementById('reportModal');
  modal.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
  modal.querySelector('[data-tab="form"]').classList.add('active');
  renderFormTab();
}

function closeReport() {
  document.getElementById('reportModal').classList.remove('open');
  document.body.style.overflow = '';
}

function renderFormTab() {
  const body = document.getElementById('reportBody');
  body.innerHTML = `
    <form id="reportForm" class="report-form">
      <div class="report-field">
        <label for="reportSubject">과목 <span class="required">*</span></label>
        <select id="reportSubject" required>
          <option value="">선택하세요</option>
          ${SUBJECTS.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
        </select>
      </div>
      <div class="report-row">
        <div class="report-field">
          <label for="reportYear">학년도 <span class="required">*</span></label>
          <input type="text" id="reportYear" placeholder="예: 2025" required>
        </div>
        <div class="report-field">
          <label for="reportCat">분류 <span class="required">*</span></label>
          <input type="text" id="reportCat" placeholder="예: 수능, 6월" required>
        </div>
        <div class="report-field">
          <label for="reportNum">번호 <span class="required">*</span></label>
          <input type="text" id="reportNum" placeholder="예: 5" required>
        </div>
      </div>
      <div class="report-field">
        <label for="reportContent">오류 내용 <span class="required">*</span></label>
        <textarea id="reportContent" rows="4" placeholder="발견한 오류를 설명해 주세요" required></textarea>
      </div>
      <details class="report-details">
        <summary>제보자 정보 (선택)</summary>
        <div class="report-details-inner">
          <div class="report-row">
            <div class="report-field">
              <label for="reportName">이름</label>
              <input type="text" id="reportName" placeholder="이름">
            </div>
            <div class="report-field">
              <label for="reportSchool">소속</label>
              <input type="text" id="reportSchool" placeholder="소속">
            </div>
          </div>
          <div class="report-row">
            <div class="report-field">
              <label for="reportTeachSubject">담당과목</label>
              <input type="text" id="reportTeachSubject" placeholder="담당과목">
            </div>
            <div class="report-field">
              <label for="reportRole">직위</label>
              <select id="reportRole">
                <option value="">선택하세요</option>
                <option value="교사">교사</option>
                <option value="학생">학생</option>
              </select>
            </div>
          </div>
        </div>
      </details>
      <button type="submit" class="btn btn-primary report-submit">제보하기</button>
      <div id="reportMsg" class="report-msg"></div>
    </form>
  `;

  document.getElementById('reportForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msgEl = document.getElementById('reportMsg');
    const submitBtn = body.querySelector('.report-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = '전송 중...';
    msgEl.textContent = '';
    msgEl.className = 'report-msg';

    const data = {
      과목: document.getElementById('reportSubject').value,
      학년도: document.getElementById('reportYear').value,
      분류: document.getElementById('reportCat').value,
      번호: document.getElementById('reportNum').value,
      오류내용: document.getElementById('reportContent').value,
      이름: document.getElementById('reportName').value,
      소속: document.getElementById('reportSchool').value,
      담당과목: document.getElementById('reportTeachSubject').value,
      직위: document.getElementById('reportRole').value
    };

    try {
      await submitReport(data);
      msgEl.textContent = '제보가 접수되었습니다. 감사합니다!';
      msgEl.classList.add('success');
      document.getElementById('reportForm').reset();
    } catch (err) {
      msgEl.textContent = '전송 실패: ' + err.message;
      msgEl.classList.add('error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '제보하기';
    }
  });
}

function renderListTab() {
  const body = document.getElementById('reportBody');
  body.innerHTML = '<div class="report-loading"><div class="spinner"></div>제보 내역을 불러오는 중...</div>';

  fetchReports().then(rows => {
    if (!rows || rows.length === 0) {
      body.innerHTML = '<div class="report-empty">제보 내역이 없습니다.</div>';
      return;
    }

    // Sort newest first
    const sorted = [...rows].reverse();

    let html = '';
    if (adminMode) {
      html += '<div class="report-list-actions"><button class="btn btn-secondary" id="reportCsvDownload">CSV 다운로드</button></div>';
    }

    html += `
      <div class="report-table-wrapper">
        <table class="report-table">
          <thead>
            <tr>
              <th>일시</th>
              <th>과목</th>
              <th>학년도</th>
              <th>분류</th>
              <th>번호</th>
              <th>오류내용</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(r => `
              <tr>
                <td class="report-td-date">${esc(r.timestamp || '')}</td>
                <td>${esc(r.과목 || '')}</td>
                <td>${esc(r.학년도 || '')}</td>
                <td>${esc(r.분류 || '')}</td>
                <td>${esc(r.번호 || '')}</td>
                <td class="report-td-content">${esc(r.오류내용 || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    body.innerHTML = html;

    if (adminMode) {
      document.getElementById('reportCsvDownload')?.addEventListener('click', () => {
        downloadCSV(rows);
      });
    }
  }).catch(err => {
    body.innerHTML = `<div class="report-empty">조회 실패: ${esc(err.message)}</div>`;
  });
}

function downloadCSV(rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(','))
  ];
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tongsarang_reports_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
