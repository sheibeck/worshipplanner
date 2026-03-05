# Phase 8: Planning Center API Export - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Export published (planned) service plans to Planning Center via the Services API. Creates a PC plan with the sermon scripture as title, adds songs/hymns as Song items and scriptures as Item entries with full text. Replaces the existing "Copy for PC" clipboard button when API credentials are configured. Task management, scheduling, and PC sync are separate concerns.

</domain>

<decisions>
## Implementation Decisions

### API Authentication
- Personal Access Token approach (App ID + Secret), not OAuth2
- User generates token at planningcenteronline.com/api_passwords
- Credentials stored org-level in Firestore (shared across all editors in the org)
- Credentials masked (dots/asterisks) after saving — can clear and re-enter but not read back
- Validate credentials on save with a test API call — show immediate success/error feedback

### Slot-to-Item Mapping
- SONG slots → PC **Song** item type (plain text title + key, no PC song library matching). Better than Item for manual setup afterward in PC
- HYMN slots → PC **Song** item type (hymn name/number as plain text). Same reasoning as songs
- SCRIPTURE slots → PC **Item** entries with full ESV text fetched and placed in the item description (ESV API already integrated)
- PRAYER slots → PC **Item** entries (title: "Prayer")
- MESSAGE slots → PC **Item** entries with sermon passage reference in description

### Export Behavior
- **One-way, one-and-done:** After export, the service is marked as "exported" — all further editing happens in Planning Center, not in WorshipPlanner. No sync back, no updating the PC plan.
- **Re-export path:** User can revert service to draft, make changes, mark as planned again, and re-export — but this always creates a **brand new** PC plan, never updates the previous one
- Track export status on the service document (exported timestamp, PC plan ID) for UI indication
- Exported services should visually indicate their exported state (e.g., badge, dimmed editing, or read-only indicator) so users know to work in PC from this point
- Partial failure: report partial success ("Plan created but 2 items failed to add") — don't roll back the plan
- Loading state: spinner on button with "Exporting..." text, button disabled during export

### Export Feedback
- Success: green inline toast "Exported to Planning Center" — auto-dismisses
- Error: red inline banner with error message — stays until dismissed
- Consistent with existing "Copied!" feedback pattern in ServiceEditorView

### Export Eligibility
- Service status "planned" = exportable (no new "locked" status needed)
- Conditional button replacement: show "Export to PC" when PC credentials are configured, fall back to "Copy for PC" when no credentials
- Export button only in ServiceEditorView (not on ServicesView service cards)
- Button hidden entirely for draft services — no disabled/grayed state

### Claude's Discretion
- PC API request batching/sequencing strategy
- Error message wording and toast timing
- Settings UI layout for the credentials section
- How to store/retrieve the PC plan URL after export

</decisions>

<specifics>
## Specific Ideas

- Songs and hymns should use PC's Song item type (not generic Item) because it's better for the manual setup work done afterward in Planning Center
- Plan title format from success criteria: sermon scripture reference + special info in parens (e.g., "Revelation 12 (Choir)")
- The existing `planningCenterExport.ts` utility already formats services as plain text — the new API export builds alongside it, not replacing the format logic
- **Intent: once exported, the service "lives" in Planning Center.** WorshipPlanner is the planning brain; PC is the execution platform. No round-trip sync — this milestone is one-and-done export.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `planningCenterExport.ts`: `formatForPlanningCenter()` and `formatScriptureRef()` — reference for slot iteration and scripture formatting
- `esvApi.ts`: ESV API integration for fetching scripture text (needed for scripture item descriptions)
- `SettingsView.vue`: Existing settings page to extend with PC credentials section
- `ServiceEditorView.vue:145-160`: "Copy for PC" button location — will be conditionally replaced

### Established Patterns
- Org-level data stored in Firestore `organizations/{orgId}` document (auth store pattern)
- `onSnapshot` real-time listeners in Pinia stores for reactive data
- Dark mode: gray-950 body, gray-900 cards, gray-800 inputs, indigo-600 primary buttons
- Inline feedback pattern: "Copied!" / "Saved!" with setTimeout auto-dismiss

### Integration Points
- `SettingsView.vue`: Add PC credentials section below Organization
- `ServiceEditorView.vue`: Replace/toggle "Copy for PC" button based on credentials
- `auth.ts` store: May need to expose PC credentials availability
- Service Firestore document: Add `pcExportedAt` and `pcPlanId` fields for re-export tracking

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-planning-center-api-export-for-published-service-plans*
*Context gathered: 2026-03-04*
