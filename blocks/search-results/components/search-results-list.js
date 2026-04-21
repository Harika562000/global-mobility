/**
 * Lucidworks/Solr payloads: AEM metadata is often indexed as `attribute_*` (see API `fl` / docs).
 * Meta names: eventdatetime, eventformat, eventlocation → various Solr field suffixes.
 */
const EVENT_DATETIME_KEYS = [
  'attribute_eventdatetime_dt',
];
const EVENT_FORMAT_KEYS = [
  'attribute_event_format_ss',
];
const EVENT_LOCATION_KEYS = [
  'attribute_eventlocation_s',
];

/**
 * Solr `fl` lines for contextual landing requests.
 * Appending extra `fl` can replace the query profile’s default `fl`, so list fields
 * must be requested explicitly.
 */
const CONTEXTUAL_LANDING_LIST_FL = [
  'id',
  'title',
  'title_s',
  'description',
  'description_s',
  'uri',
  'uri_s',
];

/** Event metadata + list fields (Events landing page). */
export const EVENT_LANDING_SOLR_FIELD_LIST = [
  ...CONTEXTUAL_LANDING_LIST_FL,
  ...EVENT_DATETIME_KEYS,
  ...EVENT_FORMAT_KEYS,
  ...EVENT_LOCATION_KEYS,
];

/** Experts landing: og:image secure URL only (`meta og:image:secure_url` → Solr dynamic field). */
const EXPERT_OG_IMAGE_FIELD = 'attribute_og_image_secure_url_t';

export const EXPERT_LANDING_SOLR_FIELD_LIST = [
  ...CONTEXTUAL_LANDING_LIST_FL,
  EXPERT_OG_IMAGE_FIELD,
];

function readDocValue(doc, key) {
  const raw = doc[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v != null && String(v).trim() !== '') return String(v).trim();
  return null;
}

function firstDocValue(doc, explicitKeys) {
  if (!doc || typeof doc !== 'object') return null;
  const direct = explicitKeys.reduce((acc, key) => {
    if (acc) return acc;
    if (!Object.prototype.hasOwnProperty.call(doc, key)) return null;
    return readDocValue(doc, key) || null;
  }, null);
  if (direct) return direct;
  const lowerMap = Object.keys(doc).reduce((acc, k) => {
    acc[k.toLowerCase()] = k;
    return acc;
  }, {});
  return explicitKeys.reduce((acc, key) => {
    if (acc) return acc;
    const actual = lowerMap[key.toLowerCase()];
    if (!actual) return null;
    return readDocValue(doc, actual) || null;
  }, null);
}

/** Fallback when Solr uses dynamic suffixes, e.g. `metadata_eventdatetime_dt`. */
function fuzzyDocValue(doc, namePart) {
  if (!doc || typeof doc !== 'object') return null;
  const needle = namePart.toLowerCase();
  const keys = Object.keys(doc);
  const match = keys.find((k) => k.toLowerCase().includes(needle));
  if (!match) return null;
  return readDocValue(doc, match);
}

function resolveEventField(doc, explicitKeys, fuzzyParts) {
  const direct = firstDocValue(doc, explicitKeys);
  if (direct) return direct;
  const parts = Array.isArray(fuzzyParts) ? fuzzyParts : [fuzzyParts];
  for (let i = 0; i < parts.length; i += 1) {
    const v = fuzzyDocValue(doc, parts[i]);
    if (v) return v;
  }
  return null;
}

/**
 * @param {string} iso
 * @returns {string}
 */
function formatEventDateTimeDisplay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dateStr = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  return `${dateStr} · ${timeStr}`;
}

function createMetaIcon(kind) {
  const wrap = document.createElement('span');
  wrap.className = `search-result-meta-icon search-result-meta-icon-${kind}`;
  wrap.setAttribute('aria-hidden', 'true');
  if (kind === 'time') {
    wrap.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
  }
  return wrap;
}

function createMetaRow(iconKind, text) {
  const row = document.createElement('div');
  row.className = 'search-result-meta-row';
  row.append(createMetaIcon(iconKind));
  const span = document.createElement('span');
  span.className = 'search-result-meta-text';
  span.textContent = text;
  row.append(span);
  return row;
}

function pickTitle(doc) {
  const v = doc.title ?? doc.title_s ?? doc.title_t;
  if (v != null && String(v).trim() !== '') {
    return String(v).trim().replace(/\s*\|\s*mobility global\s*$/i, '').trim();
  }
  return 'Untitled result';
}

