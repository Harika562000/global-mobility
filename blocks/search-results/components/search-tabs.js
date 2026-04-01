function createButton(tab, activeTab, onChange) {
  const label = typeof tab === 'string' ? tab : tab.label;
  const count = typeof tab === 'string' ? null : tab.count;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'search-results-tab';
  if (label === activeTab) btn.classList.add('is-active');
  btn.setAttribute('aria-pressed', String(label === activeTab));

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

  btn.addEventListener('click', () => onChange(label));
  return btn;
}

export default function createSearchTabs({ tabs, activeTab, onChange }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'search-results-tabs';
  tabs.forEach((tab) => wrapper.append(createButton(tab, activeTab, onChange)));
  return wrapper;
}
