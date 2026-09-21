---
phase: 141
slug: vamp-slide-assignment-live-playback
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-13
---

# Phase 141 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom) for the app; rules via `firebase emulators:exec` (no rules change expected this phase) |
| **Config file** | `vite.config.ts` (root) — excludes `src/rules.test.ts` and `render-service/**` |
| **Quick run command** | `npx vitest run <changed test files>` |
| **Full suite command** | `npx vitest run` (baseline = exactly 1 known-failing file: `src/storage.rules.test.ts`) |
| **Estimated runtime** | ~60–90s full app suite |

Type-check gate: `npm run type-check` (vue-tsc --build — never the narrower `-p tsconfig.app.json` form).

---

## Sampling Rate
- After every task commit: `npx vitest run <changed file(s)>`
- After every plan wave: `npx vitest run` + `npm run type-check` (expect only the `storage.rules.test.ts` baseline failure)
- Before verify: full suite green except the documented baseline
- Max feedback latency: ~90s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 141-01-T1 | 01 | 1 | R437 | component | `npx vitest run src/components/__tests__/VampPicker.test.ts` + grep `vampLabel?: string` in `src/types/slideGroup.ts` | ✅ green |
| 141-01-T2 | 01 | 1 | R437 | component | `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts` | ✅ green |
| 141-01-T3 | 01 | 1 | R437 | component | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts -t "141-01"` + grep `vampStore.subscribe(orgId)` | ✅ green |
| 141-02-T1 | 02 | 1 | R438 | component | `npx vitest run src/components/slides/__tests__/SlideCanvas.test.ts` | ✅ green |
| 141-02-T2 | 02 | 1 | R438 | component | `npx vitest run src/views/__tests__/AudienceOutputView.test.ts src/views/__tests__/ConfidenceOutputView.test.ts src/views/__tests__/VideoOutputView.test.ts` (+ output component tests) | ✅ green |
| 141-03-T1 | 03 | 2 | R438, R439 | component/composable | `npx vitest run src/views/__tests__/RunControlView.audio.test.ts` (+ sibling RunControlView suites) | ✅ green |
| 141-03-T2 | 03 | 2 | R438 | component | `npx vitest run src/components/run/__tests__/RunPreviewPair.test.ts src/views/__tests__/RunControlView.audio.test.ts` | ✅ green |
| 141-04-T1 | 04 | 2 | R440 | store/unit | `npx vitest run src/stores/__tests__/vamps.test.ts` | ✅ green |
| 141-04-T2 | 04 | 2 | R440 | component | `npx vitest run src/components/__tests__/VampSlideOver.test.ts` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/components/__tests__/VampPicker.test.ts` — new file: picker rendering, search by name/key, disabled no-MP3 rows, selection, empty/no-match states (mirror `VampTable.test.ts`) — R437.
- [x] `src/components/slides/__tests__/EditSlideDrawer.test.ts` — new `describe('vamp assignment')`: assign writes `audioUrl`/`audioLoop:true`/`vampId`/`vampLabel` in one `replaceGroupSlides` call; Change re-opens with current selection; Clear removes all four fields (never writes `undefined`) — R437.
- [x] `src/components/slides/__tests__/SlideCanvas.test.ts` — `suppressAudio` describe block mirroring the `suppressBackground` block: no `AudioPlayer` mounts — R438.
- [x] `src/views/__tests__/AudienceOutputView.test.ts`, `ConfidenceOutputView.test.ts`, `VideoOutputView.test.ts` — every `SlideCanvas`/`FullscreenSlideOutput` mount receives `suppressAudio: true` — R438.
- [x] `src/views/__tests__/RunControlView.audio.test.ts` — new sibling file (per the `.loop.`/`.output.` split convention): control-window `AudioPlayer` plays on a slide-with-audio going live, loops per `audioLoop`, pauses on slide change / blackout / exit; arm toggle primes + starts audio; `autoplay-blocked` → banner + working retry; media `error` → "Audio unavailable"; arm state resets on re-entry — R438, R439.
- [x] `src/stores/__tests__/vamps.test.ts` — `deleteVamp` keeps the Storage MP3 when any assignment exists, deletes both when none; assignment scan counts distinct upcoming services and fails open — R440.
- [x] `src/components/__tests__/VampSlideOver.test.ts` — delete-confirm warning line singular / plural / scan-failed / none — R440.
- [x] Church-switch: the service editor's vamp-store subscription sits inside the `isEditor` gate and re-subscribes on org change (assert in the existing `ServiceEditorView` tests or a store test).

*All 8 Wave 0 items landed in Phase 141 commits (11 test files touched, incl. `RunPreviewPair.test.ts` for the ♪ Vamp badges).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-speaker audibility from the Run control window; Audience/Confidence/Video outputs silent; no echo on a single multi-monitor machine | R438 | jsdom mocks `HTMLMediaElement.play()`; audible output and Chrome's Media Engagement heuristic are hardware/browser-dependent | Deferred to batched v2.15 UAT: fresh browser profile, run a service with a vamp-assigned slide, arm audio, confirm sound only from the control machine's speakers |
| Arm gesture satisfies Chrome autoplay policy; blocked warning appears when it does not | R439 | Browser autoplay policy is not modeled in jsdom | Deferred to batched UAT: open Run in a fresh profile, do NOT click Arm, advance to a vamp slide → expect the amber blocked warning; click Arm → expect playback |
| Vamp picker, assigned row, arm toggle, badges, and delete-confirm copy match 141-UI-SPEC.md | R437, R439, R440 | Visual/layout judgement | Deferred to batched UAT |

*Automated coverage exists (or is added in Wave 0) for the assignment write path, the suppressAudio prop on all outputs, the control-window player binding and arm/blocked/unavailable states, and the R440 scan + conditional Storage keep.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (9/9 tasks carry an `<automated>` command)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (`vitest run` everywhere)
- [x] Feedback latency < 90s per task (full suite is ~9 min on this machine — run per-file during tasks)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-18 (retroactive Nyquist audit, gaps 0)

---

## Validation Audit 2026-09-18

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 9 tasks across the 4 plans carry a green `<automated>` command; all 8 Wave 0 test files exist and were
added/extended by Phase 141 commits. Evidence: verifier's targeted run of the 11 phase-141 test files —
699/699 passed; orchestrator regression gate — full `npx vitest run` 238/239 files, 5,864 tests passed,
0 failed (the single failing file is the documented `src/storage.rules.test.ts` baseline);
`npm run type-check` clean. Manual-only rows unchanged — they are the 4 items batched into
`.planning/v2.15-DEFERRED-VERIFICATION.md` (see 141-VERIFICATION.md / 141-UAT.md).
