import { loadFragment } from '../fragment/fragment.js';
import { buildStoryCarousel } from '../../scripts/s-and-p-global/s-and-p-carousel.js';
import { eyebrowDecorator, moveInstrumentation } from '../../scripts/scripts.js';

function applyProductCardsVariant(root, variant) {
  if (!root) return;
  const variantClass = variant || 'product-cards-compact';
  root.querySelectorAll('.product-cards').forEach((productCards) => {
    productCards.classList.remove('product-cards-compact', 'product-cards-vertically-stacked');
    if (variantClass) productCards.classList.add(variantClass);
  });
}

/**
 * Bundles that imported whole fragment sections could leave section chrome (e.g.
 * `.section-title-wrapper`) inside `.product-cards-wrapper`. That is never valid here.
 * Removes it so stage/dev parity issues or cached scripts do not leave duplicate headers.
 * Does not touch `moveInstrumentation` targets on the block rows.
 */
function removeMisplacedSectionChromeInProductCards(block) {
  block.querySelectorAll('.product-cards-wrapper .section-title-wrapper').forEach((el) => {
    el.remove();
  });
}

/**
 * Get a field element from a child-item row by prop name or cell index.
 * UE authoring renders fields with data-aue-prop (most types) or
 * data-richtext-prop (richtext fields). The prop attribute may also appear
 * on a deeply nested element (e.g. data-aue-prop="image" on the <img> tag),
 * so we always walk up to the direct child of the row.
 * Publish mode uses cell order as a fallback.
 */
function getField(row, propName, cellIndex) {
  const el = row.querySelector(`[data-aue-prop="${propName}"]`)
    || row.querySelector(`[data-richtext-prop="${propName}"]`);
  if (el) {
    // Walk up to the direct child of row so callers get the wrapper div
    let target = el;
    while (target.parentElement && target.parentElement !== row) {
      target = target.parentElement;
    }
    return target;
  }
  // Only use index fallback in publish mode (no UE attributes present).
  // In UE mode, missing fields shift indices so index lookup is unreliable.
  const isUEMode = row.querySelector('[data-aue-prop], [data-richtext-prop]');
  if (!isUEMode) {
    return row.children[cellIndex] || null;
  }
  return null;
}

/**
 * Locate the product-fragment cell inside a child-item row.
 * aem-content fields do not emit a data-aue-prop wrapper in UE, so we
 * look for the last child that contains an anchor pointing to a content path.
 */
function getFragmentCell(row) {
  // Try explicit prop first (future-proof)
  const propEl = row.querySelector('[data-aue-prop="productFragment"]');
  if (propEl) {
    let target = propEl;
    while (target.parentElement && target.parentElement !== row) {
      target = target.parentElement;
    }
    return target;
  }
  // Scan children from the end — fragment anchor contains "/fragments/" or "/content/"
  const children = [...row.children];
  for (let i = children.length - 1; i >= 0; i -= 1) {
    const a = children[i].querySelector('a');
    if (a) {
      const href = a.getAttribute('href') || '';
      if (href.includes('/fragments/') || href.includes('/content/')) {
        return children[i];
      }
    }
  }
  // Last resort: fixed index
  return row.children[5] || null;
}

/** Same cell pick as section-title.js (two-column UE vs single cell). */
function getEyebrowValueCell(row) {
  if (!row) return null;
  return row.children.length > 1 ? row.children[1] : row.children[0] || row;
}

/**
 * Block-level eyebrow (row 1 in the block model) vs customer-story rows (quote, author, …).
 * Uses the same detection as section-title: explicit `eyebrow` prop,
 * else first row with fewer than three cells.
 * Decorated output matches section-title.js:
 * eyebrowDecorator(..., 'accent-color margin-bottom-400').
 */
