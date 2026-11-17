// © 2026 김용현
// 선 아이콘 (굵기 2, 끝 둥글게). currentColor 를 따른다.
const svg = (d, size = 16) =>
  `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const icon = {
  menu: (s) => svg('<path d="M4 6h16M4 12h16M4 18h16"/>', s),
  filter: (s) => svg('<path d="M4 6h16M7 12h10M10 18h4"/>', s),
  external: (s) => svg('<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>', s),
  close: (s) => svg('<path d="M18 6 6 18M6 6l12 12"/>', s),
  chevronLeft: (s) => svg('<path d="m15 18-6-6 6-6"/>', s),
  chevronRight: (s) => svg('<path d="m9 18 6-6-6-6"/>', s),
  chevronDown: (s) => svg('<path d="m6 9 6 6 6-6"/>', s),
  search: (s) => svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', s),
  reset: (s) => svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>', s),
  doc: (s) => svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>', s),
  image: (s) => svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5L5 21"/>', s),
  flag: (s) => svg('<path d="M4 21V4M4 4h12l-2 4 2 4H4"/>', s),
  check: (s) => svg('<path d="M20 6 9 17l-5-5"/>', s),
  edit: (s) => svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', s),
  undo: (s) => svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>', s),
  sort: (s) => svg('<path d="m7 15 5 5 5-5M7 9l5-5 5 5"/>', s),
  download: (s) => svg('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', s),
};
