import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.js';

const open = async (page) => {
    await page.goto('/gallery/menus');
    await expect(page.getByTestId('section-menus')).toBeVisible();
};
const log = (page) => page.getByTestId('menus-log');
const bar = (page) => page.getByTestId('menus-bar');
const top = (page, name) => bar(page).getByRole('menuitem', {name, exact: true});
const focused = (page) => page.evaluate(() => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) { active = active.shadowRoot.activeElement; }
    return active?.querySelector?.('.label')?.textContent ?? active?.getAttribute('aria-label') ?? active?.textContent;
});

test.describe('menus', () => {
    test('F10 goes to the menu bar, the arrows open and move between menus, and Escape goes back', async ({page}) => {
        await open(page);
        const documentField = page.getByTestId('menus-document');
        await documentField.focus();
        await page.keyboard.press('F10');
        await expect(top(page, 'File')).toBeFocused();
        await page.keyboard.press('ArrowRight');
        await expect(top(page, 'Edit')).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await expect(top(page, 'Edit')).toHaveAttribute('aria-expanded', 'true');
        expect(await focused(page)).toBe('Undo');
        // A disabled item can get the focus, so that the user can find it
        await expect(page.getByRole('menuitem', {name: 'Undo'})).toHaveAttribute('aria-disabled', 'true');
        await page.keyboard.press('ArrowRight');
        await expect(top(page, 'View')).toHaveAttribute('aria-expanded', 'true');
        expect(await focused(page)).toBe('Word wrap');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowRight');
        expect(await focused(page)).toBe('Zoom in');
        await page.keyboard.press('Enter');
        await expect(log(page)).toContainText('zoom-in from the menu');
        await expect(top(page, 'View')).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(documentField).toBeFocused();
    });

    test('Alt and a letter open a menu, and a letter runs an item', async ({page}) => {
        await open(page);
        await page.getByTestId('menus-document').focus();
        await page.keyboard.press('Alt+f');
        await expect(top(page, 'File')).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('s');
        await expect(log(page)).toContainText('save from the menu');
    });

    test('a shortcut runs the action, and a disabled action shows in the menu and the toolbar', async ({page}) => {
        await open(page);
        const documentField = page.getByTestId('menus-document');
        await documentField.focus();
        await page.keyboard.press('ControlOrMeta+s');
        await expect(log(page)).toContainText('save from the shortcut');
        await page.getByTestId('menus-toggle-save').click();
        const toolbarSave = page.getByTestId('menus-toolbar').getByRole('button', {name: 'Save'});
        await expect(toolbarSave).toHaveAttribute('aria-disabled', 'true');
        await top(page, 'File').click();
        await expect(page.getByRole('menuitem', {name: 'Save', exact: true})).toHaveAttribute('aria-disabled', 'true');
        await page.keyboard.press('Escape');
        await documentField.focus();
        await page.keyboard.press('ControlOrMeta+s');
        await toolbarSave.click({force: true});
        await expect(log(page)).toHaveText('save from the shortcut\n');
    });

    test('a pointer opens a menu, a hover moves to the next menu, and a submenu opens', async ({page}) => {
        await open(page);
        await top(page, 'File').click();
        await expect(page.getByRole('menuitem', {name: 'Open…'})).toBeVisible();
        await top(page, 'View').hover();
        await expect(top(page, 'File')).toHaveAttribute('aria-expanded', 'false');
        await expect(top(page, 'View')).toHaveAttribute('aria-expanded', 'true');
        await page.getByRole('menuitem', {name: 'Zoom', exact: true}).hover();
        await page.getByRole('menuitem', {name: 'Zoom out'}).click();
        await expect(log(page)).toContainText('zoom-out from the menu');
        await expect(page.getByRole('menu')).toHaveCount(0);
    });

    test('a click outside closes a menu', async ({page}) => {
        await open(page);
        await top(page, 'Edit').click();
        await expect(page.getByRole('menuitem', {name: 'Cut'})).toBeVisible();
        await page.getByTestId('menus-tips').click({position: {x: 5, y: 5}});
        await expect(page.getByRole('menu')).toHaveCount(0);
    });

    test('a checked item and the toolbar toggle show the same state', async ({page}) => {
        await open(page);
        const toggle = page.getByTestId('menus-toolbar').getByRole('button', {name: 'Word wrap'});
        await expect(toggle).toHaveAttribute('aria-pressed', 'true');
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-pressed', 'false');
        await expect(page.getByTestId('menus-document')).toHaveAttribute('wrap', 'off');
        await top(page, 'View').click();
        const item = page.getByRole('menuitemcheckbox', {name: 'Word wrap'});
        await expect(item).toHaveAttribute('aria-checked', 'false');
        await item.click();
        await expect(toggle).toHaveAttribute('aria-pressed', 'true');
        await top(page, 'View').click();
        await page.getByRole('menuitemradio', {name: 'Center'}).click();
        await expect(page.getByTestId('menus-toolbar').getByRole('button', {name: 'Center'})).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('menus-toolbar').getByRole('button', {name: 'Left'})).toHaveAttribute('aria-pressed', 'false');
    });

    test('the toolbar is one tab stop, and the arrow keys move in it', async ({page}) => {
        await open(page);
        const toolbar = page.getByTestId('menus-toolbar');
        await toolbar.getByRole('button', {name: 'Open…'}).focus();
        await page.keyboard.press('ArrowRight');
        await expect(toolbar.getByRole('button', {name: 'Save'})).toBeFocused();
        await page.keyboard.press('End');
        await expect(toolbar.getByRole('button', {name: 'Find…'})).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(page.getByTestId('menus-document')).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(toolbar.getByRole('button', {name: 'Find…'})).toBeFocused();
    });

    test('a tooltip shows on hover and on keyboard focus, stays on hover, and Escape hides it', async ({page}) => {
        await open(page);
        const save = page.getByTestId('menus-toolbar').getByRole('button', {name: 'Save'});
        await save.hover();
        const tip = page.getByRole('tooltip', {name: 'Save (Ctrl+S)'});
        await expect(tip).toBeVisible();
        await tip.hover();
        await page.waitForTimeout(400);
        await expect(tip).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(tip).toBeHidden();
        await page.getByTestId('menus-document').focus();
        await page.keyboard.press('Shift+Tab');
        await expect(page.getByRole('tooltip', {name: 'Open… (Ctrl+O)'}).or(page.getByRole('tooltip', {name: 'Find… (Ctrl+F)'}))).toBeVisible();
        await expect(page.getByTestId('menus-tip-button')).toHaveAccessibleDescription('Bold (Ctrl+B): the pointer can move onto this text');
    });

    test('the right button opens the context menu of the text, and an item runs', async ({page}) => {
        await open(page);
        await page.getByTestId('menus-document').click({button: 'right'});
        await expect(page.getByRole('menu', {name: 'Document'})).toBeVisible();
        expect(await focused(page)).toBe('Undo');
        await page.getByRole('menuitem', {name: 'Copy'}).click();
        await expect(log(page)).toContainText('copy from the menu');
    });

    test('Shift+F10 opens a context menu at the focus, and Escape gives the focus back', async ({page}) => {
        await open(page);
        const box = page.getByTestId('menus-context-box');
        await box.focus();
        await page.keyboard.press('Shift+F10');
        const menu = page.getByRole('menu', {name: 'Context menu'});
        await expect(menu).toBeVisible();
        await page.keyboard.press('ArrowDown');
        expect(await focused(page)).toBe('Rename');
        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden();
        await expect(box).toBeFocused();
        await page.keyboard.press('Shift+F10');
        await page.keyboard.press('Enter');
        await expect(log(page)).toContainText('pin is true');
    });

    test('a narrow toolbar puts the rest in a More menu', async ({page}) => {
        await open(page);
        const toolbar = page.getByTestId('menus-narrow-toolbar');
        const more = toolbar.getByRole('button', {name: 'More'});
        await expect(more).toBeVisible();
        await expect(toolbar.getByRole('button', {name: 'Find…'})).toBeHidden();
        const box = await toolbar.boundingBox();
        const moreBox = await more.boundingBox();
        expect(moreBox.x + moreBox.width).toBeLessThanOrEqual(box.x + box.width);
        await more.focus();
        await page.keyboard.press('ArrowDown');
        await expect(page.getByRole('menu', {name: 'More'})).toBeVisible();
        await page.getByRole('menuitem', {name: 'Find…'}).click();
        await expect(log(page)).toContainText('find from the menu');
        // When the toolbar is wide, each item shows and the More button goes away
        await toolbar.evaluate(element => { Object.assign(element.parentElement.style, {maxWidth: 'none', width: '2400px'}); });
        await expect(more).toBeHidden();
        await expect(toolbar.getByRole('button', {name: 'Find…'})).toBeVisible();
    });

    test('a menu stays open after a focus scroll that came before it opened, and a later scroll closes it', async ({page}) => {
        await open(page);
        await expect(page.getByTestId('menus-narrow-toolbar').getByRole('button', {name: 'More'})).toBeVisible();
        const states = await page.getByTestId('menus-narrow-toolbar').evaluate(async (bar) => {
            const frames = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
            const more = [...bar.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'More');
            const scroller = document.getElementById('page');
            scroller.scrollTop = 0;
            await frames();
            // The focus scrolls the page, and the key opens the menu before the scroll event comes
            more.focus();
            more.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}));
            await frames();
            const afterFocus = more.getAttribute('aria-expanded');
            scroller.scrollTop -= 50;
            await frames();
            return [afterFocus, more.getAttribute('aria-expanded')];
        });
        expect(states).toEqual(['true', 'false']);
    });

    test('a menu button opens with the keyboard, and a split button runs its first action', async ({page}) => {
        await open(page);
        const button = page.getByTestId('menus-button').getByRole('button', {name: 'Export'});
        await button.focus();
        await page.keyboard.press('Enter');
        await expect(button).toHaveAttribute('aria-expanded', 'true');
        expect(await focused(page)).toBe('As PDF');
        await page.keyboard.press('End');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Space');
        await expect(log(page)).toContainText('send to the team');
        await expect(button).toBeFocused();
        await expect(button).toHaveAttribute('aria-expanded', 'false');
        await page.getByTestId('menus-split').getByRole('button', {name: 'Save', exact: true}).click();
        await expect(log(page)).toContainText('save from the button');
    });

    test('notices go in a live region, pause on hover, and an error stays', async ({page}) => {
        await open(page);
        await page.getByTestId('menus-notice-info').click();
        const info = page.getByRole('status').locator('.notice', {hasText: 'The file was moved.'});
        await expect(info).toBeVisible();
        await info.getByRole('button', {name: 'Undo'}).click();
        await expect(log(page)).toContainText('undo from the notice');
        await expect(log(page)).toContainText('info notice closed: action');
        await page.getByTestId('menus-notice-error').click();
        const error = page.getByRole('alert').locator('.notice');
        await expect(error).toContainText('Error: The file could not be saved.');
        await error.getByRole('button', {name: 'Dismiss'}).click();
        await expect(error).toHaveCount(0);
    });

    test('a menu bar in a shadow root works with the keyboard', async ({page}) => {
        await open(page);
        const shadowBar = page.getByTestId('menus-shadow-bar');
        await shadowBar.getByRole('menuitem', {name: 'Edit'}).focus();
        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowDown');
        expect(await focused(page)).toBe('Redo');
        await page.keyboard.press('ArrowLeft');
        expect(await focused(page)).toBe('Open…');
        await page.keyboard.press('Escape');
        await expect(shadowBar.getByRole('menuitem', {name: 'File'})).toBeFocused();
    });

    test('a submenu opens to the left in a right-to-left page', async ({page}) => {
        await open(page);
        await page.getByTestId('menus-editor-card').evaluate(element => element.setAttribute('dir', 'rtl'));
        await top(page, 'View').click();
        const zoom = page.getByRole('menuitem', {name: 'Zoom', exact: true});
        await zoom.focus();
        await page.keyboard.press('ArrowLeft');
        const submenu = page.getByRole('menu', {name: 'Zoom'});
        await expect(submenu).toBeVisible();
        const parent = await zoom.boundingBox();
        const child = await submenu.boundingBox();
        expect(child.x + child.width).toBeLessThanOrEqual(parent.x + 4);
    });

    test('gives each target at least 24 by 24 CSS pixels, and shows a 2px focus ring', async ({page}) => {
        await open(page);
        await top(page, 'File').click();
        const targets = page.locator('.zest-menu-bar .top, .zest-popup-menu:popover-open .item, .zest-tool-bar button:not([hidden]), .zest-menu-button button:not([hidden])');
        const boxes = await targets.evaluateAll(elements => elements.filter(element => !element.closest('.zest-popup-menu') || element.closest('.zest-popup-menu').matches(':popover-open')).map(element => {
            const rect = element.getBoundingClientRect();
            return {name: element.textContent, width: rect.width, height: rect.height};
        }));
        expect(boxes.length).toBeGreaterThan(20);
        for (const box of boxes) {
            expect(box.width, box.name).toBeGreaterThanOrEqual(24);
            expect(box.height, box.name).toBeGreaterThanOrEqual(24);
        }
        await page.keyboard.press('ArrowDown');
        const item = page.locator('.zest-popup-menu .item:focus');
        expect(await item.evaluate(element => getComputedStyle(element).outlineWidth)).toBe('2px');
    });

    test('the page keeps one menu element for each menu after a route change', async ({page}) => {
        await open(page);
        await page.getByTestId('menus-document').click({button: 'right'});
        await page.keyboard.press('Escape');
        await page.goto('/gallery/menu-item');
        await expect(page.getByTestId('section-menu-item')).toBeVisible();
        expect(await page.locator('body > popup-menu').count()).toBe(0);
    });

    for (const colorScheme of ['light', 'dark']) {
        test(`an open menu, submenu, tooltip, and notices meet the standard in ${colorScheme}`, async ({page}) => {
            test.setTimeout(60000);
            await page.emulateMedia({colorScheme});
            await open(page);
            await page.getByTestId('menus-notice-info').click();
            await page.getByTestId('menus-notice-error').click();
            await expect(page.getByRole('alert').locator('.notice')).toBeVisible();
            await page.getByTestId('menus-toolbar').getByRole('button', {name: 'Save'}).hover();
            await expect(page.getByRole('tooltip', {name: 'Save (Ctrl+S)'})).toBeVisible();
            await top(page, 'View').click();
            await page.getByRole('menuitem', {name: 'Zoom', exact: true}).hover();
            await expect(page.getByRole('menu', {name: 'Zoom'})).toBeVisible();
            await page.screenshot({path: test.info().outputPath('open.png')});
            const {violations} = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
            expect(violations.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(' ')).join(', ')}`)).toEqual([]);
        });
    }
});
