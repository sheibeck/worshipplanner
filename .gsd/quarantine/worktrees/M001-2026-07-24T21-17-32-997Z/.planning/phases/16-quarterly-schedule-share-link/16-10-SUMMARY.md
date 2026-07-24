---
phase: 16-quarterly-schedule-share-link
plan: 10
subsystem: public-share-page
tags: [vue, vue-router, firestore, public-share, matrix-view]
dependency-graph:
  requires: ["16-02"]
  provides: ["quarter-share-matrix-ui", "quarter-memorable-route", "quarter-share-name-filter"]
  affects: ["src/views/QuarterShareView.vue", "src/router/index.ts"]
tech-stack:
  added: []
  patterns:
    - "window.matchMedia-backed useIsMobile() composable for structural (not CSS) mobile fallback"
    - "router.replace({query}) URL persistence for view+name (SongsView convention)"
    - "AvailabilityDrawer-style typeahead (@focus/@blur setTimeout(150)) reused for name filter"
key-files:
  created:
    - src/components/useIsMobile.ts
    - src/components/QuarterShareMatrix.vue
    - src/views/__tests__/QuarterShareView.test.ts
  modified:
    - src/views/QuarterShareView.vue
    - src/router/index.ts
    - src/router/__tests__/router.test.ts
decisions:
  - "useIsMobile guards window.matchMedia absence (jsdom test env doesn't implement it) — falls back to isDesktop=true"
  - "Matrix/list toggle persists only view+name to route.query via a single combined watch([viewMode, nameFilter]) -> router.replace, never push"
  - "Empty-dates message ('No service dates') keyed off the raw snapshot.serviceDates, not the filtered list, so a name filter matching zero dates doesn't misreport as 'no service dates at all'"
metrics:
  duration: "~35 min"
  completed: 2026-07-10
  tasks_completed: 3
  files_touched: 6
---

# Phase 16 Plan 10: Public Share-Page Matrix, Memorable Route, and Name Filter Summary

One-liner: Read-only roles x dates matrix (default view) with a list-view fallback, a memorable `/{slug}/quarter{N}-{YYYY}` route reading the denormalized `quarterShares` snapshot, and a typeahead name filter with view+name persisted in the URL — all snapshot-only, zero store access.

## What Was Built

**Task 1 — Memorable route + useIsMobile + memorable-doc branch:**
- Added `/:slug/quarter:num([1-4])-:year(\d{4})` route named `quarter-memorable-share` to `router/index.ts`, appended after all static routes (no `meta.requiresAuth`) so it can never shadow existing static app routes (D-19 — Vue Router ranks static over dynamic regardless of array position).
- Created `src/components/useIsMobile.ts` — a small composable wrapping `window.matchMedia('(min-width: 640px)')` with add/remove listener lifecycle, returning a reactive `isDesktop` ref.
- `QuarterShareView.vue`'s `onMounted` now branches: if `route.params.token` is present, reads `shareTokens/{token}` (unchanged); otherwise reads `quarterShares/{slug}__q{num}-{year}` from the memorable route's params. Same try/catch/finally/notFound handling in both branches.
- Extended `router.test.ts` with two new cases: the memorable pattern resolves for a sample slug/quarter (asserting `slug`/`num`/`year` params), and a reserved static segment (`/schedule`) still resolves to its own static route, never the dynamic one.

**Task 2 — QuarterShareMatrix component + matrix/list toggle:**
- Created `src/components/QuarterShareMatrix.vue` — presentational, read-only: `<th v-for="role">` header columns, `<tr v-for="date">` body rows, comma-separated multi-person cells (`peopleFor(...).join(', ') || '—'`), no `@click`/badges, only a subtle `hover:bg-gray-50` row highlight. Props: `roles`, `dates`, `peopleFor` accessor — derives nothing from stores.
- `QuarterShareView.vue` gained a `viewMode` ref (`'matrix' | 'list'`) initialized from `route.query.view ?? (isDesktop.value ? 'matrix' : 'list')`, a segmented Matrix/List toggle (`role="group"`, `aria-label="Schedule view"`), and renders `<QuarterShareMatrix>` or the existing list block accordingly.

