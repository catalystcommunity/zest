// The gallery section of @catalystcommunity/spreadsheet. definitions are the tags that the demo defines.
import {FormulaBar, ShadowSpreadSheet, SheetCell, SheetModel, SpreadSheet, ariaShortcut, formatShortcut} from '../../src/index.js';
import {button, card, el, makeLog} from '../kit.js';

export const definitions = {
  'spread-sheet': SpreadSheet,
  'shadow-spread-sheet': ShadowSpreadSheet,
  'sheet-cell': SheetCell,
  'formula-bar': FormulaBar,
};

// A native button that runs an action, and follows its enabled and checked states
export function actionButton(action, testId, sheet) {
  const element = el('button', {type: 'button', 'data-testid': testId});
  const show = () => {
    const shortcut = action.shortcut ? formatShortcut(action.shortcut) : '';
    element.textContent = action.label;
    element.title = shortcut ? `${action.label} (${shortcut})` : action.label;
    if (shortcut) { element.setAttribute('aria-keyshortcuts', ariaShortcut(action.shortcut)); }
    element.disabled = !action.enabled;
    if (action.checkable) { element.setAttribute('aria-pressed', String(action.checked)); }
  };
  show();
  action.addEventListener('change', show);
  element.addEventListener('click', () => {
    action.trigger(element);
    sheet?.focus();
  });
  return element;
}

function wide(element) {
  element.classList.add('wide');
  return element;
}

const budget = {
  columns: [
    {}, {}, {type: 'number'}, {type: 'currency', decimals: 2}, {type: 'currency', decimals: 2}, {type: 'percent', decimals: 1},
    {type: 'date'}, {type: 'boolean'},
  ],
  cells: {
    A1: {input: 'Item', style: {bold: true}}, B1: {input: 'Category', style: {bold: true}}, C1: {input: 'Quantity', style: {bold: true}},
    D1: {input: 'Unit price', style: {bold: true}}, E1: {input: 'Total', style: {bold: true}}, F1: {input: 'Share', style: {bold: true}},
    G1: {input: 'Due', style: {bold: true}}, H1: {input: 'Paid', style: {bold: true}},
    A2: 'Laptops', B2: 'Hardware', C2: '4', D2: '1299', E2: '=C2*D2', F2: '=E2/$E$7', G2: '2026-03-02', H2: 'TRUE',
    A3: 'Monitors', B3: 'Hardware', C3: '6', D3: '249.5', E3: '=C3*D3', F3: '=E3/$E$7', G3: '2026-03-09', H3: 'FALSE',
    A4: 'Licenses', B4: 'Software', C4: '10', D4: '89', E4: '=C4*D4', F4: '=E4/$E$7', G4: '2026-03-13', H4: 'TRUE',
    A5: 'Training', B5: 'Services', C5: '2', D5: '650', E5: '=C5*D5', F5: '=E5/$E$7', G5: '2026-04-01', H5: 'FALSE',
    A7: {input: 'Total', style: {bold: true}}, C7: '=SUM(C2:C5)', E7: {input: '=SUM(E2:E5)', style: {bold: true}}, F7: '=SUM(F2:F5)',
    A8: 'Paid items', C8: '=COUNTA(A2:A5)-COUNTBLANK(H2:H5)', E8: '=IF(AND(H2,H4), "Some paid", "None")',
    A9: 'Average price', D9: '=AVERAGE(D2:D5)', A10: 'Error example', E10: '=E7/0',
  },
};

