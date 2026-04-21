/**
 * Tag block: wrap in tag-wrapper, add tag/variation classes,
 * replace UE rows with single row structure.
 */
import { getTagClasses } from '../../scripts/scripts.js';
import { decorateIcons } from '../../scripts/aem.js';

/** Matches filenames in `/icons/*.svg` (see blocks/tag/_tag.json select options). */
const SUPPORTED_ICONS = new Set([
  'arrow-down',
  'arrow-left',
  'arrow-right',
  'arrow-up',
  'arrow-up-right',
  'asterisk',
  'atomic-icon',
  'binoculars-icon',
  'check-mark',
  'cone-icon',
  'download',
  'filter',
  'geotag',
  'geotag-hover',
  'lightning-icon',
  'linked-in',
  'pentagon-icon',
  'person-head',
  'phone',
  'plus',
  'plus-thin',
  'search',
  'stack-icon',
  'video-player',
  'x',
  'youtube',
]);

function valueCell(row) {
  if (!row) return null;
  return row.children.length > 1 ? row.children[1] : row.children[0] || row;
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const [variationRow, titleRow, iconRow] = rows;
  const variation = (valueCell(variationRow) || variationRow).textContent?.trim() || '';
  const title = (valueCell(titleRow) || titleRow).textContent?.trim() || '';
  const selectedIcon = ((valueCell(iconRow) || iconRow)?.textContent || '').trim().toLowerCase();
  const iconName = SUPPORTED_ICONS.has(selectedIcon) ? selectedIcon : '';
  const tagClasses = getTagClasses(variation).split(' ');

  const wrapper = document.createElement('div');
  wrapper.className = 'tag-wrapper';
  block.parentNode?.insertBefore(wrapper, block);
  wrapper.appendChild(block);

  block.classList.add('tag', 'block', ...tagClasses.filter((c) => c && c !== 'tag'));

  const outer = document.createElement('div');
  const inner = document.createElement('div');
  const p = document.createElement('p');
  if (iconName) {
    const icon = document.createElement('span');
    icon.className = `icon icon-${iconName}`;
    p.appendChild(icon);
  }
  p.append(title);
  inner.appendChild(p);
  outer.appendChild(inner);
  block.innerHTML = '';
  block.appendChild(outer);
  decorateIcons(block);
}
