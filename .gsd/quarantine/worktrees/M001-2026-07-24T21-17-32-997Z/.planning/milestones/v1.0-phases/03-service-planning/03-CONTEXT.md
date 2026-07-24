# Phase 3: Service Planning - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Planners can build a complete weekly service order — selecting a 4-song progression, getting smart song suggestions filtered by category and team, adding scripture, and viewing all planned weeks on a calendar. Output/sharing, collaboration, task management, and special events are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Service order builder
- Pre-filled template: service opens with all 9 slots laid out in standard order (Song, Scripture, Song, Prayer, Scripture, Song, Song, Message, Sending Song)
- Each slot shows its VW type constraint label (e.g., "Type 1 — Call to Worship")
- User fills slots by clicking each one — no drag-and-drop or wizard
- Full-page editor at `/services/:id` — service planning is complex enough to warrant its own dedicated page
- Progression pattern (1-2-2-3 or 1-2-3-3) chosen at service creation (before seeing slots) so slot labels are accurate from the start
- Team configuration via checkboxes at top of service plan (Choir, Orchestra, Special Service) — visible and easy to toggle, immediately filters song suggestions

### Song suggestions
- Dropdown list appears in-slot when user clicks an empty song slot
- Each suggestion row shows: song title, preferred key, "last used X weeks ago", VW type badge
- Top 5 suggestions shown per slot by default
- Strict VW type filtering — only songs matching the slot's type appear in suggestions
- Search bar within the dropdown for manual override — type to search the full library (filtered to correct VW type), suggestions show first, search results below
- Songs used in last 2 weeks deprioritized (shown lower in ranking, not hidden)

### Scripture & sermon input
- Structured book/chapter/verse picker for scripture passages (select book from dropdown, enter chapter and verse range)
- Validates format to ensure consistent, parseable references
- Link to ESV.org for passage text (e.g., esv.org/Psalm+23) — no ESV API integration in v1
- Dedicated "Sermon Passage" input field in the service plan (separate from scripture reading slots)
- When a scripture reading matches or overlaps with the sermon passage, show a warning
- Subtle hint text under scripture input: "Tip: Psalms work well for responsive readings"

### Calendar & services list
- Services list page shows list of week cards — one card per Sunday, each showing date, progression, song titles, and status (planned/draft)
- Click a card to navigate to the full service editor
- Focus on upcoming services (next 4-6 weeks) shown first, with past services section below
- "New Service" button with date picker dialog (defaults to next Sunday) — click navigates to full editor
- Seasonal/quarterly overview as a song rotation table: weeks as columns, songs as rows, highlights repeats and gaps to surface rotation issues

### Claude's Discretion
- Song suggestion ranking algorithm weights (recency decay, category match scoring, team compatibility)
- Exact layout and spacing of the 9-slot service template
- Loading states and skeleton patterns for the service editor
- Empty state design for the services list (no services yet)
- Date picker component choice and styling
- How the seasonal rotation table handles large song libraries (scrolling, filtering)
- Service plan auto-save vs. explicit save behavior
- How the "Prayer" and "Message" slots look (no song assignment, just labels)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- SongBadge.vue: VW type color badges (blue=1, purple=2, amber=3) — reuse in song suggestion rows and slot labels
- TeamTagPill.vue: Team compatibility pill tags — reuse for team checkboxes display
- SongSlideOver.vue: Slide-over panel pattern with Teleport to body — may inform song picker panel if needed
- SongFilters.vue: Search + filter dropdown components — search bar pattern reusable in suggestion dropdown
- useSongStore: Song data with `filteredSongs` computed, `subscribe()` pattern, song types/arrangements already modeled

### Established Patterns
- Dark mode palette: gray-950 body, gray-900 cards, gray-800 inputs/borders — all service UI must follow
- Pinia stores with `onSnapshot` directly — service store should follow same pattern
- Multi-tenant: `organizations/{orgId}/services` collection path
- Inline SVG icons — no icon library
- AppShell wrapper: views render inside `<slot />` — service views follow same pattern

### Integration Points
- Router: needs `/services` route (list) and `/services/:id` route (editor)
- AppSidebar: "Services" nav item already exists pointing to `/services`
- Song store: service planning needs to read songs for suggestion algorithm — cross-store dependency
- Song type (types/song.ts): `Song` interface with `vwType`, `teamTags`, `lastUsedAt` — suggestion algorithm uses these fields
- GettingStarted.vue: may need a "Create your first service" step

</code_context>

<specifics>
## Specific Ideas

- Visual tone consistent with Phase 1/2: Linear/Notion-inspired, dark mode, tool-focused
- Service editor should feel like a form you fill in, not a drag-and-drop playground — structured and guided
- Song suggestion dropdown should feel snappy — instant results when clicking a slot
- The seasonal rotation table is the key differentiator — it directly answers "are we repeating songs too much?"
- Week cards on the services list should give a quick summary at a glance without opening the editor

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-service-planning*
*Context gathered: 2026-03-03*
