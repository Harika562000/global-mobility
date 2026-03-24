import { eyebrowDecorator, decorateTags } from '../../scripts/scripts.js';

/**
 * Hero block: three variations (UE authoring reference).
 *
 * Variation summary (from UE authoring UI):
 * - Image as background: image, heading, description.
 * - Two-colored:        image, heading, description.
 * - Black-colored: image, tag, eyebrow, heading, description.
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

function decorateEmAccent(block, rows, picture, rowIndices) {
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

  for (let r = rowIndices.firstButtonRow; r < rows.length; r += 1) {
    if (rows[r]) appendContent(rows[r], contentDiv);
  }

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

function decorateBlackColoredRight(block, rows, picture, rowIndices) {
  const contentDiv = document.createElement('div');
  contentDiv.className = 'hero-black-colored-right-content';

  const tagRow = rows[rowIndices.tag];
  const tagText = getValueCell(tagRow)?.textContent?.trim();
  if (tagText) {
    const variationRow = rowIndices.tagVariation >= 0 ? rows[rowIndices.tagVariation] : null;
    const tagVariation = (variationRow ? getValueCell(variationRow)?.textContent?.trim() : '') || 'dark';
    const table = document.createElement('table');
    const tr1 = document.createElement('tr');
    tr1.appendChild(document.createElement('td')).textContent = `tag (${tagVariation})`;
    const tr2 = document.createElement('tr');
    tr2.appendChild(document.createElement('td')).textContent = tagText;
    table.append(tr1, tr2);
    contentDiv.appendChild(table);
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

  for (let r = rowIndices.firstButtonRow; r < rowIndices.tag; r += 1) {
    // Tag variation is used only for tag styling; don't render it as body text.
    if (r !== rowIndices.tagVariation && rows[r]) {
      appendContent(rows[r], contentDiv);
    }
  }
  decorateTags(contentDiv);

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
  const findRowByLabel = (dataRows, fromIdx, toIdx, labelPart) => {
    const lower = (labelPart || '').toLowerCase();
    for (let i = fromIdx; i <= toIdx; i += 1) {
      const label = (dataRows[i]?.children[0]?.textContent || '').toLowerCase();
      if (label.includes(lower)) return i;
    }
    return -1;
  };
  let tagTitleIdx = isBlackColoredRight
    ? findRowByLabel(rows, firstButtonRow, lastDataRow, 'tag title')
    : -1;
  let tagVariationIdx = isBlackColoredRight
    ? ['tag variation', 'tag var', 'tagvariation'].reduce(
      (found, label) => (
        found >= 0 ? found : findRowByLabel(rows, firstButtonRow, lastDataRow, label)
      ),
      -1,
    )
    : -1;

  // UE nested "tag" container rows are sometimes unlabeled; fall back to tail rows.
  if (isBlackColoredRight) {
    const knownVariations = ['outline', 'fill', 'glass', 'dark'];
    const isKnownTagVariation = (val) => knownVariations
      .includes((val || '').trim().toLowerCase());

    // If we couldn't find the labeled rows, assume the last row is tag title
    // and the row before it is variation.
    if (tagTitleIdx < 0) tagTitleIdx = lastDataRow;
    if (tagVariationIdx < 0) {
      const candidateIdx = tagTitleIdx - 1;
      const candidateText = getValueCell(rows[candidateIdx])?.textContent?.trim();
      if (candidateIdx >= firstButtonRow && isKnownTagVariation(candidateText)) {
        tagVariationIdx = candidateIdx;
      }
    }
  }
  const rowIndices = isBlackColoredRight
    ? {
      eyebrow: 1,
      heading: 2,
      description: 3,
      tagVariation: tagVariationIdx,
      tag: tagTitleIdx >= 0 ? tagTitleIdx : lastDataRow,
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

  if (isBlackColoredRight) {
    decorateBlackColoredRight(block, rows, picture, rowIndices);
  } else if (isTwoColoredRight) {
    decorateTwoColoredRight(block, rows, picture, rowIndices);
  } else {
    decorateEmAccent(block, rows, picture, rowIndices);
  }

  rows.forEach((r) => r.remove());
}
