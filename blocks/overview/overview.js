import { readBlockConfig, toClassName } from '../../scripts/aem.js';
import { createOverviewSwitcher, setupOverviewSwitcher } from '../../atomic/switcher/overview-switcher.js';
import { initCarousel } from '../../scripts/s-and-p-global/s-and-p-carousel.js';
import { loadLottie, bindLottieHover } from '../../scripts/s-and-p-global/lib/lottie.js';
import { fetchForm, createForm, loadFormBlockStyles } from '../form/form.js';
import { initEmbedFormDomEnhancements } from '../embed-form/embed-form.js';

const DEFAULT_OVERVIEW_LABEL = 'Overview';
const DEFAULT_FULLVIEW_LABEL = 'Full View';

/** Mirrors insights-card carousel tuning (overview insights slot). */
const INSIGHTS_CAROUSEL_SETTINGS = {
  transitionDurationMs: 500,
  transitionEasing: 'ease',
  dragThresholdPx: 5,
  swipeCommitPx: 30,
  swipeSlideFactor: 0.3,
  clampToMaxOffset: false,
};

/**
 * Interval (ms) for automatic stat rotation.
 * Read by `initCarousel` via `data-carousel-autoplay-ms`.
 */
const OVERVIEW_NUMERALIA_AUTOPLAY_MS = 5000;

let overviewBlockIdx = 0;

function getOverviewSection(block) {
  const section = block.closest('.section');
  if (!section) return null;
  section.classList.add('overview-container');
  return section;
}

/** `main` in Franklin; fallback to section parent for page-level show/hide. */
function getOverviewPageRoot(section) {
  if (!section) return null;
  return section.closest('main') || section.parentElement;
}

function isAuthoringChrome() {
  return document.documentElement.hasAttribute('data-aue-edit');
}

function labelFromUeRow(row, prop) {
  const el = row.querySelector(`[data-aue-prop="${prop}" i]`);
  return (el?.textContent || '').trim();
}

function partitionBlockRows(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  let overviewLabel = '';
  let fullviewLabel = '';
  const contentRows = [];

  rows.forEach((row) => {
    const o = labelFromUeRow(row, 'overview-tab');
    const f = labelFromUeRow(row, 'fullview-tab');
    if (o) {
      overviewLabel = o;
      return;
    }
    if (f) {
      fullviewLabel = f;
      return;
    }

    const cells = [...row.children];
    if (cells.length >= 2) {
      const key = toClassName(cells[0].textContent);
      if (
        key === 'overview-tab'
        || key === 'fullview-tab'
        || key === 'overview-tab-label'
        || key === 'fullview-tab-label'
      ) {
        const val = (cells[1].textContent || '').trim();
        if (key.includes('overview')) overviewLabel = val || overviewLabel;
        if (key.includes('fullview')) fullviewLabel = val || fullviewLabel;
        return;
      }
    }

    contentRows.push(row);
  });

  const cfg = readBlockConfig(block);
  if (!overviewLabel) {
    overviewLabel = cfg['overview-tab']
      || cfg['overview-tab-label']
      || DEFAULT_OVERVIEW_LABEL;
  }
  if (!fullviewLabel) {
    fullviewLabel = cfg['fullview-tab']
      || cfg['fullview-tab-label']
      || DEFAULT_FULLVIEW_LABEL;
  }

  return { overviewLabel, fullviewLabel, contentRows };
}

/** Explicit slot from data attribute (preferred in UE). */
function slotFromDataset(row) {
  const raw = row.getAttribute('data-overview-slot')?.trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'fullview') return 'fullview';
  if (raw === 'hero' || raw === 'stat' || raw === 'insights' || raw === 'products' || raw === 'contact') {
    return raw;
  }
  if (raw === 'card' || raw.startsWith('card-')) return 'card';
  return null;
}

