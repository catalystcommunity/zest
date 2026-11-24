import { describe, it, expect, vi, afterEach } from 'vitest';
import { flushRenders } from '@catalystcommunity/base-components';
import { validators as v } from '@catalystcommunity/validators';
import { SpreadSheet, SheetCell, FormulaBar, SheetModel } from '../src';
import { argumentAt } from '../src/formula.js';

if (!customElements.get('spread-sheet')) {
    customElements.define('spread-sheet', SpreadSheet);
    customElements.define('sheet-cell', SheetCell);
    customElements.define('formula-bar', FormulaBar);
}

afterEach(() => {
    document.body.replaceChildren();
    flushRenders();
});

function make(attributes = {}, cells = {}) {
    const sheet = document.createElement('spread-sheet');
    for (const [name, value] of Object.entries(attributes)) { sheet.setAttribute(name, value); }
    document.body.append(sheet);
    sheet.load({cells});
    flushRenders();
    return sheet;
}
const grid = (sheet) => sheet.querySelector('[role="grid"]');
const editor = (sheet) => sheet.querySelector('.zest-editor');
const key = (sheet, init) => {
    const target = sheet.editing ? editor(sheet) : grid(sheet);
    const event = new KeyboardEvent('keydown', {bubbles: true, cancelable: true, composed: true, ...init});
    target.dispatchEvent(event);
    flushRenders();
    return event;
};
const typeInEditor = (sheet, text) => {
    const field = editor(sheet);
    field.value += text;
    field.setSelectionRange(field.value.length, field.value.length);
    field.dispatchEvent(new Event('input', {bubbles: true}));
    flushRenders();
};
// Types text as the person does: the first character starts the edit
const type = (sheet, text) => {
    key(sheet, {key: text[0]});
    if (text.length > 1) { typeInEditor(sheet, text.slice(1)); }
};
const cellElement = (sheet, address) => {
    const {row, col} = {row: Number(address.slice(1)) - 1, col: address.charCodeAt(0) - 65};
    return [...sheet.querySelectorAll('.zest-row [data-kind="cell"]')].find(cell => cell.row === row && cell.col === col && !cell.hidden);
};
const notices = () => document.querySelectorAll('notice-area [role="status"], notice-area .zest-notice');

describe('Tab and Enter', () => {
    it('Tab, Tab, Tab, Enter goes from B3 to B4, as in other spreadsheets', () => {
        const sheet = make();
        sheet.selection = 'B3';
        key(sheet, {key: 'Tab'});
        expect(sheet.activeAddress).toBe('C3');
        key(sheet, {key: 'Tab'});
        key(sheet, {key: 'Tab'});
        expect(sheet.activeAddress).toBe('E3');
        key(sheet, {key: 'Enter'});
        expect(sheet.activeAddress).toBe('B4');
    });

    it('keeps the start column while the person types in the cells', () => {
        const sheet = make();
        sheet.selection = 'B3';
        type(sheet, 'one');
        key(sheet, {key: 'Tab'});
        type(sheet, 'two');
        key(sheet, {key: 'Tab'});
        type(sheet, 'three');
        key(sheet, {key: 'Enter'});
        expect(sheet.activeAddress).toBe('B4');
        expect([sheet.getValue('B3'), sheet.getValue('C3'), sheet.getValue('D3')]).toEqual(['one', 'two', 'three']);
    });

    it('Shift+Enter goes up to the start column, and another move ends the run', () => {
        const sheet = make();
        sheet.selection = 'B3';
        key(sheet, {key: 'Tab'});
        key(sheet, {key: 'Tab'});
        key(sheet, {key: 'Enter', shiftKey: true});
        expect(sheet.activeAddress).toBe('B2');
        key(sheet, {key: 'Tab'});
        key(sheet, {key: 'ArrowDown'});
        key(sheet, {key: 'Enter'});
        expect(sheet.activeAddress).toBe('C4');
    });

    it('Tab at the last column goes to the next row, at the start column', () => {
        const sheet = make({columns: '4'});
        sheet.selection = 'B1';
        key(sheet, {key: 'Tab'});
        key(sheet, {key: 'Tab'});
        expect(sheet.activeAddress).toBe('D1');
        const event = key(sheet, {key: 'Tab'});
        expect(event.defaultPrevented).toBe(true);
        expect(sheet.activeAddress).toBe('B2');
        key(sheet, {key: 'Tab', shiftKey: true});
        expect(sheet.activeAddress).toBe('A2');
        key(sheet, {key: 'Tab', shiftKey: true});
        expect(sheet.activeAddress).toBe('D1');
    });
});

describe('formula editing', () => {
    it('the arrow keys put a reference in a formula after an operator', () => {
        const sheet = make();
        sheet.selection = 'B3';
        key(sheet, {key: '='});
        key(sheet, {key: 'ArrowRight'});
        expect(editor(sheet).value).toBe('=C3');
        key(sheet, {key: 'ArrowRight'});
        expect(editor(sheet).value).toBe('=D3');
        key(sheet, {key: 'ArrowDown', shiftKey: true});
        expect(editor(sheet).value).toBe('=D3:D4');
        typeInEditor(sheet, '+');
        key(sheet, {key: 'ArrowUp'});
        expect(editor(sheet).value).toBe('=D3:D4+B2');
        expect(sheet.editing).toBe(true);
        key(sheet, {key: 'Enter'});
        expect(sheet.getCell('B3').input).toBe('=D3:D4+B2');
        expect(sheet.activeAddress).toBe('B4');
    });

    it('after a value, an arrow key ends the edit as before', () => {
        const sheet = make();
        sheet.selection = 'A1';
        type(sheet, '=1+2');
        key(sheet, {key: 'ArrowDown'});
        expect(sheet.editing).toBe(false);
        expect(sheet.getValue('A1')).toBe(3);
        expect(sheet.activeAddress).toBe('A2');
    });

    it('F4 changes the reference at the caret: A1, $A$1, A$1, $A1', () => {
        const sheet = make();
        sheet.selection = 'C1';
        type(sheet, '=A1+B2');
        const field = editor(sheet);
        field.setSelectionRange(2, 2);
        key(sheet, {key: 'F4'});
        expect(field.value).toBe('=$A$1+B2');
        key(sheet, {key: 'F4'});
        expect(field.value).toBe('=A$1+B2');
        key(sheet, {key: 'F4'});
        expect(field.value).toBe('=$A1+B2');
        key(sheet, {key: 'F4'});
        expect(field.value).toBe('=A1+B2');
    });

    it('shows a box with a color for each reference of the formula', () => {
        const sheet = make();
        sheet.selection = 'D1';
        type(sheet, '=A1+B2:C3+A1');
        const boxes = [...sheet.querySelectorAll('.zest-ref-box')].filter(box => !box.hidden);
        expect(boxes.length).toBe(2);
        expect(boxes.map(box => box.dataset.color)).toEqual(['0', '1']);
        key(sheet, {key: 'Escape'});
        expect([...sheet.querySelectorAll('.zest-ref-box')].filter(box => !box.hidden).length).toBe(0);
    });

    it('lists the functions, and Tab puts the name and the parenthesis in', () => {
        const sheet = make();
        sheet.selection = 'A1';
        type(sheet, '=su');
        const list = document.querySelector('type-ahead-list [role="listbox"]');
        expect([...list.children].map(item => item.textContent.replace(/SUM\(.*\)$/, ''))).toContain('SUM');
        const tab = key(sheet, {key: 'Tab'});
        expect(tab.defaultPrevented).toBe(true);
        expect(editor(sheet).value).toBe('=SUM(');
        expect(sheet.editing).toBe(true);
    });

    it('Enter on a formula keeps the typed name when a function suggestion is open', () => {
        const sheet = make();
        type(sheet, '=su');
        expect(document.querySelector('type-ahead-list [role="option"]')).not.toBeNull();
        key(sheet, {key: 'Enter'});
        expect(sheet.model.getInput('A1')).toBe('=su');
        expect(sheet.activeAddress).toBe('A2');
        expect(sheet.editing).toBe(false);
    });

    it('a scroll does not end the edit', () => {
        const sheet = make({rows: '1000'});
        sheet.selection = 'A1';
        type(sheet, 'hello');
        grid(sheet).scrollTop = 5000;
        grid(sheet).dispatchEvent(new Event('scroll'));
        flushRenders();
        expect(sheet.editing).toBe(true);
        expect(editor(sheet).value).toBe('hello');
    });
});

