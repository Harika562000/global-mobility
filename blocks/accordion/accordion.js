/*
 * Accordion Block (UE-compatible)
 * Renders expandable panels with optional header and small/cards variants.
 * @see https://www.hlx.live/developer/block-collection/accordion
 */

import { readBlockConfig } from '../../scripts/aem.js';
import { moveInstrumentation, eyebrowDecorator } from '../../scripts/scripts.js';

/**
 * Expands an accordion panel with a height transition, then sets height to auto.
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
 * Collapses an accordion panel with a height transition, then sets details.open to false.
 */
function closeAccordion(body, details) {
  const inner = body.firstElementChild;
  body.style.height = `${inner.scrollHeight}px`;
  body.offsetHeight; // eslint-disable-line no-unused-expressions -- force reflow for transition
  body.style.height = '0px';

  const onEnd = (e) => {
    if (e.propertyName !== 'height') return;
    details.open = false;
    body.removeEventListener('transitionend', onEnd);
  };

  body.addEventListener('transitionend', onEnd);
}

/**
 * Builds a header from a single row with one or three cells (eyebrow, heading, description).
 * Preserves the author's heading element (e.g. h5, p) instead of forcing an h2.
 */
function buildAccordionHeader(headerRow) {
  const header = document.createElement('div');
  header.className = 'accordion-header';

  const cells = [...headerRow.children].filter((c) => c.tagName === 'DIV');
  const isThreeColumn = cells.length >= 3;

  if (isThreeColumn) {
    const [eyebrowCell, headingCell, descCell] = cells;
    const eyebrow = eyebrowDecorator(eyebrowCell, 'accordion-header-eyebrow');
    if (eyebrow) header.append(eyebrow);

    const headingEl = headingCell.querySelector('h1, h2, h3, h4, h5, h6');
    if (headingEl) {
      headingEl.classList.add('accordion-header-heading');
      header.append(headingEl);
    } else {
      const first = headingCell.firstElementChild;
      if (first && headingCell.children.length === 1) {
        first.classList.add('accordion-header-heading');
        header.append(first);
      } else {
        const wrap = document.createElement('div');
        wrap.className = 'accordion-header-heading';
        wrap.append(...headingCell.childNodes);
        header.append(wrap);
      }
    }

    const descWrap = descCell.cloneNode(true);
    descWrap.classList.add('accordion-header-description');
    header.append(descWrap);
  } else {
    const eyebrowSource = headerRow.querySelector('p');
    const eyebrow = eyebrowDecorator(eyebrowSource, 'accordion-header-eyebrow');
    if (eyebrow && eyebrowSource) eyebrowSource.replaceWith(eyebrow);
    const heading = headerRow.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) heading.classList.add('accordion-header-heading');
    const description = headerRow.querySelector('p');
    if (description) description.classList.add('accordion-header-description');
    while (headerRow.firstElementChild) header.append(headerRow.firstElementChild);
  }

  return header;
}

/**
 * Builds a header element from block config (eyebrow, heading, description from metadata).
 */
function buildAccordionHeaderFromConfig(config) {
  const header = document.createElement('div');
  header.className = 'accordion-header';

  const eyebrow = eyebrowDecorator(config.eyebrow || '', 'accordion-header-eyebrow');
  if (eyebrow) header.append(eyebrow);

  if (config.heading) {
    const headingEl = document.createElement('div');
    headingEl.className = 'accordion-header-heading';
    headingEl.innerHTML = config.heading;
    header.append(headingEl);
  }

  if (config.description) {
    const descEl = document.createElement('div');
    descEl.className = 'accordion-header-description';
    descEl.innerHTML = config.description;
    header.append(descEl);
  }

  return header;
}

/**
 * Builds a header element from three separate rows (eyebrow, heading, description).
 * Used when the block has header content as three sibling divs from UE.
 */
