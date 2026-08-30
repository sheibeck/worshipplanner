---
phase: 97-run-service-redesign
plan: 06
subsystem: run-presentation
tags: [vue, presentation, rail, displays, R276]
requires:
  - "src/composables/useRunControl.ts (RailRow type, 97-01)"
provides:
  - "src/components/run/RunRail.vue — the order-of-service rail (pure presentation)"
  - "src/components/run/RunDisplaysPanel.vue — the additive displays cluster + State-C cards"
affects:
  - "97-09 (parent wiring: passes railRows/activeIndex/expandedSlides + per-output open/label)"
tech-stack:
  added: []
  patterns:
    - "props-in/emits-out presentational child; active-row scrollIntoView moved into the child"
key-files:
  created:
    - src/components/run/RunRail.vue
    - src/components/run/RunDisplaysPanel.vue
    - src/components/run/__tests__/RunRail.test.ts
  modified: []
decisions:
  - "RunRail derives active from an activeIndex prop (not RailRow.isActive) so the parent controls it"
  - "Self-scroll owned by RunRail: :ref captures the active row, watch(activeIndex) -> scrollIntoView({block:'nearest'})"
  - "RunDisplaysPanel dots green only when live AND open (owner fix #4: no green pre-live)"
metrics:
  duration: "~20m"
  completed: "2026-08-29"
status: complete
---

# Phase 97 Plan 06: RunRail + RunDisplaysPanel Summary

Two pure-presentation Run children (R276): `RunRail.vue` — the self-scrolling order-of-service rail preserving the control-suite rail testids and expanding the active item to its slides; and `RunDisplaysPanel.vue` — the additive displays cluster with State-C per-output cards and a disabled Stage-off placeholder. Both are props-in/emits-out with no store/channel; the parent (97-09) owns state and navigation.

## What was built

### Task 1 — `RunRail.vue` (+ test) — commit `60527e1b`

Prop contract (import `type RailRow` from `@/composables/useRunControl`):
```ts
defineProps<{
  rows: RailRow[]
  activeIndex: number | null
  expandedSlides?: { arrayIndex: number; label: string; isCurrent: boolean }[]
}>()
defineEmits<{ jump: [slotIndex: number]; 'jump-slide': [arrayIndex: number] }>()
```
- Reproduces the rail markup exactly enough to keep the suite green: `data-testid="rail-item"` on a has-slides row with `:data-active="String(row.index === activeIndex)"`, `data-testid="rail-item-empty"` on an inert no-slides row, `data-testid="run-rail-empty"` ("Nothing to present yet") on the zero-has-slides empty state (mirrors the parent's `firstIndexBySlot.size === 0` via `hasAnySlides = rows.some(r => r.hasSlides)`).
- Active item expands to its slide list (`data-testid="run-rail-slide"`, `:data-current`), each row emitting `@jump-slide(arrayIndex)`; a has-slides row emits `@jump(row.index)`; empty rows are inert (no emit).
- Owns its active-row auto-scroll: a `:ref` callback captures the active row element; `watch(() => props.activeIndex)` → `nextTick()` → `scrollIntoView({ block: 'nearest' })` — the Phase 95 behaviour moved into the child, so the parent no longer needs rail-ref plumbing.
- Nocturne Run-scoped palette (bg `#141624`) with recognisable active-indigo semantics.
- `RunRail.test.ts` (5 tests, `Element.prototype.scrollIntoView` stubbed): active-row marking + title, `@jump(2)` on a has-slides click, empty-row inertness, slide expansion → `@jump-slide(1)`, and the run-rail-empty empty state.

### Task 2 — `RunDisplaysPanel.vue` — commit `21bfa9b6`

Prop contract:
```ts
defineProps<{
  audience: { open: boolean; label: string }
  confidence: { open: boolean; label: string }
  live: boolean
}>()
defineEmits<{ reopen: [role: 'audience' | 'confidence']; manage: [] }>()
```
- `data-testid="run-displays-panel"` with a Manage link (`run-displays-manage` → `@manage`).
- Audience card (`run-display-audience`) + Confidence card (`run-display-confidence`): colorblind-safe dot+word status (green only when `live && open`, else amber/"Not open") and a Reopen button (`run-display-reopen-audience` / `run-display-reopen-confidence` → `@reopen(role)`).
- Disabled Stage placeholder (`run-display-stage-off`, `aria-disabled`, muted "Off", no actions) — no 3rd-output build.
- Renders NONE of the Phase 96 recovery testids (closed-output / reopen / reassign / fallback / blocked / partial) — those stay INLINE in the parent (97-09) so `RunControlView.output.test.ts` stays green.

## Deviations from Plan

None — plan executed as written. (One doc-comment reword in RunDisplaysPanel.vue so the plan's negative grep `! grep -qE "run-reassign-banner|run-output-closed"` passes: the comment no longer contains those literal testid strings.)

## Gate results

- `npm run type-check` (vue-tsc --build, includes test files): **clean**, no errors.
- `npx vitest run` (bare): only `src/storage.rules.test.ts` failing — the documented Storage-emulator baseline (no emulator running here). `RunRail.test.ts` passes (5/5). No other file regressed.
- Testid greps: RunRail has rail-item / rail-item-empty / run-rail-empty / scrollIntoView; RunDisplaysPanel has run-displays-panel / run-display-stage-off / run-display-reopen-audience and NONE of the recovery testids.

## Deferred / out-of-scope

- A transient `RunFilmstrip.vue(22,30)` TS2345 error was observed mid-run (a concurrent wave-2 plan's file, 97-04/05/07); it was resolved by its owning agent before the final gate. Logged in `deferred-items.md`; not touched by 97-06 (disjoint files).

## Self-Check: PASSED

- FOUND: src/components/run/RunRail.vue
- FOUND: src/components/run/RunDisplaysPanel.vue
- FOUND: src/components/run/__tests__/RunRail.test.ts
- FOUND commit: 60527e1b (RunRail)
- FOUND commit: 21bfa9b6 (RunDisplaysPanel)
