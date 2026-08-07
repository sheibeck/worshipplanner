# Phase 41: Sharing Correctness - Pattern Map

**Mapped:** 2026-08-07
**Files analyzed:** 5 (2 modified core files, 1 rules file, 2 test files)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|------------------|----------------|
| `src/stores/services.ts` (`ensureShareLink`, `buildServiceSnapshot`, `maybeRefreshShareLink`, replacing/wrapping `createShareToken`) | service (Pinia store action) | CRUD + read-modify-write with soft-fail secondary write | `src/stores/quarters.ts::finalizeAndShare` (lines 397-484) | exact — same author, same soft-fail/overwrite-in-place/PII-guard shape, already the acknowledged template for the current `createShareToken` |
| `firestore.rules` — loosened `shareTokens` update rule (currently lines 216-225) | config (security rules) | request-response (rule evaluation) | `firestore.rules:261-269` (`serviceShares`) | exact — CONTEXT.md names this the literal rule to mirror |
| `firestore.rules` — new `serviceShareLinks/{serviceId}` block | config (security rules) | request-response (rule evaluation) | `firestore.rules:261-269` (`serviceShares`), read-clause narrowed to org-editor only (no public read) | exact — same block, one clause removed |
| `src/rules.test.ts` — replace shareTokens "update stays false" test; add `serviceShareLinks` describe block | test (emulator-backed rules test) | request-response | `src/rules.test.ts:495-588` (`serviceShares` describe block) + `src/rules.test.ts:590-630` (`shareTokens` describe block, the test being replaced) | exact |
| `src/stores/__tests__/services.test.ts` — extend `firebase/firestore` mock with `where`/`getDocs`; add `ensureShareLink` describe block | test (unit, mocked Firestore) | CRUD (mocked) | same file's existing `createShareToken` test block (search for `describe('createShareToken'` further down the file) — no other test file in the repo mocks a `where`-filtered query; this is the first one | role-match — mock-extension pattern has no true prior analog, see note below |

## Pattern Assignments

### `src/stores/services.ts` — `ensureShareLink` / `buildServiceSnapshot` / refresh hooks

**Analog:** `src/stores/quarters.ts::finalizeAndShare` (lines 397-484), and the function being reworked, `src/stores/services.ts::createShareToken` (lines 353-441).

**Token generation pattern** (`services.ts:354-357`, identical at `quarters.ts:404-406`):
```typescript
const array = new Uint8Array(18)
crypto.getRandomValues(array)
const token = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
```
Reuse verbatim in `ensureShareLink`'s "no existing token" branch.

**PII guard — `nameById` Map, never raw `Person`** (`services.ts:375-387`, mirrored at `quarters.ts:408-415`):
```typescript
const rosterStore = useRosterStore()
const quartersStore = useQuartersStore()
const nameById = new Map(rosterStore.people.map((p) => [p.id, p.name]))
const resolved = resolveServiceRoleAssignments(service, quartersStore.quarters, rosterStore.roles)
const roleAssignments = resolved.map((r) => ({
  roleId: r.roleId,
  roleName: r.roleName,
  group: r.group,
  personNames: r.effectivePersonIds.map((id) => nameById.get(id) ?? id),
}))
```
This block — plus the `serviceSnapshot` object literal immediately after it (`services.ts:389-399`) — is exactly what CONTEXT.md/RESEARCH.md ask to extract into a shared pure function (`buildServiceSnapshot`). Extract the whole `slotsWithBpm` resolution (`services.ts:359-373`) + PII guard + snapshot literal together; both `ensureShareLink`'s create path and its refresh-in-place path call it.

**Overwrite-in-place write** (`services.ts:401-406`):
```typescript
await setDoc(doc(db, 'shareTokens', token), {
  serviceId: service.id,
  orgId: orgIdValue,
  serviceSnapshot,
  createdAt: serverTimestamp(),
})
```
For the refresh path, this becomes a `setDoc`/`merge` (or explicit re-write) that does NOT touch `createdAt` semantics for identity — copy `quarters.ts`'s `quarterShares` overwrite (`quarters.ts:460-475`), which is the established "overwritten in place on every finalize" precedent, rather than treating `shareTokens`'s current one-shot `setDoc` as immutable.

