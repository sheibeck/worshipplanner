---
phase: 31-service-lifecycle-draft-lock-reopen
reviewed: 2026-07-30T15:55:00Z
depth: deep
files_reviewed: 20
files_reviewed_list:
  - firestore.rules
  - src/components/NewServiceDialog.vue
  - src/components/__tests__/NewServiceDialog.test.ts
  - src/components/__tests__/ScriptureInput.test.ts
  - src/components/slides/EditSlideDrawer.vue
  - src/components/slides/SlideGrid.vue
  - src/components/slides/SlidePlanRail.vue
  - src/components/slides/SlidesTab.vue
  - src/components/slides/__tests__/EditSlideDrawer.test.ts
  - src/components/slides/__tests__/SlideGrid.test.ts
  - src/components/slides/__tests__/SlidePlanRail.test.ts
  - src/components/slides/__tests__/SlidesTab.test.ts
  - src/rules.test.ts
  - src/stores/__tests__/services.test.ts
  - src/stores/services.ts
  - src/utils/__tests__/quarterDates.test.ts
  - src/utils/quarterDates.ts
  - src/views/ServiceEditorView.vue
  - src/views/ServicesView.vue
  - src/views/__tests__/ServiceEditorView.test.ts
findings:
  critical: 2
  warning: 4
  info: 4
  total: 10
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-07-30
**Depth:** deep (cross-file trace of all three enforcement layers, plus executed probes)
**Files Reviewed:** 20
**Status:** issues_found

## Summary

The rules layer is correct and genuinely proven: 90 assertions in `src/rules.test.ts` pass against the
live emulator, including the wildcard-catch-all exclusion (Finding 0), the export carve-out, and — the
one reasoning alone gets wrong — re-export to the **same** `pcPlanId`. `npm run type-check`
(`vue-tsc --build`) is clean. The full unit run is 1880 passing with only the two documented baseline
failures (`storage.rules.test.ts`, `RosterView.test.ts`).

The lock itself, however, is not complete on the client. `31-PATTERNS.md` § 4a shipped an exhaustive
26-row mutation inventory; rows **3–22 and 27–28 were all closed, but rows 1 (`onDateChange`),
23 (the autosave watcher) and 24 (`onSave`) were not** — and the phase's own
"every mutation handler no-ops when called directly" test (`ServiceEditorView.test.ts:2983-3048`)
enumerates ten handlers while omitting exactly those. The result is reachable in the shipped UI: the
service **date** control renders unchanged on a `planned`/`exported` service, changing it fires a
full-document `onSave` that all three layers reject, and because the autosave callback has no `catch`
the view is left permanently desynchronised from Firestore with nothing on screen. Both consequences
were reproduced by execution, not inferred.

Everything the review prompt flagged as highest-risk was traced end to end and is correct: the export
write survives all three layers, re-export to the same plan is not broken client-side, delete works at
every status, no fourth slide-group write site exists, `canMutateGroup`/`canWriteGroupMedia` correctly
preserve Phase 30's R054 group-media behaviour, Sortable teardown/rebuild is paired in both files, the
five-class gate migration is applied correctly at every risky site, and neither transition flips the
status optimistically. R038 is correct and its team side effect is genuinely covered.

### Priority areas traced (evidence)

| # | Area | Result |
|---|---|---|
| 1 | Export write + delete on a non-draft service | **Correct.** `ServiceEditorView.vue:3084-3088` sends exactly `{pcExportedAt, pcPlanId, status}`; store `isExportWrite` (`services.ts:142-149`) and rule branch 2 both accept. Delete unguarded at all three layers (`services.ts:220-223`, `firestore.rules` `allow delete`, button `:1286`). |
| 2 | Re-export to the SAME `pcPlanId` | **Correct.** `pcExportedAt` is always a fresh `serverTimestamp()`; payload never violates `hasOnly`. Pinned by `rules.test.ts:774`. |
| 3 | Slide-group write on a locked service | **No fourth site.** All three composable writers gate on `canWrite`; every `SlideGrid`/`EditSlideDrawer` handler re-checks its own gate. See HI-01 for the *timing* hole, not a missing site. |
| 4 | Five-class gate migration | **Correct at every risky site.** Class C bindings deleted (`:619-640`, `:664-672`); Class D inverses still point at `isLocked` (`:690`, `:902`); Class B sites all carry the added lock term (`:619`, `:665`, `:770`, `:826`, `:1175`, `:1196`). |
| 5 | `canMutateGroup` vs `canWriteGroupMedia` | **Correct.** `SlideGrid.vue:296-297`; song group + draft ⇒ `canWriteGroupMedia === true`, so R054 group media still works. |
| 6 | Sortable teardown | **Correct in both files** (`ServiceEditorView.vue:1842-1874`, `SlideGrid.vue:683-759`), with destroy/rebuild tests in each. |
| 7 | No-optimistic-flip | **Correct.** `applyTransitionLocally` runs only after the awaited write (`:2206`, `:2249`); both catch blocks mutate nothing. |
| 8 | Wave 3's two out-of-plan changes | `originalService` mirroring is correct and necessary (`:3100-3104`). The `lastUsedAt` move is faithful but carries ME-02/ME-03. |
| 9 | R038 | **Correct.** Boundary, exhaustion fallback and the `sundayOrdinal` team side effect are all covered with real assertions (`quarterDates.test.ts:82-179`, `NewServiceDialog.test.ts:122-171`). |

