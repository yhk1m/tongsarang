// 과목 → 이미지 코드 매핑
const SUBJECT_CODE = {
  '한국지리': 'korgeo',
  '세계지리': 'wgeo',
  '통합사회': 'iss',
  '한국사': 'korhis',
  '정치와법': 'pollaw',
  '경제': 'econ',
  '사회문화': 'socul',
  '생활과윤리': 'leth',
  '윤리와사상': 'ethth',
  '동아시아사': 'eahis',
  '세계사': 'whis'
};

// 분류 → 월 코드 매핑
const CATEGORY_TO_MONTH = {
  '수능': '11',
  '9모': '09',
  '6모': '06',
  '10월학평': '10',
  '7월학평': '07',
  '5월학평': '05',
  '4월학평': '04',
  '3월학평': '03',
  // 통합사회 등 월 이름만 쓰는 과목
  '11월': '11',
  '10월': '10',
  '9월': '09',
  '7월': '07',
  '6월': '06',
  '5월': '05',
  '4월': '04',
  '3월': '03'
};

// 탐색 상태
let _navSubject = '';
let _navList = [];
let _navIndex = -1;

export function renderModal() {
  return `
    <div id="imageModal" class="modal">
      <span class="modal-close" id="modalClose">&times;</span>
      <button class="modal-nav modal-nav-prev" id="modalPrev" title="이전 문제 (←)">&#10094;</button>
      <button class="modal-nav modal-nav-next" id="modalNext" title="다음 문제 (→)">&#10095;</button>
      <div class="modal-content" id="modalContent">
        <div id="modalBody"></div>
      </div>
    </div>
  `;
}

export function bindModalEvents() {
  const modal = document.getElementById('imageModal');
  const closeBtn = document.getElementById('modalClose');

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });

  document.getElementById('modalPrev').addEventListener('click', () => navigate(-1));
  document.getElementById('modalNext').addEventListener('click', () => navigate(1));

  document.addEventListener('keydown', e => {
    if (modal.style.display !== 'block') return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });

  document.getElementById('modalContent').addEventListener('click', e => e.stopPropagation());
}

/** 탐색 가능한 목록 설정 */
export function setNavList(subject, list) {
  _navSubject = subject;
  _navList = list;
}

export function showImage(currentSubject, year, category, number) {
  // 목록에서 현재 인덱스 찾기
  _navIndex = _navList.findIndex(item =>
    String(item.학년도) === String(year) &&
    String(item.분류) === String(category) &&
    String(item.번호) === String(number)
  );

  _showCurrent(currentSubject, year, category, number);
}

function _showCurrent(subject, year, category, number) {
  const modal = document.getElementById('imageModal');
  const body = document.getElementById('modalBody');

  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
  body.innerHTML = '<div class="modal-loading"><div class="spinner"></div>이미지를 불러오는 중...</div>';

  // 네비게이션 버튼 표시/숨김
  document.getElementById('modalPrev').style.display = _navIndex > 0 ? '' : 'none';
  document.getElementById('modalNext').style.display = _navIndex < _navList.length - 1 ? '' : 'none';

  const basePath = `${import.meta.env.BASE_URL}images/${encodeURIComponent(subject)}`;
  const code = SUBJECT_CODE[subject] || subject;
  const month = CATEGORY_TO_MONTH[category] || '00';
  const paddedNum = String(number).padStart(2, '0');

  const fileName = `${year}_${month}_${code}_${paddedNum}`;
  const label = `${subject} - ${year}학년도 ${category} ${number}번`;
  const counter = _navList.length > 0 ? ` (${_navIndex + 1} / ${_navList.length})` : '';

  const img = new Image();
  img.className = 'modal-image';
  img.alt = '문제 이미지';

  img.onload = () => {
    body.innerHTML = '';
    body.appendChild(img);
    const info = document.createElement('div');
    info.className = 'modal-info';
    info.textContent = label + counter;
    body.appendChild(info);
  };

  img.onerror = () => {
    const pngImg = new Image();
    pngImg.className = 'modal-image';
    pngImg.alt = '문제 이미지';
    pngImg.onload = () => {
      body.innerHTML = '';
      body.appendChild(pngImg);
      const info2 = document.createElement('div');
      info2.className = 'modal-info';
      info2.textContent = label + counter;
      body.appendChild(info2);
    };
    pngImg.onerror = () => {
      body.innerHTML = `
        <div class="modal-error">
          이미지를 찾을 수 없습니다<br><br>
          <small>${fileName}.jpg / .png</small><br>
          <small>경로: images/${subject}/</small>
        </div>
      `;
    };
    pngImg.src = `${basePath}/${encodeURIComponent(fileName)}.png`;
  };

  img.src = `${basePath}/${encodeURIComponent(fileName)}.jpg`;
}

function navigate(dir) {
  const newIndex = _navIndex + dir;
  if (newIndex < 0 || newIndex >= _navList.length) return;
  _navIndex = newIndex;
  const item = _navList[_navIndex];
  _showCurrent(_navSubject, item.학년도, item.분류, item.번호);
}

function closeModal() {
  document.getElementById('imageModal').style.display = 'none';
  document.body.style.overflow = '';
}
