# Phase 133: Volunteer Responsibility Confirmation - Research

**Researched:** 2026-09-07
**Domain:** Firestore data modeling + security rules for a new scoped-write surface granted to an
unauthenticated-except-magic-link volunteer, layered onto the existing v2.12/2.13 `rehearseAccess`
projection architecture.
**Confidence:** HIGH (all findings grounded in this repo's actual code/rules; no external libraries
involved, so no web research was needed or attempted — `brave_search`/`firecrawl`/`exa_search` were
all unavailable per `init.phase-op`, and this phase has zero new-package surface anyway)

## Summary

This phase adds exactly one new capability to the data model: a volunteer-writable confirmation
status per (role, service) assignment. The critical architectural fact, discovered by tracing the
actual write paths in `src/stores/services.ts`, is that the existing volunteer-facing projection —
`organizations/{orgId}/rehearseAccess/{serviceId}` — is a **frozen snapshot fully overwritten by
`setDoc` on every relock** (`writeRehearseAccessDoc`, called from `markAsPlanned`) and **deleted
outright on every reopen** (`reopenService`). Storing confirmation state as a field inside that doc,
or inside the equally lock-gated `services/{serviceId}` doc (whose `update` rule is a hand-tuned,
heavily-commented allow-list with exactly two carve-outs today — Planning Center export and reopen —
see `firestore.rules:209-231`), would either get wiped every relock or require a THIRD carve-out on
the single most security-sensitive write rule in the schema. Both are wrong homes.

The correct home is a **new sibling subcollection**, `organizations/{orgId}/services/{serviceId}/confirmations/{key}`,
nested exactly like the two subcollections that already live under `services/{docId}` for the same
reason — `messages` and `lockSnapshots` (`firestore.rules:235-259`) — each with its own narrow rule,
untouched by the parent doc's lock gate. This is also the exact shape Phase 134 (R422/R423, presence)
is about to introduce one directory over (`services/{serviceId}/presence/{uid}`) — same milestone, same
pattern, same "org-scoped subcollection with get/list-split rules + live `onSnapshot` read" precedent.
Do not diverge from it.

The second critical finding: the volunteer's identity throughout this app is **email**, never
`personId` — `rehearseAccess` deliberately never exposes `personId` to the client (PII-safe
projection convention, see `RehearseAccessDoc`'s doc comment). A confirmation key built on `personId`
would require inventing a new, currently-nonexistent personId-to-volunteer-identity channel. The
existing, already-trusted identity axis is `assignedEmailsLower` / `rolesByEmailLower`. This phase
must add ONE new parallel field to that same projection — `roleAssignmentsByEmailLower: Record<string,
{roleId: string; roleName: string}[]>` — which simultaneously (a) gives the client the `roleId` it
needs to render a per-role "I've got it" control, (b) gives `firestore.rules` a single sibling `get()`
it can check to verify a write's key belongs to the caller, and (c) gives the relock reconciliation
step (R412) the exact before/after assignment sets to diff — all without inventing a second,
independently-coded assignment resolver inside rules (the anti-pattern this codebase is explicitly on
guard against, per the `isOrgMember`/`isOrgEditor` "claim-only, no cross-document fragility" doc
comments already in `firestore.rules`).

**Primary recommendation:** Add `services/{serviceId}/confirmations/{roleId}_{emailLower}` as a new
subcollection (flat map-shaped docs, one per assignment), keyed on `roleId + emailLower` (NOT
`personId`); add `roleAssignmentsByEmailLower` to `RehearseAccessDoc`/`buildRehearseAccess` as the
single source both the write-rule check and the relock-reconciliation diff read from; reconcile
confirmations inside `markAsPlanned` right after `writeRehearseAccessDoc` runs, diffing the
previous relock's `roleAssignmentsByEmailLower` against the new one; extend `RecipientSelection`
(client) and `RecipientSelector`/`resolveMessageRecipients` (server) with an `unconfirmedOnly` flag
that filters the existing matched-person set by confirmation status — a pure filtering addition, no
new send path.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Confirmation state storage | Database / Storage | API-equivalent (Firestore rules) | New Firestore subcollection; no server function needed for the write itself — client SDK writes directly, gated by rules (mirrors `lockSnapshots`) |
| Volunteer "I've got it" write | Browser / Client | Database / Storage | Volunteer's browser calls `setDoc`/`updateDoc` directly against the confirmations subcollection; Firestore rules are the only enforcement layer (no Cloud Function in the write path — matches the existing `rehearseAccess`/`lockSnapshots` client-writable precedent, not the Admin-SDK-only `messages/recipients` precedent) |
| Planner live status read | Browser / Client | Database / Storage | `onSnapshot` on the confirmations subcollection from `ServiceEditorView.vue`'s Roles tab (already a live-reactive tab today via the org-scoped `services` store's own `onSnapshot`) |
| R412 invalidation | API-equivalent (client store, trusted editor path) | Database / Storage | Reconciliation runs inside `markAsPlanned` (`src/stores/services.ts`), an already-trusted org-editor client write path — no new Cloud Function required, matches how `writeRehearseAccessDoc` itself already runs client-side at relock |
| R413 unconfirmed-only targeting | API-equivalent (functions/src) | Browser / Client (preview) | The authoritative recipient list is re-resolved server-side in `sendQueuedMessageHandler` (`functions/src/index.ts`) per the existing "never trust the client's list" design; the client (`MessageComposer.vue`) only computes a preview via the mirrored pure function |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R410 | Two-state confirm ("I've got it"), volunteer-facing | Storage shape + client write path (see "Standard Stack" / "Confirmation Storage Shape") |
| R411 | Planner-visible live status on the roster, via `onSnapshot` | New `onSnapshot` listener on the confirmations subcollection, surfaced in `ServiceEditorView.vue`'s existing Roles tab (`resolvedRoleAssignments`, line ~4147) |
| R412 | Invalidate to "needs reconfirmation" on reassignment/relock, keyed on stable assignment identity | `roleAssignmentsByEmailLower` diff inside `markAsPlanned`; see "Invalidation Hook" |
| R413 | Reminder nudges targeting only unconfirmed, reusing v1.7 messaging | `unconfirmedOnly` filter added to `RecipientSelection`/`RecipientSelector` + both resolver ports |
</phase_requirements>

