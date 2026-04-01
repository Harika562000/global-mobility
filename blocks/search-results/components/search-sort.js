const DEFAULT_SORT_OPTIONS = [
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'date-desc', label: 'Most Recent' },
];

export default function createSearchSort({
  sortBy,
  onChange,
  variant = 'desktop',
  options = DEFAULT_SORT_OPTIONS,
}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'search-results-sort';

  if (variant === 'mobile') {
    wrapper.classList.add('search-results-sort-radio');
    const title = document.createElement('h4');
    title.className = 'search-results-sort-title';
    title.textContent = 'Sorting';
    wrapper.append(title);
    const list = document.createElement('div');
    list.className = 'search-results-sort-radio-list';
    list.setAttribute('role', 'radiogroup');
    list.setAttribute('aria-label', 'Sort results');
    options.forEach((option) => {
      const label = document.createElement('label');
      label.className = 'search-results-sort-radio-item';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'search-sort';
      input.value = option.value;
      input.checked = option.value === sortBy;
      input.addEventListener('change', () => onChange(option.value));
      const text = document.createElement('span');
      text.className = 'search-results-sort-radio-label';
      text.textContent = option.label;
      label.append(input, text);
      list.append(label);
    });
    wrapper.append(list);
  } else {
    const select = document.createElement('select');
    select.className = 'search-results-sort-select';
    select.setAttribute('aria-label', 'Sort results');
    options.forEach((option) => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      if (option.value === sortBy) opt.selected = true;
      select.append(opt);
    });
    select.addEventListener('change', (e) => onChange(e.target.value));
    wrapper.append(select);
  }

  return wrapper;
}
