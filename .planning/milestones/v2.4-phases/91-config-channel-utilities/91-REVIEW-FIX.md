---
phase: 91-config-channel-utilities
fixed_at: 2026-08-28T15:00:00Z
review_path: .planning/phases/91-config-channel-utilities/91-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 91: Code Review Fix Report

**Fixed at:** 2026-08-28T15:00:00Z
**Source review:** .planning/phases/91-config-channel-utilities/91-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (0 critical, 4 warning, 3 info — `fix_scope: all`)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### WR-01: `seq: NaN` or `seq: Infinity` permanently defeats the stale-drop guard

**Files modified:** `src/utils/runChannel.ts`, `src/utils/__tests__/runChannel.test.ts`
**Commit:** `61ecb00c`
**Applied fix:** `isRunChannelMessage`'s shape guard now requires `Number.isFinite(v.index)` and `Number.isFinite(v.seq)` in addition to the existing `typeof === 'number'` checks, so a `NaN`/`Infinity` seq is rejected at the shape-guard stage and never reaches the stale-drop comparison. Added two tests: a `seq: NaN` message and a `seq: Infinity` message are each ignored (never delivered to `onState`) and do not corrupt `highestDeliveredSeq` — a subsequent legitimate message still delivers correctly.

### WR-02: `postState`/`postHello` on a closed handle will throw in production, unlike the test double

**Files modified:** `src/utils/runChannel.ts`, `src/utils/__tests__/runChannel.test.ts`
**Commit:** `b8ef6fd4`
**Applied fix:** `openRunChannel` now tracks a local `closed` flag, set `true` in `close()`. `postState`/`postHello` check the flag first and no-op (return without calling `channel.postMessage`) once closed, rather than relying on the injected fake's generosity. Added a test using a fake whose `postMessage` throws (mirroring real `BroadcastChannel` post-close semantics) that asserts posting after `close()` neither throws nor reaches `postMessage`.

### WR-03: `resolveStorage`'s bare `localStorage` reference is outside every try/catch

**Files modified:** `src/utils/monitorConfig.ts`, `src/utils/__tests__/monitorConfig.test.ts`
**Commit:** `a2e08848`
**Applied fix:** `resolveStorage` now wraps its `typeof localStorage !== 'undefined' ? localStorage : undefined` access in its own try/catch, returning `undefined` on any throw. Added a test that stubs `globalThis.localStorage` with a throwing getter (`Object.defineProperty`) and calls `saveMapping`/`loadMapping` with NO `storageOverride` (so `resolveStorage`'s real global-access branch is genuinely exercised, not bypassed), asserting neither throws and `loadMapping()` returns `null`.

### WR-04: `matchMapping` ignores extra/new live screens not present in the saved mapping

**Files modified:** `src/utils/monitorConfig.ts`, `src/utils/__tests__/monitorConfig.test.ts`
**Commit:** `2bed54c4`
**Applied fix:** Resolved the ambiguity by choosing "make `matchMapping` bidirectional" (per the review's own preferred interpretation of PITFALLS Pitfall 2's broader intent, and since Phase 92+ plans were not available to consult). `matchMapping` now also checks that every LIVE screen's fingerprint is present in the saved set; a live screen absent from the saved mapping (a newly plugged-in monitor) now also triggers `needs-reprompt`. Module-level doc-comment updated to state the bidirectional contract explicitly. Added a test: 2 saved screens + a live set containing both plus a genuinely new 3rd screen → `needs-reprompt`.

### IN-01: `onState`/`onHello` support only a single subscriber per handle

**Files modified:** `src/utils/runChannel.ts`
**Commit:** `47b6f14a`
**Applied fix:** Documented (not redesigned, per the finding's own note that this matches today's contract) — added a doc-comment on `RunChannelHandle` stating `onState`/`onHello` each hold at most one callback, last-registration-wins, no error on overwrite.

### IN-02: Assembler-agreement test never exercises a slot that emits zero slides

**Files modified:** `src/utils/__tests__/serviceSlots.test.ts`
**Commit:** `6459584b`
**Applied fix:** Added a `makeEmptySongSlot` fixture helper (a `SONG` slot with `songId: null`, which `slideshowAssembler.ts` is confirmed to emit zero slides for) and a new assembler-agreement case combining a normal `PRAYER` slot with the empty `SONG` slot through the real `assembleSlideshow`. Asserts the empty slot's original index survives in `sortedSlotsWithIndex`'s output (so it can render as non-clickable in the rail) while being correctly absent from `firstAssembledIndexBySlot`'s map and from every emitted slide's `slotIndex`.

### IN-03: No test for `service.slots = []` (empty service)

**Files modified:** `src/utils/__tests__/serviceSlots.test.ts`
**Commit:** `0d3502be`
**Applied fix:** Added `sortedSlotsWithIndex(makeService([]))` → `[]` and `firstAssembledIndexBySlot([])` → `new Map()` coverage.

## Skipped Issues

None — all 7 in-scope findings were fixed.

## Gate Results (post-fix)

- **Purity greps:** `grep -nE "^import" src/utils/runChannel.ts` and `monitorConfig.ts` → no matches. `serviceSlots.ts` → only `import type` lines (`Service`/`ServiceSlot`/`AssembledSlide`). No vue/firebase/pinia/@/stores imports in any of the three pure modules — confirmed unchanged after fixes.
- **`npm run type-check`** (`vue-tsc --build`, typechecks test files per CLAUDE.md): clean, no output.
- **Bare `npx vitest run`** (in an isolated worktree with `node_modules`/`functions/node_modules` junctioned from the main checkout, per CLAUDE.md's worktree `.env.local` note extended to `node_modules`): 158 test files passed, 1 failed — `src/storage.rules.test.ts` only, the documented pre-existing baseline failure (Storage-emulator `firestore.exists()` cross-service limitation; not chased per CLAUDE.md). 4496 tests passed, 26 skipped. **No new failures introduced.**
- Module test counts after fixes: `runChannel.test.ts` 11 → 14 tests, `monitorConfig.test.ts` 17 → 19 tests, `serviceSlots.test.ts` 5 → 8 tests (33 → 41 tests across the three modules).

---

_Fixed: 2026-08-28T15:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
