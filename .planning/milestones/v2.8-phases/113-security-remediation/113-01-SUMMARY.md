---
plan: 113-01
phase: 113-security-remediation
status: complete
requirements: [R323]
completed: 2026-09-02
key_files:
  modified:
    - firestore.rules
    - src/rules.test.ts
---

# 113-01 SUMMARY — SEC-S-01 + SEC-ISO-01 firestore.rules remediation

**Tasks:** 3/3 (Task 3 verification + this summary finished by the orchestrator after the executor
stopped mid-verification without emitting a completion marker; tasks 1 & 2 were committed by the executor).

## Commits
- `c9890f0e` fix(113-01): SEC-S-01 split get/list on shareTokens/quarterShares/serviceShares
- `3ce84f9f` fix(113-01): SEC-ISO-01 remove legacy client-side org self-provisioning
- (this summary + STATE/ROADMAP progress: orchestrator commit)

## What changed

### SEC-S-01 (Critical — live prod cross-tenant leak, now closed in code)
`firestore.rules`: the three share collections now split the previously-unified `allow read: if true`
into `allow get: if true;` + `allow list: if false;`:
- `shareTokens/{token}` (rules :346-347)
- `quarterShares/{shareId}` (:395-396)
- `serviceShares/{shareId}` (:414-415)

This preserves the shipped `getDoc`-by-known-id flow (144-bit opaque token) while denying the
unauthenticated `getDocs(collection(...))` enumeration the Phase 112 probe proved was live.
(orgSlugs / orgNames were intentionally left as the lower-sensitivity SEC-ISO-06 backlog residual.)

### SEC-ISO-01 (High)
`firestore.rules`: removed the legacy client-side org self-provisioning path — the
`organizations/{orgId}` client `allow create` branch and the `members/{uid}` Flow-1 "org creation"
disjunct. `onboardOrganization` (Admin SDK, deployed) remains the only sanctioned provisioning path.
Flow-2 (invite acceptance via `inviteLookup`) is untouched.

### Tests (`src/rules.test.ts`)
- DENY-case (regression proof): `assertFails(getDocs(collection(db, '<c>')))` for shareTokens (:1278),
  quarterShares (:992), serviceShares (:1135) — unauthenticated collection listing now denied.
- ALLOW-case: `getDoc`-by-id still succeeds for the share collections (existing shareTokens get test
  preserved; siblings covered).
- SEC-ISO-01: the former "founder of a brand-new org" ALLOW test flipped to
  `DENIES a non-super-admin self-provisioning...` (:268) + a second client-create deny test (:662);
  invite-acceptance Flow-2 ALLOW preserved.

## Verification (orchestrator-run)
- `npx vitest run --config vitest.rules.config.ts`: **`src/rules.test.ts` 203 passed / 26 skipped**
  (includes the new SEC-S-01 DENY + SEC-ISO-01 tests). `src/storage.rules.test.ts` fails only on the
  documented cross-service `firestore.exists()` Storage-emulator env limitation (no Storage emulator
  this session) — the known baseline, NOT a regression.
- `npm run type-check` (vue-tsc --build): exits 0.
- **No deploy performed** — the production `firestore.rules` deploy is the orchestrator's post-verification
  step, gated on explicit per-deploy owner confirmation.

## Deviations
- The executor completed tasks 1 & 2 (committed) but stopped during Task 3 while waiting on a
  background test run, without emitting `## PLAN COMPLETE`. The orchestrator verified the committed
  state (rules changes present, tests present, rules suite + type-check green) and finished Task 3
  (this SUMMARY + STATE/ROADMAP progress). No code was re-done.
