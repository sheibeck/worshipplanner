---
phase: 35
slug: presentation-correctness-lyric-editor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 35 — Validation Strategy

> Seeded from `35-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 + @vue/test-utils ^2.4.6 (Vue 3.5.29) — no new config |
| **Config file** | `vite.config.ts` (app suite; excludes `src/rules.test.ts`) |
| **Quick run** | `npx vitest run src/components/__tests__/PresentationViewer.test.ts src/components/__tests__/LyricPasteDialog.test.ts src/components/__tests__/SongLyricEditor.test.ts src/utils/__tests__/slideGroupMaterializer.test.ts src/utils/__tests__/slideshowAssembler.test.ts src/components/slides/__tests__/SlidesTab.test.ts` |
| **Full suite** | `npx vitest run src/` |
| **Type gate** | `npm run type-check` (**`vue-tsc --build`** — NOT `-p tsconfig.app.json`) |

**Baseline that is NOT a defect:** `src/storage.rules.test.ts` + `src/views/__tests__/RosterView.test.ts`
= 9 tests / 2 files (~2219 total before this phase). **`npm run test:rules` is NOT a gate.**

---

## Sampling Rate

- **Per task commit:** the quick-run command, scoped to the file under active edit
- **Per wave merge:** `npx vitest run src/` **and** `npm run type-check`
- **Phase gate:** full suite green against the 2-file baseline, plus `npm run build`

---

## Per-Task Verification Map

> Threat Ref is `—` throughout: no new attack surface (no rules change, no new endpoint, no new
> secret, no user-supplied text reaching a new sink).

| Task ID | Req | Wave | Behavior | Automated Command | File Exists | Status |
|---------|-----|------|----------|-------------------|-------------|--------|
| TBD | R059 | — | Lyric slide never shows `sectionLabel` when presenting | `… PresentationViewer.test.ts -t "sectionLabel"` | ✅ **existing test at `:460-464` must be INVERTED** | ⬜ |
| TBD | R059 | — | Scripture/text `presentation-label` unaffected | `… PresentationViewer.test.ts -t "presentation-label"` | ✅ `:488, :541, :551` — must pass **unmodified** | ⬜ |
| TBD | R060 | 0 | Fallback path brackets a song group, incl. **empty `performanceOrder`** | `… slideshowAssembler.test.ts` | ⚠ new describe block | ⬜ |
| TBD | R060 | 0 | Materialized path brackets — fresh, rebuild, **and corrupted stored data** | `… slideGroupMaterializer.test.ts` | ⚠ new cases | ⬜ |
| TBD | R061 | 0 | `presentStartIndex` resolves slide / group-only / nothing / stale selection | `… SlidesTab.test.ts -t "present"` | ⚠ W0 | ⬜ |
| TBD | R061 | 0 | `PresentationViewer` seeds `currentIndex` from `initialIndex`, clamped | `… PresentationViewer.test.ts -t "initialIndex"` | ⚠ W0 | ⬜ |
| TBD | R065 | 0 | Warning renders; `Replace lyrics` disabled until override or CCLI number | `… LyricPasteDialog.test.ts -t "copyright"` | ⚠ W0 — genuinely new | ⬜ |
| TBD | R065 | 0 | **Override checkbox alone unblocks the save**, independent of every other field | same file | ⚠ W0 | ⬜ |
| TBD | R066 | — | Paste is inline — no Teleport, no backdrop, no modal chrome | `… SongLyricEditor.test.ts -t "paste"` | ⚠ existing tests **fully stub** `LyricPasteDialog` (`:190-204`) | ⬜ |
| TBD | R066 | — | Parsing/save logic unchanged | `npx vitest run src/utils/__tests__/ccliParser.test.ts src/utils/__tests__/songSectionOrder.test.ts` | ✅ 19 + 8 tests — **byte-identical, pass unmodified** | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `slideshowAssembler.test.ts` — R060 fallback bracket assertions. **The empty-`performanceOrder`
      case is the actual gap**; the populated case is already covered elsewhere in the file.
- [ ] `slideGroupMaterializer.test.ts` — R060 materialized bracket assertions across fresh **and**
      rebuild, **including the corrupted-data self-healing cases** (1 stored copyright entry, 3+).
- [ ] `SlidesTab.test.ts` — `presentStartIndex` cases: slide selected, group-only selected, nothing
      selected, and **stale/removed selection**.
- [ ] `PresentationViewer.test.ts` — `initialIndex` prop: seeds correctly, clamps out-of-range,
      defaults to 0 when absent. **Plus invert the existing `sectionLabel`-presence test at `:460-464`.**
- [ ] `LyricPasteDialog.test.ts` (or successor) — R065's warning + override gate. Genuinely new
      behavior with no prior test.

*Framework install: none required.*

---

## ★ Two rules that govern this phase's test churn

**1. R060 needs a TEST, not an implementation.** Research traced every group-construction path —
fallback (`slideshowAssembler.ts:379-393`), fresh materialization
(`slideGroupMaterializer.ts:54-66`), and rebuild (`:476-630`) — and all three unconditionally emit a
leading **and** trailing copyright bracket, including for empty `performanceOrder`, empty copyright
objects, and corrupted stored data (the rebuild path actively **self-heals** stray extra entries).
**Adding emission code would triple-emit copyright slides.** If a plan proposes new emission, that is
the defect.

**2. Distinguish a REQUIRED test edit from an ILLEGITIMATE one.** Phase 33's lesson — an existing test
edited to accommodate a new feature is a red flag — has exactly two sanctioned exceptions here, and
everything else must pass unmodified:

| Edit | Sanctioned? |
|---|---|
| `PresentationViewer.test.ts:460-464` — inverted from asserting `sectionLabel` is **present** to asserting it is **absent** | ✅ **Required.** R059 reverses this exact behavior; the old assertion encodes the bug. |
| `LyricPasteDialog.test.ts` — 9 parsing/save tests **moved verbatim**, 2-3 chrome-mechanism tests **reshaped** (modal chrome genuinely no longer exists) | ✅ Sanctioned. Moving ≠ weakening — the 9 must survive assertion-for-assertion. |
| `ccliParser.test.ts` (19) and `songSectionOrder.test.ts` `normalizeParsedSections` (8) | ❌ **Must not be touched at all.** These files are outside the phase's scope. |
| Any other pre-existing test | ❌ If one needs editing, stop and re-examine the change. |

---

## Manual-Only Verifications

| Behavior | Req | Why Manual | Instructions |
|----------|-----|------------|--------------|
| **Copyright slide legibility at projector distance** | R060 | The E2 `long-text` backstop. A long title, long author list, or many `copyrightLines` must not overflow or push the **CCLI licence number** off-screen — that number is the one element that must always be visible. Needs a real projector or fixed viewport. | Project a song with an unusually long title and 4+ authors. Confirm the licence number is visible on both the leading and trailing copyright slide. |
| **Presented lyric slide shows no organizational label** | R059 | The whole point is what a congregation sees. | Present a song. Confirm no VERSE / CHORUS / BRIDGE label appears on any lyric slide, and that the slide grid still shows them. |
| **Presenting starts where you were looking** | R061 | Feel, not just index arithmetic. | Highlight a slide mid-deck, press Present — it should open there and feel like a natural start, with no "you skipped ahead" indication. Then highlight only a group and confirm it starts at that group's first slide. |
| **The inline paste region reads as designed** | R066 | Compare against Turn 3 of the wireframe. | Paste a real CCLI song with copyright, and one without. Confirm the second shows the warning, disables **Replace lyrics**, and that ticking **Add anyway — I'll enter credits later** alone re-enables it. |
| ~~CCLI primary licence text~~ | R060 | **Retrieval failed a second time** (2026-08-03; a prior attempt returned marketing copy). R060 says it "should be pulled before this criterion is treated as final." | Owner to obtain it from their CCLI account if they want the criterion finalised. **Nothing in this phase cites CCLI as a mandate**, so this does not block. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
