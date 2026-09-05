---
phase: 124-grouped-file-list-in-app-preview-play-download-remove
reviewed: 2026-09-05T00:00:00Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - src/stores/songs.ts
  - src/components/SongFilesTab.vue
  - src/components/SongFilePreviewModal.vue
  - src/stores/__tests__/songs.test.ts
  - src/components/__tests__/SongFilesTab.test.ts
  - src/components/__tests__/SongFilePreviewModal.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 124: Code Review Report

**Reviewed:** 2026-09-05
**Depth:** deep
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed `removeSongAttachment` (songs.ts), the restructured grouped `SongFilesTab.vue`, and the new
`SongFilePreviewModal.vue`, plus their test files. `npm run type-check` (vue-tsc --build) is clean, and
all 161 tests across the 5 in-scope + composable/util test files pass.

The highest-priority item from the review brief — **does the preview modal's Escape/backdrop dismiss ever
bubble up and close the non-dismissing editing slideout?** — is verified NOT a problem: the modal's Escape
handler is a Vue `@keydown` template binding on the dialog root (a genuine DOM-scoped listener, not
`window`/`document`), and `SongSlideOver.vue` has **no** Escape/backdrop listener of any kind to bubble
into (confirmed by direct read + the file's own comment: "Escape is not wired here either" — the slideout
only closes via its own Close/X button). This is correctly implemented.

The main finding worth real attention is a **reachable lost-update race between two concurrent Remove
operations on the same song** (not the add-during-remove race the CONTEXT already accepted as low-risk,
but a *remove-during-remove* race the plain filter-by-id/read-then-write approach does not close). See
WR-01. Everything else is minor (an incomplete a11y focus-trap claim, dead code, and small edge-case
gaps).

## Warnings

### WR-01: Concurrent Remove-vs-Remove race can resurrect an attachment whose Storage object was already deleted

**File:** `src/stores/songs.ts:334-350`, `src/components/SongFilesTab.vue:152-163,255-266,383-400`
**Issue:**
`removeSongAttachment` reads `songs.value.find(...)` (the local onSnapshot cache) synchronously, filters
by id, and writes the **entire filtered array** back with a plain `updateDoc` (not `arrayRemove`, not a
transaction). The code comment justifies this by noting "removal is a user-initiated, one-at-a-time
action" — but nothing in the UI actually enforces one-at-a-time *at the operation level*, only at the
confirm-dialog level (`confirmingId` ensures only one confirm **card** is visible).

Concretely: `removingId`/`confirmingId` only disable the **same row's** Remove-confirm button
(`:disabled="removingId === a.id"`, `SongFilesTab.vue:188,312`). A different row's trash button
(`song-file-remove`, lines 152-163 / 255-266) is never disabled while another row's removal is still
in flight. So a user can:
1. Click trash on row A → confirm → click Remove (kicks off `removeSongAttachment(id, A)`, which is
   still awaiting the Firestore round trip).
2. While that's pending, click trash on row B (this collapses A's confirm card per the "only one open"
   rule, but does **not** cancel or await A's in-flight write) → confirm → click Remove.

Both calls independently read the **same stale** `songs.value` snapshot (containing both A and B),
filter out only their own target, and write back a full array. Whichever `updateDoc` lands second on the
server wins entirely (last-write-wins on the whole field) — the loser's removal is silently undone, i.e.
**the "removed" attachment reappears**, which directly contradicts the acceptance truth stated in
124-CONTEXT.md ("clicking Remove → confirm → the attachment disappears … and does not reappear").

