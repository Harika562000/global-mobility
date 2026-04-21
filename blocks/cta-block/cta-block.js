import { eyebrowDecorator } from '../../scripts/scripts.js';

export default function decorate(block) {
  const rows = [...block.children];
  const eyebrowRow = rows[0];
  const headlineRow = rows[1];
  const descriptionRow = rows[2];
  const altRow = rows[10];

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'content-wrapper';

  const textContent = document.createElement('div');
  textContent.className = 'text-content';

  const eyebrowCell = eyebrowRow?.children?.[1]
    || eyebrowRow?.children?.[0]
    || eyebrowRow;
  const eyebrowText = eyebrowCell?.textContent?.trim();
  if (eyebrowText) {
    const eyebrow = eyebrowDecorator(eyebrowText, 'accent-color2');
    if (eyebrow) textContent.append(eyebrow);
  }

  if (headlineRow) {
    const headlineCell = headlineRow?.children?.[1]
      || headlineRow?.children?.[0]
      || headlineRow;
    const heading = headlineCell?.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
      textContent.append(heading);
    } else if (headlineCell?.textContent?.trim()) {
      const h4 = document.createElement('h4');
      h4.textContent = headlineCell.textContent.trim();
      textContent.append(h4);
    }
  }

  if (descriptionRow) {
    const descriptionCell = descriptionRow?.children?.[1]
      || descriptionRow?.children?.[0]
      || descriptionRow;
    if (descriptionCell?.innerHTML?.trim()) {
      const p = document.createElement('div');
      p.className = 'cta-description';
      p.innerHTML = descriptionCell.innerHTML;
      textContent.append(p);
    }
  }

  const anchors = [...block.querySelectorAll('a')].map((a) => a.closest('p') || a);

  if (anchors.length) {
    const actions = document.createElement('div');
    actions.className = 'actions';
    const container = document.createElement('div');
    container.className = 'button-container';
    anchors.forEach((anchor) => {
      container.appendChild(anchor);
    });

    actions.append(container);
    textContent.append(actions);
  }

  contentWrapper.append(textContent);

  const picture = block.querySelector('picture');
  if (picture) {
    const mediaDiv = document.createElement('div');
    mediaDiv.className = 'media';
    const altCell = altRow?.children?.[1]
      || altRow?.children?.[0]
      || altRow;
    const altText = altCell?.textContent?.trim();
    const img = picture.querySelector('img');
    if (img && altText) img.setAttribute('alt', altText);
    mediaDiv.append(picture);
    block.replaceChildren(contentWrapper, mediaDiv);
  } else {
    block.replaceChildren(contentWrapper);
  }
}
