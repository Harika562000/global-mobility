/**
 * News Strip — header sub-component
 *
 * This module does NOT export a block `decorate` function.
 * It is loaded by header.js which passes the already-parsed strip data.
 *
 * Exported API:
 *   parseNewsStrip(el)           — reads a header-news-strip block element
 *   buildNewsStrip({ content, hideStrip }) — mounts the fixed bar into <body>
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the bottom edge of the fixed <header> element in pixels.
 * @returns {number}
 */
function getHeaderBottom() {
  const headerEl = document.querySelector('header');
  if (!headerEl) return 0;
  return headerEl.getBoundingClientRect().bottom;
}

/**
 * Positions the strip bar directly below the header.
 * @param {HTMLElement} stripEl
 */
function positionStrip(stripEl) {
  stripEl.style.top = `${getHeaderBottom()}px`;
}

/**
 * Adjusts body padding-top so page content is not occluded by header + strip.
 * @param {HTMLElement} stripEl
 */
function updateBodyPadding(stripEl) {
  const currentPadding = parseFloat(document.body.style.paddingTop) || 0;
  const stripHeight = stripEl.getBoundingClientRect().height;
  // Only extend if the strip height has not already been added
  if (!stripEl.dataset.paddingAdded) {
    document.body.style.paddingTop = `${currentPadding + stripHeight}px`;
    stripEl.dataset.paddingAdded = 'true';
    stripEl.dataset.addedHeight = String(stripHeight);
  }
}

/**
 * Removes the strip's contribution to body padding-top on close.
 * @param {HTMLElement} stripEl
 */
function restoreBodyPadding(stripEl) {
  const added = parseFloat(stripEl.dataset.addedHeight) || 0;
  const current = parseFloat(document.body.style.paddingTop) || 0;
  document.body.style.paddingTop = `${Math.max(0, current - added)}px`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads a header-news-strip block element (UE or published) and returns a plain
 * data object ready for buildNewsStrip.
 *
 * @param {HTMLElement} el  — the header-news-strip block / row element
 * @returns {{ contentHtml: string, hideStrip: boolean }}
 */
export function parseNewsStrip(el) {
  const byProp = (name) => el.querySelector(`[data-aue-prop="${name}"]`);
  const isUeMode = Boolean(byProp('content') || byProp('hideStrip'));

  if (isUeMode) {
    const contentEl = byProp('content');
    const hideRaw = byProp('hideStrip')?.textContent?.trim().toLowerCase() || 'false';
    return {
      contentHtml: contentEl ? contentEl.innerHTML : '',
      hideStrip: hideRaw === 'true',
    };
  }

  // Published mode: positional columns in the first (and only) row
  const cols = [...el.children].filter((c) => !c.dataset.aueComponent);
  const contentHtml = cols[0]?.innerHTML || '';
  const hideRaw = cols[1]?.textContent?.trim().toLowerCase() || 'false';
  return {
    contentHtml,
    hideStrip: hideRaw === 'true',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mounts the news-strip bar into <body> below the header.
 * Skips mounting if hideStrip is true.
 *
 * @param {{ contentHtml: string, hideStrip: boolean }} data
 */
export function buildNewsStrip({ contentHtml, hideStrip }) {
  if (hideStrip) return;
  if (!contentHtml) return;

  // ── Build DOM ──────────────────────────────────────────────────────────────
  const strip = document.createElement('div');
  strip.className = 'news-strip-bar';
  strip.setAttribute('role', 'region');
  strip.setAttribute('aria-label', 'News notification');

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'news-strip-content';
  contentWrapper.innerHTML = contentHtml;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'news-strip-close';
  closeBtn.setAttribute('aria-label', 'Close notification');
  closeBtn.innerHTML = '<span class="news-strip-close-icon" aria-hidden="true"></span>';

  strip.append(contentWrapper, closeBtn);

  // ── Mount below header ────────────────────────────────────────────────────
  document.body.append(strip);

  const positionAndPad = () => {
    positionStrip(strip);
    updateBodyPadding(strip);
  };

  // Run immediately, then again after header decoration settles
  positionAndPad();
  setTimeout(positionAndPad, 300);

  window.addEventListener('resize', () => positionStrip(strip));

  // ── Close button ──────────────────────────────────────────────────────────
  closeBtn.addEventListener('click', () => {
    restoreBodyPadding(strip);
    strip.classList.add('news-strip-closing');
    strip.addEventListener('transitionend', () => strip.remove(), { once: true });
  });
}
