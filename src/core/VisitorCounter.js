const COUNTER_URL = 'https://script.google.com/macros/s/AKfycbzOjTEaAT2WeDN8NWwpOUp7JyYdcbMTcgYPx0kO2F-ohfjksP-vop78firT1wi_e2k5/exec';

export async function trackVisit() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(COUNTER_URL, { signal: controller.signal });
    clearTimeout(timer);
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
