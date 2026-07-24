# Phase 4: Output - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Planners can produce formatted orders of service for rehearsal and Sunday, share a mobile-friendly plan link with unauthenticated team members, and export structured data for manual Planning Center entry. Collaboration, task management, and special events are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Print layout & content
- Audience: musicians & tech team — a working document for rehearsal and service execution
- Song detail per slot: Title + Key + BPM
- Scripture: reference only (e.g., "Psalm 23:1-6"), no full text — keeps printout compact
- Single page target: dense but scannable; allow graceful overflow to second page with proper breaks
- Header: date, active teams (Choir/Orchestra/etc.), progression pattern (1-2-2-3), service name if special
- Notes: print the service's existing notes field content
- Sermon passage: displayed in the Message row (e.g., "Message — Romans 8:1-11")
- Print method: browser print via CSS @media print stylesheet — "Print" button opens native print dialog, no PDF library dependency
- Light/white background for print — separate print stylesheet from dark app theme

### Shareable link access
- Token URL model: generate a unique URL like /share/abc123 — anyone with the link can view, no login required
- Link generation: on-demand — user clicks "Share" to generate token; no public URL exists until explicitly shared
- Shared view detail level: same as print — Title + Key + BPM per song, scripture references, sermon passage, teams, progression
- Theme: light theme for the shared view — better readability on phones in daylight
- Distribution: "Copy Link" button copies URL to clipboard; user pastes into email, text, GroupMe, etc.

### Planning Center export
- Workflow: manual copy-paste — user opens Planning Center and adds items one by one using the exported text as reference
- Format: copy-to-clipboard text block — "Copy for Planning Center" button, no file download
- Song fields: Title + Key + CCLI# per song
- Scope: full service order — songs with keys/CCLI, scripture references, prayer, message/sermon passage
- Output is a structured, readable text block ordered by service slot position

### Entry points & triggers
- All actions (Print, Share, Copy for PC) as buttons in the service editor header
- Single service at a time — no batch print/export from services list
- Clipboard feedback: button text changes to "Copied!" with checkmark icon, then reverts — inline feedback, no toast

### Claude's Discretion
- Exact print stylesheet layout, spacing, and typography within "single page, dense, scannable" direction
- Share token generation mechanism (Firestore document with security rules vs. Firebase Functions)
- How the shared view component is structured (new route, public layout without AppShell)
- Exact text format for the Planning Center clipboard export
- Button placement and styling within the service editor header
- Print preview behavior (if any) before triggering browser print dialog
- How to handle printing a draft vs. planned service (warning, or allow both)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- ServiceCard.vue: Already renders compact service summary (date, slots, ESV links, status) — print layout can follow similar structure
- SongBadge.vue: VW type badges — reuse for print/share view slot labels
- ServiceEditorView.vue: Service editor header area where Print/Share/Export buttons will be added
- types/service.ts: Complete Service interface with slots, sermonPassage, teams, progression, notes — all data needed for output
- utils/scripture.ts: `esvLink()` helper for generating ESV.org URLs from scripture references

### Established Patterns
- Dark mode palette (gray-950/900/800) for app — print and share views need separate light theme
- Inline SVG icons — use for Print/Share/Copy button icons
- Pinia stores with onSnapshot — service store already provides all service data
- Tailwind CSS — @media print utilities available for print stylesheet
- Static class lookup pattern for Tailwind v4 purge safety — apply to any dynamic classes in output views

### Integration Points
- ServiceEditorView.vue header: add Print/Share/Copy for PC buttons alongside existing controls
- Router: needs /share/:token public route (no auth guard) for shared view
- Firestore: share tokens need storage (e.g., `organizations/{orgId}/shares/{token}` or `shareTokens/{token}`)
- Security rules: shared view route must bypass auth — public read for share token documents
- Song store: may need song CCLI numbers for the PC export (currently in song data, need to lookup by songId from slot)

</code_context>

<specifics>
## Specific Ideas

- Print layout should feel like a professional rehearsal handout — clean, information-dense, one page
- Shared view is essentially a "read-only light-theme version of the service order" — consistent with print content
- The Planning Center export text should be easy to read and copy from — not a raw data dump, but a human-readable formatted block
- Inline "Copied!" button feedback (not toast) matches the minimal, tool-focused UI tone established in prior phases

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-output*
*Context gathered: 2026-03-04*
