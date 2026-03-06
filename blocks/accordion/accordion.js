/*
 * Accordion Block (minimal UE-compatible)
 * Based on: https://www.hlx.live/developer/block-collection/accordion
 */

import { moveInstrumentation } from '../../scripts/scripts.js';

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

export default function decorate(block) {
  const accordionItems = [];
  const isSmall = block.classList.contains('small');
  let imagePanel;
  const images = [];

  if (isSmall) {
    imagePanel = document.createElement('div');
    imagePanel.className = 'accordion-image-panel';
  }

  const listWrapper = isSmall ? document.createElement('div') : null;
  if (listWrapper) listWrapper.className = 'accordion-list';

  const rows = [...block.children];

  rows.forEach((row, i) => {
    const label = row.children[0];
    const body = row.children[1];
    const defaultOpen = row.children[2];
    const imageCell = row.children[3];

    if (!label || !body) return;

    let bodyContent = [...body.childNodes];
    let image = null;
    if (isSmall) {
      const imageFromCell = imageCell?.querySelector?.('picture') || imageCell?.querySelector?.('img')?.closest?.('picture');
      if (imageFromCell) {
        image = imageFromCell;
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

    if (isSmall) {
      listWrapper.append(details);
    } else {
      row.replaceWith(details);
    }

    if (defaultOpen && defaultOpen.textContent.trim().toLowerCase() === 'true') {
      details.open = true;
      body.style.height = 'auto';
    }
  });

  if (accordionItems.length > 0) {
    const hasOpen = isSmall
      ? accordionItems.some((item) => item.details.open)
      : block.querySelector('details[open]');
    if (!hasOpen) {
      const first = accordionItems[0];
      first.details.open = true;
      first.body.style.height = 'auto';
    }
  }

  if (isSmall) {
    const openIndex = accordionItems.findIndex((item) => item.details.open);
    images.forEach((img, idx) => {
      img.classList.toggle('is-active', idx === (openIndex >= 0 ? openIndex : 0));
      imagePanel.append(img);
    });
    block.replaceChildren(imagePanel, listWrapper);
  }

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
}
