import { getMetadata } from './aem.js';

/**
 * Loads `/taxonomy.json` (paths.json maps content taxonomy → site root).
 *
 * Supported shapes:
 * - Sheet (Helix / spreadsheet): `{ data: [ { tag, title }, ... ], ":type": "sheet" }`
 * - Legacy nested: `{ "Product Page": { "assetAttributes": { "mobility-global:...": "Label" } } }`
 */

/**
 * @typedef {{ kind: 'sheet', byTag: Record<string, string> }} TaxonomySheet
 * @typedef {{ kind: 'nested', tree: object }} TaxonomyNested
 * @typedef {TaxonomySheet | TaxonomyNested} LoadedTaxonomy
 */

/** `<meta name>` keys for page template/type (first non-empty wins). */
const PAGE_TYPE_META_NAMES = [
  'pagetemplate',
  'pageTemplate',
  'pagetype',
  'pageType',
  'page-type',
];

/**
 * Taxonomy sheet URL(s): always at site root (`/taxonomy.json`), not under locale
 * segments like `/en/` (see paths.json: taxonomy maps to root).
 * @returns {string[]}
 */
function taxonomyJsonUrls() {
  const urls = [];
  const origin = typeof window !== 'undefined' && window.location && window.location.origin
    ? window.location.origin
    : '';
  if (origin) {
    urls.push(`${origin}/taxonomy.json`);
  }
  urls.push('/taxonomy.json');
  return urls;
}

/**
 * @returns {Promise<object|null>}
 */
async function fetchTaxonomyJsonWithFallback() {
  const urls = taxonomyJsonUrls();
  let i;
  for (i = 0; i < urls.length; i += 1) {
    try {
      /* Sequential fallbacks; stop at first 200 + JSON. */
      /* eslint-disable no-await-in-loop */
      const r = await fetch(urls[i], { credentials: 'same-origin' });
      if (r.ok) {
        return r.json();
      }
      /* eslint-enable no-await-in-loop */
    } catch (e) {
      /* try next */
    }
  }
  return null;
}

let taxonomyLoadPromise = null;

/**
 * @param {string} s
 * @returns {string}
 */
function normalizeTagKey(s) {
  return String(s || '')
    .replace(/\u00a0/g, ' ')
    .trim();
}

/** Title cell normalization (sheet rows + tabular columns). */
function normalizeTitleValue(titleVal) {
  if (titleVal == null) return '';
  return String(titleVal).replace(/\u00a0/g, ' ').trim();
}

/**
 * Sheet rows: `data`, or `rows` / `items` (some pipelines).
 * @param {object} json
 * @returns {Array}
 */
function getSheetRows(json) {
  if (!json || typeof json !== 'object') return [];
  if (Array.isArray(json.data) && json.data.length) return json.data;
  if (Array.isArray(json.rows) && json.rows.length) return json.rows;
  if (Array.isArray(json.items) && json.items.length) return json.items;
  return [];
}

/**
 * @param {object} row
 * @returns {{ tag: string, title: string }}
 */
function extractTagTitleFromRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { tag: '', title: '' };
  }
  let tagVal = row.tag ?? row.Tag ?? row.TAG;
  let titleVal = row.title ?? row.Title ?? row.TITLE;
  if (tagVal == null || titleVal == null) {
    const keys = Object.keys(row);
    let ki;
    for (ki = 0; ki < keys.length; ki += 1) {
      const k = keys[ki];
      if (/^tag$/i.test(String(k).trim()) && tagVal == null) tagVal = row[k];
      if (/^title$/i.test(String(k).trim()) && titleVal == null) titleVal = row[k];
    }
  }
  const tag = tagVal != null ? normalizeTagKey(tagVal) : '';
  const title = normalizeTitleValue(titleVal);
  return { tag, title };
}

/**
 * @param {object} json
 * @returns {Record<string, string>|null}
 */
