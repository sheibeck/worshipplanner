---
phase: 118-security-firestore-rules-and-public-share-hardening
reviewed: 2026-09-05T00:00:00Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - firestore.rules
  - src/stores/services.ts
  - src/stores/quarters.ts
  - src/views/ShareView.vue
  - src/rules.test.ts
  - src/stores/__tests__/services.test.ts
  - src/stores/__tests__/services.sharePii.test.ts
  - src/views/__tests__/ShareView.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 118: Code Review Report

**Reviewed:** 2026-09-05
**Depth:** deep (cross-file: rules ↔ store ↔ view ↔ internal diff consumer)
**Files Reviewed:** 6 source + 3 test files
**Status:** issues_found (no BLOCKERs — 3 WARNING, 2 Info)

## Summary

Phase 118 is the milestone's highest-risk phase (Firestore rules + public-share PII). I traced
every claimed invariant against the actual diff and the real call chains.

**The core security work is sound and correctly proven:**

- **R346 choke point (the critical check) holds.** `writeSharePayload` (services.ts:815-862) is
  the *only* writer of a service `serviceSnapshot`, and it routes BOTH the `shareTokens/{token}`
  write (:820) and the `serviceShares/{slug}...` write (:847) through the *same*
  `toPublicServiceSnapshot(buildServiceSnapshot(...))` result (:818). No other code path persists a
  public service-share doc — `deleteService`'s `serviceShares` reference (:619) is a delete, not a
  write. Service-level `notes` is stripped at the choke point; per-slot `notes`/`body` are stripped
  unconditionally inside `buildServiceSnapshot`'s new per-slot allowlist. The ShareView render gate
  (ShareView.vue:104-110) additionally refuses to render free-text, covering already-deployed legacy
  docs the projection can never retroactively fix.
- **The deviation is safe.** `serviceLockDiff.ts::diffServiceSnapshots` still reads
  `previous.notes !== current.notes` (:192) for the "Service notes changed" re-lock notice, and
  `buildServiceSnapshot` still returns `notes` for that org-internal consumer (lockSnapshots/current,
  a member-read/editor-write doc — ServiceEditorView.vue:3117-3120). The diff never reads per-slot
  notes/body, so unconditional slot stripping does not regress it.
- **R341** guards only draft branch 1 (`storedStatus()=='draft' && !keys().hasAny(['createdBy','createdAt'])`),
  does not reach branches 2/3, and has zero blast radius on live writes (no draft `updateDoc` path in
  services.ts emits createdBy/createdAt — the only createAt write is the `addDoc` create at :355). The
  DENY tests genuinely `assertFails` and would have passed before the fix.
- **R343** `list: if false` closes enumeration; a repo-wide grep confirms zero `getDocs`/`query` on
  orgSlugs/orgNames — only getDoc/setDoc-by-id — so the flat deny breaks no legitimate path.
- **R342/R348** are document+pin only; no grant narrowed; the pinning tests assert the accepted
  invariants (super-admin CAN write members = ALLOW; admin treated as editor = ALLOW).
- **R347** is byte-identical: the diff adds only comments; both id strings are unchanged.
- **Test integrity:** the 3 "fixed" services.test.ts assertions were legitimately invalidated (they
  asserted `snapshot.notes` on the now-correctly-stripped public payload). They were re-pointed to
  `name` to keep proving the refresh mechanism AND add a positive `'notes' in snapshot === false`
  assertion — strengthened, not weakened. The new sharePii test asserts PII absence across every slot
  kind plus `JSON.stringify` scans.

The findings below are all adjacent robustness / residual-PII gaps, none of which block the phase's
declared scope, but two of which deserve attention before the milestone closes its "public PII" theme.

## Warnings

### WR-01: Stage-marker free-text `note` still rides the public projection and renders verbatim on the anonymous `?view=stage` page

**File:** `src/stores/services.ts:214` (projection) → `src/components/stage/StageMarkerChip.vue:71` (render)
**Issue:** R346 closes free-text PII for service-level `notes` and per-slot `notes`/`body`, but the
same public snapshot still carries `marker.note` in the stageLayout projection:
```js
// services.ts:211-214
// `note` is planner-authored tech instruction (non-PII); conditional spread keeps it ABSENT...
...(marker.note ? { note: marker.note } : {}),
```
`StageMarkerChip.vue:71` renders it verbatim (`<div v-if="marker.note" ...>{{ marker.note }}</div>`),
and the public `?view=stage` share page (ShareView.vue:19-32 → StageLayoutView → StageMarkerChip)
shows it to an unauthenticated caller. This is the *exact* free-text-on-a-public-page class R346
exists to close: an editor who types a phone number or personal instruction into a stage-marker note
publishes it to anyone with the (guessable, R347) URL.

