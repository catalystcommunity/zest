import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.js';

const open = async (page) => {
    await page.setViewportSize({width: 1280, height: 1200});
    await page.goto('/gallery/containers');
    await expect(page.getByTestId('section-containers')).toBeVisible();
};
const log = (page) => page.getByTestId('containers-log');
const box = (locator) => locator.boundingBox();

async function drag(page, from, dx, dy) {
    const start = await box(from);
    const x = start.x + start.width / 2;
    const y = start.y + start.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, {steps: 6});
    await page.mouse.up();
}

test.describe('split-view', () => {
    test('a drag on the divider changes the size of the panes, and nested splits work', async ({page}) => {
        await open(page);
        const outer = page.getByTestId('split-outer');
        const files = outer.locator('> [label="Files"]');
        const before = (await box(files)).width;
        await drag(page, outer.locator('[role="separator"]').first(), 120, 0);
        await expect.poll(async () => (await box(files)).width).toBeGreaterThan(before + 100);
        await expect(log(page)).toContainText('split-view-resize');
        const inner = page.getByTestId('split-inner');
        const editor = inner.locator('> [label="Editor"]');
        const height = (await box(editor)).height;
        await drag(page, inner.locator('[role="separator"]').first(), 0, -60);
        await expect.poll(async () => (await box(editor)).height).toBeLessThan(height - 40);
    });

    test('the arrow keys move the divider, and Enter collapses the pane', async ({page}) => {
        await open(page);
        const outer = page.getByTestId('split-outer');
        const divider = outer.locator('[role="separator"]').first();
        const files = outer.locator('> [label="Files"]');
        await divider.focus();
        // The split sets its sizes in a frame. Under load, that frame can come after the focus.
        await expect.poll(async () => {
            const first = (await box(files)).width;
            await page.waitForTimeout(50);
            return Math.abs((await box(files)).width - first);
        }).toBe(0);
        const before = (await box(files)).width;
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await expect.poll(async () => Math.round((await box(files)).width - before)).toBe(20);
        await page.keyboard.press('Enter');
        await expect.poll(async () => (await box(files)).width).toBe(0);
        await expect(divider).toHaveAttribute('aria-valuenow', '0');
        await page.keyboard.press('Enter');
        await expect.poll(async () => (await box(files)).width).toBeGreaterThan(100);
        expect(await divider.evaluate(element => getComputedStyle(element).outlineWidth !== undefined)).toBe(true);
    });
});

test.describe('split-view, fast keys', () => {
    test('two keys in one frame move the divider two steps', async ({page}) => {
        await open(page);
        const outer = page.getByTestId('split-outer');
        const files = outer.locator('> [label="Files"]');
        await expect.poll(async () => (await box(files)).width).toBeGreaterThan(0);
        const before = (await box(files)).width;
        // Both keys go before the next frame, as with a fast typist or a held key
        await outer.locator('[role="separator"]').first().evaluate((divider) => {
            for (let i = 0; i < 2; i++) {
                divider.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, composed: true, cancelable: true}));
            }
        });
        await expect.poll(async () => Math.round((await box(files)).width - before)).toBe(20);
    });
});

test.describe('tab-view', () => {
    test('the arrow keys select the next tab, and skip nothing that is disabled', async ({page}) => {
        await open(page);
        const tabs = page.getByTestId('tabs-main').getByRole('tab');
        await tabs.first().click();
        await page.keyboard.press('ArrowRight');
        await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByTestId('tabs-main').getByRole('tabpanel', {name: 'Settings'})).toBeVisible();
        await expect(log(page)).toContainText('tab-view-select Settings');
        // The disabled tab gets the focus, so that a user can find it, but it is not selected
        await page.keyboard.press('ArrowRight');
        await expect(tabs.nth(2)).toBeFocused();
        await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
        expect(await tabs.nth(2).evaluate(element => getComputedStyle(element).outlineWidth)).toBe('2px');
    });

    test('a tab closes with its × and with Delete, and a listener can refuse', async ({page}) => {
        await open(page);
        const view = page.getByTestId('tabs-closable');
        const tabs = view.getByRole('tab');
        await expect(tabs).toHaveCount(6);
        await tabs.nth(1).locator('.close').click();
        await expect(tabs).toHaveCount(5);
        await expect(log(page)).toContainText('tab-view-close Document 2');
        await tabs.first().focus();
        await page.keyboard.press('Delete');
        await expect(tabs).toHaveCount(5);
        await expect(log(page)).toContainText('Document 1 cancelled');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Delete');
        await expect(tabs).toHaveCount(4);
        // The focus stays in the tabs, on the page that is now selected
        await expect(view.getByRole('tab', {selected: true})).toBeFocused();
    });

    test('the tabs can go on each side', async ({page}) => {
        await open(page);
        const view = page.getByTestId('tabs-closable');
        await page.getByTestId('tabs-placement').selectOption('start');
        const tab = await box(view.getByRole('tab').first());
        const panel = await box(view.getByRole('tabpanel'));
        expect(tab.x + tab.width).toBeLessThanOrEqual(panel.x + 1);
        await expect(view.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
        await page.keyboard.press('Tab');
    });
});

