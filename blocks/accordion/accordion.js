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

const VARIANT_VALUES = ['small', 'cards'];

/**
 * If first row is a variant row (single cell "small"/"cards"), apply to block and return rest.
 * Otherwise return all rows as item rows.
 */
function normalizeBlockChildren(block) {
  const children = [...block.children];
  if (children.length === 0) return { itemRows: [] };
  const firstRow = children[0];
  const firstCell = firstRow.querySelector(':scope > div');
  if (firstRow.children.length === 1 && firstCell) {
    const value = firstCell.textContent?.trim().toLowerCase() || '';
    const variants = value.split(/\s+/).filter((c) => VARIANT_VALUES.includes(c));
    if (variants.length > 0) {
      variants.forEach((cls) => block.classList.add(cls));
      return { itemRows: children.slice(1) };
    }
  }
  return { itemRows: children };
}

/**
 * Gets label, description (body), and optional image from an item row.
 * UE: 3 cells (label, description, image) or 2 (label, description) or 1 (combined).
 * DA: 1 cell (label + description) or 2 for small (image, content).
 */
function getItemContent(row, isSmall) {
  const cells = [...row.children];
  let image = null;
  let label = null;
  let bodyChildren = [];

  if (cells.length >= 3) {
    const labelCell = cells[0];
    const descCell = cells[1];
    image = cells[2].querySelector('picture') || null;
    label = labelCell?.firstElementChild || labelCell;
    bodyChildren = descCell ? [...descCell.children] : [];
  } else if (cells.length === 2) {
    if (isSmall && cells[0].querySelector('picture')) {
      image = cells[0].querySelector('picture');
      const contentCell = cells[1];
      const contentChildren = contentCell ? [...contentCell.children] : [];
      [label, ...bodyChildren] = contentChildren;
    } else {
      const labelCell = cells[0];
      const descCell = cells[1];
      label = labelCell?.firstElementChild || labelCell;
      bodyChildren = descCell ? [...descCell.children] : [];
    }
  } else if (cells.length === 1) {
    const contentChildren = [...cells[0].children];
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

  const { itemRows: rows } = normalizeBlockChildren(block);
  block.replaceChildren(...rows);

  rows.forEach((row, index) => {
    const { label, bodyChildren, image } = getItemContent(row, isSmall);
    if (!label && bodyChildren.length === 0) return;

    const body = document.createElement('div');
    body.className = 'accordion-item-body';
    bodyChildren.forEach((child) => body.append(child));

    const summary = document.createElement('summary');
    summary.className = 'accordion-item-label';
    summary.append(label || document.createElement('span'));

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
    row.remove();
  });

  if (isSmall) {
    images.forEach((img, i) => {
      img.classList.toggle('is-active', i === 0);
      imagePanel.append(img);
    });
    block.append(imagePanel, listWrapper);
  } else {
    block.append(listWrapper);
  }

  if (accordionItems.length > 0) {
    const firstItem = accordionItems[0];
    firstItem.details.open = true;
    firstItem.body.style.height = 'auto';
  }

  block.querySelectorAll('.button').forEach((btn) => btn.classList.remove('button'));
}
