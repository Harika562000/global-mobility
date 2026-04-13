/**
 * Media Decorator
 * ============================================================
 * Shared decoration pipeline for video assets used across
 * hero-video, teaser, text-media, carousel, and any other
 * block that embeds a native <video>.
 *
 * Public API:
 *   isVideoLink(href)                       → boolean
 *   createVideoElement(src, opts)           → HTMLVideoElement
 *   decorateMedia(container, variant, overrides) → Promise<void>
 */

import { loadCSS } from './aem.js';
import { getVariantConfig, isEditMode } from './media-config.js';
import openVideoModal from './video-modal.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Video file extensions recognised as native video assets. */
const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|ogg)(\?.*)?$/i;

/** Maps file extension to MIME type for the <source type> attribute. */
const MIME_MAP = {
  mp4: 'video/mp4',
  mov: 'video/mp4', // QuickTime served as mp4 in browsers
  webm: 'video/webm',
  ogg: 'video/ogg',
};

/**
 * Known AEM publish hostname for this project (derived from fstab.yaml).
 * /content/dam/ assets must be served from publish, not from author or EDS.
 */
const AEM_PUBLISH_HOST = 'publish-p99952-e1559416.adobeaemcloud.com';

/**
 * Resolves a video asset href to a publicly accessible absolute URL.
 *
 * On EDS preview/live pages the browser resolves "/content/dam/..." hrefs
 * against the EDS origin (e.g. *.aem.page), which returns 404 because EDS
 * does not serve DAM assets.  Any URL whose pathname starts with /content/dam/
 * must be rewritten to the AEM publish host so the video can actually load.
 *
 * Handles three cases:
 *   1. Already on publish-* host  → return unchanged
 *   2. On author-* host           → flip author- prefix to publish-
 *   3. On any other host (EDS)    → replace host with AEM_PUBLISH_HOST
 *
 * @param {string} href  Fully resolved href from an <a> element
 * @returns {string}     Publicly accessible video URL
 */
function resolveVideoSrc(href) {
  if (!href) return href;
  try {
    const url = new URL(href);
    if (url.pathname.startsWith('/content/dam/')) {
      if (url.hostname.startsWith('publish-')) {
        // Already on publish — nothing to do
        return href;
      }
      if (url.hostname.startsWith('author-')) {
        // Flip author- → publish- (same program/env IDs)
        url.hostname = url.hostname.replace(/^author-/, 'publish-');
      } else {
        // EDS domain or localhost — rewrite to known publish host
        url.hostname = AEM_PUBLISH_HOST;
        url.port = '';
      }
      return url.toString();
    }
  } catch (e) {
    // Not a parseable URL — return as-is
  }
  return href;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the given href points to a native video asset.
 *
 * @param {string} href
 * @returns {boolean}
 */
export function isVideoLink(href = '') {
  return VIDEO_EXTENSIONS.test(href);
}

/**
 * Derives the MIME type from a video URL.
 *
 * @param {string} src
 * @returns {string}
 */
function getMimeType(src) {
  const match = src.match(/\.(\w+)(\?|$)/);
  return (match && MIME_MAP[match[1].toLowerCase()]) || 'video/mp4';
}

/**
 * Creates a play/pause toggle button.
 *
 * @param {HTMLVideoElement} video
 * @returns {HTMLButtonElement}
 */
function createPlayButton(video) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.classList.add('video-btn', 'play-btn');
  btn.setAttribute('aria-label', 'Play video');

  const updateState = () => {
    const { paused } = video;
    btn.setAttribute('aria-label', paused ? 'Play video' : 'Pause video');
    btn.setAttribute('aria-pressed', String(!paused));
    btn.classList.toggle('is-playing', !paused);
  };

  btn.addEventListener('click', () => {
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  });

  video.addEventListener('play', updateState);
  video.addEventListener('pause', updateState);
  video.addEventListener('ended', updateState);

  // Set initial state
  updateState();
  return btn;
}

/**
 * Creates a mute/unmute toggle button.
 *
 * @param {HTMLVideoElement} video
 * @returns {HTMLButtonElement}
 */
function createMuteButton(video) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.classList.add('video-btn', 'mute-btn');

  const updateState = () => {
    const muted = video.muted || video.volume === 0;
    btn.setAttribute('aria-label', muted ? 'Unmute video' : 'Mute video');
    btn.setAttribute('aria-pressed', String(muted));
    btn.classList.toggle('is-muted', muted);
  };

  btn.addEventListener('click', () => {
    video.muted = !video.muted;
    updateState();
  });

  video.addEventListener('volumechange', updateState);
  updateState();
  return btn;
}

// ---------------------------------------------------------------------------
// Core builders
// ---------------------------------------------------------------------------

/**
 * Creates a configured <video> element with a <source> child.
 * Does NOT append it to the DOM.
 *
 * @param {string}  src   - Absolute or relative URL to the video file
 * @param {Object}  opts  - Options resolved from getVariantConfig()
 * @param {boolean} opts.autoplay
 * @param {boolean} opts.muted
 * @param {boolean} opts.loop
 * @param {string}  opts.preload
 * @param {boolean} opts.controls
 * @param {string}  opts.ariaLabel
 * @param {string}  opts.objectFit
 * @returns {HTMLVideoElement}
 */
