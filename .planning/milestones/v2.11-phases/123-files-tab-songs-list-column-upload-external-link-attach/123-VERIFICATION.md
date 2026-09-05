---
phase: 123-files-tab-songs-list-column-upload-external-link-attach
verified: 2026-09-05T19:45:00Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
batched_uat_items:
  - test: "Visually compare the running Files tab (drop zone, link field, upload progress, attachment rows) to 121-song-files-mock.html and the 121-UI-SPEC for pixel/spacing/color fidelity."
    expected: "Drop zone copy, colors, spacing, and states match the mock; drag-over treatment, progress bar color, and rejection-row styling match the UI-SPEC."
    why_human: "Visual fidelity cannot be verified by grep/unit tests. Per the verify task's explicit instruction, this is recorded as a milestone-batched owner-facing UAT item (not a phase gate), matching this project's established batched-UAT pattern (see v2.7-DEFERRED-VERIFICATION.md)."
  - test: "Exercise the real drag-and-drop UX in a browser: drag a PDF and an MP3 from the OS file explorer onto the drop zone, and drop several files including one oversized/wrong-type file in the same gesture."
    expected: "Drag-over highlight appears/clears correctly, all valid files upload with independent progress, the bad file shows its rejection message inline without blocking the others."
    why_human: "jsdom's synthetic `trigger('drop', ...)` in the unit tests proves the event handler wiring, not real OS drag-and-drop behavior (dataTransfer semantics, browser file-type sniffing) which requires a real browser/manual test. Batched into the same milestone UAT pass as the visual-fidelity item above."
---

# Phase 123: Files Tab, Songs List Column, Upload & External Link Attach Verification Report

**Phase Goal:** An editor can SEE, GROW, and LINK a song's attachment collection: a Files tab in the Edit
Song slideout (R361), a Songs-list Files column (R362), multi-file upload with per-file progress (R363),
and external media link attach (R365). Per-row preview/play/download/remove and the polished
Documents/Audio grouping (R366/R367/R368) are Phase 124 — correctly NOT built here.

