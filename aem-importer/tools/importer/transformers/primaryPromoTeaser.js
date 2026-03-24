/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { addSection, createBlock, convertYouTubeURL } from './util.js';
import fetchDeliveryUrl from '../integrations/search.js';

function hasDirectTextNode(element) {
  return Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '');
}

const createPrimaryPromoTeaser = async (main) => {
  const promoPrimaryTeasers = main.querySelectorAll('.ups-component.promo-teaser.primary-promo:not(.full-bleed):not(.regular-banner)');

  if (!promoPrimaryTeasers.length) return;

  for (const teaser of promoPrimaryTeasers) {
    const teaserType = 'img-left';
    const title = teaser.querySelector('.card .card-header h2') || teaser.querySelector('.card .card-header h3');
    const descriptions = teaser.querySelectorAll('.card-body .card-body-content p');
    const ctaBtns = teaser.querySelectorAll('.card-body .card-body-content >p >a.ups-cta');
    const isBackgroundArc = teaser.classList.contains('background-arc');
    const variant = [];
    const promoContainer = document.createElement('div');
    const img = teaser.querySelector('.card-img img');

    if (img) {
      img.src = await fetchDeliveryUrl(img.src.split('/').pop(), img.src);
    } else {
      const teaserVideo = teaser.querySelector('.card-img .iframe-video-container iframe');
      const videoWrapper = document.createElement('p');
      const video = document.createElement('video');
      video.src = teaserVideo ? convertYouTubeURL(teaserVideo.src) : '';
      videoWrapper.append(video);
      promoContainer.append(videoWrapper);
    }
    
    const footNote = teaser.querySelector('.card-body .card-body-content p > small')?.parentElement;
    const superText = teaser.querySelector('.card .card-body .card-body-content p:last-of-type > sup')?.parentElement;

    if (img) promoContainer.append(img);
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
        linkWrapper.append(cta);
        promoContainer.append(linkWrapper);
      });

      if (ctaBtns.length === 1 && (footNote || superText)) {
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

    if (superText) {
      const small = document.createElement('small');
      small.textContent = superText.querySelector('sup').textContent;
      const ft = document.createElement('p');
      ft.append(small);
      promoContainer.append(ft);
    }

    if (isBackgroundArc) {
      variant.push('featured');
    }

    const block = createBlock('Teaser', [[teaserType, promoContainer]], variant);
    if (isBackgroundArc) {
      const sectionMetadata = createBlock('Section Metadata', [['style', 'background-arc']]);
      block.append(sectionMetadata);
    }
    teaser.append(block);
    addSection(block);
  }
};

export default createPrimaryPromoTeaser;
