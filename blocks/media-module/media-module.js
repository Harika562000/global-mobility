/**
 * Media Module — S&P Mobility UI Library (Figma node-id=24191-12117)
 *
 * Row order (8/9/10 rows; video row found from end):
 *   0=tag var, 1=tag, 2=eyebrow, 3=title, 4=body, 5=btn1, 6=btn2, [opt], N=video
 * Section background: use section metadata or template.
 * Video row: scan from last row backward for media link.
 */

import { eyebrowDecorator, decorateTags } from '../../scripts/scripts.js';
import { getMetadata } from '../../scripts/aem.js';

function getValueCell(row) {
  if (!row) return null;
  return row.children.length > 1 ? row.children[1] : row.children[0] || row;
}

function decodeHtmlEntities(input) {
  if (input == null) return '';
  const str = input.toString();
  // Common cases we’ve seen in meta values.
  const quick = str.replace(/&#x26;|&amp;/g, '&');
  const textarea = document.createElement('textarea');
  textarea.innerHTML = quick;
  return textarea.value;
}

function normalizeMetaText(input) {
  return decodeHtmlEntities(input).trim();
}

function normalizeMetaUrl(input) {
  const decoded = normalizeMetaText(input);
  if (!decoded) return '';
  try {
    return new URL(decoded, window.location.href).toString();
  } catch {
    return decoded;
  }
}

function normalizeProfileImageSrc(input) {
  const absolute = normalizeMetaUrl(input);
  if (!absolute) return '';
  try {
    const u = new URL(absolute, window.location.href);

    // Preserve width if present, otherwise default to 1200 for profile image.
    const width = u.searchParams.get('width') || '1200';
    u.searchParams.set('width', width);
    // Preserve explicit format if provided; otherwise infer from extension.
    const pathname = u.pathname || '';
    const ext = (pathname.split('.').pop() || '').toLowerCase();
    const inferred = ext === 'jpeg' ? 'jpg' : ext;
    if (!u.searchParams.get('format') && inferred) {
      u.searchParams.set('format', inferred);
    }
    // Drop any "optimize" type params that sometimes appear in metadata.
    u.searchParams.delete('optimize');

    // Requirement: metadata-driven images should not include protocol/host.
    // Return pathname + query (+hash if present).
    const qs = u.searchParams.toString();
    const out = `${u.pathname}${qs ? `?${qs}` : ''}${u.hash || ''}`;
    // Franklin-authored assets commonly use a relative `./...` src.
    if (out.startsWith('./') || out.startsWith('../')) return out;
    if (out.startsWith('/')) return `.${out}`; // "/x" -> "./x"
    return `./${out}`;
  } catch {
    // Best effort: drop origin; don't force a specific format.
    const text = normalizeMetaText(input);
    const out = text
      .replace(/^https?:\/\/[^/]+/i, '')
      .replace(/(&|\\?)optimize=[^&]+/i, '');
    if (out.startsWith('./') || out.startsWith('../')) return out;
    if (out.startsWith('/')) return `.${out}`;
    return out ? `./${out}` : '';
  }
}

function getText(row) {
  if (!row) return '';
  const c1 = row.children?.[0];
  const c2 = row.children?.[1];
  let text = (c2?.textContent
    || '').trim();
  if (!text && c1) text = (c1.textContent || '').trim();
  if (!text) {
    text = (row.textContent
      || '').trim();
  }
  return text;
}

function isMediaLink(anchor) {
  const href = (anchor.getAttribute('href')
    || '').trim();
  const text = (anchor.textContent
    || '').trim();
  return (
    /\/content\/dam\//i.test(href)
    || /\.(mp4|webm|gif|webp)(\?|$)/i.test(href)
    || /\/content\/dam\//i.test(text)
    || /\.(mp4|webm|gif|webp)(\?|$)/i.test(text)
  );
}

function isMediaUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  if (!u || u === '#' || u === '/') return false;
  if (typeof window !== 'undefined' && window.location?.href && u === window.location.href) return false;
  if (/^\/content\/dam\/?$/i.test(u)) return false;
  return (
    /\/content\/dam\//i.test(u)
    || /\.(mp4|webm|gif|webp|png|jpg|jpeg)(\?|$)/i.test(u)
  );
}

