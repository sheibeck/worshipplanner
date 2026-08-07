---
phase: 42-powerpoint-rendered-image-display
fixed_at: 2026-08-07T13:15:00Z
review_path: .planning/phases/42-powerpoint-rendered-image-display/42-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 42: Code Review Fix Report

**Fixed at:** 2026-08-07T13:15:00Z
**Source review:** .planning/phases/42-powerpoint-rendered-image-display/42-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 Critical, 5 Warning — `fix_scope: critical_warning`, so the 0 Info findings were out of scope)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: `pending`/`failed` → `ready` render transition silently drops per-slide customization (label/audio/notes)

**Files modified:** `src/utils/importedRenderReconciler.ts`, `src/utils/__tests__/slideGroupMaterializer.test.ts`
**Commit:** `afa9817`
**Applied fix:** Chose resolution **(b)** from the review's Fix section, deliberately — not (a). The
review's own finding-specific guidance ruled out (a) (a positional carry-forward) as unsafe: 42-RESEARCH.md
Pitfall 1 establishes there is no reliable positional pairing between `deck.slides[i]` and rendered page
`i+1` (`mapAstToSlides` skips slides and emits one entry per image on multi-image slides), so an
index-based carry-forward would attach a user's note to the WRONG slide — worse than dropping it.

Corrected `importedEntryIdentities`'s doc comment in `importedRenderReconciler.ts` (previously false: it
claimed a pending/failed → ready transition "can still carry forward" per-entry label/audio/notes). The
new comment states the real behavior plainly — the two identity key spaces (`deck.slides[i].id` for
pending/failed vs. synthetic `rendered-page-N` for ready) never overlap, so `carryStoredDerivedEntries`
cannot match them, and the loss (plus entry-`id` churn) is documented as an accepted trade-off with a
named follow-up (a render-stable identity scheme, or a UI warning on `EditSlideDrawer.vue` while
`renderState` is pending/failed) if it's ever revisited. Explicitly did NOT delete the comment and move on,
per the review's instruction.

Fixed the test asymmetry the reviewer identified: the `D-10` pending→ready idempotence test
(`slideGroupMaterializer.test.ts`) previously asserted only `sourceRef`/count/order equality and never
entry-id continuity, unlike its `ready→ready` sibling (`Assumption A1`), which explicitly asserts
`carried.id`/`label`/`audioUrl` are preserved. Added a customization (label + audioUrl) to a `pending`
stored entry before the D-10 rebuild, and asserted the post-rebuild counterpart's `id` differs and its
`label`/`audioUrl` are `undefined` — the test now encodes the actual (loss) behavior out loud rather than
being silent about it, closing the asymmetry.

Verification: 122/122 tests pass in `slideGroupMaterializer.test.ts` (new assertions included); full
project `npm run type-check` (`vue-tsc --build`) clean for both files.

### WR-01: `renderedUrlCache` in `useSlideshowAssembly.ts` grows unbounded across re-renders within one session

**Files modified:** `src/composables/useSlideshowAssembly.ts`
**Commit:** `b89dd52`
**Applied fix:** In `loadMissingRenderedUrls`, after resolving a fresh `(id, count)` entry, evict every
OTHER cached key that starts with `` `${id}: ` `` before inserting the new one — the map now holds at most
one entry per `renderImportId`, matching what `renderedImageUrlsByImportId` ever actually reads. No change
to the count-in-key design itself (still correctness-load-bearing per the existing doc comment).

Verification: 49/49 tests pass in `useSlideshowAssembly.test.ts`; type-check clean.

### WR-02: `cleanup()` calls the singleton `pptxRenders` store's `unsubscribeAll()`, tearing down every listener regardless of which composable instance opened it

**Files modified:** `src/composables/useSlideshowAssembly.ts`
**Commit:** `7835f21`
**Applied fix:** Took the review's second ("or") option rather than the first: a full per-consumer
reference-counting redesign of the store's public API is a real design change no plan here authorizes, and
risks behavior change to a "genuinely new design (42-PATTERNS.md 'No Analog Found')" store with its own
dedicated test suite. Instead, added a module-level `activeSlideshowAssemblyInstances` counter in
`useSlideshowAssembly.ts` (incremented on setup, decremented in `cleanup()`), and a dev-mode-only
(`import.meta.env.DEV`) `console.warn` in `cleanup()` when more than one instance is active at teardown
time — a loud tripwire for a single-call-site-assumption violation instead of the previous silent failure
mode. Teardown behavior itself (`unsubscribeAll()` still tears down every listener) is unchanged.

