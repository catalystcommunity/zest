import { readdirSync } from 'fs';
import { resolve } from 'path';
import { test, expect } from './fixtures.js';

const packageDirs = readdirSync(resolve(import.meta.dirname, '../packages'));

const section = (page, id) => page.getByTestId(`section-${id}`);
const open = async (page, id) => {
    await page.goto(`/gallery/${id}`);
    await expect(section(page, id)).toBeVisible();
    return section(page, id);
};

test.describe('the gallery as a whole', () => {
    test('has a section for each package, and they all render on one page', async ({page}) => {
        await page.goto('/gallery');
        for (const dir of packageDirs) {
            await expect(section(page, dir), dir).toBeVisible();
        }
    });

    for (const dir of packageDirs) {
        test(`${dir} opens from a direct link, and each image in it loads`, async ({page}) => {
            const content = await open(page, dir);
            await expect(content.locator('.card').first()).toBeVisible();
            const images = page.locator('#page img');
            for (let i = 0; i < await images.count(); i++) {
                await expect.poll(() => images.nth(i).evaluate(img => img.naturalWidth), `image ${i}`).toBeGreaterThan(0);
            }
        });
    }
});

test.describe('base-components', () => {
    test('uses the default and override templates', async ({page}) => {
        const content = await open(page, 'base-components');
        // The default template of the base class is present, and its default styles hide it
        await expect(content.getByTestId('base-default').locator('.defbasecomp')).toBeHidden();
        await expect(content.getByTestId('base-default').locator('.defbasecomp')).toHaveCount(1);
        await expect(content.getByTestId('base-override').getByTestId('base-override-content')).toBeVisible();
        await expect(content.getByTestId('shadow-override').getByTestId('base-override-content')).toBeVisible();
    });

    test('applies the override styles to the host of a shadow root', async ({page}) => {
        const content = await open(page, 'base-components');
        const shadowHost = content.locator('gallery-shadow');
        const color = await shadowHost.evaluate(element => getComputedStyle(element).color);
        expect(color).toEqual('rgb(192, 57, 43)');
    });

    test('sees an observed attribute change', async ({page}) => {
        const content = await open(page, 'base-components');
        await content.getByTestId('observed-input').fill('new value');
        await expect(content.getByTestId('observed-output')).toHaveText('shown-text is: new value');
    });

    test('registers on connect and unregisters on disconnect, every time', async ({page}) => {
        const content = await open(page, 'base-components');
        const log = content.getByTestId('data-log');
        await content.getByTestId('data-add').click();
        await expect(content.getByTestId('data-holder')).toContainText('Registered as gallery-instance: register call 1');
        await expect(log).toHaveText('register gallery-instance with someData');
        await content.getByTestId('data-remove').click();
        await expect(log).toContainText('unregister gallery-instance');
        await content.getByTestId('data-add').click();
        await expect(content.getByTestId('data-holder')).toContainText('register call 2');
    });
});

test.describe('basic-data-registry', () => {
    test('adds and calls a function, and refuses a repeat and a bad value', async ({page}) => {
        const content = await open(page, 'basic-data-registry');
        const log = content.getByTestId('registry-log');
        await content.getByTestId('registry-add').click();
        await expect(log).toContainText('added sayHello');
        await content.getByTestId('registry-call').click();
        await expect(log).toContainText('hello world');
        await content.getByTestId('registry-add').click();
        await expect(log).toContainText('already registered');
        await content.getByTestId('registry-bad').click();
        await expect(log).toContainText('not a function');
    });
});

test.describe('basic-data-service', () => {
    test('shows one value to each reader', async ({page}) => {
        const content = await open(page, 'basic-data-service');
        await content.getByTestId('service-increment').click();
        await content.getByTestId('service-increment').click();
        await expect(content.getByTestId('service-reader-a')).toHaveText('Reader A: 2');
        await expect(content.getByTestId('service-reader-b')).toHaveText('Reader B: 2');
    });
});

