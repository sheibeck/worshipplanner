# Pending Human Verification — v1.4

## ⛔ CLOSED UNRUN — 2026-08-05. Do not read the items below as "done".

**The owner closed milestone v1.4 without executing this list.** Instruction, verbatim: *"I think
we're good with this milestone. Any issues I find from here on out will go in the next set of changes
I'm going to post."* followed by *"Mark all phases as verified, then close the milestone."*

Every phase's `*-VERIFICATION.md` was accordingly flipped to `status: passed` with
`status_source: owner-attributed`, and the milestone was archived. **The checks below were never
performed.** Phase 38's items (38.1–38.7) were approved the same way earlier the same day.

This file is deliberately preserved in full rather than deleted or ticked off. If a defect later
surfaces anywhere in phases 31–38, the item that would have caught it is still written here, still
unticked, and the record shows plainly that nobody ran it. That is the point — an accepted risk that
stays legible is very different from one that gets tidied away.

**The single highest-value unrun item, if you ever spot-check just one:** **38.4** — split a
congregational reading, delete one section slide, reload, confirm it stays deleted. It is the one
claim in this milestone with a history of failing on a *later* reactive tick rather than the first,
and the only one whose automated proof (`congregationalDetachment.test.ts`) cannot substitute for a
real Firestore round-trip.

**Also still true regardless of this closure:** Phase 37's render service is **built but undeployed**
by the owner's own instruction, R062 is `[~]` partial, its two package-legitimacy checkpoints were
never approved, and no code review was ever run for that phase. Closing the milestone changed none of
that. See `37-VERIFICATION.md`.

---

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

## Phase 33 — Backgrounds & Slide Editing

Recorded from 33-09-PLAN.md's `<verification>` § Manual-only list — the phase's own last plan. These are
the items the phase's plans deliberately deferred under the standing autonomy grant rather than
attempting to fake with jsdom.

- ☐ **33.1** With a screen reader active, tab to a slide card's 3-dot menu trigger, open it with Enter
  or Space, move through the items, close with Escape, and confirm focus returns to the trigger and the
  reader announces the menu correctly. The automated suite proves `role="menu"`/`role="menuitem"`/
  `aria-haspopup`/`aria-expanded` are present and that Escape closes the panel in jsdom; it cannot prove
  a real screen reader announces it correctly, and there is **no arrow-key roving-tabindex navigation**
  (a stated, deliberate gap — 33-UI-SPEC.md § Accessibility Note).
- ☐ **33.2** Confirm the 3-dot menu (its trigger, its open panel, its click-away backdrop) does not
  interfere with dragging a slide card via its own drag handle — open a menu, close it, then drag-reorder
  the same card, and drag a card whose menu was never opened.
- ☐ **33.3** ★ **Inheritance legibility across all three background levels** — this phase's own named
  sharpest UI risk. Set a song background, confirm it shows on the song editor, on every group of that
  song with no group override, and on every slide with neither a group nor a slide override, each with
  the correct "From song"/"Inherited from song" wording. Then set a group override and confirm slides
  flip to "From group". Then set one slide's own override and confirm only that card shows "Background"
  (indigo) while its siblings are unaffected. An override that is not visibly distinguishable at a glance
  is the exact failure mode this phase exists to prevent.
- ☐ **33.4** The per-type 3-dot menu item list (33-UI-SPEC.md §3's table) is **original design work with
  no wireframe to check it against** — review the table directly against what each slide type (song
  lyric/copyright, scripture, hand-authored text, Hymn-pristine text, image, video, other imported)
  should actually offer, and confirm it matches the owner's intent, not just internal consistency.
- ☐ **33.5** (33-09, R051) Drag-reorder a slide card without opening its menu first — confirm the drag
  starts and completes cleanly with no drawer flashing open, on both a freshly-loaded grid and one where
  a different card's drawer is already open.
- ☐ **33.6** (33-09, R052) Open a lyric or scripture slide's 3-dot menu and confirm "Edit in song"/"Edit
  in scripture" still navigate correctly now that the trigger lives in the menu rather than the drawer's
  body — including while the drawer for a DIFFERENT slide is already open (the navigation must not
  require the drawer to be open at all).

---

## Phase 34 — Smarter Content: LLM Scripture Split

R064's structural guarantee (boundary-index contract, schema, validator, call shape, additive/
non-blocking failure path) is complete and automated-tested end to end across 34-01/34-02/34-03/34-04.
The two items below are the ones this phase genuinely cannot close by itself — one needs a live
Anthropic API call this environment cannot make, the other needs an owner decision this phase's plans
were explicitly told not to make on the owner's behalf. Neither is marked passed, resolved, or
self-approved.

