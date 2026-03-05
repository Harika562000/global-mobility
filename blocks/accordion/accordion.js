import {
    eyebrowDecorator,
    moveInstrumentation,
    moveAttributes,
  } from '../../scripts/scripts.js';
  
  /**
   * Smoothly opens an accordion item
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
   */
  function closeAccordion(body, details) {
    const inner = body.firstElementChild;
    body.style.height = `${inner.scrollHeight}px`;
    body.offsetHeight; // force reflow
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
    let imagePanel;
    const images = [];
  
    if (isSmall) {
      imagePanel = document.createElement('div');
      imagePanel.className = 'accordion-image-panel';
    }
  
    const listWrapper = document.createElement('div');
    listWrapper.className = 'accordion-list';
  
    // Treat first row as header and skip accordion logic
    const [firstRow, ...rows] = [...block.children];
  
    // Format eyebrow
    const eyebrowSource = firstRow?.querySelector('p');
    const eyebrow = eyebrowDecorator(eyebrowSource, 'accordion-header-eyebrow');
    if (eyebrow && eyebrowSource) {
      // Preserve UE instrumentation & attributes before replacement
      moveInstrumentation(eyebrowSource, eyebrow);
      moveAttributes(eyebrowSource, eyebrow);
      eyebrowSource.replaceWith(eyebrow);
    }
  
    firstRow.classList.add('accordion-header');
    const heading = firstRow.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) heading.classList.add('accordion-header-heading');
    const description = firstRow.querySelector('p');
    if (description) description.classList.add('accordion-header-description');
  
    listWrapper.prepend(firstRow);
  
    rows.forEach((row, index) => {
      let image;
  
      const textCell = isSmall ? row.children[1] : row.children[0];
      const imageCell = isSmall ? row.children[0] : null;
  
      const cellChildren = isSmall
        ? [...(row.children[1]?.children ?? [])]
        : [...(row.children[0]?.children ?? [])];
  
      if (isSmall) {
        image = row.children[0]?.querySelector('picture');
      }
  
      const [label, ...restCellChildren] = cellChildren;
  
      // Create body wrapper
      const body = document.createElement('div');
      body.className = 'accordion-item-body';
      restCellChildren.forEach((child) => body.append(child));
  
      // Create summary
      const summary = document.createElement('summary');
      summary.className = 'accordion-item-label';
      if (label) summary.append(label);
  
      // Wrap body content for height animation
      const inner = document.createElement('div');
      inner.className = 'accordion-item-body-inner';
      inner.append(...body.childNodes);
      body.append(inner);
  
      // Create details
      const details = document.createElement('details');
      details.className = 'accordion-item';
      details.append(summary, body);
  
      /**
       * 🔑 UE FIX: move instrumentation from the original authored cell(s)
       * that are about to be removed (row.remove()) onto the new rendered structure.
       */
      if (textCell) {
        moveInstrumentation(textCell, details);
        moveAttributes(textCell, details);
      }
  
      if (isSmall) {
        const slot = image || document.createElement('div');
        slot.classList.add('accordion-item-image');
  
        // If the image was authored in a cell that we remove, preserve instrumentation
        if (imageCell) {
          moveInstrumentation(imageCell, slot);
          moveAttributes(imageCell, slot);
        }
  
        images.push(slot);
        details.dataset.imageIndex = index;
  
        details.addEventListener('toggle', () => {
          if (!details.open) return;
          const imageIndex = Number(details.dataset.imageIndex);
          images.forEach((img, idx) => {
            img.classList.toggle('is-active', idx === imageIndex);
          });
        });
      }
  
      accordionItems.push({ details, body });
  
      // Accordion open/close behavior
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
  
      // We now safely remove the original authored row
      row.remove();
    });
  
    // Build final small variant layout
    if (isSmall) {
      images.forEach((img, i) => {
        img.classList.toggle('is-active', i === 0);
        imagePanel.append(img);
      });
      block.append(imagePanel, listWrapper);
    } else {
      block.append(listWrapper);
    }
  
    // Open first accordion item on load (skip header row)
    if (accordionItems.length > 0) {
      const firstItem = accordionItems[0];
      firstItem.details.open = true;
      firstItem.body.style.height = 'auto';
    }
  
    block.querySelectorAll('.button').forEach((btn) => btn.classList.remove('button'));
  }