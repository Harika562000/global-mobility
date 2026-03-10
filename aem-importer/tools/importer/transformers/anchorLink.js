import {
  createBlock, addSection, hasDirectTextNodeOnly, transformInnerBrTags,
} from './util.js';

function createTitle(el) {
  if (!el) return;
  const title = document.createElement('h2');
  title.textContent = el.textContent;
  el.replaceWith(title);
}

function createDynamicTable(el) {
  el.forEach((table) => {
    const tableBlockCells = [];
    const tableEl = table.querySelector('table');
    if (!tableEl) return;

    const tableCaptionEl = table.previousElementSibling;
    const tableCaption = tableCaptionEl?.textContent.trim();
    const tableCaptionAsH3 = document.createElement('h3');
    tableCaptionAsH3.textContent = '';
    if (tableCaptionEl) {
      tableCaptionAsH3.textContent = tableCaption;
      tableCaptionEl.replaceWith(tableCaptionAsH3);
    }

    const tableItems = table.querySelectorAll('table thead tr th');
    const tableId = table.id;

    const tableItemsWrapper = document.createElement('div');
    const tableItemList = document.createElement('ul');
    tableItems.forEach((item) => {
      const listItem = document.createElement('li');
      listItem.innerHTML = item.innerHTML;
      tableItemList.append(listItem);
      item.remove();
    });
    tableItemsWrapper.append(tableItemList);

    const itemCells = [];
    if (tableCaption) itemCells.push(tableCaptionAsH3);
    if (tableId) itemCells.push(tableId);
    tableBlockCells.push([itemCells], [tableItemsWrapper]);
    tableCaptionAsH3?.remove();

    const tblock = createBlock('Table', tableBlockCells, ['dynamic']);
    table.append(tblock);
  });
}

const createAnchorLink = (main, document, _, url) => {
  const anchorLink = main.querySelector('.ups-component.anchor-links');
  const isRegionComponent = anchorLink?.classList.contains('ups-country-wrapper');
  if (!anchorLink || isRegionComponent) return;

  const variants = ['without chevron'];
  const links = Array.from(anchorLink.querySelectorAll('.ups-container .anchor-list ul li'));
  const anchorWrapper = document.createElement('div');
  const anchorHeader = anchorLink.querySelector('.ups-container .anchor-header');
  const anchorUl = document.createElement('ul');
  anchorUl.append(...links);
  if (anchorHeader) anchorWrapper.append(anchorHeader);
  anchorWrapper.append(anchorUl);

  const block = createBlock('Link List', [[anchorWrapper]], variants);

  anchorLink.append(block);
  addSection(block);
  const isLocationsPage = new URL(url.href).pathname.includes('locations.page');

  links.forEach((link) => {
    const href = link.querySelector('a').getAttribute('href');
    const target = main.querySelector(href);

    if (target) {
      const linkItemTitle = target.querySelector('.block-header');
      const linkItemDescription = target.querySelector('.block-description');
      transformInnerBrTags(linkItemDescription);
      createTitle(linkItemTitle.querySelector('h3'));
      let upsTitleBlock;

      // Create UPS-title block if title is available
      if (linkItemTitle) {
        const heading = linkItemTitle.querySelector('h2');
        const upsTitleVariants = [''];
        const upsTitleBlockCells = [];
        upsTitleBlockCells.push(['']);
        upsTitleBlockCells.push([heading]);
        upsTitleBlock = createBlock('Ups Title', upsTitleBlockCells, upsTitleVariants);
      }

      const listStyle = [];
      const isOrderListAlphabetically = linkItemDescription?.querySelector('ol[style*="list-style-type: lower-alpha"]');
      /**
       * To remove isolated links being treated as CTAs
       */
      const anchorLinksInDescription = linkItemDescription?.querySelectorAll('a');
      anchorLinksInDescription.forEach((aLink) => {
        const parent = aLink.parentElement;
        const childNodes = Array.from(parent.childNodes).filter((node) => node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'BR');
        if (parent.tagName === 'P'
          && childNodes.length === 1
          && !hasDirectTextNodeOnly(parent)
          && !aLink.classList.contains('ups-cta')
        ) {
          const em = document.createElement('em');
          const bold = document.createElement('b');
          em.append(aLink);
          bold.append(em);
          parent.replaceWith(bold);
        }
      });

      if (upsTitleBlock) anchorLink.append(upsTitleBlock);
      if (linkItemDescription) anchorLink.append(linkItemDescription);

      const dynamicTables = linkItemDescription?.querySelectorAll('.component-body.fuel-surcharge');

      if (dynamicTables.length) {
        createDynamicTable(dynamicTables);
      } else {
        const hasTables = linkItemDescription.querySelectorAll('.component-body table');
        const tableCaption = linkItemDescription.querySelectorAll('.table-caption');
        hasTables.forEach((hasTable, index) => {
          if (hasTable) {
            const tableBlockCells = [];
            const blockCells = [];
            const captionWrapper = document.createElement('div');
            const tableHeaders = hasTable.querySelectorAll('thead tr th');
            const tableBody = hasTable.querySelectorAll('tbody tr');

            if (tableCaption[index]) {
              const captionTitle = document.createElement('h3');
              captionTitle.textContent = tableCaption[index].textContent;
              captionWrapper.append(captionTitle);
              tableCaption[index].remove();
            }

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

            const tableBlock = createBlock('Table', tableBlockCells, ['Standard Table']);
            hasTable.replaceWith(tableBlock);
          }
        });
      }

      if (isOrderListAlphabetically) {
        listStyle.push('bullet-alphabet');
      }
      if (isLocationsPage) {
        listStyle.push('location-page');
      }
      const sectionMetadataBlock = createBlock('Section Metadata', [
        [['style'], listStyle],
        [['id'], [href.replace('#', '')]],
      ]);

      anchorLink.append(sectionMetadataBlock);
      addSection(sectionMetadataBlock);
    }
  });
};

export default createAnchorLink;
