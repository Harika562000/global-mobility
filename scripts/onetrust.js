/**
 * OneTrust Cookie Consent helpers.
 *
 * Provides utilities to open the OneTrust preference centre and wire
 * footer cookie-preference buttons to open in a new tab (or trigger
 * the OneTrust modal when the SDK is available).
 */

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
