import { TABLET_BP } from './constants.js';

/**
 * Subscribe to a media query: call callback(matches) once with the current state
 * and again whenever the query match state changes (e.g. on resize).
 *
 * @param {string} mediaQuery  CSS media query string (e.g. '(max-width: 719.98px)')
 * @param {(matches: boolean) => void} callback  Called with true when query
 *   matches, false otherwise
 */
export function onBreakpointChange(mediaQuery, callback) {
  const mq = window.matchMedia(mediaQuery);
  callback(mq.matches);
  const handleChange = (e) => callback(e.matches);
  if (mq.addEventListener) mq.addEventListener('change', handleChange);
  else mq.addListener(handleChange);
}

/**
 * Subscribe to the mobile/tablet breakpoint (TABLET_BP). Callback receives true when
 * viewport is mobile or tablet (up to 1024px), false when desktop. Useful for layouts
 * that differ by breakpoint.
 *
 * @param {(isMobile: boolean) => void} callback  Called with true on mobile/tablet,
 *   false on desktop
 */
export function onMobileBreakpointChange(callback) {
  onBreakpointChange(TABLET_BP, callback);
}

/* ========================================================================
   Page Content Fetcher & Metadata Utilities
   ======================================================================== */

/**
 * Fetch page content from the defined content source (DA → .plain.html).
 * The content source is configured in fstab.yaml; at runtime every AEM EDS page
 * is available as `<pathname>.plain.html`.
 *
 * @param {string} path  Absolute pathname (e.g. '/fragments/customer-stories/acme')
 * @returns {Promise<{ok: boolean, doc: Document|null, error: string|null}>}
 */
