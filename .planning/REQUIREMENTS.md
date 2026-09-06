# Requirements: WorshipPlanner — v2.12 Rehearse Mode

**Defined:** 2026-09-05
**Core Value:** Smart weekly service planning that follows the Vertical Worship methodology while rotating
through the full song stable and respecting team configurations.
**Milestone goal:** Give worship volunteers a low-friction, passwordless way to rehearse the services
they're serving — view/print sheet music & chords and play/practice reference recordings — without a new
username/password and without exposing media publicly. Step 2 (final) of the file-storage backlog
(999.13 / SEED-003); step 1 (song attachments) shipped as v2.11.

> **Numbering:** continues the project's global `R###` scheme from v2.11 (which ended at R373).
> **Scope decisions (owner, 2026-09-05):** access = passwordless magic link · landing = a "My Schedule"
> volunteer home (only Planned/locked services) · Rehearse = a **standalone screen** reached only from My
> Schedule (not a service-editor tab) · playback speed + whole-track loop **included** · per-org storage
> quota + egress alerting **deferred** to backlog · **no project-research pass** (SEED-003 + v2.7 research +
> v2.11 validation already cover it). Design reference: the owner's Claude Design project —
> `Rehearsal.dc.html` + `Volunteer Home.dc.html` (Nocturne palette → app dark gray-950).

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase (see Traceability).

### Passwordless Volunteer Access

- [ ] **R374**: A volunteer can sign in without a password via a Firebase email-link (`signInWithEmailLink`)
  tied to their roster email — request/receive a link, click it, and be signed in with no password to set
  or remember.
- [ ] **R375**: The magic sign-in link is delivered through the existing v1.7 volunteer-messaging emails
  (reminder / share), so a rostered volunteer reaches My Schedule in one click from the email they already
  get. (Only the link-delivery channel is reused; no new email system.)
- [ ] **R376**: A signed-in volunteer's session persists across browser refresh, they can sign out, and
  their playback position + their own downloads are attributed to their identity.
- [ ] **R377**: Magic-link volunteer access is **read-only and scoped** — it grants read access only to the
  volunteer's own org's Planned services they are assigned to (songs + their v2.11 attachments), and never
  to the planner/editor surfaces, another org's data, or Draft services. (Security-critical — enforced at
  the data layer, not just the UI; carries a threat model + rules/isolation tests.)

### My Schedule (Volunteer Home)

- [ ] **R378**: After sign-in a volunteer lands on **"My Schedule"**, a read-and-go page listing every
  service they are assigned to, matched by their roster email → role assignment. Available to anyone assigned
  to a service (keyed off assignment, not role).
