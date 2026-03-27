import { toClassName } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

function normalizeTargetValue(value = '') {
  const cleanedValue = value
    .trim()
    .replace(/^#/, '')
    .replace(/^section\./i, '');

  return toClassName(cleanedValue);
}

function parseTarget(targetToken) {
  const bareSectionMatch = targetToken.match(/^section-?(\d+)$/);
  if (bareSectionMatch) {
    const position = Number(bareSectionMatch[1]);
    return {
      type: 'bare-section',
      position,
      preferredId: `section${position}`,
    };
  }

  const indexedClassMatch = targetToken.match(/^(.*)-(\d+)$/);
  if (indexedClassMatch) {
    const className = indexedClassMatch[1];
    const position = Number(indexedClassMatch[2]);
    return {
      type: 'class-section',
      className,
      position,
      preferredId: targetToken,
    };
  }

  return {
    type: 'class-section',
    className: targetToken,
    position: 1,
    preferredId: targetToken,
  };
}

function getBareSections() {
  return [...document.querySelectorAll('main > .section')]
    .filter((section) => section.classList.length === 1);
}

function resolveSectionTarget(targetToken) {
  const parsedTarget = parseTarget(targetToken);

  if (parsedTarget.type === 'bare-section') {
    const bareSections = getBareSections();
    const section = bareSections[parsedTarget.position - 1];
    return section
      ? { section, preferredId: parsedTarget.preferredId }
      : null;
  }

  const escapedClassName = window.CSS?.escape
    ? window.CSS.escape(parsedTarget.className)
    : parsedTarget.className;

  const matchingSections = [...document.querySelectorAll(`main > .section.${escapedClassName}`)];
  const section = matchingSections[parsedTarget.position - 1];

  return section
    ? { section, preferredId: parsedTarget.preferredId }
    : null;
}

function ensureSectionId(section, preferredId, assignedIds) {
  if (assignedIds.has(section)) {
    return assignedIds.get(section);
  }

  if (section.id) {
    assignedIds.set(section, section.id);
    return section.id;
  }

  let id = preferredId;
  let duplicate = document.getElementById(id);
  let suffix = 2;

  while (duplicate && duplicate !== section) {
    id = `${preferredId}-${suffix}`;
    duplicate = document.getElementById(id);
    suffix += 1;
  }

  section.id = id;
  assignedIds.set(section, id);
  return id;
}

function setActiveLinkState(links, activeId) {
  links.forEach((link) => {
    const isActive = link.hash.slice(1) === activeId;
    link.classList.toggle('is-active', isActive);

    if (isActive) {
      link.setAttribute('aria-current', 'location');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function scrollToTarget(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return false;

  const rootStyles = getComputedStyle(document.documentElement);
  const navHeight = parseFloat(rootStyles.getPropertyValue('--nav-height')) || 0;
  const sectionGap = parseFloat(rootStyles.getPropertyValue('--spacing-400')) || 0;
  const top = target.getBoundingClientRect().top + window.scrollY - navHeight - sectionGap;

  window.scrollTo({
    top: Math.max(top, 0),
    behavior: 'smooth',
  });

  return true;
}

function isClassesConfigRow(cells) {
  if (cells.length < 2) return false;
  return cells[0].textContent.trim().toLowerCase() === 'classes';
}

function readTabRows(block) {
  return [...block.children]
    .map((row) => {
      const cells = [...row.children].filter((cell) => cell.tagName === 'DIV');
      if (cells.length < 2 || isClassesConfigRow(cells)) return null;

      const [titleCell, targetCell] = cells;
      const title = titleCell.textContent.trim();
      const target = normalizeTargetValue(targetCell.textContent);
      if (!title || !target) return null;

      return {
        row,
        title,
        target,
      };
    })
    .filter(Boolean);
}

export default function decorate(block) {
  const rowData = readTabRows(block);
  if (!rowData.length) {
    block.textContent = '';
    return;
  }

  const nav = document.createElement('nav');
  nav.className = 'tabs-nav';
  nav.setAttribute('aria-label', 'Table of contents');

  const list = document.createElement('ul');
  list.className = 'tabs-list';

  const links = [];
  const assignedIds = new Map();

  rowData.forEach(({ row, title, target }) => {
    const resolvedTarget = resolveSectionTarget(target);

    if (!resolvedTarget) {
      // eslint-disable-next-line no-console
      console.warn(`[tabs] No section found for target "${target}".`);
      return;
    }

    const id = ensureSectionId(resolvedTarget.section, resolvedTarget.preferredId, assignedIds);

    const item = document.createElement('li');
    item.className = 'tabs-item';
    moveInstrumentation(row, item);

    const link = document.createElement('a');
    link.className = 'tabs-link';
    link.href = `#${id}`;
    link.textContent = title;

    item.append(link);
    list.append(item);
    links.push(link);
  });

  if (!links.length) {
    block.textContent = '';
    return;
  }

  nav.append(list);
  block.replaceChildren(nav);

  const hashedTarget = decodeURIComponent(window.location.hash.replace('#', ''));
  const initialActiveTarget = hashedTarget || links[0].hash.slice(1);
  setActiveLinkState(links, initialActiveTarget);

  block.addEventListener('click', (event) => {
    const link = event.target.closest('.tabs-link');
    if (!link) return;

    const targetId = decodeURIComponent(link.hash.replace('#', ''));
    if (!targetId) return;

    if (scrollToTarget(targetId)) {
      event.preventDefault();
      setActiveLinkState(links, targetId);
      window.history.replaceState(null, '', `#${targetId}`);
    }
  });
}
