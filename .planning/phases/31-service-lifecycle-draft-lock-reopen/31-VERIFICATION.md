---
phase: 31-service-lifecycle-draft-lock-reopen
verified: 2026-07-30T16:38:26Z
verified_at_commit: b90eb20
status: passed
status_qualifier: "PASSED ON AUTOMATED EVIDENCE ONLY. The tooling accepts a fixed status vocabulary and 'passed' is the only value that permits phase completion; it does NOT mean a human verified this phase."
score: 36/36 must-haves verified on automated evidence
human_verification: DEFERRED — 30 checks in .planning/PENDING-VERIFICATION.md, NONE performed, NONE passed
production_rules: NOT DEPLOYED — emulator-verified only; ROADMAP backlog Phase 999.3
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  note: "Initial verification. Not a gap-closure re-run — but it follows a plan-checker pass (3 BLOCKERs) and a code review (2 BLOCKERs, 1 HIGH, 3 MEDIUM fixed; 4 LOW deferred), so it is explicitly a THIRD adversarial pass over the same surface."
gaps: []
deferred:
  - truth: "LO-01 — the Edit Slide drawer's locked notice carries no isEditor term, so a VIEWER on a locked service is told to 'reopen it for editing', an action they may not perform"
    addressed_in: "deferred-items.md LO-01 (Phase 31), not scheduled to a later phase"
    evidence: "src/components/slides/EditSlideDrawer.vue:64 — v-if=\"isSongGroup || serviceLocked\"; the page banner at ServiceEditorView.vue:304 correctly carries authStore.isEditor &&. Confirmed present in the codebase at verification time."
  - truth: "LO-02 — onMarkAsPlanned / onReopenRequest / runReopen / markAsPlanned / reopenService carry no isEditor check"
    addressed_in: "deferred-items.md LO-02 (Phase 31)"
    evidence: "Confirmed: ServiceEditorView.vue:2332/2425/2438 and services.ts:187/208 check isTransitioning and stored status only. Not exploitable — both buttons are template-gated on canEditService/authStore.isEditor && isLocked and nothing is defineExpose'd; the Firestore rule denies a viewer's reopen (verified by execution, PROBE R)."
  - truth: "LO-03 — src/stores/slideGroups.ts received no draft-only store guard although 31-CONTEXT.md scoped it"
    addressed_in: "deferred-items.md LO-03 (Phase 31)"
    evidence: "Confirmed unchanged this phase. Layer 2 for slide groups is useSlideshowAssembly's canWrite (ServiceEditorView.vue:1712) plus per-component handler guards; every current call site is gated. Structural asymmetry, not a live hole."
  - truth: "LO-04 — the mandated payload-forgery rules regression (research probe B4) is not the shape that shipped"
    addressed_in: "deferred-items.md LO-04 (Phase 31)"
    evidence: "VERIFIER RAN B4 VERBATIM against the emulator: seed exported, write {status:'draft', slots:[…]} in one payload → REJECTED. The rule is correct; only the assertion is missing from src/rules.test.ts."
  - truth: "firestore.rules is not deployed — the rules layer is emulator-only, so production runs on two layers, not three"
    addressed_in: "ROADMAP backlog Phase 999.3, required before v1.4 ships"
    evidence: "31-CONTEXT.md D-16 revised 2026-07-30 (owner deferred the deploy). PENDING-VERIFICATION.md lines 20-22."
  - truth: "Accepted residual — a forged serviceId on slideGroups CREATE bypasses the parent-status lock"
    addressed_in: "31-RESEARCH.md § 'Verdict on the residual hole: accept and document' (probe E6); STRIDE table line 967"
    evidence: "VERIFIER REPRODUCED IT: setDoc(slideGroups/{slotOfLockedService}, {serviceId: <someDraftService>}) SUCCEEDS, and the doc stays updatable thereafter. Rules cannot search a list of maps to confirm the slot belongs to the claimed service. Attacker must already be an org editor — a principal who can reopen the service in one click — so this is a workflow-integrity ceiling, not a privilege boundary."
