# Phase 110: Architectural Review - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Produce a severity-ranked **architectural review report** covering the five ROADMAP areas: module
boundaries, store/Firestore-listener lifecycle (incl. org-scoped teardown/re-subscription),
multi-tenant (org) isolation architecture, data flow, and coupling. Every finding carries an explicit
severity and a concrete file/module location. Critical/High are clearly distinguished from Medium/Low
so Phase 111 has an unambiguous remediation scope.

In scope: reading the codebase (now that its load-bearing comments/docs are relocated) and writing the
report. NO code changes — this is a review-only phase. No production deploy.

Out of scope: fixing anything (Phase 111 does that); security-specific review (Phase 112).
</domain>

<decisions>
## Implementation Decisions

### Review Method & Reporting (accepted by owner 2026-09-02)
- **Report location:** `.planning/phases/110-architectural-review/110-ARCHITECTURE-REVIEW.md` (phase
  deliverable; Phase 111 reads it from there). The Phase 112 security review will follow the same
  in-phase-dir pattern.
- **Severity rubric:**
  - **Critical** — data loss, cross-tenant data leak, or auth bypass.
  - **High** — a correctness bug or multi-tenant isolation weakness likely to bite under real use.
  - **Medium** — maintainability/coupling risk, or a latent bug that needs specific conditions.
  - **Low** — nits / style.
  - Critical + High → remediated in Phase 111. Medium + Low → triaged to backlog (not fixed here).
- **Review method:** Dimension-focused reviewer agents — one per ROADMAP area — each grounded in the
  freshly-relocated `.planning/codebase/` map docs + the `docs/adr/` ADRs + the real source, whose
  findings are consolidated into one severity-ranked report. (Runs sequentially in this repo.)
- **Scope:** exactly the five ROADMAP areas, explicitly including the church-switch re-subscribe hot
  spot as part of store/listener lifecycle (a recent real defect area).

### Locked at milestone start (REQUIREMENTS.md v2.8 scope)
- Reviews produce reports AND (in the paired remediation phase) fix Critical/High; Medium/Low → backlog.
- No research pass — architectural best-practice is applied during the review itself.
- No production deploy in this milestone (this phase makes no code changes at all).

### Claude's Discretion
- Exact report section structure, the per-dimension checklist each reviewer uses, and how findings are
  numbered (e.g. `ARCH-001`).
- Whether to merge closely-related dimensions into a single reviewer pass when that is more effective.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.planning/codebase/` map docs (ARCHITECTURE, STRUCTURE, INTEGRATIONS, CONCERNS, TESTING, STACK,
  CONVENTIONS) — freshly enriched in Phase 109 with 309 relocated behavioral notes; primary orientation
  for the review. Note the base maps predate v1.1→v2.7, so verify claims against live source.
- `docs/adr/` — 244 ADRs (Phase 108) capturing decision rationale; useful for "why is it this way".
- `.planning/codebase/CONCERNS.md` already enumerates known concerns — a starting point, not a ceiling.

### Established Patterns
- Multi-tenant isolation runs on custom auth claims (org membership), Firestore rules, and org-scoped
  Pinia stores that must teardown/re-subscribe on church switch (see the church-switch re-subscribe
  fix, quick 260901-lua, and `resetOrgScopedStores()`).
- The `.planning/graphs/` graph is STALE — grep/read real source, do not trust graph queries.

### Integration Points
- Stores in `src/stores/**`, composables in `src/composables/**`, Firestore listeners, `src/firebase/`,
  `firestore.rules`/`storage.rules`, and Cloud Functions in `functions/src/**`.

</code_context>

<specifics>
## Specific Ideas

- The church-switch re-subscribe path and `resetOrgScopedStores()` are a known recent hot spot — the
  store/listener-lifecycle dimension must scrutinize org-scoped teardown/re-subscription specifically.
- Ground findings in real file:line locations so Phase 111 can act without re-discovery.
- Distinguish Critical/High from Medium/Low unambiguously — Phase 111's scope is exactly the C/H set.

</specifics>

<deferred>
## Deferred Ideas

- Fixing any finding — Phase 111.
- Security-specific findings (rules/auth/PII/cost-abuse) — Phase 112, though genuine security issues
  noticed incidentally should be noted for handoff to 112.

</deferred>
