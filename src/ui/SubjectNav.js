export function renderSubjectNav(subjects, activeId) {
  const tabs = subjects.map(s => {
    const cls = s.id === activeId ? 'tab active' : 'tab';
    return `<button class="${cls}" data-subject="${s.id}">${s.icon} ${s.label}</button>`;
  }).join('');

  return `
    <div class="tabs-wrapper">
      <div class="tabs">
        ${tabs}
      </div>
    </div>
  `;
}

export function bindSubjectNav(onSwitch) {
  document.querySelector('.tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    const subject = btn.dataset.subject;
    if (subject) onSwitch(subject);
  });
}
