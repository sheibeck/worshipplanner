# Phase 112: Security Review - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Produce a severity-ranked **security review report** at
`.planning/phases/112-security-review/112-SECURITY-REVIEW.md` covering the six ROADMAP areas:
(1) Firestore & Storage security rules, (2) auth/custom-claims and route guards, (3) multi-tenant data
isolation, (4) Cloud Functions authorization, (5) share-token/public-page exposure and PII handling, and
(6) cost/abuse controls. Every finding carries an explicit severity + concrete location. Critical/High
unambiguously separated from Medium/Low so Phase 113 has an unambiguous remediation scope.

In scope: reading the code/rules/functions and running the rules test suite for evidence, then writing
the report. NO code changes (review-only). No production deploy.

Out of scope: fixing findings (Phase 113).
</domain>

<decisions>
## Implementation Decisions

### Reporting & Method (pre-accepted from Phase 110, 2026-09-02)
- **Report location:** `.planning/phases/112-security-review/112-SECURITY-REVIEW.md` (phase deliverable;
  Phase 113 reads it).
- **Severity rubric:** Critical = data loss / cross-tenant data leak / auth bypass; High = a real
  isolation/authz weakness likely exploitable under real use; Medium = defense-in-depth gap or a bug
  needing specific conditions; Low = nits. Critical + High → Phase 113; Medium + Low → backlog.
- **Review method:** dimension-focused review passes (one plan per grouped dimension) — each executor
  conducts the review ITSELF (no sub-agent spawning; executors can't nest agents), grounded in real
  source + rules + `docs/adr/` + `.planning/codebase/` maps — consolidated into one ranked report.

### Security-specific decisions (accepted by owner 2026-09-02)
- **Live rules-test evidence:** a Firestore emulator is running on :8080 — run
  `npx vitest run --config vitest.rules.config.ts` to ground Firestore-rules findings in real allow/deny
  behavior (the harness scopes to projectId `test-project`; prod data is `worship-planner-bc515`, so it
  is safe). Static-read `storage.rules` and NOTE the known cross-service `firestore.exists()` Storage-
  emulator limitation (see CLAUDE.md) rather than treating a Storage-rules allow-case test failure as a
  finding. Do NOT deploy anything.
- **Dimension grouping:** 3 review plans + 1 consolidation:
  - (A) Firestore & Storage security rules + multi-tenant data isolation.
  - (B) auth/custom-claims + route guards + Cloud Functions authorization.
  - (C) share-token/public-page exposure + PII handling + cost/abuse controls.
- **Fold in the Phase 110 handoff items:** assess **ARCH-005** (undeployed org-provisioning Cloud
  Functions — an authorization/deploy-gap concern) and **re-evaluate ARCH-018** (super-admin
  `isOrgEditor` universal-grant residual, "accepted" at Phase 78) under a security lens as explicit 112
  findings with their own severity calls.

### Locked at milestone start (REQUIREMENTS.md v2.8 scope)
- Reviews produce reports AND (in Phase 113) fix Critical/High; Medium/Low → backlog.
- No research pass — security best-practice applied during the review itself.
- No production deploy (this phase makes no code changes at all).

### Claude's Discretion
- Exact report section structure, per-dimension checklists, finding id scheme (e.g. SEC-001).
- Whether to author a small emulator allow/deny probe if a rule's behavior is ambiguous from reading.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets / known security context
- `firestore.rules`, `storage.rules`, and their test suites (`src/rules.test.ts` via
  `vitest.rules.config.ts`; `src/storage.rules.test.ts`). CLAUDE.md documents: bare `npx vitest run`
  EXCLUDES `src/rules.test.ts`; run rules via `npm run test:rules` OR, when an emulator is already up,
  `npx vitest run --config vitest.rules.config.ts`. `src/storage.rules.test.ts`'s 2 allow-cases fail
  under the emulator because `firestore.exists()` is inert cross-service in the Storage emulator — an
  ENVIRONMENT limitation of that rule, prod was fixed via an IAM role grant (see CLAUDE.md).
- Multi-tenant isolation = custom auth claims (org membership) + Firestore rules + org-scoped Pinia
  stores. Phase 110 confirmed the isolation architecture "otherwise sound" (single orgId source, no
  hardcoded org ids, server-side membership re-verification in functions) — but that was an
  architectural pass; this is the security-specific pass.
- Cloud Functions in `functions/src/**` (the `api` proxy with cost controls R161-R164, messaging,
  provisioning, cleanup sweeps, the Bible-API gate). v1.8 added cost caps; v2.6 added per-org Bible gate.
- Share tokens / public pages: ShareView, `?view=stage`, public shared service link, snapshot docs.
- `docs/adr/` (244 ADRs) + `.planning/codebase/CONCERNS.md` capture prior security rationale (e.g.
  the storage.rules IAM fix, inviteLookup gate, createdBy immutability, share revocation).

### Integration Points
- `firestore.rules`, `storage.rules`, `functions/src/**`, `src/router` route guards, `src/stores/auth.ts`
  (custom claims), share/public views, and the `api` proxy cost/abuse controls.

</code_context>

<specifics>
## Specific Ideas

- Ground Firestore-rules findings in the live emulator suite (it is running) — report what the rules
  actually allow/deny, not just what they appear to.
- The Phase 113 remediation success criterion REQUIRES a real ALLOW-case emulator test for any rules
  fix — so where this review finds a rules issue, note the allow-case test that a fix must add.
- Re-evaluate ARCH-018 (super-admin universal `isOrgEditor`) as a genuine security finding, not just an
  accepted architectural note — it is a privilege-scope question.

</specifics>

<deferred>
## Deferred Ideas

- Fixing any finding — Phase 113.
- Medium/Low security findings — triaged to backlog at Phase 113 (this phase only reports).

</deferred>
