---
phase: 43-service-item-types
plan: 04
subsystem: ui
tags: [vue, vitest, vue-tsc, print, share, planning-center, exhaustive-switch, hymn-regression]

# Dependency graph
requires:
  - phase: 43-01
    provides: "SlotKind widened with ANNOUNCEMENTS/MISC; NonAssignableSlot.body?: string; every kind-dispatch site closed"
  - phase: 43-02
    provides: "addSlotAsItem exhaustive per-kind dispatch; never-typed exhaustiveness backstop"
  - phase: 43-03
    provides: "Hymn chip retired from both palette rows; shared body editor for Message/Announcements/Misc"
provides:
  - "ServicePrintLayout.vue and ShareView.vue render explicit ANNOUNCEMENTS and MISC branches — closing the no-trailing-arm gap that silently dropped both kinds on the two team-facing surfaces"
  - "body rendered read-only, line breaks preserved, for MESSAGE/ANNOUNCEMENTS/MISC on both surfaces, additive alongside MESSAGE's existing sermon-passage line"
  - "src/views/__tests__/hymnRetirement.regression.test.ts — the standing cross-surface proof that a stored HYMN slot still renders/prints/shares/presents/exports after the palette change (R084 hard half)"
  - "E-13 (adjacency) and E-15 (encoding) proven by named tests"
  - "addSlotAsItem's exhaustiveness backstop empirically proven to fire at compile time (Part A, captured evidence below) and at runtime for an out-of-union kind (Part B, permanent test)"
affects: [44-default-service-template]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SlotKind is a parallel, NOT structurally connected, type to ServiceSlot's per-member kind discriminants (SongSlot.kind/ScriptureSlot.kind/HymnSlot.kind/ImportedSlot.kind are each hardcoded literals, not derived from SlotKind) — widening SlotKind alone reaches only the handful of sites that reference it directly (createSlot's kind parameter, KIND_BADGE_CLASSES's Record<SlotKind,string>), NOT addSlotAsItem's exhaustiveness backstop, which narrows on slot.kind where slot: ServiceSlot. A compile-time probe of the backstop must widen NonAssignableSlot['kind'] (or add a new ServiceSlot union member), not SlotKind alone."

key-files:
  created:
    - src/views/__tests__/hymnRetirement.regression.test.ts
  modified:
    - src/components/ServicePrintLayout.vue
    - src/views/ShareView.vue
    - src/components/__tests__/ServicePrintLayout.test.ts
    - src/views/__tests__/ShareView.test.ts
    - src/utils/__tests__/planningCenterApi.test.ts

key-decisions:
  - "Extended past 43-UI-SPEC.md's stated surface (ServiceEditorView.vue only) onto ServicePrintLayout.vue and ShareView.vue — disclosed in the plan itself as a deliberate scope extension, not an unexplained diff. Both v-else-if chains had no trailing arm before this plan, so an ANNOUNCEMENTS/MISC slot rendered as nothing on the two team-facing surfaces (T-43-12)."
  - "body rendered via each surface's own existing free-text vocabulary (ServicePrintLayout's whitespace-pre-wrap notes-paragraph precedent; ShareView's own whitespace-pre-wrap notes-paragraph precedent) — no shared component introduced, no editor classes imported onto either surface."
  - "Absent body renders label-only (PRAYER's precedent), never the not-assigned italic fallback SCRIPTURE/HYMN use for a missing required assignment — an absent body is a valid state, not an omission."
  - "body reaches the DOM through Vue text interpolation only on both surfaces — zero v-html occurrences, verified by grep. ShareView is the higher-consequence instance: reachable by anyone holding the share URL."
  - "The Task 3 Part A compile-time probe was corrected from the plan's literal instruction (widen SlotKind alone) to also widen NonAssignableSlot['kind'] — see the tech-stack pattern above and the Deviations section for the full finding and captured evidence."
  - "Task 3 Part B's runtime assertion casts a slot object with an out-of-union kind value, proving the backstop's throw arm fires and names the offending kind — the defense that matters for untyped Firestore data, which the compile-time guard alone cannot cover."

