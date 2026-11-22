import { describe, it, expect, afterEach } from 'vitest';
import { flushRenders } from '@catalystcommunity/base-components';
import { SpreadSheet, SheetCell, FormulaBar } from '../src';
import { toCanonicalInput, toLocalInput, sheetLocale, detectCsvFormat } from '../src/locale.js';
import { readClipboardTable } from '../src/clipboard.js';

if (!customElements.get('spread-sheet')) {
    customElements.define('spread-sheet', SpreadSheet);
    customElements.define('sheet-cell', SheetCell);
    customElements.define('formula-bar', FormulaBar);
}

afterEach(() => {
    document.body.replaceChildren();
    flushRenders();
});

describe('the edge between the locale and the model', () => {
    it('makes typed numbers, dates, and formulas canonical', () => {
        expect(sheetLocale('de-DE')).toMatchObject({decimal: ',', group: '.', argument: ';', order: ['day', 'month', 'year']});
        expect(toCanonicalInput('1.234,5', 'de-DE')).toBe('1234.5');
        expect(toCanonicalInput('-0,25', 'de-DE')).toBe('-0.25');
        expect(toCanonicalInput('12,5%', 'de-DE')).toBe('12.5%');
        expect(toCanonicalInput('5,50 €', 'de-DE')).toBe('€5.50');
        expect(toCanonicalInput('21.11.2026', 'de-DE')).toBe('2026-11-21');
        expect(toCanonicalInput('21/11/2026', 'en-GB')).toBe('2026-11-21');
        expect(toCanonicalInput('=SUM(A1;2,5;"a,b")', 'de-DE')).toBe('=SUM(A1,2.5,"a,b")');
        expect(toCanonicalInput('1.5', 'de-DE')).toBe('1.5');
        expect(toCanonicalInput('Hallo, Welt', 'de-DE')).toBe('Hallo, Welt');
        expect(toCanonicalInput("'1,5", 'de-DE')).toBe("'1,5");
        // A locale with canonical numbers changes nothing
        expect(toCanonicalInput('1,234.5', 'en-US')).toBe('1,234.5');
        expect(toCanonicalInput('=SUM(A1,2.5)', 'en-US')).toBe('=SUM(A1,2.5)');
    });

    it('shows canonical inputs in the form of the locale', () => {
        expect(toLocalInput('1234.5', 'de-DE', 'number')).toBe('1234,5');
        expect(toLocalInput('=SUM(A1,2.5,"a,b")', 'de-DE')).toBe('=SUM(A1;2,5;"a,b")');
        expect(toLocalInput('2026-11-21', 'de-DE', 'date')).toBe('21.11.2026');
        expect(toLocalInput('2026-11-21', 'en-US', 'date')).toBe('11/21/2026');
        expect(toLocalInput('Text 1.5', 'de-DE', 'text')).toBe('Text 1.5');
    });
});

