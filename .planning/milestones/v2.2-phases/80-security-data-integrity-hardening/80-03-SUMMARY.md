---
phase: 80-security-data-integrity-hardening
plan: 03
subsystem: slides
tags: [vue, slide-groups, data-integrity, ui-guard, client-only]

# Dependency graph
requires:
  - phase: 30-slide-materializer-rebuild
    provides: "rebuildSongGroup, the per-slot rebuild engine (Phase 30 W-03 defect location)"
provides:
  - "rebuildSongGroup clears a removed song's slides (changed:true, slides:[]) instead of returning stale slides, staying idempotent on an already-empty group (R235)"
  - "EditSlideDrawer.vue reads renderState and blocks all customization (canMutate + canMutateBackground) with an amber aria-live notice while a slide's render is pending (R236)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent clear-on-removal branch: gate changed:true on group.slides.length > 0, matching rebuildScriptureGroup's CLEARED REFERENCE idiom"
    - "Single-notice-slot precedence encoded as one computed/ternary chain (pending-render > song-group > serviceLocked), never stacked independent v-ifs"

key-files:
  created: []
  modified:
    - src/utils/slideGroupMaterializer.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts
    - src/components/slides/EditSlideDrawer.vue
    - src/components/slides/__tests__/EditSlideDrawer.test.ts

key-decisions:
  - "R235 fix is entirely local to rebuildSongGroup's !songId branch — no cross-slot query needed, since SlideGroup.id === slot.id already isolates a reprise's two occurrences into independent documents."
  - "R236: isPendingRender composes into BOTH canMutate and canMutateBackground (not just canMutate) — a background attach/remove/override is a per-slide customization the locked copy's 'customizing' wording covers too (RESEARCH Pitfall 6 / Assumption A1)."
  - "Notice precedence: pending-render wins over serviceLocked when both hold (more specific, more actionable); isSongGroup vs pending never co-occurs (mutually exclusive slot kinds), so the pre-existing song-group-wins-over-locked precedence is preserved unchanged."

requirements-completed: [R235, R236]

coverage:
  - id: D1
    description: "rebuildSongGroup clears a non-empty stored group to changed:true/slides:[] when the slot's song is removed (rewritten bug-lock test, Phase 30 W-03 flipped)"
    requirement: R235
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#R235: a removed song (songId cleared) empties a non-empty stored group"
        status: pass
    human_judgment: false
  - id: D2
    description: "rebuildSongGroup stays idempotent (changed:false) when a slot with no song meets an already-empty group"
    requirement: R235
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#R235: clearing an already-empty group is idempotent (changed: false)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two slots referencing the same songId hold independent SlideGroup objects (keyed by slot.id); clearing one slot's song empties only that slot's group, leaving the other (still-assigned) slot's group untouched"
    requirement: R235
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#R235: reprise-safe — clearing one slot's song leaves the other slot's group (same songId) untouched"
        status: pass
    human_judgment: false
  - id: D4
    description: "A renderState:'pending' slide shows the amber aria-live=\"polite\" notice with the locked copy verbatim"
    requirement: R236
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts#EditSlideDrawer - pending-render edit guard (R236) > renders the amber aria-live pending-render notice with the locked copy"
        status: pass
    human_judgment: false
  - id: D5
    description: "A pending-render slide disables both canMutate-gated controls (e.g. footer actions) and canMutateBackground-gated controls (background attach)"
    requirement: R236
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts#EditSlideDrawer - pending-render edit guard (R236) > disables customization (canMutate-gated AND canMutateBackground-gated controls) while pending"
        status: pass
    human_judgment: false
  - id: D6
    description: "When serviceLocked AND renderState:'pending' co-occur, only the pending-render notice renders (single notice slot, pending wins)"
    requirement: R236
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts#EditSlideDrawer - pending-render edit guard (R236) > pending-render wins the single notice slot when serviceLocked also holds"
        status: pass
    human_judgment: false
  - id: D7
    description: "A ready/undefined renderState slide shows no pending-render notice and controls behave exactly as today"
    requirement: R236
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts#EditSlideDrawer - pending-render edit guard (R236) > a ready (renderState undefined) slide shows no pending-render notice and behaves exactly as today"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-08-24
status: complete
---

# Phase 80 Plan 03: Reprise-Safe Slide Clear + Pending-Render Edit Guard Summary

