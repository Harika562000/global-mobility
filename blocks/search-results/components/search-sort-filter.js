import createSearchFilters from './search-filters.js';
import createSearchSort from './search-sort.js';

/**
 * Mobile-only "Filter & Sort" control.
 * Combined button that toggles a sheet with filter groups + sort dropdown.
 * Shown below 1025px; Sort dropdown is shown in toolbar on desktop.
 */
export default function createSearchSortFilter({
  facetFields,
  selectedFilters,
  sortBy,
  sortOptions,
  showSort = true,
  facetOrder,
  onFilterChange,
  onFilterClear,
  onSortChange,
  isOpen: initialIsOpen = false,
  onOpenChange,
}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'search-results-sort-filter';
  if (initialIsOpen) {
    wrapper.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  const hasFilters = Object.values(selectedFilters)
    .some((v) => (Array.isArray(v) ? v.length : Boolean(v)));
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'search-results-sort-filter-toggle';
  if (hasFilters) toggle.classList.add('has-filter');
  toggle.setAttribute('aria-expanded', String(initialIsOpen));
  toggle.setAttribute('aria-controls', 'search-results-sort-filter-panel');
  toggle.setAttribute('aria-haspopup', 'dialog');

  const iconWrap = document.createElement('span');
  iconWrap.className = 'search-results-sort-filter-toggle-icon-wrap';

  const icon = document.createElement('span');
  icon.className = 'search-results-sort-filter-toggle-icon';

  const dot = document.createElement('span');
  dot.className = 'search-results-sort-filter-toggle-dot';
  dot.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'search-results-sort-filter-toggle-text';
  text.textContent = showSort ? 'Filter & Sort' : 'Filter';

  iconWrap.append(icon, dot);
  toggle.append(iconWrap, text);

  const panel = document.createElement('div');
  panel.className = 'search-results-sort-filter-panel';
  panel.id = 'search-results-sort-filter-panel';

  const overlay = document.createElement('div');
  overlay.className = 'search-results-sort-filter-overlay';
  overlay.setAttribute('aria-hidden', String(!initialIsOpen));

  const closePanel = () => {
    wrapper.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    onOpenChange?.(false);
  };

  const openPanel = () => {
    wrapper.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    onOpenChange?.(true);
  };

  toggle.addEventListener('click', () => {
    const isOpen = wrapper.classList.contains('is-open');
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  });

  overlay.addEventListener('click', closePanel);

  const sortWrapper = document.createElement('div');
  sortWrapper.className = 'search-results-sort-filter-sort';
  sortWrapper.append(
    createSearchSort({
      sortBy,
      variant: 'mobile',
      options: sortOptions,
      onChange: (value) => {
        onSortChange(value);
        closePanel();
      },
    }),
  );

  const filtersInstance = createSearchFilters({
    facetFields,
    selectedFilters,
    facetOrder,
    onChange: (field, value, checked) => {
      onFilterChange(field, value, checked);
    },
    onClear: () => {
      onFilterClear();
    },
    onApply: closePanel,
    embedded: true,
  });

  const filtersContainer = document.createElement('div');
  filtersContainer.className = 'search-results-sort-filter-filters';
  filtersContainer.append(filtersInstance);

  const header = document.createElement('div');
  header.className = 'search-results-sort-filter-header';
  const title = document.createElement('h3');
  title.className = 'search-results-sort-filter-title';
  title.textContent = showSort ? 'Filter & Sort' : 'Filter';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'search-results-sort-filter-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '\u2715';
  closeBtn.addEventListener('click', closePanel);
  header.append(title, closeBtn);

  if (showSort) {
    panel.append(header, sortWrapper, filtersContainer);
  } else {
    panel.append(header, filtersContainer);
  }
  wrapper.append(toggle, overlay, panel);

  return wrapper;
}
