---
phase: 38-congregational-readings-become-real-slides
verified: 2026-08-05T18:20:00Z
status: human_needed
score: 5/5 truths verified (all roadmap success criteria), 0 present-behavior-unverified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "38.1 Split a scripture item into congregational sections and confirm one card per section."
    expected: "Slides tab shows N cards, one per Leader/Congregation section, each labeled with its speaker."
    why_human: "Requires a real Firestore-backed service, the Fetch Passage / Split with AI flow (ESV + Claude API), and visual confirmation of the rendered grid — cannot be exercised by static source inspection or the unit suite."
  - test: "38.2 Edit a section's words in isolation."
    expected: "Only the edited card's words change; every sibling card is untouched."
    why_human: "The write path is unit-proven (EditSlideDrawer.test.ts), but a real drawer interaction against a live document has not been driven by a human."
  - test: "38.3 Flip a section's speaker in isolation."
    expected: "Only the toggled card's speaker changes; siblings untouched."
    why_human: "Same as above — mechanism is unit-proven, real interaction is not."
  - test: "38.4 (starred) Delete one section and confirm it survives a page reload."
    expected: "The deleted card stays gone after a reload, remaining cards keep order and words. This is the criterion that has failed before in this codebase's history."
    why_human: "This is the hard criterion (roadmap #4). The DETACH branch and its multi-tick durability are proven in-process by congregationalDetachment.test.ts (15/15 passing) and traced by hand through useSlideshowAssembly's applyRebuildOutcomes -> replaceGroupSlides -> stripUndefined write path in this verification pass — the mechanism is real and correctly wired. But no in-memory test substitutes for a real Firestore round-trip and a real browser reload, which is exactly why this check exists as a human step rather than a unit assertion."
  - test: "38.5 Present the split reading and confirm the projected layout."
    expected: "Reference at top, speaker on its own line, section words below — one section per slide, never stacked."
    why_human: "Visual/projection-distance legibility judgment; component-level tests (78 passing in PresentationViewer.test.ts) prove DOM structure and testids but not how it reads on a real projector."
  - test: "38.6 Confirm a scripture change destroys the split (intended data loss, D1)."
    expected: "Changing the item's scripture on the Service Order tab collapses the Slides tab card back to ONE reference-only card."
    why_human: "DESTROY paths are unit-proven (congregationalDetachment.test.ts's DESTROY ON REFERENCE CHANGE / CLEARED REFERENCE cases) but not yet exercised against a real service document by a human."
  - test: "38.7 An existing pre-Phase-38 congregational reading upgrades itself with no action."
    expected: "A real service with a Phase-34-shaped congregational reading, opened after this phase's deploy, shows N section cards with no manual step."
    why_human: "The migration case is unit-proven against a synthetic fixture (congregationalDetachment.test.ts's MIGRATION cases) but only a real pre-existing document proves the deploy didn't miss a shape the fixture didn't anticipate."
---

# Phase 38: Congregational Readings Become Real Slides Verification Report

