---
phase: 103-manual-fallback-when-bible-api-is-off
fixed_at: 2026-08-31T21:00:00Z
review_path: .planning/phases/103-manual-fallback-when-bible-api-is-off/103-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 5
skipped: 1
status: partial
---

# Phase 103: Code Review Fix Report

**Fixed at:** 2026-08-31
**Source review:** .planning/phases/103-manual-fallback-when-bible-api-is-off/103-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (2 critical, 3 warning, 1 info)
- Fixed: 5
- Skipped: 1 (WR-03, dedup — deliberately deferred, see below)

## Fixed Issues

### CR-01: ScriptureInput.vue — pasted fallback text is silently erased by routine follow-up actions

**Files modified:** `src/components/ScriptureInput.vue`, `src/components/__tests__/ScriptureInput.test.ts`
**Commit:** `4c4e2ad1`
**Applied fix:** Gated the two clearing paths and the button visibility on `authStore.isBibleApiEnabled`, exactly as the review suggested, plus one additional guard the review's code sample didn't spell out:
- `showPreviewButton` now requires `authStore.isBibleApiEnabled` — the "Preview passage" button no longer renders at all when the API is off (it was already a pointless no-op that also wiped `previewText`).
- `onTextInput`'s reference-change clearing block (`if (passageQuery.value !== previewRef.value) { previewText.value = ''; ... }`) is now gated the same way.
- Additionally guarded the *other* clearing site in `onTextInput` — the early-return branch that fires when the reference field is cleared to empty — since that is also "editing the reference field" under the stated invariant and the paste textarea remains visible/usable regardless of whether a reference is filled in.
- Guarded the `watch(effectiveVersion, ...)` clearing block the same way, per the review's explicit follow-up instruction.

Added a dedicated `CR-01: pasted fallback text is never silently erased` describe block with 3 regression tests: no "Preview passage" button renders when the API is off; editing the reference field after pasting does not erase the paste; clearing the reference field entirely after pasting does not erase the paste. Updated one pre-existing test (`bibleApiEnabled=false: triggering a preview calls neither client...`) whose premise (clicking a still-visible button) no longer holds now that the button is hidden — rewrote it to assert the button doesn't render and no client is ever called, preserving the original Phase 102/R297 intent.

### CR-02: CongregationalEditor.vue — the paste textarea unconditionally re-seeds the main reading textarea on every keystroke

**Files modified:** `src/components/CongregationalEditor.vue`, `src/components/__tests__/CongregationalEditor.test.ts`
**Commit:** `711cf38b`
**Applied fix:** Added a `lastPasteSeed` ref tracking the exact `"Leader\n<stripped>"` string `onPasteInput` itself last wrote into `text`. `onPasteInput` now only overwrites `text` when `text.value === lastPasteSeed.value` — i.e. nothing has diverged from the last paste-seed via a manual edit or an AI split — applied verbatim per the review's suggested fix. `rawPassage` and `pastedText` are still updated unconditionally (mirroring the review's own fix code), since those don't discard visible user work the way overwriting `text` does.

Added 3 regression tests: editing the paste box after a "Split with AI" run no longer discards the split; editing the paste box after a manual hand-edit to the main textarea no longer discards the edit; and a control test confirming ordinary successive paste keystrokes (nothing else touched) still keep re-seeding the textarea as before.

### WR-01: ScriptureInput.vue renders two overlapping "open externally" links when the Bible API is off

**Files modified:** `src/components/ScriptureInput.vue`, `src/components/__tests__/ScriptureInput.test.ts`
**Commit:** `4c4e2ad1`
**Applied fix:** Added `&& authStore.isBibleApiEnabled` to the pre-existing reader link's `v-if`, exactly as the review's simplest-fix suggestion. Only the fallback block's own "Open in BibleGateway" link now renders when the API is off.

Added a regression test asserting exactly one `target="_blank"` link renders when the API is off, with the text "Open in BibleGateway", and that neither "View on ESV.org" nor "View on BibleGateway" (the old reader-link labels) appear.

### WR-02: CongregationalEditor.vue stamps pasted "any version" text with the org's configured Bible version