## Standard Stack

No new external libraries. This phase is pure application-level Firestore schema + rules + Vue
component work using the stack already in place (Firebase JS SDK v10+, Vue 3 / Pinia, Firebase
Admin SDK in `functions/src`). No `npm install` is required.

### Package Legitimacy Audit

**Not applicable — this phase introduces zero new npm packages.** No legitimacy check was run
because there is nothing to check; the Package Legitimacy Gate is a no-op for this phase.

## Confirmation Storage Shape (Research Flag 2)

**Recommendation: a dedicated subcollection, `organizations/{orgId}/services/{serviceId}/confirmations/{roleId}_{emailLower}`, NOT a map field on the service doc, NOT a field on `rehearseAccess`.**

Evidence against the two map-field alternatives:

1. **On `rehearseAccess/{serviceId}` (`src/utils/rehearseAccess.ts` / `src/stores/services.ts:302-316`):**
   `writeRehearseAccessDoc` calls `setDoc(doc(...), { ...rehearseAccess, updatedAt: serverTimestamp() })`
   — a full-document `setDoc`, not a merge, on **every** `markAsPlanned` call (initial lock AND every
   relock after a reopen). Any confirmation data placed here would be silently erased on every relock
   unless `writeRehearseAccessDoc` were rewritten to read-merge first — which would then require the
   *editor's* write path to carry volunteer-write data through a doc whose `allow write: if
   isOrgEditor(orgId)` rule (`firestore.rules:331`) has no volunteer write arm at all today. Building
   one would mean the single most heavily-commented "frozen, PII-safe, editor-writes-only" doc in the
   schema (R377) gains its first non-editor writer — a much larger blast radius than a new sibling
   collection.

2. **On `services/{serviceId}` directly (`src/types/service.ts` `Service` interface):** the `update`
   rule (`firestore.rules:209-231`) is `isOrgEditor(orgId) && (three explicit hasOnly()-gated arms)`.
   A volunteer is never `isOrgEditor` for any org (they hold no membership doc), so a volunteer write
   here is impossible without adding a fourth arm to this rule that grants a *non-editor* write — the
   single riskiest possible place to add a new actor, given this is the doc CLAUDE.md's SEC-S-01
   incident and the v2.10 hardening round were both about. Avoid entirely.

3. **A new subcollection under `services/{serviceId}` (RECOMMENDED):** nested exactly like `messages`
   and `lockSnapshots` (`firestore.rules:235-259`), which already prove the pattern: a subcollection
   under `services/{docId}` gets `orgId` and `serviceId` for free from the enclosing `match` path
   segments (no sibling `get()` needed to resolve them, unlike `rehearseAccess`'s own `parentIsPlanned()`
   cross-doc lookup), and its rule is entirely independent of the parent doc's lock-gated `update` rule
   — a volunteer write here cannot, by construction, touch `slots`, `roleAssignmentOverrides`, `status`,
   or anything else on the service. This is also architecturally identical to what Phase 134 is about to
   ship one directory over (`services/{serviceId}/presence/{uid}`, R422/R423) — same milestone, same
   precedent, same reviewer mental model.

**Doc shape** (one doc per assignment, not one big map — see key rationale below):

```typescript
// organizations/{orgId}/services/{serviceId}/confirmations/{roleId}_{emailLower}
export type ConfirmationStatus = 'confirmed' | 'needsReconfirmation'
// 'unconfirmed' is NEVER stored — it is the implicit default for any
// (roleId, emailLower) pair with no confirmation doc at all (R410's "Unconfirmed
// default, implicit"). Only 'confirmed' and 'needsReconfirmation' are ever written.

