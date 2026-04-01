/**
 * Header Section decorator.
 *
 * Runs on the nav page itself (both in UE editor and when loaded as a
 * fragment by header.js).
 *
 * Header-section is now authored as a section resource. This decorator is a
 * backward-compatible fallback for older payloads where header-section still
 * renders as a block.
 *
 * Keeps header authoring structure stable by ensuring header-menu-item rows
 * are always treated as containers for child items.
 */
export default function decorate(block) {
  const contentRoot = block.querySelector(':scope > .default-content-wrapper') || block;

  const markMenuItemContainers = () => {
    contentRoot.querySelectorAll('[data-aue-component="header-menu-item"]').forEach((row) => {
      row.dataset.aueType = 'container';
      row.dataset.aueFilter = 'header-menu-item';
    });
  };

  // Make the header-section itself a container with the correct filter so UE
  // only offers top-level header rows.
  block.dataset.aueType = 'container';
  block.dataset.aueFilter = 'header-section';

  markMenuItemContainers();

  // Keep container metadata on newly inserted menu-item rows.
  const observer = new MutationObserver(() => {
    markMenuItemContainers();
  });

  observer.observe(contentRoot, {
    childList: true,
    subtree: false,
  });
}