- [ ] **R379**: My Schedule shows **only Planned (locked, non-Draft) services** — a service still being
  drafted by a planner never appears to volunteers (reuses the app's existing not-Draft / lock gate).
- [ ] **R380**: Services are ordered soonest-first and grouped **This week / Later this month**, with a
  "Next up" badge on the soonest upcoming service; past services the volunteer served are shown separately
  and remain openable.
- [ ] **R381**: Each service card shows the date, service name, time · venue, the volunteer's own **role
  chips**, song / chart / track counts, a **readiness** indicator (all rehearsal files ready · N songs still
  missing media · waiting on charts), and a countdown + call time.
- [ ] **R382**: Each upcoming card's **Rehearse →** action opens that service's standalone Rehearse screen;
  a past card offers a read/open action instead. My Schedule itself is not editable.
- [ ] **R383**: My Schedule surfaces a "check a different email" affordance and, when a signed-in email
  matches no assignment, an empty state explaining the list is built from roster assignments and how to be
  added.

### Rehearse Screen (Standalone, per service)

- [ ] **R384**: Rehearse is its **own standalone screen reached only from a My Schedule service card** — it
  is **not** a tab inside the planner's service editor, and a volunteer never sees the Service Order /
  Slides / Roles / Stage Layout editor.
- [ ] **R385**: The Rehearse screen lists the songs in that service (with each song's key, PDF count, MP3
  count, and a now-playing indicator) and lets the volunteer select a song to see its media.
- [ ] **R386**: A selected song's detail lists its **Sheet music & chords** (PDF attachments) with per-file
  **Print** and **Download**, its **Recordings** (MP3 attachments), and an optional per-song note — all
  sourced from the v2.11 song attachments (nothing is uploaded on this screen).
- [ ] **R387**: A PDF reader displays the selected chart with page navigation (Page X of Y, prev/next) and a
  **Print** action.
- [ ] **R388**: An audio player plays a selected recording with play/pause, a seekable progress bar, and
  elapsed / total time.
- [ ] **R389**: The audio player supports whole-track **playback speed** (1× / 0.9× / 0.75× / 1.25×) and a
  whole-track **Loop** toggle.
- [ ] **R390**: External media links (YouTube / Google Drive / Dropbox) attached to a song in v2.11 are
  openable from the Rehearse screen, opening in a new tab (no in-app embedding required).

### Delivery Quality

- [ ] **R391**: My Schedule and the Rehearse screen are mobile-friendly — PDFs open/download reliably on
  phones (link-first, with an inline `<iframe>` viewer as a desktop enhancement) and audio plays on mobile.

## Future Requirements

Deferred to a later milestone. Tracked, not in this roadmap.

### Cost Guardrails (deferred by owner, 2026-09-05 → backlog)

- **RQ-QUOTA**: Per-org storage quota (e.g. ~10 GB) enforced at upload, the real cost lever a paid add-on
  would sell "more of." (v2.11 per-file caps remain the only bound this milestone.)
- **RQ-EGRESS**: Egress / billing budget alerting so an abusive church or a runaway download pattern
  surfaces before the bill does.

### Volunteer self-service extras

- **RQ-ANNOT**: Per-volunteer practice notes / annotations on a chart.
- **RQ-CALSYNC**: Add an assigned service to the volunteer's calendar from My Schedule.

## Out of Scope

Explicitly excluded for this milestone.

| Feature | Reason |
|---------|--------|
| Public / anonymous access to rehearse media | Owner decision — access is passwordless-but-authenticated (magic link); avoids the anonymous hotlinking/scraping cost+security risk SEED-003 flags. |
| Per-org storage quota + egress monitoring | Deferred to backlog (owner, 2026-09-05); v2.11 per-file caps stand. |
| Server-side audio transposition (change key) | SEED-003 anti-feature — biggest scope-creep risk; native `<audio>` only. |
| Loop-a-section / A–B loop | Whole-track loop only this milestone (SEED-003 anti-feature). |
| Image / uploaded-video attachment types | Out of the v2.11 attachment model; video enters only as an external link. |
| Volunteers editing services, songs, or attachments | Volunteer surface is strictly read-and-rehearse. |
| A Rehearse tab inside the planner's service editor | Rehearse is a standalone volunteer screen (owner decision) — reached only from My Schedule. |

## Traceability

Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| R374 | TBD | Pending |
| R375 | TBD | Pending |
| R376 | TBD | Pending |
| R377 | TBD | Pending |
| R378 | TBD | Pending |
| R379 | TBD | Pending |
| R380 | TBD | Pending |
| R381 | TBD | Pending |
| R382 | TBD | Pending |
| R383 | TBD | Pending |
| R384 | TBD | Pending |
| R385 | TBD | Pending |
| R386 | TBD | Pending |
| R387 | TBD | Pending |
| R388 | TBD | Pending |
| R389 | TBD | Pending |
| R390 | TBD | Pending |
| R391 | TBD | Pending |

**Coverage:**
- v1 requirements: 18 total (R374–R391)
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 18 ⚠️

---
*Requirements defined: 2026-09-05 — milestone v2.12 Rehearse Mode*