export async function fetchPageContent(path) {
  if (!path || typeof path !== 'string') {
    return { ok: false, doc: null, error: 'Invalid path: a non-empty string is required.' };
  }

  const url = `${path.replace(/\/$/, '')}`;

  try {
    const resp = await fetch(url);

    if (!resp.ok) {
      return {
        ok: false,
        doc: null,
        error: `Fetch failed for "${url}" (HTTP ${resp.status}).`,
      };
    }

    const html = await resp.text();
    if (!html.trim()) {
      return { ok: false, doc: null, error: `Empty response from "${url}".` };
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    return { ok: true, doc, error: null };
  } catch (err) {
    return {
      ok: false,
      doc: null,
      error: `Network error fetching "${url}": ${err.message}`,
    };
  }
}

/**
 * Identify and parse block data from a fetched page document.
 * Scans every section for block wrappers and returns a structured array of
 * blocks, each with its name, variant classes, and row data — ready for
 * consumption by dynamic blocks.
 *
 * @param {Document} doc  A Document returned by fetchPageContent
 * @returns {Array<{name:string, variants:string[], rows:Array<string[]>}>}
 */
export function parseBlockData(doc) {
  if (!doc || !doc.body) return [];

  const blocks = [];
  doc.body.querySelectorAll(':scope > div').forEach((section) => {
    section.querySelectorAll(':scope > div').forEach((wrapper) => {
      /* Each block wrapper typically has classes like "product-cards-wrapper" */
      const blockEl = wrapper.firstElementChild;
      if (!blockEl) return;

      const classes = [...blockEl.classList];
      const name = classes[0] || 'unknown';
      const variants = classes.slice(1);

      /* Extract rows → cells as plain text */
      const rows = [...blockEl.children].map(
        (row) => [...row.children].map((cell) => cell.innerHTML.trim()),
      );

      blocks.push({ name, variants, rows });
    });
  });

  return blocks;
}

/**
 * Extract page metadata from a fetched page document.
 * Reads `<meta>` tags from `<head>` (standard AEM EDS metadata)
 * and also extracts any Metadata / Section Metadata block tables found
 * in the document body.
 *
 * @param {Document} doc  A Document returned by fetchPageContent
 * @returns {{ head: Record<string, string>, sections: Array<Record<string, string>> }}
 */
export function extractPageMetadata(doc) {
  const head = {};
  const sections = [];

  if (!doc) return { head, sections };

  /* ---- Head <meta> tags ---- */
  if (doc.head) {
    doc.head.querySelectorAll('meta[name], meta[property]').forEach((meta) => {
      const key = meta.getAttribute('name') || meta.getAttribute('property');
      if (key) head[key] = meta.content || '';
    });
  }

  /* ---- Body: Section Metadata tables ---- */
  if (doc.body) {
    doc.body.querySelectorAll(':scope > div').forEach((section) => {
      const sectionMeta = {};
      section.querySelectorAll(':scope > div').forEach((wrapper) => {
        const blockEl = wrapper.firstElementChild;
        if (!blockEl) return;
        const blockName = blockEl.classList[0] || '';
        if (blockName !== 'section-metadata' && blockName !== 'metadata') return;

        [...blockEl.children].forEach((row) => {
          const cells = [...row.children];
          if (cells.length >= 2) {
            const key = cells[0].textContent.trim().toLowerCase();
            const value = cells[1].innerHTML.trim();
            if (key) sectionMeta[key] = value;
          }
        });
      });

      if (Object.keys(sectionMeta).length) sections.push(sectionMeta);
    });
  }

  return { head, sections };
}

/* ========================================================================
   Tag list polishing (AEM cq:tags / search `q`)
   ======================================================================== */

/**
 * @param {string} [raw]
 * @returns {string[]}
 */
export function normalizeTaxonomyFieldList(raw) {
  return String(raw || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Comma-separated AEM tag ids → last path segment each, comma-separated (e.g. Lucidworks `q`).
 * @param {string} [raw]
 * @returns {string}
 */
export function cleanAemTagListForSearchQuery(raw) {
  return normalizeTaxonomyFieldList(raw)
    .map((segment) => {
      const i = segment.lastIndexOf('/');
      return (i >= 0 ? segment.slice(i + 1) : segment).trim();
    })
    .filter(Boolean)
    .join(',');
}

/**
 * Display polish: strip trailing " page" from template/type labels (case-insensitive).
 * @param {string} [value]
 * @returns {string}
 */
export function stripTrailingPageFromTagLabel(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  return s.replace(/\s+page$/i, '').trim();
}

/* ========================================================================
   Path / manual page URL slots (block config keys)
   ======================================================================== */

const DEFAULT_MANUAL_PAGE_URL_SLOTS = [1, 2, 3, 4, 5, 6];
const DEFAULT_NESTED_PAGE_URL_PREFIXES = ['manualpageconfiguration_', 'manualpageselection_'];

/**
 * Same-origin pathname for EDS `.plain.html` fetch, or '' if external or file URL.
 * @param {URL} url
 * @param {string} [origin=window.location.origin]
 * @returns {string}
 */
export function toInternalContentPath(url, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  if (!url || url.origin !== origin) return '';
  const pathname = url.pathname || '/';
  const hasExtension = /\.[a-z0-9]+$/i.test(pathname);
  return hasExtension ? '' : pathname;
}

/**
 * @param {string} href
 * @param {Set<string>} seen
 * @param {string[]} list
 */
export function tryPushPathname(href, seen, list) {
  if (!href || href.startsWith('#')) return;
  try {
    const u = new URL(href, typeof window !== 'undefined' ? window.location.origin : undefined);
    const pathOnly = (u.pathname || '/').replace(/\/$/, '') || '/';
    if (!seen.has(pathOnly)) {
      seen.add(pathOnly);
      list.push(pathOnly);
    }
  } catch {
    const pathOnly = href.split('?')[0].replace(/\/$/, '') || '/';
    if (pathOnly.startsWith('/') && !seen.has(pathOnly)) {
      seen.add(pathOnly);
      list.push(pathOnly);
    }
  }
}

/**
 * Reads `pageUrl1`…`pageUrlN` from flat config and nested UE keys
 * (e.g. `manualpageselection_pageurl1`).
 * @param {Record<string, string>} config
 * @param {{ slots?: number[], nestedPrefixes?: string[] }} [options]
 * @returns {string[]}
 */
export function getManualPageUrlsFromConfig(config, options = {}) {
  const slots = options.slots ?? DEFAULT_MANUAL_PAGE_URL_SLOTS;
  const nestedPrefixes = options.nestedPrefixes ?? DEFAULT_NESTED_PAGE_URL_PREFIXES;
  return slots
    .map((idx) => {
      const flat = config[`pageurl${idx}`] || '';
      const nested = nestedPrefixes
        .map((p) => config[`${p}pageurl${idx}`] || '')
        .find(Boolean) || '';
      return flat || nested;
    })
    .filter(Boolean);
}

/* ========================================================================
   Metadata → card fields (fetch .plain.html or full HTML)
   ======================================================================== */

/**
 * @param {unknown[]} values
 * @returns {string}
 */
export function firstNonEmpty(values) {
  return values.find((v) => v != null && String(v).trim()) || '';
}

/**
 * @param {Array<Record<string, string>>|undefined} sections
 * @param {string} key
 * @returns {string}
 */
export function getSectionMetaValue(sections, key) {
  if (!Array.isArray(sections) || !key) return '';
  const normalizedKey = key.toLowerCase();
  return sections.map((s) => s?.[normalizedKey] || '').find(Boolean) || '';
}

/**
 * @param {Document} doc
 * @param {string} key
 * @returns {string}
 */
export function getMeta(doc, key) {
  const attr = key.includes(':') ? 'property' : 'name';
  const el = doc.head?.querySelector(`meta[${attr}="${key}"]`);
  return el?.getAttribute('content')?.trim() || '';
}

/** Twitter cards use meta name=, not property= (`getMeta` would miss `twitter:image`). */
export function getTwitterImageFromHead(doc) {
  if (!doc?.head) return '';
  const m = doc.head.querySelector('meta[name="twitter:image"]')
    || doc.head.querySelector('meta[name="twitter:image:src"]');
  return m?.getAttribute('content')?.trim() || '';
}

/**
 * Rough read time from word count (~200 wpm).
 * @param {string} [text]
 * @returns {string} e.g. "5 min"
 */
export function estimateReadTime(text) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  if (!words) return '';
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min`;
}

/**
 * @param {string} [value]
 * @returns {string} Trimmed value, or today's local date as YYYY-MM-DD when missing.
 */
export function ensurePublishDate(value) {
  const v = String(value || '').trim();
  if (v) return v;
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function publishDateFromHead(head) {
  return firstNonEmpty([
    head['published-time'],
    head['article:publish_time'],
    head['article:published_time'],
  ]);
}

function publishDateFromSections(sections) {
  return firstNonEmpty([
    getSectionMetaValue(sections, 'published-time'),
    getSectionMetaValue(sections, 'publishdate'),
    getSectionMetaValue(sections, 'publish-date'),
  ]);
}

/**
 * Card-shaped fields from a Document + extractPageMetadata (e.g. `.plain.html`).
 * @param {Document} doc
 * @param {URL} pageUrl
 * @returns {{ image: string, title: string, description: string, tag: string,
 *   publishDate: string, timeToRead: string, link: string }}
 */
export function buildCardDataFromExtractedMetadata(doc, pageUrl) {
  const { head = {}, sections = [] } = extractPageMetadata(doc);
  const bodyText = doc.body?.textContent || '';

  const title = firstNonEmpty([
    head['og:title'],
    head.title,
    getSectionMetaValue(sections, 'title'),
  ]);

  const description = firstNonEmpty([
    head['og:description'],
    head.description,
    getSectionMetaValue(sections, 'description'),
  ]);

  const image = firstNonEmpty([
    head['og:image'],
    head['twitter:image'],
    head['twitter:image:src'],
    getSectionMetaValue(sections, 'image'),
  ]);

  const publishDate = ensurePublishDate(firstNonEmpty([
    publishDateFromHead(head),
    publishDateFromSections(sections),
  ]));

  const tag = stripTrailingPageFromTagLabel(firstNonEmpty([
    head['content-type'],
    head['og:type'],
    getSectionMetaValue(sections, 'content-type'),
    head.pagetemplate,
    getSectionMetaValue(sections, 'pagetemplate'),
  ]));

  return {
    image,
    title,
    description,
    tag,
    publishDate,
    timeToRead: estimateReadTime(bodyText),
    link: pageUrl.href,
  };
}

/**
 * Card-shaped fields from arbitrary HTML (full page fetch).
 * @param {Document} doc
 * @param {URL} pageUrl
 * @returns {{ image: string, title: string, description: string, tag: string,
 *   publishDate: string, timeToRead: string, link: string }}
 */
export function buildCardDataFromFetchedDocument(doc, pageUrl) {
  const bodyText = doc.body?.textContent || '';
  return {
    image: firstNonEmpty([getMeta(doc, 'og:image'), getTwitterImageFromHead(doc)]),
    title: firstNonEmpty([getMeta(doc, 'og:title'), doc.title]),
    description: firstNonEmpty([getMeta(doc, 'og:description'), getMeta(doc, 'description')]),
    tag: stripTrailingPageFromTagLabel(firstNonEmpty([
      getMeta(doc, 'content-type'),
      getMeta(doc, 'og:type'),
      getMeta(doc, 'pagetemplate'),
    ])),
    publishDate: ensurePublishDate(firstNonEmpty([
      getMeta(doc, 'published-time'),
      getMeta(doc, 'article:publish_time'),
      getMeta(doc, 'article:published_time'),
      getMeta(doc, 'publish_date'),
    ])),
    timeToRead: estimateReadTime(bodyText),
    link: pageUrl.href,
  };
}

/**
 * Fetches metadata for a page URL: tries same-origin `.plain.html` path first, then full HTML.
 * @param {string} rawUrl
 * @returns {Promise<ReturnType<typeof buildCardDataFromExtractedMetadata>|null>}
 */
export async function fetchPageMetadata(rawUrl) {
  if (!rawUrl) return null;

  let pageUrl;
  try {
    pageUrl = new URL(rawUrl, typeof window !== 'undefined' ? window.location.origin : undefined);
  } catch {
    return null;
  }

  const internalPath = toInternalContentPath(pageUrl);
  if (internalPath) {
    try {
      const { ok, doc } = await fetchPageContent(internalPath);
      if (ok && doc) return buildCardDataFromExtractedMetadata(doc, pageUrl);
    } catch {
      /* fall through */
    }
  }

  try {
    const response = await fetch(pageUrl.href, { credentials: 'same-origin' });
    if (!response.ok) return null;
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return buildCardDataFromFetchedDocument(doc, pageUrl);
  } catch {
    return null;
  }
}

/* ========================================================================
   Lucidworks / Fusion doc → card list
   ======================================================================== */

/**
 * @param {Record<string, unknown>|null|undefined} doc
 * @param {string[]} keys
 * @returns {string}
 */
export function pickFirstDocString(doc, keys) {
  if (!doc || typeof doc !== 'object') return '';
  const hit = keys.find((k) => {
    const v = doc[k];
    return v != null && String(v).trim();
  });
  return hit ? String(doc[hit]).trim() : '';
}

/**
 * @param {Record<string, unknown>|null|undefined} doc
 * @returns {string}
 */
export function extractUrlFromSearchDoc(doc) {
  if (!doc || typeof doc !== 'object') return '';
  const candidates = [
    doc.uri_s,
    doc.uri,
    doc.url_s,
    doc.url,
    doc.id,
    doc.path,
    doc.link,
    doc.href,
  ];
  const found = candidates.find((v) => v != null && String(v).trim());
  return found ? String(found).trim() : '';
}

/**
 * One Fusion/Solr hit → fields used by teaser cards (title, description, imageUrl, link, …).
 * @param {Record<string, unknown>} doc
 * @returns {{ imageUrl: string, title: string, description: string, tag: string,
 *   publishDate: string, timeToRead: string, link: string }|null}
 */
export function cardDataFromLucidworksDoc(doc) {
  const link = extractUrlFromSearchDoc(doc);
  if (!link) return null;

  const title = pickFirstDocString(doc, [
    'title',
    'title_s',
    'attribute_twitter_title_s',
  ]);

  const description = pickFirstDocString(doc, [
    'description',
    'description_s',
    'attribute_og_description_s',
    'attribute_description_s',
  ]);

  const imageUrl = pickFirstDocString(doc, [
    'image_url',
    'image_url_s',
    'attribute_image_url_s',
    'attribute_twitter_image_t',
    'attribute_og_image_secure_url_t',
    'attribute_og_image_t',
  ]);

  const tag = stripTrailingPageFromTagLabel(pickFirstDocString(doc, [
    'attribute_content_type_s',
    'category_s',
    'type_s',
  ]));

  const publishDate = ensurePublishDate(pickFirstDocString(doc, [
    'date_added_s',
    'date_added_dt',
    'published_date_s',
    'attribute_article_published_time_s',
  ]));

  return {
    imageUrl,
    title: title || link,
    description,
    tag,
    publishDate,
    timeToRead: estimateReadTime(description),
    link,
  };
}

/**
 * @param {Array<{ link?: string }|null|undefined>} cards
 * @returns {Array<{ link?: string }>}
 */
export function dedupeCardsByLink(cards) {
  const seen = new Set();
  return cards.filter((c) => {
    if (!c?.link || seen.has(c.link)) return false;
    seen.add(c.link);
    return true;
  });
}

/**
 * Tag-based card list from Lucidworks (no per-page HTML fetch).
 * @param {string} selectedTags Comma-separated AEM tag ids or cleaned segments
 * @param {number} limit Max cards
 * @param {{ maxCards?: number }} [options] Hard cap (default 6)
 * @returns {Promise<NonNullable<ReturnType<typeof cardDataFromLucidworksDoc>>[]>}
 */
export async function fetchCardsFromTagSearch(selectedTags, limit, options = {}) {
  const maxCards = options.maxCards ?? 6;
  const q = cleanAemTagListForSearchQuery(selectedTags);
  if (!q) return [];
  const capped = Math.min(maxCards, Math.max(1, Number(limit) || maxCards));

  try {
    const { default: LucidworksClient } = await import('./lucidworks-client.js');
    const client = new LucidworksClient();
    const data = await client.fetchTags({
      q,
      rows: capped,
      start: 0,
    });
    if (!data) return [];
    const docs = data?.response?.docs;
    if (!Array.isArray(docs)) return [];

    const cards = docs
      .map((doc) => cardDataFromLucidworksDoc(doc))
      .filter(Boolean);
    return dedupeCardsByLink(cards).slice(0, capped);
  } catch {
    return [];
  }
}

/**
 * Cached page-data fetcher.
 *
 * Combines fetchPageContent, parseBlockData, and extractPageMetadata into a
 * single call that:
 *   1. Fetches page content from the defined source (.plain.html).
 *   2. Identifies and parses data required for dynamic blocks.
 *   3. Extracts and parses page metadata (head + section-metadata).
 *   4. Structures all parsed data for consumption by dynamic blocks.
 *   5. Caches the result in sessionStorage; returns cached copy on repeat calls.
 *   6. Implements error handling for missing or invalid data.
 *
 * @param {string} [url=window.location.pathname]  Page pathname to fetch
 * @returns {Promise<{url:string, blocks:Array, metadata:object, modules:Array}|null>}
 */
export async function getCurrentMeta(url = window.location.pathname) {
  if (!url || typeof url !== 'string') return null;

  const cleanUrl = url.replace(/\/$/, '') || '/';
  const storageKey = `meta:${cleanUrl}`;

  /* ---------- 1. Check sessionStorage cache ---------- */
  try {
    const cached = sessionStorage.getItem(storageKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.modules)) {
        return parsed;
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[getCurrentMeta] cache read error:', e);
  }

  /* ---------- 2. Fetch page content from defined source ---------- */
  const { ok, doc, error } = await fetchPageContent(cleanUrl);
  if (!ok || !doc) {
    // eslint-disable-next-line no-console
    console.warn('[getCurrentMeta]', error);
    return null;
  }

  /* ---------- 3. Parse block data for dynamic blocks ---------- */
  const blocks = parseBlockData(doc);

  /* ---------- 4. Extract page metadata ---------- */
  const metadata = extractPageMetadata(doc);

  /* ---------- 5. Build structured result ---------- */
  const meta = {
    url: cleanUrl,
    blocks,
    metadata,
    /* modules = one entry per section, compatible with legacy cache check */
    modules: blocks.map((b) => ({
      name: b.name,
      variants: b.variants,
      rowCount: b.rows.length,
    })),
  };

  /* ---------- 6. Cache for subsequent calls ---------- */
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(meta));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[getCurrentMeta] cache write error:', e);
  }

  return meta;
}

export function isAuthorEnvironment() {
  if (window?.location?.origin?.includes('author')) {
    return true;
  }
  return false;
}

/**
 * Detect if running in Universal Editor environment
 * Universal Editor loads pages in an iframe within the author environment
 * @returns {boolean} True if running in Universal Editor
 */
export const isUniversalEditor = () => {
  const isInIframe = window.self !== window.top;
  return isAuthorEnvironment() && isInIframe;
};
