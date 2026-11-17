import { submitReport, fetchReports, updateReport } from '../core/ReportAPI.js';
import { icon } from './icons.js';

const SUBJECTS = [
  '한국지리', '세계지리', '통합사회', '정치와법', '사회문화',
  '경제', '생활과윤리', '윤리와사상', '동아시아사', '세계사', '한국사'
];

export function renderReportModal() {
  return `
    <div id="reportModal" class="report-modal">
      <div class="report-card" role="dialog" aria-modal="true" aria-labelledby="reportTitle">
        <div class="report-header">
          <h2 id="reportTitle">오류 제보</h2>
          <button class="report-close" id="reportClose" aria-label="닫기">${icon.close(20)}</button>
        </div>
        <div class="report-tabs" role="tablist">
          <button class="report-tab active" data-tab="form" role="tab">제보하기</button>
          <button class="report-tab" data-tab="list" role="tab">지금까지 들어온 제보</button>
        </div>
        <div class="report-body" id="reportBody"></div>
      </div>
    </div>
  `;
}

let adminMode = false;
let reportListState = { rows: null, sorted: null, page: 1, pageSize: 10 };

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
        <label for="reportSubject">과목</label>
        <select id="reportSubject" required>
          <option value="">과목 고르기</option>
          ${SUBJECTS.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
        </select>
      </div>
      <div class="report-row">
        <div class="report-field">
          <label for="reportYear">학년도</label>
          <input type="text" id="reportYear" inputmode="numeric" placeholder="2025" required>
        </div>
        <div class="report-field">
          <label for="reportCat">분류</label>
          <input type="text" id="reportCat" placeholder="수능, 6월" required>
        </div>
        <div class="report-field">
          <label for="reportNum">번호</label>
          <input type="text" id="reportNum" inputmode="numeric" placeholder="5" required>
        </div>
      </div>
      <div class="report-field">
        <label for="reportContent">어떤 오류인가요?</label>
        <textarea id="reportContent" rows="4" placeholder="정답이 틀렸어요, 그림이 잘렸어요처럼 적어 주세요" required></textarea>
      </div>
      <div class="report-section-label">제보한 분 정보 <span>적지 않아도 돼요. 답을 드릴 때만 써요.</span></div>
      <div class="report-row">
        <div class="report-field">
          <label for="reportName">이름</label>
          <input type="text" id="reportName" autocomplete="name">
        </div>
        <div class="report-field">
          <label for="reportSchool">소속</label>
          <input type="text" id="reportSchool" autocomplete="organization">
        </div>
      </div>
      <div class="report-field">
        <label for="reportContact">연락처</label>
        <input type="text" id="reportContact" placeholder="전화번호 또는 이메일 주소">
      </div>
      <div class="report-row">
        <div class="report-field">
          <label for="reportTeachSubject">담당과목</label>
          <input type="text" id="reportTeachSubject" placeholder="없으면 비워 두세요">
        </div>
        <div class="report-field">
          <label for="reportRole">직위</label>
          <select id="reportRole">
            <option value="">고르기</option>
            <option value="교사">교사</option>
            <option value="학생">학생</option>
            <option value="__custom__">그 밖에 (직접 적기)</option>
          </select>
          <input type="text" id="reportRoleCustom" placeholder="직위 적기" style="display:none">
        </div>
      </div>
      <button type="submit" class="btn btn-primary report-submit">제보 보내기</button>
      <div id="reportMsg" class="report-msg"></div>
    </form>
  `;

  document.getElementById('reportRole').addEventListener('change', e => {
    const custom = document.getElementById('reportRoleCustom');
    if (e.target.value === '__custom__') {
      custom.style.display = '';
      custom.focus();
    } else {
      custom.style.display = 'none';
      custom.value = '';
    }
  });

  document.getElementById('reportForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msgEl = document.getElementById('reportMsg');
    const submitBtn = body.querySelector('.report-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = '보내고 있어요';
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
      연락처: document.getElementById('reportContact').value,
      담당과목: document.getElementById('reportTeachSubject').value,
      직위: document.getElementById('reportRole').value === '__custom__'
        ? document.getElementById('reportRoleCustom').value
        : document.getElementById('reportRole').value
    };

    try {
      await submitReport(data);
      msgEl.textContent = '제보를 받았어요. 고맙습니다. 확인하면 아래 제보 목록에 처리 상태를 적어 둘게요.';
      msgEl.classList.add('success');
      document.getElementById('reportForm').reset();
    } catch (err) {
      msgEl.textContent = '제보를 보내지 못했어요. 인터넷 연결을 확인하고 다시 보내 주세요.';
      msgEl.classList.add('error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '제보 보내기';
    }
  });
}

function renderListTab() {
  const body = document.getElementById('reportBody');
  body.innerHTML = '<div class="report-loading"><div class="spinner"></div>제보 목록을 불러오고 있어요</div>';

  fetchReports().then(rows => {
    if (!rows || rows.length === 0) {
      body.innerHTML = '<div class="report-empty"><strong>아직 들어온 제보가 없어요</strong><span>오류를 보셨다면 제보하기 탭에서 알려 주세요.</span></div>';
      return;
    }

    const sorted = rows.map((r, i) => ({ ...r, _rowIndex: i })).reverse();
    reportListState.rows = rows;
    reportListState.sorted = sorted;
    reportListState.page = 1;
    renderReportListPage();
  }).catch(err => {
    body.innerHTML = `<div class="report-empty"><strong>제보 목록을 불러오지 못했어요</strong><span>잠시 뒤 탭을 다시 눌러 주세요.</span></div>`;
  });
}

function renderReportListPage() {
  const body = document.getElementById('reportBody');
  const { rows, sorted, page, pageSize } = reportListState;
  const totalPages = Math.ceil(sorted.length / pageSize);
  const start = (page - 1) * pageSize;
  const pageData = sorted.slice(start, start + pageSize);

  let html = '';

  // Top bar: actions + pagination controls
  html += `<div class="report-list-topbar">`;
  if (adminMode) {
    html += `<button class="btn btn-secondary" id="reportCsvDownload">${icon.download()}CSV로 내려받기</button>`;
  }
  html += `
    <div class="report-pagination">
      <span class="report-page-info">모두 ${sorted.length}건</span>
      <select class="report-page-size" id="reportPageSize">
        ${[10, 20, 50].map(s => `<option value="${s}" ${pageSize === s ? 'selected' : ''}>${s}개씩</option>`).join('')}
      </select>
      <div class="report-page-nav">
        <button class="report-page-btn" id="reportPagePrev" aria-label="이전 쪽" ${page <= 1 ? 'disabled' : ''}>${icon.chevronLeft()}</button>
        <span class="report-page-current">${page} / ${totalPages}</span>
        <button class="report-page-btn" id="reportPageNext" aria-label="다음 쪽" ${page >= totalPages ? 'disabled' : ''}>${icon.chevronRight()}</button>
      </div>
    </div>
  </div>`;

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
            <th>오류 내용</th>
            <th>처리 상태</th>
            <th>답변</th>
          </tr>
        </thead>
        <tbody>
          ${pageData.map(r => `
            <tr data-row-index="${r._rowIndex}">
              <td class="report-td-date">${formatDate(r.timestamp)}</td>
              <td>${esc(r.과목 || '')}</td>
              <td>${esc(r.학년도 || '')}</td>
              <td>${esc(r.분류 || '')}</td>
              <td>${esc(r.번호 || '')}</td>
              <td class="report-td-desc">${r.오류내용 ? `<div class="report-desc-clamp">${esc(r.오류내용)}</div><button class="report-desc-toggle" type="button">더보기</button>` : ''}</td>
              <td class="report-td-status">${adminMode ? renderStatusEditable(r.처리상태, r._rowIndex) : renderStatus(r.처리상태)}</td>
              <td class="report-td-desc">${renderDescCell(r.상세설명, r._rowIndex)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  body.innerHTML = html;

  // Bind expand toggles
  body.querySelectorAll('.report-desc-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const clamp = btn.previousElementSibling;
      const expanded = clamp.classList.toggle('expanded');
      btn.textContent = expanded ? '접기' : '더보기';
    });
  });

  // Bind pagination controls
  document.getElementById('reportPageSize').addEventListener('change', e => {
    reportListState.pageSize = parseInt(e.target.value);
    reportListState.page = 1;
    renderReportListPage();
  });
  document.getElementById('reportPagePrev').addEventListener('click', () => {
    if (reportListState.page > 1) {
      reportListState.page--;
      renderReportListPage();
    }
  });
  document.getElementById('reportPageNext').addEventListener('click', () => {
    const totalPages = Math.ceil(reportListState.sorted.length / reportListState.pageSize);
    if (reportListState.page < totalPages) {
      reportListState.page++;
      renderReportListPage();
    }
  });

  if (adminMode) {
    bindAdminEditEvents(body, rows);
    document.getElementById('reportCsvDownload')?.addEventListener('click', () => {
      downloadCSV(rows);
    });
  }
}

