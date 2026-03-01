// DataManager: JSON 데이터 로드 및 과목별 캐싱

const SUBJECTS = [
  { id: '한국지리', label: '한국지리', icon: '🇰🇷' },
  { id: '세계지리', label: '세계지리', icon: '🌍' },
  { id: '통합사회', label: '통합사회', icon: '📚' },
  { id: '한국사', label: '한국사', icon: '🏯' },
  { id: '정치와법', label: '정치와법', icon: '⚖️' },
  { id: '경제', label: '경제', icon: '💰' },
  { id: '사회문화', label: '사회문화', icon: '👥' },
  { id: '생활과윤리', label: '생활과윤리', icon: '🤝' },
  { id: '윤리와사상', label: '윤리와사상', icon: '💡' },
  { id: '동아시아사', label: '동아시아사', icon: '🏮' },
  { id: '세계사', label: '세계사', icon: '🌐' }
];

export class DataManager {
  constructor() {
    this.cache = {};
    this.currentSubject = null;
  }

  getSubjects() {
    return SUBJECTS;
  }

  async loadSubject(subjectId) {
    if (this.cache[subjectId]) {
      this.currentSubject = subjectId;
      return this.cache[subjectId];
    }

    const url = `${import.meta.env.BASE_URL}data/${encodeURIComponent(subjectId)}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`데이터 로드 실패: ${subjectId}`);

    const data = await res.json();
    this.cache[subjectId] = data;
    this.currentSubject = subjectId;
    return data;
  }

  /** 문항이 1개 이상 있는 과목 목록 반환 (전체 과목을 로드하여 확인) */
  async getSubjectsWithData() {
    const result = [];
    for (const subj of SUBJECTS) {
      try {
        const data = await this.loadSubject(subj.id);
        if (data && data.length > 0) result.push(subj.id);
      } catch {
        // 데이터 없는 과목은 무시
      }
    }
    return result;
  }

  getFilterOptions(data, linkerStore, subject) {
    const linkedStandards = linkerStore && subject
      ? data.map(d => linkerStore.getMapping(subject, d)).filter(Boolean)
      : [];
    return {
      학년도: [...new Set(data.map(d => d.학년도).filter(Boolean))].sort((a, b) => b - a),
      분류: [...new Set(data.map(d => d.분류).filter(Boolean))].sort((a, b) => {
        const order = { '수능': 12, '11월': 11, '10월': 10, '10월학평': 10, '9월': 9, '9모': 9, '7월': 7, '7월학평': 7, '6월': 6, '6모': 6, '5월': 5, '5월학평': 5, '4월': 4, '4월학평': 4, '3월': 3, '3월학평': 3 };
        return (order[b] ?? 0) - (order[a] ?? 0);
      }),
      대단원: [...new Set(data.map(d => d.대단원).filter(Boolean))].sort(),
      성취기준: [...new Set(linkedStandards)].sort(),
      난이도: [...new Set(data.map(d => d.난이도).filter(Boolean))].sort()
    };
  }

  getStats(data) {
    let geoTesterCount = 0;
    data.forEach(item => {
      if (isGeoTesterLoaded(item.GeoTester)) geoTesterCount++;
    });
    return {
      총문제수: data.length,
      GeoTester탑재수: geoTesterCount
    };
  }
}

export function isGeoTesterLoaded(value) {
  if (!value) return false;
  const v = String(value).toLowerCase().trim();
  return v === 'o' || v === '○' || v === 'true' || v === 'y' || v === 'yes' || v === '1';
}
