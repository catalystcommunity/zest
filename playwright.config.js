import { defineConfig, devices } from '@playwright/test'

// Not the dev server's port, so these tests can run while a person runs `npm run dev`.
// ZEST_E2E_PORT gives a different port and build folder, so that two runs can work at the same time.
const port = Number(process.env.ZEST_E2E_PORT || 4174);
const suffix = process.env.ZEST_E2E_PORT ? `-${port}` : '';
const outDir = `../dist${suffix}`;

// Chromium by default, which is what CI runs. `npm run test:e2e:browsers` runs all three.
const DEVICES = {chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari'};
const browsers = (process.env.ZEST_E2E_BROWSERS || 'chromium').split(',');

export default defineConfig({
    testDir: 'e2e',
    outputDir: `test-results${suffix}`,
    fullyParallel: true,
    // The CI job has 4 CPUs and 4 GiB. With a worker for each CPU of the host, the large pages of
    // many workers at the same time used all of the memory, and Chromium stopped the tabs.
    workers: process.env.ZEST_E2E_WORKERS ? Number(process.env.ZEST_E2E_WORKERS) : (process.env.CI ? 3 : undefined),
    forbidOnly: !!process.env.CI,
    reporter: process.env.CI ? 'list' : [['list'], ['html', {open: 'never', outputFolder: `playwright-report${suffix}`}]],
    use: {
        baseURL: `https://localhost:${port}`,
        // The server uses a self-signed certificate
        ignoreHTTPSErrors: true,
        trace: 'retain-on-failure',
    },
    // A container often has a small /dev/shm, and Chromium stops a tab that needs more
    projects: browsers.map(name => ({name, use: {...devices[DEVICES[name]], ...(name === 'chromium' ? {launchOptions: {args: ['--disable-dev-shm-usage']}} : {})}})),
    webServer: {
        // The built application, so that a test also proves that the production build works
        command: `npx vite build --outDir ${outDir} && npx vite preview --outDir ${outDir} --port ${port} --strictPort`,
        url: `https://localhost:${port}`,
        ignoreHTTPSErrors: true,
        reuseExistingServer: false,
        timeout: 120000,
        stdout: 'ignore',
    },
})
