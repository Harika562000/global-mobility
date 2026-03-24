import { addSection, createBlock } from './util.js';

const createTabTitle = (main, document) => {
  const tab = document.querySelector('.ups-component.tabs');
  if (!tab) return;
  const title = tab.querySelector('.component-header');
  const isHorizontalTab = tab.classList.contains('tab-horizontal');
  if (!title || isHorizontalTab) return;

  const variant = ['align-center'];
  const heading = title.querySelector('h2') || title.querySelector('h3');
  const description = title.querySelector('p');
  const itemCells = [];

  if (heading) {
    itemCells.push(heading);
  }

  const blockCells = [[''], [itemCells]];

  const block = createBlock('Ups Title', blockCells, variant);
  title.append(block);
  addSection(block);

  if (description) {
    const t = title.querySelector('table');
    t.after(description);
  }
};

export default createTabTitle;
