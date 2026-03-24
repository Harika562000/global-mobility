import ApiClient from './api-client.js';
import { MOCK_SEARCH_RESPONSE } from './lucidworks-mock-data.js';

const baseUrl = 'https://publish-p184787-e1941710.adobeaemcloud.com';

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
   * @param {Record<string, string>} [options.headers] - Optional request headers
   * @returns {Promise<Object>} Lucidworks search response
   */
  /* eslint-disable-next-line class-methods-use-this */
  async fetchSearchResults(options = {}) {
    const {
      q = 'search_term',
      start = 0,
      rows = 10,
    } = options;

    // TODO: Replace with actual API call when integration is ready
    // const params = new URLSearchParams({
    //   q, start: String(start), rows: String(rows), wt: 'json',
    // });
    // const url = `${this.baseUrl}/api/search?${params}`;
    // const result = await this.apiClient.get(url, requestHeaders);
    // return result.ok ? result.data : null;

    // Mock response with query param injected
    const mock = JSON.parse(JSON.stringify(MOCK_SEARCH_RESPONSE));
    mock.responseHeader.params.q = q;
    mock.responseHeader.params.start = String(start);
    mock.responseHeader.params.rows = String(rows);
    mock.debug.rawquerystring = q;
    mock.debug.querystring = q;
    return Promise.resolve(mock);
  }
}