function buildAccordionHeaderFromThreeRows(eyebrowRow, headingRow, descRow) {
  const header = document.createElement('div');
  header.className = 'accordion-header';

  const eyebrowSource = eyebrowRow.querySelector('p') || eyebrowRow.firstElementChild;
  const eyebrow = eyebrowDecorator(eyebrowSource, 'accordion-header-eyebrow');
  if (eyebrow) header.append(eyebrow);

  const headingSource = headingRow.querySelector('h1, h2, h3, h4, h5, h6')
    || headingRow.firstElementChild;
  if (headingSource) {
    headingSource.classList.add('accordion-header-heading');
    if (headingRow.children.length === 1) {
      header.append(headingSource);
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'accordion-header-heading';
      wrap.append(...headingRow.childNodes);
      header.append(wrap);
    }
  }

  const descSource = descRow.querySelector('p') || descRow.firstElementChild;
  if (descSource && (descSource.textContent?.trim() || descSource.innerHTML?.trim())) {
    const descWrap = descSource.cloneNode(true);
    descWrap.classList.add('accordion-header-description');
    header.append(descWrap);
  } else if (descRow.firstElementChild) {
    const descWrap = descRow.firstElementChild.cloneNode(true);
    descWrap.classList.add('accordion-header-description');
    header.append(descWrap);
  }

  return header;
}

/**
 * Decorates the accordion block: detects header source, builds header and item rows,
 * wires open/close behavior and small-variant image panel, and ensures at least one panel is open.
 */