**Phase Goal:** A congregational scripture reading produces one slide per section — speaker on top,
passage below — and each of those slides can be edited or deleted on its own.
**Verified:** 2026-08-05
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Turning a scripture item into a congregational reading yields N slides, one per section — not one slide carrying N sections | ✓ VERIFIED | `deriveGroupEntries`'s SCRIPTURE case (`src/utils/slideGroupMaterializer.ts:107-116`) maps `congregationalSectionsFromSlot(slot)` to one `GroupSlideEntry` per section. Confirmed by reading the code and by the passing `CONVERT then IDLE` case in `congregationalDetachment.test.ts` (a 3-section slot converts to 3 entries) plus `congregationalReadingPipeline.test.ts`'s N-slide assembly cases. |
| 2 | Each section slide shows its speaker (Leader / Congregation) above that section's passage text | ✓ VERIFIED | `PresentationViewer.vue:118-139` — `presentation-speaker` `<p>` renders before `presentation-congregational-section` `<p>` in document order, both plain body-treatment blocks, no loop. 78/78 `PresentationViewer.test.ts` tests pass, including document-order and two-slides-two-speakers assertions. |
| 3 | A section slide can be edited on its own without altering its siblings | ✓ VERIFIED | `EditSlideDrawer.vue`'s `writeField` (body) and `onSpeakerToggle` (speaker) both map only the matching `entry.id` and leave every other array element untouched (`src/components/slides/EditSlideDrawer.vue:1135-1157`, `:727-735`). Both pass `props.group.sourceSignature` through unchanged on the write. 166/166 `EditSlideDrawer.test.ts` tests pass, including explicit sibling-byte-identical assertions. |
| 4 | A section slide can be deleted on its own, and stays deleted — it must not reappear when the group is next derived | ✓ VERIFIED (mechanism) — real Firestore/browser round-trip is a human item, see below | Traced by hand: `rebuildScriptureGroup`'s DETACH branch (`slideGroupMaterializer.ts:815-820`) returns the group's stored slides unconditionally with `changed:false` once `group.sourceSignature === sourceSignature(slot, inputs)`, with no gate on the group being non-empty — so a group with every section deleted stays empty. `useSlideshowAssembly.ts:456-471` computes `freshSignature` and `applyRebuildOutcomes` (`:481-516`) writes it via `replaceGroupSlides`, which runs the payload through `stripUndefined` before `updateDoc` (`src/stores/slideGroups.ts:304-331`) — confirmed this write path actually persists the detachment marker, not just the slides. `congregationalDetachment.test.ts`'s `tick()` helper mirrors this exact apply shape (asserted independently, not assumed) and its `DELETE ONE STAYS DELETED` / `DELETE ALL STAYS DELETED` cases run TWO further ticks past the deletion and confirm the deleted section's words appear nowhere. 15/15 tests pass. |
| 5 | Existing services with a stored congregational reading keep working; nothing that reads today's shape breaks | ✓ VERIFIED | `congregationalDetachment.test.ts`'s `MIGRATION, congregational` case (a legacy Phase-34-shaped group — one payload-free entry, bare-reference signature — on a slot with sections) upgrades to N entries on tick one, no change on tick two. `MIGRATION, non-regression` proves an ordinary Reference-state group in the same legacy shape reports `changed:false` on its VERY FIRST tick, so deploy rewrites nothing that wasn't already congregational. Both pass. Full app suite (below) shows no regression outside the pre-existing 2-file baseline. |