---

## Critical Issues

### BL-01 (BLOCKER): The service date stays editable on a locked service, and the rejected write desynchronises the editor permanently

**File:** `src/views/ServiceEditorView.vue:42-55` (control), `src/views/ServiceEditorView.vue:1899-1902` (handler)

**Issue:**
The date heading button and its `<input type="date">` are gated on `authStore.isEditor` alone, not
`canEditService`, and `onDateChange` has no guard:

```
1899  function onDateChange(newDate: string) {
1900    if (!localService.value || !newDate) return
1901    localService.value.date = newDate
1902  }
```

`31-PATTERNS.md` § 4a lists this as **row 1**, gate `none` — *"the date is editable while exported
today"*. It was never closed, and no summary mentions it. R036's own statement ("a service is editable
only while `draft`") is therefore not delivered for the service date.

**Reproduced by execution** (probe mounting the real view against a `planned` service with a store mock
that mirrors the real `assertWritable`):

```
PROBE date input rendered on planned service: true
PROBE updateService calls: 1 [["name","teams","sermonPassage","sermonTopic","notes","status","slots"]]
PROBE autosave error line rendered: false
PROBE lock banner rendered: true
PROBE lifecycle error rendered: false
PROBE unhandled rejections: 1
```

**Failure scenario:** editor opens a `planned` service → clicks the date heading → picks a new Sunday.
The header shows the new date. 800ms later the autosave fires the full-document `onSave` above.
`assertWritable` (`src/stores/services.ts:158-164`) throws `ServiceLockedError`; had it not, the
Firestore rule would deny it. **Nothing appears on screen** — the autosave error line at `:108-114` is
inside `v-if="canEditService"`, which is false precisely because the service is locked. The user
believes the date changed. It did not, and (per BL-02) it never will for the rest of the session.

**Fix:**
```vue
<!-- :41-55 -->
<h1 v-if="!canEditService" class="text-xl font-semibold text-gray-100">{{ formattedDate }}</h1>
<div v-else class="relative"> ... </div>
```
```ts
function onDateChange(newDate: string) {
  if (!canEditService.value) return          // 30-VERIFICATION I-01: gate the handler too
  if (!localService.value || !newDate) return
  localService.value.date = newDate
}
```
Add `onDateChange` to the `LOCKED_STATUSES` handler-guard loop in
`src/views/__tests__/ServiceEditorView.test.ts:3013-3044`, which currently omits it.

---

### BL-02 (BLOCKER): A rejected autosave wedges `autosaveStatus` at `'saving'`, permanently disabling the remote-merge watcher, with no catch and no user surface

**File:** `src/views/ServiceEditorView.vue:2033-2059` (timer callback), `:3236-3285` (`onSave`, ungated), `:1972` (the branch that gets wedged)

**Issue:**
The autosave timer callback awaits `onSave()` inside `try { … } finally { … }` with **no `catch`**:

```
2049          try {
2050            await onSave()
2051            autosaveStatus.value = 'saved'
...
2056          } finally {
2057            autosaveSaving = false
2058          }
```

`onSave` has no `canEditService` guard (`31-PATTERNS.md` row 24, `none`; `31-04-SUMMARY.md:186-188`
records the decision to leave it unguarded because "the store guard already refuses it"). Phase 31 made
that refusal *deterministic* — `assertWritable` now throws — while simultaneously **removing the only
surface that could report it** (`:93` wraps the autosave status/error line in `v-if="canEditService"`).

