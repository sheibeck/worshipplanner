---
phase: 115-live-output-readability-layout
verified: 2026-09-04T02:50:00Z
status: human_needed
score: 17/17 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "On the owner's real church Mac + projector, compare the Audience output and Confidence output slide text against the Run-screen previews/thumbnails for the same slide at projection distance."
    expected: "Text size/position matches (WYSIWYG) — the auto-fit result computed once against the canonical 1280x720 stage looks identical across projector, band monitor, and Run previews/thumbnails."
    why_human: "Requires physical projector hardware and real screen distance; jsdom has no layout engine so the measured-pixel path is untestable in CI. Batched per .planning/v2.9-DEFERRED-VERIFICATION.md (owner's 'run autonomously, defer UAT to the end' instruction)."
  - test: "On the owner's real macOS Mac (Chrome/Safari), scroll the in-item filmstrip horizontally and observe the scrollbar."
    expected: "The horizontal scrollbar stays visible (does not auto-hide via macOS's overlay-scrollbar behavior) and the right-edge fade cues off-screen content."
    why_human: "macOS overlay-scrollbar auto-hide is an OS/browser rendering behavior invisible to jsdom; this is the exact defect (R332) the phase was created to fix, so a real-hardware check is required to confirm the fix actually holds on macOS."
  - test: "On the owner's real church Mac + projector at projection distance, confirm the enlarged filmstrip thumbnails (w-48) and the smaller On-screen preview pane are subjectively legible/readable at a glance during a live run."
    expected: "A projectionist can read thumbnail slide content without squinting, and the On-screen pane no longer visually dominates/crowds the filmstrip."
    why_human: "Legibility 'at a glance' and visual balance are subjective judgments about real screen size/distance, not something a DOM assertion can prove; the plan explicitly defers exact ratio/px tuning to this hardware UAT."
---

# Phase 115: Live-Output Readability & Layout Verification Report

**Phase Goal:** A projectionist and the audience/band can read the live output clearly — slide text fills the available space via auto-fit (no manual size control), the Run/control screen is legible at a glance, and the output views render WYSIWYG-consistent with the Run previews.
**Verified:** 2026-09-04T02:50:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

