# Phase 77: Church Deletion — Cascade Cleanup - Research

**Researched:** 2026-08-22
**Domain:** Firestore Admin-SDK cascade deletion, Cloud Storage bulk deletion, super-admin-gated Cloud Functions, defense-in-depth Firestore rules
**Confidence:** HIGH (every subcollection, Storage prefix, and cross-collection reference below was found by direct grep of this codebase and firestore.rules — not inferred)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Gating (R215, R216)**
- New super-admin-gated callable `deleteOrganization({ orgId, confirmName })` in `orgProvisioning.ts` (or a
  new `orgDeletion.ts`) — `assertSuperAdminCaller` FIRST. Refuse with `failed-precondition` if the org's
  `active !== false` (must be deactivated first — deactivation is the first delete guardrail). Refuse with
  `invalid-argument` if `confirmName` doesn't match the org's stored `name` (server-side echo of the client
  type-to-confirm). The client NEVER bulk-deletes `organizations/*`, subcollections, `orgNames/*`, or
  `inviteLookup/*` directly.

**Cascade order (must read cross-ref inputs BEFORE the recursive delete removes them)**
1. Read `organizations/{orgId}` — verify `active === false` + `confirmName` matches `name`; capture `name`.
2. Collect member uids from `organizations/{orgId}/members` (needed for `users/{uid}.orgIds` arrayRemove).
3. Collect the `inviteLookup/*` docs whose `orgId === orgId` (query), and compute the `orgNames` doc id
   from the org `name` (`normalizeOrgName`) — verify it points at this orgId before deleting it.
4. Perform deletions (each idempotent / tolerant of already-gone — R221):
   - per member uid: `users/{uid}` merge-update `orgIds: FieldValue.arrayRemove(orgId)` (preserve their
     other orgs — NEVER overwrite the array);
   - delete `orgNames/{nameKey}` (only if it maps to this orgId);
   - delete each `inviteLookup/{email}` for this org;
   - Storage: delete every object under the `orgs/{orgId}/` prefix (media, backgrounds, pptx-imports,
     rendered — confirm the full prefix set in research) via the Admin SDK bucket `deleteFiles({ prefix })`;
   - Firestore: recursively delete the org doc + ALL subcollections (Admin SDK `recursiveDelete(orgRef)`).
5. Return a summary `{ orgId, name, membersUnlinked, invitesDeleted, orgNameDeleted, storageObjectsDeleted,
   ... }` so the console can echo what was removed (R221).

