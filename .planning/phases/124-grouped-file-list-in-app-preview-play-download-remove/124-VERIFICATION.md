---
phase: 124-grouped-file-list-in-app-preview-play-download-remove
verified: 2026-09-05T21:40:00Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 124: Grouped File List, In-App Preview/Play, Download & Remove Verification Report

**Phase Goal:** An editor can browse, preview, play, download, and safely remove a song's attachments.
R366 (Documents/Audio grouped rows + metadata + per-group empty states), R367 (in-app PDF preview modal +
inline MP3 player), R368 (download + remove with removes-everywhere confirm). This is the **final phase
of v2.11**.

**Verified:** 2026-09-05
**Status:** passed
**Re-verification:** No — initial verification

## VERIFICATION PASSED

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | R366: SongFilesTab renders Documents/Audio groups with graceful metadata (no undefined/NaN/Invalid Date) and per-group empty states | ✓ VERIFIED | `src/components/SongFilesTab.vue:90-221` (Documents group), `:212-335` (Audio group); `formatAttachmentDate` guards on callable `toDate()` (L527-531, mirrors TeamView.vue), `formatSize` guards `bytes == null` (L515-520, IN-02 fixed); per-group empty lines at L97-99/L219-221; tests in `SongFilesTab.test.ts` cover group split, per-group empty copy, graceful metadata incl. the `{}`-createdAt fixture |
| 2 | R367: PDF preview modal dismisses on Escape/backdrop/Close via a DOM-scoped `@keydown` (never window/document), so it cannot bubble to and close SongSlideOver's non-dismissing editing panel | ✓ VERIFIED | `SongFilePreviewModal.vue:40` (`@keydown="onKeydown"` bound on the dialog root div, not window/document), `:219-224` (Escape branch); `SongFilePreviewModal.test.ts` asserts Escape-on-dialog-root emits close and non-Escape keydowns do not; code-reviewed and confirmed in 124-REVIEW.md ("This is correctly implemented") |
| 3 | R367: MP3 = inline `<audio controls>`, one at a time, native error fallback | ✓ VERIFIED | `SongFilesTab.vue:275-282` (`<audio>` gated on `playingId === a.id`, single `playingId` ref makes one-at-a-time structural), `:283-295` (error fallback text + Download); tests cover Play-reveals-audio, second-Play-collapses-first, native-error fallback |
| 4 | R368: grouped rows expose Download + Remove (editor-only); remove uses the removes-everywhere confirm and count/badge update live; removed attachment does not reappear | ✓ VERIFIED | Download buttons at L127-138/L251-261 wired to `downloadAttachment`; Remove buttons at L152-163/L262-273 open inline confirm (L165-201/L296-332) with the exact removes-everywhere copy; `confirmRemove` calls `songStore.removeSongAttachment` (never mutates `props.attachments` directly — comment at L422-424 confirms live update flows through `onSnapshot`); `/songs` route is `requiresEditor: true` (`router/index.ts:40`) and `SongFilesTab` is only reached via `SongSlideOver.vue`, so Remove is inherently editor-only; WR-01 concurrent-remove regression test (`songs.test.ts:991-1004`) proves neither of two concurrent removes resurrects the other |
| 5 | Post-review FIX A (user-reported download bug): row Download is a `downloadAttachment()` fetch→blob→object-URL handler, not a bare cross-origin `<a :href download>` that navigates the window; falls back to `window.open(..., '_blank', 'noopener')` on fetch failure | ✓ VERIFIED | `SongFilesTab.vue:446-462`; comment block at L437-445 explains the cross-origin `download`-attribute bug this fixes; `SongFilesTab.test.ts:560-604` — one test asserts fetch→blob→createObjectURL→click→revokeObjectURL, another asserts the `window.open` fallback on fetch rejection. The link-row open-in-new-tab anchor (L139-151) is untouched. |
| 6 | Post-review WR-01: `removeSongAttachment` uses `runTransaction` (race-safe, no resurrection) | ✓ VERIFIED | `songs.ts:345-357` — `runTransaction(db, ...)` reads the live server doc (`tx.get(ref)`), filters by id, `tx.update`; `songs.test.ts:991-1004` runs two concurrent removes on different attachments of the same song and asserts both stick |
| 7 | Post-review WR-03 + WR-02: a failed Remove surfaces an inline error and keeps confirm open (Storage delete stays non-throwing); `SongFilePreviewModal` has a Tab/Shift+Tab focus trap | ✓ VERIFIED | WR-03: `SongFilesTab.vue:418-435` `confirmRemove` catches the transaction rejection, sets `removeError` (rendered at L194-200/L325-331 via `data-testid="song-file-remove-error"`), does not reset `confirmingId` on failure; Storage `deleteObject` try/catch is unchanged (`songs.ts:358-364`, never throws). WR-02: `SongFilePreviewModal.vue:204-245` `getFocusableElements()` + `onKeydown`'s Tab/Shift+Tab wrap logic; `SongFilePreviewModal.test.ts:120-146` tests both wrap directions |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/SongFilesTab.vue` | Grouped Documents/Audio rows + Preview/Play/Download/Remove actions | ✓ VERIFIED | Substantive, wired into `SongSlideOver.vue`, renders live `props.attachments` |
| `src/components/SongFilePreviewModal.vue` | PDF iframe preview modal, dismiss + focus trap | ✓ VERIFIED | Mounted once at SongFilesTab root (L206-210), driven by `previewAttachment` ref |
| `src/stores/songs.ts` (`removeSongAttachment`) | Transaction-safe removal + best-effort Storage cleanup | ✓ VERIFIED | Exported at L580, used by SongFilesTab's `confirmRemove` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `SongFilesTab.vue` Remove button | `songs.ts#removeSongAttachment` | `confirmRemove()` → `songStore.removeSongAttachment(props.songId, a)` | WIRED | L425 |
| `SongFilesTab.vue` Preview button | `SongFilePreviewModal.vue` | `previewAttachment = a` prop binding | WIRED | L120, L207-209 |
| `SongFilesTab.vue` Download button | `downloadAttachment()` | `@click="downloadAttachment(a)"` fetch→blob | WIRED | L133, L256, L446-462 |
| `SongFilesTab` mount site | `/songs` route guard | `requiresEditor: true` | WIRED | `router/index.ts:40`; only reachable via `SongSlideOver.vue` |

