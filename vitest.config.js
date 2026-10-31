import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        projects: [
            // Each package has its own config, which holds its build and its test environment.
            'packages/*',
            // The repository-level checks: the umbrella package and the release tooling contract.
            {
                test: {
                    name: 'root',
                    globals: true,
                    environment: 'jsdom',
                    mockReset: true,
                    include: ['__tests__/**/*.spec.js'],
                },
            },
        ],
    },
})
