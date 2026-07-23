---
estimated_steps: 23
estimated_files: 4
skills_used: []
---

# T07: Version History UI and SongSlideOver Lyrics Tab Integration

Create the version history component and integrate all lyrics UI into SongSlideOver as a tabbed interface.

1. Create src/components/LyricVersionHistory.vue:
   - Props: versions (SongLyrics[]) — all version docs from subcollection, currentVersionId (string)
   - Emits: revert (versionId: string)
   - Display list of version entries showing: timestamp (relative time), "Current" badge on active version, "Revert" button on non-current versions
   - On revert click: confirm dialog ("Revert to this version? Your current edits will be saved as a new version first."), then emit revert event
   - Dark-first styling: gray-800 list items, gray-400 timestamps, indigo revert button

2. Modify src/components/SongSlideOver.vue to add a tabbed interface:
   - Add two tabs at top of scrollable body: "Details" (existing form) and "Lyrics" (new)
   - "Details" tab: contains all existing form fields unchanged
   - "Lyrics" tab: contains SongLyricEditor (T05), PerformanceOrderBuilder (T06), and LyricVersionHistory
   - Tab styling: bottom-border active indicator in indigo, gray-400 inactive text
   - "Lyrics" tab only shows when editing an existing song (not in create mode — you need a song ID)
   - Tab state resets to "Details" when slide-over opens
   - Existing Save/Cancel buttons apply only to "Details" tab. "Lyrics" tab has its own auto-save.

3. Create src/components/__tests__/LyricVersionHistory.test.ts:
   - Test renders version list with timestamps
   - Test current version shows "Current" badge
   - Test revert button shows confirm dialog
   - Test emits revert event with version ID

4. Update src/components/__tests__/SongSlideOver.test.ts:
   - Add test that tabs render in edit mode
   - Add test that lyrics tab is hidden in create mode

## Inputs

- `src/components/SongSlideOver.vue`
- `src/components/SongLyricEditor.vue`
- `src/components/PerformanceOrderBuilder.vue`
- `src/stores/songLyrics.ts`

## Expected Output

- `src/components/LyricVersionHistory.vue`
- `src/components/__tests__/LyricVersionHistory.test.ts`

## Verification

npx vitest run src/components/__tests__/LyricVersionHistory.test.ts src/components/__tests__/SongSlideOver.test.ts --reporter=verbose
