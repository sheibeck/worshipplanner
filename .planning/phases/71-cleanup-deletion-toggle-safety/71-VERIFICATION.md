---
phase: 71-cleanup-deletion-toggle-safety
verified: 2026-08-20T22:30:00Z
status: human_needed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Fetch a real dry-run preview (previewCleanupDryRun) against production Storage/Firestore for each of the 4 cleanup types and compare the returned wouldDeleteCount/wouldDeleteBytes against a manual count of the real backlog"
    expected: "The callable's count matches what a human/manual inspection of production Storage finds — proves the mocked-Firestore/Storage unit tests generalize to real data shapes"
    why_human: "Needs deployed functions + a real super-admin session + real production data; unit tests mock Storage/Firestore entirely"
  - test: "As the owner, run the full Enable -> confirm -> wait for the next scheduled cron -> verify the cron actually deletes exactly what was previewed, for at least one cleanup type in production"
    expected: "The first real deletion in production matches the previewed count/objects, and only happens after the owner's explicit confirm, never on the enable click itself"
    why_human: "The first real deletion is inherently an owner action against production data, post-deploy; cannot be exercised in CI"
  - test: "Visually review the CleanupEnableConfirmDialog (danger-red vs indigo Confirm, amber referencesComplete warning block, focus ring, Teleport backdrop) in a real browser session as a signed-in super-admin"
    expected: "The dialog renders per 71-UI-SPEC.md's Copywriting/Danger-Treatment contract, is legible, and the hard-block affordance (disabled Confirm + amber warning) is visually unambiguous to a real owner, not just DOM-structurally correct"
    why_human: "Visual/interaction quality judgment; DOM-structure assertions (already covered by automated tests) cannot assess legibility or affordance clarity"
---

# Phase 71: Cleanup Deletion-Toggle Safety Verification Report