function buildTagTitleMapFromSheet(json) {
  const rows = getSheetRows(json);
  if (!rows.length) return null;

  const map = Object.create(null);

  /* Tabular sheet: columns + array-of-arrays */
  if (
    Array.isArray(json.columns)
    && json.columns.length
    && Array.isArray(rows[0])
  ) {
    const cols = json.columns.map((c) => String(c).toLowerCase().trim());
    const ti = cols.indexOf('tag');
    const tti = cols.indexOf('title');
    if (ti >= 0 && tti >= 0) {
      let i;
      for (i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (Array.isArray(row)) {
          const tag = row[ti] != null ? normalizeTagKey(row[ti]) : '';
          const title = normalizeTitleValue(row[tti]);
          if (tag && title) map[tag] = title;
        }
      }
    }
  }

  if (Object.keys(map).length) return map;

  let j;
  for (j = 0; j < rows.length; j += 1) {
    const { tag, title } = extractTagTitleFromRow(rows[j]);
    if (tag && title) map[tag] = title;
  }

  return Object.keys(map).length ? map : null;
}

/** @returns {Promise<LoadedTaxonomy|null>} */
export function loadTaxonomyData() {
  if (!taxonomyLoadPromise) {
    taxonomyLoadPromise = fetchTaxonomyJsonWithFallback()
      .then((json) => {
        if (!json || typeof json !== 'object') {
          taxonomyLoadPromise = null;
          return null;
        }
        const byTag = buildTagTitleMapFromSheet(json);
        if (byTag) return { kind: 'sheet', byTag };
        return { kind: 'nested', tree: json };
      })
      .catch(() => {
        taxonomyLoadPromise = null;
        return null;
      });
  }
  return taxonomyLoadPromise;
}

/** Page type from metadata (AEM may emit different casings / field names). */
export function getPageTypeForTaxonomy(doc = document) {
  let i;
  for (i = 0; i < PAGE_TYPE_META_NAMES.length; i += 1) {
    const v = getMetadata(PAGE_TYPE_META_NAMES[i], doc);
    if (v && String(v).trim()) return String(v).trim();
  }
  return '';
}

/**
 * Candidate keys to match a tag id/path against taxonomy keys.
 * @param {string} raw
 * @returns {string[]}
 */
export function expandTagKeys(raw) {
  const s = normalizeTagKey(raw);
  if (!s) return [];
  const keys = new Set([s]);
  if (s.includes('/')) {
    keys.add(s.split('/').filter(Boolean).pop());
  }
  if (s.includes(':')) {
    const rest = s.split(':').slice(1).join(':');
    keys.add(rest);
    if (rest.includes('/')) keys.add(rest.split('/').pop());
  }
  return [...keys];
}

/**
 * Extra variants when AEM meta path differs from taxonomy sheet (e.g. `/topic/` segment).
 * @param {string} rawTag
 * @returns {string[]}
 */
