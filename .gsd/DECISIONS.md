# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? | Made By |
|---|------|-------|----------|--------|-----------|------------|---------|
| D001 |  | architecture | Slide data model structure | Unified slide type with content-kind field (lyric, scripture, image, video, text) rather than distinct types per content | Simpler for the editor, reordering, and user mental model. One slide is one slide regardless of content. Avoids multiplying UI components for each content type. | Yes | collaborative |
| D002 |  | architecture | Song lyric versioning strategy | Single canonical version per song in catalog; services reference live, not as copies | Eliminates the wrong-slides-at-rehearsal problem from juggling multiple ProPresenter versions. Edit once, every service sees the update. User explicitly rejected per-service copies based on real-world pain. | Yes | human |
| D003 |  | architecture | Slide import format support | PowerPoint (.pptx) as the universal import format; Google Slides and Keynote users export to PowerPoint first | One import pipeline instead of three. Both Google Slides and Keynote have built-in PowerPoint export. Avoids OAuth complexity for Google Slides API and proprietary protobuf parsing for Keynote. | Yes | human |
| D004 |  | architecture | PPTX parsing execution environment | Server-side parsing via Firebase Cloud Function | More reliable extraction, no browser memory constraints, handles edge cases better. User priority: least hassle, most reliability. | Yes | human |
| D005 |  | architecture | Service order structure | Four formalized named sections (Pre-Service, Worship, Message, Sending) as default service structure | Gives lay users a clear template rather than a blank canvas. Makes slide auto-assembly deterministic. Starting with structure is better for non-technical users; can be made configurable later. | Yes | collaborative |
| D006 |  | architecture | Song lyric input method | Manual copy/paste from CCLI SongSelect with auto-parsing of section markers | CCLI does not allow API access to anyone. The paste format has reliable section markers (Verse, Chorus, Bridge, etc.) that enable auto-splitting into slides. | Yes | human |
