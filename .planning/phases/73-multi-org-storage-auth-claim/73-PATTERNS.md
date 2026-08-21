# Phase 73: Multi-Org Storage Auth Claim - Pattern Map

**Mapped:** 2026-08-21
**Files analyzed:** 5 (2 primary rewrites, 1 rules file, 2 test files extended)
**Analogs found:** 5 / 5 (all self-analogs — this phase extends its own predecessor code, not a new subsystem)

Scope note: `firestore.rules` `isOrgMember` (`exists(members/uid)`) and `src/stores/auth.ts` are OUT OF
SCOPE for this phase — unchanged, no analog needed. They are listed under "No Analog Needed" below only
for completeness.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `functions/src/orgMembershipClaims.ts` | service (Firestore-trigger claim writer) | event-driven | itself (current form, phase 40) | exact — extend in place |
| `functions/src/orgMembershipClaims.test.ts` | test | event-driven | itself | exact — extend in place |
| `functions/src/backfillOrgClaims.ts` | utility (owner-run CLI script) | batch | itself (current form, phase 40) | exact — extend in place |
| `functions/src/backfillOrgClaims.test.ts` | test | batch | itself | exact — extend in place |
| `storage.rules` (`isOrgMemberByClaim`) | config (security rules) | request-response | itself (current form) | exact — extend in place |
| `src/storage.rules.test.ts` | test (emulator rules harness) | request-response | itself | exact — extend in place |
| `functions/DEPLOY-ORG-CLAIMS.md` | docs (owner runbook) | n/a | itself | exact — extend in place |

## Pattern Assignments

### `functions/src/orgMembershipClaims.ts` (service, event-driven)

**Analog:** itself, `functions/src/orgMembershipClaims.ts` (current committed form)

**Claim shape to widen** (lines 20-34): `ORG_CLAIM_KEYS = ["orgId", "role"]`, `OrgMembershipClaim { orgId, role }`.
Add a second exported const, e.g. `ORGS_CLAIM_KEY = "orgs"`, and a new type
`OrgMembershipClaims = OrgMembershipClaim & { orgs: Record<string, OrgMembershipRole> }` (or a sibling
interface) — additive per 73-CONTEXT.md, do not touch the existing two keys' semantics.

**Builder to extend** (lines 41-44) `buildOrgMembershipClaim(orgId, role)`: keep exactly as-is for the
primary keys; add a second builder (e.g. `buildOrgsMapClaim(memberships: {orgId, role}[])`) that
normalizes each role the same way (`role === "admin" ? "editor" : role`) and folds into `{ [orgId]: role }`.

