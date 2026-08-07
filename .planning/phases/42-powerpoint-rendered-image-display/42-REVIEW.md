---
phase: 42-powerpoint-rendered-image-display
reviewed: 2026-08-07T13:30:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - firestore.rules
  - src/rules.test.ts
  - src/utils/importedRenderReconciler.ts
  - src/utils/__tests__/slideGroupMaterializer.test.ts
  - src/composables/useSlideshowAssembly.ts
  - src/stores/pptxRenders.ts
  - src/stores/__tests__/pptxRenders.test.ts
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
status: issues_found
---

# Phase 42: Code Review Report

**Reviewed:** 2026-08-07T13:30:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Re-review of iteration 2's fix pass (commits `afa9817`, `b89dd52`, `7835f21`, `9791549`, `9818898`,
`0235789`) against the six findings from `42-REVIEW.iter2.md` (1 Critical + 5 Warnings). I read the
fixer's report, then verified every claim against the actual code — not the report's prose — including
running the affected test files, `npm run type-check`, and the rules suite against a live emulator.

**All six findings are genuinely closed, with two residual concerns worth surfacing.**

- **CR-01** — verified fixed as claimed. The doc comment on `importedEntryIdentities`
  (`importedRenderReconciler.ts:144-176`) no longer claims a pending/failed→ready transition "can
  still carry forward" customization; it now states plainly that the two identity key spaces
  (`deck.slides[i].id` vs. synthetic `rendered-page-N`) never overlap, so the drop (and entry-id
  churn) is real and unavoidable given `deck.slides` has no positional pairing to a rendered page
  (Fact 1, corroborated independently against `derivedIdentityKey`/`carryStoredDerivedEntries` in
  `slideGroupMaterializer.ts`). The `D-10` test (`slideGroupMaterializer.test.ts:2582-2629`) now
  attaches a label + `audioUrl` to a `pending`-mode stored entry and asserts, post-transition, that
  `readyCounterpart.id` differs from the original and `label`/`audioUrl` are both `undefined` — this
  is a real pin: reintroducing carry-forward (or accidentally matching by position) would fail this
  assertion, unlike a test that merely restates current output. I independently confirmed
  `EditSlideDrawer.vue` has no `renderState` awareness (grep: zero matches) and that
  `slideActionMenuItems`'s `imported` case offers `edit-details` unconditionally
  (`slideDisplay.ts:419-427`), so the UI-level claim in the fixer's report checks out. Choosing
  resolution (b) over (a) is technically sound — 42-RESEARCH.md Pitfall 1 genuinely rules out a safe
  positional carry-forward, and forcing one would silently attach a user's note to the wrong slide,
  which is strictly worse. See WR-01 below for the one open question this resolution leaves behind.
- **WR-01 (prior)** — verified fixed. The eviction loop in `loadMissingRenderedUrls`
  (`useSlideshowAssembly.ts:296-301`) removes every other `${id}:*` key before inserting the fresh
  one, bounding the cache to at most one entry per `renderImportId` cache-wide (not just per call).
  Traced the eviction key-prefix match (`key.startsWith(`${id}:`)`) for false-positive collisions
  across different ids sharing a prefix — none possible, since the delimiter is included in the
  match string. No stale-URL-serving path: `renderedImageUrlsByImportId` only ever looks up the
  *current* `(id, render.status/renderedCount)` key, and a miss (evicted-but-not-yet-refetched)
  correctly reads as "not ready yet," never as an old array.
- **WR-02 (prior)** — verified fixed as described, but see the new Warning below: the fix is a
  detection tripwire, not a resolution, and it ships with no test of its own.
- **WR-03 (prior)** — verified fixed. Ran the `pptxRenders` rules block against a live Firestore
  emulator: all 7 tests pass, including the two new editor-role `create`/`delete` denial cases, and
  the stderr trace confirms both denial predicates (`L234`, `L354`) actually fire — this is a real
  rule-engine exercise, not a mocked assertion. Confirmed via `git diff` that `firestore.rules` has
  no changes since the prior review, so the fixer's "no deploy handoff needed" claim is correct.
