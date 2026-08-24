---
phase: 81
slug: polish-ops-close-out
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-24
---

# Phase 81 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **App framework** | vitest 4.0.x (jsdom) — `npx vitest run` (excludes `src/rules.test.ts`, `render-service/**`) |
| **Functions suite** | `cd functions && npm test` (node env) — for any send-path assertions |
| **Type gate** | `npm run type-check` (`vue-tsc --build`) |
| **Baseline** | app suite 2-file known-failing baseline (`storage.rules.test.ts`, `RosterView.test.ts`) |
| **Estimated runtime** | app ~60–120s |

---

## Sampling Rate

- **After every task commit:** changed test files + `npm run type-check`.
- **After every plan wave:** `npx vitest run` at baseline.
- **Before `/gsd-verify-work`:** app suite at baseline, type-check clean.
- **Max feedback latency:** ~120 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 81-01 T1 | 81-01 | 1 | R237 | component + compile (re-run existing; no rebuild) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts -t "IMPORTED\|previously dropped" && npm run type-check && grep -qi 'IMPORTED' .planning/phases/81-polish-ops-close-out/81-01-SUMMARY.md` | ⬜ pending |
| 81-01 T2 | 81-01 | 1 | R238 | doc-gate | `test -f functions/DEPLOY-EMAIL-DOMAIN.md && grep -qi 'DKIM' functions/DEPLOY-EMAIL-DOMAIN.md && grep -qi 'DMARC' functions/DEPLOY-EMAIL-DOMAIN.md && grep -qi 'from address' functions/DEPLOY-EMAIL-DOMAIN.md && grep -qi 'R238' .planning/PENDING-VERIFICATION.md` | ⬜ pending |
| 81-01 T3 | 81-01 | 1 | R238 | unit (re-run existing; no rebuild) | `cd functions && npx vitest run src/index.test.ts -t "config.sender.fromAddress" && npx vitest run src/adminEmail.test.ts` | ⬜ pending |
| 81-02 T1 | 81-02 | 1 | R239 | component (new file) | `npx vitest run src/components/admin/__tests__/ConfigurationTab.test.ts` | ⬜ pending |
| 81-02 T2 | 81-02 | 1 | R239 | component (extend) | `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts` | ⬜ pending |
| 81-02 T3 | 81-02 | 1 | R239 | component (extend) + compile | `npx vitest run src/components/admin/__tests__/ConfigTextField.test.ts && npm run type-check` | ⬜ pending |
| 81-03 T1 | 81-03 | 1 | R239 | component (extend) + onSnapshot regression | `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts` | ⬜ pending |
| 81-03 T2 | 81-03 | 1 | R239 | component (extend) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts -t "tab"` | ⬜ pending |
| 81-04 T1 | 81-04 | 1 | R240 | unit (new) + compile | `npx vitest run src/utils/__tests__/songSearch.test.ts && npm run type-check` | ⬜ pending |
| 81-04 T2 | 81-04 | 1 | R240 | component (new SongBrowser wrapper) + compile | `npx vitest run src/components/__tests__/SongBrowser.test.ts && npm run type-check` | ⬜ pending |
| 81-04 T3 | 81-04 | 1 | R240 | component regression (Songs page wired to SongBrowser + store repoint) + compile | `npx vitest run src/views/__tests__/SongsView.test.ts src/components/__tests__/SongTable.test.ts && npm run type-check` | ⬜ pending |
| 81-04 T4 | 81-04 | 1 | R240 | component regression (picker wired to SongBrowser) + compile | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts -t "song-tag filter" && npx vitest run src/components/__tests__/SongBrowser.test.ts && npm run type-check` | ⬜ pending |

*Coverage the planner must map: R237 → the EXISTING `planningCenterApi.ts`/`ServiceEditorView.vue` export tests re-confirmed green (already-shipped; a traceability/verification task, NOT a rebuild — add a coverage assertion only if a gap is found); R238 → a doc-gate that the owner runbook file exists + a test/inspection that the send path reads `appConfig.sender.fromAddress` (already wired); R239 → component tests that the 4 Owner-Console inputs + the ConfigTextField label carry accessible names and both tab strips expose `role="tablist"/tab"/aria-selected` WITHOUT converting v-show→v-if (assert the panels stay mounted); R240 → a unit test for the extracted `filterSongsByTags()` util (81-04 T1) + a new `SongBrowser.test.ts` for the shared search+tag wrapper component (81-04 T2) + regression tests proving both consumers — the Songs page/store (81-04 T3) and `SongSlotPicker` (81-04 T4) — still filter identically after each is rewired to browse through the one shared `SongBrowser.vue`. R240 delivers the ACTUAL shared component (search input + `TagFilterChecklist` + `filterSongsByTags`-based computed + scoped default slot), not just the util — the two row renderers stay distinct per RESEARCH Pitfall 6.*

