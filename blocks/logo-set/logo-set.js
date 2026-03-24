import { eyebrowDecorator } from '../../scripts/scripts.js';

function getValueCell(row) {
  if (!row) return null;
  return row.children.length > 1 ? row.children[1] : row.children[0] || row;
}

function getPropName(cell) {
  if (!cell) return '';
  return cell.getAttribute('data-aue-prop')
    || cell.querySelector('[data-aue-prop]')?.getAttribute('data-aue-prop')
    || '';
}

function extractTextContent(block) {
  const rows = block.children ? [...block.children] : [];
  let eyebrowText = '';
  let headingText = '';
  let desktopImageAlt = '';
  let mobileImageAlt = '';
  let textRowIndex = 0;

  rows.forEach((row) => {
    if (!row) return;
    const valueCell = getValueCell(row);
    if (!valueCell) return;

    const propName = getPropName(valueCell);
    if (propName === 'desktopImageAlt') {
      desktopImageAlt = valueCell.textContent?.trim() || '';
      row.remove();
      return;
    }
    if (propName === 'mobileImageAlt') {
      mobileImageAlt = valueCell.textContent?.trim() || '';
      row.remove();
      return;
    }

    if (valueCell.querySelector('picture')) {
      const rowCells = row.children ? [...row.children] : [];
      rowCells.forEach((cell) => {
        if (cell !== valueCell) cell.remove();
      });
      return;
    }

    const heading = valueCell.querySelector('h1, h2, h3, h4, h5, h6');
    const paragraphs = [...valueCell.querySelectorAll('p')]
      .map((p) => p.textContent?.trim())
      .filter(Boolean);
    const rowText = heading?.textContent?.trim()
      || paragraphs[0]
      || valueCell.textContent?.trim()
      || '';

    if (textRowIndex === 0 && rowText) {
      eyebrowText = rowText;
    } else if (textRowIndex === 1 && rowText) {
      headingText = rowText;
    } else if (!headingText && rowText) {
      headingText = rowText;
    }

    textRowIndex += 1;
    row.remove();
  });

  return {
    eyebrowText,
    headingText,
    desktopImageAlt,
    mobileImageAlt,
  };
}

function prependSectionTitle(section, eyebrowText, headingText) {
  if (!section || (!eyebrowText && !headingText)) return;
  if (section.querySelector('.section-title-wrapper')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'section-title-wrapper';

  const sectionTitleBlock = document.createElement('div');
  sectionTitleBlock.className = 'section-title block';
  sectionTitleBlock.dataset.blockName = 'section-title';
  sectionTitleBlock.dataset.blockStatus = 'loaded';

  const row = document.createElement('div');
  const col = document.createElement('div');

  if (eyebrowText) {
    const eyebrow = eyebrowDecorator(eyebrowText, 'accent-color margin-bottom-400');
    if (eyebrow) col.append(eyebrow);
  }

  if (headingText) {
    const heading = document.createElement('h5');
    heading.textContent = headingText;
    col.append(heading);
  }

  row.append(col);
  sectionTitleBlock.append(row);
  wrapper.append(sectionTitleBlock);
  section.prepend(wrapper);
}

export default function decorate(block) {
  if (!block) return;

  const section = block.closest('.section');
  if (section) {
    section.classList.add(
      'flex-grid',
      'flex-grid-container',
      'col-sm-1',
      'col-lg-2',
      'col-md-1',
      'section-title-container',
    );
  }

  const {
    eyebrowText,
    headingText,
    desktopImageAlt,
    mobileImageAlt,
  } = extractTextContent(block);
  prependSectionTitle(section, eyebrowText, headingText);

  const rows = block.children ? [...block.children] : [];
  const imageItems = [];

  rows.forEach((row) => {
    if (!row) return;
    row.classList.add('logo-set-row');

    const cells = row.children ? [...row.children] : [];
    cells.forEach((cell) => {
      if (!cell) return;

      const image = cell.querySelector('picture img');
      if (!image) {
        cell.remove();
        return;
      }

      cell.classList.add('logo-set-item');
      imageItems.push(cell);
      image.loading = imageItems.length === 1 ? 'eager' : 'lazy';
      image.decoding = 'async';
    });
  });

  if (imageItems[0]) {
    imageItems[0].classList.add('desktop-image');
    const desktopImg = imageItems[0].querySelector('img');
    if (desktopImg && desktopImageAlt !== null && desktopImageAlt !== undefined) {
      desktopImg.alt = desktopImageAlt;
    }
  }

  if (imageItems[1]) {
    block.classList.add('logo-set-responsive');
    imageItems[1].classList.add('mobile-image');
    const mobileImg = imageItems[1].querySelector('img');
    if (mobileImg && mobileImageAlt !== null && mobileImageAlt !== undefined) {
      mobileImg.alt = mobileImageAlt;
    }
  }
}
