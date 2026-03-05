# Phase 2: Song Library - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

A complete, searchable song stable with Vertical Worship categories and arrangement data, seeded from a Planning Center CSV export. Users can import, add, edit, delete, categorize, tag, search, and filter songs. Service planning, song suggestions, and usage tracking are separate phases.

</domain>

<decisions>
## Implementation Decisions

### CSV import experience
- Two entry points: "Import Songs" button on the Songs page AND a link from the Getting Started checklist on the dashboard
- After file selection, show a preview table of parsed songs with validation highlights (missing fields, warnings) before committing to Firestore
- Skip duplicates by CCLI number match (or title if no CCLI); show count of skipped duplicates in the preview
- User will provide a real Planning Center CSV export file so the parser matches the actual column format exactly
- Non-destructive: no data is written until the user reviews and clicks "Import"

### Song list & browsing
- Table/list view as the primary display — sortable rows for scanning a large library quickly
- Default columns: Title, Category (VW type), Key, BPM, Last Used, Team Tags
- Search bar at the top for title/CCLI text search
- Filter dropdowns for Category (1/2/3), Key, and Team Tags — filters combine (e.g., Type 2 + Key of G + Choir)
- Empty state: centered message ("Your song library is empty") with a prominent "Import from CSV" button and a smaller "Add song manually" link

### Song detail & editing
- Click a song row to open a slide-over panel from the right — song list stays visible behind it (Linear-style pattern)
- Same slide-over panel for both creating a new song and editing an existing one (blank for create, populated for edit)
- Multiple arrangements per song displayed as collapsible accordion sections or tabs within the panel — each showing key, BPM, length, chord chart link, tags
- User can add, remove, and edit arrangements inline within the panel
- Explicit "Save" button to commit changes; "Cancel" discards edits — no auto-save

### Categorization & tagging
- Vertical Worship type (1/2/3) displayed as color-coded badges in the song table (e.g., Type 1 = blue, Type 2 = purple, Type 3 = amber)
- Team compatibility shown as small pill tags on each song row (e.g., "Choir", "Orchestra", "Band")
- Team tags assigned in the song detail slide-over via toggle buttons or checkboxes
- CSV import auto-populates team tags from arrangement tag data
- Predefined team tags: Choir, Orchestra, Band — plus the ability for users to create custom team tags
- After import, uncategorized songs (no VW type) are filterable via an "Uncategorized" filter
- Two modes for assigning VW types: per-song in the detail panel AND a batch quick-assign mode for working through uncategorized songs with quick 1/2/3 buttons

### Claude's Discretion
- Exact color values for VW type badges within the dark mode palette
- Loading states, spinners, and skeleton patterns
- Sort behavior defaults (alphabetical by title, or most recently used)
- Pagination vs infinite scroll for the song table (whichever fits the data size)
- Exact slide-over panel width and responsive breakpoints
- Error toast/notification design
- Delete confirmation dialog design and wording
- Batch quick-assign mode interaction details

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- AppShell.vue: Sidebar + main content layout with mobile hamburger — song pages will render inside the `<slot />`
- AppSidebar.vue: Already has a "Songs" nav item pointing to `/songs` — route needs to be created
- auth.ts (Pinia store): `ensureUserDocument` pattern with org auto-creation — song store can follow same Pinia composition pattern
- Firebase setup (firebase/index.ts): `db` (Firestore) and `auth` already exported with emulator support

### Established Patterns
- Dark mode palette: gray-950 body, gray-900 cards/sidebar, gray-800 inputs/borders — all song UI must follow this
- Inline SVG icons for all UI — no icon library dependency
- Pinia stores with `onSnapshot` directly — no VueFire composables in stores
- Multi-tenant: all data nests under `organizations/{orgId}/` — songs collection will be `organizations/{orgId}/songs`
- Firestore security rules: wildcard `/{collection}/{docId}` under org already allows read/write for members

### Integration Points
- Router (router/index.ts): needs `/songs` route added (and `/songs/:id` if needed for deep links)
- GettingStarted.vue: currently has hardcoded steps — needs "Import songs" step to link to import flow
- Auth store provides `user.value` — song store will need the user's orgId to query the right collection

</code_context>

<specifics>
## Specific Ideas

- Visual tone consistent with Phase 1: Linear/Notion-inspired, tool-focused, dark mode
- Slide-over panel for song detail is inspired by Linear's issue detail panels — maintains list context while viewing details
- VW type badges should be instantly recognizable at a glance — color is the primary differentiator, not text
- Import flow should feel safe: preview before commit, clear duplicate handling, no data loss

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-song-library*
*Context gathered: 2026-03-03*
