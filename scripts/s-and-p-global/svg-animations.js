/**
 * Chart Animation Setup Functions for EDS Charts
 * Contains GSAP animation configurations for different chart types
 */

/**
 * Setup pie chart rotation animation
 * @param {object} gsap - GSAP instance
 * @param {HTMLElement} block - Chart container element
 * @param {string} uniqueId - Unique identifier for the chart
 * @returns {object} Animation timeline
 */
export function setupPieAnimation(gsap, block, uniqueId = 'pie') {
  const chartCircle = block.querySelector(`#chart-circle-${uniqueId}`);

  if (!chartCircle) return null;

  // Calculate the center point for rotation.
  // Fall back to the known SVG center (172,172 for a 344x344 viewBox) when
  // getBBox() returns zeros — this happens in AEM blocks where the element is
  // in the DOM but not yet painted at animation-setup time.
  const bbox = chartCircle.getBBox();
  const centerX = bbox.width > 0 ? bbox.x + bbox.width / 2 : 172;
  const centerY = bbox.height > 0 ? bbox.y + bbox.height / 2 : 172;

  // Set transform origin to the calculated center
  gsap.set(chartCircle, {
    svgOrigin: `${centerX} ${centerY}`,
    rotation: 0,
  });

  // Create hover animation timeline
  const timeline = gsap.timeline({ paused: true });

  timeline.to(chartCircle, {
    rotation: 90,
    duration: 0.7,
    ease: 'power2.inOut',
  });

  return timeline;
}

/**
 * Setup combined pie chart with bars animation
 * @param {object} gsap - GSAP instance
 * @param {HTMLElement} block - Chart container element
 * @param {string} uniqueId - Unique identifier for the chart
 * @returns {object} Animation timeline
 */
export function setupPieWithBarsAnimation(gsap, block, uniqueId = 'pieChart') {
  const chartCircle = block.querySelector(`#chart-circle-${uniqueId}`);
  const rect1 = block.querySelector(`#rect1-${uniqueId}`);
  const rect2 = block.querySelector(`#rect2-${uniqueId}`);
  const rect3 = block.querySelector(`#rect3-${uniqueId}`);

  if (!chartCircle || !rect1 || !rect2 || !rect3) return null;

  // Calculate the center point for pie rotation.
  // Fall back to the known pie-group center (74,88 within the 384x344 viewBox)
  // when getBBox() returns zeros before first paint.
  const bbox = chartCircle.getBBox();
  const centerX = bbox.width > 0 ? bbox.x + bbox.width / 2 : 74;
  const centerY = bbox.height > 0 ? bbox.y + bbox.height / 2 : 88;

  // Set transform origin to the calculated center
  gsap.set(chartCircle, {
    svgOrigin: `${centerX} ${centerY}`,
    rotation: 0,
  });

  // Create hover animation timeline — use element references, not global IDs
  const timeline = gsap.timeline({ paused: true });

  // Animate pie rotation and bar widths simultaneously
  timeline
    .to(chartCircle, {
      rotation: 90,
      duration: 0.6,
      ease: 'power2.inOut',
    }, 0)
    .to(rect1, {
      attr: { width: 175 },
      duration: 0.6,
      ease: 'power2.inOut',
    }, 0)
    .to(rect2, {
      attr: { width: 102 },
      duration: 0.6,
      ease: 'power2.inOut',
    }, 0)
    .to(rect3, {
      attr: { width: 352 },
      duration: 0.6,
      ease: 'power2.inOut',
    }, 0);

  return timeline;
}

/**
 * Setup bars height animation with fixed bottoms
 * @param {object} gsap - GSAP instance
 * @param {HTMLElement} block - Chart container element (scope so only this block animates)
 * @returns {object} Animation timeline
 */
export function setupBarsAnimation(gsap, block) {
  const bar1 = block?.querySelector('#bar1');
  const bar2 = block?.querySelector('#bar2');
  const bar3 = block?.querySelector('#bar3');
  if (!bar1 || !bar2 || !bar3) return null;

  const timeline = gsap.timeline({ paused: true });

  timeline
    .to(bar1, {
      attr: {
        height: 152.488,
        transform: 'matrix(-1 0 0 1 156.775 179.512)',
      },
      duration: 0.6,
      ease: 'power2.inOut',
    }, 0)
    .to(bar2, {
      attr: {
        height: 239.349,
        transform: 'matrix(-1 0 0 1 384 92.651)',
      },
      duration: 0.6,
      ease: 'power2.inOut',
    }, 0)
    .to(bar3, {
      attr: {
        height: 287.605,
        transform: 'matrix(-1 0 0 1 247.469 44.395)',
      },
      duration: 0.6,
      ease: 'power2.inOut',
    }, 0);

  return timeline;
}

