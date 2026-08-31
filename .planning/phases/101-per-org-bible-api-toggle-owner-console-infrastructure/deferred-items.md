# Deferred Items — Phase 101 Plan 01

Out-of-scope discoveries surfaced while running the full app test suite gate
(`npx vitest run`) during 101-01 execution. Logged, not fixed — neither file
was touched by this plan's changes (`src/types/organization.ts`,
`functions/src/orgProvisioning.ts`, `functions/src/index.ts`,
`functions/src/orgProvisioning.test.ts`, `firestore.rules`,
`src/rules.test.ts`).

## src/stores/appConfig.test.ts — pre-existing baseline drift

**Test:** `useAppConfigStore > saveField > calls setDoc exactly once with the
dot-path payload, email, serverTimestamp, and merge:true`

**Failure:** asserts `setDoc` is called with a flat dot-path key
(`'retention.mediaDays': 45`), but the actual call now passes a nested object
(`{ retention: { mediaDays: 45 } }`).

**Root cause:** commit `b365a1b9` ("fix: appConfig saveField wrote a literal
dotted key, never persisted (Owner Console toggles)") changed
`appConfig.ts::saveField`'s write shape but did not update this test's
expectation to match. Pre-dates this plan (101-01) and is unrelated to the
Bible API toggle work.

**Impact:** CLAUDE.md's documented baseline ("A bare `npx vitest run` should
show exactly one failing file" — `src/storage.rules.test.ts`) is currently
stale; a bare run shows 2 failing files. This plan does not fix it (out of
scope per the Scope Boundary rule) — flagging for the next phase/plan that
touches `appConfig.ts` or for a dedicated fix.

## src/storage.rules.test.ts — documented baseline (not a regression)

24-25 timeouts, all in the media-path/`allow` cases — matches CLAUDE.md's
documented Storage-emulator cross-service limitation
(`firestore.exists()` is inert in the Storage emulator). Not a regression;
no Storage emulator was running during this plan's verification.
