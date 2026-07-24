# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

### R001 — Song lyric slide creation from CCLI SongSelect paste
- Class: core-capability
- Status: active
- Description: Song lyric slide creation from CCLI SongSelect paste
- Why it matters: Primary path for getting lyrics into the system — users copy/paste from SongSelect and the parser auto-splits by verse/chorus/bridge markers into individual slides
- Source: user
- Primary owning slice: M001/S01
- Validation: unmapped

### R002 — CCLI copyright compliance on first and last lyric slides
- Class: compliance/security
- Status: active
- Description: CCLI copyright compliance on first and last lyric slides
- Why it matters: CCLI license requires copyright info (song title, authors, CCLI number, license number) displayed on first and last slides of every song
- Source: user
- Primary owning slice: M001/S01
- Validation: unmapped

### R003 — Song performance order builder with section repeats
- Class: core-capability
- Status: active
- Description: Song performance order builder with section repeats
- Why it matters: Songs are not sung in the order sections appear in lyrics — users need to arrange the performance sequence (Verse 1, Chorus, Verse 2, Chorus, Bridge, Chorus) with repeats to match how they actually sing it
- Source: user
- Primary owning slice: M001/S01
- Validation: unmapped

### R004 — Light version history on song lyrics for undo/revert
- Class: continuity
- Status: active
- Description: Light version history on song lyrics for undo/revert
- Why it matters: Protect against accidental edits or deletes — not branching versions, just the ability to fix an oops and go back to the previous state
- Source: user
- Primary owning slice: M001/S01
- Validation: unmapped

### R005 — Service-driven slide auto-assembly from service order
- Class: primary-user-loop
- Status: active
- Description: Service-driven slide auto-assembly from service order
- Why it matters: The slideshow is a projection of the service order — slides auto-assemble from service elements so no one has to manually build a slideshow from scratch each week
- Source: user
- Primary owning slice: M001/S03
- Validation: unmapped

### R006 — Auto-reorder slides when service elements change order
- Class: primary-user-loop
- Status: active
- Description: Auto-reorder slides when service elements change order
- Why it matters: When someone reorders songs, scripture, or other elements in the service, the slideshow must automatically follow — no one should have to manually re-sequence slides
- Source: user
- Primary owning slice: M001/S03
- Validation: unmapped

### R007 — Formalized service sections: Pre-Service, Worship, Message, Sending
- Class: core-capability
- Status: active
- Description: Formalized service sections: Pre-Service, Worship, Message, Sending
- Why it matters: Gives lay users a clear template-based structure for building a service rather than a blank canvas, and makes slide auto-assembly deterministic by knowing which phase each element belongs to
- Source: user
- Primary owning slice: M001/S03
- Validation: unmapped

### R008 — Scripture slides via ESV API auto-pull with auto-split for long passages
- Class: core-capability
- Status: active
- Description: Scripture slides via ESV API auto-pull with auto-split for long passages
- Why it matters: Leverages existing ESV API integration to auto-fetch scripture text when a reference is entered, then auto-splits long passages into readable slide chunks — no one has to type out scripture manually
- Source: user
- Primary owning slice: M001/S02
- Validation: unmapped

### R009 — Congregational reading mode with Leader/Congregation labels
- Class: differentiator
- Status: active
- Description: Congregational reading mode with Leader/Congregation labels
- Why it matters: Enables responsive/liturgical readings where the congregation follows along on screen — Leader and Congregation parts are clearly labeled so everyone knows when to read
- Source: user
- Primary owning slice: M001/S02
- Validation: unmapped

### R010 — PowerPoint (.pptx) import via Firebase Cloud Function
- Class: core-capability
- Status: active
- Description: PowerPoint (.pptx) import via Firebase Cloud Function
- Why it matters: Universal import format for sermon and announcement slides — server-side parsing for reliability, extracts text/images/layout and converts to native slide format
- Source: user
- Primary owning slice: M001/S04
- Validation: unmapped

### R011 — Announcement slides in Pre-Service section imported from PPTX or images
- Class: core-capability
- Status: active
- Description: Announcement slides in Pre-Service section imported from PPTX or images
- Why it matters: Announcements are created externally and imported — they live in the Pre-Service section and auto-assemble with the rest of the slideshow
- Source: user
- Primary owning slice: M001/S04
- Validation: unmapped

