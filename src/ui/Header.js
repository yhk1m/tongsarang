// © 2026 김용현
import { icon } from './icons.js';

export function renderHeader(subjectMenuButton = '') {
  return `
    <header class="header">
      <div class="header-brand">
        <img src="${import.meta.env.BASE_URL}favicon.svg" alt="" class="header-logo">
        <h1>통사랑</h1>
        <span class="header-sub">사회탐구 기출문제</span>
      </div>
      ${subjectMenuButton}
      <div class="header-buttons">
        <button class="btn btn-ghost" id="btnReport">${icon.flag()}오류 제보</button>
        <button class="btn btn-primary" id="btnMockExam">${icon.doc()}모의고사 만들기</button>
      </div>
    </header>
  `;
}

export function renderFooter() {
  return `
    <footer class="site-footer">
      <span>만든 사람 양정고등학교 지리교사 김용현</span>
      <a href="mailto:bgnlkim@gmail.com">bgnlkim@gmail.com</a>
      <span class="footer-line">
        <span class="visitor-counter" id="visitorCounter">오늘 <strong id="vcToday" class="num">-</strong>명, 전체 <strong id="vcTotal" class="num">-</strong>명</span>
        <div data-bgnl-family></div>
      </span>
    </footer>
  `;
}
