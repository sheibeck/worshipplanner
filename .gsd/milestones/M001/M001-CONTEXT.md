# M001: Worship Service Slide Management

**Gathered:** 2026-07-23
**Status:** Ready for planning

## Project Description

A full slide management system for worship services — not just lyrics, but the complete visual flow of a church service from announcements through songs, scripture readings, sermon slides, and media. Built for small churches with non-technical volunteers who need something approachable and reliable without dedicated tech staff.

## Why This Milestone

The church currently uses ProPresenter for slides, which is overly complex for small churches without tech staff. This milestone replaces that workflow with an integrated slide system inside the existing worship planner — eliminating the need for a separate application and the confusion of juggling multiple song versions across systems.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Paste lyrics from CCLI SongSelect, see them auto-split into slides by section, arrange the performance order with repeats, and have those lyrics available across all services
- Create a service with formalized sections (Pre-Service, Worship, Message, Sending), add songs/scripture/sermon/announcements, and see a complete slideshow auto-assemble from the service order
- Import a pastor's sermon PowerPoint and announcement slides into native format
- Attach audio (vamps, prayer music) and video (missionary videos) to any slide with auto-play
- Preview the complete service slideshow in full-screen with manual advance and media playback

### Entry point / environment

- Entry point: Browser URL — existing worship planner web app
- Environment: Browser (desktop primarily, mobile secondary)
- Live dependencies involved: Firebase (Firestore, Storage, Cloud Functions, Auth), ESV API (existing integration)

## Completion Class

- Contract complete means: Slide CRUD, CCLI paste parsing, PPTX import, service-to-slideshow assembly, and presentation preview all work with test coverage
- Integration complete means: Cloud Function parses real PPTX files, ESV API returns real scripture for slide generation, Firebase Storage handles media upload/download/cleanup
- Operational complete means: Auto-save prevents data loss, 2-week media cleanup runs correctly, presentation preview handles missing media gracefully

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- A volunteer can paste lyrics from SongSelect, build the performance order, add the song to a service, import a sermon PowerPoint, and preview the complete slideshow — end to end
- Reordering service elements causes the slideshow to automatically reorder without manual intervention
- Media (audio/video) auto-plays in the presentation preview when advancing to a media slide
- A PPTX file uploaded through the import flow is correctly parsed by the Cloud Function and appears as editable native slides

## Architectural Decisions

### Unified slide data model
**Decision:** Use a single slide type with a content-kind field (lyric, scripture, image, video, text) rather than distinct types per content
**Rationale:** Simpler for the editor, reordering, and the user mental model — one slide is one slide regardless of content
**Alternatives Considered:**
- Distinct TypeScript types per slide kind — cleaner type safety but more UI components and more complexity for users

### Single canonical song version
**Decision:** Songs have one lyric/slide sequence in the catalog; services reference it live, not as copies
**Rationale:** Eliminates the wrong-slides-at-rehearsal problem from juggling multiple ProPresenter versions. Edit once, every service sees the update.
**Alternatives Considered:**
- Per-service song copies — allows per-service tweaks but creates version confusion, which is exactly the problem the user is escaping from ProPresenter

### PowerPoint as universal import format
**Decision:** Support only .pptx import; Google Slides and Keynote users export to PowerPoint first
**Rationale:** One import pipeline instead of three. Both Google Slides and Keynote have built-in PowerPoint export. Avoids OAuth complexity for Google Slides API and proprietary protobuf parsing for Keynote.
**Alternatives Considered:**
- Google Slides URL import via API — requires OAuth flow, adds complexity for non-technical users
- Native Keynote parsing — Apple's protobuf schema is undocumented and fragile across versions

### Server-side PPTX parsing
**Decision:** Parse PowerPoint files in a Firebase Cloud Function, not client-side
**Rationale:** More reliable extraction, no browser memory constraints, handles edge cases better. "Least amount of hassle, most amount of reliability."
**Alternatives Considered:**
- Client-side parsing in browser — no server cost but limited by browser JS capabilities and memory

### Formalized service sections
**Decision:** Four named service sections (Pre-Service, Worship, Message, Sending) as the default structure
**Rationale:** Gives lay users a clear template to work from rather than a blank canvas. Makes slide auto-assembly deterministic. Other churches can adapt later, but a sensible default is better for the target audience.
**Alternatives Considered:**
- Fully freeform service order — more flexible but harder for non-technical users to start with

### CCLI SongSelect paste as lyric input
**Decision:** Manual copy/paste from SongSelect with auto-parsing, not API integration
**Rationale:** CCLI does not allow API access to anyone. The paste format has reliable section markers (Verse 1, Chorus, Bridge, etc.) that enable auto-splitting.
**Alternatives Considered:**
- CCLI API — not available, hard constraint

## Error Handling Strategy

- **Auto-save** on all slide editing — debounced saves as the user works, not just on explicit save. Browser crash or navigation preserves work.
- **PPTX import failures** — surface clear error ("We couldn't read this file — try re-exporting from PowerPoint") rather than silent broken slides. Never delete uploaded file until import confirmed successful.
- **ESV API failures** — show error and let user retry or enter text manually. Don't block the whole service editor.
- **Media upload failures** — resume/retry on failed uploads. Don't lose slide metadata if media attachment fails.
- **2-week cleanup** — only delete media files, never slide metadata/text. Failed cleanup retries next cycle.
- **Light versioning** — version snapshots on song lyrics act as safety net for accidental edits/deletes.
- **Presentation mode** — if media fails to load (deleted, network error), show slide text/content and skip media gracefully.
- **CCLI paste parsing** — best-effort split on markers, surface anything unexpected for user correction. Never silently drop content.

## Risks and Unknowns

