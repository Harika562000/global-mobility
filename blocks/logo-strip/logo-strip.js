import { readBlockConfig } from '../../scripts/aem.js';
import { isUniversalEditor } from '../../scripts/s-and-p-global/utils.js';

const MD = 'col-md';
const SM = 'col-sm';

const parseCsv = (s) => s.split(',').map((t) => t.trim()).filter(Boolean);
const pick = (parts, prefix) => parts.find((p) => p.startsWith(`${prefix}-`)) || '';

function hideUeRow(el) {
  const row = el?.parentElement?.parentElement;
  if (row) row.style.display = 'none';
}

/** Set one clamped col-{prefix}-N on block from explicit token, prior class, or default. */
function applyColClass(block, prefix, max, def, explicit) {
  const token = (explicit || '').trim().split(/[\s,]+/)[0] || '';
  const m = token.match(new RegExp(`^${prefix.replace(/-/g, '\\-')}-(\\d+)$`));
  let n = m ? parseInt(m[1], 10) : NaN;
  if (Number.isNaN(n)) {
    const ex = [...block.classList].find((c) => c.startsWith(`${prefix}-`));
    n = ex ? parseInt(ex.split('-').pop(), 10) : def;
  }
  if (Number.isNaN(n)) n = def;
  const v = Math.min(Math.max(n, 1), max);
  [...block.classList].filter((c) => c.startsWith(`${prefix}-`)).forEach((c) => block.classList.remove(c));
  block.classList.add(`${prefix}-${v}`);
}

/** Single-column rows with text col-md-N / col-sm-N (readBlockConfig skips these). */
function docHints(block) {
  let desktop = '';
  let mobile = '';
  const rows = [...block.children].filter((r) => r.tagName === 'DIV');
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.children.length !== 1) break;
    const cell = row.children[0];
    if (cell.querySelector('picture, img')) break;
    const text = cell.textContent?.trim() || '';
    if (/^col-md-\d+$/.test(text)) {
      if (!desktop) desktop = text;
    } else if (/^col-sm-\d+$/.test(text)) {
      if (!mobile) mobile = text;
    } else if (text) {
      break;
    }
  }
  return { desktop, mobile };
}

function resolveLayoutClasses(block) {
  const dEl = block.querySelector('[data-aue-prop="desktopColumns"]') || Array.from(block.querySelectorAll('p')).filter((p) => p.textContent.includes('col-md-'))[0];
  const mEl = block.querySelector('[data-aue-prop="mobileColumns"]') || Array.from(block.querySelectorAll('p')).filter((p) => p.textContent.includes('col-sm-'))[0];
  hideUeRow(dEl);
  hideUeRow(mEl);
  let desktop = dEl?.textContent?.trim() || '';
  let mobile = mEl?.textContent?.trim() || '';

  const legacy = block.querySelector('[data-aue-prop="classes"]')?.textContent?.trim();
  if (legacy) {
    const p = parseCsv(legacy);
    if (!desktop) desktop = pick(p, MD);
    if (!mobile) mobile = pick(p, SM);
  }

  try {
    const cfg = readBlockConfig(block);
    if (!desktop && cfg['desktop-columns']) desktop = String(cfg['desktop-columns']).trim();
    if (!mobile && cfg['mobile-columns']) mobile = String(cfg['mobile-columns']).trim();
    if (!desktop && !mobile && cfg.classes) {
      const p = parseCsv(String(cfg.classes));
      desktop = pick(p, MD);
      mobile = pick(p, SM);
    }
  } catch { /* two-column rows only */ }

  const h = docHints(block);
  if (!desktop) desktop = h.desktop;
  if (!mobile) mobile = h.mobile;

  applyColClass(block, MD, 8, 8, desktop);
  applyColClass(block, SM, 2, 2, mobile);
}

function collectMedia(block) {
  return [...block.children].flatMap((row) => (
    [...row.children]
      .map((cell) => cell.querySelector(':scope picture') || cell.querySelector(':scope > img'))
      .filter(Boolean)
  ));
}

function flattenLogosIntoFlexGrid(block) {
  const nodes = collectMedia(block);
  if (!nodes.length) return;

  const items = nodes.map((node, i) => {
    const item = document.createElement('div');
    item.className = 'logo-strip-item';
    const inner = document.createElement('div');
    inner.append(node);
    item.append(inner);
    const img = node.tagName === 'PICTURE' ? node.querySelector('img') : node;
    if (img?.tagName === 'IMG') {
      img.loading = i === 0 ? 'eager' : 'lazy';
      img.decoding = 'async';
    }
    return item;
  });

  if (!isUniversalEditor()) block.replaceChildren(...items);
  else items.forEach((el) => block.appendChild(el));
}

export default function decorate(block) {
  resolveLayoutClasses(block);
  block.classList.add('flex-grid');
  flattenLogosIntoFlexGrid(block);

  if (isUniversalEditor()) {
    if (block.closest('.logo-strip-wrapper').querySelectorAll('.block').length > 1) {
      window.location.reload();
    }
  }
}
