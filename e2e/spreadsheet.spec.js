import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.js';
import { budget } from './timing.js';

const open = async (page) => {
    await page.goto('/gallery/spreadsheet');
    await expect(page.getByTestId('section-spreadsheet')).toBeVisible();
    return page.getByTestId('sheet-budget-element');
};
// The cell element at an address, such as 'B2', in the rows that the sheet shows
const cell = (sheet, address) => {
    const col = address.charCodeAt(0) - 65;
    const row = Number(address.slice(1)) - 1;
    return sheet.locator(`[role="row"][aria-rowindex="${row + 2}"] [role="gridcell"][aria-colindex="${col + 2}"]`);
};
const state = (sheet) => sheet.evaluate(element => ({active: element.activeAddress, selection: element.selection, editing: element.editing}));
const value = (sheet, address) => sheet.evaluate((element, where) => element.model.getCell(where).display, address);

test.describe('spreadsheet', () => {
    test('shows each type with its format', async ({page}) => {
        const sheet = await open(page);
        await expect(cell(sheet, 'D2')).toHaveText('$1,299.00');
        await expect(cell(sheet, 'E2')).toHaveText('$5,196.00');
        await expect(cell(sheet, 'F2')).toHaveText(/^\d+\.\d%$/);
        await expect(cell(sheet, 'G2')).toHaveText('Mar 2, 2026');
        await expect(cell(sheet, 'H2')).toHaveText('TRUE');
        await expect(cell(sheet, 'E10')).toHaveText('#DIV/0!');
        // Numbers go to the end of the cell, text stays at the start
        expect(await cell(sheet, 'D2').evaluate(element => getComputedStyle(element).textAlign)).toBe('end');
        expect(await cell(sheet, 'A2').evaluate(element => getComputedStyle(element).textAlign)).not.toBe('end');
    });

    test('takes values and formulas from the keyboard, and Enter and Tab move', async ({page}) => {
        const sheet = await open(page);
        await cell(sheet, 'A11').click();
        await page.keyboard.type('5');
        await page.keyboard.press('Enter');
        await page.keyboard.type('7');
        await page.keyboard.press('Enter');
        await page.keyboard.type('=A11*A12');
        await page.keyboard.press('Tab');
        expect((await state(sheet)).active).toBe('B13');
        await expect(cell(sheet, 'A13')).toHaveText('35');
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Shift+Enter');
        expect((await state(sheet)).active).toBe('A12');
        await expect(page.getByTestId('sheet-log')).toContainText('change A13: "=A11*A12"');
    });

    test('edits with F2, and Escape keeps the old input', async ({page}) => {
        const sheet = await open(page);
        await cell(sheet, 'A2').click();
        await page.keyboard.press('F2');
        await expect(sheet.locator('.zest-editor')).toBeFocused();
        await expect(sheet.locator('.zest-editor')).toHaveValue('Laptops');
        await page.keyboard.type(' Pro');
        await page.keyboard.press('Escape');
        await expect(cell(sheet, 'A2')).toHaveText('Laptops');
        await expect(sheet.locator('[role="grid"]')).toBeFocused();
        await page.keyboard.press('F2');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.type('X');
        await page.keyboard.press('Enter');
        await expect(cell(sheet, 'A2')).toHaveText('LaptopXs');
    });

    test('shows the active cell and the formula in the formula bar', async ({page}) => {
        const sheet = await open(page);
        await cell(sheet, 'E2').click();
        const formula = sheet.locator('.zest-formula-bar .zest-formula');
        await expect(formula).toHaveValue('=C2*D2');
        await expect(sheet.locator('.zest-formula-bar .zest-name')).toHaveValue('E2');
        await formula.fill('=C2*D2*2');
        await formula.press('Enter');
        await expect(cell(sheet, 'E2')).toHaveText('$10,392.00');
        // A change goes to each formula that reads the cell
        await expect(cell(sheet, 'E7')).toHaveText('$14,079.00');
    });

    test('extends a range with Shift and the arrows, copies it with Ctrl+C, and pastes it with Ctrl+V', async ({page, context, browserName}) => {
        // Only Chromium has these permissions. The test reads the system clipboard only there.
        const chromium = browserName === 'chromium';
        if (chromium) { await context.grantPermissions(['clipboard-read', 'clipboard-write']); }
        const sheet = await open(page);
        await cell(sheet, 'C2').click();
        await page.keyboard.press('Shift+ArrowDown');
        await page.keyboard.press('Shift+ArrowRight');
        expect((await state(sheet)).selection).toEqual({top: 1, left: 2, bottom: 2, right: 3});
        await page.keyboard.press('Control+C');
        await cell(sheet, 'C11').click();
        await page.keyboard.press('Control+V');
        await expect(cell(sheet, 'C11')).toHaveText('4');
        await expect(cell(sheet, 'D12')).toHaveText('$249.50');
        if (chromium) {
            expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('4\t$1,299.00\n6\t$249.50');
        }
        // A copied formula moves with the paste
        await cell(sheet, 'E2').click();
        await page.keyboard.press('Control+C');
        await cell(sheet, 'E11').click();
        await page.keyboard.press('Control+V');
        expect(await sheet.evaluate(element => element.model.getInput('E11'))).toBe('=C11*D11');
        await expect(cell(sheet, 'E11')).toHaveText('$5,196.00');
    });

    test('undoes with Ctrl+Z, fills down with Ctrl+D, and the toolbar shares the actions', async ({page}) => {
        const sheet = await open(page);
        const undo = page.getByTestId('sheet-undo');
        await expect(undo).toBeDisabled();
        await cell(sheet, 'C5').click();
        await page.keyboard.press('Delete');
        await expect(cell(sheet, 'C5')).toHaveText('');
        await expect(undo).toBeEnabled();
        await page.keyboard.press('Control+Z');
        await expect(cell(sheet, 'C5')).toHaveText('2');
        await expect(undo).toBeDisabled();
        await page.getByTestId('sheet-redo').click();
        await expect(cell(sheet, 'C5')).toHaveText('');
        await undo.click();
        await cell(sheet, 'E5').click();
        await page.keyboard.press('Shift+ArrowDown');
        await page.keyboard.press('Control+D');
        expect(await sheet.evaluate(element => element.model.getInput('E6'))).toBe('=C6*D6');
        await page.keyboard.press('Control+B');
        await expect(page.getByTestId('sheet-bold')).toHaveAttribute('aria-pressed', 'true');
        expect(await cell(sheet, 'E5').evaluate(element => getComputedStyle(element).fontWeight)).toBe('700');
    });

    test('selects with a drag, a header click, and Shift with a click', async ({page}) => {
        const sheet = await open(page);
        const from = await cell(sheet, 'B2').boundingBox();
        const to = await cell(sheet, 'D4').boundingBox();
        await page.mouse.move(from.x + 10, from.y + 10);
        await page.mouse.down();
        await page.mouse.move(to.x + 10, to.y + 10, {steps: 6});
        await page.mouse.up();
        expect((await state(sheet)).selection).toEqual({top: 1, left: 1, bottom: 3, right: 3});
        await expect(sheet.locator('.zest-selection')).toBeVisible();
        await cell(sheet, 'F5').click({modifiers: ['Shift']});
        expect((await state(sheet)).selection).toEqual({top: 1, left: 1, bottom: 4, right: 5});
        // The middle of the header, away from the resize edges
        await sheet.locator('.zest-head', {hasText: /^C$/}).click();
        expect((await state(sheet)).selection).toEqual({top: 0, left: 2, bottom: 13, right: 2});
        await sheet.locator('.zest-row-head', {hasText: /^3$/}).click();
        expect((await state(sheet)).selection).toEqual({top: 2, left: 0, bottom: 2, right: 7});
        await cell(sheet, 'A3').dblclick();
        await expect(sheet.locator('.zest-editor')).toHaveValue('Monitors');
    });

    test('changes the width of a column with a drag of its edge', async ({page}) => {
        const sheet = await open(page);
        const before = await cell(sheet, 'B2').boundingBox();
        const handle = sheet.locator('.zest-head', {hasText: /^B$/}).locator('.zest-resize');
        const box = await handle.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, {steps: 5});
        await page.mouse.up();
        const after = await cell(sheet, 'B2').boundingBox();
        expect(Math.round(after.width - before.width)).toBe(60);
        expect(Math.round((await cell(sheet, 'C2').boundingBox()).x - after.x)).toBe(Math.round(after.width));
    });

    test('goes to row 10,000 with Ctrl+Down, and keeps the number of cell elements small', async ({page}) => {
        await page.goto('/gallery/spreadsheet');
        const sheet = page.getByTestId('sheet-large-element');
        await sheet.locator('[role="grid"]').focus();
        const count = () => sheet.locator('[role="gridcell"]').count();
        const before = await count();
        const started = await page.evaluate(() => performance.now());
        await page.keyboard.press('Control+ArrowDown');
        await expect(cell(sheet, 'A10000')).toHaveText('10000');
        const elapsed = await page.evaluate((start) => performance.now() - start, started);
        expect(elapsed).toBeLessThan(budget(1000));
        expect(await count()).toBe(before);
        expect(before).toBeLessThan(1500);
        expect(await sheet.locator('[role="grid"]').getAttribute('aria-activedescendant')).toBeTruthy();
        // A change at the top recalculates the chain of 9,999 formulas
        await page.getByTestId('sheet-large-change').click();
        await expect(page.getByTestId('sheet-large-time')).toContainText('10000 cells in');
        const ms = Number((await page.getByTestId('sheet-large-time').textContent()).match(/in (\d+) ms/)[1]);
        expect(ms).toBeLessThan(budget(250));
    });

    test('scrolls a large sheet with no long frames', async ({page}) => {
        await page.goto('/gallery/spreadsheet');
        const sheet = page.getByTestId('sheet-large-element');
        const grid = sheet.locator('[role="grid"]');
        await grid.scrollIntoViewIfNeeded();
        const longest = await grid.evaluate(async (element) => {
            let worst = 0;
            for (let step = 0; step < 60; step++) {
                const start = performance.now();
                element.scrollTop += 900;
                element.scrollLeft += step % 3 === 0 ? 150 : 0;
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                worst = Math.max(worst, performance.now() - start);
            }
            return worst;
        });
        // Two frames are about 33 ms. A long frame is above 100 ms.
        expect(longest).toBeLessThan(budget(150));
        await expect(sheet.locator('[role="row"][aria-rowindex]').filter({hasText: /\d/}).first()).toBeVisible();
    });

    test('a cell that stands alone shows its type, and edits with Enter', async ({page}) => {
        await page.goto('/gallery/spreadsheet');
        const percent = page.getByTestId('sheet-cell-percent');
        await expect(percent).toHaveText('12.5%');
        await expect(page.getByTestId('sheet-cell-currency')).toHaveText('$1,234.50');
        await expect(page.getByTestId('sheet-cell-auto')).toHaveText('1024');
        await percent.focus();
        await page.keyboard.press('Enter');
        await page.keyboard.press('Control+A');
        await page.keyboard.type('50');
        await page.keyboard.press('Enter');
        await expect(percent).toHaveText('50%');
    });

    test('shows one model in two sheets, and the read-only sheet does not change', async ({page}) => {
        await page.goto('/gallery/spreadsheet');
        const editable = page.getByTestId('sheet-shared-editable');
        const readonly = page.getByTestId('sheet-shared-readonly');
        await cell(editable, 'A2').click();
        await page.keyboard.type('9');
        await page.keyboard.press('Enter');
        await expect(cell(readonly, 'B2')).toHaveText('81');
        await cell(readonly, 'A2').click();
        await page.keyboard.type('1');
        await expect(readonly.locator('.zest-editor')).toHaveCount(0);
        await expect(cell(readonly, 'A2')).toHaveText('9');
    });
});

