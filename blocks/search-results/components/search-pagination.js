function createPageButton(page, currentPage, onPageChange) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'search-results-page-btn';
  if (page === currentPage) btn.classList.add('is-active');
  btn.textContent = String(page);
  btn.addEventListener('click', () => onPageChange(page));
  return btn;
}

export default function createSearchPagination({
  currentPage,
  totalPages,
  onPageChange,
}) {
  const wrapper = document.createElement('nav');
  wrapper.className = 'search-results-pagination';
  wrapper.setAttribute('aria-label', 'Search results pages');

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'search-results-page-nav';
  prev.textContent = '\u2039';
  prev.setAttribute('aria-label', 'Previous page');
  prev.disabled = currentPage <= 1;
  prev.addEventListener('click', () => onPageChange(currentPage - 1));
  wrapper.append(prev);

  const maxButtons = 5;
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + maxButtons - 1);
  for (let page = start; page <= end; page += 1) {
    wrapper.append(createPageButton(page, currentPage, onPageChange));
  }

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'search-results-page-nav';
  next.textContent = '\u203A';
  next.setAttribute('aria-label', 'Next page');
  next.disabled = currentPage >= totalPages;
  next.addEventListener('click', () => onPageChange(currentPage + 1));
  wrapper.append(next);

  return wrapper;
}
