import { loadCSS } from '../aem.js';
import { onMobileBreakpointChange } from './utils.js';

let cssReady;
function ensureStyles() {
  if (!cssReady) {
    cssReady = loadCSS(
      `${window.hlx.codeBasePath}/styles/s-and-p-global/s-and-p-carousel.css`,
    );
  }
  return cssReady;
}

/* ---- Shared icon helper ---- */

function createIcon(name) {
  const span = document.createElement('span');
  span.className = `icon icon-${name}`;
  span.setAttribute('aria-hidden', 'true');
  span.setAttribute('role', 'presentation');

  const img = document.createElement('img');
  img.dataset.iconName = name;
  img.src = `/icons/${name}.svg`;
  img.alt = '';
  img.loading = 'lazy';
  span.append(img);
  return span;
}

let carouselCounter = 0;

/**
 * Mark off-screen slides as aria-hidden and pull their focusable
 * children out of the tab order.
 */
function updateSlideVisibility(items, currentIdx, visibleCount) {
  items.forEach((item, idx) => {
    const isVisible = idx >= currentIdx
      && idx < currentIdx + visibleCount;
    item.setAttribute('aria-hidden', String(!isVisible));

    const focusable = item.querySelectorAll(
      'a, button, input, select, textarea, [tabindex]',
    );
    focusable.forEach((el) => {
      if (isVisible) el.removeAttribute('tabindex');
      else el.setAttribute('tabindex', '-1');
    });
  });
}

/**
 * Remove carousel ARIA attributes from items.
 */
function clearSlideAttributes(items) {
  items.forEach((item) => {
    delete item.dataset.slideIndex;
    item.removeAttribute('role');
    item.removeAttribute('aria-roledescription');
    item.removeAttribute('aria-label');
    item.removeAttribute('aria-hidden');

    item.querySelectorAll(
      'a, button, input, select, textarea, [tabindex]',
    ).forEach((el) => el.removeAttribute('tabindex'));
  });
}

/**
 * Build the carousel DOM and wire up all behaviour.
 * Returns a destroy function to tear everything down.
 */
