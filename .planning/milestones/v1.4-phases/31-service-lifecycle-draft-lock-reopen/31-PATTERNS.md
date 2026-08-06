# Phase 31: Service Lifecycle — Draft Lock & Reopen — Pattern Map

**Mapped:** 2026-07-29
**Files analyzed:** 8 source + 4 test targets
**Analogs found:** 9 strong in-repo precedents / 3 explicit "no precedent" findings

Read alongside `31-CONTEXT.md`. This document answers only "what existing code should the new code
copy?" — it does not re-decide anything CONTEXT.md locked.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `firestore.rules` (services status guard) | config / rules | request-response | `quarterShares` update rule, `firestore.rules:117-118` | role-match (first *field-diff* rule on a nested collection) |
| `firestore.rules` (slideGroups guard) | config / rules | request-response | `isOrgEditor()` cross-doc `get()`, `firestore.rules:16-19` | role-match — **no precedent for a `get()` on a sibling collection doc** |
| `src/stores/services.ts` (write guard) | store | CRUD | `useSlideshowAssembly`'s `canWrite` gate (`useSlideshowAssembly.ts:138-141, 268, 340, 396`) | role-match — **no precedent for a guard inside a Pinia store action** |
| `src/stores/slideGroups.ts` (write guard) | store | CRUD | same as above | role-match |
| `src/views/ServiceEditorView.vue` (lock computed, status actions, banner, reopen dialog) | view/component | request-response | itself: `isExportedLocked:1288`, delete-confirm Teleport `:211-237` | exact |
| `src/components/slides/*` (lock layer) | component | request-response | `canMutate` (`EditSlideDrawer.vue:432`), `canReorder` (`SlideGrid.vue:596`) | exact |
| `src/components/NewServiceDialog.vue` (taken-Sunday default) | component | transform | `PcImportModal.vue:235-245` (props `{open}` + store access) | exact |
| `src/utils/quarterDates.ts` or new sibling (`nextFreeSunday`) | utility (pure) | transform | `generateSundaysInQuarter` (`quarterDates.ts:11-24`) | exact |
| `src/rules.test.ts` (status-guard tests) | test | request-response | `describe('Editor vs viewer write permissions')` `rules.test.ts:121-145` | exact |
| `src/utils/__tests__/quarterDates.test.ts` | test | transform | itself | exact |
| `src/views/__tests__/ServiceEditorView.test.ts` | test | request-response | itself (`shallowMount` + `mockUpdateService` harness) | exact |
| `src/components/__tests__/NewServiceDialog.test.ts` (**new file**) | test | transform | `CsvImportModal.test.ts` / `PptxImportModal.test.ts` | role-match — no existing test for this component |

---

## 1. Layer A — Firestore rules

### 1a. Every existing rule that inspects `resource.data` (the real in-repo precedent set)

There are exactly **five** places today where a rule reads stored data rather than only
`request.auth`. All five are at the ROOT level; **none is inside `/organizations/{orgId}/…`**, and
none has ever compared a stored field against an incoming field on the same document.

| Rule | Line | Shape |
|---|---|---|
| `inviteLookup` delete | `firestore.rules:80-83` | `isOrgEditor(resource.data.orgId)` — stored field feeds a helper |
| `shareTokens` delete | `:94` | same shape |
| `orgSlugs` create | `:104` | `isOrgEditor(request.resource.data.orgId)` — **incoming** field (contrast case) |
| `quarterShares` create/update/delete | `:116-121` | **the closest analog** |
| `serviceShares` create/update/delete | `:133-138` | identical copy of quarterShares |

**Copy this exact shape** for the services status guard — it is the only immutable-field-diff
precedent in the repo:

```javascript
// firestore.rules:114-122 — quarterShares
allow create: if isOrgEditor(request.resource.data.orgId);
allow update: if isOrgEditor(resource.data.orgId)
                 && request.resource.data.orgId == resource.data.orgId;
```

