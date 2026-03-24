/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import {
  addSection, createBlock, getLink, transformInnerBrTags,
} from './util.js';
import fetchDeliveryUrl from '../integrations/search.js';

const createTextContent = async (main) => {
  const textContents = main.querySelectorAll('.ups-component.ups-text-content');
  if (!textContents.length) return;

  for (const textContent of textContents) {
    const upsTitle = textContent.querySelector('.ups-container .content-block h2' || '.ups-container .content-block h3');
    const containsLinks = textContent.querySelectorAll('a');
    const upsTitleIcon = textContent.querySelector('.ups-container .content-container .icon-container img');
    transformInnerBrTags(textContent);
    let isCentered = false;
    const variant = [];
    const blockCells = [];

    /**
     * Remove the sup tags in the title of anchors if present
     */
    const anchorLinks = textContent.querySelectorAll('.ups-container .content-block a');
    if (anchorLinks.length > 0) {
      anchorLinks.forEach((link) => {
        const title = link.getAttribute('title');
        if (title && title.length > 0) {
          const titleModified = title.replace(/<sup>(®)<\/sup>/, '$1');
          link.setAttribute('title', titleModified || title);
        }
      });
    }

    /**
     * NOTE: This fix is added so that the ® symbol is not ommitted when
     * the text is fed to JCR conversion. Will revert if this cuases any issues.
     */
    const pTags = textContent.querySelectorAll('.ups-container .content-block p');
    pTags.forEach((pTag) => {
      const supTag = pTag.querySelector('sup');
      if (supTag) {
        const aTag = supTag.parentElement;
        if (aTag.tagName !== 'A') return;
        supTag.textContent = '®';
        const tc = aTag.textContent;
        aTag.textContent = tc;
        supTag.remove();
      }
    });

    if (upsTitleIcon) {
      upsTitleIcon.src = upsTitleIcon?.src ? await fetchDeliveryUrl(upsTitleIcon.src.split('/').pop(), upsTitleIcon.src) : '';
      blockCells.push([upsTitleIcon]);
    } else {
      blockCells.push(['']);
    }

    if (containsLinks.length > 0) {
      containsLinks.forEach((link) => {
        link.href = getLink(link);
      });
    }

    if (upsTitle) {
      // check if title needs to be centered
      // if title has `component-header` class as its parent, then it needs to be centered
      const parent = upsTitle.parentElement;
      isCentered = parent.classList.contains('component-header');
      variant.push(isCentered ? 'align-center' : '');
      blockCells.push([upsTitle]);
    }
    const isBackgroundArc = textContent.classList.contains('background-arc');
    const titleBlock = createBlock('Ups Title', blockCells, variant);
    textContent.prepend(titleBlock);

    const listIsUnordered = textContent?.querySelector('.ups-container .content-block ul');
    let listIsUnorderedBulletCheckIcons = false;
    if (listIsUnordered) {
      listIsUnorderedBulletCheckIcons = listIsUnordered.parentNode.classList.contains('unordered-list');
    }
    const listIsOrdered = textContent?.querySelector('.ups-container .content-block ol');
    let listIsOrderedAlphabetically;
    let listIsOrderedNumerically;
    if (listIsOrdered) {
      listIsOrderedAlphabetically = textContent.querySelector('ol[style*="list-style-type: lower-alpha"]');
      listIsOrderedNumerically = listIsOrderedAlphabetically ? null : textContent?.querySelector('ol');
    }
    const hasCTA = textContent?.querySelectorAll('.ups-cta:not(:has(.show-more))');

    hasCTA.forEach((cta) => {
      const isCTAPrimary = cta.classList.contains('ups-cta-primary');
      const buttonP = document.createElement('p');
      const buttonEM = document.createElement('em');
      const buttonA = document.createElement('a');
      buttonA.href = getLink(cta.href);
      buttonA.textContent = cta.firstChild.textContent;

      if (isCTAPrimary) {
        buttonP.append(buttonA);
      } else {
        buttonEM.append(buttonA);
        buttonP.append(buttonEM);
      }

      textContent.append(buttonP);
      cta.remove();
    });

    if (listIsUnordered) {
      const addClassBackgroundArc = isBackgroundArc ? ', background-arc' : '';
      const styleClass = listIsUnorderedBulletCheckIcons
        ? `bullet-check-icon${addClassBackgroundArc}`
        : `${addClassBackgroundArc}`;

      // Create section metadata
      const sectionMetadata = createBlock('Section Metadata', [['style', styleClass]]);
      textContent.append(sectionMetadata);
      addSection(sectionMetadata);
    }

    if (listIsOrdered) {
      // Handle ordered list transformation
      if (listIsOrderedAlphabetically) {
        const ul = document.createElement('ul');
        listIsOrderedAlphabetically.querySelectorAll('li').forEach((li) => {
          ul.appendChild(li.cloneNode(true));
        });
        listIsOrderedAlphabetically = ul;
      }

      if (listIsOrderedNumerically) {
        const ol = document.createElement('ol');
        listIsOrderedNumerically.querySelectorAll('li').forEach((li) => {
          ol.appendChild(li.cloneNode(true));
        });
        listIsOrderedNumerically = ol;
      }

      // Replace the ordered list if necessary
      const replacement = listIsOrderedAlphabetically || listIsOrderedNumerically;
      listIsOrdered.parentNode.replaceChild(replacement, listIsOrdered);

      // Determine style class based on conditions
      const addClassBackgroundArc = isBackgroundArc ? ', background-arc' : '';
      const styleClass = `bullet-alphabet${addClassBackgroundArc}`;

      // Create section metadata
      const sectionMetadata = createBlock('Section Metadata', [['style', styleClass]]);
      textContent.append(sectionMetadata);
      addSection(sectionMetadata);

      // Remove the original ordered list
      listIsOrdered.remove();
    }

    if (!listIsUnordered && !listIsOrdered) {
      // Handle case when neither listIsUnordered nor listIsOrdered is true
      let titleSection;

      if (isBackgroundArc) {
        titleSection = createBlock('Section Metadata', [['style', 'background-arc']]);
        textContent.append(titleSection);
      } else {
        titleSection = textContent;
      }

      addSection(titleSection);
    }
  }
};

export default createTextContent;
