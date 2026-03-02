const COUNTER_URL = 'https://script.google.com/macros/s/APPS_SCRIPT_ID_HERE/exec';

export async function trackVisit() {
  try {
    const res = await fetch(COUNTER_URL);
    if (!res.ok) return;
    const data = await res.json();
    const todayEl = document.getElementById('vcToday');
    const totalEl = document.getElementById('vcTotal');
    if (todayEl) todayEl.textContent = Number(data.today).toLocaleString();
    if (totalEl) totalEl.textContent = Number(data.total).toLocaleString();
  } catch {
    // 카운터 실패해도 사이트 동작에 영향 없음
  }
}
