# Requirements: WorshipPlanner — Milestone v2.11

**Milestone:** v2.11 — Song File Attachments
**Defined:** 2026-09-05
**Goal:** Let editors attach and manage documents (PDF) and audio (MP3) files — plus external media
links (YouTube/Drive/Dropbox) — on a **Song** in the stable, via a new **Files** tab in the Edit Song
slideout, laying the durable storage foundation for the future team-rehearsal experience.

> **Scope decisions (locked at milestone start, owner-confirmed 2026-09-05):**
> - **This is step 1** of the file-storage backlog (999.13 / SEED-003). It builds only the
>   **editor-facing attach/manage** surface. The **Rehearse experience** (volunteers playing/viewing
>   attachments inside a shared or authenticated service) is a **separate, later milestone**.
> - **Uploads are PDF + MP3 only**, **≤ 50 MB per file**. **No image or uploaded-video types** — video
>   is supported only as an **external link**. (Narrower than the owner's mock, which showed MP4/JPG/PNG;
>   trimmed on the owner's call to keep the storage/egress surface small.)
> - **Files attach to the Song**, not to a service, so they follow the song into every service that uses
>   it (which is exactly what the future Rehearsal tab will read).
> - **Permanence is a load-bearing invariant** (owner, 2026-09-05): *"Songs are a permanent part of a
>   church's collection."* Song attachments must **never** be deleted by any automated media/storage
>   retention sweep. The retention crons exist only for **transient, service-specific** media.
> - **Per-file caps only** this milestone. The **per-org storage quota** and **egress monitoring/
>   alerting** recommended by SEED-003 are **deferred to the Rehearse milestone** (the streaming/read
>   side, where egress actually accrues).
> - **In-app PDF preview + MP3 player are in scope** now (per the mock).
> - **No research pass** — built on SEED-003's architecture + cost research (download-token URLs,
>   org-scoped non-`media/` path, the `firestore.exists()`-in-Storage-emulator blind spot, and reuse of
>   the existing `useMediaUpload`/`useBackgroundUpload` `uploadBytesResumable` + `MEDIA_MAX_BYTES` cap
>   patterns).
> - **Design reference:** the owner's "Song Files" mock in the *Worship Planner Slideshow Design* Claude
>   Design project (Nocturne palette) — mapped to the app's own dark gray-950 design language.

---

## v2.11 Requirements

### Files Tab & Song-List Surface

- [x] **R361**: The Edit Song slideout gains a third tab, **Files**, beside Details and Lyrics, showing a
  live count badge of the number of attachments on the song.

- [x] **R362**: The Songs list gains a **Files** column showing a paperclip icon and the attachment count
  ("N files", or "none" when empty) for each song.

### Upload & Attach

- [x] **R363**: An editor can upload **several files at once** to a song by drag-and-drop onto a drop zone
  or by click-to-browse, with **per-file upload progress** shown while each transfers.

- [x] **R364**: Uploads are restricted to **PDF (documents)** and **MP3 (audio)**, **≤ 50 MB per file**.
  The type and size limits are enforced **both client-side** (clear rejection message before/at upload)
  **and in `storage.rules`** (server-authoritative), so an oversized or disallowed file cannot be written
  even by bypassing the UI.

- [x] **R365**: An editor can attach an **external media link** (YouTube / Google Drive / Dropbox) to a
  song instead of uploading; the link is stored as metadata (no file transfer) and **opens in a new tab**
  rather than the built-in reader/player.

### File List, Preview & Management

- [x] **R366**: Attachments are shown grouped into **Documents** and **Audio** sections, each row showing
  the file's icon, name, and metadata (type · pages-or-duration · size · date), with a per-group empty
  state when a group has no files.

- [ ] **R367**: An editor can **preview a PDF** and **play an MP3 in-app** from its row (an inline reader /
  audio player), without leaving the Files tab. Externally-linked media instead opens in a new tab (R365).

- [x] **R368**: An editor can **download** any attachment and **remove** any attachment from its row.
  Removal deletes the file from the song **everywhere it appears** — including past services that used the
  song — and the UI makes that consequence clear before/at removal.

