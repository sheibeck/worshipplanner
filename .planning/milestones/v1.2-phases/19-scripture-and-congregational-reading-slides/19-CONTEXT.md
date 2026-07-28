# Phase 19: Scripture and Congregational Reading Slides - Context

**Ported from:** gsdpi slice S02 (milestone M001)
**Status:** Complete (code built and committed)

<domain>
## Phase Boundary

Enter a scripture reference, see auto-pulled ESV text split into slide-sized chunks, and toggle a congregational reading mode with Leader/Congregation labels — with manual override of any auto-generated slide and auto-save throughout.

Demo: Enter a scripture reference, see auto-pulled ESV text split into slides; toggle congregational mode with Leader/Congregation labels; manually override auto-generated slides.

In scope:
- `ScriptureSlide` type added to the `Slide` union (`contentKind: 'scripture'`) and a `ScriptureReading` Firestore document type.
- `splitPassage` utility: splits ESV text at verse boundaries with a configurable words-per-slide threshold.
- `useScriptureSlides` Pinia store: CRUD with a real-time Firestore subscription, mirroring the songLyrics store pattern.
- `ScriptureSlideEditor` component: reference → ESV fetch → auto-split preview → manual override → auto-save.
- `CongregationalEditor` component: same reference flow with Leader/Congregation section assignment.
- Service editor integration + a Normal/Congregational reading-mode toggle wired into the existing ScriptureSlot UI.

Out of scope:
- Service slideshow assembly / performance-order builder (consumed downstream by S03/later phases).
- New backend services — the ESV API proxy (`fetchPassageText`) is consumed as-is; no new Cloud Functions.
</domain>

<requirements>
## Requirements

**Owned by this phase:**
- **R008** — ESV auto-pull + auto-split of a scripture passage into slide-sized chunks.
- **R009** — Congregational reading mode (Leader / Congregation labeling).

**Supporting:**
- **R017** — Auto-save on the editor surfaces (reuses the existing `useAutoSave` composable).
- **R018** — Intuitive dark-first UX.
</requirements>

<proof>
## Proof Level

This phase proves:
- Unit tests for the splitter utility (pure-function edge cases: short / long / verse-boundary / no-verse-number fallback).
- Pinia store (mocked Firestore CRUD).
- `ScriptureSlideEditor` (component mount + interaction).
- `CongregationalEditor` (component mount + section assignment).
- Full-suite regression check (`npx vitest run`).

## Integration Closure

Produces the `ScriptureSlide` type in the `Slide` union and the `useScriptureSlides` store — consumed downstream for service slideshow assembly. `ScriptureInput.vue` reference parsing is reused. The ESV API proxy (`fetchPassageText`) is consumed as-is. Auto-save uses the existing `useAutoSave` composable. No new backend services introduced.

## Verification

The auto-save status indicator (reused from `useAutoSave`) surfaces save state to the user. ESV API fetch errors surface via a component error state. No new backend monitoring needed — failures are user-visible by design.
</requirements>

<uat_outcome>
## UAT Outcome (attempt 1, 2026-07-24) — verdict PARTIAL

Ported faithfully from the S02 assessment. 71/71 unit tests green at UAT time; browser automation tools were unavailable, so checks ran as artifact + runtime verification.

| Check | Result | Notes |
|-------|--------|-------|
| Scripture slide creation via ESV fetch (reference input, fetch button, ESV text fetch, auto-split, auto-save status) | PASS | `ScriptureSlideEditor` has `reference-input`, `fetch-btn`, `fetch-error`, `slides-container` testids; uses `fetchPassageText` + `splitPassage`; auto-save shows Saving.../Saved. 15 component + 10 splitter + 15 store tests pass. |
| Manual slide override (click to edit, marked overridden with visual distinction, auto-save on edit) | FAIL | Manual editing works via `@input → onSlideInput`; `overriddenSlides` (`Set<number>`) tracks edited indices. But the slide card uses a static class with no conditional binding on `overriddenSlides.has(idx)` — visual-distinction requirement unmet. Auto-save fires correctly. |
| Congregational reading mode toggle (switches editor, Leader/Congregation labels, speaker toggle, distinct styling per role) | PASS | `reading-mode-toggle` Normal/Congregational; `CongregationalEditor` renders `speaker-toggle` buttons, alternating default (`idx%2===0?LEADER:CONGREGATION`); Leader indigo, Congregation amber. 15 tests pass. |
| Reading mode persistence (toggle, collapse/re-expand, mode + assignments preserved) | PASS | `readingMode` typed on `ScriptureSlot`; `setReadingMode` updates the slot; deep watcher auto-saves (800ms debounce). 16 integration tests pass. |
| Empty reference guard (edit button hidden when no reference) | PASS | `v-if` requires `slotToScriptureRef(slot)` (null when book/chapter/verses incomplete). |
| Viewer role restriction (edit button hidden for non-editors) | PASS | `v-if` includes `authStore.isEditor`. |
| Very long passage (e.g. Psalm 119) splits without error | PASS | `DEFAULT_WORDS_PER_SLIDE=50`, sentence-boundary splitting, no upper limit. |
| Invalid reference shows error state, not crash | PASS | `fetchError` set in catch; `canFetch` guards on `parseScriptureInput`. |
| Rapid Normal/Congregational toggle — no duplicate saves / corruption | PASS | `setReadingMode` synchronous; 800ms debounce with clearTimeout — only last change saves. |

**Overall:** PARTIAL — the manual-override visual-distinction sub-requirement was unmet (tracking existed, no conditional class rendered); all other checks passed.
</uat_outcome>

---

*Phase: 19-scripture-and-congregational-reading-slides*
*Ported from gsdpi slice S02*
