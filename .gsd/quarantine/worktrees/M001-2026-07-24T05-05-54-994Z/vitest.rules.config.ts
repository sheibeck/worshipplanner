import { defineConfig } from 'vitest/config'

// Separate config for security rules tests (run against Firestore emulator)
export default defineConfig({
  test: {
    include: ['src/rules.test.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
})
