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

function getValueText(row) {
  if (!row) return '';
  const c2 = row.children?.[1];
  const preferred = c2 || row.children?.[0] || row;
  const directText = (c2?.textContent || '').trim();
  if (directText) return directText;

  const attrSources = [
    preferred,
    preferred?.querySelector?.('[data-richtext-value], [data-aue-value], [value]') || null,
    row.querySelector?.('[data-richtext-value], [data-aue-value], [value]') || null,
  ].filter(Boolean);

  for (let i = 0; i < attrSources.length; i += 1) {
    const el = attrSources[i];
    const val = (
      el.getAttribute?.('data-richtext-value')
      || el.getAttribute?.('data-aue-value')
      || el.getAttribute?.('value')
      || ''
    ).trim();
    if (val) return val;
  }
  return '';
}

function getRowLabel(row) {
  if (!row) return '';
  const c1 = row.children?.[0];
  return (c1?.textContent || '')
    .trim()
    .toLowerCase()
    .replace(/\*+$/g, '')
    .replace(/:+$/g, '')
    .trim();
}

function getRowPropName(row) {
  if (!row) return '';
  const propNode = row.querySelector('[data-aue-prop], [data-richtext-prop]');
  if (!propNode) return '';
  const prop = (
    propNode.getAttribute('data-aue-prop')
    || propNode.getAttribute('data-richtext-prop')
    || ''
  ).trim().toLowerCase();
  return prop;
}

function getPropNodeValue(node) {
  if (!node) return '';
  const text = (node.textContent || '').trim();
  if (text) return text;
  return (
    node.getAttribute?.('data-richtext-value')
    || node.getAttribute?.('data-aue-value')
    || node.getAttribute?.('value')
    || ''
  ).trim();
}

function findValueByProps(rows, propNames) {
  const wanted = (propNames || []).map((p) => (p || '').trim().toLowerCase()).filter(Boolean);
  if (!wanted.length) return '';
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const propNodes = row.querySelectorAll('[data-aue-prop], [data-richtext-prop]');
    for (let j = 0; j < propNodes.length; j += 1) {
      const node = propNodes[j];
      const prop = (
        node.getAttribute('data-aue-prop')
        || node.getAttribute('data-richtext-prop')
        || ''
      ).trim().toLowerCase();
      if (prop) {
        const isMatch = wanted.some((name) => prop === name || prop.endsWith(`.${name}`));
        if (isMatch) {
          const value = getPropNodeValue(node);
          if (value) return value;
        }
      }
    }
  }
  return '';
}

function findRowByProps(rows, propNames) {
  const wanted = new Set((propNames || []).map((p) => (p || '').trim().toLowerCase()));
  if (!wanted.size) return null;
  return rows.find((row) => {
    const prop = getRowPropName(row);
    if (!prop) return false;
    if (wanted.has(prop)) return true;
    return [...wanted].some((name) => prop.endsWith(`.${name}`));
  }) || null;
}

function findRowByPropsWithValue(rows, propNames, valueGetter = getValueText) {
  const wanted = new Set((propNames || []).map((p) => (p || '').trim().toLowerCase()));
  if (!wanted.size) return null;
  const matches = rows.filter((row) => {
    const prop = getRowPropName(row);
    if (!prop) return false;
    if (wanted.has(prop)) return true;
    return [...wanted].some((name) => prop.endsWith(`.${name}`));
  });
  if (!matches.length) return null;
  return matches.find((row) => (valueGetter(row) || '').trim()) || null;
}

function getEyebrowValue(row) {
  if (!row) return '';
  const valueText = getValueText(row);
  if (valueText) return valueText;
  const hasSeparateLabelAndValue = row.children && row.children.length > 1;
  // For standard labeled rows, never use label text as value.
  if (hasSeparateLabelAndValue) return '';
  const fullText = (row.textContent || '').trim();
  if (!fullText) return '';
  // Handles flattened single-cell authoring text like:
  // "Eyebrow Text * fjsdakf" or "Eyebrow: fjsdakf".
  const labelPatterns = [
    /^eyebrow(?:\s+text)?\s*\*?\s*:\s*/i, // "Eyebrow: value", "Eyebrow Text *: value"
    /^eyebrow\s+text\s*\*?\s+/i, // "Eyebrow Text * value"
    /^eyebrow\s+\*?\s+/i, // "Eyebrow * value"
  ];
  for (let i = 0; i < labelPatterns.length; i += 1) {
    const pattern = labelPatterns[i];
    if (pattern.test(fullText)) {
      const stripped = fullText.replace(pattern, '').trim();
      return stripped;
    }
  }
  // Some author DOM states keep value in attributes on inline-edit wrappers.
  const attrNode = row.querySelector?.('[data-richtext-value], [data-aue-value], [value]');
  if (attrNode) {
    const attrValue = (
      attrNode.getAttribute('data-richtext-value')
      || attrNode.getAttribute('data-aue-value')
      || attrNode.getAttribute('value')
      || ''
    ).trim();
    if (attrValue) return attrValue;
  }
  return fullText;
}

