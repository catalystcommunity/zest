import { test, expect } from './fixtures.js';

const menu = (page) => page.locator('#menu');

test.describe('the demo application', () => {
    test('shows the menu and the home page', async ({page}) => {
        await page.goto('/');
        await expect(page.getByRole('heading', {name: 'Zest demo'})).toBeVisible();
        await expect(menu(page).locator('menu-logo img')).toBeVisible();
        await expect(menu(page).locator('menu-gutter')).toContainText('Catalyst Squad');
    });

    test('routes each menu link with no page load, and the back button returns', async ({page}) => {
        await page.goto('/');
        await page.evaluate(() => { window.noReloadMark = true; });
        await menu(page).getByRole('link', {name: 'Component Gallery'}).click();
        await expect(page).toHaveURL(/\/gallery$/);
        await expect(page.getByRole('heading', {name: 'Component gallery'})).toBeVisible();
        await menu(page).getByRole('link', {name: 'Menu item'}).click();
        await expect(page).toHaveURL(/\/gallery\/menu-item$/);
        await expect(page.getByTestId('section-menu-item')).toBeVisible();
        await expect(page.getByTestId('section-menu-logo')).toHaveCount(0);
        await page.goBack();
        await expect(page.getByRole('heading', {name: 'Component gallery'})).toBeVisible();
        await page.goBack();
        await expect(page.getByRole('heading', {name: 'Zest demo'})).toBeVisible();
        expect(await page.evaluate(() => window.noReloadMark)).toEqual(true);
    });

    test('opens /home as the same page as /', async ({page}) => {
        await page.goto('/home');
        await expect(page.getByRole('heading', {name: 'Zest demo'})).toBeVisible();
    });

    test('shows the not found page for an unknown path, and a prefix of a route is not a match', async ({page}) => {
        await page.goto('/no/such/page');
        await expect(page.getByRole('heading', {name: 'Page not found'})).toBeVisible();
        await page.goto('/galleryfoo');
        await expect(page.getByRole('heading', {name: 'Page not found'})).toBeVisible();
    });

    test('uses a picker in a real page flow', async ({page}) => {
        await page.goto('/bookings');
        const picker = page.getByTestId('booking-picker');
        await picker.locator('input').click();
        await picker.locator('.day:not(.other-month)[data-day="10"]').click();
        await expect(page.getByTestId('booking-output')).toContainText(/Booking on .* 10 /);
    });

    test('fits a phone width, with no horizontal scroll', async ({page}) => {
        await page.setViewportSize({width: 375, height: 700});
        await page.goto('/gallery/two-tier-menu');
        const overflow = await page.evaluate(() => document.getElementById('page').scrollWidth - document.getElementById('page').clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });
});
