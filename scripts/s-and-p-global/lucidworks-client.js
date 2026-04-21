import ApiClient from './api-client.js';
// import { MOCK_SEARCH_RESPONSE } from './lucidworks-mock-data.js';

const baseUrl = 'https://publish-p184787-e1941575.adobeaemcloud.com';

/**
 * Client for Lucidworks search integration.
 * Uses ApiClient for requests. Returns mock data until integration is configured.
 */
export default class LucidworksClient {
  constructor(options = {}) {
    this.apiClient = new ApiClient();
    this.baseUrl = options.baseUrl || baseUrl;
    this.headers = options.headers || {};
  }

  static escapeLuceneTerm(value) {
    // Keep this conservative: we always wrap values in double quotes.
    // Only escape embedded quotes and backslashes.
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  static buildFq(filters) {
    if (!filters || typeof filters !== 'object') return [];
    const fqs = [];
    Object.entries(filters).forEach(([field, values]) => {
      const arr = Array.isArray(values) ? values.filter(Boolean) : [values].filter(Boolean);
      if (!field || !arr.length) return;
      const terms = arr.map((v) => `"${LucidworksClient.escapeLuceneTerm(v)}"`);
      // Canonical Solr/Lucidworks syntax:
      // - Single: field:("Value")
      // - Multi:  field:("A" OR "B")
      // (AND across facets is achieved by sending multiple fq parameters.)
      fqs.push(`${field}:(${terms.join(' OR ')})`);
    });
    return fqs;
  }

  /**
   * Page-type filter (no local tag param).
   * Published fq shape: attribute_page_type_s:"Experts Page". Encoded colon is %3A.
   * @param {string} pageTypeValue
   * @returns {string}
   */
  static buildPageTypeFq(pageTypeValue) {
    const term = LucidworksClient.escapeLuceneTerm(String(pageTypeValue || '').trim());
    return `attribute_page_type_s:"${term}"`;
  }

  /**
   * One tagged fq per facet field (published Fusion shape, e.g.
   * `{!tag=attribute_pillars_ss}attribute_pillars_ss:"mobility-global:…"`).
   * Single value: `field:"term"`. Multiple on same field: `field:("a" AND "b")` — documents must
   * match every selected value on that multi-valued field.
   * AND across facets = separate fq params per field.
   * @param {string} fieldName - e.g. attribute_product_capability_ss
   * @param {string[]} values - Full indexed tag values (e.g. mobility-global:… paths)
   * @returns {string}
   */
  static buildTaggedFacetFq(fieldName, values) {
    const arr = Array.isArray(values)
      ? [...new Set(values.filter(Boolean))]
      : [];
    if (!fieldName || !arr.length) return '';
    const terms = arr.map((v) => `"${LucidworksClient.escapeLuceneTerm(v)}"`);
    const rhs = arr.length === 1 ? terms[0] : `(${terms.join(' AND ')})`;
    return `{!tag=${fieldName}}${fieldName}:${rhs}`;
  }

  /**
   * Initializes typeahead suggestions.
   *
   * @param {Object} [options] - Options for typeahead
   * @param {string} [options.query] - Optional query to filter suggestions
   * @param {Record<string, string>} [options.headers] - Optional request headers
   * @returns {Promise<string[]>} Typeahead suggestion strings
   */
  /* eslint-disable-next-line class-methods-use-this */
  async initTypeahead(options = {}) {
    const { query } = options;

    // https://publish-p184787-e1941710.adobeaemcloud.com/typeahead?prefix=te
    // TODO: Replace with actual API call when integration is ready
    const url = `${this.baseUrl}/typeahead?prefix=${encodeURIComponent(query || '')}`;
    const result = await this.apiClient.get(url, {});
    return result.ok ? result.data : [];

    // Mock response
    /* if (query) {
      const lower = query.toLowerCase();
      return Promise.resolve(
        MOCK_TYPEAHEAD.filter((s) => s.toLowerCase().includes(lower)),
      );
    }
    return Promise.resolve([...MOCK_TYPEAHEAD]); */
  }

  /**
   * Fetches search results from Lucidworks.
   *
   * @param {Object} options - Search options
   * @param {string} [options.q] - Search query
   * @param {number} [options.start=0] - Start offset
   * @param {number} [options.rows=10] - Number of results
   * @param {string[]} [options.fieldList] - Extra Solr `fl` entries (e.g. event metadata fields).
   *   Appended as repeated `fl` query params; merges with the query profile’s default `fl`.
   * @param {Record<string, string>} [options.headers] - Optional request headers
   * @returns {Promise<Object>} Lucidworks search response
   */
  /* eslint-disable-next-line class-methods-use-this */
  async fetchSearchResults(options = {}) {
    const {
      q = 'search_term',
      start = 0,
      rows = 10,
      filters,
      sort,
      facetFields,
      fieldList,
    } = options;

    // The API is already configured server-side to return facets and docs in a
    // Solr-like format. We only pass the paging + query parameters.
    const params = new URLSearchParams({
      q,
      start: String(start),
      rows: String(rows),
    });

    if (Array.isArray(fieldList) && fieldList.length) {
      fieldList
        .filter(Boolean)
        .forEach((fl) => params.append('fl', String(fl)));
    }

    // Optional: facet configuration per page/template
    if (Array.isArray(facetFields) && facetFields.length) {
      facetFields
        .filter(Boolean)
        .forEach((field) => params.append('facet.field', String(field)));
    }

    // Optional: filtering (AND across facets, OR within facet)
    const fqs = LucidworksClient.buildFq(filters);
    fqs.forEach((fq) => params.append('fq', fq));

    // Optional: sorting (Lucidworks/Solr syntax)
    if (sort) {
      params.set('sort', String(sort));
    }

    const url = `${this.baseUrl}/search-results?${params}`;
    const result = await this.apiClient.get(url, this.headers);
    return result.ok ? result.data : null;
  }

  /**
   * Tag-driven card search: q=*:* + tagged facet fqs
   * + optional page type (Fusion/Solr published shape).
   * Does not use fetchSearchResults — keeps that API unchanged for the main search UI.
   *
   * @param {Object} [options]
   * @param {string} [options.q] - Main query when not using facet filters (e.g. legacy text q)
   * @param {string} [options.pageType] - Sets fq page type
   * @param {Record<string, string[]>} [options.facetFilters]
   *   - Per-field tag values; OR within field, AND across fields
   * @param {number} [options.start=0]
   * @param {number} [options.rows=10]
   * @param {boolean} [options.forInsightsCard]
   *   - Append fl=* and wt=json when no facet filters (legacy path)
   * @returns {Promise<Object|null>}
   */
  async fetchTags(options = {}) {
    const {
      q = '',
      start = 0,
      rows = 10,
      pageType,
      facetFilters,
      forInsightsCard = false,
    } = options;

    const params = new URLSearchParams({
      start: String(start),
      rows: String(rows),
    });

    const hasFacetFilters = facetFilters && typeof facetFilters === 'object'
      && Object.values(facetFilters).some((arr) => Array.isArray(arr) && arr.length > 0);

    if (pageType) {
      if (hasFacetFilters) {
        params.set('q', '*:*');
        params.append('fq', LucidworksClient.buildPageTypeFq(pageType));
        Object.entries(facetFilters).forEach(([field, values]) => {
          if (!Array.isArray(values) || !values.length) return;
          const fq = LucidworksClient.buildTaggedFacetFq(field, values);
          if (fq) params.append('fq', fq);
        });
      } else if (q) {
        params.set('q', q);
        params.append('fq', LucidworksClient.buildPageTypeFq(pageType));
      } else {
        return null;
      }
    } else if (q) {
      params.set('q', q);
    }

    if (hasFacetFilters || forInsightsCard) {
      params.set('fl', '*');
      params.set('wt', 'json');
    }

    const qs = params.toString();
    const url = `${this.baseUrl}/search-results${qs ? `?${qs}` : ''}`;
    const result = await this.apiClient.get(url, this.headers);
    return result.ok ? result.data : null;
  }
}
