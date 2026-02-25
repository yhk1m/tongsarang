const STORAGE_KEY = 'tongsarang_field_edits';

export class EditStore {
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

  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  /** 문항 유니크 키 */
  questionKey(item) {
    return `${item.학년도}_${item.분류}_${item.번호}`;
  }

  /** 수정값 조회 (없으면 null) */
  getEdit(subject, item, field) {
    const key = this.questionKey(item);
    return this.data[subject]?.[key]?.[field] ?? null;
  }

  /** 수정값 저장 */
  setEdit(subject, item, field, value) {
    if (!this.data[subject]) this.data[subject] = {};
    const key = this.questionKey(item);
    if (!this.data[subject][key]) this.data[subject][key] = {};
    this.data[subject][key][field] = value;
    this._save();
  }

  /** 개별 수정 삭제 */
  removeEdit(subject, item, field) {
    const key = this.questionKey(item);
    if (!this.data[subject]?.[key]) return;
    delete this.data[subject][key][field];
    if (Object.keys(this.data[subject][key]).length === 0) {
      delete this.data[subject][key];
    }
    if (Object.keys(this.data[subject]).length === 0) {
      delete this.data[subject];
    }
    this._save();
  }

  /** 과목 전체 수정 삭제 */
  clearSubject(subject) {
    delete this.data[subject];
    this._save();
  }

  /** 전체 수정 삭제 */
  clearAll() {
    this.data = {};
    this._save();
  }

  /** 수정값 있으면 수정값, 없으면 원본 반환 */
  getFieldValue(subject, item, field) {
    const edited = this.getEdit(subject, item, field);
    return edited !== null ? edited : (item[field] || '');
  }

  /** 해당 문항에 수정이 있는지 여부 */
  hasEdit(subject, item, field) {
    return this.getEdit(subject, item, field) !== null;
  }

  /** 과목별 수정 건수 */
  getEditCount(subject) {
    if (!this.data[subject]) return 0;
    return Object.keys(this.data[subject]).length;
  }

  /** 전체 수정 건수 */
  getTotalEditCount() {
    let count = 0;
    for (const subject of Object.keys(this.data)) {
      count += Object.keys(this.data[subject]).length;
    }
    return count;
  }

  /** JSON 문자열로 내보내기 */
  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  /** JSON 문자열에서 가져오기 (merge) */
  importJSON(str) {
    const imported = JSON.parse(str);
    for (const [subject, items] of Object.entries(imported)) {
      if (!this.data[subject]) this.data[subject] = {};
      for (const [key, fields] of Object.entries(items)) {
        if (!this.data[subject][key]) this.data[subject][key] = {};
        Object.assign(this.data[subject][key], fields);
      }
    }
    this._save();
  }
}
