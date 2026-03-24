/**
 * Displays active filters as removable chips above search results.
 * Each chip can be removed individually; "Remove all" clears all.
 */
export default function createSearchActiveFilters({ selectedFilters, onRemove, onRemoveAll }) {
  const entries = Object.entries(selectedFilters).filter(([, value]) => value);
  if (entries.length === 0) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'search-results-active-filters';

  const chips = document.createElement('div');
  chips.className = 'search-results-active-filters-chips';

  entries.forEach(([field, value]) => {
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
    removeBtn.addEventListener('click', () => onRemove(field, ''));
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
