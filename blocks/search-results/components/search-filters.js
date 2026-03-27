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
  let selectedArr = [];
  if (Array.isArray(selected)) selectedArr = selected;
  else if (selected) selectedArr = [selected];
  input.checked = selectedArr.includes(option.value);
  input.addEventListener('change', () => {
    onChange(field, option.value, input.checked);
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
  if ((Array.isArray(selected) && selected.length) || (!Array.isArray(selected) && selected)) {
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
  facetOrder,
}) {
  const container = document.createElement('aside');
  container.className = `search-results-sidebar${embedded ? ' search-results-sidebar-embedded' : ''}`;
  if (!embedded && isOpen) container.classList.add('is-open');

  if (!embedded) {
    const hasFilters = Object.values(selectedFilters).some((v) => (
      Array.isArray(v) ? v.length : Boolean(v)
    ));
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

  // Facet keys are integration-specific (e.g. the API might return
  // `attribute_services_advisory_ss` rather than `category`).
  // Prefer a configured order if provided; otherwise render a reasonable subset.
  const available = Object.keys(facetFields || {})
    .filter((field) => facetFields?.[field]?.length);
  let ordered = [];
  if (Array.isArray(facetOrder) && facetOrder.length) {
    ordered = facetOrder.filter((f) => available.includes(f));
  } else {
    ordered = available
      .filter((field) => !field.toLowerCase().includes('title'))
      .slice(0, 6);
  }
  const fields = ordered;
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