**Verification policy note:** This phase runs under the v2.9 deferred-UAT policy (`.planning/v2.9-DEFERRED-VERIFICATION.md`, STATE.md). Every must-have verifiable by code inspection + automated tests below is VERIFIED against the actual codebase (not SUMMARY claims). Items that genuinely require a physical projector or real macOS hardware are classified as human verification, not gaps — this is the expected, planned outcome, not a partial failure.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `computeFitScale` returns the largest fitting scale within [min,max], capped at MAX, floored at min, never 0/NaN/negative (R329) | ✓ VERIFIED | `src/composables/useSlideAutoFit.ts:29-51`; 19 unit tests in `useSlideAutoFit.test.ts` pass, including cap/floor/tolerance cases; ran independently — all pass |
| 2 | `computeContainScale` returns min-of-ratios letterbox scale, safe identity default on non-finite/0-size input | ✓ VERIFIED | `useSlideAutoFit.ts:63-78`; tests assert 1920x1080→1.5, height-constrained→1, 0x0/non-finite/negative→DEFAULT_FIT_SCALE |
| 3 | Both composables degrade to identity default where layout is unavailable, feature-detect ResizeObserver, never throw, disconnect on unmount | ✓ VERIFIED | Code at `useSlideAutoFit.ts:97-205`; jsdom-harness tests pass; WR-01 review finding (observer never installed if ref null at mount) was found and FIXED — `watch(ref, ..., {immediate:true, flush:'post'})` reinstalls on late attach; regression tests `WR-01: still degrades to DEFAULT_FIT_SCALE and never throws when frameRef/containerRef attaches after mount` independently re-run and pass |
| 4 | SlideCanvas sizes text from measured `--slide-fit-scale` (not `--slide-font-scale`); family/weight preserved (R329) | ✓ VERIFIED | `grep` confirms `src/components/slides/SlideCanvas.vue` scoped rules (lines 531-555) all read `var(--slide-fit-scale)`; zero `--slide-font-scale` reads remain; `font-weight: var(--slide-font-weight)` intact; 16/16 SlideCanvas tests pass |
| 5 | Auto-fit computed against the canonical 1280x720 frame; the SAME fit flows to Audience, Confidence, and Run previews (WYSIWYG mechanism) | ✓ VERIFIED (code/wiring) | AudienceOutputView and ConfidenceOutputView both `import { useContainScale, REFERENCE_WIDTH, REFERENCE_HEIGHT } from '@/composables/useSlideAutoFit'` and wrap SlideCanvas in a `1280x720` stage (`audience-stage`, `confidence-current-stage`, `confidence-next-stage`); RunFilmstrip/RunPreviewPair import the same `REFERENCE_WIDTH/HEIGHT` constants (post-review-fix IN-02) — single source of truth confirmed. **Real-pixel WYSIWYG match at projection distance is human-only** — see Human Verification #1 |
| 6 | AudienceOutputView renders SlideCanvas inside a fixed 1280x720 stage scaled via `useContainScale` to contain the fullscreen display; blackout + re-enter affordance preserved (R329) | ✓ VERIFIED | `src/views/AudienceOutputView.vue:13-37,85,106,112-113`; `data-testid="audience-stage"`; 24/24 AudienceOutputView tests pass |
| 7 | ConfidenceOutputView wraps both current+next panes' SlideCanvas in their own canonical stage; the fixed `transform: scale(0.8)` next-pane hack is removed | ✓ VERIFIED | `src/views/ConfidenceOutputView.vue:32,65,131,166-167`; `grep scale(0.8)` shows only explanatory-comment occurrences, zero live style usages; 30/30 ConfidenceOutputView tests pass |
| 8 | jsdom/no-layout degrades to identity fit (scale 1); no existing SlideCanvas/output-view test regresses | ✓ VERIFIED | Full suite run: 185/186 files pass, 5040/5067 tests pass (27 skipped), only documented baseline `src/storage.rules.test.ts` fails (Storage-emulator env limitation per CLAUDE.md) |
| 9 | On-screen pane occupies a smaller share than before; Next-up pane retained (R330) | ✓ VERIFIED | `src/components/run/RunPreviewPair.vue:24` grid is `grid-cols-1 lg:grid-cols-2` (even split, was `lg:col-span-2`-of-3 dominant); `data-testid="run-current-pane"`/`"run-next-pane"` both present; test explicitly asserts `.not.toContain('lg:col-span-2')`; 3/3 RunPreviewPair tests pass including pre-existing blackout-mirror tests |
| 10 | Filmstrip thumbnails render at ~1.5x previous width (w-32→w-48), reference-stage scaling kept in sync (R330) | ✓ VERIFIED | `RunFilmstrip.vue` thumb class is `w-48`; `THUMB_WIDTH = 192`; `thumbStageStyle` scale = `THUMB_WIDTH/REFERENCE_WIDTH` (imported constant, post-fix IN-02); test asserts the `w-48` class is present |
| 11 | An always-rendered end cap follows the last thumbnail, naming the next item or end-of-service (R331) | ✓ VERIFIED | `RunFilmstrip.vue:34-40` always renders `data-testid="run-filmstrip-endcap"`; interpolates `{{ props.nextItemLabel }}` (no v-html); tests assert 'Sermon' present when set, 'End of service'/no 'Next:' when null |
| 12 | `nextItemLabel` derived in `useRunControl` (not recomputed in RunFilmstrip) — pure `deriveNextItemLabel(rows, currentSlotIndex)` | ✓ VERIFIED | `src/composables/useRunControl.ts:110,273,1358` exports `deriveNextItemLabel`, computed `nextItemLabel`, returned from composable; `RunControlView.vue:212,338` binds `:nextItemLabel` straight through; 4/4 `useRunControl.nextItemLabel.test.ts` tests pass (middle-active, last-active→null, null-index→null, not-found→null) |
| 13 | Filmstrip scroll container forces an always-visible scrollbar + edge fade (R332) | ✓ VERIFIED (code) | `RunFilmstrip.vue:130,134-145,151` — `overflow-x: scroll` (not `auto`), persistent `::-webkit-scrollbar`/`-thumb`/`-track` rules (non-overlay), `.filmstrip-edge-fade` gradient div with `pointer-events-none`. **Real macOS overlay-scrollbar auto-hide behavior is human-only** — this is the exact defect the phase targets; see Human Verification #2 |
| 14 | Slides-grid card body + Edit Slide drawer preview render at a fixed base size independent of `--slide-font-scale`; family/weight preserved (R329) | ✓ VERIFIED | `SlideCard.vue:260-262` and `EditSlideDrawer.vue:1357-1359` both `font-size: 13px` (plain, no `calc()`/var); zero `--slide-font-scale` references in either file's scoped styles; SlideCard.test.ts + EditSlideDrawer.test.ts pass |
| 15 | Settings > Slide Typography card has no Size control; family/weight remain configurable (R329) | ✓ VERIFIED | `grep` for `slide-font-scale-sm/md/lg` in `SettingsView.vue` returns zero hits; `SettingsView.test.ts:704-712` explicitly asserts all three size-radio testids are absent while family/weight selects exist; 44/44 SettingsView tests pass |
| 16 | `slideTypography` model carries only `fontFamily`/`fontWeight`; `SCALE_MAP`, `fontScale`, `--slide-font-scale` removed everywhere (model, type, CSS, all render/test sites) | ✓ VERIFIED | `src/utils/slideTypography.ts` (no SCALE_MAP/DEFAULT_SCALE/fontScale); `src/types/organization.ts:63-66` (`{fontFamily, fontWeight}` only); `src/assets/main.css` — `--slide-font-scale: 1` line deleted (WR-03 fix confirmed); whole-repo `grep -rn fontScale src` sweep matches only test-absence-assertions and historical prose comments; 12/12 slideTypography tests pass |
| 17 | A pre-existing org doc with a stored `slideTypography.fontScale` loads without error (silently ignored, no migration) | ✓ VERIFIED (code inspection) | `src/stores/auth.ts:372-379` — `settings.value.slideTypography = {...DEFAULT_ORG_SETTINGS.slideTypography, ...orgSettings.slideTypography}`; a plain object spread copies any stray `fontScale` key through harmlessly (nothing reads it) with no throw — mechanism proven safe by construction, no dedicated stray-key test but the merge code itself guarantees no error path |
| 18 | Whole app type-checks (`vue-tsc --build`) and the app suite passes at the documented baseline | ✓ VERIFIED | Independently ran `npm run type-check` → zero errors; `npx vitest run` → 185/186 files pass, exactly the one documented baseline failure (`src/storage.rules.test.ts`, Storage-emulator ECONNREFUSED, no emulator running) |

