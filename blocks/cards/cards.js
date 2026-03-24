import { decorateIcons } from '../../scripts/aem.js';
import { eyebrowDecorator, moveInstrumentation } from '../../scripts/scripts.js';
import { initCarousel } from '../../scripts/s-and-p-global/s-and-p-carousel.js';

/**
 * Map authoring background classes to block-scoped equivalents
 * so card styles don't depend on global/section-level classes.
 */
const bgClassMap = {
  'bg-dark': 'cards-dark',
  'bg-grey': 'cards-grey',
};

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
 * Safely move all child nodes from one element into another,
 * avoiding innerHTML to prevent XSS risks.
 */
function moveChildren(source, target) {
  while (source.firstChild) {
    target.append(source.firstChild);
  }
}

function normalizeCardRows(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  const allSingleCell = rows.every((row) => row.children.length === 1);
  if (!allSingleCell) return;

  let groupSize = 0;
  if (rows.length % 4 === 0) {
    groupSize = 4;
  } else if (rows.length % 3 === 0) {
    groupSize = 3;
  }

  if (!groupSize) return;

  const grouped = [];
  for (let i = 0; i < rows.length; i += groupSize) {
    const col = document.createElement('div');
    moveInstrumentation(rows[i], col);
    col.append(...rows.slice(i, i + groupSize));
    grouped.push(col);
  }

  block.replaceChildren(...grouped);
}

