import { eyebrowDecorator, decorateTags } from '../../scripts/scripts.js';

/**
 * Hero block: three variations (UE authoring reference).
 *
 * Variation summary (from UE authoring UI):
 * - Image as background: media (image or video), heading, description.
 * - Two-colored:        media (image or video), heading, description.
 * - Black-colored:      media (image or video), tag, eyebrow, heading, description.
 *
 * Media field accepts:
 *  - An image asset  → rendered as <picture>
 *  - An MP4/WebM URL → rendered as autoplay muted looping <video> (same as video block)
 *  - A YouTube URL   → rendered as autoplay muted iframe embed (same as video block)
 *  - A Vimeo URL     → rendered as autoplay muted iframe embed (same as video block)
 */

// ─── Video embed helpers (mirrors blocks/video/video.js behaviour) ────────────

/**
 * Build a YouTube iframe embed, muted and autoplaying for background use.
 * @param {URL} url
 * @returns {HTMLElement}
 */
function embedYoutube(url) {
  const usp = new URLSearchParams(url.search);
  const suffixParams = {
    autoplay: '1',
    mute: '1',
    controls: '0',
    disablekb: '1',
    loop: '1',
    playsinline: '1',
  };
  const suffix = `&${Object.entries(suffixParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
  let vid = usp.get('v') ? encodeURIComponent(usp.get('v')) : '';
  const embed = url.pathname;
  if (url.origin.includes('youtu.be')) {
    [, vid] = url.pathname.split('/');
  }
  const temp = document.createElement('div');
  temp.innerHTML = `<div class="hero-media-embed">
    <iframe src="https://www.youtube.com${vid ? `/embed/${vid}?rel=0&v=${vid}${suffix}` : embed}"
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope; picture-in-picture"
      allowfullscreen="" scrolling="no" title="Content from Youtube" loading="lazy"></iframe>
  </div>`;
  return temp.children.item(0);
}

/**
 * Build a Vimeo iframe embed, muted and autoplaying for background use.
 * @param {URL} url
 * @returns {HTMLElement}
 */
function embedVimeo(url) {
  const [, video] = url.pathname.split('/');
  const suffixParams = { autoplay: '1', background: '1' };
  const suffix = `?${Object.entries(suffixParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
  const temp = document.createElement('div');
  temp.innerHTML = `<div class="hero-media-embed">
    <iframe src="https://player.vimeo.com/video/${video}${suffix}"
      frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen
      title="Content from Vimeo" loading="lazy"></iframe>
  </div>`;
  return temp.children.item(0);
}

/**
 * Build an autoplay muted looping <video> element for MP4/WebM.
 * @param {string} src
 * @returns {HTMLVideoElement}
 */
function createAutoplayVideo(src) {
  const video = document.createElement('video');
  video.setAttribute('autoplay', '');
  video.setAttribute('muted', '');
  video.setAttribute('loop', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('preload', 'metadata');
  video.removeAttribute('controls');
  video.muted = true;

  const source = document.createElement('source');
  source.setAttribute('src', src);
  source.setAttribute('type', `video/${src.split('.').pop()}`);
  video.appendChild(source);
  return video;
}

/**
 * Detect if a URL string is a video (YouTube, Vimeo, or video file extension).
 * Returns 'youtube' | 'vimeo' | 'file' | null.
 * @param {string} href
 */
function detectMediaType(href) {
  if (!href) return null;
  const lower = href.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('vimeo.com')) return 'vimeo';
  const ext = lower.split('?')[0].split('.').pop();
  if (['mp4', 'webm', 'ogg'].includes(ext)) return 'file';
  return null;
}

// ─── Hero helpers ─────────────────────────────────────────────────────────────

function getValueCell(row) {
  if (!row) return null;
  return row.children.length > 1 ? row.children[1] : row.children[0] || row;
}

function getRowLabel(row) {
  return (row?.children[0]?.textContent || '').trim().toLowerCase();
}

function findRowByLabel(rows, fromIdx, toIdx, labelPart) {
  const lower = (labelPart || '').toLowerCase();
  for (let i = fromIdx; i <= toIdx; i += 1) {
    const label = getRowLabel(rows[i]);
    if (label.includes(lower)) return i;
  }
  return -1;
}

function findRowByLabels(rows, fromIdx, toIdx, labels) {
  return labels.reduce(
    (found, label) => (found >= 0 ? found : findRowByLabel(rows, fromIdx, toIdx, label)),
    -1,
  );
}

/**
 * Build the hero media wrapper div containing either an image (<picture>),
 * a native video element, or an iframe embed — depending on what the author
 * placed in the media row.
 *
 * @param {string} wrapperClass  CSS class(es) for the wrapper div
 * @param {HTMLElement|null} picture  <picture> element from the media row (if any)
 * @param {string|null} videoHref   URL from an <a> in the media row (if any)
 * @returns {HTMLElement|null}
 */
function createHeroMedia(wrapperClass, picture, videoHref) {
  const mediaType = detectMediaType(videoHref);
  const hasVideo = !!mediaType;

  if (!picture && !hasVideo) return null;

  const wrapper = document.createElement('div');
  wrapper.className = wrapperClass;
  if (picture) wrapper.classList.add('has-picture');
  if (hasVideo) wrapper.classList.add('has-video');

  if (picture) wrapper.appendChild(picture);

  if (hasVideo) {
    const url = new URL(videoHref);
    let embed;
    if (mediaType === 'youtube') {
      embed = embedYoutube(url);
    } else if (mediaType === 'vimeo') {
      embed = embedVimeo(url);
    } else {
      embed = createAutoplayVideo(videoHref);
    }
    wrapper.appendChild(embed);
  }

  return wrapper;
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

function decorateEmAccent(block, rows, media, rowIndices) {
  const bgDiv = media || document.createElement('div');
  bgDiv.classList.add('hero-em-accent-background');
  const bgPicture = bgDiv.querySelector('picture');
  if (bgPicture) {
    bgPicture.querySelector('img')?.setAttribute('loading', 'eager');
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

function decorateTwoColoredRight(block, rows, media, rowIndices) {
  const contentDiv = document.createElement('div');
  contentDiv.className = 'hero-two-colored-right-content';

  appendContent(rows[rowIndices.heading], contentDiv, true);
  appendContent(rows[rowIndices.description], contentDiv);

  block.appendChild(contentDiv);
  if (media) {
    media.classList.add('hero-two-colored-right-image');
    block.appendChild(media);
  }
}

function decorateBlackColoredRight(block, rows, media, rowIndices) {
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

  block.appendChild(contentDiv);
  if (media) {
    media.classList.add('hero-black-colored-right-image');
    block.appendChild(media);
  }
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
  const hasVariationRow = !rows[0]?.querySelector('picture, video, a');
  const contentStart = hasVariationRow ? 1 : 0;

  // ── Locate the single "media" row (replaces separate image + video rows) ──
  const mediaRowIndex = isBlackColoredRight
    ? 0
    : findRowByLabels(rows, contentStart, lastDataRow, ['media', 'image', 'video']);

  const altRowIndex = isBlackColoredRight
    ? 0
    : findRowByLabels(rows, contentStart, lastDataRow, ['media alt', 'image alt', 'alt']);

  // Extract picture (for image assets) and/or a href (for video URLs)
  const mediaRow = mediaRowIndex >= 0 ? rows[mediaRowIndex] : null;
  const picture = mediaRow?.querySelector('picture') || null;
  const mediaLink = mediaRow?.querySelector('a');
  const videoHref = mediaLink ? mediaLink.href : null;

  // Apply alt text to the image if present
  if (isBlackColoredRight) {
    if (picture && mediaRow) {
      const altCell = getValueCell(mediaRow);
      const alt = altCell?.textContent?.trim();
      if (alt) {
        const img = picture.querySelector('img');
        if (img) img.setAttribute('alt', alt);
      }
    }
  } else {
    const altText = altRowIndex >= 0 ? getValueCell(rows[altRowIndex])?.textContent?.trim() : '';
    if (picture && altText) {
      const img = picture.querySelector('img');
      if (img) img.setAttribute('alt', altText);
    }
  }

  const headingIdx = isBlackColoredRight
    ? 2
    : findRowByLabel(rows, contentStart, lastDataRow, 'heading');
  const descriptionIdx = isBlackColoredRight
    ? 3
    : findRowByLabels(
      rows,
      contentStart,
      lastDataRow,
      ['description', 'sub-heading', 'sub heading'],
    );
  const eyebrowIdx = isBlackColoredRight ? 1 : -1;
  const firstButtonRow = isBlackColoredRight
    ? 4
    : Math.max(
      contentStart,
      headingIdx,
      descriptionIdx,
      altRowIndex,
      mediaRowIndex,
    ) + 1;

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
      eyebrow: eyebrowIdx,
      heading: headingIdx,
      description: descriptionIdx,
      tagVariation: tagVariationIdx,
      tag: tagTitleIdx >= 0 ? tagTitleIdx : lastDataRow,
      firstButtonRow,
    }
    : {
      eyebrow: -1,
      heading: headingIdx,
      description: descriptionIdx,
      tagVariation: -1,
      tag: lastDataRow,
      firstButtonRow,
    };

  // Build the unified media element (image, MP4, YouTube or Vimeo)
  const media = createHeroMedia('hero-media', picture, videoHref);

  if (isBlackColoredRight) {
    decorateBlackColoredRight(block, rows, media, rowIndices);
  } else if (isTwoColoredRight) {
    decorateTwoColoredRight(block, rows, media, rowIndices);
  } else {
    decorateEmAccent(block, rows, media, rowIndices);
  }

  rows.forEach((r) => r.remove());
}
