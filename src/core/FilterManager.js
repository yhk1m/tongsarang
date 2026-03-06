// FilterManager: 필터 적용, 키워드 검색, 정렬 로직

import { isGeoTesterLoaded } from './DataManager.js';

export class FilterManager {
  constructor() {
    this.sortColumn = null;
    this.sortOrder = null; // 'asc' | 'desc' | null
  }

  applyFilters(data, filters, linkerStore, subject) {
    return data.filter(item => {
      // 학년도
      if (filters.학년도 && String(item.학년도) !== String(filters.학년도)) return false;

      // 분류
      if (filters.분류 && item.분류 !== filters.분류) return false;

      // 대단원
      if (filters.대단원 && item.대단원 !== filters.대단원) return false;

      // 성취기준 (LinkerStore 매핑 기반)
      if (filters.성취기준) {
        const linked = (linkerStore ? linkerStore.getMapping(subject, item) : null) || item.성취기준 || null;
        if (linked !== filters.성취기준) return false;
      }

      // 난이도
      if (filters.난이도 && item.난이도 !== filters.난이도) return false;

      // GeoTester
      if (filters.GeoTester === 'yes' && !isGeoTesterLoaded(item.GeoTester)) return false;
      if (filters.GeoTester === 'no' && isGeoTesterLoaded(item.GeoTester)) return false;

      // 정답률 범위
      if (filters.정답률범위 && filters.정답률범위.length > 0) {
        const accuracy = parseFloat(item.정답률);
        if (isNaN(accuracy)) return false;
        const match = filters.정답률범위.some(range => {
          const [min, max] = range.split('-').map(Number);
          return accuracy >= min && accuracy <= max;
        });
        if (!match) return false;
      }

      // 키워드 검색
      if (filters.키워드) {
        const kw = filters.키워드.toLowerCase();
        const inBalm = item.발문 && item.발문.toLowerCase().includes(kw);
        const inContent = item.문항내용 && item.문항내용.toLowerCase().includes(kw);
        if (!inBalm && !inContent) return false;
      }

      return true;
    });
  }

  toggleSort(column) {
    if (this.sortColumn === column) {
      if (this.sortOrder === 'asc') {
        this.sortOrder = 'desc';
      } else if (this.sortOrder === 'desc') {
        this.sortOrder = null;
        this.sortColumn = null;
      } else {
        this.sortOrder = 'asc';
      }
    } else {
      this.sortColumn = column;
      this.sortOrder = 'asc';
    }
  }

  resetSort() {
    this.sortColumn = null;
    this.sortOrder = null;
  }

  applySorting(data) {
    if (!this.sortColumn || !this.sortOrder) return data;

    return [...data].sort((a, b) => {
      let aVal = parseFloat(a[this.sortColumn]);
      let bVal = parseFloat(b[this.sortColumn]);
      if (isNaN(aVal)) aVal = -1;
      if (isNaN(bVal)) bVal = -1;
      return this.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }
}