describe('argument hint', () => {
    it('finds the function and the argument at the caret', () => {
        expect(argumentAt('=SUM(A1, ', 9)).toEqual({name: 'SUM', index: 1, start: 1});
        expect(argumentAt('=IF(A1>0, ROUND(B1', 18)).toEqual({name: 'ROUND', index: 0, start: 10});
        expect(argumentAt('=IF(A1>0, ROUND(B1, 2), ', 24)).toEqual({name: 'IF', index: 2, start: 1});
        expect(argumentAt('=CONCAT("a,(b", ', 16)).toEqual({name: 'CONCAT', index: 1, start: 1});
        expect(argumentAt('=(A1+', 5)).toBe(null);
        expect(argumentAt('SUM(', 4)).toBe(null);
    });

    it('shows the arguments above the editor, with the current one in bold', () => {
        const sheet = make();
        sheet.selection = 'B3';
        type(sheet, '=ROUND(');
        const hint = sheet.querySelector('.zest-arg-hint');
        expect(hint.hidden).toBe(false);
        expect(hint.textContent).toBe('ROUND(number, digits)');
        expect(hint.querySelector('b').textContent).toBe('number');
        typeInEditor(sheet, 'A1, ');
        expect(hint.querySelector('b').textContent).toBe('digits');
        typeInEditor(sheet, '2)');
        expect(hint.hidden).toBe(true);
    });

    it('the repeated argument stays bold after the first', () => {
        const sheet = make();
        type(sheet, '=SUM(1, 2, ');
        expect(sheet.querySelector('.zest-arg-hint b').textContent).toBe('number');
    });
});

describe('locked cells', () => {
    it('refuses an edit of a locked cell, tells the person, and marks the cell read only', async () => {
        const sheet = make({}, {A1: 'fixed'});
        sheet.model.setColumn(0, {locked: true});
        flushRenders();
        const refused = vi.fn();
        sheet.addEventListener('spreadsheet-locked', refused);
        sheet.selection = 'A1';
        key(sheet, {key: 'x'});
        expect(sheet.editing).toBe(false);
        expect(sheet.getValue('A1')).toBe('fixed');
        expect(refused).toHaveBeenCalledTimes(1);
        expect(refused.mock.calls[0][0].detail.message).toBe('Cell A1 is locked. You cannot change it.');
        // A new notice area waits a short time, so that a screen reader hears its first notice
        await vi.waitFor(() => expect([...document.querySelectorAll('notice-area .zest-notice')].map(item => item.textContent).join(' ')).toContain('Cell A1 is locked'));
        expect(cellElement(sheet, 'A1').getAttribute('aria-readonly')).toBe('true');
        expect(cellElement(sheet, 'A1').classList.contains('zest-locked')).toBe(true);
        expect(sheet.isLocked(0, 1)).toBe(false);
    });

    it('a cell setting wins over its row, and a row setting wins over its column', () => {
        const model = new SheetModel({rows: 5, columns: 3});
        model.setColumn(0, {locked: true});
        model.setRow(1, {locked: false});
        model.setLocked('A2', true);
        expect(model.isLocked(0, 0)).toBe(true);
        expect(model.isLocked(1, 0)).toBe(true);
        model.setLocked('A2', null);
        expect(model.isLocked(1, 0)).toBe(false);
        expect(model.isLocked(2, 1)).toBe(false);
    });

    it('a paste or a clear that touches a locked cell changes nothing, by default', () => {
        const sheet = make({}, {A1: '1', B1: '2'});
        sheet.model.setLocked('B1', true);
        sheet.selection = 'A1:B1';
        key(sheet, {key: 'Delete'});
        expect([sheet.getValue('A1'), sheet.getValue('B1')]).toEqual([1, 2]);
        expect(sheet.model.canUndo).toBe(false);
    });

    it('with locked-cells="skip", the other cells change', () => {
        const sheet = make({'locked-cells': 'skip'}, {A1: '1', B1: '2'});
        sheet.model.setLocked('B1', true);
        sheet.selection = 'A1:B1';
        key(sheet, {key: 'Delete'});
        expect([sheet.getValue('A1'), sheet.getValue('B1')]).toEqual([null, 2]);
        expect(document.querySelector('notice-area')).toBe(null);
    });

    it('onLocked replaces the notice, and locked-notice="false" turns it off', () => {
        const sheet = make({'locked-notice': 'false'}, {A1: '1'});
        sheet.model.setLocked('A1', true);
        sheet.selection = 'A1';
        key(sheet, {key: 'Delete'});
        expect(document.querySelector('notice-area')).toBe(null);
        sheet.lockedNotice = true;
        sheet.onLocked = vi.fn();
        key(sheet, {key: 'Delete'});
        expect(sheet.onLocked).toHaveBeenCalledWith(expect.objectContaining({operation: 'clear', cells: [{row: 0, col: 0, address: 'A1'}]}));
        expect(document.querySelector('notice-area')).toBe(null);
    });

    it('lockRule decides first, and refresh() shows its new answer', () => {
        const sheet = make({}, {A1: '1', A2: '2'});
        let frozen = 0;
        sheet.lockRule = ({row}) => (row <= frozen ? true : undefined);
        sheet.refresh();
        flushRenders();
        expect(cellElement(sheet, 'A1').classList.contains('zest-locked')).toBe(true);
        expect(cellElement(sheet, 'A2').classList.contains('zest-locked')).toBe(false);
        frozen = 1;
        sheet.refresh();
        flushRenders();
        expect(cellElement(sheet, 'A2').classList.contains('zest-locked')).toBe(true);
    });

    it('lockRule cannot unlock a cell that the model locks', () => {
        const sheet = make({}, {A1: '1'});
        sheet.model.setLocked('A1', true);
        sheet.lockRule = () => false;
        expect(sheet.isLocked(0, 0)).toBe(true);
    });

    it('code changes a locked cell, unless it asks to follow the locks', () => {
        const sheet = make({'locked-notice': 'false'}, {A1: '1', B1: '2'});
        sheet.model.setLocked('A1', true);
        expect(sheet.setCell('A1', '5')).toBe(true);
        expect(sheet.getValue('A1')).toBe(5);
        expect(sheet.setCell('A1', '6', {respectLocks: true})).toBe(false);
        expect(sheet.getValue('A1')).toBe(5);
        expect(sheet.setCells([{address: 'A1', input: '7'}, {address: 'B1', input: '8'}], {respectLocks: true})).toBe(false);
        expect(sheet.getValue('B1')).toBe(2);
        sheet.lockedCells = 'skip';
        expect(sheet.setCells([{address: 'A1', input: '7'}, {address: 'B1', input: '8'}], {respectLocks: true})).toBe(true);
        expect([sheet.getValue('A1'), sheet.getValue('B1')]).toEqual([5, 8]);
    });

    it('with skip-locked, Tab and Enter go past locked cells', () => {
        const sheet = make({'skip-locked': ''});
        sheet.model.setColumn(1, {locked: true});
        sheet.model.setRow(1, {locked: true});
        sheet.selection = 'A1';
        key(sheet, {key: 'Tab'});
        expect(sheet.activeAddress).toBe('C1');
        sheet.selection = 'A1';
        key(sheet, {key: 'Enter'});
        expect(sheet.activeAddress).toBe('A3');
    });

    it('an undo that would change a locked cell does nothing', () => {
        const sheet = make();
        sheet.selection = 'A1';
        type(sheet, 'x');
        key(sheet, {key: 'Enter'});
        sheet.model.setLocked('A1', true);
        key(sheet, {key: 'z', ctrlKey: true});
        expect(sheet.getValue('A1')).toBe('x');
    });
});