function budgetCard() {
  const log = makeLog('sheet-log');
  const sheet = el('spread-sheet', {'formula-bar': '', rows: '14', columns: '8', label: 'Budget', 'data-testid': 'sheet-budget-element'});
  sheet.load({rows: 14, ...budget});
  sheet.style.setProperty('--zest-spread-sheet-height', '20em');
  sheet.model.setColumn(0, {width: 120});
  sheet.addEventListener('spreadsheet-change', (e) => {
    log.add(`change ${e.detail.changes.map(change => `${change.address}: ${JSON.stringify(change.newInput)}`).join(', ')}`);
  });
  sheet.addEventListener('spreadsheet-select', (e) => log.add(`select ${e.detail.address}`));
  const {undo, redo, bold, fillDown} = sheet.actions;
  return wide(card('sheet-budget', 'Typed columns and formulas, with a formula bar',
    el('p', {}, 'Type in a cell, or press F2 to edit. Arrow keys, Tab, and Enter move. Shift extends the selection. Ctrl+C and Ctrl+V copy and paste, also to other programs.'),
    el('div', {class: 'controls'},
      actionButton(undo, 'sheet-undo', sheet), actionButton(redo, 'sheet-redo', sheet),
      actionButton(bold, 'sheet-bold', sheet), actionButton(fillDown, 'sheet-fill', sheet)),
    sheet,
    log,
  ));
}

function cellsCard() {
  const cell = (input, type, label) => el('div', {class: 'sheet-cell-sample', style: 'display: grid; grid-template-columns: 6em minmax(0, 10em); gap: 0.5em; align-items: center; margin-block: 0.25em;'},
    el('span', {}, label), el('sheet-cell', {input, type, editable: '', 'data-testid': `sheet-cell-${type}`}));
  return card('sheet-cells', 'A cell that stands alone',
    el('p', {}, 'A SheetCell shows a typed input. An editable cell edits with Enter or a double click.'),
    cell('1234.5', 'currency', 'Currency'),
    cell('12.5', 'percent', 'Percent'),
    cell('2026-03-13', 'date', 'Date'),
    cell('=2^10', 'auto', 'Formula'),
  );
}

function sharedCard() {
  // Two views of one model: a change in one shows in the other
  const model = new SheetModel({rows: 6, columns: 4});
  model.load({cells: {A1: 'Edit here', A2: '5', B2: '=A2*A2', A3: '=B2+1'}});
  const editable = el('spread-sheet', {label: 'Shared model, editable', 'data-testid': 'sheet-shared-editable'});
  const shadow = el('shadow-spread-sheet', {readonly: '', label: 'Shared model, read only', 'data-testid': 'sheet-shared-readonly'});
  editable.model = model;
  shadow.model = model;
  for (const sheet of [editable, shadow]) { sheet.style.setProperty('--zest-spread-sheet-height', '10em'); }
  return card('sheet-shared', 'One model in two sheets: a light DOM sheet and a read-only shadow DOM sheet',
    editable, shadow);
}

function largeCard() {
  const status = el('p', {'data-testid': 'sheet-large-status'}, 'Loading.');
  const sheet = el('spread-sheet', {rows: '10000', columns: '100', label: 'Large sheet', 'data-testid': 'sheet-large-element'});
  const cells = {A1: '1'};
  for (let row = 2; row <= 10000; row++) { cells[`A${row}`] = `=A${row - 1}+1`; }
  const start = performance.now();
  sheet.load({rows: 10000, columns: 100, cells});
  status.textContent = `10,000 rows by 100 columns. Column A is a chain of 9,999 formulas. Load: ${Math.round(performance.now() - start)} ms.`;
  const time = el('output', {'data-testid': 'sheet-large-time'});
  return wide(card('sheet-large', 'A large sheet: only the visible cells exist',
    status,
    el('div', {class: 'controls'},
      button('sheet-large-change', 'Change A1, and recalculate the chain', () => {
        const before = performance.now();
        sheet.setCell('A1', String(Math.round(Math.random() * 1000)));
        time.textContent = `${sheet.model.lastRecalculated} cells in ${Math.round(performance.now() - before)} ms. A10000 is ${sheet.getValue('A10000')}.`;
      })),
    time,
    sheet,
  ));
}

export const section = {
  id: 'spreadsheet',
  title: 'Spreadsheet',
  render: () => [budgetCard(), cellsCard(), sharedCard(), largeCard()],
};
