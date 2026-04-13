export default function decorate(block) {
  // Skip decoration inside Universal Editor to preserve the component tree
  const isEditor = document.querySelector('html[data-aue-edit]')
    || block.closest('[data-aue-resource]')
    || block.querySelector('[data-aue-resource]');
  if (isEditor) return;

  const rows = [...block.children];
  if (!rows.length) return;

  const normalizeLabel = (value) => (value || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\*/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();

  const isPlaceholderText = (value) => {
    const normalized = normalizeLabel(value);
    return !normalized
      || normalized === 'column content'
      || normalized === 'first column'
      || normalized === 'second column';
  };

  const isPlaceholderColumn = (el) => isPlaceholderText(el?.textContent || '');

  const hasMeaningfulContent = (el) => {
    if (!el) return false;
    if (el.getAttribute('data-aue-empty') === 'true') return false;
    const text = (el.textContent || '').replace(/\u00A0/g, ' ').trim();
    if (isPlaceholderText(text)) return false;
    if (text) return true;
    return !!el.querySelector('img, picture, svg, video, iframe, ul, ol, table');
  };

  const hasSecondColumnContent = (el) => {
    if (!el) return false;
    if (el.getAttribute('data-aue-empty') === 'true') return false;
    const text = (el.textContent || '').replace(/\u00A0/g, ' ').trim();
    if (text && !isPlaceholderText(text)) return true;
    return !!el.querySelector('img, picture, svg, video, iframe, ul, ol, table');
  };

  const buildFromPropFields = () => {
    const itemRoots = [...block.querySelectorAll('[data-aue-component="sp-table-item"], [data-aue-component="sp-table-column"]')];
    const itemRoot = itemRoots[0] || block;
    const firstField = itemRoot.querySelector('[data-aue-prop="content" i], [data-aue-prop="firstcolumn" i]');
    const secondField = itemRoot.querySelector(
      '[data-aue-prop="secondColumn" i], [data-aue-prop="secondcolumn" i], [data-aue-prop="second-column" i]',
    );

    const firstNode = hasMeaningfulContent(firstField) ? firstField : null;
    const secondNode = hasSecondColumnContent(secondField) ? secondField : null;

    if (!firstNode && !secondNode) return null;

    const row = document.createElement('div');
    row.classList.add('sp-table-row');
    [firstNode, secondNode].filter(Boolean).forEach((col, index) => {
      col.classList.add(index === 0 ? 'sp-table-base' : 'sp-table-addon');
      row.append(col);
    });

    return row;
  };

  const isLabelCell = (text) => {
    const normalized = normalizeLabel(text);
    return normalized === 'column content'
      || normalized === 'first column'
      || normalized === 'second column';
  };

  const buildFromSingleItemFields = () => {
    let first = null;
    let second = null;

    rows.forEach((rowEl) => {
      const cells = [...rowEl.children];
      if (cells.length < 2) return;

      const label = normalizeLabel(cells[0].textContent || '');
      const valueCell = cells[1];

      if ((label === 'column content' || label === 'first column') && !isPlaceholderColumn(valueCell)) {
        first = first || valueCell;
      }

      if (label === 'second column' && !isPlaceholderColumn(valueCell)) {
        second = second || valueCell;
      }
    });

    if (!first && !second) {
      const twoValueCells = rows.find((rowEl) => {
        const cells = [...rowEl.children];
        return cells.length >= 2 && !isLabelCell(cells[0].textContent || '') && !isLabelCell(cells[1].textContent || '');
      });

      if (twoValueCells) {
        const cells = [...twoValueCells.children];
        const [firstCell, secondCell] = cells;
        if (!isPlaceholderColumn(firstCell)) first = firstCell;
        if (!isPlaceholderColumn(secondCell)) second = secondCell;
      }
    }

    if (!first && !second) return null;

    const row = document.createElement('div');
    row.classList.add('sp-table-row');
    [first, second].filter(Boolean).forEach((col, index) => {
      col.classList.add(index === 0 ? 'sp-table-base' : 'sp-table-addon');
      row.append(col);
    });

    return row;
  };

  const extractColumnNode = (rowEl) => {
    const cells = [...rowEl.children];
    if (cells.length === 0) return null;

    if (cells.length === 1) {
      return isPlaceholderColumn(cells[0]) ? null : cells[0];
    }

    if (cells.length >= 2 && isLabelCell(cells[0].textContent || '')) {
      return isPlaceholderColumn(cells[1]) ? null : cells[1];
    }

    return null;
  };

  const propFieldRow = buildFromPropFields();
  if (propFieldRow) {
    block.replaceChildren(propFieldRow);
    return;
  }

  const singleItemRow = buildFromSingleItemFields();
  if (singleItemRow) {
    block.replaceChildren(singleItemRow);
    return;
  }

  const extractedColumns = rows.map((rowEl) => extractColumnNode(rowEl)).filter(Boolean);
  if (extractedColumns.length) {
    const row = document.createElement('div');
    row.classList.add('sp-table-row');
    extractedColumns.slice(0, 2).forEach((col, index) => {
      col.classList.add(index === 0 ? 'sp-table-base' : 'sp-table-addon');
      row.append(col);
    });
    block.replaceChildren(row);
    return;
  }

  const row = block.querySelector(':scope > div');
  if (!row) return;

  row.classList.add('sp-table-row');
  const cols = [...row.querySelectorAll(':scope > div')].filter((col) => !isPlaceholderColumn(col));
  cols.slice(0, 2).forEach((col, index) => {
    col.classList.add(index === 0 ? 'sp-table-base' : 'sp-table-addon');
  });
}
