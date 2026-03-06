import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Maps block rows to named fields based on the content-module model field order.
 */
function readBlockFields(block) {
  const fieldNames = ['heading', 'description'];
  const fields = {};
  [...block.children].forEach((row, index) => {
    if (index >= fieldNames.length) return;
    const cols = [...row.children];
    if (cols.length) {
      const [col] = cols;
      fields[fieldNames[index]] = col;
    }
  });
  return fields;
}

export default function decorate(block) {
  const fields = readBlockFields(block);

  // Create content wrapper
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'content-module-wrapper';

  // Heading
  if (fields.heading) {
    const heading = fields.heading.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
      moveInstrumentation(fields.heading, heading);
      contentWrapper.appendChild(heading);
    } else if (fields.heading.innerHTML.trim()) {
      const h2 = document.createElement('h2');
      h2.innerHTML = fields.heading.innerHTML;
      moveInstrumentation(fields.heading, h2);
      contentWrapper.appendChild(h2);
    }
  }

  // Description
  if (fields.description) {
    const descChildren = [...fields.description.children];
    if (descChildren.length) {
      moveInstrumentation(fields.description, descChildren[0]);
      descChildren.forEach((child) => contentWrapper.appendChild(child));
    } else if (fields.description.textContent.trim()) {
      const p = document.createElement('p');
      p.textContent = fields.description.textContent.trim();
      moveInstrumentation(fields.description, p);
      contentWrapper.appendChild(p);
    }
  }

  // Clear and rebuild
  block.innerHTML = '';
  block.appendChild(contentWrapper);
}
