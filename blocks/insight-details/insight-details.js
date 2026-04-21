import { getMetadata } from '../../scripts/aem.js';
import { fetchPageMetadata } from '../../scripts/s-and-p-global/utils.js';
import { loadTaxonomyData, resolveFacetValueDisplay } from '../../scripts/taxonomy-metadata.js';

function getValueCell(row) {
  if (!row) return null;
  return row.children.length > 1 ? row.children[1] : row.children[0] || row;
}

function normalizeKey(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function readCellValue(cell) {
  if (!cell) return '';
  const link = cell.querySelector('a[href]');
  if (link) return link.getAttribute('href') || link.href || '';
  return (cell.textContent || '').trim();
}

function collectConfigRows(container, values, cells, prefix = '') {
  [...container.children].forEach((row) => {
    if (row.tagName !== 'DIV') return;
    if (row.children.length < 2) {
      collectConfigRows(row, values, cells, prefix);
      return;
    }

    const label = normalizeKey(row.children[0].textContent || '');
    if (!label) return;

    const key = prefix ? `${prefix}_${label}` : label;
    const valueCell = getValueCell(row);
    values[key] = readCellValue(valueCell);
    cells[key] = valueCell;

    collectConfigRows(valueCell, values, cells, key);
  });
}

function applyFlatRowFallback(block, values, cells) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const hasLabeledRows = rows.some((row) => (row.children.length || 0) > 1);
  if (hasLabeledRows) return;

  const fallbackMap = [
    'authorvariation',
    'authorprofilelink',
    'authorname',
    'authorlink',
    'authorimage',
    'showtimetoread',
    'showtags',
    'showinsightsthoughtleadercontenttype',
    'showtopic',
    'showtheme',
    'showseries',
    'showregionmarket',
    'showeventformat',
  ];

  fallbackMap.forEach((key, index) => {
    const row = rows[index];
    if (!row || values[key]) return;
    const cell = getValueCell(row) || row;
    values[key] = readCellValue(cell);
    cells[key] = cell;
  });
}

function getConfigValue(config, keys) {
  return keys.map((key) => config[key]).find((v) => typeof v === 'string' && v.trim()) || '';
}

function isYes(value, defaultValue = 'yes') {
  const normalized = String(value || defaultValue).trim().toLowerCase();
  return normalized === 'yes' || normalized === 'true';
}

function toAbsoluteUrl(rawUrl) {
  if (!rawUrl) return '';
  try {
    return new URL(rawUrl, window.location.origin).toString();
  } catch {
    return '';
  }
}

function normalizeImageSrc(value) {
  const absolute = toAbsoluteUrl(value);
  if (!absolute) return '';

  try {
    const url = new URL(absolute, window.location.origin);
    const query = url.searchParams.toString();
    const withoutOrigin = `${url.pathname}${query ? `?${query}` : ''}${url.hash || ''}`;
    if (withoutOrigin.startsWith('./') || withoutOrigin.startsWith('../')) return withoutOrigin;
    if (withoutOrigin.startsWith('/')) return `.${withoutOrigin}`;
    return `./${withoutOrigin}`;
  } catch {
    return value;
  }
}

function stripTitleSuffix(value = '') {
  return String(value).replace(/\s*\|\s*mobility global\s*$/i, '').trim();
}

function getMetaContent(doc, key) {
  if (!doc?.head || !key) return '';
  const attr = key.includes(':') ? 'property' : 'name';
  const el = doc.head.querySelector(`meta[${attr}="${key}"]`);
  return (el?.getAttribute('content') || '').trim();
}

async function fetchAuthorProfileMetadata(rawUrl) {
  const absoluteUrl = toAbsoluteUrl(rawUrl);
  if (!absoluteUrl) return null;

  try {
    const response = await fetch(absoluteUrl, { credentials: 'same-origin' });
    if (!response.ok) return null;
    const html = await response.text();
    if (!html.trim()) return null;

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const ogTitle = stripTitleSuffix(getMetaContent(doc, 'og:title'));
    const ogImage = getMetaContent(doc, 'og:image');

    if (!ogTitle && !ogImage) return null;

    return {
      title: ogTitle,
      image: ogImage,
      link: absoluteUrl,
    };
  } catch {
    return null;
  }
}

