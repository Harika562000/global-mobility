import { eyebrowDecorator, moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Wraps each word in a <span> so they can be animated individually.
 * @param {HTMLElement} el - The element whose text content to wrap
 */
function wrapWords(el) {
  const text = el.textContent.trim();
  el.innerHTML = text
    .split(/\s+/)
    .map((word) => `<span class="word">${word}</span>`)
    .join(' ');
}

/**
 * Animates word spans to active state one by one.
 * @param {HTMLElement} container - Element containing .word spans
 * @param {number} delay - Delay in ms between each word
 */
function animateWords(container, delay = 100) {
  const words = container.querySelectorAll('.word');
  words.forEach((word, i) => {
    setTimeout(() => word.classList.add('active'), i * delay);
  });
}

/**
 * Sets up an IntersectionObserver that fires once when
 * the block reaches the middle of the viewport.
 * @param {HTMLElement} block - The block element to observe
 * @param {Function} callback - Called once when triggered
 */
function observeScrollReveal(block, callback) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          callback();
          observer.disconnect();
        }
      });
    },
    { rootMargin: '0px 0px -50% 0px', threshold: 0 },
  );
  observer.observe(block);
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  
  // Extract fields based on structure (rows or columns)
  let subtitleCol;
  let descriptionCol;
  let ctaCol;

  if (rows.length > 1) {
    // New Row-based structure (1 row per field)
    if (block.classList.contains('default-with-cta')) {
      [ctaCol, descriptionCol] = rows.map((r) => r.firstElementChild);
    } else {
      [subtitleCol, descriptionCol] = rows.map((r) => r.firstElementChild);
    }
  } else if (rows.length === 1) {
    // Single row with columns
    const cols = [...rows[0].querySelectorAll(':scope > div')];
    if (block.classList.contains('default-with-cta')) {
      [ctaCol, descriptionCol] = cols;
    } else {
      [subtitleCol, descriptionCol] = cols;
    }
  }

  // Variations handling
  if (block.classList.contains('full-width-headline') || block.classList.contains('full-width-text')) {
    descriptionCol = descriptionCol || subtitleCol;
    subtitleCol = null;
  }

  // Clear and rebuild block structure to match CSS expectations
  block.innerHTML = '';
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'content-wrapper';

  // 1. Subtitle / Eyebrow
  if (subtitleCol) {
    const subtitleDiv = document.createElement('div');
    subtitleDiv.className = 'subtitle';
    const originalP = subtitleCol.querySelector('p') || subtitleCol;
    const decorated = eyebrowDecorator(originalP, 'accent-color');
    if (decorated) {
      moveInstrumentation(originalP, decorated);
      subtitleDiv.appendChild(decorated);
    } else {
      subtitleDiv.innerHTML = subtitleCol.innerHTML;
    }
    contentWrapper.appendChild(subtitleDiv);
  }

  // 2. CTA
  if (ctaCol) {
    const ctaDiv = document.createElement('div');
    ctaDiv.className = 'cta';
    ctaDiv.innerHTML = ctaCol.innerHTML;
    contentWrapper.appendChild(ctaDiv);
  }

  // 3. Description
  if (descriptionCol) {
    const descriptionDiv = document.createElement('div');
    descriptionDiv.className = 'description';
    descriptionDiv.innerHTML = descriptionCol.innerHTML;
    
    // Animation logic: looks for h4 or p and wraps words
    const animTarget = descriptionDiv.querySelector('h4') || descriptionDiv.querySelector('p');
    if (animTarget) {
      wrapWords(animTarget);
      observeScrollReveal(block, () => animateWords(animTarget));
    }
    contentWrapper.appendChild(descriptionDiv);
  }

  block.appendChild(contentWrapper);
}