patterns-established:
  - "hymnRetirement.regression.test.ts is the standing, single-file, cross-surface absence-of-regression pattern for any future item-type retirement: pair the survival assertion and the absence assertion in the SAME test block so neither can be satisfied without the other."

requirements-completed: [R081, R082, R084]

coverage:
  - id: D1
    description: "ServicePrintLayout.vue and ShareView.vue render explicit ANNOUNCEMENTS and MISC branches; body renders read-only with line breaks preserved for MESSAGE/ANNOUNCEMENTS/MISC on both surfaces; absent body renders label-only with no placeholder"
    requirement: "R081, R082"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ServicePrintLayout.test.ts#renders an ANNOUNCEMENTS slot / renders a MISC slot / preserves an embedded newline / renders an ANNOUNCEMENTS slot with no body (43-04)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ShareView.test.ts#renders an ANNOUNCEMENTS slot / renders a MISC slot / preserves an embedded newline / renders a MISC slot with no body (43-04)"
        status: pass
      - kind: other
        ref: "grep -c v-html src/components/ServicePrintLayout.vue = 0; grep -c v-html src/views/ShareView.vue = 0; git diff --exit-code src/stores/services.ts reports no change"
        status: pass
    human_judgment: false
  - id: D2
    description: "A stored HYMN slot still renders (editor), prints, shares, presents (slideshow assembly) and exports (Planning Center) exactly as before the palette change, in one findable file"
    requirement: "R084"
    verification:
      - kind: unit
        ref: "src/views/__tests__/hymnRetirement.regression.test.ts#RENDER/PRINT/SHARE/PRESENT/EXPORT tests"
        status: pass
    human_judgment: false
  - id: D3
    description: "E-13 (adjacency) and E-15 (encoding round-trip + no-data-mutation) proven by named tests across the editor, print and export surfaces"
    requirement: "R084"
    verification:
      - kind: unit
        ref: "src/views/__tests__/hymnRetirement.regression.test.ts#E-13 (adjacency) / E-15 (encoding) describe blocks"
        status: pass
    human_judgment: false
  - id: D4
    description: "The addSlotAsItem exhaustiveness backstop is proven to fire, not merely present — a compile-time probe produces an assignability failure against never in src/utils/planningCenterApi.ts, fully reverted; a permanent runtime test proves the throw arm fires and names the offending kind for untyped/out-of-union data"
    requirement: "R085"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/planningCenterApi.test.ts#an out-of-union kind value (as could arrive from untyped Firestore data) rejects with an error naming that kind, and issues no POST"
        status: pass
      - kind: other
        ref: "Captured Part A type-check evidence (below); git diff --exit-code src/types/service.ts reports no change after revert; npm run type-check exits 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Phase gate: npm run type-check 0 errors; app suite at its documented 2-file baseline (src/storage.rules.test.ts, src/views/__tests__/RosterView.test.ts), no new failing file; npm run build succeeds; firestore.rules/storage.rules unmodified; nothing deployed"
    verification:
      - kind: other
        ref: "npm run type-check; npx vitest run --dir src --exclude '**/rules.test.ts' (2769 passed, 1 failed = RosterView's pre-existing assertion, 2 failed files total); npm run build; git status --porcelain firestore.rules storage.rules"
        status: pass
    human_judgment: false
  - id: D6
    description: "T-43-03 share-disclosure decision (body published to anyone holding a share URL) and backstop UI-B1's visual half (a saved Hymn item, confirmed by eye across editor/print/presentation) are disclosed to the owner as deferred checks"
    verification: []
    human_judgment: true
    rationale: "Visual/print fidelity across three surfaces cannot be asserted in jsdom (43-VALIDATION.md's own stated reason), and the share-token trust-model question is a product decision no automated test can approve on the owner's behalf. Both recorded in .planning/PENDING-VERIFICATION.md § Phase 43 § Plan 43-04."

duration: ~35min
completed: 2026-08-07
status: complete
---

