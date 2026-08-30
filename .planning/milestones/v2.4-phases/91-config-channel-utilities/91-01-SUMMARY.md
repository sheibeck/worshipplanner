---
phase: 91-config-channel-utilities
plan: 01
subsystem: infra
tags: [broadcastchannel, localstorage, run-mode, pure-utils, tdd]

# Dependency graph
requires:
  - phase: 24-slideshow-assembler-refactor (and later)
    provides: slideshowAssembler.ts's assembleSlideshow / AssembledSlide.slotIndex ordering contract that serviceSlots.ts must agree with
provides:
  - "runChannel.ts: typed BroadcastChannel control->output protocol (openRunChannel/postState/onState/postHello/onHello/close) with a stale-drop seq guard"
  - "monitorConfig.ts: per-device Audience/Confidence monitor role persistence with a stable screen fingerprint and matched/needs-reprompt matching"
  - "serviceSlots.ts: sortedSlotsWithIndex / firstAssembledIndexBySlot, the shared slotIndex <-> first-assembled-slide-index derivation"
affects: [92-run-control-window, 93-run-output-window, 94-run-monitor-assignment, 95-run-rail, 96-run-blackout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure, framework-free src/utils/ modules with an injectable-factory seam for a browser-only primitive (BroadcastChannelLike), mirroring shareTokens.ts/lastUsed.ts."
    - "localStorage read paths treat stored JSON as untrusted input: JSON.parse + shape-validate inside try/catch, returning null rather than throwing or applying an unvalidated shape."

key-files:
  created:
    - src/utils/runChannel.ts
    - src/utils/__tests__/runChannel.test.ts
    - src/utils/monitorConfig.ts
    - src/utils/__tests__/monitorConfig.test.ts
    - src/utils/serviceSlots.ts
    - src/utils/__tests__/serviceSlots.test.ts
  modified: []

key-decisions:
  - "runChannel: seq is caller-owned (control's monotonic counter), never generated inside postState; onState enforces a strictly-greater-than high-water mark per handle."
  - "runChannel: no echo-suppression added — the platform never delivers a context's own broadcast back to itself, so a self-filter would be dead code."
  - "monitorConfig: localStorage key `wp:runMonitorConfig:v1` is a single fixed constant, deliberately unscoped by uid/org (diverges from stores/songs.ts's uid-scoped wp:tagFilter:v2:... precedent) because the mapping describes the physical device, not the account."
  - "monitorConfig: a missing screen label degrades to a fixed 'unlabeled' placeholder in the fingerprint rather than throwing or producing 'undefined' in the string."
  - "serviceSlots: sortedSlotsWithIndex reproduces slideshowAssembler.ts's map-then-sort byte-for-byte (pair with original array index, then sort by position) so slotIndex provenance can never drift from the assembler's own AssembledSlide.slotIndex."

patterns-established:
  - "Injectable BroadcastChannelLike factory: production defaults to the global BroadcastChannel constructor; tests inject a same-name in-memory pub/sub fake, avoiding a dependency on jsdom providing BroadcastChannel."

requirements-completed: []  # Phase 91 maps to no v2.4 requirement by design (enabling infrastructure, per ROADMAP Basis note)

coverage:
  - id: D1
    description: "runChannel.ts provides a typed BroadcastChannel wp-run-{serviceId} state protocol with a strictly-increasing-seq stale-drop guard, unit-tested with an injected channel factory (no Vue/Firebase dependency)."
    verification:
      - kind: unit
        ref: "src/utils/__tests__/runChannel.test.ts (11 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "monitorConfig.ts computes a stable per-screen fingerprint (label+resolution+position+isPrimary) and persists/retrieves a device-scoped Audience/Confidence role mapping from localStorage, tolerating disabled/throwing storage and malformed stored data."
    verification:
      - kind: unit
        ref: "src/utils/__tests__/monitorConfig.test.ts (17 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "serviceSlots.ts resolves slotIndex <-> first-assembled-slide-index consistently with slideshowAssembler.ts, proven against the real assembleSlideshow engine with non-sequential slot positions."
    verification:
      - kind: unit
        ref: "src/utils/__tests__/serviceSlots.test.ts (5 tests, including the assembler-agreement test)"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-08-28
status: complete
---

# Phase 91 Plan 01: Config + Channel Utilities Summary

**Three pure, framework-free TypeScript utility modules — a typed BroadcastChannel control/output protocol with seq-based stale-drop, a device-scoped monitor->role fingerprint/persistence layer, and a slotIndex<->first-assembled-slide lookup proven against the real slideshow assembler — de-risking Run mode's hardest sync/persistence/lookup logic before any window depends on it.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-28T14:00:00Z (approx)
- **Completed:** 2026-08-28T14:26:00Z (approx)
- **Tasks:** 3 (each TDD: RED test commit -> GREEN implementation commit)
- **Files modified:** 6 created (3 modules + 3 test files), plus 1 test-only type-check fix

## Accomplishments
- `src/utils/runChannel.ts`: `openRunChannel(serviceId, factory?)` returning `postState`/`onState`/`postHello`/`onHello`/`close`, with `runChannelName(serviceId)` as the ONE `wp-run-{serviceId}` construction site. `onState` drops any incoming state message whose `seq` is not strictly greater than the highest already delivered on that handle — the reload/re-open-race guard. Message shape is guarded defensively so a malformed broadcast can never throw inside a listener.
- `src/utils/monitorConfig.ts`: `computeFingerprint(screen)` synthesizes a stable string from label+resolution+position+isPrimary; `saveMapping`/`loadMapping` round-trip a `MonitorMapping` through the fixed key `wp:runMonitorConfig:v1` (no uid/org interpolation), with every storage access wrapped in try/catch so private-mode/disabled storage silently no-ops (save) or returns null (load) instead of throwing; `matchMapping(saved, liveScreens)` returns `matched` only when every saved fingerprint is found live, else `needs-reprompt`.
- `src/utils/serviceSlots.ts`: `sortedSlotsWithIndex(service)` pairs each slot with its original array index then sorts a copy by ascending `position` — the identical map-then-sort `slideshowAssembler.ts` performs; `firstAssembledIndexBySlot(slides)` records each `slotIndex`'s first occurrence in the flat array. The assembler-agreement test runs the real `assembleSlideshow` (not a restated ordering) with non-sequential slot positions and confirms every non-empty slot's `firstAssembledIndexBySlot` lookup lands on a slide whose own `slotIndex` matches, and is genuinely the first such slide.

## Task Commits

Each task was committed as a TDD RED/GREEN pair:

1. **Task 1: runChannel.ts**
   - `78b63f56` - test(91-01): add failing test for runChannel typed BroadcastChannel protocol
   - `f676000f` - feat(91-01): implement runChannel typed BroadcastChannel control-output protocol
2. **Task 2: monitorConfig.ts**
   - `7f1d37f0` - test(91-01): add failing test for monitorConfig fingerprint + persistence
   - `399f3297` - feat(91-01): implement monitorConfig device-scoped fingerprint + persistence
3. **Task 3: serviceSlots.ts**
   - `85c2ac06` - test(91-01): add failing test for serviceSlots slotIndex/first-slide lookup
   - `8f90b996` - feat(91-01): implement serviceSlots slotIndex/first-slide lookup
   - `3f075643` - fix(91-01): assert non-null on firstSlide lookup to satisfy vue-tsc strict indexing (Rule 1 auto-fix, found by the `npm run type-check` gate)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/utils/runChannel.ts` - typed BroadcastChannel control->output protocol, injectable channel factory
- `src/utils/__tests__/runChannel.test.ts` - 11 tests against an in-memory fake channel factory
- `src/utils/monitorConfig.ts` - device-scoped monitor->role fingerprint/persistence/match logic
- `src/utils/__tests__/monitorConfig.test.ts` - 17 tests covering fingerprint composition, round-trip, malformed/throwing storage, and matchMapping
- `src/utils/serviceSlots.ts` - sortedSlotsWithIndex / firstAssembledIndexBySlot
- `src/utils/__tests__/serviceSlots.test.ts` - 5 tests including the assembler-agreement test that exercises the real `assembleSlideshow`

## Decisions Made
- runChannel's `seq` counter stays caller-owned; the module only enforces the strictly-greater-than delivery guard, matching the plan's ARCHITECTURE.md precedent (`postState({ index, blackout, seq: seq++ })`).
- No self-echo filtering added to runChannel — verified against ARCHITECTURE.md Pattern 4 and 91-CONTEXT.md that the platform never re-delivers a context's own broadcast, so adding a filter would be dead code that could mask a real bug.
- monitorConfig's storage key is intentionally unscoped by uid/org (`wp:runMonitorConfig:v1`), a deliberate divergence from `stores/songs.ts`'s uid-scoped precedent, because the mapping is a property of the physical device/cable, not the signed-in account (per 91-CONTEXT.md and ARCHITECTURE.md Anti-Pattern 3).
- serviceSlots.ts imports ONLY type-only `Service`/`ServiceSlot`/`AssembledSlide` from `@/types/*` — no runtime coupling to the assembler module itself, keeping the derivation genuinely pure while still provably agreeing with it (proven by importing and running `assembleSlideshow` from the test file, not the module).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vue-tsc strict-indexing error in serviceSlots.test.ts**
- **Found during:** Task 3 phase-level verification (`npm run type-check`)
- **Issue:** `slides[firstSlideArrayIndex as number]` typed as possibly `undefined` under vue-tsc's strict indexed-access checking (TS18048), even though the preceding `expect(...).toBeDefined()` proves it at runtime — TypeScript's control-flow narrowing does not see through a Vitest assertion.
- **Fix:** Added a non-null assertion (`!`) at the indexing site, since the runtime guarantee is already established one line above by the `toBeDefined()` expectation.
- **Files modified:** `src/utils/__tests__/serviceSlots.test.ts`
- **Verification:** `npm run type-check` clean; `npx vitest run src/utils/__tests__/serviceSlots.test.ts` still passes (5/5).
- **Committed in:** `3f075643`

---

**Total deviations:** 1 auto-fixed (1 bug/type-strictness)
**Impact on plan:** Minor, test-only fix required by the phase's own type-check gate (CLAUDE.md mandates `npm run type-check`, which typechecks test files). No scope creep, no production code touched.

## Issues Encountered
None beyond the auto-fixed type-check item above.

## User Setup Required
None - no external service configuration required. Zero new npm dependencies (all three modules use only native browser APIs: `BroadcastChannel`, `localStorage`, `crypto` is not used here).

## Next Phase Readiness
- All three artifacts this phase promised (`runChannel.ts`, `monitorConfig.ts`, `serviceSlots.ts`) exist, are framework-free (verified by `grep -nE "^import"` against each — no `vue`/`firebase`/`@/firebase`/`pinia`/`@/stores` hits), and are unit-tested in isolation with 33 passing tests total.
- `npm run type-check` (vue-tsc --build, which typechecks test files) is clean.
- Bare `npx vitest run`: 158 test files passed, 1 failed — `src/storage.rules.test.ts`, the pre-existing known baseline failure (Storage-emulator `firestore.exists()` cross-service limitation, documented in CLAUDE.md; unrelated to this phase and not chased). No new failures introduced.
- Phases 92-96 (multi-window Run mode) can now build the control/output windows, monitor-assignment UI, and Run rail directly on top of these three primitives without re-deriving the message protocol, persistence, or slot/slide join logic.

## Self-Check: PASSED

- FOUND: src/utils/runChannel.ts
- FOUND: src/utils/__tests__/runChannel.test.ts
- FOUND: src/utils/monitorConfig.ts
- FOUND: src/utils/__tests__/monitorConfig.test.ts
- FOUND: src/utils/serviceSlots.ts
- FOUND: src/utils/__tests__/serviceSlots.test.ts
- FOUND: 78b63f56, f676000f, 7f1d37f0, 399f3297, 85c2ac06, 8f90b996, 3f075643 (all present in `git log --oneline --all`)

---

## Post-Completion: Code Review Fix (91-REVIEW.md, 2026-08-28)

`/gsd-code-review --fix` applied all 7 findings from `91-REVIEW.md` (0 critical, 4 warning, 3 info) as 7 atomic commits, keeping all three modules pure (no vue/firebase/pinia/@/stores imports — reverified after fixes).

- **WR-01** (`61ecb00c`): `isRunChannelMessage`'s shape guard now requires `Number.isFinite` on both `seq` and `index`, closing the `NaN`/`Infinity` seq path that could permanently disable or permanently jam the stale-drop guard. +2 tests.
- **WR-02** (`b8ef6fd4`): `openRunChannel` tracks a `closed` flag; `postState`/`postHello` are safe no-ops after `close()` instead of relying on the test fake's generosity (real `BroadcastChannel.postMessage()` throws `InvalidStateError` post-close). +1 test against a fake that throws on post-close postMessage.
- **WR-03** (`a2e08848`): `resolveStorage`'s bare `localStorage` global-getter reference moved inside its own try/catch, so a browser where merely accessing the getter throws (old Safari private mode, storage-partitioned contexts) still honors the module's "never throws" guarantee. +1 test stubbing a throwing global getter.
- **WR-04** (`2bed54c4`): `matchMapping` is now bidirectional set-equality — a live screen not present in the saved mapping (a newly plugged-in monitor) now also forces `needs-reprompt`, not just a saved screen going missing. Module doc-comment updated to state the bidirectional contract. +1 test.
- **IN-01** (`47b6f14a`): Documented (not redesigned) that `onState`/`onHello` hold at most one callback per handle, last-registration-wins.
- **IN-02** (`6459584b`): Added an assembler-agreement case with a real zero-slide-producing slot (empty `SONG`, no `songId`) run through the actual `assembleSlideshow`, confirming its original index survives in `sortedSlotsWithIndex` but is absent from `firstAssembledIndexBySlot`.
- **IN-03** (`0d3502be`): Added empty-input coverage: `sortedSlotsWithIndex(makeService([]))` and `firstAssembledIndexBySlot([])`.

**Verification after fixes:** `npm run type-check` (vue-tsc --build) clean. Bare `npx vitest run`: 158 files passed, 1 failed (`src/storage.rules.test.ts`, the pre-existing baseline failure — unrelated, not chased). 4496 tests passed (up from the phase's original 33 module-scoped tests to 46 across the three modules' test files, plus the rest of the suite unaffected). No new failures introduced. Purity greps re-confirmed clean on all three modules.

---
*Phase: 91-config-channel-utilities*
*Completed: 2026-08-28*
