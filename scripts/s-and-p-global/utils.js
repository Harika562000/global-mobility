import { TABLET_BP } from './constants.js';

/**
 * Subscribe to a media query: call callback(matches) once with the current state
 * and again whenever the query match state changes (e.g. on resize).
 *
 * @param {string} mediaQuery  CSS media query string (e.g. '(max-width: 719.98px)')
 * @param {(matches: boolean) => void} callback  Called with true when query
 *   matches, false otherwise
 */
export function onBreakpointChange(mediaQuery, callback) {
  const mq = window.matchMedia(mediaQuery);
  callback(mq.matches);
  const handleChange = (e) => callback(e.matches);
  if (mq.addEventListener) mq.addEventListener('change', handleChange);
  else mq.addListener(handleChange);
}

/**
 * Subscribe to the mobile/tablet breakpoint (TABLET_BP). Callback receives true when
 * viewport is mobile or tablet (up to 1024px), false when desktop. Useful for layouts
 * that differ by breakpoint.
 *
 * @param {(isMobile: boolean) => void} callback  Called with true on mobile/tablet,
 *   false on desktop
 */
export function onMobileBreakpointChange(callback) {
  onBreakpointChange(TABLET_BP, callback);
}

/* ========================================================================
   Page Content Fetcher & Metadata Utilities
   ======================================================================== */

/**
 * Fetch page content from the defined content source (DA → .plain.html).
 * The content source is configured in fstab.yaml; at runtime every AEM EDS page
 * is available as `<pathname>.plain.html`.
 *
 * @param {string} path  Absolute pathname (e.g. '/fragments/customer-stories/acme')
 * @returns {Promise<{ok: boolean, doc: Document|null, error: string|null}>}
 */
export async function fetchPageContent(path) {
  if (!path || typeof path !== 'string') {
    return { ok: false, doc: null, error: 'Invalid path: a non-empty string is required.' };
  }

  const url = `${path.replace(/\/$/, '')}.plain.html`;

  try {
    const resp = await fetch(url);

    if (!resp.ok) {
      return {
        ok: false,
        doc: null,
        error: `Fetch failed for "${url}" (HTTP ${resp.status}).`,
      };
    }

    const html = await resp.text();
    if (!html.trim()) {
      return { ok: false, doc: null, error: `Empty response from "${url}".` };
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    return { ok: true, doc, error: null };
  } catch (err) {
    return {
      ok: false,
      doc: null,
      error: `Network error fetching "${url}": ${err.message}`,
    };
  }
}

/**
 * Identify and parse block data from a fetched page document.
 * Scans every section for block wrappers and returns a structured array of
 * blocks, each with its name, variant classes, and row data — ready for
 * consumption by dynamic blocks.
 *
 * @param {Document} doc  A Document returned by fetchPageContent
 * @returns {Array<{name:string, variants:string[], rows:Array<string[]>}>}
 */
export function parseBlockData(doc) {
  if (!doc || !doc.body) return [];

  const blocks = [];
  doc.body.querySelectorAll(':scope > div').forEach((section) => {
    section.querySelectorAll(':scope > div').forEach((wrapper) => {
      /* Each block wrapper typically has classes like "product-cards-wrapper" */
      const blockEl = wrapper.firstElementChild;
      if (!blockEl) return;

      const classes = [...blockEl.classList];
      const name = classes[0] || 'unknown';
      const variants = classes.slice(1);

      /* Extract rows → cells as plain text */
      const rows = [...blockEl.children].map(
        (row) => [...row.children].map((cell) => cell.innerHTML.trim()),
      );

      blocks.push({ name, variants, rows });
    });
  });

  return blocks;
}

/**
 * Extract page metadata from a fetched page document.
 * Reads `<meta>` tags from `<head>` (standard AEM EDS metadata)
 * and also extracts any Metadata / Section Metadata block tables found
 * in the document body.
 *
 * @param {Document} doc  A Document returned by fetchPageContent
 * @returns {{ head: Record<string, string>, sections: Array<Record<string, string>> }}
 */
export function extractPageMetadata(doc) {
  const head = {};
  const sections = [];

  if (!doc) return { head, sections };

  /* ---- Head <meta> tags ---- */
  if (doc.head) {
    doc.head.querySelectorAll('meta[name], meta[property]').forEach((meta) => {
      const key = meta.getAttribute('name') || meta.getAttribute('property');
      if (key) head[key] = meta.content || '';
    });
  }

  /* ---- Body: Section Metadata tables ---- */
  if (doc.body) {
    doc.body.querySelectorAll(':scope > div').forEach((section) => {
      const sectionMeta = {};
      section.querySelectorAll(':scope > div').forEach((wrapper) => {
        const blockEl = wrapper.firstElementChild;
        if (!blockEl) return;
        const blockName = blockEl.classList[0] || '';
        if (blockName !== 'section-metadata' && blockName !== 'metadata') return;

        [...blockEl.children].forEach((row) => {
          const cells = [...row.children];
          if (cells.length >= 2) {
            const key = cells[0].textContent.trim().toLowerCase();
            const value = cells[1].innerHTML.trim();
            if (key) sectionMeta[key] = value;
          }
        });
      });

      if (Object.keys(sectionMeta).length) sections.push(sectionMeta);
    });
  }

  return { head, sections };
}

/**
 * Cached page-data fetcher.
 *
 * Combines fetchPageContent, parseBlockData, and extractPageMetadata into a
 * single call that:
 *   1. Fetches page content from the defined source (.plain.html).
 *   2. Identifies and parses data required for dynamic blocks.
 *   3. Extracts and parses page metadata (head + section-metadata).
 *   4. Structures all parsed data for consumption by dynamic blocks.
 *   5. Caches the result in sessionStorage; returns cached copy on repeat calls.
 *   6. Implements error handling for missing or invalid data.
 *
 * @param {string} [url=window.location.pathname]  Page pathname to fetch
 * @returns {Promise<{url:string, blocks:Array, metadata:object, modules:Array}|null>}
 */
export async function getCurrentMeta(url = window.location.pathname) {
  if (!url || typeof url !== 'string') return null;

  const cleanUrl = url.replace(/\/$/, '') || '/';
  const storageKey = `meta:${cleanUrl}`;

  /* ---------- 1. Check sessionStorage cache ---------- */
  try {
    const cached = sessionStorage.getItem(storageKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.modules)) {
        return parsed;
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[getCurrentMeta] cache read error:', e);
  }

  /* ---------- 2. Fetch page content from defined source ---------- */
  const { ok, doc, error } = await fetchPageContent(cleanUrl);
  if (!ok || !doc) {
    // eslint-disable-next-line no-console
    console.warn('[getCurrentMeta]', error);
    return null;
  }

  /* ---------- 3. Parse block data for dynamic blocks ---------- */
  const blocks = parseBlockData(doc);

  /* ---------- 4. Extract page metadata ---------- */
  const metadata = extractPageMetadata(doc);

  /* ---------- 5. Build structured result ---------- */
  const meta = {
    url: cleanUrl,
    blocks,
    metadata,
    /* modules = one entry per section, compatible with legacy cache check */
    modules: blocks.map((b) => ({
      name: b.name,
      variants: b.variants,
      rowCount: b.rows.length,
    })),
  };

  /* ---------- 6. Cache for subsequent calls ---------- */
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(meta));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[getCurrentMeta] cache write error:', e);
  }

  return meta;
}
