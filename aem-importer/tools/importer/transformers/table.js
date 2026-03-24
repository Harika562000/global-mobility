import { createBlock, addSection } from './util.js';

const createTable = (main, document) => {
  const tables = Array.from(main.querySelectorAll('.ups-component.table-component'));
  if (!tables.length) return;

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
      tableCaption.remove();
    }
    const footNote = table.querySelector('center p:not(:has(.ups-cta))') || document.querySelector('.component-body table + p');
    const CTALink = table.querySelector('center p:has(.ups-cta)');
    const tableFootNote = document.createElement('p');
    const tableId = document.createElement('p');
    tableId.textContent = '';
    const tableCTA = document.createElement('a');
    tableCTA.textContent = '';
    tableCTA.href = '';
    if (footNote) {
      captionWrapper.append(tableId,footNote);
    } else {
      captionWrapper.append(tableFootNote);
    }
    if (CTALink) {
      captionWrapper.append(CTALink);
    } else {
      captionWrapper.append(tableCTA);
    }
    const tableHeaders = table.querySelectorAll('.component-body table thead tr th');
    const tableBody = table.querySelectorAll('.component-body table tbody tr');

    if ((!tableHeaders.length && !tableBody.length) && !isOnlyPTag) return;

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
    addSection(block);
  });
};

export default createTable;
