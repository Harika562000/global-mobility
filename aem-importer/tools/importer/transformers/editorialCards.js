/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import fetchDeliveryUrl from '../integrations/search.js';
import { createBlock, addSection, getLink } from './util.js';

const createEditorialCards = async (main, document) => {
  const editorialCards = main.querySelectorAll('.ups-component.ups-card-component.editorial-card');
  if (!editorialCards.length) return;

  async function createEditorialCard(editorialCard) {
    const title = editorialCard.querySelector('.component-header h2');
    const description = editorialCard.querySelector('.component-header > p');
    const allCTAs = editorialCard.querySelectorAll('.component-footer .ups-cta');
    const cardsWrapper = editorialCard.querySelectorAll('.card');
    const blockCells = [];
    const variants = ['editorial', 'image'];

    for (const card of cardsWrapper) {
      const itemCells = [];
      const cardTitle = card.querySelector('.card-body .card-body-content h3');
      const cardDescription = card.querySelector('.card-body .card-body-content p');
      const cardLinks = card.querySelectorAll('.card-body .card-body-content a.ups-cta');
      const cardImage = card.querySelector('.card-img img');
      const newCardImage = document.createElement('img');

      if (cardImage) {
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

        if (link.classList.contains('ups-cta-tertiary')) {
          cardLinkA.classList.add('ups-cta-tertiary');
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

    const allCTAWrapper = document.createElement('div');
    allCTAs.forEach((cta) => {
      const ctaLinkP = document.createElement('p');
      const ctaLinkA = document.createElement('a');
      cta.querySelector('.sr-only')?.remove();
      if (cta.classList.contains('ups-cta-secondary')) {
        ctaLinkA.classList.add('ups-cta-secondary');
      }
      ctaLinkA.href = getLink(cta);
      ctaLinkA.textContent = cta.textContent;
      ctaLinkP.append(ctaLinkA);
      allCTAWrapper.append(ctaLinkP);
      cta.remove();
    });

    const block = createBlock('Cards', blockCells, variants);
    if (title) editorialCard.append(title);
    if (description) editorialCard.append(description);
    editorialCard.append(block);
    const hasTabAsParent = editorialCard.closest('.ups-component.tabs');
    block.append(allCTAWrapper);
    addSection(block, hasTabAsParent);
  }

  for (const editorialCard of editorialCards) {
    await createEditorialCard(editorialCard);
  }
};

export default createEditorialCards;
