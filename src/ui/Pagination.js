export class Pagination {
  constructor(defaultSize = 100) {
    this.currentPage = 1;
    this.totalItems = 0;
    this.pageSize = defaultSize;
  }

  get totalPages() {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  setPageSize(size) {
    this.pageSize = size;
    this.currentPage = 1;
  }

  reset(totalItems) {
    this.totalItems = totalItems;
    this.currentPage = 1;
  }

  getPageData(data) {
    this.totalItems = data.length;
    if (data.length <= this.pageSize) return data;
    const start = (this.currentPage - 1) * this.pageSize;
    return data.slice(start, start + this.pageSize);
  }

  render() {
    const sizes = [10, 20, 50, 100];
    let sizeSelect = `<select class="page-size-select">`;
    for (const s of sizes) {
      sizeSelect += `<option value="${s}" ${s === this.pageSize ? 'selected' : ''}>${s}개씩</option>`;
    }
    sizeSelect += `</select>`;

    if (this.totalItems <= this.pageSize) {
      return `<div class="pagination">${sizeSelect}</div>`;
    }

    const pages = this.totalPages;
    let buttons = '';

    // Previous
    buttons += `<button class="page-btn" data-page="prev" ${this.currentPage === 1 ? 'disabled' : ''}>&laquo;</button>`;

    // Page numbers (show max 7 around current)
    const start = Math.max(1, this.currentPage - 3);
    const end = Math.min(pages, this.currentPage + 3);

    if (start > 1) {
      buttons += `<button class="page-btn" data-page="1">1</button>`;
      if (start > 2) buttons += `<span class="page-dots">...</span>`;
    }

    for (let i = start; i <= end; i++) {
      const active = i === this.currentPage ? ' active' : '';
      buttons += `<button class="page-btn${active}" data-page="${i}">${i}</button>`;
    }

    if (end < pages) {
      if (end < pages - 1) buttons += `<span class="page-dots">...</span>`;
      buttons += `<button class="page-btn" data-page="${pages}">${pages}</button>`;
    }

    // Next
    buttons += `<button class="page-btn" data-page="next" ${this.currentPage === pages ? 'disabled' : ''}>&raquo;</button>`;

    return `<div class="pagination">${sizeSelect}${buttons}</div>`;
  }

  bind(container, onPageChange) {
    const pag = container.querySelector('.pagination');
    if (!pag) return;

    const sizeSelect = pag.querySelector('.page-size-select');
    if (sizeSelect) {
      sizeSelect.addEventListener('change', () => {
        this.setPageSize(parseInt(sizeSelect.value));
        onPageChange();
      });
    }

    pag.addEventListener('click', e => {
      const btn = e.target.closest('.page-btn');
      if (!btn || btn.disabled) return;

      const page = btn.dataset.page;
      if (page === 'prev') {
        this.currentPage = Math.max(1, this.currentPage - 1);
      } else if (page === 'next') {
        this.currentPage = Math.min(this.totalPages, this.currentPage + 1);
      } else {
        this.currentPage = parseInt(page);
      }
      onPageChange();
    });
  }
}
