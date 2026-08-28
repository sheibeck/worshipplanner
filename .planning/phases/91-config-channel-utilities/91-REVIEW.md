---
phase: 91-config-channel-utilities
reviewed: 2026-08-28T14:33:20Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/utils/runChannel.ts
  - src/utils/__tests__/runChannel.test.ts
  - src/utils/monitorConfig.ts
  - src/utils/__tests__/monitorConfig.test.ts
  - src/utils/serviceSlots.ts
  - src/utils/__tests__/serviceSlots.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: resolved
fixed_at: 2026-08-28T15:00:00Z
fix_report: 91-REVIEW-FIX.md
---

> **RESOLVED (2026-08-28):** All 7 findings below were fixed by `/gsd-code-review --fix`, one atomic
> commit per finding (`61ecb00c`, `b8ef6fd4`, `a2e08848`, `2bed54c4`, `47b6f14a`, `6459584b`,
> `0d3502be`). See `91-REVIEW-FIX.md` for the full fix report and `91-01-SUMMARY.md`'s
> "Post-Completion: Code Review Fix" section. `npm run type-check` clean; bare `npx vitest run`
> shows only the pre-existing `src/storage.rules.test.ts` baseline failure. Purity greps
> (no vue/firebase/pinia/@/stores imports) re-confirmed clean on all three modules.

# Phase 91: Code Review Report

**Reviewed:** 2026-08-28T14:33:20Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the three pure utility modules from Phase 91-01 (`runChannel.ts`, `monitorConfig.ts`,
`serviceSlots.ts`) and their test files against the plan's contracts, `PITFALLS.md`, and
`slideshowAssembler.ts`'s real ordering. All 33 unit tests pass, `npm run type-check` is clean, and
all three modules are confirmed genuinely framework-free (`grep -nE "^import"` returns no matches in
`runChannel.ts`/`monitorConfig.ts`; `serviceSlots.ts` carries only `import type` lines). None of the
three modules are wired into any Vue component yet (grep across `src/` outside `__tests__` confirms
zero consumers), so every finding below is latent — it will surface once Phases 92-96 actually call
into these modules on a live control/output window.

Core correctness holds up well: `serviceSlots.ts`'s `sortedSlotsWithIndex` is a byte-for-byte
reproduction of `slideshowAssembler.ts`'s own map-then-sort (lines 376-377), confirmed by direct
side-by-side comparison, and the "assembler agreement" test exercises the real `assembleSlideshow`
engine rather than a hand-rolled restatement. `runChannel.ts`'s strictly-greater-than stale-drop is
correct for the tested seq sequences (1,3,2 → 1,3; equal-seq drop). `monitorConfig.ts`'s fingerprint
and `matchMapping` subset logic match the stated contract.

The findings below are two categories: (1) two places where the module's behavior on a REAL browser
API diverges from what the injected test double lets the suite prove (`postMessage` after `close()`;
bare-global `localStorage` access outside the try/catch), and (2) a message-shape validation gap that
lets a malformed `seq` (`NaN`/`Infinity`) permanently defeat the stale-drop guard the threat model
(T-91-02) says protects against replay/tampering.

## Warnings

### WR-01: `seq: NaN` or `seq: Infinity` permanently defeats the stale-drop guard

**Status:** RESOLVED — commit `61ecb00c`

**File:** `src/utils/runChannel.ts:80-89` (shape guard), `:113-117` (stale-drop comparison)
**Issue:** `isRunChannelMessage`'s shape guard only checks `typeof v.seq === 'number'`. In JavaScript
`typeof NaN === 'number'` and `typeof Infinity === 'number'` are both `true`, so a `state` message
shaped `{ type: 'state', index: 0, blackout: false, seq: NaN }` (or `seq: Infinity`) passes shape
validation and reaches the stale-drop comparison at line 115.

- A `seq: NaN` message is *delivered* (since `NaN <= highestDeliveredSeq` is always `false`), and then
  `highestDeliveredSeq` is set to `NaN`. Every subsequent comparison `data.seq <= NaN` is `false`
  forever, so the stale-drop guard is permanently disabled for that handle — an out-of-order/replayed
  message posted afterward would no longer be dropped.
- A `seq: Infinity` message is likewise delivered and sets `highestDeliveredSeq = Infinity`. Every
  subsequent legitimate message (`data.seq <= Infinity` is always `true`) is now dropped forever — a
  silent, permanent denial of updates on that handle.

