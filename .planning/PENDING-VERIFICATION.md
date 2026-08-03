# Pending Human Verification — v1.4

**Why this file exists.** The owner left for the weekend on 2026-07-30 with a standing instruction to
work autonomously and skip human-verify checkpoints, doing verification together on their return. Every
checkpoint skipped under that grant is recorded here rather than silently marked passed.

**How to use it:** work top to bottom. Each item names what to do, what to expect, and what a failure
would mean. Items are grouped by phase and ordered by the risk of the thing they check.

**Status key:** ☐ not yet verified · ☑ verified by owner · ✗ failed, see notes

---

## Before starting: two setup facts

1. **Emulator.** Local verification is only meaningful with `VITE_USE_EMULATORS=true` in `.env.local`
   and the emulator running. `src/firebase/index.ts:23-28` wires auth 9099, firestore 8080, storage
   9199, functions 5001. Without the flag the dev app talks to LIVE Firebase, where the Phase 31 rules
   are deliberately **not deployed** — so any rules-layer check would give a false pass.
2. **Rules are not in production.** `firebase deploy --only firestore:rules` is deferred (ROADMAP
   backlog Phase 999.3) and must run before v1.4 ships. Until then production has the UI gate and the
   store guard only.

---

## Phase 31 — Service Lifecycle: Draft Lock & Reopen

### Lock behaviour

- ☐ **31.1** Open a Draft service. Everything is editable — Service Order, Slides, Roles.
- ☐ **31.2** Click **Mark as Planned**. Expect: one lock banner; Service Order rows become plain text
  with no drag handles, no Add item, no pickers; Slides offers no Add slide / Import / drag / drawer
  edits; Roles shows names with no checkboxes.
- ☐ **31.3** Switch across all three tabs. Expect exactly ONE banner, not re-announced per tab.
- ☐ **31.4** Confirm **Export to PC**, **Present**, **Print** and **Share** all still work while locked.
- ☐ **31.5** Check every empty state — an empty service section, the slide grid, the plan rail, Roles.
  **None should tell you to do something a locked service won't let you do.**

### Reopen

- ☐ **31.6** **Reopen for editing** on a Planned service: one click, no dialog, editing restored.
- ☐ **31.7** ★ **Drag-and-drop works again immediately, no page reload.** If the tab is undraggable
  after reopen, the Sortable teardown regressed — the fix broke the thing it was protecting.
- ☐ **31.8** Export a service to Planning Center, then Reopen. Expect a confirm dialog with the PC
  warning. Cancel → status unchanged. Confirm → back to Draft.
- ☐ **31.9** Re-export that reopened service. Expect it can still target the SAME Planning Center plan.
  This is the case that fails under the intuitive rules shape.

### Enforcement beyond the UI

- ☐ **31.10** ★ **The three-layer test.** With `VITE_USE_EMULATORS=true` and a service set to Planned,
  open devtools and attempt a direct Firestore write to it, bypassing the UI. Expect **permission
  denied**. If it succeeds, first check the flag — an app on live Firebase proves nothing here. If the
  flag is on and the write still succeeds, R036's rules layer has a real defect.
- ☐ **31.11** Delete a service that was exported. Expect the confirm dialog carries the extra Planning
  Center sentence, and deletion works.

### New-service date

- ☐ **31.12** With plans already on the next two Sundays, open New Service. Expect the date to default
  to the third Sunday. Note whether the default team selection looks right for that date — changing the
  default date changes the ordinal-of-month, which drives team defaults.

### Added by wave 3 (31-03) — the transitions themselves

Automated tests cover all of these except 31.14 and 31.15, which need a real backend to fail against.

- ☐ **31.13** Click the status pill on a Draft, a Planned and an Exported service. Expect **nothing to
  happen** — no cursor change, no hover response, no status change. It is a `<span>` now. If it still
  cycles, `toggleStatus` came back.
