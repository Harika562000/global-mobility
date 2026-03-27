/**
 * Displays active filters as removable chips above search results.
 * Each chip can be removed individually; "Remove all" clears all.
 */
export default function createSearchActiveFilters({
  selectedFilters,
  order,
  onRemove,
  onRemoveAll,
}) {
  const hasAny = Object.values(selectedFilters || {}).some((v) => (
    Array.isArray(v) ? v.length : Boolean(v)
  ));
  if (!hasAny) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'search-results-active-filters';

  const chips = document.createElement('div');
  chips.className = 'search-results-active-filters-chips';

  const seen = new Set();
  const orderedChips = (Array.isArray(order) && order.length)
    ? order
    : Object.entries(selectedFilters || {}).flatMap(([field, values]) => {
      let arr = [];
      if (Array.isArray(values)) arr = values;
      else if (values) arr = [values];
      return arr.map((value) => ({ field, value }));
    });

  orderedChips.forEach(({ field, value }) => {
    if (!field || !value) return;
    const key = `${field}::${value}`;
    if (seen.has(key)) return;
    const current = selectedFilters?.[field];
    if (Array.isArray(current) && !current.includes(value)) return;
    if (!Array.isArray(current) && String(current || '') !== String(value)) return;
    seen.add(key);
    const chip = document.createElement('span');
    chip.className = 'search-results-active-filters-chip';
    const label = document.createElement('span');
    label.className = 'search-results-active-filters-chip-label';
    label.textContent = value;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'search-results-active-filters-chip-remove';
    removeBtn.setAttribute('aria-label', `Remove ${value} filter`);
    removeBtn.innerHTML = '\u2715';
    removeBtn.addEventListener('click', () => onRemove(field, value));
    chip.append(label, removeBtn);
    chips.append(chip);
  });

  const removeAll = document.createElement('button');
  removeAll.type = 'button';
  removeAll.className = 'search-results-active-filters-remove-all';
  removeAll.textContent = 'Remove all';
  removeAll.addEventListener('click', onRemoveAll);

  wrapper.append(chips, removeAll);
  return wrapper;
}
