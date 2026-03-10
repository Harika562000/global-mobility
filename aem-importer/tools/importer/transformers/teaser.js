/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { createBlock, addSection, convertYouTubeURL } from './util.js';
import fetchDeliveryUrl from '../integrations/search.js';

const createTeaser = async (main, document) => {
  const featuredListTeasers = main.querySelectorAll('.ups-component.featured-list-component.featured-image');
  if (!featuredListTeasers.length) return;

  function appendTeaserItems(teaserImageList, teaserItems) {
    for (const item of teaserItems) {
      if (item) teaserImageList.append(item);
    }
  }

  for (const featuredListTeaser of featuredListTeasers) {
    const teaserImageList = document.createElement('div');
    const showCheckBox = featuredListTeaser.classList.contains('list-left') && !featuredListTeaser.classList.contains('icon-card');

    const variants = ['list'];
    // Teaser list variation without video - image left and list right
    const title = featuredListTeaser.querySelector('.component-header h2');
    const description = featuredListTeaser.querySelector('.component-header p');
    const teaserBody = featuredListTeaser.querySelector('.component-body .card-body-content');

    const teaserImg = featuredListTeaser.querySelector('.component-body .card-img img');
    const isteaserVideo = featuredListTeaser.querySelector('.component-body .card-img .iframe-video-container');
    if (teaserImg) {
      teaserImg.src = await fetchDeliveryUrl(teaserImg.src.split('/').pop(), teaserImg.src);
    }

    const teaserFooter = featuredListTeaser.querySelector('.card-footer >p:has(small), .card-footer >p:not(:has(.ups-cta))');
    const teaserTermsText = featuredListTeaser.querySelector('.card-footer >p:last-of-type');

    const hasUpsLink = teaserTermsText?.querySelector('.ups-link');
    const hasUpsCta = teaserTermsText?.querySelector('.ups-cta');
    if (teaserTermsText
      && (teaserTermsText.childNodes[0].nodeType === Node.TEXT_NODE
      || (hasUpsLink && !hasUpsCta))) {
      const newParagraph = document.createElement('p');
      const small = document.createElement('small');
      small.innerHTML = teaserTermsText.innerHTML;
      newParagraph.append(small);
      teaserTermsText.replaceWith(newParagraph);
      teaserFooter.append(newParagraph);
      newParagraph.remove();
    }

    const descriptionLinks = teaserBody.querySelector('p > a');
    if (descriptionLinks) {
      const linkParent = descriptionLinks.parentNode;
      if(descriptionLinks.classList.contains('ups-cta-primary')) {
        const ctaP = document.createElement('p');
        ctaP.append(descriptionLinks);
        linkParent?.append(ctaP);
      } else {
        if (linkParent.firstChild.nodeType !== Node.TEXT_NODE) {
          const previousNode = linkParent.previousElementSibling;
          previousNode?.append(descriptionLinks);
        }
      }
    }

    const teaserVideo = document.createElement('p');
    // TODO: Handle video in a conditional manner
    if (isteaserVideo) {
      const videoEl = document.createElement('video');
      videoEl.src = convertYouTubeURL(isteaserVideo.querySelector('iframe').src);
      teaserVideo.append(videoEl);
    } else {
      const videoEl = document.createElement('video');
      teaserVideo.append(videoEl);
    }

    const teaserCTA = featuredListTeaser.querySelectorAll('.card-footer .ups-cta');
    const ctaWrapper = document.createElement('div');
    teaserCTA.forEach((cta) => {
      const ctaP = document.createElement('p');
      ctaP.append(cta);
      teaserImageList.append(ctaP);
      ctaWrapper.append(ctaP);
    });

    const teaserLink = featuredListTeaser.querySelector(
      '.card-footer p .ups-link:not(small .ups-link, [href^="tel:"], .card-body-content > p span a.ups-link, .component-header > p a.ups-link)',
    );

    if (teaserLink && (teaserLink.previousSibling.nodeType !== 3)) {
      ctaWrapper.append(teaserLink);
    }

    const ctaLength = ctaWrapper.querySelectorAll('p').length;
    if (ctaLength === 1) {
      const emptyP = document.createElement('p');
      const emptyA = document.createElement('a');
      emptyA.href = '';
      emptyA.textContent = '';
      emptyP.append(emptyA);
      ctaWrapper.append(emptyP);
    }

    const args = [teaserImg, teaserVideo, teaserBody, ctaWrapper, teaserFooter];
    appendTeaserItems(teaserImageList, args);

    const imagePositionRight = featuredListTeaser.classList.contains('list-right');
    const block = createBlock('Teaser', [[imagePositionRight ? 'img-right' : 'img-left', teaserImageList]], variants);

    if (title) {
      featuredListTeaser.append(title);
    }

    if (description) {
      featuredListTeaser.append(description);
    }

    featuredListTeaser.append(block);

    if (showCheckBox) {
      const sectionMetadata = createBlock('Section Metadata', [['style', 'bullet-check-icon']]);
      block.append(sectionMetadata);
      addSection(sectionMetadata);
    } else {
      addSection(block);
    }
  }
};

export default createTeaser;
