import { readBlockConfig } from '../../scripts/aem.js';
import { events } from '../../scripts/s-and-p-global/events.js';
import createPaginationControls from './components/pagination-controls.js';

const SEARCH_SCOPE = 'search';

function decoratePrevNext(block, config) {
  block.innerHTML = '';
  block.classList.add('dynamic-module', 'dynamic-module-prev-next');
  block.dataset.variation = 'previous-next';

  const prevUrl = config['previous-link'] ?? config.previousLink ?? '';
  const nextUrl = config['next-link'] ?? config.nextLink ?? '';
  const labelsRaw = (config['link-labels'] ?? config.linkLabels ?? '').trim();
  let prevLabel = 'Previous';
  let nextLabel = 'Next';
  if (labelsRaw) {
    const parts = labelsRaw.split('|').map((s) => s.trim()).filter(Boolean);
    const [p, n] = parts;
    if (p) prevLabel = p;
    if (n) nextLabel = n;
  }

  const nav = document.createElement('nav');
  nav.className = 'dm-prev-next';
  nav.setAttribute('aria-label', 'Page navigation');

  function linkOrSpan(href, label, isPrev) {
    const el = document.createElement(href ? 'a' : 'span');
    el.className = `dm-prev-next-link ${isPrev ? 'dm-prev-next-link-prev' : 'dm-prev-next-link-next'}`;
    if (href) {
      el.href = href;
    } else {
      el.setAttribute('aria-disabled', 'true');
      el.classList.add('is-disabled');
    }
    const arrow = document.createElement('span');
    arrow.className = 'dm-prev-next-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = isPrev ? '\u2039' : '\u203A';
    const text = document.createElement('span');
    text.className = 'dm-prev-next-text';
    text.textContent = label;
    if (isPrev) {
      el.append(arrow, text);
    } else {
      el.append(text, arrow);
    }
    return el;
  }

  nav.append(linkOrSpan(prevUrl, prevLabel, true), linkOrSpan(nextUrl, nextLabel, false));
  block.append(nav);
}

function decoratePagination(block) {
  block.innerHTML = '';
  block.classList.add('dynamic-module', 'dynamic-module-pagination');
  block.dataset.variation = 'pagination';

  const mount = document.createElement('div');
  mount.className = 'dynamic-module-inner';
  block.append(mount);

  let state = {
    total: 0,
    page: 1,
    rowsPerPage: 10,
    totalPages: 0,
  };

  /** Peer pagination visible — used to emit dedupe events without STATE/emit loops. */
  let peerPaginationVisible = false;

  function render() {
    mount.innerHTML = '';
    const total = Number(state.total) || 0;
    if (total < 1) {
      block.hidden = true;
      if (peerPaginationVisible) {
        peerPaginationVisible = false;
        events.emit('search-results:peer-pagination-mounted', {}, { scope: SEARCH_SCOPE });
      }
      return;
    }
    block.hidden = false;
    const el = createPaginationControls({
      currentPage: state.page,
      totalPages: state.totalPages,
      totalItems: state.total,
      rowsPerPage: state.rowsPerPage,
      onPageChange: (page) => {
        events.emit('search-results:page-change', { page }, { scope: SEARCH_SCOPE });
      },
      onRowsChange: (rows) => {
        events.emit('search-results:rows-change', { rows }, { scope: SEARCH_SCOPE });
      },
    });
    mount.append(el);
    if (!peerPaginationVisible) {
      peerPaginationVisible = true;
      events.emit('search-results:peer-pagination-mounted', {}, { scope: SEARCH_SCOPE });
    }
  }

  const sub = events.on(
    'search-results:state',
    (detail) => {
      state = {
        total: detail?.total ?? 0,
        page: detail?.page ?? 1,
        rowsPerPage: detail?.rowsPerPage ?? 10,
        totalPages: detail?.totalPages ?? 0,
      };
      render();
    },
    { scope: SEARCH_SCOPE, eager: true },
  );

  render();

  block.addEventListener('DOMNodeRemovedFromDocument', () => {
    sub?.off?.();
  });
}

export default function decorate(block) {
  const config = readBlockConfig(block);

  // In this project, select fields named `classes` are reliably applied as CSS classes
  // by the block loader (see similar handling in `hero`/other blocks).
  let variationClass = '';
  if (block.classList.contains('previous-next')) variationClass = 'previous-next';
  else if (block.classList.contains('pagination')) variationClass = 'pagination';
  const wantsPrevNextByClass = variationClass === 'previous-next';

  // UE select rows may serialize either the option `value` or the option `name` (label text).
  // Support both so authors see the correct variation.
  const raw = config.variation ?? '';
  const variation = String(raw).trim().toLowerCase();

  // Debugging helpers: helps verify which authored values arrive in JS.
  // Safe to leave since it only affects DOM attributes.
  block.dataset.dmDebugVariationRaw = String(raw ?? '');
  block.dataset.dmDebugVariationClass = variationClass;
  block.dataset.dmDebugHasPrevNextLinks = (config['previous-link'] || config.previousLink
    || config['next-link'] || config.nextLink) ? '1' : '0';
  block.dataset.dmDebugHasPrevNextLabels = (config['link-labels'] || config.linkLabels) ? '1' : '0';

  const isPreviousNext = (
    variation === 'previous-next'
    || variation === 'previous next'
    || variation === 'previous/next'
    || variation === 'previous / next'
    || variation === 'previousnext'
    || variation === 'prev-next'
    || (variation.includes('previous') && variation.includes('next'))
    || (variation.includes('prev') && variation.includes('next'))
  );

  const hasPrevNextLinks = Boolean(
    config['previous-link'] || config.previousLink
    || config['next-link'] || config.nextLink,
  );
  const hasPrevNextLabels = Boolean(
    config['link-labels'] || config.linkLabels,
  );

  // Decide based on:
  // 1) variation intent from the loader-applied CSS class (`classes` field)
  // 2) any prev/next-specific authored fields (links/labels)
  // 3) fallback parsing from config.variation (kept for backward compatibility)
  if (wantsPrevNextByClass || isPreviousNext || hasPrevNextLinks || hasPrevNextLabels) {
    decoratePrevNext(block, config);
    return;
  }
  decoratePagination(block);
}