**Idempotency / resumability (R221)**
- Every step tolerates already-deleted state; a retry after an interruption completes without error and
  without cross-tenant damage (all writes are scoped to this orgId + its members' own `orgIds` arrayRemove).
  `recursiveDelete` and `deleteFiles` are naturally idempotent; arrayRemove is idempotent.

**Defense-in-depth rules (R216)**
- `firestore.rules`: DENY direct CLIENT delete of `organizations/{orgId}` (and ensure no client path can
  delete its subcollections/registry) — deletion is Admin-SDK-only. NOTE: the Phase-76 `preservesLifecycleFields`
  guard short-circuits to `true` on delete (`request.resource == null`), so a client `delete` of an org is
  currently still allowed for an editor — CLOSE that here with an explicit delete DENY, proven by an emulator
  test (editor AND non-super-admin client delete of `organizations/{orgId}` is denied).

**Client (R220)**
- Delete control on each Organizations row, ENABLED only for a deactivated org (mirrors the Phase 76
  Deactivate/Reactivate control's state). Opens a confirm dialog that: echoes what will be destroyed
  (org name + member/service counts if readily available), requires typing the exact church name to enable
  the destructive button, and is clearly labeled irreversible. Calls `deleteOrganization`; on success removes
  the row and shows the returned summary; maps errors (not-deactivated, name-mismatch, permission) to clear
  copy via the existing `friendlyCallableError` pattern.

### Claude's Discretion
- New `orgDeletion.ts` module vs. extending `orgProvisioning.ts`; exact summary shape; whether to show
  pre-delete counts in the dialog (nice-to-have) vs. just the name-echo.

### Deferred Ideas (OUT OF SCOPE)
- Exporting/downloading the org's data before deletion; a soft-trash restore window; scheduled auto-purge of
  long-deactivated orgs — all future scope (per REQUIREMENTS Future/Out-of-scope).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R215 | Delete refused unless org is deactivated | `setOrgActiveHandler`/`active` field precedent (orgProvisioning.ts) — see Cascade Order §1, Handler Shape |
| R216 | Super-admin-gated callable, independently re-verified; client never bulk-deletes | `assertSuperAdminCaller` reused verbatim — see Handler Shape |
| R217 | Cascade-remove org doc + every subcollection, no orphans under `organizations/{orgId}` | Full subcollection enumeration (§1) + `recursiveDelete` verification (§4) |
| R218 | Remove `orgNames`, every `inviteLookup`, `users/{uid}.orgIds` arrayRemove | §2 Cross-Collection References |
| R219 | Remove all Storage objects under `orgs/{orgId}/…` | §3 Storage Prefix Enumeration |
| R220 | Type-to-confirm, echoes destruction, irreversible label | Client Design §, no exact prior precedent — see Pitfall "No type-to-confirm precedent" |
| R221 | Idempotent/resumable, clear summary | Cascade Order + Idempotency Design §, Handler Shape |
</phase_requirements>

## Summary

This phase adds one new super-admin-gated callable, `deleteOrganization`, that permanently removes a
deactivated church. The dominant engineering risk named in the phase brief — orphaned tenant data — is
addressed by **two independent findings** from exhaustively grepping this codebase:

1. **Every subcollection under `organizations/{orgId}` is deleted in one call.** `firebase-admin@13.10.0`
   (confirmed installed via `node_modules`) exposes `getFirestore().recursiveDelete(orgRef)`, which
   verifiably exists on the `Firestore` instance at runtime in this project (checked directly with
   `node -e` against the installed package — `typeof db.recursiveDelete === "function"`). It deletes the
   org document and **every** nested subcollection at every depth, so hand-enumerating and
   hand-deleting each of the 11 subcollections found below is unnecessary for the deletion itself — the
   enumeration below exists so `VALIDATION.md` can assert "zero documents survive" per-collection, not so
   the handler can loop over them.

2. **Five top-level collections are keyed by `orgId` as a plain field and `recursiveDelete` will NOT touch
   them**, beyond the three (`orgNames`, `inviteLookup`, `users/{uid}.orgIds`) R218 already names:
   `shareTokens`, `serviceShareLinks`, `orgSlugs`, `quarterShares`, `serviceShares` all store `orgId` as a
   document field (confirmed in `firestore.rules` and `src/utils/shareTokens.ts`/`orgName.ts`/`slug.ts`).
   None of these are literally required by R217/R218's text (which scopes to
   "`organizations/{orgId}`" + the three named cross-refs), but they ARE "org-related data stored OUTSIDE
   the `organizations/{orgId}` tree" that the phase brief explicitly asked to be flagged. Left alone, a
   deleted org leaves permanently-orphaned public-share documents referencing a nonexistent org forever.
   This is called out as an **Open Question** for the planner/owner to decide scope on — see
   `## Open Questions`.

Storage cleanup is a single `bucket.deleteFiles({ prefix: 'orgs/${orgId}/' })` call — every Storage write
path found in this codebase (`media/`, `backgrounds/`, `pptx-imports/{id}/source.pptx`,
`pptx-imports/{id}/images/`, `pptx-imports/{id}/rendered/`) lives under the single `orgs/{orgId}/` prefix,
confirmed by grep across `functions/src`, `render-service/src`, and `src/composables`.

**Primary recommendation:** Build `deleteOrganizationHandler` in a new `functions/src/orgDeletion.ts`
module, reusing `assertSuperAdminCaller`/`normalizeOrgName` imported from `orgProvisioning.ts` (do not
duplicate). Sequence: verify caller → read+verify org (active===false, confirmName matches) → capture
member uids + inviteLookup docs + orgNames key → per-member `arrayRemove` → delete inviteLookup docs →
delete orgNames doc (guarded) → `bucket.deleteFiles({prefix})` → `recursiveDelete(orgRef)` → return summary.
Add a `firestore.rules` explicit `allow delete: if false` (super-admin exempted) on
`organizations/{orgId}` closing the Phase-76 `preservesLifecycleFields` gap. Client: a new
`DeleteOrgConfirmDialog.vue` with a real type-to-confirm text input (no exact prior precedent in this
codebase — see Pitfalls) gating a destructive button, following `CleanupEnableConfirmDialog.vue`'s
Teleport/focus-trap shell.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Delete-eligibility gate (active===false, confirmName match) | API / Backend | — | Server-side re-verification is the whole point of R216; client check is UX-only |
| Firestore cascade delete (org doc + subcollections) | API / Backend (Admin SDK) | — | `recursiveDelete` requires Admin SDK privileges; client SDK cannot recursively delete |
| Cross-collection reference cleanup (orgNames/inviteLookup/users.orgIds) | API / Backend (Admin SDK) | — | Requires reading data BEFORE the cascade removes the referencing docs (members) — must be server-orchestrated in one atomic sequence |
| Storage object deletion | API / Backend (Admin SDK) | — | `bucket.deleteFiles` requires the Admin Storage SDK; `storage.rules` never grants delete to any client role |
| firestore.rules delete DENY | Database / Storage (rules layer) | — | Defense-in-depth: must hold even if the callable path is bypassed |
| Type-to-confirm dialog + destructive button gating | Browser / Client | — | Pure UX guardrail; the callable independently re-verifies everything the dialog claims |
| Post-delete row removal + summary echo | Browser / Client | — | Reactive UI update after a successful callable response |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| firebase-admin | ^13.10.0 (installed, confirmed via `node_modules/firebase-admin/package.json`) [VERIFIED: local node_modules] | `getFirestore().recursiveDelete()`, `getStorage().bucket().deleteFiles()` | Already the project's Admin SDK dependency — no new package |
| @google-cloud/storage | 7.19.0 (installed, transitive dep of firebase-admin) [VERIFIED: local node_modules] | `Bucket.deleteFiles({ prefix, force })` | Already installed; `deleteFiles` is its documented bulk-delete convenience method |

### Supporting
None — this phase introduces no new runtime dependencies. It composes existing helpers
(`assertSuperAdminCaller`, `normalizeOrgName`, `patchNestedClaimKey`-style patterns) already present in
`functions/src/orgProvisioning.ts`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `recursiveDelete(orgRef)` | Hand-enumerate all 11 subcollections + manually `batch.delete()` each doc | Strictly worse: more code, a missed-subcollection bug class this whole phase exists to prevent, and it does not scale past 500 docs/batch without manual chunking that `recursiveDelete`'s internal `BulkWriter` already handles |
| `bucket.deleteFiles({ prefix })` | `bucket.getFiles({ prefix })` + per-file `.delete()` loop (the pattern the v1.8 cleanup sweeps already use) | Either works; `deleteFiles` is less code for an unconditional full-prefix wipe (no per-object age/reference filtering needed here, unlike the v1.8 sweeps) — recommended for simplicity, but the getFiles+loop pattern is an acceptable, already-precedented fallback if per-object try/catch granularity is wanted |

**Installation:**
```bash
# No new packages. firebase-admin and @google-cloud/storage are already in functions/package.json.
```

**Version verification:** Confirmed directly against the installed runtime, not training data:
```
$ node -e "console.log(require('./package.json').dependencies['firebase-admin'])"
^13.10.0
$ grep '"version"' node_modules/firebase-admin/package.json
"version": "13.10.0",
$ node -e "const admin=require('firebase-admin'); admin.initializeApp(); const {getFirestore}=require('firebase-admin/firestore'); console.log(typeof getFirestore().recursiveDelete, typeof getFirestore().bulkWriter);"
function function
```
Both `recursiveDelete` and `bulkWriter` exist as callable methods on the `Firestore` instance in the
installed package — `[VERIFIED: local node_modules, runtime probe]`, not merely "should exist per docs."

## Package Legitimacy Audit

No new external packages are introduced by this phase — it uses only `firebase-admin` and
`@google-cloud/storage`, both already installed and used elsewhere in `functions/src/index.ts`
(`getStorage().bucket()`, `bucket.getFiles()`, `file.delete()`). The Package Legitimacy Gate is not
applicable.

**Packages removed due to [SLOP] verdict:** none (n/a — no new packages)
**Packages flagged as suspicious [SUS]:** none (n/a — no new packages)

## Architecture Patterns

### System Architecture Diagram

```
Organizations tab row (deactivated org)
        │  click "Delete" (enabled only when org.active === false)
        ▼
DeleteOrgConfirmDialog.vue
        │  types exact church name → Delete button enabled
        │  click Delete
        ▼
httpsCallable('deleteOrganization', { orgId, confirmName })
        │
        ▼
deleteOrganizationHandler (functions/src/orgDeletion.ts)
        │
        ├─ 1. assertSuperAdminCaller(request)          ─────► reject unauthenticated / non-super-admin
        │
        ├─ 2. orgRef.get()                              ─────► not-found if missing
        │      verify active === false                  ─────► failed-precondition if still active
        │      verify confirmName === name               ─────► invalid-argument if mismatch
        │
        ├─ 3. READ (before anything is deleted):
        │      - orgRef.collection('members').get()      → member uids
        │      - inviteLookup query: where orgId==orgId  → invite doc ids
        │      - nameKey = normalizeOrgName(name)         → orgNames candidate doc
        │      - orgNames/{nameKey}.get()                 → verify it points at THIS orgId
        │
        ├─ 4. WRITE (each idempotent, order matters only for correctness not safety):
        │      a. per member uid: users/{uid} merge-set { orgIds: arrayRemove(orgId) }
        │      b. delete inviteLookup/{email} for each captured invite
        │      c. delete orgNames/{nameKey}  (only if step 3's read confirmed orgId match)
        │      d. bucket.deleteFiles({ prefix: `orgs/${orgId}/` })
        │      e. getFirestore().recursiveDelete(orgRef)
        │
        └─ 5. return { orgId, name, membersUnlinked, invitesDeleted, orgNameDeleted,
                        storageObjectsDeleted }
        ▼
OrganizationsTab.vue: on success, remove the row + show summary toast
                       on error: friendlyCallableError (not-deactivated / name-mismatch / permission)
```

### Recommended Project Structure
```
functions/src/
├── orgDeletion.ts           # NEW — deleteOrganizationHandler + deleteOrganization onCall wrapper
├── orgDeletion.test.ts      # NEW — unit tests (mocked Admin SDK, FakeFirestore + FakeBucket pattern)
├── orgProvisioning.ts       # UNCHANGED except: export assertSuperAdminCaller + normalizeOrgName
                             #   (currently module-private `function`s — widen to `export function`)
firestore.rules              # ADD: explicit delete DENY on organizations/{orgId}
src/rules.test.ts            # ADD: emulator ALLOW/DENY tests for the delete DENY
src/components/admin/
├── DeleteOrgConfirmDialog.vue   # NEW — type-to-confirm dialog (mirrors CleanupEnableConfirmDialog shell)
├── OrganizationsTab.vue         # MODIFIED — add Delete control + dialog wiring
```

### Pattern 1: Export-and-reuse `assertSuperAdminCaller` / `normalizeOrgName`
**What:** `assertSuperAdminCaller` and `normalizeOrgName` are currently **module-private** (unexported)
`function`s in `orgProvisioning.ts` (verified: neither has an `export` keyword, lines 39 and 87).
**When to use:** `deleteOrganizationHandler` needs both. Widen their declarations to `export function`
rather than duplicating the logic in a new module — this is the exact "one shared caller-gate helper"
discipline `orgProvisioning.ts`'s own docblock establishes for its three existing callables.
**Example:**
```typescript
// functions/src/orgProvisioning.ts — change signature only, body untouched
export async function assertSuperAdminCaller(request: CallableRequest<unknown>): Promise<string> { /* ... */ }
export function normalizeOrgName(name: string): string { /* ... */ }

// functions/src/orgDeletion.ts
import { assertSuperAdminCaller, normalizeOrgName } from "./orgProvisioning";
```

### Pattern 2: Read cross-references BEFORE the cascade delete removes them
**What:** `recursiveDelete(orgRef)` deletes `organizations/{orgId}/members/*` along with everything else.
Once that runs, there is no way to enumerate "which uids were members of this org" — the source of truth
is gone. The member-uid capture (for `users/{uid}.orgIds` arrayRemove) and the `inviteLookup` query MUST
both complete and be held in memory before `recursiveDelete` fires.
**When to use:** Any cascade delete where the deletion target is also the source of the data needed to
clean up external references.
**Example:**
```typescript
// Capture BEFORE any delete.
const membersSnap = await orgRef.collection("members").get();
const memberUids = membersSnap.docs.map((d) => d.id);

const inviteLookupSnap = await db.collection("inviteLookup").where("orgId", "==", orgId).get();
const inviteEmails = inviteLookupSnap.docs.map((d) => d.id);

const nameKey = normalizeOrgName(orgData.name);
const nameSnap = await db.collection("orgNames").doc(nameKey).get();
const shouldDeleteOrgName = nameSnap.exists && nameSnap.data()?.orgId === orgId;

// ... only now perform any delete.
```

### Pattern 3: `recursiveDelete` for the cascade, `deleteFiles({ prefix })` for Storage
**What:** Both are single calls that internally page/batch. Neither needs the full subcollection
enumeration to be passed in — that enumeration is documentation + test coverage, not input to the call.
**When to use:** Whenever "delete this document and everything nested under it" or "delete every object
under this prefix" is the actual requirement (as opposed to a filtered/conditional delete, which the v1.8
sweeps needed and this phase does not).
**Example:**
```typescript
// Source: firebase-admin v13 API surface, confirmed present on the installed package
// (functions/src/orgDeletion.ts)
await getStorage().bucket().deleteFiles({ prefix: `orgs/${orgId}/` });
await getFirestore().recursiveDelete(orgRef);
```

