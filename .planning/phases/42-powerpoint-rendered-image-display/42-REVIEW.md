---
phase: 42-powerpoint-rendered-image-display
reviewed: 2026-08-07T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - firestore.rules
  - src/rules.test.ts
  - src/types/pptxRender.ts
  - src/types/slide.ts
  - src/types/slideGroup.ts
  - src/utils/renderedPagePaths.ts
  - src/utils/__tests__/renderedPagePaths.test.ts
  - src/utils/importedRenderReconciler.ts
  - src/utils/__tests__/importedRenderReconciler.test.ts
  - src/utils/slideGroupMaterializer.ts
  - src/utils/slideshowAssembler.ts
  - src/stores/pptxRenders.ts
  - src/stores/__tests__/pptxRenders.test.ts
  - src/composables/useSlideshowAssembly.ts
  - src/components/slides/slideDisplay.ts
  - src/components/slides/SlideCard.vue
  - src/components/PresentationViewer.vue
findings:
  critical: 1
  warning: 5
  info: 0
  total: 6
status: issues_found
---

# Phase 42: Code Review Report

**Reviewed:** 2026-08-07T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

The `firestore.rules` fix (adding the `pptxRenders` write exclusion, T-42-01) is correct and
well-tested: I audited the entire file for any other rule that could still grant write access to
`organizations/{orgId}/pptxRenders/{importId}` (per the focus-area instruction not to stop at the
two changed blocks) and found none — the dedicated block is read-only, the generic wildcard's
three-way exclusion is the only other rule touching nested single-segment collections, and the
catch-all denies everything else. `src/rules.test.ts`'s `pptxRenders` describe block genuinely
exercises the exclusion (an editor `updateDoc` attempting to flip `status: 'ready'` via the generic
wildcard, asserted `assertFails`) rather than merely re-testing the dedicated read block.

