# Deferred Items — Phase 108

Items discovered during phase 108 execution that are out of scope for the current
task (comment-only edits) and were not fixed, per the executor's scope-boundary rule.

## `src/stores/appConfig.test.ts` — stale assertion, pre-existing (not a 108-02 regression)

**Found during:** 108-02 Task 3 (full test-suite verification after the comment shrink).

**Symptom:** `useAppConfigStore > saveField > calls setDoc exactly once with the dot-path
payload, email, serverTimestamp, and merge:true` fails — it asserts `saveField` calls
`setDoc` with a flat dotted key (`'retention.mediaDays': 45`), but the current
implementation (correctly) writes a nested object (`{ retention: { mediaDays: 45 } }`).

**Root cause:** commit `b365a1b9` ("fix: appConfig saveField wrote a literal dotted key,
never persisted") on 2026-08-31 — **before Phase 108 started (2026-09-01)** — fixed a real
production bug (`setDoc` treats a dotted key as a literal field name, not a nested path;
only `updateDoc` interprets dots) by switching `saveField` to write a nested object. The
test assertion was never updated to match, so it now asserts the old, buggy shape.

**Confirmed NOT caused by 108-02:** neither `src/stores/appConfig.ts` nor
`src/stores/appConfig.test.ts` appears in the 108-02 comment-shrink edit set (93 files,
listed in `108-02-SUMMARY.md`). `git log` shows both files' last modification predates
Phase 108 entirely. Reproduces identically running the test file in isolation.

**Effect on the documented test baseline:** CLAUDE.md's "known-failing baseline" (only
`src/storage.rules.test.ts`) is now stale — as of 2026-09-01 a bare `npx vitest run`
fails **2** files, not 1. This phase does not update CLAUDE.md's baseline note (out of
scope for R317); flagging it here so the next phase/plan that touches
`src/stores/appConfig.ts` picks it up.

**Suggested fix (not applied here):** update the test's expected payload to
`{ retention: { mediaDays: 45 }, updatedAt: ..., updatedBy: ... }` to match the corrected
implementation.
