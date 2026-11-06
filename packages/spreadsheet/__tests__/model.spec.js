import { describe, it, expect, vi } from 'vitest';
import {
    SheetModel, readInput, parseDelimited, toDelimited,
} from '../src/model.js';
import {
    SheetDate, SheetError, adjustForInsertDelete, columnIndex, columnName, evaluate, formatAddress, parseAddress,
    parseFormula, parseRange, shiftFormula, tokenize,
} from '../src/formula.js';

const sheet = (cells, options = {}) => {
    const model = new SheetModel({rows: 100, columns: 26, locale: 'en-US', ...options});
    model.load({cells});
    return model;
};
const value = (model, address) => {
    const result = model.getValue(address);
    return result instanceof SheetError ? result.code : result instanceof SheetDate ? `date:${result.days}` : result;
};

describe('addresses', () => {
    it('names columns as other spreadsheets do', () => {
        expect([0, 25, 26, 51, 701, 702, 16383].map(columnName)).toEqual(['A', 'Z', 'AA', 'AZ', 'ZZ', 'AAA', 'XFD']);
        expect(['A', 'Z', 'AA', 'XFD'].map(columnIndex)).toEqual([0, 25, 26, 16383]);
    });

    it('reads absolute parts and refuses addresses outside the sheet', () => {
        expect(parseAddress('$B$3')).toEqual({row: 2, col: 1, rowAbs: true, colAbs: true});
        expect(parseAddress('b3')).toEqual({row: 2, col: 1, rowAbs: false, colAbs: false});
        expect(parseAddress('A0')).toBeNull();
        expect(parseAddress('XFE1')).toBeNull();
        expect(parseAddress('hello')).toBeNull();
        expect(formatAddress(2, 1, {colAbs: true})).toBe('$B3');
        expect(parseRange('C4:A1')).toEqual({top: 0, left: 0, bottom: 3, right: 2});
    });
});

describe('the formula parser', () => {
    it('tells references from function names', () => {
        expect(tokenize('SUM(A1:B2)+LOG10(1)+LOG10').map(token => token.type))
            .toEqual(['name', 'op', 'ref', 'op', 'ref', 'op', 'op', 'name', 'op', 'number', 'op', 'op', 'ref']);
    });

    it('uses the order of operations of other spreadsheets', () => {
        const calc = (text) => evaluate(parseFormula(text), {value: () => null, values: () => []});
        expect(calc('1+2*3')).toBe(7);
        expect(calc('(1+2)*3')).toBe(9);
        expect(calc('-2^2')).toBe(4);
        expect(calc('2^3^2')).toBe(64);
        expect(calc('50%*10')).toBe(5);
        expect(calc('1+1=2')).toBe(true);
        expect(calc('"a"&1+1')).toBe('a2');
        expect(calc('"say ""hi"""')).toBe('say "hi"');
        expect(calc('"B"<"a"')).toBe(false);
        expect(calc('1<"a"')).toBe(true);
    });

    it('gives #ERROR! for a formula that does not parse, and #NAME? for an unknown name', () => {
        const calc = (text) => evaluate(parseFormula(text), {value: () => null, values: () => []}).code;
        expect(calc('1+')).toBe('#ERROR!');
        expect(calc('(1')).toBe('#ERROR!');
        expect(calc('"open')).toBe('#ERROR!');
        expect(calc('NOPE(1)')).toBe('#NAME?');
        expect(calc('profit')).toBe('#NAME?');
        expect(calc('1/0')).toBe('#DIV/0!');
        expect(calc('"a"*2')).toBe('#VALUE!');
    });
});

