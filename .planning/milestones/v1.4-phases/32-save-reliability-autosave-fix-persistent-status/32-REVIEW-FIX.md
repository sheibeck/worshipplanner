---
phase: 32-save-reliability-autosave-fix-persistent-status
fixed_at: 2026-08-02T21:55:12-04:00
review_path: .planning/phases/32-save-reliability-autosave-fix-persistent-status/32-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 32: Code Review Fix Report

**Fixed at:** 2026-08-02T21:55:12-04:00
**Source review:** `.planning/phases/32-save-reliability-autosave-fix-persistent-status/32-REVIEW.md`
**Iteration:** 1

**Scope:** Critical + Warning (7 findings). The 2 Info findings (IN-01, IN-02) are out of
scope per the fix instructions and were not touched.

**Summary:**
- Findings in scope: 7 (3 Critical, 4 Warning)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: A newer edit's "saved" status can be a lie, and for ServiceEditorView the underlying edit is permanently lost

**Files modified:** `src/composables/useAutoSave.ts`, `src/views/ServiceEditorView.vue`,
`src/composables/__tests__/useAutoSave.test.ts`, `src/views/__tests__/ServiceEditorView.test.ts`
**Commit:** `5a68288`
**Applied fix:**
1. `useAutoSave.ts`'s success/catch handlers, on both the debounced path (`scheduleSave`) and
   `flush()`, now check `status.value !== 'pending'` before overwriting to `'saved'`/`'error'` —
   a newer mutation's own watcher trigger is no longer silently stomped. Required an explicit
   `(status.value as AutoSaveStatus)` widen at each check site: TS's control-flow narrowing
   otherwise treats `status.value` as still equal to the literal it was assigned a few lines up
   (`'saving'`), not accounting for the fact that a concurrent watcher callback can mutate the
   same ref during the intervening `await`.
2. `ServiceEditorView.vue`'s `onSave()` now snapshots exactly what is being sent (`sentSnapshot`,
   built from the same `payload` object passed to `updateService`) *before* the write, and only
   stamps `originalService` clean *after* the write if `localService` — including the WR-01
   slots sync-back that intentionally follows — still matches that snapshot exactly. This is a
   refinement of the review's literal suggestion (compare `localService` before vs. after): a
   naive whole-object comparison would have been defeated by the WR-01 slots-normalization
   sync-back in the *ordinary*, no-concurrent-edit case, since the sync-back rewrites
   `localService.value.slots` to the normalized array that differs from the pre-write snapshot.
   Comparing against the actual sent payload (which already includes the normalized slots)
   avoids that false positive while still catching a genuinely concurrent edit to any other
   field.

**Regression test:** `useAutoSave.test.ts` — "CR-01: does not clobber a newer pending status when
an earlier in-flight save resolves" and "CR-01: flush()'s own success handler does not clobber a
newer pending status either". `ServiceEditorView.test.ts` — "CR-01: an edit made while an earlier
autosave write is still in flight is not marked clean before it is ever persisted" (drives a real
held-open `updateService` promise, lands a second, distinct edit mid-flight, and asserts the
second edit is eventually sent in its own follow-up write). All three verified to fail against the
pre-fix code (temporarily reverted, re-tested, restored) and pass against the fix.

---

### CR-02: `useAutoSave.flush()` can cancel a pending edit's only timer and then no-op, dropping the edit

**Files modified:** `src/composables/useAutoSave.ts`, `src/composables/__tests__/useAutoSave.test.ts`,
`src/views/__tests__/ServiceEditorView.test.ts`
**Commit:** `2bdd4d8`
**Applied fix:** `flush()` now checks `if (saving) return` *before* `clearDebounceTimer()`,
exactly as the review's suggested fix. If a save is already in flight, `flush()` no-ops without
touching any armed follow-up timer, leaving that timer free to retry a newer, distinct edit on
its own schedule once the in-flight save completes.

**Regression test:** `useAutoSave.test.ts` — "CR-02: flush() does not cancel a newer edit's
just-armed timer when a previous save is still in flight". `ServiceEditorView.test.ts` — "CR-02:
Mark as Planned's flush() does not destroy a newer edit's only retry path while an earlier save is
still in flight", which drives the actual `onMarkAsPlanned()` flow and makes the transition itself
fail (rather than succeed and lock) so the test isolates `flush()`'s own defect from the separate,
already-tested cancel-on-lock race. Both verified to fail against the pre-fix ordering and pass
against the fix.

