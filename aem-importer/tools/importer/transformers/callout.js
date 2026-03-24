import { createBlock, addSection } from './util.js';

const createCallout = (main, document) => {
  const callouts = main.querySelectorAll('.ups-component.callout');
  if (!callouts.length) return;

  callouts.forEach((callout) => {
    const icons = {
      'icon ups-icon-flag': ':flag:',
      'icon ups-icon-help': ':help:',
    };

    const calloutIcon = callout.querySelector('.content-wrapper .icon-container span');
    const calloutContent = callout.querySelector('.content-wrapper .content');
    const calloutContentPTag = calloutContent.querySelectorAll('p');
    const p = document.createElement('p');

    if (calloutIcon) {
      calloutIcon.textContent = icons[calloutIcon.className] || ':flag:';
      p.append(calloutIcon);
      calloutContent.prepend(p);
    }

    if (calloutContentPTag.length > 1) {
      const mergedPTag = Array.from(calloutContentPTag).map(p => p.innerHTML).join("<br><br>");
      calloutContentPTag.forEach(p => p.remove());
      const newParagraph = document.createElement("p");
      newParagraph.innerHTML = mergedPTag;
      calloutContent.append(newParagraph);
    }
    const block = createBlock('Callout', [[calloutContent]]);

    callout.append(block);
    addSection(block);
  });
};

export default createCallout;