function buildCarousel(container, items, opts) {
  const { infinite, showBottomNav } = opts;

  carouselCounter += 1;
  const carouselId = carouselCounter;

  container.classList.add('carousel-initialized');
  container.setAttribute('role', 'region');
  container.setAttribute('aria-roledescription', 'carousel');
  if (!container.getAttribute('aria-label')) {
    container.setAttribute('aria-label', 'Carousel');
  }

  /* AbortController for easy listener cleanup */
  const ac = new AbortController();
  const { signal } = ac;

  /* ---- Track (viewport) + inner (moving strip) ---- */
  const track = document.createElement('div');
  track.className = 'carousel-track';
  track.id = `carousel-track-${carouselId}`;
  track.setAttribute('aria-live', 'polite');

  const inner = document.createElement('div');
  inner.className = 'carousel-track-inner';

  items.forEach((item, idx) => {
    item.dataset.slideIndex = idx;
    item.setAttribute('role', 'group');
    item.setAttribute('aria-roledescription', 'slide');
    item.setAttribute(
      'aria-label',
      `Slide ${idx + 1} of ${items.length}`,
    );
    inner.append(item);
  });
  track.append(inner);

  /* ---- Helper to create a pair of arrow buttons ---- */
  function createNavButtons(label) {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute('aria-label', label);

    // Create previous button with new structure
    const prevContainer = document.createElement('p');
    prevContainer.className = 'button-container';

    const prevEm = document.createElement('em');

    const prev = document.createElement('a');
    prev.href = '#';
    prev.className = 'button secondary icon-only carousel-btn carousel-prev';
    prev.setAttribute('title', 'Previous slide');
    prev.setAttribute('aria-label', 'Previous slide');
    prev.setAttribute('aria-controls', track.id);
    prev.append(createIcon('arrow-left'));

    prevEm.append(prev);
    prevContainer.append(prevEm);

    // Create next button with new structure
    const nextContainer = document.createElement('p');
    nextContainer.className = 'button-container';

    const nextEm = document.createElement('em');

    const next = document.createElement('a');
    next.href = '#';
    next.className = 'button secondary icon-only carousel-btn carousel-next';
    next.setAttribute('title', 'Next slide');
    next.setAttribute('aria-label', 'Next slide');
    next.setAttribute('aria-controls', track.id);
    next.append(createIcon('arrow-right'));

    nextEm.append(next);
    nextContainer.append(nextEm);

    wrapper.append(prevContainer, nextContainer);
    return { wrapper, prev, next };
  }

  /* ---- Top navigation arrows (moves to header on desktop) ---- */
  const topNav = createNavButtons('Carousel navigation');
  const nav = topNav.wrapper;
  nav.className = 'carousel-nav';
  const prevBtn = topNav.prev;
  const nextBtn = topNav.next;

  /* ---- Bottom navigation arrows (desktop only, opt-in) ---- */
  let bottomNavEl = null;
  let bottomNav = null;
  if (showBottomNav) {
    bottomNavEl = createNavButtons('Carousel navigation');
    bottomNav = bottomNavEl.wrapper;
    bottomNav.className = 'carousel-bottom-nav';
  }

  /* ---- Dot indicators ---- */
  const dots = document.createElement('div');
  dots.className = 'carousel-dots';
  dots.setAttribute('role', 'tablist');
  dots.setAttribute('aria-label', 'Slide indicators');

  items.forEach((_, idx) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot';
    dot.dataset.slide = idx;
    dot.setAttribute('role', 'tab');
    dot.setAttribute(
      'aria-label',
      `Slide ${idx + 1} of ${items.length}`,
    );
    dot.setAttribute('aria-selected', String(idx === 0));
    if (idx === 0) dot.classList.add('active');
    dots.append(dot);
  });

  /* ---- Assemble ---- */
  container.append(nav, track, dots);

  /* ---- State ---- */
  let currentIndex = 0;
  let isDragging = false;

  function getVisibleCount() {
    if (!items[0] || !track.offsetWidth) return 1;
    const trackW = track.offsetWidth;
    const style = getComputedStyle(inner);
    const gap = parseFloat(style.columnGap)
      || parseFloat(style.gap) || 0;
    const itemW = items[0].offsetWidth + gap;
    return Math.max(1, Math.round(trackW / itemW));
  }

  function maxIndex() {
    return Math.max(0, items.length - 1);
  }

  function updateDots() {
    dots.querySelectorAll('.carousel-dot').forEach((d, i) => {
      d.classList.toggle('active', i === currentIndex);
      d.setAttribute('aria-selected', String(i === currentIndex));
    });
  }

  function updateNav() {
    const atStart = currentIndex <= 0;
    const atEnd = currentIndex >= maxIndex();

    // Use classList for anchor tags instead of disabled property
    if (infinite) {
      prevBtn.classList.remove('disabled');
      nextBtn.classList.remove('disabled');
      prevBtn.removeAttribute('aria-disabled');
      nextBtn.removeAttribute('aria-disabled');
    } else {
      prevBtn.classList.toggle('disabled', atStart);
      nextBtn.classList.toggle('disabled', atEnd);
      prevBtn.setAttribute('aria-disabled', String(atStart));
      nextBtn.setAttribute('aria-disabled', String(atEnd));
    }

    if (bottomNavEl) {
      if (infinite) {
        bottomNavEl.prev.classList.remove('disabled');
        bottomNavEl.next.classList.remove('disabled');
        bottomNavEl.prev.removeAttribute('aria-disabled');
        bottomNavEl.next.removeAttribute('aria-disabled');
      } else {
        bottomNavEl.prev.classList.toggle('disabled', atStart);
        bottomNavEl.next.classList.toggle('disabled', atEnd);
        bottomNavEl.prev.setAttribute('aria-disabled', String(atStart));
        bottomNavEl.next.setAttribute('aria-disabled', String(atEnd));
      }
    }
  }

  function updateActiveCard() {
    items.forEach((item, idx) => {
      item.classList.toggle('active', idx === currentIndex);
    });
  }

  function slideTo(idx, animate) {
    const shouldAnimate = animate !== false;
    let targetIdx = idx;
    const max = maxIndex();

    if (infinite) {
      if (targetIdx < 0) targetIdx = max;
      else if (targetIdx > max) targetIdx = 0;
    }

    currentIndex = Math.max(0, Math.min(targetIdx, max));
    const target = items[currentIndex];
    if (target) {
      inner.style.transition = shouldAnimate
        ? 'transform 0.5s ease' : 'none';
      inner.style.transform = `translateX(-${target.offsetLeft}px)`;
    }

    updateActiveCard();
    updateDots();
    updateNav();
    updateSlideVisibility(items, currentIndex, getVisibleCount());
  }

  /* ---- Button listeners ---- */
  const onPrev = (e) => {
    e.preventDefault();
    if (!e.currentTarget.classList.contains('disabled')) {
      slideTo(currentIndex - 1);
    }
  };
  const onNext = (e) => {
    e.preventDefault();
    if (!e.currentTarget.classList.contains('disabled')) {
      slideTo(currentIndex + 1);
    }
  };

  prevBtn.addEventListener('click', onPrev, { signal });
  nextBtn.addEventListener('click', onNext, { signal });

  if (bottomNavEl) {
    bottomNavEl.prev.addEventListener('click', onPrev, { signal });
    bottomNavEl.next.addEventListener('click', onNext, { signal });
  }

  dots.addEventListener('click', (e) => {
    const dot = e.target.closest('.carousel-dot');
    if (dot) slideTo(parseInt(dot.dataset.slide, 10));
  }, { signal });

  /* ---- Keyboard: arrow keys ---- */
  container.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      slideTo(currentIndex - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      slideTo(currentIndex + 1);
    }
  }, { signal });

  /* ---- Drag interaction (mouse + touch) ---- */
  let dragStartX = 0;
  let dragStartY = 0;
  let baseOffset = 0;
  let hasMoved = false;
  const DRAG_THRESHOLD = 5;

  function getBaseOffset() {
    const target = items[currentIndex];
    return target ? target.offsetLeft : 0;
  }

  function onDragStart(clientX, clientY) {
    isDragging = true;
    hasMoved = false;
    dragStartX = clientX;
    dragStartY = clientY;
    baseOffset = getBaseOffset();
    inner.style.transition = 'none';
    track.style.cursor = 'grabbing';
  }

  function onDragMove(clientX, clientY) {
    if (!isDragging) return;
    const dx = clientX - dragStartX;
    const dy = clientY - dragStartY;

    if (!hasMoved && Math.abs(dx) < DRAG_THRESHOLD) return;
    if (!hasMoved && Math.abs(dy) > Math.abs(dx)) {
      isDragging = false;
      track.style.cursor = '';
      return;
    }

    hasMoved = true;
    inner.style.transform = `translateX(${-baseOffset + dx}px)`;
  }

  function onDragEnd(clientX) {
    if (!isDragging) return;
    isDragging = false;
    track.style.cursor = '';

    if (!hasMoved) return;

    const dx = clientX - dragStartX;
    const itemW = items[0] ? items[0].offsetWidth : 1;
    const slidesMoved = Math.round(Math.abs(dx) / (itemW * 0.3));
    const direction = dx > 0 ? -1 : 1;

    if (Math.abs(dx) > 30 && slidesMoved > 0) {
      slideTo(currentIndex + direction * slidesMoved);
    } else {
      slideTo(currentIndex);
    }
  }

  /* Mouse drag */
  track.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    onDragStart(e.clientX, e.clientY);
  }, { signal });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    onDragMove(e.clientX, e.clientY);
  }, { signal });

  window.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    onDragEnd(e.clientX);
  }, { signal });

  /* Touch drag */
  track.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    onDragStart(touch.clientX, touch.clientY);
  }, { passive: true, signal });

  track.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    onDragMove(touch.clientX, touch.clientY);
    if (hasMoved) e.preventDefault();
  }, { passive: false, signal });

  track.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    const touch = e.changedTouches[0];
    onDragEnd(touch.clientX);
  }, { passive: true, signal });

  /* Prevent click after drag */
  track.addEventListener('click', (e) => {
    if (hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      hasMoved = false;
    }
  }, { capture: true, signal });

  /* ---- Resize: recalculate position ---- */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => slideTo(currentIndex, false), 150);
  }, { signal });

  /* ---- Initial render ---- */
  slideTo(0, false);

  /* ---- Destroy function ---- */
  function destroy() {
    ac.abort();
    clearTimeout(resizeTimer);

    // Move items back to the container
    items.forEach((item) => container.append(item));

    // Remove carousel DOM elements
    nav.remove();
    if (bottomNav) bottomNav.remove();
    track.remove();
    dots.remove();

    // Remove classes & ARIA
    container.classList.remove('carousel-initialized');
    container.removeAttribute('role');
    container.removeAttribute('aria-roledescription');
    container.removeAttribute('aria-label');
    items.forEach((item) => item.classList.remove('active'));
    clearSlideAttributes(items);
  }

  return {
    track, nav, bottomNav, dots, destroy,
  };
}

