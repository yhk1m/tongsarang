import { ACHIEVEMENT_STANDARDS } from '../data/achievementStandards.js';

// 과목 → 이미지 코드 매핑
const SUBJECT_CODE = {
  '한국지리': 'korgeo',
  '세계지리': 'wgeo',
  '통합사회': 'iss',
  '한국사': 'korhis',
  '정치와법': 'pol',
  '경제': 'econ',
  '사회문화': 'socul',
  '생활과윤리': 'leth',
  '윤리와사상': 'ethth',
  '동아시아사': 'eahis',
  '세계사': 'whis'
};

const CATEGORY_TO_MONTH = {
  '수능': '11', '9모': '09', '6모': '06',
  '10월학평': '10', '7월학평': '07', '5월학평': '05', '4월학평': '04', '3월학평': '03',
  '11월': '11', '10월': '10', '9월': '09', '7월': '07',
  '6월': '06', '5월': '05', '4월': '04', '3월': '03'
};

let LINKER_SUBJECTS = [];

let store = null;
let dm = null;
let lState = {
  subject: '한국지리',
  items: [],         // 현재 과목의 전체 문항
  filtered: [],      // 필터 적용된 문항
  currentIdx: 0,     // filtered 내 인덱스
  filterYear: '',
  filterCategory: '',
  filterStatus: '',  // '' | 'mapped' | 'unmapped'
  expandedAreas: new Set()
};

export function renderLinkerModal() {
  return `
    <div id="linkerModal" class="linker-modal">
      <div class="linker-wizard">
        <div class="linker-header">
          <h2>성취기준 연결하기</h2>
          <div class="linker-header-controls">
            <select id="linkerSubject" class="linker-select"></select>
            <div class="linker-progress" id="linkerProgress"></div>
          </div>
          <button class="me-close" id="linkerClose">&times;</button>
        </div>
        <div class="linker-body">
          <div class="linker-left" id="linkerLeft"></div>
          <div class="linker-right" id="linkerRight"></div>
        </div>
        <div class="linker-footer" id="linkerFooter"></div>
      </div>
    </div>
  `;
}

export function bindLinkerEvents(linkerStore, dataManager) {
  store = linkerStore;
  dm = dataManager;

  const modal = document.getElementById('linkerModal');
  document.getElementById('linkerClose').addEventListener('click', closeLinker);
  modal.addEventListener('click', e => {
    if (e.target === modal) closeLinker();
  });

  document.querySelector('.linker-wizard').addEventListener('click', e => e.stopPropagation());

  document.getElementById('linkerSubject').addEventListener('change', e => {
    lState.subject = e.target.value;
    loadLinkerSubject();
  });

  document.addEventListener('keydown', e => {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') closeLinker();
    if (e.key === 'ArrowLeft') navPrev();
    if (e.key === 'ArrowRight') navNext();
  });
}

export async function openLinker(subject) {
  document.getElementById('linkerModal').classList.add('open');
  document.body.style.overflow = 'hidden';

  // 데이터가 있는 과목 목록을 동적으로 로드
  const left = document.getElementById('linkerLeft');
  left.innerHTML = '<div class="me-progress-overlay"><div class="spinner"></div></div>';
  LINKER_SUBJECTS = await dm.getSubjectsWithData();

  // 과목 select 갱신
  const sel = document.getElementById('linkerSubject');
  sel.innerHTML = LINKER_SUBJECTS.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');

  lState.subject = LINKER_SUBJECTS.includes(subject) ? subject : (LINKER_SUBJECTS[0] || '한국지리');
  sel.value = lState.subject;

  await loadLinkerSubject();
}

function closeLinker() {
  document.getElementById('linkerModal').classList.remove('open');
  document.body.style.overflow = '';
}

async function loadLinkerSubject() {
  const left = document.getElementById('linkerLeft');
  left.innerHTML = '<div class="me-progress-overlay"><div class="spinner"></div></div>';

  lState.items = await dm.loadSubject(lState.subject);
  lState.filterYear = '';
  lState.filterCategory = '';
  lState.filterStatus = '';
  lState.expandedAreas = new Set();
  applyFilter();
  lState.currentIdx = 0;
  renderLeftPanel();
  renderRightPanel();
  updateProgress();
  renderFooter();
}

