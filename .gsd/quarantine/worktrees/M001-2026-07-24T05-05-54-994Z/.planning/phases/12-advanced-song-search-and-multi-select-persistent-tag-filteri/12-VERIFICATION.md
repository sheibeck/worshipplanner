---
phase: 12-advanced-song-search-and-multi-select-persistent-tag-filteri
verified: 2026-07-02T21:53:36Z
status: passed
score: 21/22 must-haves verified
overrides_applied: 1
gap_disposition: "user approved feature-complete 2026-07-13; the single remaining gap (minor delete-confirmation wording: generic heading vs element-type-aware body, D-16 amended) accepted as-is"
gaps:
  - truth: "D-16 (amended, 12-08): delete-confirmation modal uses a single GENERIC wording that does not name the specific element type"
    status: failed
    reason: "src/views/ServiceEditorView.vue's deleteConfirmBody computed (line 972-978) calls elementLabel(pendingSlotKind.value) and interpolates it into the body text (e.g. 'This will remove this song from the service plan.' / 'this scripture' / 'this hymn' etc.) for every non-clear removal. This directly contradicts the current D-16 text in 12-CONTEXT.md (amended by plan 12-08 per UAT test 8): 'Use a single generic wording ... the same copy for every element type, not naming the specific element type.' The MODAL HEADING is generic ('Remove this element from the plan?', same for all kinds) but the BODY is element-type-aware. 12-08 was a documentation-only gap-closure plan based on a UAT observation ('it always reads generic (\"this item\" / \"this element\") rather than \"this song\" / \"this scripture\"') that does not match what the shipped code actually renders."
    severity: minor
    artifacts:
      - path: "src/views/ServiceEditorView.vue"
        issue: "deleteConfirmBody (line 972-978) interpolates elementLabel(kind) into the body text, naming the specific element ('this song', 'this scripture', 'this hymn', 'this message', 'this prayer') — contradicts the amended D-16 claim that no element type is named anywhere in the modal"
      - path: ".planning/phases/12-advanced-song-search-and-multi-select-persistent-tag-filteri/12-CONTEXT.md"
        issue: "D-16 (as amended by 12-08) states the copy does not name the element type; this is inaccurate for the body text"
    missing:
      - "A developer decision: EITHER (a) strip elementLabel() out of deleteConfirmBody so the body truly is generic for every kind (matching the current D-16 text exactly), OR (b) re-amend D-16 to accurately state 'heading is generic; body names the specific element type' (which is what the code has always done since 12-05, and matches 12-05-PLAN's ORIGINAL must-have: \"names the element type in the body\")."
---

# Phase 12: Advanced song search and multi-select persistent tag filtering — Verification Report

**Phase Goal:** Give users a robust, metadata-aware song search and a persistent multi-select tag filter across both the service-plan song picker and the Songs panel — so any song is findable by name or any known metadata, and tag filtering is fast and remembered. (Plus a delete-confirmation guard on the "Remove element" X.)
**Verified:** 2026-07-02T21:53:36Z
**Status:** gaps_found
**Re-verification:** No — initial verification

