/**
 * News Strip block
 * Renders a sticky yellow notification bar below the site header.
 *
 * Block table structure (published / authored mode):
 *   Row 1, Col 1: RTE content  (rich text message)
 *   Row 1, Col 2: hideStrip    (Boolean — "true" hides the bar, "false"/empty shows it)
 *
 * UE mode: fields are read via data-aue-prop attributes.
 */

/**
 * Calculates the bottom edge of the fixed <header> element.
 * @returns {number} Pixel distance from viewport top to the bottom of the header.
 */
function getHeaderBottom() {
  const headerEl = document.querySelector('header');
  if (!headerEl) return 0;
  const rect = headerEl.getBoundingClientRect();
  return rect.bottom;
}

/**
 * Positions the strip immediately below the header.
 * @param {HTMLElement} stripEl - The .news-strip-bar element.
 */
function positionStrip(stripEl) {
  const top = getHeaderBottom();
  stripEl.style.top = `${top}px`;
}

/**
 * Updates body padding so page content is not hidden behind header + strip.
 * @param {HTMLElement|null} stripEl - The .news-strip-bar element, or null when closed.
 */
function updateBodyPadding(stripEl) {
  const headerEl = document.querySelector('header');
  const headerBottom = headerEl ? parseFloat(getComputedStyle(document.body).paddingTop) || 0 : 0;
  const stripHeight = stripEl ? stripEl.getBoundingClientRect().height : 0;
  // Add strip height on top of the existing header-driven body padding
  const currentPadding = headerBottom;
  document.body.style.paddingTop = `${currentPadding + stripHeight}px`;
}

/**
 * Removes the extra strip height from body padding when the strip is dismissed.
 * @param {number} stripHeight - Height of the strip in pixels.
 */
function removeBodyPadding(stripHeight) {
  const current = parseFloat(document.body.style.paddingTop) || 0;
  const next = Math.max(0, current - stripHeight);
  document.body.style.paddingTop = `${next}px`;
}

export default function decorate(block) {
  // ── Parse authored fields ────────────────────────────────────────────────

  // UE mode: fields carry data-aue-prop attributes
  const byProp = (name) => block.querySelector(`[data-aue-prop="${name}"]`);
  const isUeMode = Boolean(byProp('content') || byProp('hideStrip'));

  let contentEl;
  let shouldHide;

  if (isUeMode) {
    contentEl = byProp('content');
    const hideRaw = byProp('hideStrip')?.textContent?.trim().toLowerCase() || 'false';
    shouldHide = hideRaw === 'true';
  } else {
    // Published mode: positional columns in first row
    const firstRow = block.children[0];
    const cols = firstRow ? [...firstRow.children] : [];
    contentEl = cols[0] || null;
    const hideRaw = cols[1]?.textContent?.trim().toLowerCase() || 'false';
    shouldHide = hideRaw === 'true';
  }

  // If hideStrip === true, remove the block wrapper from DOM entirely
  if (shouldHide) {
    block.classList.add('hide-strip');
  }

  // ── Build strip markup ───────────────────────────────────────────────────

  const strip = document.createElement('div');
  strip.className = 'news-strip-bar';
  strip.setAttribute('role', 'region');
  strip.setAttribute('aria-label', 'News notification');

  // Content area
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'news-strip-content';

  if (contentEl) {
    // Clone the authored rich-text content
    const cloned = contentEl.cloneNode(true);
    cloned.removeAttribute('data-aue-prop');
    contentWrapper.append(cloned);
  }

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'news-strip-close';
  closeBtn.setAttribute('aria-label', 'Close notification');
  closeBtn.innerHTML = '<span class="news-strip-close-icon" aria-hidden="true"></span>';

  strip.append(contentWrapper, closeBtn);

  // ── Inject strip into <body> as a fixed element ──────────────────────────

  document.body.append(strip);

  // Position below header once header is likely rendered
  const positionWhenReady = () => {
    positionStrip(strip);
    updateBodyPadding(strip);
  };

  // Run immediately and also after a short delay for header async decoration
  positionWhenReady();
  setTimeout(positionWhenReady, 300);

  // Reposition on window resize
  window.addEventListener('resize', () => {
    positionStrip(strip);
  });

  // ── Close button interaction ─────────────────────────────────────────────

  closeBtn.addEventListener('click', () => {
    const stripHeight = strip.getBoundingClientRect().height;
    strip.classList.add('news-strip-closing');
    strip.addEventListener('transitionend', () => {
      strip.remove();
      removeBodyPadding(stripHeight);
    }, { once: true });
  });

  // ── Clear the original block content ────────────────────────────────────
  block.textContent = '';
}
