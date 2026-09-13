# Requirements: WorshipPlanner — v2.15 Service Times, Vamps & Field Fixes

**Defined:** 2026-09-09
**Core Value:** Smart weekly service planning that follows the Vertical Worship methodology while rotating
through the full song stable and respecting team configurations.
**Milestone goal:** Give services real rehearsal/report *times* (with org-level defaults) surfaced
everywhere the date already shows, add a keyed **Vamps** library whose mp3 plays live as slide audio,
always link service-update emails to the plan, and fix the deep-link → church-picker bug.

> **Numbering:** continues the project's global `R###` scheme from v2.14 (which ended at R427).
>
> **Scope decisions (owner, 2026-09-09):**
> - **Rehearsals** are modeled as **multiple dated rehearsals** (each its own date + time) per service, plus
>   **one day-of report time**.
> - The **org-level default is time-of-day only** — the planner **dates each rehearsal** on the service; the
>   default supplies the default report time and default rehearsal time(s), not dates (an org default cannot
>   know a future service's date). Defaults are **copied** onto a service at creation, never live-bound.
> - **Times display as the literal entered wall-clock time** (single physical venue) — never zone-shifted per
>   viewer, never stored as a `Timestamp`. Stored as plain `HH:mm` / `YYYY-MM-DD` strings, matching the app's
>   existing `Service.date` convention.
> - A **vamp = one musical key + one MP3** (modeled 1:1 like a Song). Assigning a vamp to a slide **denormalizes
>   its audio URL into the slide's existing `GroupSlideEntry.audioUrl`** (a display-only `vampId` reference is
>   kept for the editor UI) — reusing the shipped per-slide `audioUrl`/`audioLoop`/`AudioPlayer` pipeline, no
>   new render surface.
> - A live vamp is **audible from the Audience output only** — Confidence and Video are muted (a `suppressAudio`
>   prop mirroring the existing `suppressBackground`), to prevent triple-play echo on a single multi-monitor
>   machine.
> - Deleting a vamp assigned to upcoming service slides **warns (shows the count) but is allowed**.
>
> **Research-first pass complete** (`.planning/research/SUMMARY.md`, HIGH confidence): zero new npm
> dependencies; heavy reuse of v2.11 file-upload, the per-slide audio pipeline, the `{{service_link}}` token,
> and the `OrgSettings`/`SettingsView` plumbing. The headline risk is live vamp audio in the multi-monitor Run
> outputs (silent autoplay failure + triple-play echo) — verified on real hardware, not unit tests.

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase (see Traceability).

### Deep-Link / New-Tab Church Fix

- [x] **R428**: A multi-church member who opens a nav link in a **new browser tab** (right-click → open in
  new tab) or follows a deep link into a fresh tab lands on the **intended page**, not the church picker —
  the active church is restored from uid-scoped persistent storage that a genuinely-new tab can read. The
  fix preserves the existing safeguards: the persisted church is honored only if it is still in the user's
  memberships (stale-membership re-validation), it is cleared on sign-out, and it must not leak across
  accounts on a shared computer. Single-church users are unaffected.

### Service Rehearsal & Report Times — Org Defaults

- [x] **R429**: An editor configures **organization-level defaults** on the organization settings page: a
  default **day-of report time** and one or more **default rehearsal time(s)** (time-of-day only). These
  defaults are persisted on the org `settings` and pre-fill new services (see R432).

### Service Rehearsal & Report Times — Per-Service

- [x] **R430**: A planner can add, edit, and remove **multiple rehearsals** on a service, each with its own
  **date and time**, directly in the service editor. Rehearsals display in chronological order regardless of
  entry order.

- [x] **R431**: A planner can set a single **day-of report time** on a service (a wall-clock time on the
  service date), editable in the service editor.

- [x] **R432**: When a service is created, its rehearsal time(s) and report time **pre-fill by copying** the
  org defaults (the planner then dates each rehearsal and can adjust). Changing an org default **never**
  retroactively mutates an existing service.

### Service Rehearsal & Report Times — Display

- [x] **R433**: Everywhere a service's **date** is already shown — the dashboard, My Schedule, the volunteer
  service view, and the share/plan (public) views — the service's **rehearsal times and report time are shown
  alongside the date**. The new fields are threaded through **both** hand-maintained public projections
  (`buildServiceSnapshot` and `buildRehearseAccess`) so volunteer-facing and shared surfaces render the real
  times rather than nothing.

### Service-Update Email Link

- [x] **R434**: Every service-update / order-of-service notification email (including the auto-generated
  re-lock change notice) **includes a working link to the service plan** (the public share link). The share
  link is **guaranteed to exist before the email is sent** (ensured/self-healed if absent), so an update
  email never goes out with an empty or broken plan link.

### Vamps Library

- [x] **R435**: An editor can **create and manage vamps** from a **"Vamps" tab on the Songs page** (a
  `Songs | Vamps` tab bar — per the owner's "Vamps tab in the songs page" and the `Vamps.dc.html` Turn-12
  design), **not** a separate sidebar route. Each vamp has a **name**, a **musical key**, an **optional
  tempo** (freeform, e.g. "68 bpm"), and **one attached MP3** (≤50 MB), uploaded via the shipped
  resumable-upload pipeline into a retention-exempt, org-scoped Storage prefix (`orgs/{orgId}/vamp-files/…`,
  editor-gated in `storage.rules`, structurally exempt from every cleanup sweep). An editor can edit a
  vamp's name/key/tempo, replace/remove its MP3, and delete the vamp. _(Scope refined 2026-09-09 to match
  the owner-supplied design: tab-not-page + optional tempo.)_