This phase shipped across 8 plans (12-01..12-08, including 3 UAT-driven gap-closure plans) plus 4 additional un-planned "live UAT" fix commits applied directly during this session (`673fe41`, `11c3760`, `1a702b8`, `fecef46`). All of the latter were verified present and correctly wired in the codebase (see "Post-Execution Fixes" below).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | D-01: multi-term AND — every whitespace/field-scoped term must match | ✓ VERIFIED | `songSearch.ts` `terms.every((tok) => matchesToken(song, tok))`; 28/28 tests pass in `songSearch.test.ts` |
| 2 | D-02: space-tolerant prefix (`key: E` == `key:E`) | ✓ VERIFIED | `FIELD_SPAN_RE` captures `\s*` after the colon; tests cover both forms |
| 3 | D-03: prefixes `type:`/`key:`/`tag:`/`theme:`/`team:` recognized, bare term fallback | ✓ VERIFIED | `matchesToken()` dispatch switch; `matchesBareTerm()` fallback for unrecognized/bare tokens |
| 4 | D-04: value matching — substring for type/tag/theme/team, exact for key | ✓ VERIFIED | `key` branch uses `===`; others use `.includes()`; test: `key:e` does not match `Em` |
| 5 | D-05: phrase pre-parse `Type N` / `Key X`, no lone-digit/letter inference | ✓ VERIFIED | `.replace(/\btype\s+([1-3])\b/gi, ...)` / `.replace(/\bkey\s+.../gi, ...)`; test confirms lone `'1'` doesn't match `type:1` |
| 6 | D-06: VW-type and Key dropdowns remain in `SongFilters.vue` alongside search | ✓ VERIFIED | `<select>` for `All types` and `All keys` present; grep confirms both still render |
| 7 | D-07: shared search engine — identical behavior in picker + Songs panel | ✓ VERIFIED | `songMatchesQuery(song, query): boolean` signature unchanged; both `songs.ts` and `SongSlotPicker.vue` call it directly, no local copies |
| 8 | D-08 (amended, Option A): single combined tag control sourcing `teamTags ∪ themes ∪ tags`, replacing the old dropdowns | ✓ VERIFIED | `songs.ts` `carriesChecked` unions all three fields; `filterTag`/`filterTagInclude`/`filterTagExclude` fully removed (`grep` returns no matches); `SongFilters.vue` mounts one `TagFilterChecklist` |
| 9 | D-09: show mode — checked tags OR-combine (broadens as more are checked) | ✓ VERIFIED | Store test `show mode OR: checked Set(["Christmas","Easter"]) broadens...`; picker mirrors same logic |
| 10 | D-10: Hide toggle inverts to an exclusion set | ✓ VERIFIED | `tagFilterHide.value ? !carriesChecked : carriesChecked` in both `songs.ts` and `SongSlotPicker.vue`; store test covers hide mode |
| 11 | D-11: Clear resets only the tag filter, not search/VW-type/Key | ✓ VERIFIED | `clearTagFilter()` body only touches `tagFilterChecked`/`tagFilterHide`; store test asserts other filters untouched |
| 12 | D-12: only tag-filter state persists (search/dropdowns reset fresh) | ✓ VERIFIED | `watch([tagFilterChecked, tagFilterHide], persistTagFilter)` — no other refs watched |
| 13 | D-13: persisted to localStorage, per user+org, survives reload/restart | ✓ VERIFIED | `wp:tagFilter:v1:${org}:${uid}`; `tagFilterStorageKey()` returns null (no read/write) when uid or org missing; try/catch silent-fail on both read+write |
| 14 | D-14: single shared tag-filter state used by BOTH picker and Songs panel | ✓ VERIFIED | `SongSlotPicker.vue` binds directly to `songStore.tagFilterChecked`/`tagFilterHide` (same Pinia instance) — a tag checked in one surface is checked in the other |
| 15 | D-15: EVERY element removal is confirmed, including empty/blank slots | ✓ VERIFIED | `removeSlot()` (line 1360-1368) unconditionally sets `showSlotDeleteConfirm.value = true` — no `isSlotPopulated` branch remains |
| 16 | D-16 (amended): modal reuses the D-14 pattern; single Cancel/red-Remove modal, `onClearSong` stays distinct | ✓ VERIFIED (structure) | One Teleport modal (line 231-254) serves both paths via `pendingDeleteIsClear`; `onClearSong()` (line 1413-1429) untouched, has its own gate |
| 17 | D-16 (amended): copy is fully generic — does NOT name the element type anywhere | ✗ **FAILED** | See gap below — the body text DOES name the element type via `elementLabel()` |
| 18 | Songs panel `filteredSongs`/`SongsView` and picker `tagFilteredSongs` exclude hidden songs from both results AND tag-list metadata | ✓ VERIFIED | `songs.ts` filters `song.hidden === true`; `SongsView.availableUserTags` skips `hidden === true`; `SongSlotPicker.visibleSongs` (`hidden !== true`) feeds both `availableTags` and `tagFilteredSongs` |
| 19 | `TagFilterChecklist.vue` is a dropdown/popover with a fixed-height trigger, not an ever-growing inline list | ✓ VERIFIED | `<button>` trigger with static classes + backdrop/panel gated by `v-if="open"`; trigger label shows `Tags`/count/`(hiding)` regardless of tag count |
| 20 | `TagFilterChecklist.vue` supports an `align` prop so the popover doesn't run off-screen at either mount site, plus a local ephemeral tag-search input | ✓ VERIFIED | `align?: 'left' \| 'right'` prop (default `'left'`), `SongFilters.vue` passes `align="right"`; `tagQuery` ref + `filteredTags` computed inside the panel |
| 21 | Picker's Teleported dropdown has a stable min-height so it doesn't visually jump as result count changes | ✓ VERIFIED | `openDropdown()` sets `minHeight: '420px'` (capped to available space when flipped/constrained) |
| 22 | WR-01/WR-02 code-review fixes (tag filter resets on account switch; multi-word field values match as a phrase) remain in place | ✓ VERIFIED | `hydrateTagFilter()` resets to defaults on all three exit paths; `FIELD_SPAN_RE` captures multi-word field spans; both covered by dedicated tests |