human_verification:
  - test: "All 30 items in .planning/PENDING-VERIFICATION.md § 'Phase 31' (31.1 – 31.30)"
    expected: "Each item's stated expectation. 31.10 (devtools bypass, needs VITE_USE_EMULATORS=true), 31.18 (real pointer drag after reopen), 31.29 (real Planning Center account, no orphaned plan) are the three no automated proof can replace."
    why_human: "Real pointer input, real Planning Center side effects, and copy/tone judgement. Deferred — NOT performed — under the standing autonomy grant in .planning/STATE.md."
  - test: "31-06-PLAN.md — the phase's own closing gate (autonomous: false) has not been executed"
    expected: "npm run test:rules recorded verbatim, the human-verify checklist walked, and the deploy hand-off recorded in 31-06-SUMMARY.md"
    why_human: "The plan is explicitly a blocking human checkpoint. ROADMAP.md still reads 'Plans: 5/6 executed' and 31-06-SUMMARY.md does not exist."
  - test: "★ Type into a Draft service's Sermon Topic while a second editor clicks Mark as Planned within the 800ms debounce"
    expected: "Decide whether silently DISCARDING the in-flight text is acceptable, and whether the copy should say so"
    why_human: "VERIFIER REPRODUCED BY EXECUTION: on a ServiceLockedError the autosave handler reverts localService to originalService, so the typed text is gone (probe observed notes: '' after typing 'a long paragraph the user just typed'), while the message reads \"This service is locked, so that change wasn't saved. Reopen it for editing and try again.\" — 'try again' implies the text is still in the field. It is not. Deliberate per the BL-02 comment at ServiceEditorView.vue:2071-2077; the copy is the part that needs a human call. Relevant to Phase 32 (Save Reliability)."
---

# Phase 31: Service Lifecycle — Draft Lock & Reopen — Verification Report

> ## ⚠ NO HUMAN HAS VERIFIED THIS PHASE
>
> The frontmatter says `status: passed`. **That means it passed its AUTOMATED gates.** `passed` is the
> only value the tooling accepts to permit phase completion, so it is set for that mechanical reason —
> it is not a human sign-off, and this report must not be cited as one.
>
> What is actually true, as of 2026-07-30:
>
> - **36/36 must-haves verified**, plus 32 purpose-written probes (17 component, 15 emulator), all
>   passing. `npm run type-check` clean. Rules 96/96 against a live emulator. Full suite 1896 passing
>   with only the two documented baseline failures.
> - **30 human checks are DEFERRED and NOT performed** — `.planning/PENDING-VERIFICATION.md`. None is
>   marked passed.
> - **The Firestore rules are NOT deployed to production.** They are emulator-verified only. In
>   production two of the three enforcement layers are live; a browser console can still write to a
>   locked service there. Tracked as ROADMAP backlog Phase 999.3, required before v1.4 ships.
> - `31-06-PLAN.md`'s human-verify task was deferred under the owner's standing autonomy grant
>   (`.planning/STATE.md`), which directs deferring checkpoints while they are away — *deferring and
>   disclosing them*, never self-approving.
>
> Phase 32 was built on top of this on that basis.

**Phase Goal:** A service is editable only in Draft; Service Order, Slides and Roles all lock at
`planned`/`exported`, with an explicit "Reopen for editing" path back.

**Verified:** 2026-07-30T16:38:26Z
**Status:** `human_needed` — automated evidence complete and clean; the phase's own closing human gate
(31-06) is deliberately deferred, not passed.
**Re-verification:** No — initial verification, but deliberately conducted as a **third adversarial pass**
after the plan-checker (3 BLOCKERs) and the code review (2 BLOCKERs proven by execution).

---

## Verdict

**Yes — Phase 31 achieves its goal, and Phase 32 can be built on it.**

The pattern that produced the first two passes' findings — *a control closed at the template layer while
its handler stayed reachable, and an enumeration test that skipped exactly the rows that shipped open* —
**did not repeat**. I re-derived the mutation surface from `31-PATTERNS.md` §4a rather than from any
SUMMARY, walked all 26 rows plus the two Roles rows, and specifically executed the six rows the phase's
own enumeration test still omits (12, 17, 18, 19, 20, 21). **All six are closed at the handler layer and
were proven closed by execution**, at both `planned` and `exported`, with a positive draft control to rule
out a blanket no-op.

The two deliberate deviations from the review's suggested fixes were **verified by execution, not by
reading their comments**, and both hold:

- **ME-03** (bump `lastUsedAt` *after* a successful `markAsPlanned` instead of compensating in a `catch`)
  — proven: the bump is strictly ordered after the status write, a rejected `markAsPlanned` ages no song
  at all, no `slots` write is issued, and a failed bump neither rolls back nor misreports the completed
  transition.
- **BL-02** (leave the remote-merge branch closed while local is dirty after a *transport* failure) —
  proven **self-recovering**, not a wedge, along both exits: the branch reopens on the next successful
  retry (armed by an ordinary keystroke, no remount), *and* it reopens the moment local goes clean again
  with no successful retry at all.

What is **not** delivered is deliberate and disclosed, not missed: the rules layer is emulator-verified
and **not deployed** (D-16 revised — production runs on the UI gate and the store guard only), four LOW
review findings are logged in `deferred-items.md`, and 30 human checks are queued in
`PENDING-VERIFICATION.md`. Under the GSD decision tree a phase with a non-empty human-verification list
is `human_needed`, never `passed` — and the standing autonomy grant explicitly forbids recording a
deferred check as performed.

---

## Evidence executed for this report

