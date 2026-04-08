import { createOptimizedPicture } from '../../scripts/aem.js';
import { eyebrowDecorator, getTagClasses, moveInstrumentation } from '../../scripts/scripts.js';
import {
  DEFAULT_CAROUSEL_OPTIONS,
  initCarousel,
} from '../../scripts/s-and-p-global/s-and-p-carousel.js';
import {
  ensurePublishDate,
  fetchCardsFromTagSearch,
  fetchPageMetadata,
  getManualPageUrlsFromConfig,
  isAuthorEnvironment,
  LUCIDWORKS_PAGE_TYPES,
  tryPushPathname,
} from '../../scripts/s-and-p-global/utils.js';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const MAX_CARDS = 6;

const CARD_IMAGE_BREAKPOINTS = [
  { media: '(min-width: 1025px)', width: '1200' },
  { width: '600' },
];

const INSIGHTS_CAROUSEL_SETTINGS = {
  ...DEFAULT_CAROUSEL_OPTIONS,
  mobileOnly: false,
  infinite: false,
  showBottomNav: false,
  clampToMaxOffset: false,
  addHeaderClass: true,
  moveNavToHeaderActions: true,
  transitionDurationMs: 500,
  transitionEasing: 'ease',
};

/* -------------------------------------------------------------------------- */
/* Block table → key/value config (two-column UE rows)                        */
/* -------------------------------------------------------------------------- */

function getValueCell(row) {
  if (!row) return null;
  return row.children.length > 1 ? row.children[1] : row.children[0] || row;
}

/** Manual card rows (insights-card-item): many columns — do not treat as empty via cell 2 only. */
function isInsightsCardItemRow(row) {
  if (!row || row.tagName !== 'DIV') return false;
  if (row.dataset?.aueModel === 'insights-card-item') return true;
  return row.children.length >= 7;
}

function isEmptyRow(row) {
  if (isInsightsCardItemRow(row)) return false;
  const cell = getValueCell(row) || row;
  if (!cell) return true;
  const hasContentNode = !!cell.querySelector('picture, img, a, h1, h2, h3, h4, h5, h6');
  const hasText = !!cell.textContent?.trim();
  return !hasContentNode && !hasText;
}