/**
 * Convert a container's direct children into a transform-based
 * carousel with smooth slide transitions and drag support.
 *
 * Variants (pass via options or add class to the block):
 *  - carousel          — active on both desktop and mobile
 *  - carousel-mobile   — JS only renders on mobile; stacked on desktop
 *  - carousel-infinite — loops from last→first and first→last
 *
 * @param {HTMLElement} container  Element whose children become slides
 * @param {{ infinite?: boolean, mobileOnly?: boolean, showBottomNav?: boolean }} [opts]
 * @returns {Promise<{
 *   track: HTMLElement, nav: HTMLElement,
 *   bottomNav?: HTMLElement, dots: HTMLElement
 * }|null>}
 */
/* ---- Lightweight arrow-only carousel (no dots, always-visible arrows) ---- */

function createArrowButton(direction) {
  const container = document.createElement('p');
  container.className = 'button-container';
  const em = document.createElement('em');
  const a = document.createElement('a');
  a.href = '#';
  a.className = `button secondary icon-only carousel-btn carousel-${direction}`;
  a.setAttribute('title', `${direction === 'prev' ? 'Previous' : 'Next'} slide`);
  a.setAttribute(
    'aria-label',
    `${direction === 'prev' ? 'Previous' : 'Next'} slide`,
  );
  a.append(createIcon(direction === 'prev' ? 'arrow-left' : 'arrow-right'));
  em.append(a);
  container.append(em);
  return { container, btn: a };
}

