export function renderHeader() {
  return `
    <div class="header">
      <div class="header-left">
        <h1><img src="${import.meta.env.BASE_URL}favicon.svg" alt="" class="header-logo">통사랑<span class="title-eng">(tongsarang)</span> <span class="title-sub">사회탐구 기출문제</span></h1>
        <div class="header-buttons">
          <button class="btn btn-mockexam" id="btnMockExam">📝 모의고사 만들기</button>
          <button class="btn btn-report" id="btnReport">🔔 오류 제보</button>
        </div>
      </div>
      <div class="header-right">
        &copy; 2026 양정고등학교 지리교사 김용현<br>
        <a href="mailto:bgnlkim@gmail.com">bgnlkim@gmail.com</a>
      </div>
    </div>
  `;
}
