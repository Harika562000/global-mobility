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
  let description2Col; // For two-col-text
  let ctaCol;
  let ctaLabel;
  let ctaUrl;

  const isDefaultWithCta = block.classList.contains('default-with-cta');
  const isTwoCol = block.classList.contains('two-col-text');
  const isDefault = block.classList.contains('default-variation');
  const isFullWidthText = block.classList.contains('full-width-text');
  const isFullWidthHeadline = block.classList.contains('full-width-headline');

  // Map rows to properties
  const fieldRows = rows.map((r) => r.firstElementChild);
  
  if (isDefaultWithCta) {
    [ctaLabel, ctaUrl, descriptionCol] = fieldRows;
  } else if (isTwoCol) {
    [descriptionCol, description2Col] = fieldRows;
  } else if (isFullWidthText || isFullWidthHeadline) {
    [descriptionCol] = fieldRows;
  } else if (isDefault) {
    [subtitleCol, descriptionCol] = fieldRows;
  } else {
    // Fallback for column-based or legacy
    const cols = rows[0]?.querySelectorAll(':scope > div') || [];
    [subtitleCol, descriptionCol] = cols;
  }

  // Clear and rebuild block structure to match CSS expectations
  block.innerHTML = '';
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'content-wrapper';

  // 1. Column 1 (Subtitle/Eyebrow OR First Description)
  if (subtitleCol || (isTwoCol && descriptionCol)) {
    const col1Div = document.createElement('div');
    col1Div.className = 'subtitle'; // Using 'subtitle' class to match existing CSS column 1 styling
    
    const source = subtitleCol || descriptionCol;
    if (isDefault) {
      const originalP = source.querySelector('p') || source;
      const decorated = eyebrowDecorator(originalP, 'accent-color');
      if (decorated) {
        moveInstrumentation(originalP, decorated);
        col1Div.appendChild(decorated);
      } else {
        col1Div.innerHTML = source.innerHTML;
      }
    } else {
      col1Div.innerHTML = source.innerHTML;
      moveInstrumentation(source, col1Div);
    }
    contentWrapper.appendChild(col1Div);
  }

  // 2. CTA (Button)
  if (isDefaultWithCta && (ctaCol || (ctaLabel && ctaUrl))) {
    const ctaDiv = document.createElement('div');
    ctaDiv.className = 'cta';
    if (ctaLabel && ctaUrl) {
      const labelText = ctaLabel.textContent.trim();
      const urlText = ctaUrl.textContent.trim();
      if (labelText && urlText) {
        const p = document.createElement('p');
        const a = document.createElement('a');
        a.href = urlText;
        a.title = labelText;
        a.textContent = labelText;
        a.className = 'button primary';
        moveInstrumentation(ctaLabel, a);
        p.appendChild(a);
        ctaDiv.appendChild(p);
      }
    } else if (ctaCol) {
      ctaDiv.innerHTML = ctaCol.innerHTML;
    }
    contentWrapper.appendChild(ctaDiv);
  }

  // 3. Column 2 (Primary Description OR Second Column Content)
  const col2Source = isTwoCol ? description2Col : descriptionCol;
  if (col2Source) {
    const descriptionDiv = document.createElement('div');
    descriptionDiv.className = 'description';
    descriptionDiv.innerHTML = col2Source.innerHTML;
    moveInstrumentation(col2Source, descriptionDiv);
    
    // Animation logic (standard reveal)
    const animTarget = descriptionDiv.querySelector('h4') || descriptionDiv.querySelector('p');
    if ((isDefault || isFullWidthHeadline) && animTarget) {
      wrapWords(animTarget);
      observeScrollReveal(block, () => animateWords(animTarget));
    }
    contentWrapper.appendChild(descriptionDiv);
  }

  block.appendChild(contentWrapper);
}
