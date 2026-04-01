/**
 * Lottie Loader Utility for EDS Projects
 * Dynamically loads lottie-web from CDN and ensures single instance
 */

let lottiePromise = null;

/**
 * Loads Lottie library from CDN if not already loaded
 * @returns {Promise<object>} Promise that resolves with window.lottie
 */
export async function loadLottie() {
  if (window.lottie) {
    return window.lottie;
  }

  if (lottiePromise) {
    return lottiePromise;
  }

  lottiePromise = new Promise((resolve, reject) => {
    if (window.lottie) {
      resolve(window.lottie);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.9.0/lottie.min.js';
    script.async = true;

    script.onload = () => {
      if (window.lottie) {
        resolve(window.lottie);
      } else {
        reject(new Error('Lottie failed to load properly'));
      }
    };

    script.onerror = () => {
      reject(new Error('Failed to load Lottie from CDN'));
    };

    document.head.appendChild(script);
  });

  return lottiePromise;
}

/**
 * Adds hover play/reverse behavior to a Lottie animation.
 * @param {object} animation - Lottie animation instance
 * @param {HTMLElement} container - Element to bind hover events to
 */
export function bindLottieHover(animation, container) {
  if (!animation || !container) return;

  let reverseCompleteHandler = null;

  container.addEventListener('mouseenter', () => {
    if (reverseCompleteHandler) {
      animation.removeEventListener('complete', reverseCompleteHandler);
      reverseCompleteHandler = null;
    }

    animation.setDirection(1);
    animation.goToAndPlay(0, true);
  });

  container.addEventListener('mouseleave', () => {
    const currentFrame = animation.currentFrame || 0;

    if (currentFrame > 0) {
      animation.setDirection(-1);
      animation.play();

      reverseCompleteHandler = () => {
        animation.stop();
        animation.goToAndStop(0, true);
        animation.setDirection(1);
        animation.removeEventListener('complete', reverseCompleteHandler);
        reverseCompleteHandler = null;
      };

      animation.addEventListener('complete', reverseCompleteHandler);
    } else {
      animation.stop();
      animation.goToAndStop(0, true);
    }
  });
}

export default loadLottie;
