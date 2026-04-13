import { decorateIcons } from '../../scripts/aem.js';
import { moveInstrumentation, eyebrowDecorator } from '../../scripts/scripts.js';

const PHONE_REGEX = /[^\d+]/g;
const REGION_NAMES = ['am', 'apac', 'emea'];
/* Map card order (Americas, APAC, EMEA) to map position left?right (Americas, EMEA, APAC) */
const CARD_INDEX_TO_GEOTAG_ORDER = [0, 2, 1];

function getValueCell(row) {
  if (!row) return null;
  return row.children.length > 1 ? row.children[1] : row.children[0] || row;
}

function getPlainText(row) {
  const cell = getValueCell(row);
  return (cell?.textContent || '').trim();
}

function parseTitleAndPhone(col) {
  const heading = col.querySelector('h5');
  const paragraphs = col.querySelectorAll('p');

  if (heading && paragraphs.length >= 1) {
    return { title: heading.textContent.trim(), phone: paragraphs[0].textContent.trim() };
  }

  if (paragraphs.length >= 2) {
    return { title: paragraphs[0].textContent.trim(), phone: paragraphs[1].textContent.trim() };
  }
  const p = col.querySelector('p');
  if (p) {
    const html = p.innerHTML.trim();
    if (html.includes('<br>') || html.includes('<br/>') || html.includes('<br />')) {
      const parts = p.innerText.split(/\n/).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) return { title: parts[0], phone: parts[1] };
    }
    const text = p.textContent.trim();
    const match = text.match(/^(.+?)\s+([+\d][\d\s\-().]+)$/);
    if (match) return { title: match[1].trim(), phone: match[2].trim() };
  }
  return null;
}

function buildCardContent(title, phone, regionIndex) {
  const phoneClean = phone.replace(PHONE_REGEX, '');

  const card = document.createElement('a');
  card.className = 'contact-card';
  card.href = `tel:${phoneClean}`;
  card.dataset.region = String(regionIndex);

  const titleEl = document.createElement('p');
  titleEl.className = 'contact-card-title';
  titleEl.textContent = title;

  const phoneRow = document.createElement('div');
  phoneRow.className = 'contact-card-phone';

  const iconContainer = document.createElement('div');
  iconContainer.className = 'contact-card-icon';
  const iconSpan = document.createElement('span');
  iconSpan.className = 'icon icon-phone';
  iconContainer.appendChild(iconSpan);

  const phoneText = document.createElement('span');
  phoneText.className = 'contact-card-number';
  phoneText.textContent = phone;

  phoneRow.appendChild(iconContainer);
  phoneRow.appendChild(phoneText);
  card.appendChild(titleEl);
  card.appendChild(phoneRow);

  return card;
}

function buildCard(col, regionIndex) {
  const parsed = parseTitleAndPhone(col);
  if (!parsed) return null;
  const card = buildCardContent(parsed.title, parsed.phone, regionIndex);
  moveInstrumentation(col, card);
  return card;
}

/**
 * UE row-based fields (after optional block title row):
 * eyebrow, heading, [body], contact1Title, contact1Phone, … up to 3 pairs.
 * Body row is present only when the authored model includes it (9 rows vs 8).
 */
function buildCardFromFieldRows(titleRow, phoneRow, regionIndex) {
  const title = getPlainText(titleRow);
  const phone = getPlainText(phoneRow);
  if (!title || !phone) return null;
  const card = buildCardContent(title, phone, regionIndex);
  const inst = getValueCell(titleRow) || titleRow;
  moveInstrumentation(inst, card);
  return card;
}

function buildIntro(eyebrowRow, headingRow, bodyRow) {
  const intro = document.createElement('div');
  intro.className = 'contact-details-intro';

  if (eyebrowRow) {
    const text = getPlainText(eyebrowRow);
    if (text) {
      const formatted = eyebrowDecorator(text, 'accent-color');
      if (formatted) intro.appendChild(formatted);
    }
  }

  if (headingRow) {
    const cell = getValueCell(headingRow);
    if (cell?.innerHTML?.trim()) {
      const wrap = document.createElement('div');
      wrap.className = 'contact-details-heading';
      wrap.innerHTML = cell.innerHTML;
      intro.appendChild(wrap);
    }
  }

  if (bodyRow) {
    const cell = getValueCell(bodyRow);
    if (cell?.innerHTML?.trim()) {
      const wrap = document.createElement('div');
      wrap.className = 'contact-details-body';
      wrap.innerHTML = cell.innerHTML;
      intro.appendChild(wrap);
    }
  }

  return intro.children.length ? intro : null;
}

function buildGeotag(regionIndex) {
  const outer = document.createElement('div');
  outer.className = 'contact-geotag';
  outer.dataset.region = String(regionIndex);

  const inner = document.createElement('div');
  inner.className = 'contact-geotag-inner';

  const iconBase = `${window.hlx.codeBasePath}/icons`;
  const wrap = document.createElement('span');
  wrap.className = 'contact-geotag-icons';

  const imgDefault = document.createElement('img');
  imgDefault.className = 'contact-geotag-img contact-geotag-img-default';
  imgDefault.src = `${iconBase}/geotag.svg`;
  imgDefault.alt = '';
  imgDefault.loading = 'lazy';
  imgDefault.width = 16;
  imgDefault.height = 16;

  const imgHover = document.createElement('img');
  imgHover.className = 'contact-geotag-img contact-geotag-img-hover';
  imgHover.src = `${iconBase}/geotag-hover.svg`;
  imgHover.alt = '';
  imgHover.loading = 'lazy';
  imgHover.width = 16;
  imgHover.height = 16;

  wrap.append(imgDefault, imgHover);
  inner.appendChild(wrap);
  outer.appendChild(inner);

  return outer;
}