Consequences of any rejection:
1. `autosaveStatus` is never reassigned, so it sticks at `'saving'` forever.
2. The remote-merge branch at `:1972` is `else if (autosaveStatus.value === 'idle' || … === 'saved')`,
   so **every subsequent Firestore snapshot is discarded** for the life of the component.
3. The rejection escapes as an unhandled promise rejection.

This directly contradicts the phase's own contract — 31-RESEARCH § "Gate the handlers, not just the
templates" requires *"Cancel or no-op pending debounced writes when the lock engages, not merely hide
their inputs."* That was done in `EditSlideDrawer.writeField` (`:834-838`) but not here.

**Reproduced by execution:**
```
PROBE control — remote date applied: 2026-03-15      ← before the failure, remote merge works
PROBE updateService rejected calls: 1
PROBE date shown after post-failure remote change: 2026-04-12   ← remote 2026-05-03 IGNORED
```

**Failure scenarios (two independent triggers):**
- Via BL-01: any date edit on a locked service.
- Without BL-01: the user types into Sermon Topic on a **draft** service and clicks **Mark as Planned**
  within 800ms. `onMarkAsPlanned` (`:2195-2217`) awaits `onSave()` but **never clears `autosaveTimer`**
  (`:2031`). If the user keeps typing during the awaited round trip, `isDirty` is true again when the
  timer fires after `applyTransitionLocally('planned')` — the write lands on a now-locked service and
  wedges the view identically.

**Fix:**
```ts
// :3236 — refuse before issuing, matching every other handler in this file
async function onSave() {
  if (!canEditService.value) return
  if (!localService.value || !isDirty.value) return
  ...
}

// :2049 — never let a rejection strand the status machine
try {
  await onSave()
  autosaveStatus.value = 'saved'
  setTimeout(() => { if (autosaveStatus.value === 'saved') autosaveStatus.value = 'idle' }, 3000)
} catch (err) {
  autosaveStatus.value = 'error'
  console.error('[ServiceEditorView] autosave failed:', err)
} finally {
  autosaveSaving = false
}

// :2196 — cancel any armed debounce before the lock engages
if (autosaveTimer) { clearTimeout(autosaveTimer); autosaveTimer = null }
```

---

## Warnings

### HI-01 (HIGH): Slide-group writes issued just before the lock engages surface as unhandled `permission-denied` with nothing on screen

**File:** `src/composables/useSlideshowAssembly.ts:305-315`, `:430-451`, `:453-459`; `src/views/ServiceEditorView.vue:2195-2217`

**Issue:**
`materializeCandidates` and `applyRebuildOutcomes` `await` store writes with **no `try`/`catch`** and are
invoked fire-and-forget via `void` from `{ immediate: true }` watchers:

```
455      void applyRebuildOutcomes(outcomes)
```

Before this phase such writes always succeeded (`allow write: if isOrgEditor`). The new `/slideGroups`
rule denies them the instant the parent service leaves `draft`, and `onMarkAsPlanned` does not await
in-flight group writes before flipping the status.

**Failure scenario:** editor assigns a song to a slot (this changes `localService.slots`, so
`rebuildOutcomes` recomputes and a `replaceGroupSlides` transaction is issued via `void`), then clicks
**Mark as Planned**. `onSave` (`:2203`) and `bumpScheduledSongsLastUsed` (`:2204`) run, then
`markAsPlanned` (`:2205`) flips the stored status. Any group write still in flight is denied on arrival.
The user sees a normal transition; the console shows an unhandled `FirebaseError: Missing or insufficient
permissions`, and that group's slides silently stay stale until the next reopen.

**Fix:** wrap both apply loops so a denied write is logged and dropped rather than escaping, and drain
in-flight group writes before the status write:
```ts
// useSlideshowAssembly.ts:430
async function applyRebuildOutcomes(outcomes: RebuildOutcome[]) {
  for (const outcome of outcomes) {
    ...
    try {
      await slideGroupsStore.replaceGroupSlides(...)
    } catch (err) {
      appliedGroupRefForSlot.delete(outcome.slotId)   // allow a retry after a reopen
      console.error('[useSlideshowAssembly] group rebuild write failed:', err)
    }
  }
}
```
Same shape for `materializeCandidates` (`:309-313`).

---

### ME-01 (MEDIUM): A completed Planning Center export can fail its Firestore write and show the user a raw `ServiceLockedError` developer string

**File:** `src/views/ServiceEditorView.vue:3084-3088`, `:3114-3115`; `src/stores/services.ts:57-64`

