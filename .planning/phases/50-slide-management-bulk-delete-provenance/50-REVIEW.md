---
phase: 50-slide-management-bulk-delete-provenance
reviewed: 2026-08-10T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - firebase.json
  - functions/src/pptxParser.ts
  - functions/src/pptxParser.test.ts
  - src/__tests__/firebaseHostingHeaders.test.ts
  - src/types/slide.ts
  - src/types/slideGroup.ts
  - src/components/PptxImportModal.vue
  - src/components/__tests__/PptxImportModal.test.ts
  - src/components/slides/SlideGrid.vue
  - src/components/slides/__tests__/SlideGrid.test.ts
  - src/utils/importedRenderReconciler.ts
  - src/utils/__tests__/importedRenderReconciler.test.ts
  - src/utils/slideshowAssembler.ts
  - src/utils/__tests__/slideshowAssembler.test.ts
  - src/utils/__tests__/manualAddPreservation.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 50: Code Review Report

**Reviewed:** 2026-08-10
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Reviewed the R106 (bulk-delete imported slides), R107 (manual-add preservation, test-only in this
diff), R108 (render-stable page provenance), and R109 (index.html no-cache header) changes for Phase
50. The diff is small and focused (15 files, ~950 insertions, mostly additive/test code).

Traced the four areas called out for special attention:

- **Render-page resolution order** in `importedRenderReconciler.ts::importedEntryContent` (`ready`
  case) implements the documented priority exactly: synthetic `rendered-page-N` identity → supplied
  `renderedPage` → 1:1 positional fallback (when `deck.slides.length === resolution.entryCount`) →
  pending placeholder. Verified against the doc comment, the unit tests (11 cases covering every
  branch and the "wrong-but-irrelevant-because-synthetic-wins" edge case), and the `slideshowAssembler.ts`
  call site that threads `ref.renderedPage` through only on the stored-group path (correctly omitted
  on the no-group IMPORTED fallback path, which has no `GroupSlideEntry.sourceRef` to read one from).
- **`SlideGrid.vue`'s remove-imported handler** (`onRemoveImportedSlides`) correctly filters
  `sourceRef.kind !== 'imported'`, sorts-then-renumbers the survivors from zero, passes
  `group.sourceSignature` through unchanged (R106 territory doesn't touch R107's signature), and
  passes `group.slides` as `baseSlides` so the write routes through the existing CR-02 concurrent-write
  merge — consistent with every sibling mutation in the file. Well covered by 6 new tests (show/hide
  matrix, confirm-cancel, exact removal+renumber assertions).
- **Editor/draft-lock gating** is re-checked in every new/changed handler
  (`onRemoveImportedSlides` re-checks `canMutateGroup.value`; `onImportConfirmed` is unchanged on this
  axis) rather than relying on the template `v-if` alone, matching the 30-VERIFICATION I-01 convention
  this file already follows everywhere else.
- **Firestore-undefined safety**: `renderedPage` is only ever spread onto the `imported` `sourceRef`
  when `innerSlide.sourcePage !== undefined` (`SlideGrid.vue::onImportConfirmed`), never written as a
  literal `undefined`. Same pattern for `sourcePage` on `TextSlide`/`ImageSlide` in
  `PptxImportModal.vue` and for `title`/`altText`. Confirmed by the SlideGrid test asserting
  `not.toHaveProperty('renderedPage')` for a legacy deck slide with no `sourcePage`.
- **Optional/backward-compatible typing**: `TextSlide.sourcePage`, `ImageSlide.sourcePage`, and
  `SourceRef`'s `imported.renderedPage` are all optional, with doc comments stating the
  backward-compat contract and consumers correctly guarding on `!== undefined` rather than assuming
  presence.