export function createVideoElement(src, opts = {}) {
  const {
    autoplay = false,
    muted = true,
    loop = false,
    preload = 'metadata',
    controls = false,
    ariaLabel = 'Video',
    objectFit = 'cover',
  } = opts;

  const video = document.createElement('video');
  video.setAttribute('aria-label', ariaLabel);
  video.setAttribute('preload', preload);
  video.style.setProperty('--video-object-fit', objectFit);

  if (muted) video.setAttribute('muted', '');
  video.muted = muted; // property + attribute for cross-browser consistency

  if (loop) video.setAttribute('loop', '');
  if (controls) video.setAttribute('controls', '');

  // Autoplay is disabled in edit mode to prevent disruptive behaviour
  if (autoplay && !isEditMode()) {
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
  }

  const source = document.createElement('source');
  source.setAttribute('src', src);
  source.setAttribute('type', getMimeType(src));
  video.append(source);

  return video;
}

/**
 * Wraps a <video> (and optional poster picture) inside a .video-wrapper div,
 * optionally adding .video-controls for custom play/mute buttons.
 *
 * @param {HTMLVideoElement} video
 * @param {HTMLElement|null} posterEl  - Existing <picture> or <img> to reuse as poster
 * @param {Object}           opts      - Resolved variant config
 * @returns {HTMLDivElement} .video-wrapper
 */
function buildVideoWrapper(video, posterEl, opts) {
  const { customControls } = opts;

  const wrapper = document.createElement('div');
  wrapper.classList.add('video-wrapper');

  if (posterEl) {
    wrapper.append(posterEl);
  }
  wrapper.append(video);

  if (customControls) {
    const controls = document.createElement('div');
    controls.classList.add('video-controls');
    controls.append(createPlayButton(video));
    controls.append(createMuteButton(video));
    wrapper.append(controls);
  }

  return wrapper;
}

/**
 * Builds the modal-playback variant: keeps a poster <picture> visible inline
 * and attaches a play-trigger button. On click, opens the video in a modal.
 *
 * @param {string}      videoSrc
 * @param {HTMLElement} posterEl
 * @param {HTMLElement} linkEl    - Original <a> element (for focus return)
 * @param {Object}      opts
 * @returns {HTMLDivElement} .video-wrapper with poster + play trigger
 */
function buildModalPlaybackWrapper(videoSrc, posterEl, linkEl, opts) {
  const { ariaLabel } = opts;

  const wrapper = document.createElement('div');
  wrapper.classList.add('video-wrapper', 'video-wrapper--modal');

  if (posterEl) {
    wrapper.append(posterEl);
  }

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.classList.add('video-btn', 'video-play-trigger');
  trigger.setAttribute('aria-label', ariaLabel || 'Play video');

  trigger.addEventListener('click', () => {
    openVideoModal(videoSrc, opts, trigger);
  });

  wrapper.append(trigger);
  return wrapper;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Scans `container` for <a> links whose href ends with a video extension,
 * then replaces each link (or its wrapping <p>) with a decorated .video-wrapper.
 *
 * @param {HTMLElement} container - Block element to scan
 * @param {string}      [variant='default'] - Variant key from MEDIA_CONFIG
 * @param {Object}      [overrides={}]      - Ad-hoc option overrides
 * @returns {Promise<void>}
 */
export async function decorateMedia(container, variant = 'default', overrides = {}) {
  // Load shared media styles
  await loadCSS(`${window.hlx.codeBasePath}/styles/media.css`);

  const opts = getVariantConfig(variant, overrides);
  const videoLinks = [...container.querySelectorAll('a[href]')].filter((a) => isVideoLink(a.href));

  if (!videoLinks.length) return;

  videoLinks.forEach((link) => {
    const videoSrc = resolveVideoSrc(link.href);

    // Find a poster picture/img within the same cell or block
    const posterSelector = opts.posterSelector || 'picture';
    const posterEl = link.closest('div')?.querySelector(posterSelector)
      || container.querySelector(posterSelector)
      || null;

    // Detach poster from its current position so we can re-attach inside wrapper
    if (posterEl) {
      posterEl.remove();
    }

    // Decide which wrapper to build
    let wrapper;

    if (opts.modalPlayback) {
      wrapper = buildModalPlaybackWrapper(videoSrc, posterEl, link, opts);
    } else {
      const video = createVideoElement(videoSrc, opts);
      wrapper = buildVideoWrapper(video, posterEl, opts);
    }

    // Replace the <a> or its wrapping <p> with the wrapper
    const parent = link.parentElement;
    if (parent && parent.tagName === 'P' && parent.children.length === 1) {
      parent.replaceWith(wrapper);
    } else {
      link.replaceWith(wrapper);
    }
  });
}
