# Phase 116: Lyric Editor & Song UX - Context

**Gathered:** 2026-09-04
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — owner decided R334/R336/R337; R333/R335 are spec-fixed

<domain>
## Phase Boundary

Five targeted UX fixes to the song **lyric editor** and the read-only lyric viewer so a user can open,
navigate, and correct a song's lyrics and credits without confusion (R333–R337). No new feature areas —
these are corrections to the existing `SongSlideOver.vue` / `SongLyricEditor.vue` surfaces and the
read-only `SlideGrid.vue` song-group badge. Out of scope: any rework of the version-history mechanism
itself (it is hidden, not redesigned), and any change to how credits are parsed from a paste (only manual
editing is added).

</domain>

<decisions>
## Implementation Decisions

### R333 — Read-only viewer edit link (text + new tab) [spec-fixed]
- The read-only lyric badge in `SlideGrid.vue` (currently "Read-only — edit in Song Lyrics",
  `SlideGrid.vue:41-48`) is relabeled **"Edit song lyrics for {song name}"**, interpolating the song's
  title. If the song title is unavailable at that render site, fall back to "Edit song lyrics".
- It must open the lyric editor in a **new browser tab** (today it is an in-app `router.push` to
  `{ name: 'songs', query: { edit: songId, tab: 'lyrics' } }` handled in `SlidesTab.vue:336-339`). Open
  the resolved deep-link href in a new tab (e.g. `window.open(router.resolve({ name:'songs', query:{ edit:songId, tab:'lyrics' } }).href, '_blank', 'noopener')`, or an equivalent `<a target="_blank" rel="noopener">`). Mechanism is Claude's discretion; the arriving `?edit=&tab=lyrics` deep-link already opens `SongSlideOver` on the Lyrics tab.
- Keep the existing badge styling/location — only the text and open-in-new-tab behavior change. The song
  title must be made available to the badge (it currently only has `songGroupSongId`).

### R334 — SongSelect link next to the song name [owner: reuse the song-table CCLI link-out]
- Owner: "Use CCLI just like we have on the song table. We already link out to it." Reuse the **exact**
  existing pattern from `SongTable.vue:233-240`:
  `:href="`https://songselect.ccli.com/songs/${song.ccliNumber}`"` with `target="_blank"` and
  `rel="noopener"`. This is a direct CCLI-number deep link, NOT a search URL.
- Placement: next to the song name in the slide-over header (`SongSlideOver.vue:39-41`, bound to
  `form.title`), visible across both Details and Lyrics tabs.
