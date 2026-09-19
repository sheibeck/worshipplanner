---
phase: 142
slug: slides-tab-panel-ux-from-claude-design
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: true
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

- **After every task commit:** Run the quick run command (add `src/components/slides/__tests__/SlideGroupSetupStrip.test.ts` once Plan 03 creates it) — each PLAN.md task's `<verify><automated>` is a scoped subset of it
- **After every plan (end of its last task):** `npm run type-check` (vue-tsc --build)
- **Phase gate (142-04-T3):** `npx vitest run` (full app suite, detached) + `npm run type-check`
- **Before `/gsd-verify-work`:** Full suite green (2-file baseline) AND `npm run type-check` clean — `vue-tsc --build`, never `-p tsconfig.app.json` (CLAUDE.md gate)
- **Max feedback latency:** 30 seconds (quick run)

---

## Per-Task Verification Map

Filled in by the planner from PLAN.md task IDs. Decision → test mapping from 142-RESEARCH.md §Validation Architecture:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 142-01-T1 | 142-01 | 1 | D: setGroupBedMedia no-MP3 vamp patch (existing-doc path) — CONTEXT › Audio slot | T-142-01 | Stale `bedAudioUrl` is `deleteField()`ed, never left behind; write stays scoped to the caller's org/slot doc | unit | `npx vitest run src/stores/__tests__/slideGroups.test.ts -t "no-MP3 vamp against an existing doc"` | ✅ (new describe) | ✅ green |
| 142-01-T1 | 142-01 | 1 | D: live playback tolerates `bedVampId` without `bedAudioUrl` (regression only) | — | N/A | unit | `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts -t "bedVampId with no bedAudioUrl"` | ✅ (new case) | ✅ green |
| 142-01-T2 | 142-01 | 1 | D: BackgroundControl `variant="chip-popover"` (None · recents · ＋ upload/drop · inherited explainer); panel variant byte-identical — CONTEXT › Background & Display chips | T-142-02, T-142-03 | Drop goes through `useBackgroundUpload.validate()`; tiles gated `isEditor && !inheritedFrom`; song-level call site untouched (existing describe unmodified) | unit | `npx vitest run src/components/slides/__tests__/BackgroundControl.test.ts` | ✅ (new describe) | ✅ green |
| 142-01-T3 | 142-01 | 1 | D: Display tiles + dynamic `sizeHint` hint copy; same `videoOutput.mode` write — CONTEXT › Background & Display chips | — | `select()`/emit unchanged; `:disabled="!editable"` kept as defensive plumbing | unit | `npx vitest run src/components/slides/__tests__/SlotVideoOutputControl.test.ts` | ✅ (updated cases) | ✅ green |
| 142-02-T1 | 142-02 | 1 | D: VampPicker `allowUnattached` — CONTEXT › Audio slot (no-MP3 vamp assignable) | T-142-09 | Default `false`; per-slide drawer (`EditSlideDrawer.vue`) call site unchanged — no-MP3 rows still disabled there | unit | `npx vitest run src/components/__tests__/VampPicker.test.ts src/components/slides/__tests__/EditSlideDrawer.test.ts` | ✅ (new cases) | ✅ green |
| 142-02-T2 | 142-02 | 1 | D: Track row "duration when known" — AudioPlayer `loadedmetadata` emit (additive) | — | N/A (Run-control audio suite re-run to prove no change) | unit | `npx vitest run src/components/__tests__/AudioPlayer.test.ts src/views/__tests__/RunControlView.audio.test.ts` | ✅ (new cases) | ✅ green |
| 142-02-T3 | 142-02 | 1 | D: `audioTab` derivation incl. no-MP3 vamp; None/Track/Vamp tabs; inline VampPicker; Track row — CONTEXT › Audio slot | T-142-06, T-142-07, T-142-08 | Tabs disabled / Replace / Remove / picker hidden for `!isEditor`; None → `remove` (explicit-clear path); rejected upload emits nothing | unit | `npx vitest run src/components/slides/__tests__/SlideGroupMusicControl.test.ts src/components/slides/__tests__/SlideGrid.test.ts` | ✅ (rewritten suite) | ✅ green |
| 142-03-T1 | 142-03 | 2 | D: chip state table (set / unset "Add" dashed / vamp-no-MP3 amber / inherited "(song)" / locked inert span); caption singular/plural — CONTEXT › Layout | T-142-11 | Locked / non-editor → `<span>`, no caret, no aria-haspopup, no popover, no control mounts, no write | unit | `npx vitest run src/components/slides/__tests__/SlideGroupSetupStrip.test.ts -t "chips"` | ✅ (created 142-03) | ✅ green |
| 142-03-T2 | 142-03 | 2 | D: one popover at a time; click-outside / Esc close; focus in/return; group-switch reset; edge flip; six passthrough emits — CONTEXT › Layout | T-142-12 | Global listeners added only while open, removed on close AND unmount | unit | `npx vitest run src/components/slides/__tests__/SlideGroupSetupStrip.test.ts -t "lifecycle\|passthrough"` | ✅ (created 142-03) | ✅ green |
| 142-04-T1 | 142-04 | 3 | D: panel gate → `Boolean(selectedSlot)`; chips lead, Loop/Congregational/Remove-imported trail; `onAttachGroupVamp` no-URL guard removed; testid migration (~42 refs) — CONTEXT › Layout + Audio slot | T-142-15, T-142-16, T-142-18 | Every handler still re-checks `canWriteGroupMedia` (≥ 8 occurrences); viewers/locked get inert chips; no-MP3 patch has no `bedAudioUrl` key | unit | `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts` | ✅ (migrated) | ✅ green |
| 142-04-T2 | 142-04 | 3 | D: Background recents derived in SlidesTab (groups by `updatedAt` desc, then song-inherited in plan order, deduped, ≤ 4, no new read) — CONTEXT › Background (Claude's discretion resolved) | T-142-17 | No new Firestore read / subscription (`getDocs`/`onSnapshot`/`useSongs` absent from SlidesTab.vue) | unit | `npx vitest run src/components/slides/__tests__/SlidesTab.test.ts -t "recentBackgrounds"` | ✅ (new cases) | ✅ green |
| 142-04-T3 | 142-04 | 3 | Phase gate — full app suite at the 2-file baseline + `npm run type-check` | — | N/A | full suite + type-check | `npm run type-check && npx vitest run` (detached, ~9 min) | ✅ | ✅ green |

*Status legend: ✅ green (verified) · ❌ red (failing) · ⚠️ flaky · (unmarked = not yet run)*

---

## Wave 0 Requirements

- [x] `src/components/slides/__tests__/SlideGroupSetupStrip.test.ts` — new file: chip state table (UI-SPEC §1), popover shell (§2), single-open-at-a-time + reset-on-group-switch
- [x] New case in `src/stores/__tests__/slideGroups.test.ts` — existing group doc + no-MP3 vamp patch shape (the bug fix's regression test; a fresh-doc fixture would pass even with the bug present)
- [x] Confirm/add a case in `src/utils/__tests__/slideshowAssembler.test.ts` for `bedVampId` set with `bedAudioUrl` absent
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