/** Find row index with media (link, img, or source), from last row down. */
function getMediaRowIndex(rows, start) {
  for (let i = rows.length - 1; i >= start; i -= 1) {
    const row = rows[i];
    const cell = getValueCell(row) || row;
    let anchor = cell.querySelector('a');
    if (!anchor) anchor = row.querySelector('a');
    if (anchor && isMediaLink(anchor)) return i;
    const img = cell.querySelector('img')
      || row.querySelector('img');
    if (img?.src && isMediaUrl(img.src)) return i;
    const source = cell.querySelector('source')
      || row.querySelector('source');
    if (source?.src && isMediaUrl(source.src)) return i;
  }
  return -1;
}

/** Detect 10-row layout: rows 2 and 3 empty, row 4 has text (not a link). */
function isTenRowLayout(rows) {
  if (rows.length < 10) return false;
  const r2 = getText(rows[2]);
  const r3 = getText(rows[3]);
  const r4 = getText(rows[4]);
  const r4HasLink = (getValueCell(rows[4])
    || rows[4])?.querySelector('a');
  return !r2 && !r3 && r4 && !r4HasLink;
}

/** Block-level tags copied into expert RTE (exclude `li` — nested under ul/ol). */
const RTE_BLOCK_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, ul, ol';

/**
 * True if `el` is not nested inside another RTE block under `scope` (avoids duplicating
 * nested lists when we clone siblings).
 */
function isTopLevelRichBlock(el, scope) {
  let p = el.parentElement;
  while (p && p !== scope) {
    if (p.matches(RTE_BLOCK_SELECTOR)) return false;
    p = p.parentElement;
  }
  return true;
}

function appendContent(row, target, asHeading = false) {
  if (!row) return;
  const nodes = row.querySelectorAll('h1, h2, h3, h4, h5, h6, p');
  if (nodes.length) {
    nodes.forEach((el) => target.appendChild(el));
    return;
  }
  const text = getText(row);
  if (text) {
    const el = asHeading ? document.createElement('h2') : document.createElement('p');
    el.textContent = text;
    target.appendChild(el);
  }
}