### R012 — Sermon slides in Message section imported from PPTX
- Class: core-capability
- Status: active
- Description: Sermon slides in Message section imported from PPTX
- Why it matters: Pastor or secretary creates sermon slides in PowerPoint — they need to be imported into native format and placed in the Message section of the service
- Source: user
- Primary owning slice: M001/S04
- Validation: unmapped

### R013 — Audio attachment per slide with auto-play on entry, no loop
- Class: core-capability
- Status: active
- Description: Audio attachment per slide with auto-play on entry, no loop
- Why it matters: Enables vamps over prayers, background music during moments — MP3 auto-plays when the slide becomes active and stops at the end without looping
- Source: user
- Primary owning slice: M001/S05
- Validation: unmapped

### R014 — Video playback per slide (MP4, WebM, MOV) with auto-play on entry, no loop
- Class: core-capability
- Status: active
- Description: Video playback per slide (MP4, WebM, MOV) with auto-play on entry, no loop
- Why it matters: Supports missionary videos, special media during service — video auto-plays when slide is active, stops at end, user manually advances to next slide
- Source: user
- Primary owning slice: M001/S05
- Validation: unmapped

### R015 — Firebase Storage with 2-week media retention auto-cleanup
- Class: operability
- Status: active
- Description: Firebase Storage with 2-week media retention auto-cleanup
- Why it matters: Media files (videos, audio, imported images) are ephemeral — auto-delete after 2 weeks from service date to keep storage costs manageable for small churches
- Source: user
- Primary owning slice: M001/S05
- Validation: unmapped

### R016 — Presentation preview mode with full-screen view, manual advance, and media playback
- Class: primary-user-loop
- Status: active
- Description: Presentation preview mode with full-screen view, manual advance, and media playback
- Why it matters: Volunteers need to preview and run through the complete service slideshow before Sunday to verify everything works — full-screen browser tab with advance/back and media playback
- Source: user
- Primary owning slice: M001/S06
- Validation: unmapped

### R017 — Auto-save on all slide editing surfaces to prevent data loss
- Class: failure-visibility
- Status: active
- Description: Auto-save on all slide editing surfaces to prevent data loss
- Why it matters: Nothing more frustrating than typing lyrics, having an error, and losing all that work — changes must persist as the user works, not just on explicit save
- Source: user
- Primary owning slice: M001/S01
- Supporting slices: M001/S02, M001/S04
- Validation: unmapped

### R018 — Polished, intuitive editor UX for non-technical volunteers
- Class: quality-attribute
- Status: active
- Description: Polished, intuitive editor UX for non-technical volunteers
- Why it matters: Target audience is lay people at small churches without tech staff — the editor must be usable on first attempt with zero training, like someone who only knows PowerPoint
- Source: user
- Primary owning slice: M001/S01
- Supporting slices: M001/S02, M001/S03, M001/S04, M001/S06
- Validation: unmapped

### R019 — Unified slide data model across all content types
- Class: constraint
- Status: active
- Description: Unified slide data model across all content types
- Why it matters: One slide type with content-kind variants keeps the editor and reordering simple — lyrics, scripture, images, video, audio all share one container
- Source: inferred
- Primary owning slice: M001/S01
- Validation: unmapped

### R020 — Single canonical song lyric version, no per-service copies
- Class: constraint
- Status: active
- Description: Single canonical song lyric version, no per-service copies
- Why it matters: Eliminates the wrong-slides-at-rehearsal problem from juggling multiple versions of the same song — one version in the catalog, every service references it live
- Source: user
- Primary owning slice: M001/S01
- Validation: unmapped

## Validated

## Deferred

### R021 — ProPresenter import
- Class: integration
- Status: deferred
- Description: ProPresenter import
- Why it matters: Churches using ProPresenter may want to migrate their existing slide libraries — deferred because the format is complex and we want core functionality first
- Source: user
- Validation: unmapped
- Notes: Deferred to future milestone — ProPresenter uses proprietary XML/protobuf formats that vary across versions

