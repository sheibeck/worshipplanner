---
phase: 140
slug: vamps-library-crud-storage
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| _seeded by planner_ | — | — | R435, R436 | unit/rules | `npx vitest run` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/__tests__/vamps.test.ts` — vamps store CRUD (create/update/delete, per-org subscribe),
  mirroring the songs store test — R435.
- [ ] `src/utils/__tests__/vampFiles.test.ts` — `vampFileStoragePath` (incl. the per-upload-id segment that
  avoids the immutable-rule replace collision), size cap (≤50 MB), mime allow-list (`audio/mpeg`) — R435.
- [ ] `storage.rules` vamp-files allow/deny cases (editor create/read/delete allowed; non-editor denied;
  non-mp3 / oversize denied). NOTE: storage.rules is now claim-only (2026-08-12), so allow-cases pass in the
  emulator — NO expected-local-failure annotations needed (unlike the historical song-files note) — R435.
- [ ] Church-switch safety: `useVampStore` registered in `resetOrgScopedStores()` — a store-reset test or
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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