function setupVideoAutoplayOnce(videoEl) {
  if (!videoEl || videoEl.dataset.mediaModulePlayed === 'true') return;
  const wrapper = videoEl.closest('.media-module-video');
  if (!wrapper) return;
  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;
      if (videoEl.dataset.mediaModulePlayed === 'true') return;
      videoEl.dataset.mediaModulePlayed = 'true';
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.play().catch(() => {});
      observer.disconnect();
    },
    { rootMargin: '0px', threshold: 0.25 },
  );
  observer.observe(wrapper);
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  // Variation handling (same pattern as hero): class drives a dedicated layout.
  const isExpert = block.classList.contains('expert');
  if (isExpert) {
    const isNoAsset = block.classList.contains('expert-no-asset')
      || block.classList.contains('no-asset');
    // If the block re-decorates (UE patches), ensure we don't keep stale rendered DOM.
    block.querySelectorAll(':scope > .media-module-content, :scope > .media-module-video')
      .forEach((el) => el.remove());

    const metaTitle = normalizeMetaText(
      getMetadata('og:title') || getMetadata('twitter:title'),
    );
    const metaDescription = normalizeMetaText(
      getMetadata('titleposition'),
    );
    // Prefer the page-authored field (`ogImage`) but allow fallback to OG/Twitter tags
    // when no block image is authored.
    const ogImage = normalizeMetaUrl(getMetadata('og:image') || getMetadata('twitter:image'));
    const metaImage = normalizeProfileImageSrc(ogImage);

    const content = document.createElement('div');
    content.className = 'media-module-content';

    const copyWrap = document.createElement('div');
    copyWrap.className = 'media-module-copy';

    // Eyebrow: pick the first short non-empty text row (excluding media type words).
    const eyebrowRow = rows.find((r) => {
      const text = getText(r);
      if (!text) return false;
      const t = text.toLowerCase();
      if (t === 'video' || t === 'image' || t === 'gif') return false;
      return text.length <= 200 && !r.querySelector('picture, img');
    }) || null;

    const eyebrowWrap = document.createElement('div');
    eyebrowWrap.className = 'media-module-eyebrow';
    const eyebrowText = getText(eyebrowRow);
    if (eyebrowText) {
      const span = eyebrowDecorator(eyebrowText, 'accent-color');
      if (span) eyebrowWrap.appendChild(span);
    }
    copyWrap.appendChild(eyebrowWrap);

    // Title + description come from page metadata for profile variation.
    if (metaTitle) {
      const titleWrap = document.createElement('div');
      titleWrap.className = 'media-module-title';
      const h4 = document.createElement('h4');
      h4.textContent = metaTitle;
      titleWrap.appendChild(h4);
      copyWrap.appendChild(titleWrap);
    }

    if (metaDescription) {
      const descWrap = document.createElement('div');
      descWrap.className = 'media-module-description';
      const p = document.createElement('p');
      p.textContent = metaDescription;
      descWrap.appendChild(p);
      copyWrap.appendChild(descWrap);
    }

    // RTE: pick the row that has rich content.
    // UE/editor variants sometimes store richtext as headings/lists (not just <p>),
    // so we detect any meaningful rich nodes + non-trivial text.
    let rteRow = rows.find((r) => {
      if (r === eyebrowRow) return false;
      if (r.querySelector('picture, img')) return false;

      const t = (getText(r) || '').trim();
      if (!t) return false;
      const lower = t.toLowerCase();
      if (lower === 'video' || lower === 'image' || lower === 'gif') return false;

      const richNodes = r.querySelectorAll(
        'h1, h2, h3, h4, h5, h6, p, ul, ol, li',
      );

      // Prefer a "real" RTE chunk (longer text) but still allow lists/headings-only.
      return richNodes.length >= 1 && (t.length >= 40 || richNodes.length >= 3);
    }) || null;

    // Fallback: if strict matching fails, take the first row that actually contains rich nodes.
    if (!rteRow) {
      rteRow = rows.find((r) => {
        if (r === eyebrowRow) return false;
        if (r.querySelector('picture, img')) return false;
        return r.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, li').length >= 1;
      }) || null;
    }

    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'media-module-body';
    const rteWrap = document.createElement('div');
    rteWrap.className = 'media-module-rte';
    if (rteRow) {
      const scope = getValueCell(rteRow) || rteRow;
      const candidates = scope.querySelectorAll(RTE_BLOCK_SELECTOR);
      const nodes = [...candidates].filter((el) => isTopLevelRichBlock(el, scope));
      if (nodes.length) {
        // Clone nodes to avoid iterator/move-order issues before we remove the original rows.
        const fragment = document.createDocumentFragment();
        nodes.forEach((el) => fragment.appendChild(el.cloneNode(true)));
        rteWrap.appendChild(fragment);
      } else {
        const text = getText(rteRow);
        if (text) {
          const p = document.createElement('p');
          p.textContent = text;
          rteWrap.appendChild(p);
        }
      }
    }
    bodyWrap.appendChild(rteWrap);
    copyWrap.appendChild(bodyWrap);

    content.appendChild(copyWrap);
    block.appendChild(content);

    if (!isNoAsset) {
      // Image: pick the first row containing a picture/img and reuse its best src.
      // For expert variation we also allow a page-level OG/Twitter image fallback.
      const imageRow = rows.find((r) => r.querySelector('picture, img')) || null;
      const imgFromRow = imageRow?.querySelector('img');
      const authoredSrcRaw = (imgFromRow?.getAttribute('src') || imgFromRow?.src || '').trim();
      // Some authoring environments inject placeholder/empty images. Only accept real media URLs.
      const authoredSrc = (authoredSrcRaw && isMediaUrl(authoredSrcRaw)) ? authoredSrcRaw : '';
      const imgSrc = authoredSrc || metaImage || '';
      if (imgSrc) {
        const mediaWrap = document.createElement('div');
        mediaWrap.className = 'media-module-video';
        const imgEl = document.createElement('img');
        imgEl.src = imgSrc;
        imgEl.loading = 'lazy';
        // Alt field often comes through as empty row; keep empty if not present.
        imgEl.alt = '';
        mediaWrap.appendChild(imgEl);
        block.appendChild(mediaWrap);
      } else {
        // Ensure stale media isn't left behind when both authored + metadata image are cleared.
        block.querySelectorAll(':scope > .media-module-video').forEach((el) => el.remove());
      }
    }

    // Remove all original rows (prevents empty placeholder divs remaining).
    rows.forEach((r) => r.remove());
    return;
  }

  const tenRow = isTenRowLayout(rows);
  const idx = tenRow
    ? {
      eyebrow: 4, title: 5, body: 6, btn1: 7, btn2: 8, video: 9,
    }
    : {
      eyebrow: 2, title: 3, body: 4, btn1: 5, btn2: 6, video: 7,
    };

  /* Video row: find from end so 8/9/10-row layouts work. */
  const firstPossibleButton = Math.min(idx.btn1, 5);
  const mediaRowIndex = getMediaRowIndex(rows, firstPossibleButton);
  let actualVideoRow;
  if (mediaRowIndex >= 0) actualVideoRow = mediaRowIndex;
  else if (rows[idx.video]) actualVideoRow = idx.video;
  else actualVideoRow = rows.length - 1;
  const buttonSearchEnd = actualVideoRow >= 0 ? actualVideoRow : rows.length;

  const content = document.createElement('div');
  content.className = 'media-module-content';

  const firstButtonRow = idx.btn1;

  const tagVariation = (getText(rows[0]) || '').trim();
  let tagTitle = getText(rows[1]);
  if (!tagTitle && rows[0] && !tagVariation) tagTitle = getText(rows[0]);
  const tagWrap = document.createElement('div');
  tagWrap.className = 'media-module-tag';
  if (tagTitle) {
    const table = document.createElement('table');
    const tr1 = document.createElement('tr');
    tr1.appendChild(document.createElement('td')).textContent = tagVariation ? `tag (${tagVariation})` : 'tag';
    const tr2 = document.createElement('tr');
    tr2.appendChild(document.createElement('td')).textContent = tagTitle;
    table.append(tr1, tr2);
    tagWrap.appendChild(table);
  }
  content.appendChild(tagWrap);

  const copyWrap = document.createElement('div');
  copyWrap.className = 'media-module-copy';

  const eyebrowWrap = document.createElement('div');
  eyebrowWrap.className = 'media-module-eyebrow';
  if (rows[idx.eyebrow]) {
    const eyebrowText = getText(rows[idx.eyebrow]);
    if (eyebrowText) {
      const span = eyebrowDecorator(eyebrowText, 'accent-color');
      if (span) eyebrowWrap.appendChild(span);
    }
  }
  copyWrap.appendChild(eyebrowWrap);

  const titleWrap = document.createElement('div');
  titleWrap.className = 'media-module-title';
  if (rows[idx.title]) appendContent(rows[idx.title], titleWrap, true);
  copyWrap.appendChild(titleWrap);

  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'media-module-body';
  if (rows[idx.body]) appendContent(rows[idx.body], bodyWrap, false);
  copyWrap.appendChild(bodyWrap);

  content.appendChild(copyWrap);

  const buttonsWrap = document.createElement('div');
  buttonsWrap.className = 'media-module-buttons';
  for (let r = firstButtonRow; r < buttonSearchEnd; r += 1) {
    const row = rows[r];
    if (row) {
      const cell = getValueCell(row) || row;
      const anchors = [...(cell.querySelectorAll('a') || [])].filter((a) => !isMediaLink(a));
      if (anchors.length > 0) {
        const fragment = document.createDocumentFragment();
        cell.childNodes.forEach((node) => fragment.appendChild(node.cloneNode(true)));
        buttonsWrap.appendChild(fragment);
      }
    }
  }
  content.appendChild(buttonsWrap);

  decorateTags(content);
  block.appendChild(content);

  /** Extract media URL from a row (anchor, source, img, or text). Returns '' if none. */
  function getMediaUrlFromRow(row) {
    if (!row) return '';
    const cell = getValueCell(row) || row;
    let anchor = cell.querySelector('a');
    if (!anchor) anchor = row.querySelector('a');
    const hasAbsHref = anchor?.href
      && (anchor.href.startsWith('http') || anchor.href.startsWith('/'));
    if (hasAbsHref) return anchor.href;
    if (anchor?.getAttribute('href')) {
      return (anchor.getAttribute('href')
        || '').trim();
    }
    const source = cell.querySelector('source')
      || row.querySelector('source');
    if (source?.src) return source.src;
    const img = cell.querySelector('img') || row.querySelector('img');
    if (img?.src) return img.src;
    const text = getText(row);
    if (text && isMediaUrl(text)) return text;
    return '';
  }

  const mediaRow = rows[actualVideoRow];
  let mediaUrl = getMediaUrlFromRow(mediaRow);

  /* Image/GIF: media row may be empty; scan all rows and block for any media. */
  if (!mediaUrl) {
    for (let i = firstPossibleButton; i < rows.length; i += 1) {
      mediaUrl = getMediaUrlFromRow(rows[i]);
      if (mediaUrl) break;
    }
  }
  if (!mediaUrl) {
    const anyImg = block.querySelector('img');
    if (anyImg?.src && isMediaUrl(anyImg.src)) {
      mediaUrl = anyImg.src;
    }
    if (!mediaUrl) {
      const anySource = block.querySelector('source');
      if (anySource?.src && isMediaUrl(anySource.src)) mediaUrl = anySource.src;
    }
    if (!mediaUrl) {
      const sel = 'a[href*="/content/dam/"], a[href*=".mp4"], a[href*=".webm"], '
        + 'a[href*=".gif"], a[href*=".webp"], a[href*=".jpg"], a[href*=".jpeg"], a[href*=".png"]';
      const mediaLink = block.querySelector(sel);
      if (mediaLink?.href) mediaUrl = mediaLink.href;
    }
  }

  mediaUrl = (mediaUrl || '').trim();
  if (!mediaUrl || !isMediaUrl(mediaUrl)) mediaUrl = '';

  const isVideo = mediaUrl && /\.(mp4|webm)$/i.test(mediaUrl);

  /* Add media-module-video wrapper when we have media for consistent DOM/CSS. */
  if (mediaUrl) {
    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'media-module-video';
    if (isVideo) {
      const video = document.createElement('video');
      video.setAttribute('autoplay', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      video.setAttribute('preload', 'auto');
      video.setAttribute('aria-label', '');
      video.addEventListener('ended', () => video.pause());
      const source = document.createElement('source');
      source.src = mediaUrl;
      source.type = mediaUrl.toLowerCase().endsWith('.webm')
        ? 'video/webm'
        : 'video/mp4';
      video.appendChild(source);
      mediaWrap.appendChild(video);
      block.appendChild(mediaWrap);
      setupVideoAutoplayOnce(video);
    } else {
      /* Image/GIF or other media — render in wrapper for consistent structure. */
      const imgEl = document.createElement('img');
      imgEl.src = mediaUrl;
      imgEl.alt = '';
      imgEl.loading = 'lazy';
      imgEl.onerror = () => mediaWrap.remove();
      mediaWrap.appendChild(imgEl);
      block.appendChild(mediaWrap);
    }
  }

  rows.forEach((r) => r.remove());
}
