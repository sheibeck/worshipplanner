# S02: Scripture and Congregational Reading Slides

**Goal:** Enter a scripture reference, see auto-pulled ESV text split into slides; toggle congregational mode with Leader/Congregation labels; manually override auto-generated slides
**Demo:** Enter a scripture reference, see auto-pulled ESV text split into slides; toggle congregational mode with Leader/Congregation labels; manually override auto-generated slides

## Must-Haves

- 1. ScriptureSlide type added to Slide union in src/types/slide.ts with contentKind: 'scripture'
- 2. ScriptureReading Firestore document type defined in src/types/scriptureReading.ts
- 3. splitPassage utility correctly splits ESV text at verse boundaries with configurable words-per-slide threshold — 8+ unit tests covering short/long/edge cases
- 4. useScriptureSlides Pinia store provides CRUD with real-time Firestore subscription following songLyrics pattern — unit tests pass
- 5. ScriptureSlideEditor component: enter reference → fetch ESV text → auto-split preview → manual override → auto-save — component tests pass
- 6. CongregationalEditor component: same reference flow with Leader/Congregation section assignment — component tests pass
- 7. Full test suite passes with no regressions (npx vitest run)
- 8. Requirements covered: R008 (ESV auto-pull + auto-split), R009 (congregational mode), R017 (auto-save on editor), R018 (intuitive dark-first UX)

## Proof Level

- This slice proves: Unit tests for splitter utility (pure function edge cases), Pinia store (mocked Firestore CRUD), ScriptureSlideEditor (component mount + interaction), CongregationalEditor (component mount + section assignment). Full suite regression check.

## Integration Closure

Produces ScriptureSlide type in the Slide union and useScriptureSlides store — consumed by S03 for service slideshow assembly. ScriptureInput.vue reference parsing reused from existing component. ESV API proxy (fetchPassageText) consumed as-is. Auto-save via existing useAutoSave composable. No new backend services introduced.

## Verification

- Auto-save status indicator (reused from useAutoSave) surfaces save state to user. ESV API fetch errors surface via component error state. No new backend monitoring needed — failures are user-visible by design.

<tasks>
- [ ] **T01**: ScriptureSlide types, ScriptureReading type, and passage splitter with tests _(M)_
  **Why:** The ScriptureSlide type and passage splitter are the foundation for all S02 work. The splitter is the highest-risk algorithm (novel code, not a pattern copy), so it's front-loaded with thorough tests.
  - Files: `src/types/slide.ts`, `src/types/scriptureReading.ts`, `src/utils/scriptureSplitter.ts`, `src/utils/__tests__/scriptureSplitter.test.ts`
  - Verify: npx vitest run src/utils/__tests__/scriptureSplitter.test.ts
- [ ] **T02**: Scripture slides Pinia store with Firestore CRUD and tests _(M)_
  **Why:** The store provides the persistence layer for scripture readings, following the proven songLyrics store pattern. Components in T03/T04 depend on this for CRUD operations.
  - Files: `src/stores/scriptureSlides.ts`, `src/stores/__tests__/scriptureSlides.test.ts`
  - Verify: npx vitest run src/stores/__tests__/scriptureSlides.test.ts
- [ ] **T03**: ScriptureSlideEditor component with ESV fetch, auto-split preview, and auto-save _(L)_
  **Why:** This is the main user-facing deliverable for normal scripture slides (R008). A volunteer enters a scripture reference, sees the ESV text auto-fetched and split into slide-sized chunks, can manually override any slide, and edits auto-save.
  - Files: `src/components/ScriptureSlideEditor.vue`, `src/components/__tests__/ScriptureSlideEditor.test.ts`
  - Verify: npx vitest run src/components/__tests__/ScriptureSlideEditor.test.ts
- [ ] **T04**: CongregationalEditor component with Leader and Congregation section assignment _(L)_
  **Why:** This delivers R009 (congregational reading mode). Responsive/liturgical readings need Leader and Congregation parts clearly labeled so the congregation knows when to read aloud.
  - Files: `src/components/CongregationalEditor.vue`, `src/components/__tests__/CongregationalEditor.test.ts`
  - Verify: npx vitest run src/components/__tests__/CongregationalEditor.test.ts
- [ ] **T05**: Service editor integration and reading mode toggle _(M)_
  **Why:** Without wiring the new editors into the existing service editor UI, users have no way to access scripture slide creation. This task connects S02's editors to the existing ScriptureSlot UI in ServiceEditorView, completing the user-facing flow.
  - Files: `src/views/ServiceEditorView.vue`, `src/components/__tests__/ServiceScriptureIntegration.test.ts`
  - Verify: npx vitest run src/components/__tests__/ServiceScriptureIntegration.test.ts && npx vitest run
</tasks>

## Files Likely Touched

- src/types/slide.ts
- src/types/scriptureReading.ts
- src/utils/scriptureSplitter.ts
- src/utils/__tests__/scriptureSplitter.test.ts
- src/stores/scriptureSlides.ts
- src/stores/__tests__/scriptureSlides.test.ts
- src/components/ScriptureSlideEditor.vue
- src/components/__tests__/ScriptureSlideEditor.test.ts
- src/components/CongregationalEditor.vue
- src/components/__tests__/CongregationalEditor.test.ts
- src/views/ServiceEditorView.vue
- src/components/__tests__/ServiceScriptureIntegration.test.ts
