import { eyebrowDecorator } from '../../scripts/scripts.js';

/**
 * Decorates the banner block: icon, eyebrow, heading, description, CTA.
 * Responsive card Layout per Figma (Responsive / Banner).
 *
 * UE model field order: icon, iconAlt, eyebrow, heading, description, ctaLabel, ctaUrl
 * Each field maps to a column: cols[0]=icon, cols[1]=iconAlt, cols[2]=eyebrow,
 * cols[3]=heading, cols[4]=description, cols[5]=ctaLabel, cols[6]=ctaUrl
 */
export default function decorate(block) {
  const row = block.querySelector(':scope > div');
  if (!row) return;

  row.classList.add('banner-content');
  const cols = [...row.querySelectorAll(':scope > div')];

  // cols[0] = icon image
  const iconCol = cols[0];
  if (iconCol) {
    iconCol.classList.add('banner-icon');
  }

  // cols[1] = icon alt (consumed by image, remove from visual output)
  const iconAltCol = cols[1];
  if (iconAltCol) {
    const altText = iconAltCol.textContent.trim();
    const img = iconCol?.querySelector('img');
    if (img && altText) {
      img.alt = altText;
    }
    iconAltCol.remove();
  }

  // cols[2] = eyebrow text
  const eyebrowCol = cols[2];
  if (eyebrowCol) {
    eyebrowCol.classList.add('banner-eyebrow');
    const p = eyebrowCol.querySelector('p');
    if (p?.textContent.trim()) {
      const formatted = eyebrowDecorator(p, 'accent-color');
      if (formatted) p.replaceWith(formatted);
    }
  }

  // cols[3] = heading
  const headingCol = cols[3];
  if (headingCol) {
    headingCol.classList.add('banner-heading');
  }

  // cols[4] = description
  const descCol = cols[4];
  if (descCol) {
    descCol.classList.add('banner-description');
  }

  // cols[5] & cols[6] = CTA label & URL
  const ctaLabelCol = cols[5];
  const ctaUrlCol = cols[6];
  if (ctaLabelCol && ctaUrlCol) {
    const label = ctaLabelCol.textContent.trim();
    const url = ctaUrlCol.textContent.trim();
    if (label && url) {
      const ctaWrapper = document.createElement('div');
      ctaWrapper.classList.add('banner-cta');
      const link = document.createElement('a');
      link.href = url;
      link.textContent = label;
      link.classList.add('button');
      ctaWrapper.append(link);
      ctaLabelCol.replaceWith(ctaWrapper);
    } else {
      ctaLabelCol.remove();
    }
    ctaUrlCol.remove();
  }
}
