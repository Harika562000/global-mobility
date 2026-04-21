import createSearchResultsApp from './components/search-results-app.js';
import { readBlockConfig } from '../../scripts/aem.js';
import { fetchPlaceholders } from '../../scripts/placeholders.js';

/**
 * `readBlockConfig()` uses `toClassName(first-column label)` as keys, not model `name`.
 * UE rows like "Tab 1 — which tab" become `tab-1-which-tab`. Map those onto `tabKey1` /
 * `tabLabel1` so tab overrides apply. Also alias `tab-display-labels` → `tab-label-values`.
 * @param {Record<string, unknown>} config
 */
function normalizeSearchResultsTabConfig(config) {
  if (!config || typeof config !== 'object') return;
  const tabLabelRows = [];
  Object.keys(config).forEach((key) => {
    const which = /^tab-(\d+)-which-tab$/.exec(key);
    if (which) {
      const canon = `tabKey${which[1]}`;
      if (config[canon] === undefined) config[canon] = config[key];
    }
    const labelRow = /^tab-(\d+)-display-label$/.exec(key);
    if (labelRow) {
      const canon = `tabLabel${labelRow[1]}`;
      if (config[canon] === undefined) config[canon] = config[key];
    }
    const tabLabelMatch = /^tab-labels-(\d+)$/.exec(key);
    if (tabLabelMatch) {
      tabLabelRows.push({
        order: Number(tabLabelMatch[1]),
        value: config[key],
      });
    }
  });
  if (config['tab-labels'] === undefined && tabLabelRows.length) {
    const sorted = tabLabelRows
      .sort((a, b) => a.order - b.order)
      .map((item) => item.value)
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    if (sorted.length) config['tab-labels'] = sorted;
  }
  if (config['tab-display-labels'] !== undefined && config['tab-label-values'] === undefined) {
    config['tab-label-values'] = config['tab-display-labels'];
  }
}

function parseBoolean(value) {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

function readSingleValueFallback(block) {
  const rows = block.querySelectorAll(':scope > div');
  if (rows.length !== 1) return undefined;
  const cols = rows[0].children ? [...rows[0].children] : [];
  if (cols.length !== 1) return undefined;
  return cols[0].textContent?.trim();
}

function readSingleColumnRows(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return [];
  return rows
    .map((row) => {
      const cols = row.children ? [...row.children] : [];
      if (cols.length !== 1) return null;
      return cols[0].textContent?.trim() ?? '';
    })
    .filter((v) => v !== null);
}

function buildTabLabelsFromPlaceholders(placeholders) {
  const keys = ['all', 'products', 'insights', 'events'];
  return keys
    .map((key) => {
      const label = placeholders?.[key];
      if (!label || !String(label).trim()) return '';
      return `${key}=${String(label).trim()}`;
    })
    .filter(Boolean);
}

export default async function decorate(block) {
  const config = readBlockConfig(block);
  const placeholders = await fetchPlaceholders();
  config.placeholders = placeholders;
  normalizeSearchResultsTabConfig(config);
  const hasTabLabels = config['tab-labels'] !== undefined
    || config.tabLabels !== undefined
    || config.tablabels !== undefined;
  const hasShowSort = config['show-sort'] !== undefined || config.showSort !== undefined;
  const hasFacetLabels = config['facet-labels'] !== undefined || config.facetLabels !== undefined;

  if (!hasTabLabels) {
    const labelLines = buildTabLabelsFromPlaceholders(placeholders);
    if (labelLines.length) {
      config['tab-labels'] = labelLines;
    }
  }

  // Some authored variants render as single-column rows (no key/value columns).
  // In that case we can’t rely on row labels, so use heuristics to recover values.
  if (!hasShowSort || !hasFacetLabels) {
    const singleColValues = readSingleColumnRows(block);
    if (singleColValues.length) {
      if (!hasShowSort) {
        const boolRow = singleColValues.find((v) => parseBoolean(v) !== undefined);
        const parsed = parseBoolean(boolRow);
        if (parsed !== undefined) config.showSort = parsed;
      }
      if (!hasFacetLabels && singleColValues.length >= 2) {
        const facetRow = singleColValues.find((v) => /[^\s][^=:\n]*\s*(=|:)\s*[^\s]/.test(String(v)));
        if (facetRow) config['facet-labels'] = facetRow;
      }
    } else if (!hasShowSort) {
      // Legacy: exactly one single-cell row with only `true/false`
      const rawSingleValue = readSingleValueFallback(block);
      const parsed = parseBoolean(rawSingleValue);
      if (parsed !== undefined) config.showSort = parsed;
    }
  }
  block.innerHTML = '';
  block.append(createSearchResultsApp({ config }));
}
