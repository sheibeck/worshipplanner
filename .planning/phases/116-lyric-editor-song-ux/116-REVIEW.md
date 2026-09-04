---
phase: 116-lyric-editor-song-ux
reviewed: 2026-09-04T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/slides/SlideGrid.vue
  - src/components/slides/SlidesTab.vue
  - src/components/SongSlideOver.vue
  - src/components/SongLyricEditor.vue
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 116: Code Review Report

**Reviewed:** 2026-09-04
**Depth:** standard
**Files Reviewed:** 4 (+ 4 test files read for coverage adequacy)
**Status:** issues_found

## Summary

Reviewed the five R333–R337 changes: the read-only song badge relabel + new-tab
navigation (SlideGrid.vue / SlidesTab.vue), the SongSelect header link and
Cancel→Close relabel (SongSlideOver.vue), and the inline credits editor +
History-gate (SongLyricEditor.vue).

Specifically checked the flagged risk surfaces:
- **Reverse-tabnabbing (R333):** `window.open(href, '_blank', 'noopener')` in
  `SlidesTab.vue:345` is safe — `noopener` is present, the target is
  same-origin (`router.resolve(buildSongEditLink(...))`, not attacker data),
  and the pattern matches every other external-link site in this codebase
  (`rel="noopener"` without `noreferrer` is the established convention here —
  see `CongregationalEditor.vue`, `ScriptureInput.vue`, `ServiceCard.vue`,
  `SongTable.vue`). Not a defect.
- **XSS/stored-HTML injection (R336):** every credits field (title, authors,
  CCLI numbers, copyright lines) is rendered via `{{ }}` text interpolation,
  never `v-html`. No injection surface.
- **Array field parsing (R336):** `parseCreditLines` (split on `\n`, trim,
  filter empty) round-trips correctly and is covered by tests including the
  multi-author case.
- **Not clobbering lyrics on save (R336):** `saveCreditsEdit` passes
  `editableState.sections`/`performanceOrder` through unchanged alongside the
  edited `copyright` — verified against `onSaveVersion`'s identical shape and
  the dedicated test (`SongLyricEditor.test.ts:1179`). Sections are not lost.
- **R337 dead-code completeness:** `HISTORY_ENABLED = false` gates both the
  toggle button and the panel; `showHistory` has no other reachable path
  (confirmed via full-repo grep) and version store/handlers stay intact per
  the stated intent.

`npm run type-check` (vue-tsc --build) and the four component test suites (316
tests total) all pass cleanly against the current tree.

Two real, if modest, gaps were found in the R336 credits-save path (see
Warnings), plus one test-coverage gap (see Info). Nothing rises to Critical —
no injection, no tabnabbing, no data-loss path found.

## Warnings

### WR-01: `saveCreditsEdit` has no error handling — a failed save silently strands the user in the open form with no feedback

**File:** `src/components/SongLyricEditor.vue:948-964`

**Issue:** `saveCreditsEdit()` awaits `songLyricsStore.saveLyrics(...)` with no
`try/catch`. If the write rejects (permission error, offline, quota), the
`await` throws and `editingCredits.value = false` on line 963 never runs — the
form stays open showing the user's edits with zero indication that nothing
was persisted. Unlike the file's autosave path (`doAutoSave`), which reports
through `useAutoSave`'s `status` into the shared `saveStatus` store and
renders a visible error banner (`SaveStatusIndicator`), this explicit "Save"
button click has no status reporting at all — a rejected promise is only
visible in the console via Vue's default async-error handler, not to the
user. The sibling `onSaveVersion` (pre-existing, currently unreachable behind
`HISTORY_ENABLED`) has the same gap, so this isn't a novel pattern in the
file, but it is a newly user-reachable one: this is the only *always-visible*
manual save action in this component now that History is hidden.