describe('typed input', () => {
    it('reads numbers, money, percentages, dates, and booleans', () => {
        expect(readInput('1,234.5')).toEqual({value: 1234.5, type: 'number'});
        expect(readInput('-$12.50')).toMatchObject({value: -12.5, type: 'currency'});
        expect(readInput('12%')).toEqual({value: 0.12, type: 'percent'});
        expect(readInput('2026-03-13').value).toBeInstanceOf(SheetDate);
        expect(readInput('3/13/2026').value.days).toBe(readInput('2026-03-13').value.days);
        expect(readInput('2026-02-30')).toEqual({value: '2026-02-30', type: 'text'});
        expect(readInput('true')).toEqual({value: true, type: 'boolean'});
        expect(readInput('12,34')).toEqual({value: '12,34', type: 'text'});
    });

    it('keeps text after an apostrophe, and in a text cell', () => {
        expect(readInput("'0042")).toEqual({value: '0042', type: 'text'});
        expect(readInput('=1+1', 'text')).toEqual({value: '=1+1', type: 'text'});
        expect(readInput('0042', 'text')).toEqual({value: '0042', type: 'text'});
    });

    it('reads 12 as 12% in a percent cell, and yes as TRUE in a boolean cell', () => {
        expect(readInput('12', 'percent').value).toBe(0.12);
        expect(readInput('yes', 'boolean').value).toBe(true);
        expect(readInput('yes').value).toBe('yes');
    });

    it('shows each type with the column format', () => {
        const model = new SheetModel({locale: 'en-US', columns: [{type: 'currency', currency: 'EUR'}, {type: 'percent', decimals: 1}, {type: 'date'}, {type: 'number', decimals: 2}]});
        model.setCells([
            {address: 'A1', input: '1234.5'}, {address: 'B1', input: '12.345'}, {address: 'C1', input: '2026-03-13'},
            {address: 'D1', input: '1234.5'}, {address: 'E1', input: '$3'}, {address: 'F1', input: '0.1+0.2'}, {address: 'G1', input: '=0.1+0.2'},
        ]);
        expect(model.getCell('A1').display).toBe('€1,234.50');
        expect(model.getCell('B1').display).toBe('12.3%');
        expect(model.getCell('C1').display).toBe('Mar 13, 2026');
        expect(model.getCell('D1').display).toBe('1,234.50');
        expect(model.getCell('E1')).toMatchObject({display: '$3.00', type: 'currency'});
        expect(model.getCell('F1')).toMatchObject({display: '0.1+0.2', type: 'text'});
        expect(model.getCell('G1').display).toBe('0.3');
    });

    it('reads the cells of a column again when its type changes', () => {
        const model = sheet({A1: '0042'});
        expect(model.getValue('A1')).toBe(42);
        model.setColumn(0, {type: 'text'});
        expect(model.getValue('A1')).toBe('0042');
    });
});

describe('functions', () => {
    const model = sheet({
        A1: '10', A2: '20', A3: 'text', A4: '', A5: 'TRUE', B1: '=SUM(A1:A5)', B2: '=AVERAGE(A1:A3)', B3: '=COUNT(A1:A5)',
        B4: '=COUNTA(A1:A5)', B5: '=MIN(A1:A2)', B6: '=MAX(A1:A2, 99)', B7: '=IF(A1>5, "big", "small")', B8: '=AND(A1>5, A2<5)',
        B9: '=OR(A1>5, A2<5)', B10: '=NOT(A5)', B11: '=ROUND(2.345, 2)', B12: '=ABS(-3)', B13: '=CONCAT(A1, "-", A3)',
        B14: '=LEN(A3)', B15: '=UPPER(A3)', B16: '=LOWER("ABC")', B17: '=TODAY()', B18: '=IFERROR(1/0, "none")', B19: '=SUM("3", 4)',
        B20: '=ROUND(-2.5)', B21: '=SUM(A3)', B22: '=MOD(-7, 3)', B23: '=IF(A1/0, 1, 2)', B24: '=TODAY()+1-TODAY()',
    });

    it('calculates each function', () => {
        const results = Object.fromEntries(Array.from({length: 24}, (_, i) => [`B${i + 1}`, value(model, `B${i + 1}`)]));
        expect(results).toMatchObject({
            B1: 30, B2: 15, B3: 2, B4: 4, B5: 10, B6: 99, B7: 'big', B8: false, B9: true, B10: false, B11: 2.35, B12: 3,
            B13: '10-text', B14: 4, B15: 'TEXT', B16: 'abc', B18: 'none', B19: 7, B20: -3, B21: 0, B22: 2, B23: '#DIV/0!', B24: 1,
        });
        expect(model.getValue('B17')).toBeInstanceOf(SheetDate);
        expect(model.getCell('B17').type).toBe('date');
    });
});

