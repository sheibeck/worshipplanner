---
phase: 30-slides-mirror-the-plan-hard-lock-reconciliation-removed
verified: 2026-07-29T15:48:51Z
verified_at_commit: e5727d1
status: human_needed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
method: goal-backward; shipped code EXECUTED against constructed inputs (3 throwaway probe suites, 29 assertions incl. 1000 randomized rebuild trials), plus symbol sweep, type-check, and one full test-suite run
human_verification:
  - test: "Re-run the 5-step owner UAT against HEAD (e5727d1), not the tree that was approved. Focus on step 3 (scripture reference -> one slide) and step 5 (song-group read-only + drawer), which HI-02/ME-02/ME-03 changed after approval."
    expected: "All five steps still pass: song swap rewrites with no prompt; drop tile offers only what it accepts; a scripture reference produces exactly one reference-only slide; a Service Order reorder mirrors immediately; deleting a plan item removes its slide group."
    why_human: "The owner's recorded approval was given at 5c531b1/f013ba8. Nine fix commits (8c32bae..8d1e705) then changed the projected reference string, the Service Order scripture input binding, the drawer's audio-loop control, and 149 lines of the rebuild engine. No human has driven the shipped tree."
  - test: "Type 'John 3:16-16' into a SCRIPTURE plan item's reference field (or accept a single-verse AI suggestion), save, reload, and compare the Service Order input against the Slides rail row and the projected slide."
    expected: "Owner decision: either all four surfaces read 'John 3:16' (delegate ScriptureInput.formatRef to formatScriptureReference), or the divergence is accepted as cosmetic."
    why_human: "W-02 below. Proven by execution, but whether a cosmetic input-field divergence is worth a fix is a product call."
  - test: "Assign the same song to two plan items, then use 'Clear song' on one of them. Open the Slides tab and look at the cleared plan item's group."
    expected: "Owner decision: the cleared item should show no slides. It currently shows the old song's full slide set."
    why_human: "W-03 below. Pre-existing (identical at 0ecc84f), reachable only when the song is reprised elsewhere in the same service, and it contradicts R045's 'always mirror' wording that this phase claims to deliver."
warnings:
  - id: W-01
    severity: warning
    statement: "The shipped tree was never human-verified — the UAT record covers a superseded commit."
    evidence: "30-04-SUMMARY.md records owner approval ('This is approved') after 5c531b1; HEAD is e5727d1, 9 commits later. 8c32bae..8d1e705 changed slideGroupMaterializer.ts (+149/-25), ServiceEditorView.vue, EditSlideDrawer.vue, useSlideshowAssembly.ts, scripture.ts, slideDisplay.ts, planningCenterApi.ts, planningCenterExport.ts."
  - id: W-02
    severity: warning
    statement: "A FOURTH un-delegated scripture formatter survives the ME-01/HI-02 sweep: ScriptureInput.formatRef."
    evidence: "src/components/ScriptureInput.vue:220-229 branches on `verseStart !== undefined && verseEnd !== undefined` and does not collapse the equal-verse case. Executed: modelValue {book:'John',chapter:3,verseStart:16,verseEnd:16} renders 'John 3:16-16' in the input while formatScriptureReference, slotDisplayTitle and formatScriptureRef all render 'John 3:16'. parseScriptureInput('John 3:16-16') produces exactly that ref. Phase-30-introduced: pre-HI-02 the two agreed."
    impact: "Cosmetic. No data loss, no wrong slide, no wrong export."
  - id: W-03
    severity: warning
    statement: "Clearing a song from a plan item leaves the old song's slides projecting when that song is still assigned elsewhere in the same service."
    evidence: "Executed via assembleSlideshow: a cleared SONG slot whose stored group holds OLD-song copyright+lyric entries emits 2 slides when a second slot still references OLD. rebuildSongGroup returns {changed:false} on !songId (src/utils/slideGroupMaterializer.ts:478) — byte-identical at 0ecc84f, so PRE-EXISTING, not a Phase 30 regression. confirmSlotDelete's clear path deliberately does not cascade (ServiceEditorView.vue:1894-1902). The usual case is masked because the old song's lyrics stop being loaded; a reprised song defeats the mask."
    impact: "Live mirror violation against R045's 'membership always mirrors' wording, in a narrow reachable case."
