# Phase 91: Config + Channel Utilities - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning
**Mode:** Auto-generated for autonomous run (discuss skipped; distilled from `.planning/research/` — STACK.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md)

<domain>
## Phase Boundary

Build three PURE, framework-agnostic TypeScript utility modules (no Vue, no Firebase, no Pinia,
no DOM-rendering) that the multi-window Run mode (Phases 92–96) will consume. Each is independently
unit-testable. This phase writes and tests the riskiest sync/persistence logic BEFORE any window
depends on it. Maps to no v2.4 requirement by design (enabling infrastructure).

IN SCOPE — three modules under `src/utils/`:
1. `runChannel.ts` — a typed `BroadcastChannel` control→output protocol.
2. `monitorConfig.ts` — per-device monitor→role persistence with a stable screen fingerprint.
3. `serviceSlots.ts` — the `slotIndex` ↔ first-assembled-slide-index lookup.

OUT OF SCOPE: any Vue component, window, route, permission prompt, or actual Window Management API
call (enumeration/fullscreen live in Phases 92+). This phase does not open windows — it defines the
message protocol and the config/lookup logic those windows will use.
</domain>

<decisions>
## Implementation Decisions (from research — verify exact signatures during plan-phase)

### `runChannel.ts` (STACK.md, ARCHITECTURE.md control-channel section, PITFALLS 10–12)
- Uses the native `BroadcastChannel`. Channel name is **scoped per service**: `wp-run-{serviceId}`.
- Message protocol is **one-directional in effect**: the control window posts `state` messages
  `{ type: 'state', index: number, blackout: boolean, seq: number }`; output windows post only a
  `hello` message on (re)mount so the control window can re-send current state to a freshly-opened or
  reloaded output. Control is the single writer of `state`.
- `seq` is a monotonically increasing counter so a stale/out-of-order message can be ignored (guards
  the reload/re-open race, PITFALLS 10–11). NOTE: `Date.now()`/`Math.random()` are fine in real app
  runtime code — the GSD-script restriction does NOT apply to `src/`; but the module must be testable,
  so expose the channel/seq in a way tests can drive deterministically (e.g. inject the seq source or
  the `BroadcastChannel` factory).
- The platform never delivers a context's own broadcast back to itself — rely on this to avoid feedback
  loops (do NOT add an echo-suppression hack). Provide a thin typed wrapper: `open(serviceId)`,
  `postState(state)`, `onState(cb)`, `postHello()`, `onHello(cb)`, `close()`.

### `monitorConfig.ts` (STACK.md persistence, ARCHITECTURE.md per-device config, PITFALLS 2/3)
- Persists an Audience/Confidence role→screen mapping in **`localStorage`**, NOT Firestore (this
  describes the physical cable at a device, not an org/user preference). Deliberately **UNSCOPED** by
  uid/orgId (unlike the `wp:tagFilter:v2:...` precedent in `stores/songs.ts` which IS uid-scoped) —
  the monitor wiring belongs to the device.
- Screen `label`/id is NOT a stable hardware fingerprint across replug/data-clear. Compute a synthesized
  fingerprint from `label` + resolution (`width`x`height`) + position (`left`,`top`) + `isPrimary`.
- Provide: `computeFingerprint(screen)`, `saveMapping(mapping)`, `loadMapping()`, and a
  `matchMapping(savedMapping, liveScreens)` that returns matched/needs-reprompt so a Run launch reuses
  the saved assignment silently and only re-prompts on a genuine layout mismatch (R268 behavior; the
  screen objects are passed in — the module does NOT call `getScreenDetails()` itself, keeping it pure
  and testable).
- Wrap all `localStorage` reads/writes in try/catch (private mode / disabled storage must not throw).

### `serviceSlots.ts` (ARCHITECTURE.md Pattern 3, FEATURES.md dependency notes)
- `AssembledSlide.slotIndex` (stamped by `slideshowAssembler.ts`) is the join between the order-of-service
  rail and the flat slide array. Provide `sortedSlotsWithIndex(service)` and
  `firstAssembledIndexBySlot(slides)` (or equivalent) that resolve, for a given service slot, the index
  of its FIRST `AssembledSlide` — consistent with `slideshowAssembler.ts`'s own ordering. Must agree
  byte-for-byte with the assembler (read it; do not re-derive a second ordering — CLAUDE.md's
  two-orderings-disagree warning).

### Claude's Discretion
Exact function names, file organization, and test structure are at Claude's discretion — match existing
`src/utils/` conventions (e.g. `shareTokens.ts`, `lastUsed.ts` as pure-module analogs) and the closest
localStorage precedent the pattern-mapper surfaces.
</decisions>

<code_context>
## Existing Code Insights (verify during plan-phase)
- `src/utils/slideshowAssembler.ts` — pure `service → AssembledSlide[]`; `serviceSlots.ts` must agree
  with its ordering. `AssembledSlide.slotIndex` is the original `service.slots` array index.
- `src/utils/shareTokens.ts`, `src/utils/lastUsed.ts` — existing pure, dependency-free util modules to
  mirror for structure and test style.
- `src/stores/songs.ts` — has a `wp:tagFilter:v2:...` localStorage precedent (uid-scoped). `monitorConfig`
  mirrors the localStorage mechanics but is deliberately device-scoped (unscoped by uid/org).
- `src/types/slide.ts` — `AssembledSlide` (`slotIndex`, `section`, `groupId`).
</code_context>

<specifics>
## Verification
- All three modules are unit-tested in isolation with NO Vue/Firebase mount (success criteria explicitly
  require framework-free tests). Use a mockable `BroadcastChannel` (jsdom provides one; or inject a
  factory) and a mockable/clearable `localStorage`.
- Gates per CLAUDE.md: `npm run type-check` (vue-tsc --build) and bare `npx vitest run` (baseline:
  `src/storage.rules.test.ts` only — do not chase).
</specifics>

<deferred>
## Deferred Ideas
- Actual monitor enumeration (`getScreenDetails()`), permission prompts, and window opening → Phase 92+.
- The `blackout` field is carried in the protocol now but only EXERCISED once a blackout affordance
  exists; v2.4 defers the blackout button, so `blackout` may remain a protocol field with no UI driver
  this milestone (harmless; keeps the protocol forward-compatible). Do not build blackout UI here.
</deferred>