**Fix:**
```ts
async function saveCreditsEdit() {
  const cur = currentLyrics.value
  if (!cur) return
  const edited: CopyrightInfo = { /* ... */ }
  try {
    await songLyricsStore.saveLyrics(props.orgId, props.songId, {
      sections: editableState.sections,
      copyright: edited,
      performanceOrder: editableState.performanceOrder,
    })
    editingCredits.value = false
  } catch (err) {
    console.error('Failed to save credits:', err)
    // surface a visible error, e.g. reuse saveStatus.set(surfaceId, { status: 'error', errorText: ... })
  }
}
```

### WR-02: Every credits-only edit permanently duplicates the entire lyrics document as a new Firestore version, with no way for the user to see or prune the growth

**File:** `src/components/SongLyricEditor.vue:958-963` (calls `songLyricsStore.saveLyrics`, `src/stores/songLyrics.ts:71-84`, which is `addDoc` — creates a brand-new doc, never updates in place)

**Issue:** `songLyricsStore.saveLyrics` is documented as "Create a NEW doc in
the lyrics subcollection. Each call creates a new version (R004 light
versioning)." Using it for `saveCreditsEdit` means that editing only the CCLI
number or a single author name — a purely metadata change — duplicates the
*entire* `sections` array (every verse/chorus/line of the song) into a new
permanent Firestore document, exactly as the explicit "Save Version" action
does. Before R337 this was visible/manageable via the History panel; now that
History is hidden (`HISTORY_ENABLED = false`), a user who repeatedly tweaks
credits while getting a CCLI listing right (a plausible real workflow) will
silently accumulate an unbounded, invisible, unprunable stack of full-lyrics
version documents per edit, with no UI path to clean them up. This is
data-hygiene debt introduced specifically by pairing R336 with R337: the
version-creation side effect that used to be paired with visible/manageable
history is now a hidden cost of an ordinary metadata edit.

**Fix:** Use the in-place update path instead, mirroring `doAutoSave`:
```ts
async function saveCreditsEdit() {
  const cur = currentLyrics.value
  if (!cur?.id) return
  await songLyricsStore.updateCurrentLyrics(props.orgId, props.songId, cur.id, {
    copyright: edited,
  })
  editingCredits.value = false
}
```
If creating a new version on every credits save is actually intended (e.g. to
preserve CCLI-number history for licensing audit purposes), that tradeoff is
reasonable but should be a deliberate, documented decision rather than an
unstated side effect of reusing `saveLyrics` — and the growth should be
revisited once/if History returns.

## Info

### IN-01: No test exercises the unsaved-drawer guard on the badge's new-tab navigation path

**File:** `src/components/slides/SlidesTab.vue:342-346` (`onEditInSongBadge`); tests at `src/components/slides/__tests__/SlidesTab.test.ts:847-866` and `:927-1061`

**Issue:** `onEditInSongBadge` calls `confirmLeavingOpenDrawer()` before
`window.open(...)`, exactly like the menu's `edit-in-song`/`edit-in-scripture`
paths, which do have dedicated "cancelled confirm blocks navigation" /
"confirmed discard allows navigation" tests using a controllable
`confirmDiscard` stub (`SlidesTab.test.ts:968-1061`). The one test that
exercises the badge's `edit-in-song` emit (`:847`) mounts with the default
auto-stubbed `EditSlideDrawer`, where `confirmDiscard` resolves via the `?? true`
fallback — so it can never observe a blocked navigation. There is no test
proving that clicking the badge while the drawer holds unsaved changes and the
user cancels the confirm actually suppresses the `window.open` call.

**Fix:** Add a case to the `mountWithControllableGuard` block that opens the
drawer, emits `edit-in-song` from `SlideGrid` (the badge path, not
`menu-action`), and asserts `window.open` was not called when
`confirmDiscard` returns `false` (and was called when it returns `true`),
mirroring the existing menu-key tests at lines 968 and 990.

---

_Reviewed: 2026-09-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