describe('a sheet with a locale', () => {
    const make = (locale) => {
        const sheet = document.createElement('spread-sheet');
        sheet.setAttribute('locale', locale);
        document.body.append(sheet);
        flushRenders();
        return sheet;
    };
    const grid = (sheet) => sheet.querySelector('[role="grid"]');
    const key = (sheet, init) => {
        const target = sheet.editing ? sheet.querySelector('.zest-editor') : grid(sheet);
        target.dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, cancelable: true, composed: true, ...init}));
        flushRenders();
    };
    const type = (sheet, text) => {
        key(sheet, {key: text[0]});
        const editor = sheet.querySelector('.zest-editor');
        editor.value = text;
        editor.dispatchEvent(new Event('input', {bubbles: true}));
    };

    it('keeps canonical inputs, and the editor shows the form of the locale', () => {
        const sheet = make('de-DE');
        type(sheet, '1,5');
        key(sheet, {key: 'Enter'});
        expect(sheet.model.getInput('A1')).toBe('1.5');
        expect(sheet.getValue('A1')).toBe(1.5);
        sheet.selection = 'A2';
        type(sheet, '=SUMME(A1;2,5)'.replace('SUMME', 'SUM'));
        key(sheet, {key: 'Enter'});
        expect(sheet.model.getInput('A2')).toBe('=SUM(A1,2.5)');
        expect(sheet.getValue('A2')).toBe(4);
        sheet.selection = 'A1';
        key(sheet, {key: 'F2'});
        expect(sheet.querySelector('.zest-editor').value).toBe('1,5');
        key(sheet, {key: 'Escape'});
        expect(sheet.inputText('A2')).toBe('=SUM(A1;2,5)');
    });

    it('reads a pasted text in the form of the locale, and a copy in the page as it is', () => {
        const sheet = make('de-DE');
        const paste = (text) => {
            const event = new Event('paste', {bubbles: true, cancelable: true});
            event.clipboardData = {getData: (format) => (format === 'text/plain' ? text : '')};
            grid(sheet).focus();
            document.dispatchEvent(event);
            flushRenders();
        };
        paste('1.234,5\t21.11.2026');
        expect(sheet.model.getInput('A1')).toBe('1234.5');
        expect(sheet.model.getInput('B1')).toBe('2026-11-21');
    });

    it('takes the exact values of a table from Excel or Google Sheets', () => {
        const sheet = make('de-DE');
        const html = `<table><tr>
            <td x:num="1234.5">1.234,50 €</td>
            <td data-sheets-value='{"1":3,"3":0.125}'>12,5 %</td>
            <td data-sheets-value='{"1":2,"2":"0042"}'>0042</td>
            <td>2,5</td>
            <td colspan="2" x:bool="TRUE">WAHR</td><td>Ende</td></tr></table>`;
        const event = new Event('paste', {bubbles: true, cancelable: true});
        event.clipboardData = {getData: (format) => (format === 'text/html' ? html : '1.234,50 €\t12,5 %\t0042\t2,5\tWAHR\t\tEnde')};
        grid(sheet).focus();
        document.dispatchEvent(event);
        flushRenders();
        expect(['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1'].map(address => sheet.model.getInput(address))).toEqual(['1234.5', '0.125', "'0042", '2.5', 'TRUE', '', 'Ende']);
    });
});

describe('readClipboardTable', () => {
    it('gives null for HTML with no table, and keeps line breaks', () => {
        expect(readClipboardTable('<p>Hello</p>')).toBe(null);
        expect(readClipboardTable('<table><tr><td>a<br>b</td><td> x   y </td></tr><tr><td>c</td></tr></table>')).toEqual([
            [{input: 'a\nb', raw: false}, {input: 'x y', raw: false}],
            [{input: 'c', raw: false}, {input: '', raw: true}],
        ]);
    });
});

describe('CSV of other locales', () => {
    it('finds the signs of a file, and says when it cannot know', () => {
        expect(detectCsvFormat('Item;Price;Date\nPens;1.234,50;21.11.2026\nGlue;2,5;01.12.2026')).toMatchObject({delimiter: ';', decimal: ',', order: ['day', 'month', 'year'], confident: true});
        expect(detectCsvFormat('Item,Price\nPens,1.5\nGlue,"1,234.25"')).toMatchObject({delimiter: ',', decimal: '.', confident: true});
        const unclear = detectCsvFormat('a,b\n"1,234",03/04/2026');
        expect(unclear.decimal).toBe(null);
        expect(unclear.order).toBe(null);
        expect(unclear.confident).toBe(false);
        expect(unclear.ambiguous).toEqual(['1,234']);
    });

    it('fromCSV reads the signs of the file', () => {
        const sheet = document.createElement('spread-sheet');
        document.body.append(sheet);
        flushRenders();
        const text = 'Pens;1.234,50;21.11.2026\nGlue;2,5;01.12.2026';
        const format = detectCsvFormat(text);
        sheet.fromCSV(text, 'A1', format);
        expect(sheet.model.getInput('B1')).toBe('1234.50');
        expect(sheet.getValue('B2')).toBe(2.5);
        expect(sheet.model.getInput('C1')).toBe('2026-11-21');
        sheet.fromCSV('x;1,5', 'A5', {delimiter: ';', locale: 'de-DE'});
        expect(sheet.getValue('B5')).toBe(1.5);
    });
});