**Verified:** 2026-09-05T19:45:00Z
**Status:** passed — every automated criterion holds; the two items below are the milestone's batched
visual/drag-drop UAT (per the verify task's explicit instruction), not phase-blocking gaps.
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | R361: SongSlideOver has a third `Files` tab beside Details/Lyrics with a count badge shown only when count>0 | ✓ VERIFIED | `SongSlideOver.vue:123-137` renders `tab-files` button with `v-if="filesCount > 0"` badge (`:134-136`); `activeTab` typed `'details' \| 'lyrics' \| 'files'` (`:392`) |
| 2 | R361: `SongEditTab`/`VALID_TABS` include `'files'` | ✓ VERIFIED | `src/utils/songEditLink.ts:4,6` — `type SongEditTab = 'details' \| 'lyrics' \| 'files'`; `VALID_TABS: readonly SongEditTab[] = ['details', 'lyrics', 'files']`. Confirmed by `songEditLink.test.ts` "accepts the files tab" (11/11 pass) |
| 3 | R361: Files tab renders a functional attachment list resolved LIVE from the store (just-uploaded file appears without reopen) | ✓ VERIFIED | `SongSlideOver.vue:399-403` `liveAttachments` computed reads `songStore.songs.find(s => s.id === id)?.attachments`, not stale `props.song`; test "resolves attachments LIVE from songStore.songs by id rather than the stale props.song reference" passes (`SongSlideOver.test.ts`, 34/34 pass) |
| 4 | R362: SongTable has a toggleable `Files` column (paperclip + `none`/`1 file`/`N files`) gated on `columnVisibility.files` | ✓ VERIFIED | `SongTable.vue:157-164` (th), `:291-299` (td, paperclip SVG + `filesLabel(song)`), both `v-if="songStore.columnVisibility.files"`; `{ key: 'files', label: 'Files' }` in `toggleableColumns` (`:355`); `files: true` in `DEFAULT_COLUMN_VISIBILITY` (`src/stores/songs.ts:59`). 6 dedicated tests in `SongTable.test.ts` pass (25/25 total) |
| 5 | R362: count derives from `attachments?.length` | ✓ VERIFIED | `filesLabel()` (`SongTable.vue:510-515`): `song.attachments?.length ?? 0` → `none`/`1 file`/`N files`, safe for legacy songs |
| 6 | R363: `useSongFileUpload` uploads several files at once with per-file progress; per-file client validation rejects wrong-type/oversize with UI-SPEC copy while valid files continue; completed uploads persist | ✓ VERIFIED | `useSongFileUpload.ts` — `addFiles()` loops all files, independent `UploadRow` per file, index-based reactive progress updates (`:120-172`); `validateSongFile()` (`:62-77`) rejects and `continue`s per file without blocking others (proven by "rejects a wrong-type file... while a valid file in the same batch still uploads" test); completion persists via `addSongAttachment` |
| 7 | R365: external https link attach; source inference; `kind:'link'` attachment; opens in new tab with `rel="noopener noreferrer"` | ✓ VERIFIED | `songLinks.ts` `isValidExternalLink`/`inferLinkSource`/`buildLinkAttachment`; `SongFilesTab.vue:89-101` renders link rows as `<a target="_blank" rel="noopener noreferrer">`; `submitLink()` (`:198-209`) validates then calls `addSongAttachment`. 16/16 `songLinks.test.ts` + dedicated `SongFilesTab.test.ts` link tests pass |
| 8 | CR-01 fix: atomic `arrayUnion` append via `addSongAttachment`, no read-modify-write of the whole array, for both upload completion and link submit | ✓ VERIFIED | `src/stores/songs.ts:313-319` `addSongAttachment(id, attachment)` uses `arrayUnion(attachment)`; `useSongFileUpload.ts:157` and `SongFilesTab.vue:207` both call it (no `existingAttachments` snapshot remains in `AddFilesContext`). Regression-guard test "two overlapping addSongAttachment calls each land as their own independent arrayUnion write" passes in `songs.test.ts` |

**Score:** 8/8 truths verified

### Fix Confirmation (Code Review CR-01, WR-01, WR-02)

| Finding | Fix Claimed | Verified in Code |
|---------|-------------|-------------------|
| CR-01 (Critical — lost-update race) | Atomic `arrayUnion` append via new `addSongAttachment` store method, routed from both upload-completion and link-submit | ✓ Confirmed — `src/stores/songs.ts:313-319`, called at `useSongFileUpload.ts:157` and `SongFilesTab.vue:207`. No remaining read-modify-write of the full `attachments` array in either path. |
| WR-01 (MIME must AND with extension) | `!hasAllowedMime \|\| !hasAllowedExt` (both must agree) | ✓ Confirmed — `useSongFileUpload.ts:66`. Test "rejects a file whose extension is allowed but MIME type disagrees" passes. |
| WR-02 (reject exactly-50MB) | `file.size >= SONG_FILE_MAX_BYTES` | ✓ Confirmed — `useSongFileUpload.ts:73`. Test "WR-02: rejects a file of exactly 50MB" passes. |

### Scope Boundary Check (R366/R367/R368 correctly NOT built here)

- `SongFilesTab.vue`'s attachment list rows (`:86-137`) render icon + name + basic type/size meta only.
  `grep` confirms **no** preview/play/download/remove buttons: `SongFilesTab.test.ts`'s "renders a document
  row with name and no download/preview/remove action button" test explicitly asserts
  `row.findAll('button')).toHaveLength(0)` and passes.
- No Documents/Audio grouped sections exist — attachments render as a single flat list (`v-for="a in attachments"`),
  matching the phase's explicit "simple functional rows" boundary.
- `.planning/REQUIREMENTS.md` confirms R366/R367/R368 are `[ ]` unchecked and mapped to "Phase 124 | Pending"
  (lines 60-67, 140-142), while R361/R362/R363/R365 are `[x]` checked and mapped to "Phase 123 | Complete"
  (lines 38-56, 135-139). No scope leakage in either direction.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/SongFilesTab.vue` | Drop zone, link field, upload rows, attachment list | ✓ VERIFIED | Exists, substantive (228 lines), wired into `SongSlideOver.vue:352-357`, 14/14 own tests pass |
| `src/composables/useSongFileUpload.ts` | Multi-file upload composable | ✓ VERIFIED | Exists, substantive, wired into `SongFilesTab.vue:143,156`, 9/9 own tests pass |
| `src/utils/songLinks.ts` | Link validation/source-inference/builder | ✓ VERIFIED | Exists, substantive, wired into `SongFilesTab.vue:145`, 16/16 own tests pass |
| `src/stores/songs.ts` (`addSongAttachment`) | Atomic append method | ✓ VERIFIED | Exists (`:313-319`), exported in store return (`:533`), wired from both call sites |
| `src/components/SongSlideOver.vue` | Files tab + badge + live attachments | ✓ VERIFIED | Exists, wired, 34/34 own tests pass |
| `src/components/SongTable.vue` | Files column | ✓ VERIFIED | Exists, wired, 25/25 own tests pass |
| `src/utils/songEditLink.ts` | `'files'` in `SongEditTab`/`VALID_TABS` | ✓ VERIFIED | Confirmed, 11/11 own tests pass |

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| `SongFilesTab.vue` (drop zone / input) | `useSongFileUpload().addFiles` | `@drop`/`@change` handlers | ✓ WIRED |
| `useSongFileUpload.ts` (completion) | `songStore.addSongAttachment` | direct call, atomic arrayUnion | ✓ WIRED |
| `SongFilesTab.vue` (`submitLink`) | `songStore.addSongAttachment` | direct call, atomic arrayUnion | ✓ WIRED |
| `SongSlideOver.vue` (`liveAttachments`) | `songStore.songs` (Pinia state) | `.find(s => s.id === id)` | ✓ WIRED — live, not stale prop |
| `SongTable.vue` (Files column) | `song.attachments` | `song.attachments?.length` | ✓ WIRED |
| `useMediaUpload.ts` | `songFiles.ts` `sanitizeFileName` | import, no private duplicate | ✓ WIRED (IN-03 dedupe confirmed) |

### Behavioral Spot-Checks / Gates

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Type-check | `npm run type-check` | Clean, no errors | ✓ PASS |
| Full app suite | `npx vitest run` | 194/195 files passed, 5196 tests passed, 35 skipped; only `src/storage.rules.test.ts` failed (`ECONNREFUSED 127.0.0.1:8080` — Storage emulator not running) | ✓ PASS (matches documented baseline exactly) |
| Phase-specific suites (isolated re-run) | `npx vitest run SongSlideOver.test.ts SongTable.test.ts SongFilesTab.test.ts useSongFileUpload.test.ts songs.test.ts` | 5/5 files, 183/183 tests passed | ✓ PASS |
| CR-01 regression guard | `songs.test.ts` "two overlapping addSongAttachment calls each land as their own independent arrayUnion write" | pass | ✓ PASS |
| WR-01 regression guard | `useSongFileUpload.test.ts` "rejects a file whose extension is allowed but MIME type disagrees" | pass | ✓ PASS |
| WR-02 regression guard | `useSongFileUpload.test.ts` "rejects a file of exactly 50MB" | pass | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R361 | 123-03 | Files tab + live count badge | ✓ SATISFIED | Tab bar, badge, live computed all confirmed in code + tests |
| R362 | 123-02 | Songs-list Files column | ✓ SATISFIED | Column th/td, paperclip, filesLabel, cog toggle confirmed |
| R363 | 123-01, 123-03 | Multi-file upload + per-file progress + client validation | ✓ SATISFIED | Composable + drop zone + progress rows + rejection copy confirmed |
| R365 | 123-01, 123-03 | External media link attach | ✓ SATISFIED | songLinks helpers + link field + new-tab anchor confirmed |
| R364 | 123-01 (validation logic) | Type/size restrictions enforced client + server | ✓ SATISFIED (referenced) | Client validation now exactly mirrors storage.rules boundaries (WR-01/WR-02 fixes) — attributed to Phase 122's storage.rules + this phase's client-side alignment |

No orphaned requirements found for this phase — R361/R362/R363/R365 are the only requirements mapped to
Phase 123 in REQUIREMENTS.md, and all four are addressed.

### Anti-Patterns Found

None found. Scanned all phase-touched files (`SongFilesTab.vue`, `SongSlideOver.vue`, `SongTable.vue`,
`useSongFileUpload.ts`, `songLinks.ts`, `songs.ts`, `songEditLink.ts`) for `TBD`/`FIXME`/`XXX`/`TODO`/
`HACK`/`PLACEHOLDER`/empty-return stubs — none present. The one `catch { return params.href }` fallback in
`songLinks.ts` (IN-02, unreachable given current caller) is defensive code, not a stub, and was explicitly
scoped out of this review-fix round as optional/low-value per 123-REVIEW-FIX.md.

### Batched UAT Items (not phase-blocking)

Per this verify task's explicit instruction, these are recorded as milestone-batched owner-facing UAT
items rather than a `human_needed` phase gate, consistent with this project's established pattern
(e.g. v2.7-DEFERRED-VERIFICATION.md):

1. **Visual fidelity to 121-UI-SPEC / mock** — compare running Files tab (drop zone, link field, progress
   rows, attachment list) against `121-song-files-mock.html` for spacing/color/icon-glyph accuracy. Unit
   tests prove structure and behavior, not pixel parity.
2. **Real drag-and-drop UX** — jsdom's synthetic `trigger('drop', ...)` proves event-handler wiring but not
   real OS drag-and-drop semantics (dataTransfer, browser MIME sniffing). Exercise in a real browser.

### Gaps Summary

No functional gaps found. All four in-scope requirements (R361, R362, R363, R365) are implemented, wired,
and covered by passing unit tests. The one Critical and two Warning findings from the code review
(CR-01 lost-update race, WR-01 MIME/extension OR-logic gap, WR-02 exactly-50MB boundary mismatch) were
verified fixed directly in the source — not merely claimed in 123-REVIEW-FIX.md — with regression-guard
tests for each. The Phase 124 boundary (R366/R367/R368: grouped Documents/Audio sections, in-app
preview/play, download/remove actions) is correctly NOT present in this phase's code, matching the
phase's explicit scope contract. `npm run type-check` is clean and the full `npx vitest run` suite matches
the documented CLAUDE.md baseline exactly (only the Storage-emulator-dependent `storage.rules.test.ts`
fails, unrelated to this phase). The two batched-UAT items above (visual fidelity, real-browser drag-drop)
are milestone-level, not evidence of an unmet truth.

---

_Verified: 2026-09-05T19:45:00Z_
_Verifier: Claude (gsd-verifier)_
