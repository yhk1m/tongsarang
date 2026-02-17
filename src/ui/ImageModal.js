// 과목 → 이미지 코드 매핑
const SUBJECT_CODE = {
  '한국지리': 'korgeo',
  '세계지리': 'wgeo',
  '통합사회': 'iss',
  '한국사': 'korhis',
  '정치와법': 'pol',
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
  '3월학평': '03'
};

export function renderModal() {
  return `
    <div id="imageModal" class="modal">
      <span class="modal-close" id="modalClose">&times;</span>
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
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  document.getElementById('modalContent').addEventListener('click', e => e.stopPropagation());
}

export function showImage(currentSubject, year, category, number) {
  const modal = document.getElementById('imageModal');
  const body = document.getElementById('modalBody');

  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
  body.innerHTML = '<div class="modal-loading"><div class="spinner"></div>이미지를 불러오는 중...</div>';

  const basePath = `${import.meta.env.BASE_URL}images/${encodeURIComponent(currentSubject)}`;
  const code = SUBJECT_CODE[currentSubject] || currentSubject;
  const month = CATEGORY_TO_MONTH[category] || '00';
  const paddedNum = String(number).padStart(2, '0');

  // 파일명: YYYY_MM_code_NN.png (예: 2026_11_korgeo_01.png)
  const fileName = `${year}_${month}_${code}_${paddedNum}`;
  const label = `${currentSubject} - ${year}학년도 ${category} ${number}번`;

  const img = new Image();
  img.className = 'modal-image';
  img.alt = '문제 이미지';

  img.onload = () => {
    body.innerHTML = '';
    body.appendChild(img);
    const info = document.createElement('div');
    info.className = 'modal-info';
    info.textContent = label;
    body.appendChild(info);
  };

  img.onerror = () => {
    // Fallback: try .png
    const pngImg = new Image();
    pngImg.className = 'modal-image';
    pngImg.alt = '문제 이미지';
    pngImg.onload = () => {
      body.innerHTML = '';
      body.appendChild(pngImg);
      const info2 = document.createElement('div');
      info2.className = 'modal-info';
      info2.textContent = label;
      body.appendChild(info2);
    };
    pngImg.onerror = () => {
      body.innerHTML = `
        <div class="modal-error">
          이미지를 찾을 수 없습니다<br><br>
          <small>${fileName}.jpg / .png</small><br>
          <small>경로: images/${currentSubject}/</small>
        </div>
      `;
    };
    pngImg.src = `${basePath}/${encodeURIComponent(fileName)}.png`;
  };

  img.src = `${basePath}/${encodeURIComponent(fileName)}.jpg`;
}

function closeModal() {
  document.getElementById('imageModal').style.display = 'none';
  document.body.style.overflow = '';
}