info:
  - id: I-01
    statement: "R054 lock is template-only for 6 of 7 mutation entry points."
    evidence: "onLoopToggle has a handler-level `if (!canMutate.value) return` (ME-03). onDuplicate, onConfirmDelete, onAudioFileSelected, onRemoveAudio (EditSlideDrawer.vue) and onAddSlide, openImportModal (SlideGrid.vue) have none. Verified unreachable today: no defineExpose in either component, and every binding sits inside `v-if=\"canMutate\"` / `v-if=\"isEditor && !isSongGroup\"`. Not a defect — but Phase 31 adds a second lock layer over the same controls."
  - id: I-02
    statement: "LO-05 confirmed by execution and confirmed harmless."
    evidence: "A scripture passage change returns changed:false (probe), so applyRebuildOutcomes never runs and sourceSignature keeps naming the previous passage. Nothing reads sourceSignature (types/slideGroup.ts:42-50 'consulted by nothing'). Recorded in deferred-items.md."
deferred:
  - item: "LO-01 (dead scriptureReadingsById subscription), LO-02 (dead AssembledSlide.sourceId), LO-03 (middle copyright entries dropped on rebuild), LO-05 (stale sourceSignature comment)"
    addressed_in: "deferred-items.md (explicit, not by omission); LO-01 is adjacent to Phase 34 (R064) which the deferral note names"
    evidence: "All four are dead-code / stale-comment cleanups with no user-facing defect; LO-03 is unreachable for new data now that R054 removed the Duplicate action from song groups."
---

# Phase 30: Slides Mirror the Plan — Hard Lock & Reconciliation Removed — Verification Report

**Phase Goal:** Slide-group order and membership are hard-locked to the service order, with the reconcile/confirm review flow deleted entirely.
**Verified:** 2026-07-29T15:48:51Z at `e5727d1`
**Status:** human_needed — 5/5 must-haves verified, 0 blockers, 3 warnings requiring an owner decision
**Re-verification:** No — initial verification

## Verdict

**The phase goal is achieved.** Every one of the five roadmap success criteria is delivered in the codebase, and — critically — the two BLOCKERs, two HIGHs and five MEDIUMs from `30-REVIEW.md` are genuinely closed, not narrowed. I proved this by **executing the shipped `rebuildGroup` and `assembleSlideshow`** against constructed inputs rather than reading the code or trusting the green suite, because this phase's own history shows the suite is not a reliable oracle here (596 tests passed while 14 defects, including two silent-data-loss defects, sat in the tree).

**The "tests green, defects present" pattern did partially continue** — a third pass found one fresh phase-introduced divergence (W-02) that the review, the fixes and 3,636 passing tests all missed, plus one pre-existing mirror violation (W-03). Both are cosmetic-to-narrow, neither is a blocker, and neither threatens Phase 31.

