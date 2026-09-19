---
phase: 142-slides-tab-panel-ux-from-claude-design
verified: 2026-09-19T07:17:06Z
status: human_needed
score: 17/17 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open each chip's popover on a narrow/resized window with the slide grid scrolled; confirm the popover is never clipped and flips to right-align near the viewport's right edge."
    expected: "Popover always fully visible; `alignRight` flip observed in a real viewport (jsdom `getBoundingClientRect` is mocked in the unit suite, not a real layout)."
    why_human: "Real viewport geometry/layout is not observable in jsdom (142-VALIDATION.md Manual-Only Verifications row 1)."
  - test: "Drag a PNG/JPG from the desktop onto the Background popover's ＋ tile."
    expected: "Upload progress renders, then the new thumbnail appears highlighted and the chip updates to the new filename."
    why_human: "Real `DataTransfer`/file-drop needs a browser; the unit suite simulates the `drop` event's `dataTransfer.files` property, not an OS-level drag (142-VALIDATION.md row 2)."
  - test: "Assign a Track and press ▶ to confirm it plays; assign a vamp with no MP3, run the service, and confirm the group is silent live while the chip shows the amber '♪ {name} · no MP3' label."
    expected: "Track preview plays audible audio; a no-MP3 vamp bed produces no sound live and the amber chip/warning are visible throughout."
    why_human: "Live audio output cannot be verified in jsdom (142-VALIDATION.md row 3)."
  - test: "Vamp tab in the Audio popover when useVampStore's subscription errors (e.g. a transient Firestore read failure while vamps are loading)."
    expected: "The Vamp tab never renders blank — it shows either the loading state, the existing rows, or a visible fallback, never an empty silent gap."
    why_human: "142-02-PLAN.md's must_haves lists this as `verification: backstop` — useVampStore has no dedicated error state today (inherited gap from 141-UI-SPEC, not introduced or fixed by this phase). No test or code path in the diff demonstrates this case one way or the other; per the honest-verifier rule this is left unconfirmed rather than assumed to pass. SUMMARY.md itself defers it to UAT (142-02-SUMMARY.md coverage item D7 / VALIDATION.md)."
  - test: "Trigger a rejected/failed Firestore write from a Background or Audio popover (e.g. simulate a permission-denied or offline write) and confirm the chip does not keep showing a value that never actually saved."
    expected: "SlideGrid's `onAttachGroupMusic`/`onAttachGroupVamp`/`onAttachGroupBackground` handlers currently only `console.error` on failure (pre-existing, unchanged pattern) — since the chip derives from the stored `group` prop, a failed write should leave the chip on its prior (unchanged) value, not the attempted new one. No test exercises an actual failed-write-then-render sequence end-to-end in a live Firestore round trip."
    why_human: "142-04-PLAN.md's must_haves lists this as `verification: backstop`. Confirmed by source read that the handlers are unchanged (still bare `console.error`, no rollback/toast) and that the chip is purely derived from `group` (so it cannot diverge from Firestore truth once re-rendered) — but this causal chain is not exercised by an automated test, so it is not marked VERIFIED per the honest-verifier rule."
---

# Phase 142: Slides Tab panel UX from Claude Design Verification Report

**Phase Goal:** Rework the slide banner / audio / background-image panel UX to match the owner's Claude
Design "Slides Tab" mockup — variant 7a: one 34px row of three chips (Display · Background ·
Audio-as-one-slot), each opening its own popover; other panel actions trail the chips; chips
visible-but-inert when locked; MP3-less vamps assignable with an amber "no MP3" warning; Background
popover = None · recents · ＋ upload (drop); Display popover = Full-screen/Banner tiles with hint copy.

