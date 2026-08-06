import { defineConfig } from 'vitest/config'

// Separate config for security rules tests (run against Firestore emulator)
export default defineConfig({
  test: {
    include: ['src/rules.test.ts', 'src/storage.rules.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    // Cross-service storage.rules -> firestore.exists() checks share the emulator's
    // Java rules-tools server process. Running rules.test.ts and storage.rules.test.ts
    // concurrently floods that shared process with simultaneous evaluation requests and
    // reliably crashes it (NullPointerException in Server.processRequestsFromInputStream),
    // producing spurious permission-denied failures in both files. Force sequential file
    // execution so only one rules test file talks to the emulator at a time.
    fileParallelism: false,
  },
})
