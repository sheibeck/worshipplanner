import { defineConfig } from 'vitest/config'

// Cloud Run services run in Node, never a browser — same reasoning as
// functions/vitest.config.ts. Unlike that suite, this one has no large
// fixture decks: every render test mocks execFile and never invokes a
// real soffice/pdftoppm binary, so a shorter default timeout is fine.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 10000,
  },
})