`npm run type-check` (the `vue-tsc --build` gate, not the narrower `-p tsconfig.app.json` form) is
clean. `npx vitest run --dir src --exclude '**/rules.test.ts'` reports the documented 2-file baseline
(`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) and no new failures — nothing
in this phase's diff regressed the suite.

Two warnings below concern (1) a real functional gap in `firebase.json`'s R109 header that the phase's
own plan already identified and deferred to a human deploy-verify step, and (2) the resulting false
confidence from the new `firebaseHostingHeaders.test.ts` test, which only proves the JSON shape, not
that the header actually reaches a normal page load. Two info-level notes round out the review.

## Warnings

### WR-01: `firebase.json`'s R109 no-cache header only covers literal `/index.html` requests, not the SPA's actual navigation paths

**File:** `firebase.json:28-38`
**Issue:** The new `hosting.headers` entry targets `"source": "/index.html"` only. Firebase Hosting
matches a `headers` entry's `source` glob against the **incoming request path**, evaluated **before**
the `**` → `/index.html` rewrite is applied — a fact `50-01-PLAN.md` itself documents (line 83-89:
"Deep SPA routes (e.g. `/services/123`) rewrite to index.html but are matched by the header layer on
their own request path, not `/index.html`"). In practice this means:
- A request to the site root `/` (how virtually every real user load starts) does **not** match
  `/index.html` and does **not** receive the `no-cache, no-store, must-revalidate` header, even
  though the server serves `index.html`'s content for it.
- A deep link (`/services/123`, `/login`, etc.) has the same gap.
- Only a request whose URL literally ends in `/index.html` — something an SPA user essentially never
  types or gets redirected to — gets the intended no-cache treatment.

R109's own acceptance criterion (50-PRD.md: "a normal load after a deploy fetches the current document
and hashed bundle") is therefore not actually satisfied for the common case by this config alone. The
2026-08-05 incident this phase exists to prevent (stale `index.html` serving an old hashed-bundle
reference after a deploy) can still recur for the overwhelming majority of real page loads.

This is a known, plan-documented limitation (not something the implementer silently missed — see
`50-01-PLAN.md` lines 83-89 and `50-01-SUMMARY.md` line 96, 111, which explicitly scope it as a
deploy-time/human-verify concern under the standing NO-DEPLOYS grant), which is why this is a WARNING
rather than a BLOCKER. It is still worth surfacing here because the deferred human-verify step is easy
to skip, and the in-repo test (see WR-02) provides no signal that the gap exists.

**Fix:** After the next real deploy, verify in a real browser (hard-reload-free) that a plain load of
the production root URL (not `/index.html` directly) picks up a fresh `index.html` after a deploy. If
it does not, the fix is a more specific-over-general header ordering, e.g.:
```json
"headers": [
  {
    "source": "/assets/**",
    "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
  },
  {
    "source": "**",
    "headers": [{ "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }]
  }
]
```
(Firebase applies the most-specific matching `source` per response; a catch-all `**` no-cache entry
combined with an explicit long-cache override for the hashed `assets/**` glob preserves the LOCKED
"hashed assets keep their immutable cache" decision while actually covering every real navigation
path, including `/`.)

### WR-02: `firebaseHostingHeaders.test.ts` proves only the JSON shape, not the functional claim it's named for

**File:** `src/__tests__/firebaseHostingHeaders.test.ts:23-36`
**Issue:** The test's own describe block is titled `'firebase.json hosting headers (R109)'` and its
first `it` asserts `'serves index.html with a no-cache/must-revalidate Cache-Control header'` — phrased
as a behavioral claim about how the shell is *served*. What it actually checks is that a `hosting.headers`
array entry exists whose `source` string happens to `.includes('index.html')`, with no verification
(and no way, from a pure JSON read, to verify) that Firebase's header-matching semantics make that
entry apply to the paths real users actually request (see WR-01). A reader of green CI output would
reasonably conclude R109 is fully solved; it is not.
**Fix:** Either (a) rename the test/description to make the narrower scope explicit — e.g. "an
`index.html`-sourced header entry exists with the right Cache-Control value" — and add a code comment
pointing at the WR-01 gap, or (b) once the header source is broadened per WR-01's fix, update this test
to assert the broadened `source` pattern (e.g. `**`) instead of the substring-matched `index.html`
check, so a future narrowing regression is actually caught.

## Info

### IN-01: `renderedPageNumberFromIdentity` accepts non-canonical zero-padded page suffixes

**File:** `src/utils/importedRenderReconciler.ts:193-200`
**Issue:** `/^\d+$/.test(suffix)` accepts strings like `'007'`, which `Number('007')` parses as `7`.
Since every real synthetic identity is minted by this same module's `importedEntryIdentities` (which
never zero-pads, `${i + 1}`), this is unreachable with real data and not exploitable — but it's a
slightly looser regex than the identity space actually needs, and a future caller constructing an
identity by hand (or a corrupted stored id) could silently resolve to an unintended page number instead
of failing closed.
**Fix:** Tighten to reject leading zeros, e.g. `/^(0|[1-9]\d*)$/`, matching the "page < 1 → null" guard's
existing defensive intent. Low priority — no current call site can trigger it.

### IN-02: `onRemoveImportedSlides` shows a native `window.confirm` with no async in-flight guard

**File:** `src/components/slides/SlideGrid.vue:712-732`
**Issue:** Unlike `onAddSlide`/`onImportConfirmed`, which resolve the group via `ensureGroupMaterialized`
immediately before writing (specifically to avoid acting on a stale `props.group` snapshot),
`onRemoveImportedSlides` reads `props.group` once at the top of the function and — because
`window.confirm` blocks synchronously — there's no window for `props.group` to go stale mid-function
the way an `await` boundary would create. This is fine functionally (confirmed correct by design, and
`window.confirm` is an established pattern elsewhere in this codebase: `EditSlideDrawer.vue`,
`LyricPasteRegion.vue`, `useUnsavedGuard.ts`), but nothing prevents a user from triggering a second
"Remove imported slides" click while the first `replaceGroupSlides` await is still in flight (the
button has no `disabled` state tied to an in-progress write, unlike `PptxImportModal`'s
`isImportInFlight()` guard on its own re-entrant entry points). A rapid double-click would issue two
overlapping `replaceGroupSlides` calls against a group that, by the time the second read happens, may
already reflect the first write's stale `props.group.slides` snapshot — mitigated by the existing CR-02
`baseSlides` merge-or-reject mechanism in the store, so this degrades to a rejected/merged second write
rather than data loss, but it's worth noting as the one mutation handler in this file with no visible
in-flight affordance.
**Fix:** Optional — not required for correctness given CR-02's existing protection. If desired, disable
the button (or track a local `isRemoving` ref) for the duration of the write, mirroring the pattern
`PptxImportModal.vue` already uses for its own re-entrant guards.

---

_Reviewed: 2026-08-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