**Score:** 21/22 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/songSearch.ts` | Multi-term AND + field-scoped prefix + phrase-aware `songMatchesQuery` | ✓ VERIFIED | Implements full D-01–D-05 pipeline; 28 tests pass |
| `src/utils/__tests__/songSearch.test.ts` | Tests for prefixes/phrases/AND | ✓ VERIFIED | `field-scoped` describe block present, `tag:orch`/`Type 1`/`tag:orch key:E` assertions present |
| `src/stores/songs.ts` | Shared tag-filter checklist state + persistence + `clearTagFilter` | ✓ VERIFIED | `tagFilterChecked`/`tagFilterHide`/`clearTagFilter`/`tagFilterStorageKey` all present; `filterTag`/`filterTagInclude`/`filterTagExclude` fully removed |
| `src/components/TagFilterChecklist.vue` | Shared popover tag checklist (v-model checkedTags/hide, clear emit, align prop) | ✓ VERIFIED | 125-line SFC; presentational (no `@/stores/songs` import); popover + `align` + `tagQuery` all present |
| `src/components/SongFilters.vue` | Songs-panel filter row mounting the shared checklist, VW-type/Key retained | ✓ VERIFIED | Mounts `<TagFilterChecklist align="right" ...>`; `All types`/`All keys` selects retained; no team-tag select |
| `src/components/SongSlotPicker.vue` | Picker consuming shared search + shared checklist + shared store tag state | ✓ VERIFIED | Imports `useSongStore`/`TagFilterChecklist`; `visibleSongs`/`availableTags`/`tagFilteredSongs` all union-aware and hidden-aware |
| `src/views/SongsView.vue` | Wires `SongFilters` to `songStore`; `availableUserTags` widened to 3-field union, hidden-aware | ✓ VERIFIED | `v-model:tagFilterChecked`/`tagFilterHide`/`@clearTagFilter` bindings present; `availableUserTags` unions all 3 fields and skips hidden songs |
| `src/views/ServiceEditorView.vue` | Widened `removeSlot` gate + D-16 modal copy | ⚠️ PARTIAL | D-15 gate fully correct; D-16 copy doesn't match its own (amended) spec text — see gap |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `songSearch.ts` | Song fields (tags/themes/teamTags/vwTypes/arrangements.key) | per-prefix matcher functions | ✓ WIRED | `matchesToken` switch dispatches to each field correctly |
| `songs.ts filteredSongs` | `tagFilterChecked`/`tagFilterHide` | OR-in-show / exclude-in-hide | ✓ WIRED | Verified via store tests + code read |
| `songs.ts` | `localStorage` | watch-to-persist + hydrate-on-subscribe | ✓ WIRED | `watch([...], persistTagFilter)`; `hydrateTagFilter()` called at end of `subscribe()` |
| `SongsView.vue` | `songStore.tagFilterChecked`/`tagFilterHide`/`clearTagFilter` | v-model + `@clear` through `SongFilters` to `TagFilterChecklist` | ✓ WIRED | Full chain confirmed by reading all three files |
| `SongFilters.vue` | `TagFilterChecklist.vue` | import + mount | ✓ WIRED | `align="right"` mount confirmed |
| `SongSlotPicker.vue` | `songStore.tagFilterChecked`/`tagFilterHide`/`clearTagFilter` | `useSongStore()` + direct v-model on `TagFilterChecklist` | ✓ WIRED | Same Pinia instance as Songs panel — cross-surface sharing confirmed |
| `SongSlotPicker.vue tagFilteredSongs` | shared checked Set + hide flag | OR-in-show / exclude-in-hide, hidden-song-excluded | ✓ WIRED | Mirrors store logic exactly, operates on `visibleSongs` |
| `removeSlot(index)` | `showSlotDeleteConfirm` modal | unconditional gate for all slot removals | ✓ WIRED | No populated-only branch remains |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `SongTable` (via `SongsView`) | `songStore.filteredSongs` | Firestore `onSnapshot` → `songs.value` → filter pipeline | Yes — live Firestore collection, not a static/empty stub | ✓ FLOWING |
| `TagFilterChecklist` (Songs panel) | `availableUserTags` | `SongsView.availableUserTags` computed, unions live `songStore.songs` | Yes | ✓ FLOWING |
| `TagFilterChecklist` (picker) | `availableTags` | `SongSlotPicker.visibleSongs` computed from `props.songs` (passed from `ServiceEditorView`, itself Firestore-backed) | Yes | ✓ FLOWING |
| `ServiceEditorView` delete modal | `deleteConfirmHeading`/`deleteConfirmBody` | `pendingDeleteIsClear` + `pendingSlotKind` computeds, driven by `localService.value.slots[index].kind` | Yes (real slot data) — but see D-16 gap for what it renders | ✓ FLOWING (content is real; wording contract mismatch is documentation, not data-flow) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `songMatchesQuery` field-scoped + AND + phrase suite | `npx vitest run src/utils/__tests__/songSearch.test.ts` | 28/28 passed | ✓ PASS |
| `songs.ts` store — filters, persistence, union matching, WR-01/WR-02 regressions | `npx vitest run src/stores/__tests__/songs.test.ts` | 60/60 passed | ✓ PASS |
| Full project type-check (`vue-tsc --build`, includes template expressions) | `npm run type-check` | exit 0, no errors | ✓ PASS |
| Production build | `npm run build-only` | exit 0, 163 modules transformed | ✓ PASS |
| No leftover legacy filter references anywhere in `src/` | `grep -rn "filterTagInclude\|filterTagExclude\|includeTag\|excludeTag" src/` and bare `filterTag\b` | no matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| D-01 | 12-01 | Multi-term AND search | ✓ SATISFIED | `songSearch.ts` |
| D-02 | 12-01 | Space-tolerant `prefix: value` | ✓ SATISFIED | `songSearch.ts` |
| D-03 | 12-01 | Field prefixes type/key/tag/theme/team | ✓ SATISFIED | `songSearch.ts` |
| D-04 | 12-01 | Substring vs exact value matching | ✓ SATISFIED | `songSearch.ts` |
| D-05 | 12-01 | `Type N`/`Key X` phrase pre-parse | ✓ SATISFIED | `songSearch.ts` |
| D-06 | 12-03, 12-06 | VW-type/Key dropdowns coexist with search | ✓ SATISFIED | `SongFilters.vue` |
| D-07 | 12-01, 12-04, 12-07 | Shared search engine, both surfaces identical | ✓ SATISFIED | Single `songMatchesQuery`, no fork |
| D-08 (amended) | 12-02, 12-03, 12-06, 12-08(docs) | Single combined tag control, union of 3 fields | ✓ SATISFIED | `songs.ts`, `SongFilters.vue`, `SongSlotPicker.vue` all union-aware |
| D-09 | 12-02, 12-03, 12-04 | Show mode OR-combine | ✓ SATISFIED | store + picker logic identical |
| D-10 | 12-02, 12-03, 12-04 | Hide toggle inverts | ✓ SATISFIED | store + picker logic identical |
| D-11 | 12-02, 12-03 | Clear resets only tag filter | ✓ SATISFIED | `clearTagFilter()` |
| D-12 | 12-02 | Only tag state persisted | ✓ SATISFIED | `watch([tagFilterChecked, tagFilterHide], ...)` |
| D-13 | 12-02 | Per-user/org localStorage | ✓ SATISFIED | `wp:tagFilter:v1:{org}:{uid}` |
| D-14 | 12-02, 12-04, 12-07 | Single shared state, both surfaces | ✓ SATISFIED | Direct Pinia binding in picker |
| D-15 | 12-05 | Confirm ALL removals incl. empty | ✓ SATISFIED | `removeSlot()` unconditional gate |
| D-16 (amended) | 12-05, 12-08(docs) | Reuse D-14 modal; single generic wording, no type naming | ✗ **BLOCKED** (partial) | Modal reuse ✓; heading generic ✓; **body names the type** ✗ — contradicts current doc text |

### Anti-Patterns Found

None. No TODO/FIXME/placeholder markers, no empty stub returns, no hardcoded-empty props, and no dead legacy filter references found in any file touched by this phase (`songSearch.ts`, `songs.ts`, `TagFilterChecklist.vue`, `SongFilters.vue`, `SongSlotPicker.vue`, `SongsView.vue`, `ServiceEditorView.vue`).

### Post-Execution Fixes (verified present)

Four commits landed on top of the 8 formal plans, addressing issues surfaced during live user testing in this session — none have a dedicated PLAN/SUMMARY, so they were verified directly against the codebase per the task's explicit instructions:

| Commit | Fix | Verified in |
|--------|-----|--------------|
| `11c3760` | Hidden songs no longer contribute tags to filter lists or appear in picker results | `SongsView.availableUserTags` (skips `hidden === true`), `SongSlotPicker.visibleSongs` (feeds `availableTags` + `tagFilteredSongs`) |
| `673fe41` | Tag popover anchored to trigger's right edge (Songs panel) so it doesn't run off-screen | `TagFilterChecklist.vue` — `:class="align === 'right' ? 'right-0' : 'left-0'"` |
| `1a702b8` | `align` prop (default `'left'`) + local ephemeral tag-search input | `TagFilterChecklist.vue` — `align` prop, `tagQuery`/`filteredTags`; `SongFilters.vue` passes `align="right"` |
| `fecef46` | Picker dropdown given a stable `minHeight` so it stops jumping as result count changes | `SongSlotPicker.vue openDropdown()` — `minHeight: '420px'` (capped) |

All four are present, wired, and covered by the passing type-check/build/test suite.

### Human Verification Required

UAT (`12-UAT.md`) tests 4, 5, 6, and 7 were explicitly marked `blocked` pending the Option A tag-system rework (plans 12-06/12-07) and were never re-run after that rework — plus the popover/align/min-height fixes (the four commits above) postdate the UAT file and have no logged manual confirmation. Code-level and unit-test verification give high confidence these now work, but the following are genuinely interactive/visual flows worth a final human pass before closing the phase:

### 1. Hide-tags (inverted) toggle, end to end

**Test:** Open the tag popover (either surface), check 1-2 tags, toggle "Hide tags" on.
**Expected:** The song list now EXCLUDES songs carrying those tags; the trigger shows `(hiding)` even with the popover closed.
**Why human:** Visual/interactive toggle behavior; logic is unit-tested at the store level but the end-to-end popover interaction (open → check → toggle → close → verify list + trigger caption) was never re-confirmed after the popover conversion (12-07).

### 2. Clear-tags action

**Test:** With tags checked and Hide on, click "Clear tags" inside the popover.
**Expected:** All checkboxes uncheck, Hide turns off, popover stays open (per 12-07's discretion note); search text and VW-type/Key dropdowns are untouched.
**Why human:** Interactive popover behavior (does clicking Clear inside the now-popover-contained panel feel right, does it stay open as intended) not covered by UAT since test 5 was blocked before the popover rework.

### 3. Persistent tag filter across reload, scoped per user/org

**Test:** Check tags (and/or Hide) in the Songs panel, reload the page; then (if testable) switch to a different user/org on the same browser.
**Expected:** Same selection restored after reload; a different user/org sees no bleed-over from the prior selection.
**Why human:** Requires a real reload/account-switch in a browser session; store-level tests simulate this but a live confirmation was never logged (UAT test 6 was blocked).

### 4. Service-plan picker shares the same tag filter, popover positioned correctly under a left-aligned trigger

**Test:** Check a tag in the Songs panel, then open the picker inside the service editor.
**Expected:** The same tag shows checked in the picker's popover (shared state); the picker's popover opens left-aligned under its trigger (not clipped) and its search box accepts the same field-scoped syntax; the sticky search/filter bar stays pinned while the song list scrolls.
**Why human:** Visual positioning/overlay behavior (popover placement inside a Teleported, already-absolutely-positioned dropdown) is the hardest case to verify by static analysis alone — worth a live look given the `align` prop was a same-session hotfix.

## Gaps Summary

One real gap: the current (12-08-amended) text of **D-16** in `12-CONTEXT.md` claims the delete-confirmation modal copy is fully generic and never names the specific element type ("this song", "this scripture", etc.). Reading the actual shipped code (`src/views/ServiceEditorView.vue`, `deleteConfirmBody` computed, lines 972-978) shows the **heading** is indeed generic and identical for every element kind, but the **body** text does interpolate `elementLabel(kind)` and therefore DOES name the specific element (e.g., "This will remove this song from the service plan.").

This is not a functional defect — D-15 (confirm every removal) and the modal-reuse/Cancel/Remove mechanics all work correctly and match the phase goal ("delete-confirmation guard on the Remove element X"). It is a documentation-vs-code mismatch: 12-08 was a documentation-only gap-closure plan that amended D-16 based on a UAT-test-8 observation ("it always reads generic... rather than 'this song'/'this scripture'") that does not match what the code renders. Notably, this ALSO means the code still satisfies 12-05-PLAN's *original* must-have ("names the element type in the body") — the 12-08 correction appears to have overcorrected.

**This looks intentional / low-risk either way.** To accept the current shipped behavior (body names the element type) and close this gap by re-aligning the docs, add to this file's frontmatter:

```yaml
overrides:
  - must_have: "D-16 (amended, 12-08): delete-confirmation modal uses a single GENERIC wording that does not name the specific element type"
    reason: "Code review confirms the modal HEADING is generic (same for every kind) but the BODY correctly names the specific element via elementLabel() — this matches 12-05-PLAN's ORIGINAL must-have and is more informative for users. The 12-08 doc correction (based on a UAT-8 observation) appears to have mischaracterized the shipped body text; keeping the current code and re-amending D-16's wording (rather than stripping elementLabel from the body) is the accepted resolution."
    accepted_by: "{your name}"
    accepted_at: "{current ISO timestamp}"
```

Then re-run verification to apply. Alternatively, if the fully-generic body (no element name anywhere) IS what's wanted, strip `elementLabel(pendingSlotKind.value)` out of `deleteConfirmBody` and hardcode `'this element'` for the remove path — a one-line code change in `src/views/ServiceEditorView.vue`.

Everything else in the phase — the search engine (D-01–D-07), the unified tag filter (D-08–D-14), and the removal gate itself (D-15) — is fully implemented, wired, tested, type-clean, and builds successfully.

---

*Verified: 2026-07-02T21:53:36Z*
*Verifier: Claude (gsd-verifier)*
