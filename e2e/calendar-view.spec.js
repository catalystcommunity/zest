import { test, expect } from './fixtures.js';

const open = async (page) => {
    // Tall enough that each slot of a drag is in the window
    await page.setViewportSize({width: 1280, height: 1400});
    await page.goto('/gallery/calendar-view');
    await expect(page.getByTestId('section-calendar-view')).toBeVisible();
};
const log = (page) => page.getByTestId('calendar-log');
// The slot of a time, in the week calendar of the gallery
const slot = (calendar, label) => calendar.locator('[data-unit="slot"]')
    .filter({has: calendar.page().locator(':scope > .cell-label', {hasText: new RegExp(`^${label}$`)})});

async function drag(page, from, to, {fromOffset, steps = 8} = {}) {
    const start = await from.boundingBox();
    const end = await to.boundingBox();
    const [x, y] = fromOffset ? fromOffset(start) : [start.x + start.width / 2, start.y + start.height / 2];
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, {steps});
    await page.mouse.up();
}

test.describe('calendar-view', () => {
    test('moves an item with a drag, and the application saves it', async ({page}) => {
        await open(page);
        const week = page.getByTestId('calendar-week-element');
        const lunch = week.locator('.item[data-id="lunch"] .item-main');
        await week.scrollIntoViewIfNeeded();
        // The pointer takes the item just below its middle, in the 12:30 slot, and leaves it 90 minutes later.
        // The middle itself is on the line between two slots, and Firefox gives whole pixels.
        await drag(page, lunch, slot(week, 'Friday, March 13, 2026, 2:00 PM'), {fromOffset: (box) => [box.x + box.width / 2, box.y + box.height / 2 + 8]});
        await expect(log(page)).toContainText('calendar-week-element move lunch to 2026-03-13T13:30:00.000Z to 2026-03-13T14:30:00.000Z');
        // The store sent the saved item to each calendar
        await expect(week.locator('.item[data-id="lunch"]').locator('xpath=..').locator(':scope > .cell-label')).toHaveText('Friday, March 13, 2026, 1:30 PM');
        await expect(week.locator('.item[data-id="lunch"]')).not.toHaveClass(/pending/);
        await expect(log(page)).not.toContainText('open lunch');
    });

    test('changes the end with a drag on the bottom edge', async ({page}) => {
        await open(page);
        const week = page.getByTestId('calendar-week-element');
        const handle = week.locator('.item[data-id="lunch"] .resize');
        await week.scrollIntoViewIfNeeded();
        // The edge is in the 12:30 slot, so a drag to the 1:30 slot adds one hour
        await drag(page, handle, slot(week, 'Friday, March 13, 2026, 1:30 PM'), {fromOffset: (box) => [box.x + box.width / 2, box.y + box.height - 2]});
        await expect(log(page)).toContainText('move lunch to 2026-03-13T12:00:00.000Z to 2026-03-13T14:00:00.000Z');
    });

    test('moves a span to the next week in the month with a drag', async ({page}) => {
        await open(page);
        const month = page.getByTestId('calendar-month-element');
        // The middle of the span is on March 11, so a drag to March 18 is one week
        await drag(page, month.locator('.item[data-id="conference"] .item-main'), month.locator('[data-key="day-2026-03-18"]'));
        await expect(log(page)).toContainText('move conference to 2026-03-17 to 2026-03-20');
    });

    test('selects time with a drag, and the application adds an item there', async ({page}) => {
        await open(page);
        const week = page.getByTestId('calendar-week-element');
        const from = slot(week, 'Monday, March 9, 2026, 10:00 AM');
        await week.scrollIntoViewIfNeeded();
        await drag(page, from, slot(week, 'Monday, March 9, 2026, 11:00 AM'));
        await expect(log(page)).toContainText('calendar-week-element slot 2026-03-09T10:00:00.000Z to 2026-03-09T11:30:00.000Z');
        await expect(week.locator('.item', {hasText: 'New event'})).toBeVisible();
    });

    test('opens an item with a click, and a click with no movement does not move it', async ({page}) => {
        await open(page);
        const month = page.getByTestId('calendar-month-element');
        await month.locator('.item[data-id="standup"] .item-main').click();
        await expect(log(page)).toContainText('calendar-month-element open standup');
        await expect(log(page)).not.toContainText('move standup');
    });

    test('moves an item with two clicks and no drag', async ({page}) => {
        await open(page);
        const month = page.getByTestId('calendar-month-element');
        await month.locator('.item[data-id="standup"] .grip').click();
        await expect(month.locator('.status')).toBeVisible();
        await month.locator('[data-key="day-2026-03-19"]').click({position: {x: 10, y: 60}});
        await expect(log(page)).toContainText('move standup to 2026-03-19T09:00:00.000Z to 2026-03-19T09:30:00.000Z');
    });

    test('moves an item in a shadow root with the keyboard', async ({page}) => {
        await open(page);
        const days = page.getByTestId('calendar-days-element');
        await days.locator('.item[data-id="standup"] .grip').focus();
        await page.keyboard.press('Space');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await expect(log(page)).toContainText('calendar-days-element move standup to 2026-03-14T09:30:00.000Z to 2026-03-14T10:00:00.000Z');
    });

    test('gives each target at least 24 by 24 CSS pixels', async ({page}) => {
        await open(page);
        const month = page.getByTestId('calendar-month-element');
        const targets = month.locator('.item-main, .grip, .more, .toolbar button');
        expect(await targets.count()).toBeGreaterThan(10);
        for (const box of await targets.evaluateAll(elements => elements.map(element => {
            const rect = element.getBoundingClientRect();
            return {name: element.className, width: rect.width, height: rect.height};
        }))) {
            expect(box.width, box.name).toBeGreaterThanOrEqual(24);
            expect(box.height, box.name).toBeGreaterThanOrEqual(24);
        }
    });

    test('shows a 2px focus ring on the day that has the keyboard', async ({page}) => {
        await open(page);
        const month = page.getByTestId('calendar-month-element');
        await month.locator('.views button').last().focus();
        await page.keyboard.press('Tab');
        const focused = month.locator('[data-unit]:focus');
        await expect(focused).toHaveAttribute('data-date', '2026-03-13');
        expect(await focused.evaluate(element => getComputedStyle(element).outlineWidth)).toBe('2px');
        await page.keyboard.press('ArrowDown');
        await expect(month.locator('[data-unit]:focus')).toHaveAttribute('data-date', '2026-03-20');
    });

    test('keeps the scroll position of the time grid when new items come', async ({page}) => {
        await open(page);
        const week = page.getByTestId('calendar-week-element');
        const scroller = week.locator('.scroller');
        await scroller.evaluate(element => { element.scrollTop = 300; });
        await week.evaluate(element => { element.events = [...element.events]; });
        await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBe(300);
    });
});

test.describe('date-model', () => {
    test('reads what a person types, and writes it in each locale', async ({page}) => {
        await page.goto('/gallery/date-model');
        const input = page.getByTestId('date-model-input');
        await input.fill('tomorrow');
        await expect(page.getByTestId('date-model-output')).toContainText('en-US: March 14, 2026');
        await expect(page.getByTestId('date-model-output')).toContainText('de-DE: 14. März 2026');
        await input.fill('no date here');
        await expect(page.getByTestId('date-model-output')).toHaveText('This text is not a date.');
        await expect(page.getByTestId('date-model-week-text')).toHaveText('The week of 2026-03-13 starts on 2026-03-09.');
    });
});
