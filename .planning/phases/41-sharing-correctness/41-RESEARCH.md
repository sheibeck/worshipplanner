# Phase 41: Sharing Correctness - Research

**Researched:** 2026-08-07
**Domain:** Firestore data modeling + security rules for a persistent, auto-refreshing public share link (Firebase JS SDK, client-only Vue/Pinia SPA — no custom backend)
**Confidence:** HIGH — every load-bearing claim below is grounded in a direct read of this repo's own source (`services.ts`, `firestore.rules`, `quarters.ts`, `rules.test.ts`, `ShareView.vue`) plus two WebSearch-verified Firestore index facts. No unverified third-party API is involved.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Share-link document shape and read path**
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

**Refresh trigger and loop safety**
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

**Backfill and already-circulated links (R078)**
- Adoption finds the existing token by querying `shareTokens` where `serviceId == {id}`, ordered by
  `createdAt` descending, taking the first — "the most recent existing token" per ROADMAP criterion 4.
  `shareTokens` already has `allow read: if true`, which covers the list operation, so no rules change
  is needed for the query itself.
- The backfill runs **lazily**, via an `ensureShareLink(serviceId)` adopt-or-create helper invoked on
  the next share or next refresh. No batch admin script.
- A service with **zero** existing `shareTokens` documents mints exactly one and records it in
  `serviceShareLinks/{serviceId}` — this is the ordinary first-share path.
- On adoption, the adopted token's payload is **refreshed in place immediately**, so a link already
  emailed to a congregation starts showing current data at once rather than waiting for the next edit.

**Rules change and emulator proof**
- `shareTokens`' `allow update: if false` is loosened to **mirror `serviceShares`' existing rule**:
  `allow update: if isOrgEditor(resource.data.orgId) && request.resource.data.orgId == resource.data.orgId`
  — org-scoped, with `orgId` immutable so a share can never be reassigned to another org. Rejected:
  `isSignedIn()`, which would reintroduce the exact CR-01 cross-org-overwrite bug already fixed for
  `quarterShares` and `serviceShares`.
- `serviceShareLinks/{serviceId}` gets org-editor-scoped read/create/update/delete with `orgId`
  immutable on update, and **no** public read.
- ALLOW-case tests live in **`src/rules.test.ts`** and run against the real emulator via
  `npm run test:rules`. Both allow and deny cases are required.
- Deploying is the **owner's step**: `firebase deploy --only firestore:rules`.

### Claude's Discretion
- Exact helper names, file placement of the new store actions, and test file organization.
- Whether `ensureShareLink` lives in `services.ts` or a dedicated `src/stores/` / `src/utils/` module —
  choose whichever keeps `services.ts` under control, since it is already large.
- The snapshot-building code is currently inline in `createShareToken`; extracting it to a shared pure
  function so create and refresh cannot drift is at Claude's discretion but strongly indicated.

### Deferred Ideas (OUT OF SCOPE)
- Migrating quarter sharing (`quarterShares` / `quarters.ts::finalizeAndShare`) to the same
  persistent-link model — no v1.5 requirement covers it.
- Revoking / rotating a share link on purpose (an explicit "generate a new link" affordance).
- Cleaning up the now-orphaned surplus `shareTokens` documents left behind by the old mint-fresh
  behaviour — a data-hygiene task, not a correctness one.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R076 | Share link created once, token never changes across repeat shares/edits/overrides | § Architecture Patterns (Pattern 1: `ensureShareLink`), § R036 Carve-Out Analysis proves why the token cannot live on the service doc |
| R077 | Shared service always shows current plan + current role overrides, no re-share needed, no write-back loop | § Architecture Patterns (Pattern 2: refresh chokepoints), § Loop Safety Proof, § Common Pitfalls (write-back loop) |
| R078 | Already-circulated links (from old mint-fresh behavior) keep working; backfill adopts most recent token | § Architecture Patterns (Pattern 1, adoption branch), § Code Examples (adoption query without composite index) |
</phase_requirements>

## Summary

The current `createShareToken()` (`src/stores/services.ts:353-441`) mints a brand-new random token and
writes a frozen `serviceSnapshot` on **every** call — so re-sharing produces a new URL (breaking already
circulated links) and editing after sharing never updates the public view (the snapshot is frozen at
share time). Both reported symptoms are the same root cause. The fix separates two concerns that are
currently conflated in one document: **identity** (which token belongs to this service — must be stable)
and **payload** (what the public sees — must be fresh). A new org-scoped `serviceShareLinks/{serviceId}`
document owns identity; the existing public `shareTokens/{token}` document keeps owning payload, but its
`allow update: if false` rule must be loosened to let the app refresh it in place.

The token cannot be persisted on `services/{docId}` itself — that document is protected by the R036
draft-lock rule, whose three carve-outs (ordinary-write-while-draft, PC export, reopen) do not include an
arbitrary `{shareToken}` field, so a bare token write would be **rejected by Firestore on any `planned` or
`exported` service**, which is precisely when most sharing happens. This is not a stylistic preference —
it is independently provable by reading `services.ts:197-203` and `firestore.rules:100-120` together (see
below), and it is why R076's note in REQUIREMENTS.md explicitly supersedes PROJECT.md's original wording.

