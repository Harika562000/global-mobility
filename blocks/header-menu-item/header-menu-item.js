/**
 * Header Menu Item decorator.
 *
 * header-menu-item is a block/item (row) inside header-section, so this
 * file is NOT loaded by aem.js loadBlock().  Kept as a placeholder.
 */
export default function decorate(block) {
  block.dataset.aueType = 'container';
  block.dataset.aueFilter = 'header-menu-item';
}
