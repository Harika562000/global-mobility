import { addSection, createBlock } from './util.js';

const createRegions = (main) => {
  const region = main.querySelector('.ups-component.anchor-links.ups-country-wrapper');
  if (!region) return;

  const stickyHeader = region.querySelector('.anchor-list.ups-country_list.ups-list_sticky');
  stickyHeader.remove();

  const countryList = region.querySelector('.region-content-container');
  const blockCells = [];
  countryList.querySelectorAll('section.content-blocks').forEach((section) => {
    const itemCells = [];
    const countryWrapper = document.createElement('div');
    const countryHead = section.querySelector('.component-header h2');
    const countryContentList = section.querySelector('ul');
    countryWrapper.append(countryHead, countryContentList);
    itemCells.push([countryWrapper]);
    blockCells.push(itemCells);
  });

  const block = createBlock('Regions', blockCells);
  region.append(block);
  addSection(block);
};

export default createRegions;
