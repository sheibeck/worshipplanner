---
phase: 33-backgrounds-slide-editing
plan: 08
subsystem: ui
tags: [vue3, pinia, firestore, background-image, slide-action-menu, aria]

# Dependency graph
requires:
  - phase: 33-backgrounds-slide-editing
    provides: "33-02's slideActionMenuItems/MenuItem/MenuItemKey (slideDisplay.ts); 33-03's BackgroundControl.vue and backgroundImageLabel; 33-05's SlideCard.vue menuItems/menuOpen props and menu-toggle/menu-select emits"
provides:
  - "slideGroups store's setGroupBackground(orgId, slotId, patch) action — single-purpose group-background write/clear, structurally mirroring setGroupBedMedia"
  - "SlideGrid.vue's group-level BackgroundControl row (data-testid slide-grid-group-background), gated on canWriteGroupMedia"
  - "SlideGrid.vue's openMenuEntryId ref — the single source of truth for which card's menu is open across the whole grid"
  - "SlideGrid.vue's per-card menuItems (from slideActionMenuItems) and the new menu-action emit"
affects: [33-09 (SlidesTab.vue consumes menu-action to dispatch drawer-open/navigate/duplicate/delete)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "setGroupBackground mirrors setGroupBedMedia's exact shape: existence check, scoped single-field updateDoc, explicit deleteField() clear flag, merging skeleton setDoc on the missing-document branch"
    - "Grid holds all menu open-state (openMenuEntryId); cards hold none of their own, which is what makes one-open-at-a-time enforceable with a single ref"
    - "Per-card menu items are derived, never re-implemented: SlideGrid matches each card's slide id to its stored GroupSlideEntry and calls slideActionMenuItems with the real gates (canMutateGroup, the selected plan item's kind)"

key-files:
  created: []
  modified:
    - src/stores/slideGroups.ts
    - src/stores/__tests__/slideGroups.test.ts
    - src/components/slides/SlideGrid.vue
    - src/components/slides/__tests__/SlideGrid.test.ts

key-decisions:
  - "Did NOT add a removeLabel prop to BackgroundControl.vue. Per this plan's own key_constraints ('optional, coordinate with 33-06's open nit'), no acceptance criterion in this plan's Task 2 tests the aria-label string, so the shared component's generic 'Remove background' aria-label (already flagged by 33-03 and 33-06) is left unchanged. This was the last wave-3 call site that mounts BackgroundControl in this phase — flagging it forward as a standalone follow-up if the Copywriting Contract's exact per-level wording ('Remove group background'/'Remove song background') turns out to matter at UAT time. It remains a small, additive, optional prop."
  - "GroupBackgroundPatch is declared as a local (unexported) interface inside the store's setup function, matching BedMediaPatch's own precedent exactly rather than exporting a new module-level type — nothing downstream imports it (SlideGrid passes an inline object literal whose shape TypeScript infers from the function signature)."
  - "songBackgroundForInheritedDisplay is derived entirely from already-resolved provenance on the group's own assembled slides (backgroundSource === 'song' on any card) rather than a new song-lyrics prop or a second cascade derivation, per the plan's explicit instruction — no new prop was threaded into SlideGrid or SlideCard for this."
  - "Task 3's per-card menuItems live on the existing cards computed (extending CardEntry with a menuItems field) rather than a second parallel computed, since both are already derived from the same assembledSlideshow filter/map and keeping them in one pass avoids two separate array walks re-deriving the same card list."

requirements-completed: [R055, R063]

coverage:
  - id: D1
    description: "setGroupBackground touches only backgroundImageUrl + updatedAt on the existing-doc branch, uses deleteField() for the explicit clear, creates a merging skeleton setDoc when the group doesn't exist yet, and never writes the slides array on either branch"
    requirement: "R055"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/slideGroups.test.ts — 'setGroupBackground' describe block (5 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A group-level BackgroundControl row renders below the music control with the same wrapper-level canWriteGroupMedia gate, the real card-count caption, an inherited display for SONG groups only (own background empty, a slide resolves from the song tier), and attach/remove relayed to the new store action"
    requirement: "R055"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts — 'group background control (33-08 Task 2)' describe block (10 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "SlideGrid owns a single openMenuEntryId ref enforcing exactly one open menu across the whole grid, computes each card's menuItems from slideActionMenuItems with the grid's real gates (empty list when no stored entry matches), and relays menu-select as a new menu-action emit without acting on the key itself"
    requirement: "R063"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts — 'menu ownership (33-08 Task 3)' describe block (8 tests)"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-08-03
status: complete
---

# Phase 33 Plan 08: SlideGrid group background control + menu ownership Summary

**Added a `setGroupBackground` store action (mirroring `setGroupBedMedia` exactly), mounted `BackgroundControl` as a new sibling row below the group's music control, and made `SlideGrid.vue` the single owner of menu state — one `openMenuEntryId` ref, per-card items sourced entirely from `slideActionMenuItems`, and a new `menu-action` emit the tab one level up will dispatch.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3/3
- **Files modified:** 4 (0 created)

## Accomplishments

- **Task 1 — `setGroupBackground(orgId, slotId, patch)`** (`src/stores/slideGroups.ts`): a `GroupBackgroundPatch`-typed action structurally mirroring `setGroupBedMedia` — same existence check, same scoped single-field `updateDoc` (background field + `updatedAt` only, never `slides` or `bedAudioUrl`), same explicit `clearBackground` flag written via `deleteField()` (an undefined value would be stripped by `stripUndefined()` before the intent reached Firestore), same merging skeleton `setDoc` on the missing-document branch for the identical WR-01 race reason already documented on the bed-media action. 5 new store tests.
- **Task 2 — group background control** (`SlideGrid.vue`): `BackgroundControl` mounted as a new sibling row (`data-testid="slide-grid-group-background"`, `px-6 pt-2`) directly below the existing music control, gated on the SAME `canWriteGroupMedia` wrapper condition (never `canMutateGroup` — background is group media, exactly like the bed audio beside it, including that gate's song-group carve-out). `groupBackgroundCaption` substitutes the real card count into the Copywriting Contract's sentence; `songBackgroundForInheritedDisplay` derives the SONG-group-only inherited display from already-resolved provenance on the group's own assembled slides (`backgroundSource === 'song'`) rather than any new prop. `onAttachGroupBackground`/`onRemoveGroupBackground` mirror the music control's caller-does-the-write idiom exactly. 10 new SlideGrid tests.
- **Task 3 — menu ownership** (`SlideGrid.vue`): a single `openMenuEntryId` ref is now the whole grid's menu-state — cards hold none of their own. Each card's `menuItems` is computed by matching its slide id to the group's stored `GroupSlideEntry` and calling `slideActionMenuItems` (33-02's pure per-kind function, never re-implemented here) with `props.selectedSlot?.kind` and `canMutateGroup`; a card whose id resolves to no stored entry gets an empty list, never a menu. `onCardMenuToggle` enforces one-open-at-a-time; `onCardMenuSelect` clears the ref and emits a new `menu-action: [slideId, key]` that this component does not act on — the tab one level up (33-09) owns the dispatch. 9 new SlideGrid tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: setGroupBackground store action** — `d47cf7a` (feat)
2. **Task 2: Mount the group background control below the music control** — `445dfde` (feat)
3. **Task 3: Menu ownership — one open at a time, per-card items, action relay** — `900fd67` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/stores/slideGroups.ts` — `GroupBackgroundPatch` (local interface), `setGroupBackground()`, exported from the store's return object
- `src/stores/__tests__/slideGroups.test.ts` — 5 new `setGroupBackground` cases (update-branch payload shape, deleteField() clear, skeleton-create with merge, never-touches-slides)
- `src/components/slides/SlideGrid.vue` — `BackgroundControl` import + mount, `groupBackgroundCaption`/`songBackgroundForInheritedDisplay` computeds, `onAttachGroupBackground`/`onRemoveGroupBackground` handlers, `CardEntry.menuItems`, `openMenuEntryId` ref, `onCardMenuToggle`/`onCardMenuSelect` handlers, new `menu-action` emit
- `src/components/slides/__tests__/SlideGrid.test.ts` — `mockSetGroupBackground`, `BackgroundControl` import, extended `makeAssembled` to accept slide overrides, 10 `group background control` cases + 8 `menu ownership` cases (18 new tests total)

## Decisions Made

- **`removeLabel` NOT added to `BackgroundControl.vue`.** Per this plan's own `key_constraints` ("optional... if the criteria don't require it, leave it and flag it forward"), no acceptance criterion in Task 2 tests the aria-label string, so the shared component's generic `"Remove background"` label (flagged by both 33-03 and 33-06) is unchanged here too. This is the last wave-3 call site mounting `BackgroundControl` in this phase — no further plan is scheduled to touch it. Flagging as a standalone follow-up: if the Copywriting Contract's exact per-level wording ("Remove group background") matters at UAT time, the fix is a small, optional, additive prop with no impact on either existing call site (song, group).
- **`GroupBackgroundPatch` kept local/unexported**, matching `BedMediaPatch`'s own precedent inside `slideGroups.ts` — no downstream file imports the type; `SlideGrid.vue` passes an inline object literal that TypeScript checks against the function's own parameter type.
- **`songBackgroundForInheritedDisplay` reads directly off `cards.value`** (the already-assembled, already-resolved slide list) rather than any new prop or store read — exactly the "derive from already-resolved provenance" instruction in the plan's key_links.
- **Task 3's `menuItems` was added to the existing `cards` computed** rather than a second parallel computed, since both need the same `assembledSlideshow` filter/map pass.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' acceptance criteria (grep counts, exact caption/label strings, `data-testid` existence assertions per permission combination, store-call payload shapes, per-kind/per-gate menu item lists) were verified directly rather than assumed.

## Issues Encountered

None. The plan's `-t "menu"` filter check required attention to test-name substring matching (the filter matches `it()` titles, not `describe()` titles) — two initially-unmatched test names were adjusted so the acceptance criterion's "at least 8 cases" count was met exactly by tests whose own titles contain "menu", not merely nested under a describe block that does.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**33-09 (`SlidesTab.vue`) is the direct consumer of this plan's `menu-action` emit.** It must:
- Listen for `SlideGrid`'s `menu-action: [slideId, key]` and dispatch per `MenuItemKey`: `'edit-details'`/`'edit-lyrics'` open `EditSlideDrawer` in the matching `mode` (33-07's seam) for the given slide id; `'edit-in-song'`/`'edit-in-scripture'` navigate; `'duplicate'`/`'delete'` call the existing store actions directly (no drawer).
- Per 33-UI-SPEC.md §4's wiring correction: `onSelectSlide` should keep ONLY its selection line — `drawerOpen`/`drawerMode` should be set exclusively by the new `menu-action` handler, never by card selection.
- Delete the `edit-in-scripture` emit and the drawer's in-body "Edit in song"/"Edit in scripture" link buttons (superseded by these new menu items) — listed as 33-09's own deliberate deletion in this plan's file header.

No blockers. `npx vitest run src/` baseline unchanged: the only failures are the pre-existing, documented non-defects (`src/storage.rules.test.ts` — needs the Storage emulator; `src/views/__tests__/RosterView.test.ts` — stale assertion), 9 tests / 2 files. Full suite: 2111 passing (2089 baseline + 24 new tests from this plan across the two test files, minus the 2 already-known-failing files unaffected by this plan).

---
*Phase: 33-backgrounds-slide-editing*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: src/stores/slideGroups.ts
- FOUND: src/stores/__tests__/slideGroups.test.ts
- FOUND: src/components/slides/SlideGrid.vue
- FOUND: src/components/slides/__tests__/SlideGrid.test.ts
- FOUND: d47cf7a (git log)
- FOUND: 445dfde (git log)
- FOUND: 900fd67 (git log)
