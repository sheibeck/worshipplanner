---
estimated_steps: 24
estimated_files: 2
skills_used: []
---

# T05: Song Lyric Editor with Auto-Save and Copyright Display

Create the main lyric editor that displays parsed sections with inline editing, auto-save status, and copyright display.

1. Create src/components/SongLyricEditor.vue:
   - Props: songId (string), orgId (string)
   - On mount: subscribe to songLyricsStore for this song's lyrics
   - Display each section as a card/block:
     a. Section label header (e.g. "Verse 1", "Chorus") in bold
     b. Lyric lines as editable textarea (one textarea per section, auto-height)
     c. Sections displayed in lyric definition order (not performance order)
   - Copyright display at bottom: title, authors, CCLI song number, copyright lines, license number (R002)
   - Auto-save integration using useAutoSave composable (from T02):
     a. Watch the reactive lyrics data
     b. On debounced save: call songLyricsStore.updateCurrentLyrics()
     c. Show auto-save status indicator in top-right corner: pending dot, "Saving...", "Saved" checkmark
   - "Paste New Lyrics" button opens LyricPasteDialog (from T04) to re-import/overwrite
   - "Save Version" button: explicitly creates a new version snapshot via songLyricsStore.saveLyrics() (R004 light versioning)
   - Empty state: if no lyrics exist, show prominent "Paste Lyrics from SongSelect" CTA button opening LyricPasteDialog
   - Dark-first styling consistent with existing components
   - On unmount: cleanup auto-save timers, unsubscribe lyrics

2. Create src/components/__tests__/SongLyricEditor.test.ts:
   - Test renders sections from store data
   - Test editing a section marks auto-save as pending
   - Test "Save Version" button creates a new version
   - Test empty state shows paste CTA
   - Test copyright info is displayed

## Inputs

- `src/stores/songLyrics.ts`
- `src/composables/useAutoSave.ts`
- `src/components/LyricPasteDialog.vue`
- `src/components/SongSlideOver.vue`

## Expected Output

- `src/components/SongLyricEditor.vue`
- `src/components/__tests__/SongLyricEditor.test.ts`

## Verification

npx vitest run src/components/__tests__/SongLyricEditor.test.ts --reporter=verbose