**Score:** 5/5 roadmap truths verified. 0 present-behavior-unverified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/slideGroup.ts` | `SourceRef`'s scripture member widened with `speaker`/`text`/`verseRange` | ✓ VERIFIED | Confirmed at lines 145-152; doc comments correctly scoped to Reference vs Congregational states. |
| `src/utils/scripture.ts` | `congregationalSectionsFromSlot` / `congregationalSectionFromRef` | ✓ VERIFIED | Both present and match plan's described byte-exact/null-discrimination behavior (lines 222-247). `congregationalSlideFieldsFromSlot` confirmed deleted (no remaining references). |
| `src/utils/slideGroupMaterializer.ts` | `deriveGroupEntries`, `sourceSignature`, `rebuildScriptureGroup` two-state machine | ✓ VERIFIED | All three functions present and implement the DETACH/CONVERT/RE-SPLIT/DESTROY/CLEARED-REFERENCE state machine exactly as documented (lines 81-136, 164-190, 804-834). |
| `src/utils/slideshowAssembler.ts` | `resolveEntryContent` + fallback resolve one section per slide | ✓ VERIFIED | Scripture case (lines 144-184) branches on `congregationalSectionFromRef`, emitting the singular `section` field. |
| `src/types/slide.ts` | `ScriptureSlide.section` singular field | ✓ VERIFIED | `section?: CongregationalSection` present (line 91); no `sections` array remains anywhere in the codebase. |
| `src/components/PresentationViewer.vue` | Speaker-above-passage block, stacked-loop deleted | ✓ VERIFIED | Single non-looping block at lines 118-139; `isCongregational` tests the singular field (line 494-498). |
| `src/components/slides/slideDisplay.ts` | Speaker-aware eyebrow/footer, `speakerDisplayName` | ✓ VERIFIED | `speakerDisplayName` (line 92), speaker-aware `slideContentLabel`/`slideFooterLabel`/`slideBodyText` (lines 100-166), `slideActionMenuItems` scripture case already offers duplicate+delete under `canMutate` (lines 346-350) — confirmed no menu change was needed. |
| `src/components/slides/EditSlideDrawer.vue` | Editable section text + speaker control, gated to section entries | ✓ VERIFIED | Editable `<textarea data-testid="drawer-slide-text-editable-scripture">` and speaker toggle (`drawer-speaker-toggle`/`drawer-speaker-readonly`), both gated on `congregationalSectionFromRef` at every decision point (template, write, seed, resync, input handler). |
| `src/utils/__tests__/congregationalDetachment.test.ts` | Composed multi-tick durability and migration contract | ✓ VERIFIED | 503-line file, 15 tests, all passing when run directly (`npx vitest run src/utils/__tests__/congregationalDetachment.test.ts`). Drives every slot mutation through `scriptureSlotAfterReferenceChange`, never by hand-editing a slot; every mutation case runs at least two further ticks. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `group.sourceSignature` | `sourceSignature(slot, inputs)` | `rebuildScriptureGroup`'s DETACH comparison | ✓ WIRED | Line 816: `group.sourceSignature !== undefined && group.sourceSignature === sourceSignature(slot, inputs)`. This is the sole detachment marker and it is read, not merely stored. |
| `rebuildOutcomes` computed | `slideGroupsStore.replaceGroupSlides` | `useSlideshowAssembly.ts`'s `applyRebuildOutcomes` | ✓ WIRED | `freshSignature: sourceSignature(slot, inputs)` computed synchronously (line 467) and passed through to the store write (line 500); `replaceGroupSlides` runs it through `stripUndefined` before `updateDoc`, so an `undefined` fresh signature leaves the stored field untouched rather than clearing it — confirmed by reading `src/stores/slideGroups.ts:304-331`. |
| `carryStoredDerivedEntries`'s scripture surplus suppression (HI-01) | DESTROY collapse to one entry | reused, not reimplemented | ✓ WIRED | `derivedIdentityKey` returns the constant `'scripture'` for every scripture ref state (line 308-311); `carriesSurplus = freshEntry.sourceRef.kind !== 'scripture'` (line 501) unconditionally suppresses surplus, confirmed unmodified per the plan's explicit instruction. |
| `scriptureSlotAfterReferenceChange` clearing `congregationalSections` | reaches `rebuildScriptureGroup`'s DESTROY branch | `hasSections` check + reference-changed check | ✓ WIRED | `scripture.ts:282-287` deletes `congregationalSections` when the reference changes; `rebuildScriptureGroup` then reads `sections.length === 0` and falls to the destroy/reference-state path. |
| `EditSlideDrawer.vue`'s debounced field write | `sourceRef.text` (not `.body`) | `congregationalSectionFromRef` guard | ✓ WIRED | Line 1153: `if (congregationalSectionFromRef(e.sourceRef)) return { ...e, sourceRef: { ...e.sourceRef, text: value } }` — the correct key, guarded by the single predicate. |
| `SlideCard.vue` / `SlideGrid.vue` | `slideDisplay.ts` helpers | direct import | ✓ WIRED | `SlideCard.vue:124` imports `slideContentLabel`/`slideBodyText`/`slideFooterLabel`; `SlideGrid.vue` imports `slideActionMenuItems`. Both mounted via `SlidesTab.vue`, mounted via `ServiceEditorView.vue:1290`. Reachable from the app, not merely exported. |
| `EditSlideDrawer.vue` | mounted surface | `SlidesTab.vue:39` | ✓ WIRED | `SlidesTab.vue` imports and renders `EditSlideDrawer`; `SlidesTab` is rendered by `ServiceEditorView.vue` — full reachability chain confirmed (the Phase 34 cautionary lesson this phase explicitly cites was checked, not assumed). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Composed multi-tick durability suite | `npx vitest run src/utils/__tests__/congregationalDetachment.test.ts` | 15/15 passed | ✓ PASS |
| Drawer edit/speaker/reference tests | `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts src/components/slides/__tests__/slideDisplay.test.ts src/components/__tests__/PresentationViewer.test.ts` | 302/302 passed | ✓ PASS |
| Type-check gate (correct form) | `npm run type-check` (`vue-tsc --build`) | zero errors | ✓ PASS |
| Full app suite (correct invocation) | `npx vitest run --dir src --exclude '**/rules.test.ts'` | 2490/2499 passed, 9 failed — all in `src/storage.rules.test.ts` and `src/views/__tests__/RosterView.test.ts` (documented pre-existing baseline) | ✓ PASS |
| Commit integrity | `git cat-file -t` on all 12 task commits across 38-01..38-04 | all present | ✓ PASS |
| Debt markers | `grep -n -E "TBD|FIXME|XXX"` on the 9 most-changed phase files | no matches | ✓ PASS |
| Out-of-scope commit exclusion | `git show --stat 136fd0a` | confirmed unrelated (autosave-message CSS move, an owner mid-run request) | ✓ PASS — correctly not attributed to phase 38 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R072 | 38-01, 38-02, 38-03, 38-04 | Congregational scripture reading produces N section slides, editable/deletable independently, detaches from the slot on conversion, destroys on scripture change | ✓ SATISFIED (mechanism) | All 5 roadmap success criteria verified above; requirement's own "Complete" note in REQUIREMENTS.md correctly caveats the owner-verification checkpoint as deferred, not passed. |

No orphaned requirements found — R072 is the only requirement mapped to Phase 38 and it appears in all four plans' frontmatter.

### Anti-Patterns Found

None. No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers, no empty-implementation stubs, no hardcoded-empty-data patterns in any of the phase's touched files. The comment-reconciliation task (38-04 Task 2) found and fixed four stale doc claims in `slideGroupMaterializer.ts` — confirmed by reading, all four are now correctly scoped to state which of the two states (Reference/Congregational) they govern.

### Human Verification Required

The owner's blocking checkpoint (38-04 Task 3) was deferred under STATE.md's STANDING AUTONOMY GRANT
("owner away for the weekend") and disclosed — not self-approved — as `PENDING-VERIFICATION.md` items
38.1–38.7. Per that grant's own explicit terms ("Never record a deferred check as passed... A phase
whose verification was deferred says so in its VERIFICATION.md") and this verification's instructions,
these items are reported here as outstanding, not passed, regardless of how strong the underlying
automated/traced evidence is.

1. **38.1 — Split a scripture item into congregational sections and confirm one card per section.**
   Expected: Slides tab shows N cards, each naming its speaker. Why human: requires a live Firestore
   service, the ESV fetch + Claude split flow, and visual confirmation.

2. **38.2 — Edit a section's words in isolation.**
   Expected: only the edited card changes. Why human: real drawer interaction against a live document
   has not been driven by a human (the write path itself is unit-proven).

3. **38.3 — Flip a section's speaker in isolation.**
   Expected: only the toggled card changes. Why human: same as above.

4. **38.4 (starred, the hardest criterion) — Delete one section and confirm it survives a page reload.**
   Expected: the deleted card stays gone after reload; siblings keep order and words. Why human: this
   is roadmap criterion 4, historically the one that has failed. This verification traced the DETACH
   mechanism end to end (rebuild branch → composable's signature write → store's `stripUndefined`
   write path) and ran the 15-case composed durability suite, which passed — the mechanism is real and
   correctly wired in-process. But no unit test substitutes for an actual Firestore round-trip through
   a real page reload, which is exactly why this remains a human step.

5. **38.5 — Present the split reading and confirm the projected layout.**
   Expected: reference / speaker / words, one section per slide. Why human: visual/projection-distance
   legibility judgment; DOM structure is proven by 78 passing component tests, but not how it reads on
   a real screen.

6. **38.6 — Confirm a scripture change destroys the split (intended data loss, D1).**
   Expected: changing the passage collapses the Slides tab to one reference-only card. Why human: the
   DESTROY paths are unit-proven but not yet exercised against a real service document.

7. **38.7 — An existing pre-Phase-38 congregational reading upgrades itself with no action.**
   Expected: a real pre-existing service shows N cards after this phase's deploy, with no manual step.
   Why human: the migration case is proven against a synthetic fixture; only a real document proves the
   deploy didn't miss a shape.

### Gaps Summary

No gaps found. Every roadmap success criterion has strong, traced evidence: the pure mechanism (types,
predicates, derivation, signature, rebuild state machine) is unit- and composed-tested; the projected
layout and the editing/deletion surface are component-tested and confirmed mounted/reachable from the
app (the Phase 34 "118 passing tests, no reachable feature" failure mode was explicitly checked against
and not repeated); both binding gates (`npm run type-check` via `vue-tsc --build`, and
`npx vitest run --dir src --exclude '**/rules.test.ts'`) pass with no regressions outside the documented
2-file baseline. The only reason this report is not `passed` is the owner's still-outstanding,
properly-disclosed browser/Firestore verification checkpoint (items 38.1–38.7) — which per the standing
autonomy grant's own terms must never be recorded as passed on the executor's behalf.

---
*Verified: 2026-08-05*
*Verifier: Claude (gsd-verifier)*
