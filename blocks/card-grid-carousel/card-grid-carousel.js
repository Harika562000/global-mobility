import { eyebrowDecorator, moveInstrumentation } from '../../scripts/scripts.js';
import {
  DEFAULT_CAROUSEL_OPTIONS,
  initCarousel,
} from '../../scripts/s-and-p-global/s-and-p-carousel.js';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const CARD_GRID_CAROUSEL_SETTINGS = {
  ...DEFAULT_CAROUSEL_OPTIONS,
  mobileOnly: false,
  infinite: false,
  showBottomNav: false,
  clampToMaxOffset: false,
  transitionDurationMs: 500,
  transitionEasing: 'ease',
};

/* -------------------------------------------------------------------------- */
/* DOM helpers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Parse header rows from the block.
 * Expects first rows to contain: eyebrow text, title heading.
 * @param {HTMLElement[]} rows
 * @returns {{ eyebrow: string, titleNode: Node|null, headerRows: HTMLElement[] }}
 */
function extractHeaderData(rows) {
  let eyebrow = '';
  let titleNode = null;
  const headerRows = [];
  const cardRows = [];

  rows.forEach((row) => {
    const cell = row.firstElementChild;
    if (!cell) return;

    const hasHeading = cell.querySelector('h1, h2, h3, h4, h5, h6');
    const hasImage = cell.querySelector('picture, img');
    const text = cell.textContent.trim();

    // If the row has multiple children (multi-column = card data), it's a card row
    if (row.children.length >= 2) {
      cardRows.push(row);
      return;
    }

    // Heading row → title
    if (hasHeading && !titleNode) {
      titleNode = cell.cloneNode(true);
      headerRows.push(row);
      return;
    }

    // Image row → card
    if (hasImage) {
      cardRows.push(row);
      return;
    }

    // Short text without heading and no link → likely eyebrow
    if (text && !eyebrow && !hasHeading && !cell.querySelector('a')) {
      eyebrow = text;
      headerRows.push(row);
      return;
    }

    // Anything with a link → card row
    cardRows.push(row);
  });

  return {
    eyebrow, titleNode, headerRows, cardRows,
  };
}

/**
 * Build the block header: eyebrow at top, then title + nav group.
 * The nav wrapper (.header-actions) receives the carousel nav on desktop.
 */
function createHeader(eyebrow, titleNode) {
  const header = document.createElement('div');
  header.className = 'card-grid-carousel-header margin-bottom-600';

  // Eyebrow
  if (eyebrow) {
    const eyebrowEl = eyebrowDecorator(eyebrow, 'accent-color');
    if (eyebrowEl) {
      const eyebrowWrap = document.createElement('div');
      eyebrowWrap.className = 'card-grid-carousel-eyebrow margin-bottom-300';
      eyebrowWrap.append(eyebrowEl);
      header.append(eyebrowWrap);
    }
  }

  // Title + actions row
  const titleRow = document.createElement('div');
  titleRow.className = 'card-grid-carousel-title-row';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'card-grid-carousel-title';
  if (titleNode) {
    const children = [...titleNode.childNodes];
    titleWrap.append(...children);
  }

  const actions = document.createElement('div');
  actions.className = 'card-grid-carousel-actions';

  titleRow.append(titleWrap, actions);
  header.append(titleRow);

  return { header, actions };
}

/**
 * Build a single card element from a row.
 * Row columns: [label/year] [image] [description] [optional link]
 */
function createCardElement(row) {
  const cells = [...row.children];

  const labelCell = cells[0] || null;
  const imageCell = cells[1] || null;
  const descCell = cells[2] || null;
  const linkCell = cells[3] || null;

  const linkEl = linkCell?.querySelector('a[href]');
  const href = linkEl?.getAttribute('href') || linkEl?.href || '';

  const isLink = !!href;
  const card = document.createElement(isLink ? 'a' : 'div');
  card.className = 'card-grid-carousel-card';

  if (isLink) {
    card.href = href;
    try {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) {
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
      }
    } catch {
      // relative link – fine as-is
    }
  }

  // Label / year at top
  if (labelCell?.textContent.trim()) {
    const label = document.createElement('div');
    label.className = 'card-grid-carousel-card-label';
    label.textContent = labelCell.textContent.trim();
    card.append(label);
  }

  // Divider
  const divider = document.createElement('hr');
  divider.className = 'card-grid-carousel-card-divider margin-bottom-400';
  card.append(divider);

  // Image / logo area
  if (imageCell) {
    const imageWrap = document.createElement('div');
    imageWrap.className = 'card-grid-carousel-card-image margin-bottom-400';
    const pic = imageCell.querySelector('picture, img');
    if (pic) {
      imageWrap.append(pic.closest('picture') || pic);
    } else {
      imageWrap.append(...[...imageCell.cloneNode(true).childNodes]);
    }
    card.append(imageWrap);
  }

  // Description / body text
  if (descCell?.textContent.trim()) {
    const desc = document.createElement('div');
    desc.className = 'card-grid-carousel-card-desc';
    desc.append(...[...descCell.cloneNode(true).childNodes]);
    card.append(desc);
  }

  return card;
}

/* -------------------------------------------------------------------------- */
/* decorate                                                                   */
/* -------------------------------------------------------------------------- */

export default async function decorate(block) {
  const rows = [...block.children].filter((row) => row.tagName === 'DIV');
  if (!rows.length) return;

  const { eyebrow, titleNode, cardRows } = extractHeaderData(rows);

  // Build header
  const { header, actions } = createHeader(eyebrow, titleNode);

  // Build carousel track
  const track = document.createElement('div');
  track.className = 'card-grid-carousel-track';

  cardRows.forEach((row) => {
    const card = createCardElement(row);
    moveInstrumentation(row, card);
    track.append(card);
  });

  // Replace block content
  block.replaceChildren(header, track);
  block.classList.add('initialized');

  // Init carousel if more than one card
  const cards = [...track.children];
  if (cards.length > 1) {
    const result = await initCarousel(track, {
      mobileOnly: CARD_GRID_CAROUSEL_SETTINGS.mobileOnly,
      infinite: CARD_GRID_CAROUSEL_SETTINGS.infinite,
      showBottomNav: CARD_GRID_CAROUSEL_SETTINGS.showBottomNav,
      transitionDurationMs: CARD_GRID_CAROUSEL_SETTINGS.transitionDurationMs,
      transitionEasing: CARD_GRID_CAROUSEL_SETTINGS.transitionEasing,
      dragThresholdPx: CARD_GRID_CAROUSEL_SETTINGS.dragThresholdPx,
      swipeCommitPx: CARD_GRID_CAROUSEL_SETTINGS.swipeCommitPx,
      swipeSlideFactor: CARD_GRID_CAROUSEL_SETTINGS.swipeSlideFactor,
      clampToMaxOffset: CARD_GRID_CAROUSEL_SETTINGS.clampToMaxOffset,
    });

    if (result?.nav) {
      // Move nav buttons into header actions (desktop: shown; mobile: hidden via CSS)
      header.classList.add('has-carousel-nav');
      actions.append(result.nav);
    }
  }
}
