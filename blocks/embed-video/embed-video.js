/**
 * Embed Video Block — Vidyard Player
 *
 * Authoring rows (in order):
 *   Row 1 — Video ID or Vidyard share URL
 *   Row 2 — (Optional) Caption / accessible title
 *
 * The block dynamically loads the Vidyard embed script and renders
 * the player inside a responsive 16:9 wrapper.
 */

const VIDYARD_SCRIPT_URL = 'https://play.vidyard.com/embed/v4.js';
const VIDYARD_PLAYER_BASE = 'https://play.vidyard.com';

/**
 * Extracts the Vidyard video UUID from a raw authored value.
 * Accepts:
 *   - A bare UUID:          "abc123"
 *   - A share URL:          "https://share.vidyard.com/watch/abc123"
 *   - A play URL:           "https://play.vidyard.com/abc123"
 *   - An embed URL:         "https://play.vidyard.com/abc123.html"
 * @param {string} raw - Raw text value from the authored row.
 * @returns {string|null} The extracted UUID or null if not found.
 */
function extractVidyardId(raw) {
  if (!raw) return null;

  const trimmed = raw.trim();

  // Attempt to parse as URL
  try {
    const url = new URL(trimmed);
    // e.g. https://share.vidyard.com/watch/<uuid>
    //      https://play.vidyard.com/<uuid>
    //      https://play.vidyard.com/<uuid>.html
    const pathParts = url.pathname.split('/').filter(Boolean);
    const lastSegment = pathParts[pathParts.length - 1];
    if (lastSegment) {
      // Strip optional .html extension
      return lastSegment.replace(/\.html$/i, '');
    }
  } catch {
    // Not a URL — treat as a bare ID
    if (/^[\w-]+$/.test(trimmed)) return trimmed;
  }

  return null;
}

/**
 * Loads the Vidyard embed script once per page.
 * Subsequent calls resolve immediately if the script is already present.
 * @returns {Promise<void>}
 */
function loadVidyardScript() {
  return new Promise((resolve, reject) => {
    // Script already loaded or in progress
    if (document.querySelector(`script[src="${VIDYARD_SCRIPT_URL}"]`)) {
      if (window.VidyardV4) {
        resolve();
      } else {
        // Script tag exists but hasn't finished loading yet — wait for it
        document.querySelector(`script[src="${VIDYARD_SCRIPT_URL}"]`).addEventListener('load', resolve);
        document.querySelector(`script[src="${VIDYARD_SCRIPT_URL}"]`).addEventListener('error', reject);
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
 * Builds the Vidyard player markup.
 * Uses the recommended data-uuid img tag approach so the Vidyard
 * embed script automatically upgrades it to a full player iframe.
 *
 * @param {string} videoId - Vidyard video UUID.
 * @param {string} caption - Accessible caption / title for the video.
 * @returns {HTMLElement} Wrapper element containing the player.
 */
function buildPlayerWrapper(videoId, caption) {
  const wrapper = document.createElement('div');
  wrapper.className = 'embed-video-player-wrapper';

  // Vidyard inline embed — script picks up [data-uuid] img tags
  const img = document.createElement('img');
  img.style.width = '100%';
  img.style.margin = 'auto';
  img.style.display = 'block';
  img.setAttribute('class', 'vidyard-player-embed');
  img.setAttribute('src', `${VIDYARD_PLAYER_BASE}/${videoId}.jpg`);
  img.setAttribute('data-uuid', videoId);
  img.setAttribute('data-v', '4');
  img.setAttribute('data-type', 'inline');
  if (caption) {
    img.setAttribute('alt', caption);
  }

  wrapper.appendChild(img);
  return wrapper;
}

export default async function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  // Row 0 — video ID / URL cell
  const videoCell = rows[0]?.querySelector('p, div');
  const rawVideoValue = videoCell?.textContent?.trim()
    || rows[0]?.textContent?.trim()
    || '';

  // Row 1 — optional caption
  const captionCell = rows[1]?.querySelector('p, div');
  const caption = captionCell?.textContent?.trim() || '';

  const videoId = extractVidyardId(rawVideoValue);

  if (!videoId) {
    // Render a clear placeholder in edit mode; hide gracefully in publish
    block.innerHTML = '';
    const placeholder = document.createElement('p');
    placeholder.className = 'embed-video-placeholder';
    placeholder.textContent = 'Embed Video: Please provide a valid Vidyard video ID or URL.';
    block.appendChild(placeholder);
    return;
  }

  // Clear authored rows and build the player structure
  block.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'embed-video-container';

  const playerWrapper = buildPlayerWrapper(videoId, caption);
  container.appendChild(playerWrapper);

  // Optional visible caption below the player
  if (caption) {
    const captionEl = document.createElement('p');
    captionEl.className = 'embed-video-caption';
    captionEl.textContent = caption;
    container.appendChild(captionEl);
  }

  block.appendChild(container);

  // Load Vidyard script and trigger render
  try {
    await loadVidyardScript();
    // If the Vidyard API is available, ask it to render new players
    if (window.VidyardV4?.api?.renderDOMPlayers) {
      window.VidyardV4.api.renderDOMPlayers();
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Embed Video: could not load Vidyard script.', error);
  }
}
