import { test, expect } from './fixtures.js';

const open = async (page) => {
    await page.goto('/gallery/date-time-picker');
    await expect(page.getByTestId('section-date-time-picker')).toBeVisible();
    return page.getByTestId('section-date-time-picker');
};
const heading = (page) => page.getByRole('heading', {name: /Date time picker/});

test.describe('opening and closing', () => {
    for (const [name, testId] of [['light DOM', 'picker-initial'], ['shadow DOM', 'picker-shadow']]) {
        test(`${name}: opens on a click, closes on Escape and on a click outside`, async ({page}) => {
            const card = (await open(page)).getByTestId(testId);
            const calendar = card.locator('.calendar');
            await expect(calendar).toBeHidden();
            await card.locator('input').click();
            await expect(calendar).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(calendar).toBeHidden();
            await expect(card.locator('input')).toBeFocused();
            await card.locator('input').click();
            await calendar.locator('.month-name').click();
            await expect(card.locator('.cells')).toBeVisible();
            await heading(page).click();
            await expect(card.locator('.picker')).toBeHidden();
        });

        test(`${name}: moves between months and selects a day`, async ({page}) => {
            const content = await open(page);
            const card = content.getByTestId(testId);
            await card.locator('input').click();
            const before = await card.locator('.month-name').textContent();
            await card.locator('.next-month').click();
            await expect(card.locator('.month-name')).not.toHaveText(before);
            await card.locator('.day:not(.other-month)[data-day="15"]').click();
            await expect(card.locator('.calendar')).toBeHidden();
            await expect(card.locator('input')).toHaveValue(/ 15, /);
            await expect(card.locator('input')).toBeFocused();
            await expect(content.getByTestId('picker-log')).toContainText('-15');
            await card.locator('input').click();
            await expect(card.locator('.selected')).toHaveText('15');
        });
    }

    test('opens from the button, with focus on the grid, and the button closes it', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-initial');
        await card.locator('.toggle').click();
        await expect(card.locator('.day[tabindex="0"]')).toBeFocused();
        await card.locator('.toggle').click();
        await expect(card.locator('.calendar')).toBeHidden();
    });

    test('closes when the focus goes to something outside', async ({page}) => {
        const content = await open(page);
        const card = content.getByTestId('picker-initial');
        await card.locator('input').click();
        await expect(card.locator('.calendar')).toBeVisible();
        await content.getByTestId('picker-data-element').locator('input').focus();
        await expect(card.locator('.calendar')).toBeHidden();
    });
});