| Gate | Command | Result |
|---|---|---|
| Type check (the correct gate, not `-p tsconfig.app.json`) | `npm run type-check` (`vue-tsc --build`) | **clean, no output** |
| Firestore rules, live emulator | `npx vitest run --config vitest.rules.config.ts` | **96/96 pass in `src/rules.test.ts`**; the only 2 failures are the documented `storage.rules.test.ts` baseline |
| Full unit suite (run once) | `npx vitest run` | **1896 passed / 9 failed**; all 9 failures are the two documented baselines (`storage.rules.test.ts` ×8, `RosterView.test.ts` ×1) |
| **Verifier probe — component layer** | 17 purpose-written tests against the real `ServiceEditorView` | **17/17 pass** (probe file deleted after the run) |
| **Verifier probe — rules layer** | 15 purpose-written adversarial assertions against the live emulator | **15/15 pass** (probe file deleted after the run) |

Both probe files and their temporary vitest config were removed; `git status --porcelain` is clean apart
from two pre-existing untracked `docs/` fixtures.

---

## ★ The 26-row mutation inventory (`31-PATTERNS.md` §4a) — every row walked

Legend: **T** = template gate (`v-if="canEditService"`) · **H** = handler early-return · **S** = store
guard (`assertWritable` / per-action) · **R** = Firestore rule.

### 31-PATTERNS §4a — Service Order tab

| # | Entry point | Now at | Layers closed | How verified |
|---|---|---|---|---|
| 1 | `onDateChange` `:1922` | `if (!canEditService.value) return` :1928 + `<h1 v-if="!canEditService">` :51 | T·H·S·R | **BL-01 fix confirmed.** Shipped test `ServiceEditorView.test.ts:3128`; DOM-absence tests at `:2844` |
| 2 | `toggleStatus` | **DELETED** | — | `grep -rn toggleStatus src/` returns only comments; store test asserts `expect(store).not.toHaveProperty('toggleStatus')` |
| 3 | `toggleTeam` `:2468` | H `:2469` + T `:634` | T·H·S·R | Enumeration test |
| 4 | service `name` v-model `:650` | inside `v-if="canEditService"` `:634` | T·S·R | DOM test `:2890` + verifier PROBE B (no write escapes) |
| 5 | `sermonTopic` v-model `:681` | T `:680` | T·S·R | DOM test `:2890` |
| 6 | `onSermonPassageChange` `:2873` | H `:2874` + T `:693` | T·H·S·R | Enumeration test |
| 7 | `onScriptureChange` `:2857` | H `:2858` | T·H·S·R | Enumeration test |
| 8 | `onSelectSong` `:2602` | H `:2606` | T·H·S·R | Enumeration test |
| 9 | `onClearSong` `:2616` | H `:2617` | T·H·S·R | Enumeration test |
| 10 | `addSlot` `:2482` | H `:2483` + T `:1117` | T·H·S·R | Enumeration test |
| 11 | `removeSlot` `:2528` | H `:2529` + T `:1098` | T·H·S·R | Enumeration test |
| 12 | `confirmSlotDelete` `:2551` | H `:2552` | H·S·R | ★ **omitted from the enumeration test — proven by VERIFIER PROBE A** (both branches: remove-element and clear-song) |
| 13 | `onSectionChange` `:1683` | H `:1684` + T `:1085` | T·H·S·R | Enumeration test |
| 14 | PRAYER `linkLabel`/`linkUrl` `:943` | T `:943` | T·S·R | ★ **VERIFIER PROBE B** — direct model mutation issues no write at either locked status |
| 15 | MESSAGE link fields `:990` | T `:990` | T·S·R | ★ VERIFIER PROBE B |
| 16 | HYMN fields `:1036` | T `:1036` | T·S·R | ★ VERIFIER PROBE B |
| 17 | `onSlotSortEnd` `:1774` | H `:1779` + `canReorder` `:1756` + Sortable destroy `:1842` | T·H·S·R | ★ **omitted from the enumeration test — VERIFIER PROBE A** (fabricated drag event: no write, order unchanged) |
| 18 | `suggestAllSongs` `:2647` | H `:2648` + T `:160` | T·H | ★ **omitted — VERIFIER PROBE A** (`getSongSuggestions` never called) |
| 19 | `fetchAiForSlot` `:2731` | H `:2732` | T·H | ★ **omitted — VERIFIER PROBE A** |
| 20 | `acceptAiSong` `:2817` | H `:2818` | T·H·S·R | ★ **omitted — VERIFIER PROBE A** (seeded a draft; slot stayed empty) |
| 21 | `rejectAiSong` `:2827` | H `:2828` | T·H | ★ **omitted — VERIFIER PROBE A** |
| 22 | `onUndo` `:3531` | H `:3534` + T `:142` | T·H·S·R | Enumeration test |
| 23 | autosave watcher `:2110` | `canEditService` + **cancels** an armed timer `:2125-2132` + re-check at firing `:2154` | H·S·R | **BL-02 fix confirmed.** Enumeration test + `:3340` (typing during Mark as Planned) + VERIFIER PROBE B |
| 24 | `onSave` `:3467` | H `:3478` | H·S·R | **BL-02 fix confirmed.** Enumeration test |
| 25 | `onDelete` `:3453` | **deliberately unguarded (D-15)** | — | ★ VERIFIER PROBE F: `deleteService` called at `exported`; `deleteServiceConfirmBody` carries the Planning Center sentence; rule `allow delete` unconditional (emulator-proven) |
| 26 | export write `:3302` | **deliberately allowed (D-09)** | — | ★ VERIFIER PROBE F: payload keys are **exactly** `['pcExportedAt','pcPlanId','status']`; store `isExportWrite` and rule branch 2 both accept; **and no follow-up autosave fires** (the `originalService` mirroring at `:3324` holds) |

