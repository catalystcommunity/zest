import { describe, it, expect, vi, afterEach } from 'vitest';
import { flushRenders } from '@catalystcommunity/base-components';
import { SpreadSheet, ShadowSpreadSheet, SheetCell, FormulaBar, SheetModel } from '../src';

customElements.define('spread-sheet', SpreadSheet);
customElements.define('shadow-spread-sheet', ShadowSpreadSheet);
customElements.define('sheet-cell', SheetCell);
customElements.define('formula-bar', FormulaBar);

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
const key = (sheet, init) => {
    const target = sheet.editing ? sheet.querySelector('.zest-editor') : grid(sheet);
    const event = new KeyboardEvent('keydown', {bubbles: true, cancelable: true, ...init});
    target.dispatchEvent(event);
    flushRenders();
    return event;
};
const type = (sheet, text) => { for (const char of text) { key(sheet, {key: char}); if (sheet.editing) { const editor = sheet.querySelector('.zest-editor'); editor.value += ''; } } };
const typeInEditor = (sheet, text) => {
    const editor = sheet.querySelector('.zest-editor');
    editor.value += text;
    editor.dispatchEvent(new Event('input', {bubbles: true}));
};
const active = (sheet) => sheet.activeAddress;

describe('the grid', () => {
    it('makes cells only for the rows and columns that can show', () => {
        const sheet = make({rows: '10000', columns: '100'});
        const cells = sheet.querySelectorAll('[role="gridcell"]');
        expect(cells.length).toBeGreaterThan(50);
        expect(cells.length).toBeLessThan(600);
        expect(cells[0]).toBeInstanceOf(SheetCell);
        expect(grid(sheet).getAttribute('aria-rowcount')).toBe('10001');
        expect(grid(sheet).getAttribute('aria-colcount')).toBe('101');
    });

    it('shows typed values, styles, and errors in the cells', () => {
        const sheet = make({}, {A1: '1,234.5', B1: {input: 'x', style: {bold: true}}, C1: '=1/0', D1: '=A1*2'});
        const cell = (col) => sheet.querySelector(`[aria-rowindex="2"] [aria-colindex="${col}"]`);
        expect(cell(2).textContent).toBe('1234.5');
        expect(cell(2).classList.contains('zest-number')).toBe(true);
        expect(cell(3).classList.contains('zest-bold')).toBe(true);
        expect(cell(4)).toHaveProperty('textContent', '#DIV/0!');
        expect(cell(4).classList.contains('zest-error')).toBe(true);
        expect(cell(5).textContent).toBe('2469');
    });

    it('points aria-activedescendant at the active cell, and marks the selected cells', () => {
        const sheet = make();
        sheet.selection = 'B2:C3';
        flushRenders();
        const activeId = grid(sheet).getAttribute('aria-activedescendant');
        const activeCell = document.getElementById(activeId);
        expect([activeCell.row, activeCell.col]).toEqual([1, 1]);
        expect(sheet.querySelectorAll('[aria-selected="true"]').length).toBe(4);
    });

    it('repaints only what changed, and a recalculated cell too', () => {
        const sheet = make({}, {A1: '1', B1: '=A1+1'});
        const b1 = sheet.querySelector('[aria-rowindex="2"] [aria-colindex="3"]');
        const show = vi.spyOn(SheetCell.prototype, 'show');
        sheet.setCell('A1', '5');
        flushRenders();
        expect(b1.textContent).toBe('6');
        expect(show).toHaveBeenCalledTimes(2);
        show.mockRestore();
    });

    it('works in a shadow root, and two sheets can show one model', () => {
        const model = new SheetModel({rows: 20, columns: 5});
        const first = document.body.appendChild(document.createElement('shadow-spread-sheet'));
        const second = document.body.appendChild(document.createElement('spread-sheet'));
        first.model = model;
        second.model = model;
        model.setCell('A1', 'shared');
        flushRenders();
        expect(first.shadowRoot.querySelector('[aria-rowindex="2"] [aria-colindex="2"]').textContent).toBe('shared');
        expect(second.querySelector('[aria-rowindex="2"] [aria-colindex="2"]').textContent).toBe('shared');
    });
});

