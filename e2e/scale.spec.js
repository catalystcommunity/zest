import { test, expect } from './fixtures.js';
import { rate } from './timing.js';

// The budgets are wide, and timing.js widens them more in CI. They catch a change that makes Zest
// much slower, for example a render for each change in place of one for each frame.
// ZEST_BENCH=full runs the large sizes and prints each result.
const full = process.env.ZEST_BENCH === 'full';

const open = async (page) => {
    await page.goto('/examples/scale-lab');
    await expect(page.getByTestId('example-scale-lab')).toBeVisible();
};
const run = (page, name, options) => page.evaluate(([name, options]) => window.zestBench[name](options), [name, options]);
const report = (title, result) => {
    test.info().annotations.push({type: title, description: JSON.stringify(result)});
    if (full) { console.log(title, JSON.stringify(result)); }
};

test.describe('scale', () => {
    test.describe.configure({mode: 'serial'});

    test('components nest 1,000 levels deep, and an event reaches each level', async ({page}) => {
        await open(page);
        // Chromium stops the tab at about 1,750 levels of the flat tree, so 1,000 mixed levels (about
        // 1,500 flat levels) is near the limit of that browser
        for (const depth of full ? [10, 100, 250, 500, 1000] : [100, 1000]) {
            const result = await run(page, 'nesting', {depth, kind: 'mixed'});
            report(`nesting ${depth}`, result);
            expect(result.painted).toBe(depth);
            expect(result.heardPerEvent).toBe(depth);
            if (depth === 1000) {
                expect(result.connectMs).toBeLessThan(500);
                expect(result.firstRenderMs).toBeLessThan(500);
                expect(result.eventAllLevelsUs).toBeLessThan(5000);
                // A change deep in the tree paints only that component
                expect(result.deepUpdateMs).toBeLessThan(20);
            }
        }
    });

    test('10,000 components connect, paint, and change quickly', async ({page}) => {
        await open(page);
        for (const kind of ['light', 'shadow']) {
            const result = await run(page, 'breadth', {count: full ? 50000 : 10000, kind});
            report(`breadth ${kind}`, result);
            if (!full) {
                expect(result.connectMs).toBeLessThan(1500);
                expect(result.firstRenderMs).toBeLessThan(1500);
                expect(result.partialUpdateMs).toBeLessThan(50);
            }
        }
    });

    test('a form of 2,000 real controls opens and changes quickly', async ({page}) => {
        await open(page);
        const result = await run(page, 'widgets', {count: full ? 10000 : 2000});
        report('widgets', result);
        if (!full) {
            expect(result.connectMs + result.firstPaintMs).toBeLessThan(3000);
            expect(result.updateTenthMs).toBeLessThan(500);
        }
    });

    test('events bubble through shadow roots at a high rate', async ({page}) => {
        await open(page);
        const dom = await run(page, 'eventThroughput', {depth: 20, events: 20000});
        report('dom events', dom);
        expect(dom.heard).toBe(20000);
        // About 290,000 on a workstation, and 50,000 in the CI image
        expect(dom.eventsPerSecond).toBeGreaterThan(rate(20000));
        const broker = await run(page, 'brokerThroughput', {subscribers: 1000, events: 500});
        report('broker', broker);
        expect(broker.calls).toBe(500000);
        expect(broker.callsPerSecond).toBeGreaterThan(rate(500000));
    });

    test('a store write reaches only the component of its key', async ({page}) => {
        await open(page);
        const result = await run(page, 'storeFanOut', {components: full ? 20000 : 5000, writes: full ? 20000 : 5000});
        report('store fan out', result);
        expect(result.handlerCalls).toBe(result.writes);
        expect(result.painted).toBe(result.components);
        expect(result.usPerWrite).toBeLessThan(100);
    });

    test('a storm of changes paints one time for each frame', async ({page}) => {
        await open(page);
        const result = await run(page, 'renderStorm', {components: 500, tasks: 100});
        report('storm', result);
        // Each task paints each microtask component
        expect(result.microtask.rendersPerComponent).toBe(100);
        // A frame component paints at most one time in each frame, and shows the last value
        expect(result.frame.rendersPerComponent).toBeLessThanOrEqual(result.frame.frames + 1);
        expect(result.frame.rendersPerComponent).toBeLessThan(result.microtask.rendersPerComponent);
        expect(result.frame.shownValue).toBe(100);
    });

    test('the page runs each measurement from its buttons', async ({page}) => {
        test.setTimeout(60000);
        await open(page);
        await page.getByTestId('scale-depth').fill('200');
        await page.getByTestId('scale-run-nesting').click();
        await expect(page.getByTestId('scale-run-nesting-status')).toHaveText('Done.');
        await expect(page.getByTestId('scale-nesting-results').locator('tbody tr')).toHaveCount(1);
        await page.getByTestId('scale-run-storm').click();
        await expect(page.getByTestId('scale-run-storm-status')).toHaveText('Done.', {timeout: 30000});
        await expect(page.getByTestId('scale-storm-results').locator('tbody tr')).toHaveCount(2);
    });

    test('a click bubbles through a shadow root, and a level can handle it', async ({page}) => {
        await open(page);
        const log = page.getByTestId('scale-route-log');
        await page.getByTestId('scale-route-leaf').click();
        await expect(log.locator('li')).toHaveText([
            'inner panel hears the click. Its target is: button.',
            'shadow panel hears the click. Its target is: button.',
            'outer window hears the click. Its target is: button.',
        ]);
        await page.locator('route-shadow-panel button.inner').click();
        await expect(log.locator('li').nth(4)).toHaveText('outer window hears the click. Its target is: shadow panel.');
        await page.getByTestId('scale-route-handle').check();
        await log.evaluate(element => element.replaceChildren());
        await page.getByTestId('scale-route-leaf').click();
        await expect(log.locator('li')).toHaveCount(3);
        await expect(log.locator('li').last()).toHaveText('The shadow panel handles the click, so it goes no higher.');
    });
});
