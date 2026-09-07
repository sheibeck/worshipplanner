---
phase: 128
slug: self-service-magic-link-request-public-security-critical-sha
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-06
---

# Phase 128 — Validation Strategy

> Seeded by plan-phase from 128-RESEARCH.md's Validation Architecture. Planner fills the Per-Task map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app + functions) |
| **Config file** | `vite.config.ts` (app), `functions/vitest.config.*` (functions) |
| **Quick run command** | `npx vitest run <file>` (app) · `cd functions && npx vitest run <file>` (functions) |
| **Full suite command** | `npx vitest run` + `npm run type-check` + `cd functions && npm test` |
| **Estimated runtime** | ~60–400s |

---

## Sampling Rate
- After every task commit: `npm run type-check` + touched test file(s)
- After every wave: `npx vitest run` (app) and/or `cd functions && npm test` (functions)
- Before verify: full app suite (baseline: only `storage.rules.test.ts`) + functions suite green

---

## Per-Requirement Verification Map

*Planner refines from the PLANs; seeded from 128-RESEARCH Validation Architecture.*

| Req | Test type | Automated command | Notes |
|-----|-----------|-------------------|-------|
| R394 | unit (client) | `npx vitest run` (slug→orgId resolution via orgSlugs; "church not found" state) | unauthenticated read of `orgSlugs/{slug}` |
| R395 | unit (functions) | `cd functions && npx vitest run` (identical response for roster-hit vs miss; no code/shape leak) | enumeration-safe — the security gate |
| R396 | unit (functions) | roster-gated: send only when email in `organizations/{orgId}/people`; non-roster → no send | mocked Resend + getAuth |
| R397 | unit (functions) | rate-limit ALLOW/DENY: N within window allowed, N+1 throttled — throttled response stays enumeration-safe | `checkAndConsumeRateLimit` key `${orgId}::${emailLower}` |
| R398 | unit (client) | login "Are you a volunteer?" entry reaches the church-scoped request (church-finder via orgSlugs) | |
| R399 | unit (client) | `/volunteer/verify` failure offers one-tap "request a new link" scoped to the same church (slug from continueUrl) | |

---

## Security ALLOW/DENY (R395–R397 — mirrors Phase 125 rules-test discipline)
- DENY enumeration: roster-hit and roster-miss return byte-identical success responses; no distinct error code/status; timing side-channel mitigated (timing-pad or equivalent per research A4).
- DENY inbox-spam / cost fan-out: repeated requests for the same email+org are throttled after the ceiling; throttled path sends no email and returns the same confirmation.
- ALLOW legitimate: a roster email under the ceiling receives exactly one minted link email.
- DENY cross-org: an email on org A's roster but requested under org B's slug gets no email.

---

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Instructions |
|----------|-------------|------------|--------------|
| Real magic-link email arrives + completes sign-in | R396, R399 | Real Resend send + real inbox (Resend test-mode in prod → owner inbox only) | Request a link for a rostered email; confirm one email arrives and its link signs in |
| Rate-limit felt end-to-end | R397 | Real timing across requests | Submit repeatedly; confirm throttle with no user-visible membership leak |

---

## Validation Sign-Off
- [ ] All requirements have an automated verify or a Wave-0 dependency
- [ ] Enumeration-safety + rate-limit asserted by functions tests (ALLOW/DENY)
- [ ] `nyquist_compliant: true` set

**Approval:** pending
