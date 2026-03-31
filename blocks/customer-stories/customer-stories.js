import { loadFragment } from '../fragment/fragment.js';
import { buildStoryCarousel } from '../../scripts/s-and-p-global/s-and-p-carousel.js';

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

  const productCardsVariant = block.dataset.productCardsVariant?.trim();

  /* In UE with fragment children, load fragment content inline while
     preserving the outer data-aue-* wrapper so the content tree stays intact */
  const hasUEFragments = block.querySelector('[data-aue-component="fragment"]');
  if (hasUEFragments) {
    const fragmentRows = [...block.querySelectorAll('[data-aue-component="fragment"]')];
    await Promise.all(fragmentRows.map(async (row) => {
      const refEl = row.querySelector('[data-aue-prop="reference"]');
      const path = refEl?.textContent?.trim() || row.textContent?.trim();
      if (!path || !path.startsWith('/')) return;

      let fragment;
      try {
        fragment = await loadFragment(path);
      } catch (e) {
        // loadFragment can throw on AEM author if .plain.html is not available
      }

      if (!fragment) {
        // Show a visible placeholder with the fragment path
        row.classList.add('customer-stories-carousel-slide');
        const placeholder = document.createElement('div');
        placeholder.className = 'customer-stories-fragment-placeholder';
        placeholder.textContent = path.split('/').pop();
        row.prepend(placeholder);
        return;
      }

      // Clear the row content (JCR path text) but keep the row element + its UE attributes
      const savedAttrs = {};
      [...row.attributes].forEach((attr) => { savedAttrs[attr.name] = attr.value; });
      row.innerHTML = '';
      Object.entries(savedAttrs).forEach(([k, v]) => row.setAttribute(k, v));
      row.classList.add('customer-stories-carousel-slide');

      [...fragment.querySelectorAll(':scope .section')].forEach((section) => {
        [...section.children].forEach((wrapper) => row.append(wrapper));
      });

      const storyBlock = row.querySelector('.customer-stories-wrapper .customer-stories');
      let slides = [];
      if (storyBlock) {
        slides = [...storyBlock.querySelectorAll(':scope .customer-stories-slide')];
        const imageSlide = slides[1];
        const nameSlide = slides[2];
        const roleSlide = slides[3];

        if (imageSlide && nameSlide && roleSlide && imageSlide.querySelector('picture, img')) {
          const author = document.createElement('div');
          author.className = 'customer-stories-author-inline';

          imageSlide.classList.replace('customer-stories-slide', 'customer-stories-author-image');
          nameSlide.classList.replace('customer-stories-slide', 'customer-stories-author-name');
          roleSlide.classList.replace('customer-stories-slide', 'customer-stories-author-designation');

          // Remove customer-stories-quote from image, name and designation children
          [imageSlide, nameSlide, roleSlide].forEach((el) => {
            el.querySelectorAll('.customer-stories-quote').forEach((q) => q.classList.remove('customer-stories-quote'));
          });

          const info = document.createElement('div');
          info.className = 'customer-stories-author-inline-info';

          imageSlide.after(author);
          author.append(imageSlide, info);
          info.append(nameSlide, roleSlide);
        }
      }

      // Move "Products we use" label (slides[4] = productTitle field) into product-cards-wrapper
      const pcWrapper = row.querySelector('.product-cards-wrapper');
      if (pcWrapper && slides[4]) {
        const productLabelSlide = slides[4];
        productLabelSlide.classList.replace('customer-stories-slide', 'product-cards-label');
        // Remove inherited customer-stories-quote from the label
        productLabelSlide.querySelectorAll('.customer-stories-quote').forEach((q) => q.classList.remove('customer-stories-quote'));
        pcWrapper.prepend(productLabelSlide);
      }

      // Remove empty customer-story placeholder slides (no real content)
      if (storyBlock) {
        storyBlock.querySelectorAll(':scope > [data-aue-component="customer-story"]').forEach((el) => {
          if (!el.textContent?.trim() && !el.querySelector('img, picture, svg, video, iframe')) {
            el.remove();
          }
        });
      }

      // Move product-cards title into product-cards-wrapper so they stay together
      const titleWrapper = row.querySelector('.product-cards-title-wrapper');
      if (titleWrapper && pcWrapper) {
        pcWrapper.prepend(titleWrapper);
      }
    }));

    // Remove empty non-fragment rows (e.g. empty eyebrow placeholder)
    [...block.children].forEach((row) => {
      if (!row.hasAttribute('data-aue-component') && !row.textContent?.trim()
        && !row.querySelector('img, picture, svg, video, iframe')) {
        row.remove();
      }
    });

    // Build carousel when 2+ fragments are present
    if (fragmentRows.length >= 2) {
      const nav = buildStoryCarousel(block, fragmentRows);
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
    return;
  }

  /* Detect fragment-based authoring: any row whose only content is a link */
  const hasFragmentRows = [...block.children].some((row) => {
    const a = row.querySelector('a');
    return a && row.textContent.trim() === a.textContent.trim();
  });

  if (isCarousel || hasFragmentRows) {
    await decorateCarousel(block, productCardsVariant);
  } else {
    /* Inline mode – each row is a 3-column customer testimonial */
    [...block.children].forEach((row) => decorateStoryRow(row));
    applyProductCardsVariant(block.closest('.section') || block, productCardsVariant);
  }
}