function pickDescription(doc) {
  const v = doc.description ?? doc.description_s ?? doc.description_t;
  if (v == null) return '';
  return String(v).trim();
}

function pickResultUrl(doc) {
  const v = doc.url ?? doc.uri ?? doc.uri_s;
  if (v != null && String(v).trim() !== '') return String(v).trim();
  const { id } = doc;
  if (id != null && /^https?:\/\//i.test(String(id))) return String(id).trim();
  return '#';
}

function pickOgImageUrl(doc) {
  if (!doc || typeof doc !== 'object') return '';
  const raw = doc[EXPERT_OG_IMAGE_FIELD];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v != null && String(v).trim() !== '') return String(v).trim();
  return '';
}

function createCard(doc, options = {}) {
  const { showEventMeta = false, showExpertImage = false, formatTaxonomyValue } = options;

  const li = document.createElement('li');
  li.className = 'search-result-card';
  if (showExpertImage) {
    li.classList.add('search-result-card-expert');
  }

  const link = document.createElement('a');
  link.href = pickResultUrl(doc);
  link.className = 'search-result-link';

  const imageUrl = showExpertImage ? pickOgImageUrl(doc) : '';
  if (imageUrl) {
    link.classList.add('search-result-link-with-image');
    const media = document.createElement('div');
    media.className = 'search-result-media';
    const img = document.createElement('img');
    img.className = 'search-result-image';
    img.src = imageUrl;
    img.alt = pickTitle(doc);
    img.loading = 'lazy';
    img.decoding = 'async';
    media.append(img);
    link.append(media);
  }

  const content = document.createElement('div');
  content.className = 'search-result-content';

  const title = document.createElement('h4');
  title.className = 'search-result-title';
  title.textContent = pickTitle(doc);
  content.append(title);

  const desc = document.createElement('p');
  desc.className = 'search-result-description';
  desc.textContent = pickDescription(doc);
  content.append(desc);

  if (showEventMeta) {
    const eventTime = resolveEventField(doc, EVENT_DATETIME_KEYS, ['eventdatetime', 'event_datetime']);
    const eventFormatRaw = resolveEventField(doc, EVENT_FORMAT_KEYS, ['eventformat', 'event_format']);
    const eventLocation = resolveEventField(doc, EVENT_LOCATION_KEYS, ['eventlocation', 'event_location']);

    let formatLabel = eventFormatRaw;
    if (eventFormatRaw) {
      const tagForTaxonomy = (Array.isArray(doc.attribute_event_format_ss)
        ? doc.attribute_event_format_ss[0]
        : null)
        || eventFormatRaw;
      const pathStr = String(tagForTaxonomy);
      if (typeof formatTaxonomyValue === 'function') {
        const resolved = formatTaxonomyValue(pathStr);
        if (resolved && resolved !== pathStr) {
          formatLabel = resolved;
        } else {
          const segments = pathStr.split('/').filter(Boolean);
          const last = segments[segments.length - 1] || pathStr;
          formatLabel = last
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
        }
      } else {
        const segments = pathStr.split('/').filter(Boolean);
        const last = segments[segments.length - 1] || pathStr;
        formatLabel = last
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
      }
    }

    const hasMeta = eventTime || formatLabel || eventLocation;
    if (hasMeta) {
      const meta = document.createElement('div');
      meta.className = 'search-result-meta';
      if (eventTime) {
        meta.append(createMetaRow('time', formatEventDateTimeDisplay(eventTime)));
      }
      if (formatLabel) {
        meta.append(createMetaRow('format', formatLabel));
      }
      if (eventLocation) {
        meta.append(createMetaRow('location', eventLocation));
      }
      content.append(meta);
    }
  }

  const icon = document.createElement('span');
  icon.className = 'search-result-arrow';
  icon.setAttribute('aria-hidden', 'true');

  link.append(content, icon);
  li.append(link);
  return li;
}

export default function createSearchResultsList({
  docs,
  showEventMeta,
  showExpertImage,
  formatTaxonomyValue,
} = {}) {
  const list = document.createElement('ul');
  list.className = 'search-results';

  if (!docs.length) {
    list.classList.add('no-results');
    const item = document.createElement('li');
    item.textContent = 'No results found. Try updating your filters or query.';
    list.append(item);
    return list;
  }

  const cardOpts = { showEventMeta, showExpertImage, formatTaxonomyValue };
  docs.forEach((doc) => list.append(createCard(doc, cardOpts)));
  return list;
}
