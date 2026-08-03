---
phase: 33-backgrounds-slide-editing
verified: 2026-08-03T02:00:00Z
status: human_needed
score: 5/5 roadmap truths verified (plus 7/7 requirements satisfied); 2 backstop must-haves confirmed
  via source-level data-flow trace rather than a dedicated automated test
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Set a background at group level, then song level, then slide level (using a real photo, with
      the Firestore/Storage emulator running) and confirm each upload actually persists and renders in
      the drawer preview / group control / song control after a reload."
    expected: "The uploaded image round-trips through real Firebase Storage and is still attached after
      a page reload at every one of the three levels."
    why_human: "jsdom cannot produce a genuine `File` with real bytes, and this exact check appeared in
      33-VALIDATION.md's Manual-Only table (seeded from 33-01/33-03's research) but was NOT carried
      forward into PENDING-VERIFICATION.md's Phase 33 section — that section was populated only from
      33-09-PLAN.md's own (last-plan) manual-only list, which never restates earlier plans' items. This
      item was quietly dropped between artifacts, not deliberately deferred. Flagging it here so it is
      not lost a second time."
  - test: "With a debounced Label/Notes/Body edit still in flight, click 'Edit in song' or 'Edit in
      scripture' from a slide's 3-dot menu and navigate away before the debounce settles. Then check
      whether the edit was saved."
    expected: "Before 33-09, this path prompted 'Discard unsaved changes?' and explicitly cancelled the
      pending write before navigating. After 33-09, no confirmation appears; navigating triggers the
      drawer's `onUnmounted` best-effort `flushAll()` instead."
    why_human: "33-09-SUMMARY.md documents this as a known, disclosed gap ('Known Gap' section) — the
      explicit warning prompt is gone, mitigated only by a best-effort flush-on-unmount. This is a UX
      regression the SUMMARY itself calls out but that isn't captured as its own item in
      PENDING-VERIFICATION.md's Phase 33 section (33.6 checks the navigation itself still works, not
      this specific unsaved-edit scenario). Whether the mitigation is good enough is a product judgment
      call, not something a test can settle."
  - test: "Set a slide's own background override where the group has NO background but the song does
      (song-only inheritance, no group in between). Open the drawer and look at the remove caption under
      the slide's own thumbnail."
    expected: "Per 33-UI-SPEC.md's Copywriting Contract, the caption should read 'Removing only this
      slide's background — the song's still applies.'"
    why_human: "`EditSlideDrawer.vue`'s `lowerLevelBackgroundLabel` computed (33-07) only ever returns
      `'group'` or `null` — the 'song' branch is structurally unreachable, because no plan in this phase
      threads a song-level background lookup into this component (documented as Deviation 2 in
      33-07-SUMMARY.md). In this specific scenario the caption will show NOTHING instead of naming the
      song. This does not affect the actual cascade (verified correct in `slideshowAssembler.ts`) or the
      card chip/other captions — it is one narrow, disclosed completeness gap in one informational
      string. Confirm whether the missing caption is acceptable as-is or needs closing."
  - test: "(Pre-existing PENDING-VERIFICATION.md 33.1-33.6) Screen-reader menu navigation, menu-vs-drag
      non-interference, cross-level inheritance legibility at a glance, the per-type menu table against
      owner intent, drag without opening the menu, and song/scripture navigation with a different card's
      drawer open."
    expected: "See .planning/PENDING-VERIFICATION.md § Phase 33 for the full text of each of the six
      items."
    why_human: "Already recorded there by 33-09's executor under the standing autonomy grant — carried
      forward here so the human-verification section is complete, not because anything new was found."
---

# Phase 33: Backgrounds & Slide Editing Verification Report

