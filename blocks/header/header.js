import { getMetadata } from '../../scripts/aem.js';
import { fetchPlaceholders } from '../../scripts/placeholders.js';
import { DESKTOP_BP } from '../../scripts/s-and-p-global/constants.js';
import { loadFragment } from '../fragment/fragment.js';
import { parseNewsStrip, buildNewsStrip } from '../news-strip/news-strip.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia(DESKTOP_BP);

// ─────────────────────────────────────────────────────────────────────────────
// Legacy nav helpers (kept for backward-compat with the old 3-section /nav)
// ─────────────────────────────────────────────────────────────────────────────

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav?.querySelector('.nav-sections');
    const navSectionExpanded = navSections?.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav?.querySelector('button')?.focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections?.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.className === 'nav-drop';
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    // eslint-disable-next-line no-use-before-define
    toggleAllNavSections(focused.closest('.nav-sections'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement.addEventListener('keydown', openOnKeydown);
}

function toggleAllNavSections(sections, expanded = false) {
  if (!sections) return;
  sections.querySelectorAll('.nav-sections .default-content-wrapper > ul > li').forEach((section) => {
    section.setAttribute('aria-expanded', expanded);
  });
}

function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  if (button) button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  const navDrops = navSections ? navSections.querySelectorAll('.nav-drop') : [];
  if (isDesktop.matches) {
    navDrops.forEach((drop) => {
      if (!drop.hasAttribute('tabindex')) {
        drop.setAttribute('tabindex', 0);
        drop.addEventListener('focus', focusNavSection);
      }
    });
  } else {
    navDrops.forEach((drop) => {
      drop.removeAttribute('tabindex');
      drop.removeEventListener('focus', focusNavSection);
    });
  }
  if (!expanded || isDesktop.matches) {
    window.addEventListener('keydown', closeOnEscape);
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

function getDirectTextContent(menuItem) {
  const menuLink = menuItem.querySelector(':scope > :where(a,p)');
  if (menuLink) {
    return menuLink.textContent.trim();
  }
  return Array.from(menuItem.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent)
    .join(' ');
}

async function buildBreadcrumbsFromNavTree(nav, currentUrl) {
  const crumbs = [];
  const homeUrl = document.querySelector('.nav-brand a[href]').href;
  let menuItem = Array.from(nav.querySelectorAll('a')).find((a) => a.href === currentUrl);
  if (menuItem) {
    do {
      const link = menuItem.querySelector(':scope > a');
      crumbs.unshift({ title: getDirectTextContent(menuItem), url: link ? link.href : null });
      menuItem = menuItem.closest('ul')?.closest('li');
    } while (menuItem);
  } else if (currentUrl !== homeUrl) {
    crumbs.unshift({ title: getMetadata('og:title'), url: currentUrl });
  }
  const placeholders = await fetchPlaceholders();
  const homePlaceholder = placeholders.breadcrumbsHomeLabel || 'Home';
  crumbs.unshift({ title: homePlaceholder, url: homeUrl });
  if (crumbs.length > 1) {
    crumbs[crumbs.length - 1].url = null;
  }
  crumbs[crumbs.length - 1]['aria-current'] = 'page';
  return crumbs;
}

async function buildBreadcrumbs() {
  const breadcrumbs = document.createElement('nav');
  breadcrumbs.className = 'breadcrumbs';
  const crumbs = await buildBreadcrumbsFromNavTree(
    document.querySelector('.nav-sections'),
    document.location.href,
  );
  const ol = document.createElement('ol');
  ol.append(...crumbs.map((item) => {
    const li = document.createElement('li');
    if (item['aria-current']) li.setAttribute('aria-current', item['aria-current']);
    if (item.url) {
      const a = document.createElement('a');
      a.href = item.url;
      a.textContent = item.title;
      li.append(a);
    } else {
      li.textContent = item.title;
    }
    return li;
  }));
  breadcrumbs.append(ol);
  return breadcrumbs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mega-menu helpers (new header-menu block approach)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a single header-nav-child element (UE or published) into a plain object.
 *
 * UE mode:  children carry data-aue-prop matching field names
 *           (childLabel | childUrl | description | exploreLabel | exploreUrl | links)
 * Published: children are positional columns in the same order
 */
function parseNavChild(el) {
  const looksLikeUrl = (value = '') => /^(https?:\/\/|\/|#|mailto:|tel:|www\.)/i.test(value.trim());
  const readUrlField = (node) => {
    const href = node?.querySelector('a')?.href;
    if (href) return href;
    const text = node?.textContent?.trim() || '';
    return looksLikeUrl(text) ? text : '';
  };

  // UE mode — read by named prop attributes
  const byProp = (name) => {
    const nodes = [...el.querySelectorAll(`[data-aue-prop="${name}"]`)];
    if (!nodes.length) return null;
    // Some UE payloads include multiple nodes for the same prop; prefer the
    // one that actually contains authored content.
    const hasRichContent = (node) => Boolean(
      node?.querySelector('a, ul, ol, li, p, picture, img, svg')
      || node?.textContent?.trim(),
    );
    return nodes.find(hasRichContent) || nodes[0];
  };
  if (byProp('childLabel') || byProp('childUrl') || byProp('description') || byProp('links')) {
    const linksEl = byProp('links');
    const hasLinksContent = Boolean(
      linksEl?.querySelector('a, ul, ol, li')
      || linksEl?.textContent?.trim(),
    );
    return {
      label: byProp('childLabel')?.textContent.trim() || '',
      childUrl: readUrlField(byProp('childUrl')),
      paragraph: byProp('description')?.innerHTML || '',
      exploreLabel: byProp('exploreLabel')?.textContent.trim() || '',
      exploreUrl: readUrlField(byProp('exploreUrl')),
      linksEl: hasLinksContent ? linksEl.cloneNode(true) : null,
    };
  }

  // Published mode — positional columns
  // Field order: childLabel | [childUrl] | description | exploreLabel | exploreUrl | links
  const cols = [...el.children].filter((c) => !c.dataset.aueComponent);
  const childUrl = readUrlField(cols[1]);
  const hasChildUrlField = Boolean(childUrl) || cols.length >= 6;
  const offset = hasChildUrlField ? 1 : 0;
  return {
    label: cols[0]?.textContent.trim() || '',
    childUrl: hasChildUrlField ? childUrl : '',
    paragraph: cols[1 + offset]?.innerHTML || '',
    exploreLabel: cols[2 + offset]?.textContent.trim() || '',
    exploreUrl: readUrlField(cols[3 + offset]),
    linksEl: cols[4 + offset] ? cols[4 + offset].cloneNode(true) : null,
  };
}

/**
 * Parse the header-menu block DOM into a plain data object.
 *
 * Handles three rendering variants:
 *   A) UE editor  — rows carry data-aue-component attributes
 *   B) Published nested — menu-item divs contain nav-child divs as siblings
 *   C) Published flat   — menu-items (3 cols) followed by nav-children (4 cols)
 */
function parseHeaderMenuBlock(block) {
  const result = {
    logoElMobile: null,
    logoElTablet: null,
    logoElDesktop: null,
    logoUrl: '/',
    contact: null,
    login: null,
    showSearch: false,
    searchLabel: 'Search',
    searchUrl: '/search',
    toolsOrder: [],
    items: [],
    newsStrip: null,
  };

  // When header-section is the section wrapper itself (direct <main> child),
  // decorateSections wraps its children in a .default-content-wrapper.
  // Unwrap so we always iterate the actual component rows / UE items.
  const contentRoot = block.classList.contains('section')
    ? (block.querySelector(':scope > .default-content-wrapper') || block)
    : block;

  const getCellUrl = (cell) => cell?.querySelector('a')?.href || cell?.textContent.trim() || '';
  const markToolOrder = (toolName) => {
    if (!result.toolsOrder.includes(toolName)) {
      result.toolsOrder.push(toolName);
    }
  };
  const parseLoginItemsFromCols = (cols, startIndex = 2) => {
    const items = [];
    for (
      let idx = startIndex, itemNumber = 1;
      idx + 1 < cols.length && itemNumber <= 7;
      idx += 2, itemNumber += 1
    ) {
      const label = cols[idx]?.textContent.trim() || '';
      const url = getCellUrl(cols[idx + 1]);
      if (label || url) {
        items.push({
          label: label || `Item ${itemNumber}`,
          url: url || '#',
        });
      }
    }
    return items;
  };
  const sanitizeLoginItems = (loginLabel, loginUrl, items = []) => {
    const normalizedLabel = (loginLabel || '').trim().toLowerCase();
    const normalizedUrl = (loginUrl || '').trim();
    return items.filter((item) => {
      const itemLabel = (item?.label || '').trim();
      const itemUrl = (item?.url || '').trim();
      if (!itemLabel && !itemUrl) return false;
      const isSameLabel = itemLabel.toLowerCase() === normalizedLabel;
      const isSameUrl = normalizedUrl && itemUrl === normalizedUrl;
      // Drop accidental duplicate of the primary Login trigger entry.
      if (isSameLabel && (isSameUrl || !itemUrl || itemUrl === '#')) return false;
      return true;
    });
  };

  let currentItem = null;

  const blockNameToAueComp = {
    'header-logo': 'header-logo',
    'header-contact': 'header-contact',
    'header-login': 'header-login',
    'header-search': 'header-search',
    'header-menu-item': 'header-menu-item',
    'header-nav-child': 'header-nav-child',
  };

  [...contentRoot.children].forEach((row, idx) => {
    const blockEl = row.matches('.block[data-block-name]')
      ? row
      : row.querySelector(':scope > .block[data-block-name]');
    const rowRoot = blockEl || row;
    const blockName = rowRoot.dataset?.blockName || rowRoot.getAttribute('data-block-name');
    const aueComp = rowRoot.dataset?.aueComponent || blockNameToAueComp[blockName];
    const cols = [...rowRoot.children].filter((c) => !c.dataset.aueComponent);
    const colCount = cols.length;

    /* ── A: UE mode — dedicated sub-blocks ── */
    if (aueComp === 'header-logo') {
      // Read by data-aue-prop name (UE) or positional cols (published)
      const byProp = (name) => rowRoot.querySelector(`[data-aue-prop="${name}"]`);
      const isUeMode = byProp('imageMobile') || byProp('imageTablet') || byProp('imageDesktop');
      let altText; let urlText;
      if (isUeMode) {
        result.logoElMobile = byProp('imageMobile')?.cloneNode(true) || null;
        result.logoElTablet = byProp('imageTablet')?.cloneNode(true) || null;
        result.logoElDesktop = byProp('imageDesktop')?.cloneNode(true) || null;
        altText = byProp('alt')?.textContent.trim();
        urlText = byProp('url')?.textContent.trim();
      } else {
        // Published: positional cols: imageMobile | imageTablet | imageDesktop | alt | url
        result.logoElMobile = cols[0]?.cloneNode(true) || null;
        result.logoElTablet = cols[1]?.cloneNode(true) || null;
        result.logoElDesktop = cols[2]?.cloneNode(true) || null;
        altText = cols[3]?.textContent.trim();
        urlText = cols[4]?.textContent.trim();
      }
      // Apply shared alt text to all logo images
      if (altText) {
        [result.logoElMobile, result.logoElTablet, result.logoElDesktop].forEach((el) => {
          el?.querySelectorAll('img').forEach((img) => { img.alt = altText; });
        });
      }
      result.logoUrl = urlText || '/';
      return;
    }

    if (aueComp === 'header-contact') {
      result.contact = {
        label: cols[0]?.textContent.trim() || 'Contact',
        url: cols[1]?.textContent.trim() || '/contact',
      };
      markToolOrder('contact');
      return;
    }

    if (aueComp === 'header-login') {
      const byProp = (name) => {
        const nodes = [...rowRoot.querySelectorAll(`[data-aue-prop="${name}"]`)];
        if (!nodes.length) return null;
        const hasValue = (node) => Boolean(node?.querySelector('a') || node?.textContent?.trim());
        return nodes.find(hasValue) || nodes[0];
      };
      const isUeMode = byProp('label') || byProp('item1Label') || byProp('item1Url');
      if (isUeMode) {
        const items = [];
        for (let itemIndex = 1; itemIndex <= 7; itemIndex += 1) {
          const itemLabel = byProp(`item${itemIndex}Label`)?.textContent.trim() || '';
          const itemUrl = byProp(`item${itemIndex}Url`)?.querySelector('a')?.href
            || byProp(`item${itemIndex}Url`)?.textContent.trim()
            || '';
          if (itemLabel || itemUrl) {
            items.push({
              label: itemLabel || `Item ${itemIndex}`,
              url: itemUrl || '#',
            });
          }
        }

        const loginLabel = byProp('label')?.textContent.trim() || 'Login';
        const loginUrl = byProp('url')?.querySelector('a')?.href
          || byProp('url')?.textContent.trim()
          || '/login';

        result.login = {
          label: loginLabel,
          url: loginUrl,
          items: sanitizeLoginItems(loginLabel, loginUrl, items),
        };
      } else {
        const loginLabel = cols[0]?.textContent.trim() || 'Login';
        const loginUrl = getCellUrl(cols[1]) || '/login';
        result.login = {
          label: loginLabel,
          url: loginUrl,
          items: sanitizeLoginItems(loginLabel, loginUrl, parseLoginItemsFromCols(cols, 2)),
        };
      }
      markToolOrder('login');
      return;
    }

    if (aueComp === 'header-search') {
      const byProp = (name) => rowRoot.querySelector(`[data-aue-prop="${name}"]`);
      const isUeMode = byProp('showSearch') || byProp('label') || byProp('url');

      if (isUeMode) {
        const showRaw = byProp('showSearch')?.textContent.trim().toLowerCase();
        result.showSearch = showRaw ? showRaw !== 'false' : true;
        result.searchLabel = byProp('label')?.textContent.trim() || 'Search';
        result.searchUrl = byProp('url')?.querySelector('a')?.href
          || byProp('url')?.textContent.trim()
          || '/search';
      } else {
        const showRaw = cols[0]?.textContent.trim().toLowerCase();
        const hasBool = showRaw === 'true' || showRaw === 'false';
        result.showSearch = hasBool ? showRaw !== 'false' : true;
        result.searchLabel = cols[1]?.textContent.trim() || 'Search';
        result.searchUrl = cols[2]?.querySelector('a')?.href || cols[2]?.textContent.trim() || '/search';
      }
      markToolOrder('search');
      return;
    }

    if (aueComp === 'header-menu-item') {
      // Read fields by data-aue-prop name (UE mode) or positional cols (published)
      const byProp = (name) => rowRoot.querySelector(`[data-aue-prop="${name}"]`);
      const isUeMode = byProp('label') !== null;
      let label; let url; let isChild;
      if (isUeMode) {
        label = byProp('label')?.textContent.trim() || '';
        isChild = byProp('isChild')?.textContent.trim().toLowerCase() === 'true';
        url = byProp('url')?.querySelector('a')?.href || byProp('url')?.textContent.trim() || '#';
      } else {
        label = cols[0]?.textContent.trim() || '';
        isChild = cols[1]?.textContent.trim().toLowerCase() === 'true';
        url = cols[2]?.querySelector('a')?.href || cols[2]?.textContent.trim() || '#';
      }
      currentItem = {
        label,
        url,
        isChild,
        children: [],
      };
      result.items.push(currentItem);
      // Collect nav-children at any depth inside this menu-item row (UE wraps
      // child components inside an extra container div, so :scope > misses them)
      [...rowRoot.querySelectorAll('[data-aue-component="header-nav-child"]')]
        .forEach((child) => currentItem.children.push(parseNavChild(child)));

      // Also support authored block wrappers where child rows render as
      // .header-nav-child.block without data-aue-component markers.
      [...rowRoot.querySelectorAll('.header-nav-child.block, [data-block-name="header-nav-child"]')]
        .forEach((childBlock) => currentItem.children.push(parseNavChild(childBlock)));

      // Published nested fallback: extra columns after the first 3 fields can
      // carry inline child data blocks.
      if (currentItem.children.length === 0 && cols.length > 3) {
        cols.slice(3).forEach((nestedDiv) => {
          const parsedChild = parseNavChild(nestedDiv);
          const hasContent = Boolean(
            parsedChild.label
            || parsedChild.childUrl
            || parsedChild.paragraph
            || parsedChild.exploreLabel
            || parsedChild.exploreUrl
            || parsedChild.linksEl,
          );
          if (hasContent) {
            currentItem.children.push(parsedChild);
          }
        });
      }

      // Auto-enable mega-menu if children were found even when checkbox is off
      if (currentItem.children.length > 0) currentItem.isChild = true;
      return;
    }

    if (aueComp === 'header-nav-child') {
      // Flat sibling of a menu item in header-section — attach to the most recent menu item
      const target = currentItem || result.items[result.items.length - 1];
      if (target) {
        target.children.push(parseNavChild(rowRoot));
        target.isChild = true;
      }
      return;
    }

    if (aueComp === 'header-news-strip' || blockName === 'header-news-strip') {
      result.newsStrip = parseNewsStrip(rowRoot);
      return;
    }

    /* ── B + C: published mode ── */

    // Row 0 with a picture/img = logo block (imageMobile | imageTablet | imageDesktop | alt | url)
    if (idx === 0 && rowRoot.querySelector('picture, img')) {
      result.logoElMobile = cols[0]?.cloneNode(true) || null;
      result.logoElTablet = cols[1]?.cloneNode(true) || null;
      result.logoElDesktop = cols[2]?.cloneNode(true) || null;
      const altText = cols[3]?.textContent.trim();
      const urlText = cols[4]?.textContent.trim();
      if (altText) {
        [result.logoElMobile, result.logoElTablet, result.logoElDesktop].forEach((el) => {
          el?.querySelectorAll('img').forEach((img) => { img.alt = altText; });
        });
      }
      result.logoUrl = urlText || '/';
      return;
    }

    // 2-col row = contact or login (label | url)
    if (colCount === 2) {
      const label = cols[0].textContent.trim();
      const url = getCellUrl(cols[1]);
      if (!result.contact) {
        result.contact = { label, url };
        markToolOrder('contact');
      } else if (!result.login) {
        result.login = { label, url, items: [] };
        markToolOrder('login');
      }
      return;
    }

    // 4+ even columns can be a login row with up to 7 item label/url pairs.
    // Layout: loginLabel | loginUrl | item1Label | item1Url | ...
    if (colCount >= 4
      && colCount % 2 === 0
      && !currentItem
      && !result.login
      && result.items.length === 0) {
      result.login = {
        label: cols[0]?.textContent.trim() || 'Login',
        url: getCellUrl(cols[1]) || '/login',
        items: sanitizeLoginItems(
          cols[0]?.textContent.trim() || 'Login',
          getCellUrl(cols[1]) || '/login',
          parseLoginItemsFromCols(cols, 2),
        ),
      };
      markToolOrder('login');
      return;
    }

    // 1-3 col row = search config (showSearch | [label] | [url])
    if (colCount >= 1 && colCount <= 3) {
      const c0 = cols[0]?.textContent.trim().toLowerCase() || '';
      if (c0 === 'true' || c0 === 'false') {
        result.showSearch = c0 !== 'false';
        result.searchLabel = cols[1]?.textContent.trim() || result.searchLabel || 'Search';
        result.searchUrl = cols[2]?.querySelector('a')?.href
          || cols[2]?.textContent.trim()
          || result.searchUrl
          || '/search';
        markToolOrder('search');
      }
      return;
    }

    // 3-col row = menu item.
    // Column order can be either:
    //   NEW model order: label | isChild | url
    //   OLD authored order: label | url | isChild
    // Detect by checking which column contains a literal boolean string.
    if (colCount === 3) {
      const c0 = cols[0]?.textContent.trim() || '';
      const c1 = cols[1]?.textContent.trim() || '';
      const c2 = cols[2]?.textContent.trim() || '';
      const c1IsBool = c1 === 'true' || c1 === 'false';
      const c2IsBool = c2 === 'true' || c2 === 'false';
      let label; let isChild; let url;
      if (c1IsBool) {
        // NEW: label | isChild | url
        label = c0;
        isChild = c1 === 'true';
        url = cols[2]?.querySelector('a')?.href || c2 || '#';
      } else if (c2IsBool) {
        // OLD: label | url | isChild
        label = c0;
        url = cols[1]?.querySelector('a')?.href || c1 || '#';
        isChild = c2 === 'true';
      } else {
        // Fallback: treat as label | url | no-boolean
        label = c0;
        url = cols[1]?.querySelector('a')?.href || c1 || '#';
        isChild = false;
      }
      currentItem = {
        label, url, isChild, children: [],
      };
      result.items.push(currentItem);
      // Variant B: nav-children are extra sibling divs inside the same row
      [...rowRoot.children].slice(3).forEach((nestedDiv) => {
        const parsedChild = parseNavChild(nestedDiv);
        const hasContent = Boolean(
          parsedChild.label
          || parsedChild.childUrl
          || parsedChild.paragraph
          || parsedChild.exploreLabel
          || parsedChild.exploreUrl
          || parsedChild.linksEl,
        );
        if (hasContent) {
          currentItem.children.push(parsedChild);
        }
      });
      if (currentItem.children.length > 0) currentItem.isChild = true;
      return;
    }

    // 4-6 col row = nav-child for the previous menu item (variant C flat).
    // parseNavChild handles both old and new field orders, including childUrl.
    if (colCount >= 4 && colCount <= 6 && currentItem) {
      const parsedChild = parseNavChild(rowRoot);
      const hasContent = Boolean(
        parsedChild.label
        || parsedChild.childUrl
        || parsedChild.paragraph
        || parsedChild.exploreLabel
        || parsedChild.exploreUrl
        || parsedChild.linksEl,
      );
      if (hasContent) {
        currentItem.children.push(parsedChild);
        currentItem.isChild = true;
      }
    }
  });

  return result;
}

const HEADER_MENU_ACTIVE_BODY_CLASS = 'header-menu-active';
const INTERACTION_DELAY_MS = 500;
const MOBILE_SUBPANEL_OPEN_CLASS = 'nav-mobile-subpanel-open';
const MOBILE_FIRST_L0_OPEN_CLASS = 'nav-first-l0-open';

function setDesktopMenuActiveState(active) {
  if (!isDesktop.matches) return;
  const shouldBeActive = Boolean(active) && isDesktop.matches;
  document.body.classList.toggle(HEADER_MENU_ACTIVE_BODY_CLASS, shouldBeActive);
  document.querySelector('.nav-backdrop')?.classList.toggle('visible', shouldBeActive);
}

function syncMobileSubpanelState(nav) {
  if (!nav) return;
  const sections = nav.querySelector('.nav-sections');
  if (isDesktop.matches) {
    nav.classList.remove(MOBILE_SUBPANEL_OPEN_CLASS);
    sections?.classList.remove(MOBILE_FIRST_L0_OPEN_CLASS);
    return;
  }
  const hasOpenSubpanel = Boolean(
    nav.querySelector('.nav-item-has-children[aria-expanded="true"], .nav-login-dropdown[aria-expanded="true"]'),
  );
  nav.classList.toggle(MOBILE_SUBPANEL_OPEN_CLASS, hasOpenSubpanel);

  const openTopLevelItem = sections?.querySelector(':scope > ul > li.nav-item-has-children[aria-expanded="true"]');
  const firstTopLevelItem = sections?.querySelector(':scope > ul > li.nav-item');
  const isFirstL0Open = Boolean(openTopLevelItem && firstTopLevelItem === openTopLevelItem);
  sections?.classList.toggle(MOBILE_FIRST_L0_OPEN_CLASS, isFirstL0Open);
}

/**
 * Close all open mega-menu panels and hide backdrop.
 */
function closeAllMegaMenus(nav) {
  nav?.querySelectorAll('.nav-mega-inner').forEach((megaInner) => {
    megaInner.classList.remove('has-active-col');
  });
  nav?.querySelectorAll('.nav-mega-col').forEach((col) => {
    col.classList.remove('is-active');
    if (col.hasAttribute('aria-expanded')) {
      col.setAttribute('aria-expanded', 'false');
    }
  });
  nav?.querySelectorAll('.nav-mega-detail-pane').forEach((pane) => {
    pane.classList.remove('is-active');
  });
  nav?.querySelectorAll('.nav-mega-back-child').forEach((childLabel) => {
    childLabel.textContent = '';
  });
  nav?.querySelectorAll('.nav-mega-header-explore').forEach((exploreLink) => {
    exploreLink.hidden = true;
    exploreLink.removeAttribute('href');
  });
  nav?.querySelectorAll('.nav-mega-header').forEach((header) => {
    header.classList.remove('has-active-child');
  });

  nav?.querySelectorAll('.nav-item-has-children[aria-expanded="true"]').forEach((li) => {
    li.setAttribute('aria-expanded', 'false');
    li.querySelector('.nav-mega-menu')?.setAttribute('aria-hidden', 'true');
    li.querySelector('.nav-item-trigger')?.setAttribute('aria-expanded', 'false');
  });
  nav?.querySelectorAll('.nav-login-dropdown[aria-expanded="true"]').forEach((loginWrap) => {
    loginWrap.setAttribute('aria-expanded', 'false');
    loginWrap.querySelector('.nav-login-trigger')?.setAttribute('aria-expanded', 'false');
    loginWrap.querySelector('.nav-login-menu')?.setAttribute('aria-hidden', 'true');
    loginWrap.closest('.nav-sections')?.classList.remove('nav-login-open');
  });
  syncMobileSubpanelState(nav);
  setDesktopMenuActiveState(false);
}

function closeOpenLoginDropdowns(nav) {
  nav?.querySelectorAll('.nav-login-dropdown[aria-expanded="true"]').forEach((loginWrap) => {
    loginWrap.setAttribute('aria-expanded', 'false');
    loginWrap.querySelector('.nav-login-trigger')?.setAttribute('aria-expanded', 'false');
    loginWrap.querySelector('.nav-login-menu')?.setAttribute('aria-hidden', 'true');
  });
  syncMobileSubpanelState(nav);
}

/**
 * Convert rich-text links content into interactive heading/list groups.
 * Expected authored pattern: <p>Heading</p><ul>...</ul> repeated.
 */
function enhanceNavColLinks(linksRoot) {
  if (!linksRoot) return;

  const nodes = [...linksRoot.childNodes].filter((node) => {
    if (node.nodeType !== Node.TEXT_NODE) return true;
    return node.textContent.trim().length > 0;
  });

  const fragment = document.createDocumentFragment();
  let currentGroup = null;

  nodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && node.matches('p')) {
      const heading = node;
      heading.classList.add('nav-col-links-heading');
      heading.setAttribute('tabindex', '0');

      currentGroup = document.createElement('div');
      currentGroup.className = 'nav-col-link-group';
      currentGroup.append(heading);
      fragment.append(currentGroup);
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE && node.matches('ul, ol')) {
      const list = node;
      list.classList.add('nav-col-links-list');
      if (!currentGroup) {
        currentGroup = document.createElement('div');
        currentGroup.className = 'nav-col-link-group';
        fragment.append(currentGroup);
      }
      currentGroup.append(list);
      return;
    }

    if (currentGroup) {
      currentGroup.append(node);
    } else {
      fragment.append(node);
    }
  });

  linksRoot.replaceChildren(fragment);

  const groups = [...linksRoot.querySelectorAll(':scope > .nav-col-link-group')]
    .filter((group) => group.querySelector('.nav-col-links-heading') && group.querySelector('.nav-col-links-list'));

  if (groups.length <= 1) return;

  if (!isDesktop.matches) {
    const closeGroup = (group) => {
      const heading = group.querySelector('.nav-col-links-heading');
      const list = group.querySelector('.nav-col-links-list');
      group.classList.remove('is-active');
      heading?.setAttribute('aria-expanded', 'false');
      if (list) list.hidden = true;
    };

    const openGroup = (group) => {
      const heading = group.querySelector('.nav-col-links-heading');
      const list = group.querySelector('.nav-col-links-list');
      group.classList.add('is-active');
      heading?.setAttribute('aria-expanded', 'true');
      if (list) list.hidden = false;
    };

    groups.forEach((group) => {
      const heading = group.querySelector('.nav-col-links-heading');
      heading?.setAttribute('role', 'button');
      heading?.setAttribute('tabindex', '0');
      heading?.setAttribute('aria-expanded', 'false');
      closeGroup(group);

      const toggleGroup = () => {
        const shouldOpen = !group.classList.contains('is-active');
        groups.forEach((candidate) => closeGroup(candidate));
        if (shouldOpen) openGroup(group);
      };

      heading?.addEventListener('click', toggleGroup);
      heading?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleGroup();
        }
      });
    });
    return;
  }

  const tabs = document.createElement('ul');
  tabs.className = 'nav-col-links-tabs';

  const panels = document.createElement('div');
  panels.className = 'nav-col-links-panels';

  const tabNodes = [];
  const panelNodes = [];

  const setActiveGroup = (activeIndex = null) => {
    tabNodes.forEach((tab, index) => {
      const isActive = index === activeIndex;
      const heading = tab.querySelector('.nav-col-links-heading');
      const panel = panelNodes[index];

      tab.classList.toggle('is-active', isActive);
      heading?.setAttribute('aria-selected', isActive ? 'true' : 'false');
      heading?.setAttribute('aria-expanded', isActive ? 'true' : 'false');

      panel?.classList.toggle('is-active', isActive);
      if (panel) panel.hidden = !isActive;
    });
  };

  groups.forEach((group, index) => {
    const heading = group.querySelector('.nav-col-links-heading');
    const list = group.querySelector('.nav-col-links-list');

    const tab = document.createElement('li');
    tab.className = 'nav-col-links-tab';
    tab.setAttribute('role', 'presentation');

    const tabId = `nav-col-tab-${index}`;
    const panelId = `nav-col-panel-${index}`;

    const headingButton = document.createElement('div');
    headingButton.className = 'nav-col-links-heading';
    headingButton.textContent = heading.textContent.trim();
    headingButton.setAttribute('role', 'tab');
    headingButton.setAttribute('tabindex', '0');
    headingButton.setAttribute('id', tabId);
    headingButton.setAttribute('aria-controls', panelId);
    headingButton.setAttribute('aria-selected', 'false');
    headingButton.setAttribute('aria-expanded', 'false');

    tab.append(headingButton);

    const panel = document.createElement('div');
    panel.className = 'nav-col-links-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('id', panelId);
    panel.setAttribute('aria-labelledby', tabId);
    if (list) {
      panel.append(list);
    }

    [...group.childNodes].forEach((node) => {
      if (node !== heading && node !== list) {
        panel.append(node);
      }
    });

    const activate = () => setActiveGroup(index);
    headingButton.addEventListener('focus', activate);
    headingButton.addEventListener('click', activate);
    headingButton.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate();
      }
    });
    if (isDesktop.matches) {
      headingButton.addEventListener('mouseenter', activate);
    }

    tabs.append(tab);
    panels.append(panel);
    tabNodes.push(tab);
    panelNodes.push(panel);
  });

  tabs.setAttribute('role', 'tablist');
  linksRoot.replaceChildren(tabs, panels);

  if (isDesktop.matches) {
    setActiveGroup(null);
    linksRoot.addEventListener('mouseleave', () => setActiveGroup(null));
  } else {
    setActiveGroup(0);
  }
}