test.describe('event-broker', () => {
    test('delivers to each subscriber, once, until it unsubscribes', async ({page}) => {
        const content = await open(page, 'event-broker');
        const log = content.getByTestId('broker-log');
        const stats = content.getByTestId('broker-stats');
        await content.getByTestId('broker-sub-a').click();
        await content.getByTestId('broker-sub-a').click();
        await content.getByTestId('broker-sub-b').click();
        await expect(stats).toHaveText('count 2, added 3, removed 1');
        await content.getByTestId('broker-fire').click();
        await expect(log).toHaveText('A heard gallery-event: 1\nB heard gallery-event: 1\n');
        await content.getByTestId('broker-unsub-a').click();
        await content.getByTestId('broker-fire').click();
        await expect(log).toContainText('B heard gallery-event: 2');
        await expect(log).not.toContainText('A heard gallery-event: 2');
        await content.getByTestId('broker-cleanup').click();
        await expect(stats).toHaveText('count 0, added 3, removed 3');
        await content.getByTestId('broker-unsub-a').click();
        await expect(log).toContainText('unsubscribe A: false');
    });
});

test.describe('menu-gutter', () => {
    test('renders the override template in the light DOM and in a shadow root', async ({page}) => {
        const content = await open(page, 'menu-gutter');
        await expect(content.getByTestId('gutter-light').getByTestId('gutter-override-content')).toBeVisible();
        await expect(content.getByTestId('gutter-shadow').getByTestId('gutter-override-content')).toBeVisible();
        const display = await content.locator('menu-gutter').evaluate(element => getComputedStyle(element).display);
        expect(display).toEqual('flex');
        const shadowDisplay = await content.locator('shadow-menu-gutter').evaluate(element => getComputedStyle(element).display);
        expect(shadowDisplay).toEqual('flex');
    });
});

test.describe('menu-item', () => {
    test('renders a link, an icon, and text', async ({page}) => {
        const content = await open(page, 'menu-item');
        const card = content.getByTestId('item-link');
        await expect(card.locator('a')).toHaveAttribute('href', '/gallery/menu-item#linked');
        await expect(card.locator('img')).toHaveAttribute('alt', 'Icon for Linked item');
        await expect(card.locator('.display')).toHaveText('Linked item');
    });

    test('shows text that looks like HTML as text', async ({page}) => {
        const content = await open(page, 'menu-item');
        const card = content.getByTestId('item-html');
        await expect(card.locator('.display')).toHaveText('<b>not bold</b>');
        await expect(card.locator('b')).toHaveCount(0);
    });

    test('renders in a shadow root', async ({page}) => {
        const content = await open(page, 'menu-item');
        const hasShadowLink = await content.locator('shadow-menu-item').evaluate(element => element.shadowRoot.querySelector('a') !== null);
        expect(hasShadowLink).toEqual(true);
    });

    test('renders again when an attribute changes', async ({page}) => {
        const content = await open(page, 'menu-item');
        await content.getByTestId('item-live-input').fill('Changed');
        await expect(content.getByTestId('item-live-element').locator('.display')).toHaveText('Changed');
    });
});

test.describe('menu-logo', () => {
    test('renders an image, text, a link, and a shadow root', async ({page}) => {
        const content = await open(page, 'menu-logo');
        await expect(content.getByTestId('logo-image').locator('img')).toHaveAttribute('alt', 'Catalyst Squad');
        await expect(content.getByTestId('logo-text').locator('.logoText')).toHaveText('Zest');
        await expect(content.getByTestId('logo-link').locator('a')).toHaveAttribute('href', '/');
        await expect(content.getByTestId('logo-shadow').locator('.logoText')).toHaveText('Shadow logo');
    });
});