export default async function decorate(block) {
  [...block.classList].forEach((token) => {
    if (!token.includes('carousel-mobile')) return;
    if (token.includes('two-col') || token.includes('three-col')) {
      if (token.includes('two-col')) block.classList.add('two-col');
      if (token.includes('three-col')) block.classList.add('three-col');
      if (token.includes('card-no-border')) block.classList.add('card-no-border');
      block.classList.add('carousel-mobile');
      block.classList.remove(token);
    }
  });
  const isTwoCol = block.classList.contains('two-col');
  const isThreeCol = block.classList.contains('three-col');
  if (!block.classList.contains('carousel') && !block.classList.contains('carousel-mobile')) {
    block.classList.add('carousel-mobile');
  }
  const hasCarouselClass = block.classList.contains('carousel')
    || block.classList.contains('carousel-mobile');

  if (!isTwoCol && !isThreeCol && !hasCarouselClass) {
    return;
  }

  normalizeCardRows(block);

  // The AEM framework places background classes (bg-dark, bg-grey, etc.)
  // on the section. Add a block-scoped class to the cards block so that
  // card-specific styles don't depend on the global section-level class.
  const section = block.closest('.section');
  if (section) {
    Object.entries(bgClassMap).forEach(([authorClass, scopedClass]) => {
      if (section.classList.contains(authorClass)) {
        block.classList.add(scopedClass);
      }
    });

    // If the first row contains eyebrow + title content, lift it out
    // into a default-content wrapper above the cards wrapper.
    if (!section.querySelector('.default-content-wrapper')) {
      const firstCol = block.firstElementChild;
      if (firstCol) {
        const hasHeading = firstCol.querySelector('h1, h2, h3, h4, h5, h6');
        if (hasHeading) {
          const eyebrowWrapper = document.createElement('div');
          eyebrowWrapper.className = 'default-content-wrapper';
          moveChildren(firstCol, eyebrowWrapper);

          const cardsWrapper = section.querySelector('.cards-wrapper');
          section.insertBefore(eyebrowWrapper, cardsWrapper || block);

          firstCol.remove();
        }
      }
    }
  }

  // Find and decorate eyebrow text in the default-content-wrapper
  if (section) {
    const defaultWrapper = section.querySelector('.default-content-wrapper');
    if (defaultWrapper) {
      const allParagraphs = defaultWrapper.querySelectorAll('p');
      let eyebrowElement = null;

      allParagraphs.forEach((p) => {
        if (!p.querySelector('picture') && !p.classList.contains('button-container')
          && !p.querySelector('strong') && !p.querySelector('em')
          && !p.classList.contains('eye-brow-text')) {
          const headingElement = defaultWrapper.querySelector('h1, h2, h3, h4, h5, h6');
          const position = headingElement ? p.compareDocumentPosition(headingElement) : 0;
          const following = Node.DOCUMENT_POSITION_FOLLOWING;
          const isFollowing = (position % (following * 2)) >= following;
          if (headingElement && isFollowing) {
            eyebrowElement = p;
          }
        }
      });

      if (eyebrowElement) {
        const eyebrowText = eyebrowElement.textContent.trim();
        if (eyebrowText) {
          eyebrowElement.classList.add('eyebrow');
          const formattedEyebrow = eyebrowDecorator(eyebrowElement, 'accent-color');
          if (formattedEyebrow) {
            eyebrowElement.replaceWith(formattedEyebrow);
          }
        }
      }
    }
  }

  // Apply shared flex-grid helper classes for responsive layout
  block.classList.add('flex-grid', 'col-sm-1');
  if (isThreeCol) {
    block.classList.add('col-md-2', 'col-lg-3');
  } else if (isTwoCol) {
    block.classList.add('col-md-2', 'col-lg-2');
  }

  // Each remaining direct child div represents a card item
  const items = [];

  // First, find and extract Browse All CTA before processing cards
  let browseCta = null;
  [...block.children].forEach((cardCol) => {
    const firstChild = cardCol.querySelector('p');
    if (firstChild) {
      const link = firstChild.querySelector('a');
      if (link && link.textContent.trim().toLowerCase() === 'browse all') {
        // Mark this as the Browse All CTA
        browseCta = firstChild.cloneNode(true);
        if (!browseCta.classList.contains('button-container')) {
          browseCta.classList.add('button-container');
        }
        // Ensure the link has button classes
        const ctaLink = browseCta.querySelector('a');
        if (ctaLink && !ctaLink.classList.contains('button')) {
          ctaLink.classList.add('button', 'secondary');
        }
        // Remove the em wrapper if present
        const emWrapper = browseCta.querySelector('em');
        if (emWrapper) {
          emWrapper.replaceWith(...emWrapper.childNodes);
        }
      }
    }
  });

  [...block.children].forEach((cardCol) => {
    // Skip Browse All CTA column
    const firstChild = cardCol.querySelector('p');
    if (firstChild) {
      const link = firstChild.querySelector('a');
      if (link && link.textContent.trim().toLowerCase() === 'browse all') {
        return; // Skip this column, it's the Browse All CTA
      }
    }

    const copySource = cardCol.children[2];
    const linkCell = cardCol.children[3];

    // Use explicit link field when present; fallback to any link inside the card column
    const linkEl = (linkCell && linkCell.querySelector('a[href]'))
      || cardCol.querySelector('a[href]');
    const linkField = (linkCell && linkCell.querySelector('[data-aue-prop="link"]'))
      || cardCol.querySelector('[data-aue-prop="link"]');
    const linkText = (linkField?.textContent || linkCell?.textContent || '').trim();
    const textHref = !linkEl ? normalizeHref(linkText) : '';
    const isLinkCard = !!(linkEl || textHref);

    const item = document.createElement(isLinkCard ? 'a' : 'div');
    item.className = 'card-item';
    moveInstrumentation(cardCol, item);
    if (!item.hasAttribute('data-aue-type')) {
      item.setAttribute('data-aue-type', 'container');
      item.setAttribute('data-aue-component', 'card');
      item.setAttribute('data-aue-model', 'card');
      item.setAttribute('data-aue-label', 'Card');
      item.setAttribute('data-aue-behavior', 'component');
    }

    let isExternalLink = false;

    if (isLinkCard) {
      const href = linkEl?.getAttribute('href') || textHref;
      if (href) {
        item.href = href;
      }

      const target = linkEl?.getAttribute('target');
      if (target) {
        item.target = target;
        isExternalLink = target === '_blank';
      } else if (href && /^(https?:\/\/|\/\/)/.test(href)) {
        // Open external links in a new tab by default
        item.target = '_blank';
        item.rel = 'noopener noreferrer';
        isExternalLink = true;
      }

      const rel = linkEl?.getAttribute('rel');
      if (rel) {
        item.rel = rel;
      }
    }

    // Default cards variant with icon, title and body copy
    const head = document.createElement('div');
    head.className = 'card-head';

    const body = document.createElement('div');
    body.className = 'card-body';

    // Icon (first)
    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.setAttribute('role', 'presentation');
    const firstText = cardCol.children[0]
      && cardCol.children[0].textContent.trim();
    if (firstText && firstText.startsWith(':') && firstText.endsWith(':')) {
      const name = firstText.slice(1, -1);
      iconSpan.classList.add(`icon-${name}`);
    } else if (cardCol.children[0]) {
      const iconClone = cardCol.children[0].cloneNode(true);
      moveChildren(iconClone, iconSpan);
    }
    if (!iconSpan.textContent.trim() && !iconSpan.querySelector('img, svg, span.icon')) {
      iconSpan.classList.remove('icon');
    }
    head.append(iconSpan);

    // Title (second)
    const titleEl = document.createElement('div');
    titleEl.className = 'card-title';
    if (cardCol.children[1]) {
      const titleClone = cardCol.children[1].cloneNode(true);
      moveChildren(titleClone, titleEl);
    }
    head.append(titleEl);

    // Copy (third)
    if (copySource) {
      const arrow = copySource.querySelector('.icon-arrow-right');

      let textSource = copySource;
      const firstElement = copySource.firstElementChild;
      if (firstElement && firstElement.tagName === 'P') {
        textSource = firstElement;
      }

      const textClone = textSource.cloneNode(true);
      const arrowInClone = textClone.querySelector('.icon-arrow-right');
      if (arrowInClone) arrowInClone.remove();

      // Remove any inner link markup; card itself is the link
      const innerLink = textClone.querySelector('a[href]');
      if (innerLink) {
        innerLink.replaceWith(...innerLink.childNodes);
      }

      const isRichtext = textClone.tagName === 'DIV';
      if (isRichtext) {
        body.append(textClone);
      } else {
        const copyParagraph = document.createElement('p');
        moveChildren(textClone, copyParagraph);
        body.append(copyParagraph);
      }

      if (arrow) {
        arrow.setAttribute('aria-hidden', 'true');
        arrow.setAttribute('role', 'presentation');
        body.append(arrow);
      }
    }

    // Add aria-label for link cards based on title
    if (isLinkCard) {
      const titleText = titleEl.textContent.trim();
      const copyText = body.textContent.trim();
      const linkLabelText = linkEl?.textContent?.trim() || '';
      const baseLabel = titleText || linkLabelText || copyText;
      if (baseLabel) {
        const ariaLabel = isExternalLink
          ? `${baseLabel} (opens in new tab)`
          : baseLabel;
        item.setAttribute('aria-label', ariaLabel);
      }
    }

    item.append(head, body);
    items.push(item);
  });

  // Replace block content with card items directly
  block.replaceChildren(...items);

  // Let global decorator load/inject icons from /icons/
  try {
    decorateIcons(block);
  } catch (e) {
    // ignore if decorateIcons not available yet
  }

  // Carousel: activate when the block or its wrapper carries a
  // carousel variant class (carousel, carousel-mobile).
  const wrapper = block.closest('.cards-wrapper');
  const wrapperHasCarousel = wrapper && (
    wrapper.classList.contains('carousel')
    || wrapper.classList.contains('carousel-mobile')
  );
  const isCarousel = hasCarouselClass || wrapperHasCarousel;

  if (isCarousel) {
    const mobileOnly = block.classList.contains('carousel-mobile')
      || (wrapper && wrapper.classList.contains('carousel-mobile'));
    const infinite = block.classList.contains('carousel-infinite')
      || (wrapper && wrapper.classList.contains('carousel-infinite'));

    const result = await initCarousel(block, {
      mobileOnly,
      infinite,
      showBottomNav: false,
    });

    if (result && section) {
      // Top-right nav: move into the heading area beside the title
      const headerArea = section.querySelector(
        '.default-content-wrapper',
      );
      if (headerArea && result.nav) {
        headerArea.classList.add('carousel-header');
        headerArea.append(result.nav);
      }
    }
  }
}