function expandTagKeysForLookup(rawTag) {
  const normalized = normalizeTagKey(rawTag);
  const keys = new Set(expandTagKeys(normalized));
  if (normalized.includes('/topic/')) {
    const alt = normalized.replace(/\/topic\//g, '/');
    expandTagKeys(alt).forEach((k) => keys.add(k));
  }
  return [...keys];
}

/**
 * @param {object} taxonomy
 * @param {string} pageType
 * @returns {object|null}
 */
function getTaxonomyNodeForPageType(taxonomy, pageType) {
  if (!taxonomy || !pageType) return null;
  if (taxonomy[pageType] && typeof taxonomy[pageType] === 'object') {
    return taxonomy[pageType];
  }
  const lower = pageType.toLowerCase();
  const keys = Object.keys(taxonomy);
  let i;
  for (i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    if (k.toLowerCase() === lower && typeof taxonomy[k] === 'object') {
      return taxonomy[k];
    }
  }
  return null;
}

function looksLikeAemTagValue(raw) {
  const s = String(raw || '').trim();
  if (!s || /^https?:\/\//i.test(s)) return false;
  return s.includes('/content/cq:tags/')
    || (/^[a-z0-9-]+:/i.test(s) && s.includes('/'));
}

/**
 * @param {object} obj
 * @param {string[]} tagKeys
 * @returns {string|null}
 */
function deepFindStringLabel(obj, tagKeys) {
  if (!obj || typeof obj !== 'object') return null;
  let i;
  for (i = 0; i < tagKeys.length; i += 1) {
    const k = tagKeys[i];
    if (typeof obj[k] === 'string') return obj[k];
  }
  const values = Object.values(obj);
  for (i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const found = deepFindStringLabel(v, tagKeys);
      if (found) return found;
    }
  }
  return null;
}

/**
 * @param {object} container
 * @param {string[]} tagKeys
 * @returns {string|null}
 */
function firstMatchingLabel(container, tagKeys) {
  if (!container || typeof container !== 'object' || Array.isArray(container)) return null;
  let i;
  for (i = 0; i < tagKeys.length; i += 1) {
    const k = tagKeys[i];
    if (typeof container[k] === 'string') return container[k];
  }
  return null;
}

/**
 * @param {Record<string, string>} byTag
 * @param {string} rawTag
 * @returns {string|null}
 */
function resolveLabelFromSheet(byTag, rawTag) {
  const tagKeys = expandTagKeysForLookup(rawTag);
  let i;
  for (i = 0; i < tagKeys.length; i += 1) {
    const k = tagKeys[i];
    if (byTag[k]) return byTag[k];
  }

  const segments = normalizeTagKey(rawTag).split('/').filter(Boolean);
  const last = segments.length ? segments[segments.length - 1] : '';
  if (!last) return null;
  const allKeys = Object.keys(byTag);
  const candidates = allKeys.filter((k) => k === last || k.endsWith(`/${last}`));
  if (candidates.length === 1) return byTag[candidates[0]];
  return null;
}

/**
 * Resolve a raw AEM tag id to a display title using the sheet `byTag` map.
 * Keeps canonical ids for filter/query params; use for UI labels only.
 * @param {string} tagId
 * @param {Record<string, string>} byTag
 * @returns {string}
 */
export function resolveTagIdToDisplayTitle(tagId, byTag) {
  if (tagId == null || tagId === '') return '';
  if (!byTag || typeof byTag !== 'object') return String(tagId);
  const resolved = resolveLabelFromSheet(byTag, String(tagId));
  return resolved != null && resolved !== '' ? resolved : String(tagId);
}

/**
 * Last-segment title case when taxonomy sheet/tree has no match (e.g. `.../planning-solutions`).
 * @param {string} raw
 * @returns {string}
 */
function humanizeAemTagPath(raw) {
  const s = normalizeTagKey(raw);
  if (!s) return '';
  if (!s.includes('/') && !s.includes(':')) return s;
  let segment = s;
  if (s.includes('/')) {
    const parts = s.split('/').filter(Boolean);
    segment = parts.length ? parts[parts.length - 1] : s;
  }
  if (segment.includes(':')) {
    segment = segment.split(':').pop() || segment;
  }
  return segment
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Label for search facet chips / checkboxes: sheet title, nested tree label, or humanized path.
 * @param {string} tagId
 * @param {LoadedTaxonomy|null|undefined} loadedTaxonomy
 * @returns {string}
 */
export function resolveFacetValueDisplay(tagId, loadedTaxonomy) {
  const raw = tagId == null ? '' : String(tagId);
  if (!raw) return '';
  if (loadedTaxonomy?.kind === 'sheet' && loadedTaxonomy.byTag) {
    const fromSheet = resolveLabelFromSheet(loadedTaxonomy.byTag, raw);
    if (fromSheet != null && fromSheet !== '') return fromSheet;
  }
  if (loadedTaxonomy?.kind === 'nested' && loadedTaxonomy.tree) {
    const keys = expandTagKeysForLookup(raw);
    const fromTree = deepFindStringLabel(loadedTaxonomy.tree, keys);
    if (fromTree != null && fromTree !== '') return fromTree;
  }
  return humanizeAemTagPath(raw);
}

/**
 * Legacy nested taxonomy.json (per page type).
 * @param {object} tree
 * @param {string} pageType
 * @param {string} metaName
 * @param {string} rawTag
 * @returns {string|null}
 */
function resolveTaxonomyLabelNested(tree, pageType, metaName, rawTag) {
  if (!tree || !pageType || !rawTag) return null;
  const pt = getTaxonomyNodeForPageType(tree, pageType);
  if (!pt || typeof pt !== 'object') return null;

  /* Same key variants as sheet + facet lookup (incl. `/topic/` path alts). */
  const tagKeys = expandTagKeysForLookup(rawTag);
  if (!tagKeys.length) return null;

  const fieldCandidates = metaName
    ? [
      metaName,
      metaName.toLowerCase(),
      metaName.replace(/-([a-z])/gi, (_, c) => c.toUpperCase()),
    ]
    : [];

  let i;
  for (i = 0; i < fieldCandidates.length; i += 1) {
    const fk = fieldCandidates[i];
    if (fk) {
      const sub = pt[fk];
      if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
        const found = firstMatchingLabel(sub, tagKeys);
        if (found) return found;
      }
    }
  }

  if (metaName) {
    const lower = metaName.toLowerCase();
    const keys = Object.keys(pt);
    for (i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (key.toLowerCase() === lower) {
        const sub = pt[key];
        if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
          const found = firstMatchingLabel(sub, tagKeys);
          if (found) return found;
        }
      }
    }
  }

  const flat = firstMatchingLabel(pt, tagKeys);
  if (flat) return flat;

  const bucketVals = Object.values(pt);
  for (i = 0; i < bucketVals.length; i += 1) {
    const node = bucketVals[i];
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      const vals = Object.values(node);
      if (vals.length && vals.every((v) => typeof v === 'string')) {
        const found = firstMatchingLabel(node, tagKeys);
        if (found) return found;
      }
    }
  }

  return deepFindStringLabel(pt, tagKeys);
}