**Issue:**
`onConfirmExport`'s terminal write goes through `serviceStore.updateService`, whose new
`assertWritable` throws a message written for developers:

```
services.ts:59   `R036: refusing to ${action} service ${serviceId} — its stored status is ` +
services.ts:60     `"${storedStatus}", not "draft". Reopen it for editing first.`
```

and the catch renders it verbatim:

```
3115    exportError.value = e instanceof Error ? e.message : 'Export failed'
```

The Export button's guard reads `localService.status` (`:196`), which can disagree with the stored
status the guard reads (`services.ts:134-136`).

**Failure scenario:** two editors have the same `planned` service open. Editor A exports; the stored
status becomes `exported`. Editor B's Export button is still enabled from their own `localService`.
Editor B exports — **all Planning Center API calls complete**, creating or mutating a real plan — and then
the local guard throws. Editor B sees *"R036: refusing to update service svc-1 — its stored status is
"exported", not "draft". Reopen it for editing first."*, `pcPlanId` is never recorded, and the plan just
written to Planning Center is orphaned with no audit trail — the exact loss D-11 exists to prevent.

**Fix:** map the guard error to user copy, and re-check the stored status before doing any PC work:
```ts
// :2810, before the API conversation
if (serviceStore.services.find(s => s.id === localService.value!.id)?.status !== 'planned') {
  exportError.value = 'This service is no longer Planned — reload and try again.'
  return
}
// :3114
catch (e) {
  exportError.value = e instanceof ServiceLockedError
    ? 'This service changed status while exporting. Reload and try again.'
    : e instanceof Error ? e.message : 'Export failed'
}
```

---

### ME-02 (MEDIUM): The relocated `lastUsedAt` bump re-writes `slots` from the store snapshot immediately after `onSave` normalized it

**File:** `src/views/ServiceEditorView.vue:2177-2193`, `:2203-2204`; `src/stores/services.ts:225-250`

**Issue:**
`onMarkAsPlanned` runs `await onSave()` — which persists `reindexSlots(orderSlotsBySection(...))` and
syncs the normalized array into `localService` (`:3249`, `:3276-3278`) — and only then calls
`bumpScheduledSongsLastUsed`. That helper routes each song through `assignSongToSlot`, which does **not**
read `localService`; it reads the store's own copy and writes the whole array back:

```
services.ts:230    const service = services.value.find((s) => s.id === serviceId)
services.ts:233    const updatedSlots = service.slots.map(...)
services.ts:245    await updateService(serviceId, { slots: updatedSlots })
```

The slot index passed in is derived from `localService` (`:2187` `svc.slots.indexOf(songSlot)`) but
applied to the *store's* array. The two agree only once the snapshot for `onSave`'s write has landed.
In the pre-Phase-31 code the bump ran **before** the normalizing write, so this ordering hazard is new.

**Failure scenario:** the editor drags a slot into a different section (order changes), then clicks Mark
as Planned. `onSave` persists the new order. If the store snapshot has not yet reflected it when the
bump runs, `assignSongToSlot` writes the pre-drag array back over it, silently undoing the reorder —
and stamps the song fields at an index computed against the *new* order. Firestore's latency
compensation usually closes the window, which makes this intermittent rather than absent.

Secondarily, every bump costs a redundant full-`slots` document write (N distinct songs ⇒ N service
writes + N song writes) purely to touch `lastUsedAt` on the song documents.

**Fix:** bump the songs directly instead of round-tripping through `assignSongToSlot`:
```ts
async function bumpScheduledSongsLastUsed(): Promise<void> {
  const svc = localService.value
  if (!svc) return
  const ids = new Set(svc.slots.filter(s => s.kind === 'SONG' && (s as SongSlot).songId)
                               .map(s => (s as SongSlot).songId!))
  await Promise.all([...ids].map(id => songStore.updateSong(id, { lastUsedAt: serverTimestamp() as never })))
}
```

---

### ME-03 (MEDIUM): A failed `markAsPlanned` leaves the `lastUsedAt` bump applied, and any bump failure is reported as a connection problem

**File:** `src/views/ServiceEditorView.vue:2199-2216`

