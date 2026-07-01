---
status: complete
quick_id: 260701-awp
description: Fix song-picker sticky header (search + tag filters) rendering behind scrolling song list
date: 2026-07-01
commit: 5de0ae2
files_modified:
  - src/components/SongSlotPicker.vue
---

# Quick Task 260701-awp: Song-picker sticky header z-index fix

## Problem

On the service-plan song picker (`src/components/SongSlotPicker.vue`), scrolling the song
list made the song rows visually paint **over** the sticky search input and show/hide tag-filter
selects, instead of scrolling underneath them.

## Root Cause

The sticky header (`<div class="sticky top-0 bg-gray-800 …">`, line 40) already had an opaque
background but **no `z-index`** — it stacked at `z-index: auto`. The song rows use `opacity-50`
(non-orchestra songs), and `opacity < 1` creates a new stacking context. A `position: sticky`
element with `z-index: auto` does not outrank sibling stacking contexts, so the rows painted over it.

A single shared sticky header sits above both content branches (`v-if="!searchQuery"` rotation list
and `v-else` search-results list), so one change covers both.

## Fix

Added `z-10` to the sticky header class list (line 40):

```html
<div class="sticky top-0 z-10 bg-gray-800 border-b border-gray-700 p-2 space-y-1.5">
```

A sticky element with a positive z-index is a positioned element and paints above in-flow rows and
opacity-induced stacking contexts within the same scroll container. `z-10` stays below the file's
existing `z-30` backdrop and `z-40` panel (which live in the Teleport root, a separate stacking
context), so teleport layering is undisturbed.

## Note on the first attempt

An initial executor applied the same `z-10` change inside an isolated git worktree branch that was
never merged to the working tree, so the running dev app never received it (user reported "no
change"). This fix re-applies `z-10` directly on the main working tree and discards the orphaned
worktree.

## Human Verification Needed

1. Open the song-slot picker on a service plan.
2. Scroll the **rotation list** (no search query) — confirm song rows scroll UNDER the search +
   tag-filter header, which stays fully visible and opaque on top.
3. Type a query and scroll the **search-results list** — confirm the same behavior.