describe('the keyboard', () => {
    it('moves with the arrows, Tab, Enter, Home, and Ctrl+Home', () => {
        const sheet = make();
        key(sheet, {key: 'ArrowRight'});
        key(sheet, {key: 'ArrowDown'});
        expect(active(sheet)).toBe('B2');
        key(sheet, {key: 'Tab'});
        expect(active(sheet)).toBe('C2');
        key(sheet, {key: 'Tab', shiftKey: true});
        key(sheet, {key: 'Enter'});
        expect(active(sheet)).toBe('B3');
        key(sheet, {key: 'Home'});
        expect(active(sheet)).toBe('A3');
        key(sheet, {key: 'ArrowUp'});
        key(sheet, {key: 'ArrowUp'});
        key(sheet, {key: 'ArrowUp'});
        expect(active(sheet)).toBe('A1');
        key(sheet, {key: 'PageDown'});
        expect(sheet.selection.top).toBeGreaterThan(5);
        key(sheet, {key: 'Home', ctrlKey: true});
        expect(active(sheet)).toBe('A1');
    });

    it('extends the selection with Shift, and jumps to the edge of the data with Ctrl', () => {
        const sheet = make({}, {A1: '1', A2: '2', A3: '3', C1: 'x'});
        key(sheet, {key: 'ArrowDown', ctrlKey: true});
        expect(active(sheet)).toBe('A3');
        key(sheet, {key: 'ArrowUp', ctrlKey: true, shiftKey: true});
        expect(sheet.selection).toEqual({top: 0, left: 0, bottom: 2, right: 0});
        key(sheet, {key: 'ArrowRight', shiftKey: true});
        expect(sheet.selection).toEqual({top: 0, left: 0, bottom: 2, right: 1});
        expect(active(sheet)).toBe('A3');
        key(sheet, {key: 'End', ctrlKey: true});
        expect(active(sheet)).toBe('C3');
        key(sheet, {key: ' ', shiftKey: true});
        expect(sheet.selection).toEqual({top: 2, left: 0, bottom: 2, right: 25});
        key(sheet, {key: ' ', ctrlKey: true});
        // The row selection put the active cell at the start of the row
        expect(sheet.selection).toEqual({top: 0, left: 0, bottom: 99, right: 0});
        key(sheet, {key: 'a', ctrlKey: true});
        expect(sheet.selection).toEqual({top: 0, left: 0, bottom: 99, right: 25});
    });

    it('starts an edit with a character, and Enter saves it and goes down', () => {
        const sheet = make();
        const changes = vi.fn();
        sheet.addEventListener('spreadsheet-change', changes);
        key(sheet, {key: '4'});
        expect(sheet.editing).toBe(true);
        expect(sheet.querySelector('.zest-editor').value).toBe('4');
        typeInEditor(sheet, '2');
        key(sheet, {key: 'Enter'});
        expect(sheet.editing).toBe(false);
        expect(sheet.getValue('A1')).toBe(42);
        expect(active(sheet)).toBe('A2');
        expect(changes).toHaveBeenCalledTimes(1);
        expect(changes.mock.calls[0][0].detail.changes).toEqual([{address: 'A1', row: 0, col: 0, oldInput: '', newInput: '42'}]);
    });

    it('keeps the old input after Escape, and F2 edits with the old input', () => {
        const sheet = make({}, {A1: 'old'});
        key(sheet, {key: 'x'});
        key(sheet, {key: 'Escape'});
        expect(sheet.getValue('A1')).toBe('old');
        expect(document.activeElement).toBe(grid(sheet));
        key(sheet, {key: 'F2'});
        expect(sheet.querySelector('.zest-editor').value).toBe('old');
        typeInEditor(sheet, 'er');
        key(sheet, {key: 'Tab'});
        expect(sheet.getValue('A1')).toBe('older');
        expect(active(sheet)).toBe('B1');
    });

    it('ends an edit that typing started with an arrow key, but not an F2 edit', () => {
        const sheet = make();
        key(sheet, {key: '7'});
        key(sheet, {key: 'ArrowRight'});
        expect([sheet.getValue('A1'), active(sheet)]).toEqual([7, 'B1']);
        key(sheet, {key: 'F2'});
        const event = key(sheet, {key: 'ArrowLeft'});
        expect(event.defaultPrevented).toBe(false);
        expect(sheet.editing).toBe(true);
    });

    it('puts a line break in with Alt+Enter, and fills the selection with Ctrl+Enter', () => {
        const sheet = make({}, {A1: '1', A2: '2', A3: '3'});
        sheet.selection = 'B1:B3';
        key(sheet, {key: '='});
        typeInEditor(sheet, 'A1*10');
        key(sheet, {key: 'Enter', ctrlKey: true});
        expect([sheet.getValue('B1'), sheet.getValue('B2'), sheet.getValue('B3')]).toEqual([10, 20, 30]);
        sheet.selection = 'C1';
        key(sheet, {key: 'a'});
        key(sheet, {key: 'Enter', altKey: true});
        typeInEditor(sheet, 'b');
        key(sheet, {key: 'Enter'});
        expect(sheet.getValue('C1')).toBe('a\nb');
    });

    it('clears with Delete, undoes with Ctrl+Z, and redoes with Ctrl+Y and Ctrl+Shift+Z', () => {
        const sheet = make({}, {A1: '1', A2: '2'});
        sheet.selection = 'A1:A2';
        key(sheet, {key: 'Delete'});
        expect(sheet.getValue('A2')).toBeNull();
        expect(sheet.actions.undo.enabled).toBe(true);
        key(sheet, {key: 'z', ctrlKey: true});
        expect(sheet.getValue('A2')).toBe(2);
        expect(sheet.actions.redo.enabled).toBe(true);
        key(sheet, {key: 'y', ctrlKey: true});
        expect(sheet.getValue('A2')).toBeNull();
        key(sheet, {key: 'z', ctrlKey: true});
        key(sheet, {key: 'Z', ctrlKey: true, shiftKey: true});
        expect(sheet.getValue('A1')).toBeNull();
    });

    it('fills down and right, and makes bold and italic', () => {
        const sheet = make({}, {A1: '1', A2: '2', B1: '=A1*2'});
        sheet.selection = 'B1:B2';
        key(sheet, {key: 'd', ctrlKey: true});
        expect(sheet.getValue('B2')).toBe(4);
        key(sheet, {key: 'b', ctrlKey: true});
        expect(sheet.getCell('B2').style).toEqual({bold: true});
        expect(sheet.actions.bold.checked).toBe(true);
        key(sheet, {key: 'b', ctrlKey: true});
        expect(sheet.getCell('B1').style).toBeNull();
        expect(sheet.actions.bold.checked).toBe(false);
        sheet.selection = 'A1:C1';
        key(sheet, {key: 'r', ctrlKey: true});
        expect(sheet.getInput?.('C1') ?? sheet.model.getInput('C1')).toBe('1');
        key(sheet, {key: 'i', ctrlKey: true});
        expect(sheet.getCell('C1').style).toEqual({italic: true});
    });

    it('puts the date of today in with Ctrl+;', () => {
        const sheet = make();
        key(sheet, {key: ';', ctrlKey: true});
        expect(sheet.getCell('A1').type).toBe('date');
    });

    it('changes the width of a column with Alt+Shift and an arrow key', () => {
        const sheet = make();
        const before = sheet.widthOf(0);
        key(sheet, {key: 'ArrowRight', altKey: true, shiftKey: true});
        expect(sheet.widthOf(0)).toBe(before + 16);
        expect(sheet.model.column(0).width).toBe(before + 16);
    });

    it('lets Tab leave the grid at the last column', () => {
        const sheet = make({columns: '2'});
        key(sheet, {key: 'Tab'});
        expect(key(sheet, {key: 'Tab'}).defaultPrevented).toBe(false);
    });

    it('does not change a read-only sheet', () => {
        const sheet = make({readonly: ''}, {A1: 'x'});
        key(sheet, {key: 'q'});
        expect(sheet.editing).toBe(false);
        key(sheet, {key: 'Delete'});
        expect(sheet.getValue('A1')).toBe('x');
        expect(sheet.actions.clear.enabled).toBe(false);
        expect(grid(sheet).getAttribute('aria-readonly')).toBe('true');
    });

    it('tells the cell and its value in the live region', async () => {
        vi.useFakeTimers();
        const sheet = make({}, {B1: '=1+1'});
        key(sheet, {key: 'ArrowRight'});
        vi.advanceTimersByTime(200);
        expect(sheet.querySelector('.zest-live').textContent).toBe('B1 2, formula =1+1');
        key(sheet, {key: 'ArrowDown', shiftKey: true});
        vi.advanceTimersByTime(200);
        expect(sheet.querySelector('.zest-live').textContent).toBe('B1:B2 selected, 2 cells. B1 2');
        vi.useRealTimers();
    });
});

