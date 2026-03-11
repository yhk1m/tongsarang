const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwTiskDzQAPLnsA_gLalybes7BsjSXovLNhjT8TxRb-_akZfs7XQXejEeDgMI6Xnqk3/exec';

function fetchWithTimeout(url, options = {}, ms = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

export async function submitReport(data) {
  const res = await fetchWithTimeout(SHEETS_URL, {
    method: 'POST',
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('제보 전송 실패');
  return res.json();
}

export async function updateReport(rowIndex, fields) {
  const res = await fetchWithTimeout(SHEETS_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'update', rowIndex, ...fields })
  }, 15000);
  if (!res.ok) throw new Error('수정 실패');
  return res.json();
}

export async function fetchReports() {
  try {
    const res = await fetchWithTimeout(SHEETS_URL);
    if (!res.ok) throw new Error('제보 내역 조회 실패');
    return res.json();
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('연결 시간 초과 — 네트워크 환경을 확인하세요 (학교/기업 보안 정책으로 차단될 수 있습니다)');
    }
    if (e.message === 'Failed to fetch') {
      throw new Error('Google Sheets 연결 실패 — 네트워크 환경을 확인하세요');
    }
    throw e;
  }
}
