import createSearchResultsApp from './components/search-results-app.js';
import { readBlockConfig } from '../../scripts/aem.js';

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

export default function decorate(block) {
  const config = readBlockConfig(block);
  const hasShowSort = config['show-sort'] !== undefined || config.showSort !== undefined;
  const hasFacetLabels = config['facet-labels'] !== undefined || config.facetLabels !== undefined;

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
