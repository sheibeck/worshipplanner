---
phase: 260701-awp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/SongSlotPicker.vue
autonomous: false
requirements: [QUICK-260701-awp]
must_haves:
  truths:
    - "The sticky search + tag-filter header stays visually on top of the song rows while scrolling the rotation list"
    - "The sticky search + tag-filter header stays visually on top of the song rows while scrolling the search-results list"
    - "The header keeps its existing sticky-to-top positioning inside the dropdown panel"
    - "Song rows scroll UNDERNEATH the header, not over it"
  artifacts:
    - path: "src/components/SongSlotPicker.vue"
      provides: "Song-slot picker dropdown with a correctly-stacked sticky search/tag-filter header"
      contains: "sticky top-0"
  key_links:
    - from: "sticky header div (search input + tag selects)"
      to: "scrolling song rows below it"
      via: "z-index stacking order + opaque background"
      pattern: "sticky top-0.*z-10.*bg-gray-800"
---

<objective>
Fix the song-slot picker's sticky header (search input + include/exclude tag-filter selects)
rendering BEHIND the scrolling song list. Currently, scrolling the rotation list or the
search-results list makes song rows visually pass OVER the sticky search/tag controls.
The header must stay visually on top so rows scroll underneath it.

Purpose: The picker is unusable when the search box and tag filters are obscured by scrolling
rows. This is a stacking-order regression in a single component.

Output: `src/components/SongSlotPicker.vue` with a correctly-stacked, opaque sticky header
that covers both the rotation list and the search-results list.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

@src/components/SongSlotPicker.vue

<diagnosis>
The dropdown panel is the scroll container:
  `<div class="fixed z-40 bg-gray-800 ... overflow-y-auto" :style="dropdownStyle">` (line ~35-38)

Inside it, the sticky header is:
  `<div class="sticky top-0 bg-gray-800 border-b border-gray-700 p-2 space-y-1.5">` (line ~40)

This ONE sticky header sits above BOTH content branches (a single header serves both lists):
  - `<div v-if="!searchQuery">` — AI Picks + "By Rotation" rows (lines ~68-163)
  - `<div v-else>` — "Search Results" rows (lines ~166-194)

The song rows are `<button>` elements carrying `hover:bg-gray-900 transition-colors`, and the
rotation/search rows can carry `opacity-50` (isNonOrchestraSong) — `opacity < 1` creates a NEW
stacking context on those rows.

ROOT CAUSE: The sticky header has `position: sticky` but `z-index: auto`. The following in-flow
rows (some of which form their own stacking contexts via `opacity-50`, and all of which have
`transition`) paint at/above the sticky header's `auto` level. The header already has an opaque
background (`bg-gray-800`), so the missing piece is an explicit `z-index` that lifts the header
above the row content.

FIX: Add `z-10` (or higher, but z-10 is sufficient and below the `z-40` panel / `z-30` backdrop
scale already used in this file) to the sticky header div. Because there is a single shared sticky
header above both list branches, this one change fixes BOTH the rotation list and the search-results
list. Keep `sticky top-0` and `bg-gray-800` intact.
</diagnosis>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Raise the sticky header stacking order above the scrolling rows</name>
  <files>src/components/SongSlotPicker.vue</files>
  <action>
In `src/components/SongSlotPicker.vue`, locate the sticky search + tag-filter header div
(currently around line 40):

  `<div class="sticky top-0 bg-gray-800 border-b border-gray-700 p-2 space-y-1.5">`

Add a `z-10` utility class to it so it forms a stacking context ABOVE the in-flow song rows
that follow it. Keep every existing class — do NOT remove `sticky`, `top-0`, `bg-gray-800`,
`border-b`, `border-gray-700`, `p-2`, or `space-y-1.5`. The result:

  `<div class="sticky top-0 z-10 bg-gray-800 border-b border-gray-700 p-2 space-y-1.5">`

Rationale (do not implement anything beyond the class add):
  - `bg-gray-800` (opaque background) is already present — do not change it.
  - The song rows use `transition-colors` and some use `opacity-50` (which creates its own
    stacking context); without an explicit z-index on the sticky header, those rows paint at or
    above the header's `auto` level. `z-10` lifts the header above them.
  - `z-10` stays below the panel-level `z-40` and backdrop `z-30` already used in this file, so
    it does not disturb the teleported dropdown layering.

Because this single sticky header sits above BOTH the `v-if="!searchQuery"` (rotation) branch and
the `v-else` (search results) branch, this one change covers both lists. Do NOT duplicate the
header or add a second sticky element.

Do NOT touch the trigger buttons, the dropdown panel positioning logic, the script block, or any
row markup.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit -p tsconfig.app.json 2>&1 | head -20; grep -n "sticky top-0 z-10 bg-gray-800" src/components/SongSlotPicker.vue</automated>
  </verify>
  <done>
The sticky header div's class list contains `sticky top-0 z-10 bg-gray-800` (all original
classes retained, `z-10` added). Type-check passes. No other markup changed.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Human-verify sticky header stays above both scrolling lists</name>
  <action>Manual verification only — no code changes. Confirm the fix from Task 1 works in the running app for both the rotation list and the search-results list.</action>
  <what-built>
Added `z-10` to the sticky search + tag-filter header in the song-slot picker so it stacks above
the scrolling song rows (the opaque `bg-gray-800` background was already present). One shared
header change covers both the rotation list and the search-results list.
  </what-built>
  <how-to-verify>
1. Run the app locally (`npm run dev`) and open a service plan / editor that uses the song-slot
   picker (`SongSlotPicker.vue`) — the "Click to select a song" control on a SONG slot.
2. Open the picker so the dropdown appears with the search box + two tag-filter selects at the top.
3. ROTATION LIST: With the search box empty, scroll the song list. Confirm the "By Rotation"
   (and AI Picks) song rows scroll UNDERNEATH the search/tag header — the header stays fully
   opaque and on top, no rows bleed over the search input or the select controls.
4. SEARCH LIST: Type a query so "Search Results" rows appear. Scroll them. Confirm the search
   results rows also scroll UNDERNEATH the header.
5. Confirm the header still sticks to the top of the dropdown (does not scroll away) and the
   search input / tag selects remain clickable and focusable.
  </how-to-verify>
  <resume-signal>Type "approved" if the header stays on top for both lists, or describe what still renders over it.</resume-signal>
</task>

</tasks>

<verification>
- Sticky header class list includes `sticky top-0 z-10 bg-gray-800` with all original classes intact.
- `npx vue-tsc --noEmit` reports no new errors.
- Manual: rotation-list rows and search-results rows both scroll under the header (checkpoint).
</verification>

<success_criteria>
- The sticky search + tag-filter header renders above the scrolling song rows in BOTH the
  rotation list and the search-results list.
- The header retains its existing sticky-to-top positioning and opaque background.
- No changes outside `src/components/SongSlotPicker.vue`; no row markup or script changes.
</success_criteria>

<output>
After completion, create `.planning/quick/260701-awp-fix-song-picker-sticky-header-search-tag/260701-awp-SUMMARY.md`
</output>