test.describe('where the panel goes', () => {
    test('is not clipped by a box with overflow hidden', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-clipped');
        await card.locator('input').click();
        const day = card.locator('.day[data-date="2024-03-30"]');
        await expect(day).toBeVisible();
        // A click at this point reaches the day only if the day is really on top there
        await day.click();
        await expect(card.locator('input')).toHaveValue('Mar 30, 2024');
    });

    test('takes no space in the page', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-initial');
        const before = await card.boundingBox();
        await card.locator('input').click();
        await expect(card.locator('.calendar')).toBeVisible();
        expect((await card.boundingBox()).height).toEqual(before.height);
    });

    test('goes above the input when there is no space below, and stays in the viewport', async ({page}) => {
        await page.setViewportSize({width: 1000, height: 600});
        const card = (await open(page)).getByTestId('picker-initial');
        const input = card.locator('input');
        await input.evaluate((element) => {
            const scroller = document.getElementById('page');
            scroller.scrollTop += element.getBoundingClientRect().top - (window.innerHeight - 60);
        });
        await input.click();
        const box = await card.locator('.picker').boundingBox();
        const inputBox = await input.boundingBox();
        expect(box.y + box.height).toBeLessThanOrEqual(inputBox.y);
        expect(box.y).toBeGreaterThanOrEqual(0);
    });

    test('scrolls and does not cover the input when it fits on neither side', async ({page}) => {
        await page.setViewportSize({width: 1000, height: 420});
        const card = (await open(page)).getByTestId('picker-initial');
        const input = card.locator('input');
        await input.evaluate((element) => {
            const scroller = document.getElementById('page');
            scroller.scrollTop += element.getBoundingClientRect().top - 190;
        });
        await input.click();
        const panel = card.locator('.picker');
        const box = await panel.boundingBox();
        const inputBox = await input.boundingBox();
        expect(box.y >= inputBox.y + inputBox.height || box.y + box.height <= inputBox.y).toBe(true);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(420);
        expect(await panel.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
        // A person can scroll to the end, and the panel stays there
        await panel.evaluate((element) => { element.scrollTop = element.scrollHeight; });
        await expect.poll(() => panel.evaluate(element => Math.ceil(element.scrollTop + element.clientHeight) >= element.scrollHeight)).toBe(true);
        await page.waitForTimeout(100);
        expect(await panel.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    });

    test('follows the input when the page scrolls', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-initial');
        const input = card.locator('input');
        await input.click();
        await page.evaluate(() => { document.getElementById('page').scrollTop += 30; });
        await expect.poll(async () => {
            const panel = await card.locator('.picker').boundingBox();
            const field = await input.boundingBox();
            return Math.round(panel.y - (field.y + field.height));
        }).toEqual(4);
    });

    test('fits a phone', async ({page}) => {
        await page.setViewportSize({width: 340, height: 600});
        const card = (await open(page)).getByTestId('picker-datetime');
        await card.locator('input').click();
        const box = await card.locator('.picker').boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(340);
        const overflow = await page.evaluate(() => document.getElementById('page').scrollWidth - document.getElementById('page').clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });

    test('works in a modal dialog, and Escape closes only the panel', async ({page}) => {
        const content = await open(page);
        await content.getByTestId('picker-dialog-open').click();
        const dialog = content.getByTestId('picker-dialog');
        await dialog.locator('input').click();
        await dialog.locator('.day[data-date="2024-03-20"]').click();
        await expect(dialog.locator('input')).toHaveValue('Mar 20, 2024');
        await dialog.locator('input').click();
        await expect(dialog.locator('.calendar')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog.locator('.calendar')).toBeHidden();
        await expect(dialog).toBeVisible();
        await content.getByTestId('picker-dialog-close').click();
        await expect(dialog).toBeHidden();
    });
});

test.describe('the keyboard', () => {
    const focusedDate = (card) => card.locator('.day:focus').getAttribute('data-date');

    test('ArrowDown opens and goes to the grid, and the arrows, Home, End, and PageUp/Down move', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-initial');
        await card.locator('input').focus();
        await page.keyboard.press('ArrowDown');
        await expect(card.locator('.calendar')).toBeVisible();
        const steps = [
            ['ArrowRight', '2024-03-02'], ['ArrowDown', '2024-03-09'], ['ArrowLeft', '2024-03-08'], ['ArrowUp', '2024-03-01'],
            ['ArrowLeft', '2024-02-29'], ['Home', '2024-02-25'], ['End', '2024-03-02'], ['PageDown', '2024-04-02'],
            ['PageUp', '2024-03-02'], ['Shift+PageDown', '2025-03-02'], ['Shift+PageUp', '2024-03-02'],
        ];
        for (const [key, expected] of steps) {
            await page.keyboard.press(key);
            await expect.poll(() => focusedDate(card), key).toEqual(expected);
        }
        await expect(card.locator('.month-name')).toHaveText('March 2024');
    });

    test('Enter selects the focused day, and the focus goes back to the input', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-initial');
        await card.locator('input').focus();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');
        await expect(card.locator('input')).toHaveValue('Mar 2, 2024');
        await expect(card.locator('input')).toBeFocused();
    });

    test('moves in the grid of months', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-month');
        await card.locator('input').focus();
        await page.keyboard.press('ArrowDown');
        await expect(card.locator('.cell:focus')).toHaveAttribute('data-date', '2024-03');
        await page.keyboard.press('ArrowRight');
        await expect(card.locator('.cell:focus')).toHaveAttribute('data-date', '2024-04');
        await page.keyboard.press('ArrowDown');
        await expect(card.locator('.cell:focus')).toHaveAttribute('data-date', '2024-07');
        await page.keyboard.press('Space');
        await expect(card.locator('input')).toHaveValue('July 2024');
    });

    test('the arrows change direction for right to left', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-arabic');
        await card.locator('input').focus();
        await page.keyboard.press('ArrowDown');
        const start = await focusedDate(card);
        await page.keyboard.press('ArrowLeft');
        expect(await focusedDate(card)).not.toEqual(start);
        const left = new Date(await focusedDate(card));
        expect(left.getTime()).toBeGreaterThan(new Date(start).getTime());
    });

    test('previews a range from the keyboard', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-range');
        await card.locator('input').focus();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await expect(card.locator('.in-range-preview')).toHaveCount(3);
        await page.keyboard.press('Enter');
        await expect(card.locator('input')).toHaveValue('Mar 1, 2024 – Mar 3, 2024');
    });

    test('Tab reaches the select elements of the time, and focus stays on them when they change', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-time-seconds');
        await card.locator('input').focus();
        await page.keyboard.press('ArrowDown');
        const hour = card.locator('select.hour');
        await expect(hour).toBeFocused();
        await hour.selectOption('15');
        await expect(card.locator('select.hour')).toBeFocused();
        await expect(card.locator('input')).toHaveValue(/15:45:10/);
    });
});

