import {
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';

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
 * Finds raw "tag" block tables (authored inside other blocks) and replaces
 * each with a styled <span class="tag tag-{variation}"> element.
 *
 * Authored table format (nested inside a parent block):
 *   Row 1 cell: tag (tag-dark)   — block name + variation
 *   Row 2 cell: DataSet          — visible label text
 *
 * @param {Element} container The container to search for tag tables
 */
export function decorateTags(container) {
  container.querySelectorAll('table').forEach((table) => {
    const rows = [...table.querySelectorAll('tr')];
    if (rows.length < 2) return;

    const headerCell = rows[0].querySelector('td, th');
    if (!headerCell) return;

    const headerText = headerCell.textContent.trim().toLowerCase();
    const tagMatch = headerText.match(/^tag(?:\s*\(([^)]+)\))?$/);
    if (!tagMatch) return;

    let classes = 'tag';
    if (tagMatch[1]) {
      let variation = tagMatch[1].trim();
      if (!variation.startsWith('tag-')) {
        variation = `tag-${variation}`;
      }
      classes += ` ${variation}`;
    }

    const contentCell = rows[1].querySelector('td, th');
    if (!contentCell) return;
    const hasContent = contentCell.textContent.trim() || contentCell.querySelector('span.icon');
    if (!hasContent) return;

    const span = document.createElement('span');
    span.className = classes;
    span.append(...contentCell.cloneNode(true).childNodes);
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

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  decorateTags(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
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
  loadHeader(doc.querySelector('header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

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
