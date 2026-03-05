/*
 * Accordion Block (minimal UE-compatible)
 * Based on: https://www.hlx.live/developer/block-collection/accordion
 */

import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  [...block.children].forEach((row, i) => {
    const label = row.children[0];
    const body = row.children[1];
    const defaultOpen = row.children[2];

    if (!label || !body) return;

    const summary = document.createElement('summary');
    summary.className = 'accordion-item-label';
    summary.append(...label.childNodes);

    body.className = 'accordion-item-body';
    const accordionContent = document.createElement('div');
    accordionContent.className = 'accordion-item-content';
    accordionContent.append(...body.childNodes);
    body.append(accordionContent);

    const details = document.createElement('details');
    details.id = `accordion-${block.id || 'block'}-${i}`;
    moveInstrumentation(row, details);
    details.className = 'accordion-item';
    details.append(summary, body);
    row.replaceWith(details);

    if (defaultOpen && defaultOpen.textContent.trim().toLowerCase() === 'true') {
      details.setAttribute('open', '');
      details.classList.add('open');
    }
  });

  block.querySelectorAll('summary').forEach((summary) => {
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      const details = summary.closest('details');
      if (!block.classList.contains('multiple')) {
        block.querySelectorAll('details[open]').forEach((d) => {
          if (d !== details) {
            d.classList.remove('open');
            d.addEventListener('transitionend', () => d.removeAttribute('open'), { once: true });
          }
        });
      }
      const willOpen = !details.open;
      if (willOpen) {
        details.setAttribute('open', '');
        requestAnimationFrame(() => details.classList.add('open'));
      } else {
        details.classList.remove('open');
        details.addEventListener('transitionend', () => details.removeAttribute('open'), { once: true });
      }
    });
  });
}
