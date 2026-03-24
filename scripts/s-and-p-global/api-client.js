/**
 * Generic API client for third-party integrations.
 * Supports GET and POST with configurable headers per request.
 */
export default class ApiClient {
  /**
   * Makes an API request.
   *
   * @param {string} url - The API endpoint URL
   * @param {Object} options - Request options
   * @param {'GET'|'POST'} options.method - HTTP method (GET or POST)
   * @param {Record<string, string>} [options.headers] - Request headers
   * @param {Object|string} [options.body] - Request body (for POST)
   * @returns {Promise<{ ok: boolean, status: number, data?: any, error?: string }>}
   */
  /* eslint-disable-next-line class-methods-use-this */
  async request(url, options = {}) {
    const { method = 'GET', headers = {}, body } = options;
    const normalizedMethod = method.toUpperCase();

    if (!['GET', 'POST'].includes(normalizedMethod)) {
      return { ok: false, status: 0, error: `Unsupported method: ${method}` };
    }

    const fetchOptions = {
      method: normalizedMethod,
      headers: {
        ...headers,
      },
    };

    if (normalizedMethod === 'POST' && body !== undefined && body !== null) {
      const bodyContent = typeof body === 'string' ? body : JSON.stringify(body);
      fetchOptions.body = bodyContent;
      if (!fetchOptions.headers['Content-Type']) {
        fetchOptions.headers['Content-Type'] = 'application/json';
      }
    }

    try {
      const response = await fetch(url, fetchOptions);
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          data,
          error: response.statusText || 'Request failed',
        };
      }

      return { ok: true, status: response.status, data };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        error: err?.message || 'Network error',
      };
    }
  }

  /**
   * Performs a GET request.
   *
   * @param {string} url - The API endpoint URL
   * @param {Record<string, string>} [headers={}] - Request headers
   * @returns {Promise<{ ok: boolean, status: number, data?: any, error?: string }>}
   */
  async get(url, headers = {}) {
    return this.request(url, { method: 'GET', headers });
  }

  /**
   * Performs a POST request.
   *
   * @param {string} url - The API endpoint URL
   * @param {Object|string} [body] - Request body. Object will be JSON stringified
   * @param {Record<string, string>} [headers={}] - Request headers
   * @returns {Promise<{ ok: boolean, status: number, data?: any, error?: string }>}
   */
  async post(url, body, headers = {}) {
    return this.request(url, { method: 'POST', headers, body });
  }
}
