---
phase: quick-17
plan: "01"
subsystem: ui
tags: [print, share, service-card, progression, badge]
dependency_graph:
  requires: []
  provides: [ServicePrintLayout-no-progression, ShareView-no-progression, ServiceCard-special-badge]
  affects: [ServicePrintLayout.vue, ShareView.vue, ServiceCard.vue]
tech_stack:
  added: []
  patterns: [static-tailwind-badge, v-if-guard]
key_files:
  modified:
    - src/components/ServicePrintLayout.vue
    - src/views/ShareView.vue
    - src/components/ServiceCard.vue
decisions:
  - "Static amber Tailwind classes for Special Service badge — all class strings literal, not computed, maintaining Tailwind v4 purge safety (matches statusClasses pattern)"
metrics:
  duration: 4 minutes
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_modified: 3
---

# Quick Task 17: Remove Progression from Print/Share Headers, Add Special Service Badge Summary

**One-liner:** Removed progression string from print and share headers; added amber "Special Service: {name}" badge to ServiceCard with static Tailwind classes for purge safety.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Remove progression from print and share headers | 2342a69 | ServicePrintLayout.vue, ShareView.vue |
| 2 | Special Service badge in ServiceCard | 4e783fb | ServiceCard.vue |

## Changes Made

### Task 1: Remove Progression from Print and Share Headers

**ServicePrintLayout.vue:**
- Deleted line: `<p class="text-xs text-gray-600">Progression: {{ props.service.progression }}</p>`
- The teams line immediately above it is preserved

**ShareView.vue:**
- Changed: `<p class="text-sm text-gray-600 mt-1">{{ teamsDisplay }} &middot; {{ serviceSnapshot.progression }}</p>`
- To: `<p class="text-sm text-gray-600 mt-1">{{ teamsDisplay }}</p>`
- The middot separator and `{{ serviceSnapshot.progression }}` interpolation removed entirely

### Task 2: Special Service Badge in ServiceCard

**ServiceCard.vue:**
- Replaced: `<p v-if="service.name" class="text-xs font-medium text-indigo-300 mb-1.5 truncate">{{ service.name }}</p>`
- With: `<span v-if="service.name" class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-900/40 text-amber-300 border border-amber-800 mb-1.5">Special Service: {{ service.name }}</span>`
- All class strings are literal (not computed) — Tailwind v4 purge safe
- v-if guard preserved — nothing renders when service.name is empty

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Issues (Pre-Existing, Out of Scope)

Pre-existing TypeScript errors found in unrelated files (confirmed via git stash test — errors existed before any QUICK-17 changes):

- `src/views/ServicesView.vue` lines 255, 281: Array destructuring undefined type errors
- `src/utils/__tests__/suggestions.test.ts` multiple lines: Object possibly undefined in test assertions
- `src/components/ServiceCard.vue` line 82: parsedDate `month` possibly undefined in `new Date(year, month - 1, day)`

These are out of scope for QUICK-17 and were not introduced by these changes.

## Self-Check

### Files Exist
- [x] src/components/ServicePrintLayout.vue — progression line removed
- [x] src/views/ShareView.vue — progression interpolation removed
- [x] src/components/ServiceCard.vue — amber badge in place

### Commits Exist
- [x] 2342a69 — fix(quick-17): remove progression from print and share headers
- [x] 4e783fb — feat(quick-17): add Special Service amber badge to ServiceCard

## Self-Check: PASSED