### Behavioral Spot-Checks / Test Evidence

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Type-check clean | `npm run type-check` (vue-tsc --build) | No errors | ✓ PASS |
| App suite at documented baseline | `npx vitest run` | 195/196 files passed, 5234/5269 tests passed, 35 skipped; only `src/storage.rules.test.ts` fails (ECONNREFUSED 127.0.0.1:9199 — Storage emulator not running, documented pre-existing baseline per CLAUDE.md) | ✓ PASS (matches documented baseline exactly) |
| WR-01 concurrent-remove regression test | `songs.test.ts` — "two concurrent removes on different attachments both stick" | Included in the 5234 passing tests | ✓ PASS |
| WR-02 focus-trap tests (Tab/Shift+Tab wrap) | `SongFilePreviewModal.test.ts` describe block "WR-02: Tab/Shift+Tab focus trap" | Included in the 5234 passing tests | ✓ PASS |
| FIX A download fetch/blob + fallback tests | `SongFilesTab.test.ts` describe block "FIX A: Download uses fetch+blob, never a same-window navigation" | Included in the 5234 passing tests | ✓ PASS |
| WR-03 inline remove-error test | `SongFilesTab.test.ts` — asserts `song-file-remove-error` text | Included in the 5234 passing tests | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R366 | 124-01 | Grouped Documents/Audio rows + metadata + empty states | ✓ SATISFIED | Truth #1 |
| R367 | 124-02 | In-app PDF preview modal + inline MP3 player | ✓ SATISFIED | Truths #2, #3 |
| R368 | 124-01 | Download + remove with removes-everywhere confirm | ✓ SATISFIED | Truth #4 |

REQUIREMENTS.md already marks R366/R367/R368 as `[x]` Complete, mapped to Phase 124 in its coverage table — consistent with the code evidence above. No orphaned requirements found for this phase.

### Anti-Patterns Found

