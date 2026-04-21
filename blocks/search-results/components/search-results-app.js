import LucidworksClient from '../../../scripts/s-and-p-global/lucidworks-client.js';
import {
  getPageTypeForTaxonomy,
  loadTaxonomyData,
  resolveFacetValueDisplay,
} from '../../../scripts/taxonomy-metadata.js';
import { events } from '../../../scripts/s-and-p-global/events.js';
import createSearchTabs from './search-tabs.js';
import createSearchFilters from './search-filters.js';
import createSearchSort from './search-sort.js';
import createSearchActiveFilters from './search-active-filters.js';
import createSearchSortFilter from './search-sort-filter.js';
import createPaginationControls, { ROWS_OPTIONS } from '../../dynamic-module/components/pagination-controls.js';
import createSearchResultsList, {
  EVENT_LANDING_SOLR_FIELD_LIST,
  EXPERT_LANDING_SOLR_FIELD_LIST,
} from './search-results-list.js';
import createSearchLoading from './search-loading.js';
import { mergeFacetOptions, parseFacetFields } from './search-results-utils.js';

const SEARCH_EVENT_SCOPE = 'search';
const DEFAULT_ROWS_PER_PAGE = ROWS_OPTIONS[0] || 10;

/** Solr `attribute_page_type_s` values per tab (index must match AEM / Lucidworks). */
const PAGE_TYPE_FIELD = 'attribute_page_type_s';

const SEARCH_RESULTS_TAB_DEFAULTS = [
  { key: 'all', label: 'All', pageTypes: [] },
  {
    key: 'products',
    label: 'Products & Services',
    pageTypes: ['Product Page'],
  },
  {
    key: 'insights',
    label: 'Insights, News & Analysis',
    pageTypes: ['Insights Details Page', 'Podcast Details Page'],
  },
  {
    key: 'events',
    label: 'Events',
    pageTypes: ['Event details'],
  },
];

function normalizeLandingPageTypeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Curated landing templates (`models/_page.json` pageType): scope in-page search to detail
 * `attribute_page_type_s` values and hide the tab bar (tabs stay on generic search).
 */
function resolveContextualSearchPageTypeLock(doc) {
  const raw = getPageTypeForTaxonomy(doc);
  const key = normalizeLandingPageTypeKey(raw);
  if (!key) return null;
  const byLandingPageType = {
    'events landing page': ['Event details'],
    'expert landing page': ['Experts Page'],
    'product catalog': ['Product Page'],
    'podcast landing page': ['Podcast Details Page'],
    'podcasts landing page': ['Podcast Details Page'],
  };
  const pageTypes = byLandingPageType[key];
  return pageTypes?.length ? { pageTypes } : null;
}

const SEARCH_RESULTS_EVENTS = {
  INIT: 'init-search',
  SORT_CHANGE: 'search-results:sort-change',
  FILTER_CHANGE: 'search-results:filter-change',
  FILTER_CLEAR: 'search-results:filter-clear',
  TAB_CHANGE: 'search-results:tab-change',
  PAGE_CHANGE: 'search-results:page-change',
  ROWS_CHANGE: 'search-results:rows-change',
  STATE: 'search-results:state',
  PEER_PAGINATION_MOUNTED: 'search-results:peer-pagination-mounted',
  HAS_RESULTS: 'search-results:has-results',
  NO_RESULTS: 'search-results:no-results',
  ERROR: 'search-results:error',
};

const lucidworksClient = new LucidworksClient();

/**
 * Adds `label` on facet options (sheet, nested taxonomy.json, or humanized AEM path).
 * Filter/query logic still uses `value` (canonical id).
 */