const STATUS_OPTIONS = ['', '미확인', '수정완료', '비고'];

function renderStatusEditable(value, rowIndex) {
  return `
    <select class="report-status-select" data-row="${rowIndex}" data-field="처리상태">
      ${STATUS_OPTIONS.map(opt =>
        `<option value="${esc(opt)}" ${(value || '') === opt ? 'selected' : ''}>${opt || '정하지 않음'}</option>`
      ).join('')}
    </select>
  `;
}

function renderDescCell(value, rowIndex) {
  if (adminMode) {
    return `
      <div class="report-admin-desc" data-row="${rowIndex}">
        <div class="report-desc-clamp${value ? '' : ' empty'}">${value ? esc(value) : '<span class="report-desc-placeholder">아직 없음</span>'}</div>
        <button class="report-desc-edit-btn" type="button" data-row="${rowIndex}" aria-label="답변 고치기">${icon.edit(14)}</button>
      </div>
    `;
  }
  if (!value) return '';
  return `<div class="report-desc-clamp">${esc(value)}</div><button class="report-desc-toggle" type="button">더보기</button>`;
}

function bindAdminEditEvents(body, rows) {
  // 처리상태 드롭다운 변경
  body.querySelectorAll('.report-status-select').forEach(select => {
    select.addEventListener('change', async () => {
      const rowIndex = parseInt(select.dataset.row);
      const newValue = select.value;
      select.disabled = true;
      try {
        await updateReport(rowIndex, { 처리상태: newValue });
        rows[rowIndex].처리상태 = newValue;
        select.classList.add('report-save-ok');
        setTimeout(() => select.classList.remove('report-save-ok'), 1500);
      } catch (err) {
        alert('처리 상태를 저장하지 못했어요. 다시 골라 주세요.');
      } finally {
        select.disabled = false;
      }
    });
  });

  // 상세설명 편집 버튼
  body.querySelectorAll('.report-desc-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const rowIndex = parseInt(btn.dataset.row);
      const container = btn.closest('.report-admin-desc');
      const currentValue = rows[rowIndex].상세설명 || '';

      container.innerHTML = `
        <div class="report-desc-edit-area">
          <textarea class="report-desc-textarea">${esc(currentValue)}</textarea>
          <div class="report-desc-edit-actions">
            <button class="report-desc-save" type="button">저장</button>
            <button class="report-desc-cancel" type="button">닫기</button>
          </div>
        </div>
      `;

      const textarea = container.querySelector('.report-desc-textarea');
      textarea.focus();

      container.querySelector('.report-desc-save').addEventListener('click', async () => {
        const newValue = textarea.value;
        const saveBtn = container.querySelector('.report-desc-save');
        saveBtn.disabled = true;
        saveBtn.textContent = '저장하고 있어요';
        try {
          await updateReport(rowIndex, { 상세설명: newValue });
          rows[rowIndex].상세설명 = newValue;
          container.innerHTML = `
            <div class="report-desc-clamp${newValue ? '' : ' empty'}">${newValue ? esc(newValue) : '<span class="report-desc-placeholder">아직 없음</span>'}</div>
            <button class="report-desc-edit-btn" type="button" data-row="${rowIndex}" aria-label="답변 고치기">${icon.edit(14)}</button>
          `;
          // Re-bind the new edit button
          const newBtn = container.querySelector('.report-desc-edit-btn');
          newBtn.addEventListener('click', () => {
            newBtn.dispatchEvent(new Event('click', { bubbles: true }));
          });
          bindAdminEditEvents(container, rows);
          container.classList.add('report-save-ok');
          setTimeout(() => container.classList.remove('report-save-ok'), 1500);
        } catch (err) {
          alert('답변을 저장하지 못했어요. 다시 저장해 주세요.');
          saveBtn.disabled = false;
          saveBtn.textContent = '저장';
        }
      });

      container.querySelector('.report-desc-cancel').addEventListener('click', () => {
        container.innerHTML = `
          <div class="report-desc-clamp${currentValue ? '' : ' empty'}">${currentValue ? esc(currentValue) : '<span class="report-desc-placeholder">아직 없음</span>'}</div>
          <button class="report-desc-edit-btn" type="button" data-row="${rowIndex}" aria-label="답변 고치기">${icon.edit(14)}</button>
        `;
        bindAdminEditEvents(container, rows);
      });
    });
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

function formatDate(raw) {
  if (!raw) return '';
  const str = String(raw).trim();
  // 한국어 로케일: "2026. 3. 3. 오후 2:30:00"
  const koMatch = str.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후)?\s*(\d{1,2}):(\d{2})/);
  if (koMatch) {
    const [, y, m, day, ampm, h, min] = koMatch;
    let hour = parseInt(h);
    if (ampm === '오후' && hour < 12) hour += 12;
    if (ampm === '오전' && hour === 12) hour = 0;
    const ymd = `${y}.${m.padStart(2, '0')}.${day.padStart(2, '0')}.`;
    const hm = `${String(hour).padStart(2, '0')}:${min}`;
    return `${ymd}<br>${hm}`;
  }
  const d = new Date(str);
  if (isNaN(d)) return esc(str);
  const ymd = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}.`;
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${ymd}<br>${hm}`;
}

function renderStatus(value) {
  if (!value) return '';
  const cls = { '수정완료': 'report-status-done', '미확인': 'report-status-pending', '비고': 'report-status-note' }[value];
  return cls ? `<span class="report-status ${cls}">${esc(value)}</span>` : esc(value);
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
