import { loadCSS } from '../../scripts/aem.js';

let cssReady;

/** Desktop breakpoint for overview page-mode classes (see overview.css). */
const DESKTOP_MIN = '(min-width: 1025px)';

/**
 * Hardcoded defaults when options are omitted (e.g. `createOverviewSwitcher()` from scripts).
 * Real overview blocks should pass `bid` and panel ids from decorate.
 */
export const OVERVIEW_SWITCHER_DEFAULTS = {
  overviewLabel: 'Overview',
  fullviewLabel: 'Full View',
  bid: 1,
  panelOverviewId: 'overview-panel-0-1',
  panelFullviewId: 'overview-panel-1-1',
};

/**
 * Loads atomic overview switcher styles once per page.
 * @returns {Promise<void>}
 */
function ensureOverviewSwitcherStyles() {
  if (!cssReady) {
    const href = `${window.hlx.codeBasePath}/atomic/switcher/overview-switcher.css`;
    cssReady = loadCSS(href);
  }
  return cssReady;
}

/**
 * Builds one Overview / Full View tablist.
 * Call with no arguments to use {@link OVERVIEW_SWITCHER_DEFAULTS}.
 * @param {CreateOverviewSwitcherOptions} [options]
 * @returns {{ tablist: HTMLDivElement}}
 */
export function createOverviewSwitcher(options = {}) {
  ensureOverviewSwitcherStyles();
  const {
    overviewLabel = OVERVIEW_SWITCHER_DEFAULTS.overviewLabel,
    fullviewLabel = OVERVIEW_SWITCHER_DEFAULTS.fullviewLabel,
    bid = OVERVIEW_SWITCHER_DEFAULTS.bid,
    panelOverviewId = OVERVIEW_SWITCHER_DEFAULTS.panelOverviewId,
    panelFullviewId = OVERVIEW_SWITCHER_DEFAULTS.panelFullviewId,
    idSuffix = '',
  } = options;
  const idPost = idSuffix ? `-${idSuffix}` : '';
  const tablist = document.createElement('div');
  tablist.className = 'overview-switcher';
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'View');

  const btnOverview = document.createElement('button');
  const btnFullview = document.createElement('button');
  btnOverview.type = 'button';
  btnFullview.type = 'button';
  btnOverview.className = 'overview-switcher-tab';
  btnFullview.className = 'overview-switcher-tab is-active';
  btnOverview.setAttribute('role', 'tab');
  btnFullview.setAttribute('role', 'tab');
  btnOverview.setAttribute('aria-selected', 'false');
  btnFullview.setAttribute('aria-selected', 'true');
  btnOverview.setAttribute('aria-controls', panelOverviewId);
  btnFullview.setAttribute('aria-controls', panelFullviewId);
  btnOverview.id = `overview-tab-0-${bid}${idPost}`;
  btnFullview.id = `overview-tab-1-${bid}${idPost}`;
  btnOverview.textContent = overviewLabel;
  btnFullview.textContent = fullviewLabel;
  tablist.append(btnOverview, btnFullview);
  return tablist;
}

/**
 * Tab sync, panels, desktop page-mode classes, and viewport listener.
 * @param {SetupOverviewSwitcherOptions} options
 * @returns {{ activate: (index: 0 | 1) => void }}
 */
export function setupOverviewSwitcher({
  tabSets, panelOverview, panelFullview, pageRoot = null,
}) {
  const desktopMq = window.matchMedia(DESKTOP_MIN);

  const setPageDesktopMode = (mode) => {
    if (!pageRoot) return;
    pageRoot.classList.remove('overview-page-overview', 'overview-page-fullview');
    if (mode === 'fullview') pageRoot.classList.add('overview-page-fullview');
    else if (mode === 'overview') pageRoot.classList.add('overview-page-overview');
  };

  const clearPageDesktopMode = () => {
    pageRoot?.classList.remove('overview-page-overview', 'overview-page-fullview');
  };

  const syncDesktopModeFromTabs = (index) => {
    if (!desktopMq.matches) return;
    setPageDesktopMode(index === 0 ? 'overview' : 'fullview');
  };

  const applyMobileLayout = () => {
    clearPageDesktopMode();
  };

  const applyDesktopLayout = () => {
    const { btnFullview } = tabSets[0];
    const fullViewActive = btnFullview.classList.contains('is-active');
    setPageDesktopMode(fullViewActive ? 'fullview' : 'overview');
  };

  const activate = (index) => {
    const active = index === 0;
    tabSets.forEach(({ btnOverview, btnFullview }) => {
      if (!btnOverview || !btnFullview) return;
      btnOverview.classList.toggle('is-active', active);
      btnFullview.classList.toggle('is-active', !active);
      btnOverview.setAttribute('aria-selected', String(active));
      btnFullview.setAttribute('aria-selected', String(!active));
    });
    panelOverview.hidden = !active;
    panelFullview.hidden = active;
    syncDesktopModeFromTabs(index);
  };

  tabSets.forEach(({ btnOverview, btnFullview }) => {
    btnOverview.addEventListener('click', () => activate(0));
    btnFullview.addEventListener('click', () => activate(1));
  });

  if (desktopMq.matches) {
    setPageDesktopMode('fullview');
  }

  desktopMq.addEventListener('change', (e) => {
    if (e.matches) {
      applyDesktopLayout();
    } else {
      applyMobileLayout();
    }
  });

  return { activate };
}
