​import { TABLET_BP } from './constants.js';


// Session Storage utilities
export const getSessionStorageItem = (prop) => window.sessionStorage.getItem(prop);
export const setSessionStorageItem = (prop, value) => window.sessionStorage.setItem(prop, value);

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
 * Full cq:tag ids for Lucidworks facet filters.
 * Splits on commas and newlines, and on
 * repeated `mobility-global:` when the UE stacks tags without commas
 * (so multiple tags are not lost).
 * @param {string} [raw]
 * @returns {string[]}
 */
function splitFullTagPathsForLucidworks(raw) {
  if (raw == null || raw === '') return [];
  const s = String(raw).trim();
  if (!s) return [];
  const chunks = s
    .split(/[\n\r,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const out = [];
  chunks.forEach((chunk) => {
    const parts = chunk.split(/(?=mobility-global:)/gi).map((x) => x.trim()).filter(Boolean);
    if (parts.length) out.push(...parts);
  });
  return [...new Set(out)].filter(Boolean);
}

/**
 * Universal Editor often renders AEM cq:tag ids in leaf `div`s that never become `tags_*`
 * keys in `collectConfigRows`. Collect those ids from the block DOM for Lucidworks.
 * @param {ParentNode|null|undefined} container
 * @returns {string[]}
 */
export function extractMobilityGlobalTagPathsFromDom(container) {
  if (!container?.querySelectorAll) return [];
  const parts = [];
  container.querySelectorAll('div').forEach((el) => {
    if (el.querySelector('div')) return;
    const t = el.textContent?.trim();
    if (!t || !/\bmobility-global:/i.test(t)) return;
    parts.push(...splitFullTagPathsForLucidworks(t));
  });
  return [...new Set(parts)].filter(Boolean);
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
 * Display polish: strip trailing template suffixes from type labels (case-insensitive).
 * Handles e.g. "… Page", "… Details", "… Details Page" (insight details pages).
 * @param {string} [value]
 * @returns {string}
 */
export function stripTrailingPageFromTagLabel(value) {
  let s = String(value || '').trim();
  if (!s) return '';
  s = s.replace(/\s+details\s+page$/i, '').trim();
  s = s.replace(/\s+page$/i, '').trim();
  s = s.replace(/\s+details$/i, '').trim();
  return s;
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
  if (hasExtension) {
    let trimmed = pathname.replace(
      /^\/content\/(mobilityglobal|mobility-global|global-mobility|globalmobility)/,
      '',
    );
    trimmed = trimmed.replace(/\.html$/, '');
    return trimmed.startsWith('/') ? trimmed : (`/${trimmed}`);
  }
  return pathname;
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
 * Read time from head meta / section metadata tables.
 * @param {Record<string, string>} head
 * @param {Array<Record<string, string>>} sections
 * @returns {string}
 */
function resolveTimeToRead(head, sections) {
  const fromMeta = firstNonEmpty([
    head.timetoread,
    getSectionMetaValue(sections, 'timetoread'),
  ]);
  return (fromMeta && String(fromMeta).trim()) || '';
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
    head.pagetype,
    head['og:type'],
    getSectionMetaValue(sections, 'pagetype'),
  ]));

  return {
    image,
    title,
    description,
    tag,
    publishDate,
    timeToRead: resolveTimeToRead(head, sections) || '0 min',
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
  const { head, sections } = extractPageMetadata(doc);
  return {
    image: firstNonEmpty([getMeta(doc, 'og:image'), getTwitterImageFromHead(doc)]),
    title: firstNonEmpty([getMeta(doc, 'og:title'), doc.title]),
    description: firstNonEmpty([getMeta(doc, 'og:description'), getMeta(doc, 'description')]),
    tag: stripTrailingPageFromTagLabel(firstNonEmpty([
      getMeta(doc, 'pagetype'),
      getMeta(doc, 'og:type'),
      getMeta(doc, 'pagetemplate'),
    ])),
    publishDate: ensurePublishDate(firstNonEmpty([
      getMeta(doc, 'published-time'),
      getMeta(doc, 'article:publish_time'),
      getMeta(doc, 'article:published_time'),
      getMeta(doc, 'publish_date'),
    ])),
    timeToRead: resolveTimeToRead(head, sections) || '0 min',
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
    'attribute_page_type_s',
    'category_s',
    'type_s',
  ]));

  const publishDate = ensurePublishDate(pickFirstDocString(doc, [
    'date_added_s',
    'date_added_dt',
    'published_date_dt',
    'attribute_article_published_time_s',
  ]));

  const timeToReadFromMeta = pickFirstDocString(doc, [
    'timetoread',
    'timetoread_s',
    'attribute_timetoread_s',
    'attribute_timetoread_t',
  ]);

  return {
    imageUrl,
    title: title || link,
    description,
    tag,
    publishDate,
    timeToRead: timeToReadFromMeta || '0 min',
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

/** Lucidworks `attribute_page_type_s` values for card grids (Insights vs Experts). */
export const LUCIDWORKS_PAGE_TYPES = {
  INSIGHTS: 'Insights Details Page',
  EXPERTS: 'Experts Page',
};

/**
 * Collect full AEM tag paths from flat Tags text, `tags_*` keys, and any other config
 * cell whose value looks like cq:tag ids (`mobility-global:…`). The latter covers UE
 * rows that do not map to `tags_*` (e.g. empty label row breaking the key chain).
 * @param {string} selectedTags
 * @param {Record<string, unknown>} [blockConfig]
 * @returns {string} Comma-separated tag ids for cleanAemTagListForSearchQuery
 */
function collectTagPathsForLucidworksQuery(selectedTags, blockConfig) {
  const parts = [...splitFullTagPathsForLucidworks(selectedTags)];
  if (blockConfig && typeof blockConfig === 'object') {
    Object.entries(blockConfig).forEach(([key, val]) => {
      if (val == null || val === '') return;
      const s = Array.isArray(val) ? val.join(',') : String(val);
      if (key.startsWith('tags_')) {
        parts.push(...splitFullTagPathsForLucidworks(s));
        return;
      }
      if (/\bmobility-global:/i.test(s)) {
        parts.push(...splitFullTagPathsForLucidworks(s));
      }
    });
  }
  return [...new Set(parts)].filter(Boolean).join(',');
}

/**
 * Path after `namespace:` in an AEM cq:tag id (Solr stores full ids like `mobility-global:…`).
 * @param {string} tagPath
 * @returns {string}
 */
function pathAfterNamespace(tagPath) {
  const s = String(tagPath).trim();
  const idx = s.indexOf(':');
  return idx >= 0 ? s.slice(idx + 1) : s;
}

/**
 * Pass-through for Lucidworks facet values (full cq:tag ids). Do not rewrite
 * `market-context/market-region/` — index / `marketregion_t` expect the AEM path as-authored.
 * @param {string} tagPath
 * @returns {string}
 */
function normalizeLucidworksIndexedTagPath(tagPath) {
  return String(tagPath).trim();
}

/**
 * Maps AEM tag path prefixes to their tag-config key (longest prefix wins).
 * The actual Solr field name is resolved at runtime from /tag-config.json via loadTagConfigKeyToField().
 * Prefixes are lowercase; compared against `pathAfterNamespace(tag)` lowercased.
 */
const LUCIDWORKS_PATH_PREFIX_TO_CONFIG_KEY = [
  ['system-and-structural-tags/content-formats/event-formats/', 'eventformat'],
  ['system-and-structural-tags/content-formats/', 'contentformat'],
  ['insights-and-intelligence/insight-and-thought-leader-content-type/', 'insightsthoughtleadercontenttype'],
  ['contextual-variables/regulatory-and-operating-context/regulatory-context/', 'regulatorycontext'],
  ['contextual-variables/market-context/market-sales-region/', 'marketsalesregion'],
  ['contextual-variables/market-context/market-region/', 'marketregion'],
  ['contextual-variables/market-context/market-country/', 'marketcountry'],
  ['contextual-variables/segmentation-and-user-context/industry-or-sector/', 'industrysector'],
  ['contextual-variables/segmentation-and-user-context/audience-role/', 'audiencerole'],
  ['products-and-platforms/product-capabilities/', 'productcapability'],
  ['products-and-platforms/product-families/', 'productfamily'],
  ['products-and-platforms/services-and-advisory/', 'servicesadvisory'],
  ['insights-and-intelligence/theme/', 'theme'],
  ['insights-and-intelligence/series/', 'series'],
  ['insights-and-intelligence/topic/', 'topic'],
  ['pillars-and-need-states/need-states/', 'needstates'],
  ['pillars-and-need-states/', 'pillars'],
];

/**
 * `configKeyToField` (tags_* key suffix → Lucidworks field) is fetched from /tag-config.json.
 * @type {Record<string, string> | null}
 */
let tagConfigCache = null;
let tagConfigFetchPromise = null;

/**
 * Fetch and cache the `configKeyToField` map from /tag-config.json once.
 * @returns {Promise<Record<string, string>>}
 */
async function loadTagConfigKeyToField() {
  if (tagConfigCache) return tagConfigCache;
  if (!tagConfigFetchPromise) {
    tagConfigFetchPromise = (async () => {
      const base = typeof window !== 'undefined' ? (window.hlx?.codeBasePath || '') : '';
      try {
        const resp = await fetch(`${base}/tag-config.json`);
        if (!resp.ok) throw new Error(`tag-config.json: ${resp.status}`);
        const json = await resp.json();
        /** @type {Record<string, string>} */
        const map = {};
        const rows = json.data ?? json.configKeyToField ?? [];
        if (Array.isArray(rows)) {
          rows.forEach((row) => {
            const key = row.key ?? row.Key;
            const field = row.value ?? row.field ?? row.Value ?? row.Field;
            if (key && field) map[String(key)] = String(field);
          });
        }
        tagConfigCache = map;
      } catch {
        tagConfigCache = {};
      }
      return tagConfigCache;
    })();
  }
  return tagConfigFetchPromise;
}

/**
 * @param {Record<string, unknown>} [blockConfig]
 * @returns {Promise<Record<string, string[]>>}
 */
async function collectFacetFiltersFromBlockConfig(blockConfig) {
  /** @type {Record<string, string[]>} */
  const buckets = {};
  if (!blockConfig || typeof blockConfig !== 'object') return buckets;
  const configKeyToField = await loadTagConfigKeyToField();
  Object.entries(blockConfig).forEach(([key, val]) => {
    if (!key.startsWith('tags_')) return;
    if (val == null || val === '') return;
    const suffix = key.slice('tags_'.length);
    const field = configKeyToField[suffix];
    if (!field) return;
    const s = Array.isArray(val) ? val.join(',') : String(val);
    splitFullTagPathsForLucidworks(s).forEach((path) => {
      if (!path) return;
      const normalized = normalizeLucidworksIndexedTagPath(path);
      if (!buckets[field]) buckets[field] = [];
      if (!buckets[field].includes(normalized)) buckets[field].push(normalized);
    });
  });
  return buckets;
}

/**
 * @param {string} [tagPathsInput] Comma-separated full tag ids
 * @returns {Promise<Record<string, string[]>>}
 */
async function groupTagPathsByPathPrefix(tagPathsInput) {
  const paths = splitFullTagPathsForLucidworks(tagPathsInput);
  /** @type {Record<string, string[]>} */
  const buckets = {};
  const configKeyToField = await loadTagConfigKeyToField();
  paths.forEach((fullPath) => {
    const rest = pathAfterNamespace(fullPath);
    const restLower = rest.toLowerCase();
    const match = LUCIDWORKS_PATH_PREFIX_TO_CONFIG_KEY.find(([prefix]) => restLower.startsWith(prefix));
    if (match) {
      const [, configKey] = match;
      const field = configKeyToField[configKey];
      if (!field) return;
      const normalized = normalizeLucidworksIndexedTagPath(fullPath);
      if (!buckets[field]) buckets[field] = [];
      if (!buckets[field].includes(normalized)) buckets[field].push(normalized);
    }
  });
  return buckets;
}

/**
 * @param {Record<string, string[]>} a
 * @param {Record<string, string[]>} b
 * @returns {Record<string, string[]>}
 */
function mergeFacetBuckets(a, b) {
  const out = { ...a };
  Object.entries(b).forEach(([field, values]) => {
    if (!Array.isArray(values) || !values.length) return;
    const merged = new Set(out[field] || []);
    values.forEach((v) => merged.add(v));
    out[field] = [...merged];
  });
  return out;
}

/**
 * Builds per-field Solr facet filters for tag-driven card search
 * (AND within a field when multiple values, AND across fields).
 * `tags_*` keys from block config take precedence; remaining paths use path-prefix fallback.
 * @param {string} [selectedTags] Flat card-tags row (comma-separated)
 * @param {Record<string, unknown>} [blockConfig]
 * @returns {Promise<Record<string, string[]>>}
 */
async function buildLucidworksFacetFiltersFromTags(selectedTags, blockConfig) {
  const fromConfig = await collectFacetFiltersFromBlockConfig(blockConfig);
  const mergedCsv = collectTagPathsForLucidworksQuery(selectedTags, blockConfig);
  const allPaths = splitFullTagPathsForLucidworks(mergedCsv);
  const assigned = new Set(Object.values(fromConfig).flat());
  const remaining = allPaths.filter((p) => !assigned.has(p));
  const fromPaths = await groupTagPathsByPathPrefix(remaining.join(','));
  return mergeFacetBuckets(fromConfig, fromPaths);
}

/**
 * Tag-based card list from Lucidworks (no per-page HTML fetch).
 * Request shape: q=*:* + fq page type + tagged fq per field
 * (AND within field when multiple values) + fl=*&wt=json.
 *
 * @param {string} selectedTags Comma-separated AEM tag ids (optional with tags_* in blockConfig)
 * @param {number} limit Max cards
 * @param {object} [options]
 * @param {number} [options.maxCards] Hard cap (default 6)
 * @param {string} [options.pageType] attribute_page_type_s value (required)
 * @param {Record<string, unknown>} [options.blockConfig] Flattened config from collectConfigRows
 * @param {boolean} [options.forInsightsCard] Pass true for insights card (fl=*&wt=json on request)
 * @returns {Promise<NonNullable<ReturnType<typeof cardDataFromLucidworksDoc>>[]>}
 */
export async function fetchCardsFromTagSearch(selectedTags, limit, options = {}) {
  const maxCards = options.maxCards ?? 6;
  const { pageType, blockConfig = {}, forInsightsCard = false } = options;
  if (!pageType) return [];

  const capped = Math.min(maxCards, Math.max(1, Number(limit) || maxCards));

  const tagPaths = collectTagPathsForLucidworksQuery(selectedTags, blockConfig);
  if (!tagPaths) return [];

  const facetFilters = await buildLucidworksFacetFiltersFromTags(selectedTags, blockConfig);
  if (!Object.keys(facetFilters).length) return [];

  try {
    const { default: LucidworksClient } = await import('./lucidworks-client.js');
    const client = new LucidworksClient();
    const data = await client.fetchTags({
      start: 0,
      rows: capped,
      pageType,
      facetFilters,
      forInsightsCard,
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