/**
 * Setup grid color transition animation
 * @param {object} gsap - GSAP instance
 * @param {HTMLElement} block - Chart container element (scope so only this block animates)
 * @returns {object} Animation timeline
 */
export function setupGridAnimation(gsap, block) {
  const squares = [
    '#square-1', '#square-2', '#square-3', '#square-4',
    '#square-5', '#square-6', '#square-7', '#square-8',
    '#square-9', '#square-10',
  ].map((sel) => block?.querySelector(`${sel} path`));
  const fills = [
    '#FFC6AE', '#FFC6AE', '#172443', '#1C76D3',
    '#FFC6AE', '#172443', '#172443', '#B8D6DF',
    '#FFC6AE', '#172443',
  ];
  if (squares.some((el) => !el)) return null;

  const timeline = gsap.timeline({ paused: true });
  squares.forEach((el, i) => {
    timeline.to(el, { fill: fills[i], duration: 0.6, ease: 'power2.inOut' }, 0);
  });
  return timeline;
}

/**
 * Setup waves crossfade animation between default and hover states
 * @param {object} gsap - GSAP instance
 * @param {HTMLElement} block - Chart container element
 * @returns {object} Animation timeline
 */
export function setupWavesAnimation(gsap, block) {
  const defaultSvg = block.querySelector('.svg-default');
  const hoverSvg = block.querySelector('.svg-hover');

  if (!defaultSvg || !hoverSvg) return null;

  // Set initial state
  gsap.set(hoverSvg, { opacity: 0 });
  gsap.set(defaultSvg, { opacity: 1 });

  const timeline = gsap.timeline({ paused: true });

  // Smooth crossfade between the two SVG states
  timeline
    .to(defaultSvg, {
      opacity: 0,
      duration: 0.8,
      ease: 'power1.inOut',
    }, 0)
    .to(hoverSvg, {
      opacity: 1,
      duration: 0.8,
      ease: 'power1.inOut',
    }, 0);

  return timeline;
}

/**
 * Setup rectangle/cards crossfade animation with subtle scaling
 * @param {object} gsap - GSAP instance
 * @param {HTMLElement} block - Chart container element
 * @returns {object} Animation timeline
 */
export function setupRectangleAnimation(gsap, block) {
  const defaultLayer = block.querySelector('.svg-default');
  const hoverLayer = block.querySelector('.svg-hover');

  if (!defaultLayer || !hoverLayer) return null;

  // Set initial state
  gsap.set(hoverLayer, { opacity: 0, scale: 0.98, transformOrigin: 'center center' });
  gsap.set(defaultLayer, { opacity: 1, scale: 1, transformOrigin: 'center center' });

  const timeline = gsap.timeline({ paused: true });

  // Smooth crossfade with subtle scale effect
  timeline
    .to(defaultLayer, {
      opacity: 0,
      scale: 1.02,
      duration: 0.5,
      ease: 'power2.inOut',
    }, 0)
    .to(hoverLayer, {
      opacity: 1,
      scale: 1,
      duration: 0.5,
      ease: 'power2.inOut',
    }, 0);

  return timeline;
}

/**
 * Generic function to bind hover events to chart animations
 * @param {HTMLElement} container - Chart container element
 * @param {object} timeline - GSAP timeline
 */
export function bindHoverEvents(container, timeline) {
  if (!container || !timeline) return;

  container.addEventListener('mouseenter', () => {
    timeline.play();
  });

  container.addEventListener('mouseleave', () => {
    timeline.reverse();
  });
}

/**
 * Setup complete chart with animation
 * @param {object} gsap - GSAP instance
 * @param {HTMLElement} block - Chart container element
 * @param {string} chartType - Type of chart (pie, bars, grid, waves, rectangle)
 * @returns {object} Animation timeline
 */
export function setupChartAnimation(gsap, block, chartType) {
  let timeline = null;

  // Get unique ID from data attribute or generate one
  const chartId = block.dataset.chartId || `${chartType}_${Math.random().toString(36).substr(2, 9)}`;

  switch (chartType) {
    case 'pie':
      timeline = setupPieAnimation(gsap, block, chartId);
      break;
    case 'pieChart':
      timeline = setupPieWithBarsAnimation(gsap, block, chartId);
      break;
    case 'bars':
      timeline = setupBarsAnimation(gsap, block);
      break;
    case 'grid':
      timeline = setupGridAnimation(gsap, block);
      break;
    case 'waves':
      timeline = setupWavesAnimation(gsap, block);
      break;
    case 'rectangle':
      timeline = setupRectangleAnimation(gsap, block);
      break;
    default:
      // eslint-disable-next-line no-console
      console.warn(`Unknown chart type: ${chartType}`);
      return null;
  }

  if (timeline) {
    bindHoverEvents(block, timeline);
  }

  return timeline;
}
