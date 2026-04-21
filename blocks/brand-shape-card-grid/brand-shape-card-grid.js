import { eyebrowDecorator, moveInstrumentation } from '../../scripts/scripts.js';
import {
  DEFAULT_CAROUSEL_OPTIONS,
  initCarousel,
} from '../../scripts/s-and-p-global/s-and-p-carousel.js';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const BSCG_CAROUSEL_SETTINGS = {
  ...DEFAULT_CAROUSEL_OPTIONS,
  mobileOnly: true,
  infinite: false,
  showBottomNav: false,
  clampToMaxOffset: false,
  transitionDurationMs: 400,
  transitionEasing: 'ease',
};

/* -------------------------------------------------------------------------- */
/* DOM helpers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Extract header and card rows from the block's direct child rows.
 * Row layout authored in the document:
 *   Row 1: eyebrow text  (single cell, no heading, no image)
 *   Row 2: heading       (single cell with h1-h6)
 *   Row 3+: card rows   (multiple cells: image | logo | title | CTA)
 *
 * @param {HTMLElement[]} rows
 * @returns {{ eyebrow: string, titleNode: Node|null, cardRows: HTMLElement[] }}
 */
function extractBlockData(rows) {
  let eyebrow = '';
  let titleNode = null;
  const cardRows = [];

  rows.forEach((row) => {
    const cell = row.firstElementChild;
    if (!cell) return;

    // Multi-column rows are always card rows
    if (row.children.length >= 2) {
      cardRows.push(row);
      return;
    }

    const hasHeading = cell.querySelector('h1, h2, h3, h4, h5, h6');
    const hasImage = cell.querySelector('picture, img');
    const text = cell.textContent.trim();

    if (hasImage) {
      cardRows.push(row);
      return;
    }

    if (hasHeading && !titleNode) {
      titleNode = cell.cloneNode(true);
      return;
    }

    if (text && !eyebrow && !hasHeading && !cell.querySelector('a')) {
      eyebrow = text;
      return;
    }

    // Anything else with a link goes to card rows
    cardRows.push(row);
  });

  return { eyebrow, titleNode, cardRows };
}

/**
 * Build the block header: eyebrow label + heading.
 *
 * @param {string} eyebrow
 * @param {Node|null} titleNode
 * @returns {HTMLElement}
 */
function createHeader(eyebrow, titleNode) {
  const header = document.createElement('div');
  header.className = 'bscg-header';

  if (eyebrow) {
    const eyebrowEl = eyebrowDecorator(eyebrow, 'accent-color');
    if (eyebrowEl) {
      const eyebrowWrap = document.createElement('div');
      eyebrowWrap.className = 'bscg-eyebrow';
      eyebrowWrap.append(eyebrowEl);
      header.append(eyebrowWrap);
    }
  }

  if (titleNode) {
    const titleWrap = document.createElement('div');
    titleWrap.className = 'bscg-title';
    titleWrap.append(...[...titleNode.childNodes]);
    header.append(titleWrap);
  }

  return header;
}

/**
 * Build a single card element from a block row.
 * Authored columns: [image] [logo] [title] [CTA link] [CTA name]
 *   - image    (required)  col 0
 *   - logo     (optional)  col 1
 *   - title    (required)  col 2
 *   - CTA link (optional)  col 3 — contains the anchor/href
 *   - CTA name (optional)  col 4 — display label for the CTA
 *
 * @param {HTMLElement} row
 * @returns {HTMLElement}
 */
