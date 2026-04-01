import { eyebrowDecorator } from '../../scripts/scripts.js';

/**
 * Section Title block (UE).
 * Model: eyebrow, title, body (optional), cta.
 * Structure: eyebrow, title-row-with-cta (heading + CTA), section-title-body.
 */
function getValueCell(row) {
  if (!row) return null;
  return row.children.length > 1 ? row.children[1] : row.children[0] || row;
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const buttonEl = block.querySelector('a[href]');
  const ctaRow = buttonEl ? rows.find((row) => row.contains(buttonEl)) : null;
  const titleRow = rows.find((row) => row.querySelector('h1, h2, h3, h4, h5, h6')) ?? rows[1];
  const eyebrowRow = rows[0];
  const titleIdx = titleRow ? rows.indexOf(titleRow) : -1;
  const ctaIdx = ctaRow ? rows.indexOf(ctaRow) : -1;
  const bodyRow = titleIdx >= 0 && ctaIdx > titleIdx + 1 ? rows[titleIdx + 1] : null;

  if (bodyRow && !bodyRow.querySelector('a[href]')) {
    bodyRow.classList.add('section-title-body');
  }

  if (eyebrowRow) {
    const cell = getValueCell(eyebrowRow);
    const scope = cell || eyebrowRow;
    const p = scope.querySelector('p');
    const text = (p?.textContent?.trim() || scope.textContent?.trim() || '').trim();
    if (text) {
      const formatted = eyebrowDecorator(text, 'accent-color margin-bottom-400');
      if (formatted) {
        eyebrowRow.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.appendChild(formatted);
        eyebrowRow.appendChild(wrapper);
      }
    } else {
      eyebrowRow.remove();
    }
  }

  if (titleRow && ctaRow && ctaRow !== titleRow) {
    const titleCol = titleRow.querySelector(':scope > div');
    const buttonInCta = ctaRow.querySelector('a[href]');
    if (titleCol && buttonInCta) {
      // Preserve authored button variant so global decorateButtons() won't force "inverted"
      // (it defaults to inverted when link is single child of P or DIV)
      const authoredVariant = buttonInCta.dataset.linkType
        || ['primary', 'secondary', 'inverted'].find((c) => buttonInCta.classList.contains(c));
      if (authoredVariant) buttonInCta.dataset.linkType = authoredVariant;

      titleRow.classList.add('title-row-with-cta');
      const heading = titleCol.querySelector('h1, h2, h3, h4, h5, h6');
      const ctaDiv = document.createElement('div');
      const parentsToClean = [];
      let node = buttonInCta.parentElement;
      while (node && node !== ctaRow) {
        parentsToClean.push(node);
        node = node.parentElement;
      }
      ctaDiv.appendChild(buttonInCta);
      parentsToClean.forEach((el) => {
        if (!el.textContent?.trim()) el.remove();
      });
      titleRow.innerHTML = '';
      if (heading) titleRow.appendChild(heading);
      titleRow.appendChild(ctaDiv);
      if (ctaRow.parentElement && !ctaRow.textContent?.trim()) ctaRow.remove();
    }
  }
}
