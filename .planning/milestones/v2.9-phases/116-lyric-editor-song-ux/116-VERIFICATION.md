---
phase: 116-lyric-editor-song-ux
verified: 2026-09-04T13:44:40Z
status: human_needed
score: 5/5 must-haves verified (code/test level)
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "From the read-only slide viewer, open a SONG group and click the 'Edit song lyrics for {song}' badge."
    expected: "A new browser tab opens, landing on that song's Lyrics tab; the originating slide viewer tab stays exactly where it was (not navigated away)."
    why_human: "window.open with a resolved router href is code/test-verified (window.open called with the correct href/target/noopener), but that the browser actually opens a second tab, that tab renders the Lyrics tab, and the original tab's scroll/selection state is undisturbed is real multi-tab browser behavior no vitest/jsdom check can observe."
  - test: "Open the song editor (SongSlideOver) for a song with a CCLI number and click the 'SongSelect' link in the header."
    expected: "A new tab opens to https://songselect.ccli.com/songs/{ccliNumber} — the real external CCLI page for that song."
    why_human: "The href/target/rel are code-verified; that clicking it in a real browser reaches the correct live external page (not a 404, redirect, or CCLI login wall) can only be confirmed by a human following the link."
  - test: "In the lyric editor, click 'Add credits' on a song with no credits, fill in title/authors/CCLI number/copyright lines/license number, click Save, then reopen the song and confirm the read-only display shows the entered values; repeat for editing existing credits (fix a wrong CCLI number) and for clearing a field to blank."
    expected: "Entered credits persist and render correctly-formatted in the read-only display; the lyric sections/slide order are visibly unchanged after the save; no version-history growth (History is hidden) and no visible error toast on a normal save."
    why_human: "The save-call shape (updateCurrentLyrics, correct payload, no re-parse) is unit-tested; that the round-trip actually renders as expected in a real running app against real Firestore, and that the visual layout of the multi-line authors/copyright-lines textareas reads sensibly, needs a human looking at the screen."
---

# Phase 116: Lyric Editor & Song UX Verification Report

