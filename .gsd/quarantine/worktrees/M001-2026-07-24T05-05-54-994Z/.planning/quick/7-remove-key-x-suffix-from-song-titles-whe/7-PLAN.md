---
phase: quick
plan: 7
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/planningCenterApi.ts
  - src/utils/__tests__/planningCenterApi.test.ts
autonomous: true
requirements: [QUICK-7]

must_haves:
  truths:
    - "PC item title for a SONG slot is just the song title with no key annotation"
    - "All tests pass with the new title format"
  artifacts:
    - path: "src/utils/planningCenterApi.ts"
      provides: "addSlotAsItem with bare title"
      contains: "slot.songTitle"
  key_links:
    - from: "src/utils/planningCenterApi.ts"
      to: "Planning Center API POST body"
      via: "title attribute in createItem/updateItem call"
      pattern: "title.*songTitle"
---

<objective>
Remove the "(Key: X)" suffix from song item titles when exporting a service plan to Planning Center.

Purpose: PC item titles should be clean song titles only. The key annotation is internal UI information, not appropriate for PC item names.
Output: planningCenterApi.ts updated so SONG slot titles are bare song titles; tests updated to match.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove key suffix from title construction in addSlotAsItem</name>
  <files>src/utils/planningCenterApi.ts</files>
  <action>
    In `addSlotAsItem` (around line 700-702), change the title construction from:

    ```typescript
    const title = slot.songTitle
      ? `${slot.songTitle} (Key: ${slot.songKey ?? ''})`
      : '[Empty Song]'
    ```

    to:

    ```typescript
    const title = slot.songTitle ?? '[Empty Song]'
    ```

    No other changes needed in this file. The `songKey` field remains on the slot type and is still used elsewhere (print layout, UI display) — do not remove it.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && grep -n "Key:" src/utils/planningCenterApi.ts</automated>
  </verify>
  <done>The string "(Key:" no longer appears in planningCenterApi.ts title construction. Grep returns no matches in the title-building block.</done>
</task>

<task type="auto">
  <name>Task 2: Update tests to expect bare song titles</name>
  <files>src/utils/__tests__/planningCenterApi.test.ts</files>
  <action>
    Update all assertions and test data in planningCenterApi.test.ts that reference the old `(Key: X)` title format:

    1. Line ~260: change `title: 'Come Thou Fount (Key: G)'` to `title: 'Come Thou Fount'` (createItem test fixture)
    2. Line ~272: change `expect(body.data.attributes.title).toBe('Come Thou Fount (Key: G)')` to `expect(body.data.attributes.title).toBe('Come Thou Fount')` (createItem assertion)
    3. Line ~335: change `title: 'Come Thou Fount (Key: G)'` to `title: 'Come Thou Fount'` (updateItem test fixture)
    4. Line ~346: change `expect(body.data.attributes.title).toBe('Come Thou Fount (Key: G)')` to `expect(body.data.attributes.title).toBe('Come Thou Fount')` (updateItem assertion)
    5. Line ~520: rename the test description from `'maps SONG slot without CCLI match to song_arrangement with "Title (Key: X)" format'` to `'maps SONG slot without CCLI match to song_arrangement with bare song title'`
    6. Line ~536: change `expect(body.data.attributes.title).toBe('Come Thou Fount (Key: G)')` to `expect(body.data.attributes.title).toBe('Come Thou Fount')` (addSlotAsItem no-CCLI assertion)

    Note: The createItem and updateItem test fixtures at lines ~260/335 are testing the API call wrapper itself, which simply passes through whatever title it receives. Those fixtures can keep any title string — they test HTTP call structure, not title formatting. However, update them for consistency so no test document references the old format.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vitest run src/utils/__tests__/planningCenterApi.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>All tests in planningCenterApi.test.ts pass. No occurrence of `(Key:` remains in assertions that validate the addSlotAsItem title output.</done>
</task>

</tasks>

<verification>
Run the full test suite to confirm nothing else was broken:

```
cd C:/projects/worshipplanner && npx vitest run 2>&1 | tail -30
```

Expected: all tests pass. The only changed behavior is the PC export item title — no UI, no print layout, no data model changes.
</verification>

<success_criteria>
- PC item titles sent to Planning Center contain only the song title (e.g., "Come Thou Fount"), not "Come Thou Fount (Key: G)"
- All existing tests pass
- No regressions in unrelated test files
</success_criteria>

<output>
After completion, create `.planning/quick/7-remove-key-x-suffix-from-song-titles-whe/7-SUMMARY.md`
</output>
