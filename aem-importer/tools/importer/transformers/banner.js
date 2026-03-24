import { createBlock, addSection, isTelLink } from './util.js';

const createBanner = (main, document) => {
  const banners = main.querySelectorAll('.ups-component.promo-teaser.full-bleed');
  if (!banners.length) return;

  const bannerIncomingClasses = [
    'bg-teal',
    'slim-banner',
    'bg-grey',
    'bg-blue',
    'regular-banner',
  ];

  const bannerVariants = {
    'bg-teal': 'teal',
    'slim-banner': 'skinny',
    'bg-grey': 'gray',
    'bg-blue': 'blue',
    'regular-banner': 'arch',
  };

  banners.forEach((banner) => {
    const variants = bannerIncomingClasses
      .filter((cls) => banner.classList.contains(cls))
      .map(
        (cls) => (bannerVariants[cls] || ''),
      );

    const title = banner.querySelector('.card-header h2') || banner.querySelector('.card-header h3');
    if (title) {
      title.textContent = title?.textContent.trim();
    }
    // const description = banner.querySelector('.card-body .card-body-content p');
    const paragraphs = [...banner.querySelectorAll('.card-body .card-body-content p:not(:has(.ups-cta)):not(:has(small))')].filter(
      /**
       * This breaks banner on https://www.ups.com/ca/en/support/file-a-claim/supporting-documents.page.
       * The below logic ignores desription wrapped in anchor tag.
       * Adding (p.firstChild.tagName === 'A') to the filter to fix this.
       */
      (p) => p.firstChild !== null && (p.firstChild.tagName === 'BR'
        || p.firstChild.nodeType === Node.TEXT_NODE
        || p.firstChild.tagName === 'A'),
    );

    const description = document.createElement('div');
    paragraphs.forEach((p) => {
      description.append(p);
    });
    const links = banner.querySelectorAll('.card-body .card-body-content a.ups-cta');
    const bannerFootnoteSelect = [...banner.querySelectorAll('.card-body .card-body-content p > sup, .card-body .card-body-content p > small, .card-body .card-body-content p > em')].filter(
      (sup) => sup.previousSibling === null || sup.previousSibling.nodeType !== Node.TEXT_NODE,
    );

    let bannerFootNote;
    if (bannerFootnoteSelect.length) {
      bannerFootNote = bannerFootnoteSelect[0].parentNode;
    }

    const promoContainer = document.createElement('div');
    const footNote = document.createElement('div');
    if (title) {
      promoContainer.append(title);
    }
    promoContainer.append(description || '');

    links.forEach((link) => {
      const linkWrapper = document.createElement('p');
      if (isTelLink(link.href)) {
        link.href = `/${link.href}`;
      }
      linkWrapper.append(link);
      promoContainer.append(linkWrapper);
    });

    if (bannerFootNote) {
      if (links.length === 1) {
        const cta2wrapper = document.createElement('p');
        const cta2 = document.createElement('a');
        cta2.textContent = '';
        cta2wrapper.append(cta2);
        promoContainer.append(cta2wrapper);
      }
      const p = document.createElement('p');
      if (bannerFootNote.firstElementChild.tagName === 'SUP') {
        p.innerHTML = bannerFootNote.firstElementChild.innerHTML;
      } else {
        p.innerHTML = bannerFootNote.innerHTML;
      }
      footNote.append(p);
      bannerFootNote.remove();
    }

    const block = createBlock('Banner', [[promoContainer], [footNote]], variants);
    banner.append(block);
    addSection(block);
  });
};

export default createBanner;