describe('validation', () => {
    it('a strict column keeps an invalid edit in the editor until the person corrects it or presses Escape', () => {
        const sheet = make();
        sheet.model.setColumn(0, {validate: v.uint({max: 10}), strict: true});
        const refused = vi.fn();
        sheet.addEventListener('spreadsheet-edit-refused', refused);
        type(sheet, '50');
        key(sheet, {key: 'Enter'});
        expect(sheet.editing).toBe(true);
        expect(sheet.activeAddress).toBe('A1');
        expect(editor(sheet).getAttribute('aria-invalid')).toBe('true');
        expect(refused).toHaveBeenCalledWith(expect.objectContaining({detail: expect.objectContaining({address: 'A1', text: '50'})}));
        key(sheet, {key: 'Tab'});
        expect(sheet.editing).toBe(true);
        editor(sheet).value = '';
        typeInEditor(sheet, '5');
        expect(editor(sheet).hasAttribute('aria-invalid')).toBe(false);
        key(sheet, {key: 'Enter'});
        expect(sheet.editing).toBe(false);
        expect(sheet.getValue('A1')).toBe(5);
        sheet.selection = 'A1';
        type(sheet, 'x');
        key(sheet, {key: 'Escape'});
        expect(sheet.editing).toBe(false);
        expect(sheet.getValue('A1')).toBe(5);
    });

    it('the default post-invalid handler marks the cell, and a valid input removes the mark', () => {
        const sheet = make();
        sheet.model.setColumn(0, {validate: v.int({min: 0})});
        sheet.onValid = vi.fn();
        sheet.selection = 'A1';
        type(sheet, 'abc');
        key(sheet, {key: 'Enter'});
        const cell = cellElement(sheet, 'A1');
        expect(cell.classList.contains('zest-invalid')).toBe(true);
        expect(cell.getAttribute('aria-invalid')).toBe('true');
        expect(cell.title).toBe('Type a whole number.');
        expect(sheet.onValid).not.toHaveBeenCalled();
        sheet.selection = 'A1';
        type(sheet, '5');
        key(sheet, {key: 'Enter'});
        expect(cellElement(sheet, 'A1').classList.contains('zest-invalid')).toBe(false);
        expect(sheet.onValid).toHaveBeenCalledWith(expect.objectContaining({address: 'A1', value: 5, source: 'user'}));
    });

    it('onInvalid replaces the mark, and context.mark() adds it', () => {
        const sheet = make();
        sheet.model.setColumn(0, {validate: v.int()});
        const seen = [];
        sheet.onInvalid = (context) => { seen.push(context.message); if (context.input === 'mark me') { context.mark(); } };
        sheet.selection = 'A1';
        type(sheet, 'x');
        key(sheet, {key: 'Enter'});
        expect(cellElement(sheet, 'A1').classList.contains('zest-invalid')).toBe(false);
        type(sheet, 'mark me');
        key(sheet, {key: 'Enter'});
        expect(cellElement(sheet, 'A2').classList.contains('zest-invalid')).toBe(true);
        expect(seen).toEqual(['Type a whole number.', 'Type a whole number.']);
    });

    it('a boolean column can show check boxes, which Space and a click change', () => {
        const sheet = make({}, {A1: 'TRUE'});
        sheet.model.setColumn(0, {type: 'boolean', display: 'checkbox', title: 'Paid'});
        flushRenders();
        const box = () => cellElement(sheet, 'A1').querySelector('[role="checkbox"]');
        expect(box().getAttribute('aria-checked')).toBe('true');
        expect(box().getAttribute('aria-label')).toBe('Paid');
        sheet.selection = 'A1';
        key(sheet, {key: ' '});
        expect(sheet.getValue('A1')).toBe(false);
        expect(box().getAttribute('aria-checked')).toBe('false');
        box().dispatchEvent(new MouseEvent('click', {bubbles: true}));
        flushRenders();
        expect(sheet.getValue('A1')).toBe(true);
        expect(cellElement(sheet, 'A2').querySelector('[role="checkbox"]')).not.toBe(null);
    });

    it('messages of the sheet change the messages of the validators', () => {
        const sheet = make();
        sheet.messages = {max: (limit) => `Höchstens ${limit}.`};
        sheet.model.setColumn(0, {validate: v.int({max: 3})});
        sheet.selection = 'A1';
        type(sheet, '9');
        key(sheet, {key: 'Enter'});
        expect(sheet.getCell('A1').mark).toEqual({invalid: true, message: 'Höchstens 3.'});
    });

    it('Alt+Arrow Down opens a calendar for a date cell, and a pick writes the cell', () => {
        const sheet = make({}, {A1: '2026-11-21'});
        sheet.model.setColumn(0, {validate: v.date()});
        sheet.selection = 'A1';
        key(sheet, {key: 'ArrowDown', altKey: true});
        const popup = sheet.querySelector('.zest-date-popup');
        expect(popup).not.toBe(null);
        expect(popup.getAttribute('role')).toBe('dialog');
        const picker = popup.querySelector('date-time-picker');
        expect(picker.getAttribute('mode')).toBe('date');
        expect(picker.getAttribute('value')).toBe('2026-11-21');
        picker.dispatchEvent(new CustomEvent('date-changed', {bubbles: true, detail: {value: '2026-12-24'}}));
        flushRenders();
        expect(sheet.model.getInput('A1')).toBe('2026-12-24');
        expect(sheet.querySelector('.zest-date-popup')).toBe(null);
        // A timestamp column has a date and a time, and stays open until Escape
        sheet.model.setColumn(1, {validate: v.timestamp()});
        sheet.selection = 'B1';
        key(sheet, {key: 'ArrowDown', altKey: true});
        const second = sheet.querySelector('.zest-date-popup date-time-picker');
        expect(second.getAttribute('mode')).toBe('datetime');
        second.dispatchEvent(new CustomEvent('date-changed', {bubbles: true, detail: {date: new Date('2026-12-24T10:00:00Z')}}));
        expect(sheet.model.getInput('B1')).toBe('2026-12-24T10:00:00.000Z');
        sheet.querySelector('.zest-date-popup').dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));
        expect(sheet.querySelector('.zest-date-popup')).toBe(null);
    });

    it('the calendar does not open for a locked cell, and a text column has none', () => {
        const sheet = make({'locked-notice': 'false'});
        sheet.model.setColumn(0, {validate: v.date(), locked: true});
        sheet.selection = 'A1';
        key(sheet, {key: 'ArrowDown', altKey: true});
        expect(sheet.querySelector('.zest-date-popup')).toBe(null);
        sheet.selection = 'B1';
        key(sheet, {key: 'ArrowDown', altKey: true});
        expect(sheet.querySelector('.zest-date-popup')).toBe(null);
    });

    it('a paste of option labels stores the values', () => {
        const sheet = make();
        sheet.model.setColumn(0, {validate: v.oneOf([{value: 's', label: 'Small'}, {value: 'l', label: 'Large'}])});
        sheet.selection = 'A1';
        const event = new Event('paste', {bubbles: true, cancelable: true});
        event.clipboardData = {getData: () => 'small\nL\nHuge'};
        grid(sheet).focus();
        document.dispatchEvent(event);
        flushRenders();
        expect([sheet.model.getInput('A1'), sheet.model.getInput('A2'), sheet.model.getInput('A3')]).toEqual(['s', 'l', 'Huge']);
        expect(sheet.getCell('A3').mark?.invalid).toBe(true);
    });

    it('afterInvalid runs after the default mark', () => {
        const sheet = make();
        sheet.model.setColumn(0, {validate: v.int()});
        sheet.afterInvalid = vi.fn((context) => expect(context.reason).toBe('type'));
        sheet.selection = 'A1';
        type(sheet, 'x');
        key(sheet, {key: 'Enter'});
        expect(sheet.afterInvalid).toHaveBeenCalledTimes(1);
        expect(cellElement(sheet, 'A1').classList.contains('zest-invalid')).toBe(true);
    });

    it('marks invalid data from a load, and a validate function also works', () => {
        const sheet = document.createElement('spread-sheet');
        document.body.append(sheet);
        sheet.load({columns: [{validate: (text) => (text === 'ok' ? {valid: true, value: text} : {valid: false, message: 'Type ok.'})}], cells: {A1: 'ok', A2: 'no'}});
        flushRenders();
        expect(sheet.getCell('A2').mark).toEqual({invalid: true, message: 'Type ok.'});
        expect(sheet.getCell('A1').mark).toBe(null);
    });

    it('a column with options shows the labels, saves the values, and lists the options while the person types', () => {
        const sheet = make();
        sheet.model.setColumn(0, {title: 'Size', validate: v.oneOf([{value: 's', label: 'Small'}, {value: 'l', label: 'Large'}])});
        sheet.selection = 'A1';
        type(sheet, 'sm');
        const list = document.querySelector('type-ahead-list [role="listbox"]');
        expect(list.getAttribute('aria-label')).toBe('Size options');
        expect([...list.children].map(item => item.textContent)).toEqual(['Small']);
        // Enter takes the option and keeps the cell; the next Enter saves it and moves.
        key(sheet, {key: 'Enter'});
        expect(editor(sheet).value).toBe('Small');
        expect(sheet.activeAddress).toBe('A1');
        key(sheet, {key: 'Enter'});
        expect(sheet.getCell('A1').input).toBe('s');
        expect(sheet.getCell('A1').display).toBe('Small');
        expect(sheet.activeAddress).toBe('A2');
        sheet.selection = 'A1';
        key(sheet, {key: 'F2'});
        expect(editor(sheet).value).toBe('Small');
    });

    it('Space changes a boolean cell', () => {
        const sheet = make();
        sheet.model.setColumn(0, {validate: v.bool()});
        sheet.selection = 'A1';
        key(sheet, {key: ' '});
        expect(sheet.getValue('A1')).toBe(true);
        key(sheet, {key: ' '});
        expect(sheet.getValue('A1')).toBe(false);
    });

    it('gives the editor the keyboard of the type', () => {
        const sheet = make();
        sheet.model.setColumn(0, {validate: v.uint()});
        sheet.selection = 'A1';
        key(sheet, {key: '1'});
        expect(editor(sheet).inputMode).toBe('numeric');
    });
});

