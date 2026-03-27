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

export default function decorate(block) {
  const config = readBlockConfig(block);
  // In some authored variants, search-results renders as a single-cell row
  // with only `true`/`false` content and no key column.
  if (config['show-sort'] === undefined && config.showSort === undefined) {
    const rawSingleValue = readSingleValueFallback(block);
    const parsed = parseBoolean(rawSingleValue);
    if (parsed !== undefined) {
      config.showSort = parsed;
    }
  }
  block.innerHTML = '';
  block.append(createSearchResultsApp({ config }));
}
