/* global WebImporter */

function transform({ document, params }) {
  const elems = [];
  const url = new URL(params.originalURL);
  const path = url.pathname;
  const localePath = path.split('/').slice(0, 3).join('/');
  const siteName = path.split('/')[3];
  const siteNamePath = ['healthcare', 'supplychain'].includes(siteName) ? `${siteName}/` : '';

  const footer = document.getElementById('ups-footerWrap');
  if (!footer) return elems;

  const footerLinks = footer.querySelectorAll('.ups-footer_links');
  const ul = document.createElement('ul');
  footerLinks.forEach((linkEl) => {
    const li = document.createElement('li');
    li.append(linkEl);
    ul.append(li);
  });
  footer.append(ul);

  WebImporter.DOMUtils.remove(footer, [
    '#ups-footer',
    '#ups-footerWrap > img:first-of-type',
  ]);

  elems.push({
    path: `/${localePath}/${siteNamePath}fragments/footer`,
    element: footer,
  });

  return elems;
}

export default {
  transform,
};
