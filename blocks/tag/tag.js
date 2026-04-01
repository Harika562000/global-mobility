/**
 * Tag block: wrap in tag-wrapper, add tag/variation classes,
 * replace UE rows with single row structure.
 */
import { getTagClasses } from '../../scripts/scripts.js';

function valueCell(row) {
  if (!row) return null;
  return row.children.length > 1 ? row.children[1] : row.children[0] || row;
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const [variationRow, titleRow] = rows;
  const variation = (valueCell(variationRow) || variationRow).textContent?.trim() || '';
  const title = (valueCell(titleRow) || titleRow).textContent?.trim() || '';
  const tagClasses = getTagClasses(variation).split(' ');

  const wrapper = document.createElement('div');
  wrapper.className = 'tag-wrapper';
  block.parentNode?.insertBefore(wrapper, block);
  wrapper.appendChild(block);

  block.classList.add('tag', 'block', ...tagClasses.filter((c) => c && c !== 'tag'));

  const outer = document.createElement('div');
  const inner = document.createElement('div');
  const p = document.createElement('p');
  p.textContent = title;
  inner.appendChild(p);
  outer.appendChild(inner);
  block.innerHTML = '';
  block.appendChild(outer);
}