export interface ConfirmationDoc {
  roleId: string
  roleName: string          // denormalized, mirrors rehearseAccess's own roleName denorm — lets the
                             // planner's live listener render without a roles lookup
  emailLower: string
  status: ConfirmationStatus
  confirmedAt: Timestamp | null   // serverTimestamp() when status flips to 'confirmed'; null otherwise
  updatedAt: Timestamp             // serverTimestamp() on every write (volunteer confirm/unconfirm, or
                                    // the editor-side relock reconciliation)
}
```

**Why one doc per assignment, not a single map-field doc (`confirmations/status` holding a
`Record<key, {...}>`):** the write-rule must restrict a volunteer to touching ONLY their own key. A
single shared doc requires a rule that inspects `request.resource.data.diff(resource.data).affectedKeys()
.hasOnly([callerKey])` — doable, but it re-serializes and re-writes the WHOLE map on every single
confirm click (a multi-volunteer contention/last-write-wins hazard: two volunteers confirming within
the same second on the same service would race on the same document). Per-assignment docs give each
volunteer their own document — no contention, no shared-doc replace, and the rule is a plain per-doc
identity check, not a map-diff check. This also matches the presence subcollection's own per-uid-doc
shape one phase later (R423: `presence/{uid}`), for consistency across the milestone.

## Stable Assignment Identity (Research Flag 1 / R412's key)

**Recommendation: `${roleId}_${emailLower}` — NOT `personId`, NOT a separately-minted "serving
assignment id," NOT a slot id.**

Tracing the resolution chain:

- `src/utils/serviceRoles.ts::resolveServiceRoleAssignments(service, quarters, roles)` returns one
  `ResolvedRoleAssignment` per role, each carrying `effectivePersonIds: string[]` — computed as
  `service.roleAssignmentOverrides?.[role.id] ?? scheduledPersonIds` (line 53). This is the
  authoritative (roleId → personId[]) resolution used identically by the editor's Roles tab
  (`ServiceEditorView.vue:4147-4149`), the messaging recipient resolver
  (`src/utils/messagingRecipients.ts`), and the `rehearseAccess` projection builder
  (`src/utils/rehearseAccess.ts:123`).
- `buildRehearseAccess` (`src/utils/rehearseAccess.ts:114-244`) already converts this personId-keyed
  resolution into an **email-keyed** one for volunteer consumption: `assignedEmailsLower` (flat set) and
  `rolesByEmailLower: Record<emailLower, string[]>` (role NAMES only, no roleId — line 145-154). This
  is the deliberate PII-safe boundary: `personId` never crosses into anything a volunteer's client can
  read. `roleAssignments` (line 216-221, the "Who's Serving" array) carries `roleId` but only
  `personNames` (no id, no email) — it is a read-only display array for the WHOLE team, not
  identity-bearing for any one volunteer.

**Consequence:** neither existing field gives a volunteer's own client (a) the `roleId` needed to
render a per-role confirm control, nor (b) anything Firestore rules can use to verify "this roleId is
actually this caller's assignment" without a personId↔email lookup that would require reading the
`people` collection (which a volunteer holds no access to — not even via a rules `get()`, since that
collection isn't otherwise proven safe to expose that way, and doing so would duplicate
`resolveServiceRoleAssignments`'s business logic inside rules, exactly the cross-document-fragility
anti-pattern `isOrgMember`/`isOrgEditor`'s own doc comments warn against).

**Fix — add one new field to `RehearseAccessDoc` / `buildRehearseAccess`:**

```typescript
// New field on RehearseAccessDoc (src/utils/rehearseAccess.ts), built in the SAME loop that already
// builds rolesByEmailLower (line 146-154) — trivial addition, zero new resolution logic.
roleAssignmentsByEmailLower: Record<string, { roleId: string; roleName: string }[]>
```

This single field is the stable assignment identity backbone for the whole phase:
- **Client render:** `MyScheduleView`/`ScheduleServiceCard` (or `VolunteerServiceView`) reads
  `doc.roleAssignmentsByEmailLower[myEmailLower]` to get `{roleId, roleName}[]` — enough to render one
  "I've got it" control per role and to build the confirmation doc's key (`${roleId}_${emailLower}`).
- **Rules check:** the confirmation write rule does ONE sibling `get()` on the SAME
  `rehearseAccess/{serviceId}` doc the volunteer already has read access to (reusing the exact
  `parentIsPlanned()`-style cross-doc `get()` idiom already established at `firestore.rules:278-282`,
  not a new pattern), and checks that the incoming doc's `roleId` appears in
  `roleAssignmentsByEmailLower[callerEmailLower]`. No `people` collection read, no re-implementation of
  `resolveServiceRoleAssignments` in rules language.
- **R412 diff:** the relock reconciliation step (below) diffs the OLD `roleAssignmentsByEmailLower`
  (read back from the confirmations subcollection's own stored `roleId`/`emailLower` fields, or from the
  previous `rehearseAccess` doc before it's overwritten) against the NEW one computed this relock — same
  field, same shape, one comparison.

**Note (flagged, not resolved — flag for planner/discuss):** this key is per-**email**, not per-
person-record. Two different people sharing one email address (unusual, but the data model allows a
blank/duplicate email) would collide on the same confirmation doc. This mirrors an EXISTING accepted
risk in `rehearseAccess.assignedEmailsLower`/`rolesByEmailLower` — R412 does not need to solve a
problem the rest of the volunteer-identity system has already accepted. Not a regression, but worth a
one-line note in the plan.

## R412 — Invalidation Hook (Research Flag 4)

**Where:** `markAsPlanned` in `src/stores/services.ts` (line 580-673), the ONLY place
`writeRehearseAccessDoc` is called for a status transition into `planned` (both the first lock AND
every relock after `reopenService`). `reopenService` (line 730+) deletes the `rehearseAccess` doc but
does **not** need to touch confirmations at all — see reasoning below.

**Recommended flow**, added as a new step inside `markAsPlanned`, right after the existing
`writeRehearseAccessDoc` try/catch (line 635-654), reusing the SAME `assignments` the projection build
just computed (no second resolution pass):

1. Read the current `confirmations` subcollection for this service (`getDocs`, editor already has
   `isOrgMember` read access — no rules change needed for this read).
2. Build the NEW valid key set from the assignments this relock just resolved: for each
   `ResolvedRoleAssignment`, for each `effectivePersonId`, look up the person's `emailLower`, and
   collect `${roleId}_${emailLower}`.
3. For every EXISTING confirmation doc whose key is `status === 'confirmed'` AND is **not** in the new
   valid key set, `updateDoc` it to `status: 'needsReconfirmation'`.
4. Existing confirmation docs whose key IS still in the new valid set are left completely untouched —
   this is what satisfies "an assignment that is unchanged keeps its confirmation across unrelated
   roster edits" (R412, verbatim from CONTEXT.md).
5. Do nothing for keys with no confirmation doc at all (still implicitly `unconfirmed` — no write
   needed).

Wrap this in the same best-effort `try/catch` + `console.error` discipline as the surrounding
`writeRehearseAccessDoc`/`ensureShareLink` calls in this function (line 649-654, 666-671) — a
reconciliation failure must never roll back the already-succeeded status transition.

**Why `reopenService` needs no confirmations change:** while a service is back in Draft, the
volunteer's ENTIRE read path is cut off — `rehearseAccess` is deleted (so `MyScheduleView`'s
collection-group query and `VolunteerServiceView`'s direct read both return nothing for this service),
and the new confirmation-write rule's `parentIsPlanned()`-style check (reusing the exact live re-check
already required for `rehearseAccess` reads, `firestore.rules:278-282`) will deny any write attempt
during Draft anyway. So stale `confirmed`/`needsReconfirmation` docs sitting untouched during an
edit-in-progress window are invisible and inert; the NEXT `markAsPlanned`'s reconciliation pass (step 3
above) is the single hook that ever needs to run, and it runs exactly once per relock — no separate
"on reopen" cleanup path needed.

**Derived vs. stored (Claude's Discretion, CONTEXT.md):** **recommend STORED**, not derived. A derived
approach ("confirmed, but assignment changed since" computed live by diffing against the current
`roleAssignmentsByEmailLower`) would require the planner's live view to hold BOTH the confirmation doc
AND a separately-fetched historical assignment snapshot to detect drift — more moving parts, and it
reintroduces exactly the kind of dual-source-of-truth resolution this research is steering away from.
A stored `needsReconfirmation` status, written once at the exact moment of relock (the only moment the
assignment set can change, since Planned services are otherwise locked), is simpler, cheaper to read
(the planner's live listener needs nothing but the confirmations subcollection itself), and gives R411
free live-diff detection with zero extra client logic.

## Volunteer Scoped-Write Security (Research Flag 3 — LOAD-BEARING)

This is the phase's central risk. Design, modeled directly on the volunteer arm already proven safe
for `rehearseAccess` (`firestore.rules:277-332`):

```
match /organizations/{orgId}/services/{serviceId}/confirmations/{confirmationId} {
  function rehearseAccessDoc() {
    return get(/databases/$(database)/documents/organizations/$(orgId)/rehearseAccess/$(serviceId));
  }
  function isAssignedVolunteer() {
    return isSignedIn()
      && request.auth.token.email != null
      && request.auth.token.email_verified == true
      && exists(/databases/$(database)/documents/organizations/$(orgId)/rehearseAccess/$(serviceId))
      && request.auth.token.email.lower() in rehearseAccessDoc().data.get('assignedEmailsLower', []);
  }
  function isOwnAssignmentKey(roleId, emailLower) {
    return emailLower == request.auth.token.email.lower()
      && rehearseAccessDoc().data.get('roleAssignmentsByEmailLower', {})
           .get(emailLower, []).hasAny([{'roleId': roleId, 'roleName': ??}]);
    // NOTE: exact-map-equality-in-list is awkward in rules language; the
    // PLANNER MUST verify at implementation time whether hasAny() against a
    // list-of-maps needs a roleId-only projection field instead (e.g. an
    // additional flat roleIdsByEmailLower: Record<emailLower, string[]> is the
    // safer, rules-friendly sibling of roleAssignmentsByEmailLower — cheaper to
    // check with `in` than matching an object shape). Prefer the flat-array
    // form for the rules check; keep roleAssignmentsByEmailLower (with names)
    // for client rendering only.
  }

  allow get, list: if isOrgMember(orgId) || isAssignedVolunteer();

  allow create, update: if isOrgMember(orgId)  // editor path: the relock reconciliation write (step 3 above)
    || (
      isAssignedVolunteer()
      && confirmationId == request.resource.data.roleId + '_' + request.resource.data.emailLower
      && request.resource.data.emailLower == request.auth.token.email.lower()
      && request.resource.data.roleId in rehearseAccessDoc().data.get('roleIdsByEmailLower', {}).get(request.auth.token.email.lower(), [])
      && request.resource.data.status in ['confirmed', 'needsReconfirmation']
      // R410: volunteer may toggle back to Unconfirmed too — but 'unconfirmed'
      // is never STORED (see storage shape above); un-confirming is a DELETE,
      // not a status write. See the delete arm below.
    );

  allow delete: if isOrgMember(orgId)
    || (isAssignedVolunteer() && resource.data.emailLower == request.auth.token.email.lower());
}
```

Key properties this design guarantees:
- **No cross-tenant vector:** `orgId`/`serviceId` are path segments, never client-supplied fields —
  structurally impossible to target another org's service (same guarantee `rehearseAccess`'s own doc
  comment calls out at `firestore.rules:266-267`).
  A volunteer can never see or affect anything outside `confirmations/*` for a service they are
  proven-assigned to — the `services/{serviceId}` doc, `slots`, `roleAssignmentOverrides`,
  `stageLayout`, `messages`, everything else, remains governed exclusively by the existing
  `isOrgEditor`-gated rules, completely untouched by this new match block.
- **No self-escalation to someone else's key:** `request.resource.data.emailLower ==
  request.auth.token.email.lower()` is checked on every write; a volunteer cannot write a confirmation
  keyed to a co-worker's email.
- **No forging a role you aren't assigned:** the `roleId in rehearseAccessDoc()...` check re-derives
  from the SAME editor-trusted projection every other volunteer read already depends on — no second,
  independently-coded assignment resolver.
- **Fails closed during Draft:** `exists(rehearseAccess/{serviceId})` is false the moment
  `reopenService` deletes it — mirrors `parentIsPlanned()`'s own "exists()-guarded FIRST" discipline
  (`firestore.rules:12-16` comment) so an unguarded `get()` on a missing doc denies rather than throws.

**Required ALLOW/DENY rules tests** (extend `src/rules.test.ts`, mirroring the existing `rehearseAccess`
suite's structure at `firestore.rules:277-332`'s corresponding tests):

| # | Scenario | Expect |
|---|----------|--------|
| 1 | Assigned volunteer (email in `assignedEmailsLower`, roleId in their own `roleIdsByEmailLower`) writes their own confirmation on a Planned service | ALLOW |
| 2 | Same volunteer writes/deletes their own confirmation to un-confirm | ALLOW |
| 3 | Assigned volunteer attempts to write a confirmation keyed to a DIFFERENT assigned volunteer's email | DENY |
| 4 | Assigned volunteer attempts to write a confirmation for a `roleId` they are NOT assigned (forged role) | DENY |
| 5 | Assigned-to-service-A volunteer attempts to write a confirmation under service B (cross-service, same org) | DENY |
| 6 | Volunteer assigned in org A attempts to write a confirmation under org B (cross-tenant) | DENY |
| 7 | Any volunteer attempts to write a confirmation while the parent service is Draft (no `rehearseAccess` doc exists) | DENY |
| 8 | Any volunteer attempts to write/update ANY field on `services/{serviceId}` itself (not the subcollection) | DENY (unchanged — proves this phase adds no new surface to the parent doc) |
| 9 | Unverified-email account (`email_verified: false`) attempts a confirmation write | DENY (mirrors the existing `rehearseAccess` unverified-email test) |
| 10 | Org editor (`isOrgMember`) writes/updates a confirmation directly (the relock-reconciliation path) | ALLOW |
| 11 | Org member reads (`get`/`list`) the confirmations subcollection live | ALLOW |
| 12 | Non-assigned, non-member signed-in user attempts to read another org's confirmations | DENY |

## R413 — Unconfirmed-Only Recipient Targeting (Research Flag 5)

**Confirmed: this is a targeting/filter change, not a new send path**, on BOTH copies of the recipient
resolver that already exist (client preview + server authoritative re-resolve — this codebase
deliberately maintains two hand-ported copies, see below).

**Client (`src/utils/messagingRecipients.ts::resolveRecipients` + `src/components/MessageComposer.vue`):**
`RecipientSelection` gains one new field: `unconfirmedOnly?: boolean`. `MessageComposer.vue` needs live
confirmation data (the same subcollection R411 already subscribes to in `ServiceEditorView.vue` —
thread it down as a prop, e.g. `confirmedRoleEmailKeys: Set<string>`) to compute the preview. Inside
`resolveRecipients`, when `unconfirmedOnly` is true, change the per-assignment loop
(`messagingRecipients.ts:51-56`) so a `pid` is only added if AT LEAST ONE of that person's matched
role assignments this service has a key NOT in the confirmed-set (a person with 2 roles, one confirmed
and one not, still qualifies — R413 says "people with unconfirmed... assignments," not "fully
unconfirmed people").

**Server (`functions/src/serviceRoles.ts::resolveMessageRecipients` + `functions/src/index.ts`):**
This is the ACTUAL enforcement point — `sendQueuedMessageHandler` explicitly re-resolves the send list
from scratch at send time ("③ RE-RESOLVE recipients from scratch (Anti-Pattern 1)" — `functions/src/index.ts:2023-2066`)
and never trusts the client's computed list. `RecipientSelector` (the persisted, client-declared
intent — `functions/src/index.ts:1562-1566`) needs the same `unconfirmedOnly?: boolean` field added,
`QueuedMessageDoc.recipientSelector` persists it unchanged (no schema migration — optional field,
absent on every message queued before this phase), and `sendQueuedMessageHandler` needs one more
Admin-SDK read (`orgRef.collection('services').doc(serviceId).collection('confirmations').get()`,
alongside its existing `Promise.all` of quarters/roles/people at line 2041-2046) to build the same
confirmed-key set, then filter `resolveMessageRecipients`'s `reachable` list the same way. **Both ports
must apply the identical filter logic** — this repo already accepts hand-mirroring
`resolveServiceRoleAssignments`/`ResolvedRoleAssignment` between `src/utils/serviceRoles.ts` and
`functions/src/serviceRoles.ts` (see the latter's own doc comment: "hand-mirrored from the app's
canonical types... Only the fields the algorithm touches are declared") — follow that exact
established convention, do not attempt to deduplicate across the client/functions boundary.

**Respects the existing kill-switch / Resend test-mode caveat** (CLAUDE.md, `v2-11`-era memory): no
change needed here — `unconfirmedOnly` only narrows WHO is targeted; it does not touch
`sendQueuedMessage`'s existing org-level enqueue quota, the messaging kill-switch check, or the Resend
sender-domain-verification constraint (real email still only reaches the owner inbox until DNS
verification lands — a send-infrastructure limitation, unaffected by targeting logic).

## Architecture Patterns

### System Architecture Diagram

```
 Volunteer (My Schedule / VolunteerServiceView)
   │  reads doc.roleAssignmentsByEmailLower[myEmail] → {roleId, roleName}[]
   │  renders one "I've got it" control per role
   │
   ├─ tap "I've got it" ──► setDoc(confirmations/{roleId}_{emailLower}, {status:'confirmed',...})
   │                          gated by: isAssignedVolunteer() && isOwnAssignmentKey() (firestore.rules)
   │
   └─ tap "Undo" ──► deleteDoc(confirmations/{roleId}_{emailLower})
                        gated by: resource.data.emailLower == caller email

 Planner (ServiceEditorView.vue Roles tab)
   │  onSnapshot(collection(services/{id}/confirmations)) ──► live status per (roleId, personId)
   │  renders chip next to effectiveNames() output: Confirmed / Unconfirmed / Needs Reconfirmation
   │
   └─ relock (markAsPlanned) ─────────────────────────────────────────────┐
        │ 1. write rehearseAccess projection (unchanged, existing)         │
        │ 2. NEW: reconcile confirmations                                  │
        │    - compute new valid (roleId,emailLower) key set               │
        │    - flip stale 'confirmed' docs → 'needsReconfirmation'         │
        │    - leave unchanged keys untouched                              │
        └───────────────────────────────────────────────────────────────────┘

 Planner (MessageComposer.vue → "Nudge unconfirmed")
   │  selection.unconfirmedOnly = true
   │  client preview: resolveRecipients(..., confirmedKeys) — filters matchedPersonIds
   │
   └─ queueServiceMessage (unchanged callable) ──► messages/{id} { recipientSelector: {..., unconfirmedOnly: true} }
        │
        └─ sendQueuedMessage trigger (functions/src/index.ts)
             ③ RE-RESOLVE from scratch (existing, hardened path)
             + NEW: read confirmations subcollection (Admin SDK, bypasses rules)
             + NEW: filter resolveMessageRecipients() output by unconfirmedOnly
             → actual send list (never trusts client)
```

### Recommended file changes (no new files needed for storage — extends existing modules)
```
src/types/service.ts               # no change — confirmations do NOT live on Service
src/utils/rehearseAccess.ts         # + roleIdsByEmailLower / roleAssignmentsByEmailLower fields
src/stores/services.ts              # + reconcileConfirmations() called from markAsPlanned
src/utils/messagingRecipients.ts    # + unconfirmedOnly filter in resolveRecipients
src/components/MessageComposer.vue  # + "unconfirmed only" targeting toggle, confirmedKeys prop
src/views/ServiceEditorView.vue     # + onSnapshot(confirmations), status chip in Roles tab
src/views/MyScheduleView.vue        # or src/components/ScheduleServiceCard.vue — "I've got it" control
functions/src/serviceRoles.ts       # + unconfirmedOnly filter (server port, hand-mirrored)
functions/src/index.ts              # + RecipientSelector.unconfirmedOnly, confirmations read in sendQueuedMessageHandler
firestore.rules                     # + confirmations subcollection match block (see Security Domain)
src/rules.test.ts                   # + 12 ALLOW/DENY tests (see table above)
```

### Pattern: subcollection-per-actor, not map-field-on-locked-parent
**What:** when a non-owner actor (volunteer, and per Phase 134, a presence heartbeat) needs to write
something scoped to a service, give it its OWN subcollection with its OWN rule — never extend the
parent doc's already-hardened write rule.
**When to use:** any time a new class of writer needs access to "something about this service" without
becoming a new arm on `services/{docId}`'s `update` rule.
**Example (existing precedent, `lockSnapshots`):**
```
// firestore.rules:256-259
match /lockSnapshots/{snapshotId} {
  allow read:  if isOrgMember(orgId);
  allow write: if isOrgEditor(orgId);
}
```

### Anti-Patterns to Avoid
- **Re-deriving role assignment inside firestore.rules from `roleAssignmentOverrides` + quarters +
  roles:** this duplicates `resolveServiceRoleAssignments`'s business logic in a second language/runtime
  with no way to keep them in sync, and the quarters/roles collections are not otherwise proven
  volunteer-readable. Always check against the ALREADY-COMPUTED, ALREADY-TRUSTED `rehearseAccess`
  projection via a sibling `get()` instead.
- **Storing `'unconfirmed'` as an explicit stored value:** don't. It must stay the implicit absence of
  a doc (per R410, "Unconfirmed (default, implicit)") — storing it explicitly means every new
  assignment needs a write just to reach the default state, and doubles the doc count for no benefit.
- **Trusting the client's computed recipient list for R413's nudge send:** the server MUST re-resolve
  (this is already this codebase's law for every other selector field — do not special-case
  `unconfirmedOnly` as the one field that skips re-resolution).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting "this volunteer is genuinely assigned to this role" | A new personId↔email lookup table, or a rules-side reimplementation of quarter/override resolution | The existing `rehearseAccess` projection's denormalized email-keyed fields, read via one sibling `get()` | Single source of truth already exists and is already trusted by every other volunteer-facing read; a second implementation is a drift/inconsistency risk |
| Live status updates on the roster | A polling refresh or a manual "refresh" button | `onSnapshot` on the confirmations subcollection (Firebase JS SDK, already the pattern for `services`/`mySchedule`/soon `presence`) | Matches R411's explicit requirement and every other live-view precedent in this codebase |
| "Who hasn't confirmed" recipient list | A separate Cloud Function / new callable | Extending the existing `resolveRecipients`/`resolveMessageRecipients` pure functions with one more filter param | R413 explicitly calls this "a recipient-filter/query change, NOT a new send primitive" |

**Key insight:** every piece of this feature has a directly analogous, already-shipped precedent
elsewhere in this codebase (`rehearseAccess` for volunteer scoped read, `lockSnapshots`/`messages` for
volunteer-adjacent subcollections, the messaging resolver's client/server hand-mirror convention, and
Phase 134's about-to-ship presence subcollection). The implementation risk in this phase is not
"figuring out a new pattern" — it is faithfully reusing the four patterns that already exist rather
than inventing a fifth.

## Common Pitfalls

### Pitfall 1: Confirmation racing concurrent roster edits (read live, not one-time)
**What goes wrong:** a planner viewing a stale one-time-fetched confirmation snapshot reassigns a role
away from a volunteer who confirmed minutes ago, sees a "Confirmed" chip that is now a lie, and doesn't
realize a nudge is needed.
**Why it happens:** `getDoc`/`getDocs` snapshots go stale the instant either side (roster edit,
volunteer confirm) changes underlying data; only `onSnapshot` self-heals.
**How to avoid:** R411 already mandates `onSnapshot`; enforce it in code review — no `getDoc`/`getDocs`
anywhere in the planner-facing confirmation status read path. `markAsPlanned`'s reconciliation
(server-trusted, one-shot at relock) is the ONE legitimate place a `getDocs` is fine, because it is the
authoritative moment of change, not a display read.
**Warning signs:** any `getDocs(collection(..., 'confirmations'))` call outside `markAsPlanned`'s
reconciliation step.

### Pitfall 2: Broadening volunteer access beyond confirmations
**What goes wrong:** it's tempting to grant the volunteer's confirmation-write rule a slightly wider
`isOrgMember(orgId) || isAssignedVolunteer()`-style OR that accidentally also satisfies some other
match block, or to reuse `rehearseAccess`'s `write: if isOrgEditor(orgId)` rule verbatim for the new
subcollection (which would silently make it editor-only, breaking R410 entirely) or to weaken it to
`isSignedIn()` (which would let ANY authenticated user — including another org's volunteer — write).
**Why it happens:** copy-paste from the wrong nearby rule block.
**How to avoid:** the confirmations rule must be its OWN match block with its OWN `isAssignedVolunteer()`
helper scoped to email + role identity — never inherit `rehearseAccess`'s editor-only write arm, never
drop the `roleId`-ownership check.
**Warning signs:** a rules test where a volunteer assigned to Service A can write into Service B's
confirmations (test #5 above) — if that passes, the rule is too loose.

### Pitfall 3: Messaging kill-switch / Resend test-mode assumptions
**What goes wrong:** assuming the new `unconfirmedOnly` nudge needs its own delivery-limit or
kill-switch check.
**Why it happens:** it's a "new-feeling" send trigger even though it reuses the exact existing pipeline.
**How to avoid:** it flows through the SAME `queueServiceMessage`/`sendQueuedMessage` pair, so the
existing org-level `ORG_MAX_EMAILS_PER_DAY` quota, `MESSAGE_MAX_RECIPIENTS` cap, and any messaging
kill-switch already apply automatically — do not add a parallel check.
**Warning signs:** new quota/kill-switch code appearing anywhere in the R413 diff — a sign the send path
was duplicated instead of reused.

### Pitfall 4: `roleAssignmentsByEmailLower` growing unboundedly stale in old, never-relocked services
**What goes wrong:** a Planned service that is never reopened/relocked keeps whatever
`roleAssignmentsByEmailLower` it had at its ORIGINAL lock forever — this is correct and intended
(R412 only fires ON relock), but a plan/verification step might mistakenly expect live drift detection
without a relock. Document this as expected behavior, not a bug: an assignment can only change via
`roleAssignmentOverrides` writes, which are gated to Draft-only (`firestore.rules:214`), so the
underlying assignment literally cannot change while Planned — the invalidation hook firing only at
relock is not a gap, it is the ONLY point where it is even possible for the assignment set to differ.

## Code Examples

### Existing pattern this phase reuses verbatim: sibling cross-doc get() with exists()-guard-first
```typescript
// Source: firestore.rules:278-282 (rehearseAccess's parentIsPlanned())
function parentIsPlanned() {
  return exists(/databases/$(database)/documents/organizations/$(orgId)/services/$(serviceId))
    && get(/databases/$(database)/documents/organizations/$(orgId)/services/$(serviceId))
         .data.get('status', 'draft') != 'draft';
}
// The confirmations rule's isAssignedVolunteer() reuses this EXACT shape, substituting
// rehearseAccess/{serviceId} as the sibling doc checked, per the Security Domain section above.
```

### Existing pattern this phase reuses verbatim: hand-mirrored client/server pure resolver
```typescript
// Source: src/utils/messagingRecipients.ts (client) vs functions/src/serviceRoles.ts (server) —
// same algorithm, ported by hand, deliberately not shared via a monorepo package (documented in the
// server file's own header comment). R413's unconfirmedOnly filter must be added to BOTH, identically.
```

## Runtime State Inventory

**Not applicable** — this is a greenfield additive feature (new fields, new subcollection, new rule
block). No rename/refactor/migration is involved; nothing existing is renamed or moved. Every new field
(`roleAssignmentsByEmailLower`/`roleIdsByEmailLower` on `RehearseAccessDoc`, `unconfirmedOnly` on
`RecipientSelection`/`RecipientSelector`) is additive-optional, matching this codebase's established
no-migration convention for schema growth (see `Service.stageLayoutAutoSeeded`, `Service.messaging`,
etc. — all optional fields absent on pre-existing docs, never backfilled).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Two different `Person` records can share the same email (accepted pre-existing risk, not introduced by this phase) — confirming via email-keyed identity inherits this, not new | Stable Assignment Identity | Low — if wrong (emails are actually enforced-unique at the roster layer, unverified in this pass), the collision concern is moot and can be dropped from the plan without any design change |
| A2 | Firestore rules language's `hasAny()` against a list-of-maps works as sketched in the security-rule draft above; the flat `roleIdsByEmailLower: Record<emailLower, string[]>` sibling field is offered as the safer fallback specifically because map-list matching in rules is unverified in this research pass (no rules-emulator run was performed) | Volunteer Scoped-Write Security | Medium — if the map-list check doesn't behave as drafted, the plan must use the flat-array field (`roleIdsByEmailLower`) for the rules check, which this research already recommends as the primary approach for the rules layer regardless — so the fallback IS the primary recommendation, minimizing actual risk |

**A2 resolution guidance:** ship `roleIdsByEmailLower: Record<string, string[]>` (role ids only) as the
field the RULES check reads, and `roleAssignmentsByEmailLower: Record<string, {roleId,roleName}[]>` (or
just reuse the existing `rolesByEmailLower` names array with a parallel ids array) as the field the
CLIENT reads for rendering. Two flat fields, zero rules-language risk, zero ambiguity — this is the
resolved recommendation, not an open question for the planner.

## Open Questions

1. **Exact UI surface for the "I've got it" control on `ScheduleServiceCard.vue`**
   - What we know: the whole card is currently one `<router-link>` (`ScheduleServiceCard.vue:2-8`);
     nesting an interactive confirm button inside an `<a>`/router-link is invalid HTML and an
     accessibility hazard.
   - What's unclear: whether the confirm control moves to a restructured card (link wraps only the
     title/date, confirm button sits outside it) or lives exclusively in `VolunteerServiceView.vue`'s
     tri-tab shell (which has no such nesting problem) with `ScheduleServiceCard` staying read-only.
   - Recommendation: this is exactly the "Claude's Discretion" UI-treatment item CONTEXT.md already
     flags — resolve it in the plan/UI-SPEC pass, not here. Data-model-wise, either location reads the
     same `roleAssignmentsByEmailLower`/confirmations data, so this doesn't block planning the data
     layer.

## Environment Availability

Skipped — no external tool/service dependency beyond the Firebase stack already in continuous use by
every other phase in this project (Firestore, already provisioned; Firebase emulator, already the
project's standard test harness per CLAUDE.md).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (app suite) + `firebase emulators:exec` (rules suite) — both already configured |
| Config file | `vite.config.ts` (app), `vitest.rules.config.ts` (rules) |
| Quick run command | `npx vitest run src/utils/rehearseAccess.test.ts src/utils/__tests__/serviceRoles.test.ts` |
| Full suite command | `npx vitest run` (app) + `npm run test:rules` (rules — or `npx vitest run --config vitest.rules.config.ts` if an emulator is already running, per CLAUDE.md) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R410 | Volunteer confirms own assignment; doc created with status 'confirmed' | unit (pure store/util) + rules ALLOW | `npx vitest run src/rules.test.ts` (new confirmations describe block) | ❌ Wave 0 |
| R410 | Volunteer un-confirms (delete) | rules ALLOW | same file | ❌ Wave 0 |
| R411 | Planner's roster status chip reflects live confirmation change without reload | component test with a fake `onSnapshot` | `npx vitest run src/views/__tests__/ServiceEditorView*.test.ts` | ❌ Wave 0 (new describe block in existing file) |
| R412 | Relock flips stale confirmed → needsReconfirmation; unchanged keys untouched | unit test on the new `reconcileConfirmations` function | `npx vitest run src/stores/__tests__/services.test.ts` | ❌ Wave 0 (new describe block) |
| R413 | `unconfirmedOnly` selection filters out confirmed people, keeps needsReconfirmation/unconfirmed | unit test, both client + server ports | `npx vitest run src/utils/__tests__/messagingRecipients.test.ts` and `cd functions && npm test -- serviceRoles.test.ts` | ❌ Wave 0 (new test file/describe block; `src/utils/messagingRecipients.ts` currently has no dedicated test file — verify at plan time) |

### Sampling Rate
- **Per task commit:** the quick run command above (pure-function + rules-file targeted).
- **Per wave merge:** `npx vitest run` (full app suite) + `npm run test:rules` (or the running-emulator
  fallback per CLAUDE.md's documented port-conflict caveat).
- **Phase gate:** both full suites green, plus `npm run type-check` (per CLAUDE.md — `vue-tsc --build`,
  not the narrower `-p tsconfig.app.json` form) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/rules.test.ts` — add a `confirmations` subcollection describe block covering all 12 ALLOW/DENY
  cases in the Security Domain table above.
- [ ] `src/stores/__tests__/services.test.ts` — add coverage for the new relock reconciliation step
  (needs a fixture with a pre-existing `confirmed` doc whose `roleId` is removed from the next relock's
  resolved assignments).
- [ ] Verify whether `src/utils/messagingRecipients.ts` has an existing test file — grep found none
  during this research pass; if absent, Wave 0 must create one before adding `unconfirmedOnly` coverage
  (mirrors `src/utils/__tests__/serviceRoles.test.ts`'s existing convention for the sibling pure
  function).
- [ ] `functions/src/serviceRoles.test.ts` — add the server-side `unconfirmedOnly` mirror test.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | Firebase Auth email-link (existing `volunteerAuth.ts`/`signInWithEmailLink`) — unchanged by this phase, reused as-is |
| V3 Session Management | no | No new session concept; rides the existing Firebase Auth session |
| V4 Access Control | yes | New Firestore rules match block, `isAssignedVolunteer()`/role-ownership check — the entire Security Domain section above |
| V5 Input Validation | yes | `request.resource.data.roleId`/`emailLower`/`status` enum-checked in rules (`status in ['confirmed','needsReconfirmation']`); confirmation-doc-id format checked against the fields it carries |
| V6 Cryptography | no | No new cryptographic material — reuses existing Firebase Auth tokens |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Cross-tenant confirmation write (volunteer in org A writes into org B's service) | Tampering / Elevation of Privilege | `orgId` resolved exclusively from the path segment, never a client field (structural, matches every other org-scoped rule in this file) |
| Role-forgery (volunteer claims a role they don't hold) | Tampering | `roleId` membership checked against `rehearseAccess`'s already-editor-trusted `roleIdsByEmailLower`, via sibling `get()` — see A2 in Assumptions Log |
| Stale-projection replay (writing a confirmation after being unassigned, using a cached rule-pass) | Tampering | Firestore rules evaluate synchronously per-request against the CURRENT stored `rehearseAccess` doc — no caching window to exploit; a relock always runs the reconciliation before the volunteer's next legitimate read/write cycle |
| Recipient-list tampering (client declares `unconfirmedOnly` but supplies a forged pre-filtered id list to bypass it) | Tampering | Not applicable — the server never accepts a client-supplied id list at all; it re-resolves from scratch per the existing "Anti-Pattern 1" discipline in `sendQueuedMessageHandler` |

## Sources

### Primary (HIGH confidence — direct code/rules inspection, this repo)
- `src/types/service.ts` — `Service`/`ServiceSlot` shapes, `roleAssignmentOverrides`
- `src/utils/serviceRoles.ts` — `resolveServiceRoleAssignments`/`ResolvedRoleAssignment`
- `src/utils/rehearseAccess.ts` — `RehearseAccessDoc`, `buildRehearseAccess`
- `src/stores/services.ts` — `writeRehearseAccessDoc`, `markAsPlanned`, `reopenService`, `revokeRehearseAccessWithRetry`
- `src/stores/mySchedule.ts`, `src/views/MyScheduleView.vue`, `src/views/VolunteerServiceView.vue`, `src/components/ScheduleServiceCard.vue`
- `src/stores/volunteerAuth.ts`
- `src/views/ServiceEditorView.vue` (Roles tab, lines ~1404-1488, ~4143-4256)
- `src/utils/messagingRecipients.ts`, `src/components/MessageComposer.vue`
- `functions/src/serviceRoles.ts`, `functions/src/index.ts` (`QueueMessageRequest`, `RecipientSelector`, `sendQueuedMessageHandler`)
- `firestore.rules` (lines 1-475: helper functions, `services/{docId}`, `rehearseAccess/{serviceId}`, collection-group list block)
- `src/rules.test.ts` (existing ALLOW/DENY test structure/conventions)
- `.planning/research/SUMMARY.md` (milestone-level two-state confirmation model, Pitfall 7 "confirmation racing reassignment")
- `.planning/REQUIREMENTS.md` (R410-R413 exact wording)
- `.planning/phases/133-volunteer-responsibility-confirmation/133-CONTEXT.md` (locked decisions, research flags)
- `CLAUDE.md` (type-check/test-suite conventions, messaging kill-switch/Resend caveat context)

### Secondary / Tertiary
None — no web research was performed (no new libraries; all providers unavailable per `init.phase-op`
and unnecessary for this phase's pure internal-architecture scope).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, pure internal extension of code read directly this session.
- Architecture: HIGH — every recommendation is grounded in an already-shipped, directly-cited precedent
  in this exact codebase (rehearseAccess, lockSnapshots/messages subcollections, the client/server
  resolver hand-mirror convention).
- Pitfalls: HIGH for #1/#2/#3 (directly derived from this repo's own documented incidents — SEC-S-01,
  R377's security posture, the messaging kill-switch); MEDIUM for #4 (reasoned from the lock-gate rule,
  not empirically tested).
- Security rule syntax (map-list `hasAny()` matching, A2): MEDIUM — flagged explicitly as unverified;
  the resolved fallback (flat `roleIdsByEmailLower`) is the recommended PRIMARY approach specifically to
  avoid depending on the unverified syntax.

**Research date:** 2026-09-07
**Valid until:** 30 days (stable, no external dependency drift risk — the only staleness vector is this
codebase's own further evolution, e.g. if Phase 134's presence subcollection ships a rules helper worth
factoring out and sharing with this phase's confirmations block).