None. Scanned `SongFilesTab.vue`, `SongFilePreviewModal.vue`, `songs.ts` for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` (case-insensitive) — the only hit was the HTML `placeholder="Paste a YouTube..."` attribute on the link input, a false positive, not a debt marker. No empty implementations, no hardcoded-empty stub patterns.

### Code Review Follow-Through

`124-REVIEW.md` (deep review, 2026-09-05) found 0 Critical, 3 Warning (WR-01, WR-02, WR-03), 4 Info (IN-01..IN-04), plus a separately user-reported download-navigation bug. All four post-review fixes were independently confirmed present in the current code (not just claimed in SUMMARY.md):

1. **Download bug (FIX A)** — `downloadAttachment()` fetch→blob→object-URL handler with `window.open` fallback, replacing the bare cross-origin `<a :href download>`. Confirmed at `SongFilesTab.vue:446-462`, tested at `SongFilesTab.test.ts:560-604`.
2. **WR-01** — `removeSongAttachment` now wraps its read+write in `runTransaction` against the live server doc. Confirmed at `songs.ts:345-357`, regression-tested at `songs.test.ts:991-1004`.
3. **WR-03** — a failed remove surfaces `data-testid="song-file-remove-error"` inline and keeps the confirm card open; Storage delete remains non-throwing. Confirmed at `SongFilesTab.vue:418-435` and `195-201/326-331`, tested at `SongFilesTab.test.ts:402-410` and others.
4. **WR-02** — `SongFilePreviewModal.vue` gained a Tab/Shift+Tab focus trap (`getFocusableElements()` + wrap logic in `onKeydown`). Confirmed at `SongFilePreviewModal.vue:200-245`, tested at `SongFilePreviewModal.test.ts:120-146`.

Info items (IN-01 dead ref, IN-02 zero-byte formatSize, IN-03 dead ternary branch, IN-04 no per-row load-error UI) were all either fixed alongside the warnings (IN-01 `dialogRootRef` is now read by the focus trap; IN-02's `bytes == null` guard is in place; IN-03's dead ternary was removed per the code comment at L543-544) or remain low-priority follow-up items (IN-04, explicitly deferred — no dedicated per-row load-failure state, acceptable per the review's own low-exposure assessment now that WR-01 closes the resurrection path that would have made it relevant).

## Batched Human UAT (non-blocking — deferred per this milestone's established pattern)

Phases 121/123/124 all explicitly defer visual/runtime verification to a single owner UAT pass at the end
of v2.11 (per each phase's SUMMARY.md "Next Phase Readiness" / "Deviations" sections and the project's
documented deferred-UAT convention). These items are recorded here for that batched pass — they do not
block this phase's `passed` status because every automated/code-verifiable criterion holds:

1. **Visual fidelity** — grouped rows / PDF modal / MP3 player spacing, colors, icon glyphs, and typography
   against `121-song-files-mock.html` and 121-UI-SPEC §6-10.
2. **Real-browser download behavior** — confirm the `downloadAttachment()` fetch→blob path actually
   prompts a Save dialog in production. This depends on the Firebase Storage bucket's CORS configuration
   allowing the app's origin for the `fetch()` call; if CORS blocks it, the code silently falls back to
   opening the file in a new tab (not a broken experience, but not the intended Save-dialog UX either).
   Worth checking/adjusting bucket CORS at UAT time.
3. **Real drag-drop** — dragging real files onto the drop zone in a real browser (jsdom drag events are
   simulated in tests).
4. **Real PDF render / MP3 playback** — the iframe actually renders a PDF and the native `<audio>` element
   actually plays an MP3 from a real `downloadUrl` (jsdom does not render PDFs or play audio).

## Gaps Summary

None. All observable truths for R366/R367/R368 are verified against actual code (not SUMMARY.md claims),
all four post-review fixes are present and independently tested, `npm run type-check` is clean, and the
app test suite is at its documented baseline (only the Storage-emulator-dependent `storage.rules.test.ts`
fails, a known pre-existing environment limitation unrelated to this phase).

---

*Verified: 2026-09-05*
*Verifier: Claude (gsd-verifier)*