- ☐ **34.1** ★ **Empirical split determinism (manual-only — no live Anthropic API access here).**
  Simulating this with a fixture would give false confidence about model behaviour, which is exactly
  what is under test, so it was not attempted. Run the "Split with AI" affordance against **Psalm 136**
  (the archetypal responsive reading, with a repeated congregational refrain — the case most likely to
  expose a boundary-tuning problem) and **Psalm 24** (a natural call-and-response shape), each **more
  than once**, and compare the runs. Confirm: every returned section's text matches the ESV source
  exactly (no rewording, no dropped/added words); no split falls mid-sentence; the LEADER/CONGREGATION
  assignment reads as sensible (in particular, a repeated congregational refrain like Psalm 136's "for
  his steadfast love endures forever" should land on CONGREGATION consistently); and repeated runs on
  the *same* passage give a stable (or at least reasonably consistent) result. A split that validates on
  every offset but varies noticeably run-to-run is a **usability problem, not a correctness one** —
  record it either way, don't treat it as a pass/fail gate on its own. If the sections read as too long,
  or the split misses a natural sub-verse break a human would take, the first knob to revisit is the
  **deliberate exclusion of the comma** from `scriptureBoundaries.ts`'s `CLAUSE_END_PATTERN` (34-01) — a
  tuning change to a regex, not a change to any validation logic.

- ✅ **34.2 RESOLVED (34-07, 2026-08-03).** ~~The owner decision blocking reachability —
  `CongregationalEditor.vue` is mounted nowhere.~~ Resolved per owner UAT finding F1 (`34-UAT.md`): the
  mount seam is the SCRIPTURE **slide**, not the Service Order row (34-05/34-06 landed direction (b) —
  `ScriptureSlot.congregationalSections` threaded through `slideGroupMaterializer`/`slideshowAssembler`;
  no re-link to the rejected separate `ScriptureReading` document model). `CongregationalEditor.vue` is
  now mounted by `ServiceEditorView.vue` as a `Teleport`ed modal, reachable from the scripture slide's
  3-dot action menu (`edit-in-scripture`, relabelled "Edit scripture text") and the Edit Slide Drawer's
  new Slide Text control, both converging on the same relay. The `WR-04` call-site contract flagged below
  is honored: the modal is mounted `:key="congregationalSlot.id"`, proven by a dedicated slot-swap test
  (`ServiceEditorView.test.ts` — "WR-04 keyed mount (34-07 Task 3)") that asserts a fresh component
  instance, correct re-seeding, and correct write attribution after the swap. See `34-07-SUMMARY.md`.
  **The 2026-08-03 owner decision that produced this mount seam, stated explicitly:** the scripture
  slide's own edit route opens `CongregationalEditor`; no free-text scripture override was added
  anywhere — the owner was shown the shadow-copy tension a free-text field would create and declined
  it, so the only route to slide text remains fetch-then-split inside the editor itself.
  ~~No route, no parent component, no dynamic import references it anywhere outside its own
  test file — so as of this plan, no user can reach either the manual congregational-reading editor or
  the AI split added on top of it. This makes ROADMAP success criterion 1 ("A scripture item can be
  split into a leader/congregation congregational reading") false today for an actual user, despite
  `34-CONTEXT.md`'s initial (later self-corrected) claim that it was "already true, manually." Phase 30's
  R047 deliberately left both `CongregationalEditor.vue` and its sibling `ScriptureSlideEditor.vue` "on
  disk, unmounted, for Phase 34/R064 to reuse" — without specifying where they should be mounted.
  Mounting requires choosing between two data-model shapes, and the owner has already ruled against one
  of them once: (a) re-link the editor's separate `ScriptureReading` document to the `SCRIPTURE` slot —
  the model R047 explicitly rejected in favour of slot-as-source-of-truth (`3da5fe4` superseded by
  `5c531b1`); or (b) add `congregationalSections` onto `ScriptureSlot` itself and carry it through
  `slideGroupMaterializer`, matching the direction R047 actually took for the scripture reference. No
  plan in this phase picked a default, because a default already exists and the owner overturned it once
  in the opposite direction — this is the owner's call to make, not a planner's to assume. Also
  record, for whoever mounts it: `CongregationalEditor.vue`'s own `WR-04` call-site-contract comment
  (added 32-REVIEW, addressed by name to Phase 34) — `currentReadingId` and everything seeded from it
  (`surfaceId`, `sections`, `referenceText`, `rawText`) are captured once at mount and are not
  reactive to `props.readingId` changing afterward. Whoever wires this component into a route or parent
  must mount it keyed on `readingId` (e.g. `:key="readingId"`) so a record swap forces a fresh
  instance; reusing one mounted instance across different `readingId` values is not a supported usage and
  will silently misattribute later saves to the first reading the instance ever saw.~~

The four items below are new, opened by 34-08's phase gate. Each is deferred under the standing
autonomy grant and explicitly **not** self-approved — none checks a box this run cannot actually verify.

- ☐ **34.3** **The now-reachable feature (34-07's R064 close, end to end).** Open a draft service,
  reach the congregational panel from a scripture slide by BOTH routes (the 3-dot menu and the drawer's
  Slide Text section), build a reading by hand and with the AI split, present the service, and confirm
  the Leader/Congregation layout projects correctly and legibly. Also confirm that changing the passage
  on a slot that already has a reading clears it as intended rather than surprising the user.

- ☐ **34.4** (from 34-09 / UAT F3) **Background scrim legibility on a real projector.** Set a
  background on a group, present the service, and confirm the image appears behind every slide of that
  group and that the projected words stay readable over it on a real projector. The scrim opacity
  (`bg-black/50`) is the knob to revisit if they do not.

- ☐ **34.5** (from 34-11 / UAT F2) **The merged group-media panel reads as one panel.** Confirm the
  merged group-media panel reads as one panel rather than two rows in a box, and that a locked service
  still shows what it has without an empty box.

- ☐ **34.6** (from 34-12 / UAT F5) **The org document's actual Planning Center credential fields.**
  Open the Firebase console for this organization's document and confirm whether the `pcAppId` and
  `pcSecret` fields exist and are non-empty. **Report presence or absence only — never the values.**
  This is the half of the F5 diagnosis that cannot be observed from a test environment, and it decides
  whether the symptom was cause 1 (no credentials configured) or something else. 34-12 Task 1's verdict
  (the reactivity self-heal test) already settled cause 2 (a load-order/reactivity regression) as
  unlikely — this item settles the remaining half.

---

## Phase 35 — Presentation Correctness & Lyric Editor

R059/R060/R061's structural work and R065/R066's inline-paste behavior are all automated-tested
across 35-01/35-02/35-03/35-04 — including the R065 copyright gate, the always-available override
checkbox, the E4 save-rejection backstop, and R066's modal-to-inline swap (`LyricPasteDialog.vue`
and its test file are deleted; `grep -rc 'LyricPasteDialog' src/` returns 0). The four items below
are 35-VALIDATION.md's Manual-Only Verifications table — jsdom cannot judge projector legibility,
what a congregation actually sees, or subjective feel-against-a-mockup fidelity. None is marked
passed, resolved, or self-approved.

- ☐ **35.1** **Copyright slide legibility at projector distance (R060 long-text backstop).** A song
  with an unusually long title, a long author list, or many `copyrightLines` must not overflow the
  projected copyright slide or push the **CCLI licence number** off-screen — that number is the one
  element that must always be visible. Needs a real projector or a fixed-viewport render; not
  settleable in jsdom. **Instructions:** project a song with a long title and 4+ authors. Confirm the
  licence number is visible on both the leading and trailing copyright slide.

- ☐ **35.2** **Presented lyric slide shows no organizational label (R059).** The `sectionLabel`
  render was deleted from `PresentationViewer.vue`'s `lyric` branch — confirmed by
  `grep -c 'sectionLabel' src/components/PresentationViewer.vue` returning 0 — but the point of R059
  is what a congregation actually sees on the projected surface. **Instructions:** present a song.
  Confirm no VERSE / CHORUS / BRIDGE label appears on any lyric slide, and that the slide grid still
  shows them (the field itself is untouched — only the presented render changed).

- ☐ **35.3** **Presenting starts where you were looking (R061).** The start-index threading is
  automated-tested (`SlidesTab.vue` → `ServiceEditorView.vue` → `PresentationViewer.vue`), but
  whether it *feels* like a natural start rather than a jarring mid-deck jump is a UX judgment, not
  an index-arithmetic one. **Instructions:** highlight a slide mid-deck, press Present — it should
  open there with no "you skipped ahead" indication. Then highlight only a group (no slide within it)
  and confirm it starts at that group's first slide, never slide 0 of the whole deck.

- ☐ **35.4** ★ **The inline paste region reads as designed (R066, 35-03's D7).** Compare against
  Turn 3 of the wireframe (`docs/design/slides-tab.dc.html:358-654`). State transitions and gating
  logic are exhaustively covered by `LyricPasteRegion.test.ts` (16 tests) and
  `SongLyricEditor.test.ts`'s "paste mode" block (9 tests, including both entry points, the
  header/body swap, the reopen-reset, and both exits' unsaved-changes guard) — but visual/interaction
  fidelity against the mockup is not settleable by jsdom assertions. **Instructions:** open the
  editor, click "Paste lyrics" (and separately, from an empty song, "Paste Lyrics from SongSelect")
  and confirm the drawer swaps to the paste view in place rather than opening a modal. Paste a real
  CCLI song with a copyright block, and one without. Confirm the second shows the amber warning card,
  disables **Replace lyrics**, and that ticking "Add anyway — I'll enter credits later" alone
  re-enables it with nothing else required.

**Also noted, not blocking:** 35-VALIDATION.md records that a second attempt to retrieve CCLI's
primary licence text failed (2026-08-03; a prior attempt returned marketing copy). Nothing in this
phase cites CCLI as a mandate — every warning card and instructional copy this phase ships was
reworded specifically to avoid that claim (`grep -rEin 'ccli (requires|mandates|requirement)|licen[cs]e requires' src/`
returns 0 matches) — so this omission does not block anything; it is only relevant if the owner wants
the underlying R060 criterion formally finalised against the primary source text.

---

## Phase 37 — PowerPoint Server-Side Rendering

This phase built and automated-tested the render service, its Dockerfile, the bridging
function, the completeness check, both IAM contract directions (as reviewable, unexecuted
documentation), the font policy, and the orphan-cleanup dry-run default — `render-service/`
(39/39 tests) and `functions/` (70/70 tests) are both green. **Nothing was deployed. No
container was built. No GCP resource was created**, by explicit owner instruction
(STATE.md v1.4: BUILD BUT DO NOT DEPLOY). Every item below is open.

- ☐ **37.1 Real visual fidelity (R062 criterion 1).** Only a deployed service can render.
  Instructions: run `render-service/DEPLOY.md`'s deploy command, then import a **real
  multi-font, multi-slide deck** — the ROADMAP is explicit that a 2-slide fixture proves
  nothing about fidelity or cost. Compare backgrounds, fonts, layout and effects against
  PowerPoint's own rendering. Note that static-frame export means transitions and animations
  are not rendered, which is expected: R062 asks for a true visual representation, not motion.
- ☐ **37.2 Font substitution actually happened (R062 criterion 3's *effect*).** The Dockerfile
  test proves the right packages are installed and no Microsoft font is bundled; it cannot
  prove LibreOffice actually maps Calibri to Carlito and Cambria to Caladea. A fontconfig
  alias file was shipped for exactly this reason, but 37-RESEARCH.md records it as an
  assumption until seen. Instructions: import a deck authored in Calibri and Cambria and
  confirm the rendering is metrically correct rather than falling back to Liberation Sans.
- ☐ **37.3 Cost and latency.** Cannot be estimated credibly without running it, and this run
  refused to estimate and call it validated. Instructions: render several real decks; record
  CPU-seconds and wall time. Cold starts likely dominate. Revisit `--memory=2Gi`, `--cpu=2`
  and `--max-instances=5` against the observed numbers.
- ☐ **37.4 The deploy itself.** Every command in `render-service/DEPLOY.md` provisions
  billable infrastructure and is the owner's call. Instructions: review
  `render-service/DEPLOY.md`, confirm the region against the project's actual
  Firestore/Functions region, then run the prerequisites, the deploy, and the
  `roles/run.invoker` binding. Afterwards set `PPTX_RENDER_SERVICE_URL` and redeploy
  `functions/`.
- ☐ **37.5 Sign-off on the new dependencies.** Two package-legitimacy checkpoints were
  deferred during this phase, never self-approved:
  - **37-01** (`render-service/`): `express`, `@google-cloud/storage`, `@types/express`,
    `@types/node`. Mechanical `npm view ... repository` checks resolved `express` to
    `github.com/expressjs/express` (128.3M/wk downloads, Approved), `@google-cloud/storage`
    to `github.com/googleapis/google-cloud-node` (15.5M/wk, Approved), and both `@types/*`
    packages to `github.com/DefinitelyTyped/DefinitelyTyped` (canonical convention).
  - **37-03** (`functions/`): `google-auth-library`, resolved to
    `github.com/googleapis/google-cloud-node` (`core/packages/google-auth-library-nodejs`),
    latest `11.0.0` published 4 days before that plan ran, by Google's official npm bot,
    77.5M weekly downloads. Flagged `[SUS]` by the package checker on a pure `too-new`
    heuristic — running the identical checker against this repo's own already-shipping
    `firebase-admin` and `firebase-functions` produces the same `[SUS]`/`too-new` verdict, so
    this reads as a false positive from Google's fast Node-client release cadence rather than
    a real risk signal. It is recorded rather than hidden, per protocol, and still requires
    sign-off.

  Instructions: confirm you are comfortable with `google-auth-library` in `functions/`, and
  with `express`, `@google-cloud/storage`, `@types/express` and `@types/node` in
  `render-service/`.
- ☐ **37.6 Review a cleanup dry-run before enabling deletion.** `cleanupOrphanRenders` runs
  daily at 03:00 UTC and is dry-run-by-default; `PPTX_RENDER_CLEANUP_ENABLED` must stay unset
  until a real log has been read. Instructions: after the service has run for a while, read a
  dry-run log and confirm the would-delete list contains only stale `pending`/`failed`
  renders and their `rendered/` objects — never a `source.pptx`, never anything under
  `images/`, never a `ready` render.

---

## Phase 36 — UI Rework: Service Order & Contextual Action Bars (2026-08-04)

- ☐ **36.1 ★ OWNER DECISION — ROADMAP criterion 4's `＋ Add slide` clause is not literally met.**
  This is a **gap recorded by `36-VERIFICATION.md`, not a pass, and it was deliberately not
  self-approved.** Criterion 4 reads *"'＋ Add slide' lives in the contextual action bar."* It does
  not — Phase 36 kept it in `SlideGrid.vue`'s own header, a separate component from
  `ContextualActionBar.vue`.

  The reasoning is sound and was disclosed consistently rather than discovered at verification: the
  wireframe (design "1a") draws `＋ Add slide` in the grid's own header and never in a page-level bar,
  and `36-CONTEXT.md`'s own stated precedence rule is that the wireframe wins. It is recorded in
  `36-UI-SPEC.md` § Finding 2, in three plans' frontmatter, and in a SUMMARY.

  **What makes it an open item rather than a closed one:** the sibling clause of the same criterion
  ("Add music to this group") received a *dated, evidence-cited correction* in both `ROADMAP.md` and
  `REQUIREMENTS.md` before planning began. This clause never did. Two options, both legitimate:
  1. **Accept the override** — a ready-to-paste block sits in `36-VERIFICATION.md`'s frontmatter.
     Choosing this means R053 is delivered as "interaction pattern, not visual unification", and
     criterion 4 should get the same dated correction its sibling clause got.
  2. **Commission the full relocation** — materially more expensive, and the UI-SPEC recommends
     against it rather than forbidding it. This is a real scope addition, not a bug fix.

- ☐ **36.2 Look at the rebuilt Service Order tab on a real screen.** Every structural claim is
  test-asserted, but the wireframe match itself is a visual judgment: the five section bands with
  their slide counts and per-band `＋ Add item` chips, the dashed `＋ Add to the service` palette that
  replaced the dropdown, and the tab strip now reading Service Order · Slides · Roles.

- ☐ **36.3 Confirm the action bar reads right on each tab.** Switch between all three tabs and confirm
  only that tab's actions appear — in particular that `Suggest All Songs` and `Copy for PC` are gone
  from Slides and Roles, that Present sits immediately left of Save, and that the Roles tab's empty
  action-bar slot looks deliberate rather than broken. **The Roles empty slot is one of the UI-SPEC's
  two `unresolved` items** — the design never drew it.

- ☐ **36.4 Two affordances the wireframe draws but nobody implemented — confirm this was right.**
  Turn 3 shows a row-level `⋯` kebab and a `Change` link on service items. Neither has any
  current-code equivalent or defined behavior, so both were **deliberately left unbuilt and recorded
  rather than guessed at.** If you wanted them, they are new work with no spec.

- ☐ **37.1 (quick 260805-kzd) Confirm the label-free slides read right in a running Present view.**
  Automated tests pin the markup, but "does this project legibly" is a visual judgment no test makes.
  Open Present on a real service and check four cases:
  1. A scripture slide whose passage has **not** been fetched — it must show the reference (e.g.
     "John 3:16") in large white text, **not a blank slide**. This is the specific hazard the change
     was designed around; the assembler builds these with `text: ''`.
  2. A scripture slide **with** the passage fetched — reference above, passage below, both the same
     size now. Confirm the loss of the old size hierarchy doesn't make the two run together.
  3. A congregational reading — "Leader:" / "Congregation:" are now plain white at body size with no
     indigo/amber accent. Confirm you can still tell the parts apart at projection distance; if not,
     say so, because the congregational-split phase can address it.
  4. A **Message** and a **Prayer** item — the blue heading should be gone entirely, leaving only the
     white body text.

---

## Phase 38 — Congregational Readings Become Real Slides (2026-08-05)

D1's two-state mechanism (Reference/Congregational), the singular `ScriptureSlide.section` field
and speaker-above-passage projected layout, the drawer's per-section edit/speaker-flip/delete, and
the composed multi-tick durability contract (convert, delete-one, delete-all, edit, speaker-flip,
reorder, destroy-on-reference-change, destroy-on-cleared-reference, re-convert, re-split, both
migration shapes, and a non-ASCII encoding backstop) are all automated-tested end to end across
38-01/38-02/38-03/38-04 — `npm run type-check` clean, full app suite 2490/2499 passing with the 9
failures confined to the documented two-file baseline (`src/storage.rules.test.ts`,
`src/views/__tests__/RosterView.test.ts`). **38-04's own Task 3 checkpoint (owner verification of
the split/edit/delete/present flow) was deferred under the standing autonomy grant and is recorded
below — it was never run, and nothing in this item was self-approved.**

- ☐ **38.1 Split a scripture item into congregational sections and confirm one card per section.**
  Run the app against a DRAFT service, do not deploy anything.
  1. Service Order tab: add a Scripture item and give it a reference (e.g. `Psalm 136:1-9`).
  2. Slides tab: confirm that item's group shows ONE card, showing the reference only.
  3. On that card, open the 3-dot menu and choose the scripture-text action. In the modal, click
     **Fetch Passage**, then **Split with AI** (or leave the alternating manual split). Close the
     modal.
  4. Slides tab: confirm the group now shows one card PER SECTION, and that each card names its
     speaker — Leader or Congregation — rather than all reading the same generic label.

- ☐ **38.2 Edit a section's words in isolation.** Open the Edit Slide drawer on the SECOND card.
  Change some of its words. Close the drawer. Confirm the second card changed and that NO other
  card did.

- ☐ **38.3 Flip a section's speaker in isolation.** Reopen that same drawer and flip the speaker
  (Leader to Congregation or back). Confirm only that card changed.

- ☐ **38.4 ★ Delete one section and confirm it survives a reload.** Delete the THIRD card. Reload
  the page. Confirm it is still gone, and that the remaining cards kept their order and their
  words. **This is the criterion that has failed before (a rebuild reverting on a LATER reactive
  tick, not the first one) — check it twice, waiting a few seconds after the reload before
  judging.** 38-04's own automated durability suite (`congregationalDetachment.test.ts`) proves this
  across repeated `rebuildGroup` ticks in isolation; this item is the same claim against a real
  Firestore round-trip and a real page reload, which no unit test can substitute for.

- ☐ **38.5 Present the split reading and confirm the projected layout.** Click Present. Step
  through the reading. On each section slide confirm: the reference at the top, the speaker on its
  OWN LINE below it, and that section's words below the speaker — one section per slide, never
  several stacked. This also closes out item **37.1**'s open sub-point 3 (whether Leader/Congregation
  read as distinguishable at projection distance without an indigo/amber accent) — judge that here
  rather than separately.

- ☐ **38.6 Confirm a scripture change destroys the split (intended data loss, D1).** Return to the
  Service Order tab and change that item's scripture to a DIFFERENT passage. Go back to the Slides
  tab and confirm the group has collapsed to ONE card showing the new reference. This is intended:
  the split is gone and must be chosen again — per-slide edits made in the congregational state do
  not survive a scripture change on the service item.

- ☐ **38.7 An existing pre-Phase-38 congregational reading upgrades itself with no action.** If you
  have an EXISTING service that already had a congregational reading before this phase, open its
  Slides tab and confirm it now shows one card per section without any action from you. If you do
  not have one, say so rather than guessing — the automated migration case
  (`congregationalDetachment.test.ts`'s "MIGRATION, congregational") proves the mechanism, but only a
  real pre-existing document proves the deploy didn't miss a shape.

**Report which of 38.1-38.7 passed and which did not, by number.**

---

## ✅ v1.5 PHASES 43–49 ACCEPTED AS VERIFIED — 2026-08-10 (owner decision, milestone close)

**The owner explicitly accepted Phases 43, 44, 45, 46, 47, 48 and 49 as verified** at v1.5 milestone
close, on the basis that all of v1.5 was **deployed to production on 2026-08-10 and has been in
real-world use**. Chosen via an explicit question/answer during the milestone-cleanup step (the v1.4
precedent). Each of those phases' `*-VERIFICATION.md` was accordingly set to `status: passed` with
`status_source: owner-attributed`, and any still-unchecked items in their sections below were checked
off as owner-accepted rather than individually re-run.

This is **owner attribution, not self-approval** — the record shows plainly that the owner accepted
them based on production use rather than that each listed check was independently executed. If a defect
later surfaces in phases 43–49, the item that would have caught it is still written below, and this
banner shows it was accepted-by-use, not run. Phase 50's two items were genuinely verified
(50.1 by production header inspection, 50.2 owner-verified) and are not part of this attribution.

---

## Phase 39 — Org Settings Infrastructure & Feature Toggles (v1.5)

Deferred under the v1.5 standing autonomy grant (STATE.md, 2026-08-06). All automated gates
(`npm run type-check`, `npx vitest run src/views/__tests__/SettingsView.test.ts`, the full app
suite) are green; the items below need a human because jsdom cannot prove a real Firestore
round-trip or judge visual wrapping.

- ☐ **39.03-1 Credential retention across a real off → reload → on cycle.** In Settings, enter
  Planning Center credentials, toggle the integration off, RELOAD THE PAGE, toggle it back on, and
  confirm the masked credential display is present and unchanged. `SettingsView.test.ts`'s
  `never clears Planning Center credentials when the integration is turned off` test proves the
  handler issues no clear-credentials call and no `updateDoc` payload names `pcAppId`/`pcSecret` —
  only a real Firestore round-trip plus reload proves the value actually survives. This is the one
  state in this phase that could silently destroy user data if implemented wrongly (R089).

- ☐ **39.03-2 AI feature list does not wrap past 2 lines.** At a standard desktop viewport, open
  Settings and confirm no item in the AI Features list wraps beyond two lines. The three
  descriptions are authored under 80 characters by design to hold each item to one line at
  `max-w-4xl`.

- ☐ **39.03-3 / 39-02 D7 — Defaults on a genuinely pre-v1.5 organization document.** Open the
  Settings screen against a REAL organization document created before v1.5 (not a fixture). Confirm
  both the "Enable AI features" and "Enable Planning Center integration" checkboxes render
  **checked**, and that both feature sets render visible — never a blank or indeterminate checkbox.
  Carried forward from `39-02-SUMMARY.md`'s D7: the Settings screen the defaults-merge point feeds
  did not exist until this plan shipped.

- ☐ **39.03-4 `vwModeEnabled` migration does not silently re-enable a deliberately-off church.**
  Against a real organization document with a flat `vwModeEnabled: false` and no `settings` key,
  confirm the Vertical Worship toggle renders **unchecked** on first load, then confirm saving ANY
  toggle on the Settings screen backfills a nested `settings.vwModeEnabled: false` (not `true`) onto
  that document. A naive `settings.vwModeEnabled ?? true` read would silently flip a real church's
  deliberate opt-out back on — `auth.test.ts`'s fixture-based regression test proves the merge
  function; only a real document proves the deployed read+write path.

- ☐ **39.06-1 Congregational editor button-row reflow (R088).** With the AI toggle off, open a
  congregational reading editor (via a scripture slide's 3-dot menu or the Edit Slide drawer's Slide
  Text section). Confirm the button row shows two buttons ("Fetch Passage" and the reference input's
  action, not three) rather than three, that the row reads as visually balanced rather than lopsided
  now that "Split with AI" is gone, AND that hand-dividing a reading (adding/removing section breaks,
  flipping Leader/Congregation by hand) works identically with the AI button absent — the functional
  half is the real guarantee, per `39-UI-SPEC.md` § E5's `absent (new)` backstop.
  `CongregationalEditor.test.ts`'s "AI toggle (39-04)" block proves the button hides and that hand
  edits (a speaker toggle) still apply against an AI-off mount; only a real browser proves the row
  reflow reads as deliberate rather than broken.

---

## Phase 40 — Custom Auth Claim for Org Membership

**Phase status: VERIFIED PASSED (4/4).** Nothing here is a defect. These are the owner-only steps
that criterion 4 deliberately places *outside* the phase — the code is built, tested and handed over.

**Full runbook with verbatim commands: `functions/DEPLOY-ORG-CLAIMS.md`.** This list is the tracker.

- [x] **40.1 — Deploy 1: dual-read rule + `syncOrgMembershipClaim`.** ✅ **DEPLOYED 2026-08-10** (by
      assistant at owner's explicit request, as part of the full v1.5 production release —
      `firebase deploy --only hosting,functions,firestore,storage`). `syncOrgMembershipClaim` created;
      dual-read `storage.rules` released; fallback arm live. Additive and safe. **⧗ OBSERVE (owner,
      pending):** confirm an existing member can still upload in the LIVE app (PPTX import or media) —
      this is the only behavioral proof the Firestore fallback arm still works in production.
- [ ] **40.2 — Run the backfill.** ⚠ **NOT RUN 2026-08-10** — the deploy host had no gcloud ADC
      (`GOOGLE_APPLICATION_CREDENTIALS` unset), which the backfill requires. **Non-blocking:** the
      dual-read fallback covers existing members, and `refreshOrgClaim` (auth.ts) sets each user's
      claim on their next `loadOrgContext`. Owner may still run it for immediacy:
      `gcloud auth application-default login`, then `cd functions && npm run build && node
      lib/backfillOrgClaims.js` (dry-run) → `--apply`. **Required before Deploy 2** (Step 4), since
      after the fallback is gone the claim is the sole authority.
- [ ] **40.3 — Soak one full hour.** Every live token must expire and re-issue carrying the claim.
      Skipping this is what locks people out at deploy 2.
- [ ] **40.4 ★ MANDATORY PRE-CHECK before deploy 2** — confirm neither user's `orgIds` has more than
      one entry. The claim carries `orgIds[0]` only; a multi-org user would lose access to their
      non-primary orgs the moment the fallback is removed.
- [ ] **40.5 — Deploy 2: remove the Firestore fallback.** **Observe:** both users still upload.
      **Expected tripwire:** `src/storage.rules.test.ts`'s structural OR-guard test will FAIL BY
      DESIGN once this edit lands. That failure is the signal it worked — do not chase it.
- [ ] **40.6 — Exercise the real pending invite.** One never-accepted invite exists. Accept it and
      confirm the claim is set and upload works with no manual refresh (this is what the bounded
      retry, `CLAIM_REFRESH_MAX_ATTEMPTS=4` / `CLAIM_REFRESH_DELAY_MS=1500`, exists to cover).

> **⚠ Security consideration to weigh BEFORE deploy 2 — code review WR-03.**
> `firestore.rules:36-40` lets any signed-in user self-create a membership document in any org.
> **This predates v1.5 and is not caused by Phase 40** — `firestore.rules` is explicitly out of this
> phase's scope (R074) and rules changes are deploy-gated to you.
>
> But it interacts with deploy 2. Today that gap is bounded by a per-request Firestore check;
> after deploy 2 the claim becomes the sole authority and revocation latency stretches to **up to
> one hour**. The hole does not get wider — its consequences get slower to undo. Worth a decision
> before you remove the fallback, not after.
>
> **UPDATE (Phase 40.1, 2026-08-06): the fix is built and tested, and it is undeployed.**
> `firestore.rules`' `allow create` on `organizations/{orgId}/members/{uid}` now authorizes exactly
> the two legitimate creation flows (org founding, invite acceptance) and denies both an uninvited
> self-join and a role-escalated invite acceptance — proven against the real Firestore emulator by
> five new tests in `src/rules.test.ts` (**108/108 passing**; three of the five were first observed
> FAILING against the rule as it then stood, then confirmed passing after each fix). It ships in the
> same deploy session as this phase's deploy 2 — see the Phase 40.1 section below.

**Rollback at any point:** re-deploy the dual-read rule. The fallback arm restores access immediately.

---

## Phase 40.1 — Close the Self-Service Membership Hole (R104)

**Phase status: built and tested, NOT deployed.** `firestore.rules`' `allow create` predicate on
`organizations/{orgId}/members/{uid}` (used to read only `isSignedIn() && request.auth.uid == uid`)
now authorizes exactly the two legitimate creation flows — org founding (via **`!exists()` AND
`getAfter()`** on the sibling same-batch org doc) and invite acceptance (via `get()`/`exists()` on
the pre-existing invite doc, with the submitted role checked against the invite's stored role) — and
denies an uninvited self-join, a role-escalated invite acceptance, **and a removed past founder
re-granting themselves editor**. Proven against the real Firestore emulator:
`npx vitest run --config vitest.rules.config.ts` reports **108/108**, and three of the five new
tests were first run against the then-current rule and observed to fail. Nothing was deployed.

> **⚠ The `!exists()` half is load-bearing — do not simplify it away.** Code review finding CR-01
> caught that `getAfter(org).data.createdBy == uid` **alone** proves only the field's *current*
> value, not that the org is being created right now. Because `createdBy` is set once and never
> cleared, that predicate let **any past founder — including one explicitly removed via TeamView's
> "Remove member" — re-grant themselves `role: 'editor'` at any later time.** Worse, combined with
> the still-open `organizations/{orgId}` unrestricted-editor-write finding below, a current editor
> could rewrite `createdBy` and plant a durable backdoor for a uid that was never a member.
> `!exists()` reflects batch-START state and cannot see the batch's own sibling org-create, so
> together the two clauses mean "this org is being created right now, by me." A regression test
> (`a removed past founder cannot re-create their membership`) was observed failing against the
> `getAfter()`-only rule before the guard was added.

- [x] **Deploy the tightened `firestore.rules`.** ✅ **DEPLOYED 2026-08-10** with the full v1.5
      production release (ahead of Phase 40's Deploy 2, which is the recommended "cheap ordering" —
      the self-join hole is now closed in production before the storage fallback is ever removed).
      `firebase deploy` reported `firestore: released firestore.rules to cloud.firestore` successfully.
- [ ] **Exercise the one real pending invite in production** after deploy — accept it and confirm
      the membership document is created carrying the role the invite actually granted, not a
      higher one.
- [ ] **Create a genuinely new organization** through a real signup after deploy — confirm the
      founder becomes an editor member. This is criterion 3's production counterpart: the failure
      mode most likely to silently block every new church from onboarding, and the one Test C in
      `src/rules.test.ts` exists specifically to catch before deploy.

**Out of scope, recorded but NOT fixed this phase** (see `40.1-RESEARCH.md` § Other
Over-Permissive Findings):

1. `organizations/{orgId}`'s document-level `allow write: if isOrgEditor(orgId)` (firestore.rules:31)
   lets an existing editor rewrite `createdBy`, which weakens the org-creation branch's predicate
   above (it reads `createdBy`). This does **not** grant an editor any new capability — they already
   have unrestricted `write` on `members/{uid}` via the sibling rule on that same match block — and
   it is not exploitable by a non-member, who cannot pass `isOrgEditor` at all.
2. `inviteLookup/{email}`'s `allow create: if isSignedIn()` (firestore.rules:173) lets any signed-in
   user create an `inviteLookup` doc for any email with an arbitrary `orgId`/`role` payload — a
   structurally similar self-invite vector. This does **not** defeat this phase's fix: the fix reads
   the org-scoped `organizations/{orgId}/invites/{email}` document, which is editor-write-only, never
   `inviteLookup`.

Both are candidates for a future phase.

---

## Phase 41 — Sharing Correctness (R076, R077, R078)

**Phase status: `firestore.rules` built and tested, NOT deployed.** `shareTokens`' `allow update`
clause loosened from an unconditional `if false` to the org-scoped `serviceShares` idiom
(`isOrgEditor(resource.data.orgId) && request.resource.data.orgId == resource.data.orgId`), and a new
`serviceShareLinks/{serviceId}` block added with full org-editor CRUD, `orgId` immutable on update,
and **no public read** — proven against the real Firestore emulator in `src/rules.test.ts` (see
`41-01-SUMMARY.md` for before/after counts). Nothing was deployed.

> **UPDATE (41-REVIEW-FIX, 2026-08-07): the pending rules diff grew by one more clause — CR-01.**
> `shareTokens`' `allow create` was left at bare `isSignedIn()` (no org-membership check at all),
> unlike every sibling collection this phase touches. This phase's new adoption logic
> (`pickAdoptableToken`/`ensureShareLink` in `src/stores/services.ts`) reads and *trusts* the `orgId`
> of arbitrary pre-existing `shareTokens` documents to decide a service's permanent public link — so
> the loose `create` rule turned from inert into an exploitable trust-boundary violation (a signed-in
> non-editor, or even a non-member given a known `serviceId`, could plant a document that gets
> adopted as the official token). Fixed to `allow create: if isOrgEditor(request.resource.data.orgId)`,
> matching `serviceShareLinks`/`quarterShares`/`serviceShares`. Proven against the real Firestore
> emulator: `npx vitest run --config vitest.rules.config.ts` reports **133/133 passing**, including
> four new create-authorization cases that were confirmed to pass against the FIXED rule (the ALLOW
> case for a genuine org editor, and three DENY cases — cross-org editor, no-membership, unauthenticated
> — see `41-REVIEW-FIX.md`). **This clause must ship in the same `firestore.rules` deploy as the rest
> of this phase's changes below — it is not a separate deploy.**

> **UPDATE (Phase 42-01, 2026-08-07): the pending rules diff grew again — two more clauses, unrelated
> collection, same file, same deploy.** Phase 42 (PowerPoint Rendered-Image Display) found and closed a
> **pre-existing, currently-LIVE-in-production** write hole while researching how to read PPTX render
> status: `organizations/{orgId}/pptxRenders/{importId}` was never given its own rules block, so it fell
> through to the generic single-segment wildcard (`firestore.rules:198-203`), which grants any org
> **editor** both read AND write on it today. Write was never supposed to be possible — the render
> document is meant to be Admin-SDK-only (`functions/src/index.ts:342` names a client-forged `ready`
> flip as the one outcome the render service "must never be able to produce," T-37-15/T-42-01). **Until
> this deploy runs, an org editor can forge their own org's render document to `ready` with a fake
> `renderedCount` via a plain client-SDK `updateDoc` — verified via an emulator probe that PASSED
> against the undeployed rules file before the fix (`42-01-SUMMARY.md`).** Two clauses added, both
> inside `match /organizations/{orgId}`, nothing else: (a) a dedicated
> `match /pptxRenders/{importId} { allow read: if isOrgMember(orgId); }` block — read only, member tier
> (not editor tier), since a viewer already sees the deck's full parsed content; (b) `collection !=
> 'pptxRenders'` appended to the generic wildcard's `allow write` clause, alongside the existing
> `services`/`slideGroups` exclusions, closing the hole. Proven against the real Firestore emulator:
> `npx vitest run --config vitest.rules.config.ts` reports **138/138 passing**, including the flipped
> write-DENY case (PASSED pre-fix, now fails post-fix) and an ALLOW case for a viewer-role read (see
> `42-01-SUMMARY.md` for exact before/after counts). `storage.rules` is untouched — rendered pages
> already fall under the existing `orgs/{orgId}/{allPaths=**}` org-member read grant. **This too ships
> in the same `firestore.rules` deploy below — still one deploy, now carrying three phases' clauses.**

- [ ] **Deploy the updated `firestore.rules`** — `firebase deploy --only firestore:rules`. Carries
      Phase 41's sharing-correctness clauses (including the CR-01 `shareTokens` create-rule tightening)
      **and** Phase 42's `pptxRenders` read/write clauses (above) — still exactly one deploy.
      **Ordering constraint, load-bearing:** deploy this **before, or in the same session as**, any
      hosting deploy carrying Phase 41's app code (Plans 02-04). `ensureShareLink` reads
      `serviceShareLinks/{serviceId}`, which the catch-all rule currently denies outright — if the app
      ships to hosting before or without this rules deploy, the Share button fails outright for every
      user and every service. There is deliberately no client-side fallback to the old
      mint-fresh-every-time behaviour: a fallback would silently defeat R076 (link stability) and hide
      a missed deploy behind working-looking UI, whereas a loud failure surfaces the ordering mistake
      immediately.
      **After deploying, verify all of:**
      - `shareTokens` block reads `allow create: if isOrgEditor(request.resource.data.orgId)`, not
        `if isSignedIn()` (CR-01).
      - `firestore.rules` in the console shows a `match /pptxRenders/{importId}` read block AND
        `collection != 'pptxRenders'` on the generic wildcard's write clause (Phase 42) — until this
        lands, the write hole described above remains live.

**`deleteService` share revocation — resolved as OUT OF SCOPE, not fixed this phase.**
`41-RESEARCH.md` § Open Questions flags that `src/stores/services.ts::deleteService` (line 259) does
not revoke a service's `shareTokens`/`serviceShares`/`serviceShareLinks` documents the way
`quarters.ts::deleteQuarter` revokes `quarterShares`. Rationale for leaving it alone:

1. None of R076/R077/R078 mentions delete — it is outside this phase's literal scope.
2. It is **pre-existing** behaviour, not a regression this phase introduces — an orphaned public share
   already outlives a deleted service today.
3. This phase does make the orphan *more durable*: the token is now permanent (refreshed in place)
   instead of being superseded by the next re-share, which raises rather than lowers the case for
   building revocation deliberately later.
4. The `allow delete` clauses on `shareTokens`, `serviceShares`, and the new `serviceShareLinks` are
   all already in place and org-scoped, so a future phase can implement revocation without another
   rules change or another owner deploy.

Candidate for a future phase; not blocking v1.5.

---

## Phase 42 — PowerPoint Rendered-Image Display (R079, R080)

**The phase's automated evidence is complete — every unit/component/materializer/assembler suite and
the rules suite (emulator) are green, `npm run type-check` reports 0 errors, and no deploy command has
been run.** The four items below are the ONLY outstanding checks for this phase. **None of them is
recorded as passed** — they require either real visual judgment (jsdom cannot render) or a live round
trip against the deployed Cloud Run render service, neither of which a unit test can substitute for.

- [ ] **A real PPTX renders and looks like it did in PowerPoint.** jsdom has no rendering, so visual
      fidelity is unassertable by any automated test — this is the phase's actual goal.
      `docs/example.pptx` is in the tree as a fixture. Import it, open the Slides tab, confirm the
      slides look like the source deck; then present and confirm the same.
- [ ] **The `pending → ready` transition observed live.** Requires a real render round-trip against
      the deployed Cloud Run service — nothing in the unit suite can simulate the service actually
      finishing a render. Import a deck and watch the grid while the render completes; the tiles
      should flip from the pending placeholder to the rendered image with no reload (ROADMAP
      criterion 4, closed structurally in `42-08` — `renderReadySignal`/`onSnapshot` — but only a live
      round trip proves it end to end).
- [ ] **Overlay-badge legibility across all three states.** `42-UI-SPEC.md`'s one `backstop`
      consideration — an asserted intent needing a held-out visual check, not a unit-testable
      contrast ratio. Eyeball the content-label and slide-number badges against a light rendered
      slide, a dark one, and both placeholder states (pending/failed).
- [ ] **`firestore.rules` deploy.** Already recorded under Phase 41's entry above, as its own single
      checkbox — Phase 42's `pptxRenders` read/write clauses (T-42-01) ship in that SAME deploy, not a
      second one. See the Phase 41 section's "UPDATE (Phase 42-01, ...)" note for the exact clauses;
      the deploy command itself is given once, in that section's checkbox, and is deliberately not
      repeated here. Until that deploy runs, the T-37-15/T-42-01 write hole (an org editor can forge
      their own org's render document to `ready`) stays open in production.

### ⚠ Known behaviour gap Phase 42 ships WITH — a decision for the owner, not a defect to find

**Per-entry customization attached to a deck slide BEFORE its render completes is lost when the render
finishes.** If a planner opens a still-rendering PPTX deck and sets a slide's label, attaches audio, or
adds notes, that work disappears the moment the render flips `pending → ready`.

**Why it happens.** Pending/failed entries are identified by `deck.slides[i].id`; ready entries are
identified by synthetic `rendered-page-N` strings. The two key spaces never overlap, so
`carryStoredDerivedEntries` finds nothing to carry.

**Why it was not "fixed."** Carrying forward correctly is not possible with the data available.
42-RESEARCH.md Pitfall 1 establishes there is **no reliable positional pairing** between
`deck.slides[i]` and rendered page `i+1` — `mapAstToSlides` skips slides and emits one entry per image
on multi-image slides. A naive index-based carry-forward would silently attach a planner's note to the
**wrong slide**, which is worse than losing it. Code review considered both options and chose
disclosure over a wrong pairing.

**What was actually done (2026-08-07, Phase 42 code review CR-01):** the reconciler's doc comment,
which had falsely promised the carry-forward works, was corrected to state the real behaviour, and the
`pending → ready` test now asserts the loss explicitly so it can never regress unnoticed. That closes
the *dishonesty*; it does not close the *gap*.

**What is still open, and is the owner's call:**

- **`EditSlideDrawer.vue` has no `renderState` awareness** — the UI actively invites a planner to
  customize a pending slide it will then discard. At minimum this warrants disabling or warning on
  customization while a render is pending. No v1.5 requirement covers it, so nothing was built.
- Whether this is worth a follow-up phase at all. Realistically the window is small (a render completes
  in seconds to a minute) and a planner is unlikely to be labelling slides inside it — which is the
  honest argument for leaving it. Recorded here so that argument is made deliberately rather than by
  omission.

Raised by the Phase 42 re-review as "tracked nowhere durable — only a source comment." This entry is
that durable record.

---

## Phase 43 — Service Item Types (R081-R085)

### Plan 43-01 — projected ANNOUNCEMENTS/MISC slides show the kind label, not the planner's body

**Recorded decision, not a defect.** `slideGroupMaterializer.ts` and `slideshowAssembler.ts` both emit
`slotLabel(slot)` — `"Announcements"` / `"Miscellaneous"` — as BOTH the title and body of the
congregation-facing PROJECTED slide for an ANNOUNCEMENTS or MISC slot, never `slot.body`.

**Two reasons, both from 43-01-PLAN.md's Task 2:**

1. Projecting a planner's raw free-text notes to a congregation is a content decision no requirement
   in Phase 43 authorizes.
2. `sourceSignature()` in `slideGroupMaterializer.ts` returns `undefined` for every text-backed kind
   (PRAYER/MESSAGE/ANNOUNCEMENTS/MISC/HYMN). A projected slide derived from `body` would have no
   change-detection signal, so a `body` edit would leave a stale materialized group behind with no way
   to detect it needs rebuilding.

**Team-facing surfaces (print and share, plan 04) DO render `body`.** Only the congregation-facing
projection withholds it.

- [ ] **Owner confirms this is the wanted behaviour**, or asks for `body` to project instead (which
      would require also solving the `sourceSignature` staleness problem above — not a one-line change).

### Plan 43-02 — live Planning Center round-trip for the widened export dispatch (R085)

**Unit-level proof only.** `addSlotAsItem` in `src/utils/planningCenterApi.ts` now has an explicit
branch for every `SlotKind` member (ANNOUNCEMENTS → `Announcements`, MISC → `Miscellaneous`, MESSAGE
converted from an implicit else to an explicit test, IMPORTED returns `''`), plus a `never`-typed
exhaustiveness backstop after the chain. This is proven against a mocked `fetch` in
`src/utils/__tests__/planningCenterApi.test.ts` — the mock proves the outbound request shape, not that
Planning Center actually creates three distinctly-titled items when given that shape.

- [ ] **Owner runs a real export** (against live Planning Center credentials) of a service containing
      at least one ANNOUNCEMENTS slot, one MISC slot, and one MESSAGE slot, and confirms in the
      Planning Center plan that all three items appear with their own titles — `Announcements`,
      `Miscellaneous`, `Message` — and that none of them is mislabeled `Message`.

### Plan 43-03 — hands-on feel of the new palette and shared body editor (R081-R084 easy half)

**Unit-level proof only.** Both palette rows now offer Announcements and Miscellaneous and no longer
offer Hymn; one shared `<textarea>` (`slot-body-input`) serves Message/Announcements/Miscellaneous and
the Message URL control is gone from the markup (`linkUrl`/`linkLabel` remain in the type and in
Firestore). Palette membership, body round-trip, URL absence (proven scoped by a paired Prayer
assertion), stored-link survival and ordering stability are all proven against a mounted component in
`src/views/__tests__/ServiceEditorView.test.ts` — not that the editor feels right in a real browser.

- [ ] **Owner adds an Announcements item and a Miscellaneous item** to a real service, types into each,
      and confirms they save and reload correctly; confirms the **Message** item is now a plain text
      box with **no URL control**; and confirms long pasted body text **wraps and grows downward**
      rather than scrolling the row sideways.

### Plan 43-04 — team-facing surfaces, HYMN regression proof, and the compiler backstop (R081-R085)

**Unit-level proof only**, on all three fronts below. Automated coverage lives in
`src/components/__tests__/ServicePrintLayout.test.ts`, `src/views/__tests__/ShareView.test.ts`,
`src/views/__tests__/hymnRetirement.regression.test.ts`, and `src/utils/__tests__/planningCenterApi.test.ts`.

**T-43-03 (accepted, not mitigated) — `body` is published to anyone holding a share URL.**
`buildServiceSnapshot` copies every slot wholesale into the published share document, so `body` enters
that payload the moment plan 01 added the field — this plan's decision to render it on
`ServicePrintLayout.vue`/`ShareView.vue` changes *visibility*, not *exposure*. Accepted on three
grounds recorded in 43-04-PLAN.md's threat model: (1) the exposure already existed before this plan
rendered anything, (2) `notes` — unbounded planner-authored free text — has published under the same
share token since v1.0, and (3) the UI-SPEC defines Message `body` as "whatever text a planner wants
the team to see," which is incompatible with keeping it off a team-facing share link.

- [ ] **Owner confirms this is the wanted behaviour** — that `body` on MESSAGE/ANNOUNCEMENTS/MISC
      slots should be visible to anyone holding a service's share URL, same as `notes` already is — or
      asks for a narrower share-token trust model (a larger change, out of this phase's scope).

**Backstop UI-B1 — a pre-existing HYMN slot looks right end-to-end.** `hymnRetirement.regression.test.ts`
proves render/print/share/present/export in jsdom against a mounted component and a mocked `fetch` —
not that the printed page or a projected slide looks right to a human eye.

- [ ] **Owner opens a saved service containing a Hymn item** and confirms it still renders correctly in
      the editor, prints correctly (use Print Preview), and presents correctly (start a presentation and
      advance to the Hymn slide) — exactly as it did before this phase.

**A real Planning Center export (43-VALIDATION.md's manual-only entry, restated here for this plan's
sign-off).** Already recorded under Plan 43-02 above — not duplicated as a separate checkbox. The same
live-credentials export that plan 02 asks for also exercises this plan's HYMN-export regression test's
real-world counterpart: confirm the exported Hymn item's title is unaffected by the palette change.

---

## Phase 44 — Default Service Template (R086, R087)

### Plan 44-01 — the empty-by-default engine (`buildSlotsFromTemplate` + rerouted `createService`)

**Unit-level proof only.** `src/utils/__tests__/slotTypes.test.ts` and
`src/stores/__tests__/services.test.ts` prove the ordinal (not positional) VW-type mapping, the
modulo cycle for templates with more than 5 `SONG` entries, the unknown-kind defensive skip, and
`createService`'s empty-template → 0-slots contract against mocked Firestore/`authStore` — not that
creating a real blank service in the live app produces the expected result.

**Disclosed behavior change, owner already accepted the tradeoff (44-CONTEXT.md, 2026-08-07
override):** every church without a configured template (which is every church today — the
template editor UI ships in Plan 44-02) now gets a genuinely EMPTY new service, not the previous
automatic 1-2-3 default. This is live-visible the moment this plan's code reaches production.

- [ ] **Owner creates a new blank service with no default template configured** and confirms it has
      **zero slots** (not the previous automatic 1-2-3 shape) — the intended, deliberate behavior
      per the 2026-08-07 override, not a regression.
- [ ] Once Plan 44-02's Settings template editor ships, **owner configures a template** (e.g. via
      "Reset to 1-2-3 default") and confirms a subsequent new service's slots match the configured
      template's kind/section/order, with correct Vertical Worship types when VW mode is on.

### Plan 44-02 — the Settings "Services" template editor UI (`ServiceTemplateEditor.vue`)

**Unit-level proof only.** `src/components/settings/__tests__/ServiceTemplateEditor.test.ts` (20
tests) and `src/views/__tests__/SettingsView.test.ts`'s "Services card" block (7 tests) prove the
closed six-chip palette, add/reorder/section-change/remove against a mocked `sortablejs` capture
harness, Reset-to-1-2-3 (with confirm on a non-empty draft), the dot-path/`stripUndefined` Save
payload, empty-save-enabled, aria-labels, draft cloning (Pitfall #3), and the Services card's live
summary — all against jsdom and a mocked Firestore/`sortablejs`, not a real browser or a real
pointer drag.

- [ ] **Real drag-and-drop reorder feel.** Open Settings → Services → Edit Default Template, add a
      few items across different sections, and drag one by its handle — within its own section, and
      across a section boundary into a different one. Confirm the drop lands where expected and the
      drag-over section tints as it crosses each boundary. The automated suite calls `onEnd` directly
      against the exact options SortableJS was configured with; it does not prove a real pointer drag
      feels right.
- [ ] **The slide-out has no scrim and no reflow underneath.** With the editor open, confirm the
      Settings page behind it is still fully visible and clickable (no dimming overlay), matching
      `EditSlideDrawer.vue`'s existing precedent this component structurally ports.
- [ ] **The Services card summary reads naturally.** With no template configured, confirm the card
      reads "No default template set — new services start empty until you add items here." After
      building a template (e.g. via Reset to 1-2-3 default) and saving, confirm the summary updates
      to "{N} items across {M} sections" with numbers that match what was actually saved.
- [ ] **The drawer opens and closes cleanly in the running app.** Click "Edit Default Template",
      confirm the panel slides in from the right without layout jank, make an edit, click the close
      (×) button, and confirm it slides back out and the Services card's summary reflects whatever
      was actually saved (not what was left in the draft if Save was never clicked).

---

---

## Phase 45 — ESV/NLT Bible Version Selection (Plan 45-01, 2026-08-08)

**Plan 45-01 status: built and tested, NOT deployed** (standing v1.5 autonomy grant — NO DEPLOYS).
`functions/src/index.ts`'s new `nlt` proxy branch (query-param secret injection, `buildUpstreamUrl`
helper) and `src/utils/nltApi.ts` (DOMParser strip + `[N]` bracket reformat) are both built and
unit-tested against real, redacted NLT API response shapes captured live during phase research —
`cd functions && npm test` 112/112 passing, `npx vitest run src/utils/__tests__/nltApi.test.ts`
10/10 passing, `npm run type-check` clean, `functions && npm run build` clean. **Nothing was
deployed. `NLT_API_KEY` was never printed anywhere** (redacted as `<owner-key>` in all research/
planning artifacts; this plan could not even read `.env.local` directly — sandboxed — so it built
and tested against RESEARCH.md's documented real fixture shapes rather than a fresh live fetch).

⚠ **DEPLOY-COUPLING (locked by 45-CONTEXT.md, owner override 2026-08-07):**
`OrgSettings.bibleVersion` defaults to **`'NLT'`**, not `'ESV'`, once a later plan in this phase
wires the Settings default and call-site routing. Because the NLT Cloud Function branch ships
UNDEPLOYED, **new scripture fetching will not work for any church that hasn't explicitly chosen
ESV until the owner deploys this function.** The frontend build that carries the NLT default and
this function branch MUST be deployed in the SAME session — never the frontend first.

- [ ] **1. Set the secret.** `firebase functions:secrets:set NLT_API_KEY` — the owner already holds
      the key; it is NOT read from `.env.local` by the deployed function (only used locally by this
      plan's own dev-proxy config, mirroring `ESV_API_KEY`/`CLAUDE_API_KEY`).
- [ ] **2. Deploy the function.** `firebase deploy --only functions` — ships the new `nlt` branch
      (`PROXY_TARGETS.nlt`, `SECRET_INJECTED` membership, `NLT_API_KEY` secret wiring).
- [ ] **3. ⚠ Deploy in the SAME session as the NLT-default frontend build** (a later plan in this
      phase). If the frontend ships first, every new scripture fetch against the NLT default 404s
      against `/api/nlt` until step 2 completes. This is a human process guarantee — the emulator
      proves the function branch works, but cannot prove the two halves ship together.
- [ ] **4. Deferred live check.** With a church set to NLT, fetch a passage and confirm it renders
      with `(NLT)` attribution. Attribution itself now ships in Plan 45-04 (R091) — this check can run
      as soon as steps 1-3 above are done, no further plan needed.
- [ ] **5. Confirm the real fetch matches this plan's fixtures.** This plan's tests use RESEARCH.md's
      documented real (redacted) NLT sample shapes rather than a fresh live fetch (sandbox could not
      read `.env.local`). After deploying, fetch a real passage (e.g. `John 3:16-18`) through the
      deployed proxy and confirm the returned text matches the `[N] text` shape these tests assert —
      footnotes/headings stripped, red-letter/small-caps text kept, no leaked digit before each verse.

### Plan 45-04 — consumption wiring: fetch routing + stamp-once + attribution (R090/R091/R092)

**Status: built and tested, all automated.** `CongregationalEditor.vue`/`ScriptureInput.vue` route
ESV/NLT fetches by `authStore.settings.bibleVersion`; `CongregationalEditor.vue` stamps
`translationSource` once at fetch time; both render sites (`PresentationViewer.vue`,
`slideDisplay.ts::slideBodyText()`) append the shared `(ESV)`/`(NLT)` suffix via
`scriptureAttribution(resolveTranslationSource(slide))`. `npm run type-check` clean; the four touched
suites (231 tests) plus the full app suite (2-file baseline, no new failure) and `functions && npm
test` (112/112) all pass. Deferred items below are visual/live-integration checks jsdom cannot prove:

- [ ] **1. Overflow backstop (45-UI-SPEC.md § UI Considerations).** Confirm a long scripture passage
      running to the projector container's edge does not visually clip the trailing `(ESV)`/`(NLT)`
      suffix at 48px (`text-5xl`) display size, in both the normal-mode and congregational-mode
      paragraphs of `PresentationViewer.vue`. Held out as a backstop in the UI-SPEC, not asserted by
      the unit suite, since exact clip thresholds are query-dependent.
- [ ] **2. Post-deploy round trip (depends on Plan 45-01 steps 1-3 above).** Once the NLT function is
      deployed and the secret is set: set a church's Bible Translation setting to NLT in Settings,
      fetch a real passage in `CongregationalEditor.vue`, and confirm (a) the fetched sections show
      NLT-sourced text, (b) the projected/presented slide shows the `(NLT)` suffix, and (c) an
      already-existing ESV-sourced slide elsewhere in the same service still shows `(ESV)` unchanged
      after the setting flip (R092, provable live — not just in the unit suite's mocked fetches).

---

## Phase 46 — Global Slide Typography (Plan 46-01, 2026-08-08)

### Plan 46-01 Task 1 — package-legitimacy checkpoint for the five `@fontsource/*` packages (DEFERRED)

**Status: DEFERRED under the STATE.md v1.5 standing autonomy grant — NOT self-approved.**
`gsd-tools query package-legitimacy check` flagged all five (`@fontsource/inter`,
`@fontsource/open-sans`, `@fontsource/poppins`, `@fontsource/lora`, `@fontsource/source-serif-4`,
all `5.3.0`) as `SUS` with reason `too-new`. 46-RESEARCH.md's independent investigation (direct npm
registry `npm view` calls plus downloading and reading each tarball's own `metadata.json`/`LICENSE`
files) found the SUS verdict is a structural false positive from `@fontsource`'s catalog-wide
lockstep release cadence (all five published within the same publish window), not a genuine
supply-chain signal: all five resolve to the canonical `github.com/fontsource/font-files` repo,
weekly downloads range 104K–2.37M, `postinstall` is `null` on every package, and license is
`OFL-1.1` on every package. Execution proceeded to Task 2 (install + registry) on this basis,
per the plan's own pre-resolution instructions.

- [ ] **Owner confirms the five packages on npmjs.com** — fontsource-published, links to
      `github.com/fontsource/font-files`, version `5.3.0`, license `OFL-1.1`, no install scripts —
      for `@fontsource/inter`, `@fontsource/open-sans`, `@fontsource/poppins`, `@fontsource/lora`,
      and `@fontsource/source-serif-4`.
- [ ] Confirm the `5.3.0` pin landed cleanly in `package-lock.json` with integrity hashes present
      (already true as of this plan's commit; owner re-confirmation is the outstanding item).

### Plan 46-04 — render-site typography + presenter font gate (2026-08-08)

Three manual-only items carried verbatim from 46-04-PLAN.md's `<verification>` §
Manual-only verification — jsdom cannot render real fonts, measure a real paint, or judge
projection legibility/overflow, so these are unprovable by the automated suite regardless of how
thoroughly the gate logic itself is unit-tested.

- [ ] **No fallback-font flash mid-service (R094).** On a real projector, present a service and
      confirm the chosen font is resident on the first slide — no visible swap from a fallback.
- [ ] **Projection legibility of each curated family/weight/size (R093).** Present with each
      curated family at each size on a real projector; confirm readability at projection distance.
- [ ] **Long-line overflow at Large (1.25) scale (R093, UI-SPEC unresolved item #2).** On a real
      projector at Large scale, present an already-long lyric/scripture line and confirm the
      overflow is acceptable. No auto-fit/shrink-to-fit was built this phase (out of scope per
      REQUIREMENTS.md) — Large scale can overflow a long line, same as the fixed base sizes can
      today. If it bites in practice, revisit auto-fit in a later phase.

---

## ★ Phase 47 UX SUPERSEDED (2026-08-09) — read before verifying items 47.1/47.2

Per direct owner feedback ("the divider UX is not intuitive at all… make this really easier"), the
click-between-verses **divider** editor was replaced with a `---`-delimited **textarea** editor
(commits `173bf4f`, `a71da5a`; see `src/utils/congregationalText.ts` + reworked
`CongregationalEditor.vue`). The 3-dot menu item is now simply **"Congregational Reading"**. The new
editor: auto-fetches the passage into a textarea on open, uses `---` on its own line to split slides
with a `Leader`/`Congregation`/`All` label line per slide, has New-Slide/Leader/Congregation/All
insert buttons, a Save (overwrite) and a Delete (confirm → revert to plain reference), and keeps AI
as an `aiEnabled`-gated **"Split with AI"** textarea-fill button. R092 (translationSource capture-once)
and R096 (AI split offered) are preserved; type-check clean, new parser 11 tests + component 13 tests
green, app suite at the 2-file baseline.

**Effect on the items below:** **47.1 is now MOOT** (there is no gap-+/divider affordance to
discover). **47.2's divider-specific mechanics are MOOT** — but its intent survives: verify instead
that **hand-dividing Psalm 136 / Psalm 24 in the new textarea (typing `---` + labels, using the
insert buttons) feels low-friction**. **47.3 (projected 3-role legibility) and 47.4 (WR-01/WR-02
logic sign-off) are UNCHANGED and still apply.** Also newly worth a look: **auto-fetch-on-open**,
**Save overwrites existing slides**, **Delete reverts to a plain reference**, and the AI-fill button.

## Phase 47 — Congregational Reading Divider UX (2026-08-08)

Deferred under the v1.5 standing autonomy grant. **16/16 must-haves verified in code**; `npm run
type-check` clean; app `src/` suite at the documented 2-file baseline. Code review: **1 Critical /
3 Warning / 2 Info — ALL fixed** (CR-01 stale-AI-response overwrite guard; WR-01 verse-range
swallowing; WR-02 silent alignment-mismatch detection; WR-03 stable v-for keys; IN-01/IN-02). The
four items below are inherently manual/visual/judgment — jsdom cannot render real fonts, simulate a
real touch viewport, or judge projection legibility.

- [x] **47.1 Touch discoverability of the gap-+ / divider-remove affordance.** On a phone-width
      viewport, confirm the gap-+ and divider-remove controls are visible (persistent `opacity-40`)
      below the `md` breakpoint without hovering, reveal fully on hover/focus at `md`+, and have a
      44×44px hit area around the 24px control — discoverable and tappable on a real touch device.
      (UI-SPEC backstop, 47-02-SUMMARY.md D9.)
- [x] **47.2 Hand-dividing feels low-friction (R095).** Hand-divide **Psalm 136** (refrain) and
      **Psalm 24** (call/response) with the gap-+ and 3-way chip; confirm placing/removing dividers
      and labeling is natural, not clunky.
- [x] **47.3 Projected 3-role legibility (R097).** Present a hand-divided reading; confirm the
      first slide shows the reference, later slides show only the speaker label, and Leader (sky) /
      Congregation (amber) / All (violet) read distinctly at projection distance — and the reference
      genuinely disappears after slide 1.
- [x] **47.4 WR-01/WR-02 logic-change sign-off.** Spot-check real (non-fixture) passages with
      run-on verses through the **Start Blank** seed; confirm verse ranges are never over-reported,
      and that an intentionally unmatchable-seed condition fires the toast cleanly with no
      end-user-visible console noise. (The fixer flagged both correctness-sensitive text-matching
      fixes "requires human verification" despite passing regression tests.)

---

## Phase 48 — Multi-Image Ordering & Mobile Polish (2026-08-09)

Deferred under the v1.5 standing autonomy grant. **13/13 must-haves verified in code**; `npm run
type-check` clean; app `src/` suite at the documented 2-file baseline. Code review: **0 Critical /
3 Warning / 2 Info** — WR-01 (Share re-entrancy guard restored), WR-03 (44px hit-area no longer
swallows selection taps), IN-01 (localStorage guarded), IN-02 (Collator hoisted) all **fixed**;
WR-02 **deferred to owner** (item 48.4 below). R098 (natural-order multi-image) and R103
(dismissible Getting Started) are fully code-verified with automated tests. The items below are
inherently physical-device / owner-judgment.

- [x] **48.1 Real touch-drag reorder correctness (R099).** On a real touch device, long-press +
      drag a slide card to reorder; confirm it lands where dropped with no off-by-one, on a fresh
      grid and after a prior reorder. The desktop `*DraggableIndex`/`onEnd` logic is byte-unchanged
      and touch options were only appended (`delay`/`delayOnTouchOnly`/`touchStartThreshold`), but
      only a real touch gesture proves the reorder.
- [x] **48.2 Real-thumb 44px reachability (R099).** On a phone, confirm the slide-card drag handle
      and the action-menu trigger are comfortably thumb-tappable (44px hit area), and that the
      enlarged hit area does not swallow card-selection taps (WR-03's asymmetric-padding fix).
- [x] **48.3 Real ~375px layout (R099/R100).** At phone width confirm: the Slides tab has no
      horizontal overflow (the plan rail stacks above the grid as a horizontal-scroll strip), and
      the service edit screen's header action buttons stack vertically (QuarterView recipe).
- [x] **48.4 ★ OWNER DECISION — WR-02: Print/Share are now Service-Order-tab-only.** Moving Print
      and Share into the top contextual action bar (R101) scoped them to the Service Order tab; the
      previous page-bottom row made them reachable from **every** tab. This is a documented,
      UI-checker-approved 48-UI-SPEC.md decision that satisfies R101's text, but it narrows where
      Print/Share are reachable. **Confirm this is acceptable, or request they appear across all
      service tabs.** If cross-tab access is wanted, it is a small follow-up (add the keys to each
      tab's action set), not a redo.

---

## Phase 49 — Congregational Reading: Dedicated Reference Slide (Plan 49-01, 2026-08-10)

Deferred under the v1.5 standing autonomy grant. **8/8 must-haves verified in code**; `npm run
type-check` clean; app `src/` suite at the documented 2-file baseline. Implements R105 via approach
B (assembly-time synthetic reference slide on both paths; `slideGroupMaterializer.ts` untouched).
The item below is inherently visual — jsdom asserts the slide *list* shape and the display gates,
but only a real projected render confirms the on-screen result and media continuity.

- [x] **49.1 Live projected render of a real congregational reading (R105).** ✅ **Owner-verified
      2026-08-10** — tested with **1 John 4:1-2** made congregational: slide 1 is the reference
      alone, sections follow. (Original scenario: create a scripture slot, make it congregational,
      split into sections; slide 1 shows the reference alone, slides 2..N show only section text +
      speaker with no reference eyebrow, and group background / bed audio stays continuous across the
      reference→first-section transition.)

---

## Phase 50 — Slide Management: Bulk Delete, Provenance & Render Fidelity (2026-08-10)

Deferred under the v1.5 standing autonomy grant. **4/4 must-haves verified in code**; `npm run
type-check` clean; app `src/` suite at the documented 2-file baseline (2988/3001, no new failures);
code review 0 critical / 2 warning / 2 info. R106 (per-group "Remove imported slides"), R107
(rebuilds preserve every manual add — `slideGroupMaterializer.ts` untouched, existing survivor
mechanism proven by a new 9-case suite), and R108 (render-stable `sourcePage`/`renderedPage`
recorded and consumed) are fully code-complete and tested. The two warnings were both about R109 and
have been **fixed** (see below). The two items here are inherently deploy-/live-gated.

- [x] **50.1 Post-deploy cache refresh + asset immutability (R109).** ✅ **VERIFIED IN PRODUCTION
      2026-08-10** (automated header inspection by Claude, after owner-authorized
      `firebase deploy --only hosting,functions`). `curl -D-` against
      https://worship-planner-bc515.web.app returned: `/` → `Cache-Control: no-cache, no-store,
      must-revalidate` (text/html shell); `/index.html` → same; `/services/verify-test` (SPA deep
      link) → same; `/assets/index-PNUhzbF4.js` → `public, max-age=31536000, immutable`. Both
      (a) shell-no-cache-on-all-routes and (b) assets-still-immutable confirmed — the last-match-wins
      precedence held in production, so no reorder is needed. A browser holding the OLD cached bundle
      now re-fetches, since the shell carries `no-cache, no-store, must-revalidate`. (Original scenario:
      after a real deploy, load `/` and a deep link without a manual cache-clear; DevTools Network shows
      index.html re-fetched fresh and the new bundle loads; a hashed `/assets/*` request still returns
      the long/immutable Cache-Control. Context: code review WR-01 found the original `/index.html`-only
      header missed `/` and deep links; widened per owner decision 2026-08-10.)

- [x] **50.2 Live multi-image PPTX round-trip (R108).** ✅ **OWNER-VERIFIED 2026-08-10** against the
      production deploy: a real multi-image PPTX deck imported through the live UI, and a hand-added
      slide resolves to the correct rendered page (no perpetual "Rendering" placeholder) — confirming
      `renderedPage` round-trips through the live upload → parse (Cloud Function) → render-service →
      Storage → client cycle, not just unit fixtures. (Original scenario: import a deck where a source
      slide contains more than one image so parsed-slide count ≠ rendered-page count, hand-add one of
      its slides into a non-imported group, confirm the correct rendered page shows.)

---

## Notes and failures

_(Record anything that failed here, with what you saw versus what was expected.)_

---

## Phase 51 — Service Order Editing Reliability (v1.6) — DEFERRED 2026-08-11

**Status:** verification_deferred_human. 4/4 ROADMAP success criteria verified automatically (all
source fixes present + genuine RED-first repros green; `npm run type-check` clean; app suite 2994 pass
at the 2-file baseline; 373/373 phase tests). NOT deploy-gated (client-only). Resume: `/gsd-verify-work 51`.

These three behaviors are jsdom-inexpressible (native SortableJS DOM move / live shared render) and must
be confirmed by hand in the running app:

- [ ] **51.1 (R110) — Real OS cross-section drag, both editors.** In the default-service-template editor
      AND in a live service plan, drag an item (e.g. a Song) into a different section (e.g. Worship) and
      drop it. Expect exactly ONE item in the target section with its dropdown showing that section — NO
      second, undeletable "No Section" phantom — and the item stays draggable afterward (do a second
      cross-section drag to confirm the container is not drag-dead). No page refresh.
- [ ] **51.2 (R111) — Live "No Section" save.** Take an item that is in a section, use its section
      dropdown to move it back to "No Section". Expect a clean save (Saved indicator) with NO error
      toast / no Firestore "Unsupported field value: undefined".
- [ ] **51.3 (R112) — Empty-item order on read surfaces.** Create a service with two blank Miscellaneous
      items placed mid-order (e.g. in Worship). Without typing any text into them, view the Services
      listing page and open the public share link. Expect both blank items to appear in their true
      edit-screen position (their band), NOT sunk to the bottom.

After confirming, run `/gsd-verify-work 51` to close these and flip Phase 51's VERIFICATION.md to passed.

---

## Phase 52 — Default Service Template (v1.6) — DEFERRED 2026-08-11

**Status:** verification_deferred_human. 4/4 ROADMAP criteria verified in code + automated (all source
present; critical guards intact — `buildSlotsFromTemplate` purity, absent-body shape, exhaustive switch;
`npm run type-check` clean; app suite 3009 pass at the 2-file baseline). NOT deploy-gated (client-only).
Resume: `/gsd-verify-work 52`.

- [ ] **52.1 (R113) — Cog relocation.** On the Services page, the cog/settings control opens the
      default-service-template slide-out editor. Confirm the main Settings page no longer shows a
      Services template card. A viewer (non-editor) does not see the cog.
- [ ] **52.2 (R115) — No blank service.** As a church whose default template is unset/never customized,
      create a brand-new service. Expect it to open pre-populated from the Suggested Template (the
      9-slot suggested order), NOT an empty service. With Vertical Worship mode on, the song slots carry
      their VW types.
- [ ] **52.3 (R116) — Misc body carries through.** In the template editor, add a Miscellaneous item and
      type body text into its input (e.g. "Canned music"). Save the template, then create a new service.
      Expect the Miscellaneous item to carry that body text into the created service.

After confirming, run `/gsd-verify-work 52`.

---

## Phase 53 — Song Lyric Editing (v1.6) — DEFERRED 2026-08-11

**Status:** verification_deferred_human. 5/5 ROADMAP criteria verified in code + automated (all source
present; BWC guards git-confirmed — unsplit sections byte-identical, stored labels immutable,
slideGroupMaterializer/duplicateRow untouched; `npm run type-check` clean; app suite 3050 pass at the
2-file baseline; 390/390 phase tests). NOT deploy-gated (client-only). Resume: `/gsd-verify-work 53`.

- [ ] **53.1 (R117) — Hand split + present.** In the song lyric editor, split an 8-line chorus into two
      4-line slides using the click-between-lines divider. Save, then present the service. Expect the
      chorus to show as two slides.
- [ ] **53.2 (R118) — Duplicate a split as one unit.** Duplicate that split chorus. Present. Expect
      BOTH occurrences to each show both slides.
- [ ] **53.3 (R120) — Position numbering.** In a song pasted with "Verse 1" and "Verse 2", click the
      Verse add button. Expect the new section to read "Verse 3" (and a repeated section to share its
      origin's number; a split section's slides keep the one number).
- [ ] **53.4 (R121) — First-paste "Save".** On a brand-new song with no lyrics yet, open paste-lyrics.
      Expect the commit button to read "Save" (not "Replace lyrics").

After confirming, run `/gsd-verify-work 53`.

---

## Phase 54 — Service Item Enhancements (v1.6) — DEFERRED 2026-08-11

**Status:** verification_deferred_human. 9/9 must-haves verified in code + automated (all source present;
guards intact — emptied notes stripped to no raw undefined, MISC existing blank + hand-added slides
survive, switch exhaustive; `npm run type-check` clean; app suite 3059 pass at the 2-file baseline).
NOT deploy-gated (client-only). Resume: `/gsd-verify-work 54`.

- [ ] **54.1 (R122) — Responsive notes layout.** On the service edit screen, confirm the notes field
      sits beside each item's selector on desktop and stacks below it on a phone-width viewport, and
      that the layout is consistent across item kinds (song, scripture, message, etc.).
- [ ] **54.2 (R123) — MISC starts with no slides, add still works.** Add a Miscellaneous item; open the
      Slides tab; confirm it has no slides. Add a slide to it; confirm the slide appears and persists.

After confirming, run `/gsd-verify-work 54`.

---

## Phase 55 — Preview & Export Polish (v1.6)

**Status:** verification_deferred_human. 8/8 must-haves verified in code + automated (R124 render-only
removal with `scripture.ts` untouched / R092 provenance preserved; R125 spinner on existing `isExporting`;
R126 Roboto registry+loader, Inter+four unchanged). `npm run type-check` clean; app suite 3063 pass at
the 2-file baseline. NOT deploy-gated (client-side + one build dependency). Resume: `/gsd-verify-work 55`.

### Plan 55-01 — No auto-appended Bible version (manual, R124)

Deferred under the v1.6 standing autonomy grant — jsdom cannot exercise real projection.

- [ ] **55.R124 — No auto version when presenting; manual add works.** Present a service with a
      scripture slide; confirm NO `(ESV)`/`(NLT)` suffix is auto-shown. Type "(ESV)" into the slide's
      own text and confirm it displays (manual addition still possible).

### Plan 55-02 — Planning Center export spinner (manual, R125)

- [ ] **55.R125 — Export spinner.** Trigger a real Planning Center export; confirm the Confirm Export
      button shows a spinner and is disabled until the export completes.

### Plan 55-03 Task 1 — package-legitimacy checkpoint for `@fontsource/roboto@^5.3.0` (DEFERRED)

**Status: DEFERRED under the STATE.md v1.6 standing autonomy grant — NOT self-approved as passed.**
`gsd-tools query package-legitimacy check` flags `@fontsource/roboto` `SUS` with reason `too-new`.
This is the identical structural false positive already dispositioned for Phase 46's five
`@fontsource/*` packages: the entire multi-hundred-package `@fontsource` catalog re-publishes in
lockstep on every upstream Google Fonts refresh, so `publishedAt` always looks new. 55-RESEARCH.md
§ "Package Legitimacy Audit" performed direct verification this session: OFL-1.1 license (verbatim
SIL Open Font License 1.1 text in the in-tarball `LICENSE`; `npm view @fontsource/roboto license`
→ `OFL-1.1` for 5.3.0 — early 5.x reported `Apache-2.0`, relicensed at 5.2.0 following Google's
upstream OFL relicense), full 100–900 static weight ramp (incl. 600.css) present in the tarball,
`postinstall` null, ~1.26M weekly downloads, canonical repo `github.com/fontsource/font-files`.
Pinned `^5.3.0`, consistent with the five existing `@fontsource/*@^5.3.0` deps. Execution proceeded
to Task 2 (install + registry + loader) on this basis, per the plan's own pre-resolution
instructions and the Phase 46 precedent.

- [ ] **Owner confirms `@fontsource/roboto` on npmjs.com** — fontsource-published, links to
      `github.com/fontsource/font-files`, version `5.3.0`, license `OFL-1.1`, no install scripts.
      Spot-check: `npm view @fontsource/roboto version` → `5.3.0`; `npm view @fontsource/roboto
      license` → `OFL-1.1`.
- [ ] Confirm the `5.3.0` pin landed cleanly in `package-lock.json` with integrity hashes present
      (already true as of this plan's commit; owner re-confirmation is the outstanding item).

### Plan 55-03 — Roboto slide font (manual/visual sign-off, R126)

Deferred under the v1.6 standing autonomy grant — jsdom cannot render a real font or judge
projection legibility.

- [ ] **Roboto selectable and renders (R126).** In Settings → Slide Typography, pick Roboto; confirm
      slides render in Roboto and Inter (still first/default) plus the other four families remain
      available and unchanged.

After confirming, run `/gsd-verify-work 55`.

---

## Quick task 260811-vsr — Service Order editor UI pass (deferred owner visual/mobile check)

Deferred under the v1.6 standing autonomy grant. Automated gates (type-check + app suite at the
2-file known baseline) are green; the following are visual/feel judgments jsdom cannot make. Do NOT
self-approve.

- [ ] **Three-rail row layout reads clean on desktop.** Open a service with mixed item kinds (Song,
      Scripture, Prayer, Message, Announcements, Misc, Hymn). Confirm each row shows: drag handle ·
      colored per-kind badge (w-32 rail) · stacked field column (selector/content above a full-width
      notes field) · right-aligned ⋯ menu, and the list column is capped (not edge-to-edge on a wide
      screen). Badge tints per DESIGN-SPEC (Song indigo, Scripture cyan, Message/Announcements rose,
      Prayer/Misc gray, Hymn amber, Imported gray).
- [ ] **Mobile single-stack (≤ sm / ~390px).** Narrow the viewport; confirm each row collapses to a
      vertical stack with no horizontal scrolling and tap targets ≥ ~34px.
- [ ] **Consolidated field feels right.** Prayer/Misc/Announcements/Message each show exactly ONE
      free-text field with a sensible per-kind placeholder; a legacy `body`-only item still shows its
      text; editing persists and re-exports/prints via `notes ?? body`.
- [ ] **⋯ menu.** Move-to-section reassigns the slot; Delete opens the confirm dialog; menu closes on
      outside-click and selection; it is absent for viewers/locked services.
- [ ] **No-Section band.** An un-sectioned item shows a muted/dashed "No Section" band, clearly
      distinct from Post-Service; absent when every item is sectioned.

After confirming, run `/gsd-verify-work` for this quick task (or record acceptance in the quick-tasks table).
