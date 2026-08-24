# Phase 80: Security & Data-Integrity Hardening - Research

**Researched:** 2026-08-24
**Domain:** Firestore security rules (create-gate, field-immutability), client-side cascade-delete of denormalized share artifacts, slide-group rebuild engine, Vue read-guard UI
**Confidence:** HIGH

## Summary

This phase closes five independently-scoped, already-diagnosed gaps. Design is locked (80-CONTEXT.md); this
research re-verifies every integration point against the LIVE tree (not the seed) and designs the
Nyquist validation strategy. All five findings from CONTEXT.md were confirmed byte-for-byte against
current source — nothing drifted since the milestone research was written.

R232 and R233 are one-line-per-rule `firestore.rules` changes that exactly mirror an existing pattern
already live in the same file (`orgSlugs`/`orgNames`' `isOrgEditor(request.resource.data.orgId)` create
gate, and `organizations/{orgId}`'s existing `diff().affectedKeys()` lifecycle-field guard). R234 is a
client-only cascade-delete that mirrors `deleteQuarter`'s existing revocation structure, adapted for
`shareTokens`' query-based (not single-field) lookup. R235 is a **one-line fix inside an existing early
return** (`rebuildSongGroup`'s `if (!songId) return { changed: false, ... }`) — the exact defect was
already diagnosed and recorded as W-03 in Phase 30's verification report, complete with a test
(`slideGroupMaterializer.test.ts:686-694`) that currently LOCKS IN the buggy behavior and must be
flipped. R236 is a pure read of an already-threaded prop (`assembledSlide.slide.renderState`) that
`EditSlideDrawer.vue` receives today but never branches on.

**Primary recommendation:** Implement all five as small, surgical diffs against the exact lines cited
below — no new abstractions, no new packages, no new collections. R232/R233 ship built+tested+UNDEPLOYED
with the `firebase deploy --only firestore:rules` hand-over; R234/R235/R236 are client-only, no deploy.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| inviteLookup create authorization (R232) | Database / Storage (Firestore rules) | — | Security boundary enforced server-side; client payload already carries the field the rule reads |
| Org `createdBy` immutability (R233) | Database / Storage (Firestore rules) | — | Same file, same `diff().affectedKeys()` idiom already used for the 5 lifecycle fields |
| Service share-artifact revocation (R234) | API / Backend (Pinia store, client-authored write) | Database (existing `allow delete` rules, unchanged) | `deleteService` already owns the service's lifecycle; no Cloud Function needed — rules already permit the deletes |
| Reprise-safe slide clearing (R235) | API / Backend (pure rebuild-engine function) | Frontend Server — N/A (no SSR in this app) | `rebuildSongGroup` is a pure function invoked reactively per-slot by `useSlideshowAssembly`; the fix is entirely inside that pure function |
| Pending-render edit guard (R236) | Browser / Client (Vue component) | — | Pure UI read of an already-resolved field; no new data flow |

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**R232 — inviteLookup create gate (firestore.rules; DEPLOY HAND-OVER)**
- Change `match /inviteLookup/{email}` `allow create` from `if isSignedIn()` to
  `if isSignedIn() && isOrgEditor(request.resource.data.orgId)` — mirror the `orgSlugs`/`orgNames` create
  gate. The payload ALREADY carries `orgId` (`TeamView.vue onInvite()` writes it in the same batch as the
  invite doc) → NO client code change needed.
- `assignOrgAdmin` (Cloud Function, Admin SDK) bypasses rules → unaffected.
- Leave `allow read`/`allow delete` unchanged (the first-login acceptance flow in `auth.ts` reads then
  deletes its own invite by email — must keep working).
- Tests (emulator, `src/rules.test.ts`): ALLOW an editor of the target org creating an invite; DENY a
  signed-in non-editor and DENY a mismatched-orgId payload; a regression asserting the invite → first-login
  read+delete acceptance path still passes (RESEARCH: trace all three actors — do not just add a DENY case).

**R233 — createdBy immutability (firestore.rules; DEPLOY HAND-OVER)**
- On `organizations/{orgId}` `allow update`, forbid changing `createdBy`. Extend the existing guard using the
  `diff().affectedKeys()` pattern (the milestone research confirmed `preservesLifecycleFields()` guards 5
  named lifecycle fields but NOT `createdBy`) — add `createdBy` to the immutable-on-update set (a companion
  helper or extend the existing one; keep the lifecycle guard intact).
- Tests: DENY an editor `updateDoc` that changes `createdBy`; ALLOW a normal edit that leaves it unchanged.

**R234 — deleteService share revocation (client-only; NO rules change)**
- In `deleteService` (`src/stores/services.ts`), revoke ALL of the service's public share artifacts. Unlike
  `deleteQuarter` (single denormalized `shareToken` field), a service can accumulate MULTIPLE — so use
  QUERY-based deletion, not a single-doc delete:
  - `shareTokens` where the token targets this service (query by serviceId — see `pickAdoptableToken`'s query
    shape),
  - `serviceShareLinks/{serviceId}` (direct-keyed identity doc),
  - `serviceShares/{slug}__service-{date}` (keyed by the service's slug+date).
  Reuse the `deleteQuarter` revocation structure but adapt to these key shapes (ARCHITECTURE.md documented the
  exact keys via `ensureShareLink`/`writeSharePayload`).
- `allow delete` rules for all three collections are already in place → NO rules change.
- Test: unit — `deleteService` deletes every one of the three artifact types (incl. the multi-`shareTokens`
  case); a leftover token no longer resolves.

**R235 — clear slides on song removal, reprise-safe (client-only)**
- Removing a song from a service must clear THAT song's slides even when the same song is reprised elsewhere
  in the same service (backlog 999.2). Find where slide-clearing happens on song removal and fix the reprise
  case so it clears only the removed occurrence's slides (or all occurrences correctly), never orphaning
  slides. Do not mis-attach across reprises.
- Test: removing a reprised song leaves no orphaned slides and does not wrongly clear an unrelated occurrence.

**R236 — pending-render edit guard (client-only, the one UI element — LOCKED)**
- `EditSlideDrawer.vue` already has access to the slide's `renderState?: 'pending' | 'failed'` (type exists;
  the component just never reads it). When `renderState === 'pending'`, show an inline **amber** notice and
  disable the per-entry customization controls (or block Save) so a change can't be silently discarded when
  the render flips pending→ready.
- Copy (locked): **"This slide is still rendering. Wait until it's ready before customizing — changes made
  now would be lost when the render finishes."** Amber inline banner reusing the app's existing amber-notice
  styling (same tone as the lock banner), `aria-live="polite"`. Not a modal, not a toast.
- Test: component test — a `pending` renderState renders the notice and disables/blocks customization; a
  `ready` (undefined) slide behaves exactly as today.

**Deploy discipline (standing grant)**
- R232 + R233 are `firestore.rules` changes → ship BUILT + TESTED + **UNDEPLOYED**, with the exact
  `firebase deploy --only firestore:rules` command handed to the owner (recorded in PENDING-VERIFICATION.md).
- R234, R235, R236 are client-only — no deploy.

### Claude's Discretion
- Whether R233 extends `preservesLifecycleFields()` or adds a sibling helper; the exact query for the
  service's `shareTokens`; the precise disabled-vs-blocked treatment for R236 (either satisfies the SC).

### Deferred Ideas (OUT OF SCOPE)
- Moving org membership / invite authority onto custom claims (broader auth-model change) — out of scope.
- Any change to the `services`/`slideGroups` rules (excluded from the generic per-org wildcard) — not needed
  for these five gaps.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R232 | inviteLookup create is restricted to an editor of the target org | Verified live rule text at `firestore.rules:467-475`; confirmed `orgSlugs`/`orgNames` pattern at `firestore.rules:539-555`; traced all three actors (TeamView.vue, auth.ts, orgProvisioning.ts) |
| R233 | `createdBy` cannot change after org creation | Verified live `preservesLifecycleFields()`/`lifecycleFields()` at `firestore.rules:113-167`; confirmed `createdBy` is NOT in the 5-field list |
| R234 | Deleting a service revokes all its share artifacts | Verified live `deleteService` (`services.ts:403-412`), `deleteQuarter` precedent (`quarters.ts:460-483`), exact share-artifact write/query shapes (`services.ts:600-717`) |
| R235 | Removing a song clears its slides, reprise-safe | Verified live `rebuildSongGroup`'s `!songId` early return (`slideGroupMaterializer.ts:603-605`); found the EXACT locked-in regression test (`slideGroupMaterializer.test.ts:686-694`) and the prior diagnosis (Phase 30 W-03) |
| R236 | Pending-render slide customization is warned/blocked | Verified live `EditSlideDrawer.vue` props/computeds (`assembledSlide.slide` already threaded); verified `renderState` field shape (`types/slide.ts:50-62`); verified amber-banner styling precedent (`ServiceEditorView.vue:310-355`) |
</phase_requirements>

## Standard Stack

No new libraries. Every change is confined to `firestore.rules` (declarative rules DSL, no dependency) and
existing TypeScript/Vue source already in the repo (`firebase/firestore` client SDK, already a dependency;
Vue 3 Composition API, already in use). Version verification is N/A — nothing is being installed.

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| R233: sibling `preservesCreatedBy()` helper | Widen `lifecycleFields()`'s array to include `createdBy` | **Rejected** — `lifecycleFields()` is shared by the CREATE branch too (`!request.resource.data.keys().hasAny(lifecycleFields())`), which asserts those keys are ABSENT on create. `createdBy` is REQUIRED on create (`request.resource.data.createdBy == request.auth.uid`), so folding it into that shared list would make every legitimate org-create request deny itself. A sibling helper scoped to the update-only diff is the only correct shape. |
| R234: query by `serviceId` on `shareTokens` | Store an array of token ids on the service doc, single-key delete | **Rejected** — would require a schema change to `Service` and a corresponding rules/write-path change for every future share; the multi-token-accumulation problem (adoption of pre-existing tokens, `pickAdoptableToken`) means the array could drift from reality anyway. A query is authoritative and needs no schema change. |
| R235: query slide groups by songId across the service | Single-slot fix inside `rebuildSongGroup` | **Rejected as unnecessary** — slide groups are keyed 1:1 by `slot.id` (doc id IS the slot id — see `firestore.rules:327-330` comment), so a reprise (same song in two slots) already produces TWO independent group documents. Fixing the per-slot rebuild function is sufficient and cannot cross-contaminate the other slot's group. |

## Package Legitimacy Audit

**Not applicable this phase.** No new npm/PyPI/crates packages are introduced by any of the five plans —
every change is to `firestore.rules` or to existing TypeScript/Vue modules using already-installed
dependencies (`firebase`, `vue`, `pinia`). Skip the Package Legitimacy Gate.

## Architecture Patterns

### System Architecture Diagram

```
R232 (inviteLookup create gate)
  TeamView.vue onInvite()  --batch.set(invites/{email}, {orgId,...})-->  Firestore
                           --batch.set(inviteLookup/{email}, {orgId,role,invitedAt})-->  [RULE: isOrgEditor(payload.orgId)]
  auth.ts ensureUserDocument() --getDoc(inviteLookup/{email})--> reads --> batch.delete(...) --> [RULE: email-match OR isOrgEditor(stored.orgId), UNCHANGED]
  orgProvisioning.ts (Cloud Function, Admin SDK) --db.collection('inviteLookup').doc(email).set(...)--> [BYPASSES rules entirely]

R233 (createdBy immutability)
  TeamView/Settings editor updateDoc(organizations/{orgId}, {...})  -->  [RULE: isOrgEditor(orgId) && preservesLifecycleFields() && preservesCreatedBy() (NEW)]

R234 (deleteService cascade)
  ServiceEditorView "Delete service" --> services.ts deleteService(id)
     1. getDocs(query(shareTokens, where(serviceId==id)))  --> deleteDoc each match
     2. getDoc(serviceShareLinks/{id}) --> if exists, read slug from it OR from org doc --> deleteDoc
     3. getDoc(organizations/{orgId}) --> read slug --> getDoc(serviceShares/{slug}__service-{date}) --> if exists, deleteDoc
     4. deleteDoc(organizations/{orgId}/services/{id})   [service doc itself, LAST -- mirrors deleteQuarter's "revoke public docs FIRST" ordering]
     5. shareLinkCache.delete(id)  [already-shipped WR-03 behavior, unchanged]

R235 (reprise-safe slide clear)
  clearSongFromSlot(serviceId, slotIndex) --> updateService({slots: [...songId:null...]})
     --> useSlideshowAssembly's rebuildOutcomes watcher (reactive, fires on service.slots change)
         --> rebuildGroup(group, slot, inputs) --> rebuildSongGroup(group, slot{songId:null}, inputs)
             [TODAY: `if (!songId) return {changed:false, slides: group.slides}` -- BUG, stale slides survive]
             [FIX:   `if (!songId) return group.slides.length === 0 ? {changed:false,...} : {changed:true, slides:[]}`]
         --> applyRebuildOutcomes --> slideGroupsStore.replaceGroupSlides(orgId, slotId, [], ...)
     [Each SONG slot has its OWN group doc keyed by slot.id -- a reprised song's OTHER slot's group is untouched]

R236 (pending-render edit guard)
  useSlideshowAssembly's assembledSlideshow (already resolves renderState via importedRenderReconciler.ts)
     --> SlidesTab.vue passes `assembledSlide` prop to EditSlideDrawer.vue (ALREADY wired, no new plumbing)
         --> NEW: isPendingRender = computed(() => props.assembledSlide?.slide.renderState === 'pending')
         --> amber notice (aria-live="polite") + composed into `canMutate` (or a parallel gate)
```

### Recommended Task Boundaries (not file layout — no new files needed)

- `firestore.rules` — two isolated diffs (R232 near line 467-475; R233 near line 113-167). Independent of
  each other; can be one plan or two, but must ship together as one rules deploy hand-over (same file).
- `src/stores/services.ts` — one function (`deleteService`) grows a revocation block. No new store, no new
  file.
- `src/utils/slideGroupMaterializer.ts` — one early-return branch inside `rebuildSongGroup` changes. No new
  export, no signature change.
- `src/components/slides/EditSlideDrawer.vue` — one new computed + one new template block + composing
  `isPendingRender` into the existing `canMutate` gate (or a parallel `!isPendingRender` condition placed
  alongside it, per the locked "disable OR block Save" discretion).

### Pattern 1: Firestore create-gate mirroring an existing sibling collection (R232)

**What:** `orgSlugs`/`orgNames` already solve "prevent an arbitrary signed-in user from creating a
document that targets someone else's org" with one clause: `allow create: if
isOrgEditor(request.resource.data.orgId);`. `inviteLookup` needs the identical protection and the
payload already carries `orgId`.
**When to use:** Any `create`-only collection keyed by something OTHER than the org id, where the payload
itself declares which org it belongs to.
**Example (live source, not hypothetical):**
```
// Source: firestore.rules:539-543 (existing, unchanged)
match /orgSlugs/{slug} {
  allow read: if true;
  allow create: if isOrgEditor(request.resource.data.orgId);
  allow update, delete: if false;
}
```
**Applied fix (R232):**
```
// firestore.rules:467-475, BEFORE:
match /inviteLookup/{email} {
  allow read: if isSignedIn() && request.auth.token.email.lower() == email;
  allow create: if isSignedIn();
  allow delete: if isSignedIn() && (
    request.auth.token.email.lower() == email ||
    isOrgEditor(resource.data.orgId)
  );
}

// AFTER (only the create line changes):
match /inviteLookup/{email} {
  allow read: if isSignedIn() && request.auth.token.email.lower() == email;
  allow create: if isSignedIn() && isOrgEditor(request.resource.data.orgId);
  allow delete: if isSignedIn() && (
    request.auth.token.email.lower() == email ||
    isOrgEditor(resource.data.orgId)
  );
}
```

### Pattern 2: `diff().affectedKeys()` immutability guard (R233)

**What:** The org doc already has this exact idiom for 5 lifecycle fields. `createdBy` needs the same
treatment but MUST NOT be folded into the same list (see Alternatives Considered — the list is also
consulted on CREATE, where `createdBy` must be present).
**When to use:** Any single field that must be settable once (at create) and frozen forever after.
**Example (live source):**
```
// Source: firestore.rules:113-126 (existing, unchanged)
function lifecycleFields() {
  return ['active', 'deactivatedAt', 'deactivatedBy', 'reactivatedAt', 'reactivatedBy'];
}
function preservesLifecycleFields() {
  return request.resource == null
    ? true
    : (resource == null
        ? !request.resource.data.keys().hasAny(lifecycleFields())
        : !request.resource.data.diff(resource.data).affectedKeys().hasAny(lifecycleFields()));
}
```
**Recommended new sibling (R233) — scoped to update only, since this call site is only ever reached from
the `allow update` clause where `resource` is guaranteed non-null:**
```
// NEW, placed alongside preservesLifecycleFields()
function preservesCreatedBy() {
  return !request.resource.data.diff(resource.data).affectedKeys().hasAny(['createdBy']);
}
```
**Applied fix, `allow update` at firestore.rules:161:**
```
// BEFORE:
allow update: if isOrgEditor(orgId) && preservesLifecycleFields();
// AFTER:
allow update: if isOrgEditor(orgId) && preservesLifecycleFields() && preservesCreatedBy();
```
The `allow create` clause at line 166-167 is UNCHANGED — it already requires
`request.resource.data.createdBy == request.auth.uid`, which is the correct one-time assignment; nothing
about R233 touches create.

### Pattern 3: Guarded existence-check before delete (R234) — the `deleteQuarter` precedent

**What:** `deleteQuarter` already solves "delete N possibly-absent denormalized public-share docs before
deleting the parent" — each candidate delete is preceded by a `getDoc` existence check, because issuing a
`deleteDoc` against a genuinely non-existent doc makes `resource == null` inside the rule, and dereferencing
`resource.data.orgId` on a null `resource` is a rules-evaluation ERROR, which Firestore treats as DENY (not
a silent no-op). Skipping the existence check turns "this service was never shared" into a hard failure.
**When to use:** Every delete target in R234's cascade (`serviceShareLinks/{id}`, `serviceShares/{key}`) —
NOT `shareTokens`, because that one is discovered via a query, whose result set is already known to exist.
**Example (live source):**
```
// Source: quarters.ts:460-483 (existing, the reuse target)
async function deleteQuarter(quarterId: string): Promise<void> {
  if (!orgId.value) throw new Error('No orgId set — call subscribe() first')
  const quarter = getQuarter(quarterId)

  if (quarter.shareToken) {
    const tokenRef = doc(db, 'shareTokens', quarter.shareToken)
    const tokenSnap = await getDoc(tokenRef)
    if (tokenSnap.exists()) await deleteDoc(tokenRef)

    const orgSnap = await getDoc(doc(db, 'organizations', orgId.value))
    const slug = orgSnap.exists() ? (orgSnap.data().slug as string | undefined) : undefined
    if (slug) {
      const shareRef = doc(db, 'quarterShares', `${slug}__q${quarter.quarter}-${quarter.year}`)
      const shareSnap = await getDoc(shareRef)
      if (shareSnap.exists()) await deleteDoc(shareRef)
    }
  }
  await deleteDoc(doc(db, 'organizations', orgId.value, 'quarters', quarterId))
}
```
**R234's shape, adapted (query instead of single field; `serviceId` param already given, service object
must be looked up BEFORE the service doc is deleted, for its `date`):**
```
// Applied to services.ts deleteService(id) — sketch, not final code:
async function deleteService(id: string) {
  if (!orgId.value) return
  const service = services.value.find((s) => s.id === id)   // needed BEFORE delete, for .date below

  // 1. shareTokens — QUERY-based (a service can accumulate more than one via adoption/re-share)
  const tokensSnap = await getDocs(query(collection(db, 'shareTokens'), where('serviceId', '==', id)))
  for (const tokenDoc of tokensSnap.docs) {
    await deleteDoc(tokenDoc.ref)
  }

  // 2. serviceShareLinks/{id} — direct-keyed identity doc, existence-guarded
  const linkRef = doc(db, 'serviceShareLinks', id)
  const linkSnap = await getDoc(linkRef)
  if (linkSnap.exists()) await deleteDoc(linkRef)

  // 3. serviceShares/{slug}__service-{date} — needs the org's slug + this service's date
  if (service) {
    const orgSnap = await getDoc(doc(db, 'organizations', orgId.value))
    const slug = orgSnap.exists() ? (orgSnap.data().slug as string | undefined) : undefined
    if (slug) {
      const shareRef = doc(db, 'serviceShares', `${slug}__service-${service.date}`)
      const shareSnap = await getDoc(shareRef)
      if (shareSnap.exists()) await deleteDoc(shareRef)
    }
  }

  // 4. The service doc itself, LAST (mirrors deleteQuarter's "public docs revoked first" ordering)
  await deleteDoc(doc(db, 'organizations', orgId.value, 'services', id))
  shareLinkCache.delete(id)  // WR-03, already shipped, unchanged
}
```
**Exact query/write shapes this mirrors (live source, confirms the key formats):**
```
// Source: services.ts:676 (ensureShareLink's own adoption query — same collection/field)
const adoptionQuery = query(collection(db, 'shareTokens'), where('serviceId', '==', service.id))
// Source: services.ts:629 (writeSharePayload's serviceShares key — same string template to reverse)
await setDoc(doc(db, 'serviceShares', `${slug}__service-${service.date}`), {...})
// Source: services.ts:655 (serviceShareLinks doc id — service.id itself, no transform)
const linkRef = doc(db, 'serviceShareLinks', service.id)
```
Note the doc ordering: unlike `deleteQuarter`, there is no single `if (quarter.shareToken)` gate for the
whole block — every artifact type here is independently possibly-present (a service can have a
`serviceShareLinks` doc adopted from a pre-existing `shareTokens` doc without ever writing its own
`serviceShares` entry if `writeSharePayload`'s soft-fail branch previously failed), so each of the three
must be checked/queried independently, not gated behind one flag the way `quarter.shareToken` gates
`deleteQuarter`'s block.

### Pattern 4: Per-slot rebuild-engine fix, not a cross-slot query (R235)

**What:** `rebuildSongGroup`'s current early return treats "no song assigned" as "nothing to do" — but a
group can already hold stale entries from a PREVIOUSLY assigned song (the ordinary path: `clearSongFromSlot`
nulls `songId`/`songTitle`/`songKey` on the slot, then the reactive `rebuildOutcomes` watcher in
`useSlideshowAssembly.ts` calls `rebuildGroup` → `rebuildSongGroup` for that slot on the next tick). The fix
is entirely local to this one function; it needs NO awareness of other slots, because slide groups are
already keyed 1:1 by `slot.id`.
**When to use:** This exact defect only — do not generalize this reasoning to `rebuildScriptureGroup`'s or
`rebuildImportedGroup`'s "not yet loaded" guards, which are legitimate loading-race protections (T-30-02-04)
serving a different purpose (source data hasn't arrived yet vs. source was deliberately cleared).
**Current code (the defect, confirmed live, unchanged since `0ecc84f` per Phase 30's W-03):**
```typescript
// Source: src/utils/slideGroupMaterializer.ts:603-605
export function rebuildSongGroup(group: SlideGroup, slot: SongSlot, inputs: AssemblyInputs): RebuildResult {
  const songId = slot.songId
  if (!songId) return { changed: false, slides: group.slides }   // <-- BUG: stale slides survive forever
  ...
```
**Recommended fix:**
```typescript
export function rebuildSongGroup(group: SlideGroup, slot: SongSlot, inputs: AssemblyInputs): RebuildResult {
  const songId = slot.songId
  if (!songId) {
    // R235/999.2: the song was cleared from THIS slot. Its group must empty,
    // even when the same song is still assigned to another slot elsewhere in
    // the service — that other slot has its OWN group doc, keyed by its own
    // slot.id, and is untouched by this write.
    if (group.slides.length === 0) return { changed: false, slides: group.slides }
    return { changed: true, slides: [] }
  }
  ...
```
This is idempotent (a second pass over an already-empty group returns `changed: false`, matching every
other rebuild function's contract) and requires no change to `deriveGroupEntries`, `buildInitialGroup`,
`carryStoredDerivedEntries`, or any caller signature.

**The regression test that currently LOCKS IN the bug and MUST be updated as part of this fix:**
```typescript
// Source: src/utils/__tests__/slideGroupMaterializer.test.ts:686-694 (CURRENT, must change)
it('a song plan item with no song assigned returns the unchanged result', () => {
  const slot = songSlot({ id: 'slot-1', songId: null })
  const group = makeStoredSongGroup(twoSectionStoredSlides)
  const inputs = makeInputs()

  const result = rebuildSongGroup(group, slot, inputs)

  expect(result).toEqual({ changed: false, slides: group.slides })   // <-- asserts the BUG today
})
```
This test name and assertion must flip to assert the group CLEARS (`changed: true, slides: []`) when a
non-empty stored group meets a cleared slot, while a genuinely-already-empty group (`songId: null` +
`group.slides: []`) still correctly returns `changed: false` — add that second case explicitly so the
idempotence contract every other `rebuild*` function shares is provable here too.

### Pattern 5: Reading an already-threaded discriminator field (R236)

**What:** `EditSlideDrawer.vue` already receives `assembledSlide: AssembledSlide | null` as a prop and
already reads several of its `.slide.*` fields (`contentKind`, `backgroundImageUrl`, `backgroundSource`).
`renderState` is simply another field on that same `SlideBase` object, populated today by
`importedRenderReconciler.ts` for any slide sourced from a PPTX deck whose server-side render hasn't
produced a usable page yet. No new prop, no new store subscription, no new composable.
**When to use:** R236 only.
**Example (live source, the pattern already used for adjacent fields):**
```typescript
// Source: EditSlideDrawer.vue:699-700 (existing pattern to copy for renderState)
const resolvedBackgroundUrl = computed(() => props.assembledSlide?.slide.backgroundImageUrl)
const backgroundSource = computed(() => props.assembledSlide?.slide.backgroundSource)
```
**Applied (R236), new computed alongside the above:**
```typescript
const isPendingRender = computed(() => props.assembledSlide?.slide.renderState === 'pending')
```
**Gating point** — the existing single mutation gate every customization control in this drawer already
uses:
```typescript
// Source: EditSlideDrawer.vue:625 (existing)
const canMutate = computed(() => props.isEditor && !props.serviceLocked && !isSongGroup.value)
// Recommended: compose isPendingRender into this SAME gate (satisfies "disable the per-entry
// customization controls" per CONTEXT.md's locked wording) rather than inventing a parallel gate:
const canMutate = computed(() =>
  props.isEditor && !props.serviceLocked && !isSongGroup.value && !isPendingRender.value,
)
```
Composing into the existing `canMutate` is the lower-risk of the two locked-acceptable options (disable vs.
block-Save): every control this drawer already hides/disables for a locked service (label/notes/body
textarea, audio attach/remove/loop, Duplicate, Delete Slide) is uniformly gated by this ONE computed today,
so no second parallel disabled-state needs inventing, and there is zero risk of a control being missed.
Background attach (`canMutateBackground`) deliberately does NOT compose `isSongGroup` (see its own comment
at EditSlideDrawer.vue:1004-1013) — the plan must decide whether a pending-render slide's BACKGROUND should
also be blocked; the locked copy talks about "customizing" a slide broadly, and a background is a per-slide
customization too, so `canMutateBackground` should very likely also compose `!isPendingRender.value`. This
is a Claude's-Discretion-adjacent call the plan should make explicit, not leave implicit.

**Amber banner precedent to reuse verbatim (styling class names), NOT a new design:**
```html
<!-- Source: ServiceEditorView.vue:310 (existing amber lock-notice pattern to mirror) -->
<div class="... rounded-md border border-amber-800 bg-amber-950 px-4 py-3">
```
Combined with this drawer's own existing notice idiom (the `isSongGroup || serviceLocked` block at
EditSlideDrawer.vue:67-73, which already reuses `border-gray-700 bg-gray-800/50` for its neutral notices) —
the new pending-render notice is the FIRST amber (non-neutral) notice in this specific drawer, so it should
sit in the same "one notice slot" position/order as that existing block (this drawer's own doc comment
enforces "never two notices stacked" — decide precedence explicitly if `serviceLocked` and
`renderState==='pending'` can co-occur; today they can, since lock and render status are independent axes).

### Anti-Patterns to Avoid
- **Do not fold `createdBy` into `lifecycleFields()`** (R233) — that array is also read on CREATE to assert
  ABSENCE of those keys; `createdBy` must be PRESENT on create. Use a sibling helper scoped to update only.
- **Do not skip the existence-check-before-delete for `serviceShareLinks`/`serviceShares`** (R234) — an
  unconditional `deleteDoc` against a doc that was never created evaluates the rule against a null
  `resource`, which errors (denies), not silently succeeds. `shareTokens` is exempt from this concern
  because its deletes are driven by an actual query result set.
- **Do not attempt a cross-slot "find every group referencing this song" scan for R235** — unnecessary and
  a bigger, riskier change than the actual defect. Slide groups are already 1:1 keyed by `slot.id`; fixing
  the per-slot rebuild function is both correct and sufficient.
- **Do not add a NEW DENY-only test for R232 and call it done** — the milestone research and CONTEXT.md are
  explicit that the invite → first-login acceptance flow (`auth.ts`'s read+delete, proven today by
  `rules.test.ts`'s existing "Test B"/"Test D" batch tests at lines 182-257) must be re-run/re-confirmed
  green under the NEW create rule, since it is the flow most likely to be collaterally broken by a gate
  change even though it never itself calls `create` on `inviteLookup`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Org-scoped create authorization for a non-org-keyed collection | A bespoke `orgId`-lookup helper | The exact `isOrgEditor(request.resource.data.orgId)` clause already used by `orgSlugs`/`orgNames`/`shareTokens`/`serviceShareLinks` | One idiom, four existing call sites, zero new surface area to review |
| Field-level immutability-on-update | A new generic "protected fields" framework | The existing `diff().affectedKeys()` one-liner idiom, as a sibling function scoped to this one field | The codebase already has this exact pattern in 3+ places (`preservesLifecycleFields`, `slideGroups.serviceId`, `shareTokens/serviceShareLinks.orgId`) — a new abstraction would be inconsistent with all of them |
| Cascade-delete of denormalized public-share docs | A Cloud Function trigger (`onDocumentDeleted`) | The client-side `deleteQuarter`-style guarded-delete sequence, reused verbatim in shape | `allow delete` rules are ALREADY in place for all three collections (per CONTEXT.md); introducing a Function here would add an unnecessary server-side moving part and deploy surface for a problem the client can already solve inline |

**Key insight:** every one of the five gaps has an existing sibling pattern already live in this codebase.
None of them need a new mechanism — they need the SAME mechanism applied to one more collection/field/slot
case that was missed the first time.

## Common Pitfalls

### Pitfall 1: Testing R232 with only a DENY case proves nothing about the legitimate flow
**What goes wrong:** A plan that adds one ALLOW (editor creates invite) and one DENY (non-editor attempts
create) looks complete but never re-proves that the invite → first-login acceptance flow (which never
calls `inviteLookup`'s `create` rule at all — it only reads and deletes) still passes under the new rule.
**Why it happens:** The acceptance flow and the creation flow are two different Firestore operations
(`create` vs `read`+`delete`) governed by different clauses in the same `match` block; a change to one
clause cannot regress the other by rules syntax alone, but a reviewer scanning "did we test invite flow?"
can be satisfied by the wrong test.
**How to avoid:** Re-run (or add if missing) an explicit assertion that a real `writeBatch` mirroring
`auth.ts`'s exact operation order (delete `inviteLookup`, delete the org's `invites/{email}`, create the
`members/{uid}` doc) still `assertSucceeds` — `rules.test.ts:182-207` ("Test B") already does exactly this
shape and should keep passing untouched; add it to the explicit acceptance criteria for this plan rather
than assuming "existing tests still pass" covers it implicitly.
**Warning signs:** A plan's test list for R232 contains only ALLOW/DENY-create cases, no read/delete-flow
regression.

### Pitfall 2: Folding `createdBy` into the wrong helper breaks org creation entirely
**What goes wrong:** If `createdBy` is added to `lifecycleFields()`'s returned array, the CREATE branch of
`preservesLifecycleFields()` (`!request.resource.data.keys().hasAny(lifecycleFields())`) now DENIES every
org-create request, because `createdBy` is a required key on create.
**Why it happens:** `lifecycleFields()` is a single list consumed by BOTH the create-time "must be absent"
check and the (to-be-added) update-time "must not change" check — these are different semantics that
happen to share a helper today only because all 5 existing fields are absent-on-create AND
immutable-on-update simultaneously. `createdBy` is present-on-create AND immutable-on-update — a
genuinely different combination the shared helper cannot express.
**How to avoid:** Use a separate, update-scoped helper (`preservesCreatedBy()`), not a widened array.
**Warning signs:** `rules.test.ts`'s existing org-creation tests (Test C, "founder creates their own org",
line 209-229) start failing after the R233 change — that is the exact tripwire this pitfall predicts.

### Pitfall 3: `deleteDoc` against a never-created doc is a rules DENY, not a no-op
**What goes wrong:** A service that was never shared has no `serviceShareLinks/{id}` and no
`serviceShares/{key}` doc. An unconditional `await deleteDoc(...)` against either path throws, because
`firestore.rules`' `allow delete: if isOrgEditor(resource.data.orgId)` clause dereferences `resource.data`
on a null `resource` (doc doesn't exist), which is a rules evaluation error, and Firestore treats an
erroring rule as DENY.
**Why it happens:** Developers reasonably expect "delete a thing that isn't there" to be a harmless no-op
(as it would be with, e.g., a SQL `DELETE ... WHERE`), but Firestore security rules evaluate against
`resource` regardless of whether the client's delete "should" be a no-op, and a null-dereference inside a
rule's boolean expression is an error, not `false`.
**How to avoid:** `getDoc()` first; only call `deleteDoc()` when `.exists()` is true — exactly the shape
`deleteQuarter` already uses at `quarters.ts:467-468` and `:476-477`.
**Warning signs:** `deleteService` throws `permission-denied` for the common case of a NEVER-shared service
being deleted — this is the single most likely regression to ship if this pitfall is missed, since most
test fixtures for "delete a service" won't happen to also fixture a pre-existing share.

### Pitfall 4: Reading `service.date` AFTER the service doc is already deleted
**What goes wrong:** The `serviceShares/{slug}__service-{date}` key needs the service's OWN `date` field.
If the cascade deletes the service doc first (or the caller only has the bare `id` string, as
`deleteService`'s current signature does, with no service object), the date is unrecoverable.
**Why it happens:** `deleteService(id: string)` today never looks up the service object — it only ever
needed the `id` to call `deleteDoc`. The new revocation logic is the first thing in this function that
needs a FIELD off the service, not just its id.
**How to avoid:** Look up `services.value.find((s) => s.id === id)` (the store's own in-memory cache,
already populated by the live `onSnapshot` subscription) BEFORE issuing any delete — mirroring how
`deleteQuarter` reads `getQuarter(quarterId)` at the very top of its own function, before any delete.
**Warning signs:** A plan writes `deleteService` without a `services.value.find` (or equivalent) call
before the revocation block — the `serviceShares` artifact will then silently never be found/deleted
because the key computed from `undefined` won't match anything live.

### Pitfall 5: `rebuildSongGroup`'s fix must stay idempotent
**What goes wrong:** A naive fix that ALWAYS returns `{changed: true, slides: []}` when `!songId` (without
checking whether the group is already empty) makes this function non-idempotent — a second reactive pass
over an already-cleared group would report `changed: true` forever, causing `applyRebuildOutcomes` to
issue a redundant `replaceGroupSlides` write on every single reactive recompute (a real cost/thrash
concern, since this runs inside an `{ immediate: true }` watcher keyed to a computed that re-evaluates on
every relevant store mutation).
**Why it happens:** It's tempting to just flip the boolean without re-checking `group.slides.length`,
since "clear" feels like it should always report a change.
**How to avoid:** Gate on `group.slides.length === 0` exactly the way `rebuildScriptureGroup`'s CLEARED
REFERENCE branch already does (`slideGroupMaterializer.ts:894-911`, `hasSectionEntries` check before
emptying) — this repo already has the correct idiom for "only report changed when there's actually
something to clear," reuse it.
**Warning signs:** The new/updated test for "already-empty group + cleared slot" asserts `changed: true`
instead of `changed: false` — that's the idempotence contract breaking.

### Pitfall 6: R236's `canMutateBackground` gate must be reconsidered, not just `canMutate`
**What goes wrong:** `EditSlideDrawer.vue` has TWO separate mutation gates — `canMutate` (label/notes/body/
audio/duplicate/delete) and `canMutateBackground` (deliberately NOT excluding song groups, per its own
documented rationale). Composing `!isPendingRender` into `canMutate` alone leaves the Slide Background
section's attach/remove/override controls still live on a pending-render slide.
**Why it happens:** The two-gate split exists for a DIFFERENT reason (song-group exception), and it is easy
to fix only the gate whose name matches "customization" most obviously.
**How to avoid:** Decide explicitly (and record the decision) whether `canMutateBackground` also composes
`!isPendingRender.value`. The locked copy ("changes made now would be lost when the render finishes")
applies equally to a background attached to a not-yet-rendered slide.
**Warning signs:** A component test exercises label/notes/audio disabling under `renderState: 'pending'`
but never asserts anything about the background-attach affordance — that gap should be closed explicitly,
not left implicit.

## Runtime State Inventory

Not applicable — none of R232-R236 is a rename/refactor/migration phase. All five are net-new gates,
guards, or bug fixes against existing, unrenamed collections/fields/components.

## Code Examples

### R232 — full before/after diff context
```
// Source: firestore.rules:467-475 (live, current)
match /inviteLookup/{email} {
  allow read: if isSignedIn() && request.auth.token.email.lower() == email;
  allow create: if isSignedIn();
  allow delete: if isSignedIn() && (
    request.auth.token.email.lower() == email ||
    isOrgEditor(resource.data.orgId)
  );
}
```

### R233 — the 5 currently-guarded lifecycle fields, for contrast (createdBy is NOT among them)
```
// Source: firestore.rules:113-115 (live, current — confirms createdBy is absent from this list)
function lifecycleFields() {
  return ['active', 'deactivatedAt', 'deactivatedBy', 'reactivatedAt', 'reactivatedBy'];
}
```

### R234 — the three exact write-time key shapes to reverse for delete
```
// Source: services.ts:603 (shareTokens write — token IS the doc id)
await setDoc(doc(db, 'shareTokens', token), { serviceId: service.id, orgId: orgIdValue, ... })
// Source: services.ts:629 (serviceShares write — {slug}__service-{date} composite key)
await setDoc(doc(db, 'serviceShares', `${slug}__service-${service.date}`), { orgId, orgSlug: slug, token, ... })
// Source: services.ts:699 (serviceShareLinks write — service.id IS the doc id, inside a transaction)
tx.set(linkRef /* = doc(db,'serviceShareLinks', service.id) */, { token, orgId, serviceId, ... })
```

### R235 — the exact regression test to flip (full context)
```typescript
// Source: src/utils/__tests__/slideGroupMaterializer.test.ts:686-694 (current — asserts the bug)
it('a song plan item with no song assigned returns the unchanged result', () => {
  const slot = songSlot({ id: 'slot-1', songId: null })
  const group = makeStoredSongGroup(twoSectionStoredSlides)
  const inputs = makeInputs()
  const result = rebuildSongGroup(group, slot, inputs)
  expect(result).toEqual({ changed: false, slides: group.slides })
})
```

### R236 — the `SlideBase.renderState` field this reads (already defined, never consumed by this component)
```typescript
// Source: src/types/slide.ts:50-62 (live, current)
renderState?: 'pending' | 'failed'
```

## State of the Art

Not applicable — no external ecosystem/library version drift is involved in any of these five fixes;
everything is internal-pattern replication.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `canMutateBackground` should also compose `!isPendingRender` (Pattern 5 / Pitfall 6) | Architecture Patterns, Pitfall 6 | Low — if wrong, background-attach stays live on a pending-render slide; a background is arguably less "lost on flip" risk than text/audio customization since it doesn't depend on entry count/order, but the locked copy's wording ("customizing") reads broadly enough that this should be an explicit plan decision, not skipped |
| A2 | Placing the new amber pending-render notice in the SAME "one notice slot" as the existing `isSongGroup \|\| serviceLocked` block (rather than a second independent slot) is the intended interpretation of the drawer's "never two notices stacked" doc comment | Pattern 5 | Low — if the intended UX actually wants BOTH a lock notice and a pending-render notice visible simultaneously (they are independent axes: a locked service can also have a pending-render slide), the single-slot precedence must be decided by the plan, not silently dropped |

**If this table is empty:** N/A — two low-risk UI sequencing assumptions are logged above; every rules/data
finding was verified directly against live source, not assumed.

## Open Questions

1. **Should R236's notice take precedence over, stack with, or be independent from the existing
   `serviceLocked`/`isSongGroup` notice when both conditions are true on the same slide?**
   - What we know: the drawer's own doc comment states "never two notices stacked: when both restrictions
     hold the song-group message wins" — but that comment predates R236's new third condition.
   - What's unclear: a pending-render PPTX-imported slide is never a SONG group (mutually exclusive slot
     kinds), so `isSongGroup && isPendingRender` cannot co-occur — but `serviceLocked && isPendingRender`
     CAN (a locked service can still have an unrendered PPTX import in flight).
   - Recommendation: the plan should pick a precedence (recommend: pending-render wins when both true,
     since it is the more specific, more actionable warning per the drawer's own stated precedence
     philosophy for song-group vs. locked) and encode it as a single computed, not two independent
     `v-if`s that could theoretically both render.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firebase Local Emulator (Firestore) | `src/rules.test.ts` (R232/R233 ALLOW/DENY tests) | Assumed ✓ (existing project infra, already used by 1500+ line rules suite) | — | `npm run test:rules` starts its own; if one is already running, run `npx vitest run --config vitest.rules.config.ts` directly against it (per CLAUDE.md) |

**Missing dependencies with no fallback:** none — this is existing, already-working project infrastructure;
no new dependency is introduced by this phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (app suite) | Vitest, root `vite.config.ts` / `vitest` config (excludes `src/rules.test.ts` and `render-service/**`) |
| Framework (rules suite) | Vitest via `@firebase/rules-unit-testing`, `vitest.rules.config.ts`, run against the Firebase Firestore emulator |
| Config file | `vitest.rules.config.ts` (rules suite); root Vite config (app suite) |
| Quick run command (app) | `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts src/stores/__tests__/services.test.ts src/components/slides/__tests__/EditSlideDrawer.test.ts` |
| Quick run command (rules, emulator already running) | `npx vitest run --config vitest.rules.config.ts --reporter=verbose -t "inviteLookup\|createdBy"` |
| Full suite command (app) | `npx vitest run` |
| Full suite command (rules) | `npm run test:rules` (starts its own emulator — fails "port taken" if one is already running; see CLAUDE.md) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R232 | Editor of target org CAN create an inviteLookup doc for that org | rules/emulator ALLOW | `npx vitest run --config vitest.rules.config.ts -t "inviteLookup"` | ✅ `src/rules.test.ts` (new `describe` block to add) |
| R232 | Signed-in non-editor of target org CANNOT create an inviteLookup doc | rules/emulator DENY | same file/command | ✅ (new case) |
| R232 | Signed-in editor of a DIFFERENT org CANNOT create an inviteLookup doc whose `orgId` targets a org they don't edit (mismatched-orgId payload) | rules/emulator DENY | same file/command | ✅ (new case) |
| R232 | The invite → first-login read+delete acceptance flow (real `writeBatch`, mirroring `auth.ts`) still ALLOWS under the new create rule | rules/emulator regression ALLOW | same file/command | ✅ ALREADY EXISTS at `rules.test.ts:182-207` ("Test B") and `:231-257` ("Test D") — re-run, do not skip |
| R233 | Editor CANNOT `updateDoc` an org doc changing `createdBy` | rules/emulator DENY | `npx vitest run --config vitest.rules.config.ts -t "createdBy"` | ✅ `src/rules.test.ts` (new case) |
| R233 | Editor CAN `updateDoc` an org doc leaving `createdBy` unchanged (ordinary edit) | rules/emulator ALLOW regression | same file/command | ✅ ALREADY EXISTS at `rules.test.ts:122-141` ("allows editor to write org doc") — re-run, do not skip |
| R234 | `deleteService` deletes every matching `shareTokens` doc (incl. 2+ for one service) | unit (mocked Firestore) | `npx vitest run src/stores/__tests__/services.test.ts -t "deleteService"` | ✅ `src/stores/__tests__/services.test.ts` (new cases inside existing `describe('deleteService', ...)` at line 773) |
| R234 | `deleteService` deletes `serviceShareLinks/{id}` when present, and is a no-op (no throw) when absent | unit (mocked Firestore) | same command | ✅ (new cases) |
| R234 | `deleteService` deletes `serviceShares/{slug}__service-{date}` when present, and is a no-op (no throw) when absent | unit (mocked Firestore) | same command | ✅ (new cases) |
| R235 | Clearing a song from a slot whose group holds stale entries clears the group (`changed: true, slides: []`) | unit (pure function) | `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts -t "no song assigned"` | ✅ `slideGroupMaterializer.test.ts:686-694` — EXISTING TEST MUST BE REWRITTEN, not just added-alongside |
| R235 | Clearing a song from a slot whose group is ALREADY empty stays `changed: false` (idempotence) | unit (pure function) | same command | ❌ NEW — add this second case explicitly |
| R235 | Reprise integration: the SAME song assigned to two slots, clearing one slot's song, leaves the OTHER slot's group fully intact | integration (composable-level or store-level) | new test in `src/composables/__tests__/useSlideshowAssembly.test.ts` or a new probe in `slideGroupMaterializer.test.ts` proving two independent `SlideGroup` objects for two slots referencing the same `songId` | ❌ NEW — Wave 0 gap |
| R236 | `renderState: 'pending'` slide shows the amber notice and disables customization controls | component | `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts -t "renderState"` | ✅ `EditSlideDrawer.test.ts` (new cases; `makeAssembled`/`mountDrawer` fixtures already support arbitrary `slide` overrides, confirmed at lines 125-289) |
| R236 | `renderState` absent (undefined/'ready') slide behaves exactly as today (no notice, controls enabled per existing gates) | component regression | same command | ✅ EXISTING coverage (every current test implicitly exercises the undefined case) — assert explicitly with a dedicated case, don't rely on implicit coverage |

### Sampling Rate
- **Per task commit:** the quick run command scoped to the file(s) touched by that task.
- **Per wave merge:** full app suite (`npx vitest run`) AND, for any wave touching `firestore.rules`, the
  rules suite (`npm run test:rules`, or `npx vitest run --config vitest.rules.config.ts` against an
  already-running emulator).
- **Phase gate:** both suites green before `/gsd-verify-work` — full app suite at the documented 2-file
  known-failing baseline (`storage.rules.test.ts`, `RosterView.test.ts`, both pre-existing and unrelated to
  this phase), plus `npm run type-check` (`vue-tsc --build`) clean.

### Wave 0 Gaps
- [ ] A NEW integration-level test proving R235's reprise case end-to-end: two SONG slots in one service
  both assigned to the same `songId`, clear one slot's song, assert (a) that slot's group empties and (b)
  the OTHER slot's group is untouched (still shows the song's slides). This is the one truth CONTEXT.md's
  locked decision cares about most and no existing test proves it directly today — the existing W-03
  diagnosis proved the BUG via `assembleSlideshow`, not via a `rebuildSongGroup`-level two-slot test.
- [ ] No other Wave 0 gaps — `src/rules.test.ts`, `src/stores/__tests__/services.test.ts`,
  `src/utils/__tests__/slideGroupMaterializer.test.ts`, and `src/components/slides/__tests__/EditSlideDrawer.test.ts`
  all already exist with established fixture/mount helpers; every other test above is a new `it()` inside
  an existing `describe` block, not new framework/config work.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes (R232, R233) | Firestore security rules `allow create`/`allow update` predicates, evaluated server-side per request — the exact mechanism already governing every other collection in this file |
| V5 Input Validation | yes (R233) | `diff().affectedKeys()` server-side field-level validation (the client cannot forge a payload that changes `createdBy` regardless of what the client believes it's sending) |
| V1 Architecture | yes (R234) | Deleting a resource must also revoke every derived public-access artifact — a data-integrity/authorization-lifetime concern, not merely tidiness: a live, unauthenticated share URL for a deleted service is an information-disclosure/stale-authorization defect |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Self-invite / privilege forgery (a signed-in user creates an `inviteLookup` targeting a church they don't administer, then accepts it as themselves at a role of their choosing) | Elevation of Privilege | R232's `isOrgEditor(request.resource.data.orgId)` create gate — closes exactly this vector, already proven effective for the sibling `orgSlugs`/`orgNames` collections |
| Provenance forgery (an editor rewrites `createdBy` to disclaim or reassign authorship/audit trail of an org) | Tampering | R233's `diff().affectedKeys()` immutability guard |
| Stale public share link after resource deletion (a deleted service's share URL remains live, serving cached/stale — or in a worse case, silently reused-id — content indefinitely) | Information Disclosure | R234's cascade revocation, mirroring the already-shipped `deleteQuarter` precedent |

## Sources

### Primary (HIGH confidence — verified directly against live source this session)
- `firestore.rules` (live file, lines 1-556 read directly) — inviteLookup, organizations/{orgId}, orgSlugs/
  orgNames, shareTokens/serviceShareLinks/serviceShares rule blocks
- `src/stores/services.ts` (live file) — `deleteService`, `writeSharePayload`, `ensureShareLink`,
  `pickAdoptableToken` usage, `clearSongFromSlot`
- `src/stores/quarters.ts` (live file) — `deleteQuarter` (the revocation precedent)
- `src/utils/slideGroupMaterializer.ts` (live file, full read) — `rebuildSongGroup`, `deriveGroupEntries`,
  `rebuildScriptureGroup`'s CLEARED REFERENCE idempotence precedent
- `src/composables/useSlideshowAssembly.ts` (live file, full read) — the reactive rebuild-and-write loop
  that invokes `rebuildGroup`/`rebuildSongGroup` per slot
- `src/components/slides/EditSlideDrawer.vue` (live file, partial read, 1-1112 of 1519 lines) — existing
  prop/computed patterns for `assembledSlide.slide.*`, `canMutate`, `canMutateBackground`
- `src/types/slide.ts` — `SlideBase.renderState` field definition and doc comment
- `src/rules.test.ts` (live file, lines 1-280 read) — existing R104 self-service-membership test suite,
  the exact invite-acceptance regression shape ("Test B"/"Test D") to re-confirm
- `src/utils/__tests__/slideGroupMaterializer.test.ts` (relevant sections read) — the exact test that locks
  in the R235 defect today
- `src/stores/__tests__/services.test.ts` (relevant sections read) — existing `deleteService` test
  structure/mocking conventions
- `.planning/milestones/v1.4-phases/30-.../30-VERIFICATION.md` — the original W-03 diagnosis (Phase 30),
  confirming R235's root cause and its "pre-existing, byte-identical at 0ecc84f" provenance
- `.planning/PENDING-VERIFICATION.md` (C2, C4, C5 sections) — the original recorded findings for R232/R233
  (C2), R236 (C4), R234 (C5)

### Secondary (MEDIUM confidence)
- `.planning/phases/80-security-data-integrity-hardening/80-CONTEXT.md` — locked design decisions (treated
  as authoritative scope, re-verified rather than re-litigated per the task's focus)
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` — requirement wording and phase success criteria

### Tertiary (LOW confidence)
- None — every claim in this document was verified directly against live source or an existing,
  already-passing test this session; nothing here is `[ASSUMED]` in the package-provenance sense (no
  packages are involved). The two items in the Assumptions Log are UX-sequencing judgment calls, not
  unverified factual claims.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new packages
- Architecture: HIGH — every integration point re-verified against live source this session, all five
  CONTEXT.md claims confirmed byte-for-byte
- Pitfalls: HIGH — four of six pitfalls are drawn from actual existing code comments/prior verification
  reports in this exact codebase (W-03, WR-03, T-41-09, CR-01), not generic Firestore-rules folklore

**Research date:** 2026-08-24
**Valid until:** Stable for the life of this phase's plans — nothing here depends on external library
versions or ecosystem state that could drift; re-verify only if `firestore.rules`,
`slideGroupMaterializer.ts`, or `EditSlideDrawer.vue` change again before this phase is planned/executed.
