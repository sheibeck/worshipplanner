# Phase 77: Church Deletion — Cascade Cleanup - Context

**Gathered:** 2026-08-22
**Status:** Ready for research → planning
**Mode:** Auto-generated (autonomous smart-discuss). Settled decisions below; the exact enumeration of org subcollections + Storage paths + the cascade/idempotency mechanism is deferred to research (§research_question) — a MISSED collection would leave orphaned tenant data, so it must be enumerated from the codebase, not guessed.

<domain>
## Phase Boundary

A super-admin permanently deletes a DEACTIVATED church — every Firestore document under
`organizations/{orgId}` (all subcollections), every cross-collection reference, and every Storage object
under `orgs/{orgId}/…` — with no orphan left behind, gated by a type-the-name confirmation and a STRIDE
threat model. Requirements R215–R221. Depends on Phase 76 (delete refused unless the org is deactivated).

</domain>

<decisions>
## Implementation Decisions

### Gating (R215, R216)
- New super-admin-gated callable `deleteOrganization({ orgId, confirmName })` in `orgProvisioning.ts` (or a
  new `orgDeletion.ts`) — `assertSuperAdminCaller` FIRST. Refuse with `failed-precondition` if the org's
  `active !== false` (must be deactivated first — deactivation is the first delete guardrail). Refuse with
  `invalid-argument` if `confirmName` doesn't match the org's stored `name` (server-side echo of the client
  type-to-confirm). The client NEVER bulk-deletes `organizations/*`, subcollections, `orgNames/*`, or
  `inviteLookup/*` directly.

### Cascade order (must read cross-ref inputs BEFORE the recursive delete removes them)
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

