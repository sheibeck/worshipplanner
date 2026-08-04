---
phase: 34
slug: smarter-content-llm-scripture-split
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-03
---

# Phase 34 — Validation Strategy

> Seeded from `34-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + `@vue/test-utils` (already project dependencies — no install) |
| **Config file** | `vite.config.ts` (inline test config; no separate `vitest.config.ts` for the app suite) |
| **Quick run** | `npx vitest run src/utils/__tests__/scriptureBoundaries.test.ts src/utils/__tests__/claudeApi.test.ts src/components/__tests__/CongregationalEditor.test.ts` |
| **Full suite** | `npx vitest run src/` |
| **Type gate** | `npm run type-check` (**`vue-tsc --build`** — the `-p tsconfig.app.json` form silently skips test files and is NOT sufficient) |

**Baseline that is NOT a defect:** `src/storage.rules.test.ts` + `src/views/__tests__/RosterView.test.ts` = 9 tests / 2 files.

**`npm run test:rules` is NOT a gate** — no `firestore.rules` change is in scope.

---

## Sampling Rate

- **Per task commit:** the quick-run command above
- **Per wave merge:** `npx vitest run src/` **and** `npm run type-check`
- **Phase gate:** full suite green against the 2-file baseline, plus `npm run build`

---

## Per-Task Verification Map

> Threat Ref is `—` throughout, with one substantive note: this phase's *entire* security posture is
> the byte-match/bounds validation. There is no new endpoint and no new secret — the existing proxy
> and ESV path are untouched. The "threat" being mitigated is **the model altering scripture**, and
> the mitigation is structural (see below), not a rules or auth change.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | — | 0 | R064 boundary computation | unit | `npx vitest run src/utils/__tests__/scriptureBoundaries.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | 0 | R064 marker embed + round-trip | unit | same file | ❌ W0 | ⬜ pending |
| TBD | — | 0 | R064 `validateSplitResult()` — every failure mode | unit | `npx vitest run src/utils/__tests__/claudeApi.test.ts` | ❌ W0 (extend) | ⬜ pending |
| TBD | — | 0 | R064 SDK call shape (model id, `output_config.format`, **no** `thinking`/`effort`) | unit | same file | ❌ W0 (extend) | ⬜ pending |
| TBD | — | 0 | R064 failure → `null` + toast, `sections.value` unmutated | unit + component | `npx vitest run src/components/__tests__/CongregationalEditor.test.ts` | ❌ W0 (extend) | ⬜ pending |
| TBD | — | — | R064 manual flow unaffected (regression) | component | same file | ✅ exists — must pass **unmodified** | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/__tests__/scriptureBoundaries.test.ts` — new. Boundary computation and marker
      embedding, including a **Psalm-136-shaped fixture** (repeated semicolon-joined refrain) since
      that is the archetypal responsive reading and the shape most likely to expose a boundary bug.
- [ ] Extend `src/utils/__tests__/claudeApi.test.ts` — `validateSplitResult()` must be tested against
      **each individual failure mode**, not just a happy path: out-of-range index, non-integer index,
      overlapping sections, gap between sections, doesn't start at 0, doesn't end at max, wrong
      speaker enum, empty sections array.
      ★ **This is the phase's core guarantee.** R064's whole claim is that altered scripture is
      *structurally impossible*. A validation function with only a happy-path test does not establish
      that, and would be the single most misleading form of green in this phase.
- [ ] Extend `src/components/__tests__/CongregationalEditor.test.ts` — affordance wiring, the
      failure-toast path, and the manual-flow regression.
- [ ] **Spike (flagged by research, not a design question):** confirm whether `messages.parse()`
      needs a different Vitest mock shape than the existing `messages.create` mock. Resolve before
      writing the call-shape tests.

*Framework install: none required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **Split quality and determinism on real passages** | R064 | Requires a live Anthropic API call with real credentials. **No live API access in this session**, and simulating it with a fixture would give false confidence about *model* behaviour — which is precisely what is being checked. The ROADMAP asks for this explicitly ("validate Haiku split determinism empirically against real passages"). | Run the split on **Psalm 136** (repeated congregational refrain — the archetypal case) and **Psalm 24** (natural call-and-response). For each: run it **more than once** and compare. Confirm (a) every section's text matches the ESV source exactly, (b) no split falls mid-sentence, (c) the LEADER/CONGREGATION assignment is sensible, and (d) repeated runs on the same passage give a stable result. A split that validates but varies run-to-run is a usability problem, not a correctness one — note it either way. |
| The AI affordance never blocks the manual path | R064 | "Additive and never blocking" is a judgment about real interaction. | With the network off (or the API key invalid), open the congregational editor, attempt an AI split, confirm the failure is announced via toast, and confirm you can still build the reading entirely by hand exactly as before. |
| A failed split never partially applies | R064 | Depends on real API failure timing. | Force a mid-call failure; confirm `sections` is unchanged — not half-populated. |

---

## Gap Closure (plans 34-05 .. 34-12)

The original sections above describe the structural-correctness work (34-01..34-04) — done, tested,
and left unmodified as the record of that. R064's reachability gap FAILED verification anyway
(`34-VERIFICATION.md` Truth 1): every individual piece passed while the composition reached no user.
This section covers the eight plans that closed that gap plus the owner UAT findings planned alongside
it. **The requirement column is deliberately NOT R064 for every row** — 34-09 carries R055/R056/R070,
34-10 carries R040/R041, 34-11 carries R055, 34-12 carries R071. Restating R064 across all twelve plans
would repeat exactly the false premise this phase already had to correct once.

### Per-Task Verification Map — Gap Closure

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 34-05 Task 1 | 34-05 | 1 | R064 | unit | `npx vitest run src/utils/__tests__/scripture.test.ts` | ✅ green |
| 34-05 Task 2 | 34-05 | 1 | R064 | unit | `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts` | ✅ green |
| 34-05 Task 3 | 34-05 | 1 | R064 | unit + other | `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts` (+ `git diff --exit-code -- src/utils/slideGroupMaterializer.ts`) | ✅ green |
| 34-06 Task 1 | 34-06 | 1 | R064 | other (grep) | `grep -c "stores/scriptureSlides" src/components/CongregationalEditor.vue` (+ `npm run type-check`) | ✅ green |
| 34-06 Task 2 | 34-06 | 1 | R064 | unit | `npx vitest run src/components/__tests__/CongregationalEditor.test.ts` | ✅ green |
| 34-07 Task 1 | 34-07 | 2 | R064 | unit | `npx vitest run src/components/slides/__tests__/slideDisplay.test.ts src/components/slides/__tests__/EditSlideDrawer.test.ts src/components/slides/__tests__/SlidesTab.test.ts` | ✅ green |
| 34-07 Task 2 | 34-07 | 2 | R064 | unit | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ green |
| 34-07 Task 3 | 34-07 | 2 | R064 | unit | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ green |
| 34-08 Task 1 | 34-08 | 4 | R064 | unit | `npx vitest run src/utils/__tests__/congregationalReadingPipeline.test.ts` (+ `npm run type-check`) | ✅ green |
| 34-08 Task 2 | 34-08 | 4 | R064 | other (grep) | `grep -c "Gap Closure (plans 34-05" .planning/phases/34-smarter-content-llm-scripture-split/34-VALIDATION.md` | ✅ green |
| 34-08 Task 3 | 34-08 | 4 | R064, R070, R071 | gate | `npm run type-check`, `npx vitest run --dir src`, `npm run build` | see 34-08-SUMMARY.md |
| 34-09 Task 1 | 34-09 | 1 | R070 | other (grep) | `grep -c "R070" .planning/REQUIREMENTS.md` (+ `.planning/ROADMAP.md`) | ✅ green |
| 34-09 Task 2 | 34-09 | 1 | R055, R056, R070 | unit | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` (+ `npm run type-check`) | ✅ green |
| 34-10 Task 1 | 34-10 | 1 | R040, R041 | unit | `npx vitest run src/components/__tests__/SaveStatusIndicator.test.ts` (+ `npm run type-check`) | ✅ green |
| 34-10 Task 2 | 34-10 | 1 | R040, R041 | unit | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` (+ `npm run type-check`) | ✅ green |
| 34-11 Task 1 | 34-11 | 1 | R055 | unit | `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts` (+ `npm run type-check`) | ✅ green |
| 34-11 Task 2 | 34-11 | 1 | R055 | unit | `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts` | ✅ green |
| 34-12 Task 1 | 34-12 | 3 | R071 | unit | `npx vitest run src/stores/__tests__/auth.test.ts` (+ `npm run type-check`) | ✅ green |
| 34-12 Task 2 | 34-12 | 3 | R071 | other (grep) | `grep -c "R071" .planning/REQUIREMENTS.md` (+ `.planning/ROADMAP.md`) | ✅ green |
| 34-12 Task 3 | 34-12 | 3 | R071 | unit | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` (+ `npm run type-check`) | ✅ green |

