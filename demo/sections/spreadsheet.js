// The gallery section of @catalystcommunity/spreadsheet. definitions are the tags that the demo defines.
import {FormulaBar, ShadowSpreadSheet, SheetCell, SheetModel, SpreadSheet, ariaShortcut, formatShortcut, validators as v} from '../../src/index.js';
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

// Data entry: the records are the data of the application. A fake server keeps them, and a
// second person adds rows, as a websocket would.
function entryCard() {
  const log = makeLog('sheet-entry-log');
  let nextId = 4;
  let failNext = false;
  let store = [
    {id: 1, item: 'Laptops', category: 'hardware', quantity: 4, price: '1299.00', paid: true},
    {id: 2, item: 'Licenses', category: 'software', quantity: 10, price: '89.00', paid: false},
    {id: 3, item: 'Training', category: 'services', quantity: 2, price: '650.00', paid: false},
  ];
  const sheet = el('spread-sheet', {'entry-rows': '2', label: 'Orders', 'data-testid': 'sheet-entry-element'});
  sheet.style.setProperty('--zest-spread-sheet-height', '16em');
  sheet.setColumns([
    {key: 'item', title: 'Item', validate: v.text({required: true, maxLength: 40}), width: 140},
    {key: 'category', title: 'Category', validate: v.oneOf([{value: 'hardware', label: 'Hardware'}, {value: 'software', label: 'Software'}, {value: 'services', label: 'Services'}], {required: true}), width: 110},
    {key: 'quantity', title: 'Quantity', validate: v.uint({required: true, max: 1000}), width: 90},
    {key: 'price', title: 'Unit price', type: 'currency', decimals: 2, validate: v.decimal({scale: 2, min: 0}), width: 100},
    {key: 'paid', title: 'Paid', validate: v.bool(), display: 'checkbox', width: 60},
    {title: 'Total', type: 'currency', decimals: 2, formula: '=C1*D1', width: 110},
    {key: 'due', title: 'Due', validate: v.date(), width: 110},
  ]);
  sheet.showConflicts = true;
  // A paid order is protected, as in a form that shows it
  sheet.lockRule = ({row}) => Boolean(sheet.records?.[row]?.paid);
  sheet.records = store;
  sheet.onSubmitRow = (record, context) => new Promise((resolve, reject) => {
    log.add(`send ${context.kind} ${JSON.stringify(record)}`);
    setTimeout(() => {
      if (failNext) {
        failNext = false;
        reject(new Error('The server did not accept the row'));
        return;
      }
      const saved = context.kind === 'new' ? {id: nextId++, ...record} : {...context.original, ...record};
      store = context.kind === 'new' ? [...store, saved] : store.map(item => (item.id === saved.id ? saved : item));
      resolve(saved);
      // The application gives the sheet its new data, as after a message from the server
      sheet.records = store;
    }, 400);
  });
  sheet.addEventListener('spreadsheet-row-state', (e) => log.add(`row ${e.detail.row + 1} ${e.detail.state}${e.detail.error ? `: ${e.detail.error}` : ''}`));
  sheet.addEventListener('spreadsheet-locked', (e) => log.add(`locked ${e.detail.operation} ${e.detail.cells.map(cell => cell.address).join(' ')}`));
  sheet.addEventListener('spreadsheet-row-conflict', (e) => log.add(`row ${e.detail.row + 1} changed elsewhere: ${e.detail.fields.join(', ')}`));
  const policy = el('select', {'data-testid': 'sheet-entry-policy', 'aria-label': 'Send a row'},
    ...['leave-row', 'enter', 'change', 'manual'].map(value => el('option', {value}, `Send on ${value}`)));
  policy.addEventListener('change', () => { sheet.submitOn = policy.value; sheet.focus(); });
  const locale = el('select', {'data-testid': 'sheet-entry-locale', 'aria-label': 'Locale'},
    ...[['', 'Locale of the page'], ['en-US', 'English (US)'], ['de-DE', 'Deutsch'], ['fr-FR', 'Français']].map(([value, label]) => el('option', {value}, label)));
  locale.addEventListener('change', () => { sheet.locale = locale.value; sheet.focus(); });
  const {submitRow, discardRow, undo} = sheet.actions;
  return wide(card('sheet-entry', 'Data entry: typed and protected columns, with rows from another person',
    el('p', {}, 'Type in the empty rows at the end. Tab goes to the next cell, and Enter goes to the start of the next row. Category lists its options as you type. Space changes Paid. Alt+Arrow Down opens the calendar of Due. A row goes to the server when you leave it. Paid rows are locked. Change a row, then click "Change row 2 elsewhere" to see a conflict.'),
    el('div', {class: 'controls'},
      policy,
      actionButton(submitRow, 'sheet-entry-send', sheet), actionButton(discardRow, 'sheet-entry-discard', sheet), actionButton(undo, 'sheet-entry-undo', sheet),
      button('sheet-entry-remote', 'Add a row from another person', () => {
        store = [...store, {id: nextId++, item: `Remote order ${nextId - 1}`, category: 'services', quantity: 1, price: '10.00', paid: false}];
        sheet.records = store;
        log.add('another person added a row');
      }),
      button('sheet-entry-fail', 'Fail the next send', () => { failNext = true; log.add('the next send fails'); }),
      button('sheet-entry-elsewhere', 'Change row 2 elsewhere', () => {
        store = store.map(item => (item.id === 2 ? {...item, price: (Number(item.price) + 1).toFixed(2)} : item));
        sheet.records = store;
        log.add('another person changed row 2');
      }),
      button('sheet-entry-keep', 'Keep my changes', () => { sheet.keepRowChanges(sheet.selection.top); sheet.focus(); }),
      locale),
    sheet,
    log,
  ));
}

export const section = {
  id: 'spreadsheet',
  title: 'Spreadsheet',
  render: () => [budgetCard(), entryCard(), cellsCard(), sharedCard(), largeCard()],
};