Note what it demonstrates and what the planner must extend:
- `resource.data.X` = stored, `request.resource.data.X` = incoming. Research Question 1 in CONTEXT.md
  is exactly this distinction, and this rule is the in-repo proof that the codebase already
  understands it.
- It splits `allow write` into `create` / `update` / `delete`. **The services rule
  (`firestore.rules:51-54`) currently uses a single `allow write: if isOrgEditor(orgId)`** — it must be
  split the same way, because a status guard that reads `resource.data.status` is meaningless on
  create (no `resource`).
- It has NO comparable "…unless this specific transition" carve-out. The reopen (`planned|exported →
  draft`) and export (`planned → exported` + `pcExportedAt`/`pcPlanId`, D-09) allowances have **no
  in-repo precedent** — the planner is writing the first one. Say so in the plan rather than implying
  a template exists.
- Every one of these rules carries a multi-line comment naming the incident/review-finding that
  motivated it (`WR-01`, `CR-01`). Match that comment density; it is the file's convention.

### 1b. `slideGroups` — cross-document read

`slideGroups` is not matched explicitly at all today: it falls through to the catch-all
`match /{collection}/{docId} { allow read, write: if isOrgEditor(orgId); }` at `firestore.rules:71-73`.
Adding a status guard therefore requires **promoting it to its own explicit `match` block first** —
the same move the `songs/{songId}/lyrics/{lyricsId}` block at `:65-67` documents (with the incident
comment at `:60-64` explaining that a missing explicit match fell through and broke the Lyrics tab
with permission-denied). Copy that comment style.

The only cross-document-read precedent in the file is the helper pair at `:11-19`:

```javascript
function isOrgMember(orgId) {
  return isSignedIn() &&
    exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid));
}
function isOrgEditor(orgId) {
  return isSignedIn() &&
    get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.role in ['editor', 'admin'];
}
```

