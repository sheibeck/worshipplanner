---
phase: 41
slug: sharing-correctness
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-07
---

# Phase 41 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

> ⚠ **NOTHING IN THIS PHASE IS DEPLOYED.** Every rules-level mitigation below is **inert in
> production** until the owner runs `firebase deploy --only firestore:rules` (handoff recorded in
> `.planning/PENDING-VERIFICATION.md`). This is expected and by design under STATE.md's v1.5 standing
> autonomy grant — it is *not* an open threat — but deploy status determines what is actually
> enforced today, so it belongs in the security record. Until that deploy lands, production runs the
> **pre-Phase-41** rules.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Anonymous public ↔ `shareTokens/{token}` | `allow read: if true`. Anyone holding the URL reads the service snapshot with no auth. This is the widest boundary in the phase. | Service plan, slot list, notes, and `roleAssignments` as **names only** |
| Anonymous public ↔ `serviceShares/{shareId}` | Same, via the memorable slug URL | Same snapshot payload |
| Org editor ↔ `shareTokens/{token}` update | **NEW this phase.** Was `allow update: if false`; now org-editor-scoped with immutable `orgId` | Refreshed snapshot |
| Org editor ↔ `shareTokens/{token}` create | **TIGHTENED this phase (T-41-14).** Was `isSignedIn()`; now `isOrgEditor(request.resource.data.orgId)` | New share document |
| Org editor ↔ `serviceShareLinks/{serviceId}` | **NEW collection this phase.** Org-editor CRUD, no public read, `orgId` immutable on update | Token + provenance only; no snapshot |
| Client ↔ `organizations/{orgId}/services/{docId}` | Existing R036 draft-lock boundary. Phase 41 must never write across it from a share path (T-41-01, T-41-02) | Nothing — the absence is the control |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-41-01 | Tampering / EoP | Any share path writing to `organizations/{orgId}/services/{docId}` | medium | mitigate | Token lives on `serviceShareLinks/{serviceId}`, never the service doc. No share path issues `updateDoc`/`setDoc` against a `services` path. Absence-proof: `src/stores/__tests__/services.test.ts:1093-1108` | closed |
| T-41-02 | DoS / Tampering | Refresh hooks in `updateService`, `setRoleOverride`, `clearRoleOverride` | medium | mitigate | `services.ts:650-711` writes only `shareTokens`/`serviceShares`; nothing subscribes to either, so no write re-enters the autosave/remote-merge watcher. Absence-proof: `services.test.ts:1230-1245` | closed |
| T-41-03 | Information Disclosure | `buildServiceSnapshot` → world-readable `shareTokens/{token}` payload (create **and** refresh) | high | mitigate | `services.ts:102-144` — `personId → name` via a `Map`, emits `personNames` only; raw `Person` (email/phone/pcPersonId) never enters the snapshot. ONE shared function for both paths, so the two cannot drift. Proven on both paths against a fixture deliberately carrying `email`/`phone` | closed |
| T-41-04 | Tampering / EoP | `shareTokens` + `serviceShareLinks` update clauses (cross-org overwrite) | high | mitigate | `firestore.rules:238-239`, `:268-269` — `isOrgEditor(resource.data.orgId)`, the CR-01-hardened idiom copied from `serviceShares`. `isSignedIn()` explicitly rejected. Emulator tests `rules.test.ts:712-777`, `:900-926` | closed |
| T-41-05 | Tampering | `orgId` immutability on both collections | high | mitigate | `request.resource.data.orgId == resource.data.orgId` conjoined into every update clause — a share can never be reassigned to another org. `rules.test.ts:739-750`, `:914-926` | closed |
| T-41-06 | Info Disclosure / EoP | `serviceShareLinks/{serviceId}` public readability | medium | mitigate | `firestore.rules:251-271` — no `allow read: if true`. Unauthenticated and foreign-org reads denied. `rules.test.ts:806-831` | closed |
| T-41-07 | Spoofing / Tampering | `pickAdoptableToken` candidate filtering | medium | mitigate | `src/utils/shareTokens.ts:108-119` — candidates whose `orgId` ≠ acting org are discarded **before** sorting, so a foreign doc cannot be adopted even when it is the newest match. Second layer: T-41-04's update rule would deny the write anyway | closed |
| T-41-08 | EoP | Write clauses on both collections | medium | mitigate | Every write clause gated on `isOrgEditor`, never `isOrgMember` — a viewer-role member cannot publish or refresh a public share. `rules.test.ts:644-655`, `:765-777`, `:860-871` | closed |
| T-41-09 | Information Disclosure | `serviceShareLinks` read clause null-`resource` branch | low | accept | See Accepted Risks Log | closed |
| T-41-10 | Information Disclosure | `mintShareToken` entropy | low | accept | See Accepted Risks Log | closed |
| T-41-11 | DoS / Tampering | Concurrent first-share of the same service | medium | mitigate | `services.ts:579-600` — link doc created through `runTransaction` with a re-read inside, so a losing client adopts the winner's token instead of overwriting the index. Convergence test passing | closed |
| T-41-12 | EoP / Info Disclosure | `maybeRefreshShareLink` taking the create branch | medium | mitigate | `services.ts:681-684` — calls `writeSharePayload`, **never** `ensureShareLink`, and early-returns when no link doc exists, so an ordinary edit to a never-shared service cannot publish it | closed |
| T-41-13 | DoS | Unbounded refresh attempts against a denied rule | low | mitigate | `services.ts:685-710` — `shareLinkCache` set `false` on `permission-denied` only (refined from "any error" by review finding WR-02, so transient failures still retry). A rules denial is always `permission-denied` (code 7), verified directly in the emulator. `services.test.ts:1454-1480` | closed |
| **T-41-14** | Tampering / Spoofing / EoP | `shareTokens` **create** clause | **critical** | mitigate | **Missed by the plan-time register; found by code review as CR-01.** `firestore.rules:231` was `allow create: if isSignedIn()` — no org check. Inert before this phase, but Phase 41's adoption logic now reads and trusts arbitrary pre-existing `shareTokens` docs' `orgId`/`createdAt` to pick a service's permanent public link, so any signed-in user knowing a real `serviceId` could plant one. Fixed in `b2a2e5c` to `isOrgEditor(request.resource.data.orgId)` with 4 new tests (`rules.test.ts:606-667`, 1 ALLOW + 3 DENY). **Never deployed, so never live in production.** | closed |
| T-41-SC | Tampering | npm / pip / cargo installs | low | accept | See Accepted Risks Log | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-41-01 | T-41-09 | The null-`resource` branch in `serviceShareLinks`' read clause is **required** — without it, every first `getDoc` on a not-yet-existing link document returns `PERMISSION_DENIED` rather than a clean not-found, and the whole adopt-or-create flow is unreachable. Residual exposure: a signed-in non-member can distinguish "absent" from "denied" for a `serviceId` they already know. `serviceId` is an unguessable Firestore auto-ID and is org-private, and **no document content leaks** — the oracle reveals existence only. Independently confirmed as existence-only by the code reviewer. Accepted at ASVS L1; rationale recorded in the rules-file comment at `firestore.rules:252-264` | gsd-security-auditor (autonomous, under the v1.5 standing grant) | 2026-08-07 |
| AR-41-02 | T-41-10 | `mintShareToken`'s generator is byte-identical to the pre-existing one at `services.ts:354-357` — 18 bytes from `crypto.getRandomValues`, 144 bits. Unchanged by this phase and already reviewed. Deriving the token from `serviceId` (which would make concurrent first-shares converge trivially) is **explicitly rejected**: it would make every share URL guessable from a service id | gsd-security-auditor | 2026-08-07 |
| AR-41-03 | T-41-SC | No package-manager install task exists in this phase. Confirmed by `git diff --stat` — no `package.json` or `package-lock.json` change in any Phase 41 commit | gsd-security-auditor | 2026-08-07 |