This directly undermines the mitigation the phase's own threat register claims for T-91-02
("strict-increasing-seq stale-drop discards out-of-order/replayed state"). Since `BroadcastChannel` is
same-origin but delivers to every other same-origin context (any other tab/frame from this app,
including one running attacker-controlled or buggy third-party script under an XSS condition), a
message shaped this way is exactly the kind of malformed/hostile input the shape guard is supposed to
neutralize, and it is not covered by any test in `runChannel.test.ts`.
**Fix:**
```typescript
const v = value as { index?: unknown; blackout?: unknown; seq?: unknown }
return (
  typeof v.index === 'number' && Number.isFinite(v.index) &&
  typeof v.blackout === 'boolean' &&
  typeof v.seq === 'number' && Number.isFinite(v.seq)
)
```
Add a test asserting a `seq: NaN` / `seq: Infinity` message is dropped by the shape guard entirely
(never reaches `onState`, and never mutates `highestDeliveredSeq`).

### WR-02: `postState`/`postHello` on a closed handle will throw in production, unlike the test double

**Status:** RESOLVED — commit `b8ef6fd4`

**File:** `src/utils/runChannel.ts:121-124, 128-131, 135-137`
**Issue:** The real `BroadcastChannel.postMessage()` throws `InvalidStateError` when called after
`close()` (documented MDN/spec behavior). `openRunChannel`'s `postState`/`postHello` call
`channel.postMessage(...)` with no guard against having already called `close()` on that same handle.

The test `close() closes the underlying channel; further posts on that handle do not deliver`
(`runChannel.test.ts:177-191`) passes only because the injected fake channel silently no-ops
`postMessage` when `closed` is `true` (`if (closed) return`) — this is NOT how the native
`BroadcastChannel` behaves, so the test gives false confidence about production robustness. A
plausible real trigger: a control-window component's `onUnmounted` calls `handle.close()`, and a
still-in-flight debounced/queued slide-advance handler calls `postState()` a tick later — that call
throws uncaught, rather than the silent no-op the test implies.
**Fix:** Track a local `closed` flag inside `openRunChannel` and guard the post methods:
```typescript
let closed = false
// ...
postState(state: RunState) {
  if (closed) return
  channel.postMessage({ type: 'state', ...state })
},
postHello() {
  if (closed) return
  channel.postMessage({ type: 'hello' })
},
close() {
  closed = true
  channel.close()
},
```
Also add a test using a fake that throws on `postMessage` after `close()` (matching real
`BroadcastChannel` semantics) to prove the wrapper itself no-ops rather than relying on the fake's
generosity.

### WR-03: `resolveStorage`'s bare `localStorage` reference is outside every try/catch

**Status:** RESOLVED — commit `a2e08848`

**File:** `src/utils/monitorConfig.ts:68-72, 91-99, 107-118`
**Issue:** `saveMapping`/`loadMapping` call `resolveStorage(storageOverride)` *before* entering their
`try` block. `resolveStorage` does `typeof localStorage !== 'undefined'` and then returns the bare
global `localStorage`. In most evergreen desktop browsers merely referencing `window.localStorage`
does not throw, but this is not universal: older Safari private-browsing modes threw on the
`localStorage` *getter itself* (not just on `setItem`/`getItem`), and some current browsers throw a
`SecurityError` on `window.localStorage` access under storage-partitioning/third-party-context
restrictions. If that reference throws, it happens *outside* `saveMapping`/`loadMapping`'s `try`
block, so the exception propagates uncaught — directly contradicting the module's own doc comment
("Wrap EVERY localStorage read/write in try/catch... must never throw") and the phase's T-91-04
mitigation claim ("All localStorage access wrapped in try/catch").

This is also an **untested path**: every test in `monitorConfig.test.ts` passes an explicit
`storageOverride` (`makeMemoryStorage()` / `makeThrowingStorage()`), so `resolveStorage`'s
`typeof localStorage !== 'undefined'` branch — the one path that touches the real global — is never
exercised by any of the 17 tests. The "throwing-storage stub" tests (lines 148-158) prove `setItem`/
`getItem` throws are caught; they do not prove a throw from accessing the `localStorage` global itself
is caught, because they bypass `resolveStorage`'s global-access branch entirely via the override.
**Fix:** Move the entire `resolveStorage` call inside the `try` block (or wrap it in its own
try/catch that returns `undefined` on any throw):
```typescript
function resolveStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined
  } catch {
    return undefined
  }
}
```
Add a test that stubs the global `localStorage` getter to throw (e.g. via
`Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error(...) } })`) and asserts
`saveMapping`/`loadMapping` (called with no `storageOverride`) still don't throw.

### WR-04: `matchMapping` ignores extra/new live screens not present in the saved mapping

**Status:** RESOLVED — commit `2bed54c4` (chose the "make it bidirectional" option; module doc-comment updated)

