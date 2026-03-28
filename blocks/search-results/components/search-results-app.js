import LucidworksClient from '../../../scripts/s-and-p-global/lucidworks-client.js';
import { events } from '../../../scripts/s-and-p-global/events.js';
import createSearchTabs from './search-tabs.js';
import createSearchFilters from './search-filters.js';
import createSearchSort from './search-sort.js';
import createSearchActiveFilters from './search-active-filters.js';
import createSearchSortFilter from './search-sort-filter.js';
import createSearchPagination from './search-pagination.js';
import createSearchResultsList from './search-results-list.js';
import createSearchLoading from './search-loading.js';
import { mergeFacetOptions, parseFacetFields } from './search-results-utils.js';

const SEARCH_EVENT_SCOPE = 'search';
const ROWS_PER_PAGE = 10;
const SEARCH_RESULTS_EVENTS = {
  INIT: 'init-search',
  SORT_CHANGE: 'search-results:sort-change',
  FILTER_CHANGE: 'search-results:filter-change',
  FILTER_CLEAR: 'search-results:filter-clear',
  TAB_CHANGE: 'search-results:tab-change',
  PAGE_CHANGE: 'search-results:page-change',
  HAS_RESULTS: 'search-results:has-results',
  NO_RESULTS: 'search-results:no-results',
  ERROR: 'search-results:error',
};

const lucidworksClient = new LucidworksClient();

function emptyState(text) {
  const div = document.createElement('div');
  div.className = 'search-results-empty';
  div.textContent = text;
  return div;
}

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseBoolean(value, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseDefaultFilters(value) {
  // Format: field=value1|value2; field2=value
  // Example:
  // attribute_services_advisory_ss=Marketing Services;
  // attribute_region_s=ASEAN/South Asia|Europe
  const result = {};
  if (!value) return result;
  const str = String(value);
  str.split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const idx = pair.indexOf('=');
      if (idx < 0) return;
      const field = pair.slice(0, idx).trim();
      const raw = pair.slice(idx + 1).trim();
      if (!field || !raw) return;
      const values = raw.split('|').map((v) => v.trim()).filter(Boolean);
      if (values.length) result[field] = values;
    });
  return result;
}

function buildSortParam(sortBy) {
  if (!sortBy || sortBy === 'relevance') return '';
  if (sortBy === 'date-desc') return 'date_added_dt desc';
  return '';
}

function parseKeyValueLines(value) {
  const map = {};
  if (!value) return map;
  const text = Array.isArray(value) ? value.join('\n') : String(value);
  // Authoring may serialize textarea as:
  // - multiple lines, OR
  // - a single <p> with line breaks collapsed to spaces.
  // Support multiple pairs in one line: key=Label key2=Another Label
  // Preferred separators are newline or ';' but we try to be forgiving.
  const parts = text
    .split(/[\r\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const pairRe = /([A-Za-z0-9_]+)\s*(=|:)\s*(.+?)(?=(\s+[A-Za-z0-9_]+\s*(=|:))|$)/g;
  parts.forEach((chunk) => {
    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = pairRe.exec(chunk)) !== null) {
      const rawKey = match[1];
      const rawLabel = match[3];
      const key = String(rawKey).trim().replace(/\s+/g, '');
      const label = String(rawLabel).trim();
      if (!key || !label) continue;
      map[key] = label;
    }
  });
  return map;
}

function parseFusionFacetLabels(fusionFacetLabels) {
  const map = {};
  if (!Array.isArray(fusionFacetLabels) || !fusionFacetLabels.length) return map;
  fusionFacetLabels
    .flatMap((entry) => String(entry || '').split(','))
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const idx = pair.indexOf(':');
      if (idx < 0) return;
      const field = pair.slice(0, idx).trim().replace(/\s+/g, '');
      const label = pair.slice(idx + 1).trim();
      if (!field) return;
      // Some integrations return `field:field` which isn't a human label.
      // Treat those as "no label" so UI can fall back to a friendly formatter.
      if (label && label !== field) map[field] = label;
    });
  return map;
}

