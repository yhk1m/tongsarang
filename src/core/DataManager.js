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

  getFilterOptions(data) {
    return {
      학년도: [...new Set(data.map(d => d.학년도).filter(Boolean))].sort((a, b) => b - a),
      분류: [...new Set(data.map(d => d.분류).filter(Boolean))],
      대단원: [...new Set(data.map(d => d.대단원).filter(Boolean))].sort(),
      중단원: [...new Set(data.map(d => d.중단원).filter(Boolean))].sort(),
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
