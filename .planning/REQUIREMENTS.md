# Requirements: WorshipPlanner — Milestone v2.8

**Milestone:** v2.8 — Production Hardening: Comments-as-Specs, Architecture & Security Review
**Defined:** 2026-09-01
**Goal:** Prepare the app for real-world use (it can impact real people if it has issues) by removing
load-bearing comments into GSD's durable stores, then running architectural and security reviews and
remediating the Critical/High findings.

> **Scope decisions (locked at milestone start):**
> - **Comment→spec target:** decision *rationale* (the `R-`/`WR-`/`CR-`/`Pitfall` "why" notes) → **ADRs**
>   (`docs/adr/`, the store those tags already reference); *behavioral/architectural* "how it works" →
>   **`.planning/codebase/`** map docs. Comments shrink to short pointers.
> - **Review outcome:** produce the review reports AND remediate **Critical/High** findings in-milestone;
>   Medium/Low are triaged to a backlog, not fixed here.
> - **No research pass** (internal hardening; security best-practice is applied during the review itself).

---

## v2.8 Requirements

### Comments-as-Specs Extraction

- [x] **R316**: The codebase is audited for load-bearing comments, each classified as decision-rationale,
  behavioral/architectural, or genuinely-local — producing a triage inventory that drives R317/R318.

- [ ] **R317**: Decision-rationale comments (the `R-`/`WR-`/`CR-`/`Pitfall`-tagged "why we did it this
  way" notes) are relocated into ADRs under `docs/adr/`, and each affected code comment is reduced to a
  short pointer (e.g. the ADR id) rather than carrying the rationale itself.

- [ ] **R318**: Behavioral/architectural "how this feature works" comments are relocated into
  `.planning/codebase/` map docs, and the affected code comment is reduced to what the code alone cannot
  convey.

- [ ] **R319**: A written comment convention (comments are short; specifications/ADRs bear the load of how
  features work) is documented so the standard holds for future work.

### Architectural Review

- [ ] **R320**: An architectural review report is produced covering module boundaries, state/store and
  Firestore-listener lifecycle (incl. org-scoped teardown/re-subscription), multi-tenant (org) isolation
  architecture, data flow, and coupling — with severity-ranked findings.

- [ ] **R321**: Critical and High architectural findings from R320 are remediated, or explicitly deferred
  to a backlog with recorded rationale.

### Security Review

- [ ] **R322**: A security review report is produced covering Firestore & Storage security rules,
  auth/custom-claims and route guards, multi-tenant data isolation, Cloud Functions authorization,
  share-token / public-page exposure and PII handling, and cost/abuse controls — with severity-ranked
  findings.

- [ ] **R323**: Critical and High security findings from R322 are remediated, or explicitly deferred to a
  backlog with recorded rationale.

---

## Future Requirements (deferred)

- Remediation of **Medium/Low** architectural and security findings surfaced by R320/R322 (triaged to
  backlog at review time).

## Out of Scope

- **New user-facing features** — this milestone is hardening and internal-quality only.
- **Production deploys** — building/committing only; any prod deploy of remediation (esp. rules/functions)
  is a separate, explicitly owner-confirmed step per standing deploy policy.

- **Rewriting comments that already are short and local** — only load-bearing comments are in scope.

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| R316 | Phase 108 | Complete |
| R317 | Phase 108 | Pending |
| R318 | Phase 109 | Pending |
| R319 | Phase 109 | Pending |
| R320 | Phase 110 | Pending |
| R321 | Phase 111 | Pending |
| R322 | Phase 112 | Pending |
| R323 | Phase 113 | Pending |

**Coverage:** 8/8 v2.8 requirements mapped, each to exactly one phase (Phases 108–113). No orphans, no
duplicates.
