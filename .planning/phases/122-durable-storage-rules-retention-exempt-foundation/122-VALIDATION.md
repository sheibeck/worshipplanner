---
phase: 122
slug: durable-storage-rules-retention-exempt-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-05
---

# Phase 122 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from 122-RESEARCH.md
> "## Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (app: jsdom; rules: node emulator via `vitest.rules.config.ts`) |
| **Config file** | `vite.config.ts` (app, excludes rules.test.ts + render-service), `vitest.rules.config.ts` (rules) |
| **Quick run command** | `npm run type-check` (vue-tsc --build — the authoritative type gate; NOT `-p tsconfig.app.json`) |
| **App-suite command** | `npx vitest run` (2-file baseline: only `storage.rules.test.ts` fails — the documented Storage-emulator `firestore.exists()` blind spot) |
| **Rules-suite command** | `npm run test:rules` (own emulator) OR `npx vitest run --config vitest.rules.config.ts` against a running emulator |
| **Estimated runtime** | app ~60s, rules ~30s, type-check ~40s |

---

## Sampling Rate

- **After every task commit:** `npm run type-check`
- **After every plan wave:** `npx vitest run` (app) + the rules suite for storage.rules changes
- **Before verify:** type-check clean + app suite at baseline + new song-files rules allow/deny cases green
- **Max feedback latency:** ~90s

---

## Per-Requirement Verification Map

| Req | Validation | Command |
|-----|-----------|---------|
| **R364** (PDF/MP3 + ≤50MB, server-authoritative) | Rules-emulator allow/deny: editor writes a PDF ≤50MB → allow; editor writes a 60MB file → deny; editor writes a `text/plain` / non-audio-non-pdf → deny; catch-all no longer grants a weak write to song-files/ (the OR-combination fix) | rules suite |
| **R369** (attachments on Song doc; org-scoped prefix outside media/) | Type-check on the additive `attachments?` field; unit assertion that the path helper yields `orgs/{orgId}/song-files/{id}/...`; a legacy Song with no `attachments` still type-checks/loads | type-check + app suite |
| **R370** (exempt from every sweep) | Guard-exclusion unit test: a `orgs/{orgId}/song-files/{id}/x.pdf` path matches NONE of MEDIA_PATH_GUARD / RENDERED_OBJECT_GUARD / BACKGROUND_PATH_GUARD / PPTX_SOURCE_GUARD | functions test (`functions/src/index.test.ts`) |
| **R371** (deletion only via editor-remove or song delete; no service op orphans; indefinite survival) | Unit test on `hardDeleteSong`'s best-effort Storage cascade over attachment `storagePath`s; assertion that no cleanup sweep and no service operation touches song-files/ | app suite + functions test |
| **R372** (editor-only mutation at rules layer; viewer read-only) | Rules-emulator: editor create/delete → allow; member/viewer write/delete → deny; org member read → allow. NOTE: viewer-facing UI is unreachable in the live app (songs screen is `requiresEditor`); the rules-layer editor-only enforcement is the testable deliverable. | rules suite |

---

## Wave 0

No new test infrastructure needed — vitest, the rules emulator harness, and the functions test file all
exist. Wave 0 is a no-op beyond confirming the emulator can be reached for the rules suite.