const COLUMNS = [
    {key: 'item', title: 'Item', validate: v.text({required: true})},
    {key: 'quantity', title: 'Quantity', validate: v.uint({required: true})},
    {key: 'price', title: 'Price', validate: v.decimal({scale: 2})},
    {title: 'Total', formula: '=B1*C1'},
];

function entrySheet(records = [], attributes = {}) {
    const sheet = make({'entry-rows': '2', ...attributes});
    sheet.setColumns(COLUMNS);
    sheet.records = records;
    flushRenders();
    return sheet;
}

const flush = async () => {
    for (let i = 0; i < 4; i++) { await Promise.resolve(); }
    flushRenders();
};

describe('record fields across column sets', () => {
    const item = {key: 'item', type: 'text'};
    const category = {key: 'category', type: 'text'};
    const quantity = {key: 'quantity', validate: v.uint()};
    const order = {id: 1, item: 'Licenses', category: 'Software', quantity: 4};

    it('uses field keys for an edit, the undo history and the submitted record', () => {
        const sheet = entrySheet([order], {'submit-on': 'manual'});
        sheet.setColumns([item, category, quantity]);
        sheet.onSubmitRow = vi.fn();
        sheet.writeByUser('A1', 'Annual licenses');
        sheet.setColumns([category, item]);
        expect(sheet.getValue('A1')).toBe('Software');
        expect(sheet.getValue('B1')).toBe('Annual licenses');
        key(sheet, {key: 'z', ctrlKey: true});
        expect(sheet.rowState(0)).toBe('clean');
        expect(sheet.getValue('B1')).toBe('Licenses');
        key(sheet, {key: 'y', ctrlKey: true});
        expect(sheet.getValue('B1')).toBe('Annual licenses');
        sheet.setColumns([quantity]);
        expect(sheet.rowRecord(0).record).toEqual({quantity: 4, item: 'Annual licenses'});
        expect(sheet.toCSV()).not.toContain('Annual licenses');
        expect(sheet.toJSON().columns).toEqual([quantity]);
        expect(sheet.submitRow(0)).toBe(true);
        expect(sheet.onSubmitRow).toHaveBeenCalledWith({quantity: 4, item: 'Annual licenses'}, expect.objectContaining({id: 1}));
    });

    it('keeps a hidden invalid input on a new row, then accepts its correction', () => {
        const sheet = entrySheet([], {'submit-on': 'change'});
        sheet.setColumns([item, {...quantity, strict: true}]);
        sheet.onSubmitRow = vi.fn();
        sheet.selection = 'B1';
        type(sheet, 'wrong');
        sheet.setColumns([item]);
        expect(sheet.editing).toBe(false);
        expect(sheet.rowState(0)).toBe('draft');
        expect(sheet.rowRecord(0).errors.quantity).toBeTruthy();
        expect(sheet.submitRow(0)).toBe(false);
        expect(sheet.onSubmitRow).not.toHaveBeenCalled();
        sheet.records = [order];
        sheet.setColumns([quantity, item]);
        expect(sheet.model.getInput('A2')).toBe('wrong');
        sheet.writeByUser('A2', '7');
        expect(sheet.onSubmitRow).toHaveBeenCalledWith({quantity: 7, item: null}, expect.objectContaining({kind: 'new'}));
    });

    it('detects a conflict on a hidden edit and discard restores the incoming value', () => {
        const sheet = entrySheet([order], {'submit-on': 'manual', 'show-conflicts': ''});
        sheet.setColumns([item, quantity, category]);
        sheet.writeByUser('A1', '');
        sheet.setColumns([quantity]);
        sheet.records = [{...order, item: 'Remote', category: 'Service'}];
        expect(sheet.rowConflict(0).fields).toEqual(['item']);
        expect(sheet.submitRow(0)).toBe(false);
        expect(sheet.keepRowChanges(0)).toBe(true);
        expect(sheet.rowRecord(0).record).toEqual({quantity: 4, item: null});
        expect(sheet.discardRow(0)).toBe(true);
        sheet.setColumns([category, item]);
        expect([sheet.getValue('A1'), sheet.getValue('B1')]).toEqual(['Service', 'Remote']);
        expect(sheet.rowState(0)).toBe('clean');
    });

    it('loads a newly shown field from the record and keeps the hidden draft through a CSV import', () => {
        const sheet = entrySheet([order], {'submit-on': 'manual'});
        sheet.setColumns([item]);
        sheet.writeByUser('A1', 'Annual licenses');
        const views = [];
        const remove = sheet.watch(reason => {
            if (reason === 'change') { views.push(sheet.rowRecord(0).record); }
        });
        sheet.setColumns([category]);
        remove();
        expect(views).toEqual([{category: 'Software', item: 'Annual licenses'}]);
        expect(sheet.getValue('A1')).toBe('Software');
        sheet.fromCSV('Service,Extra', 'A1');
        expect(sheet.model.columnCount).toBe(2);
        expect(sheet.getValue('B1')).toBe('Extra');
        expect(sheet.rowRecord(0).record).toEqual({category: 'Service', item: 'Annual licenses'});
        sheet.setColumns([]);
        expect(sheet.rowRecord(0).record).toEqual({category: 'Service', item: 'Annual licenses'});
        sheet.setColumns([item, category]);
        expect(sheet.getValue('A1')).toBe('Annual licenses');
        expect(sheet.getValue('B1')).toBe('Service');
    });

    it('keeps a pending formula with its field and its dependencies through a failed send', async () => {
        const sheet = entrySheet([order], {'submit-on': 'manual'});
        const total = {key: 'total', type: 'number'};
        sheet.setColumns([quantity, total, item]);
        sheet.writeByUser('B1', '=A1*2');
        let fail;
        sheet.onSubmitRow = vi.fn(() => new Promise((_, reject) => { fail = reject; }));
        expect(sheet.submitRow(0)).toBe(true);
        sheet.setColumns([item, quantity]);
        expect(sheet.rowState(0)).toBe('pending');
        fail(new Error('Offline'));
        await flush();
        sheet.writeByUser('B1', '6');
        expect(sheet.rowRecord(0).record.total).toBe(12);
        sheet.setColumns([total, item, quantity]);
        expect(sheet.model.getInput('A1')).toBe('=C1*2');
        expect(sheet.submitRow(0)).toBe(true);
        expect(sheet.onSubmitRow.mock.lastCall[0]).toEqual({total: 12, item: 'Licenses', quantity: 6});
    });
});