function splitEyebrowAndStoryRows(rows) {
  if (!rows.length) return { eyebrowText: '', storyRows: rows };
  const first = rows[0];
  const eyebrowField = getField(first, 'eyebrow', 0);
  if (eyebrowField) {
    const text = eyebrowField.textContent?.trim() || '';
    return { eyebrowText: text, storyRows: rows.slice(1), eyebrowSourceRow: first };
  }
  const second = rows[1];
  const looksLikeBlockLevelEyebrow = first.children.length < 3
    && !!second
    && second.children.length >= 3;
  if (looksLikeBlockLevelEyebrow) {
    const cell = getEyebrowValueCell(first);
    const scope = cell || first;
    const p = scope.querySelector('p');
    const text = (p?.textContent?.trim() || scope.textContent?.trim() || '').trim();
    return { eyebrowText: text, storyRows: rows.slice(1), eyebrowSourceRow: first };
  }
  return { eyebrowText: '', storyRows: rows, eyebrowSourceRow: null };
}

/**
 * Prepend the same header shell as logo-set / section-title so .section-title-wrapper exists
 * for carousel nav and existing customer-stories-container styles.
 */
function prependBlockEyebrowToSection(section, eyebrowText, eyebrowSourceRow = null) {
  const text = (eyebrowText || '').trim();
  if (!section || !text) return;
  const existingWrapper = section.querySelector(':scope > .section-title-wrapper');
  if (existingWrapper) {
    // In UE, block re-decoration can run multiple times; update existing eyebrow text in place.
    const existingEyebrow = existingWrapper.querySelector('.eye-brow-text');
    if (existingEyebrow) existingEyebrow.textContent = text;
    return;
  }

  const formatted = eyebrowDecorator(text, 'accent-color margin-bottom-400');
  if (!formatted) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'section-title-wrapper';

  const sectionTitleBlock = document.createElement('div');
  sectionTitleBlock.className = 'section-title block';
  sectionTitleBlock.dataset.blockName = 'section-title';
  sectionTitleBlock.dataset.blockStatus = 'loaded';
  if (eyebrowSourceRow) moveInstrumentation(eyebrowSourceRow, sectionTitleBlock);

  const row = document.createElement('div');
  const col = document.createElement('div');
  col.append(formatted);
  row.append(col);
  sectionTitleBlock.append(row);
  wrapper.append(sectionTitleBlock);
  section.prepend(wrapper);
}

/**
 * Build a structured slide DOM from a customer-story child item row.
 *
 * Child-item model field order:
 *   [0] quote (richtext)
 *   [1] authorName (text)
 *   [2] designation (text)
 *   [3] image (reference)
 *   [4] productLabel (text)
 *   [5] productFragment (aem-content)
 */
function buildSlide(row) {
  const slide = document.createElement('div');
  slide.classList.add('customer-stories-carousel-slide');
  moveInstrumentation(row, slide);

  /* ---- Testimonial wrapper (quote + author) ---- */
  const storyWrapper = document.createElement('div');
  storyWrapper.classList.add('customer-stories-wrapper');

  const storyInner = document.createElement('div');
  storyInner.classList.add('customer-stories');

  // Quote
  const quoteCell = getField(row, 'quote', 0);
  const quoteEl = document.createElement('div');
  quoteEl.classList.add('customer-stories-quote');
  if (quoteCell) {
    // Preserve richtext HTML (may contain <p>, <strong>, etc.)
    [...quoteCell.childNodes].forEach((node) => quoteEl.append(node.cloneNode(true)));
  }
  storyInner.append(quoteEl);

  // Author inline container (image + name + designation)
  const authorInline = document.createElement('div');
  authorInline.classList.add('customer-stories-author-inline');

  const nameCell = getField(row, 'authorName', 1);
  const authorNameText = nameCell?.textContent?.trim() || '';

  // Author image
  const imageCell = getField(row, 'image', 3);
  const authorImage = document.createElement('div');
  authorImage.classList.add('customer-stories-author-image');
  if (imageCell) {
    // imageCell may be the wrapper <div> or the <img> itself (UE puts prop on <img>)
    const picture = imageCell.tagName === 'PICTURE' ? imageCell
      : imageCell.querySelector('picture') || imageCell.closest?.('picture');
    const img = imageCell.tagName === 'IMG' ? imageCell
      : imageCell.querySelector('img');
    if (picture) {
      authorImage.append(picture.cloneNode(true));
    } else if (img) {
      authorImage.append(img.cloneNode(true));
    }
    const imgEl = authorImage.querySelector('img');
    if (imgEl) {
      imgEl.setAttribute('loading', 'eager');
      if (!(imgEl.getAttribute('alt') || '').trim() && authorNameText) {
        imgEl.setAttribute('alt', `Portrait of ${authorNameText}`);
      }
    }
  }

  // Author info (name + designation)
  const authorInfo = document.createElement('div');
  authorInfo.classList.add('customer-stories-author-inline-info');
  const authorName = document.createElement('div');
  authorName.classList.add('customer-stories-author-name');
  if (nameCell) {
    const p = document.createElement('p');
    p.textContent = authorNameText;
    authorName.append(p);
  }

  const designationCell = getField(row, 'designation', 2);
  const authorDesignation = document.createElement('div');
  authorDesignation.classList.add('customer-stories-author-designation');
  if (designationCell) {
    const p = document.createElement('p');
    p.textContent = designationCell.textContent.trim();
    authorDesignation.append(p);
  }

  authorInfo.append(authorName, authorDesignation);
  authorInline.append(authorImage, authorInfo);
  storyInner.append(authorInline);
  storyWrapper.append(storyInner);
  slide.append(storyWrapper);

  /* ---- Extract product label and fragment reference ---- */
  const productLabelCell = getField(row, 'productLabel', 4);
  const productLabel = productLabelCell?.textContent?.trim() || '';

  const fragmentCell = getFragmentCell(row);
  const fragmentLink = fragmentCell?.querySelector('a');
  let fragmentRef = fragmentLink?.getAttribute('href') || fragmentCell?.textContent?.trim() || '';
  // Normalise: loadFragment appends .plain.html, so strip any trailing .html
  if (fragmentRef.endsWith('.html')) {
    fragmentRef = fragmentRef.slice(0, -5);
  }

  return { slide, productLabel, fragmentRef };
}

