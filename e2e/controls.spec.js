import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.js';

const open = async (page) => {
    await page.goto('/gallery/controls');
    await expect(page.getByTestId('section-controls')).toBeVisible();
};
const log = (page) => page.getByTestId('controls-log');
const css = (locator, property) => locator.evaluate((element, name) => getComputedStyle(element)[name], property);

test.describe('controls', () => {
    test('a push button counts clicks, and a toggle button stays pressed with the keyboard', async ({page}) => {
        await open(page);
        await page.getByTestId('button-default').click();
        await page.getByTestId('button-default').click();
        await expect(page.getByTestId('button-count')).toHaveText('Clicks: 2');
        const toggle = page.getByTestId('button-toggle').locator('button');
        await toggle.focus();
        await page.keyboard.press('Space');
        await expect(toggle).toHaveAttribute('aria-pressed', 'true');
        await expect(log(page)).toContainText('button-toggle change true');
        // Firefox shows the keyboard ring only after the focus moves with a key
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect(toggle).toBeFocused();
        expect(await css(toggle, 'outlineWidth')).toBe('2px');
        expect(await css(toggle, 'outlineStyle')).toBe('solid');
    });

    test('a check box and a switch change with a click on the label and with Space', async ({page}) => {
        await open(page);
        await page.getByTestId('check-plain').getByText('Send me email').click();
        await expect(log(page)).toContainText('check-plain change true');
        const wifi = page.getByTestId('switch-plain');
        await wifi.locator('input').focus();
        await page.keyboard.press('Space');
        await expect(wifi.locator('input')).toBeChecked();
        await expect(wifi.locator('.zest-state')).toHaveText('On');
        await page.getByTestId('check-shadow').getByText('In a shadow root').click();
        await expect(log(page)).toContainText('check-shadow change true');
    });

    test('a radio group has one tab stop, and the arrows select', async ({page}) => {
        await open(page);
        const group = page.getByTestId('radio-children');
        await page.getByTestId('check-shadow').locator('input').focus();
        await group.getByRole('radio', {name: 'Standard'}).focus();
        await page.keyboard.press('ArrowDown');
        await expect(group.getByRole('radio', {name: 'Express'})).toBeFocused();
        await expect(group.getByRole('radio', {name: 'Express'})).toHaveAttribute('aria-checked', 'true');
        // The disabled choice is skipped
        await page.keyboard.press('ArrowDown');
        await expect(group.getByRole('radio', {name: 'Pick up'})).toHaveAttribute('aria-checked', 'true');
        await page.keyboard.press('Tab');
        await expect(page.getByTestId('radio-options').getByRole('radio', {name: 'Small'})).toBeFocused();
        await page.getByTestId('radio-shadow').getByRole('radio', {name: 'Green'}).click();
        await expect(log(page)).toContainText('radio-shadow change Green');
    });

    test('a text field shows a problem after the user leaves it, and a search clears', async ({page}) => {
        await open(page);
        const email = page.getByTestId('text-email');
        const input = email.getByLabel('Email');
        await input.fill('not an email');
        await input.blur();
        await expect(input).toHaveAttribute('aria-invalid', 'true');
        await expect(email.locator('.zest-help')).toBeVisible();
        await input.fill('ada@example.com');
        await expect(input).not.toHaveAttribute('aria-invalid');
        const search = page.getByTestId('text-search').getByLabel('Search');
        await search.fill('menu');
        await page.getByTestId('text-search').getByRole('button', {name: 'Clear'}).click();
        await expect(search).toHaveValue('');
        await expect(search).toBeFocused();
        const password = page.getByTestId('text-password');
        await password.getByLabel('Password', {exact: true}).fill('secret12');
        await password.getByRole('button', {name: 'Show password'}).click();
        await expect(password.locator('input')).toHaveAttribute('type', 'text');
    });

    test('a text area counts the characters', async ({page}) => {
        await open(page);
        const area = page.getByTestId('area-count');
        await area.getByLabel('Comments').fill('Hello');
        await expect(area.locator('.zest-count')).toHaveText('5 of 120');
    });

    test('a spin box steps with the keys in its locale, and a button repeats while it is held', async ({page}) => {
        await open(page);
        const weight = page.getByRole('spinbutton', {name: 'Weight in kg, German format'});
        await weight.focus();
        await page.keyboard.press('ArrowUp');
        await expect(weight).toHaveValue('1.234,75');
        await expect(log(page)).toContainText('spin-weight change 1234.75');
        const quantity = page.getByTestId('spin-quantity');
        const up = quantity.locator('.zest-steps button').first();
        await up.scrollIntoViewIfNeeded();
        const box = await up.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        // Holding the button repeats the step. A busy CI worker runs the timers late, so wait for the steps.
        const value = () => quantity.locator('input').inputValue().then(Number);
        await page.mouse.down();
        await expect.poll(value).toBeGreaterThan(3);
        await page.mouse.up();
        // The release stops the repeat
        const released = await value();
        await page.waitForTimeout(300);
        expect(await value()).toBe(released);
        await quantity.locator('input').fill('99');
        await page.keyboard.press('Tab');
        await expect(quantity.locator('input')).toHaveValue('20');
    });

    test('a slider follows a drag and the keys', async ({page}) => {
        await open(page);
        const volume = page.getByTestId('slider-volume');
        const area = volume.locator('.zest-area');
        await area.scrollIntoViewIfNeeded();
        const box = await area.boundingBox();
        await page.mouse.move(box.x + 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, {steps: 5});
        await page.mouse.up();
        const thumb = page.getByRole('slider', {name: 'Volume'});
        await expect(thumb).toBeFocused();
        const value = Number(await thumb.getAttribute('aria-valuenow'));
        expect(value).toBeGreaterThan(70);
        expect(value).toBeLessThan(90);
        await page.keyboard.press('Home');
        await expect(thumb).toHaveAttribute('aria-valuenow', '0');
        await expect(volume.locator('.zest-value')).toHaveText('0 %');
        const rating = page.getByRole('slider', {name: 'Rating'});
        await rating.focus();
        await page.keyboard.press('ArrowRight');
        await expect(rating).toHaveAttribute('aria-valuenow', '4');
        await expect(log(page)).toContainText('slider-rating change 4');
    });

    test('a select-only combo box opens a list next to it, and selects with the keyboard', async ({page}) => {
        await open(page);
        const combo = page.getByTestId('combo-select').getByRole('combobox', {name: 'Fruit'});
        await combo.focus();
        await page.keyboard.press('ArrowDown');
        const list = page.getByTestId('combo-select').getByRole('listbox');
        await expect(list).toBeVisible();
        const comboBox = await combo.boundingBox();
        const listBox = await list.boundingBox();
        // Below the box, or above it when there is no room below
        const gap = Math.min(Math.abs(listBox.y - (comboBox.y + comboBox.height)), Math.abs(listBox.y + listBox.height - comboBox.y));
        expect(gap).toBeLessThan(8);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await expect(list).toBeHidden();
        await expect(combo).toHaveText('Banana');
        await expect(log(page)).toContainText('combo-select change Banana');
    });

    test('an editable combo box filters as the user types, and a click selects', async ({page}) => {
        await open(page);
        const host = page.getByTestId('combo-editable');
        const input = host.getByRole('combobox');
        await input.fill('pe');
        const options = host.getByRole('option');
        await expect(options).toHaveText(['Grape', 'Peach', 'Pear']);
        await options.nth(1).click();
        await expect(input).toHaveValue('Peach');
        await expect(host.getByRole('listbox')).toBeHidden();
        await page.getByTestId('combo-shadow').getByRole('combobox').click();
        await page.getByTestId('combo-shadow').getByRole('option', {name: 'Large', exact: true}).click();
        await expect(log(page)).toContainText('combo-shadow change l');
    });

    test('a list box selects many with Shift and the arrows', async ({page}) => {
        await open(page);
        const list = page.getByRole('listbox', {name: 'Many fruits'});
        await list.focus();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Space');
        await page.keyboard.press('Shift+ArrowDown');
        await page.keyboard.press('Shift+ArrowDown');
        await expect(list.locator('[aria-selected="true"]')).toHaveText(['Apricot', 'Banana', 'Blueberry']);
        await expect(log(page)).toContainText('list-multiple change ["Apricot","Banana","Blueberry"]');
    });

    test('a form gets each value, checks what is required, and resets', async ({page}) => {
        await open(page);
        const output = page.getByTestId('controls-form-output');
        await page.getByTestId('form-submit').click();
        await expect(output).toHaveText('Not sent yet.');
        await expect(page.getByTestId('form-name').locator('input')).toHaveAttribute('aria-invalid', 'true');
        await page.getByTestId('form-name').getByLabel('Your name').fill('Ada');
        await page.getByTestId('form-subscribe').getByText('Subscribe').click();
        await page.getByTestId('form-plan').getByRole('radio', {name: 'Team'}).click();
        await page.getByTestId('form-fruit').getByRole('combobox').click();
        await page.getByTestId('form-fruit').getByRole('option', {name: 'Mango'}).click();
        const toppings = page.getByTestId('form-toppings');
        await toppings.getByRole('option', {name: 'Cream'}).click();
        await toppings.getByRole('option', {name: 'Sprinkles'}).click();
        await page.getByTestId('form-message').getByLabel('Message').fill('Hi');
        await page.getByTestId('form-submit').click();
        const data = JSON.parse(await output.textContent());
        expect(data).toEqual({
            name: 'Ada', subscribe: 'yes', plan: 'Team', seats: '3', priority: '2', fruit: 'Mango',
            toppings: ['Cream', 'Sprinkles'], message: 'Hi',
        });
        await page.getByTestId('form-reset').click();
        await expect(output).toHaveText('Reset.');
        await expect(page.getByTestId('form-name').locator('input')).toHaveValue('');
        await expect(page.getByTestId('form-subscribe').locator('input')).not.toBeChecked();
        await expect(page.getByTestId('form-plan').getByRole('radio', {name: 'Team'})).toHaveAttribute('aria-checked', 'false');
        await expect(toppings.locator('[aria-selected="true"]')).toHaveCount(0);
    });

    // Makes a form from HTML at the end of the page, and counts its submit events
    const formFrom = async (page, html) => {
        await open(page);
        await page.evaluate((markup) => {
            const form = document.createElement('form');
            form.dataset.testid = 'enter-form';
            form.innerHTML = markup;
            window.submits = 0;
            form.addEventListener('submit', (e) => { e.preventDefault(); window.submits++; });
            document.body.append(form);
        }, html);
        return page.getByTestId('enter-form');
    };
    const submits = (page) => page.evaluate(() => window.submits);

    for (const prefix of ['', 'shadow-']) {
        test(`Enter in a ${prefix}text-field clicks the first submit ${prefix}push-button`, async ({page}) => {
            const form = await formFrom(page, `
                <${prefix}text-field label="User" name="user"></${prefix}text-field>
                <${prefix}text-field label="Password" type="password" name="password"></${prefix}text-field>
                <${prefix}push-button type="submit">Sign in</${prefix}push-button>`);
            await form.getByLabel('Password', {exact: true}).fill('secret');
            await form.getByLabel('Password', {exact: true}).press('Enter');
            await expect.poll(() => submits(page)).toBe(1);
            // As in a native field, a modifier key does not change it
            await form.getByLabel('User').press('Shift+Enter');
            await expect.poll(() => submits(page)).toBe(2);
        });
    }

    test('a disabled default button stops the implicit submission', async ({page}) => {
        const form = await formFrom(page, `
            <text-field label="User"></text-field>
            <shadow-text-field label="Code"></shadow-text-field>
            <push-button type="submit" disabled>Sign in</push-button>
            <push-button type="submit">Other</push-button>`);
        await form.getByLabel('User').press('Enter');
        await form.getByLabel('Code').press('Enter');
        await page.waitForTimeout(100);
        expect(await submits(page)).toBe(0);
    });

    test('Enter in a native input finds a submit button in a shadow root', async ({page}) => {
        const form = await formFrom(page, `
            <label>User <input name="user"></label>
            <label>Password <input name="password" type="password"></label>
            <shadow-push-button type="submit">Sign in</shadow-push-button>`);
        await form.getByLabel('Password', {exact: true}).press('Enter');
        await expect.poll(() => submits(page)).toBe(1);
    });

    test('the host names and describes the inner control, also in a shadow root', async ({page, browserName}) => {
        const form = await formFrom(page, `
            <p id="rule">At least 12 characters</p>
            <shadow-text-field label="Password" type="password" helper="Your new password" aria-describedby="rule"></shadow-text-field>
            <text-field label="Light" aria-describedby="rule"></text-field>
            <push-button aria-label="Remove row 3">Remove</push-button>
            <shadow-push-button aria-label="Remove row 4">Remove</shadow-push-button>`);
        await expect(form.getByRole('button', {name: 'Remove row 3'})).toHaveCount(1);
        await expect(form.getByRole('button', {name: 'Remove row 4'})).toHaveCount(1);
        await expect(form.getByLabel('Light')).toHaveAccessibleDescription('At least 12 characters');
        // In a shadow root, the field refers to the page element through ariaDescribedByElements.
        // Playwright computes descriptions without it, so read the accessibility tree of Chromium.
        test.skip(browserName !== 'chromium', 'The accessibility tree comes from the Chromium protocol');
        const cdp = await page.context().newCDPSession(page);
        await expect.poll(async () => {
            const {nodes} = await cdp.send('Accessibility.getFullAXTree');
            return nodes.find(node => node.name?.value === 'Password' && node.role?.value === 'textbox')?.description?.value;
        }).toBe('Your new password At least 12 characters');
    });

    test('the form restores its values when the user goes back to the page', async ({page}) => {
        await open(page);
        await page.getByTestId('form-name').getByLabel('Your name').fill('Grace');
        await page.getByTestId('form-plan').getByRole('radio', {name: 'Business'}).click();
        expect(await page.getByTestId('form-plan').evaluate(element => element.value)).toBe('Business');
    });

    test('each target is 24 by 24 CSS pixels or more', async ({page}) => {
        await open(page);
        const section = page.getByTestId('section-controls');
        const sizes = await section.evaluate((root) => {
            const found = [];
            const visit = (node) => {
                for (const element of node.querySelectorAll('*')) {
                    if (element.shadowRoot) { visit(element.shadowRoot); }
                    const target = element.matches('button, input:not([type="checkbox"]):not([role="switch"]), [role="radio"], [role="slider"], [role="option"], [role="combobox"], .zest-check-box, .zest-toggle-switch');
                    if (!target || !element.checkVisibility()) { continue; }
                    const rect = element.getBoundingClientRect();
                    found.push({name: `${element.localName}.${element.className} ${element.textContent.trim().slice(0, 20)}`, width: rect.width, height: rect.height});
                }
            };
            visit(root);
            return found;
        });
        expect(sizes.length).toBeGreaterThan(60);
        for (const size of sizes) {
            expect(size.width, size.name).toBeGreaterThanOrEqual(24);
            expect(size.height, size.name).toBeGreaterThanOrEqual(24);
        }
    });

    test('forced colors keep the selected state visible', async ({page}) => {
        await page.emulateMedia({forcedColors: 'active'});
        await open(page);
        const list = page.getByRole('listbox', {name: 'One fruit'});
        await list.getByRole('option', {name: 'Banana'}).click();
        const chosen = list.getByRole('option', {name: 'Banana'});
        const other = list.getByRole('option', {name: 'Apple'});
        expect(await css(chosen, 'backgroundColor')).not.toEqual(await css(other, 'backgroundColor'));
    });

    test('an open list, a pressed button, and a shown problem meet the standard', async ({page}) => {
        for (const colorScheme of ['light', 'dark']) {
            await page.emulateMedia({colorScheme});
            await open(page);
            await page.getByTestId('button-toggle').click();
            await page.getByTestId('form-submit').click();
            await page.getByTestId('text-email').getByLabel('Email').fill('x');
            await page.getByTestId('text-email').getByLabel('Email').blur();
            await page.getByTestId('combo-editable').getByRole('combobox').fill('a');
            await page.getByTestId('combo-editable').getByRole('combobox').press('ArrowDown');
            await expect(page.getByTestId('combo-editable').getByRole('listbox')).toBeVisible();
            const {violations} = await new AxeBuilder({page}).include('[data-testid="section-controls"]')
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
            expect(violations.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(' ')).join(', ')}`), colorScheme).toEqual([]);
        }
    });
});