**File:** `src/utils/monitorConfig.ts:127-131`
**Issue:** `matchMapping` returns `'matched'` whenever every *saved* fingerprint is found among the
*live* fingerprints — it never checks the reverse (whether the live screen set contains a screen not
present in the saved mapping). This matches the plan's literal contract text verbatim ("returns a
matched result... when every saved screen's fingerprint is present among the live screens'
fingerprints"), so it is not a deviation from spec — flagging it here because `PITFALLS.md` Pitfall 2's
stated intent is broader ("re-fetch and diff the CURRENT fingerprint set against the saved one... if it
doesn't [match], force the operator back to the monitor-config screen"). Under the current
implementation, plugging in a genuinely NEW third monitor between two Run launches (a real, common
church-booth scenario — e.g. adding a stage-monitor confidence display for the first time) is silently
treated as `'matched'` because both previously-saved (Audience, Confidence) fingerprints are still
found among the live set; the operator is never re-prompted to consider assigning the new screen.
**Fix:** Confirm with the Phase 92+ plan whether this asymmetry is intentional (a strict subset match
may be fine if the UI always lets the operator manually reassign regardless of `matchMapping`'s
verdict) or whether `matchMapping` should also flag `'needs-reprompt'` when `liveScreens.length !==
savedMapping.assignments.length` / when live fingerprints exist that aren't in the saved set. If
intentional, document the asymmetry explicitly in the module's doc comment so a future reader doesn't
assume symmetric set-equality.

## Info

### IN-01: `onState`/`onHello` support only a single subscriber per handle

**Status:** RESOLVED (documented, not redesigned, per instruction) — commit `47b6f14a`

**File:** `src/utils/runChannel.ts:102-103, 125-127, 132-134`
**Issue:** `stateCallback`/`helloCallback` are single variables, not a list — calling `onState` (or
`onHello`) a second time on the same handle silently discards the previously-registered callback
rather than adding a second subscriber or warning. This matches the plan's described one-callback-per-
handle shape and today's expected one-window-one-handle usage, so it is not a bug against the current
contract, but it is a sharp edge worth documenting (a future consumer that calls `onState` twice on the
same handle — e.g. once for slide navigation and once for a debug logger — will silently lose the
first registration with no error).
**Fix:** Add a one-line doc comment on `RunChannelHandle` noting `onState`/`onHello` each hold at most
one callback, last-registration-wins, no error on overwrite.

### IN-02: Assembler-agreement test never exercises a slot that emits zero slides

**Status:** RESOLVED — commit `6459584b`

**File:** `src/utils/__tests__/serviceSlots.test.ts:95-126`
**Issue:** The `assembler agreement` test's fixture (2 `PRAYER` slots + 1 `SCRIPTURE` slot, all valid)
produces at least one slide for every slot — every slot's `slotIndex` appears in `firstAssembledIndexBySlot`'s
result. `firstAssembledIndexBySlot`'s OWN unit test (`omits a slotIndex with zero assembled slides`,
lines 86-92) proves the zero-slides omission logic against *synthetic* `AssembledSlide[]` fixtures, not
against the real `assembleSlideshow` engine. There is no test that runs a real service containing a
slot guaranteed to emit zero slides (e.g. a `SONG` slot with no `songId`, or a `SCRIPTURE` slot whose
`scriptureRefFromSlot` returns falsy) through `assembleSlideshow` and then confirms
`sortedSlotsWithIndex` still includes that slot's original index (so it can be RENDERED as
non-clickable in the rail) while `firstAssembledIndexBySlot` correctly omits it. The code is
straightforward enough to be correct by inspection (the two functions are independent derivations, one
over `service.slots`, one over the emitted `AssembledSlide[]`), but the specific "real engine + a
genuinely empty slot" combination the task's own `<behavior>` section calls for ("slots that produce
zero slides") is not directly proven end-to-end.
**Fix:** Add a case to the agreement test with an extra `SONG` slot carrying no `songId` (or an
otherwise-empty slot) and assert its original index is present in `sortedSlotsWithIndex`'s output but
absent from `firstAssembledIndexBySlot`'s map.

### IN-03: No test for `service.slots = []` (empty service)

**Status:** RESOLVED — commit `0d3502be`

**File:** `src/utils/__tests__/serviceSlots.test.ts`
**Issue:** Neither `sortedSlotsWithIndex` nor `firstAssembledIndexBySlot` is tested against a
completely empty service/slide array. Both functions are trivially correct on empty input by
inspection (`[].map(...).sort(...)` → `[]`; `[].forEach(...)` → empty `Map`), so this is a minor
coverage gap rather than a suspected bug.
**Fix:** Add a one-line test: `expect(sortedSlotsWithIndex(makeService([]))).toEqual([])` and
`expect(firstAssembledIndexBySlot([])).toEqual(new Map())`.

---

_Reviewed: 2026-08-28T14:33:20Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