async function loadMapSvg(mapEl) {
  try {
    const base = `${window.hlx.codeBasePath}/blocks/contact-details`;
    const resp = await fetch(`${base}/world-map.svg`);
    if (!resp.ok) return;
    const svgText = await resp.text();
    const wrapper = document.createElement('div');
    wrapper.className = 'contact-map-svg';
    wrapper.innerHTML = svgText;
    const svg = wrapper.querySelector('svg');
    if (svg) {
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.removeAttribute('viewBox');
      svg.setAttribute('viewBox', '0 0 539 266');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }
    mapEl.prepend(wrapper);

    REGION_NAMES.forEach((name) => {
      const overlay = document.createElement('div');
      overlay.className = `contact-map-region contact-map-region-${name}`;
      const img = document.createElement('img');
      img.src = `${base}/region-${name}.svg`;
      img.alt = '';
      img.loading = 'lazy';
      overlay.appendChild(img);
      mapEl.appendChild(overlay);
    });
  } catch {
    /* map is decorative — fail silently */
  }
}

function buildMap(cardCount) {
  const map = document.createElement('div');
  map.className = 'contact-map';

  const geotagContainer = document.createElement('div');
  geotagContainer.className = 'contact-map-geotags';

  for (let i = 0; i < cardCount; i += 1) {
    const cardIndexForThisPin = CARD_INDEX_TO_GEOTAG_ORDER[i];
    geotagContainer.appendChild(buildGeotag(cardIndexForThisPin));
  }

  map.appendChild(geotagContainer);
  loadMapSvg(map);
  return map;
}

function addHoverInteraction(block) {
  const cards = block.querySelectorAll('.contact-card');
  const geotags = block.querySelectorAll('.contact-geotag');
  const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  function clearHighlight() {
    delete block.dataset.activeRegion;
    geotags.forEach((pin) => pin.classList.remove('active'));
  }

  function highlight(card) {
    const idx = card.dataset.region;
    const regionName = REGION_NAMES[idx] || '';
    block.dataset.activeRegion = regionName;
    geotags.forEach((pin) => {
      pin.classList.toggle('active', pin.dataset.region === idx);
    });
  }

  cards.forEach((card) => {
    card.addEventListener('mouseenter', () => highlight(card));
    card.addEventListener('mouseleave', clearHighlight);

    card.addEventListener('click', () => {
      if (isTouchDevice()) {
        highlight(card);
        setTimeout(clearHighlight, 1500);
      }
    });
  });

  document.addEventListener('touchstart', (e) => {
    if (!e.target.closest('.contact-card')) clearHighlight();
  });
}

/** Legacy: one table row, multiple columns (one column per region card). */
function decorateLegacyColumns(block, rows) {
  const cols = [];
  rows.forEach((row) => {
    cols.push(...row.querySelectorAll(':scope > div'));
  });
  if (!cols.length) return;

  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'contact-cards';

  cols.forEach((col, i) => {
    const card = buildCard(col, i);
    if (card) cardsContainer.appendChild(card);
  });

  if (!cardsContainer.children.length) return;

  const map = buildMap(cardsContainer.children.length);
  const content = document.createElement('div');
  content.className = 'contact-content';
  content.append(map, cardsContainer);
  block.replaceChildren(content);

  decorateIcons(block);
  addHoverInteraction(block);
}

function decorateFieldRows(block, rows) {
  let start = 0;
  const headText = getPlainText(rows[0]);
  if (/^contact\s*details$/i.test(headText) && rows.length > 1) start = 1;

  const R = rows.slice(start);
  if (R.length < 4) return;

  const hasBodyRow = R.length >= 9;
  const bodyRow = hasBodyRow ? R[2] : null;
  const contactsStart = hasBodyRow ? 3 : 2;
  const eyebrowRow = R[0];
  const headingRow = R[1];

  const intro = buildIntro(eyebrowRow, headingRow, bodyRow);
  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'contact-cards';

  const contactRows = R.slice(contactsStart);
  let cardIndex = 0;
  for (let i = 0; i + 1 < contactRows.length && cardIndex < 3; i += 2) {
    const card = buildCardFromFieldRows(contactRows[i], contactRows[i + 1], cardIndex);
    if (card) {
      cardsContainer.appendChild(card);
      cardIndex += 1;
    }
  }

  if (!cardsContainer.children.length) return;

  const map = buildMap(cardsContainer.children.length);
  const content = document.createElement('div');
  content.className = 'contact-content';
  content.append(map, cardsContainer);

  block.replaceChildren();
  if (intro) block.appendChild(intro);
  block.appendChild(content);

  decorateIcons(block);
  addHoverInteraction(block);
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const firstRowCols = rows[0]?.querySelectorAll(':scope > div').length ?? 0;
  const isLegacyColumns = rows.length === 1 && firstRowCols >= 2;

  if (isLegacyColumns) {
    decorateLegacyColumns(block, rows);
    return;
  }

  decorateFieldRows(block, rows);
}
