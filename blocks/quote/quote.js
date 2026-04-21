/**
 * Quote block (UE): body, name, role, image.
 * Eyebrow and heading are separate blocks; not part of quote.
 *
 * UE model field order: body, name, role, image.
 * Each field renders as a row; rows may be [label, value] – we use the value cell only.
 *
 * Output structure (per design):
 *   quote-body (body text)
 *   quote-attribution (quote-image + quote-info with quote-name, quote-role)
 */
function getValueCell(row) {
  if (!row) return null;
  return row.children.length > 1 ? row.children[1] : row.children[0] || row;
}

function getValueText(row) {
  const cell = getValueCell(row);
  return cell?.textContent?.trim() || row?.textContent?.trim() || '';
}

function appendContent(row, target, tag = 'p') {
  if (!row) return;
  const cell = getValueCell(row);
  const scope = cell || row;
  const contentSelector = 'h1, h2, h3, h4, h5, h6, p';
  let elements = scope.querySelectorAll(contentSelector);
  if (elements.length === 0 && scope.querySelector(':scope > div')) {
    const inner = scope.querySelector(':scope > div');
    elements = inner?.querySelectorAll(contentSelector) || [];
  }
  if (elements.length) {
    elements.forEach((el) => target.appendChild(el.cloneNode(true)));
  } else {
    const text = scope.textContent?.trim();
    if (text) {
      const el = document.createElement(tag);
      el.textContent = text;
      target.appendChild(el);
    }
  }
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  // UE order: body, name, role, image (4 fields). Skip first row if it is block name/title only.
  const dataRows = rows.length > 4 && !rows[0].querySelector('picture, img') && getValueText(rows[0]) === 'Quote'
    ? rows.slice(1)
    : rows;
  const [bodyRow, nameRow, roleRow, imageRow] = dataRows;

  const fragment = document.createDocumentFragment();

  // 1. Attribution (image + name + role) – appears at bottom with column-reverse
  const nameText = nameRow ? getValueText(nameRow) : '';
  const roleText = roleRow ? getValueText(roleRow) : '';
  const hasImage = imageRow?.querySelector('picture, img');
  if (hasImage || nameText || roleText) {
    const attribution = document.createElement('div');
    attribution.classList.add('quote-attribution');

    if (imageRow && hasImage) {
      const imageWrap = document.createElement('div');
      imageWrap.classList.add('quote-image');
      const picture = imageRow.querySelector('picture');
      if (picture) imageWrap.appendChild(picture.cloneNode(true));
      else {
        const img = imageRow.querySelector('img');
        if (img) imageWrap.appendChild(img.cloneNode(true));
      }
      attribution.appendChild(imageWrap);
    }

    if (nameText || roleText) {
      const info = document.createElement('div');
      info.classList.add('quote-info');
      if (nameText) {
        const nameP = document.createElement('p');
        nameP.classList.add('quote-name');
        nameP.textContent = nameText;
        info.appendChild(nameP);
      }
      if (roleText) {
        const roleP = document.createElement('p');
        roleP.classList.add('quote-role');
        roleP.textContent = roleText;
        info.appendChild(roleP);
      }
      attribution.appendChild(info);
    }

    fragment.appendChild(attribution);
  }

  // 2. Body (quote text)
  if (bodyRow) {
    const bodyWrap = document.createElement('div');
    bodyWrap.classList.add('quote-body');
    appendContent(bodyRow, bodyWrap);
    if (bodyWrap.hasChildNodes()) fragment.appendChild(bodyWrap);
  }

  block.innerHTML = '';
  block.appendChild(fragment);

  const section = block.closest('.section');
  if (section && !section.classList.contains('bg-accent')) {
    section.classList.add('bg-accent');
  }
}
