const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzebuGHhoXooWn-Zbh4uDIusr_VPlLU82bzmwBTIEI-IPydcncpzeGjMYgUUcDRFeKV/exec';

export async function submitReport(data) {
  const res = await fetch(SHEETS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('제보 전송 실패');
  return res.json();
}

export async function fetchReports() {
  const res = await fetch(SHEETS_URL);
  if (!res.ok) throw new Error('제보 내역 조회 실패');
  return res.json();
}