This compounds badly with the Storage cleanup: if A's removal actually completes deleteObject() before
B's write resurrects A's Firestore record, the resurrected row now points at a **Storage object that no
longer exists** — an orphaned reference with no dedicated error UI (the 121-UI-SPEC's per-row "Couldn't
load this file." state was never wired up — see IN-04) so it just silently fails Download/Preview.

No test exercises this scenario (the existing `removeSongAttachment` describe block in `songs.test.ts`
only covers the single-remove happy path, link-skip, deleteObject-rejection-doesn't-throw, and the
orgId-unset no-op — contrast with `addSongAttachment`'s dedicated concurrent-writes test at
`songs.test.ts:822-845`).

**Fix:** Either (a) disable every row's trash-open button while any removal is in flight
(`:disabled="removingId !== null"` on the `song-file-remove` buttons, not just the confirm-button), which
closes the reachable window cheaply, or (b) make the removal itself safe against staleness — e.g. wrap
the read+write in `runTransaction` against the live server doc instead of the local cache, or fall back to
`arrayRemove` keyed on a stable subset of fields (id-only) via a second update pass. Add a test mirroring
`songs.test.ts:822`'s concurrent-add test but for two concurrent removes.

### WR-02: SongFilePreviewModal claims to reuse the CleanupEnableConfirmDialog "dialog shell" but drops its focus trap

**File:** `src/components/SongFilePreviewModal.vue:124-128,193-201`
**Issue:** The file's own top-of-script comment says it reuses "that dialog shell (backdrop, `role="dialog"
aria-modal`, DOM-scoped `@keydown`)". `CleanupEnableConfirmDialog.vue`'s `onKeydown` (lines 191-210 there)
implements a real Tab/Shift+Tab focus trap that cycles focus only among the dialog's own buttons.
`SongFilePreviewModal.vue`'s `onKeydown` (lines 196-201) handles **only** `Escape` — `Tab` is not
intercepted at all, and the dialog contains an `<iframe>` (a focusable element) plus Download/Close
buttons. With no trap, Tab from the last focusable element can move focus out of the modal into content
behind it (the underlying `SongSlideOver` panel is still mounted/visible, just visually covered by the
`z-50` overlay) while the modal is still open — a real keyboard-accessibility regression relative to the
component this claims to model itself on.
**Fix:** Port the Tab/Shift+Tab cycling logic from `CleanupEnableConfirmDialog.vue:191-210`, scoping the
focusable set to Close + Download (+ the iframe, if it should be reachable at all).

### WR-03: `removeSongAttachment`'s Firestore write failure is unhandled — no user-facing error on Remove failure

**File:** `src/stores/songs.ts:334-350`, `src/components/SongFilesTab.vue:389-400`
**Issue:** The review brief's "must not throw to the UI" requirement is satisfied for the **Storage**
delete (correctly try/caught and logged, matching `hardDeleteSong`'s convention) — but the `updateDoc`
call itself (the actual record removal) has no try/catch anywhere in the call chain. If it rejects
(permission-denied, offline, etc.), the rejection propagates out of `removeSongAttachment` through
`confirmRemove`'s `finally`-only block (`SongFilesTab.vue:396-399`) as an unhandled promise rejection —
the confirm card silently closes (state reset in `finally`) with zero feedback that the remove did not
happen. This mirrors the exact same gap already present in `SongSlideOver.vue`'s `onSave`/`onDelete`
(`try { await … } finally { … }`, no `catch`), so it is a **pre-existing systemic pattern**, not a
regression introduced by this phase — flagging because Remove's specific promise ("this can't be undone")
makes a silently-failed-but-looks-successful removal worse than most other silent-failure sites in this
codebase.
**Fix:** At minimum, catch and surface a toast/error state on the `updateDoc` failure path so a failed
removal doesn't look identical to a successful one to the user.

## Info

### IN-01: `dialogRootRef` is bound but never read

**File:** `src/components/SongFilePreviewModal.vue:34,143`
**Issue:** `dialogRootRef` is declared (`ref<HTMLElement | null>(null)`) and attached via `ref="dialogRootRef"`
in the template, but the script never reads `dialogRootRef.value` anywhere — the Escape handler is wired
via the Vue `@keydown` event binding directly, not through this ref. Dead variable.
**Fix:** Remove the unused ref (or use it for the WR-02 focus-trap fix, at which point it stops being dead).

### IN-02: `formatSize()` treats a genuine 0-byte file the same as "no size known"

**File:** `src/components/SongFilesTab.vue:453-456`
**Issue:** `if (!bytes) return ''` — `0` is falsy, so a real (if unlikely) 0-byte upload renders with no
size field at all instead of "0.0 MB", identical to the "unknown size" case. Harmless in practice (files
this small don't occur) but a `bytes == null` check would be more correct than a truthiness check on a
numeric field.
**Fix:** `if (bytes == null) return ''`.

### IN-03: Dead branch in `metaLine()`

**File:** `src/components/SongFilesTab.vue:472-481`
**Issue:** `metaLine()` already `return`s early for `a.kind === 'link'` (line 474-477). The remaining code's
`a.kind === 'document' || a.kind === 'audio' ? TYPE_LABELS[a.kind] : ''` (line 478) can never take the
`: ''` branch, since `SongAttachmentKind` is only `'document' | 'audio' | 'link'` and `'link'` already
returned. Harmless but a needless defensive branch that obscures the real logic.
**Fix:** `TYPE_LABELS[a.kind as 'document' | 'audio']` (or narrow the type at the call site) — the ternary
adds no protection.

### IN-04: 121-UI-SPEC's per-row load-failure ("Couldn't load this file." + Retry) state was not implemented

**File:** `src/components/SongFilesTab.vue` (whole grouped-rows section)
**Issue:** `121-UI-SPEC.md` §6/7 documents an `error` state for an individual row ("Couldn't load this
file." + a Retry action replacing Download) as part of the design contract this phase consumes. No such
state exists in `SongFilesTab.vue` — rows render their metadata/actions unconditionally off whatever is
in `props.attachments`. Given the UI-SPEC's own note that this surface has no fetch step ("attachments
ride the already-subscribed Song doc … renders synchronously, no separate fetch"), the practical exposure
is low — but it does become directly relevant if WR-01 is ever hit (a resurrected row pointing at a
deleted Storage object has no distinguishing UI at all).
**Fix:** Low priority; worth a follow-up ticket rather than blocking, but tie it to WR-01's fix if that is
addressed.

---

_Reviewed: 2026-09-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