- **WR-04 (prior)** — verified fixed. `resolveImportedRender` (`importedRenderReconciler.ts:100-142`)
  now has an explicit `if (render.status === 'ready')` guard with an explicit fallback branch for any
  status value outside the closed union, degrading to `failed`. Traced that a legitimately-ready
  document (status `'ready'` AND `renderedCount >= 1`) is unaffected — the fallback branch is
  unreachable for it, since the `'ready'` branch's own internal `renderedCount` check is the only
  other exit from that arm, and it too resolves to `mode: 'ready'` whenever the count is valid.
- **WR-05 (prior)** — verified fixed. The new test
  (`pptxRenders.test.ts` — "an id removed then re-added...") genuinely asserts
  `firstUnsubA` (the specific mock `Unsubscribe` function returned for id `'a'`'s first listener) was
  `toHaveBeenCalledOnce()`, not merely that teardown ran without throwing, and separately asserts
  `onSnapshot` was called exactly twice total and that the second open's callback is live via
  `triggerSnapshot`.

**Verification performed directly (not taken on faith):**
- `npx vitest run` on all four affected test files: 215/215 pass
  (`pptxRenders.test.ts` 11, `slideGroupMaterializer.test.ts` 122, `useSlideshowAssembly.test.ts` 49,
  `importedRenderReconciler.test.ts` 33) — matches the fixer's per-file counts.
- `npm run type-check` (`vue-tsc --build`, the documented gate that also checks test files): clean.
- `npx vitest run --config vitest.rules.config.ts` against a live, already-running emulator: 140/140
  pass (127 `rules.test.ts` + 13 `storage.rules.test.ts`), matching the fixer's claim exactly.
- `git diff 914e3c2 HEAD -- firestore.rules`: empty — confirms no rules file changed, so no deploy
  handoff is implicated by this iteration.
- Purity: `importedRenderReconciler.ts` still imports only types (`ImportedDeck`, `PptxRenderDoc`,
  `ImageSlide`, `TextSlide`) — no Firestore/Storage/Vue imports introduced by any of the six fixes.
- Standing focus areas re-checked against the diff: no new listener-leak surface, `renderImportId`
  vs. `deck.id`/`slot.importId` distinction still consistently honored (unchanged code), and
  `renderFailureReason` is still routed exclusively through `renderFailureSentence` in both
  `SlideCard.vue` and `PresentationViewer.vue` (unchanged by this iteration, re-confirmed by grep).

Two residual Warnings remain — both are judgment calls about whether a technically-correct fix fully
closes the underlying concern, not newly-discovered bugs in the diff.

## Warnings

### WR-01: CR-01's accepted trade-off (b) leaves a genuinely silent, untracked, UI-invisible data-loss gap for end users

**File:** `src/utils/importedRenderReconciler.ts:152-176` (comment), `src/components/slides/EditSlideDrawer.vue` (no `renderState` gating), `src/components/slides/slideDisplay.ts:419-427` (`imported` case offers `edit-details` unconditionally)

**Issue:** The fix correctly closes the *code-defect* framing of CR-01 — the doc comment now matches
the code's actual behavior, and a test pins the drop so a future regression would be caught. That is
real progress and should not be re-opened as a Critical.

But judged as a product question rather than a documentation-accuracy question, disclosure-in-a-source-comment
is not sufficient on its own, for two reasons:

1. **The end user experiences this as silent**, regardless of how accurate the internal comment is. A
   user who opens "Edit details" on an imported slide while its deck's render is `pending` (the normal
   state for the first several seconds/minutes after any PPTX upload) or `failed` (during a retry), sets
   a label and an audio track, sees no warning, no disabled state, and no indicator anywhere in
   `EditSlideDrawer.vue` or the 3-dot menu that this work is time-bombed. It vanishes the instant the
   render completes — which, from the user's perspective, is indistinguishable from a bug. Phase 24
   D-02's "never *silently* drop a user's added slide" is written from the code's point of view; from
   the user's point of view, a loss with no on-screen cause is silent no matter how well the source is
   commented.
