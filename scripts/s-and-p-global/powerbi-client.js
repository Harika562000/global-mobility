import ApiClient from './api-client.js';

const BASE_URL = 'https://publish-p184787-e1941710.adobeaemcloud.com';

/**
 * Client for Power BI integration.
 * Fetches embed token and URL from AEM backend.
 */
export default class PowerBIClient {
  constructor(options = {}) {
    this.apiClient = new ApiClient();
    this.baseUrl = options.baseUrl || BASE_URL;
  }

  /**
   * Fetches Power BI embed token and embed URL for the given report.
   *
   * @param {string} reportId - The Power BI report ID
   * @param {Record<string, string>} [headers={}] - Optional request headers
   * @returns {Promise<{ ok: boolean, accessToken?: string,
   * embedUrl?: string, expiry?: string, error?: string }>}
   */
  async getEmbedConfig(reportId, headers = {}) {
    if (!reportId) {
      return { ok: false, error: 'Report ID is required' };
    }

    const params = new URLSearchParams({ reportId });
    const url = `${this.baseUrl}/powerbi-embed-token?${params}`;
    const result = await this.apiClient.get(url, headers);

    if (!result.ok) {
      return {
        ok: false,
        error: result.error || 'Failed to fetch Power BI embed configuration',
      };
    }

    const { accessToken, embedUrl, expiry } = result.data;

    if (!accessToken || !embedUrl) {
      return {
        ok: false,
        error: 'Invalid response: missing accessToken or embedUrl',
      };
    }

    return {
      ok: true,
      accessToken,
      embedUrl,
      expiry,
    };
  }
}