/**
 * Build a simple transform-based carousel with prev/next arrows.
 * Arrows are always visible on every viewport (no dots, no bottom nav).
 *
 * @param {HTMLElement} block   The container element
 * @param {HTMLElement[]} slides  Array of slide elements
 * @returns {HTMLElement} The nav element containing prev/next arrows
 */
export function buildStoryCarousel(block, slides) {
  const track = document.createElement('div');
  track.className = 'cs-carousel-track';

  const inner = document.createElement('div');
  inner.className = 'cs-carousel-inner';

  slides.forEach((slide, idx) => {
    slide.dataset.slideIndex = idx;
    inner.append(slide);
  });
  track.append(inner);

  /* Arrows */
  const prev = createArrowButton('prev');
  const next = createArrowButton('next');
  const nav = document.createElement('div');
  nav.className = 'cs-carousel-nav';
  nav.setAttribute('role', 'group');
  nav.setAttribute('aria-label', 'Carousel navigation');
  nav.append(prev.container, next.container);

  block.append(track);

  /* State */
  let current = 0;

  function updateNav() {
    prev.btn.classList.toggle('disabled', current <= 0);
    next.btn.classList.toggle('disabled', current >= slides.length - 1);
    prev.btn.setAttribute(
      'aria-disabled',
      String(current <= 0),
    );
    next.btn.setAttribute(
      'aria-disabled',
      String(current >= slides.length - 1),
    );
  }

  function slideTo(idx, animate) {
    current = Math.max(0, Math.min(idx, slides.length - 1));
    const target = slides[current];
    if (target) {
      inner.style.transition = animate !== false ? 'transform 0.45s ease' : 'none';
      inner.style.transform = `translateX(-${target.offsetLeft}px)`;
    }
    updateNav();
  }

  prev.btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (current > 0) slideTo(current - 1);
  });
  next.btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (current < slides.length - 1) slideTo(current + 1);
  });

  /* Touch / drag support */
  let startX = 0;
  let dragging = false;
  let moved = false;
  let base = 0;

  track.addEventListener('touchstart', (e) => {
    dragging = true;
    moved = false;
    startX = e.touches[0].clientX;
    base = slides[current] ? slides[current].offsetLeft : 0;
    inner.style.transition = 'none';
  }, { passive: true });

  track.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - startX;
    if (Math.abs(dx) > 5) moved = true;
    if (moved) {
      inner.style.transform = `translateX(${-base + dx}px)`;
      e.preventDefault();
    }
  }, { passive: false });

  track.addEventListener('touchend', (e) => {
    if (!dragging) return;
    dragging = false;
    if (!moved) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (dx < -40) slideTo(current + 1);
    else if (dx > 40) slideTo(current - 1);
    else slideTo(current);
  }, { passive: true });

  /* Recalculate on resize */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => slideTo(current, false), 150);
  });

  slideTo(0, false);

  return nav;
}

export async function initCarousel(container, opts = {}) {
  const items = [...container.children];
  if (items.length < 2) return null;

  const infinite = opts.infinite || false;
  const mobileOnly = opts.mobileOnly || false;
  const showBottomNav = opts.showBottomNav || false;

  await ensureStyles();

  if (mobileOnly) container.classList.add('carousel-mobile');
  if (infinite) container.classList.add('carousel-infinite');

  const buildOpts = { infinite, showBottomNav };

  /* For mobileOnly, only render the carousel on mobile viewports.
     Use matchMedia to init/destroy when crossing the breakpoint. */
  if (mobileOnly) {
    let instance = null;

    onMobileBreakpointChange((isMobile) => {
      if (isMobile && !instance) {
        instance = buildCarousel(container, items, buildOpts);
      } else if (!isMobile && instance) {
        instance.destroy();
        instance = null;
      }
    });

    return instance;
  }

  /* Normal carousel — active on all viewports */
  return buildCarousel(container, items, buildOpts);
}