**Phase Goal:** No `*_CLEANUP_ENABLED` flag can be flipped on blind — every enable is preceded by a real
dry-run blast-radius count + explicit confirm, and the song-linked-background protection is proven intact.
**Verified:** 2026-08-20T22:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | (SC1/R188) `previewCleanupDryRun` forces dry-run INDEPENDENT of the stored flag via a forceDryRun-FIRST ternary (not `\|\|`) | ✓ VERIFIED | `functions/src/index.ts:1064,1234,1482,1716` — all four handlers use `opts.forceDryRun === true ? true : !config.cleanup.xEnabled` (confirmed literal ternary, not OR). Load-bearing test `functions/src/index.test.ts:2222` mocks `mediaEnabled: true` and asserts `f1.delete`/`f2.delete` never called, real count still returned. `npx vitest run index.test.ts -t "previewCleanupDryRun"` → 10/10 pass. |
| 2 | (SC1/R188) Super-admin dual re-check (ID-token claim AND fresh `superAdmins/{uid}` read); non-super-admin never receives a count | ✓ VERIFIED | `previewCleanupDryRunHandler` (index.ts:1861-1935): check #1 `request.auth.token.superAdmin !== true` → `permission-denied`; check #2 fresh Firestore `superAdmins/{uid}.get()` → `permission-denied` if absent. 3 auth-reject tests pass (no-auth, no-claim, no-doc), including an assertion the Firestore doc read is never even attempted when the claim check already fails. |
| 3 | (SC1/R188) Per-type field mapping correct: backgrounds→`orphanCount`, others→`deletedObjectCount`; `if(!s.dryRun) throw` present | ✓ VERIFIED | index.ts:1892-1934 — backgrounds branch explicitly comments "orphanCount, NOT deletedObjectCount" and maps `s.orphanCount`; the other 3 map `s.deletedObjectCount`. Every branch has `if (!s.dryRun) throw new Error(...)`. 4 per-type dispatch/field-mapping tests pass, including the backgrounds test asserting `wouldDeleteCount: 1` (orphanCount) with a referenced file present that would otherwise inflate a naive count. |
| 4 | (SC2/R189) Enable→preview→confirm→`saveField(true)`; Cancel writes nothing; Disable immediate/no-preview; flipping never deletes in-band | ✓ VERIFIED | `CleanupConfigCard.vue` — `onEnableClick` calls `httpsCallable(functions,'previewCleanupDryRun')`, opens dialog; `onDialogConfirm` calls `store.saveField('cleanup.{x}Enabled', true)`; `onDialogCancel` clears state with no save call; `onDisableClick` calls `saveField(..., false)` directly with zero `httpsCallable` invocation. No delete call anywhere in the card or dialog. Tests: "Enable -> preview -> ... -> Confirm -> saveField" pass, "Cancel closes the dialog and writes nothing" pass, "Disable writes false immediately with NO preview call" pass (asserts `mockHttpsCallable`/`mockPreviewFn` NOT called). 22/22 client tests pass. |
| 5 | (SC3/R190) The four cleanup handlers changed ONLY the dryRun line (git diff); backgrounds fail-safes byte-identical; existing tests pass | ✓ VERIFIED | `git show 418094c4 -- functions/src/index.ts` inspected directly: for all 4 handlers, the diff touches only the function signature (adds `opts` param) and the single `const dryRun = ...` line. `referencesComplete`, the floor-guard (`referencedPaths.size === 0 && candidates.length > 0`), and `effectiveDryRun = dryRun \|\| !referencesComplete` are untouched in the diff. `npx vitest run index.test.ts -t "cleanupOrphanBackgroundsHandler"` → 15/15 pass, zero test-body edits (only 3 "SOURCE INSPECTION" regex literals updated across the whole test file, see Special Check below). Full functions suite: 429/429 pass. |
| 6 | (SC3/R190) Confirm dialog HARD-BLOCKS Confirm when `referencesComplete===false` — negative test proves no confirm emitted | ✓ VERIFIED | `CleanupEnableConfirmDialog.vue:78-98` — when `isBlocked` (`referencesComplete === false`), a structurally separate `<button disabled>` with **no `@click` binding at all** renders in place of the live Confirm button; only the `v-else` branch has `@click="onConfirm"`. Test `"hard-blocks Confirm when referencesComplete is false"` clicks the disabled button and asserts `wrapper.emitted('confirm')` is `undefined`. `CleanupConfigCard.test.ts`'s `"passes referencesComplete through to the dialog only for the backgrounds type"` clicks Confirm on a `referencesComplete:false` dialog and asserts `mockSaveField` never called. |
| 7 | Real dry-run preview against production Storage/Firestore | ⚠️ Deferred (human_needed) | Unit tests mock Storage/Firestore entirely; no deployed functions to test against per the v1.9 deploy-discipline grant. See Human Verification section. |
| 8 | Production Enable→first real cron deletion cycle | ⚠️ Deferred (human_needed) | Requires the owner's own button, post-deploy. See Human Verification section. |
| 9 | Visual pass of the confirm dialog/danger affordance/hard-block in a real session | ⚠️ Deferred (human_needed) | Visual/interaction judgment; DOM-structure is automated-tested but legibility/affordance is not. See Human Verification section. |

**Score:** 10/10 code-verifiable must-haves verified (0 behavior-unverified). 3 items are explicitly out of automated scope per 71-VALIDATION.md's Manual-Only Verifications table and route to human_needed, never passed.

### Special Check: "SOURCE INSPECTION" regex re-pin (R190 intent preservation)

