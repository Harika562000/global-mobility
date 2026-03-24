/**
 * GSAP Loader Utility for EDS Projects
 * Dynamically loads GSAP 3.12.5 from CDN and ensures single instance
 */

let gsapPromise = null;

/**
 * Loads GSAP library from CDN if not already loaded
 * @returns {Promise<object>} Promise that resolves with window.gsap
 */
export async function loadGSAP() {
  // Return existing GSAP if already loaded
  if (window.gsap) {
    return window.gsap;
  }

  // Return existing promise if already loading
  if (gsapPromise) {
    return gsapPromise;
  }

  // Create new loading promise
  gsapPromise = new Promise((resolve, reject) => {
    // Check again in case GSAP was loaded while promise was being created
    if (window.gsap) {
      resolve(window.gsap);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';
    script.async = true;

    script.onload = () => {
      if (window.gsap) {
        resolve(window.gsap);
      } else {
        reject(new Error('GSAP failed to load properly'));
      }
    };

    script.onerror = () => {
      reject(new Error('Failed to load GSAP from CDN'));
    };

    document.head.appendChild(script);
  });

  return gsapPromise;
}

export default loadGSAP;
