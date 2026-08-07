---
phase: 42
slug: powerpoint-rendered-image-display
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-07
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 (app suite) + `@firebase/rules-unit-testing` (rules suite) |
| **Config file** | `vite.config.ts` (app, excludes `src/rules.test.ts`) · `vitest.rules.config.ts` (rules) |
| **Quick run command** | `npx vitest run --dir src --exclude '**/rules.test.ts' src/utils/__tests__/slideGroupMaterializer.test.ts` |
| **Full suite command** | `npx vitest run` then `npm run type-check` |
| **Rules suite command** | `npm run test:rules` (starts its own emulator; if one is already up, use `npx vitest run --config vitest.rules.config.ts`) |
| **Measured runtime** | ~10s targeted · ~178s full app suite · ~16s rules suite |

> ⚠ **Command discipline (CLAUDE.md).** NEVER `npx vitest run src/` — it picks up
> `render-service/src/render.test.ts` by substring match and dies on a Vitest version mismatch. Use
> `npx vitest run --dir src --exclude '**/rules.test.ts'` or bare `npx vitest run`.
>
> ⚠ **`src/rules.test.ts` is EXCLUDED from the default `npx vitest run`.** A clean app-suite run
> proves *nothing* about the `pptxRenders` rules change.
>
> ⚠ **Type-check gate is `npm run type-check`** (`vue-tsc --build`), never `-p tsconfig.app.json`.

---

## Sampling Rate

- **After every task commit:** targeted quick command for the files touched.
- **After every plan wave:** `npx vitest run` + `npm run type-check`.
- **After any task touching `firestore.rules`:** the rules suite, without exception.
- **Before `/gsd-verify-work`:** full app suite at the documented 3-file baseline
  (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`,
  `render-service/src/render.test.ts`), rules suite green, `npm run type-check` at 0 errors.
- **Max feedback latency:** 180 seconds.

---

## Per-Task Verification Map

Seeded with the requirement-to-verification mapping the plans must satisfy. The planner and executor
fill in concrete task IDs.

| Task ID | Req | Threat Ref | Secure / Correct Behavior | Test Type | Automated Command | Status |
|---------|-----|------------|---------------------------|-----------|-------------------|--------|
| TBD | R079 | — | A deck whose render is `ready` draws the rendered PNG in the **grid** — parsed text is not drawn | unit | quick cmd (`SlideCard`/`slideDisplay`) | ⬜ pending |
| TBD | R079 | — | The same deck draws the rendered PNG in the **presenter** | unit | quick cmd (`PresentationViewer`) | ⬜ pending |
| TBD | R079 | — | Grid and presenter agree on deck contents — both consume the **one shared** reconciliation helper | unit | `slideGroupMaterializer` + `slideshowAssembler` suites | ⬜ pending |
| TBD | R080 | — | `pending` renders an explicit pending state in grid **and** presenter — never blank, never parsed text | unit | component suites | ⬜ pending |
| TBD | R080 | — | `failed` renders an explicit failure state in grid **and** presenter | unit | component suites | ⬜ pending |
| TBD | R080 | — | `failureReason` is mapped to a human sentence; **an unknown slug hits the generic fallback and the raw slug never reaches the DOM** | unit | component suites | ⬜ pending |
| TBD | R080 | — | The presenter **never skips** a pending/failed slide — it occupies its position and counts in `n / m` | unit | `PresentationViewer` suite | ⬜ pending |
| TBD | R079 | — | A deck with **no `renderImportId`** keeps the existing parsed-text path, byte-unchanged — not a failure state | unit | component + materializer suites | ⬜ pending |
| TBD | R079 | — | **Count disagreement** (`renderedCount` ≠ `deck.slides.length`) reconciles with `renderedCount` winning — ROADMAP criterion 3's named case | unit | materializer + assembler suites | ⬜ pending |
| TBD | R079 | — | Surplus **rendered** pages beyond the parsed count are shown label-less, not dropped | unit | materializer suite | ⬜ pending |
| TBD | R079 | — | `sourceSignature` folds in `status` **and** `renderedCount`; a `pending → ready` transition changes it and the rebuild fires **exactly once** | unit | materializer + `slideGroups` store suites | ⬜ pending |
| TBD | R079 | — | A rebuild triggered by a render transition **does not drop user-added slides** (Phase 24 D-02 still governs) | unit | materializer suite | ⬜ pending |
| TBD | R080 | **T-37-15** | **DENY** — an org editor CANNOT write `organizations/{orgId}/pptxRenders/{importId}` (the wildcard write-exclusion fix) | **rules (emulator)** | `npm run test:rules` | ⬜ pending |
| TBD | R080 | — | **ALLOW** — an org member CAN read that document | **rules (emulator)** | `npm run test:rules` | ⬜ pending |
| TBD | R080 | — | **DENY** — a foreign-org editor and an unauthenticated caller can read neither | **rules (emulator)** | `npm run test:rules` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Rules probe first, before any rules edit.** Confirm in the emulator that an org editor can
      currently WRITE `organizations/{orgId}/pptxRenders/{importId}` via the generic wildcard at
      `firestore.rules:198-203`. This is the phase's core factual premise and it *contradicts* both
      `functions/src/index.ts:144-148` and the first draft of `42-CONTEXT.md`. **Prove it before
      changing anything** — if the probe shows write is already denied, the whole rules task
      evaporates and the plan must be re-cut. A red test that goes green is the evidence; a reading of
      the rules file is not.
- [ ] `src/composables/__tests__/useSlideshowAssembly.test.ts` — add the `usePptxRenders` (or
      equivalent) mock. The render-status subscription is new, and every IMPORTED-with-render test
      case fails to load until this exists. **This is a genuine blocker, on the Phase 41 precedent**:
      `services.test.ts`'s firestore mock lacked `where`/`getDocs`, which was discovered late and
      blocked every adoption test.
- [ ] Confirm whether the component suites need a `getDownloadURL` mock — the rendered-PNG path
      resolves Storage paths to URLs asynchronously, which none of the existing IMPORTED tests do.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real PPTX renders and **looks like it did in PowerPoint** | R079 | The phase's actual goal is visual fidelity, which no unit test can assert. jsdom has no rendering. `docs/example.pptx` is in the tree as a fixture | Import `docs/example.pptx`, open the Slides tab, confirm the slides look like the source deck; then present and confirm the same |
| The `pending → ready` transition observed live | R079 (criterion 4) | Requires a real render round-trip against the deployed Cloud Run service | Import a deck, watch the grid while the render completes; the tiles should flip from pending to the rendered image without a reload |
| Overlay-badge legibility across all three states | R080 | The UI-SPEC's one `backstop` consideration — asserted intent needing a held-out visual check | Eyeball the badge against a light rendered slide, a dark one, and both placeholder states |
| `firestore.rules` deploy | R080 | **Owner-gated by the v1.5 standing autonomy grant** | Owner runs `firebase deploy --only firestore:rules` — the same single deploy Phase 41 already queued. Until then the T-37-15 write hole stays open in production |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the rules probe and both test-mock gaps)
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] The `firestore.rules` change ships with a **passing ALLOW case that actually executed** against
      the emulator, plus the DENY case that proves the T-37-15 write hole is closed
- [ ] No test asserts a *presence* where the requirement is an *absence* (parsed text NOT drawn; the
      presenter NOT skipping; the raw `failureReason` slug NOT in the DOM)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