describe('data entry', () => {
    it('calculates the formula column also in entry rows made before the columns', () => {
        const sheet = entrySheet([]);
        expect(sheet.getCell('D1').input).toBe('=B1*C1');
        expect(sheet.getCell('D2').input).toBe('=B2*C2');
    });

    it('shows the records, then the entry rows, and calculates the formula column', () => {
        const sheet = entrySheet([{id: 1, item: 'Pens', quantity: 12, price: '1.50'}]);
        expect(sheet.model.rowCount).toBe(3);
        expect(sheet.getValue('A1')).toBe('Pens');
        expect(sheet.getValue('D1')).toBe(18);
        expect(sheet.rowState(0)).toBe('clean');
        expect(sheet.rowState(1)).toBe('empty');
        expect(sheet.rowState(2)).toBe('empty');
        expect(sheet.isLocked(0, 3)).toBe(true);
        expect(sheet.model.canUndo).toBe(false);
    });

    it('a calculated column is blank in an empty entry row, and shows when the row gets input', () => {
        const sheet = entrySheet([{id: 1, item: 'Pens', quantity: 12, price: '1.50'}], {'submit-on': 'manual'});
        expect(cellElement(sheet, 'D1').textContent).toBe('18');
        expect(cellElement(sheet, 'D2').textContent).toBe('');
        sheet.selection = 'A2';
        type(sheet, 'Glue');
        key(sheet, {key: 'Enter'});
        expect(sheet.rowState(1)).not.toBe('empty');
        expect(cellElement(sheet, 'D2').textContent).toBe('0');
    });

    it('the column decides the type of a text value, unless keep-text is set', () => {
        for (const keep of [false, true]) {
            const sheet = make({'entry-rows': '1', ...(keep ? {'keep-text': ''} : {})});
            sheet.setColumns([{key: 'code', title: 'Code', type: 'number'}]);
            sheet.records = [{id: 1, code: '0042'}, {id: 2, code: '=1+1'}];
            flushRenders();
            expect(sheet.getValue('A1')).toBe(keep ? '0042' : 42);
            expect(sheet.getValue('A2')).toBe('=1+1');
            document.body.replaceChildren();
        }
    });

    it('the references of an open formula follow their rows when records move', () => {
        const first = {id: 1, item: 'Pens', quantity: 12, price: '1.50'};
        const sheet = entrySheet([first], {'submit-on': 'manual'});
        sheet.selection = 'A2';
        type(sheet, '=B1+1');
        editor(sheet).setSelectionRange(3, 3);
        sheet.records = [{id: 2, item: 'Glue', quantity: 1, price: '2.00'}, first];
        flushRenders();
        expect(editor(sheet).value).toBe('=B2+1');
        expect(editor(sheet).selectionStart).toBe(3);
        expect(sheet.activeAddress).toBe('A3');
    });

    it('with show-conflicts, a changed row that changed elsewhere waits for the person to decide', () => {
        const first = {id: 1, item: 'Pens', quantity: 12, price: '1.50'};
        const sheet = entrySheet([first], {'show-conflicts': '', 'submit-on': 'manual'});
        sheet.onSubmitRow = vi.fn();
        const seen = vi.fn();
        sheet.addEventListener('spreadsheet-row-conflict', seen);
        sheet.selection = 'B1';
        type(sheet, '20');
        key(sheet, {key: 'Enter'});
        sheet.records = [{...first, price: '1.75'}];
        flushRenders();
        expect(seen).toHaveBeenCalledWith(expect.objectContaining({detail: expect.objectContaining({row: 0, fields: ['price']})}));
        expect(sheet.rowConflict(0).fields).toEqual(['price']);
        expect(sheet.querySelector('[role="row"][aria-rowindex="2"] [role="rowheader"]').textContent).toContain('changed here and elsewhere');
        expect(sheet.submitRow(0)).toBe(false);
        expect(sheet.model.getInput('C1')).toBe('1.50');
        expect(sheet.keepRowChanges(0)).toBe(true);
        expect(sheet.rowConflict(0)).toBe(null);
        // The price, which the person did not change, takes the new version
        expect(sheet.model.getInput('C1')).toBe('1.75');
        expect(sheet.submitRow(0)).toBe(true);
        expect(sheet.onSubmitRow).toHaveBeenCalledWith(expect.objectContaining({quantity: 20, price: '1.75'}), expect.objectContaining({original: expect.objectContaining({price: '1.75'})}));
        // The same new version is told one time only
        sheet.records = [{...first, price: '1.75'}];
        expect(seen).toHaveBeenCalledTimes(1);
    });

    it('discardRow takes the new version of a row with a conflict', () => {
        const first = {id: 1, item: 'Pens', quantity: 12, price: '1.50'};
        const sheet = entrySheet([first], {'show-conflicts': '', 'submit-on': 'manual'});
        sheet.selection = 'B1';
        type(sheet, '20');
        key(sheet, {key: 'Enter'});
        sheet.records = [{...first, quantity: 30}];
        expect(sheet.discardRow(0)).toBe(true);
        expect(sheet.getValue('B1')).toBe(30);
        expect(sheet.rowState(0)).toBe('clean');
    });

    it('a text from the data stays a text', () => {
        const sheet = entrySheet([{id: 1, item: '=1+1', quantity: 1}, {id: 2, item: '0042', quantity: 2}]);
        expect(sheet.getValue('A1')).toBe('=1+1');
        expect(sheet.getValue('A2')).toBe('0042');
        expect(sheet.rowRecord(1).record.item).toBe('0042');
    });

    it('sends a new row when the person leaves it, with typed values', async () => {
        const sheet = entrySheet([]);
        const sent = [];
        sheet.onSubmitRow = (record, context) => { sent.push({record, kind: context.kind, reason: context.reason}); return Promise.resolve({id: 7, ...record}); };
        sheet.selection = 'A1';
        type(sheet, 'Pens');
        key(sheet, {key: 'Tab'});
        expect(sheet.rowState(0)).toBe('draft');
        // A new empty row came, so that there are still two
        expect(sheet.model.rowCount).toBe(3);
        type(sheet, '12');
        key(sheet, {key: 'Tab'});
        type(sheet, '1.5');
        key(sheet, {key: 'Enter'});
        expect(sheet.activeAddress).toBe('A2');
        expect(sent).toEqual([{record: {item: 'Pens', quantity: 12, price: '1.50'}, kind: 'new', reason: 'enter'}]);
        expect(sheet.rowState(0)).toBe('pending');
        expect(sheet.isLocked(0, 0)).toBe(true);
        await flush();
        expect(sheet.rowState(0)).toBe('sent');
        // The application puts the record in its data: the row becomes a record row
        sheet.records = [{id: 7, item: 'Pens', quantity: 12, price: '1.50'}];
        expect(sheet.rowState(0)).toBe('clean');
        expect(sheet.model.rowCount).toBe(3);
        expect(sheet.getValue('D1')).toBe(18);
    });

    it('does not send a row with a problem, and marks the empty required cells', () => {
        const sheet = entrySheet([]);
        sheet.onSubmitRow = vi.fn();
        sheet.selection = 'A1';
        type(sheet, 'Pens');
        key(sheet, {key: 'Enter'});
        expect(sheet.onSubmitRow).not.toHaveBeenCalled();
        expect(sheet.getCell('B1').mark).toEqual({invalid: true, message: 'Type a value.'});
        expect(sheet.rowState(0)).toBe('draft');
    });

    it('new data does not change a row that the person changed, and changes the others at once', () => {
        const sheet = entrySheet([{id: 1, item: 'Pens', quantity: 1}, {id: 2, item: 'Ink', quantity: 2}], {'submit-on': 'manual'});
        sheet.selection = 'B1';
        type(sheet, '5');
        key(sheet, {key: 'Enter'});
        expect(sheet.rowState(0)).toBe('changed');
        sheet.records = [{id: 1, item: 'Pens', quantity: 9}, {id: 2, item: 'Paper', quantity: 2}];
        expect(sheet.getValue('B1')).toBe(5);
        expect(sheet.getValue('A2')).toBe('Paper');
        sheet.discardRow(0);
        expect(sheet.getValue('B1')).toBe(9);
        expect(sheet.rowState(0)).toBe('clean');
    });

    it('a record from outside goes above the entry rows, and the open editor follows its row', () => {
        const sheet = entrySheet([{id: 1, item: 'Pens', quantity: 1}]);
        sheet.selection = 'A2';
        type(sheet, 'Glue');
        expect(sheet.editing).toBe(true);
        sheet.records = [{id: 1, item: 'Pens', quantity: 1}, {id: 2, item: 'Ink', quantity: 3}];
        flushRenders();
        expect(sheet.editing).toBe(true);
        expect(sheet.activeAddress).toBe('A3');
        expect(editor(sheet).value).toBe('Glue');
        key(sheet, {key: 'Tab'});
        expect(sheet.getValue('A3')).toBe('Glue');
        expect(sheet.getValue('A2')).toBe('Ink');
        expect(sheet.rowState(2)).toBe('draft');
    });

    it('undo follows the rows that moved', () => {
        const sheet = entrySheet([], {'submit-on': 'manual'});
        sheet.selection = 'A1';
        type(sheet, 'Glue');
        key(sheet, {key: 'Enter'});
        sheet.records = [{id: 1, item: 'Pens', quantity: 1}];
        expect(sheet.getValue('A2')).toBe('Glue');
        sheet.focus();
        key(sheet, {key: 'z', ctrlKey: true});
        expect(sheet.getValue('A2')).toBe(null);
        expect(sheet.getValue('A1')).toBe('Pens');
    });

    it('a failed send leaves the row for a change and a new send', async () => {
        const sheet = entrySheet([], {'submit-on': 'manual'});
        let fail = true;
        sheet.onSubmitRow = vi.fn(() => (fail ? Promise.reject(new Error('The server is down')) : Promise.resolve()));
        sheet.selection = 'A1';
        type(sheet, 'Pens');
        key(sheet, {key: 'Tab'});
        type(sheet, '2');
        key(sheet, {key: 'Tab'});
        expect(sheet.submitRow(0)).toBe(true);
        await flush();
        expect(sheet.rowState(0)).toBe('error');
        expect(sheet.rowError(0)).toBe('The server is down');
        const head = sheet.querySelector('.zest-row[data-state="error"] .zest-row-head');
        expect(head.textContent).toContain('not sent: The server is down');
        expect(sheet.isLocked(0, 0)).toBe(false);
        fail = false;
        sheet.submitRow(0);
        await flush();
        expect(sheet.rowState(0)).toBe('sent');
        expect(sheet.onSubmitRow).toHaveBeenCalledTimes(2);
    });

    it('with submit-on="change", the problems show at once, unless quiet-rows is set', () => {
        for (const quiet of [false, true]) {
            const sheet = entrySheet([], {'submit-on': 'change', ...(quiet ? {'quiet-rows': ''} : {})});
            sheet.onSubmitRow = vi.fn();
            sheet.selection = 'A1';
            type(sheet, 'Pens');
            key(sheet, {key: 'Tab'});
            expect(sheet.onSubmitRow).not.toHaveBeenCalled();
            expect(sheet.getCell('B1').mark?.invalid ?? false).toBe(!quiet);
            key(sheet, {key: 'ArrowDown'});
            expect(sheet.getCell('B1').mark?.invalid).toBe(true);
            document.body.replaceChildren();
        }
    });

    it('submitWhen decides, and validateRow checks more than one cell', () => {
        const sheet = entrySheet([], {'submit-on': 'manual'});
        sheet.onSubmitRow = vi.fn();
        sheet.validateRow = (record) => (record.quantity > 10 && !record.price ? {price: 'Type a price for more than 10.'} : null);
        sheet.submitWhen = (context) => context.reason === 'change' && context.valid;
        sheet.selection = 'A1';
        type(sheet, 'Pens');
        key(sheet, {key: 'Tab'});
        type(sheet, '20');
        key(sheet, {key: 'Tab'});
        expect(sheet.onSubmitRow).not.toHaveBeenCalled();
        type(sheet, '3');
        key(sheet, {key: 'Tab'});
        expect(sheet.onSubmitRow).toHaveBeenCalledWith({item: 'Pens', quantity: 20, price: '3.00'}, expect.objectContaining({kind: 'new', reason: 'change'}));
    });

    it('sends a changed record row as an update, with the original record', () => {
        const original = {id: 4, item: 'Pens', quantity: 1};
        const sheet = entrySheet([original]);
        sheet.onSubmitRow = vi.fn();
        sheet.selection = 'B1';
        type(sheet, '3');
        key(sheet, {key: 'ArrowDown'});
        expect(sheet.onSubmitRow).toHaveBeenCalledWith({item: 'Pens', quantity: 3, price: null}, expect.objectContaining({kind: 'update', id: 4, original}));
    });

    it('a paste of many lines makes enough entry rows', () => {
        const sheet = entrySheet([], {'submit-on': 'manual'});
        sheet.selection = 'A1';
        const event = new Event('paste', {bubbles: true, cancelable: true});
        event.clipboardData = {getData: () => 'a\t1\nb\t2\nc\t3\nd\t4'};
        grid(sheet).focus();
        document.dispatchEvent(event);
        flushRenders();
        expect(sheet.getValue('A4')).toBe('d');
        expect(sheet.rowState(3)).toBe('draft');
        expect(sheet.model.rowCount).toBe(6);
        sheet.onSubmitRow = vi.fn();
        expect(sheet.submitAll()).toBe(4);
        expect(sheet.submitAll()).toBe(0);
    });

    it('with paste-submits, a paste of many rows sends the complete rows at once', () => {
        const sheet = entrySheet([], {'paste-submits': ''});
        sheet.onSubmitRow = vi.fn();
        sheet.selection = 'A1';
        const event = new Event('paste', {bubbles: true, cancelable: true});
        event.clipboardData = {getData: () => 'a\t1\nb\t\nc\t3'};
        grid(sheet).focus();
        document.dispatchEvent(event);
        flushRenders();
        expect(sheet.onSubmitRow).toHaveBeenCalledTimes(2);
        expect(sheet.onSubmitRow).toHaveBeenCalledWith(expect.objectContaining({item: 'a', quantity: 1}), expect.objectContaining({reason: 'paste'}));
        expect(sheet.getCell('B2').mark?.invalid).toBe(true);
        expect(sheet.querySelector('.zest-live').textContent).toContain('2 rows sent, 1 with problems');
    });

    it('does not add or delete rows in data entry', () => {
        const sheet = entrySheet([{id: 1, item: 'Pens', quantity: 1}]);
        expect(sheet.actions.deleteRow.enabled).toBe(false);
        sheet.actions.deleteRow.trigger();
        expect(sheet.model.rowCount).toBe(3);
    });

    it('new data at the end of 10,000 records costs little', () => {
        const records = Array.from({length: 10000}, (_, i) => ({id: i, item: `Item ${i}`, quantity: i % 50, price: '1.00'}));
        const sheet = entrySheet(records);
        const next = [...records, {id: 10000, item: 'New', quantity: 1}];
        const start = performance.now();
        sheet.records = next;
        const time = performance.now() - start;
        expect(sheet.getValue('A10001')).toBe('New');
        expect(sheet.model.rowCount).toBe(10003);
        // Only the new row and the entry rows changed
        expect(time).toBeLessThan(400);
    });
});

