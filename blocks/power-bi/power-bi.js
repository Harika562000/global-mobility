import { loadScript } from '../../scripts/aem.js';
import PowerBIClient from '../../scripts/s-and-p-global/powerbi-client.js';

const POWERBI_SDK_URL = 'https://cdn.jsdelivr.net/npm/powerbi-client@2.23.1/dist/powerbi.min.js';

/**
 * Fetches Power BI embed config and embeds the report.
 *
 * @param {string} reportId - The Power BI report ID
 * @param {HTMLElement} container - Container element for the report
 * @returns {Promise<void>}
 */
async function embedReport(reportId, container) {
  if (!reportId) {
    container.innerHTML = '<p class="powerbi-error">Report ID is missing</p>';
    return;
  }

  try {
    container.innerHTML = '<p class="powerbi-loading">Loading report...</p>';

    const powerBIClient = new PowerBIClient();
    const config = await powerBIClient.getEmbedConfig(reportId);

    if (!config.ok) {
      throw new Error(`Configuration error: ${config.error}`);
    }

    await loadScript(POWERBI_SDK_URL);

    if (!window.powerbi || !window['powerbi-client']) {
      throw new Error('Power BI SDK failed to initialize');
    }

    container.innerHTML = '';

    const { models } = window['powerbi-client'];

    const embedConfig = {
      type: 'report',
      id: reportId,
      tokenType: models.TokenType.Embed,
      accessToken: config.accessToken,
      embedUrl: config.embedUrl,
      settings: {
        filterPaneEnabled: true,
        navContentPaneEnabled: true,
      },
    };

    const report = window.powerbi.embed(container, embedConfig);

    report.off('loaded');
    report.on('loaded', () => {
      // eslint-disable-next-line no-console
      console.log('Power BI report loaded');
    });

    report.off('error');
    report.on('error', (event) => {
      // eslint-disable-next-line no-console
      console.error('Power BI error:', event.detail);
    });
  } catch (error) {
    container.innerHTML = `<p class="powerbi-error">Failed to load report: ${error.message}</p>`;
  }
}

/**
 * Decorates the Power BI block.
 *
 * UE model field order: reportId
 * rows[0] = reportId
 *
 * @param {HTMLElement} block - The block element
 */
export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  const reportIdCell = rows[0]?.querySelector(':scope > div');
  const reportId = reportIdCell?.textContent?.trim()
    || block.querySelector('[data-aue-prop="reportId"]')?.textContent?.trim();

  const container = document.createElement('div');
  container.className = 'powerbi-container';

  block.textContent = '';
  block.appendChild(container);

  // Lazy-load: only embed when block scrolls into view
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      observer.disconnect();
      embedReport(reportId, container);
    }
  }, {
    rootMargin: '200px 0px',
  });

  observer.observe(block);
}