**Files modified:** `src/components/CongregationalEditor.vue`, `src/components/__tests__/CongregationalEditor.test.ts`
**Commit:** `711cf38b`
**Applied fix:** Applied the review's suggested guard to both stamp sites:
- `onAiSplit`'s `stampVersion`: `capturedVersion.value ?? (authStore.isBibleApiEnabled ? authStore.settings.bibleVersion : null)`.
- `onSave`'s `version`: same guard applied to the final catch-all fallback only — `capturedVersion.value ?? props.bibleVersion ?? (authStore.isBibleApiEnabled ? authStore.settings.bibleVersion : null)`. The per-item `bibleVersion` prop override is left un-guarded because it represents a deliberate, explicit per-item choice (R128), not an unrelated org default — only the final "guess the org's current setting" fallback is nulled out when the API is off.

Added a regression test: Save on a purely-pasted reading (Bible API off, no per-item override) leaves `translationSource` unset on the emitted sections, rather than falsely stamping the org's stored ESV/NLT value.

### IN-01: New paste textareas lack `for`/`id` association with their labels

**Files modified:** `src/components/ScriptureInput.vue`, `src/components/CongregationalEditor.vue`, both `__tests__` files
**Commits:** `4c4e2ad1` (ScriptureInput.vue), `711cf38b` (CongregationalEditor.vue)
**Applied fix:** Added `id="scripture-paste-textarea"` / `for="scripture-paste-textarea"` in `ScriptureInput.vue` and `id="congregational-paste-textarea"` / `for="congregational-paste-textarea"` in `CongregationalEditor.vue`, exactly as the review suggested. Added a regression test per component asserting the label's `for` attribute matches the textarea's `id`.

## Skipped Issues

### WR-03: Fallback UI block duplicated near-verbatim across both editors

**File:** `src/components/ScriptureInput.vue:152-180`, `src/components/CongregationalEditor.vue:20-55`
**Reason:** Deliberately skipped per the task's explicit instruction — the dedup extraction is nice-to-have but adds risk at milestone end (v2.6's last phase), and the review itself marked correctness of the two BLOCKER fixes (CR-01, CR-02) as the priority over this cleanup. Both components' fallback blocks are now individually correct and separately tested (including the new CR-01/CR-02/WR-02/IN-01 regression coverage above), so the duplication is a maintenance cost, not a correctness risk. Accepted as a minor follow-up for a future phase (e.g. a shared `BibleApiOffFallback.vue` or composable, as the review's own fix suggestion outlines) rather than risking a last-minute refactor of two already-fragile paste-handling code paths right after fixing their data-loss bugs.

**Original issue:** The intro paragraph, the "Open in BibleGateway" anchor (including the inline SVG icon markup), and the paste-textarea-with-empty-state block are duplicated almost verbatim between the two components, differing only in which local state the textarea binds to.

## Verification (post-fix gate run, in an isolated worktree)

- `npm run type-check` (`vue-tsc --build`) — clean, zero errors, run twice (once after the source fixes, once after the test-file additions).
- Bare `npx vitest run` (root) — **175/177 test files passed, 4802/4829 tests passed** (26 skipped). The only 2 failing files are the pre-existing documented baselines: `src/storage.rules.test.ts` (Storage-emulator-dependent, documented defect in CLAUDE.md, unrelated to this phase) and `src/stores/appConfig.test.ts` (one pre-existing dot-path-payload assertion mismatch, unrelated to scripture). Neither regressed by this fix pass — the count is 10 tests higher than the pre-fix baseline run (4792 passed), matching the 10 new regression tests added across both component test files.
- `src/components/__tests__/ScriptureInput.test.ts` (49 tests) and `src/components/__tests__/CongregationalEditor.test.ts` (28 tests) — both fully green, including every pre-existing gate-independence test (`INDEPENDENCE: Bible off + AI on`/`Bible off + AI off`) unchanged and passing.
- `firebase deploy` — **not run**, per instructions.

## Invariants preserved (confirmed unchanged post-fix)

- **Gate independence:** `authStore.isAiEnabled` continues to gate ONLY the "Split with AI" button in `CongregationalEditor.vue`; none of the CR-01/CR-02/WR-02 fixes touch or couple it to `authStore.isBibleApiEnabled`. Both pre-existing `INDEPENDENCE` tests remain green unmodified.
- **URL encoding:** `bibleGatewayLink` in `src/utils/scripture.ts` was not touched by this fix pass; `encodeURIComponent` on both the reference and the version remains intact.
- **R300 gating:** `SettingsView.vue`'s Bible Translation card gate was not touched by this fix pass (no findings against it).

---

_Fixed: 2026-08-31_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
