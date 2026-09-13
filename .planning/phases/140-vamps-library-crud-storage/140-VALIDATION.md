---
phase: 140
slug: vamps-library-crud-storage
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-09
---

# Phase 140 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom) for app; rules via `firebase emulators:exec` |
| **Quick run command** | `npx vitest run <changed test file>` |
| **Full suite command** | `npx vitest run` (baseline = 1 known-failing file: `storage.rules.test.ts`) |
| **Rules suite** | `npm run test:rules` (or `npx vitest run --config vitest.rules.config.ts` vs. a running emulator) |
| **Estimated runtime** | ~30–60s app; rules extra |

Type-check gate: `npm run type-check` (vue-tsc --build).

---

## Sampling Rate
- After every task commit: `npx vitest run <changed file>`
- After every plan wave: `npx vitest run` (expect only the `storage.rules.test.ts` baseline failure)
- Before verify: full suite green except the documented baseline; rules suite green for the new vamp-files cases
- Max feedback latency: ~60s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 140-01 T1 | 01 | 1 | R435 | unit | `npx vitest run src/utils/__tests__/vampFiles.test.ts` (6) | ✅ green |
| 140-01 T2 | 01 | 1 | R435 | unit | `npx vitest run src/stores/__tests__/vamps.test.ts src/stores/__tests__/orgScopedStores.test.ts` (21 + 1) | ✅ green |
| 140-01 T3 | 01 | 1 | R435 | unit | `npx vitest run src/composables/__tests__/useVampFileUpload.test.ts` (10) | ✅ green |
| 140-02 T1 | 02 | 1 | R435 | rules (emulator) | `npm run test:rules` — storage.rules vamp-files block + catch-all exclusion | ✅ green (310/310) |
| 140-02 T2 | 02 | 1 | R435 | rules (emulator) | `npm run test:rules` — 11 vamp-files cases + vamps Firestore catch-all cases | ✅ green (310/310) |
| 140-03 T1 | 03 | 2 | R436 | component | `npx vitest run src/components/__tests__/VampTable.test.ts` (8) | ✅ green |
| 140-03 T2 | 03 | 2 | R435, R436 | component | `npx vitest run src/components/__tests__/VampSlideOver.test.ts` (7) | ✅ green |
| 140-03 T3 | 03 | 2 | R436 | view | `npx vitest run src/views/__tests__/SongsView.test.ts` (8) | ✅ green |
| review fixes CR-01/WR-01/WR-02 | — | — | R435, R436 | unit/component | covered by the files above (+9 tests added in fix commits) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/stores/__tests__/vamps.test.ts` — vamps store CRUD (create/update/delete, per-org subscribe),
  mirroring the songs store test — R435.
- [x] `src/utils/__tests__/vampFiles.test.ts` — `vampFileStoragePath` (incl. the per-upload-id segment that
  avoids the immutable-rule replace collision), size cap (≤50 MB), mime allow-list (`audio/mpeg`) — R435.
- [x] `storage.rules` vamp-files allow/deny cases (editor create/read/delete allowed; non-editor denied;
  non-mp3 / oversize denied). NOTE: storage.rules is now claim-only (2026-08-12), so allow-cases pass in the
  emulator — NO expected-local-failure annotations needed (unlike the historical song-files note) — R435.
- [x] Church-switch safety: `useVampStore` registered in `resetOrgScopedStores()` — a store-reset test or
  assertion.

*Final list finalized by the planner.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vamps tab + flat table + slide-out editor render + match the design | R436 | Visual/layout judgement | Deferred to batched UAT: open Songs → Vamps tab; create a vamp (name/key/tempo), attach + play + remove an MP3, edit, delete; search by name/key |
| Real MP3 upload/download in a deployed env | R435 | Storage emulator can't fully model prod upload/CORS | Deferred to batched UAT: upload a real MP3, confirm it plays and downloads |

*Automated coverage exists for the store CRUD, path/validation helpers, storage rules, and church-switch reset.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-13 (autonomous run; manual-only rows batched to v2.15-DEFERRED-VERIFICATION.md)

## Validation Audit 2026-09-13

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 4 Wave 0 requirements landed with green tests (61 app-side tests in 7 files; rules suite 310/310 with the emulator). Type-check clean. Manual-only rows unchanged.
