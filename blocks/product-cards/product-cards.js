import { initCarousel } from '../../scripts/s-and-p-global/s-and-p-carousel.js';
import { onMobileBreakpointChange } from '../../scripts/s-and-p-global/utils.js';
import { loadGSAP } from '../../scripts/s-and-p-global/lib/gsap.js';
import { bindLottieHover, loadLottie } from '../../scripts/s-and-p-global/lib/lottie.js';
import { chartTemplates } from '../../scripts/s-and-p-global/svg-templates.js';
import { setupChartAnimation } from '../../scripts/s-and-p-global/svg-animations.js';

/**
 * Map authoring background classes to block-scoped equivalents
 * so card styles don't depend on global/section-level classes.
 */
const bgClassMap = {
  'bg-light': 'product-cards-light',
  'bg-accent': 'product-cards-accent',
};

/**
 * UE chart type select values → chartTemplates keys.
 * UE stores the selected option value in the DOM; we use it to pick the SVG template.
 */
const CHART_TYPE_MAP = {
  none: 'none',
  pie: 'pie',
  bars: 'bars',
  grid: 'grid',
  waves: 'waves',
  rectangle: 'rectangle',
  piechart: 'pieChart',
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

/**
 * Setup GSAP animations for all charts in product cards
 */
async function setupProductCardAnimations(block) {
  try {
    const gsap = await loadGSAP();
    const chartWrappers = block.querySelectorAll('.product-card-chart');

    chartWrappers.forEach((wrapper) => {
      const { chartType } = wrapper.dataset;
      const cardItem = wrapper.closest('.product-card-item');

      if (chartType && cardItem) {
        const timeline = setupChartAnimation(gsap, wrapper, chartType);

        if (timeline) {
          cardItem.addEventListener('mouseenter', () => timeline.play());
          cardItem.addEventListener('mouseleave', () => timeline.reverse());
        }
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to setup chart animations:', error);
  }
}

/**
 * Resolve UE chart type from cell content (select value, e.g. "pie", "pieChart").
 * Returns the key used by chartTemplates.
 */
function resolveChartType(cell) {
  if (!cell) return 'pie';
  const raw = (cell.textContent || '').trim().toLowerCase().replace(/\s+/g, '');
  return CHART_TYPE_MAP[raw] || CHART_TYPE_MAP[raw.replace(/-/g, '')] || 'pie';
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

  // UE: variant(s) from block model → data-classes (multiselect: comma or space separated)
  const ueClasses = block.dataset.classes?.trim();
  if (ueClasses) {
    ueClasses.split(/[\s,]+/).filter(Boolean).forEach((c) => block.classList.add(c));
  }

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

  // CTA from product cards container: 2-col rows (link, linkText, linkType)
  // or existing .button in a config row
  const config = {};
  Array.from(block.children).forEach((row) => {
    if (row.children.length !== 2) return;
    const keySource = row.children[0].textContent || '';
    const key = keySource.trim().toLowerCase().replace(/\s+/g, '');
    const valueCell = row.children[1];
    const linkEl = valueCell.querySelector('a[href]');
    config[key] = linkEl
      ? { type: 'link', el: linkEl }
      : { type: 'text', value: (valueCell.textContent || '').trim() };
  });

  let browseCta = null;
  const linkSource = config.link || config.cta_link;
  const textSource = config.linktext || config.link_text || config.cta_linktext;
  const typeSource = config.linktype || config.link_type || config.cta_linktype;
  const ctaLink = linkSource?.type === 'link' ? linkSource.el : null;
  const ctaLinkText = textSource?.type === 'text'
    ? textSource.value
    : (ctaLink?.textContent?.trim() || '');
  const ctaLinkType = (typeSource?.type === 'text'
    ? typeSource.value
    : '') || 'secondary';
  const href = ctaLink?.getAttribute('href')
    || (linkSource?.type === 'text' ? linkSource.value : '');

  if (href && ctaLinkText) {
    const p = document.createElement('p');
    p.className = 'button-container';
    const a = document.createElement('a');
    a.href = href;
    a.textContent = ctaLinkText;
    a.className = `button ${ctaLinkType || 'secondary'}`.trim();
    if (ctaLink?.target) a.target = ctaLink.target;
    if (ctaLink?.rel) a.rel = ctaLink.rel;
    const titleSource = config.linktitle
      || config.link_title
      || config.cta_linktitle;
    if (titleSource?.type === 'text' && titleSource.value) a.title = titleSource.value;
    p.append(a);
    browseCta = p;
  }
  if (!browseCta) {
    Array.from(block.children).some((row) => {
      if (row.children.length >= 4) return false;
      const existing = row.querySelector('a.button[href]');
      if (!existing) return false;
      browseCta = existing.closest('p') || existing.parentElement;
      if (browseCta && !browseCta.classList.contains('button-container')) {
        const wrap = document.createElement('p');
        wrap.className = 'button-container';
        wrap.append(existing.cloneNode(true));
        browseCta = wrap;
      }
      return true;
    });
  }

  // UE: only rows with 4 columns are product card items
  const cardRows = [...block.children].filter((row) => row.children.length >= 4);
  const items = [];

  cardRows.forEach((row) => {
    const hasChartJsonColumn = row.children.length >= 5;
    const chartTypeCell = row.children[0];
    const chartJsonCell = hasChartJsonColumn ? row.children[1] : null;
    const titleCell = hasChartJsonColumn ? row.children[2] : row.children[1];
    const descriptionCell = hasChartJsonColumn ? row.children[3] : row.children[2];
    const linkCell = hasChartJsonColumn ? row.children[4] : row.children[3];

    const chartType = resolveChartType(chartTypeCell);
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

    // Chart: UE chart type select value → SVG template
    const head = document.createElement('div');
    head.className = 'product-card-head';

    const chartWrapper = document.createElement('div');
    chartWrapper.className = 'product-card-chart';
    const chartId = `${chartType}_${Math.random().toString(36).substr(2, 9)}`;

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
      const lottieHost = document.createElement('div');
      lottieHost.className = 'product-card-lottie';
      chartWrapper.append(lottieHost);
      loadLottie()
        .then((lottie) => {
          const animation = lottie.loadAnimation({
            container: lottieHost,
            renderer: 'svg',
            loop: false,
            autoplay: false,
            animationData: chartJson,
          });
          bindLottieHover(animation, lottieHost);
        })
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.warn('Failed to load Lottie for product card:', error);
        });
    } else if (chartTemplates[chartType]) {
      if (chartType === 'waves') {
        chartWrapper.innerHTML = `
          <div class="svg-layer svg-default">${chartTemplates.waves.default}</div>
          <div class="svg-layer svg-hover">${chartTemplates.waves.hover}</div>
        `;
      } else if (typeof chartTemplates[chartType] === 'function') {
        chartWrapper.innerHTML = chartTemplates[chartType](chartId);
      } else {
        chartWrapper.innerHTML = chartTemplates[chartType];
      }
    }

    chartWrapper.dataset.chartType = chartType;
    chartWrapper.dataset.chartId = chartId;
    head.append(chartWrapper);

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

    item.append(head, body);
    items.push(item);
  });

  block.replaceChildren(...items);

  await setupProductCardAnimations(block);

  const hasCarouselClass = block.classList.contains('carousel')
    || block.classList.contains('carousel-mobile');
  const wrapper = block.closest('.product-cards-wrapper');
  const wrapperHasCarousel = wrapper && (
    wrapper.classList.contains('carousel')
    || wrapper.classList.contains('carousel-mobile')
  );
  const isCarousel = hasCarouselClass || wrapperHasCarousel;

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

    if (result && section) {
      const isInsideCustomerStories = !!block.closest('.customer-stories');
      const headerArea = section.querySelector('.default-content-wrapper');

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

      if (result.nav && result.dots && browseCta) {
        browseCta.classList.add('carousel-cta');
        positionCarouselCta(browseCta, result.nav, result.dots);
      }
    }
  }

  if (browseCta && !browseCta.isConnected) {
    const ctaWrapper = document.createElement('div');
    ctaWrapper.className = 'product-cards-browse-all';
    ctaWrapper.append(browseCta);
    block.append(ctaWrapper);
  }
}