function createCardElement(row) {
  const cells = [...row.children];

  const imageCell = cells[0] || null;
  const logoCell = cells[1] || null;
  const titleCell = cells[2] || null;
  const ctaCell = cells[3] || null;
  const ctaNameCell = cells[4] || null;

  // Derive the card link from the CTA cell
  const linkEl = ctaCell?.querySelector('a[href]');
  const href = linkEl?.getAttribute('href') || linkEl?.href || '';

  const isLink = !!href;
  const card = document.createElement(isLink ? 'a' : 'div');
  card.className = 'bscg-card';

  if (isLink) {
    card.href = href;
    // Always open in same tab per acceptance criteria
    card.removeAttribute('target');
  }

  // --- Card image (top, full width) ---
  if (imageCell) {
    const imageWrap = document.createElement('div');
    imageWrap.className = 'bscg-card-image';
    const pic = imageCell.querySelector('picture, img');
    if (pic) {
      imageWrap.append(pic.closest('picture') || pic);
    }
    card.append(imageWrap);
  }

  // --- Card body (logo + title + CTA) ---
  const body = document.createElement('div');
  body.className = 'bscg-card-body';

  // Logo (optional)
  if (logoCell) {
    const logoPic = logoCell.querySelector('picture, img');
    if (logoPic) {
      const logoWrap = document.createElement('div');
      logoWrap.className = 'bscg-card-logo';
      logoWrap.append(logoPic.closest('picture') || logoPic);
      body.append(logoWrap);
    }
  }

  // Title / description text
  if (titleCell?.textContent.trim()) {
    const titleWrap = document.createElement('div');
    titleWrap.className = 'bscg-card-title';
    titleWrap.append(...[...titleCell.cloneNode(true).childNodes]);
    body.append(titleWrap);
  }

  // CTA row: label (from col 4) + arrow (only when a link exists in col 3).
  const ctaText = ctaNameCell?.textContent?.trim() || '';

  const ctaRow = document.createElement('div');
  ctaRow.className = 'bscg-card-cta';

  if (ctaText) {
    const ctaLabel = document.createElement('span');
    ctaLabel.className = 'bscg-card-cta-label';
    ctaLabel.textContent = ctaText;
    ctaRow.append(ctaLabel);
  }

  // Arrow icon — only rendered when a CTA link is present in col 3
  if (isLink) {
    const arrowIcon = document.createElement('span');
    arrowIcon.className = 'bscg-card-arrow';

    const iconWrapper = document.createElement('span');
    iconWrapper.className = 'icon-arrow-right';
    iconWrapper.setAttribute('aria-hidden', 'true');

    const arrowImg = document.createElement('img');
    arrowImg.src = '/icons/arrow-up-right.svg';
    arrowImg.alt = '';
    arrowImg.loading = 'lazy';
    iconWrapper.append(arrowImg);
    arrowIcon.append(iconWrapper);
    ctaRow.append(arrowIcon);
  }

  body.append(ctaRow);
  card.append(body);

  // Shape decoration — positioned to the right of the card body via CSS
  const shapeIcon = document.createElement('img');
  shapeIcon.className = 'bscg-card-shape';
  shapeIcon.src = '/icons/Shape.svg';
  shapeIcon.alt = '';
  shapeIcon.setAttribute('aria-hidden', 'true');
  shapeIcon.loading = 'lazy';
  card.append(shapeIcon);

  return card;
}

/* -------------------------------------------------------------------------- */
/* decorate                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Decorate the Brand Shape Card Grid block.
 *
 * Variants (based on class):
 *   no 'slider' class — default; cards are stacked on mobile, grid on desktop
 *   'slider' class  — mobile: horizontal swipe carousel; desktop: grid
 *
 * @param {HTMLElement} block
 */
export default async function decorate(block) {
  const rows = [...block.children].filter((row) => row.tagName === 'DIV');
  if (!rows.length) return;

  const { eyebrow, titleNode, cardRows } = extractBlockData(rows);

  // Build header
  const header = createHeader(eyebrow, titleNode);

  // Build cards grid / track
  const cardsGrid = document.createElement('div');
  cardsGrid.className = 'bscg-cards';

  cardRows.forEach((row) => {
    const card = createCardElement(row);
    moveInstrumentation(row, card);
    cardsGrid.append(card);
  });

  // Replace block content
  block.replaceChildren(header, cardsGrid);
  block.classList.add('initialized');

  // Initialise carousel on mobile only when slider variation is selected
  const cards = [...cardsGrid.children];
  if (block.classList.contains('slider') && cards.length > 1) {
    await initCarousel(cardsGrid, {
      mobileOnly: BSCG_CAROUSEL_SETTINGS.mobileOnly,
      infinite: BSCG_CAROUSEL_SETTINGS.infinite,
      showBottomNav: BSCG_CAROUSEL_SETTINGS.showBottomNav,
      transitionDurationMs: BSCG_CAROUSEL_SETTINGS.transitionDurationMs,
      transitionEasing: BSCG_CAROUSEL_SETTINGS.transitionEasing,
      dragThresholdPx: BSCG_CAROUSEL_SETTINGS.dragThresholdPx,
      swipeCommitPx: BSCG_CAROUSEL_SETTINGS.swipeCommitPx,
      swipeSlideFactor: BSCG_CAROUSEL_SETTINGS.swipeSlideFactor,
      clampToMaxOffset: BSCG_CAROUSEL_SETTINGS.clampToMaxOffset,
    });
  }
}