### Durable, Retention-Exempt Storage (Invariant)

- [x] **R369**: Attachment records live on the **Song document** (additive schema, **no migration** of
  existing songs), and uploaded bytes live under a **dedicated org-scoped Storage prefix outside `media/`**
  (e.g. `orgs/{orgId}/song-files/…`). Org members' read/write access to that prefix is granted in
  `storage.rules` mirroring the existing `orgs/{orgId}/…` member rule, with the R364 size cap applied.

- [x] **R370**: Song attachments are **exempt from every automated retention/cleanup sweep**. Each existing
  cleanup Cloud Function — `cleanupExpiredMedia`, `cleanupOrphanBackgrounds`, and `cleanupPptxSources` — is
  verified to **exclude** the song-files prefix, and a check/test proves none of them can reach or delete a
  song attachment. (A future edit to any sweep must not be able to silently start deleting song files.)

- [x] **R371**: A song attachment is deleted **only** by an explicit editor removal (R368) or by the song
  itself being deleted; no service operation (including deleting a service that used the song) removes or
  orphans a song's attachments, and the attachment survives indefinitely otherwise.

### Access Control & Design Fidelity

- [x] **R372**: Only **editors** can upload, link, or remove song attachments; **viewers** can see the
  Files tab/column as read-only and cannot mutate attachments — enforced in the UI **and** in
  `storage.rules`/Firestore rules.

- [x] **R373**: The Files tab and Songs-list Files column are implemented to the owner's approved "Song
  Files" mock, **mapped to the app's existing dark gray-950 design language** (not the raw Nocturne
  palette), consistent with the current Edit Song slideout, Details, and Lyrics tabs. An app-fidelity
  design/UI spec is produced before implementation.

---

## Future Requirements (deferred — next / later milestone)

- **Rehearse mode** — volunteers play the attached MP3 / view the PDF / open the linked media for the
  service they are serving, inside the shared (public or authenticated) service link. This is the read/
  streaming side and the driver for the whole cluster; deferred to its own milestone (backlog 999.13).

- **Per-org storage quota** (~10 GB) enforced at upload time, and **egress monitoring / budget alerting** —
  deferred with the Rehearse (streaming) milestone, where egress cost actually accrues.

- **Download-token URL / signed-URL read path** for anonymous playback on the public share page — a
  Rehearse-mode concern (this milestone's readers are authenticated org members).

- **Image and uploaded-video attachment types** (JPG/PNG/MP4) — trimmed from this milestone to hold down
  the storage/egress surface; revisit only with quotas + egress controls in place.

- **Per-file "share with volunteers" toggle** — the mock's underlying `shared` flag; a Rehearse-mode
  affordance (control which attachments volunteers see), deferred with Rehearse.

- **Additional document/audio formats** (e.g. m4a, wav, docx) — hold to PDF + MP3 until there is demand.

## Out of Scope (this milestone)

- Any playback/preview on the **public share page** — the share page is not touched this milestone.
- Server-side audio processing (transposition, tempo/pitch shift, loop-a-section) — an explicit
  anti-feature from SEED-003 / FEATURES.md; never in this cluster's v1.

- Cross-service or per-arrangement attachment scoping — attachments are on the Song, full stop.
- Migrating or backfilling any existing data — the schema addition is additive and lazy.

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| R361 | Phase 123 | Complete |
| R362 | Phase 123 | Complete |
| R363 | Phase 123 | Complete |
| R364 | Phase 122 | Complete |
| R365 | Phase 123 | Complete |
| R366 | Phase 124 | Complete |
| R367 | Phase 124 | Pending |
| R368 | Phase 124 | Complete |
| R369 | Phase 122 | Complete |
| R370 | Phase 122 | Complete |
| R371 | Phase 122 | Complete |
| R372 | Phase 122 | Complete |
| R373 | Phase 121 | Complete |

**Coverage: 13 v2.11 requirements (R361–R373) — 100% mapped, 0 orphaned.**