**Fixed `rebuildSongGroup`'s stale-slides-on-removal bug (R235, reprise-safe by construction) and added a pending-render customization block in `EditSlideDrawer.vue` (R236), both client-only.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-24T08:00:00Z (approx)
- **Completed:** 2026-08-24T08:25:00Z (approx)
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `rebuildSongGroup`'s `!songId` early return now clears a non-empty group (`changed: true, slides: []`) instead of returning the stale stored slides forever, closing the Phase 30 W-03 orphaned-slides defect (backlog 999.2). Stays idempotent (`changed: false`) on an already-empty group.
- Reprise-safety proven directly: two independent `SlideGroup` objects for two slots referencing the same `songId` — clearing one slot's song empties only that slot's group; the other, still-assigned slot's group is untouched, because groups are keyed 1:1 by `slot.id`.
- Rewrote the Phase 30 bug-lock test at `slideGroupMaterializer.test.ts:686-694` (previously asserting the stale-slides bug) to assert the fixed clear-on-removal behavior; added the idempotence case and the two-slot reprise-independence probe (the Wave 0 gap RESEARCH flagged).
- `EditSlideDrawer.vue` now reads `assembledSlide.slide.renderState` via a new `isPendingRender` computed, composed into both `canMutate` (label/notes/body/audio/duplicate/delete) and `canMutateBackground` (background attach/remove/override) — a pending-render slide's customization is fully blocked, including its background.
- Amber, `aria-live="polite"` inline notice with the locked copy verbatim, reusing the app's existing amber-notice styling (`border-amber-800 bg-amber-950 text-amber-200`). Notice precedence made explicit: pending-render wins the single notice slot over `serviceLocked` (the two axes can co-occur); `isSongGroup` and pending-render cannot co-occur, so the pre-existing song-group-wins-over-locked precedence is unchanged.
- A ready/undefined `renderState` slide is byte-for-byte unchanged from today, proven by a dedicated regression test.

## Task Commits

Each task was committed atomically:

1. **Task 1: Clear a removed song's slides, reprise-safe (R235)** - `15ec1cc8` (fix)
2. **Task 2: Pending-render edit guard in EditSlideDrawer (R236)** - `e57b756b` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/utils/slideGroupMaterializer.ts` - `rebuildSongGroup`'s `!songId` branch now clears a non-empty group and stays idempotent on an empty one; no other rebuild function or caller signature touched
- `src/utils/__tests__/slideGroupMaterializer.test.ts` - Rewrote the bug-lock test to assert the clear; added idempotence and two-slot reprise-independence cases
- `src/components/slides/EditSlideDrawer.vue` - New `isPendingRender` computed; composed into `canMutate` and `canMutateBackground`; new amber `aria-live="polite"` notice with explicit single-slot precedence (pending-render > song-group > serviceLocked)
- `src/components/slides/__tests__/EditSlideDrawer.test.ts` - New `describe('EditSlideDrawer - pending-render edit guard (R236)')` block: notice copy/aria-live, canMutate+canMutateBackground disabling, precedence-over-serviceLocked, and a dedicated ready-state regression

## Decisions Made
- R235's fix stays entirely inside `rebuildSongGroup` — no cross-slot query, per RESEARCH's explicit "Anti-Pattern to Avoid" (slide groups are already keyed 1:1 by `slot.id`, so a per-slot fix cannot cross-contaminate a reprise).
- R236's `isPendingRender` was composed into `canMutateBackground` as well as `canMutate`, resolving RESEARCH's Assumption A1 explicitly in favor of gating the background too — the locked copy's "customizing" wording is broad enough to cover it, and leaving background attach live on a pending-render slide would be an inconsistent half-fix.
- Notice precedence (RESEARCH Open Question) resolved as: pending-render wins over serviceLocked. Encoded as a single ternary chain in one `v-if`/`:class`/`:data-testid`/text binding, never two independent `v-if`s that could theoretically both render.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` blocks precisely (exact line locations, exact idiom reuse, exact locked copy).

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. Both changes are client-only, no deploy.

## Next Phase Readiness

Phase 80 (80-01, 80-02, 80-03) is now fully executed: R232/R233 (rules, built+tested+UNDEPLOYED per deploy hand-over discipline), R234 (deleteService cascade), R235/R236 (this plan) are all complete. No blockers for the next phase.

Verification performed beyond the two task-scoped gates:
- `npx vitest run` (full app suite): 2 failed files / 26 failed tests — exactly the documented known-failing baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`), 4160 passed. Unaffected by this plan.
- `npm run type-check` (`vue-tsc --build`): clean.

---
*Phase: 80-security-data-integrity-hardening*
*Completed: 2026-08-24*

## Self-Check: PASSED

All 4 modified files and both task commits (15ec1cc8, e57b756b) verified present.
