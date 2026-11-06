import { test, expect } from './fixtures.js';

// The desktop example: many components that work together in one window
const open = async (page) => {
    await page.setViewportSize({width: 1280, height: 1000});
    await page.goto('/examples/desktop');
    await expect(page.getByTestId('example-desktop')).toBeVisible();
};
const table = (page) => page.getByTestId('desktop-table');
const rows = (page) => table(page).locator('[role="row"]:not([hidden])').filter({has: page.locator('[role="gridcell"]')});
const count = (page) => page.getByTestId('desktop-count');

test.describe('the desktop example', () => {
    test('a folder in the tree filters the table, and the status bar follows', async ({page}) => {
        await open(page);
        await expect(count(page)).toHaveText(/^5,000 records, 0 selected$/);
        await page.getByTestId('desktop-tree').getByRole('treeitem', {name: 'Oslo'}).click();
        await expect(count(page)).not.toHaveText(/^5,000/);
        const cities = await rows(page).locator('[role="gridcell"]:nth-child(2)').allTextContents();
        expect(cities.length).toBeGreaterThan(5);
        expect(new Set(cities.map(text => text.trim()))).toEqual(new Set(['Oslo']));
    });

    test('a selection enables Delete in the menu and the toolbar, and the Delete key deletes', async ({page}) => {
        await open(page);
        const deleteTool = page.getByTestId('desktop-tools').getByRole('button', {name: /Delete/});
        await expect(deleteTool).toHaveAttribute('aria-disabled', 'true');
        await rows(page).first().click();
        await expect(count(page)).toHaveText('5,000 records, 1 selected');
        await expect(deleteTool).not.toHaveAttribute('aria-disabled', 'true');
        await page.keyboard.press('Delete');
        await expect(count(page)).toHaveText('4,999 records, 0 selected');
    });

    test('a shortcut adds a record, and the form saves it into one row', async ({page}) => {
        await open(page);
        await rows(page).first().click();
        await page.keyboard.press('Alt+Shift+N');
        await expect(count(page)).toHaveText('5,001 records, 1 selected');
        const name = page.getByTestId('desktop-name');
        await expect(name).toBeVisible();
        await name.locator('input').fill('Grace Lovelace');
        await page.getByTestId('desktop-save').click();
        await page.getByTestId('desktop-tabs').getByRole('tab', {name: 'Table'}).click();
        await expect(rows(page).first()).toContainText('Grace Lovelace');
    });

    test('the keyboard opens the menu bar, and a checkable item collapses the folders', async ({page}) => {
        await open(page);
        await rows(page).first().click();
        await page.keyboard.press('F10');
        await expect(page.getByTestId('desktop-menu').getByRole('menuitem', {name: 'File'})).toBeFocused();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        const item = page.getByRole('menuitemcheckbox', {name: /Show the folders/});
        await expect(item).toBeFocused();
        await expect(item).toHaveAttribute('aria-checked', 'true');
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('desktop-tools').getByRole('button', {name: /Show the folders/})).toHaveAttribute('aria-pressed', 'false');
        await expect.poll(() => page.getByTestId('desktop-tree').evaluate(tree => tree.getBoundingClientRect().width)).toBeLessThan(40);
    });

    test('the context menu of the table duplicates a record', async ({page}) => {
        await open(page);
        await rows(page).first().click();
        await page.keyboard.press('Shift+F10');
        await page.getByRole('menuitem', {name: /Duplicate/}).click();
        await expect(count(page)).toHaveText('5,001 records, 1 selected');
        await expect(rows(page).first()).toContainText('(copy)');
    });

    test('the filter dialog filters by name, and Escape cancels it', async ({page}) => {
        await open(page);
        await rows(page).first().click();
        await page.keyboard.press('ControlOrMeta+Shift+F');
        const field = page.getByRole('textbox', {name: 'Name contains'});
        await expect(field).toBeFocused();
        await field.fill('Ada Lovelace');
        await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toBeHidden();
        // The table paints the new rows in the next frame
        await expect.poll(async () => {
            const names = await rows(page).locator('[role="gridcell"]:first-child').allTextContents();
            return names.length > 0 && names.every(text => text.includes('Ada Lovelace'));
        }).toBe(true);
        await rows(page).first().click();
        await page.keyboard.press('ControlOrMeta+Shift+F');
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(rows(page).first()).toContainText('Ada Lovelace');
    });

    test('the chart draws a bar for each city', async ({page}) => {
        await open(page);
        await page.getByTestId('desktop-tabs').getByRole('tab', {name: 'Chart'}).click();
        const chart = page.getByTestId('desktop-chart');
        await expect(chart).toBeVisible();
        await expect.poll(() => chart.evaluate(view => view.framesDrawn ?? view.stats?.framesDrawn ?? 0)).toBeGreaterThan(0);
        const painted = await chart.evaluate(view => {
            const canvas = view.querySelector('canvas') ?? view.shadowRoot?.querySelector('canvas');
            const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
            let count = 0;
            for (let i = 3; i < data.length; i += 4) { if (data[i] > 0) { count++; } }
            return count;
        });
        expect(painted).toBeGreaterThan(1000);
    });
});
