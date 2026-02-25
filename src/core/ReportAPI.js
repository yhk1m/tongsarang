const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwTiskDzQAPLnsA_gLalybes7BsjSXovLNhjT8TxRb-_akZfs7XQXejEeDgMI6Xnqk3/exec';

export async function submitReport(data) {
  const res = await fetch(SHEETS_URL, {
    method: 'POST',
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('제보 전송 실패');
  return res.json();
}

export async function fetchReports() {
  try {
    const res = await fetch(SHEETS_URL);
    if (!res.ok) throw new Error('제보 내역 조회 실패');
    return res.json();
  } catch (e) {
    if (e.message === 'Failed to fetch') {
      throw new Error('Google Sheets 연결 실패 — Apps Script가 배포되었는지 확인하세요');
    }
    throw e;
  }
}