/** Infer slot from first column label (Franklin-style rows). */
function slotFromFirstCell(row) {
  const first = row.querySelector(':scope > div:first-child');
  const key = (first?.textContent || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return null;
  if (key === 'full view' || key === 'fullview') return 'fullview';
  if (key === 'hero' || key === 'hero copy') return 'hero';
  if (key === 'stat' || key === 'credibility' || key === 'stats') return 'stat';
  if (key === 'card' || /^card\s*\d*$/.test(key) || key.startsWith('action card')) return 'card';
  if (key.includes('insight')) return 'insights';
  if (key.includes('product')) return 'products';
  if (key.includes('contact') || key.includes('question')) return 'contact';
  return null;
}

/**
 * Pull authored cell content into a wrapper. If labeled row, drop first column.
 */
function rowToContentFragment(row, stripLabel) {
  const cells = [...row.querySelectorAll(':scope > div')];
  const frag = document.createElement('div');
  frag.className = 'overview-slot-inner';
  const start = stripLabel && cells.length >= 2 ? 1 : 0;
  for (let i = start; i < cells.length; i += 1) {
    frag.append(...[...cells[i].childNodes]);
  }
  return frag;
}

function parseLayoutRows(contentRows) {
  const slots = {
    hero: null,
    stat: null,
    cards: [],
    insights: null,
    products: null,
    contact: null,
  };
  const fullviewFragments = [];
  const pending = [];

  contentRows.forEach((row) => {
    const fromData = slotFromDataset(row);
    const fromCell = slotFromFirstCell(row);
    const slot = fromData || fromCell;
    const stripLabel = !fromData && !!fromCell;

    if (slot === 'fullview') {
      fullviewFragments.push(rowToContentFragment(row, stripLabel));
      return;
    }

    if (slot === 'hero') {
      slots.hero = rowToContentFragment(row, stripLabel);
      return;
    }
    if (slot === 'stat') {
      slots.stat = rowToContentFragment(row, stripLabel);
      return;
    }
    if (slot === 'card') {
      slots.cards.push(rowToContentFragment(row, stripLabel));
      return;
    }
    if (slot === 'insights') {
      slots.insights = rowToContentFragment(row, stripLabel);
      return;
    }
    if (slot === 'products') {
      slots.products = rowToContentFragment(row, stripLabel);
      return;
    }
    if (slot === 'contact') {
      slots.contact = rowToContentFragment(row, stripLabel);
      return;
    }

    pending.push(row);
  });

  let i = 0;
  if (!slots.hero && i < pending.length) {
    slots.hero = rowToContentFragment(pending[i], false);
    i += 1;
  }
  if (!slots.stat && i < pending.length) {
    slots.stat = rowToContentFragment(pending[i], false);
    i += 1;
  }
  while (slots.cards.length < 4 && i < pending.length) {
    slots.cards.push(rowToContentFragment(pending[i], false));
    i += 1;
  }
  if (!slots.insights && i < pending.length) {
    slots.insights = rowToContentFragment(pending[i], false);
    i += 1;
  }
  if (!slots.products && i < pending.length) {
    slots.products = rowToContentFragment(pending[i], false);
    i += 1;
  }
  if (!slots.contact && i < pending.length) {
    slots.contact = rowToContentFragment(pending[i], false);
    i += 1;
  }
  while (i < pending.length) {
    fullviewFragments.push(rowToContentFragment(pending[i], false));
    i += 1;
  }

  return { slots, fullviewFragments };
}

function injectHeroSwitcher(pageRoot, tablist) {
  const hero = pageRoot?.querySelector('.hero:not(.overview-container .hero)');
  if (!hero || hero.querySelector('.overview-switcher-hero-host')) return;
  const host = document.createElement('div');
  host.className = 'overview-switcher-hero-host';
  host.appendChild(tablist);
  hero.appendChild(host);
}

function scheduleInjectHeroSwitcher(pageRoot, tablist) {
  pageRoot?.addEventListener('hero:decorated', () => {
    injectHeroSwitcher(pageRoot, tablist);
  }, { once: true });
}

function findHeroEmAccentContent(pageRoot) {
  if (!pageRoot) return null;
  return pageRoot.querySelector('.section:not(.overview-container) .hero .hero-em-accent-content');
}

/**
 * First `p` in document order after `afterEl` within `root`.
 * Excludes prose inside `.button-container`.
 * @param {Element} root
 * @param {Element} afterEl
 * @returns {HTMLParagraphElement|null}
 */
function findFirstParagraphAfter(root, afterEl) {
  if (!root || !afterEl || !root.contains(afterEl)) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  walker.currentNode = afterEl;
  let next = walker.nextNode();
  while (next) {
    if (next.tagName === 'P' && !next.closest('.button-container')) {
      return /** @type {HTMLParagraphElement} */ (next);
    }
    next = walker.nextNode();
  }
  return null;
}

/**
 * Extract heading and description from the Full View hero and inject into overview hero.
 * Listens for `hero:decorated` so injection happens after hero.js has built its DOM.
 */
function scheduleInjectHeroEmAccentContent(pageRoot, panelOverview) {
  const heroMain = panelOverview.querySelector('.overview-hero-main');
  if (!heroMain) return;

  pageRoot?.addEventListener('hero:decorated', () => {
    const source = findHeroEmAccentContent(pageRoot);
    if (!source || heroMain.querySelector('.overview-hero-title')) return;

    const sourceHeading = source.querySelector('h1, h2, h3');
    const sourceDesc = sourceHeading
      ? findFirstParagraphAfter(source, sourceHeading)
      : source.querySelector('p:not(.button-container p)');
    if (!sourceHeading && !sourceDesc) return;

    const content = document.createElement('div');
    content.className = 'hero-em-accent-content';

    if (sourceHeading) {
      const h1 = document.createElement('h1');
      h1.innerHTML = sourceHeading.innerHTML;
      content.append(h1);
    }

    if (sourceDesc) {
      const p = document.createElement('p');
      p.innerHTML = sourceDesc.innerHTML;
      content.append(p);
    }

    heroMain.append(content);
  }, { once: true });
}

function scheduleInjectCards(pageRoot, panelOverview) {
  const rowCards = panelOverview.querySelector('.overview-main-cards');
  if (!rowCards) return;

  pageRoot?.addEventListener('cards:decorated', () => {
    const source = pageRoot.querySelector('.cards:not(.overview-container .cards)');
    if (!source) return;

    const cards = [...source.querySelectorAll('.card-item')];
    cards.forEach((card) => {
      const clone = card.cloneNode(true);
      const bodyIcon = clone.querySelector('.card-body .icon');
      const cardHead = clone.querySelector('.card-head');
      const cardTitle = clone.querySelector('.card-title');

      // Extract description text before removing card-body
      const bodyText = [...(clone.querySelector('.card-body')?.childNodes || [])]
        .filter((n) => !(n.classList?.contains('icon')))
        .map((n) => n.textContent?.trim())
        .filter(Boolean)
        .join(' ');

      if (cardHead && cardTitle) {
        const bottom = document.createElement('div');
        bottom.className = 'card-bottom';

        const textContent = document.createElement('div');
        textContent.className = 'card-bottom-content';

        // Insert bottom at cardTitle's position before moving cardTitle into it
        cardTitle.replaceWith(bottom);
        textContent.append(cardTitle);

        if (bodyText) {
          const desc = document.createElement('p');
          desc.className = 'card-description';
          desc.textContent = bodyText;
          textContent.append(desc);
        }

        bottom.append(textContent);
        if (bodyIcon) bottom.append(bodyIcon);
      }

      clone.querySelector('.card-body')?.remove();

      rowCards.append(clone);
    });
    rowCards.style.setProperty('--overview-cards-count', cards.length);
  }, { once: true });
}

/**
 * Wrap footer + tag in one row for overview-only styling (see overview.css).
 * @param {HTMLElement} cardEl `.card.insights-card-item` clone
 */
function wrapOverviewInsightsCardTopRow(cardEl) {
  const tag = cardEl.querySelector(':scope > .insights-card-tag-overlay');
  const footer = cardEl.querySelector('.body .insights-card-footer');
  if (!tag && !footer) return;

  const row = document.createElement('div');
  row.className = 'overview-insights-card-toprow';

  if (footer) {
    row.appendChild(footer);
  }
  if (tag) {
    row.appendChild(tag);
  }

  cardEl.prepend(row);
}

function scheduleInjectNumeraliaStat(pageRoot, panelOverview) {
  const stat = panelOverview.querySelector('.overview-hero-stat');
  if (!stat) return;

  pageRoot?.addEventListener('numeralia:decorated', () => {
    const source = pageRoot.querySelector('.numeralia:not(.overview-container .numeralia) .stats');
    if (!source) return;

    const statItems = [...source.querySelectorAll('.stat-item')];
    if (!statItems.length) return;

    statItems.forEach((item) => {
      const clone = item.cloneNode(true);
      const numberEl = clone.querySelector('.numeralia-number');
      if (numberEl) {
        const value = numberEl.getAttribute('data-target') || '';
        numberEl.classList.add('animated');
        numberEl.innerHTML = `<span class="numeralia-number-wrapper"><span class="numeralia-number-scroll"><span class="number-item">${value}</span></span></span>`;
      }
      stat.append(clone);
    });
    stat.setAttribute('data-carousel-autoplay-ms', String(OVERVIEW_NUMERALIA_AUTOPLAY_MS));
    initCarousel(stat, { mobileOnly: false, infinite: false, vertical: true });
  }, { once: true });
}

function scheduleInjectInsightsCards(pageRoot, panelOverview) {
  const insightsSlot = panelOverview.querySelector('.overview-grid-insights');
  if (!insightsSlot) return;

  pageRoot?.addEventListener('insights-card:decorated', async () => {
    const source = pageRoot.querySelector('.section:not(.overview-container) .insights-card.initialized');
    if (!source) return;

    const cards = [...source.querySelectorAll('.card.insights-card-item')];
    if (!cards.length) return;

    const root = document.createElement('div');
    root.className = 'overview-insights-root';

    const header = document.createElement('div');
    header.className = 'overview-insights-header';
    const headerSrc = source.querySelector('.header');
    const eyebrowEl = headerSrc?.querySelector('.eye-brow-text');
    if (eyebrowEl) {
      const wrap = document.createElement('div');
      wrap.className = 'overview-insights-eyebrow';
      const eyebrowClone = eyebrowEl.cloneNode(true);
      eyebrowClone.classList.remove('eye-brow-text');
      eyebrowClone.classList.add('overview-insights-eyebrow-label');
      wrap.appendChild(eyebrowClone);
      header.appendChild(wrap);
    }
    const cta = source.querySelector('.insights-card-cta-button a[href]')
      || headerSrc?.querySelector('.actions a[href]');
    if (cta) {
      const ctaClone = document.createElement('a');
      ctaClone.className = 'overview-insights-cta text-link-button';
      ctaClone.href = cta.getAttribute('href') || '#';
      ctaClone.textContent = cta.textContent.trim();
      if (cta.getAttribute('target')) ctaClone.target = cta.getAttribute('target');
      if (cta.getAttribute('rel')) ctaClone.rel = cta.getAttribute('rel');
      header.appendChild(ctaClone);
    }
    root.appendChild(header);

    const cardsShell = document.createElement('div');
    cardsShell.className = 'insights-card initialized overview-insights-cards-shell';
    cardsShell.classList.add(
      source.classList.contains('condensed-cards') ? 'condensed-cards' : 'featured-cards',
    );

    const trackHost = document.createElement('div');
    trackHost.className = 'track carousel overview-insights-carousel';
    trackHost.setAttribute('aria-label', 'Latest insights');
    cards.forEach((card) => {
      const clone = card.cloneNode(true);
      wrapOverviewInsightsCardTopRow(clone);
      trackHost.appendChild(clone);
    });
    cardsShell.appendChild(trackHost);
    root.appendChild(cardsShell);
    insightsSlot.appendChild(root);

    if (cards.length > 1) {
      await initCarousel(trackHost, {
        mobileOnly: false,
        infinite: false,
        showBottomNav: false,
        transitionDurationMs: INSIGHTS_CAROUSEL_SETTINGS.transitionDurationMs,
        transitionEasing: INSIGHTS_CAROUSEL_SETTINGS.transitionEasing,
        dragThresholdPx: INSIGHTS_CAROUSEL_SETTINGS.dragThresholdPx,
        swipeCommitPx: INSIGHTS_CAROUSEL_SETTINGS.swipeCommitPx,
        swipeSlideFactor: INSIGHTS_CAROUSEL_SETTINGS.swipeSlideFactor,
        clampToMaxOffset: INSIGHTS_CAROUSEL_SETTINGS.clampToMaxOffset,
      });
      const nextLink = trackHost.querySelector('a.carousel-next');
      if (nextLink) {
        nextLink.classList.remove('button', 'secondary', 'icon-only');
        nextLink.classList.add('overview-insights-carousel-next-link');
      }
    }
  }, { once: true });
}

/**
 * Second adaptive form instance in the contact column.
 * Uses the same definition URL and init path as embed-form.
 * Reuses {@link initEmbedFormDomEnhancements} for step dots, labels,
 * dropdowns, connect panel, and buttons.
 */
function scheduleInjectEmbedFormContact(pageRoot, panelOverview) {
  const contactSlot = panelOverview.querySelector('.overview-grid-contact');
  if (!contactSlot) return;

  let mountInFlight = false;

  const mountFromEmbedForm = async () => {
    if (contactSlot.querySelector('.overview-grid-contact-embed') || mountInFlight) return;

    const embedBlock = pageRoot.querySelector('.section:not(.overview-container) .embed-form');
    const formUrl = embedBlock?.dataset?.embedFormDefinitionUrl;
    if (!formUrl) return;

    mountInFlight = true;
    contactSlot.innerHTML = '';

    const shell = document.createElement('div');
    shell.className = 'embed-form overview-grid-contact-embed';
    const formDiv = document.createElement('div');
    formDiv.className = 'form';
    shell.appendChild(formDiv);
    contactSlot.appendChild(shell);

    try {
      const formDef = await fetchForm(formUrl);
      if (!formDef) return;

      loadFormBlockStyles(formDef);
      const afModule = await import('../form/rules/index.js');
      if (!afModule?.initAdaptiveForm) return;
      const form = await afModule.initAdaptiveForm(formDef, createForm);
      if (form) formDiv.append(form);

      const formEl = formDiv.querySelector('form');
      if (formEl) {
        initEmbedFormDomEnhancements(formEl);
      } else {
        const observer = new MutationObserver(() => {
          const rendered = formDiv.querySelector('form');
          if (rendered) {
            observer.disconnect();
            initEmbedFormDomEnhancements(rendered);
          }
        });
        observer.observe(formDiv, { childList: true, subtree: true });
      }
    } finally {
      mountInFlight = false;
    }
  };

  pageRoot?.addEventListener('embed-form:decorated', mountFromEmbedForm, { once: true });

  requestAnimationFrame(() => {
    const emb = pageRoot?.querySelector('.section:not(.overview-container) .embed-form');
    if (emb?.dataset?.embedFormDefinitionUrl && !contactSlot.querySelector('.overview-grid-contact-embed')) {
      mountFromEmbedForm();
    }
  });
}

function scheduleInjectProductCards(pageRoot, panelOverview) {
  const productsSlot = panelOverview.querySelector('.overview-grid-products');
  if (!productsSlot) return;

  pageRoot?.addEventListener('product-cards:decorated', () => {
    const source = pageRoot.querySelector('.product-cards:not(.overview-container .product-cards)');
    if (!source) return;

    // --- Header: section title + Browse Catalog CTA ---
    const section = source.closest('.section');
    const headerEl = section?.querySelector('.default-content-wrapper, .section-title-wrapper');
    const heading = headerEl?.querySelector('h1, h2, h3, h4, h5, h6');
    // CTA may have been moved into the carousel nav by bindSectionCtaToCarousel
    const ctaLink = headerEl?.querySelector('a[href]')
      || section?.querySelector('.carousel-cta a[href]')
      || source.querySelector('.carousel-cta a[href]');

    const header = document.createElement('div');
    header.className = 'overview-products-header';

    if (heading) {
      const titleEl = document.createElement('span');
      titleEl.className = 'overview-products-title';
      titleEl.textContent = heading.textContent.trim();
      header.append(titleEl);
    }

    if (ctaLink) {
      const ctaClone = document.createElement('a');
      ctaClone.className = 'overview-products-cta text-link-button';
      ctaClone.href = ctaLink.getAttribute('href') || '#';
      ctaClone.textContent = ctaLink.textContent.trim();
      if (ctaLink.getAttribute('target')) ctaClone.target = ctaLink.getAttribute('target');
      header.append(ctaClone);
    }

    productsSlot.append(header);

    // --- Product rows: title left, lottie right, separated by dividers ---
    const list = document.createElement('div');
    list.className = 'overview-products-list';
    productsSlot.append(list);

    const items = [...source.querySelectorAll('.product-card-item')];
    items.forEach((item) => {
      const divider = document.createElement('hr');
      divider.className = 'overview-products-divider';
      list.append(divider);

      const isLink = item.tagName === 'A' && item.href;
      const row = document.createElement(isLink ? 'a' : 'div');
      row.className = 'overview-products-row';
      if (isLink) {
        row.href = item.getAttribute('href');
        if (item.getAttribute('target')) row.target = item.getAttribute('target');
        if (item.getAttribute('rel')) row.rel = item.getAttribute('rel');
      }

      const titleEl = item.querySelector('.product-card-title-text');
      const textCol = document.createElement('div');
      textCol.className = 'overview-products-row-text';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'overview-products-row-title';
      titleSpan.textContent = titleEl?.textContent?.trim() || '';
      textCol.append(titleSpan);

      const descSource = item.querySelector('.product-card-description-text');
      if (descSource?.textContent?.trim()) {
        const descWrap = document.createElement('div');
        descWrap.className = 'overview-products-row-description';
        const descInner = document.createElement('span');
        descInner.className = 'overview-products-row-description-text';
        descInner.innerHTML = descSource.innerHTML;
        descWrap.append(descInner);
        textCol.append(descWrap);
      }

      row.append(textCol);

      const lottieHost = item.querySelector('.product-card-lottie');
      if (lottieHost) {
        const lottieWrap = document.createElement('div');
        lottieWrap.className = 'overview-products-row-lottie';
        const lottieDest = document.createElement('div');
        lottieWrap.append(lottieDest);
        row.append(lottieWrap);

        const jsonStr = lottieHost.dataset.lottieJson;
        if (jsonStr) {
          let chartJson;
          try { chartJson = JSON.parse(jsonStr); } catch (e) { /* ignore */ }
          if (chartJson) {
            loadLottie().then((lottie) => {
              const animation = lottie.loadAnimation({
                container: lottieDest,
                renderer: 'svg',
                loop: false,
                autoplay: false,
                animationData: chartJson,
              });
              bindLottieHover(animation, row);
            }).catch(() => { /* ignore */ });
          }
        }
      }

      list.append(row);
    });
  }, { once: true });
}

function buildOverviewLayout(slots) {
  const hero = document.createElement('div');
  hero.className = 'overview-hero';

  const heroInner = document.createElement('div');
  heroInner.className = 'overview-hero-inner';

  const heroMain = document.createElement('div');
  heroMain.className = 'overview-hero-main';

  const stat = document.createElement('aside');
  stat.className = 'overview-hero-stat';
  if (slots.stat?.childNodes.length) stat.appendChild(slots.stat);

  heroInner.append(heroMain, stat);
  hero.appendChild(heroInner);

  const main = document.createElement('div');
  main.className = 'overview-main';

  const rowCards = document.createElement('div');
  rowCards.className = 'overview-main-cards';

  const insights = document.createElement('div');
  insights.className = 'overview-grid-insights';
  if (slots.insights?.childNodes.length) insights.appendChild(slots.insights);

  const products = document.createElement('div');
  products.className = 'overview-grid-products';
  if (slots.products?.childNodes.length) products.appendChild(slots.products);

  const subrow = document.createElement('div');
  subrow.className = 'overview-main-subrow';
  subrow.append(insights, products);

  const leftCol = document.createElement('div');
  leftCol.className = 'overview-main-left';
  leftCol.append(rowCards, subrow);

  const contact = document.createElement('div');
  contact.className = 'overview-grid-contact';
  if (slots.contact?.childNodes.length) contact.appendChild(slots.contact);

  const rightCol = document.createElement('div');
  rightCol.className = 'overview-main-right';
  rightCol.appendChild(contact);

  main.append(leftCol, rightCol);

  const root = document.createElement('div');
  root.className = 'overview-layout';
  root.append(hero, main);
  return root;
}

export default function decorate(block) {
  if (isAuthoringChrome()) return;
  block.classList.add('overview');

  const { contentRows } = partitionBlockRows(block);
  const { slots, fullviewFragments } = parseLayoutRows(contentRows);
  overviewBlockIdx += 1;
  const bid = overviewBlockIdx;

  const panelOverview = document.createElement('div');
  const panelFullview = document.createElement('div');
  panelOverview.className = 'overview-panel overview-panel-overview';
  panelFullview.className = 'overview-panel overview-panel-fullview';
  panelOverview.setAttribute('role', 'tabpanel');
  panelFullview.setAttribute('role', 'tabpanel');
  panelOverview.id = `overview-panel-0-${bid}`;
  panelFullview.id = `overview-panel-1-${bid}`;

  // const topInner = document.createElement('div');

  const layout = buildOverviewLayout(slots);
  panelOverview.appendChild(layout);

  const fullviewInner = document.createElement('div');
  fullviewInner.className = 'overview-fullview-stack';
  fullviewFragments.forEach((frag) => {
    if (frag.childNodes.length) fullviewInner.appendChild(frag);
  });
  panelFullview.appendChild(fullviewInner);

  block.textContent = '';
  const panels = document.createElement('div');
  panels.className = 'overview-panels';
  panels.append(panelOverview, panelFullview);

  const body = document.createElement('div');
  body.className = 'overview-body';
  body.appendChild(panels);

  block.append(body);

  panelOverview.hidden = true;

  const section = getOverviewSection(block);
  const pageRoot = getOverviewPageRoot(section);

  scheduleInjectHeroEmAccentContent(pageRoot, panelOverview);

  const tablist = createOverviewSwitcher({
    bid,
    panelOverviewId: panelOverview.id,
    panelFullviewId: panelFullview.id,
  });

  const heroInner = layout.querySelector('.overview-hero-inner');
  if (heroInner) heroInner.prepend(tablist);

  const heroTablist = createOverviewSwitcher({
    bid,
    panelOverviewId: panelOverview.id,
    panelFullviewId: panelFullview.id,
    idSuffix: 'hero',
  });

  scheduleInjectHeroSwitcher(pageRoot, heroTablist);
  scheduleInjectNumeraliaStat(pageRoot, panelOverview);
  scheduleInjectCards(pageRoot, panelOverview);
  scheduleInjectInsightsCards(pageRoot, panelOverview);
  scheduleInjectProductCards(pageRoot, panelOverview);
  scheduleInjectEmbedFormContact(pageRoot, panelOverview);

  const btnOverview = tablist.querySelector(`[aria-controls="${panelOverview.id}"]`);
  const btnFullview = tablist.querySelector(`[aria-controls="${panelFullview.id}"]`);
  const heroBtnOverview = heroTablist.querySelector(`[aria-controls="${panelOverview.id}"]`);
  const heroBtnFullview = heroTablist.querySelector(`[aria-controls="${panelFullview.id}"]`);

  setupOverviewSwitcher({
    tabSets: [
      { btnOverview, btnFullview },
      { btnOverview: heroBtnOverview, btnFullview: heroBtnFullview },
    ],
    panelOverview,
    panelFullview,
    pageRoot,
  });
}