/**
 * Build the full nav element from parsed header-menu data.
 */
function buildNavFromHeaderMenu(data) {
  const setActiveMegaCol = (megaInner, activeIndex = null) => {
    const hasActive = activeIndex !== null;
    megaInner.classList.toggle('has-active-col', hasActive);

    megaInner.querySelectorAll('.nav-mega-col').forEach((col) => {
      if (col.classList.contains('nav-mega-col-static')) {
        col.classList.remove('is-active');
        return;
      }
      const isActive = hasActive && col.dataset.megaIndex === String(activeIndex);
      col.classList.toggle('is-active', isActive);
      col.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    });

    megaInner.querySelectorAll('.nav-mega-detail-pane').forEach((pane) => {
      const isActive = hasActive && pane.dataset.megaIndex === String(activeIndex);
      pane.classList.toggle('is-active', isActive);
    });
  };

  // ── Brand ──────────────────────────────────────────────────────────────────
  const brand = document.createElement('div');
  brand.className = 'nav-brand';
  const logoA = document.createElement('a');
  logoA.href = data.logoUrl || '/';
  logoA.setAttribute('aria-label', 'Go to home page');

  // Render up to three responsive logos; each gets a modifier class so CSS
  // shows only the correct one per breakpoint:
  //   .logo-mobile   — shown below 520px
  //   .logo-tablet   — shown 520px – 1024px
  //   .logo-desktop  — shown 1025px+
  // If only some images are authored, fall back: tablet fills in for mobile,
  // desktop fills in for both when neither is authored.
  const mobileEl = data.logoElMobile || data.logoElTablet || data.logoElDesktop;
  const tabletEl = data.logoElTablet || data.logoElDesktop || data.logoElMobile;
  const desktopEl = data.logoElDesktop || data.logoElTablet || data.logoElMobile;

  if (mobileEl) {
    const wrap = document.createElement('span');
    wrap.className = 'logo-mobile';
    wrap.append(mobileEl.cloneNode(true));
    logoA.append(wrap);
  }
  if (tabletEl) {
    const wrap = document.createElement('span');
    wrap.className = 'logo-tablet';
    wrap.append(tabletEl.cloneNode(true));
    logoA.append(wrap);
  }
  if (desktopEl) {
    const wrap = document.createElement('span');
    wrap.className = 'logo-desktop';
    wrap.append(desktopEl.cloneNode(true));
    logoA.append(wrap);
  }

  brand.append(logoA);

  // ── Sections ───────────────────────────────────────────────────────────────
  const sections = document.createElement('div');
  sections.className = 'nav-sections';
  const ul = document.createElement('ul');
  ul.setAttribute('role', 'menubar');

  data.items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'nav-item';
    li.setAttribute('role', 'none');

    const usableChildren = (item.children || []).filter((child) => {
      const hasLabel = Boolean(child?.label?.trim());
      const hasParagraph = Boolean(child?.paragraph?.replace(/<[^>]*>/g, '').trim());
      const hasExplore = Boolean(child?.exploreLabel?.trim());
      const hasLinks = Boolean(child?.linksEl?.querySelector?.('a'));
      return hasLabel || hasParagraph || hasExplore || hasLinks;
    });
    const hasChildren = usableChildren.length > 0;

    if (hasChildren) {
      li.classList.add('nav-item-has-children');
      li.setAttribute('aria-expanded', 'false');

      const DETAIL_HIDE_DELAY_MS = INTERACTION_DELAY_MS;
      let megaInner;
      let detailHideTimer;
      const clearDetailHideTimer = () => {
        if (detailHideTimer) {
          clearTimeout(detailHideTimer);
          detailHideTimer = null;
        }
      };
      const scheduleDetailHide = () => {
        if (!isDesktop.matches) {
          setActiveMegaCol(megaInner, null);
          return;
        }
        clearDetailHideTimer();
        detailHideTimer = setTimeout(() => {
          setActiveMegaCol(megaInner, null);
          detailHideTimer = null;
        }, DETAIL_HIDE_DELAY_MS);
      };

      // Desktop hover: show backdrop while hovering over a menu-item-with-children
      const syncDesktopMenuActive = () => {
        if (!isDesktop.matches) return;
        const navEl = li.closest('nav');
        const hasHoveredDropdown = Boolean(navEl?.querySelector('.nav-item-has-children:hover, .nav-login-dropdown:hover'));
        const hasOpenDropdown = Boolean(navEl?.querySelector('.nav-item-has-children[aria-expanded="true"], .nav-login-dropdown[aria-expanded="true"]'));
        setDesktopMenuActiveState(hasHoveredDropdown || hasOpenDropdown);
      };
      li.addEventListener('mouseenter', () => {
        if (!isDesktop.matches) return;
        closeOpenLoginDropdowns(li.closest('nav'));
        clearDetailHideTimer();
        setDesktopMenuActiveState(true);
      });
      li.addEventListener('mouseleave', () => {
        if (!isDesktop.matches) return;
        clearDetailHideTimer();
        setActiveMegaCol(megaInner, null);
        requestAnimationFrame(syncDesktopMenuActive);
      });

      // Trigger button (keyboard + click)
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'nav-item-trigger';
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-haspopup', 'true');

      const triggerLabel = document.createElement('span');
      triggerLabel.textContent = item.label;
      const chevron = document.createElement('span');
      chevron.className = 'nav-item-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      trigger.append(triggerLabel, chevron);

      // Mega menu panel
      const megaMenu = document.createElement('div');
      megaMenu.className = 'nav-mega-menu';
      megaMenu.setAttribute('aria-hidden', 'true');
      megaMenu.setAttribute('role', 'region');
      megaMenu.setAttribute('aria-label', `${item.label} submenu`);

      const megaHeader = document.createElement('div');
      megaHeader.className = 'nav-mega-header';

      const megaBackButton = document.createElement('button');
      megaBackButton.type = 'button';
      megaBackButton.className = 'nav-mega-back';
      const megaBackIcon = document.createElement('span');
      megaBackIcon.className = 'nav-mega-back-icon';
      megaBackIcon.setAttribute('aria-hidden', 'true');
      const megaBackLabels = document.createElement('span');
      megaBackLabels.className = 'nav-mega-back-labels';
      const megaBackParent = document.createElement('span');
      megaBackParent.className = 'nav-mega-back-parent';
      megaBackParent.textContent = item.label;
      const megaBackChild = document.createElement('span');
      megaBackChild.className = 'nav-mega-back-child';
      megaBackLabels.append(megaBackParent, megaBackChild);
      megaBackButton.append(megaBackIcon, megaBackLabels);

      const megaHeaderExplore = document.createElement('a');
      megaHeaderExplore.className = 'nav-mega-header-explore';
      megaHeaderExplore.hidden = true;

      megaHeader.append(megaBackButton, megaHeaderExplore);

      megaInner = document.createElement('div');
      megaInner.className = 'nav-mega-inner';
      const megaList = document.createElement('div');
      megaList.className = 'nav-mega-list';
      const megaDetail = document.createElement('div');
      megaDetail.className = 'nav-mega-detail';
      const childHeaderMeta = [];

      const syncMobileMegaHeader = (activeIndex = null, forceClear = false) => {
        if (isDesktop.matches) return;
        let resolvedIndex = activeIndex;
        if (forceClear) {
          resolvedIndex = null;
        }
        if (resolvedIndex === null) {
          const activePaneIndex = megaDetail.querySelector('.nav-mega-detail-pane.is-active')?.dataset?.megaIndex;
          const activeColIndex = megaList.querySelector('.nav-mega-col.is-active')?.dataset?.megaIndex;
          const inferredIndex = activePaneIndex ?? activeColIndex;
          resolvedIndex = inferredIndex !== undefined && inferredIndex !== null
            ? Number(inferredIndex)
            : null;
        }
        const hasActive = resolvedIndex !== null && !Number.isNaN(resolvedIndex);
        if (!hasActive) {
          megaHeader.classList.remove('has-active-child');
          megaBackChild.textContent = '';
          megaHeaderExplore.hidden = true;
          megaHeaderExplore.removeAttribute('href');
          return;
        }
        const meta = childHeaderMeta[resolvedIndex] || {};
        const activeDetailPane = megaDetail.querySelector(
          `.nav-mega-detail-pane[data-mega-index="${resolvedIndex}"]`,
        );
        const fallbackLabel = megaList
          .querySelector(`.nav-mega-col[data-mega-index="${resolvedIndex}"] .nav-col-title`)
          ?.textContent
          ?.trim() || '';
        const activeChildLabel = meta.label?.trim() || fallbackLabel;
        megaBackChild.textContent = activeChildLabel;
        megaHeader.classList.toggle('has-active-child', Boolean(activeChildLabel));
        const paneExploreLink = activeDetailPane?.querySelector('.nav-col-explore');
        const exploreLabel = meta.exploreLabel?.trim()
          || paneExploreLink?.textContent?.trim()
          || '';
        const exploreUrl = meta.exploreUrl?.trim()
          || paneExploreLink?.getAttribute('href')?.trim()
          || '';
        const hasExplore = Boolean(exploreLabel);
        megaHeaderExplore.hidden = !hasExplore;
        if (hasExplore) {
          megaHeaderExplore.textContent = exploreLabel;
          if (exploreUrl) {
            megaHeaderExplore.href = exploreUrl;
          } else {
            megaHeaderExplore.removeAttribute('href');
          }
        } else {
          megaHeaderExplore.removeAttribute('href');
        }
      };

      usableChildren.forEach((child, index) => {
        const hasDescription = Boolean(child.paragraph?.replace(/<[^>]*>/g, '').trim());
        const hasExplore = Boolean(child.exploreLabel?.trim());
        const hasLinks = Boolean(
          child.linksEl?.querySelector?.('a, ul, ol, li, p')
          || child.linksEl?.textContent?.trim(),
        );
        const hasDetailContent = hasDescription || hasExplore || hasLinks;
        const childUrl = child.childUrl?.trim() || '';
        const isLinkedStaticItem = !hasDetailContent && Boolean(childUrl);
        childHeaderMeta[index] = {
          label: child.label || '',
          exploreLabel: '',
          exploreUrl: '',
        };
        let colTag = 'div';
        if (hasDetailContent) {
          colTag = 'button';
        } else if (isLinkedStaticItem) {
          colTag = 'a';
        }
        const col = document.createElement(colTag);
        col.className = 'nav-mega-col';
        if (hasDetailContent) {
          col.type = 'button';
        } else if (isLinkedStaticItem) {
          col.classList.add('nav-mega-col-link', 'nav-mega-col-static');
          col.href = childUrl;
        } else {
          col.classList.add('nav-mega-col-static');
        }
        col.dataset.megaIndex = String(index);
        if (hasDetailContent) {
          col.setAttribute('aria-expanded', 'false');
        }

        if (child.label) {
          const title = document.createElement('p');
          title.className = 'nav-col-title';
          if (isLinkedStaticItem) {
            title.classList.add('nav-col-title-has-link');
          }
          title.textContent = child.label;
          col.append(title);
        }

        if (hasDetailContent) {
          const detailPane = document.createElement('div');
          detailPane.className = 'nav-mega-detail-pane';
          detailPane.dataset.megaIndex = String(index);
          let resolvedExploreUrl = '';

          let desc = null;
          if (hasDescription || hasExplore) {
            desc = document.createElement('div');
            desc.className = 'nav-col-desc';

            if (hasDescription) {
              const descText = document.createElement('div');
              descText.className = 'nav-col-desc-text';
              descText.innerHTML = child.paragraph;
              desc.append(descText);
            }

            detailPane.append(desc);
          }

          if (hasExplore) {
            const exploreA = document.createElement('a');
            exploreA.className = 'nav-col-explore';
            exploreA.textContent = child.exploreLabel;
            // Use explicit exploreUrl field; fall back to first link in list, then item url
            resolvedExploreUrl = child.exploreUrl
              || child.linksEl?.querySelector('a')?.href
              || item.url
              || '#';
            exploreA.href = resolvedExploreUrl;
            if (desc) {
              desc.append(exploreA);
            } else {
              detailPane.append(exploreA);
            }
          }

          childHeaderMeta[index] = {
            label: child.label || '',
            exploreLabel: child.exploreLabel?.trim() || '',
            exploreUrl: resolvedExploreUrl,
          };

          if (hasLinks) {
            const linksContent = child.linksEl.cloneNode(true);
            linksContent.classList.add('nav-col-links');
            linksContent.removeAttribute('data-aue-prop');
            enhanceNavColLinks(linksContent);
            detailPane.append(linksContent);
          }

          // Hover/focus/click child label to open details in the side pane.
          col.addEventListener('mouseenter', () => {
            if (!isDesktop.matches) return;
            clearDetailHideTimer();
            setActiveMegaCol(megaInner, index);
          });
          col.addEventListener('mouseleave', (e) => {
            if (!isDesktop.matches) return;
            const nextCol = e.relatedTarget?.closest?.('.nav-mega-col');
            if (!nextCol) {
              scheduleDetailHide();
            }
          });
          col.addEventListener('focus', () => {
            if (!isDesktop.matches) return;
            clearDetailHideTimer();
            setActiveMegaCol(megaInner, index);
          });
          col.addEventListener('click', () => {
            clearDetailHideTimer();
            setActiveMegaCol(megaInner, index);
            syncMobileMegaHeader(index);
          });

          megaDetail.append(detailPane);
        }

        megaList.append(col);
      });

      megaList.addEventListener('mouseleave', () => {
        if (!isDesktop.matches) return;
        scheduleDetailHide();
      });

      megaList.addEventListener('click', (event) => {
        if (isDesktop.matches) return;
        const selectedCol = event.target.closest('.nav-mega-col');
        if (!selectedCol) return;
        const selectedIndex = Number(selectedCol.dataset.megaIndex);
        if (Number.isNaN(selectedIndex)) return;
        syncMobileMegaHeader(selectedIndex);
      });

      megaMenu.addEventListener('click', () => {
        if (isDesktop.matches) return;
        requestAnimationFrame(() => {
          syncMobileMegaHeader(null);
        });
      });

      megaDetail.addEventListener('mouseenter', () => {
        if (!isDesktop.matches) return;
        clearDetailHideTimer();
      });

      megaDetail.addEventListener('mouseleave', () => {
        if (!isDesktop.matches) return;
        scheduleDetailHide();
      });

      // Keep detail pane hidden until a child item is hovered/focused/clicked.
      setActiveMegaCol(megaInner, null);
      syncMobileMegaHeader(null);

      li.addEventListener('mouseenter', () => {
        if (!isDesktop.matches) return;
        clearDetailHideTimer();
      });
      li.addEventListener('mouseleave', () => {
        if (!isDesktop.matches) return;
        clearDetailHideTimer();
        setActiveMegaCol(megaInner, null);
      });

      megaInner.append(megaList, megaDetail);

      megaMenu.append(megaHeader, megaInner);
      li.append(trigger, megaMenu);

      megaBackButton.addEventListener('click', () => {
        if (isDesktop.matches) return;
        clearDetailHideTimer();
        li.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-expanded', 'false');
        megaMenu.setAttribute('aria-hidden', 'true');
        syncMobileMegaHeader(null, true);
        syncMobileSubpanelState(li.closest('nav'));
        trigger.focus();
      });

      // Click / keyboard toggle for accessibility
      trigger.addEventListener('click', () => {
        const isOpen = li.getAttribute('aria-expanded') === 'true';
        const navRoot = li.closest('nav');
        // Close other open items before opening a new one
        if (isDesktop.matches || !isOpen) closeAllMegaMenus(navRoot);
        const next = !isOpen;
        clearDetailHideTimer();
        li.setAttribute('aria-expanded', next ? 'true' : 'false');
        trigger.setAttribute('aria-expanded', next ? 'true' : 'false');
        megaMenu.setAttribute('aria-hidden', next ? 'false' : 'true');
        if (next) {
          setActiveMegaCol(megaInner, null);
          syncMobileMegaHeader(null);
        } else {
          syncMobileMegaHeader(null, true);
        }
        syncMobileSubpanelState(navRoot);
        // Show/hide backdrop on desktop
        if (isDesktop.matches) {
          setDesktopMenuActiveState(next);
        }
      });
    } else {
      // Leaf link — wrap in a trigger-style span so chevron is consistent
      const wrapper = document.createElement('div');
      wrapper.className = 'nav-item-leaf';
      const link = document.createElement('a');
      link.href = item.url || '#';
      link.className = 'nav-item-link';
      link.setAttribute('role', 'menuitem');
      link.textContent = item.label;
      const chevron = document.createElement('span');
      chevron.className = 'nav-item-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      wrapper.append(link, chevron);
      li.append(wrapper);
    }

    ul.append(li);
  });

  sections.append(ul);

  // ── Tools ──────────────────────────────────────────────────────────────────
  const tools = document.createElement('div');
  tools.className = 'nav-tools';

  const appendContact = () => {
    if (!data.contact) return;
    const contactA = document.createElement('a');
    contactA.href = data.contact.url || '/contact';
    contactA.className = 'nav-contact button secondary';
    contactA.textContent = data.contact.label || 'Contact';
    tools.append(contactA);
  };

  const appendLogin = () => {
    if (!data.login) return;
    const hasLoginItems = Array.isArray(data.login.items) && data.login.items.length > 0;

    if (hasLoginItems) {
      const loginWrap = document.createElement('div');
      loginWrap.className = 'nav-login nav-login-dropdown';
      loginWrap.setAttribute('aria-expanded', 'false');

      const loginTrigger = document.createElement('button');
      loginTrigger.type = 'button';
      loginTrigger.className = 'nav-login-trigger';
      loginTrigger.setAttribute('aria-expanded', 'false');
      loginTrigger.setAttribute('aria-haspopup', 'true');

      const loginText = document.createElement('span');
      loginText.textContent = data.login.label || 'Login';
      const loginChevron = document.createElement('span');
      loginChevron.className = 'nav-login-chevron';
      loginChevron.setAttribute('aria-hidden', 'true');
      loginTrigger.append(loginText, loginChevron);

      const loginMenu = document.createElement('div');
      loginMenu.className = 'nav-login-menu';
      loginMenu.setAttribute('aria-hidden', 'true');

      const loginMenuBack = document.createElement('button');
      loginMenuBack.type = 'button';
      loginMenuBack.className = 'nav-login-back';
      loginMenuBack.innerHTML = `<span class="nav-login-back-icon" aria-hidden="true"></span><span>${data.login.label || 'Login'}</span>`;

      const loginList = document.createElement('ul');
      loginList.className = 'nav-login-list';
      const normalizedLoginLabel = (data.login.label || 'Login').trim().toLowerCase();
      data.login.items.forEach((item, index) => {
        const itemLabel = (item.label || '').trim();
        if (itemLabel.toLowerCase() === normalizedLoginLabel) return;
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = item.url || '#';
        link.textContent = itemLabel || `Item ${index + 1}`;
        li.append(link);
        loginList.append(li);
      });

      loginMenu.append(loginMenuBack, loginList);
      loginWrap.append(loginTrigger, loginMenu);
      tools.append(loginWrap);

      const LOGIN_CLOSE_DELAY_MS = 500;
      let loginCloseTimer;

      const clearLoginCloseTimer = () => {
        if (loginCloseTimer) {
          clearTimeout(loginCloseTimer);
          loginCloseTimer = null;
        }
      };

      const openLoginMenu = () => {
        clearLoginCloseTimer();
        loginWrap.setAttribute('aria-expanded', 'true');
        loginTrigger.setAttribute('aria-expanded', 'true');
        loginMenu.setAttribute('aria-hidden', 'false');
        if (!isDesktop.matches) {
          loginWrap.closest('.nav-sections')?.classList.add('nav-login-open');
        }
        syncMobileSubpanelState(loginWrap.closest('nav'));
        if (isDesktop.matches) setDesktopMenuActiveState(true);
      };

      const closeLoginMenu = () => {
        clearLoginCloseTimer();
        loginWrap.setAttribute('aria-expanded', 'false');
        loginTrigger.setAttribute('aria-expanded', 'false');
        loginMenu.setAttribute('aria-hidden', 'true');
        loginWrap.closest('.nav-sections')?.classList.remove('nav-login-open');
        syncMobileSubpanelState(loginWrap.closest('nav'));
        if (isDesktop.matches) {
          const nav = loginWrap.closest('nav');
          const hasOpenMegaMenu = Boolean(nav?.querySelector('.nav-item-has-children[aria-expanded="true"], .nav-item-has-children:hover'));
          setDesktopMenuActiveState(hasOpenMegaMenu);
        }
      };

      const scheduleLoginMenuClose = () => {
        if (!isDesktop.matches) {
          closeLoginMenu();
          return;
        }
        clearLoginCloseTimer();
        loginCloseTimer = setTimeout(() => {
          closeLoginMenu();
        }, LOGIN_CLOSE_DELAY_MS);
      };

      // Align desktop behavior with mega-menu interactions.
      loginWrap.addEventListener('mouseenter', () => {
        if (!isDesktop.matches) return;
        clearLoginCloseTimer();
        closeAllMegaMenus(loginWrap.closest('nav'));
        openLoginMenu();
      });

      loginWrap.addEventListener('mouseleave', (event) => {
        if (!isDesktop.matches) return;
        if (event.relatedTarget && loginWrap.contains(event.relatedTarget)) return;
        scheduleLoginMenuClose();
      });

      loginMenu.addEventListener('mouseleave', (event) => {
        if (!isDesktop.matches) return;
        if (event.relatedTarget && loginWrap.contains(event.relatedTarget)) return;
        scheduleLoginMenuClose();
      });

      loginMenu.addEventListener('mouseenter', () => {
        if (!isDesktop.matches) return;
        clearLoginCloseTimer();
      });

      loginWrap.addEventListener('focusout', () => {
        if (!isDesktop.matches) return;
        setTimeout(() => {
          if (!loginWrap.contains(document.activeElement)) {
            closeLoginMenu();
          }
        }, 0);
      });

      loginTrigger.addEventListener('click', () => {
        const isOpen = loginWrap.getAttribute('aria-expanded') === 'true';
        closeAllMegaMenus(loginWrap.closest('nav'));
        if (!isOpen) openLoginMenu();
      });

      loginMenuBack.addEventListener('click', () => {
        closeLoginMenu();
        loginTrigger.focus();
      });
    } else {
      const loginA = document.createElement('a');
      loginA.href = data.login.url || '/login';
      loginA.className = 'nav-login nav-login-link';
      loginA.textContent = data.login.label || 'Login';
      tools.append(loginA);
    }
  };

  const appendSearch = () => {
    if (data.showSearch === false) return;
    const searchBtn = document.createElement('a');
    searchBtn.href = data.searchUrl || '/search';
    searchBtn.className = 'nav-search-btn';
    searchBtn.setAttribute('aria-label', data.searchLabel || 'Search');
    const icon = document.createElement('span');
    icon.className = 'icon icon-search';
    const img = document.createElement('img');
    img.dataset.iconName = 'search';
    img.src = '/icons/search.svg';
    img.alt = '';
    img.loading = 'lazy';
    icon.append(img);
    const label = document.createElement('span');
    label.className = 'nav-search-label';
    label.textContent = data.searchLabel || 'Search';
    searchBtn.append(icon, label);
    tools.append(searchBtn);
  };

  const appenders = {
    contact: appendContact,
    login: appendLogin,
    search: appendSearch,
  };

  if (Array.isArray(data.toolsOrder) && data.toolsOrder.length) {
    data.toolsOrder.forEach((toolName) => {
      appenders[toolName]?.();
    });
  } else {
    appendContact();
    appendLogin();
    appendSearch();
  }

  // ── Hamburger ──────────────────────────────────────────────────────────────
  const hamburger = document.createElement('div');
  hamburger.className = 'nav-hamburger';
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;

  return {
    hamburger, brand, sections, tools,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main decorate
// ─────────────────────────────────────────────────────────────────────────────

export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';

  if (!fragment) {
    // eslint-disable-next-line no-console
    console.warn(`[header] Failed to load nav fragment from "${navPath}". Check that the nav page exists at this path on the proxy origin (aem up) or that the nav metadata resolves correctly.`);
    return;
  }

  // ── Detect: new header-menu section vs. legacy 3-section fragment ───────────
  // header-section is expected as a section-level container on the nav page.
  // Keep the .header-section.block fallback for older published payloads.
  const headerSectionByContent = [...(fragment?.querySelectorAll('.section') || [])].find((section) => {
    const hasHeaderLogo = Boolean(section.querySelector('.header-logo-wrapper, .header-logo.block'));
    const hasHeaderMenus = Boolean(section.querySelector('.header-menu-item-wrapper, .header-menu-item.block'));
    const hasHeaderTools = Boolean(section.querySelector('.header-contact-wrapper, .header-login-wrapper, .header-search-wrapper'));
    return hasHeaderLogo && (hasHeaderMenus || hasHeaderTools);
  });

  let headerMenuBlock = fragment?.querySelector('.header-section.block')
    || fragment?.querySelector('.header-section')
    || fragment?.querySelector('[data-aue-component="header-section"]')
    || fragment?.querySelector('[data-aue-model="header-section"]')
    || fragment?.querySelector('.header-section-container > .section')
    || fragment?.querySelector('.header-section-container')
    || headerSectionByContent;

  // ── Flat-paragraph fallback ───────────────────────────────────────────────
  // When the nav page on AEM Preview was published in an older/flat format,
  // all content ends up as <p> elements in a single default-content-wrapper
  // instead of a proper header-section block. Detect this and synthesise a
  // virtual block element so parseHeaderMenuBlock can still run.
  if (!headerMenuBlock) {
    const dcw = fragment?.querySelector('.default-content-wrapper');
    const hasFlatParagraphs = dcw && dcw.querySelector('picture, img');
    if (hasFlatParagraphs) {
      // Build a synthetic header-section from flat p/ul payload.
      const synth = document.createElement('div');
      const nodes = [...dcw.children].filter((el) => el.matches('p, ul'));

      const getText = (el) => el?.textContent?.trim() || '';
      const hasLink = (el) => !!el?.querySelector('a');
      const getHref = (el) => el?.querySelector('a')?.getAttribute('href') || '';
      const isBoolText = (text) => text === 'true' || text === 'false';
      const isUrlLike = (text) => /^https?:\/\//i.test(text)
        || /^www\./i.test(text)
        || text.startsWith('/');
      const isContactLabel = (text) => /\bcontact\b/i.test(text);
      const isLoginLabel = (text) => /\b(login|log in|sign in|signin)\b/i.test(text);
      const isExploreLabel = (text) => /\b(explore|learn more|read more|discover|view all)\b/i.test(text);

      const buildProp = (name, value = '') => {
        const div = document.createElement('div');
        div.dataset.aueProp = name;
        div.textContent = value;
        return div;
      };

      const appendMenuRow = (label, isChild = false, url = '') => {
        const row = document.createElement('div');
        row.dataset.aueComponent = 'header-menu-item';
        row.append(
          buildProp('label', label || ''),
          buildProp('isChild', String(isChild)),
          buildProp('url', url || ''),
        );
        synth.append(row);
      };

      const appendChildRow = ({
        label = '', childUrl = '', paragraph = '', exploreLabel = '', exploreUrl = '', linksEl = null,
      }) => {
        const row = document.createElement('div');
        row.dataset.aueComponent = 'header-nav-child';

        const childLabel = buildProp('childLabel', label);
        const childUrlEl = buildProp('childUrl', childUrl);
        const description = document.createElement('div');
        description.dataset.aueProp = 'description';
        description.innerHTML = paragraph || '';

        const exploreLabelEl = buildProp('exploreLabel', exploreLabel || '');
        const exploreUrlEl = buildProp('exploreUrl', exploreUrl || '');

        const links = document.createElement('div');
        links.dataset.aueProp = 'links';
        if (linksEl) links.append(linksEl.cloneNode(true));

        row.append(childLabel, childUrlEl, description, exploreLabelEl, exploreUrlEl, links);
        synth.append(row);
      };

      const appendSearchRow = (showSearch = true, label = 'Search', url = '/search') => {
        const row = document.createElement('div');
        row.dataset.aueComponent = 'header-search';
        const showDiv = document.createElement('div');
        showDiv.textContent = String(showSearch);
        const labelDiv = document.createElement('div');
        labelDiv.textContent = label;
        const urlDiv = document.createElement('div');
        urlDiv.textContent = url;
        row.append(showDiv, labelDiv, urlDiv);
        synth.append(row);
      };

      const appendLoginRow = (label = 'Login', url = '/login', items = []) => {
        const row = document.createElement('div');
        row.dataset.aueComponent = 'header-login';

        const labelDiv = document.createElement('div');
        labelDiv.textContent = label;
        const urlDiv = document.createElement('div');
        urlDiv.textContent = url;
        row.append(labelDiv, urlDiv);

        items.slice(0, 7).forEach((item) => {
          const itemLabelDiv = document.createElement('div');
          itemLabelDiv.textContent = item.label || '';
          const itemUrlDiv = document.createElement('div');
          itemUrlDiv.textContent = item.url || '';
          row.append(itemLabelDiv, itemUrlDiv);
        });

        synth.append(row);
      };

      let i = 0;

      // ── Logo row (3 images + alt + url) ──────────────────────────────────
      const logoRow = document.createElement('div');
      logoRow.dataset.aueComponent = 'header-logo';
      for (let imgCount = 0; i < nodes.length && imgCount < 3 && nodes[i].querySelector('picture, img'); imgCount += 1, i += 1) {
        const imgDiv = document.createElement('div');
        imgDiv.append(nodes[i].cloneNode(true));
        logoRow.append(imgDiv);
      }

      const altDiv = document.createElement('div');
      if (i < nodes.length && nodes[i].tagName === 'P'
          && !nodes[i].querySelector('a, picture, img')
          && !isBoolText(getText(nodes[i]))) {
        altDiv.textContent = getText(nodes[i]);
        i += 1;
      }
      logoRow.append(altDiv);

      const urlDiv = document.createElement('div');
      if (i < nodes.length && nodes[i].tagName === 'P' && hasLink(nodes[i])) {
        urlDiv.textContent = getHref(nodes[i]);
        i += 1;
      }
      logoRow.append(urlDiv);
      synth.append(logoRow);

      let hasOpenMenu = false;

      // ── Remaining rows (menu + children + tools/search) ──────────────────
      /* eslint-disable no-continue */
      while (i < nodes.length) {
        const node = nodes[i];

        if (node.tagName === 'UL') {
          if (hasOpenMenu) {
            appendChildRow({ linksEl: node });
          }
          i += 1;
          continue;
        }

        const text = getText(node);
        const lower = text.toLowerCase();

        // Standalone trailing boolean is treated as search toggle.
        if (isBoolText(text)) {
          appendSearchRow(text === 'true', 'Search', '/search');
          hasOpenMenu = false;
          i += 1;
          continue;
        }

        // Contact / Login rows (support variants like "Contact Us")
        if (isContactLabel(text) || isLoginLabel(text)) {
          const isContact = isContactLabel(text);

          if (isContact) {
            const next = nodes[i + 1];
            const url = next?.tagName === 'P'
              ? (getHref(next) || getText(next) || '/contact')
              : '/contact';
            const row = document.createElement('div');
            row.dataset.aueComponent = 'header-contact';
            const l = document.createElement('div'); l.textContent = text;
            const u = document.createElement('div'); u.textContent = url;
            row.append(l, u);
            synth.append(row);
            hasOpenMenu = false;
            i += next?.tagName === 'P' ? 2 : 1;
            continue;
          }

          let cursor = i + 1;
          let loginUrl = '/login';

          if (cursor < nodes.length && nodes[cursor].tagName === 'P') {
            loginUrl = getHref(nodes[cursor]) || getText(nodes[cursor]) || '/login';
            cursor += 1;
          }

          const loginItems = [];
          for (let itemNumber = 1; itemNumber <= 7 && cursor + 1 < nodes.length; itemNumber += 1) {
            const labelNode = nodes[cursor];
            const urlNode = nodes[cursor + 1];

            if (labelNode?.tagName !== 'P' || urlNode?.tagName !== 'P') break;

            const itemLabel = getText(labelNode);
            const itemUrlText = getText(urlNode);
            const itemHref = getHref(urlNode);
            const isValidItem = itemLabel
              && !isBoolText(itemLabel)
              && itemLabel.toLowerCase() !== 'search'
              && !isContactLabel(itemLabel)
              && (itemHref || isUrlLike(itemUrlText));

            if (!isValidItem) break;

            loginItems.push({
              label: itemLabel,
              url: itemHref || itemUrlText,
            });
            cursor += 2;
          }

          appendLoginRow(text, loginUrl, loginItems);
          hasOpenMenu = false;
          i = cursor;
          continue;
        }

        if (lower === 'search') {
          let cursor = i + 1;
          const searchLabel = text || 'Search';
          let searchUrl = '/search';
          let showSearch = true;

          if (cursor < nodes.length && nodes[cursor].tagName === 'P') {
            const urlText = getText(nodes[cursor]);
            const href = getHref(nodes[cursor]);
            if (href || isUrlLike(urlText)) {
              searchUrl = href || urlText;
              cursor += 1;
            }
          }

          if (cursor < nodes.length && nodes[cursor].tagName === 'P') {
            const boolText = getText(nodes[cursor]);
            if (isBoolText(boolText)) {
              showSearch = boolText === 'true';
              cursor += 1;
            }
          }

          appendSearchRow(showSearch, searchLabel, searchUrl);
          hasOpenMenu = false;
          i = cursor;
          continue;
        }

        // Top-level menu item: label followed by a bool marker.
        const next = nodes[i + 1];
        if (next?.tagName === 'P' && isBoolText(getText(next))) {
          appendMenuRow(text, getText(next) === 'true', hasLink(node) ? getHref(node) : '');
          hasOpenMenu = true;
          i += 2;
          continue;
        }

        // Flat child row under the current open menu item.
        if (hasOpenMenu) {
          const child = {
            label: text,
            childUrl: '',
            paragraph: '',
            exploreLabel: '',
            exploreUrl: '',
            linksEl: null,
          };

          let cursor = i + 1;

          // Optional description paragraph
          if (cursor < nodes.length && nodes[cursor].tagName === 'P') {
            const descText = getText(nodes[cursor]);
            const looksLikeDesc = descText.length > 70 || /[.,;:-]/.test(descText);
            if (!isBoolText(descText) && looksLikeDesc) {
              child.paragraph = nodes[cursor].innerHTML;
              cursor += 1;
            }
          }

          // Optional explore label + URL pair
          if (cursor + 1 < nodes.length
              && nodes[cursor].tagName === 'P'
              && nodes[cursor + 1].tagName === 'P') {
            const exploreText = getText(nodes[cursor]);
            const exploreUrlNode = nodes[cursor + 1];
            const exploreUrlText = getText(exploreUrlNode);
            const exploreHref = getHref(exploreUrlNode);
            if (!isBoolText(exploreText)
                && isExploreLabel(exploreText)
                && (exploreHref || isUrlLike(exploreUrlText))) {
              child.exploreLabel = exploreText;
              child.exploreUrl = exploreHref || exploreUrlText;
              cursor += 2;
            }
          }

          // Optional links list
          if (cursor < nodes.length && nodes[cursor].tagName === 'UL') {
            child.linksEl = nodes[cursor].cloneNode(true);
            cursor += 1;
          }

          appendChildRow(child);
          i = cursor;
          continue;
        }

        // Fallback leaf if no open menu context.
        appendMenuRow(text, false, hasLink(node) ? getHref(node) : '');
        hasOpenMenu = false;
        i += 1;
      }
      /* eslint-enable no-continue */

      headerMenuBlock = synth;
    }
  }

  // ── UE authoring: ensure header-menu-item behaves as a container block for nav-children ──
  if (headerMenuBlock) {
    headerMenuBlock.querySelectorAll('[data-aue-component="header-menu-item"]').forEach((el) => {
      el.dataset.aueType = 'container';
      el.dataset.aueFilter = 'header-menu-item';
    });
  }

  if (headerMenuBlock) {
    // ── NEW MEGA-MENU PATH ────────────────────────────────────────────────────
    const data = parseHeaderMenuBlock(headerMenuBlock);

    // Mount news strip (below sticky header) if configured in the nav page.
    if (data.newsStrip) {
      buildNewsStrip(data.newsStrip);
    }

    const {
      hamburger, brand, sections, tools,
    } = buildNavFromHeaderMenu(data);

    const hamburgerButton = hamburger.querySelector('button');
    const closeMenuButton = document.createElement('button');
    closeMenuButton.type = 'button';
    closeMenuButton.className = 'nav-menu-close';
    closeMenuButton.setAttribute('aria-label', 'Close navigation');
    closeMenuButton.innerHTML = '<span class="nav-menu-close-icon" aria-hidden="true"></span>';
    sections.prepend(closeMenuButton);

    const closeMobileMenu = () => {
      nav.setAttribute('aria-expanded', 'false');
      document.body.style.overflowY = '';
      hamburgerButton?.setAttribute('aria-label', 'Open navigation');
      nav.classList.remove(MOBILE_SUBPANEL_OPEN_CLASS);
      sections.classList.remove('nav-login-open');
      document.body.classList.remove(HEADER_MENU_ACTIVE_BODY_CLASS);
      setDesktopMenuActiveState(false);
    };

    const resetNavState = () => {
      closeAllMegaMenus(nav);
      closeMobileMenu();
    };

    nav.setAttribute('aria-expanded', 'false');
    nav.append(brand, sections, tools);

    const sectionsList = sections.querySelector(':scope > ul');
    const loginControl = tools.querySelector('.nav-login');
    const MOBILE_LOGIN_ITEM_CLASS = 'nav-mobile-login-item';
    const loginAnchor = loginControl ? document.createComment('nav-login-anchor') : null;
    if (loginAnchor && loginControl.parentNode === tools) {
      tools.insertBefore(loginAnchor, loginControl);
    }

    const moveLoginIntoSections = () => {
      if (!sectionsList || !loginControl) return;
      let mobileItem = sectionsList.querySelector(`:scope > li.${MOBILE_LOGIN_ITEM_CLASS}`);
      if (!mobileItem) {
        mobileItem = document.createElement('li');
        mobileItem.className = `nav-item ${MOBILE_LOGIN_ITEM_CLASS}`;
        mobileItem.setAttribute('role', 'none');
        sectionsList.append(mobileItem);
      }
      if (!mobileItem.contains(loginControl)) {
        mobileItem.append(loginControl);
      }
    };

    const moveLoginBackToTools = () => {
      if (!loginControl) return;
      sectionsList?.querySelector(`:scope > li.${MOBILE_LOGIN_ITEM_CLASS}`)?.remove();
      if (loginAnchor?.parentNode === tools) {
        tools.insertBefore(loginControl, loginAnchor.nextSibling);
      } else if (loginControl.parentNode !== tools) {
        tools.append(loginControl);
      }
    };

    const syncMobileLoginPlacement = () => {
      if (isDesktop.matches) {
        moveLoginBackToTools();
      } else {
        moveLoginIntoSections();
      }
    };

    // Hamburger toggles mobile nav
    hamburgerButton.addEventListener('click', () => {
      if (isDesktop.matches) return;
      const expanded = nav.getAttribute('aria-expanded') === 'true';
      if (expanded) return;
      nav.setAttribute('aria-expanded', 'true');
      document.body.style.overflowY = 'hidden';
      hamburgerButton.setAttribute('aria-label', 'Open navigation');
      document.body.classList.add(HEADER_MENU_ACTIVE_BODY_CLASS);
    });

    closeMenuButton.addEventListener('click', () => {
      if (isDesktop.matches) return;
      closeMobileMenu();
    });

    const syncHamburger = () => {
      syncMobileLoginPlacement();
      if (isDesktop.matches) {
        resetNavState();
        hamburger.remove();
      } else if (!nav.contains(hamburger)) {
        resetNavState();
        nav.append(hamburger);
      }
    };

    syncHamburger();
    isDesktop.addEventListener('change', syncHamburger);

    // Close mega-menus on outside click
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target)) {
        closeAllMegaMenus(nav);
        closeMobileMenu();
      }
    });

    // Close mega-menus on Escape
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        closeAllMegaMenus(nav);
        // If mobile menu open, close it too
        if (!isDesktop.matches && nav.getAttribute('aria-expanded') === 'true') {
          closeMobileMenu();
        }
      }
    });
  } else {
    // ── LEGACY 3-SECTION PATH ─────────────────────────────────────────────────
    while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

    const classes = ['brand', 'sections', 'tools'];
    classes.forEach((c, i) => {
      const section = nav.children[i];
      if (section) section.classList.add(`nav-${c}`);
    });

    const navBrand = nav.querySelector('.nav-brand');
    const brandLink = navBrand?.querySelector('.button');
    if (brandLink) {
      brandLink.className = '';
      const buttonContainer = brandLink.closest('.button-container');
      if (buttonContainer) buttonContainer.className = '';
    }

    const navSections = nav.querySelector('.nav-sections');
    if (navSections) {
      navSections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((navSection) => {
        if (navSection.querySelector('ul')) navSection.classList.add('nav-drop');
        navSection.addEventListener('click', () => {
          if (isDesktop.matches) {
            const expanded = navSection.getAttribute('aria-expanded') === 'true';
            toggleAllNavSections(navSections);
            navSection.setAttribute('aria-expanded', expanded ? 'false' : 'true');
          }
        });
      });
      navSections.querySelectorAll('.button-container').forEach((buttonContainer) => {
        buttonContainer.classList.remove('button-container');
        const btn = buttonContainer.querySelector('.button');
        if (btn) btn.classList.remove('button');
      });
    }

    const navTools = nav.querySelector('.nav-tools');
    if (navTools) {
      const search = navTools.querySelector('a[href*="search"]');
      if (search && search.textContent === '') {
        search.setAttribute('aria-label', 'Search');
      }
    }

    const hamburger = document.createElement('div');
    hamburger.classList.add('nav-hamburger');
    hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
        <span class="nav-hamburger-icon"></span>
      </button>`;
    hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
    nav.prepend(hamburger);
    nav.setAttribute('aria-expanded', 'false');
    toggleMenu(nav, navSections, isDesktop.matches);
    isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));
  }

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);

  // ── Backdrop (desktop mega-menu) ───────────────────────────────────────────
  // One backdrop element per page — clicking it closes all mega-menus.
  if (!document.querySelector('.nav-backdrop')) {
    const backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.addEventListener('click', () => closeAllMegaMenus(nav));
    document.body.append(backdrop);
  }

  if (getMetadata('breadcrumbs').toLowerCase() === 'true') {
    navWrapper.append(await buildBreadcrumbs());
  }

  // UE authoring: on the nav page, allow header-section to be added inside sections.
  // This is done here (inside the header block) so all header-related UE config
  // stays within the header tag's own scope.
  // Comparison handles both localhost (/nav) and AEM author (/content/foo/nav.html).
  const currentPath = window.location.pathname.replace(/\.html$/, '');
  if (currentPath === navPath || currentPath.endsWith(navPath)) {
    document.querySelectorAll('main > .section').forEach((section) => {
      section.dataset.aueFilter = 'nav-section';
    });
  }
}