Refresh must be triggered client-side (no Cloud Function — deploy-gated, unverifiable this run) from the
one true write funnel to `services/{docId}`: `updateService()`. Two role-override actions
(`setRoleOverride`/`clearRoleOverride`) bypass `updateService` with their own `updateDoc` calls and need
their own hook. Grep confirms these are the **only** paths that mutate `services/{docId}` content besides
`markAsPlanned`/`reopenService` (status-only, excluded per locked decision — `ShareView.vue` never even
renders `status`) and `deleteService`/`createService` (not applicable). Loop safety is provable, not just
assumed: the store's only `onSnapshot` listener is on `organizations/{orgId}/services`
(`services.ts:84-96`); `shareTokens` and `serviceShareLinks` are separate top-level collections with zero
listeners anywhere in the app, so a write to either can never re-enter `ServiceEditorView.vue`'s
remote-merge watcher or autosave loop.

For R078, adopting "the most recent existing token" via `shareTokens.where('serviceId','==',id)` should
**avoid `orderBy('createdAt','desc')`** in the query itself. An equality filter plus an `orderBy` on a
different field requires a Firestore **composite index** in production (confirmed via WebSearch against
Firestore's own indexing docs), and this project currently has **zero** composite indexes
(`firestore.indexes.json` is `{"indexes": [], "fieldOverrides": []}`). The Firestore **emulator does not
enforce composite-index requirements** (confirmed via WebSearch), so a test suite using `orderBy` would
pass locally and then throw `FAILED_PRECONDITION` in production the first time a service has 2+ legacy
tokens — exactly the case R078 exists to fix. The safe alternative — `where('serviceId','==',id)` alone
(single-field, auto-indexed, no composite index needed) followed by an in-memory sort by `createdAt` — is
both correct and avoids adding a second owner-gated deploy artifact (`firestore:indexes`) beyond the one
already scoped for this phase (`firestore:rules`).

**Primary recommendation:** Add `serviceShareLinks/{serviceId}` (org-editor-scoped CRUD, `orgId`
immutable, no public read) as the stable-token index; loosen `shareTokens`' update rule to mirror
`serviceShares`' existing org-scoped pattern; extract the current `createShareToken` snapshot-building
logic into a shared pure function so a new `ensureShareLink(service, orgId)` helper can do
adopt-or-create-then-refresh-in-place, called from the two `onShare()` UI handlers (unchanged from the
caller's point of view) and from `updateService`/`setRoleOverride`/`clearRoleOverride` behind a
per-session cached "has this service been shared" check; query `shareTokens` with an equality-only filter
and sort client-side to avoid a composite-index dependency.

## Architectural Responsibility Map

This app is a client-only Vue/Pinia SPA talking directly to Firestore via the Firebase JS SDK — there is
no custom API/backend server in this data path. Firestore Security Rules are the authorization boundary
that would normally live in an API tier.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Share-link identity (stable token per service) | Database / Storage (`serviceShareLinks` doc) | Browser / Client (`ensureShareLink` orchestrates read-then-write) | The token's stability is a persistence guarantee; the SPA has no server process to own it instead |
| Share-link authorization (who can create/refresh/read) | Database / Storage (`firestore.rules`) | — | Firestore Security Rules ARE the access-control layer for a client-direct-to-Firestore app; there is no API middleware to duplicate this in |
| Refresh trigger (detecting "the plan changed") | Browser / Client (`services.ts` write funnel) | — | No server-side triggers are in scope this phase (Cloud Function rejected — deploy-gated); the client that already knows "a save just happened" does the work |
| Public payload rendering | Browser / Client (`ShareView.vue`) | — | Unauthenticated read of `shareTokens/{token}`, rendered directly; unchanged by this phase |
| PII guard (names-only snapshot) | Browser / Client (snapshot-building pure function) | — | Resolution of `personId → name` happens client-side before any Firestore write, so the raw `Person` object never crosses the wire to a public document |

## Package Legitimacy Audit

**Not applicable — no new packages.** This phase reuses `firebase`/`firebase/firestore` (already
installed, already used by every other store in `src/stores/`) and `@firebase/rules-unit-testing`
(already installed, already used by `src/rules.test.ts`). No `npm install` step is part of this phase.

## R036 Carve-Out Analysis (why the token cannot live on `services/{docId}`)

Read together, `services.ts:190-203` (client-side guard) and `firestore.rules:93-120` (server-side rule,
the actual enforcement) define exactly three shapes that pass on a non-draft service:

| # | Carve-out | Client guard (`services.ts`) | Server rule (`firestore.rules`) | Would a bare `{shareToken: '...'}` write match? |
|---|-----------|-------------------------------|----------------------------------|--------------------------------------------------|
| 1 | Ordinary edit while draft | `assertWritable`: `stored === 'draft'` → any fields allowed | `storedStatus() == 'draft'` | Only if the service is still a draft — **not** the common sharing case (people share planned/exported services) |
| 2 | Planning Center export | `isExportWrite`: `data.status==='exported'` and keys ⊆ `{status,pcExportedAt,pcPlanId}` | `storedStatus()=='planned' && request.resource.data.status=='exported' && keys().hasOnly([...]) && keys().hasAll(['pcExportedAt'])` | No — requires `status` to be present and transitioning to `'exported'`, not merely adding an unrelated field |
| 3 | Reopen | `isReopenWrite`: `data.status==='draft'` and `keys.length===1 && keys[0]==='status'` | `request.resource.data.status=='draft' && keys().hasOnly(['status','updatedAt'])` | No — requires status to flip to `'draft'` and nothing else in the diff |

A write of only `{ shareToken: 'abc123' }` to `services/{docId}` on a `planned` or `exported` service
matches **none** of the three — `firestore.rules`'s `allow update` for `/services/{docId}` would deny it
outright (server-side; the client guard would also throw `ServiceLockedError` first). This is
`[VERIFIED: codebase — services.ts:197-203, firestore.rules:93-120]`, not an assumption, and is the
concrete justification R076 gives for the `serviceShareLinks/{serviceId}` document instead.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────┐        ┌──────────────────────────────────┐
│  ServiceEditorView.vue /     │        │  ShareView.vue (public, no auth)  │
│  ServiceCard.vue             │        │  /share/:token                    │
│  onShare() [UNCHANGED SHAPE] │        │  getDoc(shareTokens/{token})      │
└──────────────┬────────────────┘      └──────────────▲─────────────────────┘
               │ createShareToken(service, orgId)      │ reads payload
               ▼                                        │
┌───────────────────────────────────────────────────────┴──────────┐
│  services.ts :: ensureShareLink(service, orgId)  [NEW]            │
│    1. getDoc(serviceShareLinks/{serviceId})                       │
│       ├─ exists → token = link.token         (R076: stable)       │
│       └─ absent → adopt-or-create:                                │
│            query shareTokens WHERE serviceId==id (no orderBy)     │
│            ├─ hits → token = most-recent-by-createdAt (R078)      │
│            └─ none → token = mint new random 36-hex                │
│            setDoc(serviceShareLinks/{serviceId}, {token,...})     │
│    2. buildServiceSnapshot(service) [extracted pure fn]           │
│    3. setDoc(shareTokens/{token}, {...snapshot})   [in place]     │
│    4. setDoc(serviceShares/{slug}__service-{date}, {...}) soft-fail│
└───────────────────────────────┬────────────────────────────────────┘
                                 │ same helper, called from:
        ┌────────────────────────┼─────────────────────────┐
        ▼                        ▼                          ▼
┌───────────────┐      ┌──────────────────┐      ┌────────────────────┐
│ updateService()│      │ setRoleOverride() │      │ clearRoleOverride() │
│ (autosave, drag│      │ (Roles tab)        │      │ (Roles tab)          │
│  reorder, song │      └──────────────────┘      └────────────────────┘
│  assign/clear) │
└───────┬─────────┘
        │ writes ONLY to services/{docId} — the funnel refresh hangs off, never writes back INTO
        ▼
┌───────────────────────┐
│ organizations/{orgId}/  │◄── onSnapshot listener (services.ts:84-96) feeds
│ services/{docId}        │    ServiceEditorView's remote-merge watcher & autosave —
└───────────────────────┘    NOTHING subscribes to shareTokens/serviceShareLinks,
                              so the refresh writes above cannot loop back here.
```

### Recommended Project Structure

No new files are structurally required — this is a targeted rework of existing files. Recommended
(Claude's discretion, per CONTEXT.md):

```
src/stores/services.ts        # ensureShareLink(), buildServiceSnapshot() (extracted), the three
                               # refresh-hook call sites, hasShareLink session cache
firestore.rules               # loosened shareTokens update rule + new serviceShareLinks block
src/rules.test.ts             # new describe blocks: serviceShareLinks CRUD, shareTokens update allow-case
src/stores/__tests__/services.test.ts   # ensureShareLink unit tests (stability, adoption, no write-back)
```

### Pattern 1: `ensureShareLink` — adopt-or-create, refresh-in-place

**What:** A single helper that resolves "the" token for a service (creating or adopting it exactly once)
and then always refreshes the public payload in place, whether this is the first share or the 500th.
**When to use:** Called from both `onShare()` UI handlers (unchanged external signature — still returns
a token string) AND from the three write-path hooks (`updateService`, `setRoleOverride`,
`clearRoleOverride`), gated by the cached `hasShareLink` check so unshared services pay nothing.

```typescript
// Illustrative shape — NOT copy-paste-ready, names/placement are Claude's discretion.
// Sources this pattern is built from: services.ts:353-441 (createShareToken, to be reworked),
// quarters.ts:397-484 (finalizeAndShare, the overwrite-in-place precedent already used for
// quarterShares/serviceShares).

const shareLinkCache = new Map<string, boolean>() // serviceId -> "has a serviceShareLinks doc"

async function ensureShareLink(service: Service, orgIdValue: string): Promise<string> {
  const linkRef = doc(db, 'serviceShareLinks', service.id)
  const linkSnap = await getDoc(linkRef)
  let token: string

  if (linkSnap.exists()) {
    token = linkSnap.data().token as string
  } else {
    // R078 adoption: equality-only filter, NO orderBy — avoids a composite-index
    // dependency in production (confirmed: Firestore requires a composite index for
    // equality-filter + orderBy-on-a-different-field; the emulator does not enforce
    // this, so an orderBy here would pass tests and then throw FAILED_PRECONDITION
    // in prod on the very services R078 exists to fix).
    const existing = await getDocs(
      query(collection(db, 'shareTokens'), where('serviceId', '==', service.id)),
    )
    if (!existing.empty) {
      // Sort client-side by createdAt descending; take the most recent.
      const sorted = existing.docs.sort(
        (a, b) => (b.data().createdAt?.seconds ?? 0) - (a.data().createdAt?.seconds ?? 0),
      )
      token = sorted[0]!.id
    } else {
      const array = new Uint8Array(18)
      crypto.getRandomValues(array)
      token = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
    }
    await setDoc(linkRef, {
      token,
      orgId: orgIdValue,
      serviceId: service.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  await refreshSharePayload(service, orgIdValue, token) // extracted from createShareToken's body
  shareLinkCache.set(service.id, true)
  return token
}
```

### Pattern 2: Refresh chokepoints — exhaustive, grep-verified

`grep -n "updateDoc(doc(db, 'organizations', orgId.value, 'services'" src/stores/services.ts` returns
exactly 5 call sites. Only 3 are in scope per the locked decision (`ShareView.vue` never renders
`status`, so status-only transitions correctly stay excluded):

| Line | Function | Refresh hook? | Why |
|------|----------|---------------|-----|
| `services.ts:208` | `updateService()` | **YES** | The single funnel — also covers `assignSongToSlot`, `clearSongFromSlot`, autosave (`onSave` at `ServiceEditorView.vue:3664`), and slot reorder (`ServiceEditorView.vue:1950`) since all three call `updateService` |
| `services.ts:230` | `markAsPlanned()` | No (locked decision) | Status-only; `ShareView.vue` doesn't render `status` |
| `services.ts:249` | `reopenService()` | No (locked decision) | Status-only; same reasoning |
| `services.ts:332` | `setRoleOverride()` | **YES** | Bypasses `updateService` with its own `updateDoc` — needs its own hook |
| `services.ts:347` | `clearRoleOverride()` | **YES** | Same as above |

`deleteService()` (`services.ts:261`) uses `deleteDoc`, not `updateDoc` — not a refresh trigger. It also
does **not** currently revoke `shareTokens`/`serviceShareLinks` (unlike `quarters.ts`'s `deleteQuarter`,
which explicitly revokes its share docs). This is pre-existing behavior, out of scope for R076-078, and
noted as an Open Question below rather than silently left unaddressed.

Guard the refresh call in all three hook sites with the `shareLinkCache` check so an unshared service's
`updateService` call does not pay for a `getDoc` on every keystroke-triggered autosave:

```typescript
async function maybeRefreshShareLink(id: string): Promise<void> {
  const service = services.value.find((s) => s.id === id)
  if (!service || !orgId.value) return
  if (shareLinkCache.get(id) === false) return // known unshared this session — skip entirely
  try {
    const linkSnap = shareLinkCache.has(id) ? null : await getDoc(doc(db, 'serviceShareLinks', id))
    if (linkSnap && !linkSnap.exists()) {
      shareLinkCache.set(id, false)
      return
    }
    await ensureShareLink(service, orgId.value) // refresh-in-place path (link already exists)
  } catch (err) {
    // WR-06 soft-fail — a share refresh problem must never fail the user's save.
    console.error('[services] share-link refresh failed:', err)
  }
}
```

### Loop Safety Proof

`services.ts:84-96` shows the store's **only** `onSnapshot` subscription is
`collection(db, 'organizations', orgIdValue, 'services')`. `grep -rn "onSnapshot" src/stores/` and
`grep -rn "'shareTokens'\|'serviceShareLinks'" src/stores/` together confirm no store anywhere
subscribes to `shareTokens` or `serviceShareLinks`. `ServiceEditorView.vue`'s remote-merge watcher
(`watch(() => serviceStore.services, ...)`, `ServiceEditorView.vue:2224`) and its `useAutoSave` composable
both react exclusively to that one `services` array. A write to `shareTokens/{token}` or
`serviceShareLinks/{serviceId}` therefore has **no path** back into either watcher — the refresh functions
must simply never call `updateService`/`updateDoc` on `services/{docId}` themselves, which the design
above satisfies by construction (they only ever `doc(db, 'shareTokens', ...)`,
`doc(db, 'serviceShareLinks', ...)`, `doc(db, 'serviceShares', ...)`).
`[VERIFIED: codebase — services.ts:84-96, ServiceEditorView.vue:2224-2239]`

### Anti-Patterns to Avoid
- **`orderBy` in the adoption query:** requires a composite index that doesn't exist in this project and
  passes silently in the emulator while throwing `FAILED_PRECONDITION` in production. Use
  equality-only + client-side sort instead.
- **Awaiting the refresh inline and letting it throw:** would turn a share-link hiccup into a failed
  save. Every refresh call must be wrapped exactly like the existing `serviceShares` write in
  `createShareToken` (`services.ts:414-438`, try/catch + `console.error`, swallow).
- **Refreshing on `markAsPlanned`/`reopenService`:** not required (status isn't rendered by `ShareView`)
  and would widen the write-path surface for no observable benefit — resist the temptation to "just
  cover every write for consistency."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Org-scoped update authorization with immutable `orgId` | A new rule idiom | Copy `serviceShares`'/`quarterShares`' existing `isOrgEditor(resource.data.orgId) && request.resource.data.orgId == resource.data.orgId` pattern verbatim | Already reviewed and CR-01-hardened in this codebase; inventing a variant risks reintroducing the exact cross-org-overwrite bug that pattern was created to fix |
| "Most recent" selection without a composite index | A Cloud Function to pre-sort, or a denormalized `latestToken` field maintained elsewhere | Equality-only Firestore query + `Array.prototype.sort` on the returned docs (services realistically have at most a handful of legacy tokens) | No production-scale concern; adding infrastructure for a handful of documents is over-engineering the exact kind CONTEXT.md's "no batch admin script" decision already rejected |
| PII-safe snapshot resolution | A second name-resolution helper | `resolveServiceRoleAssignments` (`src/utils/serviceRoles.ts`) — already tested, already the source of the `roleAssignments` shape `ShareView.vue` renders | Re-deriving this logic risks drifting from the tested pure function and reintroducing a raw-Person leak |

**Key insight:** every piece of this phase already has a proven precedent living in this exact codebase
(`quarters.ts::finalizeAndShare` for overwrite-in-place, `serviceShares`/`quarterShares` for the rules
idiom, `resolveServiceRoleAssignments` for PII-safe resolution). The job is disciplined reuse, not new
design.

## Runtime State Inventory

R078 is explicitly a backfill concern against already-existing production data, so this is answered
explicitly rather than left implicit.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Every service that has ever been shared under the old `createShareToken` behavior has **one or more** `shareTokens/{token}` documents with `serviceId` pointing at it (multiple if shared repeatedly). `serviceShareLinks/{serviceId}` does not exist for ANY service yet — it is a brand-new collection. | Code edit only (no manual migration): `ensureShareLink`'s adoption branch lazily creates the missing `serviceShareLinks` doc on the next share or the next qualifying write, per the locked "lazy backfill, no batch script" decision. |
| Live service config | None — no external service (Planning Center, Cloud Run, etc.) holds share-link state outside Firestore. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — no secret or env var references `shareTokens`/`serviceShareLinks` by name. | None. |
| Build artifacts | None — no compiled/installed artifact embeds a share collection name. | None. |

**Not found in any category beyond the one flagged above** — verified by grep across `src/`,
`functions/`, and the root config files for `shareToken`/`serviceShareLinks`/`serviceShares`.

## Common Pitfalls

### Pitfall 1: Composite-index-dependent adoption query passes in tests, fails in production
**What goes wrong:** A query like `where('serviceId','==',id).orderBy('createdAt','desc').limit(1)`
against `shareTokens` (a query mixing an equality filter with a sort on a *different* field) requires a
composite index in real Firestore. This project's `firestore.indexes.json` is currently empty
(`{"indexes": [], "fieldOverrides": []}`).
**Why it happens:** The Firestore **emulator does not enforce composite-index requirements** — it will
happily execute the query locally, so `npm run test:rules` and the unit suite both pass green.
**How to avoid:** Query with the equality filter only (`where('serviceId','==',id)`, no `orderBy`), then
sort the returned docs client-side by `createdAt`.
**Warning signs:** Any `orderBy` call added alongside a `where` on a different field anywhere in this
phase's diff — flag it in code review even if the emulator suite is green. `[CITED: Firebase/Google Cloud
Firestore indexing docs — https://firebase.google.com/docs/firestore/query-data/index-overview,
https://docs.cloud.google.com/firestore/docs/query-data/multiple-range-fields]`

### Pitfall 2: Treating `serviceShares`' rule as a copy-paste without re-checking `resource.data` availability
**What goes wrong:** `serviceShares`/`quarterShares`'s `allow create` rule checks
`isOrgEditor(request.resource.data.orgId)` (the *incoming* doc, since `resource.data` doesn't exist yet
on create) while `allow update` checks `isOrgEditor(resource.data.orgId)` (the *existing* doc) plus an
equality guard that `request.resource.data.orgId == resource.data.orgId`. Applying the wrong operand to
the wrong rule clause (e.g. using `resource.data.orgId` on `create`) breaks the very first write with a
denial that emulator error output can make look like an unrelated auth bug.
**Why it happens:** `resource` is undefined for `create` requests in Firestore rules; easy to get the two
clauses backwards when mirroring an existing block quickly.
**How to avoid:** Reuse `firestore.rules:261-269` (the `serviceShares` block) as the literal template for
`serviceShareLinks`, changing only the collection name and the field list — do not write the authorization
expressions from scratch.
**Warning signs:** A `create` test that fails with "Missing or insufficient permissions" even though the
seeded membership doc and payload both look correct.

### Pitfall 3: The existing rules test asserting `allow update: if false` must be *replaced*, not left in place
**What goes wrong:** `src/rules.test.ts:621-629` currently has a test titled *"denies updating a
shareTokens doc (frozen snapshot — update stays false)"* that asserts `assertFails` on any authenticated
update. Loosening the rule this phase intentionally makes an org-editor's scoped update **succeed** — if
this test is left unmodified it will start failing (correctly, since it now contradicts the new rule) and
could be mistaken for a regression rather than an intentionally superseded assertion.
**Why it happens:** The test's own title records the *old* invariant as permanent ("stays false"), which
this phase deliberately reverses per R077.
**How to avoid:** Rename/replace this test to assert the new split behavior: an **org-editor of the
owning org** can update (the new allow-case R077 requires), while a **different org's editor** or an
**unauthenticated** caller still cannot (the deny-cases that must still hold).
**Warning signs:** `npm run test:rules` reporting a newly-red pre-existing test after the rules file
change — check whether it's this exact test before assuming a real regression.

### Pitfall 4: `services.test.ts`'s `firebase/firestore` mock has no `where`/`getDocs`
**What goes wrong:** `src/stores/__tests__/services.test.ts:25-66` mocks `firebase/firestore` explicitly,
function-by-function. It currently exports `getDoc`, `setDoc`, `updateDoc`, `query`, `orderBy`, etc., but
**not** `where` or `getDocs` — nothing in the codebase has used a `where`-filtered query before this
phase (`grep -rn "where(\|getDocs" src/stores/` shows only `roster.ts`'s unfiltered `getDocs`, no
`where` anywhere). A test exercising `ensureShareLink`'s adoption branch will hit `where is not a
function` unless the mock is extended.
**Why it happens:** The mock module is maintained by hand, function-by-function, and this is genuinely
the first `where`-filtered query in the app.
**How to avoid:** Add `where: vi.fn((field, op, value) => ({ field, op, value }))` and
`getDocs: vi.fn(() => Promise.resolve({ empty: true, docs: [] }))` (with per-test overrides via
`vi.mocked(getDocs).mockResolvedValueOnce(...)`) to the mock block before writing adoption tests.
**Warning signs:** `TypeError: where is not a function` / `getDocs is not a function` when running the
new `ensureShareLink` unit tests.

## Code Examples

### Existing `serviceShares` rule to mirror for the new `serviceShareLinks` block
```
// Source: firestore.rules:261-269 (existing, verified)
match /serviceShares/{shareId} {
  allow read: if true;
  allow create: if isOrgEditor(request.resource.data.orgId);
  allow update: if isOrgEditor(resource.data.orgId)
                   && request.resource.data.orgId == resource.data.orgId;
  allow delete: if isOrgEditor(resource.data.orgId);
}
```

### Loosened `shareTokens` update rule (drop-in replacement for `firestore.rules:220`)
```
// Source: pattern mirrored from firestore.rules:264-265 (serviceShares update rule)
match /shareTokens/{token} {
  allow read: if true;
  allow create: if isSignedIn();
  allow update: if isOrgEditor(resource.data.orgId)
                   && request.resource.data.orgId == resource.data.orgId;
  allow delete: if isOrgEditor(resource.data.orgId);
}
```

### New `serviceShareLinks` block (org-editor-scoped, no public read)
```
// Modeled on firestore.rules:261-269 (serviceShares) with public read REMOVED per locked decision
match /serviceShareLinks/{serviceId} {
  allow read: if isOrgEditor(resource.data.orgId);
  allow create: if isOrgEditor(request.resource.data.orgId);
  allow update: if isOrgEditor(resource.data.orgId)
                   && request.resource.data.orgId == resource.data.orgId;
  allow delete: if isOrgEditor(resource.data.orgId);
}
```

### Existing soft-fail pattern to reuse for the refresh call sites
```typescript
// Source: services.ts:414-438 (createShareToken's existing serviceShares write — WR-06 precedent)
try {
  // ... the write(s) that must never fail the caller's save ...
} catch (err) {
  console.error(
    'createShareToken: memorable-URL slug/serviceShares write failed — the opaque share link above already succeeded',
    err,
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `createShareToken` mints a fresh random token and frozen snapshot on every call | `ensureShareLink` resolves a stable token once (create or adopt) and refreshes the payload in place on every relevant write | This phase | Fixes both "the link changed" and "my overrides aren't showing" from the same root cause |
| `shareTokens` is write-once (`allow update: if false`) | `shareTokens` update is org-editor-scoped (mirrors `serviceShares`) | This phase | Enables in-place refresh without opening the door to cross-org tampering |

**Deprecated/outdated:** the frozen-snapshot-at-share-time model is fully superseded; no caller should be
written against the assumption that `shareTokens/{token}` is immutable after creation.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Services realistically accumulate only "a handful" of legacy `shareTokens` docs from the old mint-fresh behavior, so an unindexed equality-only query + client-side sort is performant enough | Don't Hand-Roll, Pattern 1 | If some services were shared dozens/hundreds of times, the client-side sort still works correctly (Firestore doesn't cap `where`-only query result size in a way that matters here) but does more work than necessary; not a correctness risk, only a very mild efficiency one — low impact even if wrong |

**All other claims in this research were verified against this repository's own source or against
Firestore's official indexing documentation (WebSearch, cited inline) — no other user confirmation is
needed before planning.**

## Open Questions

1. **Should `deleteService` revoke `shareTokens`/`serviceShareLinks` the way `quarters.ts::deleteQuarter`
   revokes `quarterShares`?**
   - What we know: `deleteService` (`services.ts:259-262`) currently does not touch any share
     collection at all — this is pre-existing behavior, not something this phase changes.
   - What's unclear: whether leaving an orphaned `serviceShareLinks`/`shareTokens` pointing at a deleted
     service (still publicly readable, showing stale data forever) is acceptable for v1.5.
   - Recommendation: out of scope per R076/R077/R078's literal text (none mention delete) and per
     CONTEXT.md's explicit "no new work beyond what's asked" pattern seen elsewhere in this milestone —
     but flag it for the planner to make an explicit in-scope/out-of-scope call rather than silently
     inheriting it, since it's adjacent enough to be mistaken for in-scope.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Firebase emulator (Firestore) | `npm run test:rules` / `vitest.rules.config.ts` ALLOW-case tests | Not probed this session — CLAUDE.md documents the exact failure mode ("port taken" if one is already running) and its fallback | — | Run `npx vitest run --config vitest.rules.config.ts` directly against an already-running emulator instead of `npm run test:rules` |
| `.env.local` | Any Firebase-config-dependent test/build in a fresh worktree | Assumed present in the main checkout per CLAUDE.md; not re-verified this session | — | Symlink/copy from `C:\projects\worshipplanner\.env.local` per CLAUDE.md instructions if working in a new worktree |

**Missing dependencies with no fallback:** none identified.
**Missing dependencies with fallback:** Firebase emulator port conflict — documented fallback above; no
action needed unless the planner/executor actually hits it.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (root `vitest`/`vite.config.ts` for the app suite; separate `vitest.rules.config.ts` for emulator-backed rules tests) |
| Config file | `vite.config.ts` (app suite, excludes `src/rules.test.ts`); `vitest.rules.config.ts` (rules suite: `src/rules.test.ts` + `src/storage.rules.test.ts`) |
| Quick run command | `npx vitest run src/stores/__tests__/services.test.ts` (single file, fast inner loop) |
| Full suite command | `npx vitest run --dir src --exclude '**/rules.test.ts'` (app suite — per CLAUDE.md, avoid bare `vitest run src/` which picks up `render-service/src/render.test.ts` by substring); `npm run test:rules` for the rules suite (or `npx vitest run --config vitest.rules.config.ts` if an emulator is already running — CLAUDE.md's documented port-conflict fallback) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| R076 | Repeated `ensureShareLink`/`onShare` calls on the same service return the SAME token | unit | `npx vitest run src/stores/__tests__/services.test.ts -t "ensureShareLink"` | ❌ Wave 0 — new test cases needed in existing file |
| R076 | Editing a service (`updateService`) does not change its `serviceShareLinks` token | unit | same file, new test case | ❌ Wave 0 |
| R077 | Refresh writes to `shareTokens`/`serviceShares` and asserts NO write to `services/{docId}` (mock call-count/args assertion, not just presence of the two forward writes) | unit | same file, new test case | ❌ Wave 0 |
| R077 | `shareTokens` update rule ALLOW-case: org editor can update their own org's `shareTokens` doc | rules (emulator) | `npm run test:rules` (or `npx vitest run --config vitest.rules.config.ts` against a running emulator) | ❌ Wave 0 — replaces the existing "update stays false" test in `src/rules.test.ts:621-629` |
| R077 | `shareTokens` update rule DENY-case: a different org's editor cannot update | rules (emulator) | same command | ❌ Wave 0 |
| R077 | `serviceShareLinks` CRUD: org-editor allow-cases + cross-org/unauthenticated deny-cases, mirroring the existing `serviceShares` describe block | rules (emulator) | same command | ❌ Wave 0 |
| R078 | Adoption: 2+ pre-existing `shareTokens` docs for a service → `ensureShareLink` adopts the one with the latest `createdAt`, does not mint a new one | unit | `npx vitest run src/stores/__tests__/services.test.ts -t "adopt"` | ❌ Wave 0 |
| R078 | Zero pre-existing `shareTokens` docs → mints exactly one (ordinary first-share path, must not regress) | unit | same file | ✅ — existing `createShareToken` tests already cover the mint case; adapt to new function name |
| PII guard (R077 regression check) | `roleAssignments` in the refreshed snapshot still carries `personNames` only, never a raw `Person` object | unit | same file, existing pattern extended | ✅ — existing PII-guard tests in `services.test.ts` should be re-pointed at the extracted snapshot-builder |

### Sampling Rate
- **Per task commit:** `npx vitest run src/stores/__tests__/services.test.ts`
- **Per wave merge:** `npx vitest run --dir src --exclude '**/rules.test.ts'` AND `npm run test:rules` (or the running-emulator fallback)
- **Phase gate:** Both suites green before `/gsd-verify-work`, plus `npm run type-check` (the `vue-tsc --build` form, per CLAUDE.md — not the narrower `-p tsconfig.app.json` form)

### Wave 0 Gaps
- [ ] `src/stores/__tests__/services.test.ts` — mock `firebase/firestore` needs `where` and `getDocs` added (see Pitfall 4); new `describe('ensureShareLink', ...)` block covering stability, adoption, no-write-back, and PII-guard-survives assertions
- [ ] `src/rules.test.ts` — replace the "denies updating a shareTokens doc (frozen snapshot — update stays false)" test with allow/deny cases matching the new rule; add a new `describe('serviceShareLinks — org-editor-scoped, no public read', ...)` block mirroring the existing `serviceShares` block's structure
- [ ] No new framework/config install needed — both suites already exist and are wired into `package.json`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | Unchanged — this phase touches authorization rules, not authentication |
| V3 Session Management | No | Not touched |
| V4 Access Control | **Yes** | Firestore Security Rules: `isOrgEditor(orgId)` checks scoped to `resource.data.orgId`/`request.resource.data.orgId`, mirroring the already-hardened `serviceShares`/`quarterShares` CR-01 pattern |
| V5 Input Validation | **Yes** | Rule-level `keys().hasOnly([...])`-style scoping is not needed here (no analogous smuggled-field risk on `shareTokens`/`serviceShareLinks` the way R036's carve-outs need it), but `orgId` immutability on update IS the input-validation control preventing reassignment |
| V6 Cryptography | No | Token generation (`crypto.getRandomValues`, 144-bit entropy) is unchanged, already reviewed, reused as-is |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Cross-org overwrite of another org's `shareTokens`/`serviceShareLinks` doc via a guessable/enumerable doc ID | Tampering / Elevation of Privilege | `isOrgEditor(resource.data.orgId)` + `request.resource.data.orgId == resource.data.orgId` on every update rule — the exact CR-01 pattern already fixed for `serviceShares`/`quarterShares`; REJECTED explicitly per CONTEXT.md: do not use `isSignedIn()` alone |
| A non-editor (viewer-role org member) refreshing/creating a share link | Elevation of Privilege | `isOrgEditor`, not `isOrgMember`, gates every write — viewers can read services but cannot create/refresh share links, consistent with how `createShareToken` is already gated (only reachable from editor-only UI) |
| Refresh silently leaking the raw `Person` object into a public document | Information Disclosure | Snapshot-building stays behind the existing `nameById` Map resolution (`services.ts:375-387`) — extracting it to a shared pure function must preserve this, and a regression test should assert the snapshot object has no `email`/`phone`/`pcPersonId` keys anywhere in its serialized form |

## Sources

### Primary (HIGH confidence — direct codebase read)
- `src/stores/services.ts` (full file read) — `createShareToken`, `updateService`, `setRoleOverride`,
  `clearRoleOverride`, `assertWritable`/R036 carve-outs, the `onSnapshot` subscription, `ownWriteEchoIds`
- `firestore.rules` (full file read) — `/services/{docId}` rule, `shareTokens`, `serviceShares`,
  `quarterShares`, `orgSlugs` blocks
- `src/stores/quarters.ts:390-490` — `finalizeAndShare`, the overwrite-in-place precedent
- `src/views/ShareView.vue:1-150` — public read path, confirms `status` is never rendered
- `src/views/ServiceEditorView.vue:2120-2260, 3509-3529` — remote-merge watcher, autosave wiring, `onShare`
- `src/components/ServiceCard.vue:195-232` — second `onShare` caller
- `src/rules.test.ts` (structure + `shareTokens`/`serviceShares`/`quarterShares` describe blocks, full read of lines 1-120, 323-630)
- `src/stores/__tests__/services.test.ts:1-70, 661-800` — existing mock shape, existing `createShareToken` test coverage
- `firestore.indexes.json` — confirms zero existing composite indexes
- `vitest.rules.config.ts`, `package.json` `test:rules` script

### Secondary (MEDIUM confidence — WebSearch, cross-checked against official docs)
- Firebase/Google Cloud Firestore indexing documentation — composite index required for
  equality-filter + orderBy-on-a-different-field
  (https://firebase.google.com/docs/firestore/query-data/index-overview,
  https://docs.cloud.google.com/firestore/docs/query-data/multiple-range-fields)
- Firestore emulator behavior — does not enforce composite-index requirements locally (multiple
  corroborating sources in WebSearch results, including firebase/firebase-tools GitHub issue discussion)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency; entire phase reuses already-installed, already-reviewed patterns in this repo
- Architecture: HIGH — every claim about write paths, subscriptions, and rule shapes is grounded in a direct read of the actual source, not inference
- Pitfalls: HIGH — the composite-index pitfall is WebSearch-cross-checked against official docs; the test-mock and stale-test pitfalls are grounded in direct reads of the actual test files

**Research date:** 2026-08-07
**Valid until:** 30 days (stable — no external API, no fast-moving dependency; the only expiry risk is if `firestore.rules` or `services.ts` are touched by an unrelated phase before Phase 41 executes)