2. **The follow-up is not tracked anywhere durable.** I grepped `ROADMAP.md` and searched for a
   `.planning/backlog` (none exists in this repo) for any trace of "render-stable identity scheme" or
   a UI warning on `EditSlideDrawer.vue` — there is none. The only record of this being a known,
   deliberately-deferred gap is the source comment itself. A comment is not discoverable by product
   planning, is easy to lose in a future refactor that touches this file for an unrelated reason, and
   gives no one outside this codebase (a PM, a support engineer investigating a "my slide notes
   disappeared" ticket) anywhere to look.

This was also a real product decision — "users lose their work with no warning in this specific
window" — made unilaterally inside a review-fix pass rather than being surfaced to a human product
owner for a call. Reasonable engineers could choose (b) here, but the choice deserved visibility
outside a code comment.

**Fix:** At minimum, add an explicit backlog/ROADMAP entry recording this as a known, deferred gap
(not just a source comment) so it survives a refactor and is discoverable by non-code-reading
stakeholders. Stronger: add a lightweight UI signal — e.g., disable or badge `edit-details` on an
`imported` entry in `slideActionMenuItems` while `renderState` is `pending`/`failed`, or show a toast/
inline note in `EditSlideDrawer.vue` when it opens against such an entry ("this deck is still
rendering — customizations made now will not be saved once rendering completes"). Either materially
reduces the chance a user does work that is silently discarded, without requiring the (correctly
ruled-out) positional carry-forward.

### WR-02: WR-02's dev-mode instance-counter tripwire is an unverified diagnostic, not a fix, and has no test of its own

**File:** `src/composables/useSlideshowAssembly.ts:57-65,164-165,714-738`

**Issue:** The fix is the review's own offered fallback ("add an explicit comment + runtime guard"),
so it is not a defect — but it should be weighed honestly rather than treated as closing the
underlying hazard. `cleanup()` still calls `pptxRendersStore.unsubscribeAll()` unconditionally, tearing
down every render listener in the store regardless of which composable instance opened them; the only
change is a `console.warn` that fires when `activeSlideshowAssemblyInstances > 1` at teardown time,
and only `if (import.meta.env.DEV)`.

Two gaps this leaves:

1. **No production signal at all.** If the single-call-site assumption is ever violated in production
   (a second concurrent consumer, a future refactor), the failure mode is exactly what it was before
   this fix: listeners silently die, render status silently goes stale, with nothing in the
   console, logs, or error tracking to point at the cause. The tripwire only helps a developer who
   happens to be running a DEV build with devtools open at the exact moment the violation occurs.
2. **The tripwire itself is untested.** None of the four files in this iteration's diff touch
   `useSlideshowAssembly.test.ts`, and I confirmed no test asserts `console.warn` fires when a second
   instance's `cleanup()` runs while another instance is still active. A tripwire that can silently
   regress (e.g., a future edit that moves the increment/decrement out of sync, or changes `cleanup()`
   ordering) is a weaker guarantee than the review's own goal of "fails loudly instead of silently."

**Fix:** Add a test exercising two concurrently-active `useSlideshowAssembly` instances (construct two
inside separate effect scopes, dispose one) that asserts `console.warn` was called with the expected
message — this is cheap given the existing `useSlideshowAssembly.test.ts` harness already drives
`onScopeDispose` via `effectScope().stop()`. Separately, consider whether the warning should also fire
(via a non-DEV-gated path, e.g. reporting to whatever error-tracking this project already uses in
production) rather than being invisible outside local development, since production is exactly where a
silent multi-instance violation would be most costly to debug.

---

_Reviewed: 2026-08-07T13:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
