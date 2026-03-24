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
import { parseFacetFields, applyFilters, sortDocs } from './search-results-utils.js';

const SEARCH_EVENT_SCOPE = 'search';
const ROWS_PER_PAGE = 10;
const SEARCH_RESULTS_EVENTS = {
  INIT: 'init-search',
  SORT_CHANGE: 'search-results:sort-change',
  FILTER_CHANGE: 'search-results:filter-change',
  FILTER_CLEAR: 'search-results:filter-clear',
  TAB_CHANGE: 'search-results:tab-change',
  PAGE_CHANGE: 'search-results:page-change',
};

const lucidworksClient = new LucidworksClient();

function emptyState(text) {
  const div = document.createElement('div');
  div.className = 'search-results-empty';
  div.textContent = text;
  return div;
}

export default function createSearchResultsApp() {
  const root = document.createElement('div');
  root.className = 'search-results-app';
  root.hidden = true;

  const state = {
    hasInitSearch: false,
    loading: false,
    query: '',
    sortBy: 'relevance',
    filters: {},
    activeTab: 'All',
    response: { docs: [], numFound: 0, start: 0 },
    facets: {},
    isFilterPanelOpen: false,
    isFilterSidebarOpen: false,
  };

  let render = () => {};

  function emitControlEvent(event, payload) {
    events.emit(event, payload, { scope: SEARCH_EVENT_SCOPE });
  }

  function updateFilter(field, value) {
    if (!value) delete state.filters[field];
    else state.filters[field] = value;
  }

  async function loadSearchData(page = 1) {
    const start = (page - 1) * ROWS_PER_PAGE;
    state.loading = true;
    render();
    try {
      const response = await lucidworksClient.fetchSearchResults({
        q: state.query,
        start,
        rows: ROWS_PER_PAGE,
      });
      state.response = response?.response ?? { docs: [], numFound: 0, start: 0 };
      state.facets = parseFacetFields(response?.facet_counts?.facet_fields || {});
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
          state.filters = {};
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
          updateFilter(field, eventData?.value || '');
          await loadSearchData(1);
        },
      },
      {
        event: SEARCH_RESULTS_EVENTS.FILTER_CLEAR,
        options: { scope: SEARCH_EVENT_SCOPE },
        handler: async () => {
          state.filters = {};
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

    const sortEl = createSearchSort({
      sortBy: state.sortBy,
      onChange: (value) => {
        emitControlEvent(SEARCH_RESULTS_EVENTS.SORT_CHANGE, { sortBy: value });
      },
    });
    sortEl.classList.add('search-results-sort-desktop');

    const sortFilterEl = createSearchSortFilter({
      facetFields: state.facets,
      selectedFilters: state.filters,
      sortBy: state.sortBy,
      isOpen: state.isFilterPanelOpen,
      onOpenChange: (open) => { state.isFilterPanelOpen = open; },
      onFilterChange: (field, value) => {
        emitControlEvent(SEARCH_RESULTS_EVENTS.FILTER_CHANGE, { field, value });
      },
      onFilterClear: () => {
        emitControlEvent(SEARCH_RESULTS_EVENTS.FILTER_CLEAR, {});
      },
      onSortChange: (value) => {
        emitControlEvent(SEARCH_RESULTS_EVENTS.SORT_CHANGE, { sortBy: value });
      },
    });
    sortFilterEl.classList.add('search-results-sort-filter-mobile');

    toolbar.append(sortEl, sortFilterEl);

    return toolbar;
  }

  function renderControls() {
    const controls = document.createElement('div');
    controls.className = 'search-results-sidebar-section';

    controls.append(
      createSearchFilters({
        facetFields: state.facets,
        selectedFilters: state.filters,
        isOpen: state.isFilterSidebarOpen,
        onOpenChange: (open) => { state.isFilterSidebarOpen = open; },
        onChange: (field, value) => {
          emitControlEvent(SEARCH_RESULTS_EVENTS.FILTER_CHANGE, { field, value });
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

    const docs = state.response.docs || [];
    const filtered = applyFilters(docs, state.filters, state.activeTab);
    const sorted = sortDocs(filtered, state.sortBy);
    const total = state.response.numFound || 0;
    const currentPage = Math.floor((state.response.start || 0) / ROWS_PER_PAGE) + 1;
    const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));

    const content = document.createElement('div');
    content.className = 'search-results-content';

    content.append(renderControls());

    const main = document.createElement('div');
    main.className = 'search-results-main';
    main.append(renderToolbar(total, sorted.length));
    main.append(
      createSearchTabs({
        tabs: getTabs(),
        activeTab: state.activeTab,
        onChange: (tab) => {
          emitControlEvent(SEARCH_RESULTS_EVENTS.TAB_CHANGE, { tab });
        },
      }),
    );
    main.append(createSearchResultsList({ docs: sorted }));

    content.append(main);
    const activeFiltersEl = createSearchActiveFilters({
      selectedFilters: state.filters,
      onRemove: (field, value) => {
        emitControlEvent(SEARCH_RESULTS_EVENTS.FILTER_CHANGE, { field, value: '' });
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
