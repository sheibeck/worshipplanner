# Phase 41: Sharing Correctness - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous). Grey-area recommendations were auto-accepted under STATE.md's
★★ Standing Autonomy Grant (v1.5, 2026-08-06): *"Proceed through every v1.5 phase without pausing for
approval on ordinary implementation decisions."* Every choice is disclosed below rather than approved
interactively.

<domain>
## Phase Boundary

A service's share link is created **once** and never changes, and it always shows the current plan and
current role overrides without anyone re-pressing Share.

**In scope:** the share-token identity/storage rework (R076), the auto-refresh of an already-shared
service's public payload (R077), backfill/adoption so links already circulated to a congregation keep
working (R078), the `firestore.rules` changes those require, and emulator-backed ALLOW-case tests for
them.

**Out of scope:** quarter sharing (`quarterShares` / `quarters.ts::finalizeAndShare`) — it is the
pattern being mirrored, not a thing being changed; any redesign of `ShareView.vue`'s presentation; the
`firebase deploy` itself, which remains the owner's step.

</domain>

<decisions>
## Implementation Decisions

### Share-link document shape and read path

- The persistent token lives in a new **`serviceShareLinks/{serviceId}`** document — NOT on the service
  document. PROJECT.md's original "persist the token on the service doc" decision is superseded by
  R076: a bare `{shareToken}` write matches none of R036's three draft-lock carve-outs
  (`services.ts:197-203`, `firestore.rules:64-84`) and would be rejected on any `planned` or `exported`
  service, which is the common sharing case.
- **`shareTokens/{token}` survives and stays the public read surface.** `ShareView.vue` continues to
  resolve `/share/:token` → `getDoc(shareTokens/{token})`, which is public-readable and needs no auth.
  The split of responsibility is explicit: `serviceShareLinks/{serviceId}` is the org-scoped **index**
  that makes the token stable; `shareTokens/{token}` is the **payload** that gets refreshed in place.
  Rejected: making `serviceShareLinks` public-readable and having ShareView query by token — that needs
  a public *list* rule plus a composite index, for no gain.
- `serviceShareLinks/{serviceId}` holds **token + provenance only**: `token`, `orgId`, `serviceId`,
  `createdAt`, `updatedAt`. No `serviceSnapshot` copy — exactly one snapshot copy per surface avoids a
  third place for the data to diverge.
- `serviceShareLinks` is **org-scoped, no public read**. It is an internal index and is never linked to
  anyone.

### Refresh trigger and loop safety

- Refresh is **client-side**, in the existing service write path (`services.ts::updateService` plus the
  two role-override actions), guarded on a cached `hasShareLink` lookup so an unshared service pays
  nothing per write. Rejected: a Firestore `onWrite` Cloud Function — it is deploy-gated, and under the
  standing grant no deploy happens during this run, so R077 would ship structurally unverifiable.
- The refresh writes **only** to `shareTokens/{token}` and `serviceShares/{shareId}` and **never back
  to `services/{docId}`** — this is ROADMAP criterion 2 and the `[PITFALL]` note on R077. A test must
  assert the absence of a write-back, not merely the presence of the two forward writes.
- **Role-override changes refresh too.** R077 names "the current role overrides" explicitly, and
  `setRoleOverride` / `clearRoleOverride` write to the service doc through a different path than
  `updateService`, so both need the hook.
- A failed refresh is **soft-fail + logged**, mirroring the existing WR-06 pattern already used for the
  memorable-URL `serviceShares` write in `createShareToken` (`services.ts:433-438`). A share problem
  must never fail the user's save.

### Backfill and already-circulated links (R078)

- Adoption finds the existing token by querying `shareTokens` where `serviceId == {id}`, ordered by
  `createdAt` descending, taking the first — "the most recent existing token" per ROADMAP criterion 4.
  `shareTokens` already has `allow read: if true`, which covers the list operation, so no rules change
  is needed for the query itself.
- The backfill runs **lazily**, via an `ensureShareLink(serviceId)` adopt-or-create helper invoked on
  the next share or next refresh. No batch admin script — that would be another owner-gated step, and
  the standing grant already limits how many of those this milestone can absorb.
- A service with **zero** existing `shareTokens` documents mints exactly one and records it in
  `serviceShareLinks/{serviceId}` — this is the ordinary first-share path.
- On adoption, the adopted token's payload is **refreshed in place immediately**, so a link already
  emailed to a congregation starts showing current data at once rather than waiting for the next edit.

### Rules change and emulator proof

- `shareTokens`' `allow update: if false` is loosened to **mirror `serviceShares`' existing rule**:
  `allow update: if isOrgEditor(resource.data.orgId) && request.resource.data.orgId == resource.data.orgId`
  — org-scoped, with `orgId` immutable so a share can never be reassigned to another org. Rejected:
  `isSignedIn()`, which would reintroduce the exact CR-01 cross-org-overwrite bug already fixed for
  `quarterShares` and `serviceShares` (`firestore.rules:238-269`).
- `serviceShareLinks/{serviceId}` gets org-editor-scoped read/create/update/delete with `orgId`
  immutable on update, and **no** public read.