describe('recalculation', () => {
    it('recalculates only the cells that depend on a change', () => {
        const model = sheet({A1: '1', B1: '=A1*2', C1: '=B1+1', D1: '=5', E1: '=SUM(A1:A3)'});
        model.setCell('A1', '10');
        expect([value(model, 'B1'), value(model, 'C1'), value(model, 'E1')]).toEqual([20, 21, 10]);
        // A1, B1, C1, and E1. D1 does not depend on A1.
        expect(model.lastRecalculated).toBe(4);
    });

    it('calculates each cell after the cells that it reads, also when it reads one by two paths', () => {
        const model = sheet({A1: '1', B1: '=A1+1', C1: '=A1+B1', D1: '=C1+B1'});
        model.setCell('A1', '2');
        expect([value(model, 'B1'), value(model, 'C1'), value(model, 'D1')]).toEqual([3, 5, 8]);
    });

    it('marks a cycle and each cell that reads it, and recovers when the cycle breaks', () => {
        const model = sheet({A1: '=B1', B1: '=A1+1', C1: '=B1*2', D1: '=D1'});
        expect([value(model, 'A1'), value(model, 'B1'), value(model, 'C1'), value(model, 'D1')]).toEqual(['#CYCLE!', '#CYCLE!', '#CYCLE!', '#CYCLE!']);
        model.setCell('A1', '5');
        expect([value(model, 'B1'), value(model, 'C1')]).toEqual([6, 12]);
    });

    it('sees a cell that a range covers when the cell gets a value later, also for a large range', () => {
        const model = sheet({A1: '=SUM(B1:B5)', C1: '=SUM(D1:D5000)'}, {rows: 6000});
        model.setCells([{address: 'B3', input: '7'}, {address: 'D4000', input: '9'}]);
        expect([value(model, 'A1'), value(model, 'C1')]).toEqual([7, 9]);
        model.setCell('D4000', '');
        expect(value(model, 'C1')).toBe(0);
    });

    it('updates a chain of 10,000 formulas with no stack error, and quickly', () => {
        const cells = {A1: '1'};
        for (let row = 2; row <= 10000; row++) { cells[`A${row}`] = `=A${row - 1}+1`; }
        const model = sheet(cells, {rows: 10000});
        expect(value(model, 'A10000')).toBe(10000);
        const start = performance.now();
        model.setCell('A1', '5');
        const time = performance.now() - start;
        expect(value(model, 'A10000')).toBe(10004);
        expect(model.lastRecalculated).toBe(10000);
        expect(time).toBeLessThan(500);
    });

    it('sends one change event for a batch, with each input change', () => {
        const model = sheet({});
        const heard = vi.fn();
        model.addEventListener('change', heard);
        model.batch(() => {
            model.setCell('A1', '1');
            model.setCell('A2', '=A1');
            model.setCell('A1', '2');
        });
        expect(heard).toHaveBeenCalledTimes(1);
        const detail = heard.mock.calls[0][0].detail;
        expect(detail.changes).toEqual([
            {address: 'A1', row: 0, col: 0, oldInput: '', newInput: '2'},
            {address: 'A2', row: 1, col: 0, oldInput: '', newInput: '=A1'},
        ]);
        expect(value(model, 'A2')).toBe(2);
    });
});