**Safe to build Phase 31 on top: yes.** The rebuild engine is now provably order-preserving, multiplicity-preserving and idempotent; the reconciliation subsystem is genuinely gone; the R054 lock is complete. The one thing Phase 31 should carry forward is I-01 — it will add a second (lifecycle) lock over the same controls whose current lock is template-only.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Reordering a service item automatically reorders its slide group in the Slides tab — no second manual step | ✓ VERIFIED | `assembleSlideshow` sorts `service.slots` by `position` (`slideshowAssembler.ts:243-244`); `reindexSlots(orderSlotsBySection(...))` keeps `position === array index` (`slotTypes.ts:109-111, 190-196`); rail sorts by `position` (`SlidePlanRail.vue:113`). 50-permutation property test (`slideshowAssembler.test.ts:1203, 1229`). **Executed:** moving a SCRIPTURE slot between two SONG slots flips `['b1','a1','c1']` → `['a1','b1','c1']` in one call. |
| 2 | Swapping a song silently rewrites that group's slides to the new song, with no confirmation prompt | ✓ VERIFIED | `rebuildSongGroup`'s identity-swap branch is unconditional (`slideGroupMaterializer.ts:488-507`); no confirm surface exists anywhere (truth 4). **Executed:** OLD→NEW swap emits `copyright:NEW, lyric:NEW, lyric:NEW, video, text, copyright:NEW` — zero OLD refs survive, hand-added video + authored text spliced ahead of the trailing copyright; pass 2 `changed:false`, byte-identical. |
| 3 | Changing a scripture passage updates its scripture slide automatically, defaulting to one slide carrying the passage | ✓ VERIFIED | Per R047's CURRENT wording (reference-only, slot-derived). `deriveGroupEntries` SCRIPTURE emits exactly one payload-free entry (`:71-85`); `resolveEntryContent` resolves the reference LIVE from the slot (`slideshowAssembler.ts:139-157`). **Executed:** a populated slot projects exactly 1 slide, `reference:'Psalms 103:1-5'`, `text:''`; a passage change returns `changed:false` and keeps the entry's `id`, `audioUrl`, `label`, `notes`; a cleared reference projects 0 slides; a legacy 3-entry group collapses to 1 (HI-01) and is stable. |
| 4 | No reconcile/confirm modal or banner ever appears — every change rebuilds unconditionally | ✓ VERIFIED | Widened symbol sweep over `src/` returns **only 3 hits**, all declared negative assertions in tests (`useSlideshowAssembly.test.ts:856,919`; `ServiceEditorView.test.ts:1393`). `ReconcileConfirmModal.vue` + suite absent from disk. One unconditional decide/write loop (`useSlideshowAssembly.ts:393-420`). `replaceGroupSlides`'s transaction merge correctly kept (`slideGroups.ts:207-330`). |
| 5 | Song groups are read-only — a planner cannot create, edit, delete, or reorder a song's slides there | ✓ VERIFIED | Grid: add-slide + import hidden (`SlideGrid.vue:17,24`), read-only badge shown (`:34`), `canReorder` excludes SONG and destroys the Sortable instance (`:596, 614, 686`), drop routing refuses deck/image/video with a notice and accepts audio only (`:505-517`), drop-tile copy matches the handler (`SlideDropTarget.vue:9-12`). Drawer: `canMutate = isEditor && !isSongGroup` gates label/body/notes/audio-scope/attach/remove/duplicate/delete, and ME-03's loop checkbox is now gated at **both** the DOM (`:291`) and the handler (`:597`). Group-level audio still works — `SlideGroupMusicControl` is gated on `isEditor` only (`SlideGrid.vue:61-68`). |

**Score: 5/5 truths verified (0 present-but-behavior-unverified).**

### Review-Finding Closure — independently re-proven by execution

The task asked me to independently verify the fixer's two deliberate divergences from the reviewer's suggested patch. Both are **correct**, and I proved the anchoring scheme's idempotence rather than accepting the doc comment's claim.

