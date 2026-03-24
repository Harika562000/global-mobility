import { eyebrowDecorator } from '../../scripts/scripts.js';

export default function decorate(block) {
  const rows = [...block.children];
  if (rows.length === 0) return;

  const [logoRow, eyebrowRow, headlineRow, descriptionRow, formRow] = rows;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';

  if (logoRow) {
    logoRow.classList.add('logo');
    contentDiv.append(logoRow);
  }
  if (eyebrowRow) {
    const eyebrow = eyebrowDecorator(eyebrowRow);
    if (eyebrow) {
      contentDiv.append(eyebrow);
    } else {
      contentDiv.append(eyebrowRow);
    }
  }
  if (headlineRow) {
    headlineRow.classList.add('headline');
    contentDiv.append(headlineRow);
  }
  if (descriptionRow) {
    descriptionRow.classList.add('description');
    contentDiv.append(descriptionRow);
  }

  const formDiv = document.createElement('div');
  formDiv.className = 'form';
  if (formRow) {
    formDiv.append(...formRow.childNodes);
  }

  block.replaceChildren(contentDiv, formDiv);
}
