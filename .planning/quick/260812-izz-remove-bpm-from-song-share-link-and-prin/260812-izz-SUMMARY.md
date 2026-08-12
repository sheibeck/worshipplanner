---
task: quick
slug: 260812-izz-remove-bpm-from-song-share-link-and-prin
status: complete
one_liner: Removed BPM from the public share link and print output; added a universal per-item notes paragraph on both surfaces for every slot kind; confirmed MISC-0-slides (R123) unchanged.
subsystem: service-share-print
tags: [share-link, print, notes, security-review]
dependency-graph:
  requires: []
  provides:
    - "Per-item free-text notes render on ShareView.vue and ServicePrintLayout.vue for every slot kind"
  affects:
    - src/views/ShareView.vue
    - src/components/ServicePrintLayout.vue
    - src/views/ServiceEditorView.vue
tech-stack:
  added: []
  patterns:
    - "Consolidated free-text field: slot.notes ?? slot.body, rendered once per row via {{ }} interpolation (never v-html)"
key-files:
  created: []
  modified:
    - src/views/ShareView.vue
    - src/components/ServicePrintLayout.vue
    - src/views/ServiceEditorView.vue
    - src/components/__tests__/ServicePrintLayout.test.ts
    - src/views/__tests__/ShareView.test.ts
decisions:
  - "Left buildServiceSnapshot's internal bpm computation in services.ts untouched — harmless plumbing, no longer displayed, removing it would ripple into an unrelated store test for no user-visible benefit."
  - "Task 3 required no code change — R123 (MISC derives 0 slides) is confirmed still correct by inspection and by the existing green test at slideGroupMaterializer.test.ts:378-391."
metrics:
  duration: "~35 minutes"
  completed: "2026-08-12"
---

# Quick Task 260812-izz: Remove BPM from Song Share Link and Print Summary

Removed BPM (tempo) display from the two service-facing render surfaces (public share link
and print output), consolidated per-item free-text notes to render once per row for every
slot kind on both surfaces (previously only MESSAGE/ANNOUNCEMENTS/MISC showed notes, and
only via legacy `body`), and confirmed — without re-implementing — that a new Miscellaneous
item still derives zero slides by default (R123).

## What Was Built

### Task 1: Remove BPM

- `src/views/ShareView.vue` — SONG row now reads `Key: {{ slot.songKey }}` only; the
  `| BPM: {{ slot.bpm || '--' }}` segment is gone.
- `src/components/ServicePrintLayout.vue` — deleted the BPM span and the `getBpmForSlot`
  helper function entirely; the component no longer declares a `songs` prop (only
  `service: Service` remains); dropped the now-unused `SongSlot` and `Song` type imports.
- `src/views/ServiceEditorView.vue` — the `<ServicePrintLayout>` invocation no longer passes
  `:songs="songStore.songs"`. The unrelated `:songs="songStore.songs"` usage at ~line 1042
  (a different component) and the `songStore` import/usage elsewhere are untouched.
- `src/components/__tests__/ServicePrintLayout.test.ts` — removed the BPM-renders test, the
  `mockSongs` fixture, and the `songs` prop from every remaining `mount()` call.

### Task 2: Universal per-item notes on both surfaces

- `src/components/ServicePrintLayout.vue` — added a `slotFreeText(slot: ServiceSlot): string
  | undefined` helper (`slot.notes ?? (slot as NonAssignableSlot).body`) and a single notes
  paragraph rendered once per row, after all per-kind `<template>` blocks, guarded by
  `slotFreeText(slot)?.trim()`. Deleted the three now-redundant per-kind notes blocks that
  used to live inside MESSAGE, ANNOUNCEMENTS and MISC — the universal paragraph now covers
  those three kinds plus SONG, SCRIPTURE, PRAYER and HYMN, none of which previously showed
  notes at all.
- `src/views/ShareView.vue` — mirrored the same universal paragraph (inline expression, no
  helper needed since `serviceSnapshot` is typed `any`), deleting the three per-kind body
  paragraphs from MESSAGE/ANNOUNCEMENTS/MISC.
- Both surfaces render notes ONLY via `{{ }}` text interpolation (auto-escaped) — no `v-html`
  was introduced anywhere, satisfying T-quick-01 (the share link is public/unauthenticated).
