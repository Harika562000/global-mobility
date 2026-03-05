import { eyebrowDecorator, moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Smoothly opens an accordion item
 * @param {HTMLElement} body - Accordion content body element
 * @param {HTMLDetailsElement} details - Details wrapper element
 */
function openAccordion(body, details) {
  const inner = body.firstElementChild;
  details.open = true;

  requestAnimationFrame(() => {
    body.style.height = `${inner.scrollHeight}px`;
  });

  const onEnd = (e) => {
    if (e.propertyName !== 'height') return;
    body.style.height = 'auto';
    body.removeEventListener('transitionend', onEnd);
  };

  body.addEventListener('transitionend', onEnd);
}

/**
 * Smoothly closes an accordion item
 * @param {HTMLElement} body - Accordion content body element
 * @param {HTMLDetailsElement} details - Details wrapper element
 */
function closeAccordion(body, details) {
  const inner = body.firstElementChild;
  body.style.height = `${inner.scrollHeight}px`;

  // Force reflow so height transition runs
  body.offsetHeight; // eslint-disable-line no-unused-expressions
  body.style.height = '0px';

  const onEnd = (e) => {
    if (e.propertyName !== 'height') return;
    details.open = false;
    body.removeEventListener('transitionend', onEnd);
  };

  body.addEventListener('transitionend', onEnd);
}

/**
 * Detect if block content comes from Universal Editor (typed header/items).
 * UE may add components as direct children or wrapped in one extra div.
 * @param {Element} block - Accordion block element
 * @returns {boolean}
 */
function isUEStructure(block) {
  if (block.querySelector('[data-aue-model="accordion-header"], [data-aue-model="accordion-item"]')) return true;
  if (block.querySelector(':scope > .accordion-header, :scope > .accordion-item')) return true;
  return Array.from(block.children).some((el) => (
    el.getAttribute?.('data-aue-model') === 'accordion-header'
    || el.getAttribute?.('data-aue-model') === 'accordion-item'
    || (el.children.length === 1 && (el.firstElementChild?.getAttribute?.('data-aue-model') === 'accordion-header'
        || el.firstElementChild?.getAttribute?.('data-aue-model') === 'accordion-item'))
  ));
}

/**
 * Ensure variant class is on block (from UE model or data attributes).
 * @param {Element} block - Accordion block element
 */
function applyVariantClass(block) {
  if (block.classList.contains('small') || block.classList.contains('cards')) return;
  const variant = block.dataset.variant || block.dataset.classes || '';
  if (variant === 'small') block.classList.add('small');
  else if (variant === 'cards') block.classList.add('cards');
}

/**
 * Get header and item elements from UE structure.
 * Looks for direct children and one level of wrapper (UE sometimes wraps new components in a div).
 * @param {Element} block - Accordion block element
 * @returns {{ headerEl: Element | null, itemEls: Element[] }}
 */
function getUEElements(block) {
  const headerSelector = '[data-aue-model="accordion-header"], .accordion-header';
  const itemSelector = '[data-aue-model="accordion-item"], .accordion-item';
  let headerEl = block.querySelector(`:scope > ${headerSelector}`)
    || block.querySelector(`:scope > div > ${headerSelector}`);
  let itemEls = Array.from(block.querySelectorAll(`:scope > ${itemSelector}`));
  if (itemEls.length === 0) {
    itemEls = Array.from(block.querySelectorAll(`:scope > div > ${itemSelector}`));
  }
  return { headerEl: headerEl || null, itemEls };
}

/**
 * Get a field column from a UE element by data-aue-prop or by index.
 * @param {Element} parent - Header or item wrapper
 * @param {string} prop - data-aue-prop value (e.g. 'eyebrow', 'heading')
 * @param {number} index - Fallback index in parent.children
 * @returns {Element | null}
 */
function getUEColumn(parent, prop, index) {
  const byProp = parent.querySelector(`[data-aue-prop="${prop}"]`);
  if (byProp) return byProp;
  const kids = [...parent.children];
  return kids[index] ?? null;
}

/**
 * Get content node or HTML from a UE column (handles nested richtext/divs).
 * @param {Element} col - Column element
 * @returns {{ node: Element | null, html: string, text: string }}
 */
function getColumnContent(col) {
  if (!col) return { node: null, html: '', text: '' };
  const html = col.innerHTML?.trim() || '';
  const text = col.textContent?.trim() || '';
  const node = col.querySelector('h1, h2, h3, h4, h5, h6, p, [data-richtext-prop]')
    || col.firstElementChild;
  return { node, html, text };
}

/**
 * Build header row DOM from UE accordion-header element.
 * Resolves columns by data-aue-prop or by position; extracts content from full column.
 * @param {Element} headerEl - UE accordion header wrapper
 * @returns {HTMLDivElement}
 */
function buildHeaderRowFromUE(headerEl) {
  const firstRow = document.createElement('div');
  firstRow.classList.add('accordion-header');
  const eyebrowCol = getUEColumn(headerEl, 'eyebrow', 0) || headerEl.children[0];
  const headingCol = getUEColumn(headerEl, 'heading', 1) || headerEl.children[1];
  const descriptionCol = getUEColumn(headerEl, 'description', 2) || headerEl.children[2];

  const eyebrowData = getColumnContent(eyebrowCol);
  if (eyebrowData.text) {
    const eyebrow = eyebrowDecorator(eyebrowData.text, 'accordion-header-eyebrow');
    if (eyebrow) {
      if (eyebrowCol && headerEl.contains(eyebrowCol)) moveInstrumentation(eyebrowCol, eyebrow);
      firstRow.append(eyebrow);
    }
  }
  if (headingCol) {
    const { node, html } = getColumnContent(headingCol);
    const heading = node && /^[Hh][1-6]$/.test(node.tagName) ? node : null;
    if (heading) {
      heading.classList.add('accordion-header-heading');
      if (headerEl.contains(headingCol)) moveInstrumentation(headingCol, heading);
      firstRow.append(heading);
    } else if (html) {
      const h2 = document.createElement('h2');
      h2.innerHTML = html;
      h2.classList.add('accordion-header-heading');
      if (headerEl.contains(headingCol)) moveInstrumentation(headingCol, h2);
      firstRow.append(h2);
    }
  }
  const descData = getColumnContent(descriptionCol);
  if (descData.html || descData.text) {
    const desc = descriptionCol?.querySelector('p') || document.createElement('p');
    if (desc.tagName !== 'P') {
      const p = document.createElement('p');
      p.innerHTML = descData.html || descData.text;
      p.classList.add('accordion-header-description');
      if (descriptionCol && headerEl.contains(descriptionCol)) moveInstrumentation(descriptionCol, p);
      firstRow.append(p);
    } else {
      desc.innerHTML = descData.html || descData.text;
      desc.classList.add('accordion-header-description');
      if (descriptionCol && headerEl.contains(descriptionCol)) moveInstrumentation(descriptionCol, desc);
      firstRow.append(desc);
    }
  }
  return firstRow;
}

/**
 * Build one item row DOM from UE accordion-item element.
 * Resolves columns by data-aue-prop or by position; extracts content from full column.
 * @param {Element} itemEl - UE accordion item wrapper
 * @param {boolean} isSmall - Whether accordion is small variant
 * @returns {HTMLDivElement}
 */
function buildItemRowFromUE(itemEl, isSmall) {
  const row = document.createElement('div');
  const labelCol = getUEColumn(itemEl, 'label', 0) || itemEl.children[0];
  const descriptionCol = getUEColumn(itemEl, 'description', 1) || itemEl.children[1];
  const imageCol = getUEColumn(itemEl, 'image', 2) || itemEl.children[2];

  const labelData = getColumnContent(labelCol);
  let label = document.createElement('p');
  if (labelData.node) {
    label = labelData.node.cloneNode(true);
    if (label.tagName !== 'P' && !labelData.html) label = document.createElement('p');
  }
  if (labelData.html && label.tagName === 'P') label.innerHTML = labelData.html;
  else if (labelData.text && !label.innerHTML) label.textContent = labelData.text;

  const contentCell = document.createElement('div');
  contentCell.append(label);
  const descData = getColumnContent(descriptionCol);
  if (descData.html || descData.text) {
    const descEl = descData.node?.cloneNode(true) || document.createElement('p');
    if (descEl.tagName !== 'P') {
      const p = document.createElement('p');
      p.innerHTML = descData.html || descData.text;
      contentCell.append(p);
    } else {
      descEl.innerHTML = descData.html || descData.text;
      contentCell.append(descEl);
    }
  }

  const picture = imageCol?.querySelector?.('picture');
  if (isSmall && picture) {
    const imageCell = document.createElement('div');
    imageCell.append(picture.cloneNode(true));
    row.append(imageCell, contentCell);
  } else {
    row.append(contentCell);
  }
  return row;
}

/**
 * Get UE-style rows when they have no data-aue-model (e.g. newly added in UE).
 * Any div with exactly 3 children matches our header/item model (3 fields).
 * @param {Element} block - Accordion block element
 * @returns {{ headerEl: Element | null, itemEls: Element[] } | null}
 */
function getUEElementsByStructure(block) {
  const candidates = [];
  Array.from(block.children).forEach((child) => {
    const el = child.children.length === 3 ? child : child.firstElementChild;
    if (el?.children?.length === 3) candidates.push(el);
  });
  if (candidates.length === 0) return null;
  return {
    headerEl: candidates[0],
    itemEls: candidates.slice(1),
  };
}

/**
 * Normalize block content into a single structure: { firstRow, rows }.
 * Supports both sheet (table) and UE (accordion-header / accordion-item) content.
 * @param {Element} block - Accordion block element
 * @returns {{ firstRow: Element, rows: Element[] }}
 */
function normalizeContent(block) {
  applyVariantClass(block);

  let headerEl = null;
  let itemEls = [];

  if (isUEStructure(block)) {
    const found = getUEElements(block);
    headerEl = found.headerEl;
    itemEls = found.itemEls;
  }

  // Fallback: newly added UE components may not have data-aue-model yet; detect by structure (div with 3 children)
  if ((!headerEl && itemEls.length === 0) && block.children.length > 0) {
    const byStructure = getUEElementsByStructure(block);
    if (byStructure) {
      headerEl = byStructure.headerEl;
      itemEls = byStructure.itemEls;
    }
  }

  if (headerEl || itemEls.length > 0) {
    const isSmall = block.classList.contains('small');
    const firstRow = headerEl
      ? buildHeaderRowFromUE(headerEl)
      : (() => {
        const empty = document.createElement('div');
        empty.classList.add('accordion-header');
        return empty;
      })();
    const rows = itemEls.map((itemEl) => buildItemRowFromUE(itemEl, isSmall));
    block.innerHTML = '';
    block.append(firstRow, ...rows);
    return { firstRow, rows };
  }

  const [firstRow, ...rows] = [...block.children];
  return { firstRow, rows };
}

export default function decorate(block) {
  // Required for UE: mark block as container so "Add" shows Accordion Header / Accordion Item
  block.setAttribute('data-aue-filter', 'accordion');

  const { firstRow, rows } = normalizeContent(block);
  const accordionItems = [];
  const isSmall = block.classList.contains('small');
  let imagePanel;
  const images = [];

  if (isSmall) {
    imagePanel = document.createElement('div');
    imagePanel.className = 'accordion-image-panel';
  }

  const listWrapper = document.createElement('div');
  listWrapper.className = 'accordion-list';

  // Format eyebrow (sheet may have raw p; UE already has span from buildHeaderRowFromUE)
  const eyebrowSource = firstRow.querySelector('p:not(.accordion-header-description)');
  const eyebrow = eyebrowDecorator(eyebrowSource, 'accordion-header-eyebrow');
  if (eyebrow && eyebrowSource) {
    eyebrowSource.replaceWith(eyebrow);
  }

  firstRow.classList.add('accordion-header');
  const heading = firstRow.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) heading.classList.add('accordion-header-heading');
  const description = firstRow.querySelector('p');
  if (description) description.classList.add('accordion-header-description');

  listWrapper.prepend(firstRow);

  rows.forEach((row, index) => {
    let image;

    const cellChildren = isSmall
      ? [...(row.children[1]?.children ?? [])]
      : [...(row.children[0]?.children ?? [])];
    if (isSmall) {
      image = row.children[0]?.querySelector('picture');
    }
    const [label, ...restCellChildren] = cellChildren;
    const body = document.createElement('div');
    body.className = 'accordion-item-body';
    restCellChildren.forEach((child) => body.append(child));

    // Create summary
    const summary = document.createElement('summary');
    summary.className = 'accordion-item-label';
    summary.append(label ?? document.createElement('p'));

    // Wrap body content for height animation
    const inner = document.createElement('div');
    inner.className = 'accordion-item-body-inner';
    inner.append(...body.childNodes);
    body.append(inner);

    // Create details
    const details = document.createElement('details');
    details.className = 'accordion-item';
    details.append(summary, body);

    if (isSmall) {
      const slot = image || document.createElement('div');
      slot.classList.add('accordion-item-image');
      images.push(slot);
      details.dataset.imageIndex = index;

      details.addEventListener('toggle', () => {
        if (!details.open) return;
        const imageIndex = Number(details.dataset.imageIndex);
        images.forEach((img, idx) => {
          img.classList.toggle('is-active', idx === imageIndex);
        });
      });
    }

    accordionItems.push({ details, body });

    // Accordion open/close behavior
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      accordionItems.forEach((item) => {
        if (item.details !== details && item.details.open) {
          closeAccordion(item.body, item.details);
        }
      });
      if (details.open) {
        closeAccordion(body, details);
      } else {
        openAccordion(body, details);
      }
    });

    listWrapper.append(details);
    row.remove();
  });

  // Build final small variant layout
  if (isSmall) {
    images.forEach((img, i) => {
      img.classList.toggle('is-active', i === 0);
      imagePanel.append(img);
    });
    block.append(imagePanel, listWrapper);
  } else {
    block.append(listWrapper);
  }

  // Open first accordion item on load (skip header row)
  if (accordionItems.length > 0) {
    const firstItem = accordionItems[0];
    firstItem.details.open = true;
    firstItem.body.style.height = 'auto';
  }

  block.querySelectorAll('.button').forEach((btn) => btn.classList.remove('button'));
}
