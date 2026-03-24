import { decorateIcons } from '../../scripts/aem.js';
import { fetchPlaceholders } from '../../scripts/placeholders.js';
import { DESKTOP_BP } from '../../scripts/s-and-p-global/constants.js';
import LucidworksClient from '../../scripts/s-and-p-global/lucidworks-client.js';
import { events } from '../../scripts/s-and-p-global/events.js';

const searchParams = new URLSearchParams(window.location.search);
const TYPEAHEAD_MIN_CHARS = 3;
const TYPEAHEAD_MAX_ITEMS = 5;
const TYPEAHEAD_DEBOUNCE_MS = 200;
const PLACEHOLDER_NARROW = 'Search';
const PLACEHOLDER_WIDE = 'Search all products, services and insights';

const lucidworksClient = new LucidworksClient();
const SEARCH_EVENT_SCOPE = 'search';

/* Default path for the search page */
const DEFAULT_SEARCH_PAGE_PATH = '/search';

// Search page URL with optional ?q= for submit navigation.
function getSearchPageUrl(searchPagePath, query) {
  const url = new URL(searchPagePath || DEFAULT_SEARCH_PAGE_PATH, window.location.origin);
  if (query != null && String(query).trim()) url.searchParams.set('q', String(query).trim());
  return url.toString();
}

// Update search input value and trigger init-search (no redirect).
function runSearch(block, query) {
  const q = query != null ? String(query).trim() : '';
  const input = block?.querySelector('.search-input');
  if (input) input.value = q;
  events.emit('init-search', { query: q }, { scope: SEARCH_EVENT_SCOPE });
}

// Fetches typeahead suggestions via Lucidworks (mock until integration). Sorted by prefix match.
async function getTypeaheadSuggestions({ prefix = '', limit = 5 } = {}) {
  const query = prefix.trim();
  const list = await lucidworksClient.initTypeahead({ query });
  const normalizedPrefix = query.toLowerCase();
  const max = Math.max(0, Math.floor(Number(limit)) || 5);
  if (!normalizedPrefix) return list.slice(0, max);
  const lower = (s) => String(s).toLowerCase();
  const startsWith = (s) => lower(s).startsWith(normalizedPrefix);
  const sorted = [
    ...list.content.filter(startsWith),
    ...list.content.filter((s) => !startsWith(s)),
  ];
  return sorted.slice(0, max);
}

// Returns the typeahead dropdown element.
function getTypeaheadDropdown(block) {
  return block.querySelector('.search-typeahead');
}

// Hides typeahead dropdown and clears its list.
function hideTypeahead(block) {
  const dropdown = getTypeaheadDropdown(block);
  if (dropdown) {
    dropdown.classList.remove('is-open');
    const list = dropdown.querySelector('.search-typeahead-list');
    if (list) list.innerHTML = '';
  }
}

// Fills typeahead with suggestion links - navigates to search page on click
function showTypeaheadSuggestions(block, suggestions, prefix, config) {
  const dropdown = getTypeaheadDropdown(block);
  if (!dropdown) return;

  const list = dropdown.querySelector('.search-typeahead-list');
  list.innerHTML = '';

  const normalizedPrefix = (prefix || '').toLowerCase();
  const prefixLen = normalizedPrefix.length;

  suggestions.forEach((text) => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = getSearchPageUrl(config.searchPagePath, text);
    link.className = 'search-typeahead-item';
    if (prefixLen > 0) {
      const idx = text.toLowerCase().indexOf(normalizedPrefix);
      if (idx >= 0) {
        if (idx > 0) link.append(document.createTextNode(text.slice(0, idx)));
        const strong = document.createElement('strong');
        strong.textContent = text.slice(idx, idx + prefixLen);
        link.append(strong);
        if (idx + prefixLen < text.length) {
          link.append(document.createTextNode(text.slice(idx + prefixLen)));
        }
      } else {
        link.textContent = text;
      }
    } else {
      link.textContent = text;
    }
    link.addEventListener('click', (e) => {
      e.preventDefault();
      hideTypeahead(block);
      runSearch(block, text);
    });
    li.append(link);
    list.append(li);
  });

  dropdown.classList.add('is-open');
}

// Wraps fn so it runs after ms of no calls.
function debounce(fn, ms) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

// 3+ chars: fetch suggestions via Lucidworks, show dropdown.
async function handleTypeaheadInput(value, block, config) {
  if (value.length < TYPEAHEAD_MIN_CHARS) {
    hideTypeahead(block);
    return;
  }

  const suggestions = await getTypeaheadSuggestions({
    prefix: value,
    limit: TYPEAHEAD_MAX_ITEMS,
  });

  if (suggestions.length > 0) {
    showTypeaheadSuggestions(block, suggestions, value, config);
  } else {
    hideTypeahead(block);
  }
}

// Emits init-search so the search-results block can fetch and render (no fetch/render here).
function handleSearch(e) {
  const searchValue = (e.target && e.target.value) ? e.target.value : '';
  if (searchValue.length < TYPEAHEAD_MIN_CHARS) return;
  const q = searchValue.trim();
  events.emit('init-search', { query: q }, { scope: SEARCH_EVENT_SCOPE });
}

