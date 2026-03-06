export default function decorate(block) {
  if (!block) return;

  const rows = block.children ? [...block.children] : [];
  const items = [];

  rows.forEach((row) => {
    if (!row) return;
    row.classList.add('logo-set-row');

    const cells = row.children ? [...row.children] : [];
    cells.forEach((cell) => {
      if (!cell) return;
      cell.classList.add('logo-set-item');
      items.push(cell);

      const image = cell.querySelector('picture img');
      if (image) {
        image.loading = 'lazy';
        image.decoding = 'async';
      }
    });
  });

  // Always use first image as desktop/fallback
  if (items[0]) {
    items[0].classList.add('desktop-image');
  }

  // If mobile image exists, enable responsive swap
  if (items.length >= 2 && items[1]) {
    block.classList.add('logo-set-responsive');
    items[1].classList.add('mobile-image');
  }
}
