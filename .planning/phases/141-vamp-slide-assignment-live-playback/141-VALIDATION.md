---
phase: 141
slug: vamp-slide-assignment-live-playback
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| _seeded by planner_ | — | — | R437, R438, R439, R440 | unit/component | `npx vitest run` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/__tests__/VampPicker.test.ts` — new file: picker rendering, search by name/key, disabled no-MP3 rows, selection, empty/no-match states (mirror `VampTable.test.ts`) — R437.
- [ ] `src/components/slides/__tests__/EditSlideDrawer.test.ts` — new `describe('vamp assignment')`: assign writes `audioUrl`/`audioLoop:true`/`vampId`/`vampLabel` in one `replaceGroupSlides` call; Change re-opens with current selection; Clear removes all four fields (never writes `undefined`) — R437.
- [ ] `src/components/slides/__tests__/SlideCanvas.test.ts` — `suppressAudio` describe block mirroring the `suppressBackground` block: no `AudioPlayer` mounts — R438.
- [ ] `src/views/__tests__/AudienceOutputView.test.ts`, `ConfidenceOutputView.test.ts`, `VideoOutputView.test.ts` — every `SlideCanvas`/`FullscreenSlideOutput` mount receives `suppressAudio: true` — R438.
- [ ] `src/views/__tests__/RunControlView.audio.test.ts` — new sibling file (per the `.loop.`/`.output.` split convention): control-window `AudioPlayer` plays on a slide-with-audio going live, loops per `audioLoop`, pauses on slide change / blackout / exit; arm toggle primes + starts audio; `autoplay-blocked` → banner + working retry; media `error` → "Audio unavailable"; arm state resets on re-entry — R438, R439.
- [ ] `src/stores/__tests__/vamps.test.ts` — `deleteVamp` keeps the Storage MP3 when any assignment exists, deletes both when none; assignment scan counts distinct upcoming services and fails open — R440.
- [ ] `src/components/__tests__/VampSlideOver.test.ts` — delete-confirm warning line singular / plural / scan-failed / none — R440.
- [ ] Church-switch: the service editor's vamp-store subscription sits inside the `isEditor` gate and re-subscribes on org change (assert in the existing `ServiceEditorView` tests or a store test).

*Final list finalized by the planner.*

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
