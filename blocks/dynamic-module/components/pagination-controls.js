/**
 * Shared pagination UI: items-per-page, viewing summary, prev/next,
 * up to 5 page numbers with ellipsis. Used by Search Results and Dynamic Module.
 */

const ROWS_OPTIONS = [10, 20, 50];

/**
 * "Viewing " (regular) + range/total (bold) for desktop and mobile viewing lines.
 * @param {HTMLElement} el
 * @param {number} start
 * @param {number} end
 * @param {number} total
 */
function setViewingLineContent(el, start, end, total, labels = {}) {
  el.replaceChildren();
  const intro = document.createElement('span');
  intro.className = 'dm-pagination-viewing-intro';
  intro.textContent = labels.viewing || 'Viewing ';

  const detail = document.createElement('span');
  detail.className = 'dm-pagination-viewing-detail';
  detail.textContent = `${start.toLocaleString()}-${end.toLocaleString()} of ${total.toLocaleString()} ${labels.items || 'items'}`;

  el.append(intro, detail);
}

/**
 * Shared numeric listbox (items-per-page + mobile current-page).
 * Same markup/CSS as design system select.
 * @param {object} opts
 * @param {string | null} opts.labelId - `<label id>`; when null, use `ariaLabel` on trigger + list.
 * @param {string} opts.ariaLabel - required when `labelId` is null.
 * @param {string} opts.triggerId
 * @param {number} opts.value
 * @param {number[]} opts.options
 * @param {(n: number) => void} opts.onChange
 */
function createNumericListboxCombobox({
  labelId,
  ariaLabel,
  triggerId,
  value,
  options: optionValues,
  onChange,
}) {
  const wrap = document.createElement('div');
  wrap.className = 'dm-pagination-per-select-wrap';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'dm-pagination-per-trigger';
  trigger.id = triggerId;
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  if (labelId) {
    trigger.setAttribute('aria-labelledby', `${labelId} ${triggerId}-value`);
  } else {
    trigger.setAttribute('aria-label', ariaLabel);
  }

  const valueSpan = document.createElement('span');
  valueSpan.className = 'dm-pagination-per-value';
  valueSpan.id = `${triggerId}-value`;
  valueSpan.textContent = String(value);

  const chevron = document.createElement('span');
  chevron.className = 'dm-pagination-per-chevron';
  chevron.setAttribute('aria-hidden', 'true');

  trigger.append(valueSpan, chevron);

  const list = document.createElement('ul');
  list.className = 'dm-pagination-per-menu';
  list.setAttribute('role', 'listbox');
  if (labelId) {
    list.setAttribute('aria-labelledby', labelId);
  } else {
    list.setAttribute('aria-label', ariaLabel);
  }
  list.hidden = true;

  optionValues.forEach((n) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'presentation');
    const optBtn = document.createElement('button');
    optBtn.type = 'button';
    optBtn.className = 'dm-pagination-per-option';
    optBtn.setAttribute('role', 'option');
    optBtn.dataset.value = String(n);
    optBtn.textContent = String(n);
    optBtn.setAttribute('aria-selected', n === value ? 'true' : 'false');
    li.append(optBtn);
    list.append(li);
  });

  wrap.append(trigger, list);

  let menuOpen = false;

  const optionEls = () => [...list.querySelectorAll('.dm-pagination-per-option')];

  function updateValueDisplay(n) {
    valueSpan.textContent = String(n);
    optionEls().forEach((btn) => {
      btn.setAttribute('aria-selected', btn.dataset.value === String(n) ? 'true' : 'false');
    });
  }

  const menuCtl = {
    onDocClick(e) {
      if (!wrap.contains(e.target)) menuCtl.setOpen(false);
    },
    onDocKey(e) {
      if (e.key === 'Escape' && menuOpen) {
        e.preventDefault();
        e.stopPropagation();
        menuCtl.setOpen(false);
        trigger.focus();
      }
    },
    setOpen(open) {
      menuOpen = open;
      wrap.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      list.hidden = !open;
      document.removeEventListener('click', menuCtl.onDocClick);
      document.removeEventListener('keydown', menuCtl.onDocKey, true);
      if (open) {
        setTimeout(() => {
          document.addEventListener('click', menuCtl.onDocClick);
        }, 0);
        document.addEventListener('keydown', menuCtl.onDocKey, true);
        window.requestAnimationFrame(() => {
          const opts = optionEls();
          const selected = opts.find((b) => b.getAttribute('aria-selected') === 'true');
          (selected ?? opts[0])?.focus();
        });
      }
    },
  };

  function selectValue(n) {
    updateValueDisplay(n);
    onChange(n);
    menuCtl.setOpen(false);
    trigger.focus();
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    menuCtl.setOpen(!menuOpen);
  });

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!menuOpen) menuCtl.setOpen(true);
    }
  });

  optionEls().forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectValue(Number(btn.dataset.value));
    });
  });

  list.addEventListener('keydown', (e) => {
    const opts = optionEls();
    const active = document.activeElement;
    const idx = opts.indexOf(active);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = idx < 0 ? 0 : Math.min(idx + 1, opts.length - 1);
      opts[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = idx < 0 ? opts.length - 1 : Math.max(idx - 1, 0);
      opts[prev]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      opts[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      opts[opts.length - 1]?.focus();
    }
  });

  return wrap;
}