- Tests added: a SONG-with-notes test on both `ServicePrintLayout.test.ts` and
  `ShareView.test.ts` (a kind that previously showed no notes at all), plus a MESSAGE-notes
  test on `ShareView.test.ts` proving notes (not just legacy `body`) renders there too. All
  pre-existing notes-canonical, no-body, and newline-preservation tests still pass unchanged.

### Task 3: MISC-0-slides verification (no re-implementation)

Read `src/utils/slideGroupMaterializer.ts`:
- `deriveGroupEntries`'s `case 'MISC': return []` (line 162-163) is the single source of
  "a new Miscellaneous item derives no slides," and `buildInitialGroup` (line 266-275) feeds
  every brand-new slot straight through `deriveGroupEntries` — confirmed by reading, not
  inference.
- `rebuildGroup`'s MISC branch (line 936-951) is a deliberate no-op (`{ changed: false,
  slides: group.slides }`) that only preserves an EXISTING group's stored slides on rebuild
  — it does not seed a default slide count and cannot regress this behavior.
- Ran `src/utils/__tests__/slideGroupMaterializer.test.ts` (131 tests, all green), including
  the `deriveGroupEntries — MISC (R123)` block at lines 378-391 which explicitly asserts a
  MISC slot derives `[]`.

**No code change was made or needed.** The behavior is confirmed still correct.

## Deviations from Plan

None — plan executed exactly as written. Task 3's verification-only outcome (no fix needed)
was the expected/preferred result per the plan's own instructions.

## Verification Results

- `npm run type-check` (`vue-tsc --build`, checks test files too per CLAUDE.md): **clean, no
  errors.**
- `npx vitest run src/components/__tests__/ServicePrintLayout.test.ts
  src/views/__tests__/ShareView.test.ts` (Task 1 + Task 2 gate): **32/32 then 35/35 passed**
  across both edits.
- `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts` (Task 3 gate):
  **131/131 passed.**
- `npx vitest run` (bare, full suite, excludes `src/rules.test.ts` per CLAUDE.md):
  **3264 passed, 1 failed, 13 skipped** across 108 test files (105 passed, 3 failed).
  - `src/storage.rules.test.ts` — **documented baseline** (needs Storage emulator running;
    `ECONNREFUSED 127.0.0.1:9199` — no emulator was up during this run).
  - `src/views/__tests__/RosterView.test.ts` — **documented baseline** (stale
    "Roles config" assertion, unrelated to this task's changes).
  - `render-service/src/render.test.ts` — **NOT in the documented baseline, but confirmed
    pre-existing and unrelated to this task's changes** (see below).

### Note: a third failing suite outside the documented baseline

`render-service/src/render.test.ts` failed with `No "default" export is defined on the
"node:child_process" mock` — a vitest version mismatch between the root suite
(`vitest ^4.0.18`) and `render-service`'s own `vitest ^4.1.10` (confirmed via
`package.json`/`render-service/package.json`). CLAUDE.md documents this exact mismatch for a
different invocation (`npx vitest run src/` picking up `render-service/src/render.test.ts`
by substring match); bare `npx vitest run` also picks it up because `vite.config.ts`'s
`test.exclude` does not exclude `render-service/`, and there is no vitest workspace
isolation for it at the root config.

This task's git diff (`git diff --stat HEAD~2 HEAD`) touches only `src/views/ShareView.vue`,
`src/components/ServicePrintLayout.vue`, `src/views/ServiceEditorView.vue`, and their two
test files — never anything under `render-service/`. This failure is a pre-existing
tooling/environment artifact, not a regression introduced by this task, and is out of scope
to fix here (Rule 2/scope-boundary: pre-existing failures in unrelated files are not
auto-fixed). Flagging it here since it wasn't previously documented in CLAUDE.md's known
baseline — worth a note for whoever next runs the bare full suite.

## Security

T-quick-01 (stored XSS on the public share link): notes/body render ONLY via `{{ }}` text
interpolation (auto-escaped) on both `ShareView.vue` and `ServicePrintLayout.vue`. No
`v-html` was introduced anywhere in this task — confirmed by grep across both edited files.

## Self-Check: PASSED

- FOUND: src/views/ShareView.vue
- FOUND: src/components/ServicePrintLayout.vue
- FOUND: src/views/ServiceEditorView.vue
- FOUND: src/components/__tests__/ServicePrintLayout.test.ts
- FOUND: src/views/__tests__/ShareView.test.ts
- FOUND commit 3c3ac2f (Task 1)
- FOUND commit f08a8d0 (Task 2)
