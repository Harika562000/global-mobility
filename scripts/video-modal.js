/**
 * Video Modal
 * ============================================================
 * Opens a native <video> element inside the existing modal
 * infrastructure (blocks/modal/modal.js) without requiring a
 * fragment URL. Handles ESC key via the <dialog> native behaviour
 * and returns focus to the trigger element on close.
 *
 * Public API:
 *   openVideoModal(videoSrc, opts, triggerEl) → Promise<void>
 */

import { createModal } from '../blocks/modal/modal.js';

/**
 * Creates a <video> element configured for modal playback.
 * Controls are always shown inside the modal so the user can
 * pause / scrub without needing custom overlay buttons.
 *
 * @param {string} src   - URL of the video asset
 * @param {Object} opts  - Options merged from getVariantConfig()
 * @param {boolean} opts.muted
 * @param {boolean} opts.loop
 * @param {string}  opts.ariaLabel
 * @returns {HTMLVideoElement}
 */
function buildModalVideo(src, opts = {}) {
  const {
    muted = false,
    loop = false,
    ariaLabel = 'Video',
  } = opts;

  const video = document.createElement('video');
  video.setAttribute('controls', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-label', ariaLabel);
  video.setAttribute('preload', 'auto');

  // Respect explicit mute preference; default to unmuted for modal playback
  if (muted) {
    video.setAttribute('muted', '');
    video.muted = true;
  }

  if (loop) video.setAttribute('loop', '');

  const source = document.createElement('source');
  source.setAttribute('src', src);

  // Derive MIME type from extension
  const ext = src.match(/\.(\w+)(\?|$)/)?.[1]?.toLowerCase();
  const mimeMap = {
    mp4: 'video/mp4',
    mov: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
  };
  source.setAttribute('type', mimeMap[ext] || 'video/mp4');

  video.append(source);
  return video;
}

/**
 * Opens a video in a modal dialog and returns focus to the trigger
 * element when the modal is closed.
 *
 * @param {string}      videoSrc   - URL of the video to play
 * @param {Object}      [opts={}]  - Options from getVariantConfig()
 * @param {HTMLElement} [triggerEl] - Element that opened the modal (for focus return)
 * @returns {Promise<void>}
 */
async function openVideoModal(videoSrc, opts = {}, triggerEl = null) {
  const video = buildModalVideo(videoSrc, opts);

  // Wrap in a container so createModal() receives an iterable of nodes
  const wrapper = document.createElement('div');
  wrapper.classList.add('video-modal-wrapper');
  wrapper.append(video);

  const { block, showModal } = await createModal([wrapper]);

  // Mark the modal block so video-specific CSS rules can scope cleanly
  block.classList.add('modal--video');

  // Stop playback and return focus when the dialog closes
  const dialog = block.querySelector('dialog');
  if (dialog) {
    dialog.addEventListener(
      'close',
      () => {
        video.pause();
        video.currentTime = 0;
        if (triggerEl) {
          triggerEl.focus();
        }
      },
      { once: true },
    );
  }

  showModal();

  // Begin playback after the modal is visible
  video.play().catch(() => {
    // Autoplay blocked — user can press the native controls play button
  });
}

export default openVideoModal;
