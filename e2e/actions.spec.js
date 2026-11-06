import { test, expect } from './fixtures.js';

test.describe('actions', () => {
    test('a shortcut and a button run the same action, and a disabled action stops both', async ({page}) => {
        await page.goto('/gallery/actions');
        const count = page.getByTestId('actions-count');
        await page.getByTestId('actions-add').click();
        await expect(count).toHaveText('1');
        await page.getByTestId('actions-area').focus();
        await page.keyboard.press('ControlOrMeta+Shift+A');
        await expect(count).toHaveText('2');
        await expect(page.getByTestId('actions-log')).toContainText('add from actions-area');

        await page.getByTestId('actions-lock').click();
        await expect(page.getByTestId('actions-lock')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('actions-add')).toBeDisabled();
        await page.getByTestId('actions-area').focus();
        await page.keyboard.press('ControlOrMeta+Shift+A');
        await expect(count).toHaveText('2');
    });

    test('a group keeps one checked action', async ({page}) => {
        await page.goto('/gallery/actions');
        await expect(page.getByTestId('actions-size-medium')).toHaveAttribute('aria-pressed', 'true');
        await page.getByTestId('actions-size-large').click();
        await expect(page.getByTestId('actions-size-large')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('actions-size-medium')).toHaveAttribute('aria-pressed', 'false');
    });
});
