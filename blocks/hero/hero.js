import { eyebrowDecorator, decorateTags } from '../../scripts/scripts.js';

/**
 * Hero block: three variations (UE authoring reference).
 *
 * Variation summary (from UE authoring UI):
 * - Image as background: image, heading, description.
 * - Two-colored:        image, heading, description.
 * - Black-colored: image, tag, eyebrow, heading, description.
 *
 * The `image` reference field accepts both images and videos from DAM.
 * When a video asset is picked, it is rendered as a <video> element
 * instead of a <picture> — no additional field is needed.
 */

/** Video extensions / AEM Assets Delivery API /play pattern */
const VIDEO_SRC_RE = /\.(mp4|mov|webm|ogg)(\?.*)?$/i;
const AEM_DELIVERY_RE = /delivery-p\d+-e\d+\.adobeaemcloud\.com\/adobe\/assets\/urn:[^/]+\/play/i;

/**
 * Returns true when the href points to a video asset.
 * @param {string} href
 * @returns {boolean}
 */
function isVideoHref(href = '') {
  return VIDEO_SRC_RE.test(href) || AEM_DELIVERY_RE.test(href);
}

/**
 * Extracts a video <a> element from a row cell if the reference field
 * resolved to a video asset instead of a picture.
 *
 * @param {Element} row
 * @returns {HTMLAnchorElement|null}
 */
function getVideoLink(row) {
  if (!row) return null;
  const anchors = [...row.querySelectorAll('a[href]')];
  return anchors.find((a) => isVideoHref(a.href)) || null;
}

/**
 * Builds a <video> element for use as a full-bleed background (default variation).
 * Autoplay, muted, loop — mirrors hero-video block behaviour.
 *
 * @param {string} src
 * @returns {HTMLVideoElement}
 */
function createBackgroundVideo(src) {
  const video = document.createElement('video');
  video.setAttribute('autoplay', '');
  video.setAttribute('muted', '');
  video.setAttribute('loop', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('preload', 'auto');
  video.setAttribute('aria-label', 'Hero background video');
  video.muted = true;
  video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';

  const source = document.createElement('source');
  source.src = src;
  source.type = src.includes('/play') ? 'video/mp4' : `video/${src.split('.').pop().split('?')[0].toLowerCase() || 'mp4'}`;
  video.append(source);
  return video;
}

/**
 * Builds a <video> element for use as a side/inline asset (two-colored / black-colored variations).
 * Shows native controls, no autoplay.
 *
 * @param {string} src
 * @returns {HTMLVideoElement}
 */
function createInlineVideo(src) {
  const video = document.createElement('video');
  video.setAttribute('controls', '');
  video.setAttribute('preload', 'metadata');
  video.setAttribute('aria-label', 'Hero video');
  video.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:var(--radius-12);';

  const source = document.createElement('source');
  source.src = src;
  source.type = src.includes('/play') ? 'video/mp4' : `video/${src.split('.').pop().split('?')[0].toLowerCase() || 'mp4'}`;
  video.append(source);
  return video;
}

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

function decorateEmAccent(block, rows, picture, videoLink, rowIndices) {
  const bgDiv = document.createElement('div');
  bgDiv.className = 'hero-em-accent-background';
  if (videoLink) {
    // Video asset selected — render as full-bleed autoplay background video
    const video = createBackgroundVideo(videoLink.href);
    bgDiv.appendChild(video);
  } else if (picture) {
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

function decorateTwoColoredRight(block, rows, picture, videoLink, rowIndices) {
  const contentDiv = document.createElement('div');
  contentDiv.className = 'hero-two-colored-right-content';

  appendContent(rows[rowIndices.heading], contentDiv, true);
  appendContent(rows[rowIndices.description], contentDiv);

  const imageDiv = document.createElement('div');
  imageDiv.className = 'hero-two-colored-right-image';
  if (videoLink) {
    // Video asset selected — render as side inline video
    imageDiv.appendChild(createInlineVideo(videoLink.href));
  } else if (picture) {
    imageDiv.appendChild(picture);
  }

  block.appendChild(contentDiv);
  block.appendChild(imageDiv);
}

function decorateBlackColoredRight(block, rows, picture, videoLink, rowIndices) {
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
  if (videoLink) {
    // Video asset selected — render as side inline video
    imageDiv.appendChild(createInlineVideo(videoLink.href));
  } else if (picture) {
    imageDiv.appendChild(picture);
  }

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

  // Detect whether the reference field resolved to a video or an image.
  // A video produces an <a href="...mp4|/play"> link; an image produces <picture>.
  const mediaRow = isBlackColoredRight ? rows[0] : rows[idx];
  const videoLink = getVideoLink(mediaRow);

  let picture = null;
  if (!videoLink) {
    // Image asset — extract the <picture> from the appropriate row
    picture = isBlackColoredRight
      ? rows[0]?.querySelector('picture')
      : rows[idx]?.querySelector('picture');
  }

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
    decorateBlackColoredRight(block, rows, picture, videoLink, rowIndices);
  } else if (isTwoColoredRight) {
    decorateTwoColoredRight(block, rows, picture, videoLink, rowIndices);
  } else {
    decorateEmAccent(block, rows, picture, videoLink, rowIndices);
  }

  rows.forEach((r) => r.remove());
}
