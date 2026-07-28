# Phase 21: PowerPoint Import for Announcements and Sermon

**Source:** Migrated from gsdpi milestone M001, slice S04
**Status:** Ready for planning

## Goal

Let a user upload a `.pptx` file and have it parsed into native, editable slides via a Firebase Cloud Function. Support two use cases:

- **Announcement slides** (Pre-Service section) — created from an imported PPTX or from uploaded images.
- **Sermon slides** (Message section) — created from an imported PPTX (the pastor's sermon deck).

After this phase: a user can upload a `.pptx`, see it parsed into native slides, and add announcement and sermon sections to a service with those imported slides. Image upload works for announcements.

## Depends On

- **Phase 20** — Service Sections and Slide Auto-Assembly. Consumes the service section model (Pre-Service, Worship, Message, Sending), the slideshow assembly engine that accepts any slide source, and the service element to slide-section binding.

## Requirements

- **R010** — Import pipeline: PPTX parsing via Cloud Function.
- **R011** — Announcement slides (from PPTX or images, in the Pre-Service section).
- **R012** — Sermon slides (from PPTX, in the Message section).

Supporting:

- **R017** — Auto-save on all editing surfaces.
- **R018** — Polished, intuitive UX reusing existing app design patterns.

## Architectural Decisions

### D003 — PowerPoint as universal import format
Support only `.pptx` import; Google Slides and Keynote users export to PowerPoint first.
- **Rationale:** One import pipeline instead of three. Both Google Slides and Keynote have built-in PowerPoint export. Avoids OAuth complexity for the Google Slides API and proprietary protobuf parsing for Keynote.
- **Alternatives considered:** Google Slides URL import via API (requires OAuth, adds complexity for non-technical users); native Keynote parsing (Apple's protobuf schema is undocumented and fragile across versions).

### D004 — Server-side PPTX parsing via Cloud Function
Parse PowerPoint files in a Firebase Cloud Function, not client-side.
- **Rationale:** More reliable extraction, no browser memory constraints, handles edge cases better. "Least amount of hassle, most amount of reliability."
- **Alternatives considered:** Client-side parsing in the browser (no server cost but limited by browser JS capabilities and memory).

## Error Handling Strategy

- **PPTX import failures** — surface a clear error ("We couldn't read this file — try re-exporting from PowerPoint") rather than producing silent broken slides.
- **Never delete the uploaded file until the import is confirmed successful.** The original upload must remain recoverable so a failed parse never loses the user's source deck.
- **Auto-save** applies to the resulting editable slides as with all other editing surfaces (debounced Firestore writes; browser crash or navigation preserves work).

## Risks and Unknowns

- **PPTX parsing fidelity** — extracting text, images, and basic layout reliably from diverse PowerPoint files created by different versions and tools is the central risk of this phase.

## Technical Constraints

- Firebase Storage costs must stay manageable for small churches (imported images fall under the 2-week media retention policy handled in the media lifecycle phase).
- Service sections are added on top of the existing flat, position-based slot array without breaking existing service data.

## Integration Points

- **Firebase Storage** — upload of the source `.pptx` file and of announcement images.
- **Firebase Cloud Functions** — server-side PPTX parsing that converts the uploaded deck into native slide records.
- **Firebase Firestore** — persisting the parsed native slides into the service's Pre-Service (announcements) and Message (sermon) sections.
- Existing Cloud Functions live in `functions/src/index.ts` (ESV proxy, Planning Center integration) — the parsing function is added alongside them.

## Testing Requirements

- Integration tests for the PPTX Cloud Function: real `.pptx` files parsed into native slides.
- Component tests for the import flow and the announcement/sermon slide editors.
- Auto-save verification on the resulting editable slides.

## Open Questions

- **Which PPTX parsing library to use for the Cloud Function** — candidates include `pptx-parser`, `officegen`, `python-pptx` via subprocess, or a similar library. To be resolved during phase research.

## Acceptance

A user can upload a `.pptx` file and see it parsed into editable native slides in the sermon or announcement section. Image upload works for announcements. (M001-CONTEXT, S04.)
