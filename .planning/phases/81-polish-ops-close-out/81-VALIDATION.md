---
phase: 81
slug: polish-ops-close-out
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| _planner fills rows_ | | | R237–R240 | unit / component / doc-gate | `npx vitest run …` / grep | ⬜ pending |

*Coverage the planner must map: R237 → the EXISTING `planningCenterApi.ts`/`ServiceEditorView.vue` export tests re-confirmed green (already-shipped; a traceability/verification task, NOT a rebuild — add a coverage assertion only if a gap is found); R238 → a doc-gate that the owner runbook file exists + a test/inspection that the send path reads `appConfig.sender.fromAddress` (already wired); R239 → component tests that the 4 Owner-Console inputs + the ConfigTextField label carry accessible names and both tab strips expose `role="tablist"/tab"/aria-selected` WITHOUT converting v-show→v-if (assert the panels stay mounted); R240 → a unit test for the extracted `filterSongsByTags()` util + tests proving both `SongsView`/store and `SongSlotPicker` still filter identically after the refactor.*

---

## Wave 0 Requirements

- [ ] R237 — re-run existing PC-export tests (all `SlotKind`s exported; `IMPORTED` excluded by design); add an assertion only if a gap surfaces.
- [ ] R238 — owner runbook doc exists (`functions/DEPLOY-EMAIL-DOMAIN.md` or similar); send-path-reads-config assertion.
- [ ] R239 — component tests: accessible names on the 4 inputs + label; ARIA tab roles on both strips; panels still mounted under v-show.
- [ ] R240 — `filterSongsByTags()` util unit test + both-consumers-unchanged tests.

*Existing vitest infrastructure covers all phase requirements; every Wave 0 item is a new/rewritten test in an existing suite. R237/R238 are largely already-shipped — scope them as verification + documentation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real volunteers receive mail from the verified domain | R238 | Owner-run DNS/Resend verification; not app-verifiable | Follow the runbook: add the domain in Resend, set SPF/DKIM/DMARC, set `fromAddress` in the Owner Console, send a real test message |
| PC export in the LIVE app includes prayers/message/announcements | R237 | Live Planning Center account | Export a service with non-song slots in each mode; confirm every item lands in PC |
| Screen-reader pass on the Owner Console | R239 | Assistive-tech interaction | Tab through the console; confirm inputs are announced and tabs behave as tabs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