- Use `Song.ccliNumber` (the Details-tab-editable field the song table already links on) — **not** the
  paste-derived `copyright.ccliSongNumber`. Show the link **only when `ccliNumber` is non-empty**; hide it
  otherwise (matching the table's `v-if="song.ccliNumber"`).

### R335 — "Cancel" → "Close" [spec-fixed]
- Relabel the slide-over header's **"Cancel"** button (`SongSlideOver.vue:44-50`, `@click="onCancel"`) to
  **"Close"**. Leave its behavior (the unsaved-changes guard + `emit('close')`) unchanged.
- The adjacent X icon button (`SongSlideOver.vue:62-71`, `aria-label="Close"`) already exists and is
  fine — no visible-text collision since it is icon-only. Do not touch the unrelated Cancel buttons in the
  delete-confirm dialog, the remove-section confirm, or the paste region.

### R336 — Manual credits editing [owner: inline edit on the credits block]
- Target the **paste-derived `SongLyrics.copyright`** block (`CopyrightInfo` in `types/songLyrics.ts:32-39`:
  `title`, `authors: string[]`, `ccliSongNumber`, `copyrightLines: string[]`, `ccliLicenseNumber`) — this
  is the block with the stale-credits problem, currently read-only at `SongLyricEditor.vue:322-341`
  (`data-testid="copyright-display"`). (`Song.ccliNumber`/`author` are already editable in the Details tab
  and are NOT the target here.)
- Add an **"Edit credits" toggle** on that read-only copyright display that swaps it to an inline **form
  for all 5 fields**. `authors` and `copyrightLines` are arrays — edit as multi-line (one per line) or a
  clear equivalent. Save via the existing `songLyricsStore.saveLyrics` (persist `{ sections, copyright,
  performanceOrder }` with the edited copyright, WITHOUT re-parsing/altering the lyrics sections).
- The editor must work **even when credits are currently empty** — so a song added via the "Add anyway —
  I'll enter credits later" paste override (`LyricPasteRegion.vue:75-83`) can have credits entered/fixed
  after the fact, and a wrong-then-right paste's stale credits can be corrected or removed.
- Add/remove is covered by editing the fields to blank (removes) or filling them (adds). Removing all
  credit fields should leave the copyright block empty/hidden, consistent with the current
  `v-if="currentLyrics.copyright.ccliSongNumber"` display gate (adjust the gate if needed so an
  all-manual-entry with e.g. only copyrightLines still shows).

### R337 — Hide the History [owner: hide, keep code + versions]
- **Hide** (do not delete) the History toggle button (`SongLyricEditor.vue:21-26`,
  `data-testid="history-toggle-btn"`) and the history disclosure panel (`SongLyricEditor.vue:79-98`,
  including its "Save Version" button). Leave `LyricVersionHistory.vue`, the `songLyricsStore` version
  state/logic, and revert/save-version handlers **intact** in code so the feature can return later
  (it is "deferred", not removed).
- Prefer a clean hide (remove the toggle + panel from the rendered template, or guard behind a
  disabled flag) over deleting files. Update any tests that assert the History toggle/panel is present so
  they assert it is now absent from the UI; keep unit coverage of the underlying store/component that
  remains.

### Claude's Discretion
- Exact open-in-new-tab mechanism for R333 (window.open of the resolved href vs. an anchor element).
- The precise inline-edit form layout/controls for R336 (as long as all 5 CopyrightInfo fields are
  editable, arrays are edit-friendly, and save routes through the existing `saveLyrics`).
- How to surface the song title to `SlideGrid.vue` for the R333 label.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SongTable.vue:233-240` — the canonical CCLI link-out (`https://songselect.ccli.com/songs/${ccliNumber}`,
  `target="_blank" rel="noopener"`); reuse verbatim for R334.
- `src/utils/songEditLink.ts` — `buildSongEditLink(songId, tab)` builds the `{ name:'songs', query:{ edit, tab } }`
  route (`SongEditTab = 'details' | 'lyrics'`); reuse via `router.resolve(...).href` for the R333 new-tab open.
- `songLyricsStore.saveLyrics` — the existing persistence path for `{ sections, copyright, performanceOrder }`;
  reuse for R336 credit saves (no re-parse).
- `LyricVersionHistory.vue` + `songLyricsStore` version state — kept intact under R337 (hidden UI only).

### Established Patterns
- Slide-over shell: `SongSlideOver.vue` owns the header (title + Cancel/X), the Details/Lyrics tab bar
  (`tab-bar`, `activeTab: 'details' | 'lyrics'`), and mounts `SongLyricEditor.vue` in the Lyrics tab.
- Read-only song-group badge lives in `SlideGrid.vue`; navigation is emitted (`edit-in-song`) and handled
  in `SlidesTab.vue` via `router.push(buildSongEditLink(...))`.
- Credits are parsed from a CCLI paste in `LyricPasteRegion.vue` → `ccliParser.ts` (`parseFooter`), then
  displayed read-only — R336 adds the missing manual-edit path over the same `CopyrightInfo` shape.

### Integration Points
- `SlideGrid.vue` badge (R333) + its `SlidesTab.vue` handler (open-in-new-tab).
- `SongSlideOver.vue` header (R334 link next to `form.title`, R335 Cancel→Close).
- `SongLyricEditor.vue` copyright-display block (R336 inline edit) and History toggle/panel (R337 hide).

</code_context>

<specifics>
## Specific Ideas

- R334 must match the song table's link exactly (`https://songselect.ccli.com/songs/{ccliNumber}`) — owner
  was explicit: "just like we have on the song table."
- R336's real-world driver: fixing stale credits left over from a wrong-then-right paste, and entering
  credits for songs added via the paste "enter later" override.

</specifics>

<deferred>
## Deferred Ideas

- Redesigning or fixing the version-history "Just now" timestamp problem — out of scope; History is being
  hidden (deferred), not repaired, per R337.

</deferred>
