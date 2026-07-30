# Phase 31 — Deferred Items

Recorded so they are not lost. Each entry is a finding from `31-REVIEW.md` that was deliberately
**not** fixed in the `31-REVIEW` fix pass, which was scoped to the two BLOCKERs, the HIGH and the
three MEDIUMs.

None of these is exploitable today. All four are structural or copy issues; each names the concrete
future change that would turn it into a live defect.

---

## LO-01 — Viewers see a "reopen it for editing" instruction they cannot act on

**Files:** `src/components/slides/EditSlideDrawer.vue:51-59`; `src/components/slides/SlidesTab.vue:70`;
`src/views/ServiceEditorView.vue:1233`

`:service-locked="isLocked"` is passed regardless of role, and the drawer notice renders on
`v-if="isSongGroup || serviceLocked"` with no `isEditor` term — so a **viewer** opening the drawer on a
`planned` service reads *"This service is locked — reopen it for editing to change this slide"*, a dead
affordance for a restriction that is not why they cannot edit. The page banner
(`ServiceEditorView.vue:289`) correctly carries `authStore.isEditor &&` per 31-UI-SPEC § 1 / E8; the
drawer notice did not inherit it.

**Fix:** `v-if="isSongGroup || (isEditor && serviceLocked)"`.

---

## LO-02 — The two new lifecycle handlers and store actions carry no editor check

**Files:** `src/views/ServiceEditorView.vue:2195`, `:2230`, `:2243`; `src/stores/services.ts:187`, `:208`

`onMarkAsPlanned`, `onReopenRequest`, `runReopen`, `markAsPlanned` and `reopenService` all check
`isTransitioning` / stored status but never `authStore.isEditor`. Every other mutation handler in the
view opens with `if (!canEditService.value) return`, and the phase's stated rule (30-VERIFICATION I-01)
is "gate the handlers, not just the templates". **Not currently exploitable** — both buttons are
template-gated and nothing is `defineExpose`d — but it is the one place the phase's own convention was
not applied, leaving the rules layer as the only thing standing.

**Fix:** add `if (!authStore.isEditor) return` to both view handlers, and an `isEditor` precondition
(or a documented "rules-only" note) to the two store actions.

---

## LO-03 — `src/stores/slideGroups.ts` received no draft-only guard although `31-CONTEXT.md` scoped it

**Files:** `src/stores/slideGroups.ts` (unchanged this phase); `31-CONTEXT.md:17-19`

CONTEXT lists the store in scope and 31-RESEARCH § "Where the store guard reads status from" specifies a
cross-store guard for it. What shipped as layer 2 for slide groups is the composable's `canWrite` plus
per-component handler guards. Every current call site is guarded, so this is a **structural gap, not a
live hole** — but the asymmetry means a future component importing `useSlideGroups()` directly gets no
store-level refusal, unlike `useServiceStore()`.

**Fix:** either add the cross-store guard the research specified, or record the deviation explicitly in
the phase summary so the next author does not assume symmetry.

---

## LO-04 — The mandated payload-forgery rules regression is not the one that shipped

**File:** `src/rules.test.ts:746-752`

31-RESEARCH Pitfall 4 marks one test mandatory: *"seeds a document at `exported` and then writes
`{status:'draft', slots:[…]}` in a single payload. That test (probe B4) is mandatory."* The shipped test
seeds `planned` and writes `{status:'draft', notes:'smuggled'}`. It exercises the same `hasOnly` branch
and passes, and the `exported` + `slots` shape *is* covered one layer up
(`src/stores/__tests__/services.test.ts`, "refuses a locked update that smuggles other fields") — so
**nothing is unverified**. But the specific attack payload the research named is not asserted at the
layer that has to stop it.

**Fix:** add the B4 shape verbatim alongside the existing case.

---

## Newly dead: `serviceStore.assignSongToSlot` (created by the ME-02 fix, not a review finding)

**File:** `src/stores/services.ts:225-250`

ME-02 replaced the `lastUsedAt` bump's `assignSongToSlot` round trip with direct song-document writes.
That was the store action's **only** remaining production caller — `onSelectSong`
(`ServiceEditorView.vue:2602`) mutates `localService` locally and lets autosave persist it, and nothing
else in `src/` calls it. It is now referenced only by its own tests.

Deliberately **not** deleted here. Deleting an exported, separately-tested store action is a cleanup, not
a review fix, and this repo has a precedent for flagging rather than removing dead code mid-phase
(`isSlotPopulated`, flagged as IN-01 in `27-REVIEW.md` and still present). Recorded so the next author
does not assume it is load-bearing.

**Fix:** delete `assignSongToSlot` and its tests, or document it as a deliberately-retained store API.
