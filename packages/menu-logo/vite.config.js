import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: 'src/index.js',
      name: 'MenuLogo',
      // the proper extensions will be added
      fileName: 'index',
      // Consumers import the source as an ES module, and these packages mix default and named exports
      formats: ['es'],
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    mockReset: true,
  },
})
