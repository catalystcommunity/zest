import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.js';
import { budget } from './timing.js';

const open = async (page) => {
    await page.setViewportSize({width: 1280, height: 1400});
    await page.goto('/gallery/data-views');
    await expect(page.getByTestId('section-data-views')).toBeVisible();
};
const visibleRows = (view) => view.locator('.row:not([hidden])');

test.describe('tree-view', () => {
    test('opens a folder with the keyboard, loads its children, and checks a file', async ({page}) => {
        await open(page);
        const tree = page.getByTestId('data-views-tree');
        await tree.locator('[role="tree"]').focus();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowRight');
        const home = tree.locator('[role="treeitem"]', {hasText: 'home'});
        await expect(home).toHaveAttribute('aria-expanded', 'true');
        await expect(tree.locator('[role="treeitem"]', {hasText: 'Loading…'})).toBeVisible();
        await expect(tree.locator('[role="treeitem"][aria-level="2"]', {hasText: 'src'}).first()).toBeVisible();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('End');
        await page.keyboard.press('Home');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Space');
        await expect(tree.locator('[role="treeitem"]', {hasText: 'src'}).first()).toHaveAttribute('aria-checked', 'true');
        await expect(home).toHaveAttribute('aria-checked', 'mixed');
        await page.keyboard.press('ArrowLeft');
        await expect(home).toHaveClass(/active/);
        await expect(page.getByTestId('data-views-log')).toContainText('tree-view-check home/src true');
    });

    test('opens a folder with a click on its arrow', async ({page}) => {
        await open(page);
        const tree = page.getByTestId('data-views-tree');
        const zest = tree.locator('[role="treeitem"]', {hasText: 'zest'});
        await zest.locator('.twisty').click();
        await expect(tree.locator('[role="treeitem"][aria-level="3"]').first()).toBeVisible();
        await expect(zest).toHaveAttribute('aria-expanded', 'true');
    });
});

test.describe('list-view', () => {
    test('goes to the last of 100,000 items with End, and keeps the DOM small', async ({page}) => {
        await open(page);
        const list = page.getByTestId('data-views-list');
        await list.locator('[role="option"]').first().click();
        await page.keyboard.press('End');
        const last = list.locator('[role="option"][aria-posinset="100000"]');
        await expect(last).toBeInViewport();
        await expect(last).toHaveAttribute('aria-selected', 'true');
        await expect(list.locator('[role="listbox"]')).toHaveAttribute('aria-activedescendant', await last.getAttribute('id'));
        expect(await visibleRows(list).count()).toBeLessThan(40);
        await page.keyboard.press('Shift+PageUp');
        await expect(page.getByTestId('data-views-log')).toContainText(/list-view-select \d+ \(\d+ selected\)/);
        expect(await list.evaluate(view => view.selectedKeys.length)).toBeGreaterThan(5);
    });

    test('opens a million items, and shows the last one at the end of the scroll', async ({page}) => {
        await open(page);
        const result = await page.evaluate(async () => {
            const view = document.createElement('list-view');
            view.style.height = '320px';
            view.items = Array.from({length: 1_000_000}, (_, i) => `Row ${i + 1}`);
            const start = performance.now();
            document.querySelector('#page').append(view);
            const opened = performance.now() - start;
            view.scroller.scrollTop = view.scroller.scrollHeight;
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const rows = [...view.querySelectorAll('.row:not([hidden])')];
            const box = view.scroller.getBoundingClientRect();
            const last = rows.find(row => row.textContent === 'Row 1000000');
            const lastBox = last?.getBoundingClientRect();
            return {opened, rows: rows.length, height: view.scroller.scrollHeight, lastInside: Boolean(lastBox) && lastBox.bottom <= box.bottom + 1 && lastBox.top >= box.top};
        });
        console.log(`list-view with 1,000,000 items: first render ${result.opened.toFixed(1)} ms, ${result.rows} row elements`);
        expect(result.opened).toBeLessThan(budget(500));
        expect(result.rows).toBeLessThan(40);
        expect(result.height).toBeLessThanOrEqual(10_000_000);
        expect(result.lastInside).toBe(true);
    });
});

