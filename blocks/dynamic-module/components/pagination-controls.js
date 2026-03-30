/**
 * Shared pagination UI: items-per-page, viewing summary, prev/next,
 * up to 5 page numbers with ellipsis. Used by Search Results and Dynamic Module.
 */

const ROWS_OPTIONS = [10, 20, 50];

/**
 * @param {number} totalPages
 * @param {number} currentPage
 * @returns {{ type: 'page' | 'ellipsis'; value?: number }[]}
 */
export function buildPaginationItems(totalPages, currentPage) {
  if (totalPages < 1) return [];
  if (totalPages === 1) return [{ type: 'page', value: 1 }];

  // Show all page numbers for small sets.
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => ({ type: 'page', value: i + 1 }));
  }

  // Keep exactly 5 visible page numbers, centered around current page when possible.
  const windowSize = 5;
  const half = Math.floor(windowSize / 2);
  const safeCurrent = Math.min(Math.max(currentPage, 1), totalPages);
  let start = safeCurrent - half;
  let end = safeCurrent + half;

  if (start < 1) {
    start = 1;
    end = windowSize;
  } else if (end > totalPages) {
    end = totalPages;
    start = totalPages - windowSize + 1;
  }

  const items = [];
  if (start > 1) {
    items.push({ type: 'ellipsis' });
  }

  for (let p = start; p <= end; p += 1) {
    items.push({ type: 'page', value: p });
  }

  if (end < totalPages) {
    // Match requested examples:
    // - middle ranges use trailing ellipsis
    // - near-end ranges can show the last page number
    if (end >= totalPages - 2) items.push({ type: 'page', value: totalPages });
    else items.push({ type: 'ellipsis' });
  }

  return items;
}

export { ROWS_OPTIONS };

/**
 * @param {object} options
 * @param {number} options.currentPage
 * @param {number} options.totalPages
 * @param {number} options.totalItems
 * @param {number} options.rowsPerPage
 * @param {(page: number) => void} options.onPageChange
 * @param {(rows: number) => void} options.onRowsChange
 */