Verification: 49/49 tests pass in `useSlideshowAssembly.test.ts`; type-check clean.

### WR-03: `rules.test.ts`'s `pptxRenders` write-denial coverage tests only the `update` path for an editor, not `create`/`delete`

**Files modified:** `src/rules.test.ts`
**Commit:** `9791549`
**Applied fix:** Added two tests to the `pptxRenders` describe block, mirroring `serviceShareLinks`'s
CREATE/UPDATE/DELETE structure: an editor-role `setDoc` (create) denial test and an editor-role
`deleteDoc` (delete) test against the `pptxRenders` collection, both expected to (and do) deny via the
generic wildcard's `collection != 'pptxRenders'` exclusion.

Verification: an emulator was already running (per project convention, avoiding the documented
"port taken" conflict with `npm run test:rules`). Ran
`npx vitest run --config vitest.rules.config.ts -t "pptxRenders"` — all 7 tests in the block pass,
including the 2 new ones. Also ran the full rules suite (`npx vitest run --config vitest.rules.config.ts`,
no `-t` filter) to confirm no regressions: 140/140 pass (127 `rules.test.ts` + 13 `storage.rules.test.ts`).
Type-check clean. No `firestore.rules` changes were made (only test coverage), so no deploy handoff is
implicated.

### WR-04: `resolveImportedRender`'s ready-mode branch is reached by elimination, not by an explicit `status === 'ready'` check

**Files modified:** `src/utils/importedRenderReconciler.ts`
**Commit:** `9818898`
**Applied fix:** Replaced the implicit `// render.status === 'ready'` comment-only assumption with an
explicit `if (render.status === 'ready') { ... }` guard around the existing `renderedCount`-based ready
resolution, followed by a safe fallback branch (`{ mode: 'failed', entryCount: deck.slides.length }`) for
any status value outside the closed `'pending' | 'failed' | 'ready'` union — covering a future
server-added status value or a malformed/corrupted document, degrading safely instead of masquerading as
`ready`.

Verification: 33/33 tests pass in `importedRenderReconciler.test.ts`, 122/122 in
`slideGroupMaterializer.test.ts`, 86/86 in `slideshowAssembler.test.ts` (241 total, no regressions in any
consumer of this function); type-check clean.

### WR-05: No test proves the "same id re-added after removal" listener-leak scenario the focus areas asked to be checked

**Files modified:** `src/stores/__tests__/pptxRenders.test.ts`
**Commit:** `0235789`
**Applied fix:** Added the exact test the review's Fix section specified:
`syncSubscriptions('orgA', ['a'])` → `syncSubscriptions('orgA', [])` (closes `a`) →
`syncSubscriptions('orgA', ['a'])` again — asserting `onSnapshot` was called exactly twice total (once
per open, ruling out both a stale-listeners-map suppression and a double-`onSnapshot` call) and that the
second open's data flows through `rendersByImportId` correctly via a `triggerSnapshot` call.

Verification: 11/11 tests pass in `pptxRenders.test.ts` (new test included); type-check clean.

## Skipped Issues

None — all 6 in-scope findings were fixed.

## Post-fix full-suite verification

- `npm run type-check` (`vue-tsc --build`, the whole project, including test files per this project's
  documented gate): clean, no errors.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` (the documented canonical app-suite invocation):
  only the two pre-existing documented baseline failures remain —
  `src/storage.rules.test.ts` (Storage-emulator cross-service-read limitation, not a defect in these
  changes) and `src/views/__tests__/RosterView.test.ts` (stale assertion, pre-existing). No new failures
  introduced by any of the 6 fixes.
- `npx vitest run --config vitest.rules.config.ts` (full rules suite, against the already-running
  emulator): 140/140 pass, including the 7/7 `pptxRenders` tests (WR-03's 2 new ones).

No `firestore.deploy`/`gcloud run deploy` was run. No new deploy handoff was added to
`.planning/PENDING-VERIFICATION.md`.

---

_Fixed: 2026-08-07T13:15:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