### Anti-Patterns to Avoid
- **Hand-looping over the 11 known subcollections to delete them individually:** brittle (a 12th
  subcollection added in a future phase is silently missed), slower (N round-trips instead of one
  `BulkWriter`-backed call), and is exactly the "MISSED collection → orphaned tenant data" failure mode
  the phase brief warns about. Use `recursiveDelete`; use the enumeration only for test assertions.
- **Deleting `orgNames/{nameKey}` without verifying it still points at this orgId:** if a church was
  renamed and the old name's `orgNames` doc was never cleaned up (out of scope for this phase — church
  rename is out of scope per REQUIREMENTS.md), or if the computed nameKey happens to collide with a
  DIFFERENT org's currently-claimed name, an unguarded delete could free up another org's claimed name.
  Always re-read and compare `orgId` before deleting.
- **Running the `recursiveDelete`/`deleteFiles` calls before capturing member uids / invite docs:** loses
  the data needed for the `users/{uid}.orgIds` arrayRemove and inviteLookup cleanup permanently.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deleting an org doc + all nested subcollections at every depth | A recursive walk of `listCollections()` + manual batched deletes | `getFirestore().recursiveDelete(orgRef)` | Firebase Admin SDK's own implementation uses an internal `BulkWriter` with retry/backoff and correctly walks arbitrary subcollection depth (covers `services/{id}/messages/{id}/recipients/{id}`, three levels deep, automatically) |