/**
 * Items-per-page control (label + combobox).
 */
function createRowsPerPageCombobox({
  labelId,
  triggerId,
  rowsPerPage,
  onRowsChange,
}) {
  return createNumericListboxCombobox({
    labelId,
    ariaLabel: '',
    triggerId,
    value: rowsPerPage,
    options: ROWS_OPTIONS,
    onChange: onRowsChange,
  });
}

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
  labels = {},
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
  setViewingLineContent(viewing, start, end, safeTotal, labels);

  const perWrap = document.createElement('div');
  perWrap.className = 'dm-pagination-per-wrap';
  const labelId = `dm-pagination-pl-${Math.random().toString(36).slice(2, 9)}`;
  const triggerId = `dm-pagination-pt-${Math.random().toString(36).slice(2, 9)}`;
  const perLabel = document.createElement('span');
  perLabel.className = 'dm-pagination-per-label';
  perLabel.id = labelId;
  perLabel.textContent = labels.itemsPerPage || 'Items per page:';

  const perCombo = createRowsPerPageCombobox({
    labelId,
    triggerId,
    rowsPerPage,
    onRowsChange,
  });

  perWrap.append(perLabel, perCombo);
  meta.append(viewing, perWrap);

  const nav = document.createElement('nav');
  nav.className = 'dm-pagination-nav';
  nav.setAttribute('aria-label', 'Pagination');

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'dm-page-nav dm-page-nav-prev';
  prev.setAttribute('aria-label', 'Previous page');
  prev.innerHTML = '<span class="dm-page-nav-icon" aria-hidden="true">\u2039</span>';
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
  mobilePrev.addEventListener('click', () => onPageChange(currentPage - 1));

  const mobilePicker = document.createElement('div');
  mobilePicker.className = 'dm-pagination-mobile-picker';
  const pageCount = Math.max(totalPages, 1);
  const safeMobilePage = Math.min(Math.max(currentPage, 1), pageCount);
  const pageTriggerId = `dm-pagination-pgm-${Math.random().toString(36).slice(2, 9)}`;
  const pageCombo = createNumericListboxCombobox({
    labelId: null,
    ariaLabel: 'Current page',
    triggerId: pageTriggerId,
    value: safeMobilePage,
    options: Array.from({ length: pageCount }, (_, i) => i + 1),
    onChange: onPageChange,
  });
  const ofText = document.createElement('span');
  ofText.className = 'dm-pagination-mobile-of';
  ofText.textContent = `of ${pageCount}`;
  mobilePicker.append(pageCombo, ofText);

  const mobileNext = document.createElement('button');
  mobileNext.type = 'button';
  mobileNext.className = 'dm-page-nav dm-page-nav-next';
  mobileNext.setAttribute('aria-label', 'Next page');
  mobileNext.innerHTML = '<span class="dm-page-nav-icon" aria-hidden="true">\u203A</span>';
  mobileNext.addEventListener('click', () => onPageChange(currentPage + 1));
  mobileNav.append(mobilePrev, mobilePicker, mobileNext);

  const mobileViewing = document.createElement('p');
  mobileViewing.className = 'dm-pagination-mobile-viewing';
  setViewingLineContent(mobileViewing, start, end, safeTotal, labels);

  root.append(mobileNav, mobileViewing, bar);

  return root;
}
