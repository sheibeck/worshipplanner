# Phase 23: Presentation Preview Mode

**Source:** Migrated from gsdpi milestone M001, slice S06
**Status:** Ready for planning

## Goal

Let a user open a full-screen preview of the complete assembled service slideshow and advance manually through all slide types (lyric, scripture, image, PPTX-imported, and media), with media playback working. When media is missing, the preview degrades gracefully rather than breaking.

After this phase: a user can open a full-screen preview of a complete service slideshow and advance through all slide types with media playback working.

## Depends On

- **Phase 20** — Service Sections and Slide Auto-Assembly. Consumes the assembled slideshow (the ordered array of slides from all sources) and the service-to-slideshow binding that auto-updates on reorder.
- **Phase 22** — Media Attachments and Storage Lifecycle. Consumes the media attachment data (Firebase Storage URLs) on slides and the audio/video playback components with auto-play behavior.

## Requirements

- **R016** — Presentation preview.

Supporting:

- **R018** — Polished, intuitive UX reusing existing app design patterns.

## Error Handling Strategy

- **Graceful degradation on missing media** — if media fails to load (deleted, network error), the preview shows the slide's text/content and skips the media rather than blocking or breaking the slideshow. This includes the case where a media file was cleaned up by the 2-week retention policy.

## Risks and Unknowns

- **Browser media autoplay** — audio/video auto-play behavior varies across browsers and may require a user interaction to start. The preview must handle browsers that block autoplay until the user interacts.

## Technical Constraints

- Browser auto-play policies may require user interaction for media — the preview needs graceful handling for this.

## Integration Points

- **Firebase Firestore** — reads the assembled service slideshow.
- **Firebase Storage** — serves media (audio/video) URLs for playback.
- Reuses the audio/video playback components produced in Phase 22.

## Testing Requirements

- Manual browser verification of presentation preview with media playback.
- Verification of graceful degradation when media is missing/deleted (slide content still shows, media skipped).

## Acceptance

A user can open a full-screen preview of the complete service slideshow, advance through all slide types, and see/hear media playback. (M001-CONTEXT, S06.)
