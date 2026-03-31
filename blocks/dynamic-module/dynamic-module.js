import { readBlockConfig } from '../../scripts/aem.js';
import { events } from '../../scripts/s-and-p-global/events.js';
import createPaginationControls from './components/pagination-controls.js';

const SEARCH_SCOPE = 'search';

/** Chevron stroke weight is set in CSS (thinner ≥510px per UI Library). */
function prevNextChevronSvg(isPrev) {
  const d = isPrev ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6';
  return `<svg class="dm-prev-next-chevron-svg" width="12" height="12" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-linecap="butt" stroke-linejoin="miter" d="${d}"/></svg>`;
}

function resolvePossiblyRelativeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) {
    try {
      return new URL(raw, window.location.origin).href;
    } catch {
      return raw;
    }
  }
  return raw;
}

function getHrefLikeFromScope(scope) {
  if (!scope) return '';

  const anchor = scope.querySelector('a[href], a[data-href], [href], [data-href]');
  if (anchor) {
    const href = anchor.getAttribute?.('href') || anchor.getAttribute?.('data-href');
    if (href) return resolvePossiblyRelativeUrl(href);
    if (anchor.href) return resolvePossiblyRelativeUrl(anchor.href);
  }

  // Some authoring widgets render destination as plain text (internal path), not an <a>.
  const text = scope.querySelector('p')?.textContent?.trim()
    || scope.textContent?.trim();
  return text ? resolvePossiblyRelativeUrl(text) : '';
}

function readPrevNextLinksFromBlockDom(block) {
  // Pattern: direct child rows for [Previous, Next] values.
  // Authoring can output empty row content for one side, so preserve row order instead of
  // filtering to only rows that currently contain links.
  const topRows = [...block.children].filter((n) => n instanceof HTMLElement && n.tagName === 'DIV');
  if (topRows.length >= 2) {
    const pickHref = (row) => getHrefLikeFromScope(row);
    return {
      prevUrl: pickHref(topRows[0]),
      nextUrl: pickHref(topRows[1]),
    };
  }

  // Label text comes from `blocks/dynamic-module/_dynamic-module.json`.
  const allNodes = [...block.querySelectorAll('*')];
  const findLabelNode = (needle) => allNodes.find((n) => (
    String(n.textContent || '').trim().toLowerCase().includes(needle)
  ));

  const prevLabelNode = findLabelNode('previous link');
  const nextLabelNode = findLabelNode('next link');

  const readValueScopeFromLabel = (labelNode) => {
    const row = labelNode?.closest('div');
    if (!row) return null;
    const cols = [...row.children].filter((c) => c instanceof HTMLElement);
    // Expected: [label-col, value-col]
    if (cols.length >= 2) return cols[1];
    return labelNode.nextElementSibling || row.querySelector(':scope > div:nth-child(2)');
  };

  const prevScope = readValueScopeFromLabel(prevLabelNode);
  const nextScope = readValueScopeFromLabel(nextLabelNode);

  return {
    prevUrl: getHrefLikeFromScope(prevScope),
    nextUrl: getHrefLikeFromScope(nextScope),
  };
}

function decoratePrevNext(block, config) {
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

  // readBlockConfig can miss link destinations depending on how the authoring widget
  // renders `aem-content`. Fallback to a DOM scan so Previous/Next stay clickable.
  let prevFinalUrl = resolvePossiblyRelativeUrl(prevUrl);
  let nextFinalUrl = resolvePossiblyRelativeUrl(nextUrl);
  if (!prevFinalUrl || !nextFinalUrl) {
    const domLinks = readPrevNextLinksFromBlockDom(block);
    prevFinalUrl = prevFinalUrl || domLinks.prevUrl;
    nextFinalUrl = nextFinalUrl || domLinks.nextUrl;
  }

  block.dataset.dmDebugHasPrevNextLinks = (prevFinalUrl || nextFinalUrl) ? '1' : '0';

  // Clear authored markup only after we've extracted the link destinations.
  block.innerHTML = '';

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
    arrow.innerHTML = prevNextChevronSvg(isPrev);
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

  const divider = document.createElement('span');
  divider.className = 'dm-prev-next-divider';
  divider.setAttribute('aria-hidden', 'true');

  nav.append(
    linkOrSpan(prevFinalUrl, prevLabel, true),
    divider,
    linkOrSpan(nextFinalUrl, nextLabel, false),
  );
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
