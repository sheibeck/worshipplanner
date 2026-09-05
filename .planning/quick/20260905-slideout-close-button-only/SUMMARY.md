---
slug: slideout-close-button-only
status: complete
completed: 2026-09-05
files_changed:
  - src/components/SongSlideOver.vue
  - src/components/__tests__/SongSlideOver.test.ts
---

# Summary: Song editing slideout closes only via Close / X

**Done.** The song editing slideout (`SongSlideOver`) no longer closes on an outside click. It closes
**only** via the **Close** button or the **X** (both call `onCancel`, which runs the unsaved-changes
guard then `emit('close')`).

## What changed
- `src/components/SongSlideOver.vue` — removed `@click="onCancel"` from the backdrop `<div>` (the
  outside-click dismiss). The backdrop still dims the page; it just no longer closes the panel. Added a
  short comment explaining the panel is intentionally non-dismissing on outside-click/Escape.
- `src/components/__tests__/SongSlideOver.test.ts` — added a describe block: a backdrop click does NOT
  emit `close`; the X (aria-label "Close") still emits `close`. (The existing Close-button test already
  covers the text button.)

## Note on Escape
No change was needed for Escape: `SongSlideOver` has **no** Escape/keydown handler, and the only Escape
listeners in the codebase belong to unrelated dialogs and the presentation/run windows — so Escape never
closed this slideout. Confirmed by grep.

## Gates
- `npm run type-check` (vue-tsc --build) — clean.
- `npx vitest run src/components/__tests__/SongSlideOver.test.ts` — 34/34 pass.

## Scope
`SongSlideOver` only (the panel the request named — the one now hosting the Files tab). Other slideovers
(Team/Role/EditSlideDrawer/SongLyricEditor) were left unchanged.
