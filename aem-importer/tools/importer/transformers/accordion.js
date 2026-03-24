import {
  createBlock, addSection, hasDirectTextNodeOnly, transformInnerBrTags,
} from './util.js';

const createAccordion = (main, document) => {
  const accordions = Array.from(main.querySelectorAll('.ups-component.ups-accordion_wrapper'));
  if (!accordions.length) return;

  accordions.forEach((accordion) => {
    const open = accordion.classList.contains('open-default');
    const blockCells = [];
    const title = accordion.querySelector('.ups-container .component-header h2');
    const description = accordion.querySelector('.ups-container .component-header p');
    const accordionItems = accordion.querySelectorAll('.ups-accordion_content .ups-accordion_item');

    accordionItems?.forEach((item, index) => {
      const itemCells = [];
      const headingLink = item.querySelector('.ups-acc-headcont > a');

      if (headingLink) {
        const p = document.createElement('p');
        p.textContent = headingLink.textContent;
        headingLink.replaceWith(p);
      }

      const headingAsP = item.querySelector('.ups-acc-headcont p');
      const links = item.querySelectorAll('.ups-accordion_expand p a.ups-link');

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
      const content = item.querySelector('.ups-accordion_expand');
      transformInnerBrTags(content);

      itemCells.push(headingAsP, content, index === 0 ? open : false);
      blockCells.push(itemCells);
      item.remove();
    });

    const block = createBlock('Accordion', blockCells);
    if (title) accordion.append(title);
    if (description) accordion.append(description);
    accordion.append(block);
    const hasTabAsParent = accordion.closest('.ups-component.tabs');
    addSection(block, hasTabAsParent);
  });
};

export default createAccordion;
