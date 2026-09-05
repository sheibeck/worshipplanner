---
phase: 123
slug: files-tab-songs-list-column-upload-external-link-attach
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-05
---

# Phase 123 — Validation Strategy

> Per-phase validation contract. No research pass (patterns are established: mirror `useMediaUpload.ts`,
> build to 121-UI-SPEC, consume the Phase 122 foundation).

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (jsdom) + Vue Test Utils |
| **Quick / type gate** | `npm run type-check` (vue-tsc --build — NOT `-p tsconfig.app.json`) |
| **App suite** | `npx vitest run` (baseline: only `src/storage.rules.test.ts` fails w/o Storage emulator — expected) |
| **Estimated runtime** | type-check ~40s, app suite ~60s |

## Sampling Rate
- After every task commit: `npm run type-check`
- After every wave: `npx vitest run`
- Before verify: type-check clean + app suite at baseline (all new component/composable tests green)

## Per-Requirement Verification Map

| Req | Validation | Command |
|-----|-----------|---------|
| **R361** (Files tab + count badge) | Component test: SongSlideOver renders a third `Files` tab beside Details/Lyrics; badge shows attachment count only when > 0; tab switches without error; `SongEditTab`/`VALID_TABS` include `'files'` | app suite + type-check |
| **R362** (Songs-list Files column) | Component test: SongTable renders a `Files` column (paperclip + `none`/`1 file`/`N files`) gated on `columnVisibility.files`; the cog menu toggles it; count derives from `attachments.length` | app suite |
| **R363** (multi-file upload + progress) | Unit test `useSongFileUpload` (mocked `uploadBytesResumable`): several files upload, per-file progress updates, a wrong-type / >50MB file is rejected client-side with the UI-SPEC copy while valid files continue; completed uploads append `SongAttachment` and call `updateSong` | app suite |
| **R365** (external link attach) | Unit test: a valid https link is accepted, `linkSource` inferred from host (youtube/drive/dropbox/other), a non-URL rejected with the UI-SPEC error; a `kind:'link'` `SongAttachment` (href + source, no storagePath) is appended and persisted; opens in a new tab | app suite |

## Wave 0
No new test infrastructure — vitest + Vue Test Utils exist. Wave 0 is a no-op.