export default function decorate(block) {
  const accordionItems = [];
  const isSmall = block.classList.contains('small');
  let imagePanel;
  const images = [];

  if (isSmall) {
    imagePanel = document.createElement('div');
    imagePanel.className = 'accordion-image-panel';
  }

  // Resolve config and header presence
  const config = readBlockConfig(block);
  config.eyebrow = config.eyebrow ?? block.dataset?.eyebrow ?? '';
  config.heading = config.heading ?? block.dataset?.heading ?? '';
  config.description = config.description ?? block.dataset?.description ?? '';
  const hasConfigHeader = !!(config.eyebrow || config.heading || config.description);

  let configRowCount = 0;
  if (hasConfigHeader) {
    configRowCount = (config.classes !== undefined && config.classes !== '') ? 4 : 3;
  }

  const rows = [...block.children];
  const firstRow = rows[0];

  const hasHeaderAsThreeRows = rows.length >= 3
    && rows[0]?.tagName === 'DIV'
    && rows[1]?.tagName === 'DIV'
    && rows[2]?.tagName === 'DIV';

  const thirdCellText = firstRow?.children[2]?.textContent?.trim().toLowerCase();
  const thirdIsBoolean = thirdCellText === 'true' || thirdCellText === 'false';
  const hasHeaderRow = rows.length >= 1
    && firstRow
    && firstRow.children.length === 3
    && !thirdIsBoolean;

  const hasHeader = hasHeaderAsThreeRows || hasHeaderRow || hasConfigHeader;

  const listWrapper = (hasHeader || isSmall) ? document.createElement('div') : null;
  if (listWrapper) listWrapper.className = 'accordion-list';

  // Build header when present
  if (hasConfigHeader) {
    const header = buildAccordionHeaderFromConfig(config);
    listWrapper.prepend(header);
  } else if (hasHeaderAsThreeRows) {
    const header = buildAccordionHeaderFromThreeRows(rows[0], rows[1], rows[2]);
    listWrapper.prepend(header);
  } else if (hasHeaderRow) {
    const header = buildAccordionHeader(firstRow);
    listWrapper.prepend(header);
  }

  // Determine which rows are accordion items (skip header rows)
  let itemRows;
  if (hasConfigHeader) {
    itemRows = rows.slice(configRowCount);
  } else if (hasHeaderAsThreeRows) {
    itemRows = rows.slice(3);
  } else if (hasHeaderRow) {
    itemRows = rows.slice(1);
  } else {
    itemRows = rows;
  }

  // Build each accordion item (details/summary/body) from a row or reuse existing details
  itemRows.forEach((row, i) => {
    if (row.tagName === 'DETAILS') {
      const body = row.querySelector('.accordion-item-body');
      if (body) accordionItems.push({ details: row, body });
      if (listWrapper) listWrapper.append(row);
      return;
    }

    const label = row.children[0];
    const body = row.children[1];
    const defaultOpen = row.children[2];
    const imageCell = row.children[3];

    if (!label || !body) return;

    // Flatten single wrapper div so multiple paragraphs/links are all included
    const singleWrapper = body.children.length === 1
      && body.firstElementChild?.tagName === 'DIV';
    let bodyContent = singleWrapper
      ? [...body.firstElementChild.childNodes]
      : [...body.childNodes];

    let image = null;
    if (isSmall) {
      const picture = imageCell?.querySelector?.('picture')
        || imageCell?.querySelector?.('img')?.closest?.('picture');
      if (picture) {
        image = picture;
      } else if (body.firstElementChild?.tagName === 'PICTURE') {
        image = body.firstElementChild;
        bodyContent = [...body.children].slice(1);
      }
    }

    const summary = document.createElement('summary');
    summary.className = 'accordion-item-label';
    summary.append(...label.childNodes);

    body.className = 'accordion-item-body';
    const accordionContent = document.createElement('div');
    accordionContent.className = 'accordion-item-content';
    bodyContent.forEach((node) => accordionContent.append(node));
    body.append(accordionContent);

    const details = document.createElement('details');
    details.id = `accordion-${block.id || 'block'}-${i}`;
    moveInstrumentation(row, details);
    details.className = 'accordion-item';
    details.append(summary, body);

    if (isSmall) {
      const slot = image || document.createElement('div');
      slot.classList.add('accordion-item-image');
      images.push(slot);
      details.dataset.imageIndex = i;
      details.addEventListener('toggle', () => {
        if (!details.open) return;
        const imageIndex = Number(details.dataset.imageIndex);
        images.forEach((img, idx) => {
          img.classList.toggle('is-active', idx === imageIndex);
        });
      });
    }

    accordionItems.push({ details, body });

    if (listWrapper) {
      listWrapper.append(details);
    } else {
      row.replaceWith(details);
    }

    if (defaultOpen && defaultOpen.textContent.trim().toLowerCase() === 'true') {
      details.open = true;
      body.style.height = 'auto';
    }
  });

  // Ensure at least one panel is open
  if (accordionItems.length > 0) {
    const hasOpen = (isSmall || hasHeader)
      ? accordionItems.some((item) => item.details.open)
      : block.querySelector('details[open]');
    if (!hasOpen) {
      const first = accordionItems[0];
      first.details.open = true;
      first.body.style.height = 'auto';
    }
  }

  // Finalize block DOM: small gets image panel + list; else header + list or items only
  if (isSmall) {
    const openIndex = accordionItems.findIndex((item) => item.details.open);
    const activeIndex = openIndex >= 0 ? openIndex : 0;
    images.forEach((img, idx) => {
      img.classList.toggle('is-active', idx === activeIndex);
      imagePanel.append(img);
    });
    block.replaceChildren(imagePanel, listWrapper);
  } else if (hasHeader) {
    block.replaceChildren(listWrapper);
  }

  // Wire summary click: single-open by default, toggle open/close with height animation
  block.querySelectorAll('summary').forEach((summary) => {
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      const details = summary.closest('details');
      const body = details.querySelector('.accordion-item-body');

      if (!block.classList.contains('multiple')) {
        accordionItems.forEach((item) => {
          if (item.details !== details && item.details.open) {
            closeAccordion(item.body, item.details);
          }
        });
      }

      if (details.open) {
        closeAccordion(body, details);
      } else {
        openAccordion(body, details);
      }
    });
  });

  block.querySelectorAll('.button').forEach((el) => el.classList.remove('button'));
}
