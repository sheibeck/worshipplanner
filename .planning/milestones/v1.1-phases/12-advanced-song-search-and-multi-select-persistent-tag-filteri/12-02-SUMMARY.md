---
phase: 12-advanced-song-search-and-multi-select-persistent-tag-filteri
plan: 02
subsystem: songs-store
tags: [pinia, tag-filter, localStorage, persistence]
dependency_graph:
  requires: []
  provides:
    - "songStore.tagFilterChecked (Set<string>)"
    - "songStore.tagFilterHide (boolean)"
    - "songStore.clearTagFilter()"
    - "per-user/org localStorage persistence for tag filter"
  affects:
    - "src/components/SongFilters.vue (consumes new store fields — plan 12-03)"
    - "src/views/SongsView.vue (consumes new store fields — plan 12-03)"
    - "song picker (consumes shared store state — plan 12-04/12-05)"
tech-stack:
  added: []
  patterns:
    - "Pinia store setup-function style with ref<Set<string>> for checklist state"
    - "watch([...], fn, { deep: true }) to auto-persist on mutation"
    - "try/catch-wrapped localStorage read/write with silent-fail degrade-to-memory"
key-files:
  created: []
  modified:
    - src/stores/songs.ts
    - src/stores/__tests__/songs.test.ts
decisions:
  - "Removed filterTagInclude/filterTagExclude string refs entirely (no back-compat shim) — replaced by tagFilterChecked Set + tagFilterHide boolean per D-08/D-14"
  - "tagFilterStorageKey() returns null (skips read/write) when uid or org is missing, preventing any shared/global-key persistence (T-12-03)"
  - "hydrateTagFilter() called at the end of subscribe(), after orgId.value is set, so the per-user/org key is always resolvable at hydration time"
  - "localStorage.setItem/getItem/JSON.parse all wrapped in try/catch with silent no-op catches per UI-SPEC's graceful-degradation contract (T-12-04/T-12-05)"
metrics:
  duration_minutes: 25
  completed: 2026-07-01
---

# Phase 12 Plan 02: Songs Store Tag-Filter Checklist + Persistence Summary

Reworked the songs Pinia store's two single-tag string filters (`filterTagInclude`/`filterTagExclude`) into a shared multi-select checklist model (`tagFilterChecked: Set<string>` + `tagFilterHide: boolean`), with OR-combine-in-show / exclude-in-hide matching semantics and per-user/org localStorage persistence that silently degrades on quota/private-mode failures.

## What Was Built

**Task 1 — Checklist state + filteredSongs logic + clearTagFilter:**
- Removed `filterTagInclude`/`filterTagExclude` refs from `src/stores/songs.ts`.
- Added `tagFilterChecked = ref<Set<string>>(new Set())` and `tagFilterHide = ref(false)`.
- Rewrote the tag-matching branch of `filteredSongs`: when `tagFilterChecked.size > 0`, a song matches if it carries ANY checked tag (show mode, OR-combine) or does NOT carry any checked tag (hide mode, exclusion).
- Added `clearTagFilter()` action that resets only `tagFilterChecked`/`tagFilterHide`, leaving `searchQuery`/`filterVwType`/`filterKey` untouched.
- Rewrote the D-03 test block in `songs.test.ts` to cover: default show mode with empty set, single-tag show mode, OR-broadening with two checked tags, hide-mode exclusion, and `clearTagFilter()` isolation from other filter state.

**Task 2 — localStorage persistence:**
- Added `tagFilterStorageKey()` which reads `useAuthStore().user?.uid` and `orgId.value ?? auth.orgId`, returning `null` (no read/write) if either is missing — this keys persistence as `wp:tagFilter:v1:${org}:${uid}` so state never bleeds across accounts on a shared browser.
- Added `persistTagFilter()` (writes `{ checked: string[], hide: boolean }` via `localStorage.setItem`, wrapped in try/catch that silently ignores quota/private-mode errors) and `hydrateTagFilter()` (reads + validates the stored shape via try/catch, falling back to in-memory defaults on corrupt/missing data).
- Wired `watch([tagFilterChecked, tagFilterHide], persistTagFilter, { deep: true })` to auto-save on every change.
- Called `hydrateTagFilter()` at the end of `subscribe()`, after `orgId.value` is set, so the org+uid key is always resolvable before hydration runs.
- Added 6 new persistence tests to `songs.test.ts`: round-trip write, missing-uid no-op, missing-org no-op, hydrate-on-subscribe, corrupt-JSON silent fallback, and `setItem` throwing (quota) silent fallback — using a new `@/stores/auth` mock (`mockAuthUser`/`mockAuthOrgId` module-level vars controlled per test).

