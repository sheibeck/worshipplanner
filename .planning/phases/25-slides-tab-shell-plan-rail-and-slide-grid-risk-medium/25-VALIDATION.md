---
phase: 25
slug: slides-tab-shell-plan-rail-and-slide-grid
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-26
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## ⚠ Correction applied to the source research

`25-RESEARCH.md`'s Validation Architecture was written **before** owner decision **D-17**
(2026-07-26) and states that a video drop calls `setGroupBedMedia({ bedVideoUrl })`. That is now
**wrong**. Under D-17 a dropped video **appends a `VideoSlide`** to the selected group; only **audio**
sets the group bed. The R032 row below reflects the corrected behavior. Where research and this file
disagree on video, **this file wins**.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (+ `@vue/test-utils`) — both already project dependencies, no install needed |
| **Config file** | `vitest.config.ts` (unit). `vitest.rules.config.ts` is the separate emulator-only rules config and is NOT used by this phase. |
| **Quick run command** | `npx vitest run src/components/slides/__tests__/<Component>.test.ts` |
| **Full suite command** | `npx vitest run src/` |
| **Estimated runtime** | ~120s full suite |

> **Do NOT run `npm run test:rules`** and do not restart the Firebase emulator — a live user session
> may hold ports 8080/9199.

---

## Sampling Rate

- **After every task commit:** the relevant component's quick-run command.
- **After every plan wave:** `npx vitest run src/`. This phase modifies `ServiceEditorView.vue`
  (third tab), so the FULL existing `ServiceEditorView.test.ts` suite must stay green — not just new tests.
- **Before phase close:** full suite green against the known baseline.
- **Max feedback latency:** ~120s.

### Known-failing baseline (do NOT attempt to fix in this phase)

A full `npx vitest run src/` fails in exactly **10 files**:
- 8 under `.gsd/quarantine/worktrees/**` — stale duplicate copies, never run or fix these
- `src/storage.rules.test.ts` — needs the Storage emulator
- `src/views/__tests__/RosterView.test.ts` — stale `"Roles config"` string assertion

The failing **test count** flaps run-to-run (30 → 51 observed) purely from the quarantined
`rules.test.ts` copies. **Judge against the FILE SET, which must not grow past those 10.**

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| D-17 | `VideoSlide` exists in the `Slide` union; assembler emits it; `PresentationViewer` renders a video SLIDE distinctly from bed video **without regressing Phase 23** | unit | `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts src/components/__tests__/PresentationViewer.test.ts` | ✅ extend |
| R031 | Rail renders groups in plan order; auto-selects first (D-05); zero-slide groups show count `0` (D-08); empty service shows the D-07 empty state | unit | `npx vitest run src/components/slides/__tests__/PlanRail.test.ts` | ❌ Wave 0 |
| R031 | Grid renders the selected group's cards; card click sets `selectedSlideId` (D-12); drag-reorder writes via `replaceGroupSlides` (D-11) | unit | `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts` | ❌ Wave 0 |
| R032 | PPTX import appends `GroupSlideEntry` items to the **selected group**, NOT a new plan item | unit | `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts -t "import"` | ❌ Wave 0 |
| R032 | **Audio** drop calls `setGroupBedMedia({ bedAudioUrl })` (bed). **Video** drop appends a `VideoSlide` entry via `replaceGroupSlides` (D-17) — *corrected from research* | unit | `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts -t "drop"` | ❌ Wave 0 |
| R018 | Rail renders **no** drag affordance (D-06) — negative assertion: no `cursor-grab`, no handle class on rail rows | unit | `npx vitest run src/components/slides/__tests__/PlanRail.test.ts -t "no drag"` | ❌ Wave 0 |
| R031 | Third tab wiring: `activeTab === 'slides'` button + panel | unit | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ extend |

---

## Wave 0 Requirements

- [ ] `src/components/slides/__tests__/PlanRail.test.ts` — R031 rail behavior + R018 no-drag negative assertion
- [ ] `src/components/slides/__tests__/SlideGrid.test.ts` — R031/R032 grid, selection, drag-reorder, drop, import
- [ ] `src/components/slides/__tests__/SlideCard.test.ts` — D-10 card content + D-12 selection (small; may fold into `SlideGrid.test.ts`)
- [ ] Extend `src/views/__tests__/ServiceEditorView.test.ts` — new `describe` for the third tab. The existing three-store mock (`scriptureSlides`, `importedSlides`, `slideGroups`) is already present; add assertions only, no new mock infrastructure.
- [ ] Extend `src/components/__tests__/PptxImportModal.test.ts` — cover the additive `defineExpose` extension that lets an externally drag-dropped `File` reach the modal
- [ ] Extend `src/utils/__tests__/slideshowAssembler.test.ts` + `src/components/__tests__/PresentationViewer.test.ts` — D-17 `VideoSlide`

**Framework install:** none required.

### Test-harness gotchas that have bitten this codebase repeatedly

- Modals teleport to `<body>` → assert via `DOMWrapper` over `document.body`, plus `enableAutoUnmount(afterEach)`.
- `shallowMount` **auto-stubs `<Teleport>`** → Teleported content needs `stubs: { teleport: false }` (found in 24-06).
- `ServiceEditorView.test.ts` needs Pinia mocks for `scriptureSlides`, `importedSlides` **and** `slideGroups`.
- Composable tests leak watchers → wrap each invocation in its own `effectScope()`, stopped in `afterEach` (found in 24-05).
- The autosave deep-watch leaks 800ms timers without `enableAutoUnmount`.
- **Tailwind v4:** dynamically-constructed class names are silently purged in production. Kind-badge colors MUST use static, fully-spelled-out class-map objects (the `SongBadge.vue` / `TeamTagPill.vue` pattern). This bug has already shipped twice here.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real drag-and-drop of a file from the OS onto the grid | R032 | jsdom cannot produce a genuine OS `DataTransfer` with real `File` payloads; unit tests can only synthesize the event | Drag `docs/example.pptx` and `docs/example.mp3` (both present in the working tree) onto the slide grid; confirm PPTX appends slides and MP3 sets the group bed |
| Video slide playback on a real projector | D-17 | Requires real display hardware and codec support | Append a video slide, enter Present mode, confirm it plays and does not regress Phase 23's bed-video behavior |
| Visual density / spacing against the design contract | R018 | Pixel judgment | Compare against `docs/design/slides-tab.dc.html` Turn 1 State 1 |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (use `vitest run`, never bare `vitest`)
- [ ] Failing-file set has not grown past the 10-file baseline
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
