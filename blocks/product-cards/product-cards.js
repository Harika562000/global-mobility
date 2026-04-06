import { initCarousel } from '../../scripts/s-and-p-global/s-and-p-carousel.js';
import { onMobileBreakpointChange } from '../../scripts/s-and-p-global/utils.js';
import { bindLottieHover, loadLottie } from '../../scripts/s-and-p-global/lib/lottie.js';

/**
 * Map authoring background classes to block-scoped equivalents
 * so card styles don't depend on global/section-level classes.
 */
const bgClassMap = {
  'bg-light': 'product-cards-light',
  'bg-accent': 'product-cards-accent',
};

const BUTTON_VARIANTS = ['primary', 'secondary', 'inverted'];

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

function resolveButtonVariant(sectionTitle, ctaLink) {
  const rawFromField = (sectionTitle?.querySelector('[data-aue-prop="button1Type"]')?.textContent || '')
    .trim()
    .toLowerCase();
  if (BUTTON_VARIANTS.includes(rawFromField)) return rawFromField;

  const rawFromData = (ctaLink?.dataset?.linkType || '').trim().toLowerCase();
  if (BUTTON_VARIANTS.includes(rawFromData)) return rawFromData;

  const existing = BUTTON_VARIANTS.find((variant) => ctaLink?.classList?.contains(variant));
  return existing || 'secondary';
}

