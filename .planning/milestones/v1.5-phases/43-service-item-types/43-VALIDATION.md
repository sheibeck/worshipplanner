---
phase: 43
slug: service-item-types
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-07
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | `vite.config.ts` (excludes `src/rules.test.ts`) |
| **Quick run command** | `npx vitest run --dir src --exclude '**/rules.test.ts' src/utils/__tests__/slotTypes.test.ts src/utils/__tests__/planningCenterApi.test.ts` |
| **Full suite command** | `npx vitest run` then `npm run type-check` |
| **Measured runtime** | ~10s targeted · ~184s full app suite |

> ⚠ **`npm run type-check` is load-bearing for this phase specifically.** Widening `SlotKind` makes the
> compiler surface every exhaustive `switch (slot.kind)` that needs a new case. The `vue-tsc --build`
> form typechecks test files too; `-p tsconfig.app.json` silently skips them and would hide exactly the
> errors this phase is meant to be guided by. CLAUDE.md documents five `TS2339` errors that survived two
> full phases behind the narrow form.
>
> ⚠ NEVER `npx vitest run src/` — it picks up `render-service/src/render.test.ts` and dies on a Vitest
> version mismatch. Use `--dir src --exclude '**/rules.test.ts'` or bare `npx vitest run`.
>
> ⚠ No `firestore.rules` change in this phase, so the rules suite is not a gate here.

---

## Sampling Rate

- **After every task commit:** `npm run type-check` FIRST (it is the phase's primary defect detector),
  then the targeted quick command.
- **After every plan wave:** `npx vitest run` + `npm run type-check`.
- **Before `/gsd-verify-work`:** full app suite at the documented 3-file baseline, `npm run type-check`
  at 0 errors.
- **Max feedback latency:** 184 seconds.

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Status |
|-----|----------|-----------|--------|
| R081 | A planner can add an Announcements item from the palette; `createSlot('ANNOUNCEMENTS')` yields a valid slot with a stable `id` | unit | ⬜ pending |
| R081 | Free text typed into an Announcements item persists in `body` | unit | ⬜ pending |
| R082 | Same two, for Miscellaneous | unit | ⬜ pending |
| R083 | The Message editor renders a free-text box and **no URL link control** — asserted as an ABSENCE | unit | ⬜ pending |
| R083 | A stored `linkUrl` on a Message slot is **not destroyed** by the UI change — asserted on the data, not the DOM | unit | ⬜ pending |
| R084 | Hymn is **absent** from the add-item palette — an absence assertion | unit | ⬜ pending |
| R084 | A stored HYMN slot still renders, prints, and presents unchanged — the regression half, which is the harder and more important half | unit | ⬜ pending |
| R084 | `createSlot('HYMN')` and `slotLabel()` for HYMN still work — the kind is retired from the palette, not from the type | unit | ⬜ pending |
| **R085** | **Announcements exports to PC as `Announcements`, NOT as "Message"** | unit | ⬜ pending |
| **R085** | **Miscellaneous exports to PC as `Miscellaneous`, NOT as "Message"** | unit | ⬜ pending |
| R085 | Message still exports as `Message` | unit | ⬜ pending |
| R085 | `body` reaches the PC item description for all three text kinds | unit | ⬜ pending |
| R085 | HYMN, SONG, SCRIPTURE, PRAYER, IMPORTED export paths are unchanged | unit | ⬜ pending |
| R085 | **A compiler backstop exists** — a future `SlotKind` member produces a type error in `addSlotAsItem` rather than a silent "Message" | source assertion + type-check | ⬜ pending |
| UI-SPEC | `elementLabel()` gains `ANNOUNCEMENTS` / `MISC` cases (UI checker's carried-forward recommendation) | unit | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] None identified. This phase adds no new external dependency, no new Firestore collection, and no
      new query shape — the two prior phases' Wave 0 blockers were both test-mock gaps for new
      infrastructure, and this phase introduces none. If widening `SlotKind` turns out to break a
      shared test fixture, that surfaces immediately under `npm run type-check` rather than late.

*Existing infrastructure covers the phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real Planning Center export shows Announcements and Miscellaneous as themselves | R085 | Requires live PC credentials and a real plan; the unit test proves the branch, not the round-trip | Export a service containing one of each new type; confirm the PC plan shows three distinctly-titled items, none labelled "Message" |
| An existing service containing a Hymn item still looks right end-to-end | R084 | Visual/print fidelity across three surfaces cannot be asserted in jsdom | Open a saved service with a Hymn item; confirm it renders in the editor, prints, and presents exactly as before |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or a documented manual-only entry
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] No watch-mode flags
- [ ] Feedback latency < 184s
- [ ] **R085's two "exports as itself, not as Message" assertions actually exist and actually run** —
      this is the phase's whole reason for existing and the one defect the compiler cannot catch
- [ ] The compiler backstop is proven to work, not merely present — a deliberately-added dummy kind
      should produce a type error
- [ ] Absence assertions are genuine absences (no Hymn in palette; no URL control on Message)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
