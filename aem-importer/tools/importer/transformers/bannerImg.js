/* eslint-disable no-restricted-syntax */
import { createBlock, addSection } from './util.js';
import fetchDeliveryUrl from '../integrations/search.js';

const createImgBanner = async (main, document) => {
  const banners = main.querySelectorAll('.ups-component.promo-teaser.secondary-promo-banner.img-right');
  if (!banners.length) return;

  const bannerIncomingClasses = [
    'bg-teal',
    'slim-banner',
    'bg-grey',
    'bg-blue',
    'regular-banner',
    'img-left',
  ];

  const bannerVariants = {
    'bg-teal': 'teal',
    'slim-banner': 'skinny',
    'bg-grey': 'gray',
    'bg-blue': 'blue',
    'regular-banner': 'arch',
    'img-left': 'img left',
  };

  for (const banner of banners) {
    const variants = bannerIncomingClasses
      .filter((cls) => banner.classList.contains(cls))
      .map(
        (cls) => (bannerVariants[cls] || ''),
      );

    // The incoming document doesn't seem to contain slim-banner class
    // but our implementation has made this mandatory
    if (!variants.includes('skinny')) {
      variants.push('skinny');
    }

    const title = banner.querySelector('.card-header h2') || banner.querySelector('.card-header h3');
    title.textContent = title?.textContent.trim();

    const bannerImg = banner.querySelector('.card-img img');
    if (bannerImg) {
      // eslint-disable-next-line no-await-in-loop
      bannerImg.src = bannerImg.src ? await fetchDeliveryUrl(bannerImg.src.split('/').pop(), bannerImg.src) : '';
    }

    const description = banner.querySelector('.card-body .card-body-content p');
    const link = banner.querySelector('.card-body .card-body-content a');
    const promoContainer = document.createElement('div');
    promoContainer.append(bannerImg, title, description, link);

    const block = createBlock('Banner', [[promoContainer]], variants);
    banner.append(block);
    addSection(block);
  }
};

export default createImgBanner;