describe('the clipboard', () => {
    const clipboardEvent = (type, text = '') => {
        const data = new Map([['text/plain', text]]);
        const event = new Event(type, {bubbles: true, cancelable: true});
        event.clipboardData = {setData: (kind, value) => data.set(kind, value), getData: (kind) => data.get(kind) ?? ''};
        return {event, data};
    };

    it('copies the shown text, and a paste in the sheet keeps and moves the formulas', () => {
        const sheet = make({}, {A1: '1', A2: '2', B1: '=A1*3'});
        sheet.selection = 'B1';
        const copy = clipboardEvent('copy');
        grid(sheet).dispatchEvent(copy.event);
        expect(copy.event.defaultPrevented).toBe(true);
        expect(copy.data.get('text/plain')).toBe('3');
        sheet.selection = 'B2';
        grid(sheet).dispatchEvent(clipboardEvent('paste', '3').event);
        expect(sheet.model.getInput('B2')).toBe('=A2*3');
        expect(sheet.getValue('B2')).toBe(6);
    });

    it('pastes text from another program, and a cut and paste moves the cells', () => {
        const sheet = make({}, {A1: 'move me'});
        sheet.selection = 'C3';
        grid(sheet).dispatchEvent(clipboardEvent('paste', 'a\tb\n1\t2').event);
        expect([sheet.getValue('C3'), sheet.getValue('D4')]).toEqual(['a', 2]);
        expect(sheet.selection).toEqual({top: 2, left: 2, bottom: 3, right: 3});
        sheet.selection = 'A1';
        const cut = clipboardEvent('cut');
        grid(sheet).dispatchEvent(cut.event);
        sheet.selection = 'A5';
        grid(sheet).dispatchEvent(clipboardEvent('paste', cut.data.get('text/plain')).event);
        expect([sheet.getValue('A1'), sheet.getValue('A5')]).toEqual([null, 'move me']);
        sheet.undo();
        expect([sheet.getValue('A1'), sheet.getValue('A5')]).toEqual(['move me', null]);
    });
});

