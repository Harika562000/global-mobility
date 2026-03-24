import { loadFragment } from '../fragment/fragment.js';
import { buildStoryCarousel } from '../../scripts/s-and-p-global/s-and-p-carousel.js';

function moveSectionTitleToHeader(block) {
  const section = block.closest('.section');
  if (!section) return;

  const titleBlock = block.querySelector('[data-aue-component="section-title"], .section-title');
  if (!titleBlock) return;

  let headerArea = section.querySelector(':scope > .section-title-wrapper');
  if (!headerArea) {
    headerArea = document.createElement('div');
    headerArea.className = 'section-title-wrapper';
    section.prepend(headerArea);
  }

  headerArea.append(titleBlock);
}

function cleanupEmptyChildren(row) {
  [...row.children].forEach((child) => {
    const hasContent = child.textContent?.trim()
      || child.querySelector('img, picture, svg, video, iframe');
    if (!hasContent) child.remove();
  });
}

function removeEmptyRows(block) {
  [...block.children].forEach((row) => {
    if (!row.children.length && !row.textContent?.trim()) {
      row.remove();
    }
  });
}

function normalizeUEStoryRow(row) {
  row.classList.add('customer-stories-slide');

  const quoteEl = row.querySelector('[data-aue-prop="quote"]')
    || row.querySelector('.customer-stories-quote')
    || row.querySelector('p');
  const imageEl = row.querySelector('[data-aue-prop="authorImage"]')
    || row.querySelector('picture, img');
  const infoEl = row.querySelector('[data-aue-prop="authorInfo"]')
    || row.querySelector('.customer-stories-author-info');

  const quoteWrap = document.createElement('div');
  quoteWrap.className = 'customer-stories-quote';
  if (quoteEl) quoteWrap.append(quoteEl);

  const imageWrap = document.createElement('div');
  imageWrap.className = 'customer-stories-author-image';
  if (imageEl) imageWrap.append(imageEl);

  const infoWrap = document.createElement('div');
  infoWrap.className = 'customer-stories-author-info';
  if (infoEl) infoWrap.append(infoEl);

  const paragraphs = infoWrap.querySelectorAll('p');
  if (paragraphs[0]) paragraphs[0].classList.add('customer-stories-author-name');
  if (paragraphs[1]) paragraphs[1].classList.add('customer-stories-author-role');

  const author = document.createElement('div');
  author.className = 'customer-stories-author';
  author.append(imageWrap, infoWrap);

  row.replaceChildren(quoteWrap, author);
}

function findProductCardsWrapper(block, section) {
  return block.querySelector('.product-cards-wrapper')
    || block.querySelector('.product-cards')?.closest('.product-cards-wrapper')
    || section?.querySelector('.product-cards-wrapper')
    || section?.querySelector('.product-cards')?.closest('.product-cards-wrapper');
}

function attachProductCards(block, section, slides, variant) {
  if (!slides.length) return;
  const wrapper = findProductCardsWrapper(block, section);
  if (!wrapper) return;

  wrapper.remove();

  slides.forEach((slide, index) => {
    const clone = index === 0 ? wrapper : wrapper.cloneNode(true);
    const productCards = clone.querySelector('.product-cards');
    if (productCards) {
      const variantClass = variant || 'product-cards-compact';
      productCards.classList.remove('product-cards-compact', 'product-cards-vertically-stacked');
      productCards.classList.add(variantClass);
      if (!productCards.classList.contains('carousel')
        && !productCards.classList.contains('carousel-mobile')) {
        productCards.classList.add('carousel-mobile');
      }
    }
    slide.append(clone);
  });
}

function applyProductCardsVariant(root, variant) {
  if (!root) return;
  const variantClass = variant || 'product-cards-compact';
  root.querySelectorAll('.product-cards').forEach((productCards) => {
    productCards.classList.remove('product-cards-compact', 'product-cards-vertically-stacked');
    if (variantClass) productCards.classList.add(variantClass);
  });
}

/**
 * Decorate a single 3-column row (quote | image | name+role).
 */
function decorateStoryRow(row) {
  row.classList.add('customer-stories-slide');

  const cells = [...row.children];

  /* Col 1 – quote text */
  if (cells[0]) {
    cells[0].classList.add('customer-stories-quote');
  }

  /* Col 2 – author image */
  if (cells[1]) {
    cells[1].classList.add('customer-stories-author-image');
    const img = cells[1].querySelector('img');
    if (img) img.setAttribute('loading', 'eager');
  }

  /* Col 3 – author info (first <p> = name, second <p> = role) */
  if (cells[2]) {
    cells[2].classList.add('customer-stories-author-info');
    const paragraphs = cells[2].querySelectorAll('p');
    if (paragraphs[0]) paragraphs[0].classList.add('customer-stories-author-name');
    if (paragraphs[1]) paragraphs[1].classList.add('customer-stories-author-role');
  }

  /* Wrap image + info in a shared author container for flex layout */
  if (cells[1] && cells[2]) {
    const author = document.createElement('div');
    author.classList.add('customer-stories-author');
    cells[1].after(author);
    author.append(cells[1], cells[2]);
  }
}