**Verified:** 2026-09-19
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Selecting any group shows the group-media panel with the 7a chip row (Display · Background · Audio); gate is `Boolean(selectedSlot)`, renders for editor/viewer, locked/unlocked, group materialized or not | ✓ VERIFIED | `src/components/slides/SlideGrid.vue:77` `v-if="Boolean(selectedSlot)"` mounts `<SlideGroupSetupStrip>` (line 81); `SlideGrid.test.ts` "group media panel (34-11 Task 1)" block (148 tests total, all passing) asserts the panel renders across editor/viewer/locked × group-present/absent |
| 2 | Chips are visible-but-inert (inert `<span>`, no caret, no `aria-haspopup`/`aria-expanded`, no popover on click) on a locked service / for a non-editor — supersedes old hide-when-locked | ✓ VERIFIED | `SlideGroupSetupStrip.vue:9-34` `v-if="editable"` button / `v-else` inert span split; `SlideGroupSetupStrip.test.ts` "editable: false renders all three chips as inert spans..." test passing; `SlideGrid.test.ts` "group background control" rewritten viewer/locked tests passing |
| 3 | Loop (MISC/ANNOUNCEMENTS), Congregational-reading, and Remove-imported-entries render AFTER the three chips on the same row, gates/testids preserved | ✓ VERIFIED | `SlideGrid.vue:98-127` `<template #trailing>` inside `<SlideGroupSetupStrip>`, unchanged `v-if`s/testids (`slide-grid-congregational-btn`, `slide-grid-remove-imported-btn`, `<SlotLoopControl>`); `SlideGroupSetupStrip.vue:93` renders `<slot name="trailing" />` between the chip loop and the caption |
| 4 | A no-MP3 vamp assigned to an EXISTING group doc writes `bedVampId`+`bedVampLabel` and `deleteField()`s any stale `bedAudioUrl`; a URL-bearing patch still takes the existing branch | ✓ VERIFIED | `src/stores/slideGroups.ts:149-164` — `else if (patch.bedAudioUrl !== undefined)` (line 149) precedes `else if (patch.bedVampId)` (line 159, `deleteField()` on `bedAudioUrl`); `slideGroups.test.ts` 45 tests passing incl. the new "no-MP3 vamp against an existing doc (Phase 142)" describe |
| 5 | Live playback (slideshowAssembler) resolves no `audioUrl`/`audioLoop` for a `bedVampId`-set, `bedAudioUrl`-absent group — no throw | ✓ VERIFIED | `slideshowAssembler.test.ts:2080` "bedVampId with no bedAudioUrl resolves no audio and no loop (142...)" passing; `git diff --stat -- src/utils/slideshowAssembler.ts` empty (no source change needed, confirmed by plan + summary) |
| 6 | `BackgroundControl` `variant="chip-popover"` renders None/recents/upload tiles + drop-to-upload + inherited explainer; default `panel` variant byte-identical for `SongLyricEditor.vue` | ✓ VERIFIED | `src/components/slides/BackgroundControl.vue:3-53` new branch matches UI-SPEC §4 verbatim (testids, copy "Recent in this service · drop a file on ＋", "Managed on the song — edit it from the song's Lyrics tab."); lines 56-116 `v-else` panel branch unchanged; `BackgroundControl.test.ts` 27 tests passing (both variants) |
| 7 | `SlotVideoOutputControl` renders Full-screen/Banner as tiles in a `role=radiogroup`; caption is dynamic per mode; `select()`/`mode`/`change` emit unchanged | ✓ VERIFIED | `SlotVideoOutputControl.vue` full file matches UI-SPEC §3 verbatim, `sizeHint` computed (lines 17-21), emit shape `emit('change', { mode: next })` unchanged; 9/9 tests passing |
| 8 | Audio is ONE slot: None/Track/Vamp segmented control derived from data (`vamp` whenever `bedVampId` set, regardless of `audioUrl`); no-MP3 vamp renders the Vamp tab + amber warning, never the empty state | ✓ VERIFIED | `SlideGroupMusicControl.vue:244` `derivedTab` computed (`bedVampId ? 'vamp' : audioUrl ? 'track' : 'none'`); `isVampBed = computed(() => !!props.bedVampId)` (line 221, redefined per RESEARCH Finding 5); warning `<p data-testid="group-music-vamp-warning">` gated `isVampBed && !audioUrl` (line 101-105); 22/22 tests passing |
| 9 | `VampPicker` `allowUnattached` makes a no-MP3 row clickable with the amber tag; default stays disabled for `EditSlideDrawer` | ✓ VERIFIED | `VampPicker.vue:49` `v-if="vamp.attachment?.downloadUrl \|\| allowUnattached"`; `EditSlideDrawer.vue` zero-diff confirmed by summary + 186/186 `EditSlideDrawer.test.ts` tests passing; 15/15 `VampPicker.test.ts` passing |
| 10 | `AudioPlayer` emits `loadedmetadata` with the finite duration (Infinity/NaN emit nothing) so the Track row can show a duration once known | ✓ VERIFIED | `AudioPlayer.vue:84` `if (typeof d === 'number' && Number.isFinite(d)) emit('loadedmetadata', d)`; `RunControlView.audio.test.ts` unaffected (passing) |
| 11 | Popover lifecycle: single-open-at-a-time, Esc-with-focus-return, click-outside close, group-switch reset, viewport-edge flip, no Tab-close/focus-trap, listener hygiene (added on open, removed on close AND unmount) | ✓ VERIFIED | `SlideGroupSetupStrip.vue:264-341` full implementation (`toggle`, `closeAndRefocus`, `onPointerDown`, `focusIntoPopover`, `watch(openChip, ...)`, `onUnmounted`, `watch(selectedSlot.id, ...)`); 27 tests in `SlideGroupSetupStrip.test.ts` covering every behavior, all passing |
| 12 | A stale open popover force-closes if `editable` flips to `false` mid-session (code-review WR-01 finding) | ✓ VERIFIED | `SlideGroupSetupStrip.vue:41` popover `v-if` gated on `openChip === chip.id && editable`; `watch(() => props.editable, (editable) => { if (!editable) close() })` (line 339-341); fixed in commit `38adec2e`, regression test passing |
| 13 | Background popover recents are derived client-side in `SlidesTab.vue` (group-owned sorted by `updatedAt` desc + song-inherited in plan order, deduped, capped to 4) with no new Firestore read | ✓ VERIFIED | `SlidesTab.vue:269-296` `recentBackgrounds` computed; `grep -c "getDocs\|onSnapshot\|useSongs"` on the file = 0; 65/65 `SlidesTab.test.ts` tests passing incl. the "recentBackgrounds (142)" describe |
| 14 | `onAttachGroupVamp` no longer early-returns on a missing `downloadUrl`; SlideGrid stays the sole Firestore write owner with `canWriteGroupMedia` re-checked in every handler | ✓ VERIFIED | `SlideGrid.vue:551-573` — no `if (!downloadUrl) return` guard; patch built as `{ ..., ...(downloadUrl ? { bedAudioUrl: downloadUrl } : {}) }`; 8 occurrences of `canWriteGroupMedia.value) return` in the file (matches/exceeds the plan's ≥8 acceptance bar) |
| 15 | Retired testids (`slide-grid-group-background`, `slide-grid-group-background-caption`, `group-music-add`, the `142 interim` markers) no longer exist anywhere; `SlideGrid.test.ts` fully migrated | ✓ VERIFIED | `grep -c` for all four patterns against `SlideGrid.vue` and `SlideGrid.test.ts` = 0 (checked directly); 148/148 `SlideGrid.test.ts` tests passing |
| 16 | Full app suite at the documented 2-file baseline; `npm run type-check` (vue-tsc --build) clean | ✓ VERIFIED | Re-ran `npm run type-check` myself — exits clean, no errors. Re-ran the 8 targeted suites myself (358/358 passing) plus `EditSlideDrawer.test.ts`/`RunControlView.audio.test.ts`/`AudioPlayer.test.ts` (216/216 passing). Per verification-scope instructions the full untargeted `npx vitest run` was not re-run (already run post-merge at HEAD~4 by the orchestrator: 240 passed/241, only `src/storage.rules.test.ts` — documented Storage-emulator limitation) |
| 17 | Row-end caption reads "applies to all N slide(s) in this group, unless a slide sets its own" with correct singular/plural | ✓ VERIFIED | `SlideGroupSetupStrip.vue:239-242` `scopeCaption` computed with `slide${n === 1 ? '' : 's'}`; tests assert both N=1 and N>1 strings |

**Score:** 17/17 truths verified (0 present-behavior-unverified). Two plan-declared `verification: backstop`
must-haves (Vamp-tab subscription-error surfacing; Firestore write-failure-then-render surfacing) are
correctly excluded from the truths table above and routed to Human Verification below per the
honest-verifier rule — neither is assumed to pass nor counted toward the score.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/stores/slideGroups.ts` | `setGroupBedMedia` third patch branch | ✓ VERIFIED | Present, correctly ordered after the `bedAudioUrl !== undefined` branch, `deleteField()`s stale URL |
| `src/components/slides/BackgroundControl.vue` | `variant`/`recents` props, chip-popover branch | ✓ VERIFIED | Additive branch; panel variant untouched (verified by reading both templates) |
| `src/components/slides/SlotVideoOutputControl.vue` | Display tiles + `sizeHint` | ✓ VERIFIED | Matches UI-SPEC §3 verbatim |
| `src/components/VampPicker.vue` | `allowUnattached` prop | ✓ VERIFIED | Enabled no-MP3 row keeps amber tag; default path unchanged |
| `src/components/AudioPlayer.vue` | `loadedmetadata` emit | ✓ VERIFIED | Gated on `Number.isFinite` |
| `src/components/slides/SlideGroupMusicControl.vue` | Segmented None/Track/Vamp body | ✓ VERIFIED | `audioTab` derivation, inline `VampPicker`, Track row, `close` emit all present |
| `src/components/slides/SlideGroupSetupStrip.vue` (NEW) | Chip row + popover shell | ✓ VERIFIED | File exists, composes all three Wave-1 controls, emit-only (no store import) |
| `src/components/slides/SlideGrid.vue` | Panel gate, strip mount, `recentBackgrounds` prop, guard removal | ✓ VERIFIED | All present as specified |
| `src/components/slides/SlidesTab.vue` | `recentBackgrounds` computed | ✓ VERIFIED | Present, no new Firestore read |
| `.planning/codebase/ARCHITECTURE.md` | New entries for the above | ✓ VERIFIED (not re-quoted here — confirmed present via plan/summary acceptance greps, doc-only artifact) | |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `setGroupBedMedia` existing-doc branch | `updateDoc` payload | third `else if` branch | ✓ WIRED | Confirmed in source, correct branch order |
| `BackgroundControl` chip-popover tiles | `attach`/`remove` emits | `selectNone`/`selectRecent`/`uploadFile` | ✓ WIRED | All three functions present and wired to the correct emits |
| `SlotVideoOutputControl` tiles | `change` emit | unchanged `select(next)` | ✓ WIRED | Verified unchanged |
| `SlideGroupSetupStrip` chips | popover mount | `openChip` computed gate | ✓ WIRED | Single-ref state, verified by 27 passing lifecycle/state tests |
| `SlideGroupSetupStrip` child control emits | strip's six passthrough emits | inline arrow-function handlers | ✓ WIRED | `@change`→`video-output-change`, `@attach`/`@remove`(bg)→`attach-background`/`remove-background`, `@attach`/`@remove`(music)→`attach-music`/`remove-music`, `@attach-vamp`→`attach-vamp`, `@close`→`close()` — all present in template |
| `SlideGrid` strip emits | store write handlers | `onAttachGroupMusic`/`onRemoveGroupMusic`/`onAttachGroupVamp`/`onAttachGroupBackground`/`onRemoveGroupBackground`/inline `video-output-change` relay | ✓ WIRED | All six emits bound in `SlideGrid.vue:91-96`, all handlers unchanged except the vamp guard removal |
| `SlidesTab.recentBackgrounds` | `BackgroundControl.recents` | `SlidesTab` → `SlideGrid :recent-backgrounds` → `SlideGroupSetupStrip :recent-backgrounds` → `BackgroundControl :recents` | ✓ WIRED | Full prop chain confirmed by reading all four files |

### Data-Flow Trace (Level 4)

Chips derive purely from the `group`/`selectedSlot` props passed down from `SlideGroupSetupStrip`'s own
props, which trace to `SlideGrid`'s `group`/`selectedSlot` props, which trace to `SlidesTab`'s
`groupsBySlotId`/plan-item-selection state (unchanged, pre-existing subscription — Phase 142 adds no new
read). `recentBackgrounds` traces to the same already-subscribed `groupsBySlotId` + `assembledSlideshow`
props (confirmed no `getDocs`/`onSnapshot`/`useSongs` call was added). No hollow/disconnected props found —
every prop threaded through the four-component chain is a real, non-empty binding, not a hardcoded `[]`/`{}`.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Targeted suite (8 files named in task) | `npx vitest run <8 files>` | 358/358 tests passed | ✓ PASS |
| Regression suites (EditSlideDrawer, RunControlView audio, AudioPlayer) | `npx vitest run <3 files>` | 216/216 tests passed | ✓ PASS |
| Type-check | `npm run type-check` | exits 0, no errors | ✓ PASS |
| Full app suite | *not re-run — orchestrator already ran it post-merge at HEAD~4 (240/241 files, 5965 tests, only `src/storage.rules.test.ts` fails — documented baseline)* | — | ? SKIP (per task scoping instruction) |

### Probe Execution

Not applicable — this phase has no `scripts/*/tests/probe-*.sh` declared in any plan/summary, and it is a
frontend UI rework, not a migration/tooling phase.

### Requirements Coverage

| Requirement | Source Plan | Description (current REQUIREMENTS.md) | Status | Evidence |
|--------------|------------|------------------------------------------|--------|----------|
| R032 | 142-01/02/03/04 | **Not a row in current REQUIREMENTS.md** — v2.15's REQUIREMENTS.md only tracks R428–R440 (100% mapped, 0 unmapped). R032 is a historical ID from an earlier milestone's numbering, cited by the plans as the pre-existing "group music" capability this phase touches, not a new requirement being introduced. | ⚠ TRACEABILITY NOTE (not a gap) | Per the phase's own frontmatter: "none newly mapped (ROADMAP TBD) — plans cite the existing IDs this work touches" |
| R055 | 142-01/03/04 | **Not a row in current REQUIREMENTS.md** — same as R032, cited as the pre-existing "group background" capability. | ⚠ TRACEABILITY NOTE (not a gap) | Same as above |
| R425 | 142-01/03/04 | **Not a row in current REQUIREMENTS.md** — cited as the pre-existing "video output" capability. | ⚠ TRACEABILITY NOTE (not a gap) | Same as above |
| R437 | 142-01/02/03 | "A planner can assign a vamp to a slide..." — **marked Complete under Phase 141** in REQUIREMENTS.md (line 173: `R437 | Phase 141 | Complete`) | ⚠ TRACEABILITY NOTE (not a gap) | Phase 142 extends the existing vamp-assignment capability to the group-level bed (a no-MP3 vamp is now assignable there too), consistent with R437's intent, but does not itself close a REQUIREMENTS.md row — R437 was already closed by Phase 141 |

No orphaned requirements found: REQUIREMENTS.md's Phase map shows Phase 142 is not listed at all (the
document was last updated for v2.15's 4 phases, 138–141), and the phase's own ROADMAP entry explicitly
states "Requirements: none newly mapped." This is consistent, expected, and documented — not a gap.

### Anti-Patterns Found

None. Scanned all 9 modified/created production source files
(`SlideGroupSetupStrip.vue`, `SlideGrid.vue`, `SlideGroupMusicControl.vue`, `BackgroundControl.vue`,
`SlotVideoOutputControl.vue`, `VampPicker.vue`, `AudioPlayer.vue`, `SlidesTab.vue`, `slideGroups.ts`) for
`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented"/"coming soon" — zero matches in all
nine files. No stub returns, no hardcoded-empty props at call sites (`recentBackgrounds`/`vamps` bind real
computed/store values, not literal `[]`), no console.log-only implementations.

### Human Verification Required

### 1. Popover viewport-edge flip and clipping
**Test:** Open each chip's popover on a narrow/resized window with the slide grid scrolled.
**Expected:** Popover is always fully visible; flips to right-align near the viewport's right edge.
**Why human:** Real viewport geometry/layout is not observable in jsdom (142-VALIDATION.md Manual-Only row 1).

### 2. Drag-and-drop background upload
**Test:** Drag a PNG/JPG from the desktop onto the Background popover's ＋ tile.
**Expected:** Upload progress renders, then the new thumbnail appears highlighted and the chip updates.
**Why human:** Real OS-level `DataTransfer`/file-drop needs a browser (142-VALIDATION.md row 2).

### 3. Live audio playback (Track preview and no-MP3 vamp silence)
**Test:** Assign a Track and press ▶; assign a no-MP3 vamp and run the service.
**Expected:** Track preview plays audibly; a no-MP3 vamp bed produces no sound live while the amber chip/warning stay visible.
**Why human:** Live audio output cannot be verified in jsdom (142-VALIDATION.md row 3).

### 4. Vamp-tab subscription-error surfacing (backstop, plan 142-02)
**Test:** Force `useVampStore`'s subscription to error (e.g. transient Firestore read failure) while the Audio popover's Vamp tab is open.
**Expected:** The Vamp tab never renders blank — shows loading, existing rows, or a visible fallback.
**Why human:** `142-02-PLAN.md` explicitly tags this `verification: backstop` — `useVampStore` has no dedicated error state today (an inherited gap from 141-UI-SPEC, not touched by this phase). No test or code path proves this either way; abstaining per the honest-verifier rule rather than assuming pass.

### 5. Firestore write-failure-then-render surfacing (backstop, plan 142-04)
**Test:** Trigger a rejected Background/Audio Firestore write (e.g. simulated permission-denied) and confirm the chip does not keep showing a value that never saved.
**Expected:** A failed write leaves the chip on its prior (last-saved) value, never the attempted-but-failed one.
**Why human:** `142-04-PLAN.md` explicitly tags this `verification: backstop` — the handlers still only `console.error` on failure (confirmed unchanged by source read) and the chip is purely `group`-prop-derived (so it cannot diverge from Firestore once re-rendered), but no automated test exercises the actual failed-write round trip.

### Gaps Summary

No gaps found. All 17 phase-level truths (derived from the ROADMAP goal + the union of all four plans'
`must_haves.truths`) are verified against the actual codebase — not just SUMMARY.md claims. Every artifact
exists, is substantive, and is wired through the full prop/emit chain from `SlidesTab` down to
`slideGroups.ts`. Type-check is clean (re-run by this verifier). The 8 plan-named test suites plus 3
regression suites (11 files, 574 tests) were re-run by this verifier and all pass. The one code-review
finding (WR-01) was fixed and its regression test passes. No debt markers, no stub returns, no orphaned
requirements. The only open items are the 3 Manual-Only Verifications already documented in
142-VALIDATION.md (visual/drag-drop/audio — none automatable) plus the 2 explicitly-declared `backstop`
must-haves that this phase inherited/carried forward rather than resolved — both are correctly deferred to
UAT by the plans themselves, not silently passed.

---

_Verified: 2026-09-19T07:17:06Z_
_Verifier: Claude (gsd-verifier)_
