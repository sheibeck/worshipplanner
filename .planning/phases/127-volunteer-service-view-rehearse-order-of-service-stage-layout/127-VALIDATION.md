---
phase: 127
slug: volunteer-service-view-rehearse-order-of-service-stage-layout
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-06
---

# Phase 127 — Validation Strategy

> Seeded by plan-phase from 127-RESEARCH.md's Validation Architecture. Planner fills the Per-Task map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app + rules) |
| **Config file** | `vite.config.ts` (app), `vitest.rules.config.ts` (rules) |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npx vitest run` + `npm run type-check` (+ `npm run test:rules` if the projection extension touches rules — expected NOT to) |
| **Estimated runtime** | ~60–120s |

---

## Sampling Rate
- After every task commit: `npm run type-check` + touched test file(s)
- After every wave: `npx vitest run`; `npm run build` for the view/route plans
- Before verify: full suite green (baseline: `storage.rules.test.ts`)

---

## Per-Task Verification Map

*Planner fills from the PLANs.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| TBD | — | 1 | R384/R392/R393 | unit | `npx vitest run src/utils/rehearseAccess.test.ts` (order/role/stage projection extension reuses buildServiceSnapshot allowlists; no PII leak) | ⬜ pending |
| TBD | — | — | R385–R390 | unit | `npx vitest run` (song-select, speed/loop player logic, external-link open, orgId resolution from store) | ⬜ pending |
| TBD | — | — | R384/R391 | type+build | `npm run type-check` + `npm run build` (standalone tri-tab view replaces placeholder; mobile reflow) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements
- [ ] Unit tests for the extended `buildRehearseAccess` (orderOfService + roleAssignments + stageLayout via
      the shared `buildServiceSnapshot` allowlists — assert NO free-text notes/slot bodies leak).
- [ ] Unit test for **orgId resolution** from the `mySchedule` store (the route carries no orgId) incl. the
      cold-navigation `loadMySchedule` fallback.
- [ ] Player logic tests: speed cycle (1/0.9/0.75/1.25), loop toggle, one-track-at-a-time.

*Frameworks present; Wave 0 items authored within the phase's plans.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real PDF opens/prints and real MP3 plays (with speed/loop) on desktop AND a phone | R386–R389, R391 | Native iframe/OS PDF viewer + `<audio>` playback + print + mobile reflow can't be exercised in jsdom | On desktop + a phone: open a rehearse service, view/print a chart, play an MP3, change speed, toggle loop, open an external link; confirm Order of Service + Stage Layout tabs render read-only |

---

## Validation Sign-Off
- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Projection-extension PII-safety asserted by test (no notes/slot-body leak)
- [ ] `nyquist_compliant: true` set

**Approval:** pending