---

## Wave 0 Requirements

No separate Wave-0 scaffolding plan is required. Every requirement's test infrastructure already exists except one file, which is created inline by the task that produces its code (test-alongside):

- [x] R237 — no gap: existing `ServiceEditorView.test.ts` R237 block (3 tests) + the `never`-typed exhaustive dispatch are the coverage; 81-01 T1 re-runs them (verification, not rebuild).
- [x] R238 — no gap: existing `functions/src/index.test.ts` + `adminEmail.test.ts` cover the send path; 81-01 T3 re-runs them. The runbook + PENDING-VERIFICATION entry are doc deliverables (81-01 T2, doc-gate).
- [~] R239 — `ConfigurationTab.test.ts` does NOT exist and is created inside 81-02 T1 (its verify runs the new file). `OrganizationsTab.test.ts`, `ConfigTextField.test.ts`, `OwnerConsoleView.test.ts`, `ServiceEditorView.test.ts` exist and are extended in place (81-02 T2/T3, 81-03 T1/T2), including the onSnapshot-survives-`setTab` regression in 81-03 T1.
- [~] R240 — `songSearch.test.ts` exists and gains a `filterSongsByTags` block (81-04 T1). `SongBrowser.test.ts` does NOT exist and is created inside 81-04 T2 (its verify runs the new file) alongside the new `SongBrowser.vue` shared wrapper. `SongsView.test.ts` / `SongTable.test.ts` (81-04 T3) and the `ServiceEditorView.test.ts` song-tag-filter block (81-04 T4) are the existing behavior-preservation regression nets — extended in place for the Songs-page suites; the `ServiceEditorView.test.ts` block is re-run only (that file is 81-03's `files_modified` territory this wave, so 81-04 does not edit it — preserving Wave 1 with disjoint file ownership).

*R237/R238 are already-shipped — scoped as verification + documentation. The only missing test file (`ConfigurationTab.test.ts`) is scaffolded within its own task, so every task carries a runnable `<automated>` verify (no `MISSING` placeholder needed).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real volunteers receive mail from the verified domain | R238 | Owner-run DNS/Resend verification; not app-verifiable | Follow the runbook: add the domain in Resend, set SPF/DKIM/DMARC, set `fromAddress` in the Owner Console, send a real test message |
| PC export in the LIVE app includes prayers/message/announcements | R237 | Live Planning Center account | Export a service with non-song slots in each mode; confirm every item lands in PC |
| Screen-reader pass on the Owner Console | R239 | Assistive-tech interaction | Tab through the console; confirm inputs are announced and tabs behave as tabs |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (new files `ConfigurationTab.test.ts` — scaffolded inline in 81-02 T1 — and `SongBrowser.test.ts` — scaffolded inline in 81-04 T2 with its `SongBrowser.vue`)
- [x] No watch-mode flags
- [x] Feedback latency < 120s (single-file scoped runs; functions tests run in their own workspace)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner)
