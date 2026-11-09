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
    .filter({has: calendar.page().locator(':scope > .zest-cell-label', {hasText: new RegExp(`^${label}$`)})});

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
        const lunch = week.locator('.zest-item[data-id="lunch"] .zest-item-main');
        await week.scrollIntoViewIfNeeded();
        // The pointer takes the item just below its middle, in the 12:30 slot, and leaves it 90 minutes later.
        // The middle itself is on the line between two slots, and Firefox gives whole pixels.
        await drag(page, lunch, slot(week, 'Friday, March 13, 2026, 2:00 PM'), {fromOffset: (box) => [box.x + box.width / 2, box.y + box.height / 2 + 8]});
        await expect(log(page)).toContainText('calendar-week-element move lunch to 2026-03-13T13:30:00.000Z to 2026-03-13T14:30:00.000Z');
        // The store sent the saved item to each calendar
        await expect(week.locator('.zest-item[data-id="lunch"]').locator('xpath=..').locator(':scope > .zest-cell-label')).toHaveText('Friday, March 13, 2026, 1:30 PM');
        await expect(week.locator('.zest-item[data-id="lunch"]')).not.toHaveClass(/\bzest-pending\b/);
        await expect(log(page)).not.toContainText('open lunch');
    });

    test('changes the end with a drag on the bottom edge', async ({page}) => {
        await open(page);
        const week = page.getByTestId('calendar-week-element');
        const handle = week.locator('.zest-item[data-id="lunch"] .zest-resize');
        await week.scrollIntoViewIfNeeded();
        // The edge is in the 12:30 slot, so a drag to the 1:30 slot adds one hour
        await drag(page, handle, slot(week, 'Friday, March 13, 2026, 1:30 PM'), {fromOffset: (box) => [box.x + box.width / 2, box.y + box.height - 2]});
        await expect(log(page)).toContainText('move lunch to 2026-03-13T12:00:00.000Z to 2026-03-13T14:00:00.000Z');
    });

    test('moves a span to the next week in the month with a drag', async ({page}) => {
        await open(page);
        const month = page.getByTestId('calendar-month-element');
        // The middle of the span is on March 11, so a drag to March 18 is one week
        await drag(page, month.locator('.zest-item[data-id="conference"] .zest-item-main'), month.locator('[data-key="day-2026-03-18"]'));
        await expect(log(page)).toContainText('move conference to 2026-03-17 to 2026-03-20');
    });

    test('selects time with a drag, and the application adds an item there', async ({page}) => {
        await open(page);
        const week = page.getByTestId('calendar-week-element');
        const from = slot(week, 'Monday, March 9, 2026, 10:00 AM');
        await week.scrollIntoViewIfNeeded();
        await drag(page, from, slot(week, 'Monday, March 9, 2026, 11:00 AM'));
        await expect(log(page)).toContainText('calendar-week-element slot 2026-03-09T10:00:00.000Z to 2026-03-09T11:30:00.000Z');
        await expect(week.locator('.zest-item', {hasText: 'New event'})).toBeVisible();
    });

    test('opens an item with a click, and a click with no movement does not move it', async ({page}) => {
        await open(page);
        const month = page.getByTestId('calendar-month-element');
        await month.locator('.zest-item[data-id="standup"] .zest-item-main').click();
        await expect(log(page)).toContainText('calendar-month-element open standup');
        await expect(log(page)).not.toContainText('move standup');
    });

    test('moves an item with two clicks and no drag', async ({page}) => {
        await open(page);
        const month = page.getByTestId('calendar-month-element');
        await month.locator('.zest-item[data-id="standup"] .zest-grip').click();
        await expect(month.locator('.zest-status')).toBeVisible();
        await month.locator('[data-key="day-2026-03-19"]').click({position: {x: 10, y: 60}});
        await expect(log(page)).toContainText('move standup to 2026-03-19T09:00:00.000Z to 2026-03-19T09:30:00.000Z');
    });

    test('moves an item in a shadow root with the keyboard', async ({page}) => {
        await open(page);
        const days = page.getByTestId('calendar-days-element');
        await days.locator('.zest-item[data-id="standup"] .zest-grip').focus();
        await page.keyboard.press('Space');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await expect(log(page)).toContainText('calendar-days-element move standup to 2026-03-14T09:30:00.000Z to 2026-03-14T10:00:00.000Z');
    });

    test('gives each target at least 24 by 24 CSS pixels', async ({page}) => {
        await open(page);
        const month = page.getByTestId('calendar-month-element');
        const targets = month.locator('.zest-item-main, .zest-grip, .zest-more, .zest-toolbar button');
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
        await month.locator('.zest-views button').last().focus();
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
        const scroller = week.locator('.zest-scroller');
        await scroller.evaluate(element => { element.scrollTop = 300; });
        await week.evaluate(element => { element.events = [...element.events]; });
        await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBe(300);
    });

    test('keeps the focus when the application sets back the view and the date from the range event', async ({page}) => {
        await open(page);
        const month = page.getByTestId('calendar-month-element');
        await month.evaluate(element => {
            element.addEventListener('calendar-range-changed', (e) => {
                element.view = e.detail.view;
                element.date = e.detail.date;
            });
        });
        await month.locator('[data-key="day-2026-03-31"]').focus();
        await page.keyboard.press('ArrowDown');
        await expect(month.locator('[data-unit]:focus')).toHaveAttribute('data-date', '2026-04-07');
        await expect(log(page)).toContainText('calendar-month-element range month 2026-03-29 to 2026-05-03');
        // A set of the same values, also after the event, keeps the same element in focus
        const same = await month.evaluate(async (element) => {
            const before = document.activeElement;
            element.view = 'month';
            element.date = '2026-04-07';
            element.date = element.range.date;
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            return document.activeElement === before;
        });
        expect(same).toBe(true);
        await page.keyboard.press('ArrowRight');
        await expect(month.locator('[data-unit]:focus')).toHaveAttribute('data-date', '2026-04-08');
    });

    test('shows the state of a tagged item with a sign that is not a color', async ({page}) => {
        await open(page);
        const week = page.getByTestId('calendar-week-element');
        const style = (locator, property) => locator.evaluate((element, name) => getComputedStyle(element)[name], property);
        const vendor = week.locator('.zest-item.zest-tag-invited[data-id="vendor"]');
        expect(await style(vendor, 'borderTopStyle')).toBe('dashed');
        expect(await style(vendor, 'borderInlineStartStyle')).toBe('solid');
        const retro = week.locator('.zest-item[data-id="retro"]');
        await expect(retro).toHaveAttribute('part', 'item item-declined');
        expect(await style(retro.locator('.zest-item-title'), 'textDecorationLine')).toBe('line-through');
        await expect(retro.locator('.zest-item-main')).toHaveAccessibleName(/^Declined, 3:00 PM Retro/);
        // The all-day row and a shadow root show the tags too
        await expect(week.locator('.zest-all-day-cell .zest-item.zest-tag-cancelled')).toBeVisible();
        const days = page.getByTestId('calendar-days-element');
        await expect(days.locator('[part~="item-cancelled"]')).toBeVisible();
        await expect(page.getByTestId('calendar-agenda-element').locator('.zest-item.zest-tag-tentative')).toBeVisible();
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