| Deleting every Storage object under a prefix | Manual `getFiles({prefix})` + `Promise.all(files.map(f=>f.delete()))` | `bucket.deleteFiles({ prefix, force: true })` | One call, handles pagination internally (`GetFilesOptions.autoPaginate` semantics), and `force: true` continues past individual object delete failures instead of aborting on the first error — the getFiles+loop pattern is a legitimate historical precedent (v1.8 sweeps) but is more code for this phase's unconditional full-wipe use case |
| Server-side re-verification of super-admin identity | A new gate function | `assertSuperAdminCaller` (already exists, exported) | Established, tested pattern used by 4 other callables (`onboardOrganization`, `assignOrgAdmin`, `listOrganizations`, `setOrgActive`) — do not fork a second implementation |

**Key insight:** every primitive this phase needs (recursive Firestore delete, prefix-scoped Storage
delete, super-admin re-verification) already exists either in the installed SDK or in this codebase's own
`orgProvisioning.ts`. The actual engineering work is *sequencing* (read-before-delete for cross-refs) and
*enumeration for test coverage*, not building new deletion primitives.

## Common Pitfalls

### Pitfall 1: Deleting cross-references AFTER the cascade instead of before
**What goes wrong:** `recursiveDelete(orgRef)` runs first; the code then tries to read
`orgRef.collection('members').get()` to find uids to `arrayRemove` — but the members subcollection is
already gone, so zero uids are found and every affected user keeps a stale `orgId` in their `orgIds` array
forever.
**Why it happens:** It's tempting to write the cascade delete step first because it's the "main" action
and treat cross-ref cleanup as an afterthought appended at the end.
**How to avoid:** Enforce the read-then-delete ordering documented in Pattern 2 above; a unit test should
assert that `arrayRemove` calls are queued using uids captured from a `members.get()` call that happened
BEFORE `recursiveDelete`/`deleteFiles` were invoked (assert call order via `vi.fn()` mock call sequencing).
**Warning signs:** `membersUnlinked` in the returned summary is always 0 even for orgs that had members.