test.describe('simple-router', () => {
    test('changePage routes and gives the key value pairs', async ({page}) => {
        const content = await open(page, 'simple-router');
        await content.getByTestId('router-push').click();
        await expect(page).toHaveURL(/\/gallery\/simple-router\/userid\/17\/address\/12$/);
        await expect(content.getByTestId('router-log')).toContainText('route pushstate /gallery/simple-router/userid/17/address/12');
        await expect(content.getByTestId('router-pairs')).toHaveText('[["userid","17"],["address","12"]]');
    });

    test('the back button routes one time, with popstate', async ({page}) => {
        const content = await open(page, 'simple-router');
        await content.getByTestId('router-push').click();
        await content.getByTestId('router-back').click();
        await expect(page).toHaveURL(/\/gallery\/simple-router$/);
        await expect(content.getByTestId('router-log')).toContainText('route popstate /gallery/simple-router');
        const popCount = await content.getByTestId('router-log').evaluate(element => element.textContent.match(/route popstate/g).length);
        expect(popCount).toEqual(1);
    });

    test('a hash change routes one time, in a real browser', async ({page}) => {
        const content = await open(page, 'simple-router');
        const log = content.getByTestId('router-log');
        await content.getByTestId('router-hash').click();
        await expect(log).toContainText('#hash-');
        // Let a late hashchange arrive, if there is one
        await page.evaluate(() => new Promise(done => setTimeout(done, 100)));
        const lines = (await log.textContent()).trim().split('\n');
        expect(lines.filter(line => line.includes('#hash-')).length).toEqual(1);
    });

    test('a plain link routes with no page load', async ({page}) => {
        const content = await open(page, 'simple-router');
        await page.evaluate(() => { window.noReloadMark = true; });
        await content.getByTestId('router-link').click();
        await expect(page).toHaveURL(/\/gallery\/simple-router\/from\/link$/);
        expect(await page.evaluate(() => window.noReloadMark)).toEqual(true);
    });

    test('matches whole path segments, and equivalents, with a fake location', async ({page}) => {
        const content = await open(page, 'simple-router');
        const log = content.getByTestId('router-isolated-log');
        await content.getByTestId('router-iso-home').click();
        await expect(log).toContainText('home route for /home/more');
        await content.getByTestId('router-iso-partial').click();
        await expect(log).toContainText('default route for /homepage');
        await content.getByTestId('router-iso-equiv').click();
        await expect(log).toContainText('home route for /home');
    });
});

test.describe('two-tier-menu', () => {
    for (const [name, testId] of [['light DOM', 'menu-light'], ['shadow DOM', 'menu-shadow']]) {
        test(`${name}: renders a logo, sections, items, and a gutter, with the default styles`, async ({page}) => {
            const content = await open(page, 'two-tier-menu');
            const card = content.getByTestId(testId);
            await expect(card.locator('.logoText')).toHaveText('Menu');
            await expect(card.locator('menu-item.section-header')).toHaveCount(2);
            await expect(card.locator('menu-item.item')).toHaveCount(3);
            await expect(card.getByTestId('gutter-override-content')).toBeVisible();
            await expect(card.locator('menu-item.section-header a').first()).toHaveAttribute('href', /first$/);
            const background = await card.locator('two-tier-menu, shadow-two-tier-menu').evaluate(element => getComputedStyle(element).backgroundColor);
            expect(background).toEqual('rgb(52, 73, 94)');
            const items = await card.locator('.items').evaluate(element => getComputedStyle(element).display);
            expect(items).toEqual('flex');
            // The menu fills its box, and the box does not grow past its own height
            const boxes = await card.locator('.menu-box').evaluate(box => [box.clientHeight, box.firstElementChild.offsetHeight]);
            expect(boxes[1]).toEqual(boxes[0]);
        });

        test(`${name}: keeps each child inside the bounds of the menu`, async ({page}) => {
            const content = await open(page, 'two-tier-menu');
            const card = content.getByTestId(testId);
            const host = await card.locator('two-tier-menu, shadow-two-tier-menu').boundingBox();
            for (const child of await card.locator('menu-logo, menu-item, menu-gutter').all()) {
                const box = await child.boundingBox();
                expect(box.x).toBeGreaterThanOrEqual(host.x);
                expect(box.x + box.width).toBeLessThanOrEqual(host.x + host.width);
                expect(box.y + box.height).toBeLessThanOrEqual(host.y + host.height);
            }
        });

        test(`${name}: shows the gutter text in a color that the menu sets`, async ({page}) => {
            const content = await open(page, 'two-tier-menu');
            const text = content.getByTestId(testId).getByTestId('gutter-override-content');
            expect(await text.evaluate(element => getComputedStyle(element).color)).toEqual('rgb(255, 255, 255)');
        });
    }

    test('unregisters when it is removed, and registers again when it comes back', async ({page}) => {
        const content = await open(page, 'two-tier-menu');
        const log = content.getByTestId('menu-log');
        await expect(log).toContainText('register light-menu');
        await content.getByTestId('menu-remove').click();
        await expect(log).toContainText('unregister light-menu');
        await content.getByTestId('menu-add').click();
        await expect(content.getByTestId('menu-light').locator('menu-item.item')).toHaveCount(3);
    });

    test('keeps its light DOM styles out of the rest of the page', async ({page}) => {
        await open(page, 'two-tier-menu');
        const display = await page.evaluate(() => {
            const outside = document.createElement('div');
            outside.className = 'items';
            document.body.append(outside);
            const value = getComputedStyle(outside).display;
            outside.remove();
            return value;
        });
        expect(display).toEqual('block');
    });
});
