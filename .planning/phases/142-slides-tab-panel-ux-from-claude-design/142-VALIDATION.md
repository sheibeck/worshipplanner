---
phase: 142
slug: slides-tab-panel-ux-from-claude-design
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-19
---

# Phase 142 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.5 (app suite) + @vue/test-utils |
| **Config file** | `vite.config.ts` (`test` block — excludes `src/rules.test.ts` and `render-service/**`) |
| **Quick run command** | `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts src/components/slides/__tests__/SlideGroupMusicControl.test.ts src/components/slides/__tests__/BackgroundControl.test.ts src/components/slides/__tests__/SlotVideoOutputControl.test.ts src/components/__tests__/VampPicker.test.ts src/stores/__tests__/slideGroups.test.ts` |
| **Full suite command** | `npx vitest run` (bare — 2-file baseline per CLAUDE.md: only `src/storage.rules.test.ts` known-fails, an environment limitation) |
| **Estimated runtime** | quick ≈ 30 s · full ≈ 9 min (run detached) · `npm run type-check` ≈ 60 s |

---

## Sampling Rate

- **After every task commit:** Run the quick run command (add `src/components/slides/__tests__/SlideGroupSetupStrip.test.ts` once Wave 0 creates it)
- **After every plan wave:** Run `npx vitest run` (full app suite) + `npm run type-check`
- **Before `/gsd-verify-work`:** Full suite green (2-file baseline) AND `npm run type-check` clean — `vue-tsc --build`, never `-p tsconfig.app.json` (CLAUDE.md gate)
- **Max feedback latency:** 30 seconds (quick run)

---

## Per-Task Verification Map

Filled in by the planner from PLAN.md task IDs. Decision → test mapping from 142-RESEARCH.md §Validation Architecture:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | D: setGroupBedMedia no-MP3 vamp patch (existing-doc path) | — | Write stays scoped to the caller's org/service | unit | `npx vitest run src/stores/__tests__/slideGroups.test.ts -t "bedVamp"` | ✅ (new case) | ⬜ pending |
| TBD | — | — | D: chip state table (set/unset/vamp-no-MP3/inherited/open/locked) | — | Locked → inert spans, no popover, no write | unit | `npx vitest run src/components/slides/__tests__/SlideGroupSetupStrip.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | D: audioTab derivation incl. no-MP3 vamp | — | N/A | unit | `npx vitest run src/components/slides/__tests__/SlideGroupMusicControl.test.ts` | ✅ (new cases) | ⬜ pending |
| TBD | — | — | D: VampPicker `allowUnattached` | — | Per-slide drawer call site unchanged (no-MP3 rows still disabled) | unit | `npx vitest run src/components/__tests__/VampPicker.test.ts` | ✅ (new cases) | ⬜ pending |
| TBD | — | — | D: BackgroundControl chip-popover variant; panel variant byte-identical | — | Song-level call site untouched | unit | `npx vitest run src/components/slides/__tests__/BackgroundControl.test.ts` | ✅ (new cases) | ⬜ pending |
| TBD | — | — | D: panel gate → `Boolean(selectedSlot)`; testid migration | — | N/A | unit | `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts` | ✅ (migrate ~42 refs) | ⬜ pending |
| TBD | — | — | D: live playback tolerates `bedVampId` without `bedAudioUrl` | — | N/A | unit | `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts` | ✅ (verify/add case) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/slides/__tests__/SlideGroupSetupStrip.test.ts` — new file: chip state table (UI-SPEC §1), popover shell (§2), single-open-at-a-time + reset-on-group-switch
- [ ] New case in `src/stores/__tests__/slideGroups.test.ts` — existing group doc + no-MP3 vamp patch shape (the bug fix's regression test; a fresh-doc fixture would pass even with the bug present)
- [ ] Confirm/add a case in `src/utils/__tests__/slideshowAssembler.test.ts` for `bedVampId` set with `bedAudioUrl` absent
- No new framework or config — vitest is already configured for these directories

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Popover never clipped by the scrolling slide grid; flips to right-align near the viewport edge | UI-SPEC §2 / UI Considerations (overflow) | Layout/viewport geometry not observable in jsdom | Open each chip's popover on a narrow window with the grid scrolled; confirm the popover is fully visible and flips at the right edge |
| Drop an image file onto the Background ＋ tile uploads it | CONTEXT (Background popover) | Real DataTransfer/file drop needs a browser | Drag a PNG from the desktop onto the ＋ tile; confirm the upload progress row and the new background thumbnail |
| Track ▶ preview plays audio; Vamp with no MP3 plays nothing live | CONTEXT (Audio slot) | Audio output | Assign a track, press ▶; assign a no-MP3 vamp, run the service, confirm silence and the amber label |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