function applyFilter() {
  let items = lState.items;
  if (lState.filterYear) items = items.filter(i => i.학년도 === lState.filterYear);
  if (lState.filterCategory) items = items.filter(i => i.분류 === lState.filterCategory);
  if (lState.filterStatus === 'mapped') {
    items = items.filter(i => store.getMapping(lState.subject, i));
  } else if (lState.filterStatus === 'unmapped') {
    items = items.filter(i => !store.getMapping(lState.subject, i));
  }
  lState.filtered = items;
}

function renderLeftPanel() {
  const left = document.getElementById('linkerLeft');

  // Collect unique years and categories
  const years = [...new Set(lState.items.map(i => i.학년도))].sort().reverse();
  const cats = [...new Set(lState.items.map(i => i.분류))];

  let html = `
    <div class="linker-filters">
      <select id="linkerFilterYear" class="linker-select linker-filter-select">
        <option value="">전체 학년도</option>
        ${years.map(y => `<option value="${esc(y)}" ${lState.filterYear === y ? 'selected' : ''}>${esc(y)}</option>`).join('')}
      </select>
      <select id="linkerFilterCat" class="linker-select linker-filter-select">
        <option value="">전체 분류</option>
        ${cats.map(c => `<option value="${esc(c)}" ${lState.filterCategory === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
      <select id="linkerFilterStatus" class="linker-select linker-filter-select">
        <option value="" ${lState.filterStatus === '' ? 'selected' : ''}>전체</option>
        <option value="mapped" ${lState.filterStatus === 'mapped' ? 'selected' : ''}>연결됨</option>
        <option value="unmapped" ${lState.filterStatus === 'unmapped' ? 'selected' : ''}>미연결</option>
      </select>
    </div>
    <div class="linker-item-list" id="linkerItemList">
      ${renderItemList()}
    </div>
  `;
  left.innerHTML = html;

  // Filter event listeners
  left.querySelector('#linkerFilterYear').addEventListener('change', e => {
    lState.filterYear = e.target.value;
    applyFilter();
    lState.currentIdx = 0;
    document.getElementById('linkerItemList').innerHTML = renderItemList();
    renderRightPanel();
    updateProgress();
    renderFooter();
    bindItemListClicks();
  });
  left.querySelector('#linkerFilterCat').addEventListener('change', e => {
    lState.filterCategory = e.target.value;
    applyFilter();
    lState.currentIdx = 0;
    document.getElementById('linkerItemList').innerHTML = renderItemList();
    renderRightPanel();
    updateProgress();
    renderFooter();
    bindItemListClicks();
  });
  left.querySelector('#linkerFilterStatus').addEventListener('change', e => {
    lState.filterStatus = e.target.value;
    applyFilter();
    lState.currentIdx = 0;
    document.getElementById('linkerItemList').innerHTML = renderItemList();
    renderRightPanel();
    updateProgress();
    renderFooter();
    bindItemListClicks();
  });

  bindItemListClicks();
}

function renderItemList() {
  if (lState.filtered.length === 0) {
    return '<div class="linker-no-items">문항이 없습니다</div>';
  }
  return lState.filtered.map((item, idx) => {
    const mapped = store.getMapping(lState.subject, item);
    const active = idx === lState.currentIdx ? ' active' : '';
    return `
      <div class="linker-item-card${active}" data-idx="${idx}">
        <span class="linker-item-status">${mapped ? '●' : '○'}</span>
        <span class="linker-item-label">${esc(item.학년도)} ${esc(item.분류)} ${esc(String(item.번호))}번</span>
      </div>
    `;
  }).join('');
}

function bindItemListClicks() {
  const list = document.getElementById('linkerItemList');
  if (!list) return;
  list.querySelectorAll('.linker-item-card').forEach(card => {
    card.addEventListener('click', () => {
      lState.currentIdx = parseInt(card.dataset.idx);
      highlightCurrentItem();
      renderRightPanel();
      renderFooter();
    });
  });
}

function highlightCurrentItem() {
  const list = document.getElementById('linkerItemList');
  if (!list) return;
  list.querySelectorAll('.linker-item-card').forEach((card, idx) => {
    card.classList.toggle('active', idx === lState.currentIdx);
  });
  // Scroll active item into view
  const active = list.querySelector('.linker-item-card.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function renderRightPanel() {
  const right = document.getElementById('linkerRight');
  const item = lState.filtered[lState.currentIdx];

  if (!item) {
    right.innerHTML = '<div class="linker-no-items">문항을 선택하세요</div>';
    return;
  }

  const standards = ACHIEVEMENT_STANDARDS[lState.subject];
  const currentMapping = store.getMapping(lState.subject, item);

  right.innerHTML = `
    <div class="linker-image-area" id="linkerImageArea">
      <div class="me-progress-overlay"><div class="spinner"></div></div>
    </div>
    <div class="linker-standards-area" id="linkerStandardsArea">
      ${renderStandardsTree(standards, currentMapping)}
    </div>
  `;

  loadItemImage(item);
  bindStandardsEvents(item);
}

function loadItemImage(item) {
  const area = document.getElementById('linkerImageArea');
  const code = SUBJECT_CODE[lState.subject] || lState.subject;
  const month = CATEGORY_TO_MONTH[item.분류] || '00';
  const paddedNum = String(item.번호).padStart(2, '0');
  const fileName = `${item.학년도}_${month}_${code}_${paddedNum}`;
  const basePath = `${import.meta.env.BASE_URL}images/${encodeURIComponent(lState.subject)}`;
  const label = `${item.학년도}학년도 ${item.분류} ${item.번호}번`;

  const img = new Image();
  img.className = 'linker-image';
  img.alt = label;

  img.onload = () => {
    area.innerHTML = '';
    area.appendChild(img);
    const info = document.createElement('div');
    info.className = 'linker-image-label';
    info.textContent = label;
    area.appendChild(info);
  };

  img.onerror = () => {
    // Fallback .png
    const png = new Image();
    png.className = 'linker-image';
    png.alt = label;
    png.onload = () => {
      area.innerHTML = '';
      area.appendChild(png);
      const info = document.createElement('div');
      info.className = 'linker-image-label';
      info.textContent = label;
      area.appendChild(info);
    };
    png.onerror = () => {
      area.innerHTML = `<div class="linker-image-error">이미지 없음<br><small>${fileName}</small></div>`;
    };
    png.src = `${basePath}/${encodeURIComponent(fileName)}.png`;
  };

  img.src = `${basePath}/${encodeURIComponent(fileName)}.jpg`;
}

function renderStandardsTree(standards, currentMapping) {
  if (!standards) return '<div class="linker-no-items">성취기준 데이터가 없습니다</div>';

  return `
    <div class="linker-standards-tree">
      ${standards.areas.map((area, aIdx) => {
        const expanded = lState.expandedAreas.has(aIdx);
        return `
          <div class="linker-area-group">
            <div class="linker-area-header" data-area-idx="${aIdx}">
              <span class="linker-area-arrow">${expanded ? '▼' : '▶'}</span>
              ${esc(area.area)}
            </div>
            <div class="linker-area-items" style="display:${expanded ? 'block' : 'none'}" data-area-content="${aIdx}">
              ${area.standards.map(s => {
                const checked = currentMapping === s.id ? ' checked' : '';
                return `
                  <label class="linker-standard-item${checked ? ' selected' : ''}">
                    <input type="radio" name="linkerStandard" value="${esc(s.id)}"${checked}>
                    <span class="linker-std-id">${esc(s.id)}</span>
                    <span class="linker-std-text">${esc(s.text)}</span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
      <div class="linker-clear-mapping">
        <button class="btn btn-secondary linker-btn-clear" id="linkerClearMapping">연결 해제</button>
      </div>
    </div>
  `;
}

function bindStandardsEvents(item) {
  const area = document.getElementById('linkerStandardsArea');
  if (!area) return;

  // Area toggle (expand/collapse)
  area.querySelectorAll('.linker-area-header').forEach(header => {
    header.addEventListener('click', () => {
      const idx = parseInt(header.dataset.areaIdx);
      if (lState.expandedAreas.has(idx)) {
        lState.expandedAreas.delete(idx);
      } else {
        lState.expandedAreas.add(idx);
      }
      const content = area.querySelector(`[data-area-content="${idx}"]`);
      const arrow = header.querySelector('.linker-area-arrow');
      if (content) {
        const show = lState.expandedAreas.has(idx);
        content.style.display = show ? 'block' : 'none';
        arrow.textContent = show ? '▼' : '▶';
      }
    });
  });

  // Radio selection
  area.querySelectorAll('input[name="linkerStandard"]').forEach(radio => {
    radio.addEventListener('change', () => {
      store.setMapping(lState.subject, item, radio.value);
      // Update visual
      area.querySelectorAll('.linker-standard-item').forEach(el => el.classList.remove('selected'));
      radio.closest('.linker-standard-item').classList.add('selected');
      updateProgress();
      updateItemStatus();
      // Auto-advance to next item
      setTimeout(() => navNext(), 300);
    });
  });

  // Clear mapping
  const clearBtn = document.getElementById('linkerClearMapping');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      store.setMapping(lState.subject, item, null);
      area.querySelectorAll('.linker-standard-item').forEach(el => el.classList.remove('selected'));
      area.querySelectorAll('input[name="linkerStandard"]').forEach(r => r.checked = false);
      updateProgress();
      updateItemStatus();
    });
  }
}

function updateItemStatus() {
  // Update the dot indicator for current item in the list
  const list = document.getElementById('linkerItemList');
  if (!list) return;
  lState.filtered.forEach((item, idx) => {
    const card = list.querySelector(`.linker-item-card[data-idx="${idx}"]`);
    if (card) {
      const mapped = store.getMapping(lState.subject, item);
      card.querySelector('.linker-item-status').textContent = mapped ? '●' : '○';
    }
  });
}

function updateProgress() {
  const el = document.getElementById('linkerProgress');
  if (!el) return;
  const total = lState.items.length;
  const mapped = store.getMappedCount(lState.subject);
  const pct = total > 0 ? Math.round((mapped / total) * 100) : 0;
  el.innerHTML = `
    <div class="linker-progress-bar">
      <div class="linker-progress-fill" style="width:${pct}%"></div>
    </div>
    <span class="linker-progress-text">${mapped}/${total} (${pct}%)</span>
  `;
}

function renderFooter() {
  const footer = document.getElementById('linkerFooter');
  const total = lState.filtered.length;
  const current = total > 0 ? lState.currentIdx + 1 : 0;

  footer.innerHTML = `
    <div class="linker-footer-left">
      <button class="btn btn-secondary linker-nav-btn" id="linkerPrev" ${lState.currentIdx <= 0 ? 'disabled' : ''}>◀ 이전</button>
      <button class="btn btn-secondary linker-nav-btn" id="linkerNext" ${lState.currentIdx >= total - 1 ? 'disabled' : ''}>다음 ▶</button>
      <span class="linker-footer-count">${current} / ${total}</span>
    </div>
    <div class="linker-footer-right">
      <button class="btn btn-secondary" id="linkerExport">내보내기</button>
      <button class="btn btn-secondary" id="linkerImport">가져오기</button>
      <input type="file" id="linkerImportFile" accept=".json" style="display:none">
    </div>
  `;

  footer.querySelector('#linkerPrev').addEventListener('click', navPrev);
  footer.querySelector('#linkerNext').addEventListener('click', navNext);
  footer.querySelector('#linkerExport').addEventListener('click', handleExport);
  footer.querySelector('#linkerImport').addEventListener('click', () => {
    document.getElementById('linkerImportFile').click();
  });
  footer.querySelector('#linkerImportFile').addEventListener('change', handleImport);
}

function navPrev() {
  if (lState.currentIdx > 0) {
    lState.currentIdx--;
    highlightCurrentItem();
    renderRightPanel();
    renderFooter();
  }
}

function navNext() {
  if (lState.currentIdx < lState.filtered.length - 1) {
    lState.currentIdx++;
    highlightCurrentItem();
    renderRightPanel();
    renderFooter();
  }
}

function handleExport() {
  const json = store.exportJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tongsarang_성취기준_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      store.importJSON(reader.result);
      // Refresh view
      updateProgress();
      updateItemStatus();
      renderRightPanel();
      alert('가져오기 완료');
    } catch (err) {
      alert('가져오기 실패: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
