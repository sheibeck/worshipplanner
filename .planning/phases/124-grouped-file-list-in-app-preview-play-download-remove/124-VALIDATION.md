---
phase: 124
slug: grouped-file-list-in-app-preview-play-download-remove
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-05
---

# Phase 124 — Validation Strategy

> No research pass (established patterns: dialog shell from CleanupEnableConfirmDialog, inline-confirm from
> Delete-Song, atomic array ops from Phase 123's addSongAttachment). Build to 121-UI-SPEC §6-10.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (jsdom) + Vue Test Utils |
| **Type gate** | `npm run type-check` (vue-tsc --build — NOT `-p tsconfig.app.json`) |
| **App suite** | `npx vitest run` (baseline: only `src/storage.rules.test.ts` fails w/o Storage emulator) |

## Sampling Rate
- After every task commit: `npm run type-check`
- After every wave: `npx vitest run`
- Before verify: type-check clean + app suite at baseline (all new component/store tests green)

## Per-Requirement Verification Map

| Req | Validation | Command |
|-----|-----------|---------|
| **R366** (grouped Documents/Audio + metadata + empty states) | Component test: attachments split into Documents/Audio groups; each row shows `{TYPE} · {…} · {size} · {date}` with graceful omission of unknown pages/duration (never `undefined`/`NaN`); an empty group shows its per-group empty line | app suite |
| **R367** (in-app PDF preview + MP3 player) | Component test: clicking Preview opens the PDF modal (iframe on downloadUrl) that dismisses on Escape/backdrop/Close; clicking Play reveals an inline `<audio controls>`, one at a time; error fallbacks render | app suite |
| **R368** (download + remove) | Component test: uploaded rows expose Download; Remove opens the inline confirm with the removes-everywhere copy; confirming calls `removeSongAttachment` (atomic) + best-effort `deleteObject`, the row disappears and count/badge update live; a failed `deleteObject` does NOT revert the record removal; links have no Download and no Storage delete | app suite (mock firebase/storage deleteObject) |

## Wave 0
No new test infrastructure — vitest + Vue Test Utils exist. Wave 0 is a no-op.
