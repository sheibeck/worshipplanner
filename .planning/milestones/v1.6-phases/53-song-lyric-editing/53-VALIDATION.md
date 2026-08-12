---
phase: 53
slug: song-lyric-editing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-11
---

# Phase 53 — Validation Strategy

> Seeded from 53-RESEARCH.md § Validation Architecture. New pure helpers (`sliceSectionIntoSlides`,
> `deriveSectionKind`, per-kind numbering) get RED-first unit tests; the assembler split + duplicate
> paths and the editor/paste UI get behavior tests. Backward-compat (BWC) is a named regression class.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + @vue/test-utils (jsdom) |
| **Config file** | `vite.config.ts` (app suite; excludes `src/rules.test.ts`) |
| **Quick run command** | `npx vitest run --dir src <path>` (scope to touched file) |
| **Full suite command** | `npx vitest run --dir src --exclude '**/rules.test.ts'` (or bare `npx vitest run`) |
| **Type gate** | `npm run type-check` (= vue-tsc --build; checks tests — CLAUDE.md) |

**Known-failing baseline (exactly 2, not regressions):** `src/storage.rules.test.ts`,
`src/views/__tests__/RosterView.test.ts`. This phase touches no Firestore rules; `npm run test:rules`
not required. Do NOT use `npx vitest run src/` (pulls render-service) or `--dir src` without the exclude
in the phase gate.

---

## Per-Requirement Verification Map

| Req | Behavior | Type | File |
|-----|----------|------|------|
| R117 | `sliceSectionIntoSlides`: breaks → N groups; absent → 1; clamps invalid indices | unit | `src/utils/__tests__/songSectionOrder.test.ts` (extend) |
| R117 | Both assembler paths emit N slides for a split section (stored + fallback), ids `${entry.id}:i` | unit | `src/utils/__tests__/slideshowAssembler.test.ts` (extend) |
| R117 | Unsplit section unchanged (id `entry.id`, one slide) — regression guard | unit | `slideshowAssembler.test.ts` |
| R117 | Editor split affordance writes `slideBreaks` | component | `src/components/__tests__/SongLyricEditor.test.ts` (extend) |
| R118 | Duplicated split occurrence emits all N slides, distinct ids, BOTH occurrences | unit | `slideshowAssembler.test.ts` + `slideGroupMaterializer.test.ts` (repeat entries unchanged) |
| R119 | `'Pre-Chorus'` in `ADD_SECTION_KINDS`; slugs to `pre-chorus` | unit | `songSectionOrder.test.ts` |
| R119 | Add-Pre-Chorus palette button renders + adds a section | component | `SongLyricEditor.test.ts` |
| R120 | `deriveSectionKind` strips trailing number for all real labels | unit | `songSectionOrder.test.ts` |
| R120 | `buildSectionRows` per-kind ordinal; repeats/splits share number; none unnumbered | unit | `songSectionOrder.test.ts` |
| R120 | Editor renders derived label; adding a Verse after pasted "Verse 1/2" shows "Verse 3" | component | `SongLyricEditor.test.ts` |
| R121 | Button reads "Save" when `currentSectionCount === 0`, else "Replace lyrics" | component | `src/components/__tests__/LyricPasteRegion.test.ts` (extend) |
| BWC | Legacy section (no `slideBreaks`) renders byte-identically; stored label never rewritten | unit | `slideshowAssembler.test.ts` + `songSectionOrder.test.ts` |

---

## Wave 0 Requirements

- [ ] `sliceSectionIntoSlides` tests — NEW function (add to `songSectionOrder.test.ts`).
- [ ] `deriveSectionKind` + per-kind numbering tests — NEW (add to `songSectionOrder.test.ts`).
- [ ] Assembler split tests on BOTH paths incl. duplicate (R118) — extend `slideshowAssembler.test.ts`.
- [ ] BWC regression: unsplit/legacy section byte-identical + stored label untouched.
- [ ] No new framework/config/fixtures — all target files exist.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Split an 8-line chorus into two 4-line slides by hand; both appear when presenting | R117 | Real editor interaction + projection | In the song editor, split a chorus after line 4; present the service and confirm two chorus slides |
| Duplicating the split chorus brings both slides | R118 | End-to-end duplicate + present | Duplicate the split chorus; present; confirm both occurrences show both slides |
| Adding a Verse names it by position (e.g. "Verse 3") | R120 | Real add against a pasted song | Paste a song with Verse 1/Verse 2; click Verse; confirm the new one reads "Verse 3" |
| First-time paste button reads "Save" | R121 | Real new-song flow | On a brand-new song, open paste lyrics; confirm the commit button reads "Save" |

---

## Validation Sign-Off

- [ ] New helpers have RED-first unit tests before wiring
- [ ] Unsplit/legacy sections proven byte-identical (BWC); stored labels never rewritten
- [ ] Full app suite green at the exactly-2-file baseline; `npm run type-check` clean
- [ ] `nyquist_compliant: true` set by validate-phase

**Approval:** pending
