/**
 * Hero Video Block
 * ============================================================
 * Thin block component that delegates all video decoration to
 * the shared media-decorator pipeline.
 *
 * Supported block class variants (set in the document / UE):
 *   (none)       → 'hero'        full-bleed autoplay background video
 *   hero-modal   → 'hero-modal'  poster shown inline; video opens in modal
 *
 * Additional behaviour classes (combinable):
 *   autoplay, muted, loop, show-controls
 *
 * Authored DOM expected inside the block:
 *   Row 1, Col 1: a link to the video file (.mp4 / .mov / .webm / .ogg)
 *   Row 1, Col 2: (optional) a picture element used as poster image
 */

import { loadCSS } from '../../scripts/aem.js';
import { decorateMedia } from '../../scripts/media-decorator.js';

/**
 * Derives the media variant from the block's CSS class list.
 * Returns 'hero-modal' when that class is present, 'hero' otherwise.
 *
 * @param {HTMLElement} block
 * @returns {string}
 */
function resolveVariant(block) {
  if (block.classList.contains('hero-modal')) return 'hero-modal';
  return 'hero';
}

/**
 * Builds any ad-hoc overrides from explicit block classes so authors
 * can mix in individual playback flags without changing the variant.
 *
 * @param {HTMLElement} block
 * @returns {Object}
 */
function resolveOverrides(block) {
  const overrides = {};
  if (block.classList.contains('autoplay')) overrides.autoplay = true;
  if (block.classList.contains('loop')) overrides.loop = true;
  if (block.classList.contains('show-controls')) {
    overrides.controls = true;
    overrides.customControls = false;
  }
  return overrides;
}

/**
 * Decorate function called by EDS for the hero-video block.
 *
 * @param {HTMLElement} block
 * @returns {Promise<void>}
 */
export default async function decorate(block) {
  // Load block-specific CSS on top of the shared media.css
  // (media-decorator.js loads media.css; this loads hero-video.css)
  await loadCSS(`${window.hlx.codeBasePath}/blocks/hero-video/hero-video.css`);

  const variant = resolveVariant(block);
  const overrides = resolveOverrides(block);

  // Set a meaningful aria-label on the block element itself
  const ariaLabelMap = {
    hero: 'Hero background video',
    'hero-modal': 'Hero video – click to play',
  };
  block.setAttribute('aria-label', ariaLabelMap[variant] || 'Hero video');
  block.setAttribute('role', 'region');

  // Delegate all DOM transformation to the shared pipeline
  await decorateMedia(block, variant, overrides);
}