- ALLOW-case tests live in **`src/rules.test.ts`** and run against the real emulator via
  `npm run test:rules`. Per ROADMAP criterion 3 and CLAUDE.md's non-negotiable rules-testing mandate,
  the phase must ship a **passing allow case that actually executes** — a deny-only suite is what let a
  deny-everyone `storage.rules` reach production for a whole milestone. Both allow and deny cases are
  required.
- Deploying is the **owner's step**. The phase ships built, tested, and undeployed, and hands off the
  exact command: `firebase deploy --only firestore:rules`.

### Claude's Discretion

- Exact helper names, file placement of the new store actions, and test file organization.
- Whether `ensureShareLink` lives in `services.ts` or a dedicated `src/stores/` / `src/utils/` module —
  choose whichever keeps `services.ts` under control, since it is already large.
- The snapshot-building code is currently inline in `createShareToken`; extracting it to a shared pure
  function so create and refresh cannot drift is at Claude's discretion but strongly indicated.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/stores/services.ts::createShareToken` (lines 353-441) — the whole current implementation:
  random 36-char hex token, BPM resolution from the song store, the PII-guarded `roleAssignments`
  build, the `shareTokens/{token}` write, and the soft-fail memorable-URL `serviceShares` write.
- `src/stores/quarters.ts::finalizeAndShare` — the pattern `createShareToken` was copied from,
  including the `nameById` PII guard and the slug claim/derive flow. It is the reference for
  overwrite-in-place behaviour (`quarterShares` is already overwritten on every finalize).
- `deriveSlug` / `claimSlug` — already used by `createShareToken` for the memorable URL.
- `resolveServiceRoleAssignments` (`src/utils/serviceRoles.ts`) — resolves effective role assignments
  including overrides; already covered by `src/utils/__tests__/serviceRoles.test.ts`.
- `src/rules.test.ts` — the emulator-backed rules suite (excluded from the default `vitest run`; see
  CLAUDE.md).

### Established Patterns

- **PII guard (D-04/D-24):** resolve `personId → name` through a `Map` and store `personNames` only —
  never the raw `Person` object (no email/phone/pcPersonId). Preserving this through the rework is
  ROADMAP criterion 5.
- **Soft-fail secondary writes (WR-06):** the primary share write succeeds first; the memorable-URL
  write is wrapped in try/catch, logged with `console.error`, and swallowed.
- **Org-scoped rules with immutable orgId (CR-01):** `quarterShares` and `serviceShares` both use
  `isOrgEditor(resource.data.orgId)` on update plus an equality check that `orgId` cannot change. This
  is the shape the loosened `shareTokens` update rule must copy.
- **R036 draft-lock:** `services.ts:197-203` + `firestore.rules:64-84` restrict writes to
  `planned`/`exported` services to three named carve-outs. This is *why* the token cannot live on the
  service document.
- Error logging convention: `console.error('[moduleName] operation:', err)`.

### Integration Points

- `src/views/ServiceEditorView.vue:3509-3519` (`onShare`) and
  `src/components/ServiceCard.vue:209-219` (`onShare`) — both call
  `serviceStore.createShareToken(service, orgId)` and build `${origin}/share/${token}`. Both must keep
  working unchanged from the caller's point of view (stable token in, same URL shape out).
- `src/views/ShareView.vue:111-130` — public read path, `getDoc(doc(db, 'shareTokens', token))` into a
  `serviceSnapshot` ref. Reads `roleAssignments` defensively (`?.length`) for legacy shares.
- `firestore.rules:217-225` (`shareTokens`) — the `allow update: if false` to loosen.
- `firestore.rules:261-269` (`serviceShares`) — the rule to mirror.
- Existing tests that will move with the behaviour: `src/stores/__tests__/services.test.ts`,
  `src/components/__tests__/ServiceCard.test.ts`, `src/views/__tests__/ShareView.test.ts`,
  `src/views/__tests__/ServiceEditorView.test.ts`.

</code_context>

<specifics>
## Specific Ideas

- One root cause explains both reported symptoms ("the link changed" and "my role overrides aren't
  showing"): `createShareToken()` minted a fresh token on **every** call and froze the snapshot at
  share time. Both fixes are the same rework — do not treat them as two independent bugs.
- ROADMAP criterion 1 names the collection literally: `serviceShareLinks/{serviceId}`. Use that name.
- The `firestore.rules` file in this repo contains lines beginning `\ ` where a comment marker was
  mangled (e.g. `firestore.rules:216`, `227`, `238`, `254`, `271`). Do not "fix" these as part of this
  phase unless they actually break the parse — an unrelated rules-file churn during a security phase is
  how regressions hide.

</specifics>

<deferred>
## Deferred Ideas

- Migrating quarter sharing (`quarterShares`) to the same persistent-link model — the same
  mint-fresh-every-time question may apply there, but no v1.5 requirement covers it. Note it; do not
  build it.
- Revoking / rotating a share link on purpose (an explicit "generate a new link" affordance). Making
  the token permanent makes rotation the *only* way to un-share, but no requirement asks for it in
  v1.5.
- Cleaning up the now-orphaned surplus `shareTokens` documents left behind by the old mint-fresh
  behaviour. Adoption keeps the most recent one working; the older ones stay readable and harmless.
  Deleting them is a data-hygiene task, not a correctness one.

</deferred>
