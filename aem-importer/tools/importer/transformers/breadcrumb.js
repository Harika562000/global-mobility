import { addSection, createBlock } from './util.js';

const createBreadcrumbs = (main) => {
  // TODO: Handle dark background
  const breadcrumbs = main.querySelector('.ups-breadcrumb.ups-component');
  if (!breadcrumbs) return;
  if (window.meta === undefined) window.meta = {};
  window.meta['nav-title'] = breadcrumbs.querySelectorAll('li:last-child a')[0]?.textContent.trim() || '';

  breadcrumbs.innerHTML = '';
  const block = createBlock('Breadcrumbs', [['']], ['Light Background']);

  breadcrumbs.append(block);
  addSection(block);
};

export default createBreadcrumbs;
