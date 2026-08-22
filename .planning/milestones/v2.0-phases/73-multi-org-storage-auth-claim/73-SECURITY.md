---
phase: 73
slug: multi-org-storage-auth-claim
verdict: SECURED
threats_closed: 6
threats_open: 0
asvs_level: 1
audited: 2026-08-21
---

# Phase 73 — Security Verdict: SECURED

Retroactive threat-mitigation audit of the widened org-membership custom claim + `storage.rules` change,
against the `<threat_model>` registers in 73-01/73-02/73-03 PLAN.md. All mitigations verified **live**
(54/54 functions unit tests, 16/16 storage-rules emulator tests) and by direct code reading — not merely
grepped. This phase ships **UNDEPLOYED** (owner-gated deploy per the v2.0 grant); that is expected, not an
open threat.

| Threat | Category | Sev | Disposition | Evidence |
|--------|----------|-----|-------------|----------|
| T-73-01 (writer) | Tampering/EoP — claim-wipe (superAdmin or a valid second-org membership dropped) | high | mitigate | All writes route through `mergeAndSetCustomClaims` / `mergeSetAndClearCustomClaims` / targeted `clearClaimKeys`; the only bare `setCustomUserClaims` sites are inside `claimsHelpers.ts`. Delete branch recomputes `orgs` from survivors. superAdmin-preservation + primary-clear-keep-second-org unit tests pass. |
| T-73-01 (backfill) | Tampering/EoP — superAdmin wipe in backfill | high | mitigate | `backfillOrgClaims.ts` switched from bare `setCustomUserClaims` to `mergeAndSetCustomClaims`; superAdmin-preserved test passes. |
| T-73-02 | EoP/Info-disclosure — cross-org Storage access | high | mitigate | `storage.rules isOrgMemberByClaim` ORs a null-guarded `orgs[orgId]` arm with the legacy arm, both against the requested path orgId. `orgs` is fed only by the trigger's `collectionGroup('members')` scan (never client-writable `users/{uid}`); membership writes are `firestore.rules`-gated by `isOrgEditor`, so a client cannot self-escalate. multi-org ALLOW + cross-org DENY emulator tests pass. |
| T-73-03 | Tampering — stale-claim-after-removal | high | mitigate | Removal is now a **single atomic** `mergeSetAndClearCustomClaims({ set:{orgs}, clear:ORG_CLAIM_KEYS })` write (WR-01 fix, commit `455935fa`) — the two-write TOCTOU window is gone; `orgs` recomputed from a post-delete strongly-consistent scan. |
| T-73-05 | Tampering/DoS — deny-everyone regression | high | mitigate | No `firestore.exists(` in `storage.rules`; static-assertion guard test passes (the cross-service read that once shipped a deny-everyone rule stays absent). |
| T-73-06 | Denial of legitimate access — null-index eval error | medium | mitigate | `orgs != null` guards before indexing; legacy-claim-ALLOW emulator test passes. |

**Accept/transfer (verified present, not gaps):** T-73-04 (no CAS primitive in `claimsHelpers` — pre-existing
residual, not widened here); T-73-07 (no-drift shared builder + `orgsMapsEqual` deduped, commit `5decfda4`);
T-73-SC (no new npm dependency).

**Unregistered flags:** none. **Open threats: 0.**

Audit was read-only; WR-01 (`455935fa`) and WR-02 (`788b1806`) review fixes confirmed present in code, not
merely documented.
