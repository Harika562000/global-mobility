// eslint-disable-next-line import/no-unresolved
import { moveInstrumentation } from '../../scripts/scripts.js';

// keep track globally of the number of tab blocks on the page
let tabBlockCnt = 0;

function setActiveTab(tablist, tabpanel, button) {
  tabpanel.parentElement.querySelectorAll('.tabs-panel').forEach((panel) => {
    panel.setAttribute('aria-hidden', true);
  });

  tablist.querySelectorAll('button').forEach((btn) => {
    btn.setAttribute('aria-selected', false);
    btn.setAttribute('tabindex', '-1');
  });

  tabpanel.setAttribute('aria-hidden', false);
  button.setAttribute('aria-selected', true);
  button.setAttribute('tabindex', '0');
}

function setCurrentTocLink(tocItems, activeLink) {
  tocItems.forEach(({ link }) => {
    if (link === activeLink) {
      link.setAttribute('aria-current', 'true');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function getSectionReference(row) {
  return row.children[1]?.textContent.trim() || '';
}

function findSectionTarget(block, sectionReference) {
  if (!sectionReference) {
    return null;
  }

  const pageRoot = block.closest('main') || document;
  const escapedReference = window.CSS?.escape
    ? window.CSS.escape(sectionReference)
    : sectionReference;

  return pageRoot.querySelector(`.section[data-id="${escapedReference}"]`);
}

export default async function decorate(block) {
  const isTableOfContents = block.classList.contains('table-of-contents');
  // const isAuthorMode = !!document.querySelector('[data-aue-resource]')
  //   || !!document.querySelector('script[src$="/scripts/editor-support.js"]');
  const IsAuthorEditMode = !!window.location.ancestorOrigins.length && window.location.pathname.endsWith('.html');
  const panelRows = [...block.children]
    .filter((child) => child.firstElementChild && child.firstElementChild.children.length > 0);
  const tocItems = [];
  let hasExternalTargets = false;

  // build tablist
  const tablist = document.createElement(isTableOfContents && !IsAuthorEditMode ? 'nav' : 'div');
  tablist.className = 'tabs-list';
  tablist.id = `tablist-${tabBlockCnt += 1}`;
  if (isTableOfContents && !IsAuthorEditMode) {
    tablist.setAttribute('aria-label', 'Table of contents');
  } else {
    tablist.setAttribute('role', 'tablist');
  }

  // the first cell of each row is the title of the tab
  const tabHeadings = panelRows.map((child) => child.firstElementChild);

  tabHeadings.forEach((tab, i) => {
    const id = `tabpanel-${tabBlockCnt}-tab-${i + 1}`;

    // decorate tabpanel
    const tabpanel = panelRows[i];
    const sectionReference = isTableOfContents ? getSectionReference(tabpanel) : '';
    const sectionTarget = isTableOfContents ? findSectionTarget(block, sectionReference) : null;
    tabpanel.className = 'tabs-panel';
    tabpanel.id = id;

    if (isTableOfContents && !IsAuthorEditMode) {
      tabpanel.removeAttribute('aria-hidden');
      tabpanel.removeAttribute('aria-labelledby');
      tabpanel.removeAttribute('role');
    } else {
      tabpanel.setAttribute('aria-hidden', !!i);
      tabpanel.setAttribute('aria-labelledby', `tab-${id}`);
      tabpanel.setAttribute('role', 'tabpanel');
    }

    // build tab control
    const control = document.createElement(isTableOfContents && !IsAuthorEditMode ? 'a' : 'button');
    control.className = 'tabs-tab';
    control.id = `tab-${id}`;
    control.innerHTML = tab.innerHTML;

    if (isTableOfContents && !IsAuthorEditMode) {
      const targetId = sectionTarget?.dataset.id || sectionReference;

      if (sectionTarget && targetId) {
        sectionTarget.id = targetId;
        hasExternalTargets = true;
      } else if (targetId) {
        tabpanel.id = targetId;
      }

      control.href = targetId ? `#${targetId}` : '#';
      tocItems.push({ link: control, panel: sectionTarget || tabpanel });
    } else {
      control.setAttribute('aria-controls', id);
      control.setAttribute('aria-selected', !i);
      control.setAttribute('role', 'tab');
      control.setAttribute('type', 'button');
      control.setAttribute('tabindex', i ? '-1' : '0');

      control.addEventListener('click', () => {
        setActiveTab(tablist, tabpanel, control);
      });
    }

    // add the new tab list button, to the tablist
    tablist.append(control);

    // remove the tab heading from the dom, which also removes it from the UE tree
    tab.remove();

    if (isTableOfContents && !IsAuthorEditMode && tabpanel.children[0]) {
      tabpanel.children[0].remove();
    }

    // remove the instrumentation from the button's h1, h2 etc (this removes it from the tree)
    if (control.firstElementChild) {
      moveInstrumentation(control.firstElementChild, null);
    }
  });

  if (isTableOfContents && !IsAuthorEditMode && hasExternalTargets) {
    block.classList.add('links-only');
    panelRows.forEach((panel) => {
      if (panel.parentElement === block) {
        panel.remove();
      }
    });
  }

  block.prepend(tablist);

  if (isTableOfContents && tocItems.length) {
    const hash = window.location.hash.replace('#', '');
    const initialItem = tocItems.find(({ panel }) => panel.id === hash) ?? tocItems[0];
    const visiblePanels = new Map();

    setCurrentTocLink(tocItems, initialItem.link);

    tocItems.forEach(({ link }) => {
      link.addEventListener('click', (event) => {
        const targetId = link.getAttribute('href')?.replace('#', '');
        const targetElement = targetId ? document.getElementById(targetId) : null;

        if (targetElement) {
          event.preventDefault();
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
          window.history.replaceState(null, '', `#${targetId}`);
        }

        setCurrentTocLink(tocItems, link);
      });
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visiblePanels.set(entry.target.id, entry.intersectionRatio);
          } else {
            visiblePanels.delete(entry.target.id);
          }
        });

        const [activePanelId] = [...visiblePanels.entries()]
          .sort(([, firstRatio], [, secondRatio]) => secondRatio - firstRatio)[0] || [];
        const activeItem = tocItems.find(({ panel }) => panel.id === activePanelId);

        if (activeItem) {
          setCurrentTocLink(tocItems, activeItem.link);
        }
      }, {
        rootMargin: '-20% 0px -65% 0px',
        threshold: [0.15, 0.35, 0.6],
      });

      tocItems.forEach(({ panel }) => {
        observer.observe(panel);
      });
    }
  }
}
