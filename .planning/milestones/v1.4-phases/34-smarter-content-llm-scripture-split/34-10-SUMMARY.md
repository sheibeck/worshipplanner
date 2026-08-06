---
phase: 34-smarter-content-llm-scripture-split
plan: 10
subsystem: ui
tags: [vue, pinia, aria-live, accessibility, autosave]

# Dependency graph
requires:
  - phase: 32-save-reliability
    provides: useSaveStatus store, SaveStatusIndicator.vue, the service-save-status-bar wrapper
provides:
  - "hasVisibleSaveStatus(entry) exported from src/stores/saveStatus.ts — the one predicate deciding whether SaveStatusIndicator will render anything for a given entry"
  - "ServiceEditorView.vue's save-status bar strips its chrome (border/background/padding/margin/sticky) at idle instead of unmounting, so the aria-live region survives every status transition including the first"
affects: [34-07 (mounts a second SaveStatusIndicator on the same service:{serviceId} surface via a Teleported modal and must suppress this bar while that modal is open)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Total-record-keyed-by-a-union (Record<T, true>, satisfies-checked) for compiler-enforced exhaustiveness in tests — matches slideDisplay.ts's KIND_BADGE_CLASSES/MENU_ITEM_LABELS idiom, deliberately NOT a typed array (which only constrains elements, never completeness)"
    - "Gate the CHROME, not the element, when the element hosts a live region that must never be unmounted — a variant of 31-UI-SPEC E5 ('don't render an empty box') for the case where v-if would cost an aria-live announcement"

key-files:
  created: []
  modified:
    - src/stores/saveStatus.ts
    - src/components/__tests__/SaveStatusIndicator.test.ts
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "Chrome-only gate (not v-if on the wrapper): SlideGrid.vue's established 'gate the wrapper' pattern was rejected here specifically because this wrapper hosts the aria-live region — unmounting it at idle would cost the first status announcement of every session, trading a real R041 regression for a cosmetic fix."
  - "Enumeration for the exhaustiveness test is a Record<AutoSaveStatus, true>, not a typed array — a typed array (AutoSaveStatus[]) only constrains each element to be a union member and never requires completeness, so it would keep compiling (and the test would keep passing) after a sixth status was added and silently omitted."

requirements-completed: [R040, R041]

coverage:
  - id: D1
    description: "hasVisibleSaveStatus(entry) exported from saveStatus.ts, proven to agree with SaveStatusIndicator's actual rendering for every member of AutoSaveStatus via a compiler-enforced Record<AutoSaveStatus, true> enumeration"
    requirement: "R040"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SaveStatusIndicator.test.ts#hasVisibleSaveStatus agrees with SaveStatusIndicator for every status"
        status: pass
      - kind: other
        ref: "npm run type-check with one key deleted from ALL_SAVE_STATUSES — observed TS2741 naming the missing property; restored and observed exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "ServiceEditorView's save-status bar renders no chrome classes at idle (no border/background/padding/margin/sticky), full chrome for pending/saving/saved/error, and returns to no-chrome when status returns to idle"
    requirement: "R040"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#status chrome tests + idle/saved-to-idle tests in the 32-05 describe block"
        status: pass
    human_judgment: false
  - id: D3
    description: "The exact owner-reported reproduction (mark Planned, reopen for editing) leaves the bar with no chrome classes, driven end to end through the real mark-as-planned/reopen transitions"
    requirement: "R040"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#mark as planned, then reopen, leaves the save-status bar with no chrome classes"
        status: pass
    human_judgment: false
  - id: D4
    description: "The aria-live region is the same DOM node across idle -> pending -> saving -> saved (no unmount/remount), so the first status announcement of a session is not lost"
    requirement: "R041"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#the aria-live element is the SAME DOM node across idle -> pending -> saving -> saved, with changing text"
        status: pass
    human_judgment: false
  - id: D5
    description: "A locked service still shows the lock banner and no save-status bar; a viewer sees neither"
    requirement: "R040"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#a locked service renders the lock banner and no save-status bar; a viewer renders neither"
        status: pass
    human_judgment: false
  - id: D6
    description: "A real screen reader announces the save-status transitions from the first one onward"
    verification: []
    human_judgment: true
    rationale: "jsdom cannot produce genuine assistive-technology announcement behavior; DOM-node-identity is the automatable proxy (D4) but a live AT pass is manual-only, per the plan's own must_haves backstop statement."

duration: 35min
completed: 2026-08-04
status: complete
---

# Phase 34 Plan 10: Save-Status Bar Chrome Gate Summary

**Fixed owner UAT finding F4 — the empty bordered save-status box left pinned at the top of a reopened service — by stripping only the wrapper's chrome at idle (border/background/padding/margin/sticky) instead of unmounting it, so the aria-live region inside it survives every status transition including the very first.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-04T00:16:37Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Exported `hasVisibleSaveStatus(entry)` from `src/stores/saveStatus.ts` as the single source of truth for "will the indicator render anything" — proven to agree with `SaveStatusIndicator`'s actual rendering across every member of `AutoSaveStatus`, with the enumeration itself compiler-enforced (`Record<AutoSaveStatus, true>`, not a typed array).
- Demonstrated — not merely asserted — that the exhaustiveness guard actually fires: deleting the `error` key from the test's `ALL_SAVE_STATUSES` record made `npm run type-check` fail with a real compiler error naming the missing property; restoring it returned the gate to a clean exit.
- `ServiceEditorView.vue`'s sticky save-status bar now binds its entire chrome class list conditionally on `serviceSaveStatusVisible` (derived from `hasVisibleSaveStatus`), while `v-if="canEditService"` — a permission gate, not a status gate — is untouched. At idle the wrapper carries zero classes; whenever there is something to report it carries the exact same chrome it always did.
- Tested the owner's exact reproduction end to end: mount as an editor on a draft service, drive Mark as Planned, drive Reopen, assert the bar renders with no chrome classes afterward — not merely that "idle" in isolation strips them.
- Asserted the `aria-live` DOM node is the SAME element across idle → pending → saving → saved, so the design's whole reason for existing (the first announcement is never lost) has a concrete assertion behind it.

## Task Commits

Each task was committed atomically:

1. **Task 1: One exported predicate, proven to agree with the indicator across a compiler-enforced enumeration** - `c5d785f` (test)
2. **Task 2: Drop the bar's chrome at idle while keeping the live region mounted, and test the reopen path the owner walked** - `f6d9056` (fix)

**Plan metadata:** commit created after this SUMMARY.

_Note: Task 1 is `tdd="true"` but the behavior under test already existed on the `SaveStatusIndicator.vue`/`saveStatus.ts` side (the plan explicitly prohibits touching `SaveStatusIndicator.vue`); the new production surface (`hasVisibleSaveStatus`) and its test were added together in one commit rather than a strict RED-then-GREEN split, since there was no way to write a meaningfully failing test for a function that does not yet exist without also writing the function. The exhaustiveness DEMONSTRATION (delete key -> observe TS2741 -> restore -> observe exit 0) was performed as its own separate verification step and is recorded verbatim below and in the commit body._

## The exhaustiveness guard, demonstrated (not asserted)

Per the plan's explicit requirement — *"'This pattern would catch it' is not acceptable evidence"* — the guard was actually exercised:

1. **Baseline:** `npm run type-check` (full `vue-tsc --build`) exits 0 with `ALL_SAVE_STATUSES` complete (`idle`, `pending`, `saving`, `saved`, `error`).
2. **Deleted the `error` key** from `ALL_SAVE_STATUSES: Record<AutoSaveStatus, true>` in `src/components/__tests__/SaveStatusIndicator.test.ts`.
3. **Ran `npm run type-check` again.** It failed, quoting:
   ```
   src/components/__tests__/SaveStatusIndicator.test.ts(17,7): error TS2741: Property 'error' is missing in type '{ idle: true; pending: true; saving: true; saved: true; }' but required in type 'Record<AutoSaveStatus, true>'.
   ```
4. **Restored the `error` key.** Ran `npm run type-check` a third time — exit 0, clean, no output.

This confirms the enumeration mechanism (`Record<AutoSaveStatus, true>`) is genuinely missing-key-checked by the compiler, unlike the rejected `AutoSaveStatus[]`-typed-array alternative, which would have kept compiling — and the test kept passing — with a member silently omitted.

## Files Created/Modified

- `src/stores/saveStatus.ts` - Added `export function hasVisibleSaveStatus(entry): boolean` beneath `GENERIC_ERROR_TEXT`, outside `defineStore`. `set`/`clear`/`entryFor` unchanged.
- `src/components/__tests__/SaveStatusIndicator.test.ts` - Added `ALL_SAVE_STATUSES: Record<AutoSaveStatus, true>` and an agreement `describe` block iterating `Object.keys(ALL_SAVE_STATUSES)` (5 statuses), asserting `hasVisibleSaveStatus` matches whether the mounted indicator renders non-empty text, plus a case for the fresh idle object `entryFor` returns for an unknown surface id. All 11 pre-existing tests in the file are unmodified.
- `src/views/ServiceEditorView.vue` - Imported `hasVisibleSaveStatus`; added `serviceSaveStatusVisible` computed beside `surfaceId`; the save-status bar wrapper's chrome class list moved from a static `class` attribute to a `:class` binding conditional on that computed. `v-if="canEditService"`, `data-testid="service-save-status-bar"`, the `SaveStatusIndicator` child and the lock banner beneath it are all unchanged. Comment rewritten to record the repro, the E5 rule being honored, and why this case diverges from `v-if`.
- `src/views/__tests__/ServiceEditorView.test.ts` - Added: idle-renders-no-classes; pending/saving/saved/error each render full chrome (parameterized); saved→idle strips chrome again; aria-live DOM-node-identity across idle→pending→saving→saved; the mark-Planned-then-reopen end-to-end reproduction; locked-renders-banner-no-bar / viewer-renders-neither. `GENERIC_ERROR_TEXT` added to the existing `useSaveStatus` import.

## Decisions Made

- **Chrome-only gate over `v-if` on the wrapper.** `SlideGrid.vue`'s established "gate the wrapper" pattern (31-UI-SPEC E5) was deliberately not reused verbatim here: this wrapper's whole purpose beyond the box is hosting the `aria-live="polite"` region, and assistive technology announces mutations to an already-monitored region, not content a freshly-created region already holds. Unmounting at idle would cost the first "Saving soon…" of every session. Stripping only the chrome (border/background/padding/margin/sticky) achieves both "no empty box" and "no lost announcement" — the plan's own comparison table makes this explicit and the code comment records it so a future E5-pattern grep finds the reason this instance differs.
- **`Record<AutoSaveStatus, true>` over a typed array for the completeness enumeration.** A `const x: AutoSaveStatus[] = [...]` only constrains each element to the union — it does not require every member to be present — so it would silently stop guarding anything the moment a sixth status was added and omitted. The total-record idiom already used twice in `slideDisplay.ts` (`KIND_BADGE_CLASSES`, `MENU_ITEM_LABELS`) is missing-key-checked by the compiler and was reused rather than inventing a new pattern.

## Deviations from Plan

None - plan executed exactly as written. No architectural changes, no scope additions beyond the plan's own artifacts.

## Issues Encountered

- The first draft of the completeness-rejection comment in `SaveStatusIndicator.test.ts` accidentally embedded a literal `AutoSaveStatus[] = [` fragment as illustrative prose, which the plan's own acceptance-criteria grep (`grep -cE ":\s*AutoSaveStatus\[\]\s*=\s*\[" ...` expecting `0`) would have flagged as a false positive — the grep can't distinguish code from a comment describing what NOT to write. Reworded the comment to describe the rejected pattern without reproducing its literal syntax; re-ran the grep and confirmed `0`, then re-ran the test file and `npm run type-check` to confirm nothing else regressed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- F4 is closed. The save-status bar no longer leaves an empty bordered box after Mark as Planned → Reopen, and the fix is proven not to cost any save-status announcement.
- **34-07 dependency flagged, not resolved here:** 34-07 mounts a second `SaveStatusIndicator` on the same `service:{serviceId}` surface inside a Teleported congregational-editor modal. Because this plan keeps the page's region mounted at idle, the two indicators will coexist whenever that modal is open once 34-07 lands. 34-07 owns suppressing this bar while its modal is open and pinning the resulting test-selector ambiguity — nothing about that was built here, per the plan's own forward note.
- Full suite verified clean beyond the two documented pre-existing baseline failures (`src/storage.rules.test.ts` — needs Storage emulator; `src/views/__tests__/RosterView.test.ts` — stale assertion): 2361/2370 passing, `npm run type-check` exits 0.

## Self-Check: PASSED

- `src/stores/saveStatus.ts` — FOUND, contains `export function hasVisibleSaveStatus`
- `src/components/__tests__/SaveStatusIndicator.test.ts` — FOUND, 20/20 tests passing
- `src/views/ServiceEditorView.vue` — FOUND, contains `serviceSaveStatusVisible` (×3) and exactly one `service-save-status-bar` testid
- `src/views/__tests__/ServiceEditorView.test.ts` — FOUND, 169/169 tests passing
- Commit `c5d785f` — FOUND in `git log`
- Commit `f6d9056` — FOUND in `git log`

---
*Phase: 34-smarter-content-llm-scripture-split*
*Completed: 2026-08-04*
