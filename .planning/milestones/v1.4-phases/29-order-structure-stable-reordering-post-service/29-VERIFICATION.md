---
phase: 29-order-structure-stable-reordering-post-service
verified: 2026-07-29T02:04:07Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 29: Order Structure — Stable Reordering & Post-Service Verification Report

**Phase Goal:** Service items and slides reorder reliably and land exactly where dropped, with the view
correct immediately and no refresh required. The five sections — Pre-Service → Worship → Message →
Sending → Post-Service — render in fixed order, are never themselves draggable, and stay visible when
empty.

**Verified:** 2026-07-29
**Status:** passed
**Re-verification:** No — initial verification (this is the first phase in the project with
`workflow.verifier` enabled; v1.2/v1.3 shipped without a genuine VERIFICATION.md gate).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dragging a service item lands it exactly where dropped, immediately, no refresh | VERIFIED | `ServiceEditorView.vue:1522-1606` (`onSlotSortEnd`) reads only `oldDraggableIndex`/`newDraggableIndex`; `:key="slot.id"` (line 572) makes Vue's own re-render correct — no DOM patch needed. Proven by passing unit tests (`ServiceEditorView.test.ts`, "lands a service item exactly where it was dropped (R044)", "moves an item within its own section to a non-adjacent position (R044)") AND by owner-performed real-browser verification (29-05-PLAN.md Task 3 checklist steps 4-7; 29-05-SUMMARY.md D6 — owner ran `npm run dev` and confirmed cross-section drop, multi-position drag, and reload persistence directly). |
| 2 | The five sections always render in fixed order, are never draggable, stay visible when empty | VERIFIED | `src/types/service.ts:17-27` — `ServiceSection`/`SERVICE_SECTIONS`/`SERVICE_SECTION_LABELS` all list `'post-service'` fifth/last. `ServiceEditorView.vue:1426-1438` (`slotSectionGroups`) maps `SERVICE_SECTIONS` unconditionally regardless of entry count. Template (lines 530-570): section-header `div` is a sibling of the list container, not a `v-for` member inside it and never carries the `draggable: '.slot-item'` class — structurally excluded from the Sortable instance. Empty-section placeholder (`v-if="group.entries.length === 0"`) renders inside the still-live drop-target container. Confirmed by 8 passing tests asserting header count/order and by owner-performed browser check (steps 2-3, 5). |
| 3 | Dragging a slide in the Slides tab persists its new position without reverting | VERIFIED | `SlideGrid.vue:707-730` (`onEnd`) reads only `evt.oldDraggableIndex`/`evt.newDraggableIndex`; the D-16 single-step `insertBefore` DOM revert and its false "index arithmetic" comment are both gone (`grep -c insertBefore` = 0). A rejected write now bumps `gridRenderNonce` (props-driven re-render) plus calls `destroySortable()` so a fresh Sortable instance re-attaches to the replacement DOM node — proven by passing tests including "drags a slide to the position it was dropped in (R049)" and the two new draggable-index regression guards (T-29-11). |
| 4 | Adding a new slide appends to the true end of its group, not before the last slide | VERIFIED | `SlideGrid.vue:423` (`appendToGroup`) — sorts by `order`, concatenates additions, renumbers every entry to its array index; routed through all three append paths (`onAddSlide`, `onImportConfirmed`, `appendVideoEntries`), replacing each path's own diverging `Math.max(...)+1` computation. Proven by "appends a new slide at the true end of the group with contiguous orders (R050)" and two "renumbers all entries contiguously" tests, all passing. |

