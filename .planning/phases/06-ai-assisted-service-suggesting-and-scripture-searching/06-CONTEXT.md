# Phase 6: AI Assisted Service Suggesting and Scripture Searching - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Enhance the existing service planning workflow with AI-powered song suggestions and scripture discovery. The AI uses sermon context (topic and/or passage) to suggest thematically relevant songs and scripture readings. The current algorithmic suggestion system (recency + VW type scoring) remains as the baseline — AI augments it, never replaces it. The service editor must always work fully without AI.

</domain>

<decisions>
## Implementation Decisions

### Sermon context & AI input
- Add an optional free-text "Sermon Topic/Theme" field to the service editor (e.g., "Grace and forgiveness", "The prodigal son")
- AI uses both the sermon topic field and the sermon passage (already exists) as context — either alone is sufficient to trigger suggestions
- AI considers previously selected songs/scriptures in the service when suggesting for the next slot — builds a cohesive service flow
- AI runs on-demand via an explicit button press — not automatic. Planner controls when AI runs and API costs

### Song suggestion enhancement
- AI suggestions shown as a separate "AI Picks" section above the existing "By Rotation" section in the SongSlotPicker dropdown
- Two modes: per-slot AI picks in the picker dropdown, plus a top-level "Suggest All Songs" button for a complete 4-song set
- Top 3 AI picks per slot
- When no sermon context exists, the AI section shows a placeholder prompt: "Add a sermon topic or passage for AI suggestions"
- When AI is unavailable or errors, the current rotation-based suggestions continue working — AI is an enhancement, not a dependency

### Scripture discovery
- Two entry points for AI scripture: natural language search field above the structured picker + "Suggest Scripture" button per scripture slot
- Natural language search accepts queries like "passages about forgiveness" or "comfort in suffering"
- Auto-suggest provides 3-5 passages based on sermon context
- AI suggests full references with specific verse ranges (e.g., "Psalm 23:1-6", not just "Psalm 23")
- Results show reference + AI's brief reason for suggesting it (e.g., "Themes of grace and redemption") — no passage text preview in results. Planner uses existing ESV preview button to read text
- Overlap with sermon passage: AI shows all suggestions but marks overlapping ones with a warning — planner decides if overlap is intentional

### AI response presentation
- Each AI suggestion includes a short 5-10 word reason (e.g., "Themes of redemption match Romans 8", "Complements the opening hymn")
- "Suggest All Songs" fills empty song slots directly inline in the service editor — each slot shows the AI pick with accept/reject actions. Feels like a draft the planner refines
- Graceful error handling: AI section shows "Suggestions unavailable" with a retry link on failure. Service editor always works without AI

### Claude's Discretion
- What song metadata to send to the AI (balance of data richness vs. API payload size)
- Loading state design while AI is processing (shimmer, spinner, or other pattern fitting the dark-mode UI)
- AI API architecture (client-side calls vs. backend proxy)
- Caching strategy for AI responses within a session
- Exact placement and styling of the "Suggest All Songs" button in the service editor header
- How accept/reject actions look on AI-filled slots

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `utils/suggestions.ts` — `rankSongsForSlot()`: Pure scoring function (recency + VW type bonus). AI picks will render above these rotation-based results
- `utils/scripture.ts` — `BIBLE_BOOKS`, `scripturesOverlap()`, `esvLink()`: Scripture reference handling, overlap detection already built
- `utils/esvApi.ts` — `fetchPassageText()`: ESV API integration with `VITE_ESV_API_KEY`. Pattern for external API calls reusable for AI
- `SongSlotPicker.vue` — Dropdown with search, top 5 ranked suggestions. Needs new "AI Picks" section above rotation results
- `ScriptureInput.vue` — Structured book/chapter/verse picker with ESV preview. Needs AI search field above and per-slot suggest button
- `ServiceEditorView.vue` — Full-page editor (738 lines). Integration point for "Suggest All Songs" button and sermon topic field
- `SongBadge.vue`, `TeamTagPill.vue` — Reusable badges for AI suggestion display

### Established Patterns
- Dark mode palette: gray-950 body, gray-900 cards, gray-800 inputs — AI UI must follow
- Pinia stores with `onSnapshot` for Firestore real-time data
- Async/await with try/catch error handling (see `ScriptureInput.vue` preview pattern)
- Teleport to body for dropdowns/pickers (z-index management)
- Static class lookup for Tailwind v4 purge safety
- Inline SVG icons — no icon library

### Integration Points
- `VITE_CLAUDE_API_KEY` already in `.env.local.example` — Claude anticipated as AI provider
- `ServiceEditorView.vue` header area — add "Suggest All Songs" button alongside Print/Share/Export
- `ServiceEditorView.vue` — add sermon topic text field near existing sermon passage input
- `SongSlotPicker.vue` — add "AI Picks" section above rotation suggestions
- `ScriptureInput.vue` — add natural language search field and "Suggest Scripture" button
- Song store (`stores/songs.ts`) — provides full song library for AI context
- Service store (`stores/services.ts`) — provides service data including slots, teams, progression

</code_context>

<specifics>
## Specific Ideas

- AI is a power tool for the planner, not an autopilot — always on-demand, always overridable
- "Suggest All Songs" creates a draft the planner refines, not a final answer
- Short reasoning per suggestion builds trust without cluttering the UI
- Scripture search should feel like asking a knowledgeable pastor "what passages relate to this theme?"
- The service editor must feel exactly the same without AI context — no broken or empty states when AI isn't used

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-ai-assisted-service-suggesting-and-scripture-searching*
*Context gathered: 2026-03-04*
