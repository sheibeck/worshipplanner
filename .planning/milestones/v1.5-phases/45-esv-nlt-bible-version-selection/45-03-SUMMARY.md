---
phase: 45-esv-nlt-bible-version-selection
plan: 03
subsystem: api
tags: [typescript, vitest, scripture, provenance, r091, r092, vue-tsc]

# Dependency graph
requires: []
provides:
  - "translationSource?: 'ESV' | 'NLT' field on ScriptureSlide, CongregationalSection (src/types/slide.ts) and the 'scripture' variant of SourceRef (src/types/slideGroup.ts) — optional, because a pre-phase slide's ABSENCE of the field is the R092 fallback trigger"
  - "scriptureAttribution(version): pure helper returning parenthesized initials only — '(ESV)' / '(NLT)' (R091)"
  - "resolveTranslationSource(slide): pure helper returning slide.translationSource ?? 'ESV' — NEVER imports authStore/OrgSettings, so an existing slide's resolved source is independent of the org's current setting (R092 guarantee, by construction)"
  - "materializer + assembler thread a stamped translationSource from CongregationalSection -> SourceRef -> ScriptureSlide without re-deriving it"
  - "named R092 invariant test: sourceSignature() / assembled-slide resolution are unchanged by an org bibleVersion change"
affects: [45-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provenance-at-the-data-layer: a per-record optional source field + a pure resolve() helper whose hardcoded fallback (never the live setting) is what makes 'never retroactively alter' true by construction rather than by discipline"
key-files:
  created: []
  modified:
    - src/types/slide.ts
    - src/types/slideGroup.ts
    - src/utils/scripture.ts
    - src/utils/__tests__/scripture.test.ts
    - src/utils/slideGroupMaterializer.ts
    - src/utils/slideshowAssembler.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts
    - src/utils/__tests__/slideshowAssembler.test.ts

key-decisions:
  - "translationSource is OPTIONAL on all three types — a pre-phase slide has no field, and that absence is exactly what resolveTranslationSource() maps to 'ESV'. Making it required would have forced a migration and defeated the R092 field-less-fallback design."
  - "resolveTranslationSource() lives in the pure scripture util and is forbidden (documented at the helper) from importing authStore/OrgSettings — this is the single correctness line for R092. A named invariant test proves an org bibleVersion change does not alter an existing slide's resolved source or sourceSignature()."
  - "The materializer/assembler only PASS THROUGH a stamped translationSource; they never derive it from the current setting. Stamping happens once at fetch time — that call site is plan 45-04's job, not this one."

patterns-established:
  - "scriptureAttribution() is the one canonical attribution producer both render paths (plan 45-04) consume — no per-path duplication (R091 'built once')"

requirements-completed: []
requirements-partial:
  - id: R091
    note: "Foundation only — scriptureAttribution() helper exists and returns initials-only. The two render sites that APPEND it (PresentationViewer.vue, slideBodyText() in slideDisplay.ts) are plan 45-04."
  - id: R092
    note: "Foundation only and guaranteed at the data layer — the field, the ESV-fallback resolve helper, the threading, and the named invariant test all exist. The stamp-once-at-fetch call site (CongregationalEditor.vue) is plan 45-04."

coverage:
  - id: D1
    description: "translationSource field added to ScriptureSlide, CongregationalSection, and SourceRef's scripture variant (optional)"
    requirement: "R092"
    verification:
      - kind: other
        ref: "npm run type-check (vue-tsc --build) exits 0 with the field threaded through all three types and both assembly utils"
        status: pass
    human_judgment: false
  - id: D2
    description: "scriptureAttribution(version) returns '(ESV)'/'(NLT)' — initials only"
    requirement: "R091"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scripture.test.ts — scriptureAttribution cases"
        status: pass
    human_judgment: false
  - id: D3
    description: "resolveTranslationSource() returns the stamped source, else 'ESV' for field-less slides, and never reads the org setting"
    requirement: "R092"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scripture.test.ts (field-less -> 'ESV') and src/utils/__tests__/slideshowAssembler.test.ts:706 (NAMED R092 invariant: field-less assembled slide resolves to 'ESV' independent of any org setting)"
        status: pass
    human_judgment: false
  - id: D4
    description: "materializer/assembler thread a stamped translationSource without re-derivation; sourceSignature unaffected by a setting change"
    requirement: "R092"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts + slideshowAssembler.test.ts (translationSource passthrough + R092 signature-invariance)"
        status: pass
    human_judgment: false

duration: interrupted-then-closed-by-orchestrator
completed: 2026-08-08
status: complete
---

# Phase 45 Plan 03: Per-Slide Translation Provenance (Field + Helpers + Threading) Summary

**Established the data-layer foundation that makes R091 attribution and R092 immutability true by construction: an optional `translationSource` field on the scripture-slide / congregational-section / source-ref types, two pure helpers (`scriptureAttribution` for initials-only attribution, `resolveTranslationSource` whose hardcoded `?? 'ESV'` fallback never reads the live org setting), and materializer/assembler threading that carries a stamped value through without re-deriving it — proven by a named R092 invariant test.**

## Orchestrator Close-Out Note

The executing subagent completed and committed both tasks (`b603bbd`, `0b52210`) but returned before writing this SUMMARY or updating tracking — it had launched the full app suite as a background run and returned while waiting on it. The orchestrator closed the plan out: confirmed both task commits landed, `npm run type-check` exits 0, the plan's touched test files are green (scripture.test.ts + slideshowAssembler.test.ts + slideGroupMaterializer.test.ts, incl. the named R092 invariant), and the full app suite finished at the documented 2-file baseline (`storage.rules.test.ts`, `RosterView.test.ts`) with no new failing file. No work was lost or redone; only the SUMMARY/tracking write was completed by the orchestrator.

## Accomplishments

- Added `translationSource?: 'ESV' | 'NLT'` to `ScriptureSlide` and `CongregationalSection` (`src/types/slide.ts`) and to the `'scripture'` variant of `SourceRef` (`src/types/slideGroup.ts`). Optional by design — a pre-phase slide's absence of the field is the R092 fallback trigger.
- Added two pure helpers to `src/utils/scripture.ts`: `scriptureAttribution(version)` → `` `(${version})` `` (initials only, R091), and `resolveTranslationSource(slide)` → `slide.translationSource ?? 'ESV'`, documented as forbidden from importing `authStore`/`OrgSettings` (the R092 correctness line).
- Threaded `translationSource` through `slideGroupMaterializer.ts` and `slideshowAssembler.ts` as pure pass-through — the stamped value rides `CongregationalSection → SourceRef → ScriptureSlide`; neither util derives it from the current setting.
- Added a **named R092 invariant test** (`slideshowAssembler.test.ts:706`) proving a field-less assembled slide resolves to `'ESV'` independent of any org setting, plus signature-invariance across a bibleVersion change, and the field-less→ESV case in `scripture.test.ts`.
- `npm run type-check` (vue-tsc --build) exits 0. Touched test files: 163+ green. Full app suite at the documented 2-file baseline; no new failing file.

## Task Commits

1. **Task 1: translationSource field + scriptureAttribution/resolveTranslationSource helpers** — `b603bbd` (feat)
2. **Task 2: thread translationSource through materializer/assembler + R092 invariant test** — `0b52210` (feat)

## Files Created/Modified

- `src/types/slide.ts` — `translationSource?` on `ScriptureSlide` + `CongregationalSection`
- `src/types/slideGroup.ts` — `translationSource?` on `SourceRef`'s scripture variant
- `src/utils/scripture.ts` — `scriptureAttribution()` + `resolveTranslationSource()`
- `src/utils/slideGroupMaterializer.ts`, `src/utils/slideshowAssembler.ts` — pass-through threading
- `src/utils/__tests__/scripture.test.ts`, `slideGroupMaterializer.test.ts`, `slideshowAssembler.test.ts` — coverage incl. the named R092 invariant

## Decisions Made

- **Optional field, not required** — avoids a migration and makes the field-less state the R092 fallback trigger.
- **`resolveTranslationSource` is pure and setting-blind** — the hardcoded `?? 'ESV'` (never the live setting) is what guarantees existing slides never change when the org toggles ESV↔NLT.
- **Stamping is deferred to 45-04** — this plan only builds the field/helpers/threading; the one place a value is written (fetch time in `CongregationalEditor.vue`) belongs to the consumption plan.

## Deviations from Plan

None — both tasks executed as written. The only non-standard event was the orchestrator closing out the SUMMARY/tracking after the subagent returned early (see Close-Out Note); no plan content changed.

## Issues Encountered

The executing subagent returned while a background test run was still pending, before writing SUMMARY/tracking. Resolved by the orchestrator with no lost work (see Close-Out Note).

## Next Phase Readiness

- Plan 45-04 (consumption wiring) has everything it needs: the `translationSource` field to stamp at fetch time, `scriptureAttribution()` to append at both render sites, and `resolveTranslationSource()` to read per slide. R091 and R092 close when 45-04 wires the render sites and the stamp-once-at-fetch call.
- `npm run type-check` 0; full app suite at the 2-file baseline.

---
*Phase: 45-esv-nlt-bible-version-selection*
*Completed: 2026-08-08 (executed 2026-08-07, closed out by orchestrator)*

## Self-Check: PASSED

All modified source files present on disk; both task commits (`b603bbd`, `0b52210`) in git history; type-check 0; touched tests green incl. the named R092 invariant.
