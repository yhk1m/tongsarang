const STORAGE_KEY = 'tongsarang_achievement_mappings';
const DEFAULTS_LOADED_KEY = 'tongsarang_defaults_loaded_v6';

const MIGRATION_KEY = 'tongsarang_migration_tongsahoe_2022';

// 통합사회 2015→2022 성취기준 코드 매핑
const TONGSAHOE_2015_TO_2022 = {
  '[10통사01-01]': '[10통사1-01-01]',
  '[10통사01-02]': '[10통사1-02-01]',
  '[10통사01-03]': '[10통사1-02-02]',
  '[10통사02-01]': '[10통사1-03-01]',
  '[10통사02-02]': '[10통사1-03-02]',
  '[10통사02-03]': '[10통사1-03-03]',
  '[10통사03-01]': '[10통사1-05-01]',
  '[10통사03-02]': '[10통사1-05-02]',
  '[10통사03-03]': '[10통사1-05-03]',
  '[10통사04-01]': '[10통사2-01-01]',
  '[10통사04-02]': '[10통사2-01-02]',
  '[10통사04-03]': '[10통사2-01-03]',
  '[10통사05-01]': '[10통사2-03-01]',
  '[10통사05-02]': '[10통사2-03-02]',
  '[10통사05-03]': '[10통사2-03-01]',
  '[10통사05-04]': '[10통사2-03-03]',
  '[10통사06-01]': '[10통사2-02-01]',
  '[10통사06-02]': '[10통사2-02-03]',
  '[10통사06-03]': '[10통사2-02-03]',
  '[10통사07-01]': '[10통사1-04-01]',
  '[10통사07-02]': '[10통사1-04-02]',
  '[10통사07-03]': '[10통사1-04-03]',
  '[10통사07-04]': '[10통사1-04-04]',
  '[10통사08-01]': '[10통사2-04-01]',
  '[10통사08-02]': '[10통사2-04-02]',
  '[10통사08-03]': '[10통사2-04-03]',
  '[10통사09-01]': '[10통사2-05-01]',
  '[10통사09-02]': '[10통사2-05-02]',
  '[10통사09-03]': '[10통사2-05-03]',
};

export class LinkerStore {
  constructor() {
    this.data = this._load();
    this._migrateTongsahoe2022();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /** 기본 매핑 데이터 자동 로드 (최초 1회) */
  async loadDefaults() {
    const loaded = localStorage.getItem(DEFAULTS_LOADED_KEY);
    if (loaded) return;
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}data/default_mappings.json`);
      if (!resp.ok) return;
      const defaults = await resp.json();
      for (const [subject, mappings] of Object.entries(defaults)) {
        if (!this.data[subject]) this.data[subject] = {};
        for (const [key, val] of Object.entries(mappings)) {
          if (!this.data[subject][key]) {
            this.data[subject][key] = val;
          }
        }
      }
      this._save();
      localStorage.setItem(DEFAULTS_LOADED_KEY, '1');
    } catch { /* ignore */ }
  }

  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  /** 통합사회 2015→2022 성취기준 코드 마이그레이션 (1회) */
  _migrateTongsahoe2022() {
    if (localStorage.getItem(MIGRATION_KEY)) return;
    const mappings = this.data['통합사회'];
    if (!mappings) { localStorage.setItem(MIGRATION_KEY, '1'); return; }
    let changed = false;
    for (const [key, val] of Object.entries(mappings)) {
      if (TONGSAHOE_2015_TO_2022[val]) {
        mappings[key] = TONGSAHOE_2015_TO_2022[val];
        changed = true;
      }
    }
    if (changed) this._save();
    localStorage.setItem(MIGRATION_KEY, '1');
  }

  /** 문항 → 유니크 키 (과목 내) */
  questionKey(item) {
    return `${item.학년도}_${item.분류}_${item.번호}`;
  }

  /** 성취기준 연결 저장 */
  setMapping(subject, item, standardId) {
    if (!this.data[subject]) this.data[subject] = {};
    const key = this.questionKey(item);
    if (standardId) {
      this.data[subject][key] = standardId;
    } else {
      delete this.data[subject][key];
    }
    this._save();
  }

  /** 단일 문항 매핑 조회 */
  getMapping(subject, item) {
    const key = this.questionKey(item);
    return this.data[subject]?.[key] || null;
  }

  /** 과목별 전체 매핑 */
  getSubjectMappings(subject) {
    return this.data[subject] || {};
  }

  /** 연결 완료 개수 */
  getMappedCount(subject) {
    return Object.keys(this.data[subject] || {}).length;
  }

  /** JSON 문자열로 내보내기 */
  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  /** JSON 문자열에서 가져오기 (merge) */
  importJSON(str) {
    const imported = JSON.parse(str);
    for (const [subject, mappings] of Object.entries(imported)) {
      if (!this.data[subject]) this.data[subject] = {};
      Object.assign(this.data[subject], mappings);
    }
    this._save();
  }
}
