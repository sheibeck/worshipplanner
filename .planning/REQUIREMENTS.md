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
> volunteer home (only Planned/locked services) · the volunteer service view = a **standalone, read-only
> view** reached only from My Schedule (NOT the planner editor) with **Rehearse + Order of Service + Stage
> Layout** tabs, since tech-team members are volunteers too · playback speed + whole-track loop **included** · per-org storage
> quota + egress alerting **deferred** to backlog · **no project-research pass** (SEED-003 + v2.7 research +
> v2.11 validation already cover it). Design reference: the owner's Claude Design project —
> `Rehearsal.dc.html` + `Volunteer Home.dc.html` (Nocturne palette → app dark gray-950).

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase (see Traceability).

### Passwordless Volunteer Access

- [x] **R374**: A volunteer can sign in without a password via a Firebase email-link (`signInWithEmailLink`)
  tied to their roster email — request/receive a link, click it, and be signed in with no password to set
  or remember.

- [x] **R375**: The magic sign-in link is delivered through the existing v1.7 volunteer-messaging emails
  (reminder / share), so a rostered volunteer reaches My Schedule in one click from the email they already
  get. (Only the link-delivery channel is reused; no new email system.)

- [x] **R376**: A signed-in volunteer's session persists across browser refresh, they can sign out, and
  their playback position + their own downloads are attributed to their identity.

- [x] **R377**: Magic-link volunteer access is **read-only and scoped** — it grants read access only to the
  volunteer's own org's Planned services they are assigned to (songs + their v2.11 attachments), and never
  to the planner/editor surfaces, another org's data, or Draft services. (Security-critical — enforced at
  the data layer, not just the UI; carries a threat model + rules/isolation tests.)

### My Schedule (Volunteer Home)

- [x] **R378**: After sign-in a volunteer lands on **"My Schedule"**, a read-and-go page listing every
  service they are assigned to, matched by their roster email → role assignment. Available to anyone assigned
  to a service (keyed off assignment, not role).

- [x] **R379**: My Schedule shows **only Planned (locked, non-Draft) services** — a service still being
  drafted by a planner never appears to volunteers (reuses the app's existing not-Draft / lock gate).

- [x] **R380**: Services are ordered soonest-first and grouped **This week / Later this month**, with a
  "Next up" badge on the soonest upcoming service; past services the volunteer served are shown separately
  and remain openable.

- [x] **R381**: Each service card shows the date, service name, time · venue, the volunteer's own **role
  chips**, song / chart / track counts, a **readiness** indicator (all rehearsal files ready · N songs still
  missing media · waiting on charts), and a countdown + call time.

- [x] **R382**: Each upcoming card's **Rehearse →** action opens that service's standalone Rehearse screen;
  a past card offers a read/open action instead. My Schedule itself is not editable.

- [x] **R383**: My Schedule surfaces a "check a different email" affordance and, when a signed-in email
  matches no assignment, an empty state explaining the list is built from roster assignments and how to be
  added.

### Volunteer Service View (Standalone, read-only, per service)

- [ ] **R384**: Opening a service from My Schedule opens a **standalone, read-only volunteer service view** —
  **not** the planner's `ServiceEditorView` (a volunteer never sees the editing UI, drafts, slide editing, or
  messaging). It carries the views a serving volunteer needs as tabs — **Rehearse** (default) · **Order of
  Service** · **Stage Layout** — because tech-team members are volunteers too; it is composed from the
  existing read-only renderers (ShareView snapshot + the v2.7 read-only order/stage renders), not by forking
  the editor.

- [x] **R385**: The **Rehearse** tab lists the songs in that service (with each song's key, PDF count, MP3
  count, and a now-playing indicator) and lets the volunteer select a song to see its media.

- [x] **R386**: A selected song's detail lists its **Sheet music & chords** (PDF attachments) with per-file
  **Print** and **Download**, its **Recordings** (MP3 attachments), and an optional per-song note — all
  sourced from the v2.11 song attachments (nothing is uploaded on this screen).

- [ ] **R387**: A PDF reader displays the selected chart with page navigation (Page X of Y, prev/next) and a
  **Print** action.

- [ ] **R388**: An audio player plays a selected recording with play/pause, a seekable progress bar, and
  elapsed / total time.

- [ ] **R389**: The audio player supports whole-track **playback speed** (1× / 0.9× / 0.75× / 1.25×) and a
  whole-track **Loop** toggle.

- [x] **R390**: External media links (YouTube / Google Drive / Dropbox) attached to a song in v2.11 are
  openable from the Rehearse tab, opening in a new tab (no in-app embedding required).

- [ ] **R392**: The volunteer service view has a read-only **Order of Service** tab showing the service's
  running order (reusing the existing read-only order-of-service render), so tech and all volunteers can see
  what happens when.

- [ ] **R393**: The volunteer service view has a read-only **Stage Layout** tab showing the v2.7 stage
  diagram (instruments/mics + person Name-Role assignments), which tech-team volunteers need for setup
  (reusing the existing read-only/print stage render).

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
| Reusing the planner's `ServiceEditorView` for the volunteer view | The volunteer view is a standalone, read-only view composed from existing read-only renderers (owner decision) — not a hidden/read-only mode of the god-module editor; keeps the R377 isolation guarantee simple. |
| Volunteer editing of order of service / stage layout | Order of Service + Stage Layout are read-only in the volunteer view (planners edit them in the editor). |

## Traceability

Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| R374 | Phase 125 | Complete |
| R375 | Phase 125 | Complete |
| R376 | Phase 125 | Complete |
| R377 | Phase 125 | Complete |
| R378 | Phase 126 | Complete |
| R379 | Phase 126 | Complete |
| R380 | Phase 126 | Complete |
| R381 | Phase 126 | Complete |
| R382 | Phase 126 | Complete |
| R383 | Phase 126 | Complete |
| R384 | Phase 127 | Pending |
| R385 | Phase 127 | Complete |
| R386 | Phase 127 | Complete |
| R387 | Phase 127 | Pending |
| R388 | Phase 127 | Pending |
| R389 | Phase 127 | Pending |
| R390 | Phase 127 | Complete |
| R391 | Phase 127 | Pending |
| R392 | Phase 127 | Pending |
| R393 | Phase 127 | Pending |

**Coverage:**

- v1 requirements: 20 total (R374–R393)
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-05 — milestone v2.12 Rehearse Mode*
