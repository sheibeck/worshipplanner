---
status: complete
phase: 12-advanced-song-search-and-multi-select-persistent-tag-filteri
source: [12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-03-SUMMARY.md, 12-04-SUMMARY.md, 12-05-SUMMARY.md, 12-06-SUMMARY.md, 12-07-SUMMARY.md, 12-08-SUMMARY.md]
started: 2026-07-03T01:31:47Z
updated: 2026-07-03T01:33:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Field-scoped + phrase + multi-term search
expected: |
  In the Songs panel search box: `key:A` shows only key-A songs (and `key:e` does NOT match "Em"), `tag:christmas`, `type:1`, `theme:grace`, `team:orchestra` each scope to that field, and `key: A` (space after colon) is tolerated. The natural phrases `Type 1` and `Key A` work without a colon. Two plain words like `christmas acoustic` return only songs matching BOTH terms (AND).
result: pass

### 2. Unified tag control (one dropdown, fixed height)
expected: |
  On the Songs page the old separate include/exclude tag dropdowns AND the "All tags" team-tag select are gone. There is ONE "Tags" dropdown. Its trigger button stays a constant height no matter how many tags exist (it does not grow the header). Opening it reveals the tag list inside a scrollable popover. The list is the combined, de-duplicated set of your team tags, themes, and user tags.
result: pass

### 3. Per-tag Show / Hide (independent)
expected: |
  Each tag row inside the dropdown has an independent "Show" and "Hide" control. You can Show one tag and Hide another at the same time (e.g. Show "Orchestra" and Hide "Christmas"). Exclusion wins — a song carrying a Hidden tag is dropped even if it also carries a Shown tag. The closed trigger reflects state, e.g. "Tags · 1 shown · 1 hidden".
result: pass

### 4. Filter-the-tags search box
expected: |
  Inside the tag dropdown there is a small "Filter tags…" input. Typing in it narrows the visible tag rows by substring (case-insensitive). Clearing it (or closing and reopening the dropdown) restores the full list — the filter text does not stick between opens.
result: pass

### 5. Popover positioning (both surfaces)
expected: |
  On the Songs page the tag dropdown opens aligned so the tag names are fully visible and never clipped off the right edge of the screen. In the service-plan song selector the tag dropdown opens directly under its trigger (left-aligned), not off to the right side of the panel.
result: pass

### 6. Shared + persistent tag filter across surfaces
expected: |
  Set some Show/Hide tags on the Songs page, then open the song selector on a service plan — the same Show/Hide selections are already applied there (shared state). Reload the app and reopen — your selections are still remembered (persisted per your login/org).
result: pass

### 7. Picker: same filter, no automatic team scoping
expected: |
  In the service-plan song selector, Show/Hide tags filter the songs exactly like the Songs page. The list is NOT automatically limited to the service's team — choosing to Show "Orchestra" surfaces orchestra songs even on a non-orchestra service. Searching/filtering shows the same songs you'd see on the Songs page (minus hidden songs).
result: pass

### 8. Picker rows: no dimming, unified tag pills
expected: |
  In the song selector, songs are NOT grayed out/dimmed (the old orchestra dimming is gone). Every song row — including the AI Picks, By Rotation, and Search Results sections — shows its tag pills: team tags, themes, and user tags.
result: pass

### 9. Hidden songs fully excluded
expected: |
  A hidden/deleted song never appears in the Songs page main list, nor in the picker's suggestions or search. Its tags also do NOT appear as options in either tag dropdown — so you never see a tag that matches zero visible songs.
result: pass

### 10. Picker dropdown stays a stable size
expected: |
  Opening the song selector, the dropdown holds a stable minimum height and does not visibly jump/resize as the number of matching songs changes while you type or filter.
result: pass

### 11. User-tag autocomplete (no duplicates)
expected: |
  When adding a user tag to a song — in the song editor slide-over, the inline tag input in the song table, and the bulk "Tag name" bar — typing shows existing matching tags as suggestions, so you can pick an existing tag instead of creating a near-duplicate.
result: pass
note: "Autocomplete works. During testing a console error surfaced on the inline '+' add — inlineInputRef.value?.focus is not a function (ref inside v-for resolved to an array). Fixed with a function ref (commit on master). Feature itself was functional."

### 12. Delete-confirmation on element removal
expected: |
  On a service plan, clicking the "Remove element" X on any row — including an empty/blank row — prompts a confirmation modal before removing. The heading is generic ("Remove this element from the plan?") and the body names the element type (e.g. "this song" / "this scripture"). Cancel keeps it; confirm removes it.
result: pass

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