describe('data entry, when the data comes before the answer', () => {
    it('a new row takes its record at once, with no second copy', async () => {
        const sheet = entrySheet([]);
        let finish;
        sheet.onSubmitRow = (record) => new Promise((resolve) => { finish = () => resolve({id: 9, ...record}); });
        sheet.selection = 'A1';
        type(sheet, 'Pens');
        key(sheet, {key: 'Tab'});
        type(sheet, '2');
        key(sheet, {key: 'Enter'});
        expect(sheet.rowState(0)).toBe('pending');
        // The websocket message comes first. With no id before the send, the sheet cannot know
        // that it is this row, so both show until the answer.
        sheet.records = [{id: 9, item: 'Pens', quantity: 2}];
        expect(sheet.rowState(1)).toBe('pending');
        finish();
        await flush();
        expect(sheet.rowState(0)).toBe('clean');
        expect(sheet.rowState(1)).toBe('empty');
        expect(sheet.model.rowCount).toBe(3);
        expect(sheet.getValue('A2')).toBe(null);
    });

    it('with newRecordId, the record from outside finds its row, and no second copy shows', async () => {
        const sheet = entrySheet([]);
        sheet.newRecordId = () => 'u-1';
        let finish;
        const sent = [];
        sheet.onSubmitRow = (record) => new Promise((resolve) => { sent.push(record); finish = () => resolve(record); });
        sheet.selection = 'A1';
        type(sheet, 'Pens');
        key(sheet, {key: 'Tab'});
        type(sheet, '2');
        key(sheet, {key: 'Enter'});
        expect(sent[0]).toEqual({id: 'u-1', item: 'Pens', quantity: 2, price: null});
        sheet.records = [{id: 'u-1', item: 'Pens', quantity: 2}];
        expect(sheet.rowState(0)).toBe('pending');
        expect(sheet.model.rowCount).toBe(3);
        finish();
        await flush();
        expect(sheet.rowState(0)).toBe('clean');
        expect(sheet.model.rowCount).toBe(3);
    });

    it('an updated record row takes the new record at once', async () => {
        const sheet = entrySheet([{id: 1, item: 'Pens', quantity: 1}]);
        let finish;
        sheet.onSubmitRow = () => new Promise((resolve) => { finish = resolve; });
        sheet.selection = 'B1';
        type(sheet, '3');
        key(sheet, {key: 'ArrowDown'});
        sheet.records = [{id: 1, item: 'Pens', quantity: 3}];
        finish();
        await flush();
        expect(sheet.rowState(0)).toBe('clean');
        expect(sheet.getValue('B1')).toBe(3);
    });
});