**Score:** 4/4 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/views/ServiceEditorView.vue` | Per-section Sortable containers, `oldDraggableIndex`/`newDraggableIndex`-only `onEnd`, `slot.id` key, D-16 revert removed, save-failure revert-and-surface | VERIFIED | All three original defects confirmed removed by direct grep; CR-01/WR-01 review fixes present at source (lines 1598-1602, 2864-2892) |
| `src/components/slides/SlideGrid.vue` | Same three-defect fix, `appendToGroup` shared contract, visible reorder-failure surface | VERIFIED | `oldDraggableIndex`/`newDraggableIndex`-only at 4 sites; `insertBefore` grep = 0; `appendToGroup` used at 3 call sites; `reorderError`/`gridRenderNonce`/`destroySortable()` present |
| `src/types/service.ts` | `'post-service'` as fifth, last member of union/array/label-map | VERIFIED | Lines 17, 19, 21-27 — `post-service` last in all three; doc comment updated |
| `src/utils/slotTypes.ts` | `groupBySection`/`flattenBySection`/`orderSlotsBySection` pure ordering helpers | VERIFIED | Present, used by `ServiceEditorView.vue` at every mutation site (`addSlot`, `performRemoveSlot`, `onSectionChange`, reorder handler, save payload) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ServiceEditorView.vue` drag handler | `serviceStore.updateService` | Immediate single write on reorder (D-15) | WIRED | `await serviceStore.updateService(serviceId.value, { slots: reindexed })` — one write for both order and section |
| `slotSectionGroups` computed | Template `v-for` | `SERVICE_SECTIONS.map(...)` drives always-rendered per-section containers | WIRED | Confirmed no section-name string literals in the render path — widening to five sections required zero template changes beyond the Post-Service placeholder copy branch |
| `SlideGrid.vue` append paths | `appendToGroup` | All three (`onAddSlide`, `onImportConfirmed`, `appendVideoEntries`) route through one shared helper | WIRED | grep confirms 3 call sites |
| Downstream consumers (`useSlideshowAssembly.ts`, `ServicePrintLayout.vue`, `planningCenterExport.ts`, `SlidePlanRail.vue`) | Post-Service section | Array-order / `SERVICE_SECTIONS`-iteration inheritance, zero source changes | WIRED | Confirmed by dedicated passing tests for the first three; `SlidePlanRail.vue` confirmed by direct read (zero section-related code in the file — grep for "section" returns nothing) |

### Behavioral Spot-Checks / Test Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| ServiceEditorView reorder/revert/CR-01 regression suite | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | 66/66 pass, including the CR-01 regression test ("a failed drag does not clobber... a later drag that already succeeded") | PASS |
| SlideGrid reorder/append/revert suite | `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts` | 70/70 pass | PASS |
| Pure ordering helpers | `npx vitest run src/utils/__tests__/slotTypes.test.ts` | 62/62 pass (real file; 2 quarantine-worktree duplicates also pass) | PASS |
| Downstream-consumer Post-Service tests | `npx vitest run src/composables/__tests__/useSlideshowAssembly.test.ts src/components/__tests__/ServicePrintLayout.test.ts src/utils/__tests__/planningCenterExport.test.ts` | All pass (7 files, 132 tests) | PASS |
| Type check | `npx vue-tsc --noEmit -p tsconfig.json` | 0 errors | PASS |
| Lint on touched files | `npx eslint src/views/ServiceEditorView.vue src/components/slides/SlideGrid.vue src/utils/slotTypes.ts src/types/service.ts` | 15 pre-existing errors, all confirmed via `git blame` to predate Phase 29 (oldest: 2026-03-04; newest unrelated: 2026-07-01) — 0 new errors on any Phase-29-touched line | PASS (no regressions) |
| Full workspace suite (run once) | `npx vitest run` (full, un-truncated capture) | 11 failed files / 156 passed (168); 39 failed tests / 3577 passed / 26 skipped (3687); 1 worker-crash error (Storage/Firestore emulator RPC flakiness) | PASS — failing file set is the documented pre-existing baseline (see below), no Phase-29 file appears in it |
| CR-01 regression test control (documented in 29-REVIEW-FIX.md, not re-run here) | `git stash` the fix, re-run, `git stash pop` | Reviewer/fixer documented: fails without the fix with the exact predicted stale-order regression | Accepted as prior evidence — reproducing this destructively was not repeated in this verification pass |

