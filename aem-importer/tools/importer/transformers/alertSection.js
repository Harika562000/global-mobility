import { addSection, createBlock } from './util.js';

const createServiceAlerts = (main) => {
  const serviceAlerts = main.querySelector('.ups-component .ups-service_alerts');
  if (!serviceAlerts) return;

  const headerPanel = serviceAlerts.querySelector('.ups-service_alerts .ups-header_panel');
  const headline = headerPanel.querySelector('h2.ups-header').textContent.replace(/\s*\d+.*$/, '').trim();
  const prevButton = headerPanel.querySelector('.slick-prev .ups-btn').textContent.trim();
  const nextButton = headerPanel.querySelector('.slick-next .ups-btn').textContent.trim();
  const slideOfSpan = headerPanel.querySelector('h2.ups-header span');
  const match = slideOfSpan.textContent.match(/\d*\s*(\D+)\s*\d+/);
  const slideOfText = match ? match[1].trim() : "of";
  const serviceCarousel = serviceAlerts.querySelector('.ups-wrap_inner .ups-service-scroller .ups-service-carousel');
  const seviceAlertItems = serviceCarousel.querySelectorAll('.ups-service-slick');
  serviceAlerts.querySelector('.ups-wrap_inner .ups-header_panel').remove();

  seviceAlertItems.forEach((item) => {
    const accordionsTR = item.querySelectorAll('.ups-zip-lookup .ups-component.ups-accordion_wrapper table tr');

    if (item.querySelector('.ups-zip-lookup')) {
      const statesBlock = item.querySelector('.ups-zip-lookup .ups-states-block');
      const heading = statesBlock.querySelector('.ups-affected-heading');
      const plceholder = statesBlock.querySelector('.ups-check-affected .ups-input label');
      const errorMassage = document.createElement('p');
      errorMassage.textContent = 'Invalid ZIP code';
      const findButton = statesBlock.querySelector('.ups-check-affected button.ups-zip-search');
      const impactedMessage = statesBlock.querySelector('.ups-check-affected .ups-zip_lookUp_alert.message');
      const notImpactedMessage = statesBlock.querySelector('.ups-check-affected .ups-zip_lookUp_alert.alert');
      const accordionHeading = statesBlock.querySelector('.ups-states-zip.row .heading');
      const showZipcode = document.createElement('p');
      const zipcodeShowHideButton = statesBlock.querySelector('.ups-states-zip.row .show-all button');
      showZipcode.textContent = zipcodeShowHideButton.textContent;
      const hideZipcode = document.createElement('p');
      hideZipcode.textContent = zipcodeShowHideButton.getAttribute('data-hide-text');

      const zipCodeItems = [heading, plceholder, errorMassage, findButton, impactedMessage,
        notImpactedMessage, accordionHeading, showZipcode, hideZipcode,
      ];

      const block = createBlock('Impacted Areas', [[zipCodeItems]]);
      accordionsTR.forEach((tr, index) => {
        if (index > 0) {
          block.append(tr);
        }
      });

      item.querySelector('.ups-zip-lookup .ups-states-block').replaceWith(block);
    }

    const tables = Array.from(item.querySelectorAll('table'));

  tables.forEach((table) => {
    const tableBlockCells = [];
    const blockCells = [];
    const tableTitle = table.querySelector('.component-header h3');
    if (tableTitle) {
      const title = document.createElement('h2');
      title.textContent = tableTitle.textContent;
      tableTitle.replaceWith(title);
    }

    const captionWrapper = document.createElement('div');
    const tableCaption = table.querySelector('.table-caption');
    const isComparisonTable = table.classList.contains('comparison');
    const isOnlyPTag = table.querySelectorAll('.ups-container > p').length === 1 ? table.querySelector('.ups-container > p') : null;

    if (tableCaption) {
      const captionTitle = document.createElement('h3');
      captionTitle.textContent = tableCaption.textContent;
      captionWrapper.append(captionTitle);
      // TODO: Intentionally empty, but it'll be updated when we encounter footnote
      const tableFootNote = document.createElement('p');
      tableFootNote.textContent = '';
      const tableCTA = document.createElement('a');
      tableCTA.textContent = '';
      tableCTA.href = '';
      captionWrapper.append(tableFootNote, tableCTA);
      tableCaption.remove();
    }
    const tableHeaders = table.querySelectorAll('table tr th');
    const tableBody = table.querySelectorAll('table tr');

    const ul = document.createElement('ul');

    tableHeaders.forEach((header) => {
      const li = document.createElement('li');
      li.textContent = header.textContent;
      ul.append(li);
      header.replaceWith(ul);
      header.remove();
    });

    blockCells.push([ul]);
    tableBlockCells.push([captionWrapper]);
    if (tableHeaders.length) {
      tableBlockCells.push(blockCells);
    }

    tableBody.forEach((tr) => {
      const ul2 = document.createElement('ul');
      const td = tr.querySelectorAll('th, td');
      td.forEach((item) => {
        const li = document.createElement('li');
        const icon = item.querySelector('img');
        if (icon) {
          li.textContent = ':check:';
        } else {
          li.innerHTML = item.innerHTML;
        }
        ul2.append(li);
        item.replaceWith(ul2);
        item.remove();
      });
      tableBlockCells.push([ul2]);
      tr.remove();
    });

    if (isOnlyPTag) {
      const ul3 = document.createElement('ul');
      const li = document.createElement('li');
      if (isOnlyPTag.innerHTML.includes('<br>')) {
        const parts = isOnlyPTag.innerHTML.split('<br>');
        li.innerHTML = parts.map((part) => `<p>${part}</p>`).join('');
      } else {
        li.innerHTML = isOnlyPTag.innerHTML;
      }
      ul3.appendChild(li);
      isOnlyPTag.replaceWith(ul3);
      tableBlockCells.push([ul3]);
    }

    const block = createBlock('Table', tableBlockCells, isComparisonTable ? ['Comparison'] : ['Standard Table']);
    table.append(block);
  });

    const sectionMetadataBlock = createBlock('Section Metadata', [
      [['name'], ['Alert Section']],
      [['alertSection'], ['true']],
      [['headline'], [headline]],
      [['ctaPrev'], [prevButton]],
      [['ctaNext'], [nextButton]],
      [['slideoftext'], [slideOfText]],
      [['filter'], ['alert-section']],
      [['model'], ['alert-section']],
    ]);
    item.append(sectionMetadataBlock);
    addSection(sectionMetadataBlock);
  });
};

export default createServiceAlerts;