- PPTX parsing fidelity — extracting text, images, and basic layout reliably from diverse PowerPoint files created by different versions and tools
- CCLI SongSelect paste format variations — the format may differ across songs or change over time
- Service section formalization — extending the current flat slot array without breaking existing services and their data
- Browser-based media playback — audio/video auto-play behavior varies across browsers and may require user interaction to start

## Existing Codebase / Prior Art

- `src/types/service.ts` — Service model with ordered slots (SongSlot, ScriptureSlot, NonAssignableSlot, HymnSlot), position field, slot kinds
- `src/utils/slotTypes.ts` — Slot factory, reindexSlots(), buildSlots() with progression-based templates, slotLabel()
- `src/utils/esvApi.ts` — ESV API integration via Cloud Function proxy, fetches passage text with verse numbers
- `src/types/song.ts` — Song type with ccliNumber field, arrangements, VW types
- `src/stores/services.ts` — Pinia store for service CRUD operations
- `src/stores/songs.ts` — Pinia store for song catalog
- `src/views/ServiceEditorView.vue` — Service editor with slot management
- `src/components/SongSlideOver.vue` — Right slide-over drawer pattern for editing
- `functions/src/index.ts` — Existing Cloud Functions (ESV proxy, Planning Center integration)
- `src/components/` — 30 hand-rolled Vue components using Tailwind dark-first design, SortableJS, modals, drawers

## Relevant Requirements

- R001-R004 — Song lyric slides (CCLI paste, copyright, performance order, versioning)
- R005-R007 — Service-driven assembly (auto-assembly, auto-reorder, service sections)
- R008-R009 — Scripture slides (ESV auto-pull, congregational reading)
- R010-R012 — Import pipeline (PPTX parsing, announcements, sermon)
- R013-R015 — Media (audio, video, storage lifecycle)
- R016 — Presentation preview
- R017-R020 — Cross-cutting (auto-save, UX quality, unified model, single version)

## Scope

### In Scope

- Song lyric slides from CCLI SongSelect paste with auto-split and performance order builder
- Copyright compliance on first/last lyric slides
- Light version history on lyrics (undo/revert)
- Scripture slides via ESV API with auto-split and congregational reading mode
- Service sections (Pre-Service, Worship, Message, Sending)
- Service-driven slideshow auto-assembly with auto-reorder on service changes
- PowerPoint import via Cloud Function (sermon and announcement slides)
- Image import for announcement slides
- Audio attachment per slide (MP3, auto-play, no loop)
- Video playback per slide (MP4, WebM, MOV, auto-play, no loop)
- Firebase Storage with 2-week media retention auto-cleanup
- Presentation preview mode (full-screen, manual advance, media playback)
- Auto-save on all editing surfaces
- Polished, intuitive UX reusing existing app design patterns

### Out of Scope / Non-Goals

- Multi-monitor output, confidence monitors, live presentation engine (future milestone)
- Slide transitions and presentation polish (future milestone)
- ProPresenter import (future milestone)
- Keynote native import (users export to PowerPoint)
- Google Slides API direct import (users export to PowerPoint)
- CCLI API integration (not available)
- ProPresenter song library migration (starting fresh)
- Per-service song lyric copies or multiple versions of same song

## Technical Constraints

- CCLI does not provide API access — lyrics must come through manual copy/paste from SongSelect
- Existing services use a flat slot array with position-based ordering — service sections must be added without breaking existing data
- Firebase Storage costs must stay manageable for small churches — 2-week media retention policy
- Browser auto-play policies may require user interaction for media — need graceful handling

## Integration Points

- Firebase Firestore — slide data, song lyrics, service slideshow assembly
- Firebase Storage — media file uploads (audio, video, imported images)
- Firebase Cloud Functions — PPTX parsing, 2-week media cleanup job
- ESV API (existing) — scripture text fetch for scripture slides
- CCLI SongSelect (manual) — copy/paste lyrics with section markers

## Testing Requirements

- Unit tests for CCLI SongSelect paste parser (section splitting, copyright extraction, edge cases)
- Unit tests for scripture auto-split logic (long passages, verse boundaries)
- Unit tests for service-to-slideshow assembly and reorder logic
- Integration tests for PPTX Cloud Function (real .pptx files → native slides)
- Component tests for slide editor, performance order builder
- Manual browser verification of presentation preview with media playback
- Auto-save verification (edit → crash simulation → recovery)

## Acceptance Criteria

- S01: A user can paste lyrics from SongSelect, see auto-split sections, arrange performance order with repeats, and save with auto-save. Copyright info appears on first/last slides. Light versioning allows revert.
- S02: A user can enter a scripture reference and see auto-pulled ESV text split into slides. Congregational reading mode shows Leader/Congregation labels. Manual override works for all auto-generated content.
- S03: A service has four named sections. Adding songs/scripture/etc. to sections auto-assembles the slideshow. Reordering elements reorders slides. Existing services are not broken.
- S04: A user can upload a .pptx file and see it parsed into editable native slides in the sermon or announcement section. Image upload works for announcements.
- S05: A user can attach MP3 or video to any slide. Media auto-plays on slide entry, stops at end, no loop. 2-week cleanup deletes old media files.
- S06: A user can open full-screen preview of the complete service slideshow, advance through all slide types, and see/hear media playback.

## Open Questions

- Exact PPTX parsing library for Cloud Functions (pptx-parser, officegen, python-pptx via subprocess, or similar) — to be determined during planning/research
- How varied the SongSelect paste format actually is across different song types (hymns vs contemporary vs multilingual) — may need broader sample testing
- Whether the service section model should be configurable per-church or fixed for v1 — starting fixed, can be made configurable later
