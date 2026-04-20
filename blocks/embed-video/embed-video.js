/**
 * Embed Video Block — Vidyard Player
 *
 * Authoring (Universal Editor model fields):
 *   video     — reference picker (required) — DAM asset whose path/name
 *               contains the Vidyard video UUID
 *   embedType — select (default: "inline") — "inline" or "iframe"
 *   caption   — plain text (optional) — visible caption below the player
 *
 * Inline  → renders <img class="vidyard-player-embed" data-type="inline">
 *           and lazy-loads the Vidyard embed script (v4.js) to upgrade it.
 * iFrame  → renders <iframe src="https://play.vidyard.com/<uuid>">
 *           directly in a 16:9 wrapper — no Vidyard script required.
 */

const VIDYARD_SCRIPT_URL = 'https://play.vidyard.com/embed/v4.js';
const VIDYARD_PLAYER_BASE = 'https://play.vidyard.com';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts the Vidyard video UUID from any of these formats:
 *   - Bare UUID:                "PwgGGncrTE8oGEAnqBKmvw"
 *   - DAM asset path:           "/content/dam/videos/PwgGGncrTE8oGEAnqBKmvw.mp4"
 *   - Vidyard share URL:        "https://share.vidyard.com/watch/PwgGGncrTE8oGEAnqBKmvw"
 *   - Vidyard play URL:         "https://play.vidyard.com/PwgGGncrTE8oGEAnqBKmvw"
 *   - Vidyard thumbnail URL:    "https://play.vidyard.com/PwgGGncrTE8oGEAnqBKmvw.jpg"
 *
 * @param {string} raw - Raw string from the authored field.
 * @returns {string|null} UUID string, or null if not extractable.
 */
function extractVidyardId(raw) {
  if (!raw) return null;

  const trimmed = raw.trim();
  let lastSegment = '';

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    lastSegment = parts[parts.length - 1] || '';
  } catch {
    const parts = trimmed.split('/').filter(Boolean);
    lastSegment = parts[parts.length - 1] || trimmed;
  }

  if (!lastSegment) return null;

  // Remove file extension (.mp4, .jpg, .html, etc.)
  const id = lastSegment.replace(/\.[a-z0-9]+$/i, '');

  return /^[\w-]+$/.test(id) ? id : null;
}

/**
 * Reads the video asset reference from the first block row.
 * The UE "reference" component renders as:
 *   1. <a href="/content/dam/…">  (generic DAM asset)
 *   2. <picture><img src="…"></picture>  (image asset)
 *   3. Raw text content (local dev / plain table)
 *
 * @param {Element} row
 * @returns {string}
 */
function readVideoReference(row) {
  if (!row) return '';
  const anchor = row.querySelector('a[href]');
  if (anchor) return anchor.getAttribute('href');
  const img = row.querySelector('img[src]');
  if (img) return img.getAttribute('src');
  return row.textContent?.trim() || '';
}

/**
 * Reads the plain-text value from a block row cell.
 *
 * @param {Element} row
 * @returns {string}
 */
function readTextRow(row) {
  if (!row) return '';
  const cell = row.querySelector('p, div');
  return (cell ? cell.textContent : row.textContent)?.trim() || '';
}

// ─── Inline embed ─────────────────────────────────────────────────────────────

/**
 * Lazy-loads the Vidyard embed script once per page.
 * @returns {Promise<void>}
 */
function loadVidyardScript() {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${VIDYARD_SCRIPT_URL}"]`);
    if (existing) {
      if (window.VidyardV4) {
        resolve();
      } else {
        existing.addEventListener('load', resolve);
        existing.addEventListener('error', reject);
      }
      return;
    }

    const script = document.createElement('script');
    script.src = VIDYARD_SCRIPT_URL;
    script.async = true;
    script.addEventListener('load', resolve);
    script.addEventListener('error', () => reject(new Error('Failed to load Vidyard script')));
    document.head.appendChild(script);
  });
}

/**
 * Builds the Vidyard inline-embed element.
 * Vidyard's v4 script upgrades <img class="vidyard-player-embed"> tags.
 *
 * @param {string} videoId - Vidyard UUID.
 * @param {string} caption - Alt text / accessible label.
 * @returns {HTMLElement} Wrapper div.
 */
function buildInlineWrapper(videoId, caption) {
  const wrapper = document.createElement('div');
  wrapper.className = 'embed-video-player-wrapper';

  const img = document.createElement('img');
  img.className = 'vidyard-player-embed';
  img.style.cssText = 'width:100%;margin:auto;display:block;';
  img.setAttribute('src', `${VIDYARD_PLAYER_BASE}/${videoId}.jpg`);
  img.setAttribute('data-uuid', videoId);
  img.setAttribute('data-v', '4');
  img.setAttribute('data-type', 'inline');
  if (caption) img.setAttribute('alt', caption);

  wrapper.appendChild(img);
  return wrapper;
}

// ─── iFrame embed ─────────────────────────────────────────────────────────────

/**
 * Builds a native <iframe> embed for the Vidyard player.
 * No Vidyard script dependency — works in any CSP environment.
 *
 * @param {string} videoId - Vidyard UUID.
 * @param {string} caption - Accessible title attribute for the iframe.
 * @returns {HTMLElement} Wrapper div.
 */
function buildIframeWrapper(videoId, caption) {
  const wrapper = document.createElement('div');
  wrapper.className = 'embed-video-iframe-wrapper';

  const iframe = document.createElement('iframe');
  iframe.src = `${VIDYARD_PLAYER_BASE}/${videoId}`;
  iframe.setAttribute('title', caption || 'Vidyard video player');
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('frameborder', '0');

  wrapper.appendChild(iframe);
  return wrapper;
}

// ─── Block decorator ──────────────────────────────────────────────────────────

export default async function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  // Row 0 — video asset reference
  const rawVideo = readVideoReference(rows[0]);

  // Row 1 — embed type ("inline" | "iframe"), defaults to "inline"
  const embedType = readTextRow(rows[1]) || 'inline';

  // Row 2 — optional caption
  const caption = readTextRow(rows[2]) || '';

  const videoId = extractVidyardId(rawVideo);

  // Guard: no valid Vidyard UUID found
  if (!videoId) {
    block.innerHTML = '';
    const placeholder = document.createElement('p');
    placeholder.className = 'embed-video-placeholder';
    placeholder.textContent = 'Embed Video: No valid Vidyard video asset selected.';
    block.appendChild(placeholder);
    return;
  }

  // Replace authored rows with player structure
  block.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'embed-video-container';

  if (embedType === 'iframe') {
    // ── iFrame path ──────────────────────────────────────────────────
    container.appendChild(buildIframeWrapper(videoId, caption));
  } else {
    // ── Inline path (default) ────────────────────────────────────────
    container.appendChild(buildInlineWrapper(videoId, caption));
  }

  if (caption) {
    const captionEl = document.createElement('p');
    captionEl.className = 'embed-video-caption';
    captionEl.textContent = caption;
    container.appendChild(captionEl);
  }

  block.appendChild(container);

  // For inline embeds, lazy-load the Vidyard script and trigger rendering
  if (embedType !== 'iframe') {
    try {
      await loadVidyardScript();
      if (window.VidyardV4?.api?.renderDOMPlayers) {
        window.VidyardV4.api.renderDOMPlayers();
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Embed Video: could not load Vidyard script.', error);
    }
  }
}
