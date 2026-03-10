/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import fetchDeliveryUrl from '../integrations/search.js';
import { createBlock, addSection, getLink } from './util.js';

const createCards = async (main, document) => {
  const serviceCards = main.querySelectorAll('.ups-component.ups-card-component.service-card');
  if (!serviceCards.length) return;

  async function createServiceCard(serviceCard) {
    const cardsWrapper = serviceCard.querySelectorAll('.card');
    const blockCells = [];
    const variants = [];
    const isIconsCard = serviceCard.classList.contains('icon-card');

    if (isIconsCard) {
      variants.push('icons', 'services');
    } else if (Array.from(cardsWrapper).some((card) => card.querySelector('.card-img img'))) {
      variants.push('images', 'services');
    } else {
      variants.push('text', 'services');
    }

    for (const card of cardsWrapper) {
      const itemCells = [];
      const cardTitle = card.querySelector('.card-body .card-body-content h3');
      const cardDescription = card.querySelector('.card-body .card-body-content p');
      const cardLinks = card.querySelectorAll('.card-body .card-body-content a.ups-cta');
      const cardImage = card.querySelector('.card-img img');
      const newCardImage = document.createElement('img');

      if (cardImage && !isIconsCard) {
        newCardImage.src = cardImage.src ? await fetchDeliveryUrl(cardImage.src.split('/').pop(), cardImage.src) : '';
        newCardImage.alt = cardImage.alt || '';
      } else {
        newCardImage.src = '';
        newCardImage.alt = '';
      }
      itemCells.push(newCardImage);

      const cardsIconBool = document.createElement('div');
      cardsIconBool.textContent = 'false';
      itemCells.push(cardsIconBool);

      const newCardIconImage = document.createElement('img');
      if (isIconsCard && cardImage) {
        newCardIconImage.src = cardImage.src ? await fetchDeliveryUrl(cardImage.src.split('/').pop(), cardImage.src) : '';
        newCardIconImage.alt = cardImage.alt || '';
      } else {
        newCardIconImage.src = '';
        newCardIconImage.alt = '';
      }
      itemCells.push(newCardIconImage);

      const cardsDiv = document.createElement('div');
      cardsDiv.append(cardTitle);

      if (cardDescription) {
        cardsDiv.append(cardDescription);
      } else {
        const cardDescriptionP = document.createElement('p');
        cardDescriptionP.textContent = '';
        cardsDiv.append(cardDescriptionP);
      }

      cardLinks.forEach((link) => {
        const cardLinkP = document.createElement('p');
        const cardLinkA = document.createElement('a');
        link.querySelector('.sr-only')?.remove();
        if (link.classList.contains('ups-cta-secondary')) {
          cardLinkA.classList.add('ups-cta-secondary');
        }
        cardLinkA.href = getLink(link);
        cardLinkA.textContent = link.textContent;
        cardLinkP.append(cardLinkA);
        cardsDiv.append(cardLinkP);
      });

      const cardFootnote = card.querySelector('.card-body .card-body-content p small');
      if (cardFootnote) {
        const p = document.createElement('p');
        p.innerHTML = cardFootnote.innerHTML;
        cardsDiv.append(p);
      }

      itemCells.push(cardsDiv);
      blockCells.push(itemCells);
      card.remove();
    }

    const block = createBlock('Cards', blockCells, variants);
    serviceCard.append(block);
    const hasTabAsParent = serviceCard.closest('.ups-component.tabs');
    addSection(block, hasTabAsParent);
  }

  for (const serviceCard of serviceCards) {
    await createServiceCard(serviceCard);
  }
};

export default createCards;