- [x] **R436**: The Vamps tab is a **flat, browsable, searchable one-vamp-per-row table** (columns:
  Vamp · Key · Tempo · Audio, searchable by vamp name or key; a "No MP3 attached" warning state), with a
  slide-out editor (Name, Key chip-picker, Tempo, MP3 attach/play/remove, Delete) — built to the imported
  **`Vamps.dc.html`** Claude Design (Turn 12 "one row, one vamp"), mapped to the app's dark gray-950 language
  mirroring the existing Songs table/slide-over components.

### Vamp Slide Assignment & Live Playback

- [ ] **R437**: A planner can **assign a vamp to a slide** in a service. The assignment attaches the vamp's
  audio to that slide (the vamp's `audioUrl` denormalized into the slide's existing per-slide audio field,
  plus a display-only `vampId` so the editor shows which vamp is assigned) and can be cleared/changed.

- [ ] **R438**: When a slide with an assigned vamp is live in **Run the Service**, the vamp **plays and
  loops** until the slide changes or it is cleared, and is **audible only from the computer running the
  service (the Run control window)** — the Audience, Confidence and Video outputs are silent, so a single
  machine driving multiple monitors never triple-plays/echoes the audio. (Owner decision 2026-09-13;
  supersedes the earlier "Audience output only" wording.)

- [ ] **R439**: A projectionist **arms audio** with a gesture on the Run/control screen so a vamp plays from
  that window despite browser autoplay policy; if audio is still blocked, the failure is **surfaced on the
  control screen** as a visible warning (never a silent failure with no on-screen indication).

- [ ] **R440**: Deleting a vamp that is currently **assigned to one or more upcoming services' slides**
  **warns** the editor (showing how many services are affected) but **allows** the deletion; already-assigned
  slides retain their attached audio until re-materialized.

## v2 Requirements

Acknowledged but deferred — not in this milestone's roadmap.

### Rehearsal / Service Location

- **LOC-01**: A rehearsal (and/or the service) carries an optional **location/venue** field shown next to
  its time. (Carried-over open item from v2.12 "venue/call-time card fields") — deferred by owner 2026-09-09
  to keep v2.15 scoped to times only.)

### Times — Extras

- **TIME-EXTRA-01**: Calendar / ICS export of a volunteer's rehearsal + report times.
- **TIME-EXTRA-02**: Per-team / per-role rehearsal-time visibility scoping (Planning Center supports it;
  out of scope here).

- **TIME-EXTRA-03**: Dedicated `{{report_time}}` / `{{rehearsal_dates}}` merge tokens for messaging.

### Vamps — Extras

- **VAMP-EXTRA-01**: Crossfade between consecutive vamps (needs a materially harder dual-audio-source
  architecture; conflicts with the "no new render surface" constraint).

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Rehearsal/service **venue/location** field | Deferred to v2 (LOC-01); v2.15 is times-only per owner decision 2026-09-09 |
| **Multi-key** vamp entries (one vamp holding many keys) | Owner chose one-key-per-vamp (mirrors a Song 1:1); a multi-key entry is an anti-feature for this model |
| **BPM / tempo** metadata on vamps | A vamp is a sustained bed, not a metered loop — models a property the artifact doesn't have (anti-feature) |
| **Crossfade** between vamps | Deferred to v2 (VAMP-EXTRA-01); requires a new dual-source audio architecture |
| Vamp audio on **Confidence / Video** outputs | Owner chose Audience-only to prevent triple-play echo; Video (OBS/vMix) composites its own audio |
| **Auto-notify on every plan edit** | Anti-feature (notification fatigue — Planning Center deliberately avoids it); scope is only guaranteeing the *existing* send carries the plan link |
| **Timezone-shifting** times per viewer | Single-venue model — times display as the literal entered wall-clock value |
| **Per-org storage quota + egress monitoring** | SEED-003 remaining guardrails; owner parked the seed 2026-09-09 (per-file ≤50 MB caps remain the only bound) |
| **Owner admin UI for cost/cleanup knobs** | SEED-001; owner parked the seed 2026-09-09 |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| R428 | Phase 138 | Complete |
| R429 | Phase 139 | Complete |
| R430 | Phase 139 | Complete |
| R431 | Phase 139 | Complete |
| R432 | Phase 139 | Complete |
| R433 | Phase 139 | Complete |
| R434 | Phase 138 | Complete |
| R435 | Phase 140 | Complete |
| R436 | Phase 140 | Complete |
| R437 | Phase 141 | Pending |
| R438 | Phase 141 | Pending |
| R439 | Phase 141 | Pending |
| R440 | Phase 141 | Pending |

**Coverage:**

- v1 requirements: 13 total (R428–R440)
- Mapped to phases: 13 (100%)
- Unmapped: 0

**Phase map:**

- Phase 138 — Field Fixes: Church-Picker Deep-Link & Service-Update Email Link (R428, R434)
- Phase 139 — Rehearsal & Report Times (R429, R430, R431, R432, R433)
- Phase 140 — Vamps Library: CRUD & Storage (R435, R436)
- Phase 141 — Vamp Slide Assignment & Live Playback (R437, R438, R439, R440)

---
*Requirements defined: 2026-09-09*
*Last updated: 2026-09-09 after v2.15 ROADMAP.md creation — 4 phases (138-141), 13/13 requirements mapped*
