import { readdirSync } from 'fs';
import { resolve } from 'path';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.js';

const packageDirs = readdirSync(resolve(import.meta.dirname, '../packages'));
const STANDARD = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function violations(page) {
    const {violations: found} = await new AxeBuilder({page}).withTags(STANDARD).analyze();
    return found.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(' ')).join(', ')}`);
}

test.describe('each gallery page meets the standard', () => {
    for (const colorScheme of ['light', 'dark']) {
        for (const dir of packageDirs) {
            test(`${dir} in ${colorScheme}`, async ({page}) => {
                test.setTimeout(60000);
                await page.emulateMedia({colorScheme});
                await page.goto(`/gallery/${dir}`);
                await expect(page.getByTestId(`section-${dir}`)).toBeVisible();
                expect(await violations(page)).toEqual([]);
            });
        }
    }

    test('an open picker panel meets the standard', async ({page}) => {
        test.setTimeout(60000);
        await page.goto('/bookings');
        await page.locator('date-time-picker input').click();
        await expect(page.locator('.picker')).toBeVisible();
        expect(await violations(page)).toEqual([]);
    });
});

test.describe('each gallery page reflows', () => {
    for (const dir of packageDirs) {
        test(`${dir} fits 320 CSS pixels with no horizontal scroll`, async ({page}) => {
            await page.setViewportSize({width: 320, height: 700});
            await page.goto(`/gallery/${dir}`);
            await expect(page.getByTestId(`section-${dir}`)).toBeVisible();
            // A wide font, so that this does not pass only because of the fonts on this machine
            await page.addStyleTag({content: '* { font-family: monospace !important; letter-spacing: 0.05em; }'});
            const overflow = await page.evaluate(() => {
                const scroller = document.getElementById('page');
                return scroller.scrollWidth - scroller.clientWidth;
            });
            expect(overflow).toBeLessThanOrEqual(0);
        });
    }
});

const tokensPage = async (page) => {
    await page.goto('/gallery/design-tokens');
    await expect(page.getByTestId('section-design-tokens')).toBeVisible();
};
const css = (locator, property) => locator.evaluate((element, name) => getComputedStyle(element)[name], property);

test.describe('the design tokens', () => {
    test('give a control the default size, and each target is large enough', async ({page}) => {
        await tokensPage(page);
        const box = await page.getByTestId('tokens-light').locator('date-time-picker input').boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(40);
        expect(box.height).toBeLessThan(48);
        const small = await page.getByTestId('tokens-small-sample').locator('date-time-picker input').boundingBox();
        expect(small.height).toBeLessThan(box.height);
        expect(small.height).toBeGreaterThanOrEqual(24);
    });

    test('follow the color scheme of a part of the page', async ({page}) => {
        await tokensPage(page);
        const light = await css(page.getByTestId('tokens-light').locator('date-time-picker input'), 'backgroundColor');
        const dark = await css(page.getByTestId('tokens-dark').locator('date-time-picker input'), 'backgroundColor');
        expect(light).toEqual('rgb(255, 255, 255)');
        expect(dark).toEqual('rgb(16, 19, 22)');
    });

    test('change for one part of the page when a parent sets a token', async ({page}) => {
        await tokensPage(page);
        const sample = page.getByTestId('tokens-override-sample').locator('date-time-picker');
        const color = await sample.evaluate(element => getComputedStyle(element.querySelector('.dtp')).getPropertyValue('--_highlight'));
        expect(color.trim()).toEqual('#7a2e8e');
    });
});

test.describe('a user setting', () => {
    test('a keyboard user sees a 2px solid focus ring', async ({page}) => {
        await page.goto('/bookings');
        const input = page.locator('date-time-picker input');
        await input.focus();
        await page.keyboard.press('Tab');
        const toggle = page.locator('date-time-picker .toggle');
        await expect(toggle).toBeFocused();
        expect(await css(toggle, 'outlineStyle')).toEqual('solid');
        expect(await css(toggle, 'outlineWidth')).toEqual('2px');
    });

    test('reduced motion removes each transition, and other users get a short one', async ({page}) => {
        await page.emulateMedia({reducedMotion: 'reduce'});
        await page.goto('/bookings');
        const toggle = page.locator('date-time-picker .toggle');
        expect(await css(toggle, 'transitionDuration')).toMatch(/^0s/);
        await page.emulateMedia({reducedMotion: 'no-preference'});
        expect(await css(toggle, 'transitionDuration')).toMatch(/^0\.12s/);
    });

    test('more contrast makes the focus ring and the borders thicker', async ({page}) => {
        await page.emulateMedia({contrast: 'more'});
        await page.goto('/bookings');
        const input = page.locator('date-time-picker input');
        await input.focus();
        await page.keyboard.press('Tab');
        const toggle = page.locator('date-time-picker .toggle');
        expect(await css(toggle, 'outlineWidth')).toEqual('3px');
        expect(await css(input, 'borderTopWidth')).toEqual('2px');
    });

    test('forced colors keep the selected date visible', async ({page}) => {
        await page.emulateMedia({forcedColors: 'active'});
        await page.goto('/gallery/design-tokens');
        const sample = page.getByTestId('tokens-light').locator('date-time-picker');
        await sample.locator('input').click();
        const selected = sample.locator('.day.selected');
        await expect(selected).toBeVisible();
        const unselected = sample.locator('.day:not(.selected)').first();
        expect(await css(selected, 'backgroundColor')).not.toEqual(await css(unselected, 'backgroundColor'));
        expect(await css(selected, 'color')).not.toEqual(await css(selected, 'backgroundColor'));
    });
});

test.describe('shared styles', () => {
    test('each picker on a page shares one sheet, and a page style wins over the defaults', async ({page}) => {
        await page.goto('/gallery/design-tokens');
        const before = await page.evaluate(() => document.adoptedStyleSheets.length);
        const pickers = await page.locator('date-time-picker').count();
        expect(pickers).toBeGreaterThan(1);
        expect(before).toBeLessThan(pickers);
        expect(await page.locator('#page date-time-picker style').count()).toEqual(0);
        await page.addStyleTag({content: 'date-time-picker .toggle { min-width: 77px; }'});
        expect(await css(page.getByTestId('tokens-light').locator('.toggle'), 'minWidth')).toEqual('77px');
    });

    test('addStyles reaches a picker that is already on the page', async ({page}) => {
        await page.goto('/gallery/design-tokens');
        await page.evaluate(() => customElements.get('date-time-picker').addStyles('.dtp .toggle { min-width: 88px; }'));
        expect(await css(page.getByTestId('tokens-light').locator('.toggle'), 'minWidth')).toEqual('88px');
    });

    test('a shadow picker adopts the sheet in its own root, and has the open state', async ({page}) => {
        await page.goto('/gallery/date-time-picker');
        const host = page.locator('shadow-date-time-picker').first();
        expect(await host.evaluate(element => element.shadowRoot.adoptedStyleSheets.length)).toEqual(1);
        expect(await host.evaluate(element => element.matches(':state(open)'))).toBe(false);
        await host.evaluate(element => element.openPicker());
        expect(await host.evaluate(element => element.matches(':state(open)'))).toBe(true);
    });
});
