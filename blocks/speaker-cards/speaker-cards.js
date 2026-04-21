import { moveInstrumentation } from '../../scripts/scripts.js';
import { initCarousel } from '../../scripts/s-and-p-global/s-and-p-carousel.js';
import { onBreakpointChange } from '../../scripts/s-and-p-global/utils.js';

function resolveCardLink(linkEl) {
  const rawHref = linkEl?.getAttribute('href')?.trim() || '';
  const titlePath = linkEl?.getAttribute('title')?.trim() || '';

  // Keep authored relative/hash/mailto/tel links untouched.
  if (/^(\/|#|mailto:|tel:)/i.test(rawHref)) {
    return {
      href: rawHref,
      external: false,
    };
  }

  try {
    const url = new URL(linkEl.href, window.location.origin);
    if (titlePath.startsWith('/')) {
      return {
        href: titlePath,
        external: false,
      };
    }
    if (url.origin === window.location.origin) {
      return {
        href: `${url.pathname}${url.search}${url.hash}`,
        external: false,
      };
    }
    return {
      href: url.href,
      external: /^(https?:)?\/\//i.test(url.href),
    };
  } catch {
    return {
      href: linkEl?.href || rawHref || '#',
      external: false,
    };
  }
}

export default async function decorate(block) {
  const isEditor = document.querySelector('html[data-aue-edit]');
  if (isEditor) return;

  const rows = [...block.children];
  if (!rows.length) return;

  const cards = [];

  rows.forEach((row) => {
    const cells = [...row.children];

    let card = document.createElement('div');
    card.className = 'speaker-card';
    moveInstrumentation(row, card);

    // Image
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'speaker-card-image';
    const pic = cells[0]?.querySelector('picture') || cells[0]?.querySelector('img');
    if (pic) {
      imgWrapper.append(pic.closest('picture') || pic);
    } else if (cells[0]) {
      imgWrapper.append(...cells[0].childNodes);
    }
    card.append(imgWrapper);

    // Text content
    const content = document.createElement('div');
    content.className = 'speaker-card-content';

    // Title
    const titleEl = cells[1];
    if (titleEl) {
      const title = document.createElement('h3');
      title.className = 'speaker-card-title';
      title.textContent = titleEl.textContent.trim();
      content.append(title);
    }

    // Description
    const descEl = cells[2];
    if (descEl) {
      const desc = document.createElement('div');
      desc.className = 'speaker-card-description';
      desc.append(...descEl.childNodes);
      content.append(desc);
    }

    card.append(content);

    // Link – if a link is authored, make the whole card a native <a>
    const linkEl = cells[3]?.querySelector('a');
    if (linkEl) {
      const anchor = document.createElement('a');
      const { href, external } = resolveCardLink(linkEl);
      anchor.className = 'speaker-card speaker-card-link';
      anchor.href = href;
      if (linkEl.title) anchor.title = linkEl.title;
      if (external) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
      anchor.append(...card.childNodes);
      card = anchor;
    }

    cards.push(card);
  });

  block.replaceChildren(...cards);

  // Flex-grid layout: 1 col mobile, 2 col 1025px+, 3 col 1440px+
  block.classList.add('flex-grid', 'col-md-3', 'col-lg-2', 'col-xl-3');

  // Carousel on mobile only (< 720px). Tablet shows 3-col grid.
  if (cards.length > 1) {
    let carouselInstance = null;
    onBreakpointChange('(max-width: 719px)', async (isMobile) => {
      if (isMobile && !carouselInstance) {
        carouselInstance = await initCarousel(block, {
          infinite: false,
          showBottomNav: false,
        });
      } else if (!isMobile && carouselInstance) {
        carouselInstance.destroy();
        carouselInstance = null;
      }
    });
  }
}
