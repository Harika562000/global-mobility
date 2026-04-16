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

  // decorateSections() always wraps blocks in a named div (e.g. footer-tag-line-wrapper),
  // so replace the parent wrapper directly regardless of whether it has a class.
  const parent = block.parentElement;
  if (parent) {
    parent.replaceWith(wrapper);
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

  // Wrap message + icons in a content div so at 720px+ the content block
  // and the cloned cookie button sit in the same row (space-between).
  const content = document.createElement('div');
  content.className = 'footer-social-links-content';
  if (messageCell?.innerHTML) {
    const message = document.createElement('p');
    message.innerHTML = messageCell.innerHTML;
    content.append(message);
  }
  if (ul.children.length) content.append(ul);
  if (content.children.length) wrapper.append(content);

  decorateIcons(wrapper);

  if (tagLineWrapper) {
    tagLineWrapper.after(wrapper);
  }

  // decorateSections() wraps blocks in a named div (e.g. footer-social-links-wrapper).
  // Remove the whole wrapper so no empty shell is left behind.
  const outerWrapper = block.parentElement;
  if (outerWrapper) outerWrapper.remove();
}

/**
 * Decorates the footer-copyright block (new implementation).
 * Row 0 = richtext copyright content (links extracted into a <ul>).
 * Row 1 = cookieButton container (cells: link, linkText, linkTitle, linkType).
 * Builds footer-copyright-wrapper and inserts it after footer-links-wrapper.
 * Returns the cookie button element for cloning, or null.
 */
function decorateFooterCopyright(block, footerSection) {
  const rows = Array.from(block.children);
  if (!rows.length) return null;

  // Row 0: richtext content — extract <a> elements into a <ul>
  const contentCell = rows[0]?.querySelector(':scope > div');
  const ul = document.createElement('ul');
  if (contentCell) {
    contentCell.querySelectorAll('a').forEach((link) => {
      const rawHref = link.getAttribute('href') || '';
      const href = normalizeHref(rawHref);
      if (href && href !== rawHref) link.setAttribute('href', href);
      const li = document.createElement('li');
      li.append(link.cloneNode(true));
      ul.append(li);
    });
  }

  // Row 1: cookieButton container — cells[0]=link, cells[1]=linkText, cells[2]=linkTitle, cells[3]=linkType
  let cookieButton = null;
  const buttonRow = rows[1];
  if (buttonRow) {
    const cells = Array.from(buttonRow.children);
    const linkAnchor = cells[0]?.querySelector('a');
    const linkText = cells[1]?.textContent?.trim()
      || cells[0]?.textContent?.trim()
      || '';
    const linkTitle = cells[2]?.textContent?.trim() || '';
    const linkType = cells[3]?.textContent?.trim() || 'inverted';

    if (linkText) {
      const btn = document.createElement('a');
      const btnHref = normalizeHref(linkAnchor?.getAttribute('href') || '');
      btn.href = btnHref || '#';
      if (!btnHref) btn.setAttribute('data-action', 'cookie-preferences');
      btn.className = `button ${linkType} original-copyright-button size-40`;
      if (linkTitle) btn.setAttribute('title', linkTitle);
      btn.textContent = linkText;
      cookieButton = btn;
    }
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'footer-copyright-wrapper';
  if (ul.children.length) wrapper.append(ul);
  if (cookieButton) wrapper.append(cookieButton);

  // Always append to the end of footer-section so copyright lands after all other blocks
  // regardless of the authored order in the fragment.
  footerSection.append(wrapper);

  // decorateSections() wraps blocks in a named div (e.g. footer-copyright-wrapper).
  // Remove the whole wrapper so no empty shell is left behind.
  const outerWrapper = block.parentElement;
  if (outerWrapper) outerWrapper.remove();

  return cookieButton;
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
 * Loads footer fragment from footer page and decorates all footer blocks
 * inside the single footer-section container.
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

  // Decorate new footer-copyright block and insert after footer-links-wrapper
  const footerCopyrightBlock = footerSection?.querySelector(':scope > div > .footer-copyright');
  const newCopyrightButton = footerCopyrightBlock
    ? decorateFooterCopyright(footerCopyrightBlock, footerSection)
    : null;

  // Clone new copyright button into footer-social-links-wrapper for tablet layout
  const newSocialLinksWrapper = footer.querySelector('.footer-social-links-wrapper');
  if (newCopyrightButton && newSocialLinksWrapper) {
    const clonedCopyrightButton = newCopyrightButton.cloneNode(true);
    clonedCopyrightButton.classList.add('copyright-button-clone');
    clonedCopyrightButton.classList.remove('original-copyright-button');
    newSocialLinksWrapper.append(clonedCopyrightButton);
  }

  // Group footer-social-links-wrapper and footer-copyright-wrapper in one container,
  // mirroring the footer-social-utility-wrapper pattern for responsive alignment.
  const newCopyrightWrapper = footerSection?.querySelector('.footer-copyright-wrapper');
  if (newSocialLinksWrapper || newCopyrightWrapper) {
    const socialCopyrightWrapper = document.createElement('div');
    socialCopyrightWrapper.className = 'footer-social-copyright-wrapper';
    if (newSocialLinksWrapper) socialCopyrightWrapper.append(newSocialLinksWrapper);
    if (newCopyrightWrapper) socialCopyrightWrapper.append(newCopyrightWrapper);
    footerSection.append(socialCopyrightWrapper);
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
