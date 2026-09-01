# Requirements: WorshipPlanner — v2.7 Rehearsal, Stage Plans & Presentation Polish

**Defined:** 2026-09-01
**Core Value:** Smart weekly service planning that follows the Vertical Worship methodology while rotating through the full song stable and respecting team configurations.

Milestone scope: six in-scope features (the storage/rehearsal cluster was deferred out of v2.7 — see
Out of Scope / Deferred and `seeds/SEED-003-rehearsal-attachments-and-storage-costs.md`). Zero new npm
dependencies; every feature reuses an existing pattern. REQ-IDs continue from v2.6 (last was R301).

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase.

### Lyric Authoring — inline black slide

- [ ] **R302**: From the Song Lyrics editor, a user can insert an inline **black (blackout) slide**
  between a song's lyric slides to mark an instrumental/interlude, without creating a new blank service
  section.
- [ ] **R303**: A black slide renders as a full black screen — no lyrics, no background image, no
  organizational labels — on the Audience output, the Confidence monitor, the in-app preview, and
  print/export, and it participates in normal slide navigation.
- [ ] **R304**: Adding, moving, duplicating, or deleting a black slide does not corrupt song section
  numbering, the split-section-as-one-unit behavior, or the slide↔service-order mirroring.

### Live Presentation — blackout scoping & looping

- [ ] **R305**: Pressing **"Go to black"** blacks out **only the Audience output**; the Confidence
  monitor keeps showing the current/upcoming slide.
- [ ] **R306**: A user can mark a service item as **looping** (a per-item checkbox in the editor) so
  that, during Run, that item's slides auto-advance and loop back to the item's first slide.
- [ ] **R307**: A looping item auto-advances on a **configurable interval, defaulting to 10 seconds**,
  chosen from a dropdown of preset intervals with an option to enter a custom value; the interval
  persists with the item.
- [ ] **R308**: Auto-advance never fights manual navigation and tears down correctly — it stops/pauses
  cleanly when the operator navigates to a different item, leaves the Run screen, or triggers
  "Go to black" (exact blackout-vs-loop interaction decided at plan time), with no leaked timers or
  control↔output desync.

### Notifications — system-wide dismissible messages

- [ ] **R309**: Every warning/error/info message surfaced in the app can be **manually dismissed** by
  the user, through one shared notification system — no message can get permanently stuck on screen.
- [ ] **R310**: A message tied to a condition **auto-clears when that condition resolves**; specifically,
  the Run screen's "monitors not configured" warning disappears automatically once monitors are
  configured, and is manually dismissible in the meantime.

### Multi-Org — church switcher

- [ ] **R311**: A user who belongs to **multiple churches** can switch their active church from the
  **top-bar user menu**, without signing out, using the existing multi-org membership path (distinct
  from the super-admin "enter any church" path).
- [ ] **R312**: Switching active church **fully resets org-scoped app state** (no stale data from the
  previous church across any store, including stores added this milestone) and reflects the user's role
  in the newly selected church.

### Stage Layout — visual per-service stage plot

- [ ] **R313**: On a dedicated **Stage Layout tab** of a service, a user can place labeled markers
  (instruments, mics, monitors) on a freeform canvas via drag-and-drop, with **on-stage and off-stage
  (side) zones**.
- [ ] **R314**: Markers support **free-text labels** and can be positioned anywhere within a zone,
  including a marker for a **one-off speaker's microphone**; positions round-trip on reload and stay
  stable across viewport resize.
- [ ] **R315**: The stage layout is **saved per service** (persisted to Firestore, no file storage) and
  is viewable **read-only** where the service is shared/printed, so tech/sound can reference the setup.

## v2 Requirements (Future)

Deferred to future releases. Tracked, not in this roadmap.

### Rehearsal & media (deferred out of v2.7 — see SEED-003 / backlog 999.13)

- **REHEARSE-01**: Attach PDF chord charts/sheet music, MP3 practice tracks, and YouTube links to a Song
  (reusable across services).
- **REHEARSE-02**: A Rehearse view (per song) to play the MP3 / YouTube and open the PDF, for volunteers
  to practice their part.
- **REHEARSE-03**: Volunteers find the service where they're serving and open its rehearse view
  (leaning: require volunteer login rather than a public link — see SEED-003 cost/security analysis).

## Out of Scope

Explicitly excluded from v2.7. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Song rehearsal attachments (PDF/MP3/YouTube) + public/authenticated Rehearse mode | Deferred by owner 2026-08-31 to its own milestone — highest-risk area (unauthenticated Storage reads, egress cost, storage-rules emulator blind spot). Full research + cost model in `seeds/SEED-003-*`. |
| Server-side audio transposition / playback-speed / loop-a-section in rehearsal | Biggest scope-creep risk per FEATURES.md; a later-iteration item, not part of the deferred cluster's first version either. |
| New npm dependencies for any v2.7 feature | Research (STACK.md) confirmed native browser APIs + existing patterns cover all six features; adding a drag/toast/PDF lib is unwarranted. |
| Constrained equipment-icon library for the stage plot | Free-text labeled markers are what actually support the one-off-speaker-mic case for a single known venue; an icon library is overkill. |

## Traceability

Which phases cover which requirements. Filled in during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| R302 | TBD | Pending |
| R303 | TBD | Pending |
| R304 | TBD | Pending |
| R305 | TBD | Pending |
| R306 | TBD | Pending |
| R307 | TBD | Pending |
| R308 | TBD | Pending |
| R309 | TBD | Pending |
| R310 | TBD | Pending |
| R311 | TBD | Pending |
| R312 | TBD | Pending |
| R313 | TBD | Pending |
| R314 | TBD | Pending |
| R315 | TBD | Pending |
