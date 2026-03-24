const MAX_DESKTOP_COLS = 8;
const MAX_MOBILE_COLS = 2;

/**
 * Reads an authored col-{prefix}-N class from the block, clamps N to [1, max],
 * replaces the original class with the clamped one, and adds the default if absent.
 */
function applyColClass(block, prefix, max, defaultVal) {
  const existing = [...block.classList].find((c) => c.startsWith(`${prefix}-`));
  if (existing) {
    const n = parseInt(existing.split('-').pop(), 10);
    const clamped = Math.min(
      Math.max(Number.isNaN(n) ? defaultVal : n, 1),
      max,
    );
    block.classList.remove(existing);
    block.classList.add(`${prefix}-${clamped}`);
  } else {
    block.classList.add(`${prefix}-${defaultVal}`);
  }
}

export default function decorate(block) {
  applyColClass(block, 'col-md', MAX_DESKTOP_COLS, 8);
  applyColClass(block, 'col-sm', MAX_MOBILE_COLS, 2);
  block.classList.add('flex-grid');

  const rows = [...block.children];
  block.replaceChildren();

  rows.forEach((row) => {
    const picture = row.querySelector('picture');
    if (!picture) return;

    const img = picture.querySelector('img');
    if (img) {
      const altCell = row.children[1];
      const altText = altCell ? altCell.textContent.trim() : '';
      if (altText) img.setAttribute('alt', altText);
      img.loading = 'lazy';
      img.decoding = 'async';
    }

    const logoItem = document.createElement('div');
    logoItem.className = 'logo-item';
    logoItem.append(picture);
    block.append(logoItem);
  });
}