function normalizeKey(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function readCellValue(cell) {
  if (!cell) return '';
  const link = cell.querySelector('a[href]');
  if (link) return link.getAttribute('href') || link.href || '';
  return cell.textContent.trim();
}

function collectConfigRows(container, values, cells, prefix = '') {
  [...container.children].forEach((row) => {
    if (row.tagName !== 'DIV') return;
    if (row.children.length < 2) {
      collectConfigRows(row, values, cells, prefix);
      return;
    }

    const label = normalizeKey(row.children[0].textContent || '');
    if (!label) return;

    const key = prefix ? `${prefix}_${label}` : label;
    const valueCell = getValueCell(row);
    values[key] = readCellValue(valueCell);
    cells[key] = valueCell;

    collectConfigRows(valueCell, values, cells, key);
  });
}

function getConfigValue(config, keys) {
  return keys.map((key) => config[key]).find((v) => typeof v === 'string' && v.trim()) || '';
}

function getConfigCell(cells, keys) {
  return keys.map((key) => cells[key]).find(Boolean) || null;
}

/* -------------------------------------------------------------------------- */
/* Paths, URLs, dates                                                         */
/* -------------------------------------------------------------------------- */

function clampCardCount(value) {
  const count = Number.parseInt(value, 10);
  if (Number.isNaN(count)) return MAX_CARDS;
  return Math.min(MAX_CARDS, Math.max(1, count));
}

function parseDateValue(value) {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
}

function isExternalUrl(href) {
  try {
    const url = new URL(href, window.location.origin);
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Flat UE rows (single-column block output)                                  */
/* -------------------------------------------------------------------------- */

function extractFlatInsightsContentConfig(block) {
  const result = { contentSource: '', pageUrls: [], cardTags: '' };
  const seen = new Set();
  let afterSource = false;

  let captureNextRowAsCardTags = false;

  [...block.children]
    .filter((row) => row.tagName === 'DIV')
    .forEach((row) => {
      if (isEmptyRow(row)) return;
      const cell = row.firstElementChild;
      if (!cell) return;

      const text = cell.textContent?.trim() || '';
      const nk = normalizeKey(text);

      if (captureNextRowAsCardTags) {
        const link = cell.querySelector('a[href]');
        if (!link && text && nk !== 'tags') {
          result.cardTags = text;
        }
        captureNextRowAsCardTags = false;
        if (!link) return;
      }

      if (!afterSource) {
        if (text === 'manual-page-selection' || nk === 'manualpageselection') {
          result.contentSource = 'manual-page-selection';
          afterSource = true;
          return;
        }
        if (text === 'tags' || nk === 'tags') {
          result.contentSource = 'tags';
          afterSource = true;
          captureNextRowAsCardTags = true;
          return;
        }
      }

      if (afterSource) {
        const link = cell.querySelector('a[href]');
        if (link) tryPushPathname(link.getAttribute('href') || link.href || '', seen, result.pageUrls);
      }
    });

  return result;
}

function inferFlatManualPageUrls(block) {
  const seen = new Set();
  const urls = [];

  [...block.children].forEach((row) => {
    if (row.tagName !== 'DIV' || isEmptyRow(row)) return;
    const cell = row.firstElementChild;
    if (!cell) return;
    const link = cell.querySelector('a.button[href], a[href]');
    if (!link || link.classList.contains('secondary')) return;
    tryPushPathname(link.getAttribute('href') || '', seen, urls);
  });

  return urls;
}

/* -------------------------------------------------------------------------- */
/* Header + manual card rows                                                  */
/* -------------------------------------------------------------------------- */

function extractFallbackHeader(rows) {
  const fallback = {
    eyebrow: '',
    titleHTML: '',
    ctaHref: '',
    ctaText: '',
    ctaMarkup: null,
  };

  rows.forEach((row) => {
    if (row.children.length >= 7) return;
    const cell = getValueCell(row) || row;
    if (!cell) return;

    if (!fallback.eyebrow) {
      const p = cell.querySelector('p');
      const hasHeading = cell.querySelector('h1, h2, h3, h4, h5, h6');
      if (p && !p.querySelector('a') && !hasHeading) {
        fallback.eyebrow = p.textContent?.trim() || '';
      }
    }

    if (!fallback.titleHTML) {
      const hasHeading = cell.querySelector('h1, h2, h3, h4, h5, h6');
      /* Richtext can output multiple block headings (e.g. two h4 lines). */
      if (hasHeading) fallback.titleHTML = cell.innerHTML;
    }

    if (!fallback.ctaHref) {
      const a = cell.querySelector('a[href]');
      if (a) {
        fallback.ctaHref = a.getAttribute('href') || a.href || '';
        fallback.ctaText = a.textContent?.trim() || '';
        const p = cell.querySelector('p');
        if (p?.querySelector('a[href]')) fallback.ctaMarkup = p.cloneNode(true);
      }
    }
  });

  return fallback;
}

function getAuthoredButtonParagraph(cells) {
  const buttonTextCell = getConfigCell(cells, ['button1text', 'linktext1']);
  const buttonLinkCell = getConfigCell(cells, ['button1', 'link1']);
  const fromText = buttonTextCell?.querySelector('p');
  if (fromText?.querySelector('a[href]')) return fromText.cloneNode(true);
  const fromLink = buttonLinkCell?.querySelector('p');
  if (fromLink?.querySelector('a[href]')) return fromLink.cloneNode(true);
  return null;
}

function appendSectionTitleContent(content, titleCell, config, fallbackHeader) {
  if (titleCell) {
    const titleWrap = document.createElement('div');
    titleWrap.className = 'section-title';
    titleWrap.append(...[...titleCell.cloneNode(true).childNodes]);
    content.append(titleWrap);
    return;
  }

  const titleText = getConfigValue(config, ['sectionheader_sectiontitle', 'sectiontitle', 'title']);
  const fallbackHtml = (fallbackHeader.titleHTML || '').trim();
  const headingCount = (fallbackHtml.match(/<h[1-6]\b/gi) || []).length;

  if (!titleText && !fallbackHtml) return;

  /* Richtext with multiple block headings: config text is flattened; */
  if (fallbackHtml && headingCount > 1) {
    const titleWrap = document.createElement('div');
    titleWrap.className = 'section-title';
    titleWrap.innerHTML = fallbackHtml;
    content.append(titleWrap);
    return;
  }

  if (titleText) {
    const h2 = document.createElement('h2');
    h2.textContent = titleText;
    content.append(h2);
    return;
  }

  const titleWrap = document.createElement('div');
  titleWrap.className = 'section-title';
  titleWrap.innerHTML = fallbackHtml;
  content.append(titleWrap);
}

function createHeader(config, cells, fallbackHeader = {}) {
  const header = document.createElement('div');
  header.className = 'header default-content-wrapper';

  const content = document.createElement('div');
  content.className = 'header-content';

  const eyebrowCell = getConfigCell(cells, ['sectionheader_eyebrow', 'eyebrow']);
  const eyebrowText = getConfigValue(config, ['sectionheader_eyebrow', 'eyebrow'])
    || fallbackHeader.eyebrow
    || '';
  if (eyebrowText) {
    const formatted = eyebrowDecorator(eyebrowCell || eyebrowText);
    if (formatted) content.append(formatted);
  }

  const titleCell = getConfigCell(cells, ['sectionheader_sectiontitle', 'sectiontitle', 'title']);
  appendSectionTitleContent(content, titleCell, config, fallbackHeader);

  const bodyCell = getConfigCell(cells, ['sectionheader_body', 'body']);
  if (bodyCell) {
    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'section-body';
    bodyWrap.append(...[...bodyCell.cloneNode(true).childNodes]);
    content.append(bodyWrap);
  }

  const actions = document.createElement('div');
  actions.className = 'actions';

  const ctaHref = getConfigValue(config, [
    'button1', 'ctalink', 'sectionheader_cta_link1', 'sectionheader_cta_link', 'link1',
  ]) || fallbackHeader.ctaHref || '';

  const ctaText = getConfigValue(config, [
    'button1text', 'ctalabel', 'sectionheader_cta_linktext1', 'sectionheader_cta_linktext', 'linktext1',
  ]) || fallbackHeader.ctaText || 'Browse All';

  const authoredCta = getAuthoredButtonParagraph(cells) || fallbackHeader.ctaMarkup;

  if (authoredCta) {
    const container = document.createElement('div');
    container.className = 'button-container insights-card-cta-button';
    container.append(authoredCta);
    actions.append(container);
  } else if (ctaHref) {
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = ctaHref;
    a.textContent = ctaText;
    if (isExternalUrl(ctaHref)) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    p.append(a);
    const container = document.createElement('div');
    container.className = 'button-container insights-card-cta-button';
    container.append(p);
    actions.append(container);
  }

  header.append(content, actions);
  return { header, actions };
}

function getManualCards(blockRows) {
  const mapped = blockRows
    .filter((row) => row.children.length >= 7 || row.dataset.aueModel === 'insights-card-item')
    .map((row) => {
      const hasImageAltField = row.children.length >= 8;
      const imageCell = row.children[0];
      const imageAltCell = hasImageAltField ? row.children[1] : null;
      const baseIdx = hasImageAltField ? 2 : 1;
      const titleCell = row.children[baseIdx];
      const descriptionCell = row.children[baseIdx + 1];
      const tagCell = row.children[baseIdx + 2];
      const publishDateCell = row.children[baseIdx + 3];
      const timeToReadCell = row.children[baseIdx + 4];
      const linkCell = row.children[baseIdx + 5];
      const link = linkCell?.querySelector('a[href]')?.getAttribute('href') || '';
      const imageElement = imageCell?.querySelector('picture')
        || imageCell?.querySelector('img')
        || null;

      return {
        imageElement,
        imageAlt: imageAltCell?.textContent?.trim() || '',
        title: titleCell?.textContent.trim() || '',
        description: descriptionCell?.textContent.trim() || '',
        tag: tagCell?.textContent.trim() || '',
        publishDate: ensurePublishDate(publishDateCell?.textContent?.trim() || ''),
        timeToRead: timeToReadCell?.textContent.trim() || '',
        link,
        sourceRow: row,
      };
    });
  if (isAuthorEnvironment()) return mapped;
  return mapped.filter((card) => card.title || card.link);
}

function orderCardsByPublishDate(cards) {
  return [...cards].sort(
    (a, b) => parseDateValue(b.publishDate) - parseDateValue(a.publishDate),
  );
}

/* -------------------------------------------------------------------------- */
/* Card DOM                                                                   */
/* -------------------------------------------------------------------------- */

function formatDisplayDate(value) {
  if (!value) return '';
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return value;
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatMinLabel(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  return trimmed.toLowerCase().endsWith('min') ? trimmed : `${trimmed} min`;
}

function canUseOptimizedPicture(src) {
  if (!src || typeof src !== 'string') return false;
  try {
    const u = new URL(src, window.location.href);
    if (u.origin !== window.location.origin) return false;
    return /\.(jpe?g|png|gif|webp)$/i.test(u.pathname);
  } catch {
    return false;
  }
}

function createFallbackPicture(imageUrl, alt) {
  const picture = document.createElement('picture');
  const source = document.createElement('source');
  source.setAttribute('srcset', imageUrl);
  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = alt;
  img.loading = 'lazy';
  picture.append(source, img);
  return picture;
}

function createImageElement(card) {
  const alt = card.imageAlt || card.title || '';

  if (card.imageElement) {
    const clone = card.imageElement.cloneNode(true);
    if (clone.querySelector('source')) {
      const img = clone.querySelector('img');
      if (img) {
        img.setAttribute('alt', card.imageAlt || img.getAttribute('alt') || card.title || '');
      }
      return clone;
    }
    const img = clone.querySelector('img');
    const src = img?.getAttribute('src') || img?.src || '';
    if (src && canUseOptimizedPicture(src)) {
      return createOptimizedPicture(src, alt, false, CARD_IMAGE_BREAKPOINTS);
    }
    if (img) img.setAttribute('alt', alt || img.getAttribute('alt') || '');
    return clone;
  }

  if (card.imageUrl) {
    if (canUseOptimizedPicture(card.imageUrl)) {
      return createOptimizedPicture(card.imageUrl, alt, false, CARD_IMAGE_BREAKPOINTS);
    }
    return createFallbackPicture(card.imageUrl, alt);
  }

  return null;
}

function createArrowIcon() {
  const span = document.createElement('span');
  span.className = 'icon icon-arrow-right';
  span.setAttribute('aria-hidden', 'true');
  span.setAttribute('role', 'presentation');
  const img = document.createElement('img');
  img.dataset.iconName = 'arrow-right';
  img.src = `${window.hlx?.codeBasePath || ''}/icons/arrow-right.svg`;
  img.alt = '';
  img.loading = 'lazy';
  span.append(img);
  return span;
}

function createCardElement(card, style) {
  const hasLink = !!card.link;
  const item = document.createElement(hasLink ? 'a' : 'div');
  item.className = 'card';
  item.classList.add(style === 'condensed-cards' ? 'condensed' : 'featured');
  item.classList.add('insights-card-item');

  if (hasLink) {
    item.href = card.link;
    if (isExternalUrl(card.link)) {
      item.target = '_blank';
      item.rel = 'noopener noreferrer';
    }
  }

  const media = document.createElement('div');
  media.className = 'media';
  const image = createImageElement(card);
  if (image) media.append(image);

  if (card.tag) {
    const tagOverlay = document.createElement('div');
    tagOverlay.className = 'insights-card-tag-overlay';
    const tagSpan = document.createElement('span');
    tagSpan.className = getTagClasses('glass').trim();
    tagSpan.textContent = card.tag;
    tagOverlay.append(tagSpan);
    item.append(tagOverlay);
  }

  const body = document.createElement('div');
  body.className = 'body';

  const cardBody = document.createElement('div');
  cardBody.className = 'insights-card-body';

  const titleRow = document.createElement('div');
  titleRow.className = 'insights-card-title';
  const titleText = document.createElement('p');
  titleText.className = 'insights-card-title-text';
  titleText.textContent = card.title?.split('|')[0] || '';
  titleRow.append(titleText);
  if (card.timeToRead) {
    const titleTime = document.createElement('span');
    titleTime.className = 'insights-card-title-time';
    titleTime.textContent = formatMinLabel(card.timeToRead);
    titleRow.append(titleTime);
  }
  cardBody.append(titleRow);

  if (card.description) {
    const descEl = document.createElement('p');
    descEl.className = 'insights-card-description';
    const descText = document.createElement('span');
    descText.className = 'insights-card-description-text';
    descText.textContent = card.description;
    descEl.append(descText);
    cardBody.append(descEl);
  }

  body.append(cardBody);

  const dateStr = formatDisplayDate(card.publishDate) || card.publishDate || '';
  const timeStrDisplay = formatMinLabel(card.timeToRead);
  if (dateStr || timeStrDisplay) {
    const footer = document.createElement('div');
    footer.className = 'insights-card-footer';
    const datetimeWrap = document.createElement('div');
    datetimeWrap.className = 'insights-card-footer-datetime';
    if (timeStrDisplay) {
      const timeSpan = document.createElement('span');
      timeSpan.className = 'insights-card-footer-time';
      timeSpan.textContent = timeStrDisplay;
      datetimeWrap.append(timeSpan);
    }
    if (dateStr) {
      const dateSpan = document.createElement('span');
      dateSpan.className = 'insights-card-footer-date';
      dateSpan.textContent = dateStr;
      datetimeWrap.append(dateSpan);
    }
    footer.append(datetimeWrap, createArrowIcon());
    body.append(footer);
  }

  if (media.children.length) item.append(media);
  item.append(body);
  return item;
}

/* -------------------------------------------------------------------------- */
/* Resolve card list (manual vs fetched)                                      */
/* -------------------------------------------------------------------------- */

function resolveContentSourceAndUrls(block, config, manualCards, flat = null) {
  const flatConfig = flat || extractFlatInsightsContentConfig(block);
  const fromTable = getConfigValue(config, ['contentsource']);
  let contentSource = fromTable?.trim() || flatConfig.contentSource || 'manual-authoring';
  let pageUrls = getManualPageUrlsFromConfig(config);
  if (!pageUrls.length) pageUrls = flatConfig.pageUrls;

  if (contentSource === 'manual-authoring' && !manualCards.length && !pageUrls.length) {
    const inferred = inferFlatManualPageUrls(block);
    if (inferred.length) {
      contentSource = 'manual-page-selection';
      pageUrls = inferred;
    }
  }

  return { contentSource, pageUrls };
}

async function buildCardsForSource({
  contentSource,
  pageUrls,
  cardTags,
  cardCount,
  manualCards,
  blockConfig,
}) {
  if (contentSource === 'manual-authoring') return manualCards;

  if (contentSource === 'tags') {
    const fromSearch = await fetchCardsFromTagSearch(cardTags, cardCount, {
      maxCards: MAX_CARDS,
      pageType: LUCIDWORKS_PAGE_TYPES.INSIGHTS,
      blockConfig: blockConfig || {},
      forInsightsCard: true,
    });
    /* No fallback to manual cards when Tags is selected. */
    return fromSearch;
  }

  if (contentSource === 'manual-page-selection') {
    /* No fallback to manual cards: empty URLs or failed fetches → no cards. */
    const uniqueUrls = [...new Set(pageUrls)].filter(Boolean).slice(0, cardCount);
    if (!uniqueUrls.length) return [];
    const fetched = await Promise.all(uniqueUrls.map((url) => fetchPageMetadata(url)));
    return fetched
      .filter(Boolean)
      .map((data) => ({
        imageUrl: data.image,
        title: data.title,
        description: data.description,
        tag: data.tag,
        publishDate: data.publishDate,
        timeToRead: data.timeToRead,
        link: data.link,
      }));
  }

  return manualCards;
}

function disableNativeTitleTooltip(anchorEl) {
  if (anchorEl.tagName !== 'A') return;
  anchorEl.removeAttribute('title');
  anchorEl.addEventListener('mouseenter', () => anchorEl.removeAttribute('title'), { passive: true });
  anchorEl.addEventListener('focus', () => anchorEl.removeAttribute('title'), { passive: true });
  const observer = new MutationObserver(() => {
    if (anchorEl.getAttribute('title')) anchorEl.removeAttribute('title');
  });
  observer.observe(anchorEl, { attributes: true, attributeFilter: ['title'] });
}

function wireExploreCtaPlacement(block, actions) {
  const exploreCta = actions.querySelector('.insights-card-cta-button');
  if (!exploreCta) return;

  const mobileMq = window.matchMedia('(max-width: 719px)');
  const placeExploreCta = () => {
    if (mobileMq.matches) block.append(exploreCta);
    else actions.append(exploreCta);
  };
  placeExploreCta();
  mobileMq.addEventListener('change', placeExploreCta);
}

/* -------------------------------------------------------------------------- */
/* decorate                                                                   */
/* -------------------------------------------------------------------------- */

export default async function decorate(block) {
  const rows = [...block.children].filter((row) => !isEmptyRow(row));
  const config = {};
  const configCells = {};
  collectConfigRows(block, config, configCells);
  const fallbackHeader = extractFallbackHeader(rows);
  const flatContent = extractFlatInsightsContentConfig(block);

  let cardStyle = getConfigValue(config, ['classes', 'cardstyle']) || 'featured-cards';
  if (block.classList.contains('condensed-cards')) cardStyle = 'condensed-cards';
  else if (block.classList.contains('featured-cards')) cardStyle = 'featured-cards';

  const cardCount = clampCardCount(getConfigValue(config, ['cardcount']) || '6');
  const cardTags = getConfigValue(config, ['cardtags', 'tags_cardtags'])
    || flatContent.cardTags
    || '';
  const manualCards = getManualCards(rows);

  const { contentSource, pageUrls } = resolveContentSourceAndUrls(
    block,
    config,
    manualCards,
    flatContent,
  );

  let cards = await buildCardsForSource({
    contentSource,
    pageUrls,
    cardTags,
    cardCount,
    manualCards,
    blockConfig: config,
  });

  cards = orderCardsByPublishDate(cards).slice(0, cardCount);

  const { header, actions } = createHeader(config, configCells, fallbackHeader);
  const cardsTrack = document.createElement('div');
  cardsTrack.className = 'track carousel';

  cards.forEach((card) => {
    const item = createCardElement(card, cardStyle);
    if (card.sourceRow) moveInstrumentation(card.sourceRow, item);
    disableNativeTitleTooltip(item);
    cardsTrack.append(item);
  });

  block.replaceChildren(header, cardsTrack);
  block.classList.add('initialized', cardStyle);

  if (cards.length > 1) {
    const result = await initCarousel(cardsTrack, {
      mobileOnly: INSIGHTS_CAROUSEL_SETTINGS.mobileOnly,
      infinite: INSIGHTS_CAROUSEL_SETTINGS.infinite,
      showBottomNav: INSIGHTS_CAROUSEL_SETTINGS.showBottomNav,
      transitionDurationMs: INSIGHTS_CAROUSEL_SETTINGS.transitionDurationMs,
      transitionEasing: INSIGHTS_CAROUSEL_SETTINGS.transitionEasing,
      dragThresholdPx: INSIGHTS_CAROUSEL_SETTINGS.dragThresholdPx,
      swipeCommitPx: INSIGHTS_CAROUSEL_SETTINGS.swipeCommitPx,
      swipeSlideFactor: INSIGHTS_CAROUSEL_SETTINGS.swipeSlideFactor,
      clampToMaxOffset: INSIGHTS_CAROUSEL_SETTINGS.clampToMaxOffset,
    });

    if (result?.nav && INSIGHTS_CAROUSEL_SETTINGS.moveNavToHeaderActions) {
      if (INSIGHTS_CAROUSEL_SETTINGS.addHeaderClass) header.classList.add('carousel-header');
      actions.prepend(result.nav);
      actions.classList.add('has-carousel-nav');
    }
  }

  wireExploreCtaPlacement(block, actions);
}
