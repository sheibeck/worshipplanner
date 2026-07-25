import { defineConfig } from 'vitest/config'

// Cloud Functions run in Node, never a browser — unlike the root vitest.config.ts
// (jsdom, for Vue components), this suite always uses the node environment.
// testTimeout is generous because parsing real .pptx fixture decks (including the
// ~8.8MB docs/example.pptx integration fixture) is slower than a typical unit test.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
  },
})