/**
 * Load a product fragment and append its content into the slide's product-cards wrapper.
 */
async function loadProductSection(slide, productLabel, fragmentRef) {
  const pcWrapper = document.createElement('div');
  pcWrapper.classList.add('product-cards-wrapper');

  // Product section label (e.g. "Products we use")
  if (productLabel) {
    const labelDiv = document.createElement('div');
    labelDiv.classList.add('product-cards-label');
    const p = document.createElement('p');
    p.textContent = productLabel;
    labelDiv.append(p);
    pcWrapper.append(labelDiv);
  }

  if (fragmentRef && fragmentRef.startsWith('/')) {
    try {
      const fragment = await loadFragment(fragmentRef);
      if (fragment) {
        [...fragment.querySelectorAll(':scope .section')].forEach((section) => {
          [...section.children].forEach((wrapper) => {
            const firstBlock = wrapper.firstElementChild;
            // Only the column whose first block is product-cards — avoids pulling in sibling
            // section-title / customer-stories wrappers from the same fragment section.
            if (firstBlock?.classList?.contains('product-cards')) {
              pcWrapper.append(wrapper);
            }
          });
        });
      }
    } catch {
      // Fragment load failed — show a visible placeholder
      const placeholder = document.createElement('div');
      placeholder.className = 'customer-stories-fragment-placeholder';
      placeholder.textContent = fragmentRef.split('/').pop();
      pcWrapper.append(placeholder);
    }
  }

  // Strip product-cards carousel — cards should stack vertically inside customer stories
  pcWrapper.querySelectorAll('.product-cards').forEach((pc) => {
    pc.classList.remove('carousel', 'carousel-mobile', 'carousel-infinite', 'carousel-initialized');
    pc.removeAttribute('role');
    pc.removeAttribute('aria-roledescription');
    pc.removeAttribute('aria-label');
    pc.querySelectorAll('.carousel-footer, .carousel-nav, .carousel-bottom-nav, .carousel-dots').forEach((el) => el.remove());
    const inner = pc.querySelector('.carousel-track-inner') || pc.querySelector('.carousel-inner');
    const track = pc.querySelector('.carousel-track');
    if (inner) {
      [...inner.children].forEach((child) => {
        child.removeAttribute('aria-hidden');
        pc.append(child);
      });
    }
    if (track) track.remove();
  });

  // Only append if we have label or loaded content
  if (pcWrapper.children.length > 0) {
    slide.append(pcWrapper);
  }
}

