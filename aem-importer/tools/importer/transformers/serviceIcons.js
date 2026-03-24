/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { createBlock, addSection } from './util.js';
import fetchDeliveryUrl from '../integrations/search.js';

const createServiceIconCards = async (main) => {
  // TODO: Move this code to createPathwayCards.js??
  const serviceCards = main.querySelectorAll('.ups-component.featured-list-component.icon-card');
  if (!serviceCards.length) return;

  async function createServiceIconCard(serviceCard) {
    const cardsWrapper = serviceCard.querySelectorAll('.card');
    const blockCells = [];
    const variants = ['icons', 'pathways'];

    async function constructCardImageHref(cardImage) {
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

      const cardsImgDiv = document.createElement('div');
      const cardsImgA = document.createElement('a');
      cardsImgA.href = '';

      cardsImgDiv.append(cardsImgA);
      itemCells.push(cardsImgDiv);

      const cardsIconBool = document.createElement('div');
      cardsIconBool.textContent = 'false';
      itemCells.push(cardsIconBool);

      const cardIcon = document.createElement('div');
      const cardIconP = document.createElement('p');
      const cardIconA = document.createElement('a');
      cardIconA.href = await constructCardImageHref(cardImage);
      cardIconA.textContent = cardImage?.alt || '';
      cardIconP.append(cardIconA);
      cardIcon.append(cardIconP);
      itemCells.push(cardIcon);

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
        cardLinkA.href = link.href;
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
    addSection(block);
  }

  for (const serviceCard of serviceCards) {
    await createServiceIconCard(serviceCard);
  }
};

export default createServiceIconCards;
