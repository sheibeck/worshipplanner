---
phase: 91-config-channel-utilities
verified: 2026-08-28T15:30:00Z
status: passed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 91: Config + Channel Utilities Verification Report

**Phase Goal:** Pure, framework-agnostic utility modules exist for control→output sync, per-device
monitor-role persistence, and service-slot↔slide lookup, so the riskiest sync/persistence logic is
built and unit-tested before any window depends on it.
**Verified:** 2026-08-28T15:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A window can open a typed run channel for a service and send/receive a `{ index, blackout, seq }` state update over `BroadcastChannel` named `wp-run-{serviceId}`. | VERIFIED | `src/utils/runChannel.ts` — `runChannelName()` (line 81-83) is the sole `wp-run-` construction site; `openRunChannel` returns `postState`/`onState`/`postHello`/`onHello`/`close`. Test suite (`runChannel.test.ts`, 14 tests) proves cross-handle delivery via an injected in-memory factory. |
| 2 | An out-of-order or stale state message (seq not strictly greater than the last delivered) is dropped, so a reopened/reloaded output window never regresses to an older slide. | VERIFIED | Lines 111-135: per-handle `highestDeliveredSeq` high-water mark, strict `<=` drop. Post-review fix (WR-01, commit `61ecb00c`) closes the `NaN`/`Infinity` bypass via `Number.isFinite` in the shape guard — proven by tests at lines 215-250 of `runChannel.test.ts` (seq:NaN and seq:Infinity messages dropped, high-water mark uncorrupted). |
| 3 | `computeFingerprint` yields a stable string from label+resolution+position+isPrimary; `matchMapping` reuses a saved assignment silently and flags a genuine layout change as needs-reprompt. | VERIFIED | `monitorConfig.ts` lines 69-72 (`computeFingerprint`), lines 149-155 (`matchMapping`, now bidirectional set-equality per WR-04/commit `2bed54c4` — both a removed AND a newly added live screen force `needs-reprompt`). Tests at lines 107 (missing-label degrades to placeholder), 204-230 (needs-reprompt on removed AND newly-added screen) confirm. |
| 4 | The monitor role mapping persists to and loads from localStorage device-scoped (NOT keyed by uid/org), survives reload, and never throws when storage is unavailable or corrupt. | VERIFIED | `MONITOR_CONFIG_STORAGE_KEY = 'wp:runMonitorConfig:v1'` (line 59) — fixed, no uid/org interpolation. `saveMapping`/`loadMapping` (lines 108-135) wrap all storage access in try/catch; malformed JSON / failed shape-validate returns null. Post-review fix (WR-03, commit `a2e08848`) moved the bare `localStorage` global-getter reference itself inside its own try/catch in `resolveStorage` (lines 82-89) — proven by a test stubbing a throwing `globalThis.localStorage` getter with NO `storageOverride` (lines 167-186 of `monitorConfig.test.ts`), so the previously-untested global-access branch is now genuinely exercised. |
| 5 | serviceSlots resolves each service slot to the index of its FIRST assembled slide, byte-consistent with slideshowAssembler.ts's own position-sort + slotIndex provenance. | VERIFIED | `serviceSlots.ts` lines 34-37 (`sortedSlotsWithIndex`) is a byte-for-byte match of `slideshowAssembler.ts` lines 376-377 (`service.slots.map((slot, index) => ({slot, index}))` then `.sort((a,b) => a.slot.position - b.slot.position)`) — confirmed by direct side-by-side grep of both files. `firstAssembledIndexBySlot` (lines 46-54) records first-occurrence only. The agreement test (`serviceSlots.test.ts`, imports and runs the real `assembleSlideshow` from `@/utils/slideshowAssembler`) proves agreement against the live engine, including a zero-slide-producing slot case (IN-02 fix, commit `6459584b`) and empty-service/empty-array coverage (IN-03, commit `0d3502be`). |
| 6 | All three modules import no Vue, Firebase, or Pinia, and each is covered by an isolated unit test with no Vue/Firebase mount. | VERIFIED | `grep -nE "^import"` on `runChannel.ts` and `monitorConfig.ts` returns zero matches; `serviceSlots.ts` carries only `import type { Service, ServiceSlot } from '@/types/service'` and `import type { AssembledSlide } from '@/types/slide'` (type-only, erased at compile time). All three test files run under plain vitest with in-memory fakes/fixtures, no Vue Test Utils mount, no Firebase emulator. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/runChannel.ts` | Typed BroadcastChannel control→output protocol | VERIFIED | Exists, substantive (160 lines), exports match plan table exactly (`openRunChannel`, `runChannelName`, `RunState`, `RunStateMessage`, `HelloMessage`, `RunChannelMessage`, `BroadcastChannelLike`, `BroadcastChannelFactory`, `RunChannelHandle`). |
| `src/utils/__tests__/runChannel.test.ts` | Isolated unit test | VERIFIED | 14 tests, all passing. |
| `src/utils/monitorConfig.ts` | Per-device monitor→role persistence + fingerprint | VERIFIED | Exists, substantive (156 lines), exports `computeFingerprint`, `saveMapping`, `loadMapping`, `matchMapping`, `MONITOR_CONFIG_STORAGE_KEY`, plus `ScreenLike`/`MonitorRole`/`MonitorAssignment`/`MonitorMapping`/`MatchResult` types. |
| `src/utils/__tests__/monitorConfig.test.ts` | Isolated unit test | VERIFIED | 19 tests, all passing. |
| `src/utils/serviceSlots.ts` | slotIndex↔first-assembled-slide-index lookup | VERIFIED | Exists, substantive (54 lines), exports `sortedSlotsWithIndex`, `firstAssembledIndexBySlot`, `IndexedServiceSlot`. |
| `src/utils/__tests__/serviceSlots.test.ts` | Isolated unit test, assembler-agreement case | VERIFIED | 8 tests, all passing; imports and runs real `assembleSlideshow`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `serviceSlots.ts` | `slideshowAssembler.ts` | Ordering agreement (map-then-sort) | WIRED | Confirmed byte-for-byte identical logic by direct comparison of lines 34-37 vs. lines 376-377; agreement test imports and calls the real `assembleSlideshow`, not a restated ordering. |
| `runChannel.ts` channel name | Per-service scoping | `wp-run-{serviceId}` template, single construction site | WIRED | Only `runChannelName()` builds the string; grep confirms no second hard-coded `wp-run-` literal. |
| `monitorConfig.ts` storage key | Device-scoped constant | `wp:runMonitorConfig:v1`, no uid/org interpolation | WIRED | Test asserts exact key string; grep of the module shows no template placeholder for uid/org. |

Note: as expected for this phase (enabling infrastructure consumed by Phases 92-96, none of which
have executed yet), a repo-wide grep for `runChannel`/`monitorConfig`/`serviceSlots` outside
`src/utils/*.ts` and `__tests__/` found zero Vue-component consumers. This is NOT a gap — the phase
goal is explicitly "before any window depends on it," and Phase 92+ is where wiring into UI happens.

### Requirements Coverage

Phase 91 maps to no v2.4 requirement by design (ROADMAP Basis note: enabling infrastructure). No
orphaned requirements found in `.planning/REQUIREMENTS.md` for Phase 91. This is correct, not a gap.

### Anti-Patterns Found

`grep -nE "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` across all three modules and their test files: zero
matches (the one hit, `UNLABELED_PLACEHOLDER` in `monitorConfig.ts`, is a legitimate constant
identifier for the documented missing-label fallback behavior, not a debt marker or stub).

No empty-implementation patterns (`return null`/`return {}`/`=> {}`), no hardcoded-empty-data stubs
flowing to output, no console.log-only implementations found in any of the three modules.

### Code Review Fix Verification (91-REVIEW.md → 91-REVIEW-FIX.md)

All 7 findings (0 critical, 4 warning, 3 info) independently re-verified fixed in the current source,
not merely claimed in the fix report:

| Finding | Fix verified in source | Fix verified in tests |
|---------|------------------------|------------------------|
| WR-01 (NaN/Infinity seq bypass) | `Number.isFinite` checks at `runChannel.ts:93-97` | 2 tests, lines 215-250 of `runChannel.test.ts` |
| WR-02 (post-close throw) | `closed` flag guards `postState`/`postHello`, `runChannel.ts:117-121,139-151` | Test at line 193, fake that throws on post-close postMessage |
| WR-03 (bare localStorage getter outside try/catch) | `resolveStorage` wraps getter access in own try/catch, `monitorConfig.ts:82-89` | Test lines 167-186, `globalThis.localStorage` throwing getter, no `storageOverride` |
| WR-04 (matchMapping one-directional) | Bidirectional set-equality, `monitorConfig.ts:149-155` | Test lines 214-230, newly-added live screen forces needs-reprompt |
| IN-01 (single-callback documented) | Doc comment on `RunChannelHandle`, `runChannel.ts:61-67` | N/A (docs-only, no behavior change) |
| IN-02 (zero-slide slot in agreement test) | N/A (test-only) | `makeEmptySongSlot`/`songId: null` case, `serviceSlots.test.ts:37-43,151+` |
| IN-03 (empty-service coverage) | N/A (test-only) | Lines 84, 113 of `serviceSlots.test.ts` |

All 7 fix commits (`61ecb00c`, `b8ef6fd4`, `a2e08848`, `2bed54c4`, `47b6f14a`, `6459584b`, `0d3502be`)
and all 7 original TDD commits (`78b63f56`, `f676000f`, `7f1d37f0`, `399f3297`, `85c2ac06`, `8f90b996`,
`3f075643`) confirmed present in `git log --oneline --all`.

### Gate Results (independently re-run, not trusted from SUMMARY)

- **`npm run type-check`** (`vue-tsc --build`, typechecks test files per CLAUDE.md): clean, no output.
- **Bare `npx vitest run`** (full suite, run fresh — not reused from SUMMARY): 157 passed / 1 failed
  test file, 4395 tests passed, 26 skipped. The single failure is `src/storage.rules.test.ts`
  (`ECONNREFUSED 127.0.0.1:8080` — no local Firestore emulator running), the documented pre-existing
  baseline failure per CLAUDE.md. No new failures introduced by this phase.
- **Scoped run** of the three new test files (`runChannel.test.ts`, `monitorConfig.test.ts`,
  `serviceSlots.test.ts`): 3 files, 41 tests, all passing (14 + 19 + 8, matching SUMMARY's claimed
  post-fix counts exactly).
- **Purity greps** (independently re-run): `runChannel.ts` and `monitorConfig.ts` have zero `^import`
  lines; `serviceSlots.ts` has only two `import type` lines. No `vue`/`firebase`/`@/firebase`/`pinia`/
  `@/stores` reference anywhere in any of the three modules.

### Human Verification Required

None. All must-haves are pure-logic assertions provable by static analysis and unit test — no
UI/visual/real-time/external-service behavior in scope for this phase.

### Gaps Summary

None. All 6 observable truths verified, all 6 artifacts present/substantive, all 3 key links wired,
both phase-level gates (`type-check`, `vitest run`) independently reproduced clean against the
documented baseline, and all 7 code-review findings independently confirmed fixed in source (not just
claimed in the review-fix report).

---

_Verified: 2026-08-28T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
