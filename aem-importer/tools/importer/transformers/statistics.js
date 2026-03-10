/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { createBlock, addSection } from './util.js';
import fetchDeliveryUrl from '../integrations/search.js';

const createStatistics = async (main, document) => {
  const statisticsBlock = main.querySelectorAll('.ups-component.ups-card-component.statistics-card');
  if (!statisticsBlock.length) return;

  async function createStatisticsBlock(statistics) {
    const title = statistics.querySelector('.ups-container .component-header h2');
    const description = statistics.querySelector('.ups-container .component-header p');
    const itemWrapper = statistics.querySelectorAll('.card');
    const blockCells = [];
    const statisticsFooter = statistics.querySelector('.ups-container .component-footer');
    const ctaLinks = statisticsFooter ? Array.from(statisticsFooter.querySelectorAll('p:first-of-type a')) : [];
    const statisticsCTAsDiv = document.createElement('div');

    for (const item of itemWrapper) {
      const itemCells = [];
      const itemTitleText = item.querySelector('.card-body .card-body-content h3').textContent;
      const itemDescription = item.querySelector('.card-body .card-body-content p');
      const itemImage = item.querySelector('.card-img img');

      const mainDiv = document.createElement('div');

      const itemIconP = document.createElement('p');
      const imageTag = document.createElement('img');
      imageTag.src = (itemImage?.src) ? await fetchDeliveryUrl(itemImage?.src.split('/').pop(), itemImage?.src) : '';
      imageTag.alt = itemImage?.alt || '';
      itemIconP.append(imageTag);
      mainDiv.append(itemIconP);

      const itemTitle = document.createElement('p');
      itemTitle.textContent = itemTitleText;
      mainDiv.append(itemTitle);

      const itemDescDiv = document.createElement('div');
      if (itemDescription) {
        itemDescDiv.append(itemDescription);
        mainDiv.append(itemDescDiv);
      } else {
        const itemDescriptionP = document.createElement('p');
        itemDescriptionP.textContent = '';
        itemDescDiv.append(itemDescriptionP);
        mainDiv.append(itemDescDiv);
      }

      itemCells.push(mainDiv);
      blockCells.push(itemCells);
      item.remove();
    }

    ctaLinks.forEach((link) => {
      const statisticsLinkP = document.createElement('p');
      const statisticsLinkA = document.createElement('a');
      if (link.classList.contains('ups-cta-secondary')) {
        statisticsLinkA.classList.add('ups-cta-secondary');
      }
      statisticsLinkA.href = link.href;
      statisticsLinkA.textContent = link.textContent;
      statisticsLinkP.append(statisticsLinkA);
      statisticsCTAsDiv.append(statisticsLinkP);
      link.remove();
    });

    blockCells.unshift([statisticsCTAsDiv]);
    const block = createBlock('Statistics', blockCells);
    if (title) statistics.append(title);
    if (description) statistics.append(description);
    statistics.append(block);
    addSection(block);
  }

  for (const statistics of statisticsBlock) {
    await createStatisticsBlock(statistics);
  }
};

export default createStatistics;