test.describe('typing', () => {
    test('accepts a typed date on Tab, and puts back the old value for a bad one', async ({page}) => {
        const content = await open(page);
        const input = content.getByTestId('picker-initial').locator('input');
        await input.fill('7/4/2024');
        await input.press('Tab');
        await expect(input).toHaveValue('Jul 4, 2024');
        await input.fill('nonsense');
        await input.press('Tab');
        await expect(input).toHaveValue('Jul 4, 2024');
        await input.fill('');
        await input.press('Tab');
        await expect(input).toHaveValue('');
        await expect(content.getByTestId('picker-log')).toContainText('picker-initial: cleared');
    });

    test('accepts on Enter, with the panel open, and moves the panel to that month', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-initial');
        const input = card.locator('input');
        await input.click();
        await input.fill('tomorrow');
        await input.press('Enter');
        const tomorrow = new Date(Date.now() + 86400000);
        await expect(card.locator('.month-name')).toHaveText(new Intl.DateTimeFormat('en-US', {month: 'long', year: 'numeric'}).format(tomorrow));
    });

    test('accepts a time in each form', async ({page}) => {
        const input = (await open(page)).getByTestId('picker-time').locator('input');
        for (const [typed, shown] of [['3pm', /^3:00\sPM$/], ['1530', /^3:30\sPM$/], ['09:15', /^9:15\sAM$/]]) {
            await input.fill(typed);
            await input.press('Tab');
            await expect(input).toHaveValue(shown);
        }
    });

    test('refuses a typed time outside the steps and the limits', async ({page}) => {
        const input = (await open(page)).getByTestId('picker-time-limits').locator('input');
        await input.fill('10:30');
        await input.press('Tab');
        await expect(input).toHaveValue('10:30');
        for (const bad of ['10:15', '08:00', '18:00']) {
            await input.fill(bad);
            await input.press('Tab');
            await expect(input).toHaveValue('10:30');
        }
    });

    test('takes no typing with no-typing, and is still usable', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-no-typing');
        await expect(card.locator('input')).not.toBeEditable();
        await card.locator('input').click();
        await card.locator('.day[data-date="2024-03-20"]').click();
        await expect(card.locator('input')).toHaveValue('Mar 20, 2024');
    });
});