**Note (documented, not applied):** the review's fix section flags a residual gap — `flush()`
still cannot guarantee "definitely nothing pending" if a caller needs to *wait out* an in-flight
save rather than just avoid destroying its follow-up timer; that would require exposing an
awaitable in-flight promise/settled-signal, which is a larger composable-shape change the review
itself explicitly scoped out ("flag that as a follow-up if callers rely on `flush()` for that
guarantee"). No current caller (`onMarkAsPlanned` is the only `flush()` call site) relies on that
stronger guarantee, so no further change was made here.

---

### CR-03: An unresolved, still-dirty autosave `'error'` is silently erased the instant a service locks

**Files modified:** `src/views/ServiceEditorView.vue`, `src/views/__tests__/ServiceEditorView.test.ts`
**Commit:** `3ec621d`
**Applied fix:** Took option (b) from the review's fix section. The cancel-on-lock watcher
(`watch([canEditService, () => autoSave.status.value], ...)`) now checks, in its `!editable`
branch, whether `autoSave.status.value === 'error'` before reporting `'idle'`. If it is, the
failure text (read from the `saveStatus` store's own definitive entry, with a hardcoded fallback)
is written into `lifecycleError` instead — `lifecycleError` is rendered in the lock banner
(`data-testid="service-lock-banner-error"`), which is *not* gated behind `canEditService`, unlike
the sticky status bar. The `saveStatus` store entry itself is left untouched (not downgraded to
`'idle'`) rather than quietly discarded.

Required hoisting `const lifecycleError = ref<string | null>(null)` from its original declaration
site (down with the R037 transition state) to just above this watcher, since the watcher now reads
it. Verified this is safe even for the watcher's own `{ immediate: true }` first synchronous run:
`autoSave.status.value` is provably still `'idle'` at that exact point (the composable was just
constructed a few lines above), so the new `status === 'error'` branch can never execute before
`lifecycleError` exists — but the declaration was still moved for clarity/future-proofing rather
than relying on that timing argument implicitly.

**A more surprising finding during verification:** a literal repro of the review's own words
("directly mutate `localService.status` to simulate the lock, without going through
`onMarkAsPlanned`") does **not** reproduce a blank banner even on the pre-fix code — because
`handleAutosaveFailure` (the function that puts autosave into `'error'` in the first place)
*already* writes a (differently-worded) message into `lifecycleError`, and that write survives an
externally-triggered lock untouched. The actually-reachable "zero on-screen indication" case is
specifically when **the same client** that has the outstanding error clicks **Mark as Planned**
themselves: `onMarkAsPlanned` unconditionally nulls `lifecycleError.value = null` at its own start
(to clear any *stale* prior failure before a fresh attempt), then proceeds to lock the service —
and nothing re-populates `lifecycleError` afterward, since no *new* failure occurred. The fix and
its regression test are built against this actually-reachable path, not the literal (and, it turns
out, already partially self-healing) direct-mutation repro. This is exactly the class of
"adapt the fix to actual code behavior" call this workflow expects.

**Regression test:** `ServiceEditorView.test.ts` — "CR-03: an outstanding autosave error stays
visible in the lock banner instead of vanishing when Mark as Planned locks the service". Drives a
real transport failure, then a real `onMarkAsPlanned()` call, and asserts
`service-lock-banner-error` is present with the correct text. Verified to fail against the pre-fix
watcher (banner absent entirely) and pass against the fix.

---

### WR-01: `SaveStatusEntry.errorText` has no fallback where it's rendered, unlike the toast

**Files modified:** `src/stores/saveStatus.ts`, `src/components/SaveStatusIndicator.vue`,
`src/components/__tests__/SaveStatusIndicator.test.ts`
**Commit:** `555a931`
**Applied fix:** `GENERIC_ERROR_TEXT` moved from a store-internal `const` to a module-level
`export const` in `saveStatus.ts`, so both the toast-push fallback (`saveStatus.ts`'s own `set()`)
and `SaveStatusIndicator.vue`'s inline-error span share the exact same string (`entry.errorText ??
GENERIC_ERROR_TEXT`) rather than two independently-maintained copies that could drift.

**Regression test:** `SaveStatusIndicator.test.ts` — "WR-01 (32-REVIEW): falls back to the generic
sentence when errorText is missing, rather than rendering blank" — sets `{ status: 'error' }` with
no `errorText` and asserts the fallback renders.

---

### WR-02: No regression test locks in the multi-document own-write-echo interleaving

**Files modified:** `src/stores/__tests__/services.test.ts` (test-only, no source change)
**Commit:** `5381d22`
**Applied fix:** Added two tests to the `subscribe / onSnapshot` describe block: (1) two documents
whose own-writes overlap and settle on different snapshots, asserting each document's echo status
is derived independently across three consecutive emissions; (2) a snapshot mixing one document's
settle edge with a second, genuinely external document's simultaneous change, asserting only the
settling document is classified as an echo. Both pass against the existing (already-correct, per
the review's own hand-trace) `services.ts` logic — this closes the coverage gap the review flagged,
it does not indicate the logic itself needed a fix.

---

### WR-03: `useSaveStatus.mostUrgent` is fully built and tested but has no production consumer

**Files modified:** `src/stores/saveStatus.ts`, `src/stores/__tests__/saveStatus.test.ts`
**Commit:** `de4d245`
**Applied fix:** Took the review's "remove it until a consumer exists" option (rather than wiring
it into a speculative future cross-surface indicator, which is out of this phase's UI-SPEC scope).
Removed `mostUrgent`, its backing `URGENCY` ranking table, and the now-unused `computed` import
from `saveStatus.ts`; removed the five dedicated `mostUrgent` tests from `saveStatus.test.ts`
(kept the one `clear()` test that also exercised `mostUrgent` as a side assertion, trimmed to drop
only that assertion). Confirmed via `grep -rn "mostUrgent" src/` immediately before committing that
no other file in `src/` references it.

---

### WR-04: The two readings editors' `surfaceId` has no reactive path to update if `readingId` changes post-mount

**Files modified:** `src/components/CongregationalEditor.vue`, `src/components/ScriptureSlideEditor.vue`
(documentation only, no behavioral change)
**Commit:** `2e76d8b`
**Applied fix:** Took the review's second offered option (document/enforce the `:key` contract)
rather than the first (add a `watch(() => props.readingId, ...)`). Rationale, expanded beyond the
review's own note: `currentReadingId` is not the *only* state seeded once at mount from
`props.readingId` — `sections`/`localSlides`, `referenceText`, and `rawText` are too, all inside
`onMounted`. A watcher that resets only `currentReadingId`/`surfaceId` (the review's literal
suggestion) would leave those other fields stale while `surfaceId` looked freshly correct — a
*more* subtly wrong state than today's uniformly-stale-but-internally-consistent one. A genuinely
correct fix needs the whole `onMounted` load path to re-run reactively on `readingId` change, which
is a real design change, and — since both components are still unmounted dead weight per Phase
30/R047, with no current call site to integration-test against — an unverifiable one to make
blind right now. Added a prominent call-site contract comment next to each component's
`defineExpose({ currentReadingId })` instead, explicit that a `:key` tied to `readingId` is
mandatory and that a partial prop-watcher was considered and rejected, so whoever wires these into
Phase 34 sees the constraint before reusing an instance across readings.

**Regression test:** none applicable — no source behavior changed, only documentation. Existing
`CongregationalEditor.test.ts` / `ScriptureSlideEditor.test.ts` suites (39 tests) re-run clean,
confirming the comment-only change didn't touch runtime behavior.

---

## Skipped Issues

None — all 7 in-scope findings were fixed.

## Findings deliberately out of scope

IN-01 (`SongLyricEditor.vue`'s repair-write bypasses `useAutoSave` and swallows its own failure)
and IN-02 (`assignSongToSlot` remains dead code, previously flagged) are Info-severity and out of
this fix pass's scope per the task's explicit instructions. Neither is trivially adjacent to any
of the 7 fixes made above (IN-01 touches a different component's unrelated repair-write code path;
IN-02 is a restated prior-phase finding requiring no action). Not fixed, not rejected — left for a
future pass at Info scope.

---

## Gate results (run against the final committed state, HEAD `2e76d8b`)

| Gate | Result |
|---|---|
| `npm run type-check` (`vue-tsc --build`, typechecks test files) | Clean — 0 errors |
| `npx vitest run src/` | 1981 passed / 9 failed / 76 files (74 passed, 2 failed) — the 9 failures are exactly the pre-existing known-failing baseline (`src/storage.rules.test.ts` × 6, needs the Storage emulator; `src/views/__tests__/RosterView.test.ts` × 3, stale assertion). Before this fix pass: 1977 passed / 9 failed. Net: +6 CR regression tests, +3 WR-01/WR-02 tests, −5 WR-03 dead-code tests removed with the code they tested = 1981. No file beyond the known baseline regressed. |
| `npm run build` | Succeeds — `vite build` completes, only the pre-existing "chunk larger than 500kB" advisory warning (unrelated to this fix pass) |

Each of the 6 non-source-only commits was individually verified before committing: for every fix
touching source (CR-01, CR-02, CR-03), the corresponding regression test was confirmed to **fail**
against the pre-fix code (by temporarily reverting just that change and re-running the targeted
test file) and **pass** against the fix, then the pre-fix state was restored before moving on.

---

_Fixed: 2026-08-02T21:55:12-04:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
