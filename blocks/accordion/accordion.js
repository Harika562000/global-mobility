import {
    eyebrowDecorator,
    moveInstrumentation,
    moveAttributes,
  } from '../../scripts/scripts.js';
  
  /**
   * Smoothly opens an accordion item
   * @param {HTMLElement} body
   * @param {HTMLDetailsElement} details
   */
  function openAccordion(body, details) {
    const inner = body.firstElementChild;
    details.open = true;
  
    requestAnimationFrame(() => {
      body.style.height = `${inner.scrollHeight}px`;
    });
  
    const onEnd = (e) => {
      if (e.propertyName !== 'height') return;
      body.style.height = 'auto';
      body.removeEventListener('transitionend', onEnd);
    };
  
    body.addEventListener('transitionend', onEnd);
  }
  
  /**
   * Smoothly closes an accordion item
   * @param {HTMLElement} body
   * @param {HTMLDetailsElement} details
   */
  function closeAccordion(body, details) {
    const inner = body.firstElementChild;
    body.style.height = `${inner.scrollHeight}px`;
  
    // force reflow so transition runs
    body.offsetHeight; // eslint-disable-line no-unused-expressions
  
    body.style.height = '0px';
  
    const onEnd = (e) => {
      if (e.propertyName !== 'height') return;
      details.open = false;
      body.removeEventListener('transitionend', onEnd);
    };
  
    body.addEventListener('transitionend', onEnd);
  }
  
  export default function decorate(block) {
    const accordionItems = [];
    const isSmall = block.classList.contains('small');
  
    /* ----------------------------
     * Layout containers
     * ---------------------------- */
    let imagePanel;
    const images = [];
  
    if (isSmall) {
      imagePanel = document.createElement('div');
      imagePanel.className = 'accordion-image-panel';
    }
  
    const listWrapper = document.createElement('div');
    listWrapper.className = 'accordion-list';
  
    /* ----------------------------
     * Header row (eyebrow / heading / description)
     * ---------------------------- */
    const [firstRow, ...rows] = [...block.children];
  
    const eyebrowSource = firstRow?.querySelector('p');
    const eyebrow = eyebrowDecorator(
      eyebrowSource,
      'accordion-header-eyebrow',
    );
  
    if (eyebrow && eyebrowSource) {
      moveInstrumentation(eyebrowSource, eyebrow);
      moveAttributes(eyebrowSource, eyebrow);
      eyebrowSource.replaceWith(eyebrow);
    }
  
    firstRow.classList.add('accordion-header');
  
    const heading = firstRow.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) heading.classList.add('accordion-header-heading');
  
    const description = firstRow.querySelector('p');
    if (description) description.classList.add('accordion-header-description');
  
    listWrapper.append(firstRow);
  
    /* ----------------------------
     * Accordion items
     * Each UE item row = 3 columns:
     * [0] image (optional)
     * [1] label
     * [2] body
     * ---------------------------- */
    rows.forEach((row, index) => {
      const imageCell = row.children[0];
      const labelCell = row.children[1];
      const bodyCell = row.children[2];
  
      const label =
        labelCell?.firstElementChild ?? labelCell;
  
      const bodyContent = bodyCell
        ? [...bodyCell.childNodes]
        : [];
  
      /* Body wrapper */
      const body = document.createElement('div');
      body.className = 'accordion-item-body';
      bodyContent.forEach((n) => body.append(n));
  
      /* Inner wrapper for height animation */
      const inner = document.createElement('div');
      inner.className = 'accordion-item-body-inner';
      inner.append(...body.childNodes);
      body.append(inner);
  
      /* Summary */
      const summary = document.createElement('summary');
      summary.className = 'accordion-item-label';
      if (label) summary.append(label);
  
      /* Details */
      const details = document.createElement('details');
      details.className = 'accordion-item';
      details.append(summary, body);
  
      /* ✅ Preserve UE instrumentation before removing authored row */
      if (labelCell) {
        moveInstrumentation(labelCell, details);
        moveAttributes(labelCell, details);
      }
  
      /* Small variant image handling */
      if (isSmall) {
        const img =
          imageCell?.querySelector('picture, img') ||
          document.createElement('div');
  
        img.classList.add('accordion-item-image');
  
        if (imageCell) {
          moveInstrumentation(imageCell, img);
          moveAttributes(imageCell, img);
        }
  
        images.push(img);
        details.dataset.imageIndex = index;
  
        details.addEventListener('toggle', () => {
          if (!details.open) return;
          const active = Number(details.dataset.imageIndex);
          images.forEach((el, i) => {
            el.classList.toggle('is-active', i === active);
          });
        });
      }
  
      accordionItems.push({ details, body });
  
      /* Single-open accordion behavior */
      summary.addEventListener('click', (e) => {
        e.preventDefault();
  
        accordionItems.forEach((item) => {
          if (item.details !== details && item.details.open) {
            closeAccordion(item.body, item.details);
          }
        });
  
        if (details.open) {
          closeAccordion(body, details);
        } else {
          openAccordion(body, details);
        }
      });
  
      listWrapper.append(details);
  
      /* Remove original UE-authored row */
      row.remove();
    });
  
    /* ----------------------------
     * Final layout assembly
     * ---------------------------- */
    if (isSmall) {
      images.forEach((img, i) => {
        img.classList.toggle('is-active', i === 0);
        imagePanel.append(img);
      });
      block.append(imagePanel, listWrapper);
    } else {
      block.append(listWrapper);
    }
  
    /* ----------------------------
     * Open first item by default
     * ---------------------------- */
    if (accordionItems.length > 0) {
      const firstItem = accordionItems[0];
      firstItem.details.open = true;
      firstItem.body.style.height = 'auto';
    }
  
    /* Cleanup */
    block
      .querySelectorAll('.button')
      .forEach((btn) => btn.classList.remove('button'));
  }