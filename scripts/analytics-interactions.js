import { pushAnalyticsCustomEvent, pushAnalyticsEvent } from './google-tag-manager.js';
import { getPageTypeForTaxonomy } from './taxonomy-metadata.js';

/** Match decorateButtons document extensions in aem.js */
const ASSET_PATH_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|rar)$/i;
const JS_HREF_SCHEME = ['java', 'script:'].join('');

/**
 * Block name or nearest identifiable section for click context.
 * @param {Element} el
 * @returns {string}
 */
function getClickComponentLocation(el) {
  const block = el.closest('[data-block-name]');
  if (block?.dataset?.blockName) return String(block.dataset.blockName);
  const legacyBlock = el.closest('div.block');
  if (legacyBlock?.dataset?.blockName) return String(legacyBlock.dataset.blockName);
  if (legacyBlock?.classList?.length) {
    const c = legacyBlock.classList[0];
    if (c && c !== 'block') return c;
  }
  const section = el.closest('.section');
  if (section?.dataset?.style) return `section:${section.dataset.style}`;
  return 'page';
}

/**
 * Card title for insights-card, experts-card, and generic cards block (whole-card or inner link).
 * @param {HTMLAnchorElement} anchor
 * @returns {string}
 */
function getCardTitleForLink(anchor) {
  const root = anchor.closest('a.card, a.card-item')
    || anchor.closest('.card-item');
  if (!root) return '';
  const titleEl = root.querySelector(
    '.insights-card-title-text, .experts-card-title, .card-title',
  );
  return (titleEl?.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} href raw href attribute
 * @returns {boolean}
 */
function isNonNavigableHref(href) {
  const h = (href || '').trim();
  const lower = h.toLowerCase();
  if (!h) return true;
  if (lower.startsWith(JS_HREF_SCHEME)) return true;
  if (lower === '#') return true;
  return false;
}

/**
 * CTA styling can be removed in header nav, or never applied when
 * href === link text (decorateButtons).
 * Optional: set data-analytics-cta on authored links that should report as cta_click.
 * @param {HTMLAnchorElement} a
 * @returns {boolean}
 */
function isCtaInteraction(a) {
  if (a.classList.contains('carousel-btn')) return false;
  if (a.hasAttribute('data-analytics-cta')) return true;
  if (a.classList.contains('button')) return true;
  if (a.closest('.button-container')) return true;
  if (a.closest('.insights-card-cta-button, .experts-card-cta-button')) return true;
  const inCtaBlock = a.closest('.cta-block');
  if (inCtaBlock && a.closest('.actions')) return true;
  /* Whole experts/insights card is an <a.card>; carousel href="#" is still a CTA. */
  if (
    a.classList.contains('card')
    && (
      a.classList.contains('insights-card-item')
      || a.classList.contains('featured')
      || a.classList.contains('condensed')
    )
  ) {
    return true;
  }
  /* All <a> tags inside the header nav (sections, tools, brand logo) fire cta_click */
  if (a.closest('.nav-sections, .nav-tools, .nav-brand')) return true;
  return false;
}

/**
 * @param {HTMLAnchorElement} a
 * @returns {boolean}
 */
function isAssetDownloadLink(a) {
  if (a.hasAttribute('download')) return true;
  try {
    const { pathname } = new URL(a.href, window.location.origin);
    return ASSET_PATH_EXT.test(pathname);
  } catch {
    return false;
  }
}

/**
 * @param {HTMLAnchorElement} a
 * @returns {{ asset_name: string, asset_type: string }}
 */
function getAssetMetadata(a) {
  const href = a.getAttribute('href') || '';
  let assetName = (a.getAttribute('download') || a.textContent || a.getAttribute('aria-label') || '').trim();
  let assetType = (a.getAttribute('data-analytics-asset-type') || '').trim();

  try {
    const url = new URL(a.href, window.location.origin);
    if (!assetName) {
      assetName = url.pathname.split('/').pop() || href;
    }
    if (!assetType) {
      const m = url.pathname.match(/\.([a-z0-9]+)$/i);
      assetType = m ? m[1].toLowerCase() : 'file';
    }
  } catch {
    if (!assetType) assetType = 'file';
  }

  return { asset_name: assetName, asset_type: assetType };
}

/**
 * @param {Element} el
 * @returns {boolean}
 */
function isFormSubmitControl(el) {
  if (el instanceof HTMLInputElement && el.type === 'submit') return true;
  if (el instanceof HTMLButtonElement) {
    return (el.getAttribute('type') || 'submit').toLowerCase() === 'submit';
  }
  return false;
}

/**
 * @param {MouseEvent} e
 */
function onDocumentClick(e) {
  if (e.defaultPrevented) return;
  const t = e.target;
  if (!(t instanceof Element)) return;

  const formEl = t.closest('form');
  if (formEl instanceof HTMLFormElement) {
    const formType = getFormType(formEl);
    if (formType.toLowerCase().includes('subscribe') || formType.toLowerCase().includes('subscription')) {
      const control = t.closest('button, input');
      if (control && formEl.contains(control) && isFormSubmitControl(control)) {
        pushAnalyticsCustomEvent('newsletter_click', { newsletter_name: formType });
        return;
      }
      /* AEM AF often uses a visible <a class="button">Submit</a> with a hidden real submit button */
      const submitLink = t.closest('a[href]');
      if (submitLink instanceof HTMLAnchorElement && formEl.contains(submitLink)) {
        const hint = `${submitLink.getAttribute('aria-label') || ''} ${submitLink.getAttribute('title') || ''} ${submitLink.textContent || ''}`
          .toLowerCase();
        if (hint.includes('submit')) {
          pushAnalyticsCustomEvent('newsletter_click', { newsletter_name: formType });
          return;
        }
      }
    }
  }

  const a = t.closest('a[href]');
  if (a instanceof HTMLAnchorElement) {
    const href = a.getAttribute('href') || '';
    const lower = href.trim().toLowerCase();

    if (lower.startsWith('mailto:')) {
      pushAnalyticsCustomEvent('contact_click', { contact_type: 'email' });
      return;
    }
    if (lower.startsWith('tel:')) {
      pushAnalyticsCustomEvent('contact_click', { contact_type: 'phone' });
      return;
    }

    if (isAssetDownloadLink(a)) {
      const { asset_name: assetName, asset_type: assetType } = getAssetMetadata(a);
      pushAnalyticsCustomEvent('asset_download', {
        asset_name: assetName,
        asset_type: assetType,
      });
      return;
    }

    const isCarousel = a.classList.contains('carousel-btn');
    if (isCtaInteraction(a) && !isCarousel) {
      const cardTitle = getCardTitleForLink(a);
      const ctaLabel = (
        cardTitle
        || (a.getAttribute('aria-label') || '').trim()
        || (a.textContent || '').replace(/\s+/g, ' ').trim()
      ).slice(0, 500);
      const ctaLocation = getClickComponentLocation(a);
      pushAnalyticsCustomEvent('cta_click', {
        cta_label: ctaLabel,
        cta_location: ctaLocation,
      });
      return;
    }

    if (isNonNavigableHref(href)) return;

    const cardTitle = getCardTitleForLink(a);
    const linkLabel = (a.textContent || a.getAttribute('aria-label') || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
    pushAnalyticsCustomEvent('link_click', {
      link_url: a.href,
      link_label: linkLabel,
      link_location: getClickComponentLocation(a),
      ...(cardTitle ? { card_title: cardTitle } : {}),
    });
    return;
  }

  const btn = t.closest('button');
  if (btn instanceof HTMLButtonElement) {
    if (btn.classList.contains('search-submit')) return;
    if (btn.classList.contains('carousel-btn')) return;
    if (btn.classList.contains('button')) {
      const ctaLabel = (btn.textContent || btn.getAttribute('aria-label') || '').trim();
      const ctaLocation = getClickComponentLocation(btn);
      pushAnalyticsCustomEvent('cta_click', {
        cta_label: ctaLabel,
        cta_location: ctaLocation,
      });
    }
  }
}

/** Milestone percentages that fire `scroll_depth`. */
const DEPTH_MILESTONES = [25, 50, 75, 100];

/** Minimum ms between continuous `scroll` dataLayer pushes (throttle). */
const SCROLL_THROTTLE_MS = 500;

/** Minimum time (ms) a user must remain on the page for `article_read`. */
const ARTICLE_READ_TIME_MS = 30000;

/** Minimum scroll depth (%) required alongside the time gate. */
const ARTICLE_READ_SCROLL_THRESHOLD = 50;

/**
 * @returns {number} Scroll percentage of the page (0–100, integer).
 */
function getScrollPercentage() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  if (!docHeight) return 0;
  return Math.min(100, Math.round((scrollTop / docHeight) * 100));
}

/**
 * Attaches scroll tracking:
 *  - `scroll`       fires continuously (throttled) with current `scroll_percentage`
 *  - `scroll_depth` fires once each at 25 / 50 / 75 / 100 %
 *  - `article_read` fires once when the 75 % milestone is hit
 */
function initScrollTracking() {
  if (document.body.dataset.analyticsScrollInit === 'true') return;
  document.body.dataset.analyticsScrollInit = 'true';

  const firedMilestones = new Set();
  let scrollTimer = null;
  let lastScrollPct = -1;

  function onScroll() {
    const pct = getScrollPercentage();

    if (pct !== lastScrollPct) {
      lastScrollPct = pct;
      if (scrollTimer === null) {
        scrollTimer = setTimeout(() => {
          scrollTimer = null;
          pushAnalyticsCustomEvent('scroll', { scroll_percentage: getScrollPercentage() });
        }, SCROLL_THROTTLE_MS);
      }
    }

    DEPTH_MILESTONES.forEach((milestone) => {
      if (firedMilestones.has(milestone) || pct < milestone) return;
      firedMilestones.add(milestone);
      pushAnalyticsCustomEvent('scroll_depth', { scroll_percentage: milestone });
    });

    if (firedMilestones.size === DEPTH_MILESTONES.length) {
      window.removeEventListener('scroll', onScroll, { passive: true });
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
}

/**
 * Fires `article_read` once when BOTH conditions are met:
 *  - The user has been on the page for at least 30 seconds (time gate)
 *  - The user has scrolled at least 50 % of the page (engagement gate)
 *
 * Only runs on article / insights page types (detected via page-type metadata).
 * Combining time + scroll avoids false positives from idle tabs (time-only)
 * and accidental fast scrollers (scroll-only).
 */
function initArticleReadTracking() {
  const pageType = getPageTypeForTaxonomy(document);
  if (!pageType) return;
  const lowerPageType = pageType.toLowerCase();
  if (!lowerPageType.includes('insight') && !lowerPageType.includes('article')) return;

  let scrollMet = false;
  let timeMet = false;
  let fired = false;

  function tryFire() {
    if (fired || !scrollMet || !timeMet) return;
    fired = true;
    pushAnalyticsCustomEvent('article_read', {
      article_title: document.title,
      page_type: pageType,
    });
  }

  setTimeout(() => {
    timeMet = true;
    tryFire();
  }, ARTICLE_READ_TIME_MS);

  function onScrollForArticle() {
    if (scrollMet) return;
    if (getScrollPercentage() >= ARTICLE_READ_SCROLL_THRESHOLD) {
      scrollMet = true;
      window.removeEventListener('scroll', onScrollForArticle, { passive: true });
      tryFire();
    }
  }

  window.addEventListener('scroll', onScrollForArticle, { passive: true });
}

/**
 * Resolve form_type from the form's own attributes or nearest block name.
 * @param {HTMLFormElement} form
 * @returns {string}
 */
/**
 * Resolves `form_type` for analytics: prefers eyebrow copy when it mentions contact or subscribe.
 * Eyebrow may live on the form block or in the parent section (outside `<form>`).
 * @param {HTMLFormElement} form
 * @returns {string}
 */
function getFormType(form) {
  const eyebrowRoot = form.closest('.section') || form.closest('[data-block-name]') || form;
  const eyebrow = eyebrowRoot.querySelector('.eye-brow-text, [data-eyebrow], .eye-brow-text');
  if (eyebrow?.textContent) {
    const text = eyebrow.textContent.replace(/\s+/g, ' ').trim();
    const lower = text.toLowerCase();
    if (lower.includes('contact') || lower.includes('subscribe') || lower.includes('subscription')) {
      return text;
    }
  }

  return (
    form.getAttribute('data-form-type')
    || form.dataset.formType
    || form.closest('[data-block-name]')?.dataset?.blockName
    || 'unknown'
  );
}

/**
 * Forms already being watched for state-panel changes (prevents duplicate observers).
 * @type {WeakSet<HTMLFormElement>}
 */
const observedForms = new WeakSet();

/**
 * Watches a form's subtree for success/error panels becoming visible.
 * AEM Adaptive Forms (data-source="aem") signal outcomes by toggling
 * `data-visible="true"` on a child fieldset whose name/class contains
 * "success" or "error".
 * Started on first user interaction so the observer is guaranteed to be running
 * before the submit API call completes.
 * @param {HTMLFormElement} form
 */
function observeFormStatePanel(form) {
  if (observedForms.has(form)) return;
  observedForms.add(form);
  const formType = getFormType(form);
  const observer = new MutationObserver((mutations) => {
    for (let i = 0; i < mutations.length; i += 1) {
      const { attributeName, target } = mutations[i];
      if (attributeName !== 'data-visible') continue; // eslint-disable-line no-continue
      if (!(target instanceof HTMLElement)) continue; // eslint-disable-line no-continue
      if (target.getAttribute('data-visible') !== 'true') continue; // eslint-disable-line no-continue
      const name = (target.getAttribute('name') || '').toLowerCase();
      const cls = (target.className || '').toLowerCase();
      if (name.includes('success') || cls.includes('success')) {
        pushAnalyticsCustomEvent('thank_you_view', { form_type: formType });
        observer.disconnect();
        break;
      }
      if (name.includes('error') || cls.includes('error')) {
        pushAnalyticsEvent('error_view', { error_type: 'form_error', form_type: formType });
        observer.disconnect();
        break;
      }
    }
  });
  observer.observe(form, { attributes: true, attributeFilter: ['data-visible'], subtree: true });
}

/**
 * Tracks which forms have already fired `form_start` this session.
 * WeakSet avoids memory leaks when form elements are removed from the DOM.
 * @type {WeakSet<HTMLFormElement>}
 */
const startedForms = new WeakSet();

/**
 * Delegated handler for `focusin` and `input` — fires `form_start` once per form
 * and immediately starts the success-panel observer so it is active before submit.
 * Both events bubble, so a single listener on `document.body` covers all forms.
 * @param {Event} e
 */
function onFormInteraction(e) {
  const form = e.target.closest('form');
  if (!form || startedForms.has(form)) return;
  startedForms.add(form);
  pushAnalyticsCustomEvent('form_start', { form_type: getFormType(form) });
  observeFormStatePanel(form);
}

/**
 * Delegated handler for the native `submit` event (bubbles).
 * Fires `form_submit`; also ensures the observer is running in case submit fires
 * without a prior focusin/input (e.g. programmatic submission).
 * @param {Event} e
 */
function onFormSubmit(e) {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  pushAnalyticsCustomEvent('form_submit', { form_type: getFormType(form) });
  observeFormStatePanel(form);
}

/**
 * Delegated handler for the `form:success` custom event dispatched by `submitSuccess`
 * in `blocks/form/submit.js` for sheet-based forms (data-source="sheet").
 * Fires `thank_you_view` only when the form stays on the page (no redirect).
 * @param {Event} e
 */
function onFormSuccess(e) {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  pushAnalyticsCustomEvent('thank_you_view', { form_type: getFormType(form) });
}

/**
 * Resolve video_title from the element's own attributes or nearest block context.
 * @param {HTMLVideoElement} video
 * @returns {string}
 */
function getVideoTitle(video) {
  return (
    video.getAttribute('data-video-title')
    || video.getAttribute('title')
    || video.closest('[data-block-name]')?.dataset?.blockName
    || 'video'
  );
}

/**
 * Tracks which videos have already fired `video_play` this session.
 * @type {WeakSet<HTMLVideoElement>}
 */
const playedVideos = new WeakSet();

/**
 * Captured `play` / `ended` handlers — `play` and `ended` do not bubble so we use
 * the capture phase on `document.body` (same delegation pattern as click tracking).
 * `video_play` fires only once per video (pause → resume does not re-fire).
 * @param {Event} e
 */
function onVideoPlay(e) {
  if (!(e.target instanceof HTMLVideoElement)) return;
  if (playedVideos.has(e.target)) return;
  playedVideos.add(e.target);
  pushAnalyticsCustomEvent('video_play', { video_title: getVideoTitle(e.target) });
}

function onVideoEnded(e) {
  if (!(e.target instanceof HTMLVideoElement)) return;
  pushAnalyticsCustomEvent('video_complete', { video_title: getVideoTitle(e.target) });
}

/**
 * Handles all three error_view cases (no UTM params attached):
 *  - 404: reads `data-error-type` from `<body>` on page load
 *  - form_error: detected via MutationObserver in observeFormStatePanel
 *  - system_error: uncaught JS exceptions and unhandled promise rejections
 *    (throttled to at most one event per 5 s to prevent flooding dataLayer)
 */
function initErrorTracking() {
  /* ── 404 page: detected via <main class="error"> ───────────────────── */
  if (document.querySelector('main.error')) {
    pushAnalyticsEvent('error_view', { error_type: '404' });
  }

  /* ── Uncaught JS errors (throttled) ───────────────────────────────── */
  let lastSystemErrorAt = 0;
  const SYSTEM_ERROR_THROTTLE_MS = 5000;

  function onSystemError() {
    const now = Date.now();
    if (now - lastSystemErrorAt < SYSTEM_ERROR_THROTTLE_MS) return;
    lastSystemErrorAt = now;
    pushAnalyticsEvent('error_view', { error_type: 'system_error' });
  }

  window.addEventListener('error', onSystemError);
  window.addEventListener('unhandledrejection', onSystemError);
}

/**
 * Single delegated listener: newsletter, contact, asset, CTA, and generic link_click.
 * Whole experts/insights card anchors (`a.card` + featured|condensed|insights-card-item)
 * even when href is `#` (e.g. carousel slides). Card title is used for cta_label when present.
 * Subscribe forms: `newsletter_click` on submit (see subscribe-form branch in onDocumentClick).
 * Asset type override: `data-analytics-asset-type` on the link.
 * Header nav: all <a> tags inside .nav-sections, .nav-tools, or .nav-brand fire cta_click with
 * cta_label = link text and cta_location = "header".
 * Scroll: fires `scroll` (throttled) and `scroll_depth` at 25 / 50 / 75 / 100 %.
 * Article read: fires `article_read` once when ≥ 30 s elapsed AND ≥ 50 % scrolled (article pages only).
 * Video: fires `video_play` on play and `video_complete` on ended for any <video> element.
 * Form: fires `form_start` (first focusin/input), `form_submit` (submit), and
 *       `thank_you_view` (form:success custom event from submit.js when no redirect).
 * Errors: fires `error_view` for 404 pages, form error panels, and uncaught JS errors.
 */
export function initAnalyticsInteractionTracking() {
  if (typeof document === 'undefined' || document.body.dataset.analyticsInteractionsInit === 'true') {
    return;
  }
  document.body.dataset.analyticsInteractionsInit = 'true';
  document.body.addEventListener('click', onDocumentClick);
  document.body.addEventListener('play', onVideoPlay, { capture: true });
  document.body.addEventListener('ended', onVideoEnded, { capture: true });
  document.body.addEventListener('focusin', onFormInteraction);
  document.body.addEventListener('input', onFormInteraction);
  document.body.addEventListener('submit', onFormSubmit);
  document.body.addEventListener('form:success', onFormSuccess);
  initScrollTracking();
  initArticleReadTracking();
  initErrorTracking();
}

export default initAnalyticsInteractionTracking;