function applyButtonVariant(ctaLink, variant) {
  if (!ctaLink) return;
  const resolved = BUTTON_VARIANTS.includes(variant) ? variant : 'secondary';
  ctaLink.classList.add('button');
  BUTTON_VARIANTS.forEach((name) => ctaLink.classList.remove(name));
  ctaLink.classList.add(resolved);
  ctaLink.dataset.linkType = resolved;
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

function positionCarouselCta(cta, nav, dots) {
  if (!cta || !nav || !dots || cta.dataset.carouselCtaBound === 'true') return;
  cta.dataset.carouselCtaBound = 'true';

  const moveCta = (isMobile) => {
    if (isMobile && dots.parentNode) {
      dots.insertAdjacentElement('afterend', cta);
      return;
    }

    if (nav.parentNode) nav.append(cta);
  };

  onMobileBreakpointChange(moveCta);
}

function getSectionCta(headerArea) {
  if (!headerArea) return null;

  const sectionTitle = headerArea.querySelector('.section-title') || headerArea;
  let ctaLink = sectionTitle.querySelector('.title-row-with-cta a.button[href]:not(.carousel-btn)')
    || sectionTitle.querySelector('a.button[href]:not(.carousel-btn)');

  if (!ctaLink) {
    const buttonLinkField = sectionTitle.querySelector('[data-aue-prop="button1"]');
    const rawHref = (buttonLinkField?.textContent || '').trim();
    const href = normalizeHref(rawHref);

    if (buttonLinkField && href) {
      const buttonTextField = sectionTitle.querySelector('[data-aue-prop="button1Text"]');
      const buttonTitleField = sectionTitle.querySelector('[data-aue-prop="button1Title"]');

      const text = (buttonTextField?.textContent || '').trim() || 'Browse all';
      const title = (buttonTitleField?.textContent || '').trim();

      ctaLink = document.createElement('a');
      ctaLink.href = href;
      ctaLink.textContent = text;
      ctaLink.className = 'button';
      applyButtonVariant(ctaLink, resolveButtonVariant(sectionTitle, ctaLink));
      if (title) ctaLink.title = title;
      if (/^(https?:\/\/|\/\/)/.test(href)) {
        ctaLink.target = '_blank';
        ctaLink.rel = 'noopener noreferrer';
      }

      buttonLinkField.textContent = '';
      buttonLinkField.append(ctaLink);
    }
  }

  if (!ctaLink) return null;

  const normalizedHref = normalizeHref(ctaLink.getAttribute('href') || '');
  if (normalizedHref) ctaLink.setAttribute('href', normalizedHref);
  applyButtonVariant(ctaLink, resolveButtonVariant(sectionTitle, ctaLink));
  if (/^(https?:\/\/|\/\/)/.test(normalizedHref) && !ctaLink.getAttribute('target')) {
    ctaLink.setAttribute('target', '_blank');
    ctaLink.setAttribute('rel', 'noopener noreferrer');
  }

  const container = ctaLink.closest('p.button-container');
  if (container) return container;

  const p = document.createElement('p');
  p.className = 'button-container';
  if (ctaLink.parentElement) {
    ctaLink.parentElement.replaceChild(p, ctaLink);
  }
  p.append(ctaLink);
  return p;
}

function bindSectionCtaToCarousel(block, cta) {
  if (!block || !cta) return;

  cta.classList.add('carousel-cta');

  const attach = () => {
    const nav = block.querySelector('.carousel-nav');
    const dots = block.querySelector('.carousel-dots');
    if (!nav || !dots) return false;
    positionCarouselCta(cta, nav, dots);
    return true;
  };

  if (attach()) return;

  const observer = new MutationObserver(() => {
    if (attach()) observer.disconnect();
  });
  observer.observe(block, { childList: true, subtree: true });
}

function alignSectionTitleCta(sectionTitle, ctaLink) {
  if (!sectionTitle || !ctaLink) return;

  const rows = [...sectionTitle.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const titleRow = rows.find((row) => row.querySelector('h1, h2, h3, h4, h5, h6'));
  const ctaRow = rows.find((row) => row.contains(ctaLink));
  if (!titleRow || !ctaRow || ctaRow === titleRow) return;

  const titleCol = titleRow.querySelector(':scope > div');
  const heading = titleCol?.querySelector('h1, h2, h3, h4, h5, h6');
  if (!heading) return;

  titleRow.classList.add('title-row-with-cta');
  const ctaDiv = document.createElement('div');
  ctaDiv.append(ctaLink);

  titleRow.innerHTML = '';
  titleRow.append(heading, ctaDiv);

  if (ctaRow.parentElement && !ctaRow.textContent?.trim()) {
    ctaRow.remove();
  }
}

/**
 * Copy all data-aue-* and other UE editor attributes from source to target
 * so the Universal Editor can still associate the DOM node with the product card item.
 */
function copyUEAttributes(source, target) {
  if (!source || !source.attributes) return;
  [...source.attributes].forEach((attr) => {
    if (attr.name.startsWith('data-aue-')) {
      target.setAttribute(attr.name, attr.value);
    }
  });
}

export default async function decorate(block) {
  const section = block.closest('.section');
  if (section) {
    Object.entries(bgClassMap).forEach(([authorClass, scopedClass]) => {
      if (section.classList.contains(authorClass)) {
        block.classList.add(scopedClass);
      }
    });
  }

  // Variant + carousel classes are applied via the "classes" model field,
  // which AEM crosswalk maps directly to block.classList. No dataset reads needed.

  // Flex grid layout by variant
  const isVerticallyStacked = block.classList.contains('product-cards-vertically-stacked');
  const isCompact = block.classList.contains('product-cards-compact');
  const isCompactLarge = block.classList.contains('product-cards-compact-large');
  block.classList.add('flex-grid');

  if (isVerticallyStacked) {
    block.classList.add('col-sm-1', 'col-md-1', 'col-lg-1');
  } else if (isCompactLarge) {
    block.classList.add('col-sm-1', 'col-md-1', 'col-lg-3');
  } else if (isCompact) {
    block.classList.add('col-sm-1', 'col-md-2', 'col-lg-2', 'col-xl-4');
  } else {
    block.classList.add('col-sm-1', 'col-md-2', 'col-lg-3');
  }

  /* UE: 4 cols = chartJson, title, description, link.
     Legacy 5 cols = ignored chart-type col, chartJson, title, description, link. */
  const cardRows = [...block.children].filter((row) => row.children.length >= 4);
  const items = [];

  cardRows.forEach((row) => {
    const legacyFiveCol = row.children.length >= 5;
    const chartJsonCell = legacyFiveCol ? row.children[1] : row.children[0];
    const titleCell = legacyFiveCol ? row.children[2] : row.children[1];
    const descriptionCell = legacyFiveCol ? row.children[3] : row.children[2];
    const linkCell = legacyFiveCol ? row.children[4] : row.children[3];
    const linkEl = linkCell?.querySelector('a[href]') || row.querySelector('a[href]');
    const linkField = linkCell?.querySelector('[data-aue-prop="link"]')
      || row.querySelector('[data-aue-prop="link"]');
    const linkText = (linkField?.textContent || linkCell?.textContent || '').trim();
    const textHref = !linkEl ? normalizeHref(linkText) : '';
    const isLinkCard = !!(linkEl || textHref);

    const item = document.createElement(isLinkCard ? 'a' : 'div');
    item.className = 'product-card-item';
    copyUEAttributes(row, item);

    let isExternalLink = false;

    if (isLinkCard) {
      const itemHref = linkEl?.getAttribute('href') || textHref;
      if (itemHref) item.href = itemHref;

      const target = linkEl?.getAttribute('target');
      if (target) {
        item.target = target;
        isExternalLink = target === '_blank';
      } else if (itemHref && /^(https?:\/\/|\/\/)/.test(itemHref)) {
        item.target = '_blank';
        item.rel = 'noopener noreferrer';
        isExternalLink = true;
      }

      const rel = linkEl?.getAttribute('rel');
      if (rel) item.rel = rel;
    }

    const resolvedHref = linkEl?.getAttribute('href') || linkEl?.href || textHref;
    if (resolvedHref && !isLinkCard) {
      item.addEventListener('click', (event) => {
        if (event.defaultPrevented) return;
        event.preventDefault();
        const target = item.getAttribute('target') || linkEl?.getAttribute('target') || '_self';
        window.open(resolvedHref, target);
      }, true);
    }

    let head = null;
    const chartJsonText = chartJsonCell?.textContent?.trim();
    let chartJson = null;
    if (chartJsonText) {
      try {
        chartJson = JSON.parse(chartJsonText);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Invalid chart JSON in product card:', error);
      }
    }

    if (chartJson) {
      head = document.createElement('div');
      head.className = 'product-card-head';
      const chartWrapper = document.createElement('div');
      chartWrapper.className = 'product-card-chart';
      const lottieHost = document.createElement('div');
      lottieHost.className = 'product-card-lottie';
      lottieHost.dataset.lottieJson = JSON.stringify(chartJson);
      chartWrapper.append(lottieHost);
      head.append(chartWrapper);
      loadLottie()
        .then((lottie) => {
          const animation = lottie.loadAnimation({
            container: lottieHost,
            renderer: 'svg',
            loop: false,
            autoplay: false,
            animationData: chartJson,
          });
          // Bind to the card item so hovering anywhere on the card triggers the animation
          bindLottieHover(animation, item);
        })
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.warn('Failed to load Lottie for product card:', error);
        });
    }

    const titleEl = document.createElement('div');
    titleEl.className = 'product-card-title';

    if (titleCell) {
      let titleSource = titleCell;
      const first = titleCell.firstElementChild;
      if (first?.tagName === 'P') titleSource = first;

      const textClone = titleSource.cloneNode(true);
      const innerLink = textClone.querySelector('a[href]');
      if (innerLink) innerLink.replaceWith(...innerLink.childNodes);
      let titleText = textClone;
      if (textClone.tagName !== 'P') {
        titleText = document.createElement('p');
        moveChildren(textClone, titleText);
      }
      titleText.classList.add('product-card-title-text');
      titleEl.append(titleText);

      const titleArrow = titleEl.querySelector('.icon-arrow-right');
      if (titleArrow) {
        titleArrow.setAttribute('aria-hidden', 'true');
        titleArrow.setAttribute('role', 'presentation');
      }
    }

    const body = document.createElement('div');
    body.className = 'product-card-body';
    body.append(titleEl);

    if (descriptionCell) {
      let descSource = descriptionCell;
      const firstDesc = descriptionCell.firstElementChild;
      if (firstDesc?.tagName === 'P') descSource = firstDesc;

      const descClone = descSource.cloneNode(true);
      const innerDescLink = descClone.querySelector('a[href]');
      if (innerDescLink) innerDescLink.replaceWith(...innerDescLink.childNodes);

      const descParagraph = document.createElement('p');
      descParagraph.classList.add('product-card-description');
      moveChildren(descClone, descParagraph);

      const textWrap = document.createElement('span');
      textWrap.classList.add('product-card-description-text');
      const descIcon = descParagraph.querySelector('.icon-arrow-right');
      if (descIcon) {
        descIcon.remove();
        descIcon.setAttribute('aria-hidden', 'true');
        descIcon.setAttribute('role', 'presentation');
        moveChildren(descParagraph, textWrap);
        descParagraph.append(textWrap, descIcon);
      } else {
        moveChildren(descParagraph, textWrap);
        descParagraph.append(textWrap);
      }

      body.append(descParagraph);
    }

    if (isLinkCard && titleEl.textContent) {
      const cardLabel = titleEl.textContent.trim();
      if (cardLabel) {
        item.setAttribute(
          'aria-label',
          isExternalLink ? `${cardLabel} (opens in new tab)` : cardLabel,
        );
      }
    }

    if (head) item.append(head, body);
    else item.append(body);
    items.push(item);
  });

  block.replaceChildren(...items);

  const hasCarouselClass = block.classList.contains('carousel')
    || block.classList.contains('carousel-mobile');
  const wrapper = block.closest('.product-cards-wrapper');
  const wrapperHasCarousel = wrapper && (
    wrapper.classList.contains('carousel')
    || wrapper.classList.contains('carousel-mobile')
  );
  const isCarousel = hasCarouselClass || wrapperHasCarousel;

  const headerArea = section?.querySelector(':scope > .default-content-wrapper')
    || section?.querySelector(':scope > .section-title-wrapper');
  const sectionCta = getSectionCta(headerArea);

  if (!isCarousel && sectionCta) {
    const sectionTitle = headerArea?.querySelector('.section-title');
    const ctaLink = sectionCta.querySelector('a[href]');
    alignSectionTitleCta(sectionTitle, ctaLink);
  }

  if (isCarousel) {
    const mobileOnly = block.classList.contains('carousel-mobile')
      || (wrapper?.classList.contains('carousel-mobile'));
    const infinite = block.classList.contains('carousel-infinite')
      || wrapper?.classList.contains('carousel-infinite');

    const result = await initCarousel(block, {
      mobileOnly,
      infinite,
      showBottomNav: true,
    });

    if (sectionCta) bindSectionCtaToCarousel(block, sectionCta);

    if (result && section) {
      // If the section has an 'inverted' class, apply it to the carousel nav buttons
      if (section.classList.contains('inverted') && result.nav) {
        result.nav.querySelectorAll('.carousel-prev, .carousel-next').forEach((btn) => {
          btn.classList.add('inverted');
        });
      }

      const isInsideCustomerStories = !!block.closest('.customer-stories');

      if (isInsideCustomerStories && headerArea && result.nav) {
        headerArea.classList.add('carousel-header');
        headerArea.append(result.nav);
      }

      if (result.bottomNav && mobileOnly) {
        const footer = document.createElement('div');
        footer.className = 'carousel-footer';
        footer.append(result.bottomNav);
        if (headerArea) {
          const cta = headerArea.querySelector('.button-container');
          if (cta) footer.append(cta);
        }
        block.append(footer);
      }

      if (result.nav && result.dots && sectionCta) {
        positionCarouselCta(sectionCta, result.nav, result.dots);
      }
    }
  }

  block.dispatchEvent(new CustomEvent('product-cards:decorated', { bubbles: true }));
}
