---
phase: 23
slug: presentation-preview-mode
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-25
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `23-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 + @vue/test-utils ^2.4.6 |
| **Config file** | `vite.config.ts` (`test: { environment: 'jsdom', exclude: [...] }`) — no separate `vitest.config.ts`, no global `setupFiles` (media-element stubs set per-test in `beforeEach`) |
| **Quick run command** | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` |
| **Full suite command** | `npx vitest run` (non-interactive; `npm run test:unit` defaults to watch mode) |
| **Estimated runtime** | ~5s quick / ~60s full |

**Emulator constraint (from STATE.md — hard):** do NOT run `npm run test:rules` and do NOT restart the
Firestore/Storage emulator. A live user session may hold ports 8080/9199. This phase touches no
Firestore rules, so `test:rules` is not required for any task.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed test file(s)>`
- **After every plan wave:** Run `npx vitest run` (full unit suite, non-watch)
- **Before `/gsd-verify-work`:** Full suite green + `npm run type-check` clean + `npm run build` green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner; rows below are keyed by behavior and are bound to concrete
task IDs when plans land. Every behavior here is a `must_have` candidate for goal-backward verification.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | R016 | — | N/A | component | `npx vitest run src/components/__tests__/SlideshowPreview.test.ts` — "Present Slideshow" CTA disabled at 0 slides, enabled otherwise | ⚠️ extend existing | ⬜ pending |
| TBD | TBD | 1 | R016 | — | N/A | component | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` — viewer teleports to body, renders slide at index | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | R016 | — | N/A | component | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` — →/Space/←/Backspace/Esc navigate+exit, stop-at-ends (no wrap) | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | R016 | — | N/A | component | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` — progress indicator `"{section} · N / M"` / `"N / M"` ungrouped | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | R016 | — | N/A | component | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` — outgoing slide's media `.pause()` called before advance | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | R016 | — | Slide text interpolated as text, never `v-html` | component | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` — media `@error` hides player, shows "Media unavailable", slide text still renders | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | R016 | — | N/A | component | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` — autoplay-blocked affordance: "Tap to play" vs "Playing muted — tap to unmute" (mock `HTMLMediaElement.prototype.play` → `NotAllowedError`) | ❌ W0 | ⬜ pending |
| TBD | TBD | 0/1 | R016 | — | N/A | component | `npx vitest run src/components/__tests__/AudioPlayer.test.ts src/components/__tests__/VideoPlayer.test.ts` — `chromeless` prop omits native `controls` | ⚠️ extend existing | ⬜ pending |
| TBD | TBD | 1 | R016 | — | N/A | component | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` — congregational scripture Leader/Congregation blocks, incl. empty/undefined `sections` fallback | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | R018 | — | N/A | component | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` — chrome auto-hide after ~3s idle / reappear on activity (`vi.useFakeTimers()`) | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | R016 | — | N/A | component | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` — `requestFullscreen()` rejection falls back to fixed CSS overlay (mock `Element.prototype.requestFullscreen` → rejected promise) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/__tests__/PresentationViewer.test.ts` — new file; covers every component-testable R016/R018 behavior above
- [ ] Extend `src/components/__tests__/AudioPlayer.test.ts` + `VideoPlayer.test.ts` — assert `chromeless` omits `controls`
- [ ] Extend `src/components/__tests__/SlideshowPreview.test.ts` — assert CTA disabled/enabled state and open-viewer emit
- [ ] Fixtures: reuse `SlideshowPreview.test.ts`'s existing `copyrightSlide()` / `lyricSlide()` / `scriptureSlide()` builders as `AssembledSlide` fixtures (extract to a shared test-fixture module if the planner prefers DRY)
- [ ] Framework install: **none** — Vitest + @vue/test-utils already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real browser fullscreen enter/exit + native Esc-to-exit sync | R016 | jsdom does not implement the Fullscreen API at all; only the *rejection* branch is unit-testable | Open a service with slides → click "Present Slideshow" → confirm true fullscreen, press Esc → confirm viewer state syncs to exited |
| iOS Safari fullscreen behavior | R016 | Element-type restrictions are `[ASSUMED]` in RESEARCH; real device required | Open on iPad/iPhone Safari → confirm viewer is usable (fullscreen or CSS-overlay fallback) |
| Real unmuted audio/video autoplay across actual browser autoplay policies | R016 | jsdom media methods are stubs; real policy variance cannot be simulated | Attach MP3 + MP4 to slots → present → confirm autoplay on slide entry, stop at end, no loop |
| Graceful degradation on deleted/expired media (Phase 22 2-week cleanup) | R016 | Requires a real expired/removed Storage object | Present a service whose slide references removed media → confirm "Media unavailable" notice, no crash, text still renders |
| Visual "feel" of chrome auto-hide timing + projection-scale typography | R018 | Subjective; requires a real projector/large screen | Present on the projector → confirm chrome fade timing is unobtrusive and text is legible from the back of the room |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`npx vitest run`, never bare `npm run test:unit`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