test.describe('modes', () => {
    for (const [testId, tag] of [['picker-datetime', 'light'], ['picker-datetime-shadow', 'shadow']]) {
        test(`date and time, ${tag}: selects both, and stays open until Done`, async ({page}) => {
            const content = await open(page);
            const card = content.getByTestId(testId);
            await card.locator('input').click();
            await card.locator('.day[data-date="2024-03-20"]').click();
            await expect(card.locator('.calendar')).toBeVisible();
            await card.locator('select.hour').selectOption({label: '3'});
            await card.locator('select.period').selectOption('pm');
            await expect(content.getByTestId('picker-log')).toContainText('2024-03-20T15:00');
            await card.locator('.done').click();
            await expect(card.locator('.calendar')).toBeHidden();
            await expect(card.locator('input')).toHaveValue(/Mar 20, 2024.*3:00/);
        });
    }

    test('time: the steps and the limits show in the select elements', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-time-limits');
        await card.locator('input').click();
        const hour = card.locator('select.hour');
        await expect(hour.locator('option[value="8"]')).toBeDisabled();
        await expect(hour.locator('option[value="9"]')).toBeEnabled();
        await expect(hour.locator('option[value="18"]')).toBeDisabled();
        expect(await card.locator('select.minute option').allTextContents()).toEqual(['--', '00', '30']);
    });

    test('time: a list and slots select and close', async ({page}) => {
        const content = await open(page);
        const list = content.getByTestId('picker-time-list');
        await list.locator('input').click();
        await list.locator('[data-time="14:30"]').click();
        await expect(list.locator('input')).toHaveValue('14:30');
        await expect(list.locator('.picker')).toBeHidden();
        const slots = content.getByTestId('picker-time-slots');
        await slots.locator('input').click();
        await expect(slots.locator('.slot')).toHaveCount(4);
        await slots.locator('[data-time="10:30"]').click();
        await expect(slots.locator('input')).toHaveValue('10:30');
    });

    test('month, week, and year', async ({page}) => {
        const content = await open(page);
        const month = content.getByTestId('picker-month');
        await month.locator('input').click();
        await month.locator('[data-date="2024-07"]').click();
        await expect(month.locator('input')).toHaveValue('July 2024');
        const week = content.getByTestId('picker-week');
        await week.locator('input').click();
        await week.locator('.day[data-date="2024-03-13"]').click();
        await expect(week.locator('input')).toHaveValue('2024-W11');
        await week.locator('input').click();
        await expect(week.locator('.day.selected')).toHaveCount(7);
        const year = content.getByTestId('picker-year');
        await year.locator('input').click();
        await year.locator('[data-date="2025"]').click();
        await expect(year.locator('input')).toHaveValue('2025');
    });

    test('goes from the days to a year and a month, and comes back', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-initial');
        await card.locator('input').click();
        await card.locator('.month-name').click();
        await card.locator('.month-name').click();
        await card.locator('[data-date="2026"]').click();
        await card.locator('[data-date="2026-11"]').click();
        await expect(card.locator('.month-name')).toHaveText('November 2026');
        await expect(card.locator('.day[tabindex="0"]')).toBeFocused();
    });
});