### Idempotency / resumability (R221)
- Every step tolerates already-deleted state; a retry after an interruption completes without error and
  without cross-tenant damage (all writes are scoped to this orgId + its members' own `orgIds` arrayRemove).
  `recursiveDelete` and `deleteFiles` are naturally idempotent; arrayRemove is idempotent.

### Defense-in-depth rules (R216)
- `firestore.rules`: DENY direct CLIENT delete of `organizations/{orgId}` (and ensure no client path can
  delete its subcollections/registry) — deletion is Admin-SDK-only. NOTE: the Phase-76 `preservesLifecycleFields`
  guard short-circuits to `true` on delete (`request.resource == null`), so a client `delete` of an org is
  currently still allowed for an editor — CLOSE that here with an explicit delete DENY, proven by an emulator
  test (editor AND non-super-admin client delete of `organizations/{orgId}` is denied).

### Client (R220)
- Delete control on each Organizations row, ENABLED only for a deactivated org (mirrors the Phase 76
  Deactivate/Reactivate control's state). Opens a confirm dialog that: echoes what will be destroyed
  (org name + member/service counts if readily available), requires typing the exact church name to enable
  the destructive button, and is clearly labeled irreversible. Calls `deleteOrganization`; on success removes
  the row and shows the returned summary; maps errors (not-deactivated, name-mismatch, permission) to clear
  copy via the existing `friendlyCallableError` pattern.

### Claude's Discretion
- New `orgDeletion.ts` module vs. extending `orgProvisioning.ts`; exact summary shape; whether to show
  pre-delete counts in the dialog (nice-to-have) vs. just the name-echo.

</decisions>

<research_question>
## OPEN — resolve in RESEARCH.md before planning

1. **Enumerate EVERY subcollection under `organizations/{orgId}`** by grepping the codebase (client + functions
   + rules) for `organizations/{orgId}/…` / `collection(... 'organizations', orgId, '…')` paths. The known
   set is members, invites, services, songs, slideGroups, shareTokens (+ any quarter/schedule/roster
   collections, sent-message history, quarter-share tokens, and anything else). `recursiveDelete(orgRef)`
   deletes the doc + ALL nested subcollections regardless — CONFIRM that, so the enumeration is for
   verification/tests, not for hand-deleting each. Flag any org-related data stored OUTSIDE the
   `organizations/{orgId}` tree that a recursive delete would miss (e.g. top-level collections keyed by orgId).
2. **Cross-collection references** — confirm exactly where `orgNames` (keyed by normalized name → `{orgId}`),
   `inviteLookup` (keyed by email → `{orgId, role}`), and `users/{uid}.orgIds` live and how to find all
   entries for a given org (a query on `inviteLookup` where `orgId ==`; the `orgNames` id via
   `normalizeOrgName(name)` with an orgId-match guard). Any OTHER top-level doc that references an orgId?
3. **Storage** — confirm the FULL set of Storage path prefixes under `orgs/{orgId}/` actually written by the
   app + functions + render-service (media, backgrounds, pptx-imports, rendered, and any others). Confirm the
   Admin SDK `bucket.deleteFiles({ prefix: 'orgs/${orgId}/' })` (or `getStorage().bucket().deleteFiles`)
   deletes them all, and how it paginates / whether a partial failure is safely retriable.
4. **`recursiveDelete` availability** in this functions runtime (firebase-admin v13 `getFirestore().recursiveDelete`)
   — confirm and note the bulk-writer semantics / limits.
5. **firestore.rules delete DENY** — the exact rule change to deny client deletes of `organizations/{orgId}`
   (and confirm subcollections aren't client-deletable in bulk), given the Phase-76 lifecycle-field guard is
   delete-permissive; plus the emulator test shape.
6. Idempotency/ordering pitfalls and a **Validation Architecture** section (so a VALIDATION.md can derive):
   unit tests (mocked Admin SDK) proving the cascade order + arrayRemove-not-overwrite + not-deactivated
   refusal + name-mismatch refusal + idempotent re-run; emulator test for the client-delete DENY.

Deliverable: an implementation-ready cascade design (exact step list, the deleteOrganization handler shape,
the Storage delete call, the rules DENY, and the test matrix), grounded in the actual codebase paths.
</research_question>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/src/orgProvisioning.ts` — `assertSuperAdminCaller`, the super-admin-gated callable pattern,
  `normalizeOrgName`, the `orgNames`/`inviteLookup`/members write shapes (from onboarding/assign).
- `functions/src/orgMembershipClaims.ts` — the members/claim model (a deleted member's claim recompute is
  moot since the whole org is gone, but `users/{uid}.orgIds` arrayRemove keeps their OTHER orgs' access).
- `firestore.rules` — the `organizations/{orgId}` block (Phase-76 lifecycle guard) to add a delete DENY to.
- `storage.rules` / render-service — the `orgs/{orgId}/…` Storage path structure.
- `src/components/admin/OrganizationsTab.vue` — the row controls + `friendlyCallableError`; a prior
  confirm-dialog pattern exists (`CleanupEnableConfirmDialog` from v1.9 Phase 71 — a type-to-confirm/echo
  precedent worth mirroring).
- v1.8 Storage-retention sweeps (`cleanupExpiredMedia` etc.) — precedent for Admin-SDK Storage deletes.

### Established Patterns
- Super-admin-gated callables re-verify the caller; destructive server actions are Admin-SDK-only; rules
  changes ship UNDEPLOYED with genuine emulator DENY tests; the client type-to-confirm dialog echoes the
  destructive scope (Phase 71 precedent).

### Integration Points
- Server: new callable (deleteOrganization) + Storage delete + `firestore.rules` delete DENY. Client: the
  Organizations row delete control + confirm dialog.

</code_context>

<specifics>
## Specific Ideas

Owner's words: "let a super user delete an organization and everything associated with it… extra
precautions and confirmations… cleanup any relationships in the db, all of the media, etc." Deactivate-first
is the guardrail; deletion is irreversible.

</specifics>

<deferred>
## Deferred Ideas

- Exporting/downloading the org's data before deletion; a soft-trash restore window; scheduled auto-purge of
  long-deactivated orgs — all future scope (per REQUIREMENTS Future/Out-of-scope).

</deferred>
