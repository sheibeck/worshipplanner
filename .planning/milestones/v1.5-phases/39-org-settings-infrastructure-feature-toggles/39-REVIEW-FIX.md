---
phase: 39-org-settings-infrastructure-feature-toggles
fixed_at: 2026-08-06T20:00:00Z
review_path: .planning/phases/39-org-settings-infrastructure-feature-toggles/39-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 39: Code Review Fix Report

**Fixed at:** 2026-08-06
**Source review:** .planning/phases/39-org-settings-infrastructure-feature-toggles/39-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (1 Critical, 3 Warning — Info was out of scope for this pass, and the review
  reported zero Info findings anyway)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: `authStore.settings.vwModeEnabled` skips the mandatory dual-read migration, silently disagreeing with `authStore.vwModeEnabled`

**Files modified:** `src/stores/auth.ts`, `src/stores/__tests__/auth.test.ts`
**Commit:** `5663b90`
**Applied fix:** `loadOrgContext` previously computed the `vwModeEnabled` dual-read
(`orgSettings.vwModeEnabled ?? orgData.vwModeEnabled ?? true`) ONLY for the standalone
`vwModeEnabled.value` ref, while `settings.value` was built with a plain
`{ ...DEFAULT_ORG_SETTINGS, ...orgSettings }` spread that never consulted the legacy flat field —
so a pre-v1.5 org with `{ vwModeEnabled: false }` and no nested `settings` key resolved
`vwModeEnabled.value === false` (correct) but `settings.value.vwModeEnabled === true` (wrong, silently
re-enabling Vertical Worship in the object the type contract calls canonical).

Fixed by computing the dual-read exactly once into `resolvedVwModeEnabled` and applying that single
value to both `settings.value.vwModeEnabled` (via an explicit override after the defaults spread) and
`vwModeEnabled.value` — the two values are now structurally incapable of disagreeing, since they are
assigned from the same variable in the same code path.

Extended the existing regression test (`'keeps a flat vwModeEnabled false when there is no settings
key'`, the one CLAUDE.md/39-CONTEXT.md call "the single most important test in the phase") to also
assert `store.settings.vwModeEnabled === false`, not only `store.vwModeEnabled`. Confirmed non-vacuous:
pre-fix, `DEFAULT_ORG_SETTINGS.vwModeEnabled` is hardcoded `true`, so the added assertion would have
resolved to `true` against the pre-fix merge and failed — the fix closes exactly the gap the review
identified.

**Verification:** Tier 1 (re-read) + Tier 2 (`npx vitest run` on `auth.test.ts`, 36/36 passing,
including the strengthened test) + full-suite `npm run type-check` clean.

### WR-01: "Suggest All Songs" is a live AI entry point that is never hidden when AI is off

**Files modified:** `src/views/serviceEditorActionBar.ts`, `src/views/ServiceEditorView.vue`,
`src/views/__tests__/serviceEditorActionBar.test.ts`
**Commit:** `b9cc91e`
**Applied fix:** `ActionBarContext` gained a required `aiEnabled: boolean` field (required, not
optional, so the compiler forces every call site to supply it — following the exact pattern already
used for `pcEnabled`). `buildServiceOrderItems` now only pushes `buildSuggestItem(ctx)` when
`ctx.canEditService && ctx.aiEnabled`. `ServiceEditorView.vue`'s `activeActionItems` computed threads
`aiEnabled: authStore.settings.aiEnabled` into the context object it builds, mirroring the existing
`pcEnabled: authStore.settings.pcEnabled` line immediately above it.

Test coverage added: a new `describe('aiEnabled (WR-01)', ...)` block in
`serviceEditorActionBar.test.ts` with four assertions (toggle-off hides the item, toggle-on control
case, composition with `canEditService` for both editor and viewer, and no effect on slides/roles tabs
where the item never appears anyway). `aiEnabled` was also added to `BOOLEAN_FLAG_KEYS`, folding it
into the file's existing cartesian-product LEAK TEST and ROLES EMPTY tests so future context flags are
automatically covered by that suite's exhaustive sweep.

**Verification:** Tier 1 (re-read) + Tier 2 (`npx vitest run` on `serviceEditorActionBar.test.ts` +
`ServiceEditorView.test.ts` together, 269/269 passing) + full-suite `npm run type-check` clean.

### WR-02: No integration-level test for the three new `pcEnabled`-composed behaviors in `ServiceEditorView.vue`

**Files modified:** `src/views/__tests__/ServiceEditorView.test.ts`
**Commit:** `d6d7de0`
**Applied fix:** No source change was needed — the review confirmed all three `pcEnabled`-composed
behaviors were already correctly implemented in `ServiceEditorView.vue`; only test coverage was
missing. Added a `describe('WR-02: authStore.settings.pcEnabled composition', ...)` block inside the
existing "contextual action bar wiring" describe (reusing its `mountView` helper) with six mounted
assertions — a toggle-off case and a toggle-on control case for each of the three behaviors named in
the finding:

