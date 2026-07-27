---
phase: 25-slides-tab-shell-plan-rail-and-slide-grid-risk-medium
fixed_at: 2026-07-27T00:45:54Z
review_path: .planning/phases/25-slides-tab-shell-plan-rail-and-slide-grid-risk-medium/25-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 25: Code Review Fix Report

**Fixed at:** 2026-07-27T00:45:54Z
**Source review:** .planning/phases/25-slides-tab-shell-plan-rail-and-slide-grid-risk-medium/25-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (CR-01 Critical, CR-02 Critical, WR-01 Warning, WR-02 Warning — WR-02
  "no regression test exists for either concurrency race" was folded into CR-01/CR-02's own fixes
  per task instructions, not treated as separate work; IN-01 Info was explicitly out of scope)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: `materializeGroupIfMissing`'s non-merge `setDoc` can silently erase a concurrently-attached group bed (asymmetric WR-01 race)

**Files modified:** `src/stores/slideGroups.ts`, `src/stores/__tests__/slideGroups.test.ts`
**Commit:** `8c8492a`
**Applied fix:** Applied the review's suggested fix as-is — `materializeGroupIfMissing`'s
skeleton-create `setDoc` now passes `{ merge: true }` as its third argument, mirroring Phase 24's
WR-01 fix to `setGroupBedMedia`'s own skeleton-create. This only changes behavior inside the race
window (the branch only ever runs when `getDoc` found no existing document): `input`'s `slides` key
is always present in the payload, so merge still authoritatively replaces `slides` rather than
resurrecting a stale array — only `bedAudioUrl` (absent from `input` per D-19) can ever survive from
a racing `setGroupBedMedia` write, exactly as intended. Documented this asymmetry explicitly in the
function's doc comment per the design guidance's caution about merge writes and stale `slides`.

Added the WR-02-required regression coverage: one test asserting the create call now carries
`{ merge: true }` and omits `bedAudioUrl` from its own payload, and one reverse-order reproduction
test (`setGroupBedMedia`'s skeleton lands first, `materializeGroupIfMissing` lands second, both
having independently seen the document absent) asserting both writes are merge writes and the
second payload never claims the bed field — the mechanism that guarantees `bedAudioUrl` survives.
All 27 tests in the file pass, `npm run type-check` and `npm run build` both exit 0.

### CR-02: Group-slide write paths have no in-flight guard — a fast double-invocation silently loses a just-added entry

**Files modified:** `src/stores/slideGroups.ts`, `src/stores/__tests__/slideGroups.test.ts`,
`src/components/slides/SlideGrid.vue`, `src/components/slides/__tests__/SlideGrid.test.ts`,
`src/composables/useSlideshowAssembly.ts`
**Commit:** `30ddd0a`
**Applied fix:** Chose option (b) from the review's own fix note — the review explicitly said
fixing this once inside `replaceGroupSlides` is more robust than guarding every caller
individually, given how many independent call sites share this shape (add-slide, import,
video-append, drag-reorder in `SlideGrid.vue`, and the reconciliation watcher in
`useSlideshowAssembly.ts`, which runs in a separate composable instance an in-flight guard local to
`SlideGrid.vue` could never see).

`replaceGroupSlides` now accepts an optional 5th argument, `baseSlides` — the entries snapshot the
caller actually read before computing its own next `slides` array. When supplied, the write goes
through a `runTransaction` compare-and-swap: inside the transaction, the live document is read and
diffed against `baseSlides` by entry id. Any entry present on the live document but absent from
BOTH `baseSlides` and the caller's own `slides` payload was added by a different, concurrent write
that landed after this caller took its snapshot — it is re-appended (via a new
`mergeConcurrentlyAddedEntries` helper) rather than silently discarded by the overwrite. This closes
both the append-vs-append race (two callers computing the same delta from the same stale base) and
the append-vs-reorder race named explicitly in the review, since whichever write loses the commit
race re-derives against the other write's already-landed result. Concurrent DELETIONS are
explicitly out of scope (no delete-a-slide path exists yet — Phase 26), documented as such in the
doc comment. Omitting `baseSlides` keeps the previous plain-`updateDoc` behavior unchanged for any
caller not yet updated (none remain after this fix — all five call sites now pass it).

