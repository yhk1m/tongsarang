export function renderDevToolbar() {
  return `
    <div class="dev-toolbar" id="devToolbar">
      <div class="dev-toolbar-left">
        <span class="dev-badge">DEV</span>
        <span class="dev-label">개발자 모드</span>
        <span class="dev-edit-count" id="devEditCount"></span>
      </div>
      <div class="dev-toolbar-right">
        <button class="dev-btn dev-btn-danger" id="devClearSubject">과목 초기화</button>
        <button class="dev-btn dev-btn-danger" id="devClearAll">전체 초기화</button>
        <button class="dev-btn" id="devExport">내보내기</button>
        <button class="dev-btn" id="devImport">가져오기</button>
        <input type="file" id="devImportFile" accept=".json" style="display:none">
      </div>
    </div>
  `;
}

export function updateDevEditCount(editStore, linkerStore, currentSubject) {
  const el = document.getElementById('devEditCount');
  if (!el) return;
  const editCount = editStore.getTotalEditCount();
  const subjectEdits = editStore.getEditCount(currentSubject);
  el.textContent = `수정 ${subjectEdits}건 (전체 ${editCount}건)`;
}

export function bindDevToolbarEvents(editStore, linkerStore, onImport, getCurrentSubject) {
  const exportBtn = document.getElementById('devExport');
  const importBtn = document.getElementById('devImport');
  const importFile = document.getElementById('devImportFile');
  const clearSubjectBtn = document.getElementById('devClearSubject');
  const clearAllBtn = document.getElementById('devClearAll');

  if (clearSubjectBtn) {
    clearSubjectBtn.addEventListener('click', () => {
      const subject = getCurrentSubject ? getCurrentSubject() : null;
      if (!subject) return;
      const count = editStore.getEditCount(subject);
      if (count === 0) { alert('현재 과목에 수정사항이 없습니다.'); return; }
      if (!confirm(`"${subject}" 과목의 수정 ${count}건을 모두 초기화하시겠습니까?`)) return;
      editStore.clearSubject(subject);
      if (onImport) onImport();
    });
  }

  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      const count = editStore.getTotalEditCount();
      if (count === 0) { alert('수정사항이 없습니다.'); return; }
      if (!confirm(`전체 수정 ${count}건을 모두 초기화하시겠습니까?`)) return;
      editStore.clearAll();
      if (onImport) onImport();
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const combined = {
        edits: JSON.parse(editStore.exportJSON()),
        mappings: JSON.parse(linkerStore.exportJSON())
      };
      const json = JSON.stringify(combined, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tongsarang_edits_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (importBtn) {
    importBtn.addEventListener('click', () => {
      importFile.click();
    });
  }

  if (importFile) {
    importFile.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (data.edits) {
            editStore.importJSON(JSON.stringify(data.edits));
          }
          if (data.mappings) {
            linkerStore.importJSON(JSON.stringify(data.mappings));
          }
          alert('가져오기 완료');
          if (onImport) onImport();
        } catch (err) {
          alert('가져오기 실패: ' + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }
}