Every row above carries a non-empty automated command — there are no Wave 0 gaps in this closure,
because every test file involved already existed at task-start except
`congregationalReadingPipeline.test.ts`, which 34-08 Task 1 both creates and asserts against.

### Test-command hazards (from CLAUDE.md / STATE.md, not restated from memory)

- **Type gate:** the only sufficient type gate is `npm run type-check` (`vue-tsc --build`), which also
  typechecks test files. `vue-tsc --noEmit -p tsconfig.app.json` silently skips them and is NOT
  sufficient evidence of a type-clean phase.
- **App-suite gate:** a bare `npx vitest run src/` also matches `render-service/src/render.test.ts` by
  substring and fails on a Vitest version mismatch (root pins a different major/minor than
  `render-service/`). The correct app-suite gate is `npx vitest run --dir src`, with the known-failing
  baseline `src/storage.rules.test.ts` (needs the Storage emulator) and
  `src/views/__tests__/RosterView.test.ts` (stale assertion) — 9 tests / 2 files, not a defect.

### Manual-Only Verifications (gap closure)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| The mounted affordance itself | R064 | jsdom cannot judge whether the route is discoverable from a scripture SLIDE, or whether the projected Leader/Congregation layout reads correctly on a real screen. | Open a real service, reach the congregational panel from a scripture slide by BOTH routes (3-dot menu, drawer), build a reading, and confirm it projects. See PENDING-VERIFICATION.md item 34.3. |
| The background scrim's legibility (34-09, UAT F3) | R070 | Whether `bg-black/50` keeps projected text readable over a real photograph on a real projector is a perceptual judgment, not a DOM assertion. | See PENDING-VERIFICATION.md item 34.4. |
| The merged group-media panel (34-11, UAT F2) | R055 | Whether one panel actually reads as one panel is a layout judgment. | See PENDING-VERIFICATION.md item 34.5. |
| The Planning Center org-document check (34-12, UAT F5) | R071 | Presence or absence of the credential fields must be read from the live Firebase console by the owner, reported as booleans, never as values. | See PENDING-VERIFICATION.md item 34.6. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
