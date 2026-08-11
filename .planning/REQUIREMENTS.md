# Requirements: WorshipPlanner v1.6 "Editing Reliability & Song Slides"

**Defined:** 2026-08-11
**Core Value:** Smart weekly service planning that follows the Vertical Worship methodology (1→2→3 song
progression) while rotating through the full song stable and respecting team configurations.

**Milestone goal:** Fix the drag-and-drop corruption that plagues both the default template and real
service plans, move the service template to where it is actually used, and make song-slide editing
intuitive for a non-technical user — plus item-editing and preview polish.

**Numbering:** continues from v1.5 (R073–R109). v1.6 owns **R110–R126**.

**Research basis:** none — research was skipped for this milestone (mostly bug-fixes and UI on patterns
already in the codebase; the drag-and-drop root cause is best isolated by reading the actual reorder
handlers during phase planning). The v1.4 research already located the reordering machinery's fragility
(`ServiceEditorView.vue` Sortable `onEnd` and the `SlideGrid.vue` copy) — see STATE.md §"v1.4 RESEARCH
FINDINGS".

---

## v1.6 Requirements

### Service Order Editing Reliability

> The drag-and-drop reordering machinery — the same `ServiceEditorView.vue` / `SlideGrid.vue` Sortable
> handlers flagged fragile in v1.4 — corrupts state on cross-section drags. All three symptoms clear on
> a page refresh, which points at a client-state / persisted-state desync, not lost data. **Sequenced
> as the first phase** (owner instruction, 2026-08-11): it blocks trust in every other editing surface.

- [x] **R110**: Dragging a service item into a section places exactly one item in that section and
      leaves no phantom duplicate — proven in **both** the default-template editor **and** the live
      service plan. Today a drag spawns a second, undeletable copy stuck at "No Section" while the real
      item shows the target section.

- [x] **R111**: Moving an item that is in a section back to "No Section" via the section dropdown saves
      successfully, with no save error.

- [x] **R112**: The Services listing page and the public share link show every service item in the same
      order as the service edit screen, **including items with an empty body** (e.g. two blank
      Miscellaneous items). Today an empty-bodied item sorts to the bottom until text is typed into it.

### Default Service Template

- [x] **R113**: The default-service-template editor is reached from the **Services page** via a
      cog/settings control, and is no longer presented on the main Settings page.

- [x] **R114**: The template's seed-order button is labelled **"Suggested Template"**, is shown
      regardless of whether Vertical Worship mode is on, and carries no dependence on the 1-2-3
      progression in its label or availability.

- [x] **R115**: Every newly created service starts from the org's Suggested Template; there is no
      blank-template starting path. (When Vertical Worship mode is on, the template's song slots still
      receive their required VW types, as established in v1.5.)

- [x] **R116**: A Miscellaneous item added **inside the template** exposes its body input box, so an org
      can pre-fill recurring content (canned music, standing announcement slides) into the default.

### Song Lyric Editing

> Goal, stated by the owner: make song editing as intuitive and easy as possible for a user who may not
> be overly technical.

- [x] **R117**: Any song lyric item (verse, chorus, pre-chorus, etc.) can be **split into multiple
      slides**, with the user manually choosing which lines land on each slide (e.g. an 8-line chorus
      divided into two 4-line slides).

- [ ] **R118**: **Duplicating** a song item that has been split into multiple slides duplicates the
      whole multi-slide unit together, not a single slide.

- [x] **R119**: **Pre-Chorus** is available as an addable song lyric item type alongside Verse and
      Chorus.

- [x] **R120**: Song lyric sections are numbered by their **position** among sections of the same kind:
      the first verse is "Verse 1", a verse added after two existing verses is "Verse 3", and the second
      slide of a split "Verse 1" is still "Verse 1". No section is left unnumbered.

- [x] **R121**: On a brand-new song being given lyrics for the first time, the paste-lyrics commit
      button reads **"Save"** (not "Replace Lyrics"); the existing helper text already notes that it
      replaces lyrics.

