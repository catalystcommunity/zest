// A spreadsheet application: 10,000 rows by 52 columns, a toolbar that shares the actions of the
// sheet, a formula bar, a status bar with statistics of the selection, and CSV import and export.
import {formatCellRange} from '../../src/index.js';
import {el} from '../kit.js';
import {actionButton} from '../sections/spreadsheet.js';

const REGIONS = ['North', 'South', 'East', 'West', 'Central'];
const PRODUCTS = ['Widget', 'Gadget', 'Gizmo', 'Doohickey', 'Sprocket', 'Flange'];
const ROWS = 10000;

function salesData() {
  const header = (input) => ({input, style: {bold: true}});
  const cells = {
    A1: header('Date'), B1: header('Region'), C1: header('Product'), D1: header('Units'), E1: header('Price'),
    F1: header('Revenue'), G1: header('Running total'), H1: header('Share'),
    J1: header('Summary'), J2: 'Total revenue', K2: `=SUM(F2:F${ROWS})`, J3: 'Average units', K3: `=AVERAGE(D2:D${ROWS})`,
    J4: 'Largest price', K4: `=MAX(E2:E${ROWS})`, J5: 'Rows', K5: `=COUNT(D2:D${ROWS})`,
  };
  // A fixed sequence, so that each load has the same numbers
  let seed = 7;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const start = Date.UTC(2026, 0, 1);
  for (let row = 2; row <= ROWS; row++) {
    const date = new Date(start + Math.floor((row - 2) / 8) * 86400000).toISOString().slice(0, 10);
    cells[`A${row}`] = date;
    cells[`B${row}`] = REGIONS[Math.floor(random() * REGIONS.length)];
    cells[`C${row}`] = PRODUCTS[Math.floor(random() * PRODUCTS.length)];
    cells[`D${row}`] = String(1 + Math.floor(random() * 40));
    cells[`E${row}`] = (5 + random() * 95).toFixed(2);
    cells[`F${row}`] = `=D${row}*E${row}`;
    cells[`G${row}`] = row === 2 ? '=F2' : `=G${row - 1}+F${row}`;
    cells[`H${row}`] = `=F${row}/$K$2`;
  }
  return {
    rows: ROWS,
    columns: [
      {type: 'date', width: 120}, {width: 90}, {width: 110}, {type: 'number'}, {type: 'currency', decimals: 2},
      {type: 'currency', decimals: 2, width: 120}, {type: 'currency', decimals: 2, width: 140}, {type: 'percent', decimals: 3},
      {}, {width: 130}, {type: 'currency', decimals: 2, width: 140},
      ...Array.from({length: 41}, () => ({})),
    ],
    cells,
  };
}

export function renderSpreadsheetExample() {
  const sheet = el('spread-sheet', {id: 'example-sheet', label: 'Sales', 'data-testid': 'example-sheet'});
  sheet.style.setProperty('--zest-spread-sheet-height', 'max(16em, 65vh)');
  const started = performance.now();
  sheet.load(salesData());
  const loadTime = Math.round(performance.now() - started);
  sheet.model.setStyle('K2', {bold: true});
  const bar = el('formula-bar', {for: 'example-sheet'});

  const actions = sheet.actions;
  const group = (label, ...ids) => el('div', {role: 'group', 'aria-label': label, class: 'controls'},
    ...ids.map(id => actionButton(actions[id], `example-${id}`, sheet)));

  // A file input has a width of its own that grows with the font, so it must be able to get smaller
  const file = el('input', {type: 'file', accept: '.csv,text/csv', id: 'example-csv', 'data-testid': 'example-import', style: 'max-width: 100%; min-width: 0;'});
  file.addEventListener('change', async () => {
    const chosen = file.files?.[0];
    if (!chosen) { return; }
    const text = await chosen.text();
    const lines = text.split('\n').length;
    sheet.load({rows: Math.max(1000, lines + 100), columns: 52});
    sheet.fromCSV(text, 'A1');
    file.value = '';
    sheet.focus();
  });
  const exportButton = el('button', {type: 'button', 'data-testid': 'example-export'}, 'Export CSV');
  exportButton.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([sheet.toCSV()], {type: 'text/csv'}));
    const link = el('a', {href: url, download: 'sheet.csv'});
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // The status bar: the statistics of the selection, as in a spreadsheet program
  const status = el('div', {class: 'sheet-status', 'data-testid': 'example-status', style: 'display: flex; flex-wrap: wrap; gap: 0.5em 1.5em; padding: 0.375em 0.5em; border-top: 1px solid; font-variant-numeric: tabular-nums;'});
  const number = new Intl.NumberFormat(undefined, {maximumFractionDigits: 2});
  let recalculated = 0;
  const showStatus = () => {
    const range = sheet.selection;
    const summary = sheet.model.summary(range);
    const parts = [formatCellRange(range), `Count: ${summary.count}`];
    if (summary.numbers) { parts.push(`Sum: ${number.format(summary.sum)}`, `Average: ${number.format(summary.average)}`); }
    parts.push(recalculated ? `Recalculated: ${recalculated} cells` : `Loaded ${ROWS} rows in ${loadTime} ms`);
    status.replaceChildren(...parts.map(text => el('span', {}, text)));
  };
  sheet.addEventListener('spreadsheet-select', showStatus);
  sheet.addEventListener('spreadsheet-change', () => {
    recalculated = sheet.model.lastRecalculated ?? 0;
    showStatus();
  });
  showStatus();

  return [
    el('p', {}, 'The sheet has 10,000 rows and 52 columns. Column G is a running total: a change in column D or E recalculates each row below it. Only the cells that you can see are in the page.'),
    el('div', {class: 'controls', style: 'flex-wrap: wrap;'},
      group('Edit', 'undo', 'redo', 'cut', 'copy', 'paste', 'clear'),
      group('Format', 'bold', 'italic', 'fillDown', 'fillRight'),
      group('Rows and columns', 'insertRow', 'deleteRow', 'insertColumn', 'deleteColumn'),
      el('div', {role: 'group', 'aria-label': 'File', class: 'controls', style: 'min-width: 0; max-width: 100%;'},
        el('label', {for: 'example-csv'}, 'Import CSV'), file, exportButton)),
    bar,
    sheet,
    status,
  ];
}
