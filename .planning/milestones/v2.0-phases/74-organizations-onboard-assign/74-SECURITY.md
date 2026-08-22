---
phase: 74
slug: organizations-list-onboard-admin-assignment
verdict: SECURED
threats_closed: 8
threats_open: 0
asvs_level: 1
audited: 2026-08-21
---

# Phase 74 — Security Verdict: SECURED

Retroactive threat-mitigation audit of the three super-admin-gated provisioning callables + the Organizations
tab UI, against the `<threat_model>` registers in 74-01/74-02 PLAN.md. Verified **live** against code and the
passing test suites (34 functions tests + 18 component tests), not documentation. Ships **UNDEPLOYED**
(owner-gated deploy per the v2.0 grant) — expected, not an open threat.

| Threat | Category | Sev | Disposition | Evidence |
|--------|----------|-----|-------------|----------|
| T-74-01 | EoP — authz bypass | high | mitigate | `assertSuperAdminCaller` is the first call in all three handlers — rejects unauthenticated + `token.superAdmin !== true`, then independently re-reads `superAdmins/{callerUid}` (matches `setSuperAdminClaim` verbatim). |
| T-74-02 | Spoofing/EoP — forged payload | high | mitigate | Target resolved server-side via `getUserByEmail` (no client uid trusted); role hardcoded `"editor"` in both write branches (no client-supplied role field exists). |
| T-74-03 (R206) | Tampering — membership overwrite | high | mitigate | Single shared `writeAdminAssignment` writes `users/{uid}.orgIds` only via `arrayUnion` + merge (never overwrite). WR-01 fix live: `assignOrgAdmin` pre-reads the member doc and preserves `existingJoinedAt` on re-assignment (commit `99072c32`). |
| T-74-04 (R201/R202) | Tampering — duplicate/half-created org | high | mitigate | `resolveAdminTarget` runs before `runTransaction`; the only read (`tx.get(nameRef)`) precedes all writes and throws `already-exists` before any write; orgNames claim + org + settings + first-admin all on one transaction — no post-commit step, so a failure strands nothing. |
| T-74-05 | Repudiation/DoS — invite-masking | medium | mitigate | `resolveAdminTarget` catches ONLY `auth/user-not-found` (rethrows others). WR-02 fix live: `assertValidEmailFormat` rejects empty/`/`-containing/malformed email before it's used as a doc id (commit `facf1b93`). |
| T-74-06 | Tampering/DoS — orphan membership | medium | mitigate | `assignOrgAdmin` reads `organizations/{orgId}` and throws `not-found` before any write. |
| T-74-07 (R200/R204) | EoP/Tampering — client direct writes | high | mitigate | `OrganizationsTab.vue` imports only `httpsCallable` — no Firestore write import; "no direct writes" test passes. |
| T-74-08 | Info-disclosure — cross-row feedback bleed | low | mitigate | `assignError`/`assignFeedback` are orgId-keyed maps; per-row-scoping test passes. |

**Accept:** T-74-SC (no new npm dependency in either plan). **WR-03** double-submit guard confirmed live
(commit `50d25aca`). **Unregistered flags:** none. **Open threats: 0.**
