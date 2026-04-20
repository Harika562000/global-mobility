/**
 * Embed Video Block — Vidyard Player
 *
 * Authoring (Universal Editor model fields):
 *   video   — reference picker (required) — selects a DAM asset whose path
 *             contains the Vidyard video UUID
 *   caption — plain text (optional) — visible caption below the player
 *
 * The block reads the asset URL/path that the reference picker resolves to
 * (rendered as an <a href="…"> or <picture><img src="…"></picture> in the
 * block's authored HTML), extracts the Vidyard UUID, then builds the
 * Vidyard inline-embed markup and lazy-loads the Vidyard embed script.
 */

const VIDYARD_SCRIPT_URL = 'https://play.vidyard.com/embed/v4.js';
const VIDYARD_PLAYER_BASE = 'https://play.vidyard.com';

/**
 * Extracts the Vidyard video UUID from any string that may be:
 *   - A bare UUID                              "abc123XYZ"
 *   - A DAM asset path                         "/content/dam/videos/abc123XYZ.mp4"
 *   - A Vidyard share URL                      "https://share.vidyard.com/watch/abc123XYZ"
 *   - A Vidyard play URL                       "https://play.vidyard.com/abc123XYZ"
 *   - A Vidyard embed / thumbnail URL          "https://play.vidyard.com/abc123XYZ.jpg"
 *
 * The UUID is the last path segment (after stripping known extensions).
 *
 * @param {string} raw - Raw string value from the authored field.
 * @returns {string|null} The extracted UUID, or null if nothing useful found.
 */
function extractVidyardId(raw) {
  if (!raw) return null;

  const trimmed = raw.trim();

  // Derive the last path segment regardless of whether it is a full URL or a path
  let lastSegment = '';
  try {
    // Works for full URLs
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    lastSegment = parts[parts.length - 1] || '';
  } catch {
    // Plain path or bare ID — grab the last slash-separated token
    const parts = trimmed.split('/').filter(Boolean);
    lastSegment = parts[parts.length - 1] || trimmed;
  }

  if (!lastSegment) return null;

  // Strip common media extensions (.mp4, .mov, .jpg, .html, etc.)
  const id = lastSegment.replace(/\.[a-z0-9]+$/i, '');

  // Basic sanity check — Vidyard UUIDs are alphanumeric (and sometimes contain hyphens)
  return /^[\w-]+$/.test(id) ? id : null;
}

/**
 * Lazy-loads the Vidyard embed script once per page.
 * Subsequent calls are no-ops if the script tag already exists.
 * @returns {Promise<void>}
 */
function loadVidyardScript() {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${VIDYARD_SCRIPT_URL}"]`);
    if (existing) {
      // Already injected — wait for load or resolve immediately if already done
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
 * Builds the Vidyard inline-embed player element.
 * Vidyard's embed script automatically upgrades <img data-uuid="…"> tags
 * that carry the class "vidyard-player-embed".
 *
 * @param {string} videoId - Vidyard video UUID.
 * @param {string} caption - Accessible alt text for the player image.
 * @returns {HTMLElement} Wrapper div containing the embed image.
 */
function buildPlayerWrapper(videoId, caption) {
  const wrapper = document.createElement('div');
  wrapper.className = 'embed-video-player-wrapper';

  const img = document.createElement('img');
  img.className = 'vidyard-player-embed';
  img.style.width = '100%';
  img.style.margin = 'auto';
  img.style.display = 'block';
  img.setAttribute('src', `${VIDYARD_PLAYER_BASE}/${videoId}.jpg`);
  img.setAttribute('data-uuid', videoId);
  img.setAttribute('data-v', '4');
  img.setAttribute('data-type', 'inline');
  if (caption) img.setAttribute('alt', caption);

  wrapper.appendChild(img);
  return wrapper;
}

/**
 * Reads the video asset reference from the block DOM.
 *
 * The Universal Editor "reference" field component renders the selected DAM
 * asset as one of:
 *   1. An <a href="/content/dam/…"> anchor (most common for generic assets)
 *   2. A <picture><source …/><img src="/content/dam/…"></picture> element
 *   3. A plain <img src="…"> element
 *
 * @param {HTMLElement} row - The first authored row element.
 * @returns {string} The raw asset href/src string, or empty string if not found.
 */
function readVideoReference(row) {
  if (!row) return '';

  // 1. Anchor element
  const anchor = row.querySelector('a[href]');
  if (anchor) return anchor.getAttribute('href');

  // 2. Picture / img element
  const img = row.querySelector('img[src]');
  if (img) return img.getAttribute('src');

  // 3. Fallback: raw text content (e.g. during local development with a plain table)
  return row.textContent?.trim() || '';
}

export default async function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  // Row 0 — video reference (DAM asset picker)
  const rawVideoValue = readVideoReference(rows[0]);

  // Row 1 — optional caption
  const captionCell = rows[1]?.querySelector('p, div');
  const caption = captionCell?.textContent?.trim() || '';

  const videoId = extractVidyardId(rawVideoValue);

  // Show a visible placeholder when no valid ID can be resolved
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

  container.appendChild(buildPlayerWrapper(videoId, caption));

  if (caption) {
    const captionEl = document.createElement('p');
    captionEl.className = 'embed-video-caption';
    captionEl.textContent = caption;
    container.appendChild(captionEl);
  }

  block.appendChild(container);

  // Lazy-load Vidyard and trigger player rendering
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
