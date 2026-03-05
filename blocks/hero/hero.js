import { moveInstrumentation } from '../../scripts/scripts.js';
import { decorateButtons } from '../../scripts/aem.js';

/**
 * Maps block rows to named fields based on the hero model field order.
 * The `classes` field is applied as a CSS class by the block loader and is NOT a content row.
 * Remaining model fields are delivered as single-column rows, one per field, in order.
 */
function readBlockFields(block) {
  const fieldNames = [
    'image', 'imageAlt', 'eyebrow', 'heading', 'description',
    'ctaLabel', 'ctaUrl', 'secondaryCtaLabel', 'secondaryCtaUrl',
  ];
  const fields = {};
  [...block.children].forEach((row, index) => {
    if (index >= fieldNames.length) return;
    const cols = [...row.children];
    if (cols.length) {
      const [col] = cols;
      fields[fieldNames[index]] = col;
    }
  });
  return fields;
}

export default function decorate(block) {
  const section = block.closest('.section');
  if (section && section.classList.contains('bg-light-grey')) {
    section.classList.add('hero-section');
  }

  const isBlackColoredRight = block.classList.contains('hero-black-colored-right');
  const isTwoColoredRight = block.classList.contains('hero-two-colored-right');
  const isEmAccent = !isTwoColoredRight && !isBlackColoredRight;

  const fields = readBlockFields(block);

  // Image
  const picture = fields.image?.querySelector('picture');
  if (picture) {
    const img = picture.querySelector('img');
    const altText = fields.imageAlt?.textContent?.trim();
    if (img && altText) img.setAttribute('alt', altText);
  }

  // Content wrapper
  const contentWrapper = document.createElement('div');
  if (isEmAccent) {
    contentWrapper.className = 'hero-em-accent-content';
  } else if (isTwoColoredRight) {
    contentWrapper.className = 'hero-two-colored-right-content';
  } else if (isBlackColoredRight) {
    contentWrapper.className = 'hero-black-colored-right-content';
  }

  // Eyebrow
  const eyebrowText = fields.eyebrow?.textContent?.trim();
  if (eyebrowText) {
    const eyebrowP = document.createElement('p');
    eyebrowP.className = 'eye-brow-text';
    eyebrowP.textContent = eyebrowText;
    if (fields.eyebrow) moveInstrumentation(fields.eyebrow, eyebrowP);
    contentWrapper.appendChild(eyebrowP);
  }

  // Heading
  if (fields.heading) {
    const heading = fields.heading.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
      moveInstrumentation(fields.heading, heading);
      contentWrapper.appendChild(heading);
    } else if (fields.heading.innerHTML.trim()) {
      const h1 = document.createElement('h1');
      h1.innerHTML = fields.heading.innerHTML;
      moveInstrumentation(fields.heading, h1);
      contentWrapper.appendChild(h1);
    }
  }

  // Description
  if (fields.description) {
    const descChildren = [...fields.description.children];
    if (descChildren.length) {
      moveInstrumentation(fields.description, descChildren[0]);
      descChildren.forEach((child) => contentWrapper.appendChild(child));
    } else if (fields.description.textContent.trim()) {
      const p = document.createElement('p');
      p.textContent = fields.description.textContent.trim();
      moveInstrumentation(fields.description, p);
      contentWrapper.appendChild(p);
    }
  }

  // Primary CTA
  const ctaLabel = fields.ctaLabel?.textContent?.trim();
  const ctaUrl = fields.ctaUrl?.textContent?.trim();
  if (ctaLabel && ctaUrl) {
    const p = document.createElement('p');
    const strong = document.createElement('strong');
    const a = document.createElement('a');
    a.href = ctaUrl;
    a.title = ctaLabel;
    a.textContent = ctaLabel;
    strong.appendChild(a);
    p.appendChild(strong);
    contentWrapper.appendChild(p);
  }

  // Secondary CTA
  const secondaryLabel = fields.secondaryCtaLabel?.textContent?.trim();
  const secondaryUrl = fields.secondaryCtaUrl?.textContent?.trim();
  if (secondaryLabel && secondaryUrl) {
    const p = document.createElement('p');
    const em = document.createElement('em');
    const a = document.createElement('a');
    a.href = secondaryUrl;
    a.title = secondaryLabel;
    a.textContent = secondaryLabel;
    em.appendChild(a);
    p.appendChild(em);
    contentWrapper.appendChild(p);
  }

  decorateButtons(contentWrapper);

  // Image wrapper
  let imageWrapper = null;
  if (picture) {
    imageWrapper = document.createElement('div');
    if (isEmAccent) {
      imageWrapper.className = 'hero-em-accent-background';
    } else if (isTwoColoredRight) {
      imageWrapper.className = 'hero-two-colored-right-image';
    } else if (isBlackColoredRight) {
      imageWrapper.className = 'hero-black-colored-right-image';
    }
    if (fields.image) moveInstrumentation(fields.image, imageWrapper);
    imageWrapper.appendChild(picture);
  }

  // Clear and rebuild
  block.innerHTML = '';

  if (isEmAccent) {
    if (imageWrapper) block.appendChild(imageWrapper);
    block.appendChild(contentWrapper);
  } else {
    block.appendChild(contentWrapper);
    if (imageWrapper) block.appendChild(imageWrapper);
  }

  // Override button styles for em-accent variation
  if (isEmAccent) {
    const allButtons = [...contentWrapper.querySelectorAll('a.button')];
    allButtons.forEach((button, index) => {
      if (index === 0) {
        button.classList.remove('secondary', 'inverted');
        button.classList.add('primary');
      } else if (index === 1) {
        button.classList.remove('primary', 'secondary');
        button.classList.add('inverted');
      }
    });
  }
}
