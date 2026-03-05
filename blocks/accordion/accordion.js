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
 * Normalize header row into accordion-header element.
 * Supports: (1) UE-style 3 cells [eyebrow, heading, description], (2) single cell with mixed content.
 * @param {Element} row - First row element
 * @returns {Element} - Header div with class accordion-header
 */
function buildAccordionHeader(row) {
  const header = document.createElement('div');
  header.className = 'accordion-header';

  const cells = [...row.children].filter((c) => c.tagName === 'DIV');
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
      const wrap = document.createElement('h2');
      wrap.className = 'accordion-header-heading';
      wrap.append(...headingCell.childNodes);
      header.append(wrap);
    }
    const descWrap = descCell.cloneNode(true);
    descWrap.classList.add('accordion-header-description');
    header.append(descWrap);
  } else {
    const eyebrowSource = row.querySelector('p');
    const eyebrow = eyebrowDecorator(eyebrowSource, 'accordion-header-eyebrow');
    if (eyebrow && eyebrowSource) eyebrowSource.replaceWith(eyebrow);
    const heading = row.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) heading.classList.add('accordion-header-heading');
    const description = row.querySelector('p');
    if (description) description.classList.add('accordion-header-description');
    while (row.firstElementChild) header.append(row.firstElementChild);
  }

  return header;
}

/**
 * Extract label, body content, and optional image from an item row (classic or UE structure).
 * @param {Element} row - Row element
 * @param {boolean} isSmall - Whether small variant (has image)
 * @returns {{ label: Element, bodyContent: Element[], image: Element|null }}
 */
function parseAccordionItemRow(row, isSmall) {
  const cells = [...row.children].filter((c) => c.tagName === 'DIV');
  let label;
  let bodyContent = [];
  let image = null;

  if (isSmall && cells.length >= 3) {
    const withPicture = cells.findIndex((c) => c.querySelector('picture'));
    if (withPicture >= 0) {
      image = cells[withPicture].querySelector('picture');
      const otherCells = cells.filter((_, i) => i !== withPicture);
      label = otherCells[0];
      bodyContent = otherCells.length > 1 ? [otherCells[1]] : [...(otherCells[0]?.children ?? [])];
      if (bodyContent.length === 1 && bodyContent[0] === otherCells[0]) {
        bodyContent = [...otherCells[0].children];
      }
    } else {
      label = cells[0];
      bodyContent = cells.length > 2 ? [cells[2]] : [...(cells[1]?.children ?? [])];
      if (bodyContent.length === 1 && bodyContent[0] === cells[1]) bodyContent = [...cells[1].children];
    }
  } else if (isSmall && cells.length === 2) {
    const firstHasPicture = cells[0].querySelector('picture');
    if (firstHasPicture) {
      image = cells[0].querySelector('picture');
      const secondCell = cells[1];
      const firstHeading = secondCell.querySelector('h1, h2, h3, h4, h5, h6');
      label = firstHeading || secondCell.firstElementChild;
      bodyContent = firstHeading ? [...secondCell.children].filter((c) => c !== firstHeading) : [...secondCell.children].slice(1);
    } else {
      label = cells[0];
      bodyContent = [...(cells[1]?.children ?? [])];
    }
  } else if (cells.length >= 2) {
    label = cells[0];
    bodyContent = [cells[1]];
  } else {
    const firstCell = cells[0];
    const childArr = firstCell ? [...firstCell.children] : [];
    label = childArr[0];
    bodyContent = childArr.slice(1);
  }

  if (!label) {
    label = document.createElement('span');
  }
  return { label, bodyContent, image };
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

  const allRows = [...block.children];
  const firstRow = allRows[0];
  const itemRows = allRows.slice(1);

  if (firstRow) {
    const header = buildAccordionHeader(firstRow);
    listWrapper.append(header);
  }

  itemRows.forEach((row, index) => {
    const { label, bodyContent, image } = parseAccordionItemRow(row, isSmall);

    const body = document.createElement('div');
    body.className = 'accordion-item-body';
    bodyContent.forEach((el) => body.append(el));

    const summary = document.createElement('summary');
    summary.className = 'accordion-item-label';
    summary.append(label);

    const inner = document.createElement('div');
    inner.className = 'accordion-item-body-inner';
    inner.append(...body.childNodes);
    body.append(inner);

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
  });

  if (isSmall) {
    images.forEach((img, i) => {
      img.classList.toggle('is-active', i === 0);
      imagePanel.append(img);
    });
    block.replaceChildren(imagePanel, listWrapper);
  } else {
    block.replaceChildren(listWrapper);
  }

  if (accordionItems.length > 0) {
    const firstItem = accordionItems[0];
    firstItem.details.open = true;
    firstItem.body.style.height = 'auto';
  }

  block.querySelectorAll('.button').forEach((btn) => btn.classList.remove('button'));
}
