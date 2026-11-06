import { existsSync } from 'fs';
import { resolve } from 'path';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.js';
import { sitePaths } from '../demo/site-routes.js';

// The same build folder as playwright.config.js
const outDir = resolve(import.meta.dirname, '..', process.env.ZEST_E2E_PORT ? `dist-${process.env.ZEST_E2E_PORT}` : 'dist');
const STANDARD = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.describe('the demo site', () => {
    test('the home page explains Zest and links to the gallery and each example', async ({page}) => {
        await page.goto('/');
        await expect(page.getByRole('heading', {name: 'Zest', exact: true, level: 1})).toBeVisible();
        await expect(page).toHaveTitle('Zest: web components for applications');
        const home = page.getByTestId('site-home');
        for (const href of ['/gallery', '/examples/desktop', '/examples/spreadsheet', '/examples/scale-lab', '/gallery/controls']) {
            await expect(home.locator(`a[href="${href}"]`).first()).toBeVisible();
        }
        await home.getByRole('link', {name: 'Open the component gallery'}).click();
        await expect(page).toHaveURL(/\/gallery$/);
        await expect(page).toHaveTitle('Component gallery · Zest');
    });

    test('the live component converts in both directions, and its source is the file that runs', async ({page}) => {
        await page.goto('/');
        const converter = page.getByTestId('site-converter');
        const celsius = converter.getByRole('spinbutton', {name: 'Celsius'});
        const fahrenheit = converter.getByRole('spinbutton', {name: 'Fahrenheit'});
        await expect(fahrenheit).toHaveValue('68.0');
        await celsius.fill('100');
        await celsius.press('Enter');
        await expect(fahrenheit).toHaveValue('212.0');
        await fahrenheit.fill('32');
        await fahrenheit.press('Enter');
        await expect(celsius).toHaveValue('0.0');
        await expect(converter).toHaveAttribute('celsius', '0');

        await page.getByTestId('site-live').getByRole('tab', {name: 'Source'}).click();
        await expect(page.getByLabel('The source of the temperature converter')).toContainText('class TemperatureConverter extends BaseComponent');
    });

    test('the build has a page file at each path, because the site host has no fallback', async ({page}) => {
        const missing = sitePaths().filter(path => !existsSync(resolve(outDir, path, 'index.html')));
        expect(missing).toEqual([]);
        // Each link of the menu is one of those paths
        await page.goto('/');
        const links = await page.locator('#menu').evaluate(menu => {
            const found = new Set();
            const walk = (root) => {
                for (const node of root.querySelectorAll('*')) {
                    if (node instanceof HTMLAnchorElement) { found.add(new URL(node.href).pathname); }
                    if (node.shadowRoot) { walk(node.shadowRoot); }
                }
            };
            walk(menu.shadowRoot ?? menu);
            return [...found];
        });
        expect(links.length).toBeGreaterThan(20);
        const unknown = links.filter(path => path !== '/' && !sitePaths().includes(path.slice(1)));
        expect(unknown).toEqual([]);
    });

    test('a path with a trailing slash opens the same page, as the file server sends it', async ({page}) => {
        await page.goto('/examples/desktop/');
        await expect(page.getByTestId('example-desktop')).toBeVisible();
        await page.goto('/gallery/menu-item/');
        await expect(page.getByTestId('section-menu-item')).toBeVisible();
    });

    for (const colorScheme of ['light', 'dark']) {
        test(`the home page meets the standard in ${colorScheme}`, async ({page}) => {
            test.setTimeout(60000);
            await page.emulateMedia({colorScheme});
            await page.goto('/');
            await expect(page.getByTestId('site-converter').getByRole('spinbutton', {name: 'Celsius'})).toHaveValue('20.0');
            const {violations} = await new AxeBuilder({page}).withTags(STANDARD).analyze();
            expect(violations.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(' ')).join(', ')}`)).toEqual([]);
        });
    }

    test('the home page fits 320 CSS pixels with no horizontal scroll', async ({page}) => {
        await page.setViewportSize({width: 320, height: 700});
        await page.goto('/');
        await expect(page.getByTestId('site-home')).toBeVisible();
        await page.addStyleTag({content: '* { font-family: monospace !important; letter-spacing: 0.05em; }'});
        const overflow = await page.evaluate(() => {
            const scroller = document.getElementById('page');
            return scroller.scrollWidth - scroller.clientWidth;
        });
        expect(overflow).toBeLessThanOrEqual(0);
    });
});
