/* global WebImporter */
import { getMetaContent } from './util.js';

const createMetadata = (main, document) => {
  /**
   * NOTE: The file helix-importer/src/importer/html2jcr/hast2jcr/handlers/metadata.js
   * handles how the metadata is created. It compares the meta object with the
   * page properties and ignores the keys that are not present in the page properties.
   *
   * Unfortunately, there are lots of meta tags on the live site for which there is
   * no corresponding page property. This means that the meta tags are not being
   * imported into the JCR. Two ways to fix this
   *
   * 1) Update the page properties to include all the meta tags or
   * 2) Update the metadata.js file to include all the meta tags grabbed from the live site
   *
   * We will currently proceed with 2. If we decide to go with 1, we will need to update
   * the page properties to include all possible meta tags.
   */

  const meta = {};
  const title = document.querySelector('title');

  if (title) {
    meta.Title = title.innerHTML.replace(/[\n\t]/gm, '');
    meta.PageTitle = meta.Title;
  }

  if (window.meta !== undefined) {
    meta['nav-title'] = window.meta['nav-title'];
  }

  getMetaContent(document, ['description', 'keywords', 'viewport', 'vpath', 'ups-locale'], meta);
  const canonicalHref = document.querySelector('link[rel=canonical]')?.href;
  if (canonicalHref) {
    const canonicalURL = new URL(canonicalHref);
    meta.canonical = canonicalURL.pathname.replace('.page', '');
  }

  const block = WebImporter.Blocks.getMetadataBlock(document, meta);
  main.append(block);

  return meta;
};

export default createMetadata;
