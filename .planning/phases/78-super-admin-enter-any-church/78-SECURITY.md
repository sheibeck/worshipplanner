---
phase: 78
slug: super-admin-enter-any-church
verdict: SECURED
threats_closed: 7
threats_open: 0
asvs_level: 1
audited: 2026-08-23
---

# Phase 78 — Security Verdict: SECURED

Retroactive threat-mitigation audit of the super-admin content arm (`firestore.rules` + `storage.rules`) +
the client enter/exit flow, against the `<threat_model>` registers in 78-01/78-02 PLAN.md. Verified at L2/L3
depth — data-flow traced, live emulator + unit tests re-run independently (not taken from plan/review
claims). Ships **UNDEPLOYED** (owner-gated rules deploy) — expected, not an open threat.

## Tests run (live)

| Command | Result |
|---------|--------|
| `npm run type-check` | clean |
| `npx vitest run --config vitest.rules.config.ts` (live emulator) | 213/213 passed (187 `rules.test.ts` + 26 `storage.rules.test.ts`) — incl. the R225 ALLOW/DENY matrix, the super-admin lifecycle-write DENY, the super-admin delete DENY, and all pre-existing Phase 76/77 rules tests |
| `npx vitest run src/stores/__tests__/auth.test.ts …OrganizationsTab… …AppShell…` | 138/138 passed |
| `npx vitest run` (app suite) | documented 2-file baseline only; no new regressions |

## Threat table (code-cited)

| Threat | Category | Sev | Disposition | Evidence |
|--------|----------|-----|-------------|----------|
| T-78-01 | EoP — super-admin content arm | critical | mitigate | `firestore.rules:33-73` (`isOrgMember`/`isOrgEditor` OR `isSuperAdmin()` outermost, claim-only, no cross-doc lookup); `storage.rules:48-75` mirrors. Claim origin non-forgeable: `superAdminClaims.ts` trigger is the sole claim writer off the owner-gated `superAdmins/{uid}` doc + `setSuperAdminClaimHandler` server double-check. ALLOW + non-member DENY proven live (`rules.test.ts:525-554`, `storage.rules.test.ts:304-342`). |
| T-78-02 | EoP/Tampering — super-admin client lifecycle write | critical | mitigate | `firestore.rules:161` org-doc `allow update: if isOrgEditor(orgId) && preservesLifecycleFields();` — the `|| isSuperAdmin()` disjunct is genuinely absent (direct read). Super-admin `update({active:false})` DENIED test (`rules.test.ts:564-571`) re-run live, passes — must use `setOrgActive` (Admin SDK) so the `deactivatedOrgs` fan-out runs. |
| T-78-03 | Tampering/EoP — member-doc create via arm | low | accept | `firestore.rules:186-201` inline comment (IN-02) documents the residual (super-admin client SDK can legally `create` a member doc via the widened `isOrgEditor`); mitigated as a CLIENT contract — `enterOrgAsSuperAdmin` writes no `setDoc`/`writeBatch` (`auth.test.ts:1518-1529`), and `TeamView.vue` reads only `members`/`invites`. Super-admins are fully trusted; not exploitable in the normal flow. |
| T-78-04 | Tampering — super-admin client org-delete | high | mitigate | `firestore.rules:184` `allow delete: if false;` byte-unchanged (no isOrgEditor/isOrgMember/isSuperAdmin reference). Super-admin client-delete DENY test (`rules.test.ts:505-510`) re-run live, passes. |
| T-78-05 | DoS — self-inflicted router strand | medium | mitigate | `auth.ts:159-176` `hasNoOrg` gains `&& viewingAsSuperAdmin === null`; the sibling WR-01 gap (`deactivatedOrgMessage` not cleared) fixed — `resetOrgContext` now clears it (`auth.ts:307-333`, commit `d29cb26e`); regression test (`auth.test.ts:1571-1584`) passes. |
| T-78-06 | Info disclosure/Tampering — client state not a boundary | low | accept | `viewingAsSuperAdmin` + forced `userRole='editor'` are pure Pinia refs with no privileged effect independent of the rules arm; `isSuperAdmin` set only from `getIdTokenResult().claims.superAdmin`, never client-writable. |
| T-78-07 | Repudiation — no audit log | low | accept | Deferred per 78-CONTEXT.md (super-admin action audit log = future scope). |

Non-security review fixes verified present (not privilege-boundary): WR-02 double-submit guard
(`OrganizationsTab.vue` `enteringOrgId`), WR-03 navigate-only-on-success (`enterOrgAsSuperAdmin` returns
`Promise<boolean>`). **Open threats: 0.**
