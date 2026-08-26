---
phase: 84-last-used-date-correctness-backfill
fixed_at: 2026-08-26T00:00:00Z
review_path: .planning/phases/84-last-used-date-correctness-backfill/84-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 84: Code Review Fix Report

**Fixed at:** 2026-08-26T00:00:00Z
**Source review:** .planning/phases/84-last-used-date-correctness-backfill/84-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: The live UI's only `markAsPlanned` call site re-stamped `lastUsedAt` with wall-clock time immediately after the correct recompute

**Files modified:** `src/views/ServiceEditorView.vue`, `src/views/__tests__/ServiceEditorView.test.ts`
**Commit:** `e1200a31`
**Applied fix:** Deleted `bumpScheduledSongsLastUsed()` and its call site in `onMarkAsPlanned` entirely. `serviceStore.markAsPlanned` (the store-level R247 fix) is now the sole writer of `lastUsedAt` on the mark-as-planned transition — there is no second write path left to race it. Confirmed via grep that `bumpScheduledSongsLastUsed` had no other callers before deleting it, and confirmed the reopen path (`runReopen`) never had an analogous stamp. Replaced the stale `bumps the SONG documents directly...` test (which had exercised the now-deleted function against a fully-mocked store, hiding the conflict) with a regression test asserting `songStore.updateSong` is never called with a `lastUsedAt` patch from the view, and that `serviceStore.markAsPlanned` is the only call made. `src/stores/__tests__/services.test.ts`'s existing "lastUsedAt recompute (R247)" suite is the end-to-end proof the store's real recompute stamps the *service* date, not wall-clock time.

### CR-02: `markAsPlanned`/`reopenService`'s `lastUsedAt` recompute was not soft-failed

**Files modified:** `src/stores/services.ts`, `src/stores/__tests__/services.test.ts`
**Commit:** `e74e1339`
**Applied fix:** Wrapped the `recomputeLastUsedFor(...)` call in both `markAsPlanned` and `reopenService` in its own `try/catch`, mirroring the established `maybeRefreshShareLink` soft-fail pattern already in this file (log-and-swallow, never re-raise). The status `updateDoc` already lands before the recompute runs, so a transient recompute failure (permission edge case, network blip, quota) no longer rejects the whole transition and no longer makes the caller report "Couldn't mark this service as Planned" for a service that is genuinely locked/reopened server-side. Added two regression tests (`markAsPlanned`/`reopenService`) that force `songStore.updateSong` to reject once and assert the store call still resolves and the status `updateDoc` still landed.

### WR-01: `songIdsInService`'s doc comment claimed deduplication it didn't perform

**Files modified:** `src/stores/services.ts`, `src/stores/__tests__/services.test.ts`
**Commit:** `5aadea13`
**Applied fix:** Added the missing `[...new Set(ids)]` step so the implementation now matches its doc comment — a song repeated across multiple SONG slots in the same service triggers exactly one recompute/write, not one per occurrence. Added a regression test with a service containing the same songId in two SONG slots, asserting `songStore.updateSong` is called exactly once for it.

### WR-02: Backfill silently derived a `NaN`-producing date from a service doc missing `date`

**Files modified:** `functions/src/backfillLastUsed.ts`, `functions/src/backfillLastUsed.test.ts`
**Commit:** `a5103824`
**Applied fix:** Replaced the `data.date ?? ""` fallthrough with an explicit pre-filter: any service doc whose `date` is missing or does not match `/^\d{4}-\d{2}-\d{2}$/` is excluded from `serviceInputs` *before* any song is classified against it, logged via `console.warn`, and its id collected into a new `BackfillSummary.malformedServices: string[]` field (also surfaced in the CLI's dry-run/apply banner) — distinct from `summary.failed`, which is per-song. This turns an incidental "safe because it happened to be caught" NaN Timestamp attempt into an explicit, reviewable condition. Added a regression test with a service doc missing `date`: its song is now treated exactly like "no locked service" (conservative skip), the service id appears in `malformedServices`, and nothing lands in `failed`. Updated the existing summary-shape assertions (`toEqual({ processed, skipped, failed })`) to include the new field.

### WR-03: `serviceDateToMillis` resolved local-midnight against the executing process's ambient timezone

**Files modified:** `src/utils/lastUsed.ts`, `src/utils/__tests__/lastUsed.test.ts`, `functions/src/backfillLastUsed.ts`, `functions/src/backfillLastUsed.test.ts`, `src/stores/__tests__/services.test.ts`
**Commit:** `3801a1eb`
**Applied fix:** Changed `serviceDateToMillis` from `new Date(\`${date}T00:00:00\`).getTime()` (local-midnight, ambient-TZ-dependent) to a timezone-explicit `Date.UTC(year, month - 1, day)` parse of the `"YYYY-MM-DD"` string, applied identically to both the canonical copy (`src/utils/lastUsed.ts`) and its mirrored Admin-SDK copy (`functions/src/backfillLastUsed.ts`), keeping the two byte-identical per their existing mirror contract. This makes the client (browser TZ) and the backfill script (host-machine TZ, commonly UTC in CI/cloud-shell/Docker) compute the same millis for the same calendar date, so `Timestamp.isEqual`'s idempotency check converges correctly regardless of where the backfill is run. Updated both sides' `serviceDateToMillis` unit tests and `services.test.ts`'s two `Timestamp.fromMillis` call-assertions to the new UTC-midnight expected values, and added explicit TZ-independence/parity tests on both sides. Fixed two TS strict-mode errors this change surfaced (`noUncheckedIndexedAccess` on the destructured `date.split('-')` result; an unrelated pre-existing tuple-destructuring issue in a new WR-01 test) so `npm run type-check` stays clean.

## Skipped Issues

None — all findings were fixed.

## Verification gates (run after all 5 fixes)

- `npm run type-check` (`vue-tsc --build`, includes test files per CLAUDE.md) — **clean, 0 errors.**
- `cd functions && npx tsc --noEmit -p tsconfig.json` — **clean, 0 errors.**
- `npx vitest run` (bare, full app suite) — **4346 passed, 2 known-baseline failures** (`src/storage.rules.test.ts` — no Storage emulator running; `src/views/__tests__/RosterView.test.ts` — pre-existing stale assertion), both documented in CLAUDE.md as the standing baseline and untouched by this fix pass. One additional test (`functions/src/pptxParser.test.ts`, a 5s-timeout test unrelated to any file touched by this fix) failed only under the full parallel run's resource contention and was confirmed to pass cleanly (17/17) when re-run in isolation — a run-level flake, not a regression.
- `cd functions && npx vitest run src/backfillLastUsed.test.ts` — **15/15 passed**, including the "mirrored derivation parity with src/utils/lastUsed.ts" suite (WR-03 parity) and the new WR-02 malformed-date regression test.
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — **335/335 passed** (CR-01 regression test included).
- `npx vitest run src/stores/__tests__/services.test.ts` — **109/109 passed** (CR-02 and WR-01 regression tests included).
- `npx vitest run src/utils/__tests__/lastUsed.test.ts` — **17/17 passed** (WR-03 tests included).

---

_Fixed: 2026-08-26T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