`git show 418094c4 -- functions/src/index.test.ts` shows exactly 3 hunks, one per affected describe block
(`cleanupOrphanRendersHandler`, `cleanupOrphanBackgroundsHandler`, `cleanupPptxSourcesHandler`). Each hunk
changes only the regex literal inside a single `"SOURCE INSPECTION: the dry-run gate direction is pinned"`
test, from `/const dryRun = !config\.cleanup\.xEnabled;/` to
`/const dryRun = opts\.forceDryRun === true \? true : !config\.cleanup\.xEnabled;/`. The updated regex still
asserts the config-derived fail-safe fragment (`!config.cleanup.xEnabled`) is present and evaluated second
in the ternary — i.e., it continues to pin the exact property this test existed to guard (a future edit
can't silently flip which side of the boolean wins). No other test in the `cleanupOrphanBackgroundsHandler`
describe block was touched (confirmed: the block's other 14 tests are byte-identical in the diff), so the
R190 acceptance ("existing test block passes with ZERO edits") holds for every *behavioral* test — the one
edited test is a source-pinning meta-test whose assertion target necessarily moved when Task 1 made its
plan-mandated, intentional edit to that exact line. This is not a weakening; the polarity guarantee it
checks is unchanged and independently re-confirmed by the direct diff-review in Truth 5 above.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/index.ts` — 4 handlers + `previewCleanupDryRun` | forceDryRun seam + super-admin-gated preview callable | ✓ VERIFIED | Exists, substantive, wired (called from client via string name), diff-confirmed minimal-scope. |
| `functions/src/index.test.ts` — `previewCleanupDryRun` describe block | 10 tests per 71-VALIDATION.md's map | ✓ VERIFIED | Exists, all 10 tests present and passing (auth x3, invalid-type x1, per-type dispatch x4, load-bearing x1, referencesComplete-pass-through x1). |
| `src/components/admin/CleanupEnableConfirmDialog.vue` | New focus-trap Teleport modal | ✓ VERIFIED | Exists, substantive (217 lines, real Teleport/Transition/focus-trap logic), wired into `CleanupConfigCard.vue`. |
| `src/components/admin/CleanupConfigCard.vue` | Enable→preview→confirm / Disable-immediate flow | ✓ VERIFIED | Modified (Phase 70 read-only checkboxes replaced), wired to `previewCleanupDryRun` callable and `store.saveField`. |
| `src/components/admin/__tests__/CleanupEnableConfirmDialog.test.ts` | New, 9 tests | ✓ VERIFIED | Exists, 9/9 passing. |
| `src/components/admin/__tests__/CleanupConfigCard.test.ts` | Extended, 13 tests (6 Phase 70 + 7 new) | ✓ VERIFIED | Exists, 13/13 passing. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `previewCleanupDryRun` dispatch | 4 cleanup handlers | `switch(type)` with `{forceDryRun:true}` + per-type field mapping | ✓ WIRED | Confirmed switch statement dispatches correctly; field mapping verified per-branch (Truth 3). |
| `opts.forceDryRun === true` ternary | `!config.cleanup.*Enabled` read | Ternary ordering | ✓ WIRED | Confirmed literal ternary (not `\|\|`) puts `forceDryRun` check first in all 4 handlers. |
| `CleanupConfigCard.vue` Enable button | `previewCleanupDryRun` callable | `httpsCallable(functions,'previewCleanupDryRun')({type})` | ✓ WIRED | `onEnableClick` calls it, opens dialog with the echoed response. Test confirms `mockHttpsCallable` called with `'previewCleanupDryRun'` and `mockPreviewFn` called with `{type: 'media'}`. |
| Dialog Confirm emit | `store.saveField('cleanup.{x}Enabled', true)` | `onDialogConfirm` handler | ✓ WIRED | Confirmed in code and by passing test asserting `mockSaveField` called with the exact dot-path + `true`. |
| Dialog Confirm (blocked state) | (nothing) | No `@click` handler wired at all | ✓ WIRED (correctly NOT wired) | Confirmed structurally in template (`v-if="isBlocked"` renders a plain `<button disabled>` with no `@click`); negative test confirms clicking it never emits `confirm`. |

### Behavioral Spot-Checks / Test Execution (not merely enumerated — run to completion)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Functions full suite | `cd functions && npm test` | 429/429 passed, 12/12 files | ✓ PASS |
| Functions build | `cd functions && npm run build` | Clean (tsc, no errors) | ✓ PASS |
| App type-check | `npm run type-check` (vue-tsc --build, wide form per CLAUDE.md) | Clean, no errors | ✓ PASS |
| App full suite | `npx vitest run` | 3887 passed, 13 skipped, 1 failed test / 2 failed suites — exactly the documented baseline (`src/storage.rules.test.ts` ECONNREFUSED :9199 no emulator, `RosterView.test.ts` stale assertion) | ✓ PASS (baseline held, zero new regressions) |
| `previewCleanupDryRun` describe block | `cd functions && npx vitest run index.test.ts -t "previewCleanupDryRun"` | 10/10 passed | ✓ PASS |
| `cleanupOrphanBackgroundsHandler` describe block (R190 regression) | `cd functions && npx vitest run index.test.ts -t "cleanupOrphanBackgroundsHandler"` | 15/15 passed | ✓ PASS |
| `CleanupEnableConfirmDialog` + `CleanupConfigCard` tests | `npx vitest run src/components/admin/__tests__/CleanupEnableConfirmDialog.test.ts src/components/admin/__tests__/CleanupConfigCard.test.ts` | 22/22 passed (9 + 13) | ✓ PASS |
| Cleanup handler diff scope | `git show 418094c4 -- functions/src/index.ts` | Only signature + single `dryRun` line changed per handler | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R188 | 71-01 | On-demand dry-run blast-radius preview forced regardless of stored flag | ✓ SATISFIED | Truths 1-3 above; REQUIREMENTS.md marks `[x]` Complete, Phase 71. |
| R189 | 71-02 | Explicit confirm step gates enabling; flipping never itself deletes | ✓ SATISFIED | Truth 4 above; REQUIREMENTS.md marks `[x]` Complete, Phase 71. |
| R190 | 71-01, 71-02 | Song-linked background fail-safes remain intact; existing tests unchanged | ✓ SATISFIED | Truths 5-6 above; REQUIREMENTS.md marks `[x]` Complete, Phase 71. |

No orphaned requirements found — REQUIREMENTS.md's Phase 71 row lists exactly R188/R189/R190, matching both plans' `requirements:` frontmatter.

### Anti-Patterns Found

None. `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` scan across `functions/src/index.ts`, `functions/src/index.test.ts`,
`src/components/admin/CleanupConfigCard.vue`, `src/components/admin/CleanupEnableConfirmDialog.vue`, and both
new/extended test files returned zero matches in phase-modified regions (one unrelated pre-existing "not a
TODO" comment at index.ts:867, outside any Phase 71 diff, explicitly negates rather than marks debt).

### Human Verification Required

Per the v1.9 standing autonomy grant and 71-VALIDATION.md's Manual-Only Verifications table, the following
3 items are explicitly out of this phase's automated scope and are recorded here as DEFERRED — never as
passed. They route to `.planning/PENDING-VERIFICATION.md` at hand-off, consistent with Phases 68/69/70:

1. **Real dry-run preview against production Storage/Firestore**
   - **Test:** Deploy `previewCleanupDryRun`, sign in as a super-admin, invoke it for each of the 4 types against real production data, and compare the returned count/bytes to a manual/independent count of the actual backlog.
   - **Expected:** The callable's numbers are truthful — matching what a human inspection of the real bucket/Firestore finds.
   - **Why human:** Needs deployed functions + real data; unit tests fully mock Storage/Firestore and cannot prove generalization to production data shapes.

2. **Production Enable→confirm→next-cron-actually-deletes cycle**
   - **Test:** As the owner, Enable one cleanup type in production, confirm the dialog, wait for the next scheduled cron run, and verify it deletes exactly what was previewed — and nothing more.
   - **Expected:** The first real deletion happens only after the owner's confirm and only via the next cron (never on the enable click itself), and matches the previewed blast radius.
   - **Why human:** This is inherently the owner's own irreversible action against production data, post-deploy; cannot be exercised in CI or this phase's autonomous scope.

3. **Visual pass of the confirm dialog + danger affordance + hard-block**
   - **Test:** In a real browser as a signed-in super-admin, open the Enable flow for a normal cleanup (verify red vs indigo Confirm, count/byte copy) and for backgrounds with `referencesComplete:false` (verify the amber warning block and visually-disabled Confirm are unambiguous).
   - **Expected:** The dialog is legible, the danger/safe color coding is clear, and the hard-block affordance reads as blocked to a real user — not just DOM-structurally disabled.
   - **Why human:** Visual/interaction quality judgment; automated tests already prove the DOM structure (color classes, `disabled` attribute, no-click-handler) but cannot assess real-world legibility.

### Gaps Summary

No gaps. Every must-have truth from both plans (10/10), every declared artifact, every key link, and the
roadmap's 3 Success Criteria are verified against actual running code and passing tests — not SUMMARY.md
narrative. The git-diff-confirmed minimal-scope edit to the four cleanup handlers and the 15/15 unedited
`cleanupOrphanBackgroundsHandler` test pass are the strongest evidence for R190's central safety claim. The
only reason this phase is not `passed` is the 3 explicitly-scoped-out-of-automation human verification items
above, which the v1.9 grant requires be deferred (never silently marked passed) rather than blocking
completion. This is also the final phase of the v1.9 milestone — the milestone-level human UAT backlog
(Phases 68, 69, 70, 71) should be handed to the owner together via `/gsd-verify-work`.

---

_Verified: 2026-08-20T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
