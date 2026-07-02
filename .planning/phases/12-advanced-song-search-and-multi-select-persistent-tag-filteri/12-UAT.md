---
status: partial
phase: 12-advanced-song-search-and-multi-select-persistent-tag-filteri
source: [12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-03-SUMMARY.md, 12-04-SUMMARY.md, 12-05-SUMMARY.md]
started: 2026-07-02T05:33:59Z
updated: 2026-07-02T05:36:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing paused — 4 items deferred pending Option A tag-system rework]

## Tests

### 1. Field-scoped song search
expected: |
  In the Songs panel search box, typing a field-scoped query filters precisely: `key:A` shows only key-A songs (and `key:e` does NOT match "Em" — exact key match); `tag:christmas` shows only christmas-tagged songs; `type:1`, `theme:grace`, `team:orchestra` each scope to that field. `key: A` (space after colon) is tolerated.
result: pass

### 2. Natural phrase + multi-term AND search
expected: |
  Typing the natural two-word phrase `Type 1` filters to Type-1 songs, and `Key A` filters to key-A songs (no colon needed). Typing two plain words like `christmas acoustic` returns only songs that match BOTH terms (AND), not either — narrowing results as you add terms.
result: pass

### 3. Songs panel multi-select tag checklist
expected: |
  In the Songs panel filter area, the old single-select "include tag" / "exclude tag" dropdowns are gone, replaced by a scrollable checkbox list of your tags. Checking two or more tags broadens the results (OR) — songs carrying ANY checked tag are shown. Checked rows are visually highlighted (pink). If you have no tags, an empty-state message appears instead.
result: issue
reported: "UX confusing. There's a separate 'Tags' dropdown (team tags like Orchestra) AND a whole separate inline checklist of custom tags (Christmas) that grows unbounded and keeps making the header area taller. Should combine team tags + custom tags into ONE tags list presented as a dropdown where each item has a checkbox, with hide-tags / clear-tags next to it. Also themes 'look' like tags but aren't part of the tag system — so there are effectively 3 kinds of tags (teamTags, themes, tags). Wants a single unified tag system."
severity: major

### 4. Hide-tags (inverted) toggle
expected: |
  Turning on the "Hide tags" checkbox inverts the filter: instead of showing only songs with the checked tags, songs carrying any checked tag are now excluded. A "(hiding)" caption appears next to the header while hide mode is on, so it stays clear even if the toggle scrolls out of view.
result: blocked
blocked_by: other
reason: "Deferred by user pending the Option A tag-system rework (test 3 issue). The hide toggle moves into the new combined tag dropdown; user will test after rework lands."

### 5. Clear-tags action
expected: |
  Clicking the "Clear tags" link unchecks all tag checkboxes and resets the hide toggle, but leaves your search text, VW-type, key, and team filters untouched.
result: blocked
blocked_by: other
reason: "Deferred pending Option A tag-system rework (test 3 issue). Clear action moves into the new combined tag dropdown; re-verify after rework."

### 6. Persistent tag filter across reload
expected: |
  After checking some tags (and/or the hide toggle) in the Songs panel, reloading the page restores the same tag selection automatically. The saved selection is scoped per user + organization — switching accounts/orgs on the same browser does not carry another user's tag selection over.
result: blocked
blocked_by: other
reason: "Deferred pending Option A tag-system rework (test 3 issue). Persistence should carry over, but the selection UI changes; re-verify after rework."

### 7. Service-plan picker shares the same tag filter
expected: |
  Opening the song picker inside the service editor shows the same multi-select tag checklist (with Hide toggle and Clear link) as the Songs panel, and its search box accepts the same field-scoped / phrase / multi-term syntax. The tag selection is shared state with the Songs panel. The sticky search/filter bar stays pinned above the scrolling song list.
result: blocked
blocked_by: other
reason: "Deferred pending Option A tag-system rework (test 3 issue). Picker gets the same combined tag dropdown; re-verify shared-state + search/sticky after rework."