| Finding | Fixer's approach | Independent verdict |
|---------|-----------------|--------------------|
| **BL-01 (SONG deviation)** — `isSlotDerivableRef` answers on ref KIND alone for SONG, not on `songId` | Deliberate divergence from the reviewer's `ref.songId === slot.songId` | **✓ CORRECT.** Executed: with the reviewer's predicate, every OLD-song lyric/copyright entry would classify as "user work" and `survivingEntries` would splice the entire previous song back into the swapped group. The shipped predicate drops them; the swap branch already rebuilds from the new song's derivation, so nothing is lost that the swap did not intend to replace. A song's `lyric`/`copyright` refs are never user-authorable. |
| **BL-01 (survival widening)** | Widened to key off the slot, not the ref kind | **✓ CLOSED.** Executed: imported entries appended into a SCRIPTURE group survive (`['e1','e2','e3']`, was `['e1']`); a second deck imported into an IMPORTED group survives; the intended re-import drop of an obsolete own-deck `innerSlideId` is preserved (`['e1']`). |
| **BL-02 (anchoring deviation)** — a fresh derived entry anchors to its nearest carried neighbour's stored index, rather than sorting unplaced entries to the end | Deliberate divergence from the reviewer's `?? Number.MAX_SAFE_INTEGER` sort | **✓ CORRECT AND IDEMPOTENT.** Key is `anchor + (i+1)/(n+1)` with the fraction strictly in `(0,1)`, so (a) an anchored entry can never sort past its own anchor, (b) a run of new entries keeps derivation order, (c) no anchored key can collide with an integer stored index. Idempotence is **structural**, not incidental: after one pass every entry's stored index equals its own position, so pass 2 is the identity sort. **Executed over 1000 randomized scenarios** (deck size 1-5, random subsets forcing fresh derivations, shuffled stored order, 0-2 foreign/user entries): **0** pass1≠pass2, **0** pass3≠pass2, **0** spurious `changed:true` on pass 2, **0** lost entries. A drag-reordered imported group rebuilds `changed:false` preserving `['e3','e2','e1']`; a mid-group hand-added video stays at index 1; a full re-import lands ahead of a user-appended entry. |
| **HI-01** — legacy scripture group stabilised at N identical slides | Suppress surplus for `kind === 'scripture'` | **✓ CLOSED.** Executed: 3-entry legacy group → 1 entry, carrying `stored[0]`'s id and `audioUrl`; pass 2 `changed:false`. |
| **HI-02** — `John 3:16-16` | Collapsed in `formatScriptureReference` | **✓ CLOSED at the canonical formatter and 3 of 4 consumers** — but see W-02: `ScriptureInput.formatRef` is a fourth site the sweep missed. |
| **ME-01 / ME-02** — un-delegated formatters, non-round-trippable editor | Delegated to `scriptureRefFromSlot` + `formatScriptureReference` | **✓ CLOSED.** `planningCenterExport.ts:83-87`, `planningCenterApi.ts:967-968`, `slideDisplay.ts:56-57`, `ServiceEditorView.vue:2180-2187` all delegate. Executed round-trip controls: whole-chapter ("Psalms 103"), single-verse-with-null-end ("Romans 8:28") and true ranges agree across input, rail and slide. |
| **ME-03** — audio-loop checkbox | DOM `:disabled` + handler guard + `await` instead of `void` | **✓ CLOSED** (`EditSlideDrawer.vue:291, 597, 609`). |
| **ME-04** — delete/materialize race | `suppressMaterialization(slotId)` hold | **✓ WINDOW GENUINELY CLOSED, not narrowed.** The hold is taken **before** `await deleteGroup` and released in `finally` **after** `performRemoveSlot` (`ServiceEditorView.vue:1918-1932`). The composable receives `localService` itself, not a remote ref (`:1366`), and `performRemoveSlot` splices synchronously (`:1863-1867`) — so by the time the hold releases, the slot is already absent from `service.value.slots` and can never be a materialization candidate. Both the automatic watcher (`useSlideshowAssembly.ts:284`) and `ensureGroupMaterialized` (`:342`) respect the hold. Vue's `pre`-flush watchers cannot interleave between the splice and the release (same synchronous continuation). Failure path is also safe: the slot stays and the group is restored by Firestore's local revert, so no orphan. 3 regression tests in `64de10c`. |
| **ME-05** | Suite deleted | **✓ CLOSED** — `ServiceScriptureIntegration.test.ts` absent. |
| **LO-04** | Comment corrected | **✓ CLOSED** (`slideGroupMaterializer.ts:10-23`). |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **R045** (order) | ✓ SATISFIED | Truth 1. Permutation property test + executed reorder. |
| **R045** (membership) | ✓ SATISFIED, with W-03 caveat | Cascade delete + ME-04 hold close the orphan window; an orphan group is never rendered (executed). Caveat: the *clear-song* path (not a remove-element delete) can leave stale slides projecting — see W-03. |
| **R046** | ✓ SATISFIED | Truth 2 + truth 4. |
| **R047** | ✓ SATISFIED | Truth 3, verified against the **current** rewritten wording (slot-derived, reference-only, no reading document). The "Edit Scripture Slides" button, reading-mode toggle and editor panel are gone from `ServiceEditorView.vue` (zero grep hits); `ScriptureSlideEditor.vue` and `CongregationalEditor.vue` remain on disk unmounted for Phase 34, as the requirement states. |
| **R048** | ✓ SATISFIED | Truth 4. The `dismissedSignature` leave-vs-backfill decision is recorded **explicitly** (30-CONTEXT.md lines 42-46, and `types/slideGroup.ts:42-50`) — not by omission, as the roadmap demanded. |
| **R054** | ✓ SATISFIED | Truth 5. |