describe('record register', () => {
    it('keeps the source record and its key through edits, reordering, and conflicts', () => {
        const original = {code: 0, item: 'First', quantity: 1};
        const sheet = entrySheet([original], {'record-key': 'code', 'submit-on': 'manual'});
        sheet.lockRule = ({row, col}) => sheet.rowKey(row) === 0 && col === 2;
        sheet.writeByUser('A1', 'Local');
        const incoming = {...original, item: 'Remote'};
        sheet.records = [{code: 'next', item: 'Second'}, incoming, {item: 'No key'}];
        expect(sheet.rowKey(0)).toBe('next');
        expect(sheet.rowKey(1)).toBe(0);
        expect(sheet.isLocked(1, 2)).toBe(true);
        expect(sheet.rowOriginal(1)).toBe(original);
        expect(sheet.rowRecord(1).record.item).toBe('Local');
        expect(sheet.rowKey(2)).toBeNull();
        for (const row of [3, 99]) {
            expect(sheet.rowKey(row)).toBeNull();
            expect(sheet.rowOriginal(row)).toBeNull();
        }
        sheet.discardRow(1);
        expect(sheet.rowOriginal(1)).toBe(incoming);
    });

    it('updates the hint and its words on reused cells without changing validation or values', () => {
        const sheet = make({rows: '1000', columns: '2'}, {A1: 'Review'});
        let indicated = 0;
        sheet.cellHint = ({row, col}) => row === indicated && col === 0 ? 'attention' : null;
        flushRenders();
        const cell = cellElement(sheet, 'A1');
        expect(cell.textContent).toBe('Review Needs attention');
        expect(cell.classList.contains('zest-hint-attention')).toBe(true);
        expect(cell.hasAttribute('aria-invalid')).toBe(false);
        expect(sheet.getValue('A1')).toBe('Review');
        sheet.labels = {hints: {attention: 'Assess this row'}};
        flushRenders();
        expect(cell.textContent).toBe('Review Assess this row');
        indicated = 1;
        sheet.refresh();
        flushRenders();
        expect(cell.textContent).toBe('Review');
        expect(cell.classList.contains('zest-hint-attention')).toBe(false);
        expect(cellElement(sheet, 'A2').textContent.trim()).toBe('Assess this row');
        grid(sheet).scrollTop = 5000;
        grid(sheet).dispatchEvent(new Event('scroll'));
        flushRenders();
        expect(sheet.querySelector('.zest-hint-attention')).toBeNull();
    });

    it('updates row and header labels, and uses the translated lock message for the event and live region', () => {
        const sheet = entrySheet([]);
        const corner = sheet.querySelector('.zest-corner');
        expect(corner.textContent).toBe('Rows and columns');
        sheet.labels = {
            corner: 'Lignes et colonnes', rowStates: {empty: 'Nouvelle ligne'},
            lockedNotice: (address, count) => `${address} verrouillée (${count})`,
        };
        flushRenders();
        expect(corner.textContent).toBe('Lignes et colonnes');
        expect(sheet.querySelector('.zest-row-head').title).toBe('Nouvelle ligne');
        sheet.onLocked = vi.fn();
        sheet.selection = 'D1';
        key(sheet, {key: 'F2'});
        expect(sheet.onLocked.mock.calls[0][0].message).toBe('D1 verrouillée (1)');
        expect(sheet.querySelector('.zest-live').textContent).toBe('D1 verrouillée (1)');
    });

    it('uses the column alignment for option labels unless the cell has its own alignment', () => {
        const sheet = make();
        const options = [{value: 3, label: '3 – Possible'}];
        sheet.setColumns([{options}, {validate: v.oneOf(options), align: 'center'}, {type: 'number'}]);
        sheet.setCells([0, 1, 2].map(col => ({row: 0, col, input: '3'})));
        flushRenders();
        expect(cellElement(sheet, 'A1').textContent).toBe('3 – Possible');
        expect(cellElement(sheet, 'A1').classList.contains('zest-align-start')).toBe(true);
        expect(cellElement(sheet, 'B1').classList.contains('zest-align-center')).toBe(true);
        expect(cellElement(sheet, 'C1').classList.contains('zest-align-start')).toBe(false);
        sheet.model.setStyle('A1', {align: 'end'});
        flushRenders();
        expect(cellElement(sheet, 'A1').classList.contains('zest-align-end')).toBe(true);
        expect(sheet.getValue('A1')).toBe(3);
    });

    it('announces the result when Tab skips a locked column and submits the row', async () => {
        const sheet = entrySheet([{id: 1, item: 'Pens', quantity: 2}], {'skip-locked': ''});
        sheet.labels = {rowSending: row => `Sending ${row}`, rowSent: row => `Saved ${row}`};
        const response = Promise.withResolvers();
        sheet.onSubmitRow = vi.fn(() => response.promise);
        const state = vi.fn();
        sheet.addEventListener('spreadsheet-row-state', state);
        sheet.selection = 'C1';
        type(sheet, '5');
        key(sheet, {key: 'Tab'});
        expect(sheet.activeAddress).toBe('A2');
        expect(sheet.onSubmitRow).toHaveBeenCalledTimes(1);
        expect(sheet.querySelector('.zest-live').textContent).toBe('Sending 1');
        response.resolve();
        await flush();
        expect(sheet.querySelector('.zest-live').textContent).toBe('Saved 1');
        expect(state.mock.calls[0][0].detail).toMatchObject({row: 0, state: 'sent'});
    });
});