A `isServiceDraft(orgId, serviceId)` helper would be written in exactly this shape. Two caveats the
planner must weigh (this is CONTEXT.md's Research Question 2, unanswered by precedent):
- Every write to `slideGroups` already pays one `get()` for `isOrgEditor`; a service `get()` doubles it.
- **A group document does not carry its service id in its doc id** — the doc id IS the *slot* id
  (`slideGroups.ts:77-130`). `serviceId` is a *field* on the document
  (`slideGroups.ts:189-198`), so the rule would have to read
  `request.resource.data.serviceId` (spoofable by the writer) or `resource.data.serviceId` (absent on
  create). This is a concrete, structural obstacle to the rules-level option and should be stated in
  the plan.

### ★ 1c. The write the lock must NOT block, beyond D-09's export

Besides the export write, **`useSlideshowAssembly` writes to `slideGroups` automatically whenever an
editor merely OPENS a service** — the materialization watcher / `ensureGroupMaterialized`
(`useSlideshowAssembly.ts:337-365`, gated only on `canWrite`, which
`ServiceEditorView.vue:1366` supplies as `computed(() => authStore.isEditor)`). If a `slideGroups`
rule denies writes for non-draft services without the composable's `canWrite` also being narrowed,
**every locked service will throw permission-denied on load**, unprompted by any user action. Narrow
`canWrite` in the SAME change as the rule, not after it.

---

## 2. Layer B — the store guard

### There is no precondition/guard pattern in either store today. This would be the first.

Every action in `src/stores/services.ts` validates exactly two things and nothing else:

```typescript
// services.ts:84-90 — the canonical shape, repeated in deleteService, setRoleOverride, clearRoleOverride
async function updateService(id: string, data: Record<string, unknown>) {
  if (!orgId.value) return                    // ← the ONLY precondition anywhere in this store
  await updateDoc(doc(db, 'organizations', orgId.value, 'services', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}
```

`createService:68` is the one variant — it *throws* (`throw new Error('No orgId set — call subscribe() first')`)
rather than silently returning. `slideGroups.ts` has no preconditions at all; its actions take `orgId`
as a parameter rather than reading store state (`materializeGroupIfMissing:113`, `deleteGroup:138`,
`setGroupBedMedia:173`, `replaceGroupSlides:256`), so a `services` store guard there would be a new
cross-store dependency.

**Closest analog for the guard's shape** — the `canWrite` gate in the assembly composable, which is
the only "a capability flag short-circuits a write" pattern in the repo:

```typescript
// useSlideshowAssembly.ts:337-341
async function ensureGroupMaterialized(slotId: string): Promise<EnsureGroupMaterializedResult | undefined> {
  ...
  if (!svc || !orgId || !canWrite.value) return undefined
```

Silent-return-on-denial. Note the trade-off the planner must decide (CONTEXT.md leaves the guard shape
to discretion): silent return matches `updateService`'s existing `if (!orgId.value) return`, but makes
a blocked mutation indistinguishable from a successful one to the caller. `createService`'s `throw` is
the in-repo alternative. Pick one and state it; both have precedent in the same file.

**Where the store knows the status.** `services.value` (`services.ts:35`) already holds the live
document list, so `services.value.find(s => s.id === id)?.status` is available inside every action —
`assignSongToSlot:102` and `clearSongFromSlot:125` already read it that way. `slideGroups.ts` has no
such handle.

**The two escape hatches the guard needs** (mirroring D-09/D-11):
- the export write, `ServiceEditorView.vue` ≈`2691` — `updateService(id, { pcExportedAt: serverTimestamp(), pcPlanId, status: 'exported' })`
- the reopen write itself — `status: 'draft'` on a non-draft service.

---

## 3. Layer C — the UI, and how the three existing seams compose

They do **not** currently compose — they are three independent, differently-shaped gates:

| Seam | Definition | Scope |
|---|---|---|
| `isExportedLocked` | `ServiceEditorView.vue:1288` — `localService.value?.status === 'exported'` | Service Order tab only; never passed to any child |
| `canReorder` (service order) | `ServiceEditorView.vue:1392` — `authStore.isEditor && localService.value !== null` | **does not consult `isExportedLocked` at all** |
| `canMutate` | `EditSlideDrawer.vue:432` — `props.isEditor && !isSongGroup.value` | drawer only |
| `canReorder` (slides) | `SlideGrid.vue:596` — `props.isEditor && props.group !== null && !isSongGroup.value` | grid only |

The Slides-tab pair share one input: `isEditor`, prop-drilled
`ServiceEditorView.vue:1006 → SlidesTab.vue:138 → SlideGrid/EditSlideDrawer`. **That prop chain is the
composition point.** The lifecycle lock extends these rather than paralleling them by narrowing what
flows down that one chain (or adding one sibling prop next to it and ANDing it into the two existing
computeds). Copy the `canMutate` shape verbatim:

```typescript
// EditSlideDrawer.vue:430-432
const isSongGroup = computed(() => props.planItem?.kind === 'SONG')
const canMutate = computed(() => props.isEditor && !isSongGroup.value)
```

`canReorder` also shows the required side effect — the watcher at `SlideGrid.vue:614` (and the
multi-instance generalization at `ServiceEditorView.vue:1496-1528`) **destroys the Sortable instance**
when the flag goes false. A lock that only hides a drag handle leaves a live Sortable behind; follow
the destroy path.

### Banner / read-only affordance

Copy the Phase 30 read-only badge at `SlideGrid.vue:34` (`v-if="isSongGroup"`) and the drawer's
`v-else` read-only renderings. D-05's "state the reason once, remove the control" is already
implemented in `ServiceEditorView.vue:502-515` and `:690-709` — the `v-if="isEditor && !isExportedLocked"`
editor control paired with a `v-else-if="isEditor && isExportedLocked"` plain-text render. That
two-branch pattern is exactly what the Service Order rows need for D-06; reuse `slotScriptureText()`
(`:2185`) rather than inlining a second formatter (ME-02's lesson, noted in the comment at `:700-702`).

---

## 4. COMPLETE mutation-entry-point inventory

Legend for **Gate today**: `v-if` = template-only · `:disabled` = attribute-only (handler still callable
and still reachable via keyboard/DOM in some cases) · `handler` = a guard inside the function ·
`none` = no lock of any kind (may still be `isEditor`-gated, which is a different axis).

### 4a. Service Order tab — `ServiceEditorView.vue`

All of these mutate `localService` locally; the write happens via the autosave watcher (`:1668`),
`onSave()` (`:2743`), or the immediate reorder save (`:1449-1465`).

| # | Entry point | Handler | Binding | Gate today |
|---|---|---|---|---|
| 1 | `onDateChange` | `:1553` | `:53` | **none** (`isEditor` only — the date is editable while exported today) |
| 2 | `toggleStatus` | `:1796` | `:62` | none — **D-01 DELETES this** |
| 3 | `toggleTeam` | `:1811` | `:452` | `:disabled` (`:453`) |
| 4 | service `name` (`v-model`) | — | `:460` | `:disabled` (`:463`) |
| 5 | `sermonTopic` (`v-model`) | — | `:489` | `:disabled` (`:492`) |
| 6 | `onSermonPassageChange` | `:2205` | `:507` | `v-if` (`:502`) |
| 7 | `onScriptureChange` | `:2190` | `:698` | `v-if` (`:690`) |
| 8 | `onSelectSong` | `:1941` | `:675` | `v-if` (`:666`) |
| 9 | `onClearSong` | `:1954` | `:619`, `:676` | `v-if` (`:617`, `:666`) |
| 10 | `addSlot` | `:1824` | `:921-925` | `v-if` on the enclosing block (`:897`) |
| 11 | `removeSlot` | `:1869` | `:882` | `v-if` (`:880`) |
| 12 | `confirmSlotDelete` | `:1891` | `:255` | **none** — the confirm Teleport (`:239-263`) is outside every locked block |
| 13 | `onSectionChange` | `:1351` | `:870` | `v-if` (`:867`) |
| 14 | PRAYER `linkLabel`/`linkUrl` (inline `@input`) | — | `:732`, `:739` | `v-if` (`:729`) |
| 15 | MESSAGE `linkLabel`/`linkUrl` (inline `@input`) | — | `:779`, `:786` | `v-if` (`:776`) |
| 16 | HYMN `hymnName`/`hymnNumber`/`verses` (inline `@input`) | — | `:825`, `:832`, `:839` | `v-if` (`:822`) |
| 17 | `onSlotSortEnd` (drag reorder + immediate write) | `:1410` | Sortable `onEnd` `:1518` | **none** — `canReorder:1392` omits the lock, so **drag-reorder currently works on an exported service** |
| 18 | `suggestAllSongs` | `:1984` | `:133` | `:disabled` (`:134`) |
| 19 | `fetchAiForSlot` | `:2067` | `:677` | `v-if` (`:666`) |
| 20 | `acceptAiSong` | `:2152` | `:642` | **none** — `v-if="isEditor && aiDraftSongs.has(index)"` (`:631`) omits the lock |
| 21 | `rejectAiSong` | `:2161` | `:653` | none (same block) |
| 22 | `onUndo` (restores a whole snapshot → autosave) | `:2812` | `:119` + Ctrl+Z (`:1767-1778`) | **none** |
| 23 | autosave watcher | `:1668` | — | guards `isEditor` only (`:1674`) |
| 24 | `onSave` | `:2743` | `:199` | **none** |
| 25 | `onDelete` (deletes the service) | `:2729` | `:228` | none — D-08 does not list Delete; **decide explicitly** |
| 26 | ★ export write (`status:'exported'` + `pcExportedAt` + `pcPlanId`) | ≈`:2691` inside `onConfirmExport:2336` | `:364` | must stay ALLOWED (D-09) |

> **★ Post-review closure note (31-REVIEW BL-01 / BL-02).** The "Gate today" column above is the
> pre-phase snapshot and is left as written. Rows **3-22** and **27-28** were all closed during the
> phase; rows **1**, **23** and **24** were not, and shipped. The phase's own
> "every mutation handler no-ops when called directly" test
> (`ServiceEditorView.test.ts`) enumerated ten handlers while omitting exactly those three,
> which is why a 1880-test suite passed over them. All three are now closed, with the
> enumeration test extended to cover them so the same hole cannot pass again:
>
> | # | Entry point | Closed by |
> |---|---|---|
> | 1 | `onDateChange` | `v-if="!canEditService"` on the heading/picker pair + `if (!canEditService.value) return` in the handler |
> | 23 | autosave watcher | `isEditor` term replaced by `canEditService`, and the watcher now **cancels** an already-armed `autosaveTimer` rather than merely declining to arm a new one (31-RESEARCH's "cancel or no-op pending debounced writes when the lock engages"); the timer callback re-checks at firing time as well |
> | 24 | `onSave` | `if (!canEditService.value) return`, plus a `catch` on the debounce callback so a rejection can never strand `autosaveStatus` at `'saving'` and disable the remote-merge branch |

### 4b. Roles tab — writes straight through the store, zero lock today

| # | Entry point | Handler | Binding | Gate today |
|---|---|---|---|---|
| 27 | `onToggleOverridePerson` → `serviceStore.setRoleOverride` (`services.ts:149`) | `:2682` | checkbox `:979` | **none** |
| 28 | `onResetRoleOverride` → `serviceStore.clearRoleOverride` (`services.ts:163`) | `:2722` | `:960` | **none** |

These two bypass `localService`/autosave entirely (scoped dot-path writes), so **a UI-only lock on the
Service Order tab does nothing for them** — they are the strongest argument for the store layer.

### 4c. Slides tab — the seven grid entry points plus the drawer's twelve

Per `30-VERIFICATION.md` I-01: six of seven are template-`v-if` only; only `onLoopToggle` has a handler
guard. **Gate the handlers, not just the templates.**

`SlideGrid.vue`:

| # | Entry point | Handler | Gate today |
|---|---|---|---|
| 29 | `onAddSlide` | `:327` | `v-if="isEditor && !isSongGroup"` (`:17`) — no handler guard |
| 30 | `openImportModal` → `onImportConfirmed` | `:372` / `:397` | `v-if` (`:24`) — no handler guard |
| 31 | `appendVideoEntries` | `:426` | `v-if` on `SlideDropTarget` (`:128`, `:139`) |
| 32 | `attachDroppedAudio` / `onFilesDropped` | `:461` / `:502` | `v-if` (`:128`, `:139`) |
| 33 | `onAttachGroupMusic` | `:274` | `SlideGroupMusicControl :is-editor` (`:65`) — **must keep working per D-06's "no group media" being IN scope but D-08's non-editing actions not** |
| 34 | `onRemoveGroupMusic` | `:290` | same |
| 35 | drag reorder → `replaceGroupSlides` | `:614-660` | `canReorder:596`, with Sortable destroy |

`EditSlideDrawer.vue` (all write via `replaceGroupSlides`/`setGroupBedMedia`):

| # | Entry point | Handler | Gate today |
|---|---|---|---|
| 36 | `onLoopToggle` | `:589` | `:disabled` (`:291`) **+ handler guard `if (!canMutate.value) return` (`:597`)** ← the shape to copy |
| 37 | `onDuplicate` | `:1028` | `v-if="canMutate"` (`:317`) |
| 38 | `onConfirmDelete` | `:1076` | `v-if="canMutate"` (`:317`) |
| 39 | `onAudioFileSelected` → `attachSlideAudio`/`attachGroupAudio` | `:665` / `:638` / `:653` | `v-if="canMutate"` (`:268`) |
| 40 | `onRemoveAudio` → `removeSlideAudio`/`removeGroupAudio` | `:689` / `:698` / `:712` | `v-if="canMutate"` (`:247`) |
| 41 | label / notes / body debounced writes (`scheduleWrite` → `writeField`) | `:830` / `:798`, callers `:953`, `:958`, `:963` | `v-if="canMutate"` (`:93`, `:186`, `:302`) — **no handler guard; a pending debounced write can still land after the lock flips** |

**One high-leverage chokepoint:** entry points 29–32 all funnel through
`props.ensureGroupMaterialized` (`SlideGrid.vue:331, 404, 430`; typed at `:213`, supplied
`SlidesTab.vue:48`, originating `ServiceEditorView.vue:1366`). Narrowing `canWrite` there closes four
of the seven grid paths at once — but not 33/34/35, which call the store directly.

---

## 5. Dialog / confirm precedent — reuse, do not add a component

**There is no shared confirm-dialog component in this repo.** Every confirm is a hand-rolled
`<Teleport to="body">` block inside the owning view. `ServiceEditorView.vue` already contains three:

- delete-service confirm — `:211-237`
- slot-delete confirm — `:239-263` (D-14/D-16; body text from a computed, `deleteConfirmBody:1222`)
- export dialog — `:265-372`

**Copy `:211-237` for the reopen confirm** — it is the shortest and closest (one heading, one body
paragraph, Cancel + destructive action, `:disabled` on the in-flight flag):

```vue
<!-- ServiceEditorView.vue:211-237 -->
<Teleport to="body">
  <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
      <h2 class="text-base font-semibold text-gray-100 mb-2">Delete service?</h2>
      <p class="text-sm text-gray-400 mb-6">…</p>
      <div class="flex justify-end gap-3">
        <button type="button" @click="showDeleteConfirm = false" :disabled="isDeleting" …>Cancel</button>
        <button type="button" @click="onDelete" :disabled="isDeleting" …>{{ isDeleting ? 'Deleting...' : 'Delete' }}</button>
      </div>
    </div>
  </div>
</Teleport>
```

Follow the slot-delete precedent for the D-04 evidence gate: put the conditional warning copy in a
`computed` (like `deleteConfirmBody:1222-1244`), not in template `v-if` branches.

`NewServiceDialog.vue` (`:1-119`) is the repo's only standalone dialog *component* — a `Teleport` +
two `Transition`s + `defineProps<{open}>` + `defineEmits<{close, create}>`. If the planner decides
the reopen confirm should be a component rather than an inline Teleport, that is the file to copy.

---

## 6. Firestore rules test precedent

**Shape** — `src/rules.test.ts:121-145` is the exact template, and it already expresses "this write is
REJECTED" via `assertFails` (37 uses in the file):

```typescript
// rules.test.ts:133-145
it('denies viewer from writing org doc', async () => {
  await seedMembershipDoc('orgA', 'userA', 'viewer')
  const context = testEnv.authenticatedContext('userA')
  const db = context.firestore()
  await assertFails(
    setDoc(doc(db, 'organizations', 'orgA'), { name: "UserA's Church", updatedAt: new Date() }),
  )
})
```

Everything the status guard needs is already in the harness:
- `seedDoc(path, data)` (`:42-50`) seeds a document **bypassing rules** — this is how you create a
  service already at `status:'planned'` before asserting a write against it fails.
- `seedMembershipDoc(orgId, uid, role)` (`:32-40`).
- `testEnv.clearFirestore()` in `afterEach` (`:24-26`) — no manual cleanup.
- The `quarterShares` block (`:200-334`) is the closest full-suite analog: it already tests an
  **update-with-a-changed-immutable-field is rejected** case, which is structurally the same assertion
  the status guard needs.

**Running it:** `npm run test:rules` →
`firebase emulators:exec "npx vitest run --config vitest.rules.config.ts --reporter=verbose" --project test-project --only firestore,storage`
(`package.json:11`). Config: `vitest.rules.config.ts` (node env, 30s timeout, `fileParallelism: false`
— the comment there explains that concurrent rules files crash the shared Java rules server).

**It does NOT run in the default suite** — `vite.config.ts:85-86` excludes `src/rules.test.ts`
(`src/storage.rules.test.ts` is *not* excluded and is a known baseline failure without the Storage
emulator). Requires the emulator **and** `.env.local` (see `CLAUDE.md`). Plan the rules test as an
explicitly-run gate with its command recorded in the plan; green CI does not cover it.

---

## 7. Date / Sunday utilities

**Closest analog for "walk forward through Sundays, skipping taken ones":**
`generateSundaysInQuarter` (`src/utils/quarterDates.ts:11-24`) — it is the only forward Sunday walk in
the repo, and it is a pure, tested function with no Firestore/Vue/`Date.now()` dependency (see the
file header at `:1-2`).

```typescript
// quarterDates.ts:4 and :17-22
const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
…
d.setDate(d.getDate() + ((7 - d.getDay()) % 7)) // advance to first Sunday on/after start
while (d <= end) {
  sundays.push(fmtDate(d))
  d.setDate(d.getDate() + 7)
}
```

The new helper is that loop with `while (d <= end)` replaced by a bounded counter (D-13's ~52) and a
`takenDates: Set<string>` skip test. Two divergences to reconcile:
- `NewServiceDialog.vue:136-146`'s private `nextSunday()` re-implements `fmtDate` inline
  (`:142-145`) and uses `day === 0 ? 7 : 7 - day` — i.e. **strictly next Sunday, never today**, whereas
  `quarterDates`'s `(7 - d.getDay()) % 7` yields *today* when today is Sunday. D-13's fallback says
  "degrade to exactly the behaviour that exists now", so the fallback must keep `nextSunday()`'s
  strictly-forward semantics. Decide this explicitly; the two are off by seven days on a Sunday.
- `fmtDate` is module-private in `quarterDates.ts` (not exported). Putting the new function in that
  same file reuses it for free; a new file would duplicate it. Prefer the same file.

Test analog: `src/utils/__tests__/quarterDates.test.ts` (same directory convention, pure-function
tests, no mocks needed).

---

## 8. Prop-drilling vs store access (R038 / D-14 wiring)

**The established convention is: a dialog takes `defineProps<{ open: boolean }>()` and reads bulk data
from the store directly.** Nine components do this. The closest analog — same prop surface as
`NewServiceDialog`, i.e. `open` and nothing else:

```typescript
// PcImportModal.vue:230-245
import { useAuthStore } from '@/stores/auth'
import { useSongStore } from '@/stores/songs'
…
const props = defineProps<{ open: boolean }>()
…
const authStore = useAuthStore()
const songStore = useSongStore()
```

Same shape in `CsvImportModal.vue:309/318` and `BatchQuickAssign.vue:113/121`. Components that receive
domain data as *props* instead (`SongSlotPicker`, `SlidesTab`, `SlideGrid`, `EditSlideDrawer`) are all
children of a view that already owns and transforms the data — not standalone modals.

`ServicesView.vue` mounts the dialog at `:166-171` (`:open="dialogOpen"`, `@create="onCreateService"`)
and already subscribes (`initStore():334-338`, handler `onCreateService:349-353`), so a prop would also
work. **But `useServiceStore()` inside `NewServiceDialog.vue` matches the dominant convention, keeps
`ServicesView` untouched, and needs no new prop.** The store is a singleton already subscribed by the
parent view, so `serviceStore.services` is populated by the time the dialog opens.

Note for the planner: `NewServiceDialog.vue` currently imports **only** `{ ref, watch } from 'vue'`
(`:122`) — it has no store import and no `@/` import at all today, which is why CONTEXT.md D-14 calls
this "new work, not a one-line change." Its existing `defaultForm()`/`watch(() => props.open)` reset
pattern (`:162-181`) is where the new default date plugs in.

---

## 9. Shared patterns to apply across all plans

### Error handling on scoped writes
Two established, deliberately different shapes — pick per call site, both are precedent:
- **Optimistic + rollback + `console.error`, no user-facing banner** — `onToggleOverridePerson`
  (`ServiceEditorView.vue:2682-2720`, the WR-02 comment at `:2692-2699` explains why).
- **`console.error` + soft-fail, keep going** — `createShareToken`'s secondary write
  (`services.ts:251-256`).

### Comment convention
Every non-obvious guard in this codebase carries a comment naming its decision id / review finding
(`D-09`, `WR-01`, `CR-02`, `ME-04`) and, where applicable, the bug it prevents. See
`slideGroups.ts:95-111` and `ServiceEditorView.vue:1466-1493` for the density expected. Match it —
especially on the D-09 export carve-out, which is the single most likely thing for a future
maintainer to "simplify" away.

### Test harness for `ServiceEditorView`
`src/views/__tests__/ServiceEditorView.test.ts:1-70` — `shallowMount` + `enableAutoUnmount(afterEach)`
(the comment at `:13-23` explains that the 800ms autosave timer pollutes later tests otherwise) +
whole-module `vi.mock('firebase/firestore')` + a `mockUpdateService` spy. Assert lock behaviour by
call-count on that spy, not by DOM absence alone — DOM absence is exactly what I-01 showed is not
enough.

### Store test harness
`src/stores/__tests__/services.test.ts:1-50` — `setActivePinia(createPinia())`, `vi.stubGlobal('crypto', …)`
(needed because `createService` → `buildSlots` → `crypto.randomUUID`), and a full `vi.mock('firebase/firestore')`
returning spied `updateDoc`/`addDoc`/`deleteDoc`. A store-guard test asserts `updateDoc` was **not**
called.

---

## No Analog Found

| Need | Why there is no precedent |
|---|---|
| A rule that carves out a specific *state transition* (reopen; export) | The five data-conditional rules (`:80-83, :94, :104, :116-121, :133-138`) only compare identity fields; none permits a specific value change while denying others |
| A rules `get()` on a doc in a *different* collection identified by a document **field** | `isOrgEditor`'s `get()` resolves a path from the `{orgId}` wildcard, never from document data. `slideGroups` docs are keyed by slot id and carry `serviceId` only as a field |
| A guard inside a Pinia store action | Both stores validate only `orgId` presence (`services.ts:68, 85, 93, 154, 164`); `slideGroups.ts` validates nothing |
| A shared confirm-dialog component | Every confirm is a hand-rolled `Teleport` in its owning view (three of them in `ServiceEditorView.vue` alone) |
| A test for `NewServiceDialog.vue` | No file in `src/components/__tests__/`; nearest siblings are `CsvImportModal.test.ts` / `PptxImportModal.test.ts` |
| An editable `notes` control on the service | D-07 says notes lock too, but grep finds `notes` only in the export payload (`ServiceEditorView.vue:2778`) and the group-slide delete copy (`:1237`). **The service `notes` field has no UI to lock.** Confirm before planning work for it |

## Metadata

**Analog search scope:** `firestore.rules`, `src/stores/`, `src/views/`, `src/components/`,
`src/components/slides/`, `src/composables/`, `src/utils/`, `src/rules.test.ts`,
`vitest.rules.config.ts`, `vite.config.ts`, `package.json`
**Files read:** 18
**Knowledge graph:** not used — stale per `CLAUDE.md`; every path above verified against real `src/`
**Pattern extraction date:** 2026-07-29