test.describe('selection', () => {
    test('a range on two months, with a preview on hover', async ({page}) => {
        const content = await open(page);
        const card = content.getByTestId('picker-range');
        await card.locator('input').click();
        await expect(card.locator('.calendar')).toHaveCount(2);
        await card.locator('.day[data-date="2024-03-28"]').click();
        await card.locator('.day[data-date="2024-04-03"]').hover();
        await expect(card.locator('.in-range-preview')).toHaveCount(7);
        await card.locator('.day[data-date="2024-04-03"]').click();
        await expect(card.locator('input')).toHaveValue('Mar 28, 2024 – Apr 3, 2024');
        await expect(content.getByTestId('picker-log')).toContainText('2024-03-28/2024-04-03');
        await card.locator('input').click();
        await expect(card.locator('.in-range')).toHaveCount(5);
    });

    test('a range refuses what its limits do not allow', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-range-limits');
        await card.locator('input').click();
        await card.locator('.day[data-date="2024-03-18"]').click();
        await card.locator('.day[data-date="2024-03-18"]').click();
        await expect(card.locator('.calendar')).toBeVisible();
        await card.locator('.day[data-date="2024-03-21"]').click();
        await expect(card.locator('.calendar')).toBeVisible();
        await card.locator('.day[data-date="2024-03-19"]').click();
        await expect(card.locator('input')).toHaveValue('Mar 18, 2024 – Mar 19, 2024');
    });

    test('multiple dates toggle', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-multiple');
        await card.locator('input').click();
        await card.locator('.day[data-date="2024-03-05"]').click();
        await card.locator('.day[data-date="2024-03-06"]').click();
        await card.locator('.day[data-date="2024-03-05"]').click();
        await expect(card.locator('.day.selected')).toHaveCount(1);
        await card.locator('.done').click();
        await expect(card.locator('input')).toHaveValue('Mar 6, 2024');
    });

    test('a range of date and time has a start and an end row', async ({page}) => {
        const content = await open(page);
        const card = content.getByTestId('picker-range-datetime');
        await card.locator('input').click();
        await card.locator('.day[data-date="2024-03-05"]').click();
        await card.locator('.day[data-date="2024-03-06"]').click();
        await card.locator('.time-row[data-row="1"] select.hour').selectOption('17');
        await expect(content.getByTestId('picker-log')).toContainText('2024-03-05T00:00/2024-03-06T17:00');
    });

    test('a day that is not available cannot be selected', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-limits');
        await card.locator('input').click();
        // force, because Playwright waits for an aria-disabled element to become enabled
        await card.locator('.day[data-date="2024-03-16"]').click({force: true});
        await card.locator('.day[data-date="2024-03-09"]').click({force: true});
        await expect(card.locator('input')).toHaveValue('');
        await expect(card.locator('.prev-month')).toBeHidden();
        await card.locator('.day[data-date="2024-03-15"]').click();
        await expect(card.locator('input')).toHaveValue('Mar 15, 2024');
    });

    test('presets from data', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-presets');
        await card.locator('input').click();
        await card.getByRole('button', {name: 'All of April'}).click();
        await expect(card.locator('input')).toHaveValue('Apr 1, 2024 – Apr 30, 2024');
    });

    test('a daily window limits the time', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-window');
        await card.locator('input').click();
        await card.locator('.day[data-date="2024-03-20"]').click();
        await expect(card.locator('input')).toHaveValue(/9:00|09:00/);
        await expect(card.locator('select.hour option[value="8"]')).toBeDisabled();
    });
});

test.describe('states', () => {
    test('disabled does not open, and read only shows its value', async ({page}) => {
        const content = await open(page);
        await expect(content.getByTestId('picker-disabled').locator('input')).toBeDisabled();
        await expect(content.getByTestId('picker-disabled').locator('.toggle')).toBeDisabled();
        const readOnly = content.getByTestId('picker-readonly');
        await expect(readOnly.locator('input')).toHaveValue('Mar 15, 2024');
        await readOnly.locator('input').click();
        await expect(readOnly.locator('.picker')).toBeHidden();
    });

    test('inline stays, with week numbers, and no input', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-inline');
        await expect(card.locator('.calendar')).toBeVisible();
        await expect(card.locator('input')).toBeHidden();
        await expect(card.locator('.week-number[role="rowheader"]').first()).toBeVisible();
        await card.locator('.day[data-date="2024-03-20"]').click();
        await expect(card.locator('.calendar')).toBeVisible();
        await expect(card.locator('.day[data-date="2024-03-20"]')).toHaveClass(/selected/);
    });
});

test.describe('locale', () => {
    test('German: names, 24 hours, Monday first', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-german');
        await card.locator('input').click();
        await expect(card.locator('.month-name')).toHaveText('März 2024');
        await expect(card.locator('.weekday').first()).toHaveText('Mo');
        await expect(card.locator('select.period')).toHaveCount(0);
        await expect(card.locator('.now')).toHaveText('Jetzt');
    });

    test('Japanese: reads back the long format that it writes', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-japanese');
        await card.locator('input').click();
        await card.locator('.day[data-date="2024-03-20"]').click();
        const input = card.locator('input');
        await expect(input).toHaveValue('2024年3月20日');
        await input.fill('2024年4月2日');
        await input.press('Tab');
        await expect(input).toHaveValue('2024年4月2日');
    });

    test('Arabic: its own digits, and the panel lines up on the right', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-arabic');
        await card.locator('input').click();
        await expect(card.locator('.day[data-date="2024-03-15"]')).toHaveText('١٥');
        // In right to left the input comes first, on the right
        const input = await card.locator('input').boundingBox();
        const panel = await card.locator('.picker').boundingBox();
        expect(Math.abs((panel.x + panel.width) - (input.x + input.width))).toBeLessThan(3);
    });

    test('ISO format', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-iso');
        await card.locator('input').click();
        await card.locator('.day[data-date="2024-03-20"]').click();
        await expect(card.locator('input')).toHaveValue('2024-03-20');
    });
});