### 31-PATTERNS §4b — Roles tab

| # | Entry point | Now at | Layers closed | How verified |
|---|---|---|---|---|
| 27 | `onToggleOverridePerson` → `setRoleOverride` | H `:3405` + store guard `services.ts:289` + T `:1211` | T·H·S·R | Enumeration test + store test + emulator (`roleAssignmentOverrides` dot-path rejected at `planned`) |
| 28 | `onResetRoleOverride` → `clearRoleOverride` | H `:3446` + store guard `services.ts:304` + T `:1190` | T·H·S·R | Same |

### 31-PATTERNS §4c — Slides tab (rows 29–41)

Closed by two composed computeds rather than row-by-row, and correctly split:

- `SlideGrid.canMutateGroup = isEditor && !serviceLocked && !isSongGroup` (`:296`) → rows 29, 30, 31, 32, 35
- `SlideGrid.canWriteGroupMedia = isEditor && !serviceLocked` (`:297`) → rows 33, 34 — **this split is what
  preserves Phase 30's R054** (a song group on a *draft* service still accepts group bed media)
- `EditSlideDrawer.canMutate = isEditor && !serviceLocked && !isSongGroup` (`:468`) → rows 36–41

Every one of those handlers carries its own early return (verified by grep at `SlideGrid.vue:324, 341,
379, 425, 436, 443, 454, 483, 519, 565, 620` and `EditSlideDrawer.vue:633, 702, 727, 840, 1071, 1101,
1121`), and `canReorder` (`SlideGrid.vue:666`) drives the Sortable destroy/rebuild. The **load-time**
write path — `useSlideshowAssembly`'s `{immediate:true}` materialization watcher, which 31-PATTERNS §1c
warned would throw `permission-denied` on every locked service — is narrowed at
`ServiceEditorView.vue:1712` (`canWriteSlideGroups`), and `ServiceEditorView.test.ts:2344` asserts **zero**
slide-group writes at both locked statuses.