test.describe('floating-window', () => {
    test('moves with a drag on the title bar, and stays in the area', async ({page}) => {
        await open(page);
        const area = page.getByTestId('window-area');
        const notes = page.getByTestId('window-notes');
        await area.scrollIntoViewIfNeeded();
        const start = await box(notes);
        await drag(page, notes.locator('.title'), 100, 50);
        await expect.poll(async () => Math.round((await box(notes)).x - start.x)).toBe(100);
        await expect(notes).toHaveAttribute('active', '');
        await expect(log(page)).toContainText('floating-window-move Notes');
        await drag(page, notes.locator('.title'), 3000, 3000);
        const areaBox = await box(area);
        const end = await box(notes);
        expect(end.x + end.width).toBeLessThanOrEqual(areaBox.x + areaBox.width + 1);
        expect(end.y + end.height).toBeLessThanOrEqual(areaBox.y + areaBox.height + 1);
    });

    test('changes size with a drag on the corner', async ({page}) => {
        await open(page);
        const help = page.getByTestId('window-help');
        await help.scrollIntoViewIfNeeded();
        const start = await box(help);
        const corner = help.locator('.corner');
        const c = await box(corner);
        await page.mouse.move(c.x + c.width - 4, c.y + c.height - 4);
        await page.mouse.down();
        await page.mouse.move(c.x + c.width + 76, c.y + c.height + 36, {steps: 5});
        await page.mouse.up();
        await expect.poll(async () => Math.round((await box(help)).width - start.width)).toBe(80);
        await expect(log(page)).toContainText('floating-window-resize Help');
    });

    test('moves with clicks and no drag: the handle, then a place in the area', async ({page}) => {
        await open(page);
        const area = page.getByTestId('window-area');
        const tasks = page.getByTestId('window-tasks');
        await area.scrollIntoViewIfNeeded();
        await tasks.locator('.handle').click();
        await expect(tasks.locator('.hint')).toContainText('Move');
        await area.click({position: {x: 500, y: 200}});
        await expect.poll(async () => {
            const a = await box(area);
            const t = await box(tasks);
            // The corner is at the click, inside the 1px border. Firefox rounds a part of a pixel the other way.
            return Math.abs(t.x - a.x - 501) <= 1 && Math.abs(t.y - a.y - 201) <= 1;
        }).toBe(true);
        await expect(tasks.locator('.hint')).toBeEmpty();
    });

    test('moves with the keyboard, and the window buttons work', async ({page}) => {
        await open(page);
        const notes = page.getByTestId('window-notes');
        await notes.locator('.handle').focus();
        const start = await box(notes);
        await page.keyboard.press('Alt+F7');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');
        await expect.poll(async () => Math.round((await box(notes)).x - start.x)).toBe(20);
        await notes.getByRole('button', {name: 'Maximize'}).click();
        const area = await box(page.getByTestId('window-area'));
        await expect.poll(async () => Math.round((await box(notes)).width)).toBe(Math.round(area.width - 2));
        await notes.getByRole('button', {name: 'Restore'}).click();
        await notes.getByRole('button', {name: 'Close'}).click();
        await expect(notes).toHaveCount(0);
        await expect(log(page)).toContainText('floating-window-close Notes');
        await page.getByTestId('windows-tile').click();
        const tasks = await box(page.getByTestId('window-tasks'));
        const help = await box(page.getByTestId('window-help'));
        expect(tasks.x + tasks.width).toBeLessThanOrEqual(help.x + 1);
    });
});