function splitMetaList(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];

  // Taxonomy meta values are usually comma-separated full cq:tag ids.
  // Split only at boundaries where a new namespaced tag starts, so
  // accidental commas inside a single value don't create fake entries.
  if (/mobility-global:/i.test(raw)) {
    return raw
      .split(/,\s*(?=mobility-global:)/gi)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return raw
    .split(/[\n\r,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanTagValue(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return '';
  const withoutNamespace = value.includes(':') ? value.split(':').slice(1).join(':') : value;
  const leaf = withoutNamespace.split('/').pop() || withoutNamespace;
  return leaf
    .replace(/,+/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getFirstMetadataValue(keys) {
  return keys.map((key) => getMetadata(key)).find((value) => String(value || '').trim()) || '';
}

function getFirstHeadMetaValue(keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const attr = key.includes(':') ? 'property' : 'name';
    const meta = document.head.querySelector(`meta[${attr}="${key}"]`);
    const value = (meta?.getAttribute('content') || '').trim();
    if (value) return value;
  }
  return '';
}

function getTimeToRead() {
  return getFirstMetadataValue(['timetoread', 'time-to-read', 'time to read']);
}

function toDisplayLabel(label) {
  return String(label || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function getTagCandidates(config) {
  const taxonomy = await loadTaxonomyData();
  const groups = [
    {
      enabled: isYes(getConfigValue(config, ['showinsightsthoughtleadercontenttype'])),
      fields: [
        {
          label: 'insightsThoughtLeaderContentType',
          metadataKeys: [
            'insightsandthoughtleadercontenttype',
            'insights-thought-leader-content-type',
            'insightsthoughtleadercontenttype',
          ],
        },
      ],
    },
    {
      enabled: isYes(getConfigValue(config, ['showtopic'])),
      fields: [{ label: 'topic', metadataKeys: ['topic'] }],
    },
    {
      enabled: isYes(getConfigValue(config, ['showtheme'])),
      fields: [{ label: 'theme', metadataKeys: ['theme'] }],
    },
    {
      enabled: isYes(getConfigValue(config, ['showseries'])),
      fields: [{ label: 'series', metadataKeys: ['series'] }],
    },
    {
      enabled: isYes(getConfigValue(config, ['showregionmarket'])),
      fields: [
        { label: 'marketSalesRegion', metadataKeys: ['marketsalesregion'] },
        { label: 'marketCountry', metadataKeys: ['marketcountry'] },
        { label: 'marketRegion', metadataKeys: ['marketregion', 'regionmarket', 'region-market'] },
      ],
    },
    {
      enabled: isYes(getConfigValue(config, ['showeventformat'])),
      fields: [{ label: 'eventFormat', metadataKeys: ['eventformat', 'event-format'] }],
    },
  ];

  return groups
    .filter((group) => group.enabled)
    .flatMap((group) => group.fields)
    .map((field) => {
      const raw = getFirstHeadMetaValue(field.metadataKeys)
        || getFirstMetadataValue(field.metadataKeys);
      const values = [...new Set(
        splitMetaList(raw)
          .map((part) => {
            const display = taxonomy ? resolveFacetValueDisplay(part, taxonomy) : part;
            return cleanTagValue(display || part);
          })
          .filter(Boolean),
      )];
      if (!values.length) return null;
      return {
        label: field.label,
        values,
        valueText: values.join(', '),
      };
    })
    .filter(Boolean);
}

function renderAuthorSection({ imageSrc, name, link }) {
  if (!name) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'insight-details-author';

  if (imageSrc) {
    const avatar = document.createElement('img');
    avatar.className = 'insight-details-author-image';
    avatar.src = imageSrc;
    avatar.alt = name;
    avatar.loading = 'lazy';
    wrapper.append(avatar);
  }

  const textWrap = document.createElement('span');
  textWrap.className = 'insight-details-author-text';

  const byText = document.createElement('span');
  byText.className = 'insight-details-author-by';
  byText.textContent = 'By';
  textWrap.append(byText);

  const nameEl = link ? document.createElement('a') : document.createElement('span');
  nameEl.className = 'insight-details-author-name';
  nameEl.textContent = name;

  if (link) {
    nameEl.href = link;
  }

  textWrap.append(nameEl);
  wrapper.append(textWrap);
  return wrapper;
}

function renderTags(tags) {
  if (!tags.length) return null;
  const list = document.createElement('div');
  list.className = 'insight-details-tags';

  tags.forEach((tag) => {
    const tagEl = document.createElement('div');
    tagEl.className = 'insight-details-tag';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'insight-details-tag-label';
    labelSpan.textContent = `${toDisplayLabel(tag.label)}: `;

    const valueEl = document.createElement('span');
    valueEl.className = 'insight-details-tag-value';
    valueEl.textContent = tag.valueText;

    tagEl.append(labelSpan, valueEl);
    list.append(tagEl);
  });

  return list;
}

export default async function decorate(block) {
  const config = {};
  const configCells = {};
  collectConfigRows(block, config, configCells);
  applyFlatRowFallback(block, config, configCells);

  const authorVariation = getConfigValue(config, ['authorvariation']) || 'page-url';
  const isPageUrlAuthor = authorVariation === 'page-url';

  let authorName = '';
  let authorLink = '';
  let authorImage = '';

  if (isPageUrlAuthor) {
    const authorProfileLink = getConfigValue(config, ['authorprofilelink']);
    if (authorProfileLink) {
      const profileMetadata = await fetchAuthorProfileMetadata(authorProfileLink);
      const metadata = profileMetadata || (await fetchPageMetadata(authorProfileLink));
      if (metadata) {
        authorName = stripTitleSuffix(metadata.title);
        authorLink = metadata.link || toAbsoluteUrl(authorProfileLink);
        authorImage = normalizeImageSrc(metadata.image);
      }
    }
  } else {
    authorName = getConfigValue(config, ['authorname']);
    authorLink = getConfigValue(config, ['authorlink']);
    const imageCell = configCells.authorimage;
    const imageInCell = imageCell?.querySelector('img');
    authorImage = imageInCell?.getAttribute('src') || imageInCell?.src || '';
  }

  const showTimeToRead = isYes(getConfigValue(config, ['showtimetoread']));
  const showTags = isYes(getConfigValue(config, ['showtags']));
  const timeToRead = showTimeToRead ? getTimeToRead() : '';
  const tags = showTags ? [...new Set(await getTagCandidates(config))] : [];

  const root = document.createElement('div');
  root.className = 'insight-details-meta';

  const authorSection = renderAuthorSection({
    imageSrc: authorImage,
    name: authorName,
    link: authorLink,
  });
  const header = document.createElement('div');
  header.className = 'insight-details-header';
  if (authorSection) header.append(authorSection);

  if (timeToRead) {
    const time = document.createElement('span');
    time.className = 'insight-details-time';
    time.textContent = timeToRead.toLowerCase().includes('min') ? timeToRead : `${timeToRead} min`;
    header.append(time);
  }

  if (header.children.length) {
    root.append(header);
  }

  const tagsEl = renderTags(tags);
  if (tagsEl) root.append(tagsEl);

  block.replaceChildren(root);
}