// Sets placeholder and aria-label by viewport (narrow vs wide).
function setSearchPlaceholderForViewport(input) {
  const wide = window.matchMedia(DESKTOP_BP).matches;
  const text = wide ? PLACEHOLDER_WIDE : PLACEHOLDER_NARROW;
  input.placeholder = text;
  input.setAttribute('aria-label', text);
}

// Search input with typeahead, Enter, Escape, placeholder sync.
function searchInput(block, config) {
  const input = document.createElement('input');
  input.setAttribute('type', 'search');
  input.className = 'search-input';

  setSearchPlaceholderForViewport(input);
  const mq = window.matchMedia(DESKTOP_BP);
  mq.addEventListener('change', () => setSearchPlaceholderForViewport(input));

  const debouncedTypeahead = debounce((val) => {
    handleTypeaheadInput(val, block, config);
  }, TYPEAHEAD_DEBOUNCE_MS);

  input.addEventListener('input', (e) => {
    const { value } = e.target;
    if (value.length < TYPEAHEAD_MIN_CHARS) {
      hideTypeahead(block);
      return;
    }
    debouncedTypeahead(value);
  });

  input.addEventListener('focus', () => {
    const bar = block.querySelector('.search-bar');
    if (bar) bar.classList.remove('is-submitted');
    const { value } = input;
    if (value.length >= TYPEAHEAD_MIN_CHARS) {
      handleTypeaheadInput(value, block, config);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      hideTypeahead(block);
      runSearch(block, input.value);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      hideTypeahead(block);
      input.blur();
    }
  });

  return input;
}

// Search icon span (.icon .icon-search).
function searchIcon() {
  const icon = document.createElement('span');
  icon.classList.add('icon', 'icon-search');
  return icon;
}

// Submit button; navigates to search page with query.
function searchButton(block, config) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'button primary search-submit';
  btn.disabled = true;
  btn.setAttribute('aria-label', config.placeholders?.searchPlaceholder || 'Search');
  btn.textContent = 'Search';
  btn.addEventListener('click', () => {
    hideTypeahead(block);
    const input = block.querySelector('.search-input');
    if (!input) return;
    runSearch(block, input.value);
  });
  return btn;
}

// Typeahead dropdown container and list.
function searchTypeaheadDropdown() {
  const dropdown = document.createElement('div');
  dropdown.className = 'search-typeahead';
  const list = document.createElement('ul');
  list.className = 'search-typeahead-list';
  dropdown.append(list);
  return dropdown;
}

// Search box: bar (icon + input + button) + typeahead dropdown.
function searchBox(block, config) {
  const box = document.createElement('div');
  box.classList.add('search-box');
  const bar = document.createElement('div');
  bar.classList.add('search-bar');
  bar.append(searchIcon(), searchInput(block, config), searchButton(block, config));
  box.append(bar);
  box.append(searchTypeaheadDropdown());
  return box;
}

// Entry: build search UI, wire events, run search if ?q= in URL.
export default async function decorate(block) {
  const placeholders = await fetchPlaceholders();
  const searchPagePath = DEFAULT_SEARCH_PAGE_PATH;
  const config = {
    placeholders,
    searchPagePath,
  };
  block.innerHTML = '';
  block.append(searchBox(block, config));

  const searchInputEl = block.querySelector('.search-input');
  const submitBtn = block.querySelector('.search-submit');
  const updateSubmitDisabled = () => {
    const hasValue = (searchInputEl?.value ?? '').trim().length > 0;
    if (submitBtn) submitBtn.disabled = !hasValue;
  };

  const applyQueryAndMaybeSearch = async (query, options = {}) => {
    const { isRunSearch = false } = options;
    if (!searchInputEl || query == null) return;
    const value = String(query).trim();
    searchInputEl.value = value;
    updateSubmitDisabled();
    if (isRunSearch && value.length >= TYPEAHEAD_MIN_CHARS) {
      handleSearch({ target: searchInputEl });
    }
  };

  const initialQ = searchParams.get('q');
  if (initialQ) {
    await applyQueryAndMaybeSearch(initialQ, { isRunSearch: true });
  }

  if (searchInputEl && submitBtn) {
    searchInputEl.addEventListener('input', updateSubmitDisabled);
    searchInputEl.addEventListener('change', updateSubmitDisabled);
    updateSubmitDisabled();
  }

  document.addEventListener('click', (e) => {
    if (!block.contains(e.target)) hideTypeahead(block);
  });

  /* Arrow Up/Down + Enter: navigate/select typeahead when open */
  block.addEventListener('keydown', (e) => {
    const dropdown = getTypeaheadDropdown(block);
    if (!dropdown?.classList.contains('is-open')) return;
    const links = [...block.querySelectorAll('.search-typeahead-item')];
    if (!links.length) return;

    const input = block.querySelector('.search-input');
    const curr = links.indexOf(document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      links[(curr < 0 ? 0 : curr + 1) % links.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      (curr <= 0 ? input : links[curr - 1])?.focus();
    } else if (e.key === 'Enter' && curr >= 0) {
      e.preventDefault();
      links[curr].click();
    }
  });

  decorateIcons(block);
}
