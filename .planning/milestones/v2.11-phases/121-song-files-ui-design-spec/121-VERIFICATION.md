---
phase: 121-song-files-ui-design-spec
status: passed
verified: 2026-09-05
verified_by: orchestrator (design-contract phase — verified from first-hand gate evidence: gsd-ui-checker VERIFIED 6/6, deliverables present, no source touched)
requirements: [R373]
gate_evidence:
  ui_checker: "gsd-ui-checker — UI-SPEC VERIFIED, 6/6 dimensions PASS after one revision (spacing exception documented; visual focal point added)"
  deliverables: "121-UI-SPEC.md present (verified) + 121-song-files-mock.html present (app-fidelity mock)"
  scope: "git diff confirms no src/**, functions/**, or *.rules changed this phase — design-contract-only, as scoped"
---

# Phase 121 — Verification

**Goal:** Before any Files-tab code is written, there is an approved, app-fidelity design contract mapping
the owner's "Song Files" Nocturne mock onto the app's dark gray-950 / indigo language, so phases 122-124
build against one settled reference.

**Verdict:** **PASSED** (automated). R373 is fully satisfied — the UI-SPEC exists, covers every Song Files
surface, is expressed in the app's real palette, and was verified 6/6 by gsd-ui-checker (which is R373's
explicit "produced via /gsd-ui-phase" approval path). A throwaway app-fidelity HTML mock was additionally
delivered for owner review.

## Requirement-by-requirement

| Req | What it needs | Status | Evidence |
|-----|---------------|--------|----------|
| **R373** | App-fidelity design/UI spec produced before implementation; every Files surface, in the app's dark gray-950 language, consistent with the Details/Lyrics tabs; reviewed/approved (owner sign-off OR produced via /gsd-ui-phase) before Phase 123 | ✅ pass (automated) | `121-UI-SPEC.md` produced by gsd-ui-researcher, verified by gsd-ui-checker 6/6 dimensions (the `/gsd-ui-phase` approval path). Palette mapped to Tailwind v4 stock gray/indigo, reusing the exact `SongSlideOver.vue` tab idiom. All surfaces + states + copy + access-control covered. Mock (`121-song-files-mock.html`) delivered for the owner look. |

## Success criteria (ROADMAP)

1. ✅ A reviewable UI-SPEC.md covers every Song Files surface (tab states, Songs-list column, grouped
   rows, PDF preview / MP3 player, external-link attach).
2. ✅ Every element uses the app's dark gray-950 palette/typography/spacing (not raw Nocturne), consistent
   with the existing Edit Song slideout tabs.
3. ✅ The spec is reviewed/approved before Phase 123 — produced via /gsd-ui-phase (checker-verified 6/6).

## Human verification (batched UAT)

- The HTML mock (`121-song-files-mock.html`) is queued for the batched end-of-milestone owner look — a
  visual confirmation the mapping matches intent. Non-blocking: R373 is met by the checker-verified spec.
