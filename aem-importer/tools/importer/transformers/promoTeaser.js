/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import {
  addSection, convertYouTubeURL, createBlock, getLink,
} from './util.js';
import fetchDeliveryUrl from '../integrations/search.js';

function hasDirectTextNode(element) {
  return Array.from(element.childNodes).some((node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
      return true; // Direct text node with non-whitespace content
    }
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === 'em') {
      return node.textContent.trim() !== ''; // <em> element with non-whitespace content
    }
    return false;
  });
}

const createPromoTeaser = async (main) => {
  const promoTeasers = main.querySelectorAll('.ups-component.promo-teaser.secondary-promo:not(.full-bleed):not(.regular-banner)');
  if (!promoTeasers.length) return;

  for (const teaser of promoTeasers) {
    const teaserType = teaser.classList.contains('img-left') ? 'img-left' : 'default';
    const title = teaser.querySelector('.card .card-header h2') || teaser.querySelector('.card .card-header h3');
    const descriptions = teaser.querySelectorAll('.card-body .card-body-content p');
    let ctaBtns;
    ctaBtns = teaser.querySelectorAll('.card-body .card-body-content >p >a:not(.ups-link)');

    /**
     * Since both a has same link, when parsed both login and signup is treated as
     * textnode inside the a tag and in between span tag. So, we need to handle this case
     * and create a tags for each textnode inside the a tag. This is a workaround for this issue.
     */
    const positionIdentifier = ctaBtns[0]?.classList.contains('ups-cta-secondary');
    const isMalformed = [...ctaBtns].length === 1 && ctaBtns[0].querySelectorAll('span').length > 1;
    if (isMalformed) {
      const { childNodes } = ctaBtns[0];
      const texts = Array.from(childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent.trim())
        .filter((text) => text);

      // construct CTA buttons using texts
      ctaBtns = texts.map((text, index) => {
        const a = document.createElement('a');
        a.textContent = text;
        a.href = getLink(ctaBtns[0].href);
        if (index === 1) {
          a.classList.add(positionIdentifier ? 'ups-cta-primary' : 'ups-cta-secondary');
        } else {
          if(ctaBtns.length == 1 && index == 0) {
            a.classList.add(positionIdentifier ? 'ups-cta-secondary' : 'ups-cta-primary');
          }
        }
        return a;
      });
    }

    const img = teaser.querySelector('.card-img img');
    if (img) {
      img.src = await fetchDeliveryUrl(img.src.split('/').pop(), img.src);
    }

    const video = teaser.querySelector('.card-img .iframe-video-container');
    let teaserVideo;
    if (video) {
      const videoSrc = video.querySelector('iframe').src;
      teaserVideo = document.createElement('div');
      const videoEl = document.createElement('video');
      videoEl.src = convertYouTubeURL(videoSrc);
      teaserVideo.append(videoEl);
      video.remove();
    }

    if (teaser.querySelector('.card-body .card-body-content p:last-child > a.ups-link')) {
      const parentNode = teaser.querySelector('.card-body .card-body-content p:last-child > a.ups-link').parentElement;
      const smallTag = document.createElement('small');
      smallTag.innerHTML = parentNode.innerHTML;
      parentNode.innerHTML = '';
      parentNode.appendChild(smallTag);
    }

    const footNote = teaser.querySelector('.card-body .card-body-content p > small, .card-body .card-body-content p:last-child > a.ups-link')?.parentElement;
    const promoContainer = document.createElement('div');

    if (img) promoContainer.append(img);
    if (video) promoContainer.append(teaserVideo);
    if (title) promoContainer.append(title);
    descriptions.forEach((description) => {
      const p = document.createElement('p');
      if (hasDirectTextNode(description)) {
        p.innerHTML = description.innerHTML;
      }
      promoContainer.append(p);
      description.remove();
    });


    if (ctaBtns) {
      ctaBtns.forEach((cta) => {
        const linkWrapper = document.createElement('p');
        if (cta.classList.contains('ups-cta-primary')) {
          linkWrapper.append(cta);
        } else {
          // removed em for a bug https://www.ups.com/ke/en/track/change-delivery.page
          const secondaryEmWrapper = document.createElement('em');
          secondaryEmWrapper.append(cta);
          linkWrapper.append(cta);
        }
        promoContainer.append(linkWrapper);
      });

      if (ctaBtns.length === 1 && footNote) {
        // This is needed or else JCR  treats footnote as CTA2 🥲
        const emptyP = document.createElement('p');
        const emptyA = document.createElement('a');
        emptyP.append(emptyA);
        promoContainer.append(emptyP);
      }
    }

    if (footNote) {
      promoContainer.append(footNote);
    }

    const block = createBlock('Teaser', [[teaserType, promoContainer]]);
    teaser.append(block);
    addSection(block);
  }
};

export default createPromoTeaser;