**Task 3 — Name filter typeahead + URL persistence + tests (TDD):**
- Added a name-filter input (placeholder `"Filter by name…"`) with an absolute-positioned dropdown, `@focus`/`@blur` + `window.setTimeout(150)` debounce — same shape as `AvailabilityDrawer.vue`'s "Must serve with" control, light-theme-adapted. Candidates are deduped names collected from the snapshot's own `calendar` (never `rosterStore`).
- `filteredDates` computed hides dates where the selected name serves no role in any column; applied to both the matrix and list views. A "Show everyone" text button appears only when a filter is active and clears it.
- `view` and `name` are both hydrated from `route.query` on mount and persisted together via a single `watch([viewMode, nameFilter], ...) -> router.replace({ query: { ...route.query, view, name: name || undefined } })`.
- Created `src/views/__tests__/QuarterShareView.test.ts` (mirrors `ShareView.test.ts`'s mocked-`getDoc` harness): matrix renders roles/dates from a snapshot, toggling to list renders the list, selecting a name filter hides non-serving dates in both views, and "Show everyone" restores all dates.

## Verification

- `npx vitest run src/router/__tests__/router.test.ts` — 9/9 passed.
- `npx vitest run src/views/__tests__/QuarterShareView.test.ts` — 4/4 passed (matrix render, list toggle, name filter hides non-serving dates, clear restores).
- `npx vitest run src/views/__tests__/ShareView.test.ts` — 4/4 passed (unaffected regression check).
- `npx vue-tsc --build` — clean, no errors, across all three tasks.
- `grep -c "@/stores" src/views/QuarterShareView.vue` and `src/components/QuarterShareMatrix.vue` — both `0` (D-24 preserved).
- `grep -c "quarter-memorable-share" src/router/index.ts` — `1`; no `requiresAuth` on the new route.
- Copy verified verbatim: "Filter by name…", "No matching names", "Show everyone".

## TDD Gate Compliance

Task 3 followed the RED/GREEN cycle as required (`tdd="true"`):
- RED: `test(16-10): add failing tests for share-page name filter (RED)` (commit `9119948`) — matrix/list render+toggle tests passed immediately (already implemented by Task 2), the two name-filter tests failed as expected since no filter UI existed yet.
- GREEN: `feat(16-10): implement share-page name filter typeahead (GREEN)` (commit `951e97f`) — all 4 tests pass.
- No REFACTOR commit needed — implementation was clean on first pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Guarded `useIsMobile` against missing `window.matchMedia`**
- **Found during:** Task 3, writing the test harness for `QuarterShareView.test.ts`.
- **Issue:** jsdom's Vitest test environment does not implement `window.matchMedia`; calling it unconditionally in `useIsMobile.ts` threw a `TypeError` during component mount in tests, blocking all `QuarterShareView` tests (including the ones already passing from Task 2).
- **Fix:** `useIsMobile.ts` now checks `typeof window.matchMedia === 'function'` before calling it, falling back to `mediaQuery = null` (and `isDesktop.value` defaulting to `true`) when unavailable. This has no effect on real browsers (all support `matchMedia`) and makes the composable safely testable.
- **Files modified:** `src/components/useIsMobile.ts`
- **Commit:** `6838e6b`

No other deviations — the plan's remaining scope executed exactly as written.

## Known Stubs

None — all three artifacts (`useIsMobile.ts`, `QuarterShareMatrix.vue`, `QuarterShareView.vue`'s memorable-route branch/toggle/filter) are fully wired to the fetched snapshot; no placeholder data paths.

## Threat Flags

None — this plan's surface changes match the plan's own `<threat_model>` exactly (T-16-10-01 through T-16-10-04, all mitigated as designed: zero `@/stores/*` imports, reserved-slug enforcement lives at slug-claim time in 16-02 not here, Vue text interpolation used throughout with no `v-html`). No new endpoints, auth paths, or schema changes beyond what the threat register already covers.

## Self-Check: PASSED

- FOUND: src/components/useIsMobile.ts
- FOUND: src/components/QuarterShareMatrix.vue
- FOUND: src/views/__tests__/QuarterShareView.test.ts
- FOUND: src/views/QuarterShareView.vue (modified)
- FOUND: src/router/index.ts (modified)
- FOUND: src/router/__tests__/router.test.ts (modified)
- FOUND commit 1e58d30 (Task 1)
- FOUND commit 3122280 (Task 2)
- FOUND commit 6838e6b (fix)
- FOUND commit 9119948 (RED)
- FOUND commit 951e97f (GREEN)