describe('the formula bar', () => {
    it('shows the active cell, and Enter in it writes the cell', () => {
        const sheet = make({'formula-bar': ''}, {A1: '=2+2'});
        const [name, formula] = sheet.querySelectorAll('.zest-formula-bar input');
        expect(name.value).toBe('A1');
        expect(formula.value).toBe('=2+2');
        formula.value = '=3+3';
        formula.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        expect(sheet.getValue('A1')).toBe(6);
        expect(document.activeElement).toBe(grid(sheet));
    });

    it('goes to an address that the user types, and shows the editor text while the user types', () => {
        const sheet = make({'formula-bar': ''});
        const [name, formula] = sheet.querySelectorAll('.zest-formula-bar input');
        name.value = 'C5';
        name.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        expect(sheet.activeAddress).toBe('C5');
        name.value = 'nowhere';
        name.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        expect(name.getAttribute('aria-invalid')).toBe('true');
        key(sheet, {key: '='});
        typeInEditor(sheet, 'SUM(');
        expect(formula.value).toBe('=SUM(');
    });

    it('stands next to a sheet with the for attribute', () => {
        const sheet = make({id: 'budget'}, {B2: 'hi'});
        const bar = document.createElement('formula-bar');
        bar.setAttribute('for', 'budget');
        document.body.append(bar);
        sheet.selection = 'B2';
        expect(bar.querySelector('.zest-formula').value).toBe('hi');
        bar.remove();
        sheet.selection = 'A1';
        expect(bar.querySelector('.zest-formula').value).toBe('hi');
    });
});

describe('a cell that stands alone', () => {
    it('shows its typed input, and an editable cell edits with Enter', () => {
        const cell = document.createElement('sheet-cell');
        cell.setAttribute('input', '25');
        cell.setAttribute('type', 'percent');
        cell.setAttribute('editable', '');
        document.body.append(cell);
        expect(cell.textContent).toBe('25%');
        const changed = vi.fn();
        cell.addEventListener('change', changed);
        cell.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
        cell.querySelector('textarea').value = '50';
        cell.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
        expect(cell.input).toBe('50');
        expect(changed).toHaveBeenCalledWith(expect.objectContaining({detail: {input: '50'}}));
        flushRenders();
        return Promise.resolve().then(() => expect(cell.textContent).toBe('50%'));
    });
});