# Phase 43 Plan 04: Team-Facing Surfaces, HYMN Regression Proof, and the Compiler Backstop Summary

**Closed the print/share silent-omission gap for ANNOUNCEMENTS/MISC (T-43-12), added the standing cross-surface HYMN absence-of-regression suite proving R084's hard half, and empirically proved the `addSlotAsItem` exhaustiveness backstop fires both at compile time and at runtime.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-07T15:28:00-04:00 (approx.)
- **Completed:** 2026-08-07T16:03:00-04:00
- **Tasks:** 3
- **Files modified:** 5 (1 new)

## Accomplishments

- `ServicePrintLayout.vue` and `ShareView.vue` both dispatched on `slot.kind` through a `v-else-if` chain with NO trailing arm — an ANNOUNCEMENTS or MISC slot rendered as literally nothing on the two surfaces the worship team actually reads (T-43-12). Task 1 added explicit branches for both kinds to both files, plus `body` display (read-only, line breaks preserved, non-whitespace-only) for MESSAGE/ANNOUNCEMENTS/MISC on both surfaces — additive on MESSAGE, alongside its existing sermon-passage line. An absent `body` renders label-only (PRAYER's precedent), never the SCRIPTURE/HYMN not-assigned fallback. `body` reaches the DOM through Vue text interpolation only — zero `v-html` on either surface. HYMN and SCRIPTURE branches, and `src/stores/services.ts`, are byte-identical (verified by `git diff`).
- Created `src/views/__tests__/hymnRetirement.regression.test.ts` — one named, findable file proving R084's hard half: a stored HYMN slot with all three free-text fields renders its content row in the editor (paired, in the SAME assertion block, with the Hymn palette chip's absence from both rows), prints its full line, shares its full line, assembles into a slideshow text slide with the pre-phase title/body composition rule, and exports to Planning Center with the pre-existing Worship-Song-prefix title format. E-13 (two adjacent HYMN slots stay distinct across editor/print/export, with distinct ids) and E-15 (`hymnName`/`hymnNumber`/`verses` round-trip byte-for-byte through the editor and export, including whitespace and a multi-byte character, with the fixture's slot object structurally unchanged after mount) are both proven by named tests. Also extended `ServicePrintLayout.test.ts` and `ShareView.test.ts` (additive only — no pre-existing test modified) with ANNOUNCEMENTS/MISC labelled-line coverage, embedded-newline preservation, and no-body label-only rendering.
- Proved the `addSlotAsItem` exhaustiveness backstop empirically (Task 3). Part A's compile-time probe — corrected from the plan's literal wording after a real finding, see Deviations — produced `src/utils/planningCenterApi.ts(1069,9): error TS2322: Type '"__PROBE_43_04_DO_NOT_COMMIT__"' is not assignable to type 'never'.`, fully reverted (`git diff --exit-code src/types/service.ts` confirmed byte-identical). Part B added a permanent runtime test: `addSlotAsItem` called with an out-of-union kind value rejects with an error naming that kind and issues no POST — the defense that matters for untyped Firestore data, which the compile-time guard alone cannot reach.
- Phase gate green: `npm run type-check` (`vue-tsc --build`) exits 0. Full app suite (`npx vitest run --dir src --exclude '**/rules.test.ts'`) — 2769 passed, 1 failed, 2 failing files: `src/storage.rules.test.ts` and `src/views/__tests__/RosterView.test.ts`, the documented pre-existing baseline, unchanged. `npm run build` succeeds. `firestore.rules`/`storage.rules` unmodified; nothing deployed.

## Task Commits

1. **Task 1: Render the new kinds, and the shared body text, on the printed order and the shared service view** - `f3f19ef` (feat)
2. **Task 2: The cross-surface HYMN absence-of-regression suite** - `1bef531` (test)
3. **Task 3: Prove the exhaustiveness backstop actually fires, then close the phase gate** - `9ef34a1` (test)

## Files Created/Modified

- `src/components/ServicePrintLayout.vue` — ANNOUNCEMENTS/MISC branches added after MESSAGE, before HYMN; `body` display added to MESSAGE/ANNOUNCEMENTS/MISC
- `src/views/ShareView.vue` — same two branches and `body` display, using this file's own eyebrow-label and notes-paragraph conventions
- `src/components/__tests__/ServicePrintLayout.test.ts` — 4 new tests (additive only)
- `src/views/__tests__/ShareView.test.ts` — 4 new tests (additive only)
- `src/views/__tests__/hymnRetirement.regression.test.ts` — NEW FILE, 12 tests across RENDER/PRINT/SHARE/PRESENT/EXPORT plus E-13/E-15
- `src/utils/__tests__/planningCenterApi.test.ts` — 1 new test (the Part B runtime backstop assertion); 111/111 passing

## Decisions Made

- **Extended past 43-UI-SPEC.md's stated surface** (`ServiceEditorView.vue` only) onto `ServicePrintLayout.vue` and `ShareView.vue`. Disclosed in the plan itself as a deliberate, on-the-record scope extension — leaving those two surfaces untouched would have meant an ANNOUNCEMENTS/MISC item rendered as nothing at all where the team actually reads it.
- **`body` rendered via each surface's own existing free-text vocabulary**, not a shared component and not the editor's classes: `ServicePrintLayout.vue`'s `whitespace-pre-wrap` notes-paragraph precedent; `ShareView.vue`'s own equivalent.
- **Absent `body` renders label-only** (PRAYER's precedent on both surfaces), never the SCRIPTURE/HYMN not-assigned italic fallback — an absent `body` is a valid state, not a missing required assignment.
- **`body` reaches the DOM through Vue text interpolation only** — zero `v-html`, verified by grep on both files. ShareView is the highest-consequence instance since it is reachable without authentication.
- **T-43-03 (Information Disclosure, accepted not mitigated):** `body` is now visible in the published share snapshot. Not a new exposure — `buildServiceSnapshot` already copies every slot wholesale, so `body` entered the payload the moment plan 01 added the field, independent of any view rendering it. `notes` has published under the same share token since v1.0 on the same trust model. Recorded in `.planning/PENDING-VERIFICATION.md § Phase 43 § Plan 43-04` for the owner's explicit confirmation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 3 Part A's probe target corrected: `SlotKind` alone does not reach `addSlotAsItem`**

- **Found during:** Task 3, Part A (the compile-time probe)
- **Issue:** The plan instructs widening the standalone `SlotKind` type alias (`src/types/service.ts:7`) and asserting that `src/utils/planningCenterApi.ts` appears in the resulting `npm run type-check` error list with an assignability-against-`never` failure. Running the probe exactly as written (`SlotKind` widened only) produced errors in `src/components/slides/slideDisplay.ts` (`Record<SlotKind, string>` missing the new key) and `src/utils/slotTypes.ts` (`createSlot(kind: SlotKind)`'s switch loses its exhaustiveness) — but **zero errors in `planningCenterApi.ts`**. Root cause, confirmed by reading `src/types/service.ts`: `SlotKind` is a parallel type, NOT structurally connected to `ServiceSlot`'s per-member `kind` discriminants. `SongSlot.kind`, `ScriptureSlot.kind`, `HymnSlot.kind` and `ImportedSlot.kind` are each their own hardcoded string literal (e.g. `kind: 'SONG'`), and `NonAssignableSlot.kind` is its own separately-declared 4-literal union (`'PRAYER' | 'MESSAGE' | 'ANNOUNCEMENTS' | 'MISC'`) — none of the five interfaces reference `SlotKind` at all. `addSlotAsItem`'s backstop narrows on `slot.kind` where `slot: ServiceSlot`, so it can only be forced to fail by widening one of `ServiceSlot`'s own member discriminants, not the shadow `SlotKind` alias.
- **Fix:** Additionally widened `NonAssignableSlot['kind']` (the interface actually backing the four kinds `addSlotAsItem`'s if-chain excludes before reaching the backstop) to include the same probe literal, alongside the `SlotKind` widening the plan specifies. This produced the required proof: `src/utils/planningCenterApi.ts(1069,9): error TS2322: Type '"__PROBE_43_04_DO_NOT_COMMIT__"' is not assignable to type 'never'.` — plus the plan's expected "other files complain too" noise (`ServiceCard.vue`, `slideDisplay.ts`, `slideGroupMaterializer.ts` x3, `slotTypes.ts` x2). Both widenings were reverted together; `git diff --exit-code src/types/service.ts` confirmed byte-identical to the pre-probe state, and `npm run type-check` returned to 0 errors.
- **Files modified:** `src/types/service.ts` (temporarily, during Part A only — fully reverted, appears in no commit)
- **Verification:** Captured `npm run type-check` output (full file list and the exact `planningCenterApi.ts` error line, above); `git diff --exit-code src/types/service.ts` clean; `npm run type-check` exits 0 after revert.
- **Committed in:** N/A — the probe itself is never committed. The finding is recorded here and as a `tech-stack.patterns` entry in this SUMMARY's frontmatter, for any future plan that needs to prove an exhaustiveness guard against `ServiceSlot`'s discriminant.

---

**Total deviations:** 1 auto-fixed (1 bug — a plan instruction that did not compile into the proof it claimed, corrected using the same "verify against the real file before trusting the plan's literal wording" discipline plan 02 established for its own backstop-binding form).
**Impact on plan:** The plan's INTENT (empirically prove the backstop fires) and its acceptance criteria (the specific `planningCenterApi.ts`-with-`never`-error evidence) are both fully satisfied. The only departure is which type declaration the temporary probe touches — a mechanics-level correction, not a scope change.

## Issues Encountered

None beyond the deviation above, resolved inline during Task 3.

## User Setup Required

None — no external service configuration required.

**Deferred owner verification added to `.planning/PENDING-VERIFICATION.md § Phase 43 § Plan 43-04`:**
- The T-43-03 share-disclosure decision (confirm `body` should be visible to anyone holding a share URL, same trust model as `notes`).
- Backstop UI-B1's visual half: open a saved service containing a Hymn item and confirm it renders, prints (Print Preview) and presents (start a presentation, advance to the Hymn slide) exactly as before this phase — jsdom cannot assert visual/print fidelity.
- Restated pointer to 43-02's already-recorded live Planning Center export check (not duplicated as a new checkbox).

## Next Phase Readiness

- Phase 43 (R081-R085) is now fully implemented and proven: type layer (43-01), export dispatch (43-02), editor UI (43-03), team-facing surfaces plus the HYMN regression proof and the compiler backstop's empirical proof (43-04).
- `npm run type-check` is 0 errors; the full app suite is at its 2-file baseline; `npm run build` succeeds.
- `hymnRetirement.regression.test.ts` is the standing pattern for any future item-type retirement in this codebase — extend it, never delete it, if the add-item palette is touched again.
- Three items remain in `.planning/PENDING-VERIFICATION.md § Phase 43` awaiting the owner: the projected-slide label-vs-body decision (43-01), the live Planning Center export (43-02), the hands-on editor feel (43-03), the T-43-03 share-disclosure confirmation and backstop UI-B1's visual half (43-04).
- No blockers for Phase 44 (default service template editor) — the `SlotKind` eight-member shape, the `NonAssignableSlot.body` field, and the exhaustive `addSlotAsItem` dispatch are all final for this milestone.

---
*Phase: 43-service-item-types*
*Completed: 2026-08-07*

## Self-Check: PASSED

All modified/created files present on disk (`src/components/ServicePrintLayout.vue`, `src/views/ShareView.vue`, `src/components/__tests__/ServicePrintLayout.test.ts`, `src/views/__tests__/ShareView.test.ts`, `src/views/__tests__/hymnRetirement.regression.test.ts`, `src/utils/__tests__/planningCenterApi.test.ts`, `.planning/PENDING-VERIFICATION.md`); all three task commits (`f3f19ef`, `1bef531`, `9ef34a1`) found in git history.
