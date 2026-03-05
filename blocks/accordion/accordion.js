import { eyebrowDecorator } from '../../scripts/scripts.js';

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
 * Detects if block content is from UE (one row per header field) vs DA/sheet (one header row).
 * UE: row0=eyebrow, row1=heading, row2=description, row3+=items.
 */
function isUEHeaderStructure(children) {
  if (children.length < 3) return false;
  const row0 = children[0];
  const row1 = children[1];
  const hasSingleCell = (row) => row.children.length === 1;
  const hasHeading = (row) => row.querySelector('h1, h2, h3, h4, h5, h6');
  return hasSingleCell(row0) && hasSingleCell(row1) && hasHeading(row1) && !hasHeading(row0);
}

/**
 * Builds one header row from UE (eyebrow, heading, description rows) or returns existing row.
 */
function normalizeHeaderRow(block) {
  const children = [...block.children];
  if (!isUEHeaderStructure(children)) {
    return { headerRow: children[0], itemRows: children.slice(1) };
  }
  const headerRow = document.createElement('div');
  [children[0], children[1], children[2]].forEach((row) => {
    const cell = row.querySelector('div');
    if (cell) headerRow.append(cell.cloneNode(true));
  });
  return { headerRow, itemRows: children.slice(3) };
}

const VARIANT_VALUES = ['small', 'cards'];

/**
 * Applies variant classes from the first row (Accordion Header) to the block.
 * UE stores "classes" in the first cell of the header row; only remove that cell if it's a variant.
 */
function applyHeaderClassesToBlock(block, firstRow) {
  const firstCell = firstRow.querySelector(':scope > div');
  if (!firstCell) return;
  const value = firstCell.textContent?.trim().toLowerCase() || '';
  const variants = value.split(/\s+/).filter((cls) => VARIANT_VALUES.includes(cls));
  if (variants.length === 0) return;
  variants.forEach((cls) => {
    if (!block.classList.contains(cls)) block.classList.add(cls);
  });
  firstCell.remove();
}

/**
 * Gets label and body elements from an item row (supports DA and UE structures).
 * UE: row can have 3 cells (image, label, body) or 2 (image, content) or 1 (content).
 * DA: row has 1 cell (label + body) or 2 cells for small (image, content).
 */
function getItemLabelAndBody(row, isSmall) {
  const cells = [...row.children];
  let image = null;
  let label = null;
  let bodyChildren = [];

  if (cells.length >= 3) {
    image = cells[0].querySelector('picture') || null;
    const labelCell = cells[1];
    const bodyCell = cells[2];
    label = labelCell?.firstElementChild || labelCell;
    bodyChildren = bodyCell ? [...bodyCell.children] : [];
  } else if (cells.length === 2 && isSmall) {
    image = cells[0].querySelector('picture') || null;
    const contentCell = cells[1];
    const contentChildren = contentCell ? [...contentCell.children] : [];
    [label, ...bodyChildren] = contentChildren;
  } else if (cells.length >= 1) {
    const contentCell = cells[0];
    const contentChildren = contentCell ? [...contentCell.children] : [];
    [label, ...bodyChildren] = contentChildren;
  }

  return { label, bodyChildren, image };
}

export default function decorate(block) {
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

  const { headerRow: firstRow, itemRows: rows } = normalizeHeaderRow(block);
  block.replaceChildren(firstRow, ...rows);

  applyHeaderClassesToBlock(block, firstRow);

  // Format eyebrow
  const eyebrowSource = firstRow.querySelector('p');
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
    const { label, bodyChildren: restCellChildren, image } = getItemLabelAndBody(row, isSmall);
    if (!label && restCellChildren.length === 0) return;

    const body = document.createElement('div');
    body.className = 'accordion-item-body';
    restCellChildren.forEach((child) => body.append(child));

    const summary = document.createElement('summary');
    summary.className = 'accordion-item-label';
    summary.append(label || document.createElement('span'));

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