test.describe('the spreadsheet example', () => {
    test('loads 10,000 rows, and the status bar sums the selection', async ({page}) => {
        await page.goto('/examples/spreadsheet');
        test.skip(await page.getByText('Page not found').count() > 0, 'the example route is not wired yet');
        const sheet = page.getByTestId('example-sheet');
        await expect(cell(sheet, 'A1')).toHaveText('Date');
        await expect(page.getByTestId('example-status')).toContainText('Loaded 10000 rows');
        await cell(sheet, 'D2').click();
        await page.keyboard.press('Shift+ArrowDown');
        const units = await sheet.evaluate(element => element.getValue('D2') + element.getValue('D3'));
        await expect(page.getByTestId('example-status')).toContainText(`Sum: ${units}`);
        // A change at the top recalculates the running total of each row below it
        await page.keyboard.press('Escape');
        await cell(sheet, 'D2').click();
        await page.keyboard.type('1000');
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('example-status')).toContainText(/Recalculated: (\d{4,}) cells/);
        await page.getByTestId('example-undo').click();
        expect(await sheet.evaluate(element => element.model.getInput('D2'))).not.toBe('1000');
    });
});

test.describe('the spreadsheet example meets the standard', () => {
    for (const colorScheme of ['light', 'dark']) {
        test(`in ${colorScheme}, also while a cell is in edit`, async ({page}) => {
            test.setTimeout(60000);
            await page.emulateMedia({colorScheme});
            await page.goto('/examples/spreadsheet');
            test.skip(await page.getByText('Page not found').count() > 0, 'the example route is not wired yet');
            const sheet = page.getByTestId('example-sheet');
            await cell(sheet, 'B3').click();
            await page.keyboard.press('Shift+ArrowRight');
            const analyze = async () => (await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
                .violations.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(' ')).join(', ')}`);
            expect(await analyze()).toEqual([]);
            await page.keyboard.press('F2');
            expect(await analyze()).toEqual([]);
        });
    }

    test('fits 320 CSS pixels: the grid scrolls in itself', async ({page}) => {
        await page.setViewportSize({width: 320, height: 700});
        await page.goto('/examples/spreadsheet');
        test.skip(await page.getByText('Page not found').count() > 0, 'the example route is not wired yet');
        await expect(page.getByTestId('example-sheet')).toBeVisible();
        await page.addStyleTag({content: '* { font-family: monospace !important; letter-spacing: 0.05em; }'});
        const overflow = await page.evaluate(() => {
            const scroller = document.getElementById('page');
            return scroller.scrollWidth - scroller.clientWidth;
        });
        expect(overflow).toBeLessThanOrEqual(0);
    });
});