1. `activeActionItems` action-bar context wiring — `export-pc-btn` absent when `pcEnabled` is false
   even with credentials present; present in the control case.
2. The credentials-missing hint row's `v-if` — absent when `pcEnabled` is false and uncredentialed;
   present in the control case.
3. `onExportToPC`'s belt-and-suspenders guard — invoked directly on the mounted `vm` (since the button
   that would normally trigger it is itself hidden by behavior 1 when `pcEnabled` is false, a DOM click
   cannot reach this guard), asserting `showExportDialog` never flips to `true`; the control case
   confirms it does flip when `pcEnabled` is true.

**Note on verification methodology:** running only the new tests via `-t "WR-02"` initially reported 1
failure in an unrelated, pre-existing test (`'editor: rapid toggles of two different people for the
same role do not clobber each other (WR-02)'` — a different phase's WR-02, matched only by substring).
Isolating that single test passed; running the FULL file (matching the project's actual test-command
gate, not a `-t` filter) passed all 242/242. This is a `-t`-filter lifecycle-hook artifact (skipped
tests' sibling `beforeEach`/`afterEach` hooks do not run identically under a subset selection), not a
regression from this fix — documented here per this workflow's non-vacuity requirement, so a future
reader isn't misled by a `-t`-scoped run.

**Verification:** Tier 1 (re-read) + Tier 2 (`npx vitest run` on the full `ServiceEditorView.test.ts`
file, 242/242 passing) + full-suite `npm run type-check` clean.

### WR-03: `isAiEnabled()` guard sits outside the `try` block in all three gated `claudeApi.ts` exports

**Files modified:** `src/utils/claudeApi.ts`, `src/utils/__tests__/claudeApi.test.ts`
**Commit:** `6aa474b`
**Applied fix:** Moved `if (!isAiEnabled()) return null` from immediately before each `try` block to
the first statement inside it, in all three gated exports (`getSongSuggestions`,
`getScriptureSuggestions`, `splitCongregationalReading`). `isAiEnabled()` calls `useAuthStore()`, which
throws if invoked with no active Pinia instance; with the guard outside the `try`, that throw would
convert the async function's returned promise to a rejection instead of the documented `null`,
contradicting the module's never-throw contract. Inside the `try`, the same throw is now caught by the
existing `catch` block and mapped to `null`, identically to every other failure mode this module already
handles. Updated the `isAiEnabled` JSDoc to reflect the new call-site position and explain why.

**3-of-7 gating boundary preserved:** `grep -c "isAiEnabled" src/utils/claudeApi.ts` returns exactly 4
(one definition + three call sites) before and after the fix — the four pure parse/validate helpers
(`safeParseJsonArray`, `validateSongSuggestions`, `validateScriptureSuggestions`, `validateSplitResult`)
remain ungated, as required.

Added a new `describe('WR-03: isAiEnabled() guard never throws out of a gated export', ...)` block to
`claudeApi.test.ts`. The existing mock for `useAuthStore` was extended with a `mockAuthStoreThrows` flag
(reset in the file's existing unconditional `afterEach`) that, when set, makes the mocked
`useAuthStore()` throw — simulating "no active Pinia." Three tests (one per gated export) set this flag
and assert `resolves.toBeNull()` rather than a rejection. This is a genuinely new failure mode: the
file's pre-existing `aiEnabled: false` tests toggle a settings flag and never reach `useAuthStore()`
throwing, so they could not have caught this bug — confirmed these new tests exercise a path no
pre-existing test covers.

**Verification:** Tier 1 (re-read) + Tier 2 (`npx vitest run` on `claudeApi.test.ts`, 70/70 passing,
including the 3 new WR-03 tests, with the expected `console.error` log lines confirming the guard's
thrown error was caught rather than propagated) + full-suite `npm run type-check` clean.

## Skipped Issues

None — all 4 in-scope findings were fixed. No false positives were identified on closer inspection;
every finding's described code state matched the actual source at fix time.

## Full-Suite Verification (post-fix, all 4 commits applied)

- `npm run type-check` (`vue-tsc --build`, the full gate including test files): **clean, zero errors.**
- `npx vitest run --dir src --exclude '**/rules.test.ts'`: 2547 passed, 9 failed across exactly 2 files
  — `src/storage.rules.test.ts` (Storage-emulator cross-service-read limitation, documented in
  CLAUDE.md as a real defect awaiting the v1.5-scoped custom-claim fix, not introduced by this fix pass)
  and `src/views/__tests__/RosterView.test.ts` (the known stale `'wraps Roles config in
  CollapsibleSection'` assertion). This is **exactly** the known-failing baseline CLAUDE.md documents —
  no new failures were introduced by any of the four fixes.

---

_Fixed: 2026-08-06_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