export default function createSearchResultsApp({ config = {} } = {}) {
  const root = document.createElement('div');
  root.className = 'search-results-app';
  root.hidden = true;

  // `readBlockConfig()` returns normalized (kebab-case) keys, but allow both
  // kebab and camel to be resilient.
  const facetsConfig = config.facets ?? config['facet-order'] ?? config.facetOrder;
  const sortOptionsConfig = config['sort-options'] ?? config.sortOptions;
  const defaultFiltersConfig = config['default-filters'] ?? config.defaultFilters;
  const authoredFacetLabelsConfig = config['facet-labels']
    ?? config.facetLabels
    ?? config.facetlabels
    ?? config['filter-titles']
    ?? config.filterTitles;
  const showSortConfig = config['show-sort']
    ?? config.showSort
    ?? config.showsort
    ?? config['show-sort-options']
    ?? config.showSortOptions
    ?? config.showsortoptions;
  const showSort = parseBoolean(showSortConfig, true);
  const authoredFacetLabels = parseKeyValueLines(authoredFacetLabelsConfig);

  const facetOrder = parseList(facetsConfig);
  const sortOptionValues = parseList(sortOptionsConfig);
  const sortOptions = [
    { value: 'relevance', label: 'Most Relevant' },
    { value: 'date-desc', label: 'Most Recent' },
  ].filter((opt) => (sortOptionValues.length ? sortOptionValues.includes(opt.value) : true));

  const state = {
    hasInitSearch: false,
    loading: false,
    hasResults: true,
    query: '',
    sortBy: 'relevance',
    filters: {},
    filterOrder: [],
    activeTab: 'All',
    response: { docs: [], numFound: 0, start: 0 },
    facets: {},
    facetLabels: authoredFacetLabels,
    /** New search: replace facets entirely; filter/page/sort: merge so fq doesn’t collapse UI */
    resetFacetOptionsOnNextLoad: false,
    isFilterPanelOpen: false,
    isFilterSidebarOpen: false,
  };

  let render = () => {};

  function emitControlEvent(event, payload) {
    events.emit(event, payload, { scope: SEARCH_EVENT_SCOPE });
  }

  function addToOrder(field, value) {
    const key = `${field}::${value}`;
    if (state.filterOrder.some((x) => `${x.field}::${x.value}` === key)) return;
    state.filterOrder.push({ field, value });
  }

  function removeFromOrder(field, value) {
    const key = `${field}::${value}`;
    state.filterOrder = state.filterOrder.filter((x) => `${x.field}::${x.value}` !== key);
  }

  function updateFilter(field, value, checked) {
    if (!field || !value) return;
    const current = Array.isArray(state.filters[field]) ? state.filters[field] : [];
    const set = new Set(current);
    if (checked) {
      set.add(value);
      addToOrder(field, value);
    } else {
      set.delete(value);
      removeFromOrder(field, value);
    }
    const next = [...set];
    if (!next.length) delete state.filters[field];
    else state.filters[field] = next;
  }

  async function loadSearchData(page = 1) {
    const start = (page - 1) * ROWS_PER_PAGE;
    state.loading = true;
    render();
    try {
      const sort = buildSortParam(state.sortBy);
      const response = await lucidworksClient.fetchSearchResults({
        q: state.query,
        start,
        rows: ROWS_PER_PAGE,
        filters: state.filters,
        sort,
        facetFields: facetOrder.length ? facetOrder : undefined,
      });
      state.response = response?.response ?? { docs: [], numFound: 0, start: 0 };
      const parsedFacets = parseFacetFields(response?.facet_counts?.facet_fields || {});
      if (state.resetFacetOptionsOnNextLoad) {
        state.facets = parsedFacets;
        state.resetFacetOptionsOnNextLoad = false;
      } else {
        state.facets = mergeFacetOptions(state.facets, parsedFacets, state.filters);
      }
      state.facetLabels = {
        ...parseFusionFacetLabels(response?.fusion?.facet_labels),
        ...authoredFacetLabels,
      };

      const total = Number(state.response?.numFound) || 0;
      state.hasResults = total > 0;
      if (total > 0) {
        emitControlEvent(SEARCH_RESULTS_EVENTS.HAS_RESULTS, { query: state.query, total, page });
      } else {
        emitControlEvent(SEARCH_RESULTS_EVENTS.NO_RESULTS, { query: state.query, total: 0, page, reason: 'empty' });
      }
    } catch (e) {
      state.response = { docs: [], numFound: 0, start };
      state.facets = {};
      state.facetLabels = authoredFacetLabels;
      state.hasResults = false;
      const message = e?.message || String(e);
      emitControlEvent(SEARCH_RESULTS_EVENTS.ERROR, { query: state.query, page, message });
      emitControlEvent(SEARCH_RESULTS_EVENTS.NO_RESULTS, {
        query: state.query,
        total: 0,
        page,
        reason: 'error',
        message,
      });
    } finally {
      state.loading = false;
      render();
    }
  }

  function registerEventSubscriptions() {
    const handlers = [
      {
        event: SEARCH_RESULTS_EVENTS.INIT,
        options: { scope: SEARCH_EVENT_SCOPE, eager: false },
        handler: async (eventData) => {
          const q = eventData?.query?.trim() ?? '';
          state.query = q;
          state.hasInitSearch = true;
          state.resetFacetOptionsOnNextLoad = true;
          state.filters = parseDefaultFilters(defaultFiltersConfig);
          state.filterOrder = Object.entries(state.filters).flatMap(([field, values]) => {
            const arr = Array.isArray(values) ? values : [];
            return arr.map((value) => ({ field, value }));
          });
          state.activeTab = 'All';
          state.sortBy = 'relevance';
          state.loading = true;
          render();
          await loadSearchData(1);
        },
      },
      {
        event: SEARCH_RESULTS_EVENTS.SORT_CHANGE,
        options: { scope: SEARCH_EVENT_SCOPE },
        handler: async (eventData) => {
          state.sortBy = eventData?.sortBy || 'relevance';
          await loadSearchData(1);
        },
      },
      {
        event: SEARCH_RESULTS_EVENTS.FILTER_CHANGE,
        options: { scope: SEARCH_EVENT_SCOPE },
        handler: async (eventData) => {
          const field = eventData?.field;
          if (!field) return;
          updateFilter(field, eventData?.value, Boolean(eventData?.checked));
          await loadSearchData(1);
        },
      },
      {
        event: SEARCH_RESULTS_EVENTS.FILTER_CLEAR,
        options: { scope: SEARCH_EVENT_SCOPE },
        handler: async () => {
          state.filters = parseDefaultFilters(defaultFiltersConfig);
          state.filterOrder = Object.entries(state.filters).flatMap(([field, values]) => {
            const arr = Array.isArray(values) ? values : [];
            return arr.map((value) => ({ field, value }));
          });
          state.activeTab = 'All';
          await loadSearchData(1);
        },
      },
      {
        event: SEARCH_RESULTS_EVENTS.TAB_CHANGE,
        options: { scope: SEARCH_EVENT_SCOPE },
        handler: async (eventData) => {
          state.activeTab = eventData?.tab || 'All';
          await loadSearchData(1);
        },
      },
      {
        event: SEARCH_RESULTS_EVENTS.PAGE_CHANGE,
        options: { scope: SEARCH_EVENT_SCOPE },
        handler: async (eventData) => {
          const page = Number(eventData?.page) || 1;
          await loadSearchData(Math.max(1, page));
        },
      },
    ];

    return handlers.map(({ event, handler, options }) => events.on(event, handler, options));
  }

  function getTabs() {
    const categories = state.facets.category?.slice(0, 3) || [];
    return [
      { label: 'All', count: state.response.numFound || 0 },
      ...categories.map((item) => ({ label: item.value, count: item.count })),
    ];
  }

  function renderToolbar(total, visibleCount) {
    const toolbar = document.createElement('div');
    toolbar.className = 'search-results-toolbar';

    const count = document.createElement('p');
    count.className = 'search-results-count';
    count.textContent = `Showing ${visibleCount.toLocaleString()} of ${total.toLocaleString()} results for "${state.query}"`;
    toolbar.append(count);

    const sortFilterEl = createSearchSortFilter({
      facetFields: state.facets,
      selectedFilters: state.filters,
      sortBy: state.sortBy,
      sortOptions,
      showSort,
      facetLabels: state.facetLabels,
      facetOrder,
      isOpen: state.isFilterPanelOpen,
      onOpenChange: (open) => { state.isFilterPanelOpen = open; },
      onFilterChange: (field, value, checked) => {
        emitControlEvent(SEARCH_RESULTS_EVENTS.FILTER_CHANGE, { field, value, checked });
      },
      onFilterClear: () => {
        emitControlEvent(SEARCH_RESULTS_EVENTS.FILTER_CLEAR, {});
      },
      onSortChange: (value) => {
        emitControlEvent(SEARCH_RESULTS_EVENTS.SORT_CHANGE, { sortBy: value });
      },
    });
    sortFilterEl.classList.add('search-results-sort-filter-mobile');

    if (showSort) {
      const sortEl = createSearchSort({
        sortBy: state.sortBy,
        options: sortOptions,
        onChange: (value) => {
          emitControlEvent(SEARCH_RESULTS_EVENTS.SORT_CHANGE, { sortBy: value });
        },
      });
      sortEl.classList.add('search-results-sort-desktop');
      toolbar.append(sortEl);
    }
    toolbar.append(sortFilterEl);

    return toolbar;
  }

  function renderControls() {
    const controls = document.createElement('div');
    controls.className = 'search-results-sidebar-section';

    controls.append(
      createSearchFilters({
        facetFields: state.facets,
        selectedFilters: state.filters,
        facetLabels: state.facetLabels,
        facetOrder,
        isOpen: state.isFilterSidebarOpen,
        onOpenChange: (open) => { state.isFilterSidebarOpen = open; },
        onChange: (field, value, checked) => {
          emitControlEvent(SEARCH_RESULTS_EVENTS.FILTER_CHANGE, { field, value, checked });
        },
        onClear: () => {
          emitControlEvent(SEARCH_RESULTS_EVENTS.FILTER_CLEAR, {});
        },
        onApply: undefined,
      }),
    );

    return controls;
  }

  render = () => {
    root.innerHTML = '';
    if (!state.hasInitSearch) {
      root.hidden = true;
      return;
    }

    root.hidden = false;

    if (state.loading) {
      root.append(createSearchLoading());
      return;
    }

    if (!state.hasResults) {
      root.hidden = true;
      return;
    }

    const docs = state.response.docs || [];
    const total = state.response.numFound || 0;
    const currentPage = Math.floor((state.response.start || 0) / ROWS_PER_PAGE) + 1;
    const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));

    const content = document.createElement('div');
    content.className = 'search-results-content';

    content.append(renderControls());

    const main = document.createElement('div');
    main.className = 'search-results-main';
    main.append(renderToolbar(total, docs.length));
    // Tabs are optional; keep hidden unless category facets exist.
    if (state.facets.category?.length) {
      main.append(
        createSearchTabs({
          tabs: getTabs(),
          activeTab: state.activeTab,
          onChange: (tab) => {
            emitControlEvent(SEARCH_RESULTS_EVENTS.TAB_CHANGE, { tab });
          },
        }),
      );
    }
    main.append(createSearchResultsList({ docs }));

    content.append(main);
    const activeFiltersEl = createSearchActiveFilters({
      selectedFilters: state.filters,
      order: state.filterOrder,
      onRemove: (field, value) => {
        emitControlEvent(SEARCH_RESULTS_EVENTS.FILTER_CHANGE, { field, value, checked: false });
      },
      onRemoveAll: () => {
        emitControlEvent(SEARCH_RESULTS_EVENTS.FILTER_CLEAR, {});
      },
    });
    if (activeFiltersEl) {
      root.append(activeFiltersEl);
    }

    root.append(content);
    root.append(
      createSearchPagination({
        currentPage,
        totalPages,
        onPageChange: (page) => emitControlEvent(SEARCH_RESULTS_EVENTS.PAGE_CHANGE, { page }),
      }),
    );
  };

  const subscriptions = registerEventSubscriptions();

  root.addEventListener('DOMNodeRemovedFromDocument', () => {
    subscriptions.forEach((sub) => sub?.off?.());
  });
  root.append(emptyState('Enter a query to search.'));
  return root;
}
