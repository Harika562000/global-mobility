import { getMetadata, decorateIcons } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/** Footer section class names, in display order (brand, nav, tagline, social, utility, section). */
const FOOTER_SECTION_CLASSES = [
  'footer-brand',
  'footer-nav',
  'footer-tagline',
  'footer-social',
  'footer-utility',
  'footer-section',
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

function normalizeHref(raw) {
  if (!raw) return '';
  const href = raw.replace(/\u00A0/g, ' ').trim();
  if (!href) return '';
  if (/^(mailto:|tel:)/i.test(href)) return href;
  if (/^www\./i.test(href)) return `https://${href}`;
  if (!/^(https?:\/\/|\/|\.\/|\.\.\/|#)/i.test(href) && /\.[a-z]{2,}(\/|$)/i.test(href)) {
    return `https://${href}`;
  }
  return href;
}

/**
 * Processes the footer-logo block: reads the link (row 2) and alt text (row 3),
 * sets the alt on the img, and wraps the picture in an anchor if a link is present.
 * The external-link normalisation in decorate() handles target/rel afterwards.
 */
function decorateFooterLogo(block) {
  const rows = Array.from(block.children);
  if (!rows.length) return;

  const picture = rows[0]?.querySelector('picture');
  const rawHref = rows[1]?.querySelector('a')?.getAttribute('href') || rows[1]?.textContent?.trim() || '';
  const href = normalizeHref(rawHref);
  const altText = rows[2]?.textContent?.trim() || '';

  if (!picture) return;

  const img = picture.querySelector('img');
  if (img && altText) img.alt = altText;

  block.innerHTML = '';

  if (href) {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.append(picture);
    block.append(anchor);
  } else {
    block.append(picture);
  }
}

/**
 * Decorates the footer-tag-line block: extracts the richtext content from inside
 * the block's cell and places it in a footer-tag-line-wrapper div, replacing the
 * anonymous decorateSections wrapper.
 */
function decorateFooterTagLine(block) {
  const cell = block.querySelector(':scope > div > div');
  if (!cell) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'footer-tag-line-wrapper';
  while (cell.firstChild) {
    wrapper.append(cell.firstChild);
  }

  const anonymousDiv = block.parentElement;
  if (anonymousDiv && !anonymousDiv.className) {
    anonymousDiv.replaceWith(wrapper);
  } else {
    block.replaceWith(wrapper);
  }
}

/**
 * Decorates the footer-social-links block (new implementation).
 * Row 0 = "Follow Us" richtext message; rows 1+ = footer-social-link items
 * (cell[0]=icon picture, cell[1]=alt text, cell[2]=url anchor).
 * Builds a footer-social-links-wrapper div and inserts it after tagLineWrapper.
 */
function decorateFooterSocialLinks(block, tagLineWrapper) {
  const rows = Array.from(block.children);
  if (!rows.length) return;

  const messageCell = rows[0]?.querySelector(':scope > div');

  const ul = document.createElement('ul');
  rows.slice(1).forEach((row) => {
    const cells = Array.from(row.children);
    const picture = cells[0]?.querySelector('picture');
    const altText = cells[1]?.textContent?.trim() || '';
    const anchor = cells[2]?.querySelector('a');

    if (!picture) return;

    const img = picture.querySelector('img');
    if (img && altText) img.alt = altText;

    const a = document.createElement('a');
    const href = normalizeHref(anchor?.getAttribute('href') || '');
    if (href) {
      a.href = href;
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
    if (altText) a.setAttribute('aria-label', altText);
    a.append(picture);

    const li = document.createElement('li');
    li.append(a);
    ul.append(li);
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'footer-social-links-wrapper';

  if (messageCell?.innerHTML) {
    const message = document.createElement('p');
    message.innerHTML = messageCell.innerHTML;
    wrapper.append(message);
  }
  if (ul.children.length) wrapper.append(ul);

  decorateIcons(wrapper);

  if (tagLineWrapper) {
    tagLineWrapper.after(wrapper);
  }

  // Remove the block's anonymous wrapper div from the section
  const anonymousDiv = block.parentElement;
  if (anonymousDiv && !anonymousDiv.className) {
    anonymousDiv.remove();
  } else {
    block.remove();
  }
}

/**
 * Decorates a footer-links block: row 0 = optional column heading, row 1+ = footer-link items.
 * Each link item: cell[0]=url anchor, cell[1]=display text.
 * External links get an arrow-up-right icon inside the <u> wrapper.
 */
function decorateFooterLinks(block) {
  const rows = Array.from(block.children);
  if (!rows.length) return;

  const headingText = rows[0]?.textContent?.trim();
  const ul = document.createElement('ul');

  rows.slice(1).forEach((row) => {
    const cells = Array.from(row.children);
    const anchor = cells[0]?.querySelector('a');
    if (!anchor) return;

    const customText = cells[1]?.textContent?.trim();
    const linkText = customText || anchor.textContent.trim();
    const rawHref = anchor.getAttribute('href') || '';
    const href = normalizeHref(rawHref);

    let isExternal = false;
    try {
      isExternal = !!href
        && /^(https?:\/\/|\/\/)/.test(href)
        && !new URL(href, window.location).hostname.includes(window.location.hostname);
    } catch { /* malformed href — treat as internal */ }

    const u = document.createElement('u');
    u.textContent = linkText;
    if (isExternal) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'icon icon-arrow-up-right';
      u.append(iconSpan);
    }

    anchor.classList.remove('button', 'primary', 'secondary', 'inverted');
    anchor.textContent = '';
    anchor.append(u);
    if (href && href !== rawHref) anchor.setAttribute('href', href);
    if (isExternal) {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
    }

    const li = document.createElement('li');
    li.append(anchor);
    ul.append(li);
  });

  block.innerHTML = '';
  if (headingText) {
    const heading = document.createElement('p');
    heading.className = 'footer-links-heading';
    heading.textContent = headingText;
    block.append(heading);
  }
  if (ul.children.length) block.append(ul);
}

/**
 * Loads footer fragment from footer page; first 6 sections get
 * footer-brand, footer-nav, footer-tagline, footer-social, footer-utility, footer-section.
 */
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

  const footerSection = footer.querySelector('.footer-section');

  // Decorate footer-logo block inside footer-section
  const footerLogoBlock = footer.querySelector('.footer-section .footer-logo');
  if (footerLogoBlock) {
    decorateFooterLogo(footerLogoBlock);
    // Unwrap the anonymous div added by decorateSections
    const logoWrapper = footerLogoBlock.parentElement;
    if (logoWrapper && logoWrapper !== footerSection && !logoWrapper.className) {
      logoWrapper.replaceWith(footerLogoBlock);
    }
  }

  // Decorate footer-tag-line block inside footer-section
  const footerTagLineBlock = footerSection?.querySelector(':scope > div > .footer-tag-line');
  if (footerTagLineBlock) decorateFooterTagLine(footerTagLineBlock);

  // Decorate new footer-social-links block and insert it after footer-tag-line-wrapper
  const footerSocialLinksBlock = footerSection?.querySelector(':scope > div > .footer-social-links');
  const tagLineWrapper = footer.querySelector('.footer-tag-line-wrapper');
  if (footerSocialLinksBlock) decorateFooterSocialLinks(footerSocialLinksBlock, tagLineWrapper);

  // Collect, decorate, and wrap footer-links blocks inside footer-section.
  // decorateSections() wraps each block in an anonymous <div>, so blocks are
  // at depth 2 (.footer-section > div > .footer-links), not depth 1.
  const footerLinksBlocks = footerSection
    ? Array.from(footerSection.querySelectorAll(':scope > div > .footer-links'))
    : [];
  if (footerLinksBlocks.length) {
    const linksWrapper = document.createElement('div');
    linksWrapper.className = 'footer-links-wrapper columns';
    const linksRow = document.createElement('div');
    const firstWrapper = footerLinksBlocks[0].parentElement;
    footerSection.insertBefore(linksWrapper, firstWrapper);
    footerLinksBlocks.forEach((linksBlock) => {
      const wrapperDiv = linksBlock.parentElement;
      decorateFooterLinks(linksBlock);
      linksRow.append(linksBlock);
      wrapperDiv.remove();
    });
    linksWrapper.append(linksRow);
    decorateIcons(linksWrapper);
  }

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
  utilityButton?.classList.add('original-button', 'size-40');
  if (socialContentWrapper && utilityButton) {
    const clonedButton = utilityButton.cloneNode(true);
    clonedButton.classList.add('button-clone');
    clonedButton.classList.remove('original-button');
    socialContentWrapper.append(clonedButton);
  }

  updateCopyrightYear(footer);

  // Open external links in a new tab
  footer.querySelectorAll('a[href]').forEach((link) => {
    const rawHref = link.getAttribute('href');
    const href = normalizeHref(rawHref);
    if (href && href !== rawHref) {
      link.setAttribute('href', href);
      link.href = href;
    }

    if (href && /^(https?:\/\/|\/\/)/.test(href) && !new URL(href, window.location).hostname.includes(window.location.hostname)) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
  });

  // Safety net: if any authored bare-domain URL survives, force absolute navigation on click.
  footer.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || !footer.contains(link)) return;

    const rawHref = link.getAttribute('href');
    const href = normalizeHref(rawHref);
    if (!href || href === rawHref) return;

    event.preventDefault();
    const target = link.getAttribute('target') || '_self';
    window.open(href, target);
  });

  block.append(footer);
}
