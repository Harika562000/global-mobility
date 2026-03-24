/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* global WebImporter */

import fetchDeliveryUrl from '../integrations/search.js';
import { assetsGroupedByLocale, assets } from '../integrations/assets.js';

const APP_URL = 'wwwapps.ups.com';
const absoluteAppDomains = ['solutions.ups.com', APP_URL, 'www.campusship.ups.com'];

/**
 * Creates a table block with a header and rows.
 *
 * @param {string} blockName - The name of the block.
 * @param {Array<Array<string>>} [rows=[]] - An array of rows, each row is an array of cell values.
 * @param {Array<string>} [variants=[]] - An array of variant strings to be included in the header.
 * @returns {HTMLTableElement} The created table element.
 */
export const createBlock = (blockName, rows = [], variants = []) => {
  const variantStr = variants.join(', ');
  const header = `${blockName}${variantStr ? ` (${variantStr})` : ''}`;
  const cells = [
    [header],
  ];
  rows.forEach((row) => {
    cells.push(row);
  });
  const table = WebImporter.DOMUtils.createTable(cells, document);
  return table;
};

export const addSection = function appendHr(element, isNestedBlock = false) {
  if (!isNestedBlock) {
    const hr = document.createElement('hr');
    element.after(hr);
  }
};

/**
 * Converts a YouTube embed URL to a standard YouTube watch URL.
 *
 * @param {string} url - The YouTube embed URL to convert.
 * @returns {string} - The converted YouTube watch URL,
 * or the original URL if it is not an embed URL.
 */
export const convertYouTubeURL = (url) => {
  const urlObj = new URL(url);

  if (urlObj.hostname === 'www.youtube.com' && urlObj.pathname.startsWith('/embed/')) {
    const videoId = urlObj.pathname.split('/')[2];
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  return url;
};

/**
 * Retrieves the content of specified meta tags from a document and adds them to a meta object.
 *
 * @param {Document} document - The document object to search for meta tags.
 * @param {string[]} metaNames - An array of meta tag names to search for.
 * @param {Object} meta - An object to store the meta tag content,
 * with keys being the capitalized meta tag names.
 * @returns {Object} The updated meta object with the content of the specified meta tags.
 */
export const getMetaContent = (document, metaNames, meta) => {
  metaNames.forEach((name) => {
    const element = document.querySelector(`meta[name="${name}"]`);
    if (element) {
      meta[name.charAt(0).toUpperCase() + name.slice(1)] = element.content;
    }
  });
  return meta;
};

/**
 * Removes the domain from a given URL.
 *
 * @param {string} url - The URL from which to remove the domain.
 * @returns {string} The URL without the domain, prefixed with a slash
 * if it didn't already start with one.
 */
function removeDomainFromUrl(url) {
  const domainPattern = /^(?:https?:\/\/)?(?:www\.)?([^/]+)\/?/;
  return url.startsWith('/') ? url : `/${url.replace(domainPattern, '')}`;
}

/**
 * Checks if the given parent node has at least one direct child that is a non-empty text node.
 *
 * @param {Node} p - The parent node to check.
 * @returns {boolean} - Returns true if the parent node has at least one
 * direct child that is a non-empty text node, otherwise false.
 */
export function hasDirectTextNodeOnly(p) {
  for (const child of p.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.nodeValue.trim()) {
      return true;
    }
  }
  return false;
}

export function isTelLink(link) {
  return link.startsWith('tel:');
}

export function isMailLink(link) {
  return link.startsWith('mailto:');
}

export const transformAppLinks = (element) => {
  element.querySelectorAll('a').forEach((link) => {
    let href = link.getAttribute('href');
    if (!href) return;

    if (!href.endsWith('.page')) {
      // Check for URI schemes (tel:, mailto:, etc.) and hash links
      const hasScheme = /^[a-z]+:/i.test(href);
      const isHashLink = href.startsWith('#');

      if (!hasScheme && !isHashLink) {
        // Handle relative URLs
        if (!href.startsWith('http')) {
          href = `https://www.ups.com${href.startsWith('/') ? href : `/${href}`}`;
        }
      }

      // Handle localhost replacement
      if (href.startsWith('http://localhost:3001')) {
        href = href.replace('http://localhost:3001', 'https://www.ups.com');
      }
    }

    link.href = href;
  });
};

