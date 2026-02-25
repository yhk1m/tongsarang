export function renderDevToolbar() {
  return `
    <div class="dev-toolbar" id="devToolbar">
      <div class="dev-toolbar-left">
        <span class="dev-badge">ADMIN</span>
        <span class="dev-label">관리자 모드</span>
        <span class="dev-edit-count" id="devEditCount"></span>
      </div>
      <div class="dev-toolbar-right">
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