// The value of a date must not move with the zone of the person who looks at it
for (const timezoneId of ['America/Los_Angeles', 'Pacific/Auckland', 'UTC']) {
    test.describe(`in ${timezoneId}`, () => {
        test.use({timezoneId});

        test('a date stays on its day', async ({page}) => {
            const content = await open(page);
            const card = content.getByTestId('picker-initial');
            await expect(card.locator('input')).toHaveAttribute('placeholder', 'Mar 15, 2024');
            await card.locator('input').click();
            await expect(card.locator('.month-name')).toHaveText('March 2024');
            await card.locator('.day[data-date="2024-03-31"]').click();
            await expect(content.getByTestId('picker-log')).toContainText('picker-initial: 2024-03-31');
            await expect(card.locator('input')).toHaveValue('Mar 31, 2024');
        });

        test('a fixed zone gives the same instant from each place', async ({page}) => {
            const content = await open(page);
            const element = content.getByTestId('picker-zone-element');
            await element.evaluate((picker) => { picker.value = '2024-03-15T09:00'; });
            expect(await element.evaluate(picker => picker.valueAsDate.toISOString())).toEqual('2024-03-15T00:00:00.000Z');
        });
    });
}

test.describe('in America/New_York, when the clocks change', () => {
    test.use({timezoneId: 'America/New_York'});

    test('a day with no 02:30 stays selectable, and the value keeps the day', async ({page}) => {
        const content = await open(page);
        const card = content.getByTestId('picker-datetime-shadow');
        await card.locator('input').click();
        await card.locator('.day[data-date="2024-03-10"]').click();
        await expect(content.getByTestId('picker-log')).toContainText('2024-03-10T00:00');
    });
});

test.describe('the time zone select', () => {
    test('keeps the wall clock, and moves the instant', async ({page}) => {
        const content = await open(page);
        const card = content.getByTestId('picker-zone-select');
        const element = content.getByTestId('picker-zone-select-element');
        await card.locator('input').click();
        await card.locator('.day[data-date="2024-03-20"]').click();
        await card.locator('.time-zone-select').selectOption('Asia/Tokyo');
        expect(await element.evaluate(picker => picker.value)).toEqual('2024-03-20T00:00');
        expect(await element.evaluate(picker => picker.valueAsDate.toISOString())).toEqual('2024-03-19T15:00:00.000Z');
    });
});

test.describe('data', () => {
    test('marks days from a registry, and loads the next month from the event', async ({page}) => {
        const content = await open(page);
        const card = content.getByTestId('picker-data');
        await expect(content.getByTestId('picker-data-log')).toContainText('register availability');
        await card.locator('input').click();
        const full = card.locator('.day[data-date="2024-03-10"]');
        await expect(full).toHaveClass(/booked/);
        await expect(full).toHaveAttribute('aria-disabled', 'true');
        await expect(full).toHaveAttribute('title', 'Full');
        await expect(card.locator('.day[data-date="2024-03-12"] .badge')).toHaveText('2');
        await expect(card.locator('.day[data-date="2024-04-10"]')).toHaveCount(0);
        await card.locator('.next-month').click();
        await expect(content.getByTestId('picker-data-log')).toContainText('load 2024-4');
        await expect(card.locator('.day[data-date="2024-04-10"]')).toHaveClass(/booked/);
    });

    test('an EventBroker hears the picker, from anywhere on the page', async ({page}) => {
        const content = await open(page);
        const card = content.getByTestId('picker-broker');
        await card.locator('input').fill('2024-03-20');
        await card.locator('input').press('Tab');
        await expect(content.getByTestId('picker-broker-log')).toHaveText('heard-by-broker: 2024-03-20\n');
    });
});

