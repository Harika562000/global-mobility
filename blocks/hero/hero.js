import { eyebrowDecorator } from '../../scripts/scripts.js';
import { decorateButtons } from '../../scripts/aem.js';

/**
 * Hero block: three variations (UE authoring reference).
 *
 * Variation summary (from UE authoring UI):
 * - Image as background: image, heading, description, 2 buttons.
 * - Two-colored:        image, heading, description.
 * - Black-colored:      image, tag, eyebrow, heading, description, 1 button.
 *
 * Row indices (idx = 1 when rows[0] is Variation; idx = 0 when no variation row):
 * - Image as background / Two-colored: heading=idx+2, description=idx+3 (no eyebrow row in DOM). Buttons from idx+4.
 * - Black-colored: rows[0]=image, rows[1]=eyebrow, rows[2]=heading, rows[3]=description. Buttons from 4. Tag=last.
 * Button link rows are detected dynamically (scanning for <a>).
 */

/** Get the value cell (content) from a row; UE often uses row = [label, value]. */
function getValueCell(row) {
  if (!row) return null;
  return row.children.length > 1 ? row.children[1] : row.children[0] || row;
}

function appendContent(row, target, fallbackHeading = false) {
  if (!row) return;
  const cell = getValueCell(row);
  const scope = cell || row;
  const contentSelector = 'h1, h2, h3, h4, h5, h6, p';
  let elements = scope.querySelectorAll(contentSelector);
  if (elements.length === 0 && scope.querySelector(':scope > div')) {
    const inner = scope.querySelector(':scope > div');
    elements = inner.querySelectorAll(contentSelector);
  }
  if (elements.length) {
    elements.forEach((el) => target.appendChild(el));
  } else {
    const text = scope.textContent?.trim();
    if (text) {
      const el = fallbackHeading ? document.createElement('h2') : document.createElement('p');
      el.textContent = text;
      target.appendChild(el);
    } else {
      const source = scope.querySelector(':scope > div') || scope;
      while (source.firstChild) {
        target.appendChild(source.firstChild);
      }
    }
  }
}

function findLinkRow(rows, startIdx, endIdx) {
  for (let i = startIdx; i < endIdx; i += 1) {
    if (rows[i]?.querySelector('a')) return i;
  }
  return -1;
}

function buildCta(rows, linkIdx, typeRowIdx = -1) {
  if (linkIdx < 0) return null;

  const linkRow = rows[linkIdx];
  if (!linkRow) return null;

  const anchor = linkRow.querySelector('a');
  const linkText = getValueCell(rows[linkIdx + 1])?.textContent?.trim();
  const linkTitle = getValueCell(rows[linkIdx + 2])?.textContent?.trim();

  let linkType = '';
  if (anchor) {
    const parent = anchor.parentElement;
    if (parent?.tagName === 'EM') linkType = 'secondary';
    else if (parent?.tagName === 'STRONG') linkType = 'primary';
  }
  if (!linkType && typeRowIdx >= 0 && rows[typeRowIdx]) {
    linkType = (getValueCell(rows[typeRowIdx])?.textContent?.trim() || '').toLowerCase();
  }
  if (!linkType) {
    linkType = (getValueCell(rows[linkIdx + 3])?.textContent?.trim() || '').toLowerCase();
  }
  if (!linkType && linkIdx >= 1) {
    const prevCell = getValueCell(rows[linkIdx - 1]);
    if (prevCell?.querySelector('em') && !prevCell?.querySelector('a')) linkType = 'secondary';
    else if (prevCell?.querySelector('strong') && !prevCell?.querySelector('a')) linkType = 'primary';
  }

  if (!anchor && !linkText) return null;

  const a = anchor || document.createElement('a');
  if (!anchor) a.href = '#';
  a.className = '';
  if (linkText) a.textContent = linkText;
  if (linkTitle) a.title = linkTitle;

  const p = document.createElement('p');

  if (linkType === 'primary') {
    const strong = document.createElement('strong');
    strong.appendChild(a);
    p.appendChild(strong);
  } else if (linkType === 'secondary') {
    const em = document.createElement('em');
    em.appendChild(a);
    p.appendChild(em);
  } else {
    p.appendChild(a);
  }

  return p;
}

function decorateEmAccent(block, rows, picture, primaryIdx, secondaryIdx, rowIndices) {
  const bgDiv = document.createElement('div');
  bgDiv.className = 'hero-em-accent-background';
  if (picture) {
    picture.querySelector('img')?.setAttribute('loading', 'eager');
    bgDiv.appendChild(picture);
  }

  const contentDiv = document.createElement('div');
  contentDiv.className = 'hero-em-accent-content';

  appendContent(rows[rowIndices.heading], contentDiv, true);
  appendContent(rows[rowIndices.description], contentDiv);

  const primaryCta = buildCta(rows, primaryIdx, rowIndices.firstButtonRow >= 0 ? rowIndices.firstButtonRow + 3 : -1);
  if (primaryCta) contentDiv.appendChild(primaryCta);

  const secondaryCta = buildCta(rows, secondaryIdx, rowIndices.firstButtonRow >= 0 ? rowIndices.firstButtonRow + 7 : -1);
  if (secondaryCta) contentDiv.appendChild(secondaryCta);

  decorateButtons(contentDiv);

  block.appendChild(bgDiv);
  block.appendChild(contentDiv);
}