Updated all four `SlideGrid.vue` write paths (`onAddSlide`, `onImportConfirmed`,
`appendVideoEntries`, drag-reorder's `onEnd`) and `useSlideshowAssembly.ts`'s
`applyReconciliationOutcomes` to pass their own pre-write snapshot through as `baseSlides`.

Added the WR-02-required regression coverage at the store level (exercising the real, unmocked
`replaceGroupSlides` function rather than a mock, which is where the actual merge logic lives):
a no-`baseSlides` legacy-fast-path test, a no-conflict transaction test, a concurrently-added-entry
survival test (the fast-double-click / overlapping-append reproduction WR-02 asked for — both
entries present in the final write), and a drag-reorder-vs-concurrent-append test (the
append-vs-reorder case the review named explicitly — the reorder's full-array overwrite still
recovers the entry it never knew about). `SlideGrid.test.ts` gained two assertions confirming the
correct snapshot is passed through as `baseSlides` at the add-slide and drag-reorder call sites.
All 111 tests across the three touched test files pass, `npm run type-check` and `npm run build`
both exit 0.

### WR-01: A group's bed audio still layers onto a video slide's own playback, in tension with D-18

**Files modified:** `src/utils/slideshowAssembler.ts`, `src/utils/__tests__/slideshowAssembler.test.ts`
**Commit:** `29a3a14`
**Applied fix:** Per the design guidance, resolved this as **not intentional** and applied the
review's suggested fix: `resolveEntryMedia` now returns `{ audioFromBed: false }` unconditionally
for any `entry.sourceRef.kind === 'video'`, before the existing D-04 precedence logic runs — a video
entry never resolves the group's `bedAudioUrl`, regardless of whether it has its own `entry.audioUrl`.
This extends D-04's existing "slide beats group" precedence to video: a dropped video is a
self-contained unit per D-18, so it suppresses the bed for its own duration; the bed simply resumes
on whatever slide follows, since `resolveEntryMedia` is evaluated independently per entry with no
cross-entry state to carry — no explicit "resume" logic was needed. No change was needed in
`PresentationViewer.vue`: `currentAudioUrl` already reads `slide.audioUrl` directly with no
video-specific branching, so once the assembler stopped emitting an `audioUrl` for these entries,
the viewer naturally never mounts both an `AudioPlayer` and the video's own soundtrack at once.

Updated the one existing test that asserted the old (unintended) behavior — "a video entry in a
group that ALSO has an audio bed" — to assert the video suppresses the bed (`audioFromBed: false`,
no `audioUrl` key) instead of inheriting it, and added a second test confirming the bed resumes on
the very next (non-video) entry in the same group. No other D-04 precedence test needed changes —
they exercise `lyric`/`scripture` entries, which are untouched by the new `video`-kind early return.
All 46 tests in the file pass, `npm run type-check` and `npm run build` both exit 0.

**⚠ Behavioral decision requiring human-verify confirmation:** this fix makes video slides
categorically suppress the group's bed audio for their own duration (no per-video override). If a
future workflow wants bed music to keep playing quietly underneath a dropped video clip, that would
need to be an explicit, separate decision — this fix assumes the review's framing (a video slide is
a fully self-contained unit, D-18) is correct and applies it uniformly. Please confirm this is the
desired behavior at the Phase 25 batch human-verify pass; if not, `resolveEntryMedia`'s new
early-return branch in `src/utils/slideshowAssembler.ts` is the single, well-isolated place to revisit.

## Skipped Issues

None — all 4 in-scope findings were fixed.

## Verification Performed

- `npx vitest run src/stores/__tests__/slideGroups.test.ts` — 27/27 pass.
- `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts` — 51/51 pass.
- `npx vitest run src/composables/__tests__/useSlideshowAssembly.test.ts` — 33/33 pass.
- `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts` — 46/46 pass.
- Each of the three commits was independently verified at its own commit boundary (via a
  `git stash push --keep-index` snapshot check) to confirm `npm run type-check` passes and the
  affected test files pass at THAT commit — not just at the final combined state — since CR-01 and
  CR-02 both touch `src/stores/slideGroups.ts`/its test file in non-overlapping regions.
- `npx vitest run src/` (full sweep, final combined state) — 10 failing FILES, and all 10 are
  exactly the pre-existing documented baseline (8 `.gsd/quarantine/worktrees/**` stale duplicates,
  `src/storage.rules.test.ts` requiring the Storage emulator, `src/views/__tests__/RosterView.test.ts`'s
  stale pre-existing "Roles config" assertion). 3320 tests passed (up from the Phase 24 baseline of
  3018, consistent with Phase 25's own new coverage). Zero new failures introduced by these fixes;
  the failing-file SET did not grow past the documented 10.
- `npm run type-check` — exits 0, no errors, at the final combined state.
- `npm run build` — exits 0, production bundle produced successfully, at the final combined state.

## Logic-Complexity Note

CR-02's fix (a Firestore transaction with a custom concurrent-entry-recovery diff) and WR-01's fix
(a categorical behavior change to which entries receive bed audio) are both genuine logic changes
to data-integrity- and UX-relevant paths, not pure syntax edits. Both are backed by passing unit
tests that directly exercise the new behavior (concurrent-append survival, append-vs-reorder
survival, video-suppresses-bed, bed-resumes-on-next-slide), and `npm run type-check`/`npm run build`
both stayed green throughout — but per this task's own instructions, WR-01 is called out above as a
**behavioral decision requiring explicit human-verify confirmation** (not just a bug fix), and CR-02's
`mergeConcurrentlyAddedEntries` helper is a new, non-trivial merge algorithm on the group's write
path that is worth a human skim of `src/stores/slideGroups.ts`'s `replaceGroupSlides` before this
ships, given it is the sole write path every slide-group mutation in the app now goes through.

---

_Fixed: 2026-07-27T00:45:54Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
