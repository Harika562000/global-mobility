import { getConfigValue } from './configs.js';
import { syncUtmPersistence, getUtmDataLayerFields } from './analytics-utm.js';
import { getPageTypeForTaxonomy } from './taxonomy-metadata.js';

let gtmInjected = false;
let gtagInjected = false;

export function ensureDataLayer() {
  window.dataLayer = window.dataLayer || [];
}

/**
 * Loads the Google Tag Manager container (dynamic equivalent of the official head snippet).
 * Uses config key `google-tag-manager` (GTM container ID): read from localStorage
 * {@link LOCAL_SITE_CONFIG_KEY} first, else configs.json (then cached under that key).
 * @returns {Promise<void>}
 */
export async function loadGTM() {
  if (gtmInjected) return;

  const gtmId = await getConfigValue('google-tag-manager');
  if (!gtmId) return;

  gtmInjected = true;
  ensureDataLayer();
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`;
  document.head.appendChild(script);

  const inlineScript = document.createElement('script');
  inlineScript.textContent = `
    (function(w,d,s,l,i){
      w[l]=w[l]||[];
      w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});
      var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),
          dl=l!='dataLayer'?'&l='+l:'';
      j.async=true;
      j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
      f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${gtmId}');
  `;
  document.head.appendChild(inlineScript);

  /* noscript fallback required by GTM for JS-disabled environments. */
  const noscript = document.createElement('noscript');
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmId}`;
  iframe.height = '0';
  iframe.width = '0';
  iframe.style.cssText = 'display:none;visibility:hidden';
  noscript.appendChild(iframe);
  document.body.insertBefore(noscript, document.body.firstChild);
}

/**
 * Loads gtag.js and runs the default GA4 config.
 * Uses config key `google-tag-analytics` (GA4 measurement ID); same localStorage cache
 * as GTM via {@link LOCAL_SITE_CONFIG_KEY}.
 * @returns {Promise<void>}
 */
export async function loadGoogleAnalytics() {
  if (gtagInjected) return;

  const measurementId = await getConfigValue('google-tag-analytics');
  if (!measurementId) return;

  gtagInjected = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  /* Inline setup mirrors the official GA4 snippet.
     send_page_view: false — pushAnalyticsPageView fires the single enriched hit. */
  const inlineScript = document.createElement('script');
  inlineScript.textContent = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}');
  `;
  document.head.appendChild(inlineScript);
}

/**
 * Loads GTM and the standalone GA4 gtag.js integration.
 * @returns {Promise<void>}
 */
export async function loadGoogleTagManagerAndAnalytics() {
  await loadGTM();
  await loadGoogleAnalytics();
}

/**
 * Pushes a single page_view object to dataLayer (page_type + UTMs).
 * Do not also call gtag('event','page_view').
 * gtag would queue a second dataLayer entry as ['event', 'page_view', ...].
 * GTM and gtag.js both consume the same object-style push.
 */
export function pushAnalyticsPageView() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  ensureDataLayer();
  syncUtmPersistence();
  const utm = getUtmDataLayerFields();

  window.dataLayer.push({
    event: 'page_view',
    page_type: getPageTypeForTaxonomy(document),
    page_location: window.location.href,
    page_path: `${window.location.pathname}${window.location.search}`,
    page_title: document.title,
    ...utm,
  });
}

/**
 * Pushes a named event to dataLayer **without** UTM parameters.
 * Use for events where attribution context is not needed (e.g. error_view).
 *
 * @param {string} eventName GA / GTM event name
 * @param {Record<string, string|number|boolean|undefined>} [eventParams]
 */
export function pushAnalyticsEvent(eventName, eventParams = {}) {
  if (typeof window === 'undefined' || !eventName) return;

  ensureDataLayer();
  const params = { ...eventParams };
  Object.keys(params).forEach((k) => {
    if (params[k] === undefined || params[k] === null) delete params[k];
  });

  window.dataLayer.push({ event: eventName, ...params });
}

/**
 * Pushes a named interaction to dataLayer once (with persisted UTMs).
 * GTM: Custom Event trigger on `event`. Avoids duplicate gtag() array pushes in dataLayer.
 *
 * @param {string} eventName GA / GTM event name (e.g. cta_click, contact_click)
 * @param {Record<string, string|number|boolean|undefined>} [eventParams] Event-specific parameters
 */
export function pushAnalyticsCustomEvent(eventName, eventParams = {}) {
  if (typeof window === 'undefined' || !eventName) return;

  ensureDataLayer();
  syncUtmPersistence();
  const utm = getUtmDataLayerFields();
  const params = { ...eventParams };
  Object.keys(params).forEach((k) => {
    if (params[k] === undefined || params[k] === null) delete params[k];
  });

  window.dataLayer.push({
    event: eventName,
    ...params,
    ...utm,
  });
}
