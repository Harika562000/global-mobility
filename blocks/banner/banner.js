import { eyebrowDecorator } from '../../scripts/scripts.js';

/**
 * Decorates the banner block: icon, eyebrow, heading, description, CTA.
 * Responsive card Layout per Figma (Responsive / Banner).
 */
export default function decorate(block) {
  const row = block.querySelector(':scope > div');
  if (!row) return;

  row.classList.add('banner-content');
  const cols = row.querySelectorAll(':scope > div');

  const iconCol = cols[0];
  const eyebrowCol = cols[1];

  if (iconCol) {
    iconCol.classList.add('banner-icon');
  }

  if (eyebrowCol) {
    eyebrowCol.classList.add('banner-eyebrow');
    const p = eyebrowCol.querySelector('p');
    if (p?.textContent.trim()) {
      const formatted = eyebrowDecorator(p, 'accent-color');
      if (formatted) p.replaceWith(formatted);
    }
  }
}