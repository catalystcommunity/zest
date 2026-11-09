// Uses the declarations as an application does. tsc checks it; nothing runs it.
import { defineSpreadsheet, parseCellAddress, SHEET_FUNCTIONS, SheetError, SheetModel, type SheetValue } from '@catalystcommunity/spreadsheet';

defineSpreadsheet();
const sheet = document.createElement('spread-sheet');
sheet.formulaBar = true;
sheet.label = 'Budget';
sheet.load({
    columns: [{}, {type: 'number'}, {type: 'currency', currency: 'EUR', decimals: 2}],
    cells: {A1: 'Item', B1: 'Quantity', C1: 'Price', A2: 'Pens', B2: '12', C2: '1.5', C3: '=B2*C2'},
});
sheet.addEventListener('spreadsheet-change', (e) => { for (const change of e.detail.changes) { console.log(change.address, change.newInput); } });
sheet.addEventListener('spreadsheet-select', (e) => { console.log(e.detail.address, e.detail.range.top); });
sheet.selection = 'B2:C4';
sheet.model.setStyle('A1:C1', {bold: true});
sheet.actions.undo.trigger();
const remove = sheet.watch((reason, text) => { if (reason === 'edit') { console.log(text); } });
remove();

const display: string = sheet.getCell('C3').display;
const value: SheetValue = sheet.getValue(2, 2);

const model = new SheetModel({rows: 10, columns: 3});
model.addEventListener('change', (e) => { console.log(e.detail.history.canUndo); });
model.setCells([{address: 'A1', input: '1'}, {row: 1, col: 0, input: '=A1*2'}]);
model.batch(() => model.setType('A1:A2', 'number'));
const csv: string = model.toCSV({values: false});

SHEET_FUNCTIONS.DOUBLE = (args) => {
    const first = args[0];
    return typeof first === 'number' ? first * 2 : new SheetError('#VALUE!', 'not a number');
};
const at = parseCellAddress('B3');
void [display, value, csv, at?.row];
