import { events } from '../../scripts/s-and-p-global/events.js';

export default function decorate(block) {
  const section = block.closest('.section');
  const rows = [...block.querySelectorAll(':scope > div')];
  const getCell = (row) => row?.querySelector(':scope > div');

  const headerCell = getCell(rows[0]);
  const bodyCell = getCell(rows[1]);

  block.classList.add('no-search-results');

  // If the block isn't authored as 2 rows yet, don't break existing markup.
  if (!headerCell && !bodyCell) return;

  const container = document.createElement('div');
  container.className = 'no-search-results-container';
  container.hidden = true;

  const header = document.createElement('div');
  header.className = 'header';
  header.innerHTML = headerCell?.innerHTML?.trim() || '';

  const body = document.createElement('div');
  body.className = 'body';
  body.classList.add('body-200');
  if (bodyCell) body.append(...[...bodyCell.childNodes]);

  const headerTemplate = header.innerHTML;
  const bodyTemplate = body.innerHTML;

  const escapeHTML = (s) => {
    const div = document.createElement('div');
    div.textContent = s ?? '';
    return div.innerHTML;
  };

  const applyQuery = (query) => {
    const q = String(query ?? '').trim();
    const replacement = q ? `<strong>${escapeHTML(q)}</strong>` : '';

    // Restore templates first (so repeated events don't duplicate content).
    header.innerHTML = headerTemplate;
    body.innerHTML = bodyTemplate;
    // Header: append query at end of the <p> text (preferred),
    // falling back to placeholder replacement, then to appending to the container.
    if (!replacement) return;

    const headerP = header.querySelector('p');
    if (headerP) {
      if (headerP.innerHTML.includes('{{query}}')) {
        headerP.innerHTML = headerP.innerHTML.replaceAll('{{query}}', replacement);
      } else {
        headerP.insertAdjacentHTML('beforeend', ` ${replacement}`);
      }
    }

    // Body placeholder replacement (optional)
    if (body.innerHTML.includes('{{query}}')) {
      body.innerHTML = body.innerHTML.replaceAll('{{query}}', replacement);
    }
  };

  container.append(header, body);
  block.replaceChildren(container);

  const SEARCH_EVENT_SCOPE = 'search';
  const NO_RESULTS_EVENT = 'search-results:no-results';
  const HAS_RESULTS_EVENT = 'search-results:has-results';

  const subs = [
    events.on(NO_RESULTS_EVENT, (payload) => {
      applyQuery(payload?.query);
      container.hidden = false;
      section?.classList.add('is-visible');
    }, { scope: SEARCH_EVENT_SCOPE, eager: true }),
    events.on(HAS_RESULTS_EVENT, () => {
      container.hidden = true;
      section?.classList.remove('is-visible');
    }, { scope: SEARCH_EVENT_SCOPE, eager: true }),
  ];

  block.addEventListener('DOMNodeRemovedFromDocument', () => {
    subs.forEach((s) => s?.off?.());
  });
}