### Service Item Enhancements

- [ ] **R122**: Every service item exposes a **notes field beside its selector** (song selector,
      scripture selector, etc.) for recording who leads the item or who sings which parts. The selector
      and notes sit side-by-side on desktop and stack on small screens, with a consistent layout across
      item types.

- [ ] **R123**: Miscellaneous service items **default to no slides**. Slides can still be added to a
      Miscellaneous item when the user chooses.

### Preview & Export Polish

- [ ] **R124**: The slideshow preview **no longer auto-appends the Bible version** (ESV/NLT) to
      scripture slides. The version can still be added to a slide manually if desired.

- [ ] **R125**: The Planning Center export shows a **spinner / in-progress indicator** while the export
      is running, so the user can see it is working.

### Slide Fonts

- [ ] **R126**: **Roboto** is available as a curated, self-hosted slide font in the typography picker.
      (Inter already ships from v1.5's font set — this requirement adds Roboto and confirms Inter
      remains.)

## Future Requirements

Deferred; tracked but not in this milestone's roadmap.

- **Backlog 999.1**: Extract a shared song-browse component used by both the Songs page and the
  service-plan picker.

- **Backlog 999.2**: Clearing a song should clear its slides, even when the song is reprised.
- **Backlog 999.3**: Confirm the production draft lock by hand and deploy `firestore.rules` (deploy is
  the owner's step).

- **AI-assisted slide split**: automatically proposing where to break a long section into slides. v1.6's
  split (R117) is manual only.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| AI auto-splitting of song slides | v1.6's split (R117) is deliberately manual — the user decides the break points; auto-split is a later, AI-gated enhancement |
| Rich-text / formatting in the item notes field | R122 is a plain-text input for leader/parts notes; formatting is unneeded and out of scope |
| Per-slide font overrides | Font family/weight/size remains one setting for all slides (v1.5 owner decision); R126 only widens the font list |
| Migrating existing HYMN service slots to SONG | Unchanged from v1.5 — HYMN carries free-text fields SONG cannot represent losslessly |
| Editing imported PowerPoint slide *content* in-app | Unchanged from v1.5 — PPTX is rendered server-side to images for fidelity; correcting a deck means re-importing |
| Runtime Google Fonts API for slide fonts | Unchanged from v1.5 — a projector without internet at service time cannot fetch a remote font; curated self-hosted woff2 only |

## Traceability

Which phases cover which requirements. Filled during roadmap creation (2026-08-11).

| Requirement | Phase | Status |
|-------------|-------|--------|
| R110 | Phase 51 — Service Order Editing Reliability | Complete |
| R111 | Phase 51 — Service Order Editing Reliability | Complete |
| R112 | Phase 51 — Service Order Editing Reliability | Complete |
| R113 | Phase 52 — Default Service Template | Complete |
| R114 | Phase 52 — Default Service Template | Complete |
| R115 | Phase 52 — Default Service Template | Complete |
| R116 | Phase 52 — Default Service Template | Complete |
| R117 | Phase 53 — Song Lyric Editing | Complete |
| R118 | Phase 53 — Song Lyric Editing | Pending |
| R119 | Phase 53 — Song Lyric Editing | Complete |
| R120 | Phase 53 — Song Lyric Editing | Complete |
| R121 | Phase 53 — Song Lyric Editing | Complete |
| R122 | Phase 54 — Service Item Enhancements | Pending |
| R123 | Phase 54 — Service Item Enhancements | Pending |
| R124 | Phase 55 — Preview & Export Polish | Pending |
| R125 | Phase 55 — Preview & Export Polish | Pending |
| R126 | Phase 55 — Preview & Export Polish | Pending |

**Coverage:**

- v1.6 requirements: 17 total (R110–R126)
- Mapped to phases: 17 (Phases 51–55)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-11 at the start of milestone v1.6*
*Last updated: 2026-08-11 — roadmap created, traceability filled (17/17 mapped to Phases 51–55)*