function isNonEyebrowToken(text) {
  const lower = (text || '').trim().toLowerCase();
  return (
    !lower
    || lower === 'video'
    || lower === 'image'
    || lower === 'gif'
    || lower === 'outline'
    || lower === 'fill'
    || lower === 'glass'
    || lower === 'dark'
  );
}

function getRichBlockCount(row) {
  if (!row) return 0;
  const scope = getValueCell(row) || row;
  return scope.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol').length;
}

function isLikelyRichBodyRow(row) {
  if (!row) return false;
  const richBlockCount = getRichBlockCount(row);
  if (richBlockCount >= 2) return true;
  const text = (getText(row) || '').trim();
  if (richBlockCount >= 1 && text.length > 120) return true;
  return false;
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

    const isEyebrowLabel = (label) => label.includes('eyebrow');
    const isIgnoredExpertLabel = (label) => (
      label === 'classes'
      || label.includes('tag variation')
      || label === 'tag'
      || label.includes('tag title')
      || label.includes('section title')
      || label.startsWith('cta')
      || label === 'media asset'
      || label === 'profile image'
      || label === 'image alt text'
      || label === 'profile image alt text'
    );

    // Restrict body selection to expert RTE field only. This prevents default-variation
    // body content from leaking when switching to expert without authoring expert RTE.
    const isExpertRteLabel = (label) => (
      label === 'rte'
      || label === 'body (rte)'
      || label === 'body rte'
      || label === 'body'
    );
    const explicitRteRowByProp = findRowByProps(rows, ['rte']);
    const explicitRteRowByLabel = rows.find((r) => {
      if (r.querySelector('picture, img')) return false;
      const label = getRowLabel(r);
      if (!isExpertRteLabel(label)) return false;
      if (isIgnoredExpertLabel(label)) return false;
      const valueText = getValueText(r);
      const hasRichNodes = r.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, li').length >= 1;
      return !!valueText || hasRichNodes;
    }) || null;
    const explicitRteStructuralRow = [...rows]
      .reverse()
      .find((r) => isLikelyRichBodyRow(r)) || null;
    const explicitRteRow = explicitRteRowByProp
      || explicitRteRowByLabel
      || explicitRteStructuralRow;

    // Primary source: read explicit expert eyebrow field value from prop nodes.
    const explicitExpertEyebrowValue = findValueByProps(rows, ['expertEyebrow']);

    // Secondary source: explicit expert eyebrow row by prop/label.
    const expertEyebrowPropRow = findRowByPropsWithValue(rows, ['expertEyebrow'], getEyebrowValue)
      || findRowByPropsWithValue(rows, ['eyebrow'], getEyebrowValue)
      || null;
    let eyebrowRow = expertEyebrowPropRow
      || rows.find((r) => {
        if (!isEyebrowLabel(getRowLabel(r))) return false;
        return !!getEyebrowValue(r);
      })
      || null;
    // Fallback 1: in flattened markup, expert eyebrow is usually right before expert RTE.
    if (!eyebrowRow && explicitRteRow) {
      const rteIndex = rows.indexOf(explicitRteRow);
      for (let i = rteIndex - 1; i >= 0; i -= 1) {
        const row = rows[i];
        if (row && !row.querySelector('picture, img')) {
          const text = (getEyebrowValue(row) || '').trim();
          if (text && !isNonEyebrowToken(text)) {
            eyebrowRow = row;
            break;
          }
        }
      }
    }

    // Fallback 2: in flattened/label-less markup, use the last authored textual row
    // (any length), excluding media/config rows and the explicit expert RTE row.
    // In UE flattened DOM, expert eyebrow often appears near the end of authored rows.
    if (!eyebrowRow) {
      const eyebrowCandidates = rows.filter((r) => {
        if (r === explicitRteRow) return false;
        if (r.querySelector('picture, img')) return false;
        if (isLikelyRichBodyRow(r)) return false;
        const label = getRowLabel(r);
        if (isIgnoredExpertLabel(label) || isExpertRteLabel(label) || label.includes('tag')) return false;
        const text = (getEyebrowValue(r) || '').trim();
        if (!text || isNonEyebrowToken(text)) return false;
        return true;
      });
      eyebrowRow = eyebrowCandidates.length
        ? eyebrowCandidates[eyebrowCandidates.length - 1]
        : null;
    }

    const eyebrowWrap = document.createElement('div');
    eyebrowWrap.className = 'media-module-eyebrow';
    // Never use label text as eyebrow content when the row is labeled.
    const eyebrowText = explicitExpertEyebrowValue || (eyebrowRow ? getEyebrowValue(eyebrowRow) : '');
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
      h4.textContent = metaTitle.replace(/\s*\|\s*mobility global\s*$/i, '').trim();
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

    let rteRow = explicitRteRow || rows.find((r) => {
      if (r === eyebrowRow) return false;
      if (r.querySelector('picture, img')) return false;
      const label = getRowLabel(r);
      if (!isExpertRteLabel(label)) return false;
      if (isIgnoredExpertLabel(label)) return false;
      const valueText = getValueText(r);
      const hasRichNodes = r.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, li').length >= 1;
      return !!valueText || hasRichNodes;
    }) || null;

    // Fallback for flattened authoring where label/value cells are not preserved.
    // Keep it safe: only accept unlabeled single-cell richtext rows.
    if (!rteRow) {
      rteRow = rows.find((r) => {
        if (r === eyebrowRow) return false;
        if (r.querySelector('picture, img')) return false;
        const label = getRowLabel(r);
        const isSingleCell = (r.children?.length || 0) <= 1;
        if (!isSingleCell || label) return false;
        const hasRichNodes = r.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, li').length >= 1;
        return hasRichNodes;
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

  // Default variation: ignore expert-only authored fields so row mapping stays scoped
  // to default variation content.
  const isExpertOnlyLabel = (label) => (
    label === 'rte'
    || label === 'body (rte)'
    || label === 'body rte'
    || label === 'profile image'
    || label === 'image'
    || label === 'image alt text'
    || label === 'profile image alt text'
  );
  const defaultRows = rows.filter((r) => {
    const label = getRowLabel(r);
    if (!label) return true;
    return !isExpertOnlyLabel(label);
  });

  const tenRow = isTenRowLayout(defaultRows);
  const idx = tenRow
    ? {
      eyebrow: 4, title: 5, body: 6, btn1: 7, btn2: 8, video: 9,
    }
    : {
      eyebrow: 2, title: 3, body: 4, btn1: 5, btn2: 6, video: 7,
    };

  /* Video row: find from end so 8/9/10-row layouts work. */
  const firstPossibleButton = Math.min(idx.btn1, 5);
  const mediaRowIndex = getMediaRowIndex(defaultRows, firstPossibleButton);
  let actualVideoRow;
  if (mediaRowIndex >= 0) actualVideoRow = mediaRowIndex;
  else if (defaultRows[idx.video]) actualVideoRow = idx.video;
  else actualVideoRow = defaultRows.length - 1;
  const buttonSearchEnd = actualVideoRow >= 0 ? actualVideoRow : defaultRows.length;

  const content = document.createElement('div');
  content.className = 'media-module-content';

  const firstButtonRow = idx.btn1;
  const defaultEyebrowRow = findRowByPropsWithValue(defaultRows, ['defaultEyebrow'], getEyebrowValue)
    || findRowByPropsWithValue(defaultRows, ['eyebrow'], getEyebrowValue)
    || defaultRows.find((r) => getRowLabel(r).includes('eyebrow') && !!getEyebrowValue(r))
    || null;

  const tagVariation = (getText(defaultRows[0]) || '').trim();
  let tagTitle = getText(defaultRows[1]);
  if (!tagTitle && defaultRows[0] && !tagVariation) tagTitle = getText(defaultRows[0]);
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
  let authoredDefaultEyebrowRow = defaultEyebrowRow || defaultRows[idx.eyebrow] || null;
  if (!authoredDefaultEyebrowRow || !getEyebrowValue(authoredDefaultEyebrowRow)) {
    const reserved = new Set([idx.title, idx.body]);
    for (let i = 2; i < firstButtonRow; i += 1) {
      const row = defaultRows[i];
      if (!reserved.has(i) && row && !row.querySelector('picture, img')) {
        const text = (getEyebrowValue(row) || '').trim();
        if (text && !isNonEyebrowToken(text)) {
          authoredDefaultEyebrowRow = row;
          break;
        }
      }
    }
  }
  if (authoredDefaultEyebrowRow) {
    const eyebrowText = getEyebrowValue(authoredDefaultEyebrowRow);
    if (eyebrowText) {
      const span = eyebrowDecorator(eyebrowText, 'accent-color');
      if (span) eyebrowWrap.appendChild(span);
    }
  }
  copyWrap.appendChild(eyebrowWrap);

  const titleWrap = document.createElement('div');
  titleWrap.className = 'media-module-title';
  if (defaultRows[idx.title]) appendContent(defaultRows[idx.title], titleWrap, true);
  copyWrap.appendChild(titleWrap);

  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'media-module-body';
  if (defaultRows[idx.body]) appendContent(defaultRows[idx.body], bodyWrap, false);
  copyWrap.appendChild(bodyWrap);

  content.appendChild(copyWrap);

  const buttonsWrap = document.createElement('div');
  buttonsWrap.className = 'media-module-buttons';
  for (let r = firstButtonRow; r < buttonSearchEnd; r += 1) {
    const row = defaultRows[r];
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

  const mediaRow = defaultRows[actualVideoRow];
  let mediaUrl = getMediaUrlFromRow(mediaRow);

  /* Image/GIF: media row may be empty; scan all rows and block for any media. */
  if (!mediaUrl) {
    for (let i = firstPossibleButton; i < defaultRows.length; i += 1) {
      mediaUrl = getMediaUrlFromRow(defaultRows[i]);
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