### R022 — Keynote native import
- Class: integration
- Status: deferred
- Description: Keynote native import
- Why it matters: Some users create slides in Keynote — deferred because Keynote uses proprietary protobuf format and users can export to PowerPoint instead
- Source: user
- Validation: unmapped
- Notes: Users should export Keynote to PowerPoint for import — native .key parsing deferred

### R023 — ProPresenter song library migration
- Class: integration
- Status: deferred
- Description: ProPresenter song library migration
- Why it matters: Churches with existing ProPresenter libraries would benefit from bulk migration — deferred because we are intentionally starting fresh to escape ProPresenter complexity
- Source: user
- Validation: unmapped
- Notes: User explicitly chose to start fresh rather than migrate from ProPresenter

### R024 — Multi-monitor output and confidence monitors
- Class: core-capability
- Status: deferred
- Description: Multi-monitor output and confidence monitors
- Why it matters: Full presentation system with multiple displays is the eventual goal — deferred to a dedicated future milestone covering transitions, multi-monitor, confidence monitors, and streaming
- Source: user
- Validation: unmapped
- Notes: Future milestone will cover transitions, multi-monitor, confidence monitors, streaming system

### R025 — Slide transitions and presentation polish
- Class: quality-attribute
- Status: deferred
- Description: Slide transitions and presentation polish
- Why it matters: Smooth transitions between slides enhance the presentation experience — deferred to the multi-monitor/presentation milestone
- Source: user
- Validation: unmapped
- Notes: Bundled with the future presentation system milestone

## Out of Scope

### R026 — Google Slides API direct import
- Class: anti-feature
- Status: out-of-scope
- Description: Google Slides API direct import
- Why it matters: Would require OAuth flow complexity — users export Google Slides to PowerPoint instead, keeping one import pipeline
- Source: user
- Validation: unmapped
- Notes: Explicitly descoped in favor of universal PPTX import

### R027 — CCLI API integration (not available)
- Class: constraint
- Status: out-of-scope
- Description: CCLI API integration (not available)
- Why it matters: CCLI does not provide API access to anyone — lyrics must come through manual copy/paste from SongSelect website
- Source: user
- Validation: unmapped
- Notes: Hard constraint — CCLI does not allow API access

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | core-capability | active | M001/S01 | none | unmapped |
| R002 | compliance/security | active | M001/S01 | none | unmapped |
| R003 | core-capability | active | M001/S01 | none | unmapped |
| R004 | continuity | active | M001/S01 | none | unmapped |
| R005 | primary-user-loop | active | M001/S03 | none | unmapped |
| R006 | primary-user-loop | active | M001/S03 | none | unmapped |
| R007 | core-capability | active | M001/S03 | none | unmapped |
| R008 | core-capability | active | M001/S02 | none | unmapped |
| R009 | differentiator | active | M001/S02 | none | unmapped |
| R010 | core-capability | active | M001/S04 | none | unmapped |
| R011 | core-capability | active | M001/S04 | none | unmapped |
| R012 | core-capability | active | M001/S04 | none | unmapped |
| R013 | core-capability | active | M001/S05 | none | unmapped |
| R014 | core-capability | active | M001/S05 | none | unmapped |
| R015 | operability | active | M001/S05 | none | unmapped |
| R016 | primary-user-loop | active | M001/S06 | none | unmapped |
| R017 | failure-visibility | active | M001/S01 | M001/S02, M001/S04 | unmapped |
| R018 | quality-attribute | active | M001/S01 | M001/S02, M001/S03, M001/S04, M001/S06 | unmapped |
| R019 | constraint | active | M001/S01 | none | unmapped |
| R020 | constraint | active | M001/S01 | none | unmapped |
| R021 | integration | deferred | none | none | unmapped |
| R022 | integration | deferred | none | none | unmapped |
| R023 | integration | deferred | none | none | unmapped |
| R024 | core-capability | deferred | none | none | unmapped |
| R025 | quality-attribute | deferred | none | none | unmapped |
| R026 | anti-feature | out-of-scope | none | none | unmapped |
| R027 | constraint | out-of-scope | none | none | unmapped |

## Coverage Summary

- Active requirements: 20
- Mapped to slices: 20
- Validated: 0
- Unmapped active requirements: 0
