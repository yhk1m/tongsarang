const STORAGE_KEY = 'tongsarang_achievement_mappings';
const DEFAULTS_LOADED_KEY = 'tongsarang_defaults_loaded_v5';

export class LinkerStore {
  constructor() {
    this.data = this._load();
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