`importedRenderReconciler.ts`/`slideGroupMaterializer.ts`/`slideshowAssembler.ts` are genuinely pure
(no Firestore/Storage/Vue imports), the `deck.renderImportId` vs `deck.id`/`slot.importId` distinction
is consistently honored at every lookup site I traced (grid, presenter fallback, presenter
stored-group path, the composable's subscription/URL-resolution layer), the `renderFailureSentence`
mapping is a single table reused verbatim by both `SlideCard.vue` and `PresentationViewer.vue`, and
the `if (!content) continue`/`return` guards in `assembleSlideshow` are provably unreachable for
pending/failed renders since `importedEntryContent` never returns `undefined` for those modes. The
1-based/4-padded page-path convention and its off-by-one test coverage are correct.

The one Critical finding is a real, traceable data-loss defect: a PPTX slide's attached label/audio/
notes are silently discarded the moment its deck's render transitions from `pending`/`failed` to
`ready`, contradicting the explicit invariant `importedEntryIdentities`'s own doc comment claims to
uphold. The Warning findings cover an unbounded local cache, a fragile singleton-store teardown
pattern, a defensive-coding gap in the render-mode fallback, and two test-coverage gaps (one in the
rules suite, one in the listener-leak suite) relative to what the stated focus areas asked to be
proven.

## Critical Issues

### CR-01: `pending`/`failed` → `ready` render transition silently drops per-slide customization (label/audio/notes)

**File:** `src/utils/importedRenderReconciler.ts:129-146` (contract), `src/utils/slideGroupMaterializer.ts:285-297,343-355,474-547` (implementation)

**Issue:** `importedEntryIdentities`'s doc comment states the design contract explicitly:

> `ready` mode mints synthetic `rendered-page-N` identities (Fact 1 — no `deck.slides[i].id`
> pairing); every other mode reuses `deck.slides[i].id` **so a pending→ready transition for the
> first `deck.slides.length` slides can still carry forward any per-entry label/audio/notes a user
> set before the render completed.**

This is not what the code does. `pending` and `failed` modes key an entry's identity on
`deck.slides[i].id` (a parsed-slide UUID), while `ready` mode keys it on the synthetic
`rendered-page-N` string (`importedRenderReconciler.ts:142-146`). `slideGroupMaterializer.ts`'s
`derivedIdentityKey` for the `imported` ref kind is `` `imported:${ref.importId}:${ref.innerSlideId}` ``
(line 348) — so a stored entry minted while the deck was `pending` (key
`imported:{importId}:<parsed-uuid>`) and a freshly-derived entry once the deck turns `ready` (key
`imported:{importId}:rendered-page-1`) **never share a key**. `carryStoredDerivedEntries`
(`slideGroupMaterializer.ts:474-547`) only carries a stored entry forward when its key appears in the
fresh derivation; a key that never appears at all is dropped, not treated as surplus
(`slideGroupMaterializer.ts:538` comment: "A stored entry whose key never appears in `fresh` at all
... is DROPPED"). `isSlotDerivableRef`'s `IMPORTED` case (`slideGroupMaterializer.ts:291-292`) also
classifies every `imported` entry for this slot's `importId` as slot-derivable regardless of render
state, so `survivingEntries` never rescues it either — there is no fallback rescue path.

Net effect: for **every** parsed slide of a deck (not just some), any label, per-slide `audioUrl`,
`audioLoop`, or `notes` a user attaches via the "Edit details" 3-dot menu (`slideActionMenuItems`'s
`imported` case offers `edit-details`/`duplicate`/`delete` unconditionally — it does not gate on
`renderState`, and `EditSlideDrawer.vue` has no `renderState` awareness at all, confirmed by grep)
while the deck's render is still `pending` (or has `failed` and is being retried) is silently deleted
the instant the render completes, with the entry ids themselves also churning (breaking the
`GroupSlideEntry.id` stability invariant `slide.ts`/`slideGroup.ts` document elsewhere as load-bearing
for `PresentationViewer`'s per-slide media-component keying).

This is confirmed by the test suite's own asymmetry (`src/utils/__tests__/slideGroupMaterializer.test.ts`,
not in this phase's required-reading list but read for corroboration): the `pending -> ready`
idempotence test (`D-10`, lines ~2582-2608) asserts only `sourceRef`/count/order equality after the
transition and never asserts entry-`id` continuity, while the `ready -> ready` re-derivation test
(`Assumption A1`, lines ~2632-2659) explicitly asserts `carried.id === labeledGroup.slides[2]!.id`,
`carried.label`, and `carried.audioUrl` are preserved. No test anywhere asserts that a label/audio/
notes attached during `pending` survives into `ready` — because it does not.

**Fix:** Either (a) implement the carry-over the doc comment promises — e.g. give `pending`/`failed`
mode's identities a stable *positional* fallback key (`` `imported:${importId}:pos:${index}` ``) that
`ready` mode's synthetic identities can also produce for their first `deck.slides.length` entries, so
`derivedIdentityKey` can match them positionally across the transition; or (b) if losing
pre-render-completion customization is an accepted trade-off, correct the doc comment to say so
explicitly (removing the false "can still carry forward" claim) and consider disabling
`edit-details`/`duplicate` on an `imported` entry while `renderState` is `pending`/`failed`, so users
are not invited to do work that will silently vanish.

## Warnings

### WR-01: `renderedUrlCache` in `useSlideshowAssembly.ts` grows unbounded across re-renders within one session

**File:** `src/composables/useSlideshowAssembly.ts:238,268,279`

**Issue:** `renderedUrlCache` is keyed by `` `${renderImportId}:${renderedCount}` `` (line 240-242) and
is never evicted — only added to (`loadMissingRenderedUrls`, line 279). This is deliberate for
correctness (the doc comment at lines 233-237 explains the count-in-key design avoids ever serving a
stale array), but it means every distinct `(renderImportId, renderedCount)` pair ever observed during
the life of one `useSlideshowAssembly` instance stays resident forever, even though only the
*current* count's entry (`renderedImageUrlsByImportId`, lines 305-315) is ever read again. A deck
re-rendered several times in one editing session (re-upload, retry after `failed`) accumulates one
permanently-unread array of resolved download URLs per distinct count.

**Fix:** When `loadMissingRenderedUrls` resolves a new `(id, count)` entry, delete any other cached
key that starts with `` `${id}: ` `` before inserting the new one — the map should hold at most one
entry per `renderImportId`.

### WR-02: `cleanup()` calls the singleton `pptxRenders` store's `unsubscribeAll()`, tearing down every listener regardless of which composable instance opened it

**File:** `src/composables/useSlideshowAssembly.ts:699`, `src/stores/pptxRenders.ts:95-100`

**Issue:** `usePptxRenders()` is a Pinia store — a singleton for the app's lifetime — but
`useSlideshowAssembly`'s `cleanup()` (fired from `onScopeDispose`, so on every unmount of every
component that calls this composable) calls `pptxRendersStore.unsubscribeAll()`, which tears down
**every** outstanding listener in the store, not just the ones this particular composable instance
opened. The design comment on `pptxRenders.ts:11-19` and `useSlideshowAssembly.ts` both note "the
single call site (`ServiceEditorView.vue`)" as the reason this is safe today. That is an assumption
about caller cardinality baked into a teardown method's behavior, with nothing in the store enforcing
it — a second concurrent consumer (an admin dashboard preview, a second open tab sharing the same Pinia
instance in a future SSR/multi-pane context, or simply a future refactor that reuses this composable
from two components at once) would have its listeners silently killed by an unrelated component's
unmount, with no error and no signal other than the render status silently going stale.

**Fix:** Either scope subscriptions per-consumer (return a per-call `unsubscribeAll` from
`syncSubscriptions`'s caller-side tracking, e.g. reference-count each `renderImportId` across callers
so `unsubscribeAll` only closes listeners this instance itself opened), or add an explicit comment +
runtime guard (e.g. a dev-mode warning if a second `useSlideshowAssembly` instance is constructed
while one is still active) so the single-call-site assumption fails loudly instead of silently if it
is ever violated.

### WR-03: `rules.test.ts`'s `pptxRenders` write-denial coverage tests only the `update` path for an editor, not `create`/`delete`

**File:** `src/rules.test.ts:1497-1558`

**Issue:** The `pptxRenders` describe block (lines 1496-1559) has exactly one write-denial test for
an org **editor**: `updateDoc` on a pre-seeded document (T-42-01, lines 1497-1511). The only
`create`-path (`setDoc`) denial test in the block is for a **viewer** (lines 1548-1558), not an
editor. There is no test asserting an editor's `setDoc`/`deleteDoc` against a not-yet-existing (or
existing) `pptxRenders` doc is denied. Since the rule's `allow write` predicate
(`firestore.rules:234-237`) is a single unified condition covering create/update/delete, this is very
likely covered by construction — but the review instructions for this phase specifically call out
that "the write-denial case must genuinely exercise the new exclusion," and today only the `update`
half of "write" has editor-role coverage. The originally-demonstrated threat (T-37-15, forging a
`ready` flip) is an update, so the load-bearing case is covered — but a reader auditing this suite for
completeness (as the phase's own commentary asks reviewers to do for the rules file itself) would
reasonably expect the mirrored create/delete cases here too, matching the pattern every other
collection in this file uses (see `serviceShareLinks`'s explicit CREATE/UPDATE/DELETE-each-4-cases
structure).

**Fix:** Add an editor-role `setDoc` (create) denial test and an editor-role `deleteDoc` denial test
to the `pptxRenders` describe block, mirroring the shape already used for every other collection in
this file.

### WR-04: `resolveImportedRender`'s ready-mode branch is reached by elimination, not by an explicit `status === 'ready'` check

**File:** `src/utils/importedRenderReconciler.ts:100-126`

**Issue:** After the `pending` and `failed` branches return, the comment at line 115 says
`// render.status === 'ready'`, but the code never actually re-checks `render.status`; it proceeds
straight to inspecting `render.renderedCount`. This is type-safe *only* because `PptxRenderStatus` is
declared as a closed `'pending' | 'failed' | 'ready'` union (`src/types/pptxRender.ts:19`) — but the
value crossing the Firestore boundary is cast with `snap.data() as PptxRenderDoc`
(`src/stores/pptxRenders.ts:84`), with no runtime validation. If the render document ever legitimately
gains a fourth status value in the future (`functions/src/index.ts` can add one without a client
deploy — `slideDisplay.ts`'s own failure-sentence table comment makes exactly this point about the
sibling `failureReason` slug space), or a document is malformed/corrupted, this function will treat it
as `ready` whenever `renderedCount >= 1` happens to be present, rather than falling back to `pending`
or `failed` safely.

**Fix:** Replace the two early-return `if` statements with an explicit `switch (render.status)` (or add
an explicit `if (render.status === 'ready') { ... }` guard before the `renderedCount` check, with a
final safe fallback for anything else), so a future or corrupted status value degrades to `pending`/
`failed` instead of being silently treated as `ready`.

### WR-05: No test proves the "same id re-added after removal" listener-leak scenario the focus areas asked to be checked

**File:** `src/stores/__tests__/pptxRenders.test.ts`

**Issue:** The `syncSubscriptions — closing listeners (T-42-06 listener-leak guard)` block tests
removal (id present → removed) and org-switch, and the `opening listeners` block tests id-set growth
and a no-op repeat call — but no test exercises "an id is removed, then re-added in a later call,"
which is the scenario most likely to reveal a leak (e.g. a stale entry left in the internal
`listeners` map that suppresses re-subscription, or a double-`onSnapshot` call). I traced
`syncSubscriptions`'s code (`src/stores/pptxRenders.ts:60-93`) and it is correct — `closeListener`
deletes the id from `listeners`, so a later re-add finds `listeners.has(id)` false and opens a fresh
listener — but this is exactly the kind of guarantee that should be pinned by a test rather than left
to code inspection, especially given this store's own doc comment calls out that it has "no prior
analog in this codebase to have gotten it right by imitation."

**Fix:** Add a test: `syncSubscriptions('orgA', ['a'])` → `syncSubscriptions('orgA', [])` (closes `a`)
→ `syncSubscriptions('orgA', ['a'])` again, asserting `onSnapshot` was called twice total (once per
open) and the second open's data flows through `rendersByImportId` correctly.

---

_Reviewed: 2026-08-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