**Conclusion on the inventory: 26/26 + 2 Roles rows closed at the layer(s) each needs. No row was
assumed — rows 12, 14, 15, 16, 17, 18, 19, 20, 21 had no direct execution proof anywhere in the repo and
now have it (in this report's probe run; the assertions themselves were not committed).**

---

## Observable Truths

### ROADMAP Success Criteria (the contract)

| # | Truth | Status | Evidence |
|---|---|---|---|
| SC1 | A service can only be edited (Service Order, Slides, Roles) while Draft; a direct write bypassing the UI is rejected | ✓ VERIFIED (emulator) | 96 emulator assertions + 15 verifier probes; the 26-row table above. **Caveat: `firestore.rules` is not deployed — see the deferred list.** |
| SC2 | An editor can "Reopen for editing" a Planned or Exported service, returning it to Draft | ✓ VERIFIED | PROBE E: one click from `planned`; dialog→confirm from `exported`; store writes `{status:'draft',updatedAt}` only; rule branch 3 accepts, emulator-proven |
| SC3 | Reopening an already-exported service warns about Planning Center; a never-exported service does not | ✓ VERIFIED | `hasPcExportEvidence` (`:1589`) gates on `pcExportedAt \|\| pcPlanId`, **not** on the status string (D-04) — a legacy hand-set `exported` gets no dialog. PROBE E + shipped tests `:2534, :2552, :2567, :2602` |
| SC4 | Creating a service defaults its date to the nearest Sunday without an existing plan | ✓ VERIFIED | `nextFreeSunday` (`quarterDates.ts:43`) ← `NewServiceDialog.defaultForm()` ← `:taken-dates="takenServiceDates"` (`ServicesView.vue:169`, computed at `:229`). 31 shipped assertions |

### 31-01 — Firestore rules (layer 1)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | A write to a service stored at `planned`/`exported` is REJECTED, UI bypassed | ✓ VERIFIED | Emulator, both statuses; plus verifier probes for full-document `setDoc` replace, illegal `exported→planned`, and hand-stamped export evidence — all rejected |
| 2 | The catch-all wildcard no longer grants write on `/services` | ✓ VERIFIED | `firestore.rules:162-166` (`collection != 'services'`); emulator test "not rescued by the org-level wildcard" |
| 3 | The export write (`planned→exported` + evidence) is still ALLOWED | ✓ VERIFIED | Rule branch 2 `:73-77`; emulator |
| 4 | A re-export to the SAME `pcPlanId` is still ALLOWED (D-11) | ✓ VERIFIED | `hasAll(['pcExportedAt'])` not `pcPlanId` — the case reasoning alone gets wrong. Emulator |
| 5 | Reopen (→`draft`, `status`+`updatedAt` only) ALLOWED; a reopen touching anything else REJECTED | ✓ VERIFIED | Emulator; **verifier ran the mandated B4 shape verbatim** (`exported` + `{status:'draft', slots:[…]}`) → rejected |
| 6 | Delete ALLOWED at any status (D-15) | ✓ VERIFIED | `allow delete: if isOrgEditor(orgId)` `:63`; emulator |
| 7 | A `roleAssignmentOverrides.{roleId}` dot-path write is REJECTED on a locked service | ✓ VERIFIED | Dot-path surfaces as the top-level key in `affectedKeys()`, in neither carve-out. Emulator |
| 8 | A legacy document with NO `status` field is treated as draft and stays editable | ✓ VERIFIED | `resource.data.get('status','draft')` `:58`, mirrored by `storedStatusOf`'s `?? 'draft'` (`services.ts:135`) and `canWriteSlideGroups`' `?? 'draft'`. Emulator, all three layers agree |

### 31-02 — Slide groups (layer 1, cross-document)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | A slide write whose parent is `planned`/`exported` is REJECTED | ✓ VERIFIED | `parentDraft()` `:95-97`; emulator, plus a verifier probe that flips the parent live: allowed → denied → allowed again after reopen |
| 2 | ★ Opening a locked service does NOT throw permission-denied — no write is attempted on load | ✓ VERIFIED | `canWriteSlideGroups` `:1712`; `ServiceEditorView.test.ts:2344` asserts zero writes; `:2377` proves materialization resumes on reopen with no remount |
| 3 | A slide write against a draft parent still succeeds, unchanged | ✓ VERIFIED | Emulator |
| 4 | An orphan group (parent deleted) is still DELETABLE | ✓ VERIFIED | `allow delete` is deliberately more permissive `:117-120`; emulator, plus verifier probe for the legacy no-`serviceId` case |
| 5 | A group cannot be re-parented from a draft service onto a locked one | ✓ VERIFIED | `request.resource.data.serviceId == resource.data.serviceId` `:111`; emulator |

### 31-03 — The transitions (layer 2 + UI)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | The status badge is no longer clickable — `toggleStatus` does not exist | ✓ VERIFIED | `<span data-testid="service-status-pill">` `:80-92`; grep; store test asserts the property is absent |
| 2 | `exported` reachable ONLY by a real export; no hand-setting path | ✓ VERIFIED | No generic `setStatus`; `allow create` requires `status=='draft'` (verifier probe: create at `planned` and create with **no** status field are both rejected); `exported→exported` also rejected |
| 3 | Mark as Planned only in draft; Reopen only when locked | ✓ VERIFIED | `v-if="canEditService"` `:185` / `v-if="authStore.isEditor && isLocked"` `:304`. Shipped tests `:2486, :2496` |
| 4 | Reopen with real evidence opens the confirm dialog; without it does not | ✓ VERIFIED | PROBE E + shipped tests |
| 5 | ★ A rejected transition leaves the pill/banner/gates at the OLD status and says so on screen | ✓ VERIFIED | `applyTransitionLocally` runs only after the awaited write (`:2368`, `:2444`); both `catch` blocks mutate nothing. PROBE E ("a rejected reopen does not flip") + PROBE D (rejected `markAsPlanned` stays Draft) + shipped `:2653, :2676` |
| 6 | `pcExportedAt` and `pcPlanId` both survive a reopen (D-11) | ✓ VERIFIED | `reopenService` writes `status`+`updatedAt` and nothing else (`services.ts:208-214`); PROBE E asserts both ids present after reopen; verifier probe proves a reopen that *clears* `pcPlanId` is rejected at the rules layer |
| 7 | The delete confirm gains a PC sentence only with export evidence | ✓ VERIFIED | `deleteServiceConfirmBody` `:1508`; PROBE F asserts the sentence at `exported`+evidence; shipped `:2718/:2733` cover both branches |

### 31-04 — The read-only tabs (layer 3)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Locked Service Order rows render as plain text — no handles, no Add item, no pickers | ✓ VERIFIED | 52 shipped assertions at BOTH statuses (`:2879`), plus the 26-row table above |
| 2 | Locked Slides tab offers no Add slide, Import, drag, drawer edits or group media | ✓ VERIFIED | `canMutateGroup`/`canWriteGroupMedia`/`canMutate`; `:2976` asserts `SlidesTab` is told `serviceLocked` **without** overloading `isEditor` |
| 3 | Locked Roles tab renders assignments as names, no checkboxes | ✓ VERIFIED | `:1190`, `:1211` gated on `canEditService`; shipped `:2926` |
| 4 | ONE lock banner, not one per tab, no re-announce on switch | ✓ VERIFIED | Structurally guaranteed — the banner sits outside all three `v-show` panels (`:303`). Shipped `:3026` |
| 5 | Export to PC, Present, Print and Share still work while locked (D-08) | ✓ VERIFIED | Shipped `:2957` (all four rendered and enabled at both statuses) + PROBE F (the export write actually lands) |
| 6 | ★ No empty state or helper text instructs a locked user to do what they cannot | ✓ VERIFIED (editor) | Shipped `:2990` (empty-section placeholder) and `:3001` (Roles no-schedule note) at both statuses, plus `:3014` proving draft keeps both instructions. **Adjacent open item: LO-01 — a VIEWER is still told to "reopen it for editing" in the drawer.** Tone judgement across all four states is deferred (31.22) |
| 7 | ★ Reopening restores drag-and-drop with no page reload | ✓ VERIFIED (mechanism) | `:3056` locking destroys the per-section Sortables; `:3069` reopening re-creates them; `SlideGrid.vue:684` pairs the same. PROBE E proves the editor is genuinely writable again (a keystroke saves). **Real pointer input is deferred (31.18)** |
| 8 | A viewer does not see the lock banner | ✓ VERIFIED | `v-if="authStore.isEditor && isLocked"` `:304`; shipped `:3044` |

### 31-05 — The next-free-Sunday default

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Default date is the nearest FUTURE Sunday with no plan | ✓ VERIFIED | `nextFreeSunday` `:43-59`; wired `ServicesView.vue:169` → `NewServiceDialog.vue:135/164` |
| 2 | Consecutive taken Sundays are skipped | ✓ VERIFIED | `for` loop with a `Set` skip test; `quarterDates.test.ts` |
| 3 | Bounded at ~52 and falls back to the plain next Sunday — never blank | ✓ VERIFIED | `maxWeeks = 52`, `return plainNextSunday` `:58` |
| 4 | ★ Default TEAM selection follows the date's ordinal-of-month | ✓ VERIFIED | `sundayOrdinal` `:147` feeds `defaultForm()` **and** the `form.value.date` watcher; `NewServiceDialog.test.ts:122-171` |

**Score: 36/36 truths verified on automated evidence. 0 failed. 0 present-but-behavior-unverified.**

---

## ★ The two deliberate deviations — verified by execution

### (a) ME-03 — the `lastUsedAt` bump moved AFTER a successful `markAsPlanned`

The review asked for a compensating restore in a `catch`. The phase instead **deleted the window**: once
ME-02 stopped routing the bump through `assignSongToSlot` (which wrote the whole `slots` array), the bump
no longer had to precede the status write, and `/songs` is role-gated only
(`firestore.rules:124-125`) so a song write is legal at any service status.

Executed against the real view (`onMarkAsPlanned`, three probes):

| Claim | Result |
|---|---|
| The bump runs strictly AFTER `markAsPlanned` | ✓ call-order array: `markAsPlanned` then `updateSong` |
| No service write carrying `slots` is issued by the bump (ME-02) | ✓ zero `updateService` calls with a `slots` key after the transition |
| A rejected `markAsPlanned` ages **no** song | ✓ `updateSong` never called; pill stays `Draft` |
| A failed bump does not roll back or misreport the completed transition | ✓ status stays `planned`, `lifecycleError` stays `null` |
| The failure message branches on cause, not on transport | ✓ `ServiceLockedError` → "This service changed status somewhere else…" (`:2405-2408`) |

**The argument holds.** The compensating restore is genuinely unnecessary because the failing path is
unreachable, not merely handled — and a restore would itself have needed to survive a second failure.

### (b) BL-02 — the remote-merge branch is left CLOSED while local is dirty after a transport failure

The review asked only that the status machine not strand. The phase went further and made `'error'`
*hold the merge branch closed while dirty*, so a snapshot arriving mid-outage cannot discard unsaved
typing (`:2004-2011`). The risk is that this is a new wedge. **It is not.** Executed:

| Claim | Result |
|---|---|
| Control: the merge branch works before any failure | ✓ remote `2026-03-15` applied |
| Status parks at `'error'`, never strands at `'saving'` | ✓ |
| The user's text is KEPT (this is the whole point of the branch) | ✓ notes unchanged after the rejection |
| While dirty, a remote snapshot is deliberately ignored | ✓ remote `2026-05-03` not applied — the protection, working |
| **Exit 1** — the next keystroke re-arms the debounce, the retry succeeds, the merge branch reopens | ✓ status leaves `'error'`; remote `2026-06-07` applied. **No remount.** |
| **Exit 2** — the branch admits `'error'` the moment local goes clean, with NO successful retry at all | ✓ user reverts their own edit → remote `2026-07-05` applied |

**Two independent exits, both proven.** There is no path on which the branch stays closed once the user
stops having unsaved work. This is a bounded, self-clearing protection, not a wedge.

---

## R036 — the three layers, each confirmed independently

| Layer | Where | Independently proven by |
|---|---|---|
| **1 — Firestore rules** | `firestore.rules:57-121` + the load-bearing wildcard exclusions `:162-166` | 96 emulator assertions + 15 verifier probes. **NOT DEPLOYED — emulator only (D-16 revised).** |
| **2 — Pinia store guard** | `services.ts:117-173` (`assertWritable`, three shapes mirroring the rule one-for-one) + `setRoleOverride`/`clearRoleOverride`'s own guards `:289/:304` | 25 shipped store tests exercising the guard and the transitions with Firestore fully mocked — no rules involvement |
| **3 — UI** | `isLocked` / `canEditService` `:1566-1568`, `canWriteSlideGroups` `:1712`, `canReorder` `:1756`, and the composed slide gates | 52 shipped view tests + 17 verifier probes with the store mocked — no store guard involvement |

**The two legal non-draft writes still work through all three:**

- **Export (D-09).** Payload is exactly `{pcExportedAt, pcPlanId, status:'exported'}` (verified by probe).
  Rule branch 2 accepts (emulator). Store `isExportWrite` accepts (`services.ts:142`). UI keeps the button
  live at `planned` (`:206-211`). And the phase closed the trailing hazard: `originalService` is mirrored
  at `:3324` so no autosave fires into the just-locked service — probe-confirmed, zero calls after 900ms.
- **Delete at any status (D-15).** `allow delete: if isOrgEditor(orgId)` with no status term; store
  `deleteService` deliberately unguarded (`:216-223`); button still rendered on a locked service
  (shipped `:2749`) and probe-confirmed to call through at `exported` with the PC warning sentence present.

---

## Dead code

| Symbol | Status | Verified |
|---|---|---|
| `serviceStore.assignSongToSlot` (`services.ts:225-250`) | **Confirmed dead in production code** | Only three references outside the store: its own two tests and a `mockAssignSongToSlot` the view test no longer exercises. `onSelectSong` mutates `localService` and lets autosave persist. Deliberately retained, recorded in `deferred-items.md` |
| `toggleStatus` | Deleted cleanly | Grep finds only explanatory comments; store test pins its absence |
| `isExportedLocked` | Deleted cleanly | Grep finds only comments explaining the widening to `isLocked` |
| `NewServiceDialog`'s private `nextSunday()` | Deleted cleanly, replaced by the shared `nextFreeSunday` | Grep finds only comments |

**Nothing else was orphaned.** Every symbol added this phase has a live consumer:
`drainGroupWrites` ← `onMarkAsPlanned:2366`; `suppressMaterialization` ← `confirmSlotDelete:2579`;
`hasPcExportEvidence` ← three consumers (banner body, reopen gate, delete confirm) as designed;
`reopenPcWarning`/`statusLabel`/`statusBadgeClasses` all bound in the template.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TODO`/`FIXME`/`XXX`/`TBD`/`HACK`/`PLACEHOLDER` | — | **None.** All 11 phase-modified source files scanned; zero debt markers |

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| **R036** | Draft-only editing, three-layer enforcement | ✓ SATISFIED (emulator) — production is two-layer until the rules deploy | The 26-row table + the three-layer table above |
| **R037** | Explicit reopen, with a PC warning when already exported | ✓ SATISFIED | SC2/SC3, PROBE E. **Bookkeeping note:** `REQUIREMENTS.md` still shows `[ ] R037 … Pending` while R036/R038 are `[x] Complete` — the code is delivered; the checkbox lags |
| **R038** | New-service date defaults to the nearest free Sunday | ✓ SATISFIED | SC4 |

No orphaned requirements: `REQUIREMENTS.md` maps exactly R036–R038 to Phase 31, and all three are claimed
by the executed plans.

**Cloud Function exposure (ROADMAP note):** checked — `functions/src/index.ts` performs **no** Firestore
writes to `services` or `slideGroups`, so the Admin-SDK bypass the roadmap warned about does not exist
here. `src/stores/services.ts` is the only writer to `/services` in the whole repo.

---

## What a third pass found — the honest list

Nothing that blocks Phase 32. Four things worth recording:

1. **Six inventory rows had no direct execution proof anywhere in the repo** (12, 17, 18, 19, 20, 21) —
   the same class of omission that let rows 1/23/24 ship. **All six are correctly guarded in source and
   are now execution-proven** by this verification's probe run. *The probe assertions were not committed*
   — if the project wants standing protection, extend `ServiceEditorView.test.ts:3092`'s loop with those
   six handlers.
2. **A `ServiceLockedError` autosave refusal silently discards the user's in-flight typing.** Reproduced:
   after typing "a long paragraph the user just typed" into a service another editor just locked, the
   field reads `""`, and the message says *"…try again"* — implying the text is still there. Deliberate
   (`:2071-2077`) and defensible; the **copy** is not. Routed to human verification; directly relevant to
   Phase 32.
3. **The accepted `serviceId`-forgery residual is real** — reproduced against the emulator. It is
   correctly analysed in `31-RESEARCH.md` (org editors only; not a tenancy boundary), but the analysis
   lives only in a phase document. `firestore.rules:106-108` documents the *immutability* fix without
   mentioning that the **create** side is deliberately not closable. One comment line there would stop a
   future maintainer rediscovering it as a bug.
4. **The rules layer is not in production.** This is the single largest gap between "verified" and
   "protected", and it is disclosed everywhere it should be (D-16, PENDING-VERIFICATION lines 20-22,
   ROADMAP backlog 999.3). Repeating it here because a green rules suite reads exactly like a deployed
   lock.

---

## Human Verification Required

**None of the following was performed.** Deferred under the standing autonomy grant
(`.planning/STATE.md`), which explicitly forbids recording a deferred check as passed.

### 1. The 30 queued items

`.planning/PENDING-VERIFICATION.md` § "Phase 31" — items **31.1 through 31.30**, already written as an
owner-facing checklist. The three that no automated evidence can substitute for:

- **31.10** — devtools direct-write bypass, with `VITE_USE_EMULATORS=true` (the *only* way to see the
  rules layer from the running app; on live Firebase the check proves nothing).
- **31.18** — real pointer drag on both tabs immediately after a reopen. Unit tests prove the Sortable
  instances are destroyed and re-created; only a pointer proves the re-created ones are live.
- **31.29** — two browsers, one real Planning Center account: confirm the second export refuses *before*
  contacting PC, and that **no duplicate or orphaned plan** exists afterwards.

### 2. `31-06-PLAN.md` has not been executed

**Test:** run the plan (`autonomous: false`): re-run `npm run test:rules` and record it verbatim, walk the
12-item checklist, and record the deploy hand-off.
**Expected:** `31-06-SUMMARY.md` exists and records each outcome honestly.
**Why human:** it is the phase's own blocking checkpoint. ROADMAP.md still reads *"Plans: 5/6 executed"*.

### 3. ★ Decide whether discarding in-flight typing is acceptable, and fix the copy if not

**Test:** two browsers on one draft service — type in A, click **Mark as Planned** in B within ~800ms.
**Expected:** A's banner reads *"This service is locked, so that change wasn't saved. Reopen it for
editing and try again."* — decide whether that is the right thing to say when the text has been reverted
out of the field.
**Why human:** product judgement on a deliberate trade-off. The verifier reproduced the loss; the code
comment at `:2071-2077` argues for it; the copy does not disclose it.

---

## Gaps Summary

**No gaps.** No truth failed, no artifact is missing or stubbed, no key link is unwired, and no blocker
anti-pattern exists.

The phase is `human_needed` rather than `passed` for exactly one structural reason: its own closing gate
(31-06) is a blocking human checkpoint that was deliberately deferred, and 30 human checks sit queued
behind it. That is the honest reading of the autonomy grant, not a defect finding.

**Is it safe to build Phase 32 on top of this?** Yes. Phase 32 (Save Reliability — autosave fix and a
persistent save indicator) inherits a `handleAutosaveFailure` seam (`:2093-2108`) with a two-class failure
taxonomy, a proven-self-recovering `'error'` state, an autosave watcher that both cancels on lock and
re-checks at firing time, and a `lifecycleError` surface that renders at *every* status. That is a
better foundation than Phase 32 would have had before, not a compromised one. The two things Phase 32
should carry forward: item 2 above (the discarded-typing copy), and the fact that the autosave
status/error line is deliberately removed at locked statuses (`:103`), which its "persistent inline
indicator" requirement (R040) will need to reconcile.

---

_Verified: 2026-07-30T16:38:26Z_
_Verifier: Claude (gsd-verifier) — goal-backward, third adversarial pass_
_Method: 26-row inventory re-walked from 31-PATTERNS.md §4a; 32 purpose-written probes executed against the real component and the live Firestore emulator; probe files deleted after the run (`git status` clean)_
