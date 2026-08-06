---
phase: 33
slug: backgrounds-slide-editing
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-02
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `33-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + `@vue/test-utils` |
| **Config file** | `vite.config.ts` (app suite — **excludes `src/rules.test.ts`**) |
| **Quick run command** | `npx vitest run src/components/slides src/utils/__tests__/slideshowAssembler.test.ts` |
| **Full suite command** | `npx vitest run src/` |
| **Type gate** | `npm run type-check` (**`vue-tsc --build`** — NOT `-p tsconfig.app.json`) |
| **Estimated runtime** | ~20s quick · ~130s full |

**`npm run test:rules` is NOT a gate for this phase.** Research Question 1 verified that
`orgs/{orgId}/backgrounds/**` falls into the existing generic 25MB-cap catch-all in `storage.rules`
and is structurally exempt from `cleanupExpiredMedia` (`MEDIA_PATH_GUARD = /^orgs\/[^/]+\/media\//`,
`functions/src/index.ts:241`). **No rules change is in scope. If planning discovers one is needed
after all, that is a scope problem to raise, not to absorb** — this phase has no rules-testing budget.

**Baseline:** `src/storage.rules.test.ts` (Storage emulator) and `src/views/__tests__/RosterView.test.ts`
(stale assertion) = 9 tests / 2 files. The `.gsd/` quarantine duplicates were deleted 2026-07-29 — the
obsolete "10-file baseline" must not be cited.

---

## Sampling Rate

- **After every task commit:** the targeted `-t` filtered command for that task's requirement
- **After every plan wave:** `npx vitest run src/components/slides src/utils/__tests__/slideshowAssembler.test.ts src/components/__tests__/SongLyricEditor.test.ts` **and** `npm run type-check`
- **Before `/gsd-verify-work`:** full suite green against the 2-file baseline, plus `npm run build`
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

> Task IDs assigned by the planner; seeded by requirement. Threat Ref is `—` throughout: no new
> attack surface (no rules change, no new endpoint). The one security-adjacent item is the new
> upload path, covered by MIME/size validation below rather than by a threat-model entry.

| Task ID | Plan | Wave | Requirement | Threat Ref | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------|-------------------|-------------|--------|
| TBD | — | — | R051 | — | unit | `npx vitest run src/components/slides/__tests__/SlidesTab.test.ts -t "select"` | ✅ needs inverted assertion | ⬜ pending |
| TBD | — | 0 | R052 | — | unit | `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts -t "mode"` | ❌ W0 | ⬜ pending |
| TBD | — | 0 | R055 | — | unit | `npx vitest run src/components/slides/__tests__/BackgroundControl.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | 0 | R056 | — | unit | `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts -t "background"` | ❌ W0 (new cases, existing file) | ⬜ pending |
| TBD | — | 0 | R057 | — | unit | `npx vitest run src/components/__tests__/SongLyricEditor.test.ts -t "background"` | ❌ W0 (new cases, existing file) | ⬜ pending |
| TBD | — | 0 | R058 | — | unit | `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts -t "audio"` | ✅ `:813-957` block needs DELETION | ⬜ pending |
| TBD | — | 0 | R063 | — | unit | `npx vitest run src/components/slides/__tests__/slideDisplay.test.ts -t "slideActionMenuItems"` | ❌ W0 (pure function) | ⬜ pending |
| TBD | — | 0 | R055-R057 (upload) | — | unit | `npx vitest run src/composables/__tests__/useBackgroundUpload.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | 0 | R051/R063 (menu a11y) | — | component | `npx vitest run src/components/slides/__tests__/SlideActionMenu.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/slides/__tests__/SlideActionMenu.test.ts` — new. Open/close, per-item emits,
      **Escape closes and returns focus to the trigger**, and the E1/E2 backstops from the UI
      Considerations table. ★ This is the codebase's **first real ARIA menu** — a full-repo grep for
      `role="menu"` / `aria-haspopup` / `role="listbox"` returned zero matches, so there is no
      accessibility precedent to copy. Write the a11y assertions deliberately.
- [ ] `src/components/slides/__tests__/BackgroundControl.test.ts` — new shared component, tested once
      and reused at both call sites' integration tests.
- [ ] `src/composables/__tests__/useBackgroundUpload.test.ts` — new. MIME and size rejection, upload
      success path. **Verify whether `useMediaUpload.test.ts` exists before assuming its structure can
      be mirrored** — research did not confirm it this session.
- [ ] `src/utils/__tests__/slideshowAssembler.test.ts` — new `background` cases in the existing file.
      ★ Must cover **Pitfall 3**: `resolveEntryMedia`'s signature has no way to look up the owning
      song, and non-SONG groups (PRAYER/SCRIPTURE/…) have **no `SongLyrics` at all** — a naive cascade
      crashes on `song.backgroundImageUrl`. Test the non-SONG-group path explicitly, not just the
      happy song path.
      ★ Must also cover the **deliberate divergence**: a video slide does NOT suppress an inherited
      background, though it does suppress inherited bed audio.
- [ ] `src/components/slides/__tests__/slideDisplay.test.ts` — new pure-function cases for the per-kind
      menu item table, including the **Hymn discriminator** (`sourceRef.body === undefined` on a
      materializer-created Hymn text slide vs `body: ''` on a hand-added one).
- [ ] `src/components/slides/__tests__/EditSlideDrawer.test.ts` — the `:813-957` audio-scope describe
      block is **deleted**, not adapted. Everything else is re-homed across the two modes.
- [ ] `src/components/slides/__tests__/SlidesTab.test.ts` — inverted assertion: selecting a card must
      **NOT** set `drawerOpen`.

*Framework install: not required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real image file uploads, persists, and is still there later | R055-R057 | jsdom cannot produce a genuine `File` with real bytes, and the 14-day sweep exemption is a property of the deployed Cloud Function, not of the client. | With the emulator running, set a background at each of the three levels with a real photo. Confirm it renders in the drawer preview. **The persistence claim (that `orgs/{orgId}/backgrounds/**` is never swept) is verified by code reading only — it cannot be observed without waiting 14 days.** |
| Menu keyboard navigation with a real screen reader | R051 | `role="menuitem"` / `aria-expanded` semantics are only observable in a real AT. | Tab to the 3-dot trigger, open with Enter/Space, arrow through items, Escape to close, confirm focus returns to the trigger and the reader announces the menu correctly. |
| The menu does not interfere with dragging | R051 | SortableJS drag behaviour is not exercised in jsdom. | Drag a slide by its grip; confirm no menu opens. Open the menu, then try to drag; confirm sane behaviour. |
| Inheritance is legible at a glance | R056 | "Can a user tell where this background came from?" is a judgment call about real rendered UI. | Set a song background, then a group background, then a slide background. At each step confirm the card chip, drawer caption and group control all say the right thing. **This is the phase's sharpest UI risk — an override the user cannot see.** |
| The 3-dot menu's item list matches the owner's intent per type | R063 | The design is **original work** — the Claude Design mockup predates every affordance in this phase (see `33-CONTEXT.md` `<specifics>`). | Review the per-type table in `33-UI-SPEC.md` §3 against what you actually want each slide type to offer. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
