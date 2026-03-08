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

  const isTwoCol = block.classList.contains('two-col-text');
  const isDefault = block.classList.contains('default-variation');
  const isFullWidthText = block.classList.contains('full-width-text');
  const isFullWidthHeadline = block.classList.contains('full-width-headline');
  const isDefaultWithCta = block.classList.contains('default-with-cta');

  /**
   * Field Mapping based on JSON structure:
   * row[0] -> eyebrow
   * row[1] -> description (First Column)
   * row[2] -> description2 (Second Column)
   * row[3] -> ctaLabel
   * row[4] -> ctaUrl
   */
  const fieldRows = rows.map((r) => r.firstElementChild);
  const [rowEyebrow, rowDesc1, rowDesc2, rowCtaLabel, rowCtaUrl] = fieldRows;

  // Clear and rebuild block structure
  block.innerHTML = '';
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'content-wrapper';

  // 1. Column 1 (Eyebrow for Default OR First Description for Two-Col)
  if ((isDefault && rowEyebrow) || (isTwoCol && rowDesc1)) {
    const col1Div = document.createElement('div');
    col1Div.className = 'subtitle';
    const source = isDefault ? rowEyebrow : rowDesc1;

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

  // 2. Column 2 (Description 1 for Standard/Headline OR Description 2 for Two-Col)
  const col2Source = isTwoCol ? rowDesc2 : rowDesc1;

  if (col2Source && !isDefaultWithCta) {
    const descriptionDiv = document.createElement('div');
    descriptionDiv.className = 'description';
    descriptionDiv.innerHTML = col2Source.innerHTML;
    moveInstrumentation(col2Source, descriptionDiv);

    // Animation logic (only for specific variations)
    const animTarget = descriptionDiv.querySelector('h4') || descriptionDiv.querySelector('p');
    if (animTarget && (isDefault || isFullWidthHeadline)) {
      wrapWords(animTarget);
      observeScrollReveal(block, () => animateWords(animTarget));
    }
    contentWrapper.appendChild(descriptionDiv);
  }

  // 3. CTA Variation (Description + Button)
  if (isDefaultWithCta) {
    if (rowDesc1) {
      const descriptionDiv = document.createElement('div');
      descriptionDiv.className = 'description';
      descriptionDiv.innerHTML = rowDesc1.innerHTML;
      moveInstrumentation(rowDesc1, descriptionDiv);
      contentWrapper.appendChild(descriptionDiv);
    }

    if (rowCtaLabel && rowCtaUrl) {
      const ctaDiv = document.createElement('div');
      ctaDiv.className = 'cta';
      const labelText = rowCtaLabel.textContent.trim();
      const urlText = rowCtaUrl.textContent.trim();

      if (labelText && urlText) {
        const p = document.createElement('p');
        const a = document.createElement('a');
        a.href = urlText;
        a.title = labelText;
        a.textContent = labelText;
        a.className = 'button primary';
        moveInstrumentation(rowCtaLabel, a);
        p.appendChild(a);
        ctaDiv.appendChild(p);
      }
      contentWrapper.appendChild(ctaDiv);
    }
  }

  block.appendChild(contentWrapper);
}
