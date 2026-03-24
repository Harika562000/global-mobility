/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { createBlock, addSection, getLink } from './util.js';
import fetchDeliveryUrl from '../integrations/search.js';

const createPathwayCards = async (main, document) => {
  const serviceCards = main.querySelectorAll('.ups-component.ups-card-component.pathways-card');
  if (!serviceCards.length) return;

  async function createServiceCard(serviceCard) {
    const cardsWrapper = serviceCard.querySelectorAll('.card');
    const blockCells = [];
    const variants = ['icons', 'pathways'];
    if (cardsWrapper.length === 2) {
      variants.push('twocolumn');
    }

    async function constructCardImageSrc(cardImage) {
      if (cardImage?.src) {
        const deliveryUrl = await fetchDeliveryUrl(cardImage?.src.split('/').pop(), cardImage?.src);
        return deliveryUrl;
      }

      return '';
    }

    for (const card of cardsWrapper) {
      const itemCells = [];
      const cardTitle = card.querySelector('.card-body .card-body-content h3');
      const cardDescription = card.querySelector('.card-body .card-body-content p');
      const cardLinks = card.querySelectorAll('.card-body .card-body-content a.ups-cta');
      const cardImage = card.querySelector('.card-img img');
      const newCardImage = document.createElement('img');

      if (cardImage) {
        newCardImage.src = await constructCardImageSrc(cardImage);
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
      newCardIconImage.src = '';
      newCardIconImage.alt = '';
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
        if (link.classList.contains('ups-cta-secondary')) {
          cardLinkA.classList.add('ups-cta-secondary');
        }
        link.querySelector('.sr-only')?.remove();
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

export default createPathwayCards;
