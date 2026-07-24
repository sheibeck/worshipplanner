# S01: Song Lyric Slides and Editor — UAT

**Milestone:** M001
**Written:** 2026-07-24T13:20:14.307Z

## UAT Type
- UAT mode: browser-executable

## Preconditions
- Dev server running: `npm run dev` → `http://localhost:5173`
- Firebase emulator running: `npx firebase emulators:start`
- `.env.local` present with Firebase config

## Test Cases

### TC1: CCLI Paste and Parse (R001, R002)
1. Navigate to Songs list, open or create a song
2. Click the Lyrics tab in SongSlideOver
3. Click "Paste Lyrics" to open LyricPasteDialog
4. Paste valid CCLI SongSelect text (with verse/chorus markers, copyright block)
5. **Expected:** Live preview shows parsed sections with correct labels (Verse 1, Chorus, Bridge, etc.)
6. **Expected:** Copyright info (title, authors, CCLI number) displayed in preview
7. Click Confirm
8. **Expected:** Sections appear in SongLyricEditor with copyright footer

### TC2: Section Editing and Auto-Save (R017, R018)
1. In SongLyricEditor, edit text in a lyric section
2. **Expected:** Status indicator shows "Saving..." then "Saved" within ~1 second
3. Reload the page and return to the same song's Lyrics tab
4. **Expected:** Edited text persists

### TC3: Performance Order Builder (R003)
1. Click the Performance Order tab or section
2. **Expected:** Default order matches parsed section order
3. Add a section (e.g., add Chorus again for a repeat)
4. Drag to reorder sections
5. **Expected:** Order updates visually; repeat sections allowed
6. Click Reset to Default
7. **Expected:** Order reverts to original parsed order

### TC4: Version History and Revert (R004)
1. Make and save multiple edits to lyrics
2. Open Version History
3. **Expected:** Multiple versions listed with relative timestamps
4. Click Revert on an older version
5. **Expected:** Confirmation dialog appears
6. Confirm revert
7. **Expected:** Lyrics revert to selected version content; a new version entry is created (append-only)

### TC5: Discard Guard (R018)
1. Open LyricPasteDialog, paste text but do not confirm
2. Click Cancel or close
3. **Expected:** Confirmation prompt warns about unsaved changes

### Edge Cases
- Paste empty text → no sections parsed, confirm disabled
- Paste text without CCLI markers → single section, no copyright
- Performance order with all sections removed → empty state displayed
- Version history with single version → revert button present but only one entry
