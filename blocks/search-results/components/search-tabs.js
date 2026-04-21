function createButton(tab, activeTabKey, onChange) {
  const label = typeof tab === 'string' ? tab : tab.label;
  const key = typeof tab === 'string' ? tab : tab.key;
  const count = typeof tab === 'string' ? null : tab.count;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'search-results-tab';
  const isActive = key === activeTabKey;
  if (isActive) btn.classList.add('is-active');
  btn.setAttribute('aria-pressed', String(isActive));

  const text = document.createElement('span');
  text.className = 'search-results-tab-text';
  text.textContent = label;
  btn.append(text);

  if (typeof count === 'number') {
    const counter = document.createElement('span');
    counter.className = 'search-results-tab-count';
    counter.textContent = String(count);
    btn.append(counter);
  }

  btn.addEventListener('click', () => onChange(key));
  return btn;
}

/**
 * @param {Object} opts
 * @param {Array<{ key: string, label: string, count?: number }|string>} opts.tabs
 * @param {string} [opts.activeTabKey] - Selected tab key (matches `search-results-app` state)
 * @param {string} [opts.activeTab] - Legacy alias for `activeTabKey`
 */
export default function createSearchTabs({
  tabs,
  activeTabKey,
  activeTab,
  onChange,
}) {
  const resolvedActiveKey = activeTabKey ?? activeTab;
  const wrapper = document.createElement('div');
  wrapper.className = 'search-results-tabs';
  tabs.forEach((tab) => wrapper.append(createButton(tab, resolvedActiveKey, onChange)));
  return wrapper;
}
