function toTitleCase(value) {
  return String(value)
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function createFilterItem(field, selected, option, onChange) {
  const label = document.createElement('label');
  label.className = 'search-results-filter-item';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = selected === option.value;
  input.addEventListener('change', () => {
    onChange(field, input.checked ? option.value : '');
  });

  const text = document.createElement('span');
  text.className = 'search-results-filter-item-label';
  text.textContent = option.value;

  label.append(input, text);
  return label;
}

function createFilterGroup(field, selected, options, onChange) {
  const details = document.createElement('details');
  details.className = 'search-results-filter-group';
  details.open = true;

  const summary = document.createElement('summary');
  summary.className = 'search-results-filter-group-summary';
  const dot = document.createElement('span');
  dot.className = 'search-results-filter-group-dot';
  dot.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.className = 'search-results-filter-group-label';
  text.textContent = toTitleCase(field);
  summary.append(text, dot);
  if (selected) {
    details.classList.add('has-filter');
  }
  details.append(summary);

  const list = document.createElement('div');
  list.className = 'search-results-filter-items';
  options.slice(0, 6).forEach((opt) => {
    list.append(createFilterItem(field, selected, opt, onChange));
  });
  details.append(list);

  return details;
}

export default function createSearchFilters({
  facetFields,
  selectedFilters,
  onChange,
  onClear,
  onApply,
  embedded = false,
  isOpen = false,
  onOpenChange,
}) {
  const container = document.createElement('aside');
  container.className = `search-results-sidebar${embedded ? ' search-results-sidebar-embedded' : ''}`;
  if (!embedded && isOpen) container.classList.add('is-open');

  if (!embedded) {
    const hasFilters = Object.values(selectedFilters).some(Boolean);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'search-results-filter-toggle';
    if (hasFilters) toggle.classList.add('has-filter');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-controls', 'search-results-filters-panel');

    const left = document.createElement('span');
    left.className = 'search-results-filter-toggle-left';

    const icon = document.createElement('span');
    icon.className = 'search-results-filter-toggle-icon';

    const dot = document.createElement('span');
    dot.className = 'search-results-filter-toggle-dot';
    dot.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.className = 'search-results-filter-toggle-text';
    text.textContent = 'Filter';

    const caret = document.createElement('span');
    caret.className = 'search-results-filter-toggle-caret';

    left.append(icon, dot, text, caret);
    toggle.append(left);
    toggle.addEventListener('click', () => {
      container.classList.toggle('is-open');
      const open = container.classList.contains('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      onOpenChange?.(open);
    });
    container.append(toggle);
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'search-results-filters';
  wrapper.id = embedded ? undefined : 'search-results-filters-panel';

  const fields = ['category', 'brand', 'type', 'status'];
  fields.forEach((field) => {
    if (!facetFields[field]?.length) return;
    wrapper.append(createFilterGroup(field, selectedFilters[field], facetFields[field], onChange));
  });

  const actions = document.createElement('div');
  actions.className = 'search-results-filters-actions button-container';

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'button primary';
  applyBtn.textContent = 'Apply All';
  applyBtn.addEventListener('click', () => onApply?.());

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'button secondary';
  clearBtn.textContent = 'Clear All';
  clearBtn.addEventListener('click', onClear);

  actions.append(applyBtn, clearBtn);
  wrapper.append(actions);

  container.append(wrapper);
  return container;
}