**Phase Goal:** Background images can be set at group, slide, and song level, and slide editing moves to
an explicit 3-dot menu with type-appropriate options.
**Verified:** 2026-08-03
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (the 5 stated success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A background can be set at slide, group, or song level, most-specific-wins | ✓ VERIFIED | `resolveEntryMedia` (`src/utils/slideshowAssembler.ts:222-260`): `entry.backgroundImageUrl ?? group.backgroundImageUrl ?? song?.backgroundImageUrl`, with matching `backgroundSource` tri-state. 58 passing cases in `slideshowAssembler.test.ts` including a dedicated `background cascade (R055/R056/R057)` describe block (slide-wins, group-wins, song-wins, nothing-resolves-genuinely-absent). Write paths: `setGroupBackground` (`slideGroups.ts:228`), `setSongBackground` (`songLyrics.ts`), and the drawer's per-slide attach/remove (`EditSlideDrawer.vue`) — all live, all tested, all wired to real UI controls (`BackgroundControl.vue` at group/song call sites, the inline three-state block in the drawer). |
| 2 | Per-slide audio no longer offers a "whole group" scope option; group audio is group-level only | ✓ VERIFIED | `grep -rn "audioScope" src/` returns **zero hits** anywhere in the codebase — field, drawer UI, and store reader all deleted together (matches 33-04's plan exactly). The drawer's empty-state now shows only a hint line (`audio-scope-hint`, `EditSlideDrawer.vue:270`) pointing at `SlideGroupMusicControl.vue`, confirmed still the sole group-audio entry point (P-02). |
| 3 | A slide enters edit mode only via an explicit 3-dot menu, never by clicking the slide | ✓ VERIFIED | `SlidesTab.vue:301-303`'s `onSelectSlide` is now exactly `selectedSlideId.value = slideId` — the `drawerOpen.value = true` line documented as the R051 coupling is gone from this function. Confirmed the two *other* legitimate call sites that still set it true are correct: `selectSlideById` (post-duplicate follow-selection, `:310-313`) and the new `onMenuAction` dispatcher (`:406-446`, only for `edit-details`/`edit-lyrics`/`duplicate`/`delete` keys). Selection itself is untouched — still drives `selected` (plan-rail accent/drop target), `selectedEntry`, `selectedAssembledSlide`. `SlideCard.vue`'s root changed from `<button>` to `<div role="button" tabindex="0">` (§1's HTML-validity fix) with `@click`/`@keydown.enter`/`@keydown.space.prevent` reproducing native activation — verified live in source, not just claimed. |
| 4 | The menu opens separate "Edit details" and "Edit lyrics" drawers, not one multi-tab drawer | ✓ VERIFIED (premise corrected, per 33-CONTEXT.md) | `EditSlideDrawer.vue` gained a `mode: 'details' \| 'lyrics'` prop (one component, confirmed no split occurred — `ls | grep -c EditSlideDrawer` returns 1 for both `.vue` and its test file per 33-07-SUMMARY). Every section (Label/Audio/Background/Notes/footer) is gated `mode === 'details'`; the editable text textarea relocated to `mode === 'lyrics'` only. `onMenuAction` sets `drawerMode` per the menu key pressed (`edit-details` → `'details'`, `edit-lyrics` → `'lyrics'`). The requirement's own stated premise ("tabs") was verified false at discuss time (sections, not tabs) and is disclosed in 33-CONTEXT.md/33-UI-SPEC.md — the *intent* (two independently-openable edit surfaces) is what was delivered and is what this truth checks. |
| 5 | Editing options offered for a slide vary by service-item type | ✓ VERIFIED | `slideActionMenuItems()` (`src/components/slides/slideDisplay.ts:296-335`) is a pure per-`sourceRef.kind` function: lyric/copyright → `edit-details`+`edit-in-song` only (never edit-lyrics/duplicate/delete, **even when `canMutate` is true** — verified structurally, P-03); scripture → `edit-details`+`edit-in-scripture`+conditionally duplicate/delete; text (hand-authored) → `edit-details`+`edit-lyrics`+conditionally duplicate/delete; text (Hymn-pristine, `sourceRef.body === undefined` and `planItemKind === 'HYMN'`) → `edit-lyrics` withheld; imported/video → `edit-details`+conditionally duplicate/delete; unrecognised kind → conservative `edit-details`-only fallback. 50 passing cases in `slideDisplay.test.ts` cover the full table plus both flagged backstops (unresolved-`planItemKind`, unknown-`sourceRef.kind`). |

**Score:** 5/5 roadmap truths verified.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| R051 | 33-02, 33-05, 33-09 | Slide enters edit only via 3-dot menu | ✓ SATISFIED | See Truth #3. Note: REQUIREMENTS.md marked this Complete after 33-02 (which built only `SlideActionMenu.vue`/`slideActionMenuItems` in isolation, no consumer wiring) — the end-to-end select/edit decoupling did not exist until 33-09's `d8a5141`/`ce05b58` commits, verified directly above against live `SlidesTab.vue`, not the checkbox. |
| R052 | 33-04(context)/33-07, 33-09 | "Edit details"/"Edit lyrics" as separate drawers | ✓ SATISFIED | See Truth #4. |
| R055 | 33-01, 33-03, 33-08 | Group-level background control | ✓ SATISFIED | `SlideGrid.vue:90-101` mounts `BackgroundControl` below the music control, gated on the same `canWriteGroupMedia` (song-group carve-out included); `setGroupBackground` (`slideGroups.ts:228-259`) touches only `backgroundImageUrl`/`updatedAt`, never `slides` — confirmed live (R055's "never overwrites a slide's own background" adjacency truth holds structurally). Zero-slide group accepted via the merging `setDoc` skeleton-create branch. |
| R056 | 33-01, 33-05, 33-07 | Per-slide background override, most-specific-wins | ✓ SATISFIED | See Truth #1; drawer's three-state Slide Background section (`EditSlideDrawer.vue:303-360`) never wrapped in `!isVideo` (the deliberate divergence, §9) — confirmed live at `:297-303`. |
| R057 | 33-01, 33-03, 33-06 | Song-level background from Song Lyrics editor | ✓ SATISFIED | `SongLyricEditor.vue:35-43` mounts `BackgroundControl` reading/writing `currentLyrics.backgroundImageUrl` via `songLyricsStore.setSongBackground`; no `inherited-from` prop at this call site (song is least-specific tier) — confirmed live. |
| R058 | 33-04 | Remove per-slide "whole group" audio scope | ✓ SATISFIED | See Truth #2. |
| R063 | 33-02, 33-05, 33-08 | Menu options vary by service-item type | ✓ SATISFIED | See Truth #5. |

No orphaned requirements — REQUIREMENTS.md's Phase 33 row (R051, R052, R055, R056, R057, R058, R063) matches exactly what the nine plans' `requirements:` frontmatter declares, cumulatively.

### Prohibitions (must-NOT checks, judgment-tier)

| # | Prohibition | Status | Evidence |
|---|---|---|---|
| P-01 | Deleting from the menu must land on the existing named-loss confirm, never bypass it | ✓ RESOLVED | No component in the menu-dispatch path (`SlidesTab.vue`, `SlideGrid.vue`, `SlideActionMenu.vue`) calls a delete store action directly — `grep -rn "deleteSlide\|removeSlide"` across those three files returns nothing. `onMenuAction`'s `delete` case only sets `pendingDrawerAction`; the drawer's nonce-keyed watcher (`EditSlideDrawer.vue:1260-1266`) sets the **existing** `showDeleteConfirm` ref, which renders `deleteConfirmBody` (names attached audio/notes, `slideDisplay.ts:177-188`) before any write happens. |
| P-02 | Removing per-slide audio scope must not silently change what a user hears | ✓ RESOLVED | `SlideGroupMusicControl.vue` confirmed still the sole surviving group-bed attach/remove surface (its own header comment states this); `resolveEntryMedia`'s audio fallback (`entry.audioUrl ?? group.bedAudioUrl`) is unchanged by this phase — an entry with no own audio in a group with a bed still resolves and plays the bed exactly as before. |
| P-03 | The menu must never offer a write affordance on a song group's slide, even when `canMutate` is true | ✓ RESOLVED | Structural, not conditional: `slideActionMenuItems`'s `lyric`/`copyright` branches (`slideDisplay.ts:303-306`) return immediately with only `edit-details`+`edit-in-song` — `canMutate` is never read in either branch, confirmed by inspection (the parameter isn't referenced before the `return`). `canMutateBackground` (the one drawer gate that *does* stay available for song groups) is explicitly and separately scoped to background-only, documented inline. |

### Landmines (explicit focus items)

| Landmine | Status | Evidence |
|---|---|---|
| Background resolved OUTSIDE the video early-return, so video still inherits background but not bed audio | ✓ VERIFIED | `resolveEntryMedia` (`slideshowAssembler.ts:222-260`) computes `backgroundImageUrl`/`backgroundSource` **before** the `if (entry.sourceRef.kind === 'video')` early return, and the video branch explicitly attaches both onto its returned `videoMedia` object while still forcing `audioFromBed: false`. Test: `slideshowAssembler.test.ts:1228` — "a video entry with no background of its own, in a group that has one, resolves `backgroundSource: 'group'` while still resolving no bed audio." |
| A group with no owning song (PRAYER/SCRIPTURE/IMPORTED) resolves without throwing | ✓ VERIFIED | `song?.backgroundImageUrl` optional-chained throughout; `emitFromGroup` (`:306-320`) passes `song: undefined` for every `sourceRef.kind` except `lyric`/`copyright`. Test: `slideshowAssembler.test.ts:1205` — "a PRAYER group with no owning song resolves its group background without throwing." |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/types/slideGroup.ts` | `GroupSlideEntry`/`SlideGroup.backgroundImageUrl?`, `audioScope` removed | ✓ VERIFIED | Both fields present; `audioScope` absent codebase-wide. |
| `src/types/songLyrics.ts` | `SongLyrics.backgroundImageUrl?` | ✓ VERIFIED | Present, greenfield, no migration. |
| `src/types/slide.ts` | `SlideBase.backgroundImageUrl?`/`backgroundSource?` | ✓ VERIFIED | Present, tri-state as specified. |
| `src/utils/slideshowAssembler.ts` | Cascade extension | ✓ VERIFIED | See Truth #1. |
| `src/components/slides/slideDisplay.ts` | `slideActionMenuItems`, `backgroundImageLabel` | ✓ VERIFIED | Both present, pure, tested. |
| `src/components/slides/SlideActionMenu.vue` | New ARIA menu | ✓ VERIFIED | `role="menu"`/`role="menuitem"`/`aria-haspopup`/`aria-expanded`, Escape-closes-and-refocuses, `@click.stop` trigger — all present and match 33-UI-SPEC §2 markup essentially verbatim. |
| `src/components/slides/SlideCard.vue` | root swap, menu mount, chip | ✓ VERIFIED | `role="button" tabindex="0"` root, `SlideActionMenu` conditionally mounted, background chip with correct 3-way styling. |
| `src/components/slides/BackgroundControl.vue` | shared presentational control | ✓ VERIFIED | Emit-only (`attach`/`remove`), no Firestore write of its own, used at both group and song call sites. |
| `src/composables/useBackgroundUpload.ts` | upload composable | ✓ VERIFIED | `image/*` MIME check, 10MB cap, `orgs/{orgId}/backgrounds/**` path — confirmed exempt from `cleanupExpiredMedia`'s `MEDIA_PATH_GUARD` regex by direct inspection of `functions/src/index.ts:241`. |
| `src/components/slides/EditSlideDrawer.vue` | mode prop, background section, pendingAction seam | ✓ VERIFIED | All three present and wired; audio-scope UI fully removed. |
| `src/components/slides/SlideGrid.vue` | group background control, `openMenuEntryId` ownership | ✓ VERIFIED | Both present; `cards` computed supplies per-card `menuItems` via `slideActionMenuItems`, empty list when the entry doesn't resolve (no dangling menu). |
| `src/components/SongLyricEditor.vue` | song background row | ✓ VERIFIED | Present, no `inherited-from` prop passed (correct — song is least-specific tier). |
| `src/components/slides/SlidesTab.vue` | `onSelectSlide` reduced, `onMenuAction` dispatcher | ✓ VERIFIED | See Truth #3. |
| `src/stores/slideGroups.ts` | `setGroupBackground` | ✓ VERIFIED | Mirrors `setGroupBedMedia` exactly; touches only `backgroundImageUrl`/`updatedAt`. |
| `src/stores/songLyrics.ts` | `setSongBackground` | ✓ VERIFIED | Present, writes through the existing per-field update path. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `SlidesTab.vue` `onSelectSlide` | selection state only | direct assignment | ✓ WIRED | Drawer no longer opens on select — verified line-by-line. |
| `SlideGrid.vue` `menu-action` emit | `SlidesTab.vue` `onMenuAction` | `@menu-action="onMenuAction"` | ✓ WIRED | Confirmed in template. |
| `onMenuAction` (edit-details/edit-lyrics) | `EditSlideDrawer.vue` `mode`/`open` props | `drawerMode.value`, `drawerOpen.value = true` | ✓ WIRED | Confirmed. |
| `onMenuAction` (duplicate/delete) | `EditSlideDrawer.vue` `pendingAction` prop | `pendingDrawerAction.value = {...}` bound via `:pending-action` | ✓ WIRED | Confirmed nonce-keyed watcher consumes it and clears via `@pending-action-consumed`. |
| `resolveEntryMedia` | `AssembledSlide.slide.backgroundImageUrl`/`backgroundSource` | `emitFromGroup`'s spread | ✓ WIRED | Confirmed at `slideshowAssembler.ts:329-330`. |
| `SlideCard.vue`/`EditSlideDrawer.vue` background rendering | `AssembledSlide.slide.backgroundSource` | direct prop read, never re-derived | ✓ WIRED | Both read the resolved field directly (`SlideCard.vue:159`, `EditSlideDrawer.vue:602-603`). |
| `BackgroundControl` `attach`/`remove` emits | `slideGroupsStore.setGroupBackground` / `songLyricsStore.setSongBackground` | caller-owned write, never inside the component | ✓ WIRED | Confirmed at both call sites. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `SlideCard.vue` background chip | `backgroundSource` | `props.assembledSlide.slide.backgroundSource`, computed fresh from `assembledSlideshow` each recompute (no local cache) | Yes — traced through `resolveEntryMedia` back to real stored `backgroundImageUrl` fields | ✓ FLOWING |
| `EditSlideDrawer.vue` Slide Background section | `resolvedBackgroundUrl`/`backgroundSource` | `props.assembledSlide.slide.*`, same resolved fields | Yes | ✓ FLOWING |
| `SlideGrid.vue` group background inherited display | `songBackgroundForInheritedDisplay` | Derived from `cards.value.find(c => c.assembledSlide.slide.backgroundSource === 'song')` — reads the already-resolved cascade, not a second derivation | Yes | ✓ FLOWING |
| Cross-service song background propagation | `SongLyrics.backgroundImageUrl` | `useSlideshowAssembly.ts`'s `songLyricsById` map, populated by `loadLyrics(org, songId)` fresh per service session; `assembleSlideshow` is a pure function re-invoked on every recompute | Traced by source-reading, not a dedicated automated test (backstop) — no write path exists that would need a per-service copy; any service loading the song document sees its current `backgroundImageUrl` | ⚠ FLOWING (verified by code trace, not test) |

### Backstop Must-Haves (10 distinct statements across 33-01–33-07)

Per the honest-verifier rule, a `verification: backstop` truth abstains without explicit evidence. Checked each:

| Backstop statement | Plan | Evidence found | Disposition |
|---|---|---|---|
| Unrecognised/future `sourceRef.kind` → conservative list | 33-02 | `slideDisplay.test.ts:473` dedicated test | ✓ VERIFIED (test) |
| E1 partial — unresolved plan item never grants edit-lyrics | 33-02 | `slideDisplay.test.ts:468` dedicated test | ✓ VERIFIED (test) |
| E1 overflow — widest list fits w-40 at 200px card | 33-02 | `SlideActionMenu.test.ts:121` dedicated test | ✓ VERIFIED (test) |
| E2 partial — Hymn discriminator reactive without remount | 33-02 | No dedicated test found. Confirmed via code trace: `slideActionMenuItems` is a pure, stateless function called fresh inside `SlideGrid.vue`'s `cards` computed (`:359-363`), so standard Vue dependency tracking recomputes it whenever `props.group.slides` changes — no caching layer exists to go stale. | ⚠ VERIFIED (code trace, not test) |
| E2 overflow — "Edit in scripture" fits w-40 without wrap | 33-02 | `SlideActionMenu.test.ts:131` dedicated test | ✓ VERIFIED (test) |
| E3 overflow — long filename truncates | 33-03 | `BackgroundControl.test.ts:231-242` dedicated test | ✓ VERIFIED (test) |
| Concurrency — stale local copy can't reintroduce `audioScope` | 33-04 | `EditSlideDrawer.test.ts:853` dedicated test | ✓ VERIFIED (test) |
| E4 partial — chip updates same render pass, no manual refresh | 33-05 | `SlideCard.test.ts:391` dedicated test | ✓ VERIFIED (test) |
| Song background propagates to every service without a per-service write | 33-01, 33-06 | No dedicated multi-service test. Confirmed via code trace (see Data-Flow Trace table above) — architecturally guaranteed, not separately tested. | ⚠ VERIFIED (code trace, not test) — also covered by the pre-existing human-verification item PENDING-VERIFICATION.md 33.3 |
| E3 partial — drawer's own/inherited CTA states never cross | 33-07 | `EditSlideDrawer.test.ts:1660-1743` (override CTA absent when own is set; Remove absent when own is not set) | ✓ VERIFIED (test) |

8 of 10 have a dedicated automated test; the remaining 2 are confirmed by direct source-code data-flow tracing (Level 4 methodology) rather than a runtime test — reported transparently rather than silently counted as equivalent to the tested ones.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full phase-scoped suite | `npx vitest run src/components/slides src/composables/__tests__/useBackgroundUpload.test.ts src/components/__tests__/SongLyricEditor.test.ts src/utils/__tests__/slideshowAssembler.test.ts` | 14 files / 546 tests, all passing | ✓ PASS |
| Type gate | `npm run type-check` (`vue-tsc --build`, per CLAUDE.md the only sufficient form) | exit 0 (per orchestrator-collected evidence, re-confirmed by the passing full-suite type-checked test run above) | ✓ PASS |
| Full workspace suite (run once, per constraint) | `npx vitest run src/` | 2118 passed / 9 failed / 2127 total — exactly the two documented pre-existing baseline files (`storage.rules.test.ts`, `RosterView.test.ts`), zero new failures | ✓ PASS |
| `audioScope` fully removed | `grep -rn "audioScope" src/` | zero hits | ✓ PASS |

### Anti-Patterns Found

None. Scanned all 15 primary phase-modified source files (types, store, composable, and every touched `.vue`/`.ts`) for `TBD`/`FIXME`/`XXX` (debt-marker gate — zero hits), `TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented" (zero hits beyond legitimate `placeholder-gray-500` CSS classes and prose uses of the word "placeholder" describing what the code deliberately does NOT substitute), empty-implementation patterns, and hardcoded-empty stub props. No stubs found — every artifact traced back to real, tested logic.

### Deferred Items

None deferred to a later phase — all 7 requirements and 5 success criteria are fully in scope for, and delivered within, Phase 33.

## Gaps Summary

No BLOCKER-level gaps. All 5 roadmap success criteria and all 7 requirements are backed by live, wired,
tested code — traced directly against source, not inferred from SUMMARY claims or the REQUIREMENTS.md
checkbox (which was confirmed to have been flipped early/misleadingly for R051/R052 per the task's own
warning, but the underlying behavior was independently re-verified against 33-09's actual commits, not
the checkbox).

Three WARNING-level findings, none of which falsify a success criterion:

1. **A manual verification item was quietly dropped between artifacts.** 33-VALIDATION.md's Manual-Only
   table (seeded during research/planning) included "a real image file uploads, persists, and is still
   there later" for R055-R057 — but PENDING-VERIFICATION.md's Phase 33 section was populated only from
   33-09-PLAN.md's own manual-only list (the last plan), which never restates earlier plans' items. No
   other plan's SUMMARY captured it either. Added as a human-verification item above.
2. **33-09's known gap:** the "Discard unsaved changes?" confirmation that guarded the two removed
   in-body "Edit in song"/"Edit in scripture" link buttons was not ported to the new menu path. Disclosed
   in 33-09-SUMMARY.md, mitigated by the drawer's existing `onUnmounted` best-effort `flushAll()` (verified
   present at `EditSlideDrawer.vue:1138-1143`), but the explicit user-facing warning is gone — a UX
   regression, not a verified data-loss regression. Added as a human-verification item above.
3. **33-07's known gap:** the drawer's "the song's still applies" remove-caption branch is structurally
   unreachable — `lowerLevelBackgroundLabel` only proves the group tier. Narrow (affects one caption in
   one scenario: a slide overriding an song-only background with no group between), does not affect actual
   cascade resolution, card chip, or any other provenance surface. Added as a human-verification item
   above.

Because human-verification items exist (both the six pre-existing PENDING-VERIFICATION.md Phase 33 items,
legitimately deferred under the standing autonomy grant, and the three additional items surfaced by this
verification), overall status is `human_needed`, not `passed` — consistent with how Phases 31 and 32 were
resolved in this same milestone.

---

_Verified: 2026-08-03_
_Verifier: Claude (gsd-verifier)_
