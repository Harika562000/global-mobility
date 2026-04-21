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
    // Desktop: custom combobox (no native <select>) styled like the
    // pagination "items per page" dropdown (Figma match).
    const wrap = document.createElement('div');
    wrap.className = 'search-results-sort-combobox';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'search-results-sort-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', 'Sort results');

    const valueSpan = document.createElement('span');
    valueSpan.className = 'search-results-sort-value';

    const selected = options.find((o) => o.value === sortBy) || options[0];
    valueSpan.textContent = selected?.label || String(sortBy || '');

    const chevron = document.createElement('span');
    chevron.className = 'search-results-sort-chevron';
    chevron.setAttribute('aria-hidden', 'true');

    trigger.append(valueSpan, chevron);

    const list = document.createElement('ul');
    list.className = 'search-results-sort-menu';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Sort results');
    list.hidden = true;

    const optionButtons = [];
    options.forEach((option) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'presentation');

      const optBtn = document.createElement('button');
      optBtn.type = 'button';
      optBtn.className = 'search-results-sort-option';
      optBtn.setAttribute('role', 'option');
      optBtn.dataset.value = String(option.value);
      optBtn.textContent = String(option.label);
      optBtn.setAttribute('aria-selected', String(option.value === sortBy));

      li.append(optBtn);
      list.append(li);
      optionButtons.push(optBtn);
    });

    wrap.append(trigger, list);
    wrapper.append(wrap);

    let menuOpen = false;
    let onDocClick = () => {};
    let onDocKeyDown = () => {};

    const closeMenu = () => {
      menuOpen = false;
      wrap.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      list.hidden = true;
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onDocKeyDown, true);
    };

    const openMenu = () => {
      menuOpen = true;
      wrap.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      list.hidden = false;

      document.addEventListener('click', onDocClick);
      document.addEventListener('keydown', onDocKeyDown, true);

      const selectedOpt = optionButtons.find(
        (b) => b.getAttribute('aria-selected') === 'true',
      ) || optionButtons[0];
      selectedOpt?.focus();
    };

    onDocClick = (e) => {
      if (!wrap.contains(e.target)) closeMenu();
    };

    onDocKeyDown = (e) => {
      if (e.key === 'Escape' && menuOpen) {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        trigger.focus();
      }
    };

    const onSelectValue = (value) => {
      const next = options.find((o) => String(o.value) === String(value));
      const nextLabel = next?.label || String(value);
      valueSpan.textContent = nextLabel;

      optionButtons.forEach((btn) => {
        btn.setAttribute(
          'aria-selected',
          String(btn.dataset.value) === String(value) ? 'true' : 'false',
        );
      });

      onChange(String(value));
      closeMenu();
      trigger.focus();
    };

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menuOpen) closeMenu();
      else openMenu();
    });

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!menuOpen) openMenu();
      }
    });

    list.addEventListener('keydown', (e) => {
      const active = document.activeElement;
      const idx = optionButtons.indexOf(active);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = idx < 0 ? 0 : Math.min(idx + 1, optionButtons.length - 1);
        optionButtons[next]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = idx < 0 ? optionButtons.length - 1 : Math.max(idx - 1, 0);
        optionButtons[prev]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        optionButtons[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        optionButtons[optionButtons.length - 1]?.focus();
      }
    });

    optionButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectValue(btn.dataset.value);
      });
    });
  }

  return wrapper;
}
