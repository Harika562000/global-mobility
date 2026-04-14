/**
 * Media Configuration
 * ============================================================
 * Centralised, config-driven options for every variant that
 * uses the shared media-decorator pipeline.
 *
 * Each variant key maps to an options object consumed by
 * decorateMedia() in media-decorator.js.
 *
 * Supported options (all optional):
 *   autoplay        {boolean}  – autoplay the video (disabled in edit mode)
 *   muted           {boolean}  – mute the video on load
 *   loop            {boolean}  – loop the video
 *   preload         {string}   – 'auto' | 'metadata' | 'none'
 *   controls        {boolean}  – show native browser controls
 *   customControls  {boolean}  – overlay custom play/pause + mute buttons
 *   modalPlayback   {boolean}  – show poster inline; open real video in modal
 *   posterSelector  {string}   – CSS selector used to find a poster picture/img
 *                                inside the authored block cell
 *   ariaLabel       {string}   – fallback aria-label for the <video> element
 *   objectFit       {string}   – CSS object-fit value ('cover' | 'contain' …)
 */

/** Shared defaults applied to every variant unless overridden. */
const BASE_DEFAULTS = {
  autoplay: false,
  muted: true,
  loop: false,
  preload: 'metadata',
  controls: false,
  customControls: true,
  modalPlayback: false,
  posterSelector: 'picture',
  ariaLabel: 'Video',
  objectFit: 'cover',
};

/**
 * Per-variant option sets.
 * Import MEDIA_CONFIG and call getVariantConfig(variant) to resolve.
 */
export const MEDIA_CONFIG = {
  /** Standalone hero-video block – full-bleed, autoplay background video. */
  hero: {
    autoplay: true,
    muted: true,
    loop: true,
    preload: 'auto',
    controls: false,
    customControls: false,
    modalPlayback: false,
    ariaLabel: 'Hero background video',
    objectFit: 'cover',
  },

  /** Hero-video with a poster that opens a modal on click. */
  'hero-modal': {
    autoplay: false,
    muted: true,
    loop: false,
    preload: 'none',
    controls: false,
    customControls: false,
    modalPlayback: true,
    ariaLabel: 'Hero video – click to play',
    objectFit: 'cover',
  },

  /** Teaser / card thumbnail – custom play button, no autoplay. */
  teaser: {
    autoplay: false,
    muted: true,
    loop: false,
    preload: 'metadata',
    controls: false,
    customControls: true,
    modalPlayback: false,
    ariaLabel: 'Teaser video',
    objectFit: 'cover',
  },

  /** Text-media layout – video beside copy. */
  'text-media': {
    autoplay: false,
    muted: true,
    loop: false,
    preload: 'metadata',
    controls: false,
    customControls: true,
    modalPlayback: false,
    ariaLabel: 'Media video',
    objectFit: 'contain',
  },

  /** Carousel slide background. */
  carousel: {
    autoplay: true,
    muted: true,
    loop: true,
    preload: 'auto',
    controls: false,
    customControls: false,
    modalPlayback: false,
    ariaLabel: 'Carousel slide video',
    objectFit: 'cover',
  },

  /** Generic fallback – shows custom controls, no autoplay. */
  default: {
    autoplay: false,
    muted: true,
    loop: false,
    preload: 'metadata',
    controls: false,
    customControls: true,
    modalPlayback: false,
    ariaLabel: 'Video',
    objectFit: 'cover',
  },
};

/**
 * Returns a merged config object for the given variant.
 * Unknown variant names fall back to 'default'.
 *
 * @param {string} [variant='default'] Variant key from MEDIA_CONFIG
 * @param {Object} [overrides={}]      Ad-hoc option overrides
 * @returns {Object} Resolved config
 */
export function getVariantConfig(variant = 'default', overrides = {}) {
  const base = MEDIA_CONFIG[variant] || MEDIA_CONFIG.default;
  return { ...BASE_DEFAULTS, ...base, ...overrides };
}

/**
 * Returns true when the current page is being edited inside Universal Editor.
 * Autoplay and intrusive behaviours should be disabled in edit mode.
 *
 * @returns {boolean}
 */
export function isEditMode() {
  return (
    document.documentElement.classList.contains('adobe-ue-edit')
    || !!document.querySelector('meta[name="ue-edit"]')
    || window.location.search.includes('xwalk-edit=true')
  );
}

export default MEDIA_CONFIG;