describe('undo', () => {
    it('undoes and redoes a batch as one step', () => {
        const model = sheet({A1: '1', B1: '=A1*2'});
        model.setCells([{address: 'A1', input: '5'}, {address: 'A2', input: 'x'}]);
        expect(value(model, 'B1')).toBe(10);
        expect(model.undo()).toBe(true);
        expect([value(model, 'A1'), value(model, 'A2'), value(model, 'B1')]).toEqual([1, null, 2]);
        expect(model.canRedo).toBe(true);
        model.redo();
        expect([value(model, 'A1'), value(model, 'B1')]).toEqual([5, 10]);
        expect(model.undo()).toBe(true);
        expect(model.undo()).toBe(false);
    });

    it('undoes a style, and a new change clears the redo steps', () => {
        const model = sheet({A1: 'x'});
        model.setStyle('A1:B1', {bold: true});
        expect(model.getCell('B1').style).toEqual({bold: true});
        model.undo();
        expect(model.getCell('A1').style).toBeNull();
        model.setCell('A1', 'y');
        expect(model.canRedo).toBe(false);
    });

    it('undoes a deleted row, with the formulas that pointed at it', () => {
        const model = sheet({A1: '1', A2: '2', A3: '3', B1: '=A2*10', B2: '=SUM(A1:A3)', C3: 'kept'});
        model.deleteRows(1);
        expect(model.getInput('B1')).toBe('=#REF!*10');
        expect(model.getInput('B1') && value(model, 'B1')).toBe('#REF!');
        expect(model.getInput('C2')).toBe('kept');
        model.undo();
        expect([model.getInput('A2'), model.getInput('B1'), model.getInput('B2'), model.getInput('C3')]).toEqual(['2', '=A2*10', '=SUM(A1:A3)', 'kept']);
        expect(value(model, 'B2')).toBe(6);
        model.redo();
        expect(model.getInput('C2')).toBe('kept');
    });
});

describe('rows and columns', () => {
    it('moves the references when rows are added, also absolute ones', () => {
        const model = sheet({A1: '1', A5: '5', B1: '=A5+$A$5', B2: '=SUM(A1:A5)'});
        model.insertRows(2, 2);
        expect(model.getInput('B1')).toBe('=A7+$A$7');
        expect(model.getInput('B2')).toBe('=SUM(A1:A7)');
        expect(value(model, 'B2')).toBe(6);
        expect(model.rowCount).toBe(102);
    });

    it('makes a range smaller when part of it is deleted, and #REF! when all of it is', () => {
        expect(adjustForInsertDelete('SUM(A1:A10)', 'row', 4, -2)).toBe('SUM(A1:A8)');
        expect(adjustForInsertDelete('SUM(A5:A6)', 'row', 4, -2)).toBe('SUM(#REF!)');
        expect(adjustForInsertDelete('SUM(A5:A10)', 'row', 4, -2)).toBe('SUM(A5:A8)');
        expect(adjustForInsertDelete('SUM(A1:A5)', 'row', 4, -2)).toBe('SUM(A1:A4)');
        expect(adjustForInsertDelete('B1+C1', 'col', 1, -1)).toBe('#REF!+B1');
    });

    it('moves the cells and the column formats when a column is deleted', () => {
        const model = new SheetModel({locale: 'en-US', columns: [{}, {type: 'currency'}, {type: 'percent'}]});
        model.setCells([{address: 'C1', input: '50'}, {address: 'D1', input: '=C1*2'}]);
        model.deleteColumns(1);
        expect(model.getInput('B1')).toBe('50');
        expect(model.getCell('B1').display).toBe('50%');
        expect(model.getInput('C1')).toBe('=B1*2');
        model.undo();
        expect(model.column(1).type).toBe('currency');
        expect(model.getInput('D1')).toBe('=C1*2');
    });
});