- ☐ **31.14** ★ **A rejected transition must not flip the status.** Easiest way to force one: stop the
  Firestore emulator, then click **Reopen for editing**. Expect the pill and the banner to keep saying
  **Planned**/**Exported**, and a red line inside the banner reading *"Couldn't reopen this service.
  Check your connection and try again."* Then do the same with **Mark as Planned** on a Draft — the
  pill stays **Draft** and the red line appears inline beside the button. A UI that shows the NEW
  status after a failed write is the exact defect this milestone exists to close.
- ☐ **31.15** Export a service to Planning Center and then **wait ~2 seconds without touching
  anything**. Expect no error, and no permission-denied write in the devtools console. Before this wave
  the autosave fired a full-document write ~800ms after every export, against a service the rules layer
  had just locked.
- ☐ **31.16** Type an edit into a Draft service and click **Mark as Planned** immediately, before the
  autosave settles. Expect the edit to survive — reload and confirm it is still there.
- ☐ **31.17** Mark a Draft service with assigned songs as Planned, then check those songs' **last used**
  date. Expect it to update. That bump used to live inside the save path and moved with this wave.

### Added by wave 4 (31-04) — the read-only tabs themselves

52 automated tests cover the gates, the copy and the Sortable lifecycle at BOTH `planned` and
`exported`. The five below are the parts a jsdom test cannot honestly assert: real pointer dragging,
and whether a stripped screen *reads* as deliberate rather than broken.

- ☐ **31.18** ★ **Reopen, then actually drag.** On a `planned` service, confirm the Service Order rows
  have no drag grips and the Slides grid cards have none either. Click **Reopen for editing**, then —
  **without reloading the page** — drag a Service Order row to a different section, and drag a slide
  card within its group. Both must work. The unit tests prove the Sortable instances are destroyed and
  re-created; only a real pointer proves the re-created instances are actually live. If dragging is
  dead after a reopen, that is the regression this wave was written to prevent.
- ☐ **31.19** Scroll to the bottom of a long locked Service Order tab. Expect the amber lock banner to
  still be pinned at the top of the scrollport, and expect the tab NOT to read as broken with **Add
  Element** gone. That "is it broken or is it locked?" judgement is the whole reason the banner is
  sticky, and no test can make it.
- ☐ **31.20** On a locked service, open the Slides tab and click a slide card. The **Edit Slide drawer
  must still open**, showing the preview at size, the kind badge, the context line and any attached
  audio with a working player — and a gray notice reading *"This service is locked — reopen it for
  editing to change this slide."* If the drawer refuses to open, the lock over-reached: it removed a
  view affordance in the name of a write lock.
- ☐ **31.21** On a locked service, select a slide group that has **no** background music. Expect **no
  empty bordered rectangle** where the group-music control used to be — the whole control should be
  absent. Then select a group that DOES have music: the filename, the "plays across all N slides" line
  and the ▶ preview must all still be there, with no × remove button.
- ☐ **31.22** Eyeball the four locked empty states for tone: an empty Service Order section
  (*"No items in this section."*, no second line), an empty slide group (*"No slides in this group." /
  "Reopen the service for editing to add slides."*), the Slides rail on a service with no plan items,
  and the Roles tab with no quarter schedule (*"No schedule found for this date."*). None may instruct
  the reader to perform an action they cannot perform.

### Added by wave 5 (31-05) — the next-free-Sunday default

31 automated tests cover the date walk and the team side effect (`quarterDates.test.ts`,
`NewServiceDialog.test.ts`, both green). 31.12 above remains the primary human check; these two are
the judgement calls a unit test cannot make. **Neither has been performed — recorded as outstanding,
not as passed.**

- ☐ **31.23** ★ **The team side effect, seen with real data.** Create a plan on the next upcoming
  Sunday, then open **New Service** again. The date must skip to the Sunday after it — and the
  pre-checked TEAMS will change with it, because team defaults are derived from which Sunday-of-the-
  month the date is (1st → Orchestra + Communion, 3rd → Choir, otherwise none). This is intended and
  now tested, but it is a visible change from before: the dialog no longer always opens on the same
  ordinal. Confirm the teams shown are the ones you would actually want for the *skipped-to* date; if
  they are not, that is a product decision to revisit, not a bug in the walk.
- ☐ **31.24** Open **New Service** on a Sunday (or with the machine clock set to one). The default must
  be the FOLLOWING Sunday, never today — the strictly-forward convention this wave locked in and
  commented in `quarterDates.ts`. Also confirm the date field is never blank in the pathological case
  where every upcoming Sunday for a year already has a plan; it should fall back to the plain next
  Sunday and let you type over it.

### Added by the 31-REVIEW fix pass — copy and behaviour changed by BL-01/BL-02/HI-01/ME-01/ME-03

All of these are proven by automated regression tests; what is deferred is only the human judgement on
**wording and feel**, which no test can make. Nothing below was visually confirmed by the run.

- ☐ **31.25** ★ **The service date on a locked service.** Open a `planned` service. The date in the
  header must now be plain text — no hover colour change, no cursor pointer, no picker on click. Reopen
  it and the picker must come straight back with no page reload. Before this fix the picker still opened
  on a locked service and silently discarded the date you chose.
- ☐ **31.26** **The autosave-failure message, draft.** Hard to stage deliberately; if you ever see it,
  check the wording reads right: *"Couldn't save your changes — they're still here. Check your
  connection; editing again will retry."* The claim "they're still here" is load-bearing — a transport
  failure deliberately KEEPS your typing rather than reverting it, so confirm your text really is still
  in the field when this appears.
- ☐ **31.27** **The autosave-failure message, locked.** Stage this with two browsers on the same
  service: type in one, and Mark as Planned in the other within ~800ms. The typing browser should show
  *"This service is locked, so that change wasn't saved. Reopen it for editing and try again."* in the
  amber lock banner, and — this is the part that was broken — must then keep receiving later changes to
  that service instead of freezing silently for the rest of the session.
- ☐ **31.28** **Reorder-failure copy is unchanged.** The drag-failure line still reads *"Couldn't save
  this order — reverted. Try dragging again."* It now shares a state with the autosave failure above but
  must NOT have inherited its wording.
- ☐ **31.29** ★ **Export copy after a status change.** Two browsers, same `planned` service. Export in
  one; then export in the other. The second must refuse *before* contacting Planning Center — check your
  real PC account afterwards and confirm **no duplicate or orphaned plan was created**. This is the one
  item with a real-world side effect that a unit test cannot observe.
- ☐ **31.30** **Mark-as-Planned failure copy.** A store-guard refusal should now say *"This service
  changed status somewhere else. Reload to see where it stands."* rather than blaming your connection.
  A genuine offline failure should still say *"Check your connection and try again."*

---

## Later phases

Appended as each phase completes.

## Phase 32 — Save Reliability: Autosave Fix & Persistent Status

> ⚠ **Read before verifying: the code moved after these items were written.** A code review found
> **3 Critical + 4 Warning** findings and all seven were fixed in commits `5a68288`…`2e76d8b`, which
> land *after* `32-VERIFICATION.md` was produced. Three of those fixes change behaviour you may be
> about to look at:
>
> - **CR-01** — an edit made *during* an in-flight save was being marked clean without ever being
>   written (silent data loss). `onSave()` now marks clean against the payload actually sent, not
>   against live `localService`. **Worth exercising deliberately:** edit, and keep editing while the
>   save is in flight; nothing you typed should be lost.
> - **CR-02** — `flush()` used to destroy a newer edit's only retry path. Reachable via
>   **Mark as Planned** — flush now checks for an in-flight save before clearing the debounce timer.
> - **CR-03** — an outstanding autosave **error** used to vanish silently the instant a service
>   locked. It now routes into `lifecycleError` and stays visible in the lock banner. **Worth
>   exercising:** force a save failure, then Mark as Planned, and confirm the failure is still
>   reported rather than swallowed by the lock.
>
> Full dispositions in `32-REVIEW-FIX.md`. Gates at the fixed HEAD: `npm run type-check` clean,
> `npx vitest run src/` 1981 passed / 9 failed (the two documented baseline files only).
>
> **`32-VERIFICATION.md` is `human_needed`, not `passed`** — the eight items below are why. Nothing
> here has been self-approved.

### Plan 32-04 — `SaveStatusIndicator.vue` and `ToastHost.vue`

- ☐ **32-04.1** ★ **E1 overflow backstop, visual confirmation.** The automated test
  (`src/components/__tests__/SaveStatusIndicator.test.ts`, "E1 overflow backstop") only proves — via
  jsdom, which cannot measure real layout — that the 59-character generic error sentence renders with
  no truncation class and its full text content present inside a 120px-wide mounted parent. It does
  **not** prove the text visually wraps instead of clipping in a real browser. Open `SongLyricEditor.vue`
  (the narrowest of the three editor headers per 32-UI-SPEC.md § E1), force its status into the error
  state, and confirm the sentence *"Couldn't save your changes — they're still here. Try again."* wraps
  onto multiple lines rather than being clipped or causing horizontal overflow of the header row.
- ☐ **32-04.2** Trigger a real save failure (e.g. stop the Firestore emulator, then edit a saving
  surface) and confirm the toast appears bottom-right on a normal-width window, and full-width-minus-
  margins at the bottom on a narrow/mobile width, without overlapping the sticky status bar or the
  Phase 31 lock banner at the top of the viewport.

### Plan 32-05 — `ServiceEditorView` migrated onto `useAutoSave`/`useSaveStatus`; sticky status bar

- ☐ **32-05.1** Open a Service Order with enough items to scroll. Scroll to the bottom of the list.
  Confirm the save-status bar is still pinned at the top of the editing surface, not scrolled out of
  view — this is the exact "it didn't save" failure mode the sticky placement exists to prevent.
- ☐ **32-05.2** Make one edit, then wait at least **ten real seconds** without touching anything else.
  Confirm `Saved h:mm` is still on screen the whole time. The automated suite uses fake timers, which
  proves the 3-second fade is gone but does not prove the text visually stays on screen in a real
  browser tab over real wall-clock time.
- ☐ **32-05.3** With the Firestore emulator running: edit a field so a debounced save fires, wait for
  its own echo to land, then immediately pick a song on a slot. Confirm the pick's save lands against
  the real Firestore `serverTimestamp()` resolution (both the optimistic and the server-ack snapshot) —
  jsdom's mocked `updatedAt`/`hasPendingWrites` values simulate this but do not prove it against a real
  backend.
- ☐ **32-05.4** ★ **The "above the fold" reading.** This plan's own `<flagged_reading>` section records
  that R040's "never above the fold" was read as "not parked in the global app header, far from the
  content" — which is why the status lives in a sticky sub-header of the editing surface itself, rather
  than (for example) the app's top-level header bar. That reading was Claude's recommendation, accepted
  under the standing autonomy grant — **not an owner statement**. Confirm this is what was actually
  meant; if not, only this plan's Task 2 template change (the `service-save-status-bar` placement) needs
  revisiting, not the store/composable layer beneath it.

### Plan 32-06 — `CongregationalEditor`/`ScriptureSlideEditor`/`SongLyricEditor` onto `SaveStatusIndicator`

- ☐ **32-06.1** Open the song lyrics editor, edit a section, and confirm the header shows `Saving…` then
  a persisting `Saved h:mm` rather than the old dot-and-tick. `CongregationalEditor.vue` and
  `ScriptureSlideEditor.vue` are currently unmounted dead weight pending Phase 34, so this check is only
  possible against `SongLyricEditor.vue` today — reconfirm the other two once Phase 34 mounts them.
- ☐ **32-06.2** Resize below 640px with a failure showing and confirm the sentence *"Couldn't save your
  changes — they're still here. Try again."* wraps rather than clipping in the narrowest header
  (`SongLyricEditor.vue`'s `flex items-center gap-2` group). The automated E1/E4 overflow backstop
  (`src/components/__tests__/SongLyricEditor.test.ts`) only proves — via jsdom, which cannot measure real
  layout — that no truncation class is present and the full text renders; it does not prove the sentence
  visually wraps in a real browser.
- ☐ **32-06.3** With a screen reader active, confirm a routine save (`Saving soon…` / `Saving…` /
  `Saved h:mm`) is announced politely and does not interrupt, while a failure raises the assertive toast
  in addition to the polite inline announcement.

---

## Notes and failures

_(Record anything that failed here, with what you saw versus what was expected.)_