**Slug/memorable-URL soft-fail write** (`services.ts:414-438`, identical structure at `quarters.ts:442-481`):
```typescript
try {
  const orgRef = doc(db, 'organizations', orgIdValue)
  const orgSnap = await getDoc(orgRef)
  const orgData = orgSnap.exists() ? orgSnap.data() : {}
  let slug = orgData.slug as string | undefined
  if (!slug) {
    const derived = deriveSlug((orgData.name as string | undefined) ?? '')
    const base = derived || 'org'
    slug = await claimSlug(base, orgIdValue)
    await updateDoc(orgRef, { slug })
  }
  await setDoc(doc(db, 'serviceShares', `${slug}__service-${service.date}`), {
    orgId: orgIdValue,
    orgSlug: slug,
    serviceSnapshot,
    token,
    updatedAt: serverTimestamp(),
  })
} catch (err) {
  console.error(
    'createShareToken: memorable-URL slug/serviceShares write failed — the opaque share link above already succeeded',
    err,
  )
}
```
This is the WR-06 soft-fail template. Copy this try/catch shape for BOTH (a) the memorable-URL write in `ensureShareLink` and (b) the new `maybeRefreshShareLink` wrapper around the whole refresh call from `updateService`/`setRoleOverride`/`clearRoleOverride` — the outer wrapper needs its own try/catch with a distinct log prefix (e.g. `'[services] share-link refresh failed:'`) so a share hiccup never fails the caller's save, per CONTEXT.md.

**Error logging convention:** `console.error('<functionName>: <what failed> — <why it's non-fatal>', err)` — every soft-fail catch in this codebase follows this exact shape (function name prefix, human sentence, trailing `err`). Use it for both the new memorable-URL catch and the new refresh-hook catch.

---

### `firestore.rules` — loosened `shareTokens` update + new `serviceShareLinks` block

**Analog:** `firestore.rules:261-269` (`serviceShares`).

**The exact block to mirror** (read in full, verbatim):
```
match /serviceShares/{shareId} {
  allow read: if true;
  allow create: if isOrgEditor(request.resource.data.orgId);
  allow update: if isOrgEditor(resource.data.orgId)
                   && request.resource.data.orgId == resource.data.orgId;
  allow delete: if isOrgEditor(resource.data.orgId);
}
```

**Current `shareTokens` block to modify** (`firestore.rules:216-225`):
```
match /shareTokens/{token} {
  allow read: if true;
  allow create: if isSignedIn();
  allow update: if false;
  allow delete: if isOrgEditor(resource.data.orgId);
}
```
Change only the `allow update` line to:
```
  allow update: if isOrgEditor(resource.data.orgId)
                   && request.resource.data.orgId == resource.data.orgId;
```
Leave `allow create: if isSignedIn()` and `allow delete: if isOrgEditor(...)` untouched — those are not part of R077's scope and `shareTokens` docs are created before an `orgId`-scoped editor check would even be meaningful for the very first write in some flows (matches existing behavior).

**New block** — same shape as `serviceShares`, with the `allow read` clause narrowed to org-editor (no public read), inserted adjacent to the `shareTokens` block for readability:
```
match /serviceShareLinks/{serviceId} {
  allow read: if isOrgEditor(resource.data.orgId);
  allow create: if isOrgEditor(request.resource.data.orgId);
  allow update: if isOrgEditor(resource.data.orgId)
                   && request.resource.data.orgId == resource.data.orgId;
  allow delete: if isOrgEditor(resource.data.orgId);
}
```

**CRITICAL pitfall (per RESEARCH.md Pitfall 2), applies to every clause above:** `resource` is undefined on `create` — always use `request.resource.data.orgId` there. On `update`, `resource.data.orgId` is the existing doc, `request.resource.data.orgId` is the incoming doc; the equality check is what makes `orgId` immutable. Do not swap these.

