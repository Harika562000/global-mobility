export default function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  const allSingleCell = rows.every((rowEl) => rowEl.children.length === 1);
  let row = null;

  const isPlaceholderColumn = (rowEl) => {
    const text = (rowEl.textContent || '').replace(/\u00A0/g, ' ').trim();
    return !text || text.toLowerCase() === 'column content';
  };

  if (allSingleCell && rows.length > 1) {
    const meaningfulRows = rows.filter((rowEl) => !isPlaceholderColumn(rowEl));
    const columnRows = meaningfulRows.length ? meaningfulRows : [rows[0]];

    row = document.createElement('div');
    row.classList.add('sp-table-row');
    columnRows.slice(0, 2).forEach((colRow, index) => {
      colRow.classList.add(index === 0 ? 'sp-table-base' : 'sp-table-addon');
      row.append(colRow);
    });
    block.replaceChildren(row);
    return;
  }

  row = block.querySelector(':scope > div');
  if (!row) return;

  row.classList.add('sp-table-row');
  const cols = row.querySelectorAll(':scope > div');
  cols.forEach((col, index) => {
    col.classList.add(index === 0 ? 'sp-table-base' : 'sp-table-addon');
  });
}
