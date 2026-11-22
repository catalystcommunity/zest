import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.js';

const open = async (page, testId) => {
    await page.goto('/gallery/spreadsheet');
    await expect(page.getByTestId('section-spreadsheet')).toBeVisible();
    const sheet = page.getByTestId(testId);
    await sheet.scrollIntoViewIfNeeded();
    return sheet;
};
const cell = (sheet, address) => {
    const col = address.charCodeAt(0) - 65;
    const row = Number(address.slice(1)) - 1;
    return sheet.locator(`[role="row"][aria-rowindex="${row + 2}"] [role="gridcell"][aria-colindex="${col + 2}"]`);
};
const active = (sheet) => sheet.evaluate(element => element.activeAddress);
const states = (sheet) => sheet.evaluate(element => Array.from({length: element.model.rowCount}, (_, row) => element.rowState(row)));

test.describe('spreadsheet keyboard of other spreadsheets', () => {
    test('Tab, Tab, Tab, Enter goes from B3 to B4, also with typing between', async ({page}) => {
        const sheet = await open(page, 'sheet-budget-element');
        await cell(sheet, 'B12').click();
        await page.keyboard.type('one');
        await page.keyboard.press('Tab');
        await page.keyboard.type('two');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        expect(await active(sheet)).toBe('E12');
        await page.keyboard.press('Enter');
        expect(await active(sheet)).toBe('B13');
    });

    test('the arrow keys and a click put references in a formula, and F4 makes them absolute', async ({page}) => {
        const sheet = await open(page, 'sheet-budget-element');
        await cell(sheet, 'C12').click();
        await page.keyboard.type('=');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('Shift+ArrowUp');
        const editor = sheet.locator('.zest-editor');
        await expect(editor).toHaveValue('=C9:C10');
        await expect(sheet.locator('.zest-ref-box:not([hidden])')).toHaveCount(1);
        await page.keyboard.type('+');
        await cell(sheet, 'D2').click();
        await expect(editor).toHaveValue('=C9:C10+D2');
        await page.keyboard.press('F4');
        await expect(editor).toHaveValue('=C9:C10+$D$2');
        await expect(sheet.locator('.zest-ref-box:not([hidden])')).toHaveCount(2);
        await page.keyboard.press('Enter');
        expect(await sheet.evaluate(element => element.model.getInput('C12'))).toBe('=C9:C10+$D$2');
    });

    test('the list of functions completes a name with Tab', async ({page}) => {
        const sheet = await open(page, 'sheet-budget-element');
        await cell(sheet, 'A12').click();
        await page.keyboard.type('=aver');
        const list = page.locator('type-ahead-list [role="listbox"]');
        await expect(list.getByRole('option', {name: /AVERAGE/})).toBeVisible();
        await page.keyboard.press('Tab');
        await expect(sheet.locator('.zest-editor')).toHaveValue('=AVERAGE(');
        await page.keyboard.type('D2:D5)');
        await page.keyboard.press('Enter');
        expect(await sheet.evaluate(element => element.getValue('A12'))).toBe(571.875);
    });
});