**Decision function to extend** (lines 90-146) `decideMembershipClaim`: Step 1 (lines 95-106, primary-org
re-derivation from `users/{uid}.orgIds[0]`) stays untouched for the primary. Add a NEW read step — per
CONTEXT.md, use `collectionGroup('members')` filtered/queried by uid (mirror `backfillOrgClaims.ts` lines
96-109's `collectionGroup("members")` enumeration + `resolveOrgId` guard, lines 71-76) to derive the full
`orgs` set from surviving `members` docs, NOT from `orgIds` — this is what makes delete-staleness safe
(CONTEXT.md's sharpest correctness risk, mirrors the comment already at lines 115-119 about `TeamView`'s
stale `orgIds` on `deleteDoc`). The idempotency check at lines 135-143 (`existingClaims?.orgId === ... &&
existingClaims?.role === ...`) is the pattern to extend with a third comparison: existing `orgs` map
deep-equal to computed `orgs` map, still all under the same `"already-current"` skip reason.

**Set/clear write pattern to extend** (lines 187-203 of `syncOrgMembershipClaimHandler`): the `"set"` case
already calls `mergeAndSetCustomClaims(uid, { ...decision.claims })` (line 193) — extend `decision.claims`
to include the `orgs` map so the SAME merge call carries it (no new call site needed, this is the exact
mechanism that preserves `superAdmin`). The `"clear"` case currently calls
`clearClaimKeys(uid, ORG_CLAIM_KEYS)` (line 199) clearing only `orgId`/`role` — per CONTEXT.md this must
become a recompute-not-blanket-clear: on a primary-membership delete, clear the primary keys but
RECOMPUTE `orgs` from the surviving `members` docs (may still contain non-primary orgs) rather than
wiping `orgs` entirely. This likely means `decideMembershipClaim`'s `"clear"` decision variant needs to
carry the recomputed `orgs` value alongside the primary-clear signal (extend the `MembershipClaimDecision`
union at lines 72-75), and the handler's `"clear"` branch does a `mergeAndSetCustomClaims` with the new
`orgs` value in addition to `clearClaimKeys` for the primary keys.

**Known-limitation comment to update** (lines 82-88): this docblock explicitly documents "carries the
user's PRIMARY org only" as the limitation this phase closes — update/remove per CONTEXT.md's directive to
revise the module comment.

### `functions/src/orgMembershipClaims.test.ts` (test, event-driven)

**Analog:** itself — established mocking seams (lines 1-33): `vi.mock("firebase-admin/auth", ...)`,
`vi.mock("firebase-admin/firestore", ...)`, `vi.mock("firebase-functions/v2/firestore", ...)`, and helper
`fakeUserDoc(exists, orgIds)` / `mockUsersFirestore`. Extending for the widened claim requires ALSO
mocking `collectionGroup("members")` the way `backfillOrgClaims.test.ts` does (see below) since
`decideMembershipClaim` will now read both `users/{uid}` AND the members collectionGroup. New test cases
needed per CONTEXT.md: multi-org user gets a full `orgs` map; delete of primary membership recomputes
`orgs` from surviving `members` docs (proving `orgIds` staleness doesn't leak a removed org); superAdmin
preserved through a widened `mergeAndSetCustomClaims` call (existing pattern already covers this via
`mockAuth({ existingClaims: {...} })`, lines 46-57).

### `functions/src/backfillOrgClaims.ts` (utility, batch)

**Analog:** itself, `functions/src/backfillOrgClaims.ts` (current committed form)

**collectionGroup enumeration pattern to reuse for the writer** (lines 96-109): this is the exact idiom
CONTEXT.md tells the writer to adopt for recomputing a user's full org set — `getFirestore().collectionGroup("members").get()`
then `resolveOrgId(memberDoc)` (lines 71-76, structural guard: parent chain must be
`organizations/{orgId}/members/{uid}`) then read `role` off `memberDoc.data()`.

**Shared decision logic, no-drift pattern** (line 4 import + lines 110-134): backfill imports
`decideMembershipClaim` from `./orgMembershipClaims` rather than reimplementing — when the decision
function is widened to also read the `orgs` map, this backfill gets it for free through the same import,
zero changes to its own decision logic. Only the `apply`-gated write at line 116
(`getAuth().setCustomUserClaims(uid, decision.claims)`) may need to become `mergeAndSetCustomClaims` if
the widened `decision.claims` should merge rather than replace — check against `orgMembershipClaims.ts`'s
own merge call (line 193) for consistency; currently the backfill uses a bare `setCustomUserClaims` since
at v1.5 scale claims were being set fresh, but R208/R175 superAdmin-preservation likely means this call
site should switch to `mergeAndSetCustomClaims` too.

**Dry-run/--apply/idempotent-skip CLI shape** (lines 43-60 options/summary types, lines 170-204
`runBackfillCli`): unchanged scaffolding — dry-run default (`apply` flag from `process.argv.includes("--apply")`,
line 174), banner print before work (lines 178-184), non-zero exit code on any failure (lines 187-192,
197-199). No structural change needed here; the widened claim rides through the same `processed`/`skipped`/`failed`
counters.

### `functions/src/backfillOrgClaims.test.ts` (test, batch)

**Analog:** itself — `fakeMemberDoc` (lines 38-61) builds the collectionGroup doc shape with the
`ref.parent.parent...` structural chain `resolveOrgId` expects; `mockFirestore` (lines 76-95) wires
`collectionGroup("members")` AND `collection("users")` on the SAME `getFirestore()` mock since
`decideMembershipClaim` needs both. `statefulAuth` (lines 103-114) is the idempotency-proving pattern —
claims written by one run are read back by `getUser` on a second run, the only way to genuinely exercise
"skip if already matching" across two calls. Extend this same stateful fake for the new orgs-map
idempotency test.

### `storage.rules` — `isOrgMemberByClaim` (config, request-response)

**Analog:** itself, current committed form

**Function to widen** (lines 28-32):
```
function isOrgMemberByClaim(orgId) {
  return request.auth != null
    && request.auth.token.orgId == orgId
    && request.auth.token.role != null;
}
```
Per CONTEXT.md R209/R211, add an OR arm checking the new map: `request.auth.token.orgs[orgId] != null`,
keeping the existing two-line check as the legacy/backward-compat arm. Do NOT touch `isOrgMember` (lines
39-41) — it stays a thin wrapper delegating to `isOrgMemberByClaim`.

**Module comment to update** (lines 7-14, 23-27): both the top-of-file "v1.5 claim migration — COMPLETE"
block and the "KNOWN LIMITATION" comment directly above `isOrgMemberByClaim` explicitly describe the
single-primary-org limitation this phase closes — both must be revised to describe the widened `orgs`-map
arm and the still-required legacy arm for R211 compat. Do NOT reintroduce `firestore.exists()` — line 34's
comment and the guard test in `src/storage.rules.test.ts` (below) explicitly forbid this.

### `src/storage.rules.test.ts` (test, request-response — emulator rules harness)

**Analog:** itself, current committed form

**Claim-minting idiom** (line 68 et al.): `testEnv.authenticatedContext('userA', { orgId: 'orgA', role: 'editor' })`
— the second arg is the raw custom-claims object passed straight through to the emulator's mock JWT.
For multi-org tests, mint with `{ orgId: 'orgA', role: 'editor', orgs: { orgA: 'editor', orgB: 'viewer' } }`
to prove BOTH orgs are readable/writable; for cross-org DENY, omit the target org from `orgs`; for
legacy-claim ALLOW (R211), mint with ONLY `{ orgId: 'orgA', role: 'editor' }` (no `orgs` key at all) and
prove it still passes for its primary org — this is the exact backward-compat case CONTEXT.md calls out.

**ALLOW/DENY assertion idiom** (lines 67-141): `assertSucceeds(uploadBytes(...))` /
`assertSucceeds(getBytes(...))` for allow cases; `assertFails(...)` for deny cases. `SMALL_BYTES` (line 52)
is the reusable small-payload fixture — no new fixture needed for the new multi-org tests since they only
exercise the membership arm, not size caps.

**Static-assertion guard pattern to extend** (lines 195-237): the existing test statically greps
`storage.rules` text (comments stripped, whitespace collapsed) to prove no cross-service `firestore.exists()`
was reintroduced and the claim keys are present. Add a companion assertion of the same shape confirming
`request.auth.token.orgs` appears in the rule code, keeping the same `firestore.exists(` / `/databases/(default)/documents/`
negative assertions unchanged (still forbidden).

**Firestore setup note:** lines 14-20 load `firestore.rules` into the test environment purely because
`storage.rules` used to have a cross-service fallback (now removed) — this Firestore setup is vestigial
infrastructure, not needed by the claim-only arm, and is safe to leave as-is (no change required for this
phase; do not remove, out of scope).

### `functions/DEPLOY-ORG-CLAIMS.md` (docs)

**Analog:** itself — existing runbook documents the soak/token-refresh guidance and Deploy 1/Deploy 2
ordering from phase 40. Per CONTEXT.md's "Deploy (HAND OVER)" decision, append the new deploy order
(widened trigger → backfill → storage.rules) and the exact `firebase deploy --only functions:syncOrgMembershipClaim`
/ `firebase deploy --only storage` commands plus dry-run→`--apply` backfill invocation, preserving the
existing soak-guidance prose structure rather than rewriting it.

## Shared Patterns

### Merge-preserving custom-claim writes (R175/R208 superAdmin preservation)
**Source:** `functions/src/claimsHelpers.ts` lines 51-58 (`mergeAndSetCustomClaims`) and lines 67-73
(`clearClaimKeys`)
**Apply to:** `orgMembershipClaims.ts`'s widened set/clear branches AND (likely) `backfillOrgClaims.ts`'s
write call site.
```typescript
export async function mergeAndSetCustomClaims(
  uid: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const user = await getAuth().getUser(uid);
  const current = (user.customClaims as Record<string, unknown> | undefined) ?? {};
  await getAuth().setCustomUserClaims(uid, { ...current, ...patch });
}
```
Never call `getAuth().setCustomUserClaims()` directly for a partial patch — always route through this
helper so an unrelated claim (`superAdmin`) is never clobbered.

### Shared decision function, no-drift (D-11 pattern)
**Source:** `functions/src/orgMembershipClaims.ts`'s `decideMembershipClaim` (lines 90-146), imported by
`functions/src/backfillOrgClaims.ts` line 4.
**Apply to:** any widening of decision logic — extend the ONE function; both trigger and backfill inherit
the change with zero duplicated logic. Do not add a second "what should this claim be" implementation.

### `collectionGroup('members')` enumeration + structural guard
**Source:** `functions/src/backfillOrgClaims.ts` lines 71-76 (`resolveOrgId`) and 96-109 (the query loop)
**Apply to:** the widened `decideMembershipClaim`'s new org-set read (recompute `orgs` from surviving
`members` docs rather than trusting `users/{uid}.orgIds`, which is stale on delete per `TeamView`'s
`deleteDoc` not updating `orgIds`).
```typescript
function resolveOrgId(memberDoc: QueryDocumentSnapshot): string | undefined {
  const orgDoc = memberDoc.ref.parent.parent;
  if (!orgDoc) return undefined;
  if (orgDoc.parent.id !== "organizations") return undefined;
  return orgDoc.id;
}
```
For a per-uid read (rather than backfill's whole-collection scan), use
`getFirestore().collectionGroup("members").where(admin.firestore.FieldPath.documentId(), ...)` is not
viable (member doc ID is the uid but collectionGroup queries can't filter on doc id path segment
directly the same way) — simplest is `collectionGroup("members")` with no filter then `.docs.filter(d => d.id === uid)`,
mirroring how the backfill iterates all docs; at current 2-3-user scale (per backfillOrgClaims.ts's own
D-10 scale note, lines 17-22) this remains proportionate. Flag this exact query shape as the
researcher/planner's call per CONTEXT.md's "Claude's Discretion."

### Dry-run / `--apply` / idempotent owner-run CLI script shape
**Source:** `functions/src/backfillOrgClaims.ts` lines 43-60 (types), 170-204 (`runBackfillCli`)
**Apply to:** the extended backfill itself — no new script needed, extend in place; the shape (dry-run
default, banner print, non-zero exit on failure, `require.main === module` guard at line 202) is already
correct and complete for this phase's needs.

### Emulator ALLOW/DENY rules-test idiom with `authenticatedContext` claim minting
**Source:** `src/storage.rules.test.ts` lines 67-141
**Apply to:** new multi-org ALLOW, cross-org DENY, and legacy-claim ALLOW tests (R209/R211 proof
requirement from CONTEXT.md).
```typescript
const context = testEnv.authenticatedContext('userA', { orgId: 'orgA', role: 'editor' })
const storage = context.storage()
const fileRef = ref(storage, 'orgs/orgA/pptx-imports/import1/source.pptx')
await assertSucceeds(uploadBytes(fileRef, SMALL_BYTES))
```

## No Analog Needed (explicitly out of scope)

| File | Role | Reason |
|---|---|---|
| `firestore.rules` (`isOrgMember`) | config | Claim-independent (`exists(members/uid)`); CONTEXT.md explicitly excludes it — do not touch |
| `src/stores/auth.ts` | store | Reads only the unchanged primary `claims.orgId`/`claims.role`; CONTEXT.md explicitly excludes it — do not touch |

## Metadata

**Analog search scope:** `functions/src/`, `storage.rules`, `src/storage.rules.test.ts` (all files this
phase modifies are self-analogs of their own current committed form — this is an in-place-extension
phase, not a new-subsystem phase, so no cross-directory analog search was needed).
**Files scanned:** 7 (orgMembershipClaims.ts, orgMembershipClaims.test.ts, claimsHelpers.ts,
backfillOrgClaims.ts, backfillOrgClaims.test.ts, storage.rules, src/storage.rules.test.ts)
**Pattern extraction date:** 2026-08-21