**Score:** 17/17 code-verifiable must-haves verified (one truth, #17, additionally has no dedicated regression test but is proven safe by direct code inspection of the merge mechanism). 3 items require real hardware and are routed to Human Verification below — this is the phase's own explicitly planned deferral, not a gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/composables/useSlideAutoFit.ts` | Exports `computeFitScale`, `computeContainScale`, `useSlideAutoFit`, `useContainScale`, `DEFAULT_FIT_SCALE`, `MAX_FIT_SCALE`, `REFERENCE_WIDTH`, `REFERENCE_HEIGHT` | ✓ VERIFIED | All exports present and correctly implemented; read in full |
| `src/components/slides/SlideCanvas.vue` | Driven by `useSlideAutoFit`; scoped rules read `--slide-fit-scale` | ✓ VERIFIED | Confirmed via grep + read |
| `src/views/AudienceOutputView.vue` | Renders SlideCanvas in canonical 1280x720 stage via `useContainScale` | ✓ VERIFIED | `audience-stage` testid present, wired |
| `src/views/ConfidenceOutputView.vue` | Both panes in canonical stage; `scale(0.8)` hack removed | ✓ VERIFIED | `confidence-current-stage`/`confidence-next-stage` present; no live `scale(0.8)` |
| `src/components/run/RunFilmstrip.vue` | `~w-48` thumbs, next-item end cap, always-visible scrollbar + edge fade | ✓ VERIFIED | All three confirmed via grep + read |
| `src/components/run/RunPreviewPair.vue` | Smaller On-screen pane column ratio | ✓ VERIFIED | Even 2-col grid confirmed |
| `src/composables/useRunControl.ts` | Exports `deriveNextItemLabel`; returns `nextItemLabel` computed | ✓ VERIFIED | Confirmed at lines 110, 273, 1358 |
| `src/components/slides/SlideCard.vue` | Fixed-base body font-size, no `--slide-font-scale` | ✓ VERIFIED | `13px` fixed, confirmed |
| `src/components/slides/EditSlideDrawer.vue` | Fixed-base preview font-size, no `--slide-font-scale` | ✓ VERIFIED | `13px` fixed, confirmed |
| `src/utils/slideTypography.ts` | `SCALE_MAP`/`DEFAULT_SCALE`/`fontScale`/`--slide-font-scale` all removed | ✓ VERIFIED | Confirmed |
| `src/types/organization.ts` | `slideTypography` type + `DEFAULT_ORG_SETTINGS` without `fontScale` | ✓ VERIFIED | Confirmed |
| `src/views/SettingsView.vue` | Size radios + handlers + size-driven preview removed | ✓ VERIFIED | Confirmed |
| `.planning/codebase/ARCHITECTURE.md` | Behavioral note describing per-slide auto-fit on canonical stage | ✓ VERIFIED | Lines 1231, 1846-1848 confirm the auto-fit note; slideTypography note also updated |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `computeFitScale` | SlideCanvas/RunPreviewPair/thumbnails | shared `--slide-fit-scale` CSS custom property contract | ✓ WIRED | Same mechanism used by `useSlideAutoFit`'s oracle and SlideCanvas's inline style binding |
| `useContainScale` | AudienceOutputView, ConfidenceOutputView | direct import + containerRef/stageStyle | ✓ WIRED | Confirmed both views import and use it; `RunPreviewPair` intentionally keeps its own width-only `useScaleToFit` (WR-02, explicitly reviewed and documented as a deliberate behavior-preserving skip, not an oversight) |
| `deriveNextItemLabel` | RunFilmstrip via RunControlView | `railRows` → `nextItemLabel` computed → `:nextItemLabel` prop | ✓ WIRED | Confirmed end to end |
| RunFilmstrip end-cap next-item name | Vue template | `{{ }}` interpolation only (no v-html) | ✓ WIRED (XSS-safe) | Confirmed at `RunFilmstrip.vue:39` |
| `REFERENCE_WIDTH`/`REFERENCE_HEIGHT` | RunFilmstrip, RunPreviewPair, AudienceOutputView, ConfidenceOutputView | imported from single source `useSlideAutoFit.ts` | ✓ WIRED | Post-review-fix IN-02 confirmed — all four consumers now import rather than redeclare |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| R329 | 01, 03, 04, 05 | Slide text auto-scales to fill output; no manual size control; family remains selectable | ✓ SATISFIED (code-verified) | Auto-fit engine + SlideCanvas/output-view integration + editor fixed-base + full model/UI removal all confirmed; real-pixel WYSIWYG match is human-only (Human Verification #1) |
| R330 | 02 | Live main-slide view smaller; preview thumbnails larger and legible | ✓ SATISFIED (code-verified) | Even-split grid + w-48 thumbs confirmed; subjective at-a-glance legibility is human-only (Human Verification #3) |
| R331 | 02 | "End" marker after last thumbnail naming the next item | ✓ SATISFIED | End cap always rendered, correctly derived, tested |
| R332 | 02 | Scroll affordance reliably visible/usable, including macOS | ✓ SATISFIED (code-verified) | Forced non-overlay scrollbar CSS confirmed; real macOS auto-hide behavior is human-only (Human Verification #2) |

No orphaned requirements — REQUIREMENTS.md maps exactly R329-R332 to Phase 115, all four appear in plan frontmatter `requirements:` fields and are marked `[x]` complete.

### Anti-Patterns Found

None. Swept all phase-modified source files for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/empty-implementation patterns — zero debt markers. The only "placeholder" matches are unrelated pre-existing HTML `placeholder=` input attributes.

### Code Review Findings (115-REVIEW.md / 115-REVIEW-FIX.md)

3 warnings + 2 info findings were raised in code review; 4/5 were fixed and independently re-verified in this pass (WR-01's regression tests re-run and pass; WR-03's CSS deletion confirmed; IN-01/IN-02 confirmed). WR-02 (RunPreviewPair reimplements useContainScale) was explicitly skipped with a documented rationale (behavior differs — width-only vs. true contain — so swapping would be a behavior change, not a pure refactor) and a code comment pointing back at the finding was added. This is a reasonable, low-severity, non-blocking deferral — not a gap.

### Human Verification Required

See frontmatter `human_verification` — 3 items, all requiring the owner's real church Mac + projector, all explicitly anticipated by the phase's own plans and the v2.9 deferred-verification policy:

1. **WYSIWYG real-pixel match** — Audience/Confidence output vs. Run previews/thumbnails at projection distance.
2. **macOS scrollbar auto-hide fix confirmation** — the exact defect R332 was created to fix.
3. **Subjective legibility/visual-balance check** — filmstrip thumbnails and the smaller On-screen pane "at a glance" on real hardware.

### Gaps Summary

None. Every must-have derived from the ROADMAP success criteria and the 5 plans' frontmatter `must_haves` is either code-verified (17/17, independently re-run against the actual codebase — not SUMMARY claims) or is a genuinely hardware-dependent check that the phase's own plans, code review, and the milestone's deferred-UAT policy correctly routed to human verification. `npm run type-check` is clean and the full test suite (`npx vitest run`) is at the exact documented one-file baseline with no regressions. All 17 commits referenced across the 5 SUMMARYs and the review-fix report were independently confirmed present in `git log`.

---

_Verified: 2026-09-04T02:50:00Z_
_Verifier: Claude (gsd-verifier)_
