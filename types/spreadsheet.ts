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

// Data entry
import { validators as v } from '@catalystcommunity/validators';
const entry = document.createElement('spread-sheet');
entry.entryRows = 2;
entry.submitOn = 'leave-row';
entry.setColumns([
    {key: 'item', title: 'Item', validate: v.text({required: true})},
    {key: 'quantity', title: 'Quantity', validate: v.uint()},
    {key: 'size', title: 'Size', validate: v.oneOf(['S', 'M', 'L'])},
    {title: 'Total', formula: '=B1*2'},
]);
entry.records = [{id: 1, item: 'Pens', quantity: 3, size: 'M'}];
entry.onSubmitRow = async (row, context) => {
    if (context.kind === 'update') { console.log(context.id, context.original); }
    return {id: 2, ...row};
};
entry.validateRow = (row) => (Number(row.quantity) > 10 ? {quantity: 'Ten or fewer.'} : null);
entry.submitWhen = (context) => context.valid && context.reason !== 'change';
entry.onInvalid = (context) => { if (context.source === 'user') { context.mark(); } };
entry.afterInvalid = (context) => console.log(context.address, context.message);
entry.lockRule = ({row}) => (row === 0 ? true : undefined);
entry.lockedCells = 'skip';
entry.onLocked = (detail) => console.log(detail.operation, detail.cells.length);
entry.addEventListener('spreadsheet-row-state', (e) => console.log(e.detail.row, e.detail.state));
entry.addEventListener('spreadsheet-locked', (e) => e.preventDefault());
const state = entry.rowState(0);
console.log(state, entry.submitAll(), entry.isLocked(0, 0), entry.optionsOf(2));
entry.model.setRow(3, {locked: true});
entry.model.setLocked('A1:B2', null);

// Locales, conflicts, and the options of this release
import { detectCsvFormat, canonicalCellInput, localCellInput, readClipboardTable } from '@catalystcommunity/spreadsheet';
entry.locale = 'de-DE';
entry.messages = {required: 'Bitte einen Wert eingeben.'};
entry.showConflicts = true;
entry.pasteSubmits = true;
entry.quietRows = true;
entry.keepText = false;
const changedElsewhere = entry.rowConflict(0);
if (changedElsewhere) { console.log(changedElsewhere.fields, changedElsewhere.incoming); entry.keepRowChanges(0); }
entry.addEventListener('spreadsheet-row-conflict', (e) => console.log(e.detail.row, e.detail.fields));
entry.addEventListener('spreadsheet-edit-refused', (e) => console.log(e.detail.message));
const refused: boolean = entry.setCell('A1', '5', {respectLocks: true});
const csvFormat = detectCsvFormat('a;1,5');
if (csvFormat.confident) { entry.fromCSV("a;1,5", "A1", {delimiter: csvFormat.delimiter, decimal: csvFormat.decimal ?? ".", order: csvFormat.order ?? undefined}); }
entry.fromCSV('a;1,5', 'A1', {delimiter: ';', locale: 'de-DE'});
console.log(refused, entry.inputText('A1'), entry.effectiveLocale, canonicalCellInput('1,5', 'de-DE'), localCellInput('1.5', 'de-DE', 'number'), readClipboardTable('<table></table>'));
entry.setColumns([{key: 'paid', title: 'Paid', type: 'boolean', display: 'checkbox'}, {key: 'qty', validate: v.uint(), strict: true}]);
