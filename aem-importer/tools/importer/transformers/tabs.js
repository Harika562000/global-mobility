/* eslint-disable no-restricted-syntax */
import {
  createBlock, addSection, transformInnerBrTags, hasDirectTextNodeOnly,
} from './util.js';
import fetchDeliveryUrl from '../integrations/search.js';

function escapeAmpersand(str) {
  return str.replace(/&/g, '&amp;');
}

const createTabs = (main) => {
  const tabs = main.querySelectorAll('.ups-component.tabs');
  if (!tabs.length) return;

  for (const tab of tabs) {
    const tabType = tab.classList.contains('tab-horizontal') ? 'horizontal' : 'vertical';
    const tabHeadings = Array.from(tab.querySelectorAll('ul[role="tablist"] li'));
    const tabContents = tab.querySelectorAll('.tab-content .tab-pane');

    for (const [index, heading] of tabHeadings.entries()) {
      /**
       * Hacky solution for tab sections to work.
       * We will use this until we have a better solution.
       */
      const itemCells = [];
      const tabContent = tabContents[index];
      const tabImage = tabContent.querySelector('img');
      transformInnerBrTags(tabContent);

      // to fix primary cta appearing in tab content when it is a link
      const links = tabContent.querySelectorAll('a.ups-link');

      if (links.length > 0) {
        links.forEach((link) => {
          if (link.parentNode.tagName === 'P') {
            const pTag = link.parentNode;
            const childNodes = Array.from(pTag.childNodes).filter((node) => node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'BR');

            if (childNodes.length === 1 && !hasDirectTextNodeOnly(pTag)) {
              // Only one anchor tag and no other non-<br> tags
              const strongTag = document.createElement('strong');
              link.parentNode.replaceChild(strongTag, link);
              strongTag.append(link);
            }
          }
        });
      }

      if (tabImage?.src) {
        const tabImageDiv = document.createElement('div');
        const tabImagep = document.createElement('p');
        const tabImageAnchor = document.createElement('a');
        (async () => {
          /* eslint-disable no-await-in-loop */
          tabImageAnchor.href = tabImage.src ? await fetchDeliveryUrl(tabImage?.src.split('/').pop(), tabImage?.src) : '';
        })();
        if (tabImageAnchor.href) {
          tabImageDiv.append(tabImagep);
          tabImagep.append(tabImageAnchor);
          tabContent.prepend(tabImagep);
          tabImage.remove();
        }
      }

      const tabHeading = heading.querySelector('a')?.textContent?.trim();
      const tabDivEl = document.createElement('h2');
      tabDivEl.textContent = tabHeading;
      if (tabHeading) {
        const tabHeadingBlock = createBlock('Tab Heading', [[tabDivEl]]);
        const tabHeadingDiv = document.createElement('div');
        tabHeadingDiv.append(tabHeadingBlock);
        tabContent.prepend(tabHeadingDiv);
      }

      itemCells.push([['name'], ['Tab Section']]);
      itemCells.push([['tabSection'], [true]]);
      itemCells.push([['category'], [tabType]]);
      itemCells.push([['icon'], ['']]);
      itemCells.push([['filter'], ['tab-section']]);
      itemCells.push([['model'], ['tab-section']]);
      itemCells.push([['content'], [escapeAmpersand(tabHeading || '')]]);

      const hasCTA = tabContent.querySelectorAll('.ups-cta');

      // Picked from textContent.js
      hasCTA.forEach((cta) => {
        const isCTAPrimary = cta.classList.contains('ups-cta-primary');
        const buttonP = document.createElement('p');
        const buttonEM = document.createElement('em');
        const buttonA = document.createElement('a');
        buttonA.href = cta.href;
        buttonA.textContent = cta.firstChild.textContent;
        if (isCTAPrimary) {
          buttonP.append(buttonA);
        } else {
          buttonEM.append(buttonA);
          buttonP.append(buttonEM);
        }
        tabContent.append(buttonP);
        cta.remove();
      });

      const block = createBlock('Section Metadata', itemCells);
      heading.remove();
      tabContent.append(block);
      addSection(block);
    }
  }
};

export default createTabs;
