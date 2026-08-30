---
phase: 94-confidence-monitor-output
plan: 02
subsystem: presentation-output
tags: [confidence-monitor, output-window, vue, router, suppress-background]
requires:
  - "94-01: useOutputWindow composable + AudienceOutputView refactor"
provides:
  - "ConfidenceOutputView.vue — band-facing current+next 70/30 stage-reference window"
  - "/present/confidence/:serviceId route (name confidence-output, requiresAuth only)"
affects:
  - "src/router/index.ts (new authed route)"
  - "Phase 95 will open + place this window on the assigned monitor"
tech-stack:
  added: []
  patterns:
    - "Reuse-not-fork: consume shared useOutputWindow for all lifecycle/chrome, diverge only in render body"
    - "SlideCanvas suppressBackground=true (Phase 90's first real consumer) forces backgrounds to black"
    - "Vertical flex 70/30 split with fixed regions (no collapse) to prevent last-slide reflow"
key-files:
  created:
    - src/views/ConfidenceOutputView.vue
  modified:
    - src/router/index.ts
decisions:
  - "Region wrappers carry stable data-testids (confidence-current-region / confidence-next-region) so wave-3's no-reflow test asserts by testid, not brittle Tailwind classes"
  - "Next pane is a STATIC preview with no canvas ref — never play()'d — so the band never hears/sees upcoming media"
  - "Last slide keeps the next region present (black, tag hidden) rather than collapsing, to avoid jump-resizing the current pane"
metrics:
  duration: ~15m
  completed: 2026-08-28
status: complete
---

# Phase 94 Plan 02: Confidence Monitor Output View Summary

Built `ConfidenceOutputView.vue` — the worship band's glanceable stage-reference window — as the sibling of Phase 93's AudienceOutputView, consuming the same `useOutputWindow` composable (94-01) for all lifecycle and chrome, and registered its `/present/confidence/:serviceId` route (requiresAuth only, org via `?org=`).

## What Was Built

**View structure (`src/views/ConfidenceOutputView.vue`):**
- Root: `fixed inset-0 bg-black flex flex-col`, `ref="rootRef"`, `data-testid="confidence-output"`, `:style="rootStyle"` (shared CSS-var font wrapper + cursor:none-while-fullscreen).
- **Current region (top, dominant):** `div.relative.flex-[7_1_0%]` with `data-testid="confidence-current-region"`, containing `<SlideCanvas v-if="currentSlide && fontReady" ref="currentCanvasRef" :suppressBackground="true" :interactive="false" />`. No label. Drives media.
- **Next region (bottom, subordinate):** `div.relative.flex-[3_1_0%].border-t.border-white/10` with `data-testid="confidence-next-region"`, containing `<SlideCanvas v-if="nextSlide && fontReady" :suppressBackground="true" :interactive="false" />` (NO ref, static) plus the `<span v-if="nextSlide" data-testid="confidence-next-label">Next</span>` tag (`absolute top-2 left-3 text-sm ... text-gray-500`). On the last slide (`nextSlide == null`) the region stays present (fixed 30%, pure black, tag hidden) — never collapses, so the current pane never reflows.
- **Re-enter affordance:** copied verbatim from AudienceOutputView, `data-testid="confidence-reenter-fullscreen"`, shown only when `!isFullscreen`, overlays both panes.
- Zero operator chrome (no exit/nav/progress/slide-count/org label). No spinner/loading copy — loading and empty states are pure black.

**Script:** `defineProps<{ channelFactory?: BroadcastChannelFactory }>()`, destructures `useOutputWindow({ channelFactory: props.channelFactory })`. `currentSlide` / `nextSlide` computed via direct index access (`assembledSlideshow.value[index.value]` and `[index.value + 1] ?? null` — no `Array.prototype.at`). Media invariant (current pane only): `watch(index)` pause→nextTick→play, `watch(fontReady)` deferred first-play, `onBeforeUnmount(pause)`. Next pane has no ref and is never `play()`'d.

**Route (`src/router/index.ts`):** `path: '/present/confidence/:serviceId'`, `name: 'confidence-output'`, lazy `import('../views/ConfidenceOutputView.vue')`, `meta: { requiresAuth: true }` only (no requiresEditor). Placed adjacent to `/present/audience`, before `/owner-console` and the public dynamic slug routes. `router.beforeEach` untouched. Comment cites R272/R275 + the `?org=` convention.

## Region Testids Added

Per the plan-checker's warning (folded in beyond the plan text), the two region wrappers carry stable testids so wave-3's no-reflow test asserts by testid rather than a brittle Tailwind class:
- `data-testid="confidence-current-region"` on the current pane wrapper
- `data-testid="confidence-next-region"` on the next pane wrapper

Other plan-specified testids retained: `confidence-output` (root), `confidence-next-label`, `confidence-reenter-fullscreen`.

## Deviations from Plan

None beyond the pre-authorized region-testid addition (documented above, per the execution brief). Plan executed as written.

## Gate Results

- `npm run type-check` (vue-tsc --build): **clean**, no errors (no OOM, no NODE_OPTIONS needed).
- `npx vitest run` (bare, no `--dir src`): **1 failed file / 162 passed (163)**, **25 failed / 4529 passed tests**. The only failing file is `src/storage.rules.test.ts` — the documented Storage-emulator baseline (CLAUDE.md). No regression: the audience suite and all other files stay green.
- `grep -c 'suppressBackground="true"'` on the view: **2** (both panes).
- Route grep: `path: '/present/confidence/:serviceId'` and `ConfidenceOutputView.vue` both present.

## Commits

- `7c18f49f` — feat(94-02): register /present/confidence/:serviceId route (requiresAuth only)
- `90f139d9` — feat(94-02): build ConfidenceOutputView current+next 70/30 split, both backgrounds suppressed

## Notes for Wave 3

Wave 3 (94-03) authors the confidence behavioral tests + the direct useOutputWindow unit test. This plan did NOT write tests. The no-reflow test should target `confidence-current-region` / `confidence-next-region` by testid.

HUMAN-UAT deferred to milestone-end: real second-screen black-background suppression as seen by the band, and glanceable current/next legibility at ~30% next-pane height — cannot be proven by jsdom.

## Self-Check: PASSED
- FOUND: src/views/ConfidenceOutputView.vue
- FOUND commit 7c18f49f (route)
- FOUND commit 90f139d9 (view)
