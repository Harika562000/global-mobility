/* global WebImporter */

import { transformers, asyncTransformers, postTransformers } from './transformers/index.js';
import {
  transformDotPageUrl, transformAllXlsxAndPdfLinks, transformButtonTypes, transformAppLinks
} from './transformers/util.js';

async function transform({ document, params }) {
  const elems = [];
  const url = new URL(params.originalURL);
  const path = url.pathname.toLowerCase();
  const localePath = path.split('/').slice(0, 3).join('/');
  const edsPath = path.replace(/(\.page|\.html)$/, '');
  window.url = params.originalURL;
  window.failedAssets = [];

  // Handle the <title> element separately
  const titleElement = document.querySelector('title');
  if (titleElement && titleElement.text.includes('\u00A0')) {
    titleElement.text = titleElement.text.replace(/\u00A0/g, ' ');
  }

  // define the main element: the one that will be transformed to Markdown
  const main = document.body;

  transformers.forEach(
    (fn) => fn.call(this, main, document, params, url),
  );

   await Promise.all(asyncTransformers.map((fn) => fn(main, document, params, url)));

  WebImporter.DOMUtils.remove(main, [
    'header',
    'nav.navbar',
    '#ups-skipNav',
    '.show-more',
    '.show-less',
    '.sr-only',
    '.icon.ups-icon-link_newwindow',
    'footer',
  ]);

  // create the metadata block and append it to the main element
  postTransformers.forEach(
    (fn) => fn.call(this, main, document, params, url),
  );

  transformAppLinks(main);
  transformDotPageUrl(main);
  await transformAllXlsxAndPdfLinks(main, localePath);
  transformButtonTypes(main);

  const report = {};

  // const listOfAllImages = [...main.querySelectorAll('img')].map((img) => img.src);
  // const listOfAllMeta = [...document.querySelectorAll('meta')].map((meta) => {
  //   const name = meta.getAttribute('name') || meta.getAttribute('property');
  //   if (name) {
  //     return { name, content: meta.content };
  //   }
  //   return null;
  // }).filter((meta) => meta);

  // report.PageTitle = document.querySelector('title').textContent;
  // report.PageDescription = document.querySelector('meta[name="description"]')?.content;
  // report.PageKeywords = document.querySelector('meta[name="keywords"]')?.content;
  // report.listOfAllMeta = listOfAllMeta;
  // report.listOfAllImages = listOfAllImages;

  let countryLocale = edsPath.slice(1,6).split("/");
  countryLocale[0] = countryLocale[0].toUpperCase();
  report.countryLocale = countryLocale.join('_');
  report.failedAssets = window.failedAssets.join('\n');
  console.log('/content/ups-pt'+edsPath);

  elems.push({
    path: '/content/ups-pt'+edsPath,
    element: main,
    report,
  });
  window.failedAssets = [];

  return elems;
}

export default {
  transform,
};