---

## Unregistered Flags (informational — not blocking)

| Flag | Source | Assessment |
|------|--------|------------|
| IN-01 | `41-REVIEW.md` | `serviceShareLinks` create/update never verify `request.resource.data.serviceId == serviceId` (the path key). **Not currently exploitable** — nothing in the app queries by that field, and the codebase already tolerates the identical gap on `shareTokens.serviceId`. Flagged because `serviceShareLinks` is new attack surface introduced this phase with no threat-model entry covering this specific property. Worth closing opportunistically in a future rules pass |
| WR-04 | `41-REVIEW.md` (deliberately skipped by the fix pass) | Memorable-URL `serviceShares` document orphaning when a service's date changes after sharing. Independently judged a **correctness/UX defect, not a security threat** — the orphaned document re-serves content the org itself already chose to publish (stale, not unauthorized), so it does not cross a trust boundary. Both proposed fixes are real schema/migration changes: one breaks the live public URL scheme, the other needs a new field plus a migration plan. Not added to the security register |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-07 | 15 | 15 | 0 | gsd-security-auditor (ASVS L1; verification exceeded L1 grep-depth — live test execution and full data-flow trace) |

**Evidence re-derived independently at audit time, not taken from the plans' claims:**
- `npx vitest run --config vitest.rules.config.ts` → **133/133 passing** (120 `rules.test.ts` + 13 `storage.rules.test.ts`), run against the live emulator.
- `npx vitest run --dir src --exclude '**/rules.test.ts' src/stores/__tests__/services.test.ts src/utils/__tests__/shareTokens.test.ts` → **101/101 passing**.
- `npm run type-check` → 0 errors.
- `git show --stat` on every Phase 41 commit touching `firestore.rules` (`505ef5e`, `b2a2e5c`) → the rules diff is scoped to exactly the `shareTokens` and `serviceShareLinks` blocks; **no other collection's trust boundary was touched**.

---

## The lesson this phase records

The plan-time threat register was thorough — 14 entries, every high-severity one genuinely mitigated
and proven against a real emulator — **and it still missed a critical vulnerability.** T-41-14 was
found by code review, not by threat modelling, because it lived in a rule the phase never intended to
change. What made it exploitable was not the rule itself but the *new code that started trusting the
data that rule guards*.

The generalizable point: **a threat model scoped to what a phase changes will miss threats created by
what a phase starts to trust.** When new code begins reading a data source it previously ignored,
that source's write-authorization becomes part of the phase's attack surface even though no line of
it was edited. Model the read edges, not only the write edges.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
- [x] Deploy-gated caveat recorded — mitigations are inert until the owner deploys

**Approval:** verified 2026-08-07 (autonomous, under STATE.md's v1.5 standing autonomy grant)