function decorateTwoColoredRight(block, rows, picture, rowIndices) {
  const contentDiv = document.createElement('div');
  contentDiv.className = 'hero-two-colored-right-content';

  appendContent(rows[rowIndices.heading], contentDiv, true);
  appendContent(rows[rowIndices.description], contentDiv);

  const imageDiv = document.createElement('div');
  imageDiv.className = 'hero-two-colored-right-image';
  if (picture) imageDiv.appendChild(picture);

  block.appendChild(contentDiv);
  block.appendChild(imageDiv);
}

function decorateBlackColoredRight(block, rows, picture, primaryIdx, rowIndices) {
  const contentDiv = document.createElement('div');
  contentDiv.className = 'hero-black-colored-right-content';

  const tagRow = rows[rowIndices.tag];
  const tagText = getValueCell(tagRow)?.textContent?.trim();
  if (tagText) {
    const variationRow = rowIndices.tagVariation >= 0 ? rows[rowIndices.tagVariation] : null;
    const tagVariation = variationRow ? getValueCell(variationRow)?.textContent?.trim()?.toLowerCase() : '';
    let tagClasses = 'tag';
    if (tagVariation) {
      tagClasses += ` tag-${tagVariation}`;
    } else {
      tagClasses += ' tag-dark';
    }
    const tagSpan = document.createElement('span');
    tagSpan.className = tagClasses;
    tagSpan.textContent = tagText;
    contentDiv.appendChild(tagSpan);
  }

  if (rowIndices.eyebrow >= 0) {
    const eyebrowRow = rows[rowIndices.eyebrow];
    const eyebrowCell = getValueCell(eyebrowRow);
    const eyebrowText = eyebrowCell?.textContent?.trim();
    if (eyebrowText) {
      const eyebrowP = eyebrowCell?.querySelector('p');
      const formatted = eyebrowDecorator(eyebrowP || eyebrowText, 'accent-color');
      if (formatted) contentDiv.appendChild(formatted);
    }
  }

  appendContent(rows[rowIndices.heading], contentDiv, true);
  appendContent(rows[rowIndices.description], contentDiv);

  const typeRowIdx = rowIndices.firstButtonRow >= 0 ? rowIndices.firstButtonRow + 3 : -1;
  const cta = buildCta(rows, primaryIdx, typeRowIdx);
  if (cta) contentDiv.appendChild(cta);
  decorateButtons(contentDiv);

  const imageDiv = document.createElement('div');
  imageDiv.className = 'hero-black-colored-right-image';
  if (picture) imageDiv.appendChild(picture);

  block.appendChild(contentDiv);
  block.appendChild(imageDiv);
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const section = block.closest('.section');
  if (section && section.classList.contains('bg-light-grey')) {
    section.classList.add('hero-section');
  }

  const isBlackColoredRight = block.classList.contains('hero-black-colored-right');
  const isTwoColoredRight = block.classList.contains('hero-two-colored-right');

  const lastDataRow = rows.length - 1;
  const hasVariationRow = !rows[0]?.querySelector('picture');
  const idx = hasVariationRow ? 1 : 0;

  const picture = isBlackColoredRight
    ? rows[0]?.querySelector('picture')
    : rows[idx]?.querySelector('picture');

  if (isBlackColoredRight) {
    const pictureRow = rows[0];
    if (picture && pictureRow) {
      const altCell = getValueCell(pictureRow);
      const alt = altCell?.textContent?.trim();
      if (alt) {
        const img = picture.querySelector('img');
        if (img) img.setAttribute('alt', alt);
      }
    }
  } else {
    const altText = getValueCell(rows[idx + 1])?.textContent?.trim();
    if (picture && altText) {
      const img = picture.querySelector('img');
      if (img) img.setAttribute('alt', altText);
    }
  }

  const firstButtonRow = isBlackColoredRight ? 4 : idx + 4;
  const rowIndices = isBlackColoredRight
    ? {
      eyebrow: 1,
      heading: 2,
      description: 3,
      tagVariation: lastDataRow - 1,
      tag: lastDataRow,
      firstButtonRow: 4,
    }
    : {
      eyebrow: -1,
      heading: idx + 2,
      description: idx + 3,
      tagVariation: -1,
      tag: lastDataRow,
      firstButtonRow,
    };

  const primaryIdx = findLinkRow(rows, firstButtonRow, lastDataRow);
  const secondaryIdx = primaryIdx >= 0
    ? findLinkRow(rows, primaryIdx + 4, lastDataRow)
    : -1;

  if (isBlackColoredRight) {
    decorateBlackColoredRight(block, rows, picture, primaryIdx, rowIndices);
  } else if (isTwoColoredRight) {
    decorateTwoColoredRight(block, rows, picture, rowIndices);
  } else {
    decorateEmAccent(block, rows, picture, primaryIdx, secondaryIdx, rowIndices);
  }

  rows.forEach((r) => r.remove());
}
