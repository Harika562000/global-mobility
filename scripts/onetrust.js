/**
 * OneTrust Cookie Consent helpers.
 *
 * Dynamically injects the OneTrust SDK script using the domain-script ID
 * read from configs.json (key: "onetrust-domain-script"), then provides
 * utilities to open the preference centre and wire footer cookie buttons.
 */

import { getConfigValue } from './configs.js';

/** CDN URL for the OneTrust stub script. */
const ONETRUST_CDN = 'https://cdn.cookielaw.org/scripttemplates/otSDKStub.js';

/** Config key that holds the OneTrust data-domain-script UUID. */
const CONFIG_KEY = 'onetrust-domain-script';

/**
 * Injects the OneTrust SDK <script> tag into <head> using the domain-script
 * UUID from configs.json.  The mandatory OptanonWrapper stub is also injected.
 * Resolves immediately if the script is already present or no UUID is found.
 *
 * @returns {Promise<void>}
 */
export async function loadOneTrust() {
  // Avoid double-injection
  if (document.querySelector(`script[src="${ONETRUST_CDN}"]`)) return;

  const domainScript = await getConfigValue(CONFIG_KEY);
  if (!domainScript) {
    // eslint-disable-next-line no-console
    console.warn('OneTrust: no domain-script UUID found in configs.json (key: onetrust-domain-script)');
    return;
  }

  // Inject OptanonWrapper stub first (OneTrust calls it after consent is set)
  const wrapperScript = document.createElement('script');
  wrapperScript.type = 'text/javascript';
  wrapperScript.textContent = 'function OptanonWrapper() {}';
  document.head.insertBefore(wrapperScript, document.head.firstChild);

  // Inject the OneTrust SDK stub as the very first element in <head>
  await new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = ONETRUST_CDN;
    script.type = 'text/javascript';
    script.charset = 'UTF-8';
    script.setAttribute('data-domain-script', domainScript);
    script.onload = resolve;
    script.onerror = resolve; // resolve on error too — non-blocking
    document.head.insertBefore(script, document.head.firstChild);
  });
}

/**
 * Opens the OneTrust preference centre modal when the SDK is available,
 * or falls back to opening the button's href in a new tab.
 *
 * @param {MouseEvent} [e] - The click event (optional).
 */
export function openCookiePreferences(e) {
  if (e) e.preventDefault();

  if (typeof window.OneTrust !== 'undefined') {
    window.OneTrust.ToggleInfoDisplay();
  } else if (e && e.currentTarget) {
    const { href } = e.currentTarget;
    if (href && href !== '#' && !href.endsWith('#')) {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  }
}

/**
 * Wires all [data-action="cookie-preferences"] anchors found within the
 * given root to openCookiePreferences and ensures they open in a new tab
 * as a fallback.
 *
 * @param {Document|Element} [root=document] - The root element to search within.
 */
export function initCookieButtons(root = document) {
  root.querySelectorAll('a[data-action="cookie-preferences"]').forEach((btn) => {
    btn.addEventListener('click', openCookiePreferences);
    btn.setAttribute('target', '_blank');
    btn.setAttribute('rel', 'noopener noreferrer');
  });
}
