import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/** Footer section class names, in display order (brand, nav, tagline, social, utility). */
const FOOTER_SECTION_CLASSES = [
  'footer-brand',
  'footer-nav',
  'footer-tagline',
  'footer-social',
  'footer-utility',
];

/** Placeholder authors use for year; replaced at runtime with current year. */
const COPYRIGHT_YEAR_PLACEHOLDER = 'XXXX';

/** Replaces XXXX with current year when string contains © and XXXX. */
function replaceCopyrightYear(text) {
  if (!text || typeof text !== 'string') return text;
  if (!text.includes('©') || !text.includes(COPYRIGHT_YEAR_PLACEHOLDER)) return text;
  const year = new Date().getFullYear();
  return text.replace(COPYRIGHT_YEAR_PLACEHOLDER, String(year));
}

/** Wraps the leading © in a span.copyright-symbol so it can be styled (e.g. color). */
function wrapCopyrightSymbol(el) {
  const text = el.textContent?.trim() || '';
  if (!text.startsWith('©')) return;
  const symbol = document.createElement('span');
  symbol.className = 'copyright-symbol';
  symbol.textContent = '©';
  const rest = document.createTextNode(text.slice(1));
  el.textContent = '';
  el.append(symbol, rest);
}

/** Replaces XXXX with current year in footer copyright text */
function updateCopyrightYear(footerRoot) {
  if (!footerRoot) return;

  // Titles containing © and XXXX
  footerRoot.querySelectorAll('[title*="©"]').forEach((el) => {
    const title = el.getAttribute('title');
    if (title && title.includes(COPYRIGHT_YEAR_PLACEHOLDER)) {
      el.setAttribute('title', replaceCopyrightYear(title));
    }
  });

  // Leaf nodes only (avoids wiping container content)
  footerRoot.querySelectorAll('a, p, span').forEach((el) => {
    if (el.children.length > 0) return;
    const text = el.textContent;
    if (!text || !text.includes(COPYRIGHT_YEAR_PLACEHOLDER) || !text.includes('©')) return;
    el.textContent = replaceCopyrightYear(text);
    wrapCopyrightSymbol(el);
  });
}

/** Loads footer fragment from footer page; first 5 sections get footer-brand, footer-nav, footer-tagline, footer-social, footer-utility. */
export default async function decorate(block) {
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);

  if (!fragment) return;

  block.textContent = '';
  const footer = document.createElement('div');
  footer.className = 'footer-inner-wrapper';

  while (fragment.firstElementChild) {
    footer.append(fragment.firstElementChild);
  }
  Array.from(footer.children).forEach((section, index) => {
    if (FOOTER_SECTION_CLASSES[index]) {
      section.classList.add(FOOTER_SECTION_CLASSES[index]);
    }
  });

  // Wrap footer-social content in .footer-social-content
  const socialSection = footer.querySelector('.footer-social');
  const defaultContentWrapper = socialSection?.querySelector(':scope > .default-content-wrapper');
  if (defaultContentWrapper) {
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'footer-social-content';
    while (defaultContentWrapper.firstElementChild) {
      contentWrapper.append(defaultContentWrapper.firstElementChild);
    }
    defaultContentWrapper.append(contentWrapper);
  }

  // Group social and utility sections in one wrapper
  const utilitySection = footer.querySelector('.footer-utility');
  if (socialSection || utilitySection) {
    const linksWrapper = document.createElement('div');
    linksWrapper.className = 'footer-social-utility-wrapper';
    if (socialSection) linksWrapper.append(socialSection);
    if (utilitySection) linksWrapper.append(utilitySection);
    footer.append(linksWrapper);
  }

  // Clone CTA button into social section for layout
  const socialContentWrapper = footer.querySelector('.footer-social > .default-content-wrapper');
  const utilityButton = footer.querySelector('.footer-utility .button');
  utilityButton?.classList.add('original-button', 'inverted', 'size-40');
  if (socialContentWrapper && utilityButton) {
    const clonedButton = utilityButton.cloneNode(true);
    clonedButton.classList.add('button-clone');
    clonedButton.classList.remove('original-button');
    socialContentWrapper.append(clonedButton);
  }

  updateCopyrightYear(footer);
  block.append(footer);
}
