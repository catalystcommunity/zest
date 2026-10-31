import { defineConfig, devices } from '@playwright/test'

// Not the dev server's port, so these tests can run while a person runs `npm run dev`
const port = 4174;

// Chromium by default, which is what CI runs. `npm run test:e2e:browsers` runs all three.
const DEVICES = {chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari'};
const browsers = (process.env.ZEST_E2E_BROWSERS || 'chromium').split(',');

export default defineConfig({
    testDir: 'e2e',
    outputDir: 'test-results',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    reporter: process.env.CI ? 'list' : [['list'], ['html', {open: 'never', outputFolder: 'playwright-report'}]],
    use: {
        baseURL: `https://localhost:${port}`,
        // The server uses a self-signed certificate
        ignoreHTTPSErrors: true,
        trace: 'retain-on-failure',
    },
    projects: browsers.map(name => ({name, use: {...devices[DEVICES[name]]}})),
    webServer: {
        // The built application, so that a test also proves that the production build works
        command: `npm run build && npx vite preview --port ${port} --strictPort`,
        url: `https://localhost:${port}`,
        ignoreHTTPSErrors: true,
        reuseExistingServer: false,
        timeout: 120000,
        stdout: 'ignore',
    },
})