test.describe('spreadsheet data entry', () => {
    test('a new row goes to the server when the person leaves it, and becomes a record', async ({page}) => {
        const sheet = await open(page, 'sheet-entry-element');
        await cell(sheet, 'A4').click();
        await page.keyboard.type('Pens');
        await page.keyboard.press('Tab');
        await page.keyboard.type('ha');
        const option = page.locator('type-ahead-list [role="option"]', {hasText: 'Hardware'});
        await expect(option).toBeVisible();
        await page.keyboard.press('Tab');
        await page.keyboard.type('3');
        await page.keyboard.press('Tab');
        await page.keyboard.type('2.5');
        await page.keyboard.press('Enter');
        expect(await active(sheet)).toBe('A5');
        await expect(page.getByTestId('sheet-entry-log')).toContainText('send new {"item":"Pens","category":"hardware","quantity":3,"price":"2.50","paid":null,"due":null}');
        await expect.poll(() => states(sheet)).toEqual(['clean', 'clean', 'clean', 'clean', 'empty', 'empty']);
        await expect(cell(sheet, 'B4')).toHaveText('Hardware');
        await expect(cell(sheet, 'F4')).toHaveText('$7.50');
    });

    test('a row with a problem does not go, and the problem cells are marked', async ({page}) => {
        const sheet = await open(page, 'sheet-entry-element');
        await cell(sheet, 'A4').click();
        await page.keyboard.type('Glue');
        await page.keyboard.press('Enter');
        await expect(cell(sheet, 'B4')).toHaveAttribute('aria-invalid', 'true');
        await expect(cell(sheet, 'C4')).toHaveAttribute('title', 'Type a value.');
        await expect(page.getByTestId('sheet-entry-log')).not.toContainText('send new');
        // The mark is a red inner border, not color only: there is also a corner sign
        const shadow = await cell(sheet, 'B4').evaluate(element => getComputedStyle(element).boxShadow);
        expect(shadow).toContain('inset');
    });

    test('rows from another person go above the entry rows, and the open editor keeps its text', async ({page}) => {
        const sheet = await open(page, 'sheet-entry-element');
        await cell(sheet, 'A4').click();
        await page.keyboard.type('Half typed');
        await page.getByTestId('sheet-entry-remote').evaluate(button => button.click());
        await expect(sheet.locator('.zest-editor')).toHaveValue('Half typed');
        await expect(sheet.locator('.zest-editor')).toBeFocused();
        expect(await active(sheet)).toBe('A5');
        await expect(cell(sheet, 'A4')).toHaveText('Remote order 4');
        await page.keyboard.press('Tab');
        expect(await sheet.evaluate(element => element.getValue('A5'))).toBe('Half typed');
    });

    test('a paid row is locked: a key does not edit it, and a notice tells why', async ({page}) => {
        const sheet = await open(page, 'sheet-entry-element');
        await cell(sheet, 'C1').click();
        await expect(cell(sheet, 'C1')).toHaveAttribute('aria-readonly', 'true');
        await page.keyboard.type('9');
        await expect(sheet.locator('.zest-editor')).toHaveCount(0);
        await expect(page.locator('notice-area')).toContainText('Cell C1 is locked');
        await expect(page.getByTestId('sheet-entry-log')).toContainText('locked edit C1');
    });

    test('a failed send leaves the row with a message, and a new send works', async ({page}) => {
        const sheet = await open(page, 'sheet-entry-element');
        await page.getByTestId('sheet-entry-fail').click();
        await cell(sheet, 'C2').click();
        await page.keyboard.type('11');
        await page.keyboard.press('Enter');
        await expect.poll(() => sheet.evaluate(element => element.rowState(1))).toBe('error');
        await expect(sheet.locator('[role="row"][aria-rowindex="3"] [role="rowheader"]')).toContainText('not sent: The server did not accept the row');
        await cell(sheet, 'C2').click();
        await page.getByTestId('sheet-entry-send').click();
        await expect.poll(() => sheet.evaluate(element => element.rowState(1))).toBe('clean');
        await expect(cell(sheet, 'C2')).toHaveText('11');
    });

    test('a boolean column shows check boxes, which Space and a click change', async ({page}) => {
        const sheet = await open(page, 'sheet-entry-element');
        const box = cell(sheet, 'E2').getByRole('checkbox', {name: 'Paid'});
        await expect(box).toHaveAttribute('aria-checked', 'false');
        await cell(sheet, 'D3').click();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Space');
        await expect(cell(sheet, 'E3').getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
        await box.click();
        await expect(box).toHaveAttribute('aria-checked', 'true');
    });

    test('Alt+Arrow Down opens the calendar of a date cell, and a pick writes the cell', async ({page}) => {
        const sheet = await open(page, 'sheet-entry-element');
        await cell(sheet, 'G2').click();
        await page.keyboard.press('Alt+ArrowDown');
        const dialog = page.getByRole('dialog', {name: 'Calendar for G2'});
        await expect(dialog).toBeVisible();
        await dialog.locator('[role="gridcell"]', {hasText: /^15$/}).first().click();
        await expect(dialog).toBeHidden();
        expect(await sheet.evaluate(element => element.model.getInput('G2'))).toMatch(/^\d{4}-\d{2}-15$/);
        await expect(sheet.locator('[role="grid"]')).toBeFocused();
    });

    test('a changed row that also changed elsewhere waits for the person', async ({page}) => {
        const sheet = await open(page, 'sheet-entry-element');
        await cell(sheet, 'C2').click();
        await page.keyboard.type('11');
        await page.keyboard.press('Tab');
        await page.getByTestId('sheet-entry-elsewhere').evaluate(button => button.click());
        await expect(sheet.locator('[role="row"][aria-rowindex="3"] [role="rowheader"]')).toContainText('changed here and elsewhere');
        await expect(page.getByTestId('sheet-entry-log')).toContainText('row 2 changed elsewhere: price');
        await page.keyboard.press('ArrowDown');
        await expect(page.getByTestId('sheet-entry-log')).not.toContainText('send update');
        await cell(sheet, 'C2').click();
        await page.getByTestId('sheet-entry-keep').click();
        await page.getByTestId('sheet-entry-send').click();
        await expect(page.getByTestId('sheet-entry-log')).toContainText('"quantity":11,"price":"90.00"');
    });

    test('in German, the person types a decimal comma and the model keeps 1234.5', async ({page}) => {
        const sheet = await open(page, 'sheet-entry-element');
        await page.getByTestId('sheet-entry-locale').selectOption('de-DE');
        await cell(sheet, 'D3').click();
        await page.keyboard.type('1.234,5');
        await page.keyboard.press('Enter');
        expect(await sheet.evaluate(element => element.model.getInput('D3'))).toBe('1234.5');
        await expect(cell(sheet, 'D3')).toContainText('1.234,50');
        // The row goes to the server when the person leaves it, and is locked until the answer
        await expect.poll(() => sheet.evaluate(element => element.rowState(2))).toBe('clean');
        await cell(sheet, 'D3').dblclick();
        await expect(sheet.locator('.zest-editor')).toHaveValue('1234,50');
    });

    test('has no accessibility violations, also while the list of options is open', async ({page}) => {
        const sheet = await open(page, 'sheet-entry-element');
        await expect(sheet.locator('.zest-corner')).toHaveAccessibleName('Rows and columns');
        const headers = await new AxeBuilder({page}).withRules(['empty-table-header']).include('[data-testid="sheet-entry"]').analyze();
        expect(headers.violations).toEqual([]);
        await cell(sheet, 'B4').click();
        await page.keyboard.type('s');
        await expect(page.locator('type-ahead-list [role="option"]').first()).toBeVisible();
        const results = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .include('[data-testid="sheet-entry"]').include('type-ahead-list').analyze();
        expect(results.violations).toEqual([]);
    });
});

test.describe('the way out of the grid', () => {
    test('Tab wraps to the next row, and Escape then Tab leaves the grid', async ({page}) => {
        const sheet = await open(page, 'sheet-budget-element');
        await cell(sheet, 'B2').click();
        const columns = await sheet.evaluate(element => element.model.columnCount);
        for (let i = 1; i < columns; i++) { await page.keyboard.press('Tab'); }
        expect(await active(sheet)).toBe('B3');
        await page.keyboard.press('Escape');
        await page.keyboard.press('Tab');
        await expect(sheet.locator('[role="grid"]')).not.toBeFocused();
    });
});

test.describe('type-ahead and validators', () => {
    test('a text field lists suggestions, and Enter takes one', async ({page}) => {
        await page.goto('/gallery/controls');
        const field = page.getByTestId('text-suggest').getByRole('combobox');
        await field.click();
        await page.keyboard.type('bo');
        const list = page.locator('type-ahead-list [role="listbox"]');
        await expect(list.getByRole('option')).toHaveText(['Bogotá', 'Boston']);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await expect(field).toHaveAttribute('aria-activedescendant', /type-ahead/);
        await page.keyboard.press('Enter');
        await expect(field).toHaveValue('Boston');
        await expect(list).toBeHidden();
    });

    test('the validators gallery shows the typed value or the problem', async ({page}) => {
        await page.goto('/gallery/validators');
        await expect(page.getByTestId('validator-uint-output')).toHaveText('value 18446744073709551615n');
        // 2026 is not a leap year
        await expect(page.getByTestId('validator-date-output')).toHaveText('type: Type a date, for example 2026-03-13.');
        await page.getByTestId('validator-int-input').fill('121');
        await expect(page.getByTestId('validator-int-output')).toHaveText('max: Type a number that is 120 or less.');
    });
});