Orphaned requirements: none. REQUIREMENTS.md maps exactly R045-R048 + R054 to Phase 30, and all five are claimed by the phase's plans.

## Warnings — owner decision required

### W-01 (process): the shipped tree was never human-verified

The owner's 5-step UAT — the strongest evidence for criteria 2, 3 and 5 — was given after `5c531b1`. HEAD is nine commits later. The intervening fixes changed **the projected reference string** (HI-02), **the Service Order scripture input binding** (ME-02), **the drawer's audio controls** (ME-03) and **149 lines of the rebuild engine** (BL-01/BL-02). Those are precisely what UAT steps 3 and 5 exercised.

My execution probes cover the engine thoroughly and `vue-tsc --build` is clean, so I have no reason to believe anything broke. But the record should not read as "human-verified" for code no human has driven.

### W-02 (defect, cosmetic, phase-introduced): a fourth un-delegated scripture formatter

`src/components/ScriptureInput.vue:220-229` keeps its own `formatRef`, which branches on `verseStart !== undefined && verseEnd !== undefined` and never collapses the equal-verse case. **Proven by mounting the component:**

| Surface | Renders |
|---|---|
| `formatScriptureReference` (canonical) | `John 3:16` |
| `slotDisplayTitle` (rail / grid header / drawer) | `John 3:16` |
| `formatScriptureRef` (Planning Center export) | `John 3:16` |
| **`ScriptureInput` field (Service Order tab)** | **`John 3:16-16`** |

Reachable: `parseScriptureInput('John 3:16-16')` produces `{verseStart:16, verseEnd:16}` exactly, and `onSelectAiScripture` writes whatever the AI returns. Note this divergence **did not exist before Phase 30** — pre-HI-02, `formatScriptureReference` also emitted `John 3:16-16`, so the two agreed. The HI-02 fix created it, and `ME-01`'s stated purpose was to eliminate exactly this class ("two scripture formatters were left un-delegated"). The sweep found two of three.

Impact is cosmetic: same passage, no data loss, no wrong slide, no wrong export.

### W-03 (defect, pre-existing, narrow): clearing a song can leave its slides projecting

**Proven by executing `assembleSlideshow`:** a plan item whose song was cleared still emits the old song's slides — 2 slides in my probe — whenever that same song is still assigned to another plan item in the same service (which keeps its lyrics loaded and so keeps `resolveEntryContent`'s `lyric`/`copyright` branches resolving).

`rebuildSongGroup` returns `{changed:false}` on `!songId` (`slideGroupMaterializer.ts:477-478`) — **byte-identical at `0ecc84f`**, so this is not a Phase 30 regression — and `confirmSlotDelete`'s clear-song path deliberately does not cascade a group delete (`ServiceEditorView.vue:1894-1902`, "R029 scopes the cascade to actually removing the plan item"). The ordinary case is masked because a cleared song stops being loaded; a reprised song defeats the mask.

It is reported here because Phase 30 is the phase that claims "slides always mirror the plan", and this is a case where they do not.

## Behavioral Spot-Checks

