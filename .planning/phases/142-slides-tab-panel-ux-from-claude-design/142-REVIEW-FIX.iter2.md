---
phase: 142-slides-tab-panel-ux-from-claude-design
fixed_at: 2026-09-19T07:03:56Z
review_path: .planning/phases/142-slides-tab-panel-ux-from-claude-design/142-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 142: Code Review Fix Report

**Fixed at:** 2026-09-19T07:03:56Z
**Source review:** .planning/phases/142-slides-tab-panel-ux-from-claude-design/142-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (`fix_scope: critical_warning`): 1 (0 critical, 1 warning)
- Fixed: 1
- Skipped: 0

Two Info-tier findings (IN-01, IN-02) were present in REVIEW.md but are out of scope for
`critical_warning` and were intentionally not touched — see "Out of Scope" below.

## Fixed Issues

### WR-01: Open popover survives `editable` flipping to `false` mid-session, leaving dead-end interactive controls

**Files modified:** `src/components/slides/SlideGroupSetupStrip.vue`, `src/components/slides/__tests__/SlideGroupSetupStrip.test.ts`
**Commit:** 38adec2e
**Applied fix:**

- Gated the popover's own `v-if` on `openChip === chip.id && editable` (in addition to the existing
  chip-button `v-if="editable"` / `v-else` inert-span split), so the popover can no longer stay mounted
  once `editable` goes `false` while it happens to be open.
- Added `watch(() => props.editable, (editable) => { if (!editable) close() })`, mirroring the existing
  `selectedSlot.id` watcher's reset precedent (ADR-0115), so a lock landing mid-open force-closes the
  popover — which also drains the `pointerdown`/`keydown` listeners via the existing `openChip` watcher's
  `else` branch, and avoids the orphaned-Storage-upload scenario the review described (an in-flight
  Background/Track upload can no longer be kicked off through a stale, already-unlocked popover).
- Left the child controls' hardcoded `:editable="true"` / `is-editor="true"` as-is (per the existing
  code comment) — with the popover itself now gated on `editable`, that invariant is enforced by the
  parent `v-if` rather than by convention alone, which was the review's suggested minimal fix.
- Added a regression test, `'editable flipping to false while a popover is open closes it and removes
  its listeners (WR-01)'`, in the "popover lifecycle" describe block: opens the Audio popover via
  `wrapper.setProps`-driven click, then flips `editable` from `true` to `false` via
  `wrapper.setProps({ editable: false })`, and asserts (a) the popover unmounts and (b) the
  `document`/`window` `pointerdown`/`keydown` listeners were removed exactly once, using the same
  `removeEventListener` spy pattern as the existing open/close-listener-accounting test.

**Verification:**
- `npx vitest run src/components/slides/__tests__/SlideGroupSetupStrip.test.ts src/components/slides/__tests__/SlideGrid.test.ts` — 175 tests passed (2 files), including the new regression test.
- `npm run type-check` (`vue-tsc --build`) — clean, no errors.
- Tier 1: re-read the modified template/script sections after editing; fix text present, surrounding code intact.

## Skipped Issues

None — the single in-scope finding (WR-01) was fixed.

## Out of Scope (not attempted, per `fix_scope: critical_warning`)

### IN-01: `SlidesTab.vue`'s `recentBackgrounds` sort reimplements ad-hoc Firestore-timestamp coercion instead of the existing safe helper

**File:** `src/components/slides/SlidesTab.vue:276-278`
Not attempted — Info-tier, outside `critical_warning` fix scope. Review notes this is a
maintainability/consistency note, not a functional bug (production `updatedAt` is always a real Firestore
`Timestamp`).

### IN-02: Watcher comment assumes popover transitions always pass through `null`, which is false

**File:** `src/components/slides/SlideGroupSetupStrip.vue:310-323`
Not attempted — Info-tier, outside `critical_warning` fix scope. Review states no functional fix is
required; the duplicate-listener-registration case is a documented no-op today.

---

_Fixed: 2026-09-19T07:03:56Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
