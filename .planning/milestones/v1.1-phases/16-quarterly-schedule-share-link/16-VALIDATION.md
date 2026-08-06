---
phase: 16
slug: quarterly-schedule-share-link
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-09
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest config (project default — confirm during Wave 0) |
| **Quick run command** | `npx vitest run src/utils/scheduler.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant quick command (`npx vitest run <file>`)
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Populated per-plan during planning. R-12 (scheduler pairing fix) is the mandatory automated coverage anchor — the Nolan/Tim containment case MUST have a deterministic unit test in `scheduler.test.ts`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-XX-XX | XX | X | R-12 | — | Nolan (once/mo, must-serve-with Tim) serves once/mo; every Nolan occurrence coincides with a Tim occurrence; Tim's extras don't drag Nolan in | unit | `npx vitest run src/utils/scheduler.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Confirm vitest is installed and the existing `scheduler.test.ts` suite runs green before layering R-12 changes.

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Matrix view renders roles × dates and toggles to list | R-01 | Visual/DOM layout | Open share link, toggle matrix/list, confirm both render from snapshot |
| Matrix auto-falls back to list on phone widths | R-01 / D-14 | Responsive breakpoint | Narrow viewport → list default; toggle still available |
| Memorable URL `/{slug}/quarter{N}-{YYYY}` resolves to snapshot | R-02 | Router + Firestore read | Visit derived URL; confirm same content as opaque token route |
| Reserved slug cannot shadow app routes | R-02 / D-19 | Route precedence | Attempt slug = `settings`/`schedule`; confirm reserved/suffixed and app route wins |
| Name filter typeahead persists in URL (view + name) | R-03 / D-15/16 | UX interaction | Select a name; reload URL; confirm same filtered view reproduced |
| Schedule-page redesign integrates collapsible sections | R-09 / R-11 | Visual/UX | Confirm redesigned layout + collapse state remembered per-user |
| QuarterGrid whole-cell click opens right-side slide-out | R-13 / R-14 | Pointer target + drawer | Click anywhere in cell → slide-out opens; remove pills still `@click.stop` |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