export default async function decorate(block) {
  const productCardsVariant = block.dataset.productCardsVariant?.trim();
  const allRows = [...block.children];
  const {
    eyebrowText,
    storyRows,
    eyebrowSourceRow,
  } = splitEyebrowAndStoryRows(allRows);

  // Build structured slides from each customer-story child item (skip block-level eyebrow row)
  const slideData = storyRows
    .filter((row) => row.children.length >= 3) // Skip empty/invalid rows
    .map((row) => buildSlide(row));

  // Load product fragments in parallel
  await Promise.all(
    slideData.map((data) => loadProductSection(
      data.slide,
      data.productLabel,
      data.fragmentRef,
    )),
  );

  // Replace block content with the decorated slides
  const slides = slideData.map(({ slide }) => slide);
  block.replaceChildren(...slides);

  prependBlockEyebrowToSection(block.closest('.section'), eyebrowText, eyebrowSourceRow);

  removeMisplacedSectionChromeInProductCards(block);

  applyProductCardsVariant(block, productCardsVariant);

  // Force product-cards to single-column layout inside customer stories
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
    pc.classList.add('col-md-2', 'col-lg-1', 'col-xl-1');
  });

  // Build carousel navigation when 2+ slides are present
  if (slides.length >= 2) {
    const nav = buildStoryCarousel(block, slides);
    const track = block.querySelector('.cs-carousel-track');
    if (track) {
      track.setAttribute('role', 'region');
      track.setAttribute('aria-roledescription', 'carousel');
      track.setAttribute('aria-label', 'Customer stories');
    }
    const section = block.closest('.section');

    if (section?.classList.contains('bg-dark')) {
      nav.querySelectorAll('.carousel-btn').forEach((btn) => btn.classList.add('inverted'));
    }

    if (section) {
      const headerArea = section.querySelector(':scope > .section-title-wrapper')
        || section.querySelector(':scope > .default-content-wrapper');
      if (headerArea) {
        headerArea.classList.add('carousel-header');
        headerArea.append(nav);
      }
    }

    // Mobile dot pagination (hidden on desktop, visible on mobile).
    // Use role="group" + aria-current, not tablist/tab.
    // Tablist semantics require tabpanels and trigger ARIA violations in audits.
    const dots = document.createElement('div');
    dots.className = 'cs-carousel-dots';
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Slide indicators');
    slides.forEach((_, idx) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `cs-carousel-dot${idx === 0 ? ' active' : ''}`;
      dot.dataset.slide = idx;
      dot.setAttribute('aria-label', `Go to slide ${idx + 1} of ${slides.length}`);
      if (idx === 0) dot.setAttribute('aria-current', 'true');
      dots.append(dot);
    });
    block.append(dots);

    // Helper to update dot active state
    const inner = block.querySelector('.cs-carousel-inner');
    const setActiveDot = (activeIdx) => {
      dots.querySelectorAll('.cs-carousel-dot').forEach((d, i) => {
        d.classList.toggle('active', i === activeIdx);
        if (i === activeIdx) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
    };

    // Sync dots when arrows or swipe change the slide (observe transform)
    if (inner) {
      const syncDots = () => {
        const match = (inner.style.transform || '').match(/translateX\((-?[\d.]+)px\)/);
        const offset = match ? Math.abs(parseFloat(match[1])) : 0;
        let activeIdx = 0;
        for (let i = slides.length - 1; i >= 0; i -= 1) {
          if (slides[i].offsetLeft <= offset + 10) {
            activeIdx = i;
            break;
          }
        }
        setActiveDot(activeIdx);
      };
      const observer = new MutationObserver(syncDots);
      observer.observe(inner, { attributes: true, attributeFilter: ['style'] });
    }

    // Dot click navigates the carousel
    dots.addEventListener('click', (e) => {
      const dot = e.target.closest('.cs-carousel-dot');
      if (!dot || !inner) return;
      const idx = parseInt(dot.dataset.slide, 10);
      const target = slides[idx];
      if (target) {
        setActiveDot(idx);
        inner.style.transition = 'transform 0.45s ease';
        inner.style.transform = `translateX(-${target.offsetLeft}px)`;
      }
    });
  }
}