describe('the clipboard', () => {
    it('moves relative references and keeps absolute ones when it pastes', () => {
        expect(shiftFormula('A1+$A$1+$A1+A$1', 2, 1)).toBe('B3+$A$1+$A3+B$1');
        expect(shiftFormula('A1', -1, 0)).toBe('#REF!');
        const model = sheet({A1: '1', A2: '2', B1: '=A1*10'});
        const clip = model.copy('B1');
        model.paste('B2', clip);
        expect(model.getInput('B2')).toBe('=A2*10');
        expect(value(model, 'B2')).toBe(20);
    });

    it('fills a target range with a copy of one cell', () => {
        const model = sheet({A1: '1', A2: '2', A3: '3', B1: '=A1+1'});
        model.paste('B1:B3', model.copy('B1'));
        expect([value(model, 'B2'), value(model, 'B3')]).toEqual([3, 4]);
    });

    it('copies the shown text with tabs, and pastes text from another program', () => {
        const model = sheet({A1: '1.5', B1: 'a\tb', A2: '=A1*2'});
        expect(model.copy('A1:B2').text).toBe('1.5\t"a\tb"\n3\t');
        model.pasteText('D1', 'x\t2\n"multi\nline"\t=E1*2\n');
        expect([model.getInput('D1'), model.getInput('E1'), model.getInput('D2'), value(model, 'E2')]).toEqual(['x', '2', 'multi\nline', 4]);
    });

    it('fills down and right as one undo step', () => {
        const model = sheet({A1: '1', A2: '2', A3: '3', B1: '=A1*2', C1: 'x'});
        model.fill({top: 0, left: 1, bottom: 2, right: 2}, 'down');
        expect([value(model, 'B3'), model.getInput('C3')]).toEqual([6, 'x']);
        model.undo();
        expect(model.getInput('B3')).toBe('');
        model.fill({top: 0, left: 0, bottom: 0, right: 3}, 'right');
        expect(model.getInput('D1')).toBe('1');
    });
});

describe('import, export, and search', () => {
    it('writes and reads CSV, with quotes', () => {
        const model = sheet({A1: 'name', B1: 'note', A2: 'a,b', B2: 'say "x"', C2: '=1+1', A3: '2026-03-13'});
        const csv = model.toCSV();
        expect(csv).toBe('name,note,\n"a,b","say ""x""",2\n2026-03-13,,\n');
        expect(model.toCSV({values: false}).split('\n')[1]).toBe('"a,b","say ""x""",=1+1');
        const copy = sheet({});
        copy.fromCSV(csv);
        expect(copy.getInput('B2')).toBe('say "x"');
        expect(parseDelimited('a,"b\r\nc"\r\nd', ',')).toEqual([['a', 'b\r\nc'], ['d']]);
        expect(toDelimited([['a', 'b,c']], ',')).toBe('a,"b,c"');
    });

    it('saves and loads JSON with styles and types', () => {
        const model = sheet({A1: {input: '5', style: {bold: true}, type: 'text'}, B1: '=A1&"!"'});
        const copy = new SheetModel();
        copy.load(JSON.parse(JSON.stringify(model.toJSON())));
        expect(copy.getCell('A1')).toMatchObject({input: '5', value: '5', style: {bold: true}});
        expect(copy.getValue('B1')).toBe('5!');
        expect(copy.canUndo).toBe(false);
    });

    it('finds the edge of the data for Ctrl and an arrow key', () => {
        const model = sheet({A1: '1', A2: '2', A3: '3', A6: '6'});
        expect(model.dataEdge(0, 0, 1, 0)).toEqual({row: 2, col: 0});
        expect(model.dataEdge(2, 0, 1, 0)).toEqual({row: 5, col: 0});
        expect(model.dataEdge(5, 0, 1, 0)).toEqual({row: 99, col: 0});
        expect(model.dataEdge(0, 0, 0, 1)).toEqual({row: 0, col: 25});
        expect(model.dataEdge(0, 0, -1, 0)).toEqual({row: 0, col: 0});
    });

    it('sums, counts, and averages a range for a status bar', () => {
        const model = sheet({A1: '1', A2: '2', A3: 'x', A4: '=A1+A2'});
        expect(model.summary({top: 0, left: 0, bottom: 9, right: 0})).toEqual({count: 4, numbers: 3, sum: 6, average: 2});
    });
});