function enrichFacetsForDisplay(facets, taxonomyLoaded) {
  if (!facets || typeof facets !== 'object') return facets;
  const out = {};
  Object.keys(facets).forEach((field) => {
    const items = facets[field];
    if (!Array.isArray(items)) {
      out[field] = items;
      return;
    }
    out[field] = items.map((item) => {
      if (!item || item.value == null) return item;
      const id = String(item.value);
      const display = resolveFacetValueDisplay(id, taxonomyLoaded);
      if (display === id) return item;
      return { ...item, label: display };
    });
  });
  return out;
}

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
  if (sortBy === 'date-desc') return 'published_date_dt desc';
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

  // Capture sequences like:
  // - key=Label
  // - key: Label
  // - key=Label key2=Another Label
  // - key=Label,key2=Another Label (comma-separated authoring)
  const pairRe = /([A-Za-z0-9_]+)\s*(=|:)\s*(.+?)(?=((?:\s|,)+[A-Za-z0-9_]+\s*(=|:))|$)/g;
  parts.forEach((chunk) => {
    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = pairRe.exec(chunk)) !== null) {
      const rawKey = match[1];
      const rawLabel = match[3];
      const key = String(rawKey).trim().replace(/\s+/g, '');
      const label = String(rawLabel).trim();
      if (key && label) {
        map[key] = label;
      }
    }
  });
  return map;
}

/**
 * @param {string|string[]|undefined} tabLabelsConfig Block `tab-labels` / `tabLabels`
 *   (key=Label lines).
 */
