---
slug: slideout-close-button-only
created: 2026-09-05
type: quick
files:
  - src/components/SongSlideOver.vue
  - src/components/__tests__/SongSlideOver.test.ts
---

# Quick Task: Song editing slideout closes only via Close / X

**Request:** The song editing slideout (SongSlideOver) should NOT close on Escape or when clicking
outside it. Now that it does a lot more (the new Files tab, uploads), an accidental close is frustrating.
It should close ONLY when the user clicks the **Close** button or the **X**.

**Investigation:**
- Click-outside close = the backdrop `<div>` in `SongSlideOver.vue` (`@click="onCancel"`, ~line 15).
- Escape: there is NO Escape/keydown handler anywhere in `SongSlideOver.vue`, and the only Escape
  listeners in the codebase belong to unrelated dialogs/presentation windows — so Escape already does not
  close this slideout. No change needed for Escape.
- Close button + X both call `onCancel` directly (which runs the unsaved-changes guard, then
  `emit('close')`) — these stay as the only close paths.

**Change:** Remove `@click="onCancel"` from the backdrop `<div>` so an outside click no longer closes the
panel (the backdrop still dims). Keep the Close button and X wired to `onCancel`.

**Verify:** `npm run type-check` clean; a new test asserts a backdrop click does NOT emit `close`, while
the existing test still asserts the Close button DOES emit `close`.

**Scope:** SongSlideOver only (the panel the request is about — "we're doing a lot more work in here now").
Other slideovers (Team/Role/EditSlideDrawer) are out of scope.