test.describe('forms', () => {
    test('submits its name and value', async ({page}) => {
        const content = await open(page);
        await content.getByTestId('picker-form-submit').click();
        await expect(content.getByTestId('picker-form-output')).toHaveText('{"appointment":"2024-03-15T09:00"}');
    });

    test('a required empty picker stops the submit, and reports on the input', async ({page}) => {
        const content = await open(page);
        const element = content.getByTestId('picker-form-element');
        await element.locator('input').fill('');
        await element.locator('input').press('Tab');
        await content.getByTestId('picker-form-submit').click();
        await expect(content.getByTestId('picker-form-output')).toHaveText('Not submitted');
        expect(await element.evaluate(picker => picker.validity.valueMissing)).toEqual(true);
        expect(await element.evaluate(picker => picker.checkValidity())).toEqual(false);
        expect(await element.evaluate(picker => picker.validationMessage)).toEqual('Select a value.');
        expect(await element.evaluate(picker => picker.matches(':invalid'))).toEqual(true);
        await expect(element.locator('input')).toBeFocused();
    });

    test('reset returns to the value attribute, and sends no event', async ({page}) => {
        const content = await open(page);
        const element = content.getByTestId('picker-form-element');
        await element.locator('input').fill('2030-01-01 10:00');
        await element.locator('input').press('Tab');
        await expect.poll(() => element.evaluate(picker => picker.value)).toEqual('2030-01-01T10:00');
        await content.getByTestId('picker-form-reset').click();
        expect(await element.evaluate(picker => picker.value)).toEqual('2024-03-15T09:00');
    });

    test('a label focuses the input, and names it', async ({page}) => {
        const content = await open(page);
        const form = content.getByTestId('picker-form');
        await form.locator('label').click();
        await expect(form.locator('input')).toBeFocused();
        await expect(form.locator('input')).toHaveAttribute('aria-label', 'Appointment');
    });

    test('Enter in the input submits the form when nothing has changed', async ({page}) => {
        const content = await open(page);
        const input = content.getByTestId('picker-form').locator('input');
        await input.press('Enter');
        await expect(content.getByTestId('picker-form-output')).toContainText('2024-03-15T09:00');
    });

    test('adds no tab stop of its own', async ({page}) => {
        const content = await open(page);
        const element = content.getByTestId('picker-form-element');
        await element.locator('input').focus();
        await page.keyboard.press('Tab');
        await expect(element.locator('.toggle')).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(element.locator('input')).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(page.locator('date-time-picker:focus')).toHaveCount(0);
    });

    test('a disabled fieldset disables it', async ({page}) => {
        const content = await open(page);
        const element = content.getByTestId('picker-fieldset-element');
        await content.getByTestId('picker-fieldset-toggle').click();
        await expect(element.locator('input')).toBeDisabled();
        await content.getByTestId('picker-fieldset-toggle').click();
        await expect(element.locator('input')).toBeEnabled();
    });
});

test.describe('accessibility', () => {
    test('the parts have the roles and the names', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-initial');
        await expect(card.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
        await card.getByRole('combobox').click();
        await expect(card.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
        await expect(card.getByRole('dialog')).toBeVisible();
        await expect(card.getByRole('grid')).toHaveAccessibleName('March 2024');
        await expect(card.getByRole('gridcell', {name: 'Friday, March 15, 2024'})).toBeVisible();
        await expect(card.getByRole('button', {name: 'Next month'})).toBeVisible();
        await expect(card.getByRole('columnheader', {name: 'Sunday'})).toBeVisible();
    });

    test('announces the month when it moves', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-initial');
        await card.locator('input').click();
        await card.locator('.next-month').click();
        await expect(card.locator('.live')).toHaveText('April 2024');
    });

    test('marks the selected day', async ({page}) => {
        const card = (await open(page)).getByTestId('picker-initial');
        await card.locator('input').click();
        await card.locator('.day[data-date="2024-03-20"]').click();
        await card.locator('input').click();
        await expect(card.locator('.day[data-date="2024-03-20"]')).toHaveAttribute('aria-selected', 'true');
    });
});