test.describe('dialog-window', () => {
    test('gives the button value, Enter clicks the default, Escape cancels, and the focus returns', async ({page}) => {
        await open(page);
        const opener = page.getByTestId('dialog-open-custom');
        await opener.click();
        // A question is an alert dialog
        const dialog = page.getByRole('alertdialog', {name: 'Save changes?'});
        await expect(dialog).toBeVisible();
        await expect(page.getByRole('button', {name: 'Save', exact: true})).toBeFocused();
        await page.getByRole('button', {name: 'Do not save'}).click();
        await expect(log(page)).toContainText('custom: "discard"');
        await expect(opener).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(log(page)).toContainText('custom: "cancel"');
        await expect(opener).toBeFocused();
    });

    test('a modal dialog makes the page inert, and a modeless one does not', async ({page}) => {
        await open(page);
        await page.getByTestId('dialog-open-modeless').click();
        await expect(page.getByRole('dialog', {name: 'Find'})).toBeVisible();
        await page.getByTestId('dialog-message').click();
        const message = page.getByRole('dialog', {name: 'Done'});
        await expect(message).toBeVisible();
        await expect(page.getByText('The file is saved.')).toBeVisible();
        await page.getByRole('button', {name: 'OK'}).click();
        await expect(log(page)).toContainText('message: "ok"');
        await expect(page.locator('dialog-window[label="Done"]')).toHaveCount(0);
    });

    test('asks for text, and an error tells its kind in words', async ({page}) => {
        await open(page);
        await page.getByTestId('dialog-ask').click();
        const input = page.getByRole('textbox', {name: 'New name'});
        await expect(input).toBeFocused();
        await input.fill('');
        await expect(page.getByRole('button', {name: 'OK'})).toBeDisabled();
        await input.fill('todo.txt');
        await page.keyboard.press('Enter');
        await expect(log(page)).toContainText('ask: "todo.txt"');
        await page.getByTestId('dialog-error').click();
        const error = page.getByRole('alertdialog', {name: 'Cannot open'});
        await expect(error).toContainText('Error:');
        await expect(page.getByText('The file is not there.')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(log(page)).toContainText('error: "cancel"');
    });
});

test.describe('other containers', () => {
    test('the accordion keeps one section open, and the arrows go between headings', async ({page}) => {
        await open(page);
        const accordion = page.getByTestId('accordion');
        await accordion.getByRole('button', {name: 'Appearance'}).click();
        await expect(accordion.getByRole('button', {name: 'General'})).toHaveAttribute('aria-expanded', 'false');
        await expect(accordion.getByRole('region', {name: 'Appearance'})).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await expect(accordion.getByRole('button', {name: 'Shortcuts'})).toBeFocused();
        await page.keyboard.press('Home');
        await expect(accordion.getByRole('button', {name: 'General'})).toBeFocused();
    });

    test('a check box in a group box turns its content on', async ({page}) => {
        await open(page);
        const group = page.getByTestId('group-checkable');
        const host = group.getByRole('textbox', {name: 'Host'});
        // The content is inert, so it cannot get the focus
        const focusable = () => host.evaluate(element => { element.focus(); return document.activeElement === element; });
        expect(await focusable()).toBe(false);
        await group.getByRole('checkbox', {name: 'Use a proxy'}).check();
        expect(await focusable()).toBe(true);
        await host.fill('other.example');
        await expect(log(page)).toContainText('group-box-check true');
        await page.getByTestId('group-collapsible').getByRole('button', {name: 'Advanced'}).click();
        await expect(page.getByText('Settings that most users do not need.')).toBeVisible();
    });

    test('the scroll area scrolls with the keyboard, and the status pane tells changes', async ({page}) => {
        await open(page);
        const region = page.getByRole('region', {name: 'Release notes'});
        await region.focus();
        await page.keyboard.press('PageDown');
        await expect.poll(() => region.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
        await page.getByTestId('status-input').fill('abc');
        await expect(page.getByRole('status').filter({hasText: 'Typed 3 characters'})).toBeVisible();
    });

    test('each target is at least 24 by 24 CSS pixels', async ({page}) => {
        await open(page);
        const sizes = await page.getByTestId('section-containers').evaluate(section => {
            const found = [];
            const visit = (root) => {
                for (const element of root.querySelectorAll('*')) {
                    if (element.shadowRoot) { visit(element.shadowRoot); }
                    if (element.matches('button, [role="tab"], [role="separator"], .close')) {
                        const rect = element.getBoundingClientRect();
                        if (rect.width && rect.height) { found.push({name: element.className || element.textContent, width: rect.width, height: rect.height}); }
                    }
                }
            };
            visit(section);
            return found;
        });
        expect(sizes.length).toBeGreaterThan(30);
        for (const size of sizes) {
            expect(size.width, size.name).toBeGreaterThanOrEqual(24);
            expect(size.height, size.name).toBeGreaterThanOrEqual(24);
        }
    });
});

test.describe('states that the gallery test does not open', () => {
    const axe = async (page) => {
        const {violations} = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        return violations.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(' ')).join(', ')}`);
    };

    for (const colorScheme of ['light', 'dark']) {
        test(`meet the standard in ${colorScheme}: tabs on the side, a collapsed pane, a window in move mode, an open dialog`, async ({page}) => {
            test.setTimeout(60000);
            await page.emulateMedia({colorScheme});
            await open(page);
            await page.getByTestId('tabs-placement').selectOption('end');
            const divider = page.getByTestId('split-outer').locator('[role="separator"]').first();
            await divider.focus();
            await page.keyboard.press('Enter');
            await page.getByTestId('window-tasks').locator('.handle').click();
            await page.getByTestId('window-notes').getByRole('button', {name: 'Minimize'}).click();
            await page.getByTestId('group-collapsible').getByRole('button', {name: 'Advanced'}).click();
            expect(await axe(page)).toEqual([]);
            await page.getByTestId('dialog-ask').click();
            await expect(page.getByRole('textbox', {name: 'New name'})).toBeFocused();
            expect(await axe(page)).toEqual([]);
        });
    }
});