describe('register validation and row options', () => {
    it('keeps the selected option with its record if the row moves before the second Enter', () => {
        const sheet = entrySheet([], {'submit-on': 'change'});
        sheet.setColumns([{key: 'action', options: ['Review', 'Approve']}]);
        const first = {id: 1, action: 'Review'};
        const second = {id: 2, action: 'Review'};
        sheet.records = [first, second];
        sheet.onSubmitRow = vi.fn();
        sheet.selection = 'A2';
        type(sheet, 'app');
        key(sheet, {key: 'Enter'});
        sheet.records = [second, first];
        flushRenders();
        expect(sheet.activeAddress).toBe('A1');
        expect(editor(sheet).value).toBe('Approve');
        expect(sheet.getValue('A1')).toBe('Review');
        expect(sheet.onSubmitRow).not.toHaveBeenCalled();
        key(sheet, {key: 'Enter'});
        expect(sheet.onSubmitRow).toHaveBeenCalledTimes(1);
        expect(sheet.onSubmitRow).toHaveBeenCalledWith({action: 'Approve'}, expect.objectContaining({id: 2, row: 0}));
        expect(sheet.getValue('A2')).toBe('Review');
    });

    it.each(['check', 'manual', 'change', 'enter', 'leave'])('passes %s to the row validator once', reason => {
        const sheet = entrySheet([{id: 1, item: 'Pens', quantity: 1}], {
            'submit-on': ['check', 'manual'].includes(reason) ? 'manual' : reason === 'leave' ? 'leave-row' : reason,
        });
        sheet.selection = 'B1';
        sheet.validateRow = vi.fn(() => ({quantity: 'Review quantity'}));
        sheet.onSubmitRow = vi.fn();
        if (reason === 'check') {
            expect(sheet.rowRecord(0).valid).toBe(false);
        } else {
            sheet.writeByUser('B1', '2');
            if (reason === 'manual') { expect(sheet.submitRow(0)).toBe(false); }
            if (reason === 'enter') { key(sheet, {key: 'Enter'}); }
            if (reason === 'leave') { key(sheet, {key: 'ArrowDown'}); }
            expect(sheet.getCell('B1').mark?.message).toBe('Review quantity');
        }
        expect(sheet.validateRow.mock.calls.map(([, context]) => context.reason)).toEqual([reason]);
        expect(sheet.onSubmitRow).not.toHaveBeenCalled();
    });

    it('uses each destination row for a paste and reports its validation reason once', () => {
        const sheet = entrySheet([], {'paste-submits': '', 'submit-on': 'manual'});
        sheet.setColumns([{key: 'action', options: [{value: 9, label: 'Choose'}]}]);
        sheet.optionsRule = ({row}) => row < 2 ? [{value: row, label: 'Choose'}] : null;
        sheet.validateRow = vi.fn(() => ({action: 'Confirm'}));
        sheet.selection = 'A1';
        grid(sheet).focus();
        const paste = new Event('paste', {bubbles: true, cancelable: true});
        paste.clipboardData = {getData: type => type === 'text/plain' ? 'Choose\nChoose\nChoose' : ''};
        document.dispatchEvent(paste);
        flushRenders();
        expect([0, 1, 2].map(row => sheet.getValue(row, 0))).toEqual([0, 1, 9]);
        expect(sheet.validateRow.mock.calls.map(([, context]) => [context.row, context.reason])).toEqual([[0, 'paste'], [1, 'paste'], [2, 'paste']]);
    });

    it('uses the record options for display, editing and lookup after the records move', () => {
        const sheet = entrySheet([], {'submit-on': 'manual'});
        sheet.setColumns([{key: 'action', options: [{value: 1, label: 'Default'}]}]);
        const a = {id: 'a', action: 1};
        const b = {id: 'b', action: 1};
        sheet.records = [a, b];
        let choices = [{value: 1, label: 'Review'}, {value: 2, label: 'Approve'}];
        sheet.optionsRule = ({row, col, address, sheet}) => {
            expect(sheet.getCell(address).col).toBe(col);
            return sheet.rowKey(row) === 'a' ? choices : null;
        };
        sheet.records = [b, a];
        flushRenders();
        expect(sheet.optionsOf(0)).toEqual([{value: 1, label: 'Default'}]);
        expect(sheet.optionsOf(0, 1)).toEqual(choices);
        expect(cellElement(sheet, 'A1').textContent).toBe('Default');
        expect(cellElement(sheet, 'A2').textContent).toBe('Review');
        sheet.selection = 'A2';
        key(sheet, {key: 'F2'});
        expect(editor(sheet).value).toBe('Review');
        key(sheet, {key: 'Escape'});
        type(sheet, 'app');
        expect(document.querySelector('type-ahead-list [role="option"]').textContent).toBe('Approve');
        key(sheet, {key: 'Enter'});
        key(sheet, {key: 'Enter'});
        expect(sheet.getValue('A2')).toBe(2);
        expect(sheet.getCell('A2').display).toBe('Approve');
        choices[1].label = 'Approved';
        sheet.refresh();
        flushRenders();
        expect(cellElement(sheet, 'A2').textContent).toBe('Approved');
        choices = [];
        sheet.refresh();
        flushRenders();
        expect(sheet.optionsOf(0, 1)).toEqual([]);
        expect(cellElement(sheet, 'A2').textContent).toBe('2');
    });
});
