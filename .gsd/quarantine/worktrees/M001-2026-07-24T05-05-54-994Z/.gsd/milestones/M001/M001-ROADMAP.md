# M001: Worship Service Slide Management

**Vision:** A full slide management system for worship services — lyrics, scripture, imported presentations, and media — that auto-assembles from the service order and is approachable for non-technical church volunteers

## Success Criteria

- A volunteer can paste lyrics from SongSelect, build the performance order, add the song to a service, import a sermon PowerPoint, and preview the complete slideshow end to end
- Reordering service elements causes the slideshow to automatically reorder without manual intervention
- Media (audio/video) auto-plays in the presentation preview when advancing to a media slide
- A PPTX file uploaded through the import flow is correctly parsed by the Cloud Function and appears as editable native slides
- The slide editor is polished and intuitive enough for a non-technical volunteer to use on first attempt without training

## Slices

- [ ] **S01: Song Lyric Slides and Editor** `risk:high` `depends:[]`
  > After this: Paste CCLI lyrics, see auto-split slides with copyright, arrange performance order with repeats, edit and revert with auto-save

- [ ] **S02: Scripture and Congregational Reading Slides** `risk:medium` `depends:[S01]`
  > After this: Enter a scripture reference, see auto-pulled ESV text split into slides; toggle congregational mode with Leader/Congregation labels; manually override auto-generated slides

- [ ] **S03: Service Sections and Slide Auto-Assembly** `risk:high` `depends:[S01,S02]`
  > After this: Create a service with Pre-Service/Worship/Message/Sending sections, add songs and scripture, see slideshow auto-assemble; reorder elements and watch slides follow

- [ ] **S04: PowerPoint Import for Announcements and Sermon** `risk:medium` `depends:[S03]`
  > After this: Upload a .pptx file, see it parsed into native slides; add announcement and sermon sections to a service with imported slides

- [ ] **S05: Media Attachments and Storage Lifecycle** `risk:medium` `depends:[S01]`
  > After this: Attach MP3 or video to a slide, see it auto-play in the editor preview; verify 2-week cleanup policy works on old media

- [ ] **S06: Presentation Preview Mode** `risk:low` `depends:[S03,S05]`
  > After this: Open full-screen preview of a complete service slideshow, advance through all slide types with media playback working

## Boundary Map

### S01 → S02\n\nProduces:\n- Unified slide data model (Firestore schema) with content-kind field\n- Slide CRUD operations and Pinia store\n- Auto-save infrastructure (debounced Firestore writes)\n\nConsumes:\n- nothing (first slice)\n\n### S01 → S03\n\nProduces:\n- Song lyric slide sequences stored per-song in catalog (live reference target)\n- Slide rendering components for lyric content type\n\nConsumes:\n- nothing (first slice)\n\n### S01 → S05\n\nProduces:\n- Unified slide data model with media attachment fields (audioUrl, videoUrl)\n- Slide editor component with attachment UI hooks\n\nConsumes:\n- nothing (first slice)\n\n### S02 → S03\n\nProduces:\n- Scripture slide generation from ESV API with auto-split\n- Congregational reading slide variant\n\nConsumes:\n- Unified slide model and CRUD operations from S01\n\n### S03 → S04\n\nProduces:\n- Service section model (Pre-Service, Worship, Message, Sending)\n- Slideshow assembly engine that accepts any slide source\n- Service element → slide section binding\n\nConsumes:\n- Song lyric slides from S01 (live catalog references)\n- Scripture slides from S02\n\n### S03 → S06\n\nProduces:\n- Assembled slideshow (ordered array of slides from all sources)\n- Service-to-slideshow binding that auto-updates on reorder\n\nConsumes:\n- Song and scripture slides from S01, S02\n\n### S05 → S06\n\nProduces:\n- Media attachment data (Firebase Storage URLs) on slides\n- Audio/video playback components with auto-play behavior\n\nConsumes:\n- Unified slide model from S01
