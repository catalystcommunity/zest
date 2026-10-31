import { test as base, expect } from '@playwright/test';

// Each test fails on an uncaught exception, a console error, or a request that fails,
// because a broken component often shows nothing else.
export const test = base.extend({
    page: async ({page}, use) => {
        const problems = [];
        page.on('pageerror', error => problems.push(`uncaught: ${error.message}`));
        page.on('console', message => {
            if (message.type() === 'error') { problems.push(`console: ${message.text()}`); }
        });
        page.on('response', response => {
            if (response.status() >= 400) { problems.push(`${response.status()}: ${response.url()}`); }
        });
        await use(page);
        expect(problems).toEqual([]);
    },
});

export { expect };
