import { createBlock, addSection } from './util.js';

const createLinkList = (main, document) => {
  const linkLists = main.querySelectorAll('.ups-component.ups-links-list');
  if (!linkLists.length) return;

  function createLinkListBlock(linkList) {
    const variants = [];
    const titleBlockVariants = [];
    const blockCells = [];
    let titleBlock;
    const title = linkList.querySelector('.ups-container .component-header h2');
    const description = linkList.querySelector('.ups-container .component-header p');

    // Construct Ups Title block if title is available
    if (title) {
      titleBlockVariants.push('align-center');
      blockCells.push(['']); // Icons not a possbililty for Link List
      blockCells.push([title]);
      titleBlock = createBlock('Ups Title', blockCells, titleBlockVariants);
    }

    if (linkList.querySelector('.ups-icon-right-arrow')) {
      variants.push('with chevron');
    }

    const listItems = Array.from(linkList.querySelectorAll('.list-items li'));
    listItems.forEach((item) => {
      item.querySelector('span')?.remove();
    });
    const ul = document.createElement('ul');
    ul.append(...listItems);
    const block = createBlock('Link List', [[ul]], variants);
    if (titleBlock) linkList.prepend(titleBlock);
    if (description) linkList.append(description);
    linkList.append(block);
    addSection(block);
  }

  linkLists.forEach((linkList) => {
    createLinkListBlock(linkList);
  });
};

export default createLinkList;