function buildResolvedSearchTabs(tabLabelsConfig, placeholderLabels = {}) {
  const authoredRaw = parseKeyValueLines(tabLabelsConfig);
  const authoredNorm = {};
  Object.entries(authoredRaw).forEach(([k, v]) => {
    const nk = String(k).trim().toLowerCase();
    if (nk) authoredNorm[nk] = v;
  });
  return SEARCH_RESULTS_TAB_DEFAULTS.map((def) => {
    const { key, label: defaultLabel, pageTypes } = def;
    const raw = authoredNorm[key];
    const placeholder = placeholderLabels[key];
    let label = defaultLabel;
    if (placeholder != null && String(placeholder).trim()) {
      label = String(placeholder).trim();
    }
    if (raw != null && String(raw).trim()) {
      label = String(raw).trim();
    }
    return { key, label, pageTypes };
  });
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

  const contextualPageTypeLock = typeof document !== 'undefined'
    ? resolveContextualSearchPageTypeLock(document)
    : null;

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
  const placeholders = config.placeholders || {};
  const filterAndSortLabel = placeholders.filterSort
    || placeholders.filterAndSort
    || 'Filter & Sort';
  const placeholderTabLabels = {
    all: placeholders.all,
    products: placeholders.products,
    insights: placeholders.insights,
    events: placeholders.events,
  };
  const paginationPlacement = config['pagination-placement'] ?? config.paginationPlacement ?? 'embedded';
  const showEmbeddedPagination = String(paginationPlacement).toLowerCase() !== 'external';
  const authoredFacetLabels = parseKeyValueLines(authoredFacetLabelsConfig);
  const tabLabelsAuthored = config['tab-labels']
    ?? config.tabLabels
    ?? config.tablabels
    ?? config['tab-label-values']
    ?? config.tabLabelValues
    ?? config.tablabelvalues
    ?? config['tab-display-labels']
    ?? config.tabDisplayLabels
    ?? config.tabdisplaylabels
    ?? '';
  const searchResultsTabs = buildResolvedSearchTabs(tabLabelsAuthored, placeholderTabLabels);

  const facetOrder = parseList(facetsConfig);
  const sortOptionValues = parseList(sortOptionsConfig);
  const sortOptions = [
    { value: 'relevance', label: placeholders.mostRelevant || 'Most Relevant' },
    { value: 'date-desc', label: placeholders.mostRecent || 'Most Recent' },
  ].filter((opt) => (sortOptionValues.length ? sortOptionValues.includes(opt.value) : true));

  const state = {
    hasInitSearch: false,
    loading: false,
    hasResults: true,
    query: '',
    sortBy: 'relevance',
    filters: {},
    filterOrder: [],
    activeTabKey: 'all',
    response: { docs: [], numFound: 0, start: 0 },
    facets: {},
    facetLabels: authoredFacetLabels,
    /**
     * New search: replace facets entirely; filter/page/sort: merge so fq doesn’t collapse UI
     */
    resetFacetOptionsOnNextLoad: false,
    isFilterPanelOpen: false,
    isFilterSidebarOpen: false,
    rowsPerPage: DEFAULT_ROWS_PER_PAGE,
    /**
     * Populated from global facet response: `attribute_page_type_s` bucket → count
     * (all tabs, user filters only).
     */
    pageTypeTabCounts: {},
    /**
     * `numFound` for query + user filters without tab page-type `fq`
     * (drives inactive "All" tab count).
     */
    globalNumFoundSnapshot: null,
    /**
     * Legacy alias: kept in sync with `globalNumFoundSnapshot` when the global request runs.
     */
    allTabNumFoundSnapshot: null,
  };

  let render = () => {};
  /** Full `loadTaxonomyData()` result (sheet or nested); drives facet/chip labels. */
  let taxonomyLoaded = null;

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

  function getActiveTabPageTypes() {
    const def = searchResultsTabs.find((t) => t.key === state.activeTabKey);
    return def?.pageTypes?.length ? def.pageTypes : [];
  }

  function getEffectivePageTypeFilterValues() {
    if (contextualPageTypeLock?.pageTypes?.length) {
      return contextualPageTypeLock.pageTypes;
    }
    return getActiveTabPageTypes();
  }

  /** True when page type is imposed by a tab or contextual landing (not "All"). */
  function isPageTypeScopeLocked() {
    return getEffectivePageTypeFilterValues().length > 0;
  }

  /**
   * Filters shown in chips / checkboxes: omit `attribute_page_type_s` when the tab or
   * landing context already applies it so UI state matches the request.
   */
  function getSelectedFiltersForUi() {
    const out = { ...state.filters };
    if (isPageTypeScopeLocked()) {
      delete out[PAGE_TYPE_FIELD];
    }
    return out;
  }

  function getFilterOrderForUi() {
    if (!isPageTypeScopeLocked()) return state.filterOrder;
    return state.filterOrder.filter((x) => x.field !== PAGE_TYPE_FIELD);
  }

  /** Sidebar / sheet facets: hide page-type group when scope is controlled by tab or lock. */
  function getFacetFieldsForFiltersUi() {
    const enriched = enrichFacetsForDisplay(state.facets, taxonomyLoaded);
    if (!isPageTypeScopeLocked()) return enriched;
    const { [PAGE_TYPE_FIELD]: _omit, ...rest } = enriched;
    return rest;
  }

  /**
   * Tab selection (or contextual landing lock) applies `attribute_page_type_s` (OR within set).
   * That constraint wins over the same field in facet filters.
   */
  function buildFiltersForSearchRequest() {
    const pageTypeValues = getEffectivePageTypeFilterValues();
    const out = { ...state.filters };
    if (pageTypeValues.length) {
      delete out[PAGE_TYPE_FIELD];
      out[PAGE_TYPE_FIELD] = pageTypeValues;
    }
    return out;
  }

  function buildFacetFieldsForRequest() {
    const base = facetOrder.length ? [...facetOrder] : [];
    if (!contextualPageTypeLock && state.activeTabKey === 'all' && !base.includes(PAGE_TYPE_FIELD)) {
      base.push(PAGE_TYPE_FIELD);
    }
    return base.length ? base : undefined;
  }

  /**
   * Filters for the secondary "global facets" request: same user/default filters as the main
   * search, but **no** tab-imposed `attribute_page_type_s` (so facet buckets + tab badges match
   * across all tabs for the current filter set).
   */
  function buildFiltersForGlobalFacetsRequest() {
    const out = { ...state.filters };
    if (contextualPageTypeLock?.pageTypes?.length) {
      delete out[PAGE_TYPE_FIELD];
      out[PAGE_TYPE_FIELD] = contextualPageTypeLock.pageTypes;
    }
    return out;
  }

  /** Facet fields for the global request (includes page type for tab strip counts). */
  function buildGlobalFacetFieldsForRequest() {
    const base = facetOrder.length ? [...facetOrder] : [];
    if (!base.includes(PAGE_TYPE_FIELD)) {
      base.push(PAGE_TYPE_FIELD);
    }
    return base.length ? base : undefined;
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

  /**
   * Scroll to the search input area (preferred) so users stay anchored at the query bar
   * while results refresh below.
   */
  function scrollSearchSectionIntoView() {
    if (typeof document === 'undefined') return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const rootTop = root.getBoundingClientRect().top + window.scrollY;
        const searchWrappers = [...document.querySelectorAll('.search-wrapper')]
          .filter((el) => !el.hidden && el.getBoundingClientRect().height > 0);
        const nearestSearchWrapper = searchWrappers
          .filter((el) => (el.getBoundingClientRect().top + window.scrollY) <= rootTop)
          .sort((a, b) => (b.getBoundingClientRect().top + window.scrollY)
            - (a.getBoundingClientRect().top + window.scrollY))[0];
        const section = root.closest('.section');
        const target = nearestSearchWrapper
          || section?.querySelector(':scope > .search-wrapper')
          || document.querySelector('[data-block-name="search"] .search-bar')
          || document.querySelector('.block.search .search-bar')
          || document.querySelector('[data-block-name="search"]')
          || document.querySelector('.block.search')
          || root.closest('[data-block-name="search-results"]')
          || root.closest('.search-results.block')
          || root.closest('.block.search-results')
          || root;
        try {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {
          target.scrollIntoView();
        }
      });
    });
  }

  async function loadSearchData(page = 1) {
    const rows = state.rowsPerPage;
    const totalKnown = Number(state.response?.numFound) || 0;
    const totalPages = totalKnown <= 0 ? 1 : Math.max(1, Math.ceil(totalKnown / rows));
    const nextPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const start = (nextPage - 1) * rows;
    state.loading = true;
    render();
    try {
      const sort = buildSortParam(state.sortBy);
      let response;
      let responseGlobal = null;

      const contextualFieldList = (() => {
        if (!contextualPageTypeLock?.pageTypes?.length) return undefined;
        const keys = new Set(
          contextualPageTypeLock.pageTypes.map((pt) => String(pt).trim()),
        );
        if (keys.has('Event details')) return EVENT_LANDING_SOLR_FIELD_LIST;
        if (keys.has('Experts Page')) return EXPERT_LANDING_SOLR_FIELD_LIST;
        return undefined;
      })();

      if (contextualPageTypeLock) {
        response = await lucidworksClient.fetchSearchResults({
          q: state.query,
          start,
          rows,
          filters: buildFiltersForSearchRequest(),
          sort,
          facetFields: buildFacetFieldsForRequest(),
          fieldList: contextualFieldList,
        });
      } else {
        [response, responseGlobal] = await Promise.all([
          lucidworksClient.fetchSearchResults({
            q: state.query,
            start,
            rows,
            filters: buildFiltersForSearchRequest(),
            sort,
            facetFields: undefined,
          }),
          lucidworksClient.fetchSearchResults({
            q: state.query,
            start: 0,
            rows: 1,
            filters: buildFiltersForGlobalFacetsRequest(),
            sort: '',
            facetFields: buildGlobalFacetFieldsForRequest(),
          }).catch(() => null),
        ]);
      }

      if (!response) {
        throw new Error('Search returned no data');
      }

      // Prefer the server's effective paging size if the API echoes it back.
      // Lucidworks response header typically contains: responseHeader.params.rows.
      const apiRowsRaw = response?.responseHeader?.params?.rows;
      const apiRows = Number(apiRowsRaw);
      const allowedRows = ROWS_OPTIONS;
      if (allowedRows.includes(apiRows)) {
        state.rowsPerPage = apiRows;
      }

      const rawResponse = response?.response ?? { docs: [], numFound: 0, start: 0 };
      // Keep paging anchored to requested params (`start`/`rows`) so UI and
      // list window remain consistent even if backend returns broad doc sets.
      state.response = {
        ...rawResponse,
        start,
      };

      if (contextualPageTypeLock) {
        const parsedFacets = parseFacetFields(response?.facet_counts?.facet_fields || {});
        const numFoundMain = Number(state.response?.numFound) || 0;
        state.globalNumFoundSnapshot = numFoundMain;
        state.allTabNumFoundSnapshot = numFoundMain;
        if (parsedFacets[PAGE_TYPE_FIELD]?.length) {
          const map = {};
          parsedFacets[PAGE_TYPE_FIELD].forEach(({ value, count }) => {
            if (value != null) map[String(value)] = count ?? 0;
          });
          state.pageTypeTabCounts = map;
        }
        const { [PAGE_TYPE_FIELD]: _pageTypeFacet, ...facetsForUi } = parsedFacets;
        if (state.resetFacetOptionsOnNextLoad) {
          state.facets = facetsForUi;
          state.resetFacetOptionsOnNextLoad = false;
        } else {
          state.facets = mergeFacetOptions(state.facets, facetsForUi, getSelectedFiltersForUi());
        }
      } else if (responseGlobal) {
        const gNum = Number(responseGlobal?.response?.numFound);
        if (!Number.isNaN(gNum)) {
          state.globalNumFoundSnapshot = gNum;
          state.allTabNumFoundSnapshot = gNum;
        }
        const parsedGlobal = parseFacetFields(responseGlobal?.facet_counts?.facet_fields || {});
        if (parsedGlobal[PAGE_TYPE_FIELD]?.length) {
          const map = {};
          parsedGlobal[PAGE_TYPE_FIELD].forEach(({ value, count }) => {
            if (value != null) map[String(value)] = count ?? 0;
          });
          state.pageTypeTabCounts = map;
        } else {
          state.pageTypeTabCounts = {};
        }
        const { [PAGE_TYPE_FIELD]: _pt, ...facetsGlobal } = parsedGlobal;
        if (state.resetFacetOptionsOnNextLoad) {
          state.facets = facetsGlobal;
          state.resetFacetOptionsOnNextLoad = false;
        } else {
          state.facets = mergeFacetOptions(state.facets, facetsGlobal, getSelectedFiltersForUi());
        }
      } else if (state.resetFacetOptionsOnNextLoad) {
        state.resetFacetOptionsOnNextLoad = false;
      }

      state.facetLabels = {
        ...parseFusionFacetLabels(responseGlobal?.fusion?.facet_labels),
        ...parseFusionFacetLabels(response?.fusion?.facet_labels),
        ...authoredFacetLabels,
      };

      const total = Number(state.response?.numFound) || 0;
      state.hasResults = total > 0;
      if (total > 0) {
        emitControlEvent(SEARCH_RESULTS_EVENTS.HAS_RESULTS, {
          query: state.query,
          total,
          page: nextPage,
        });
      } else {
        emitControlEvent(SEARCH_RESULTS_EVENTS.NO_RESULTS, {
          query: state.query, total: 0, page: nextPage, reason: 'empty',
        });
      }
    } catch (e) {
      state.response = { docs: [], numFound: 0, start };
      state.facets = {};
      state.facetLabels = authoredFacetLabels;
      state.hasResults = false;
      state.globalNumFoundSnapshot = null;
      state.allTabNumFoundSnapshot = null;
      state.pageTypeTabCounts = {};
      const message = e?.message || String(e);
      emitControlEvent(SEARCH_RESULTS_EVENTS.ERROR, {
        query: state.query,
        page: nextPage,
        message,
      });
      emitControlEvent(SEARCH_RESULTS_EVENTS.NO_RESULTS, {
        query: state.query,
        total: 0,
        page: nextPage,
        reason: 'error',
        message,
      });
    } finally {
      state.loading = false;
      render();
      scrollSearchSectionIntoView();
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
          state.activeTabKey = 'all';
          state.pageTypeTabCounts = {};
          state.globalNumFoundSnapshot = null;
          state.allTabNumFoundSnapshot = null;
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
          if (field === PAGE_TYPE_FIELD && isPageTypeScopeLocked()) return;
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
          state.activeTabKey = 'all';
          await loadSearchData(1);
        },
      },
      {
        event: SEARCH_RESULTS_EVENTS.TAB_CHANGE,
        options: { scope: SEARCH_EVENT_SCOPE },
        handler: async (eventData) => {
          if (contextualPageTypeLock) return;
          const nextKey = eventData?.tab || 'all';
          state.activeTabKey = searchResultsTabs.some((t) => t.key === nextKey) ? nextKey : 'all';
          delete state.filters[PAGE_TYPE_FIELD];
          state.filterOrder = state.filterOrder.filter((x) => x.field !== PAGE_TYPE_FIELD);
          state.resetFacetOptionsOnNextLoad = true;
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
      {
        event: SEARCH_RESULTS_EVENTS.ROWS_CHANGE,
        options: { scope: SEARCH_EVENT_SCOPE },
        handler: async (eventData) => {
          const raw = Number(eventData?.rows);
          const allowed = ROWS_OPTIONS;
          state.rowsPerPage = allowed.includes(raw) ? raw : DEFAULT_ROWS_PER_PAGE;
          await loadSearchData(1);
        },
      },
      {
        event: SEARCH_RESULTS_EVENTS.PEER_PAGINATION_MOUNTED,
        options: { scope: SEARCH_EVENT_SCOPE },
        handler: () => {
          render();
        },
      },
    ];

    return handlers.map(({ event, handler, options }) => events.on(event, handler, options));
  }

  function tabCountForDefinition(tabDef) {
    const currentTotal = Number(state.response?.numFound) || 0;
    // Active tab must match "Showing N results" (tab + sort + facet filters).
    if (tabDef.key === state.activeTabKey) {
      return currentTotal;
    }
    if (!tabDef.pageTypes?.length) {
      const globalTotal = state.globalNumFoundSnapshot;
      if (globalTotal != null) return globalTotal;
      const snap = state.allTabNumFoundSnapshot;
      if (snap != null) return snap;
      return currentTotal;
    }
    // Other tabs: counts from global facet request (same user filters, no tab page-type fq).
    return tabDef.pageTypes.reduce(
      (sum, pt) => sum + (state.pageTypeTabCounts[pt] ?? 0),
      0,
    );
  }

  function getTabs() {
    return searchResultsTabs.map((tabDef) => ({
      key: tabDef.key,
      label: tabDef.label,
      count: tabCountForDefinition(tabDef),
    }));
  }

  function renderToolbar(total) {
    const toolbar = document.createElement('div');
    toolbar.className = 'search-results-toolbar';

    const count = document.createElement('p');
    count.className = 'search-results-count';
    const totalSpan = document.createElement('span');
    totalSpan.textContent = total.toLocaleString();

    const querySpan = document.createElement('span');
    querySpan.textContent = String(state.query || '').trim();

    count.append(
      document.createTextNode(`${placeholders.showing || 'Showing'} `),
      totalSpan,
      document.createTextNode(` ${placeholders.resultsFor || 'results for'} `),
      querySpan,
    );
    toolbar.append(count);

    const sortFilterEl = createSearchSortFilter({
      facetFields: getFacetFieldsForFiltersUi(),
      selectedFilters: getSelectedFiltersForUi(),
      sortBy: state.sortBy,
      sortOptions,
      showSort,
      facetLabels: state.facetLabels,
      facetOrder,
      labels: {
        filter: placeholders.filter || 'Filter',
        filterAndSort: filterAndSortLabel,
      },
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
        facetFields: getFacetFieldsForFiltersUi(),
        selectedFilters: getSelectedFiltersForUi(),
        facetLabels: state.facetLabels,
        facetOrder,
        labels: {
          filter: placeholders.filter || 'Filter',
        },
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

  /** Visible Dynamic Module (Pagination) — hidden module does not suppress embedded controls. */
  function hasPeerPaginationBlock() {
    if (typeof document === 'undefined') return false;
    return Boolean(
      document.querySelector('.block.dynamic-module[data-variation="pagination"]:not([hidden])'),
    );
  }

  function shouldEmbedPaginationHere() {
    if (!showEmbeddedPagination) return false;
    return !hasPeerPaginationBlock();
  }

  function emitSearchState() {
    const total = Number(state.response?.numFound) || 0;
    const rows = state.rowsPerPage;
    const totalPages = total === 0 ? 0 : Math.max(1, Math.ceil(total / rows));
    const start = Number(state.response?.start) || 0;
    const currentPage = Math.floor(start / rows) + 1;
    emitControlEvent(SEARCH_RESULTS_EVENTS.STATE, {
      total,
      page: currentPage,
      rowsPerPage: rows,
      totalPages,
    });
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
      emitSearchState();
      return;
    }

    const allDocs = state.response.docs || [];
    const total = state.response.numFound || 0;
    const pageSize = state.rowsPerPage;
    const start = Number(state.response?.start) || 0;
    const currentPage = Math.floor(start / pageSize) + 1;
    const totalPages = total === 0 ? 0 : Math.max(1, Math.ceil(total / pageSize));

    // If backend returns full/unpaged docs, align visible window to `start` + `rows`.
    const shouldSliceByWindow = allDocs.length > pageSize;
    const docs = shouldSliceByWindow
      ? allDocs.slice(start, start + pageSize)
      : allDocs;

    const content = document.createElement('div');
    content.className = 'search-results-content';

    content.append(renderControls());

    const main = document.createElement('div');
    main.className = 'search-results-main';
    main.append(renderToolbar(total, docs.length));
    if (!contextualPageTypeLock) {
      main.append(
        createSearchTabs({
          tabs: getTabs(),
          activeTabKey: state.activeTabKey,
          onChange: (tabKey) => {
            emitControlEvent(SEARCH_RESULTS_EVENTS.TAB_CHANGE, { tab: tabKey });
          },
        }),
      );
    }
    const showEventResultMeta = Boolean(
      contextualPageTypeLock?.pageTypes?.some((pt) => String(pt).trim() === 'Event details'),
    );
    const showExpertResultImage = Boolean(
      contextualPageTypeLock?.pageTypes?.some((pt) => String(pt).trim() === 'Experts Page'),
    );
    main.append(createSearchResultsList({
      docs,
      showEventMeta: showEventResultMeta,
      showExpertImage: showExpertResultImage,
      formatTaxonomyValue: (v) => resolveFacetValueDisplay(String(v), taxonomyLoaded),
    }));

    content.append(main);
    const activeFiltersEl = createSearchActiveFilters({
      selectedFilters: getSelectedFiltersForUi(),
      order: getFilterOrderForUi(),
      formatFilterValue: (v) => resolveFacetValueDisplay(String(v), taxonomyLoaded),
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
    // Only render pagination UI when there is more than one page.
    // (Avoids showing a redundant bar like "Viewing 1-9 of 9" with only Page 1.)
    if (shouldEmbedPaginationHere() && total > 0 && totalPages > 1) {
      root.append(
        createPaginationControls({
          currentPage,
          totalPages,
          totalItems: total,
          rowsPerPage: state.rowsPerPage,
          labels: {
            itemsPerPage: placeholders.itemsPerPage || 'Items per page:',
            viewing: placeholders.viewing || 'Viewing ',
            items: placeholders.items || 'items',
          },
          onPageChange: (page) => {
            emitControlEvent(SEARCH_RESULTS_EVENTS.PAGE_CHANGE, { page });
          },
          onRowsChange: (nextRows) => {
            emitControlEvent(SEARCH_RESULTS_EVENTS.ROWS_CHANGE, { rows: nextRows });
          },
        }),
      );
    }
    emitSearchState();
  };

  loadTaxonomyData().then((t) => {
    taxonomyLoaded = t;
    render();
  });

  const subscriptions = registerEventSubscriptions();

  root.addEventListener('DOMNodeRemovedFromDocument', () => {
    subscriptions.forEach((sub) => sub?.off?.());
  });
  root.append(emptyState('Enter a query to search.'));
  return root;
}