**Phase Goal:** A user can open, navigate, and correct a song's lyrics and credits without confusion, from both the read-only lyric viewer and the editor itself.
**Verified:** 2026-09-04T13:44:40Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The read-only slide-viewer badge reads "Edit song lyrics for {song name}" (fallback "Edit song lyrics") and opens the lyric editor in a new browser tab, sourced only from the slot's own songId/songTitle (R333) | VERIFIED | `SlideGrid.vue:531-534` (`songEditLabel` computed reads `props.selectedSlot.songTitle` only when `kind==='SONG'`); `SlideGrid.vue:43-55` (button/span bound to `songEditLabel`, `data-testid="slide-grid-song-readonly-badge"`); `SlidesTab.vue:342-346` (`onEditInSongBadge` calls `router.resolve(buildSongEditLink(songId,'lyrics')).href` then `window.open(href,'_blank','noopener')`, no `router.push`); `onMenuAction` (line 348) confirmed untouched (still `router.push`). Tests pass: `SlideGrid.test.ts`, `SlidesTab.test.ts` (incl. new IN-01 guard tests at lines 1015-1099 proving the badge path's confirm-guard blocks/allows `window.open`). |
| 2 | The lyric editor shows a SongSelect link next to the song name in the title bar, gated on a persisted CCLI number (R334) | VERIFIED | `SongSlideOver.vue:51-58` — anchor `href="https://songselect.ccli.com/songs/${props.song.ccliNumber}"`, `target="_blank"`, `rel="noopener"`, `v-if="props.song?.ccliNumber"`, `data-testid="song-songselect-link"`; matches `SongTable.vue:234-240`'s exact pre-existing pattern verbatim. `SongSlideOver.test.ts` (27 tests) passes, including presence/absence/create-mode/cross-tab persistence assertions per the SUMMARY's D2 coverage. |
| 3 | The "Cancel" button is relabeled "Close" (guard behavior unchanged); other Cancel buttons (delete-confirm) untouched (R335) | VERIFIED | `SongSlideOver.vue:61-67` — button text is `Close`, `@click="onCancel"` unchanged; icon-only X (line 79-88) already said "Close" and is untouched; delete-confirm "Cancel" at line 299 is untouched. |
| 4 | A user can manually edit a song's Credits/CCLI/copyright text (add, correct, remove), independent of pasting, reachable even from empty credits, without re-parsing lyric sections (R336) | VERIFIED | `SongLyricEditor.vue:910-977` — `hasCredits` computed (5-field OR), `copyright-edit-toggle` gated only on `!editingCredits` (reachable regardless of `hasCredits`), `copyright-edit-form` with all 5 field testids, `saveCreditsEdit()` calls `songLyricsStore.updateCurrentLyrics(orgId, songId, cur.id, { copyright: edited })` — confirmed this sends ONLY the `copyright` key (no `sections`/`performanceOrder`), so lyric sections are structurally impossible to touch (stronger than "passed through unchanged" — this was the WR-02 review fix, verified present in the code, not just claimed). `updateCurrentLyrics` confirmed to exist in `src/stores/songLyrics.ts:90-101` as an in-place `updateDoc` (not a new-version `addDoc`). `saveCreditsEdit` also wraps the call in try/catch with a `saveStatus.set(...)` error surface (WR-01 fix), confirmed present at lines 963-976. `SongLyricEditor.test.ts` (90 tests) passes. |
| 5 | The read-only copyright display shows whenever ANY credit field is non-empty (not only ccliSongNumber), hidden when all blank (R336) | VERIFIED | `SongLyricEditor.vue:330` — gate is `v-if="hasCredits && !editingCredits"`; `hasCredits` (line 914-918) is true if any of title/authors.length/ccliSongNumber/copyrightLines.length/ccliLicenseNumber is truthy — widened from the old ccliSongNumber-only gate. Covered by a dedicated test per the SUMMARY (copyrightLines-only case). |
| 6 | The History tab/toggle and history panel are hidden from the UI; LyricVersionHistory.vue and the store's version state/handlers remain intact in code (R337) | VERIFIED | `SongLyricEditor.vue:21-28` (`history-toggle-btn` gated `v-if="HISTORY_ENABLED"`, `HISTORY_ENABLED = false` at line 507) and `:81-100` (`history-panel` gated `v-if="HISTORY_ENABLED && showHistory"`); `LyricVersionHistory` import, `showHistory` ref, `onSaveVersion`/`onRevertVersion` handlers, and `songLyricsStore`'s `lyricVersions`/`revertToVersion`/`saveLyrics` all confirmed still present and referenced (template gate keeps them load-bearing, per the review's confirmed grep). `LyricVersionHistory.test.ts` (8 tests, untouched) still passes. |

**Score:** 6/6 truths verified at the code/test level (R333-R337 map to 6 truths across 2 plans; R336 spans truths 4-5). 0 present-but-behavior-unverified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/slides/SlideGrid.vue` | badge relabel + `songEditLabel` computed | VERIFIED | Present, substantive, wired to click handler and props.selectedSlot |
| `src/components/slides/SlidesTab.vue` | `onEditInSongBadge` new-tab open | VERIFIED | Present, substantive, wired via `@edit-in-song="onEditInSongBadge"` |
| `src/components/SongSlideOver.vue` | SongSelect link + Close relabel | VERIFIED | Present, substantive, wired |
| `src/components/SongLyricEditor.vue` | inline credits editor + History hide | VERIFIED | Present, substantive, wired to `songLyricsStore.updateCurrentLyrics` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `SlideGrid.vue` `edit-in-song` emit | `SlidesTab.vue` `onEditInSongBadge` | `@edit-in-song="onEditInSongBadge"` | WIRED | Confirmed in template at `SlidesTab.vue:33` |
| `onEditInSongBadge` | `window.open` | `router.resolve(buildSongEditLink(songId,'lyrics')).href` | WIRED | Confirmed at `SlidesTab.vue:344-345`; tested with router-resolve stub + `window.open` spy |
| `SongSlideOver.vue` header anchor | `songselect.ccli.com` | static href template on `props.song.ccliNumber` | WIRED | Confirmed at `SongSlideOver.vue:53`, matches `SongTable.vue:235` verbatim |
| `saveCreditsEdit` | Firestore | `songLyricsStore.updateCurrentLyrics(orgId, songId, cur.id, { copyright: edited })` | WIRED | Confirmed at `SongLyricEditor.vue:964-966`; `updateCurrentLyrics` confirmed to exist and do an in-place `updateDoc` in `src/stores/songLyrics.ts:90-101` (not `saveLyrics`/`addDoc` — the plan's originally-specified shape was superseded by the WR-02 review fix, and the fix is genuinely in the code, not just claimed in the fix report) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Type gate | `npm run type-check` (vue-tsc --build, includes test files) | Clean, no errors | PASS |
| Phase 116 test files | `npx vitest run` on 5 affected test files | 5 files / 327 tests passed | PASS |
| Full app suite regression | `npx vitest run` (bare, full run — executed once) | 185/186 files, 5054/5080 tests passed; sole failing file `src/storage.rules.test.ts` (26 tests, Storage-emulator `firestore.exists()` limitation) | PASS — matches CLAUDE.md's documented single-file baseline exactly; no new regressions from Phase 116 |
| No debt markers | grep TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER across all 4 modified components | No matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| R333 | 116-01 | Read-only badge relabel + new-tab open | SATISFIED | SlideGrid.vue/SlidesTab.vue, tests pass |
| R334 | 116-01 | SongSelect link in editor header | SATISFIED | SongSlideOver.vue, tests pass |
| R335 | 116-01 | "Cancel" -> "Close" relabel | SATISFIED | SongSlideOver.vue, tests pass |
| R336 | 116-02 | Manual credits editing | SATISFIED | SongLyricEditor.vue, tests pass |
| R337 | 116-02 | Hide History tab (code intact) | SATISFIED | SongLyricEditor.vue, tests pass |

No orphaned requirements — both plans' `requirements:` frontmatter (`[R333,R334,R335]` + `[R336,R337]`) together account for all 5 requirement IDs REQUIREMENTS.md maps to Phase 116, and the traceability table there already marks all 5 Complete.

### Anti-Patterns Found

None. No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers, no empty handlers, no hardcoded-empty stub returns in any of the 4 modified component files. The two code-review-flagged Warnings (WR-01 error handling, WR-02 version-growth) and one Info (IN-01 missing guard test) were fixed in a prior iteration (`116-REVIEW-FIX.md`, commits `c5a6042c`, `3e3590cd`) and independently re-confirmed present in the code during this verification (not merely trusted from the fix report).

### Human Verification Required

### 1. Badge opens a genuinely new tab, on the Lyrics tab, without disturbing the origin tab

**Test:** From the read-only slide viewer, open a SONG group and click the "Edit song lyrics for {song}" badge.
**Expected:** A new browser tab opens, landing on that song's Lyrics tab; the originating slide viewer tab stays exactly where it was.
**Why human:** `window.open` call arguments are unit-tested; actual multi-tab browser behavior, tab landing on the correct sub-tab, and origin-tab state preservation cannot be observed by vitest/jsdom.

### 2. SongSelect link reaches the real external CCLI page

**Test:** Open the song editor for a song with a CCLI number and click "SongSelect" in the header.
**Expected:** A new tab opens to `https://songselect.ccli.com/songs/{ccliNumber}`, the correct live external page for that song.
**Why human:** The href is code-verified as correctly constructed; whether the live external site actually resolves to the right song page needs a human following the link in a browser.

### 3. Credits editor round-trip renders correctly in a real running app

**Test:** Add credits from empty, edit existing credits (fix a CCLI number), and clear a field — for each, save and confirm the read-only display and persisted state look correct; confirm lyric sections/slide order are visually unchanged after a credits-only save.
**Expected:** Credits persist and display correctly; no unexpected changes to lyrics; no error banner on a normal save; no History-panel-visible version growth (feature hidden).
**Why human:** The save-call shape and payload are unit-tested against mocks; a real Firestore round-trip and the visual layout/readability of the form need a human looking at the running app.

### Gaps Summary

No gaps. All 5 requirements (R333-R337) are implemented, wired, and covered by passing unit tests; `npm run type-check` is clean; the full test suite shows exactly the documented single-file baseline failure with no new regressions. The three items above are genuinely human/browser-only checks (new-tab landing behavior, external site resolution, real-app visual round-trip) consistent with this milestone's deferred-UAT policy — they are not code gaps, and per `.planning/v2.9-DEFERRED-VERIFICATION.md` they are expected to be batched to milestone-end UAT rather than blocking this phase.

---

*Verified: 2026-09-04T13:44:40Z*
*Verifier: Claude (gsd-verifier)*
