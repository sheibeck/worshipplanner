---
phase: 77
slug: church-deletion-cascade-cleanup
verdict: SECURED
threats_closed: 11
threats_open: 0
asvs_level: 1
audited: 2026-08-23
---

# Phase 77 — Security Verdict: SECURED

Retroactive threat-mitigation audit of the destructive `deleteOrganization` cascade + the `firestore.rules`
client-delete DENY, against the `<threat_model>` registers in 77-01/77-02 PLAN.md. Every declared
mitigation verified **live** against the implemented code (not the review's claims) and by running the
suites independently. Ships **UNDEPLOYED** (owner-gated deploy) — expected, not an open threat.

## Tests run (live)

| Command | Result |
|---------|--------|
| `cd functions && npm run build` (tsc) | exit 0 — clean (CR-01 build break stays fixed) |
| `cd functions && npx vitest run` | 544/544 passed (15 files), incl. 24/24 `orgDeletion.test.ts` |
| `npx vitest run --config vitest.rules.config.ts` (live emulator) | 203/203 passed — incl. both new `organizations/{orgId}` delete-DENY tests (editor + super-admin client contexts) |
| `npx vitest run` (app suite) | documented 2-file baseline only (`storage.rules.test.ts`, `RosterView.test.ts`); no new failures |

## Threat table (code-cited)

| Threat | Category | Sev | Disposition | Evidence |
|--------|----------|-----|-------------|----------|
| T-77-01 | EoP — unauthorized deletion | critical | mitigate | `assertSuperAdminCaller` is line 1 of `deleteOrganizationHandler` (`orgDeletion.ts:95`); `firestore.rules:147` `allow delete: if false;` with the `write`→`update` narrowing (`firestore.rules:124`) so the DENY is not a no-op; emulator DENY proven for editor + super-admin (`src/rules.test.ts:488-501`). No other client-reachable bulk-delete path. |
| T-77-02 | Tampering — wrong-org deletion | high | mitigate | Server re-reads `organizations/{orgId}.name`; `confirmName.trim() !== orgName.trim()` (`orgDeletion.ts:130`, case-sensitive) before any read/delete; mismatch rejected with zero destructive calls (`orgDeletion.test.ts:282-292`). |
| T-77-03 | Tampering/DoS — orphan via ordering | high | mitigate | Full READ phase (members, inviteLookup, orgNames guard, 5 extra collections) completes before any WRITE/Storage/`recursiveDelete` — call-order test (`orgDeletion.test.ts:344-373`). |
| T-77-04 | Tampering — client rules delete bypass | critical | mitigate | Unconditional `allow delete: if false`, no super-admin exemption (`firestore.rules:132-147`). |
| T-77-05 | Repudiation | medium | mitigate | `console.warn` audit line (orgId/name/callerUid) after guards, before destructive steps (`orgDeletion.ts:137`) — Cloud-Logging-backed. |
| T-77-06 | Tampering — deactivate/delete race | high | mitigate | `active` read fresh at call start (`orgDeletion.ts:117`); refused `failed-precondition` before any cascade read (`orgDeletion.test.ts:262-280`). |
| T-77-07 | Info disclosure — orphaned share docs | medium | mitigate | All 5 `EXTRA_ORG_KEYED_COLLECTIONS` (`orgDeletion.ts:38-44`) queried `where('orgId','==',orgId)` and deleted; cross-org docs untouched (`orgDeletion.test.ts:475-497`). |
| T-77-08 | Tampering/DoS — cross-tenant orphan on retry | high | mitigate | `FieldValue.arrayRemove(orgId)` merge-set, never overwrite (`orgDeletion.ts:81`); every query orgId-scoped; idempotent-retry + never-touches-another-org tests pass (`orgDeletion.test.ts:542-583`). |
| T-77-SC | Supply chain | n/a | accept | No `functions/package.json` change in any Phase 77 commit. |
| T-77-09 | Client type-to-confirm is UX-only | low | accept | Server independently re-verifies `confirmName` (T-77-02) — a client bypass gains nothing. |
| T-77-10 | Info disclosure — dialog echo | low | accept | Dialog renders only props already returned by the super-admin-gated `listOrganizations` to the same client. |
| T-77-11 | Repudiation — client row removal | low | accept | Durable record is the server log (T-77-05) + returned summary. |

**WR-01** (timeout/memory): `onCall({ timeoutSeconds: 540, memory: "512MiB" }, ...)` (`orgDeletion.ts:230`) with a documented resumability boundary. **WR-02** (confirmName trim): server both-sides trim (`orgDeletion.ts:130`); the client-dialog mirror was completed after the audit (`DeleteOrgConfirmDialog.vue` now trims both sides, commit `0b5d3cef`, +1 test) — the audit's one residual non-blocking finding is now closed. **Open threats: 0.**
