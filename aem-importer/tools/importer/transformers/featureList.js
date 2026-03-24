/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import fetchDeliveryUrl from '../integrations/search.js';
import { addSection, createBlock, getLink } from './util.js';

const createFeatureList = async (main, document) => {
  const featureLists = main.querySelectorAll('.ups-component.featured-list-component');
  if (!featureLists.length) return;

  async function createServiceCard(featureList) {
    const isFeaturedImgAndListLeft = featureList.classList.contains('featured-image')
      || featureList.classList.contains('list-left');
    if (isFeaturedImgAndListLeft) return;

    const blockCells = [];
    const variants = [];
    const title = featureList.querySelector('.component-header > h2');
    const description = featureList.querySelector('.component-header > p');
    const isIconsItem = featureList.classList.contains('icon-card');
    const isBulletListSolid = featureList.classList.contains('bullet-list-solid');
    const isCollapsible = featureList.classList.contains('collapsible');
    const isCollapsibleDiv = document.createElement('div');
    isCollapsibleDiv.textContent = 'false';

    if (isCollapsible) {
      const componentBody = featureList.querySelector('.component-body');
      featureList.querySelector('.collapsible-section').replaceWith(componentBody);
      featureList.querySelector('.toggle-content-btn').remove();
      isCollapsibleDiv.textContent = 'true';
    }

    let listItems;
    let bulletedUL = false;
    if (isIconsItem) {
      variants.push('vertical-icon');
      listItems = featureList.querySelectorAll('.card');
    } else if (isBulletListSolid) {
      listItems = featureList.querySelectorAll('.card ol li');
      if(!listItems.length) {
        listItems = featureList.querySelectorAll('.card ul li');
        bulletedUL = true;
      } else {
        variants.push('no-bullet');
      }
    } else {
      variants.push('custom-bullet');
      listItems = featureList.querySelectorAll('.card ul li');
    }
    const featureListFooter = featureList.querySelector('.ups-container .component-footer');
    const cardFooter = featureList.querySelector('.ups-container .component-body .card-footer');
    const cardFootNote = cardFooter?.querySelector('p:last-of-type');
    let ctaLinks = [];

    if (featureListFooter) {
      ctaLinks = Array.from(featureListFooter.querySelectorAll('p:first-of-type a:not(small a)'));
    } else if (cardFooter) {
      ctaLinks = Array.from(cardFooter.querySelectorAll('p:first-of-type a:not(small a)'));
    }

    const footNotes = featureListFooter?.querySelectorAll('p:has(small)')
      || (() => {
        if (cardFootNote?.[Symbol.iterator]) {
          return [...cardFootNote];
        }
        return cardFootNote ? [cardFootNote] : [];
      })();

    const featureListCTAsDiv = document.createElement('div');
    const featureListFootnoteDiv = document.createElement('div');

    // FIX For https://www.ups.com/cz/en/business-solutions/expand-your-online-business/ecommerce-plug-ins.page
    // footnote (In English Only) not appearing, if you are modyfying, pls ensure this doesn't break
    if (!footNotes.length) {
      /**
       * If the footnote is still empty, check if there is more than
       * one p tag in the cardFooter.
       * Note: For some reason, the span tag is not shown when it is querySelected,
       * instead there's only text content. So, we need to check if the last p tag
       * has no children but only text content.
       */
      const cardFooterP = cardFooter?.querySelectorAll('p');
      const lastCardFooterP = cardFooterP?.[cardFooterP.length - 1];
      if (lastCardFooterP?.textContent && !lastCardFooterP?.children.length) {
        const p = document.createElement('p');
        p.textContent = lastCardFooterP?.textContent || '';
        featureListFootnoteDiv.append(p);
      }
    }

    for (const item of listItems) {
      const itemCells = [];
      const itemDiv = document.createElement('div');
      if (isIconsItem) {
        const itemImage = item.querySelector('.card-img img');
        const itemTitle = item.querySelector('.card-body .card-body-content h3');
        const titleInP = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = itemTitle.textContent;
        titleInP.append(strong);

        const itemDescription = item.querySelectorAll('.card-body .card-body-content > :not(h3)');

        const newItemImg = document.createElement('img');
        newItemImg.src = itemImage?.src ? await fetchDeliveryUrl(itemImage?.src.split('/').pop(), itemImage?.src) : '';
        newItemImg.alt = itemImage?.alt || '';
        itemDiv.append(newItemImg);

        const itemContentDiv = document.createElement('div');
        itemContentDiv.append(titleInP);

        if (itemDescription.length > 0) {
          itemDescription.forEach((desc) => {
            itemContentDiv.append(desc);
          });
        } else {
          const itemDescriptionP = document.createElement('p');
          itemDescriptionP.textContent = '';
          itemContentDiv.append(itemDescriptionP);
        }

        itemDiv.append(itemContentDiv);
        itemCells.push(itemDiv);
      } else {
        const itemUl = document.createElement(isBulletListSolid && !bulletedUL ? 'ol' : 'ul');
        const itemClone = item.cloneNode(true);
        itemUl.append(itemClone);
        itemDiv.append(itemUl);
        itemCells.push(itemDiv);
      }
      blockCells.push(itemCells);
      item.remove();
    }

    ctaLinks.forEach((link) => {
      const featureListLinkP = document.createElement('p');
      const featureListLinkA = document.createElement('a');
      link.querySelector('.sr-only')?.remove();
      if (link.classList.contains('ups-cta-secondary')) {
        featureListLinkA.classList.add('ups-cta-secondary');
      }
      featureListLinkA.href = getLink(link.href);
      featureListLinkA.textContent = link.textContent;
      if (ctaLinks.length === 1 && link.classList.contains('ups-cta-secondary')) {
        const p = document.createElement('p');
        const a = document.createElement('a');
        a.href = '';
        p.append(a);
        featureListCTAsDiv.append(p);
      }
      featureListLinkP.append(featureListLinkA);
      featureListCTAsDiv.append(featureListLinkP);
      link.remove();
    });

    if (footNotes) {
      const footNoteWrapper = document.createElement('p');
      footNotes.forEach((note, index) => {
        const isLastNote = index === footNotes.length - 1;
        let featureListFootnote;
        if (!note?.querySelector('small') && ctaLinks.length === 2 && footNotes.length === 1) {
          featureListFootnote = note;
        } else {
          featureListFootnote = note?.querySelector('small');
        }

        if (featureListFootnote) {
          let featureListFootnoteText = featureListFootnote.innerHTML;
          if (isLastNote && featureListFootnote.parentElement.tagName === 'EM') {
            const em = document.createElement('em');
            em.innerHTML = featureListFootnoteText;
            featureListFootnoteText = em.outerHTML;
          }
          const featureListFootnoteTextWithBr = isLastNote ? featureListFootnoteText : `${featureListFootnoteText}<br>`;
          footNoteWrapper.innerHTML += featureListFootnoteTextWithBr;
          featureListFootnote.remove();
        }
        note.remove();
      });

      featureListFootnoteDiv.append(footNoteWrapper);
    }

    if (featureListFootnoteDiv.innerHTML === '') {
      const p = document.createElement('p');
      p.textContent = '';
      featureListFootnoteDiv.append(p);
    }

    blockCells.unshift([featureListFootnoteDiv]);
    blockCells.unshift([featureListCTAsDiv]);
    blockCells.unshift([isCollapsibleDiv]);

    featureList.querySelector('.component-body').innerHTML = '';
    if (featureListFooter) {
      featureList.querySelector('.component-footer').innerHTML = '';
    }
    const block = createBlock('Feature List', blockCells, variants);
    if (title) {
      // if there is a br tag, replace it with \n
      title.innerHTML = title.innerHTML.replace(/<br>/g, '\n');
      // If there is sup tag, remove it
      title.innerHTML = title.innerHTML.replace(/<sup>/g, '');
      featureList.append(title);
    }

    if (description) {
      featureList.append(description);
    }

    featureList.append(block);
    const hasTabAsParent = featureList.closest('.ups-component.tabs');
    addSection(block, hasTabAsParent);
  }

  for (const featureList of featureLists) {
    await createServiceCard(featureList);
  }
};

export default createFeatureList;
