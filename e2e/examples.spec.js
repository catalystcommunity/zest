import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.js';

const EXAMPLES = ['desktop', 'spreadsheet', 'scale-lab'];
const STANDARD = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.describe('the examples', () => {
    test('the list links to each example, and the menu has them', async ({page}) => {
        await page.goto('/examples');
        for (const id of EXAMPLES) {
            await expect(page.locator(`#page a[href="/examples/${id}"]`)).toBeVisible();
        }
        await page.locator('#page a[href="/examples/scale-lab"]').click();
        await expect(page.getByTestId('example-scale-lab')).toBeVisible();
        await expect(page).toHaveURL(/\/examples\/scale-lab$/);
    });

    for (const id of EXAMPLES) {
        for (const colorScheme of ['light', 'dark']) {
            test(`${id} meets the standard in ${colorScheme}`, async ({page}) => {
                test.setTimeout(60000);
                await page.emulateMedia({colorScheme});
                await page.goto(`/examples/${id}`);
                await expect(page.getByTestId(`example-${id}`)).toBeVisible();
                const {violations} = await new AxeBuilder({page}).withTags(STANDARD).analyze();
                expect(violations.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(' ')).join(', ')}`)).toEqual([]);
            });
        }

        test(`${id} fits 320 CSS pixels with no horizontal scroll`, async ({page}) => {
            await page.setViewportSize({width: 320, height: 700});
            await page.goto(`/examples/${id}`);
            await expect(page.getByTestId(`example-${id}`)).toBeVisible();
            await page.addStyleTag({content: '* { font-family: monospace !important; letter-spacing: 0.05em; }'});
            const overflow = await page.evaluate(() => {
                const scroller = document.getElementById('page');
                return scroller.scrollWidth - scroller.clientWidth;
            });
            expect(overflow).toBeLessThanOrEqual(0);
        });
    }
});