export default function createPaginationControls({
  currentPage,
  totalPages,
  totalItems,
  rowsPerPage,
  onPageChange,
  onRowsChange,
}) {
  const root = document.createElement('div');
  root.className = 'dm-pagination';

  const meta = document.createElement('div');
  meta.className = 'dm-pagination-meta';

  const viewing = document.createElement('p');
  viewing.className = 'dm-pagination-viewing';
  const safeTotal = Math.max(0, Number(totalItems) || 0);
  const start = safeTotal === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const end = safeTotal === 0 ? 0 : Math.min(currentPage * rowsPerPage, safeTotal);
  viewing.textContent = `Viewing ${start.toLocaleString()}-${end.toLocaleString()} of ${safeTotal.toLocaleString()} items`;

  const perWrap = document.createElement('div');
  perWrap.className = 'dm-pagination-per-wrap';
  const selectId = `dm-pagination-per-${Math.random().toString(36).slice(2, 9)}`;
  const perLabel = document.createElement('label');
  perLabel.className = 'dm-pagination-per-label';
  perLabel.setAttribute('for', selectId);
  perLabel.textContent = 'Items per page';

  const select = document.createElement('select');
  select.id = selectId;
  select.className = 'dm-pagination-per-select';
  select.setAttribute('aria-label', 'Items per page');
  ROWS_OPTIONS.forEach((n) => {
    const opt = document.createElement('option');
    opt.value = String(n);
    opt.textContent = String(n);
    if (n === rowsPerPage) opt.selected = true;
    select.append(opt);
  });
  select.addEventListener('change', () => {
    const next = Number(select.value) || rowsPerPage;
    onRowsChange(next);
  });

  perWrap.append(perLabel, select);
  meta.append(viewing, perWrap);

  const nav = document.createElement('nav');
  nav.className = 'dm-pagination-nav';
  nav.setAttribute('aria-label', 'Pagination');

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'dm-page-nav dm-page-nav-prev';
  prev.setAttribute('aria-label', 'Previous page');
  prev.innerHTML = '<span class="dm-page-nav-icon" aria-hidden="true">\u2039</span>';
  prev.disabled = currentPage <= 1 || totalPages < 1;
  prev.addEventListener('click', () => onPageChange(currentPage - 1));

  const pages = document.createElement('div');
  pages.className = 'dm-pagination-pages';

  if (totalPages >= 1 && safeTotal > 0) {
    const items = buildPaginationItems(totalPages, currentPage);
    items.forEach((item) => {
      if (item.type === 'ellipsis') {
        const ell = document.createElement('span');
        ell.className = 'dm-page-ellipsis';
        ell.setAttribute('aria-hidden', 'true');
        ell.textContent = '\u2026';
        pages.append(ell);
        return;
      }
      const page = item.value;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dm-page-btn';
      if (page === currentPage) btn.classList.add('is-active');
      btn.textContent = String(page);
      btn.setAttribute('aria-label', `Page ${page}`);
      if (page === currentPage) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
      btn.addEventListener('click', () => onPageChange(page));
      pages.append(btn);
    });
  }

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'dm-page-nav dm-page-nav-next';
  next.setAttribute('aria-label', 'Next page');
  next.innerHTML = '<span class="dm-page-nav-icon" aria-hidden="true">\u203A</span>';
  next.disabled = currentPage >= totalPages || totalPages < 1;
  next.addEventListener('click', () => onPageChange(currentPage + 1));

  nav.append(prev, pages, next);

  const bar = document.createElement('div');
  bar.className = 'dm-pagination-bar';
  bar.append(meta, nav);

  // Mobile (<720): compact pager like "< [page-select] of N >" + viewing line.
  const mobileNav = document.createElement('nav');
  mobileNav.className = 'dm-pagination-mobile-nav';
  mobileNav.setAttribute('aria-label', 'Pagination');

  const mobilePrev = document.createElement('button');
  mobilePrev.type = 'button';
  mobilePrev.className = 'dm-page-nav dm-page-nav-prev';
  mobilePrev.setAttribute('aria-label', 'Previous page');
  mobilePrev.innerHTML = '<span class="dm-page-nav-icon" aria-hidden="true">\u2039</span>';
  mobilePrev.disabled = currentPage <= 1 || totalPages < 1;
  mobilePrev.addEventListener('click', () => onPageChange(currentPage - 1));

  const mobilePicker = document.createElement('div');
  mobilePicker.className = 'dm-pagination-mobile-picker';
  const pageSelectId = `dm-pagination-page-${Math.random().toString(36).slice(2, 9)}`;
  const pageSelect = document.createElement('select');
  pageSelect.id = pageSelectId;
  pageSelect.className = 'dm-pagination-page-select';
  pageSelect.setAttribute('aria-label', 'Current page');
  for (let p = 1; p <= totalPages; p += 1) {
    const opt = document.createElement('option');
    opt.value = String(p);
    opt.textContent = String(p);
    if (p === currentPage) opt.selected = true;
    pageSelect.append(opt);
  }
  pageSelect.addEventListener('change', () => {
    const page = Number(pageSelect.value) || currentPage;
    onPageChange(page);
  });
  const ofText = document.createElement('span');
  ofText.className = 'dm-pagination-mobile-of';
  ofText.textContent = `of ${Math.max(totalPages, 1)}`;
  mobilePicker.append(pageSelect, ofText);

  const mobileNext = document.createElement('button');
  mobileNext.type = 'button';
  mobileNext.className = 'dm-page-nav dm-page-nav-next';
  mobileNext.setAttribute('aria-label', 'Next page');
  mobileNext.innerHTML = '<span class="dm-page-nav-icon" aria-hidden="true">\u203A</span>';
  mobileNext.disabled = currentPage >= totalPages || totalPages < 1;
  mobileNext.addEventListener('click', () => onPageChange(currentPage + 1));
  mobileNav.append(mobilePrev, mobilePicker, mobileNext);

  const mobileViewing = document.createElement('p');
  mobileViewing.className = 'dm-pagination-mobile-viewing';
  mobileViewing.textContent = viewing.textContent;

  root.append(mobileNav, mobileViewing, bar);

  return root;
}