**Issue:**
```
2203      if (isDirty.value) await onSave()
2204      await bumpScheduledSongsLastUsed()
2205      await serviceStore.markAsPlanned(localService.value.id)
```
The bump *must* precede the status write (it writes `slots`, which is illegal once locked), so the two
cannot be made atomic — but there is no compensating action. If `markAsPlanned` rejects, every scheduled
song has already had `lastUsedAt` set to now while the service is still a draft that was never
scheduled. `lastUsedAt` feeds the AI rotation heuristics (`recentServiceSongIds`, the `songLibrary`
payload at `:2452+`), so those songs are wrongly aged with no way for the user to know or undo it.

The same `catch` also swallows the cause: a rejection anywhere inside `onSave` or the bump surfaces as
*"Couldn't mark this service as Planned. Check your connection and try again."* (`:2213`), which is
wrong for a store-guard refusal or a rejected song write.

**Fix:** capture each song's prior `lastUsedAt` before bumping and restore it in the `catch`; and branch
the message on `err instanceof ServiceLockedError` versus a transport failure so the retry advice
matches the cause.

---

## Info

### LO-01 (LOW): Viewers see a "reopen it for editing" instruction they cannot act on

**File:** `src/components/slides/EditSlideDrawer.vue:51-59`; `src/components/slides/SlidesTab.vue:70`; `src/views/ServiceEditorView.vue:1233`

`:service-locked="isLocked"` is passed regardless of role, and the drawer notice renders on
`v-if="isSongGroup || serviceLocked"` with no `isEditor` term. A **viewer** opening the drawer on a
`planned` service now reads *"This service is locked — reopen it for editing to change this slide."* —
a dead affordance for a restriction that is not why they cannot edit. 31-UI-SPEC § 1 and E8 reject
exactly this reasoning for the page banner (`ServiceEditorView.vue:289` correctly carries
`authStore.isEditor &&`); the drawer notice did not inherit it.

**Fix:** `v-if="isSongGroup || (isEditor && serviceLocked)"`.

---

### LO-02 (LOW): The two new lifecycle handlers and store actions carry no editor check

**File:** `src/views/ServiceEditorView.vue:2195`, `:2230`, `:2243`; `src/stores/services.ts:187`, `:208`

`onMarkAsPlanned`, `onReopenRequest`, `runReopen`, `markAsPlanned` and `reopenService` all check
`isTransitioning` / stored status but never `authStore.isEditor`. Every other mutation handler in this
view opens with `if (!canEditService.value) return`, and the phase's stated rule (30-VERIFICATION I-01,
quoted at `:2267-2272`) is "gate the handlers, not just the templates". Not currently exploitable — both
buttons are template-gated and nothing is `defineExpose`d — but it is the one place the phase's own
convention was not applied, and the rules layer is the only thing left standing.

**Fix:** add `if (!authStore.isEditor) return` to both view handlers and an `isEditor` precondition (or
a documented "rules-only" note) to the two store actions.

---

### LO-03 (LOW): `src/stores/slideGroups.ts` received no draft-only guard although `31-CONTEXT.md` scoped it

**File:** `src/stores/slideGroups.ts` (unchanged this phase); `31-CONTEXT.md:17-19`

CONTEXT lists `src/stores/slideGroups.ts` in scope and 31-RESEARCH § "Where the store guard reads status
from" specifies a cross-store guard for it. The delivered layer 2 for slide groups is the composable's
`canWrite` plus per-component handler guards. Every current call site is guarded, so this is a structural
gap rather than a live hole — but the asymmetry means a future component that imports `useSlideGroups()`
directly gets no store-level refusal, unlike `useServiceStore()`.

**Fix:** either add the cross-store guard the research specified, or record the deviation explicitly in
the phase summary so the next author does not assume symmetry.

---

### LO-04 (LOW): The mandated payload-forgery rules regression is not the one that shipped

**File:** `src/rules.test.ts:746-752`

31-RESEARCH Pitfall 4 marks one test mandatory: *"seeds a document at `exported` and then writes
`{status:'draft', slots:[…]}` in a single payload. That test (probe B4) is mandatory."* The shipped test
seeds `planned` and writes `{status:'draft', notes:'smuggled'}`. It exercises the same `hasOnly` branch
and passes, and the `exported` + `slots` shape *is* covered one layer up
(`src/stores/__tests__/services.test.ts`, "refuses a locked update that smuggles other fields") — so
nothing is unverified. But the specific attack payload the research named is not asserted at the layer
that has to stop it.

**Fix:** add the B4 shape verbatim alongside the existing case.

---

_Reviewed: 2026-07-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep — findings BL-01 and BL-02 reproduced by executing probe suites against the real component; rules layer verified with 90 passing assertions against the running Firestore emulator; probe files deleted after the run_