**Full-suite failing-file cross-check against documented baseline:**
`.gsd/quarantine/worktrees/**` duplicates of `services.test.ts` (×2), `RosterView.test.ts` (×2),
`ServiceEditorView.test.ts` (×2), `rules.test.ts` (×1); `src/storage.rules.test.ts` (needs Storage
emulator); `src/views/__tests__/RosterView.test.ts` (pre-existing stale "Roles config" text assertion,
git-blamed to 2026-07-13-era commits, untouched by Phase 29); `functions/lib/index.test.js` and
`functions/lib/pptxParser.test.js` (gitignored compiled build artifacts, confirmed present in
`.gitignore:13`). All 11 observed failures map to the documented 10-file baseline plus the 2
known-accepted `functions/lib` artifacts; the count varies run-to-run (11-12) because of Storage/Firestore
emulator connection flakiness (`GrpcConnection RPC 'Write' stream ... UNAVAILABLE`, a `Worker exited
unexpectedly` in this run) — not because of anything Phase 29 touched. No file modified by Phase 29
appears anywhere in the failing set.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| R042 | 29-05 | Post-Service section exists in service plan and Slides tab | SATISFIED | `SERVICE_SECTIONS` widened; `useSlideshowAssembly.ts` places it after Sending; `SlidePlanRail.vue` inherits array order for free (no section literals to update) |
| R043 | 29-02, 29-03, 29-05 | Five sections render in fixed order, never draggable, always visible | SATISFIED | Confirmed structurally (headers are siblings, not Sortable members) and by 8+ passing tests |
| R044 | 29-01, 29-03 | Service item drag lands exactly where dropped, no refresh | SATISFIED | Three-defect fix confirmed removed at source; CR-01 hardening confirmed and regression-tested |
| R049 | 29-01, 29-04 | Slide drag persists without reverting | SATISFIED | `SlideGrid.vue` three-defect fix confirmed; reorder-failure surface added and tested |
| R050 | 29-01, 29-04 | New slide appends to true end of group | SATISFIED | `appendToGroup` shared contract confirmed at all 3 append call sites |

No orphaned requirements found — REQUIREMENTS.md's Phase 29 mapping (R042, R043, R044, R049, R050) matches exactly what all five plans declared and what was verified above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any Phase-29-touched file | — | None |

No blockers. The one disclosed gap (WR-01's fix has no dedicated regression test, per the fixer's
documented reasoning that Vue's watcher-flush batching made the discriminator unreliable and that
forcing a racy test would itself be a maintenance liability) is explicitly pre-accepted per this
task's `<known_and_accepted>` list — its reasoning was independently reviewed here (source at
`ServiceEditorView.vue:2864-2892`, reference-equality guard against a genuinely concurrent async
window) and holds up: the guard is real, the trade-off is disclosed rather than hidden, and the
underlying defect class (order self-heals via the pre-existing remote-merge watcher) is non-destructive.

### Human Verification Required

None outstanding. The phase's one `checkpoint:human-verify` item (29-05-PLAN.md Task 3 — a real
cross-section OS drag in a running browser, which jsdom structurally cannot synthesize) was already
**performed by the project owner directly on 2026-07-28**, working through the full 8-step checklist
(five headers in fixed order; header non-draggability; mid-section cross-section drop landing exactly
between two items; drop into the empty Post-Service section; multi-position within-section drag;
reload persistence; Slides-tab reorder + append-at-the-true-end; offline-drag revert message) and
reporting success. This is recorded here as **owner-performed, human verification** — not an automated
check, and not something this verifier agent exercised or re-ran (jsdom cannot).

### Gaps Summary

No gaps found. All four ROADMAP success criteria are verified against the actual source (not SUMMARY
claims): the three compounding defects behind R044/R049 are genuinely removed from both
`ServiceEditorView.vue` and `SlideGrid.vue` (confirmed by grep and by reading the surrounding logic,
not just by absence of a string); the fifth Post-Service section is correctly positioned last across
the type union, the editor, and all four downstream consumers; and the CR-01 code-review blocker (a
stale-snapshot revert that could silently discard and then re-persist over a later successful edit) was
fixed with a working regression test that fails without the fix and passes with it. The one disclosed
warning (WR-01, no dedicated regression test) is judged an acceptable, honestly-reported trade-off
rather than a hidden gap.

---

_Verified: 2026-07-29_
_Verifier: Claude (gsd-verifier)_