### Pitfall 2: The `orgNames`/`inviteLookup` scope gap — flagged, not yet decided
**What goes wrong:** R217/R218 only name `orgNames`, `inviteLookup`, and `users.orgIds` as the
cross-references to clean up. Five OTHER top-level collections (`shareTokens`, `serviceShareLinks`,
`orgSlugs`, `quarterShares`, `serviceShares`) are ALSO keyed by `orgId` as a field and will be silently
orphaned forever if not explicitly queried and deleted. `recursiveDelete` cannot see them (they are not
nested under `organizations/{orgId}`).
**Why it happens:** These collections were added across five different phases (41, 39/settings, 16/16.1,
17) for public share-link functionality, long before church deletion existed as a concept — no phase
before this one had reason to think about org-scoped cleanup.
**How to avoid:** See `## Open Questions` — this needs an explicit scope decision (owner or planner
discretion) before implementation: either (a) extend the cascade to also query-and-delete these five
collections by `orgId`, or (b) explicitly descope them as "acceptable future-phase cleanup" and document
the residual orphan risk. Given the owner's own words ("cleanup any relationships in the db... everything
associated with it"), recommend (a).
**Warning signs:** After deleting an org, `shareTokens`/`quarterShares`/etc. documents referencing the
deleted `orgId` are still readable by anyone with the (now-dead) share URL — a minor confidentiality
concern (stale content is still served) and a permanent orphan-data accumulation.