/**
 * Load fragment pages, wrap each in a carousel slide, and init carousel.
 */
async function decorateCarousel(block, variant) {
  const rows = [...block.children];

  /* Collect fragment paths from each row */
  const fragmentPaths = rows.map((row) => {
    const link = row.querySelector('a');
    return link ? link.getAttribute('href') : row.textContent.trim();
  });

  /* Load all fragments in parallel */
  const fragments = await Promise.all(
    fragmentPaths.map((path) => loadFragment(path)),
  );

  /* Build one slide per fragment */
  const slides = [];
  fragments.forEach((fragment) => {
    if (!fragment) return;

    const slide = document.createElement('div');
    slide.classList.add('customer-stories-carousel-slide');

    /* Move every section's children into the slide */
    [...fragment.querySelectorAll(':scope .section')].forEach((section) => {
      /* Preserve wrapper divs so inner blocks keep their styles */
      [...section.children].forEach((wrapper) => slide.append(wrapper));
    });

    /* Move product-cards title into product-cards-wrapper so they stay together */
    const titleWrapper = slide.querySelector('.product-cards-title-wrapper');
    const pcWrapper = slide.querySelector('.product-cards-wrapper');
    if (titleWrapper && pcWrapper) {
      pcWrapper.prepend(titleWrapper);
    }

    slides.push(slide);
  });

  /* Replace block content with the slides */
  block.replaceChildren(...slides);

  applyProductCardsVariant(block, variant);

  /* Force product-cards layout: 2-col at tablet (md), 1-col at desktop (lg/xl) */
  block.querySelectorAll('.product-cards').forEach((pc) => {
    pc.classList.remove(
      'col-md-2',
      'col-md-3',
      'col-lg-2',
      'col-lg-3',
      'col-lg-4',
      'col-xl-1',
      'col-xl-2',
      'col-xl-3',
      'col-xl-4',
    );
    pc.classList.add(
      'col-md-2',
      'col-lg-1',
      'col-xl-1',
    );
  });

  /* Only build carousel when there are 2+ slides */
  if (slides.length >= 2) {
    const nav = buildStoryCarousel(block, slides);

    /* Place nav arrows in section header (top-right, next to "Customer Stories") */
    const section = block.closest('.section');
    if (section) {
      const headerArea = section.querySelector(':scope > .section-title-wrapper')
        || section.querySelector(':scope > .default-content-wrapper');
      if (headerArea) {
        headerArea.classList.add('carousel-header');
        headerArea.append(nav);
      }
    }
  }
}

export default async function decorate(block) {
  const isCarousel = block.classList.contains('carousel')
    || block.classList.contains('carousel-mobile');

  const hasUEItems = block.querySelector('[data-aue-component="customer-story"], [data-aue-component="section-title"]');
  const productCardsVariant = block.dataset.productCardsVariant?.trim();

  if (hasUEItems) {
    moveSectionTitleToHeader(block);
    [...block.children].forEach((row) => cleanupEmptyChildren(row));
    const slides = [...block.children]
      .filter((row) => row.querySelector('[data-aue-component="customer-story"]'));

    slides.forEach((row) => normalizeUEStoryRow(row));

    if (isCarousel && slides.length >= 2) {
      const nav = buildStoryCarousel(block, slides);
      const section = block.closest('.section');
      if (section) {
        const headerArea = section.querySelector(':scope > .section-title-wrapper')
          || section.querySelector(':scope > .default-content-wrapper');
        if (headerArea) {
          headerArea.classList.add('carousel-header');
          headerArea.append(nav);
        }
        attachProductCards(block, section, slides, productCardsVariant);
      }
    } else {
      applyProductCardsVariant(block.closest('.section') || block, productCardsVariant);
    }

    removeEmptyRows(block);

    return;
  }

  if (isCarousel) {
    await decorateCarousel(block, productCardsVariant);
  } else {
    /* Inline mode – each row is a 3-column customer testimonial */
    [...block.children].forEach((row) => decorateStoryRow(row));
    applyProductCardsVariant(block.closest('.section') || block, productCardsVariant);
  }
}