**Reminder from CONTEXT.md/RESEARCH.md's Specifics section:** lines near 216, 227, 238, 254, 271 in this file have a mangled `\ ` comment marker artifact. Do not "fix" this as part of the diff — leave it exactly as-is unless it breaks the rules parser.

---

### `src/rules.test.ts` — replace stale test, add `serviceShareLinks` describe block

**Analog for auth-context construction** (used throughout the file, e.g. lines 68-73, 598-604):
```typescript
await seedMembershipDoc('orgA', 'userA', 'editor')
const context = testEnv.authenticatedContext('userA')
const db = context.firestore()
await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA')))
```
`seedMembershipDoc(orgId, uid, role)` (`src/rules.test.ts:33-41`) and `seedDoc(path, data)` (`src/rules.test.ts:44-51`) are the two helpers to reuse — both bypass rules via `testEnv.withSecurityRulesDisabled`. `testEnv.unauthenticatedContext()` is the deny-case counterpart (line 55, 584, 616).

**The stale test to REPLACE, not merely edit** (`src/rules.test.ts:621-629`):
```typescript
it('denies updating a shareTokens doc (frozen snapshot — update stays false)', async () => {
  await seedMembershipDoc('orgA', 'userA', 'editor')
  await seedDoc('shareTokens/tok-abc', { orgId: 'orgA', quarterId: 'q1' })
  const context = testEnv.authenticatedContext('userA')
  const db = context.firestore()
  await assertFails(
    setDoc(doc(db, 'shareTokens', 'tok-abc'), { orgId: 'orgA', quarterId: 'q1', tampered: true }),
  )
})
```
Replace with two tests: an ALLOW case (same org editor, `orgId` unchanged, `assertSucceeds`) and a DENY case (different org's editor, `assertFails`) — the shape is identical to the `serviceShares` update tests already in the file just above the `shareTokens` describe block (lines ~495-560 region; grep `describe('serviceShares'` for the exact update-test pair to copy). This is the genuine ALLOW-case test the orchestrator flagged as mandatory.

**Describe-block scaffold to mirror wholesale for `serviceShareLinks`** (`src/rules.test.ts:590-630`, the `shareTokens` describe block header/shape, and `src/rules.test.ts:495-588`, the `serviceShares` describe block covering create/update/delete allow+deny): build a new `describe('serviceShareLinks — org-editor-scoped, no public read', ...)` block with:
- read: allow for org editor, DENY for unauthenticated (unlike `shareTokens`'s public-read test at line 591 — this is the one inverted assertion, since `serviceShareLinks` has no public read)
- create: allow for org editor of `request.resource.data.orgId`, deny for a different org's editor
- update: allow for the owning org's editor with `orgId` unchanged, deny for a different org's editor
- delete: allow for owning org's editor, deny for different org / unauthenticated (mirror lines 566-587)

---

### `src/stores/__tests__/services.test.ts` — mock extension + `ensureShareLink` tests

**Analog:** the file's own existing `firebase/firestore` mock block (lines 25-66) — no other file in the repo mocks a `where`-filtered query; confirmed no better analog exists (`grep -rn "where(\|getDocs" src/stores/` per RESEARCH.md turns up only `roster.ts`'s unfiltered `getDocs`, no `where` anywhere in the codebase). Treat this mock block itself as the analog to extend in place, not a different file to copy from.

**Current mock, exact shape to extend** (`src/stores/__tests__/services.test.ts:25-66`):
```typescript
vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((db, ...segments) => ({ path: segments.join('/') })),
    doc: vi.fn((db, ...segments) => ({ id: segments[segments.length - 1] ?? 'mock-id', path: segments.join('/') })),
    onSnapshot: vi.fn(/* ... */),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-service-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    getDoc: vi.fn(() =>
      Promise.resolve({
        exists: () => true,
        data: () => ({ name: 'Grace Church', slug: 'grace-church' }),
      }),
    ),
    setDoc: vi.fn(() => Promise.resolve()),
    deleteField: vi.fn(() => '__DELETE_FIELD_SENTINEL__'),
    query: vi.fn((ref) => ref),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => ({ seconds: 1000000, nanoseconds: 0 })),
  }
})
```
Per RESEARCH.md Pitfall 4, add exactly two exports:
```typescript
where: vi.fn((field, op, value) => ({ field, op, value })),
getDocs: vi.fn(() => Promise.resolve({ empty: true, docs: [] })),
```
Default `getDocs` to the "no existing tokens" (empty) case; override per-test with `vi.mocked(getDocs).mockResolvedValueOnce({ empty: false, docs: [...] })` for adoption tests. Note `getDoc`'s default mock (`exists: () => true, data: () => ({ name: 'Grace Church', slug: 'grace-church' })`) is shared across ALL `getDoc` calls in a test — `ensureShareLink`'s own `getDoc(serviceShareLinks/{serviceId})` call will need per-test `mockResolvedValueOnce` overrides too, since the shared default doesn't shape-match a `serviceShareLinks` doc (`token`/`orgId`/`serviceId`/`createdAt`/`updatedAt`).

**Existing test coverage to adapt, not discard:** search this file for `describe('createShareToken'` — its existing tests (mint case, PII-guard assertion) are the direct precedent for the new `ensureShareLink` describe block's "zero pre-existing tokens" and "personNames only, no raw Person" cases. Re-point them at the new function name rather than writing from scratch.

## Shared Patterns

### Soft-fail secondary write (WR-06)
**Source:** `src/stores/services.ts:414-438` (existing `createShareToken`'s `serviceShares` write) and `src/stores/quarters.ts:442-481` (`finalizeAndShare`'s equivalent).
**Apply to:** the memorable-URL write inside `ensureShareLink`, AND the new outer `maybeRefreshShareLink` wrapper called from `updateService`/`setRoleOverride`/`clearRoleOverride`.
```typescript
try {
  // ... the write(s) that must never fail the caller's save ...
} catch (err) {
  console.error('<context>: <what failed> — <why non-fatal>', err)
}
```

### PII guard (D-04/D-24) — names only, via Map
**Source:** `src/stores/services.ts:375-387`, mirrored `src/stores/quarters.ts:408-415`.
**Apply to:** `buildServiceSnapshot` (the extracted pure function) — resolve `personId -> name` through a `Map`, never store the raw `Person` object.

### Org-scoped update with immutable `orgId` (CR-01 pattern)
**Source:** `firestore.rules:244-269` (`quarterShares`, `serviceShares`).
**Apply to:** the loosened `shareTokens` update rule and the new `serviceShareLinks` block — every `allow update` clause must be `isOrgEditor(resource.data.orgId) && request.resource.data.orgId == resource.data.orgId`. Never substitute `isSignedIn()`.

### Emulator rules-test scaffold
**Source:** `src/rules.test.ts:33-51` (`seedMembershipDoc`, `seedDoc`) + `testEnv.authenticatedContext(uid)` / `testEnv.unauthenticatedContext()`.
**Apply to:** all new/replaced `shareTokens` and `serviceShareLinks` tests. Always seed the membership doc for the *acting* user's org before constructing `authenticatedContext`, and seed the *target* doc's `orgId` field explicitly since that's what every rule branches on.

## No Analog Found

None. Every file in scope has a strong same-repo analog; the closest thing to a gap is the `where`/`getDocs` mock extension in `services.test.ts`, which is a first-of-its-kind addition to an existing, well-understood mock block rather than a file with no precedent at all — documented above rather than listed as a true gap.

## Metadata

**Analog search scope:** `src/stores/`, `src/stores/__tests__/`, `firestore.rules`, `src/rules.test.ts`, `src/views/ShareView.vue`, `src/components/ServiceCard.vue`, `src/views/ServiceEditorView.vue` (integration points only, not classified as files-to-modify per CONTEXT.md's "unchanged from caller's point of view" note).
**Files scanned:** 7 read directly (this session) + prior RESEARCH.md full-file reads of `services.ts`, `firestore.rules`, `quarters.ts:390-490`, `ShareView.vue:1-150`, `rules.test.ts` structure, `services.test.ts:1-70,661-800`.
**Pattern extraction date:** 2026-08-07
