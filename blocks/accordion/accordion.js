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
 * @param {Element} block - Accordion block element
 * @returns {boolean}
 */
function isUEStructure(block) {
  const first = block.querySelector(':scope > .accordion-header, :scope > .accordion-item');
  if (first) return true;
  return Array.from(block.children).some((el) => (
    el.getAttribute?.('data-aue-model') === 'accordion-header'
    || el.getAttribute?.('data-aue-model') === 'accordion-item'
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
 * @param {Element} block - Accordion block element
 * @returns {{ headerEl: Element | null, itemEls: Element[] }}
 */
function getUEElements(block) {
  const selector = '[data-aue-model="accordion-header"], .accordion-header';
  const itemSelector = '[data-aue-model="accordion-item"], .accordion-item';
  const headerEl = block.querySelector(`:scope > ${selector}`);
  const itemEls = Array.from(block.querySelectorAll(`:scope > ${itemSelector}`));
  return { headerEl, itemEls };
}

/**
 * Build header row DOM from UE accordion-header element.
 * Model order: eyebrow, heading, description (each a single cell div).
 * @param {Element} headerEl - UE accordion header wrapper
 * @returns {HTMLDivElement}
 */
function buildHeaderRowFromUE(headerEl) {
  const firstRow = document.createElement('div');
  firstRow.classList.add('accordion-header');
  const [eyebrowCol, headingCol, descriptionCol] = [...headerEl.children];

  if (eyebrowCol?.textContent?.trim()) {
    const eyebrow = eyebrowDecorator(eyebrowCol, 'accordion-header-eyebrow');
    if (eyebrow) {
      if (headerEl.contains(eyebrowCol)) moveInstrumentation(eyebrowCol, eyebrow);
      firstRow.append(eyebrow);
    }
  }
  if (headingCol) {
    const heading = headingCol.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
      heading.classList.add('accordion-header-heading');
      if (headerEl.contains(headingCol)) moveInstrumentation(headingCol, heading);
      firstRow.append(heading);
    } else if (headingCol.innerHTML?.trim()) {
      const h2 = document.createElement('h2');
      h2.innerHTML = headingCol.innerHTML;
      h2.classList.add('accordion-header-heading');
      if (headerEl.contains(headingCol)) moveInstrumentation(headingCol, h2);
      firstRow.append(h2);
    }
  }
  if (descriptionCol?.innerHTML?.trim() || descriptionCol?.textContent?.trim()) {
    const desc = descriptionCol.querySelector('p') || document.createElement('p');
    if (desc.tagName !== 'P') {
      const p = document.createElement('p');
      p.innerHTML = descriptionCol.innerHTML || descriptionCol.textContent || '';
      p.classList.add('accordion-header-description');
      if (headerEl.contains(descriptionCol)) moveInstrumentation(descriptionCol, p);
      firstRow.append(p);
    } else {
      desc.classList.add('accordion-header-description');
      if (headerEl.contains(descriptionCol)) moveInstrumentation(descriptionCol, desc);
      firstRow.append(desc);
    }
  }
  return firstRow;
}

/**
 * Build one item row DOM from UE accordion-item element.
 * Model order: label, description, image. For small variant with image: [imageCell, contentCell]; else [contentCell].
 * @param {Element} itemEl - UE accordion item wrapper
 * @param {boolean} isSmall - Whether accordion is small variant
 * @returns {HTMLDivElement}
 */
function buildItemRowFromUE(itemEl, isSmall) {
  const row = document.createElement('div');
  const [labelCol, descriptionCol, imageCol] = [...itemEl.children];

  let label;
  if (labelCol) {
    const first = labelCol.firstElementChild;
    label = first ? first.cloneNode(true) : document.createElement('p');
    if (label.tagName === 'P' && labelCol.textContent && !label.innerHTML) {
      label.textContent = labelCol.textContent;
    }
  } else {
    label = document.createElement('p');
  }

  const contentCell = document.createElement('div');
  contentCell.append(label);
  if (descriptionCol?.innerHTML?.trim() || descriptionCol?.textContent?.trim()) {
    const descEl = descriptionCol.firstElementChild?.cloneNode(true)
      ?? document.createElement('p');
    if (descEl.tagName !== 'P' && !descriptionCol.firstElementChild) {
      descEl.innerHTML = descriptionCol.innerHTML || descriptionCol.textContent || '';
    } else if (descriptionCol.textContent && !descEl.innerHTML) {
      descEl.textContent = descriptionCol.textContent;
    }
    contentCell.append(descEl);
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
 * Normalize block content into a single structure: { firstRow, rows }.
 * Supports both sheet (table) and UE (accordion-header / accordion-item) content.
 * @param {Element} block - Accordion block element
 * @returns {{ firstRow: Element, rows: Element[] }}
 */
function normalizeContent(block) {
  applyVariantClass(block);

  if (isUEStructure(block)) {
    const { headerEl, itemEls } = getUEElements(block);
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