test.describe('table-view', () => {
    test('sorts by a column with a click and with the keyboard', async ({page}) => {
        await open(page);
        const table = page.getByTestId('data-views-table');
        const amount = table.locator('[role="columnheader"]', {hasText: 'Amount'});
        await amount.click();
        await expect(amount).toHaveAttribute('aria-sort', 'ascending');
        const firstAmount = async () => Number((await table.locator('[role="row"][aria-rowindex="2"] [aria-colindex="4"]').textContent()).replace(/[$,]/g, ''));
        const [low, high] = await table.evaluate(view => view.items.reduce(([min, max], item) => [Math.min(min, item.amount), Math.max(max, item.amount)], [Infinity, -Infinity]));
        expect(await firstAmount()).toBe(low);
        // The header has the keyboard focus, so Enter sorts again
        await page.keyboard.press('Enter');
        await expect(amount).toHaveAttribute('aria-sort', 'descending');
        expect(await firstAmount()).toBe(high);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowRight');
        await expect(table.locator('[role="grid"]')).toHaveAttribute('aria-activedescendant', /r0c4$/);
        await expect(page.getByTestId('data-views-log')).toContainText('table-view-sort amount descending');
    });

    test('changes the width of a column with a drag on the edge of its header', async ({page}) => {
        await open(page);
        const table = page.getByTestId('data-views-table');
        const name = table.locator('[role="columnheader"]', {hasText: 'Name'});
        const before = (await name.boundingBox()).width;
        const handle = await name.locator('.resize').boundingBox();
        await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
        await page.mouse.down();
        await page.mouse.move(handle.x + 80, handle.y + handle.height / 2, {steps: 5});
        await page.mouse.up();
        const after = (await name.boundingBox()).width;
        expect(after - before).toBeGreaterThan(70);
        expect(after - before).toBeLessThan(90);
        // The cells follow the header, and the drag did not sort
        const cell = await table.locator('[role="row"][aria-rowindex="2"] [aria-colindex="2"]').boundingBox();
        expect(Math.abs(cell.width - after)).toBeLessThan(1);
        await expect(name).not.toHaveAttribute('aria-sort', /.+/);
        await expect(page.getByTestId('data-views-log')).toContainText('table-view-resize name');
    });

    test('renders one changed row again', async ({page}) => {
        await open(page);
        const table = page.getByTestId('data-views-table');
        const cell = table.locator('[role="row"][aria-rowindex="2"] [aria-colindex="4"]');
        const before = Number((await cell.textContent()).replace(/[$,]/g, ''));
        await page.getByTestId('data-views-change-row').click();
        await expect.poll(async () => Number((await cell.textContent()).replace(/[$,]/g, ''))).toBeCloseTo(before + 100, 2);
        await expect(table.locator('[role="row"][aria-rowindex="2"] [aria-colindex="2"]')).toContainText('★');
    });

    test('scrolls through 100,000 rows with short renders and a small DOM', async ({page}) => {
        await open(page);
        const table = page.getByTestId('data-views-table');
        const result = await table.evaluate(async (view) => {
            const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
            const times = [];
            const render = view.render;
            view.render = function () {
                const start = performance.now();
                render.call(this);
                times.push(performance.now() - start);
            };
            const max = view.scroller.scrollHeight - view.scroller.clientHeight;
            let largest = 0;
            for (let step = 0; step <= 100; step++) {
                // Big jumps and small steps, as a scroll bar drag and a wheel make
                view.scroller.scrollTop = step % 2 ? max * step / 100 : max * step / 100 + 96;
                await frame();
                await frame();
                largest = Math.max(largest, view.querySelectorAll('.row').length);
            }
            view.render = render;
            delete view.render;
            times.sort((a, b) => a - b);
            return {renders: times.length, median: times[Math.floor(times.length / 2)], worst: times.at(-1), rows: largest};
        });
        console.log(`table-view scroll: ${result.renders} renders, median ${result.median.toFixed(2)} ms, worst ${result.worst.toFixed(2)} ms, ${result.rows} row elements`);
        expect(result.renders).toBeGreaterThan(50);
        // Firefox gives performance.now() in whole milliseconds, so its median is a whole number
        expect(result.median).toBeLessThan(budget(test.info().project.name === 'chromium' ? 8 : 12));
        // One frame can include garbage collection
        expect(result.worst).toBeLessThan(budget(150));
        expect(result.rows).toBeLessThan(60);
    });

    test('sorts 100,000 rows in a short time', async ({page}) => {
        await open(page);
        const table = page.getByTestId('data-views-table');
        const times = await table.evaluate((view) => ['name', 'amount', 'joined'].map(key => {
            const start = performance.now();
            view.sortBy(key, 'ascending');
            view.render();
            return performance.now() - start;
        }));
        console.log(`table-view sort of 100,000 rows: name ${times[0].toFixed(0)} ms, amount ${times[1].toFixed(0)} ms, joined ${times[2].toFixed(0)} ms`);
        for (const time of times) { expect(time).toBeLessThan(budget(1500)); }
    });
});

test.describe('data views together', () => {
    for (const colorScheme of ['light', 'dark']) {
        test(`meet the standard with selected rows, an open folder, and a sort in ${colorScheme}`, async ({page}) => {
            await page.emulateMedia({colorScheme});
            await open(page);
            const tree = page.getByTestId('data-views-tree');
            await tree.locator('[role="treeitem"]', {hasText: 'zest'}).locator('.twisty').click();
            await tree.locator('[role="treeitem"]', {hasText: 'notes.md'}).click();
            const list = page.getByTestId('data-views-list');
            await list.locator('[role="option"]').nth(1).click();
            await page.keyboard.press('Shift+ArrowDown');
            await page.getByTestId('data-views-table').locator('[role="columnheader"]', {hasText: 'City'}).click();
            await page.keyboard.press('ArrowDown');
            await expect(tree.locator('[role="treeitem"][aria-level="3"]').first()).toBeVisible();
            const {violations} = await new AxeBuilder({page}).include('[data-testid="section-data-views"]')
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
            expect(violations.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(' ')).join(', ')}`)).toEqual([]);
        });
    }

    test('keep the selected rows visible in forced colors', async ({page}) => {
        await page.emulateMedia({forcedColors: 'active'});
        await open(page);
        const list = page.getByTestId('data-views-list');
        await list.locator('[role="option"]').nth(1).click();
        const css = (locator) => locator.evaluate(element => getComputedStyle(element).backgroundColor);
        expect(await css(list.locator('[role="option"]').nth(1))).not.toEqual(await css(list.locator('[role="option"]').nth(2)));
    });
});

test.describe('tree-view without check boxes', () => {
    test('shows no check box', async ({page}) => {
        await page.goto('/examples/desktop');
        const tree = page.getByTestId('desktop-tree');
        await expect(tree.locator('[role="treeitem"]').first()).toBeVisible();
        expect(await tree.locator('.check').evaluateAll(checks => checks.filter(check => check.getBoundingClientRect().width > 0).length)).toBe(0);
    });
});