/**
 * @param {LoadedTaxonomy|null} taxonomy
 * @param {string} pageType
 * @param {string} metaName meta[name] e.g. assetattributes
 * @param {string} rawTag
 * @returns {string|null}
 */
export function resolveTaxonomyLabel(taxonomy, pageType, metaName, rawTag) {
  if (!taxonomy || !rawTag) return null;
  if (taxonomy.kind === 'sheet' && taxonomy.byTag && Object.keys(taxonomy.byTag).length) {
    return resolveLabelFromSheet(taxonomy.byTag, rawTag);
  }
  if (taxonomy.kind === 'nested' && taxonomy.tree) {
    return resolveTaxonomyLabelNested(taxonomy.tree, pageType, metaName, rawTag);
  }
  return null;
}

/**
 * @param {LoadedTaxonomy|null} taxonomy
 * @param {string} metaName
 * @param {string} content
 * @param {Document} doc
 * @returns {string}
 */
export function normalizeTaxonomyMetaContent(taxonomy, metaName, content, doc = document) {
  if (!taxonomy) return content;

  const pageType = getPageTypeForTaxonomy(doc);
  if (taxonomy.kind === 'nested' && !pageType) return content;

  const parts = String(content)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const out = parts.map((part) => {
    if (!looksLikeAemTagValue(part)) return part;
    const label = resolveTaxonomyLabel(taxonomy, pageType, metaName, part);
    return label || part;
  });

  return out.join(', ');
}

/**
 * Rewrites `<meta name="...">` tag ids to display titles from `taxonomy.json`.
 * @param {Document} doc
 */
export async function applyTaxonomyLabelsToMetas(doc = document) {
  const taxonomy = await loadTaxonomyData();
  if (!taxonomy) return;

  if (taxonomy.kind === 'nested' && !getPageTypeForTaxonomy(doc)) return;

  doc.head.querySelectorAll('meta[name]').forEach((m) => {
    const name = (m.getAttribute('name') || '').trim();
    const raw = (m.getAttribute('content') || '').trim();
    if (!name || !raw) return;

    const next = normalizeTaxonomyMetaContent(taxonomy, name, raw, doc);
    if (next && next !== raw) {
      m.setAttribute('content', next);
    }
  });
}

let taxonomyHeadObserver = null;

/**
 * Metas are sometimes injected after first paint; re-apply labels when `<meta name>` nodes appear.
 * @param {Document} doc
 */
export function observeTaxonomyMetaInjections(doc = document) {
  if (taxonomyHeadObserver || typeof MutationObserver === 'undefined') return;

  let t = 0;
  const schedule = () => {
    window.clearTimeout(t);
    t = window.setTimeout(() => {
      applyTaxonomyLabelsToMetas(doc);
    }, 100);
  };

  taxonomyHeadObserver = new MutationObserver(schedule);
  taxonomyHeadObserver.observe(doc.head, { childList: true, subtree: true });
}

/**
 * Re-run label replacement shortly after load (Helix sometimes finalizes head after first tick).
 * @param {Document} doc
 */
export function scheduleTaxonomyMetaRelabel(doc = document) {
  const run = () => {
    applyTaxonomyLabelsToMetas(doc);
  };
  window.setTimeout(run, 0);
  window.setTimeout(run, 100);
  window.setTimeout(run, 400);
}