## Verification

- `npx vitest run src/stores/__tests__/songs.test.ts` — 56/56 passing
- `grep -n "filterTagInclude\|filterTagExclude" src/stores/songs.ts` — no matches
- `src/stores/songs.ts` contains `tagFilterChecked`, `tagFilterHide`, `clearTagFilter`, `tagFilterHide.value ? !carriesChecked : carriesChecked`, `wp:tagFilter`, `if (!uid || !org) return null`, `watch(`, `hydrateTagFilter` called inside `subscribe`
- `npm run type-check` — `src/stores/songs.ts` and `src/stores/__tests__/songs.test.ts` are type-clean; two pre-existing errors remain in `src/views/SongsView.vue` (lines 70-71) referencing the now-removed `filterTagInclude`/`filterTagExclude` — see "Known Cross-Plan Boundary" below.

## Known Cross-Plan Boundary (not a defect in this plan)

`src/views/SongsView.vue` and `src/components/SongFilters.vue` still reference `songStore.filterTagInclude`/`filterTagExclude`, which this plan intentionally removed from the store per its `files_modified` scope (`src/stores/songs.ts`, `src/stores/__tests__/songs.test.ts` only). Plan **12-03** (wave 2, `depends_on: [02]`) owns rewriting `SongFilters.vue`/`SongsView.vue` to bind against `tagFilterChecked`/`tagFilterHide`/`clearTagFilter` via the new `TagFilterChecklist.vue` component — its Task 2 explicitly removes these two lines and rewires the bindings. Until 12-03 lands, `npm run type-check` on the full project reports 2 errors confined to those two lines in `SongsView.vue`; this is the expected, temporary state of a wave-1→wave-2 dependency chain, not a regression introduced by this plan. `songs.ts` itself (this plan's actual scope) is fully type-clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Added `@/stores/auth` mock to songs.test.ts**
- **Found during:** Task 2, first test run
- **Issue:** Importing `useAuthStore` from `@/stores/auth` inside `songs.ts` pulled the real `firebase/auth` module into the songs store test suite (which only mocked `firebase/firestore` and `@/firebase`), causing `onAuthStateChanged is not a function` errors and failing all 50 pre-existing tests, not just the new ones.
- **Fix:** Added `vi.mock('@/stores/auth', ...)` returning a lightweight mock store object with getter-based `user`/`orgId` backed by module-level `mockAuthUser`/`mockAuthOrgId` variables, reset in `beforeEach`. This mirrors the existing pattern in `services.test.ts` (`vi.mock('@/stores/songs', ...)`) for cross-store test isolation.
- **Files modified:** `src/stores/__tests__/songs.test.ts`
- **Commit:** f2353d4

No architectural changes were required. All work stayed within the plan's declared file scope (`src/stores/songs.ts`, `src/stores/__tests__/songs.test.ts`).

## Known Stubs

None — both tasks are fully wired; no placeholder data or empty stub renders were introduced.

## Threat Flags

None — the threat model in this plan's frontmatter (T-12-03 information disclosure, T-12-04 tampering, T-12-05 DoS) was implemented exactly as specified (namespaced key, try/catch validation, silent-fail write). No new network endpoints, auth paths, or schema changes were introduced beyond what the threat model already covers.

## Self-Check: PASSED

- FOUND: src/stores/songs.ts (verified via Read + grep)
- FOUND: src/stores/__tests__/songs.test.ts (verified via Read + grep)
- FOUND commit e270927 (feat(12-02): tag-filter checklist state + clearTagFilter in songs store)
- FOUND commit f2353d4 (feat(12-02): persist tag filter to per-user/org localStorage)