| Check | Command | Result | Status |
|---|---|---|---|
| Type-check | `npx vue-tsc --build` | exit 0, no output | ✓ PASS |
| R046 symbol sweep | `grep -rnE "<13 reconciliation symbols>" src/` | 3 hits, all declared negative assertions | ✓ PASS |
| Reconciliation component removed | `ls src/components/slides/` | no `ReconcileConfirmModal.vue`, no suite | ✓ PASS |
| R047 UI removal | `grep -n "edit-scripture-slides-btn\|readingMode\|ScriptureSlideEditor" src/views/ServiceEditorView.vue` | 0 hits | ✓ PASS |
| Phase-34 editors retained | `ls src/components/` | `ScriptureSlideEditor.vue`, `CongregationalEditor.vue` present | ✓ PASS |
| Rebuild-engine probes (BL-01/BL-02/HI-01/R047/SONG swap) | 3 throwaway vitest suites, 29 assertions | all pass | ✓ PASS |
| Randomized idempotence | 1000 trials × 3 passes | 0 failures, 0 lost entries | ✓ PASS |
| Working tree after probes | `git status --porcelain` | only pre-existing untracked `docs/example.mp3`, `docs/example.pptx` | ✓ CLEAN |

Probe suites were created under `src/utils/__verify30probe*.test.ts`, executed, and deleted; the tree is verified unchanged.

## Test Baseline (honest record)

One full run: `npx vitest run` → **3,636 passed / 41 failed / 18 skipped (3,695) across 166 files; 14 files failed.**

| # | Failing file | Attributable to Phase 30? |
|---|---|---|
| 1-10 | `.gsd/quarantine/worktrees/{2 worktrees}/src/{rules, stores/services, utils/planningCenterExport, views/RosterView, views/ServiceEditorView}.test.ts` | No — frozen worktree snapshots picked up by the runner (`vite.config.ts`'s `test.exclude` covers only `src/rules.test.ts` and `node_modules`) |
| 11-12 | `functions/lib/index.test.js`, `functions/lib/pptxParser.test.js` | No — untracked build artifacts |
| 13 | `src/storage.rules.test.ts` | No — needs the Storage emulator |
| 14 | `src/views/__tests__/RosterView.test.ts` | No — stale assertion, unrelated subsystem |

**The live `src/` tree has exactly one failing file, `RosterView.test.ts`, and it is unrelated to slides.** Every suite this phase touched is green.

**HI-02 quarantine diagnosis: CONFIRMED.** The 2 extra quarantine failures are `.../src/utils/__tests__/planningCenterExport.test.ts > formatScriptureRef > formats single verse references`, failing with `expected 'John 3:16' to be 'John 3:16-16'`. The snapshot imports `@/utils/planningCenterExport`, and the root `vite.config.ts` alias resolves `@` to the **real** `src/` — so the frozen test asserts the pre-HI-02 contract against the post-HI-02 implementation. The live `src/utils/__tests__/planningCenterExport.test.ts` was updated by `d6bd5ce` and passes. **Nothing in the live `src/` tree is affected.**

Caveat on the phase's own numbers: the 596/596 figure in `30-REVIEW.md` was the phase's suites only, and it is exactly the number that was green while all 14 review findings sat in the tree. It should not be read as a quality signal.

## Anti-Patterns

| File | Pattern | Severity | Impact |
|---|---|---|---|
| — | No `TBD`/`FIXME`/`XXX` in any file this phase modified | — | Clean |
| `src/components/ScriptureInput.vue:220` | Duplicated formatter bypassing the declared canonical primitive | ⚠️ Warning | W-02 |
| `EditSlideDrawer.vue`, `SlideGrid.vue` | 6 mutation handlers with no handler-level lock guard | ℹ️ Info | I-01 — unreachable today, relevant to Phase 31 |

## Notes for Phase 31

Phase 31 (Draft Lock & Reopen) adds a lifecycle lock over the same Slides-tab controls R054 just locked. Because 6 of 7 mutation entry points are gated by template `v-if` alone (I-01), Phase 31 must gate the **templates**, not assume the handlers are safe — or take the opportunity to push both locks into the handlers. `canMutate` in `EditSlideDrawer.vue:432` and `canReorder` in `SlideGrid.vue:596` are the two natural seams.

---

_Verified: 2026-07-29T15:48:51Z at `e5727d1`_
_Verifier: Claude (gsd-verifier), goal-backward with executed probes_
