import {
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  getMetadata,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';

// Intercept fetch to inject CSRF token for AEM adaptive form FDM calls
(function initCsrfProtection() {
  const originalFetch = window.fetch;
  window.fetch = function csrfFetch(...args) {
    const [url, options] = args;
    let urlStr = '';
    if (typeof url === 'string') {
      urlStr = url;
    } else if (url instanceof Request) {
      urlStr = url.url;
    }
    if (urlStr.includes('.af.dermis') && options && options.method === 'POST') {
      return originalFetch('/libs/granite/csrf/token.json')
        .then((resp) => resp.json())
        .then((data) => {
          if (data && data.token) {
            if (!options.headers) options.headers = {};
            if (options.headers instanceof Headers) {
              options.headers.set('CSRF-Token', data.token);
            } else {
              options.headers['CSRF-Token'] = data.token;
            }
            // Also add to body for maximum compatibility
            if (options.body instanceof FormData || options.body instanceof URLSearchParams) {
              options.body.append(':cq_csrf_token', data.token);
            } else if (typeof options.body === 'string') {
              options.body += `&${encodeURIComponent(':cq_csrf_token')}=${encodeURIComponent(data.token)}`;
            } else if (options.body && typeof options.body === 'object') {
              options.body[':cq_csrf_token'] = data.token;
            }
          }
          return originalFetch(url, options);
        });
    }
    return originalFetch.apply(this, args);
  };
}());

/** Base origin for dynamic imports (e.g. plugins). */
export const NX_ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';

/**
 * Extracts text from a source element/string and returns it wrapped in:
 * <span class="eye-brow-text {additionalClass}">Extracted text</span>
 *
 * @param {Element|string} source Element (or string) to extract text from
 * @param {string} [additionalClass=''] Additional CSS class(es) to append
 * @returns {HTMLSpanElement|null} Span element or null if no text found
 */
export function eyebrowDecorator(source, additionalClass = '') {
  const text = (typeof source === 'string' ? source : source?.textContent || '').trim();
  if (!text) return null;
  const span = document.createElement('span');
  span.className = ['eye-brow-text', additionalClass].filter(Boolean).join(' ');
  span.textContent = text;
  return span;
}

/**
 * Returns tag class string for a variation name (e.g. "dark" -> "tag tag-dark").
 * @param {string} [variation] Variation name, with or without "tag-" prefix
 * @returns {string} Class string for the tag span
 */
export function getTagClasses(variation) {
  const v = (variation || '').trim().toLowerCase().replace(/^tag-/, '');
  return v ? `tag tag-${v}` : 'tag tag-dark';
}

/**
 * Decorates nested tag tables inside a container (e.g. Hero, sections).
 * Finds tables with row1 = "tag (tag-dark)", row2 = label text, replaces each with a tag span.
 *
 * @param {Element} container The container to search for tag tables
 */
export function decorateTags(container) {
  container.querySelectorAll('table').forEach((table) => {
    const trs = [...table.querySelectorAll('tr')];
    if (trs.length < 2) return;

    const headerCell = trs[0].querySelector('td, th');
    if (!headerCell) return;

    const headerText = headerCell.textContent.trim().toLowerCase();
    const tagMatch = headerText.match(/^tag(?:\s*\(([^)]+)\))?$/);
    if (!tagMatch) return;

    const variation = tagMatch[1] ? tagMatch[1].trim() : '';
    const contentCell = trs[1].querySelector('td, th');
    const content = contentCell ? contentCell.textContent.trim() : '';
    if (!content) return;

    const span = document.createElement('span');
    span.className = getTagClasses(variation);
    span.textContent = content;
    table.replaceWith(span);
  });
}

/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to?.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

function autolinkModals(doc) {
  doc.addEventListener('click', async (e) => {
    const origin = e.target.closest('a');
    if (origin && origin.href && origin.href.includes('/modals/')) {
      e.preventDefault();
      const { openModal } = await import(`${window.hlx.codeBasePath}/blocks/modal/modal.js`);
      openModal(origin.href);
    }
  });
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

function a11yLinks(main) {
  const links = main.querySelectorAll('a');
  links.forEach((link) => {
    let label = link.textContent;
    if (!label && link.querySelector('span.icon')) {
      const icon = link.querySelector('span.icon');
      label = icon ? icon.classList[1]?.split('-')[1] : label;
    }
    link.setAttribute('aria-label', label);
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  // add aria-label to links
  a11yLinks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  if (getMetadata('breadcrumbs').toLowerCase() === 'true') {
    doc.body.dataset.breadcrumbs = true;
  }
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  autolinkModals(doc);

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