This is **pre-existing and out of this phase's declared scope** (R346 = notes/body) and was a
deliberate, documented decision (T-107-01 labels `note` "non-PII"). But that "non-PII" assumption is
the same one that was wrong for service `notes`, and the milestone's stated goal is public-PII
hardening. If the assumption is wrong this borders on Critical.
**Fix:** Re-evaluate T-107-01 against R346's threat model. Either (a) drop `note` from the public
stage projection (keep it only in the org-internal StageLayoutEditor/print paths), or (b) record an
explicit, current-dated re-acceptance in the phase docs stating stage-marker `note` is knowingly
published free-text — do not leave the inconsistency silent while service/slot notes are being closed.

### WR-02: New per-slot `switch` has no default arm — an unrecognized slot `kind` maps to `undefined` and would make the entire share write throw

**File:** `src/stores/services.ts:130-181` (`buildServiceSnapshot` slot projection)
**Issue:** The old code mapped every slot and returned the slot itself for non-SONG kinds
(`return slot`), so a slot with an unexpected `kind` (corrupt/legacy/future data cast out of the
`ServiceSlot` union at the Firestore boundary) was passed through intact. The new exhaustive `switch`
covers the 8 known kinds but has **no `default`**:
```js
const slotsWithBpm = orderedSlots.map((slot): ServiceSlot => {
  switch (slot.kind) {
    case 'SONG': ...
    ...
    case 'MISC': ...
  } // <-- no default; falls off the end for any other kind → returns undefined
})
```
TypeScript accepts this because the compile-time union is exhaustive, but a runtime slot whose `kind`
is outside the union yields `undefined` in `snapshot.slots`. That `undefined` then flows into
`setDoc(doc(db,'shareTokens',...), { serviceSnapshot, ... })` (services.ts:820) — the primary write,
which is **not** wrapped in the try/catch that guards the secondary serviceShares write — and
Firestore rejects `undefined` at any depth, throwing out of the whole share-link path. It also lands
`undefined` in the internal lockSnapshots/current snapshot (ServiceEditorView.vue:3120).
**Fix:** Add a defensive default that preserves the old pass-through-as-structured behavior, e.g.:
```js
default:
  return { id: slot.id, kind: slot.kind, position: slot.position } as ServiceSlot
```
(mirrors the `buildSlotsFromTemplate` `KNOWN_SLOT_KINDS` defensiveness already used in slotTypes.ts).

### WR-03: The R346 render gate rests on an `any`-typed snapshot, so a future re-introduction of a free-text field is not type-caught

**File:** `src/views/ShareView.vue:164`
**Issue:** `const serviceSnapshot = ref<any>(null)`. The render-side gate (the security control for
already-deployed legacy docs) is enforced *only* by the template no longer referencing `slot.notes` /
`slot.body` / `serviceSnapshot.notes`. Because the ref is `any`, neither `npm run type-check` nor the
`PublicServiceSnapshot` type will catch a future edit that re-adds `{{ slot.notes }}` — the exact
regression R346 guards against, on a security-critical public surface. The Phase 118 commit history
shows this file has previously accreted free-text renders; `any` removes the compiler as a guardrail.
**Fix:** Type it explicitly — `ref<PublicServiceSnapshot | null>(null)` (import the type from
`@/stores/services`). Structured-only fields then fail type-check the moment a free-text field is
re-added. (`stageLayout`/legacy fields may need a widened local type; that is preferable to `any`.)

## Info

### IN-01: R341 guards the draft UPDATE path only — `allow create` still accepts an arbitrary `createdBy`/`createdAt`

**File:** `firestore.rules:207`
**Issue:** `allow create: if isOrgEditor(orgId) && request.resource.data.status == 'draft'` does not
constrain provenance, so an editor can set any `createdBy`/`createdAt` at create time. R341 correctly
scopes to the finding (draft update), and impact is low (the creator can only mis-attribute their own
new doc), and in practice the app's create path (services.ts:355) never writes `createdBy` at all — so
the guarded field is effectively defensive-only. Noting for completeness: the provenance guarantee is
update-time, not end-to-end.
**Fix:** If provenance integrity is desired, gate create with
`request.resource.data.get('createdBy','') == request.auth.uid` (only if/when the app begins writing
createdBy on services). Otherwise document the create-time gap as accepted.

### IN-02: R348/R342 pin-tests seed a partial org and rely on `isOrgActive` defaulting to active

**File:** `src/rules.test.ts:33-41` (`seedMembershipDoc`) used by the R348 test (:1013) and the R342
test (:806-820)
**Issue:** `isOrgEditor` also requires `isOrgActive(orgId)`, but the synonymity/members-write tests
seed only a membership (and, for R342, an org doc with just `{ name }`) and pass — they lean on
`isOrgActive` returning true for an org with no explicit active/status field. The tests are correct
today, but they don't assert the active-gate, so a future change to `isOrgActive`'s default would
change these results silently rather than via an explicit assertion.
**Fix:** Optional — no action required; if hardening test intent, seed an explicit active-org doc so
the ALLOW is unambiguous about *why* it succeeds.

---

_Reviewed: 2026-09-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
