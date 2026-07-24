# S02: Scripture and Congregational Reading Slides — UAT

**Milestone:** M001
**Written:** 2026-07-24T14:19:52.681Z

# S02 UAT: Scripture and Congregational Reading Slides

## UAT Type
- UAT mode: browser-executable

## Preconditions
- Dev server running: `npm run dev` → `http://localhost:5173`
- Firebase emulator running with seed data (organization with at least one service containing a SCRIPTURE slot)
- `.env.local` present with valid `ESV_API_KEY` for ESV API proxy
- User logged in as editor role

## Test Cases

### TC-01: Scripture slide creation via ESV fetch
1. Navigate to a service editor view with a SCRIPTURE slot
2. Click "Edit Scripture Slides" button on the scripture slot
3. Editor panel expands inline below the slot
4. Enter a scripture reference (e.g. "John 3:16-21") in the reference input
5. Click "Fetch" button
6. **Expected:** ESV text is fetched and auto-split into slide-sized chunks displayed as a preview list
7. **Expected:** Auto-save status indicator shows "Saving..." then "Saved"

### TC-02: Manual slide override
1. After TC-01, click on a slide's text content in the preview
2. Edit the text manually
3. **Expected:** The slide is marked as overridden (visually distinct)
4. **Expected:** Auto-save triggers on edit

### TC-03: Congregational reading mode toggle
1. From the scripture editor panel, click "Congregational Reading" toggle
2. **Expected:** Editor switches to CongregationalEditor component
3. **Expected:** Sections display with Leader/Congregation labels in alternating pattern
4. Click a speaker toggle button on any section
5. **Expected:** Role toggles between Leader and Congregation
6. **Expected:** Preview panel updates with distinct styling per speaker role

### TC-04: Reading mode persistence
1. Toggle to Congregational mode, make speaker assignments
2. Collapse the editor (click "Edit Scripture Slides" again)
3. Re-expand the editor
4. **Expected:** Reading mode and speaker assignments are preserved

### TC-05: Empty reference guard
1. Find a SCRIPTURE slot with no reference entered
2. **Expected:** "Edit Scripture Slides" button is not visible (editor requires a reference)

### TC-06: Viewer role restriction
1. Log in as a viewer (non-editor role)
2. Navigate to a service with SCRIPTURE slots
3. **Expected:** "Edit Scripture Slides" button is not visible

## Edge Cases
- Very long passage (e.g. Psalm 119) should split into many slides without error
- Invalid scripture reference should show error state, not crash
- Rapid toggle between Normal/Congregational should not cause duplicate saves or state corruption

## Operational Readiness
This slice is entirely client-side with user-visible feedback:
- **Health signal:** Auto-save status indicator ("Saving..."/"Saved") confirms Firestore persistence is working. Slide preview populating after fetch confirms ESV API proxy is reachable.
- **Failure signal:** ESV fetch errors surface via component error state text visible to the user. Firestore write failures surface via auto-save status remaining in error state.
- **Recovery:** User retries fetch if ESV API is temporarily unavailable. Firestore connectivity issues resolve when network is restored; auto-save retries automatically.
- **Monitoring gaps:** No server-side monitoring added — all failures are user-visible by design (client-side editors with status indicators). ESV API rate limiting would appear as fetch failures to the user.