### Pitfall 3: No exact "type the name to confirm" precedent exists in this codebase
**What goes wrong:** Assuming `CleanupEnableConfirmDialog.vue` (named in CONTEXT.md as "the type-to-confirm/
echo precedent") already implements a text-input-must-match-exact-value pattern, and copying it verbatim.
**Why it happens:** The CONTEXT.md description says "type-to-confirm/echo precedent," but reading the
actual component (`src/components/admin/CleanupEnableConfirmDialog.vue`) shows it has **no text input at
all** — it is a Confirm/Cancel button pair with an **echoed count** (`wouldDeleteCount`/`wouldDeleteBytes`)
and a hard-block state (`referencesComplete === false`). There is no prior "type the exact string to
enable a button" pattern anywhere in `src/` (confirmed by grep for `confirmText`/`typedName`/
`matchesName`/"type the...confirm" — zero real matches).
**How to avoid:** Build the type-to-confirm text input as genuinely new UI. Reuse what
`CleanupEnableConfirmDialog.vue` DOES establish (Teleport + backdrop/panel Transition shell, hand-rolled
focus trap, `Escape`-cancels, confirm button styled destructive-red, disabled during the in-flight
request) — but the "Delete" button's `:disabled` binding must additionally require
`typedName.trim() === org.name` (exact, case-sensitive match recommended — do not silently trim/lowercase
in a way that could let "grace church" satisfy "Grace Church" and reduce the guardrail's effectiveness).
**Warning signs:** A plan that says "reuse CleanupEnableConfirmDialog's type-to-confirm input" without
first reading the actual component will discover mid-implementation there is no such input to reuse.

### Pitfall 4: `deleteFiles({ prefix })` without `force: true` aborts on the first failed delete
**What goes wrong:** `Bucket.deleteFiles()` is a convenience wrapper: by default (no `force` option) it
still attempts every file but a single permission/network error can cause the returned promise to reject
without a clear signal of which files succeeded, since the option controls error-collection behavior, not
delete parallelism.
**Why it happens:** The default behavior of `@google-cloud/storage`'s bulk helper is optimized for
"stop and report" convenience use, not resilience.
**How to avoid:** Pass `{ prefix: 'orgs/${orgId}/', force: true }` so all matching files are attempted and
transient per-object failures don't abort the whole sweep — mirrors the try/catch-per-file resilience
already established in `cleanupExpiredMediaHandler`/`cleanupOrphanRenders` (index.ts), just via the
library's own bulk-delete parameter instead of a manual loop.
**Warning signs:** A retried `deleteOrganization` call after a prior interrupted run still finds leftover
Storage objects that should have been swept on the first attempt.

### Pitfall 5: Firestore rules delete DENY must exempt the super-admin path correctly (or not at all)
**What goes wrong:** `deleteOrganization` uses the Admin SDK, which bypasses `firestore.rules` entirely —
so the new rules DENY does not need (and should not have) any special-case for the callable. But if the
DENY is written as `allow delete: if isSuperAdmin()` (an ALLOW-with-condition rather than an explicit
DENY), it re-opens a client-side deletion path for anyone who independently holds the `superAdmin` claim,
which conflicts with the design intent ("deletion is Admin-SDK-only").
**Why it happens:** Mirroring the existing `preservesLifecycleFields()` pattern's `|| isSuperAdmin()`
exemption idiom without noticing that pattern exists for ordinary field-preservation writes, not for
irreversible whole-document deletion.
**How to avoid:** Match CONTEXT.md's own language precisely: "deletion is Admin-SDK-only" — the correct
rule is an unconditional `allow delete: if false;` on `organizations/{orgId}` (no super-admin exemption),
since the only legitimate deletion path is the Admin SDK callable, which never touches rules at all.
**Warning signs:** An emulator test "a super-admin CAN client-delete an org" passes when it should be
irrelevant/never-exercised — that's a sign the rule was written more permissively than the design calls for.

## Code Examples

### The `deleteOrganization` handler shape
```typescript
// Source: composed from orgProvisioning.ts's established handler pattern
// (functions/src/orgDeletion.ts — NEW file)
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { assertSuperAdminCaller, normalizeOrgName } from "./orgProvisioning";

export interface DeleteOrganizationRequest {
  orgId: string;
  confirmName: string;
}

export interface DeleteOrganizationResponse {
  orgId: string;
  name: string;
  membersUnlinked: number;
  invitesDeleted: number;
  orgNameDeleted: boolean;
  storageObjectsDeleted: number;
}

export async function deleteOrganizationHandler(
  request: CallableRequest<DeleteOrganizationRequest>,
): Promise<DeleteOrganizationResponse> {
  await assertSuperAdminCaller(request);

  const { orgId, confirmName } = request.data ?? ({} as DeleteOrganizationRequest);
  if (typeof orgId !== "string" || orgId.trim() === "") {
    throw new HttpsError("invalid-argument", "orgId is required.");
  }

  const db = getFirestore();
  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    throw new HttpsError("not-found", `No organization found for id "${orgId}".`);
  }

  const orgData = orgSnap.data() as { name?: string; active?: boolean };
  const active = orgData.active ?? true; // default-true, same posture as isOrgActive()/setOrgActiveHandler
  if (active) {
    throw new HttpsError("failed-precondition", "Deactivate the church before deleting it.");
  }
  if (typeof confirmName !== "string" || confirmName !== orgData.name) {
    throw new HttpsError("invalid-argument", "Typed name does not match the church name.");
  }

  // --- READ everything the cascade will make unreadable (Pattern 2) -------
  const membersSnap = await orgRef.collection("members").get();
  const memberUids = membersSnap.docs.map((d) => d.id);

  const inviteLookupSnap = await db.collection("inviteLookup").where("orgId", "==", orgId).get();

  const nameKey = normalizeOrgName(orgData.name ?? "");
  const nameSnap = nameKey ? await db.collection("orgNames").doc(nameKey).get() : null;
  const shouldDeleteOrgName = !!nameSnap?.exists && nameSnap.data()?.orgId === orgId;

  // --- WRITE / DELETE (idempotent — safe to retry, R221) -------------------
  const batch = db.batch();
  for (const uid of memberUids) {
    batch.set(db.collection("users").doc(uid), { orgIds: FieldValue.arrayRemove(orgId) }, { merge: true });
  }
  for (const doc of inviteLookupSnap.docs) {
    batch.delete(doc.ref);
  }
  if (shouldDeleteOrgName && nameSnap) {
    batch.delete(nameSnap.ref);
  }
  await batch.commit();

  const [files] = await getStorage().bucket().getFiles({ prefix: `orgs/${orgId}/` });
  await getStorage().bucket().deleteFiles({ prefix: `orgs/${orgId}/`, force: true });

  await db.recursiveDelete(orgRef);

  return {
    orgId,
    name: orgData.name ?? "",
    membersUnlinked: memberUids.length,
    invitesDeleted: inviteLookupSnap.size,
    orgNameDeleted: shouldDeleteOrgName,
    storageObjectsDeleted: files.length,
  };
}

export const deleteOrganization = onCall(deleteOrganizationHandler);
```
*(Note: `getFiles` before `deleteFiles` is only to obtain an accurate `storageObjectsDeleted` count for the
summary — `deleteFiles` itself does not return a count. If exact counts aren't needed, skip the `getFiles`
call and omit/estimate `storageObjectsDeleted`.)*

### firestore.rules delete DENY
```javascript
// Source: composed to close the gap documented in firestore.rules:96-106
// (preservesLifecycleFields() short-circuits `request.resource == null` -- delete -- to `true`)
match /organizations/{orgId} {
  // ... existing read/write/create rules unchanged ...

  // Phase 77 (R216): deletion is Admin-SDK-only. deleteOrganization (Admin SDK)
  // bypasses rules entirely, so this DENY has zero effect on the legitimate
  // deletion path -- it exists solely to close the client-side gap left by
  // preservesLifecycleFields()'s `request.resource == null -> true` branch,
  // which the `write` rule above still permits for an ordinary editor.
  // Deliberately UNCONDITIONAL -- no isSuperAdmin() exemption (Pitfall 5).
  allow delete: if false;
}
```

### Emulator test shape for the delete DENY
```typescript
// Source: mirrors src/rules.test.ts's existing lifecycle-field DENY tests (lines ~414-440)
it('denies a client delete of organizations/{orgId} for an ORDINARY EDITOR', async () => {
  const editorDb = testEnv.authenticatedContext('userA', {}).firestore();
  await assertFails(deleteDoc(doc(editorDb, 'organizations', 'orgA')));
});

it('denies a client delete of organizations/{orgId} for a SUPER-ADMIN (Admin-SDK-only, no exemption)', async () => {
  const superAdminDb = testEnv
    .authenticatedContext('superAdminUser', { superAdmin: true })
    .firestore();
  await assertFails(deleteDoc(doc(superAdminDb, 'organizations', 'orgA')));
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| firebase-admin v9-v12: `recursiveDelete` existed but with less mature `BulkWriter` retry/backoff | firebase-admin v13.10.0 (installed): same API, hardened internals | N/A (this project has always been on v13.x for this milestone chain) | No migration concern — the method signature (`db.recursiveDelete(ref, bulkWriter?)`) has been stable across major versions |

**Deprecated/outdated:** None relevant — this is greenfield functionality within an established codebase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Case-sensitive, untrimmed-beyond-whitespace exact-string match is the right `confirmName` comparison (client input trimmed once, then `===`) | Client Design, Pitfall 3 | If the owner actually wants case-insensitive matching, a legitimate delete could be needlessly blocked by a capitalization mismatch — low severity, easily adjusted, but worth confirming since R220 doesn't specify |
| A2 | `deleteFiles({ prefix, force: true })` is preferred over the `getFiles`+loop pattern already used by the v1.8 sweeps | Standard Stack, Don't Hand-Roll | If per-object try/catch granularity or per-object logging is required for the delete summary's `storageObjectsDeleted` count, the getFiles+loop pattern (already precedented) may be the better fit — both are valid, this is a style preference not a correctness issue |
| A3 | The five orphan-risk top-level collections (`shareTokens`, `serviceShareLinks`, `orgSlugs`, `quarterShares`, `serviceShares`) should be IN SCOPE for this phase's cascade, based on the owner's "cleanup any relationships in the db" framing | Summary, Pitfall 2, Open Questions | If out of scope, these become permanent orphans after every deletion — a real but non-catastrophic residual risk (public-read documents referencing a dead org, not a security hole) that should be an explicit, informed decision, not an oversight |

**If this table is empty:** N/A — see rows above; none of these are compliance/security-critical, all are
scope/style decisions flagged for planner or owner sign-off.

## Open Questions

1. **Should the cascade also clean up `shareTokens`, `serviceShareLinks`, `orgSlugs`, `quarterShares`,
   `serviceShares` (all top-level, `orgId`-keyed, NOT covered by `recursiveDelete`)?**
   - What we know: all five exist, are confirmed keyed by an `orgId` field (via `firestore.rules` and
     `src/utils/shareTokens.ts`/`orgName.ts`/`slug.ts`), and would be permanently orphaned by a deletion
     that only implements R217/R218's literal text.
   - What's unclear: R217/R218 do not name them, and the phase's stated success criteria don't either —
     so implementing cleanup for them is "going beyond the written requirements" even though it matches
     the owner's stated intent ("everything associated with it").
   - Recommendation: extend the cascade to also query-and-batch-delete each of these five collections by
     `orgId == orgId` before `recursiveDelete` (same pattern as `inviteLookup`) — the marginal
     implementation cost is small (5 more `.where('orgId','==',orgId).get()` + batch-delete calls,
     identical shape to the `inviteLookup` cleanup already required) and it fully satisfies "no orphan
     left behind." If the planner/owner decides to descope this, document the residual orphan risk
     explicitly in the plan rather than silently omitting it.

2. **Should `aiUsage` ledger entries carrying this org's `orgId` be deleted too?**
   - What we know: `aiUsage` docs store `orgId` (via `buildUsageEntry`, `functions/src/index.ts:447`), so
     they are technically org-scoped data that would survive a deletion.
   - What's unclear: this is a low-value, Admin-SDK-only cost-observability ledger, not user-facing tenant
     data — the "no orphan" bar is arguably lower here than for the five share-link collections above.
   - Recommendation: explicitly descope (low priority, no user-facing or security impact) unless the
     planner wants full symmetry; document the decision either way.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| firebase-admin (recursiveDelete, bulkWriter) | Firestore cascade delete | ✓ | 13.10.0 (installed) | — |
| @google-cloud/storage (deleteFiles) | Storage cascade delete | ✓ | 7.19.0 (installed, transitive) | getFiles+loop (already precedented in this codebase) |
| Firebase emulator (Firestore + Storage) | Rules DENY tests, cascade unit tests | Assumed available (used throughout this project's existing `src/rules.test.ts`/`src/storage.rules.test.ts`) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none identified as missing.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (functions: mocked Admin SDK via `FakeFirestore`/`FakeBucket` pattern established in `orgProvisioning.test.ts`; rules: `@firebase/rules-unit-testing` via `firebase emulators:exec`) |
| Config file | `functions/vitest.config.ts` (unit); `vitest.rules.config.ts` (rules) |
| Quick run command | `cd functions && npx vitest run orgDeletion.test.ts` |
| Full suite command | `cd functions && npx vitest run` (unit); `npm run test:rules` or `npx vitest run --config vitest.rules.config.ts` against a running emulator (rules) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R215 | Delete on an active org is refused (`failed-precondition`) | unit | `npx vitest run orgDeletion.test.ts -t "active"` | ❌ Wave 0 |
| R216 | Non-super-admin caller rejected; caller re-verified via Firestore doc, not just claim | unit | `npx vitest run orgDeletion.test.ts -t "superAdmin"` | ❌ Wave 0 |
| R217 | `recursiveDelete` is called with the correct `orgRef`; each of the 11 known subcollections is proven gone (mocked or emulator-integration) | unit + emulator | `npx vitest run orgDeletion.test.ts -t "recursiveDelete"` | ❌ Wave 0 |
| R218 | `arrayRemove` (not overwrite) on `users/{uid}.orgIds`; `inviteLookup` docs queried+deleted by `orgId`; `orgNames` deleted ONLY when it points at this orgId | unit | `npx vitest run orgDeletion.test.ts -t "arrayRemove|inviteLookup|orgNames"` | ❌ Wave 0 |
| R219 | `bucket.deleteFiles` called with `prefix: orgs/${orgId}/` | unit | `npx vitest run orgDeletion.test.ts -t "deleteFiles"` | ❌ Wave 0 |
| R220 | Client: Delete button disabled until typed text matches org name exactly; disabled for an active org | component | `npx vitest run DeleteOrgConfirmDialog.test.ts` | ❌ Wave 0 |
| R221 | Idempotent re-run after partial failure completes cleanly (each step tolerates already-deleted state); summary shape matches spec | unit | `npx vitest run orgDeletion.test.ts -t "idempotent|retry"` | ❌ Wave 0 |
| R216 (rules) | `firestore.rules`: editor AND super-admin client `deleteDoc(organizations/{orgId})` both DENIED | emulator | `npx vitest run --config vitest.rules.config.ts -t "delete DENY"` | ❌ Wave 0 (add to `src/rules.test.ts`) |

### Sampling Rate
- **Per task commit:** `cd functions && npx vitest run orgDeletion.test.ts`
- **Per wave merge:** `cd functions && npx vitest run` (full unit suite) + rules suite against a running emulator
- **Phase gate:** Full unit suite green + rules suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `functions/src/orgDeletion.ts` — the handler itself does not exist yet
- [ ] `functions/src/orgDeletion.test.ts` — new file; extend the `FakeFirestore` pattern from
      `orgProvisioning.test.ts` with: a fake `.where('orgId','==',...)` query result, a fake `batch()`,
      and a fake `getStorage().bucket()` exposing `getFiles`/`deleteFiles` spies, plus a spy for
      `db.recursiveDelete` (since it's a top-level Firestore method, not a doc/collection method — the
      existing `FakeFirestore` class will need a `recursiveDelete` spy added)
- [ ] `src/components/admin/DeleteOrgConfirmDialog.vue` + its test file — new type-to-confirm UI, no
      existing component to extend
- [ ] `src/rules.test.ts` — add the two delete-DENY emulator tests (editor + super-admin) shown in Code
      Examples above

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `assertSuperAdminCaller` re-verifies `request.auth` + independently re-reads `superAdmins/{uid}` from Firestore (never trusts the ID-token claim alone) — reused verbatim |
| V3 Session Management | no | No session state introduced by this phase |
| V4 Access Control | yes | Super-admin-only callable (server re-verified) + `firestore.rules` delete DENY as defense-in-depth if the callable path is ever bypassed |
| V5 Input Validation | yes | `orgId`/`confirmName` type/presence validation (mirrors `onboardOrganizationHandler`'s `invalid-argument` pattern); `confirmName` exact-match against server-stored `name`, never trusting a client-side-only check |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client bypasses the dialog and calls `deleteOrganization` directly with a guessed/copied `confirmName` | Elevation of Privilege | Server independently re-reads `organizations/{orgId}.name` and compares — the client-declared `confirmName` alone proves nothing; only a match against the SERVER's stored name is trusted (mirrors `assignOrgAdminHandler`'s "never trust the caller-declared value alone" doctrine already established in this codebase) |
| A non-super-admin discovers/forges a client call to `deleteOrganization` | Elevation of Privilege | `assertSuperAdminCaller` (claim check + independent Firestore doc re-read) — identical gate as the four existing callables |
| A client attempts to `deleteDoc(organizations/{orgId})` directly, bypassing the callable entirely | Tampering | New `firestore.rules` `allow delete: if false` (unconditional — see Pitfall 5) |
| An org is deleted while active (skipping the deactivate-first guardrail) via a race between two concurrent super-admin actions (one reactivates while another deletes) | Tampering / Denial of Service | Server reads `active` fresh at the START of `deleteOrganizationHandler` and refuses if not `false` — a `reactivate` that lands between the client's dialog-open and the callable's execution is caught by this fresh read, not a stale client-side snapshot |
| Retrying an interrupted delete corrupts another org's data (cross-tenant orphan) | Tampering | Every write in the sequence is scoped to the captured `orgId`/member uids from THIS org only; `arrayRemove(orgId)` (not overwrite) on `users/{uid}.orgIds` never touches another org's membership entry for that same user (R221's explicit "preserve other memberships" requirement) |
| Deleted org's public share links (`shareTokens`, `quarterShares`, etc.) remain live/readable after deletion, serving stale content under a dead org's identity | Information Disclosure | See Open Question 1 — recommend extending the cascade to also delete these; if descoped, document as an accepted residual risk, not a silent gap |

## Sources

### Primary (HIGH confidence)
- Direct grep of `src/`, `functions/src/`, `firestore.rules`, `storage.rules` in this repository — every
  subcollection, Storage prefix, and cross-collection reference cited above was found this way, not
  assumed from training knowledge.
- `node -e` runtime probe against the installed `firebase-admin@13.10.0` package confirming
  `recursiveDelete`/`bulkWriter` exist as callable methods.
- `node_modules/@google-cloud/storage/build/cjs/src/bucket.d.ts` — confirmed `deleteFiles(query?: DeleteFilesOptions)` signature and that `DeleteFilesOptions extends GetFilesOptions, PreconditionOptions` with an additional `force?: boolean`.

### Secondary (MEDIUM confidence)
- None used — every claim in this document was either grepped directly from the codebase or probed
  against the installed runtime.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing installed versions confirmed by direct inspection
- Architecture: HIGH — cascade order and handler shape composed directly from this codebase's own
  established patterns (`orgProvisioning.ts`'s four existing callables)
- Pitfalls: HIGH for Pitfalls 1/4/5 (grounded in SDK semantics + existing rules structure); MEDIUM for
  Pitfall 2/3 since they surface genuine scope ambiguity requiring a human/planner decision, not a
  technical uncertainty

**Research date:** 2026-08-22
**Valid until:** 30 days (stable Admin SDK APIs; no fast-moving dependency in this phase)
