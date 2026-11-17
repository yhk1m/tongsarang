// © 2026 김용현
import { icon } from './icons.js';

/** 넓은 화면: 가로 탭. 대분류가 바뀌는 자리에 세로 구분선을 넣는다. */
export function renderSubjectNav(subjects, activeId) {
  const tabs = subjects.map((s, i) => {
    const active = s.id === activeId;
    const divider = i > 0 && subjects[i - 1].group !== s.group
      ? '<span class="tab-divider" aria-hidden="true"></span>'
      : '';
    return `${divider}<button class="tab${active ? ' active' : ''}" role="tab" aria-selected="${active}" data-subject="${s.id}" title="${s.group}">${s.label}</button>`;
  }).join('');

  return `
    <nav class="tabs-wrapper" aria-label="과목">
      <div class="tabs" role="tablist">
        ${tabs}
      </div>
    </nav>
  `;
}

/** 휴대폰: 머리의 햄버거 버튼 (지금 과목 이름이 함께 보인다) */
export function renderSubjectMenuButton(subjects, activeId) {
  const cur = subjects.find(s => s.id === activeId);
  return `
    <button type="button" class="subject-menu-btn" id="btnSubjectMenu" aria-haspopup="dialog" aria-expanded="false" aria-controls="subjectSheet">
      ${icon.menu(20)}<span id="subjectMenuLabel">${cur ? cur.label : '과목'}</span>
    </button>
  `;
}

/** 휴대폰: 왼쪽에서 나오는 과목 목록. 대분류 이름 아래에 과목을 묶는다. */
export function renderSubjectSheet(subjects, activeId) {
  const groups = [];
  for (const s of subjects) {
    let g = groups.find(x => x.name === s.group);
    if (!g) groups.push(g = { name: s.group, items: [] });
    g.items.push(s);
  }
  return `
    <div class="subject-sheet-backdrop" id="subjectSheetBackdrop" hidden></div>
    <aside class="subject-sheet" id="subjectSheet" role="dialog" aria-modal="true" aria-labelledby="subjectSheetTitle" hidden>
      <div class="subject-sheet-head">
        <h2 id="subjectSheetTitle">과목 고르기</h2>
        <button type="button" class="subject-sheet-close" id="subjectSheetClose" aria-label="닫기">${icon.close(20)}</button>
      </div>
      <div class="subject-sheet-body">
        ${groups.map(g => `
          <div class="subject-group">
            <div class="subject-group-name">${g.name}</div>
            ${g.items.map(s => `
              <button type="button" class="subject-item${s.id === activeId ? ' active' : ''}" data-subject="${s.id}" aria-current="${s.id === activeId}">
                <span>${s.label}</span>${icon.check(18)}
              </button>`).join('')}
          </div>`).join('')}
      </div>
    </aside>
  `;
}

function openSheet() {
  const sheet = document.getElementById('subjectSheet');
  sheet.hidden = false;
  document.getElementById('subjectSheetBackdrop').hidden = false;
  document.getElementById('btnSubjectMenu').setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
  (sheet.querySelector('.subject-item.active') || sheet.querySelector('.subject-item'))?.focus();
}

function closeSheet() {
  const sheet = document.getElementById('subjectSheet');
  if (sheet.hidden) return;
  sheet.hidden = true;
  document.getElementById('subjectSheetBackdrop').hidden = true;
  const btn = document.getElementById('btnSubjectMenu');
  btn.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  btn.focus();
}

export function bindSubjectNav(onSwitch) {
  document.querySelector('.tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab');
    if (btn?.dataset.subject) onSwitch(btn.dataset.subject);
  });

  document.getElementById('btnSubjectMenu').addEventListener('click', openSheet);
  document.getElementById('subjectSheetClose').addEventListener('click', closeSheet);
  document.getElementById('subjectSheetBackdrop').addEventListener('click', closeSheet);
  document.getElementById('subjectSheet').addEventListener('click', e => {
    const item = e.target.closest('.subject-item');
    if (!item) return;
    closeSheet();
    onSwitch(item.dataset.subject);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSheet();
  });
}

/** 탭, 과목 목록, 햄버거 버튼 이름을 한꺼번에 맞춘다 */
export function setActiveSubject(subject, label) {
  document.querySelectorAll('.tab, .subject-item').forEach(el => {
    const on = el.dataset.subject === subject;
    el.classList.toggle('active', on);
    el.setAttribute(el.classList.contains('tab') ? 'aria-selected' : 'aria-current', String(on));
  });
  const name = document.getElementById('subjectMenuLabel');
  if (name) name.textContent = label || subject;
}
