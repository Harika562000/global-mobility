import { eyebrowDecorator } from '../../scripts/scripts.js';

/**
 * Decorates the banner block: icon, eyebrow, heading, description, CTA.
 * Responsive card Layout per Figma (Responsive / Banner).
 *
 * UE model field order: icon, eyebrow, heading, description, ctaLabel, ctaUrl
 * Each field renders as a separate row:
 * rows[0]=icon, rows[1]=eyebrow, rows[2]=heading,
 * rows[3]=description, rows[4]=ctaLabel, rows[5]=ctaUrl
 */
export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  // rows[0] = icon image
  const iconRow = rows[0];
  if (iconRow) {
    iconRow.classList.add('banner-icon');
  }

  // rows[1] = eyebrow text
  const eyebrowRow = rows[1];
  if (eyebrowRow) {
    eyebrowRow.classList.add('banner-eyebrow');
    const p = eyebrowRow.querySelector('p');
    if (p?.textContent.trim()) {
      const formatted = eyebrowDecorator(p, 'accent-color');
      if (formatted) p.replaceWith(formatted);
    }
  }

  // rows[5] = CTA URL (rendered as anchor by UE)
  const ctaUrlRow = rows[5];
  if (ctaUrlRow) {
    ctaUrlRow.classList.add('banner-cta');
  }
}