export const transformDotPageUrl = (element) => {
  if (!element) {
    throw new Error('Element is required');
  }

  // Find all anchor tags within the given element
  const links = element.querySelectorAll('a');
  const domain = 'https://www.ups.com';

  links.forEach((link) => {
    let href = link.getAttribute('href');
    if (href && /\.page($|\?)/.test(href)) {
      const url = new URL(href, window.location.href);
      if (url.hostname === 'solution.ups.com') return;

      if (url.hostname === APP_URL) {
        link.setAttribute('href', href.replace(/\.page(?=$|\?)/, ''));
      } else {
        href = removeDomainFromUrl(href);
        // Check if the href ends with ".page" or has ".page" before query parameters
        const cleanedHref = (href.replace(/\.page(?=$|\?)/, '').toLowerCase());
        link.setAttribute('href', `${domain}${cleanedHref}`);
      }
    }
    if (link.pathname === '/dropoff' && link.classList.contains('ups-cta')) {
      link.setAttribute('href', '#ups-location');
    }
  });
};

export const transformAllXlsxAndPdfLinks = async (element, localePath) => {
  const links = element.querySelectorAll('a');

  for (const link of links) {
    const href = link.getAttribute('href');
    if (href && /\.(pdf|xlsx)($|\?)/.test(href)) {
      const fileName = href.split('/').pop();
      // console.log('Original asset', fileName); // TODO: Keeping for debugging purposes
      // console.log('New eDam name', assetsGroupedByLocale[localePath][fileName]);
      /**
       * First priority for locale specific assets
       * Second priority for global assets and then the original asset name.
       */
      const edamAssetName = assetsGroupedByLocale?.[localePath]?.[fileName]
        || assets?.[fileName]
        || fileName;
      const deliveryUrl = await fetchDeliveryUrl(edamAssetName, href);
      const transformedDeliveryUrl = deliveryUrl;
      link.setAttribute('href', transformedDeliveryUrl);
    }
  }
};

export const transformButtonTypes = (main) => {
  const wrapLinksToMatchCTAStyles = (elements, wrapperType = 'strong') => {
    elements.forEach((link) => {
      // To fix the links appearing as bold in the text content block
      if (link.classList.contains('ups-link')
        && link.closest('.ups-component').classList.contains('ups-text-content')
        && hasDirectTextNodeOnly(link.parentElement)) return;
      const wrapper = document.createElement(wrapperType);
      link.parentNode.insertBefore(wrapper, link);
      wrapper.appendChild(link);
    });
  };

  const elementsToWrap = [
    { selector: '.ups-cta-secondary', wrapperType: 'em' },
    { selector: '.ups-tertiary', wrapperType: 'strong' },
    { selector: '.content-block .ups-link', wrapperType: 'strong' },
  ];

  elementsToWrap.forEach(({ selector, wrapperType }) => {
    const elements = main.querySelectorAll(selector);
    if (elements.length > 0) wrapLinksToMatchCTAStyles(elements, wrapperType);
  });
};

export const transformNonBlockingSpaces = (element) => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);

  while (walker.nextNode()) {
    const { currentNode } = walker;
    if (currentNode.nodeValue.includes('\u00A0')) {
      currentNode.nodeValue = currentNode.nodeValue.replace(/\u00A0/g, ' ');
    }
  }
};

export const getLink = (href) => {
  const url = new URL(href, window.location.href);
  const knownDomains = [
    'www.ups.com',
    'wwwapps.ups.com', 'www.campusship.ups.com',
    'hlx.page', 'hlx.live', 'aem.page', 'aem.live',
    'adobeaemcloud.com',
    window.location.hostname,
  ];

  ['es-us', 'ru', 'si', 'ua'].forEach((sub) => {
    knownDomains.push(`${sub}.ups.com`);
    knownDomains.push(`${sub}-apps.ups.com`);
  });
  let isExternal = false;
  if (url.pathname.endsWith('.pdf')) {
    isExternal = true;
  } else if (!url.hostname.includes('localhost') && !knownDomains.some((host) => url.hostname.includes(host))) {
    isExternal = true;
  }
  if (url.hostname.includes('localhost')) {
    url.hostname = 'www.ups.com';
    url.port = '';
  }

  if (isExternal || absoluteAppDomains.includes(url.hostname)) {
    return url.href;
  }

  return url.pathname + url.search;
};

export function getTextOnlyParagraphs() {
  const paragraphs = document.querySelectorAll('p');

  // eslint-disable-next-line arrow-body-style
  const textOnlyParagraphs = Array.from(paragraphs).filter((p) => {
    return p.childNodes.length === 1 && p.childNodes[0].nodeType === Node.TEXT_NODE;
  });

  return textOnlyParagraphs;
}

export function transformInnerBrTags(el) {
  const brTags = el.querySelectorAll('strong > br');
  brTags.forEach((br) => {
    const strongParent = br.parentNode;
    if (hasDirectTextNodeOnly(strongParent) || strongParent.querySelector('sub, sup')) {
      strongParent.parentNode.insertBefore(br, strongParent.nextSibling);
    }
  });
}