### 8. Delete-confirmation gate on every element removal
expected: |
  In the service editor, clicking the Remove (X) on ANY plan element — including an empty/blank slot that previously deleted silently — now opens a confirmation modal first. The heading/body wording is element-type-aware (e.g. "remove this song", "this scripture", etc.). Cancel keeps the element; Remove deletes it. The existing "clear song" action keeps its own separate wording.
result: pass
note: "Core behavior PASSES — every removal (populated or empty) is now gated by a confirmation modal; Cancel/Remove work. DEVIATION: the modal copy is NOT element-type-aware — it always reads generic ('this item' / 'this element') rather than 'this song' / 'this scripture'. User ACCEPTS the generic wording and wants to KEEP the functionality; no code fix. Action: update the spec/docs (D-16 and 12-05-SUMMARY.md claim of element-type-aware copy) to describe the generic wording as the intended behavior."

## Summary

total: 8
passed: 3
issues: 1
pending: 0
skipped: 0
blocked: 4

## Gaps

- truth: "Songs panel tag filtering presents a single, clear, unified tag control that doesn't grow the header unbounded"
  status: failed
  reason: "User reported: separate 'Tags' dropdown (teamTags e.g. Orchestra) coexists with a separate inline custom-tags checklist (tags e.g. Christmas) that grows unbounded and keeps making the header taller. Wants team tags + custom tags combined into ONE tag list rendered as a dropdown where each item has a checkbox, with hide-tags/clear-tags beside it. Themes also look like tags but are a third separate field — user wants a single unified tag system across teamTags/themes/tags."
  severity: major
  test: 3
  root_cause: "Song model has three separate string[] fields — teamTags (PC arrangement/team tags, drives orchestra suggestion filter), themes (PC song themes), tags (Phase 9 user tags). Phase 12 added the new user-tags checklist as a THIRD control alongside the pre-existing teamTags 'All tags' dropdown, rather than unifying them. Checklist renders inline (not in a dropdown/popover) so its height scales with tag count."
  artifacts:
    - path: "src/components/SongFilters.vue"
      issue: "Renders both a teamTags 'All tags' <select> (filterTag) and a separate inline TagFilterChecklist for user tags"
    - path: "src/components/TagFilterChecklist.vue"
      issue: "Inline checklist grows the header height instead of being contained in a dropdown/popover"
    - path: "src/types/song.ts"
      issue: "Three parallel string[] fields (teamTags, themes, tags) with no unified tag concept"
  decision: "Option A (chosen by user 2026-07-02): unify the FILTER UI only — do NOT merge the data model. Keep teamTags/themes/tags as separate Song fields so PC import and the Phase 10 orchestra suggestion filter keep working. Present a single combined tag control: one dropdown/popover listing the union of teamTags ∪ themes ∪ tags, each row a checkbox, with hide-tags + clear-tags beside it. It replaces BOTH the current teamTags 'All tags' <select> (filterTag) in SongFilters.vue AND the separate inline TagFilterChecklist. Contained in a dropdown so header height stays fixed. Filtering matches a song if any of its three fields contains a checked value (OR in show mode / exclude in hide mode). Full data-model unification (Option B) NOT chosen for now."
  missing:
    - "Combined tag control as a dropdown/popover with per-item checkboxes + hide + clear, sourcing the union of teamTags ∪ themes ∪ tags, replacing both the teamTags 'All tags' <select> and the inline TagFilterChecklist"
    - "Filter logic matches across all three fields (teamTags/themes/tags): show = has ANY checked; hide = has NONE checked"
    - "Apply the same combined control to the service-plan picker (SongSlotPicker.vue) so both surfaces share it"
    - "Fixed-height/contained rendering so the filter header does not grow unbounded with tag count"

- truth: "Delete-confirmation modal copy matches documented behavior"
  status: doc_update_only
  reason: "User accepts the generic wording ('this item'/'this element') and wants functionality kept — NO code fix. Spec/docs claim element-type-aware copy (D-16, 12-05-SUMMARY.md) that the shipped modal does not produce."
  severity: cosmetic
  test: 8
  code_fix: false
  missing:
    - "Update D-16 requirement and 12-05-SUMMARY.md to describe generic delete-confirmation wording as intended (drop the element-type-aware copy claim)"
