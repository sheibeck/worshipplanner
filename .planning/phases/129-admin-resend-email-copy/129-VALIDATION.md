---
phase: 129
slug: admin-resend-email-copy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-06
---

# Phase 129 — Validation Strategy

> Seeded by plan-phase from 129-RESEARCH.md's Validation Architecture. Planner fills the Per-Task map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app + functions) |
| **Quick run command** | `npx vitest run <file>` (app) · `cd functions && npx vitest run <file>` (functions) |
| **Full suite command** | `npx vitest run` + `npm run type-check` + `cd functions && npm test` |
| **Estimated runtime** | ~60–400s |

---

## Sampling Rate
- After every task commit: `npm run type-check` + touched test file(s)
- Before verify: full app suite (baseline: only `storage.rules.test.ts`) + functions suite green

---

## Per-Requirement Verification Map

| Req | Test type | Automated command | Notes |
|-----|-----------|-------------------|-------|
| R400 | unit (functions) | `cd functions && npx vitest run src/index.test.ts` — admin callable mode:'email' sends via shared core, returns {sent} | editor-authz + roster-gated |
| R401 | unit (functions + client) | mode:'copy' mints via shared core + returns {link}; client copies via navigator.clipboard | works in Resend test-mode (no send) |
| R402 | unit (functions) | one mint code path: `mintVolunteerLink` extracted, used by BOTH email (compose+send) and copy; assert single mint helper | R402 = one code path |
| authz | unit (functions) | non-editor / non-member caller → permission-denied; unauthenticated → unauthenticated | mirror queueServiceMessageHandler authz |
| roster gate | unit (functions) | target email not on org roster or no email → honest error (NOT enumeration-safe generic — authenticated editor) | mint to emailLower |

---

## Security / Threat Model note
- Authenticated + editor/admin-gated + roster-gated. The accepted editor→volunteer impersonation tradeoff
  (an editor can mint a volunteer's account-level link) is an intentional, documented risk acceptance for
  this read-only volunteer role — NOT a mitigated finding. No enumeration/rate-limit machinery (caller is a
  trusted editor who already sees the roster).

---

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Instructions |
|----------|-------------|------------|--------------|
| Real emailed link arrives + signs in | R400 | Real Resend send + inbox (test-mode → owner inbox in prod) | Email a rostered volunteer from RosterView; confirm the email + link |
| Clipboard copy works on a real browser | R401 | `navigator.clipboard` needs a real secure context | Copy from RosterView; paste; confirm it's the sign-in link |

---

## Validation Sign-Off
- [ ] R400–R402 have automated verify
- [ ] Single mint code path (R402) asserted by test
- [ ] `nyquist_compliant: true` set

**Approval:** pending
