# Requirements: WorshipPlanner — v2.14 Services UX Alignment, Dashboard & Live-Stream Output

**Defined:** 2026-09-07
**Core Value:** Smart weekly service planning that follows the Vertical Worship methodology while rotating
through the full song stable and respecting team configurations.
**Milestone goal:** Bring the Services page and share views up to the app's UX/mobile standard, make the
dashboard genuinely useful, add worship-team responsibility confirmation and editor presence, and introduce
a third "Video" live-stream output with banner/full-screen slides.

> **Numbering:** continues the project's global `R###` scheme from v2.13 (which ended at R405).
>
> **Scope decisions (owner, 2026-09-07):**
> - **Research-first pass ran** (`.planning/research/SUMMARY.md`): dashboard should lead with a
>   "needs-your-attention" feed (not BI/metrics); confirmation is a **two-state** Unconfirmed/Confirmed
>   model (Decline/replacement deferred); presence is **Firestore-only** (heartbeat + client soft-TTL, no
>   Realtime Database); auto-share-link reuses the idempotent `ensureShareLink()` at the Planned/lock
>   transition; Stage Layout auto-populate is a **one-time seed of an empty canvas**.
> - **Video output — Blackbird is IRRELEVANT.** There is **no external hardware compositing dependency and
>   no feasibility spike**. Compositing happens in the video room's **software** (OBS/vMix-style Browser
>   Source), which can consume a genuinely transparent (alpha) source. Owner chose **"build both,
>   transparent default"**: render transparent background by default + a **configurable solid key-color
>   fallback** (default magenta) for tools that need chroma-key. Purely app-side work.
> - **Add-ons pulled in** (research "should have"): reminder nudges for unconfirmed assignments (R413) and
>   an editor-presence roll-up on the dashboard (R418). **Deferred to backlog:** the banner
>   backing-bar/contrast-treatment differentiator (basic banner legibility — title-safe inset + text
>   sizing — remains table-stakes in R427).
> - **One hard cross-feature dependency:** the confirmation model (R410) must land before the dashboard's
>   unconfirmed-volunteers widget (R417).
> - **Security note:** presence rules must use the org-scoped `get`/`list`-split idiom to avoid a smaller
>   replay of the proven v2.8 SEC-S-01 cross-tenant leak (R423). Auto-share-link must stay gated to
>   Planned/lock so drafts are never exposed (R421).

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase (see Traceability).

### Services Page & Share-View Polish

- [ ] **R406**: The main `/services` page uses the same standard page header pattern as the rest of the app
  (it currently doesn't match), so it looks and behaves consistently with other pages.

- [ ] **R407**: The `/services` page's tabs and buttons are mobile-friendly — usable and readable on a phone
  (they currently aren't), matching the app's mobile button/header conventions.

- [ ] **R408**: The share service-link pages render service-plan rows with an alternating light-gray row
  background, so it's easier to keep your place scanning each row of the plan.

### Verbiage — Remove "Planning Center"

- [ ] **R409**: "Planning Center" references are removed from UI copy that is **not** about the actual PC
  integration/export, after inventorying and classifying every occurrence so substantive integration copy
  isn't garbled. Concrete case: the Planned/locked banner ("Planned — editing is locked. Planning Center
  already has this plan. Reopen it…") drops the "Planning Center already has this plan." sentence.

### Volunteer Responsibility Confirmation

- [ ] **R410**: A worship-team member can confirm they know they're responsible for something in a service
  via a per-assignment "I've got it" action in their volunteer-facing surface (My Schedule / volunteer
  service view). Assignments are **Unconfirmed** by default and become **Confirmed** — a two-state model
  (no Decline/replacement this milestone).

- [ ] **R411**: A planner sees each assignment's confirmation status (Confirmed / Unconfirmed) on the
  service roster, read live (`onSnapshot`, not a one-time fetch).

- [ ] **R412**: When an underlying assignment is reassigned (or through an unlock→relock edit), a prior
  confirmation is invalidated to "needs reconfirmation" rather than showing a stale checkmark — keyed on
  stable assignment identity.

- [ ] **R413**: A planner can send reminder nudges targeting **only** unconfirmed assignments, reusing the
  existing v1.7 volunteer-messaging send infrastructure (a recipient-targeting change, not a new send path).

### Dashboard

- [ ] **R414**: The undefined "Volunteer coverage" metric is removed from the dashboard.
- [ ] **R415**: The dashboard shows an upcoming-services list (a "needs your attention" framing, not
  BI/metrics).

- [ ] **R416**: The dashboard shows a per-service readiness signal (songs/media attached, roles filled,
  slides built, Draft vs Planned/locked), **reusing the existing v2.12 My Schedule readiness computation**
  rather than inventing a second, parallel definition.

- [ ] **R417**: The dashboard shows an unconfirmed-volunteers widget (who hasn't yet confirmed for upcoming
  services). Depends on R410.

- [ ] **R418**: The dashboard shows an editor-presence roll-up (who is currently editing what), reusing the
  per-service presence data from R422.

- [ ] **R419**: The dashboard has a clear empty / first-run state when there's nothing needing attention.

### Stage Layout Auto-Populate

- [ ] **R420**: The per-service Stage Layout auto-populates the service's assigned roles/instruments as a
  **one-time seed of an empty canvas** (first visit with zero elements). It never regenerates, wipes, or
  duplicates markers on re-run against a canvas that already has manual placements (roster changes right up
  until lock).

### Auto-Generated Share Link

- [x] **R421**: A service's share link exists automatically so the user never has to click "Share Link"
  manually. **(Scope RESOLVED 2026-09-07 — supersedes the original "gate to Planned / no Draft exposure"
  framing.)** Real UI-created services already mint a link at `createService()`; the gap is tokenless
  services (seed data, or services created before the 2026-08-17 mint). Keep the `createService()` mint, add
  an idempotent fail-closed "ensure link exists" self-heal (reusing `ensureShareLink()`, not
  `maybeRefreshShareLink()`) so tokenless services self-heal without a manual click, and fix the seed script
  to mint a token. Idempotency prevents duplicate tokens. Draft-sharing behavior is intentionally unchanged
  (drafts keep their link for volunteer-message `{{service_link}}`); no ShareView status gate is added.

### Editor Presence

- [ ] **R422**: While a user is viewing/editing a service, other viewers of the same service see an
  indicator of who else is currently present, backed by a Firestore heartbeat (`serverTimestamp()` +
  `onSnapshot`, coarse ~25–30s interval, paused while the tab is hidden) with a client-side soft-TTL
  staleness filter (~60s). Teardown uses `watch(serviceId, …)` (Vue Router reuses the mounted editor
  instance across service navigation, so `onUnmounted` alone is insufficient).

- [ ] **R423**: Presence records are stored in an org-scoped `services/{serviceId}/presence/{uid}`
  subcollection whose read rules use the `get`/`list`-split, org-membership-scoped idiom (no unscoped
  `allow read: if isSignedIn()`), verified by a cross-org rules test; a scheduled cleanup backstop
  (Firestore TTL and/or a `cleanupStalePresence` cron sibling of the existing retention crons) removes
  abandoned records. A forced-disconnect test proves stale presence clears.

### Video Output (Live-Stream)

- [ ] **R424**: A third output type **"Video"** is added to the multi-monitor output-role system alongside
  Audience/Confidence — `MonitorRole` widened, the monitor setup UI offers it, a `VideoOutputView`
  sibling + its own static route exist. Video assignment coexists with the existing N-assignment role model.

- [ ] **R425**: A slide item can be flagged to be sent to the Video output as either a **Banner** or
  **Full-screen** (per-item authoring UI + schema field), riding the existing autosave path. **Banner is
  valid only when the output is Video.**

- [ ] **R426**: A slide sent Full-screen to the Video output fills the entire video picture, reusing the
  existing Audience full-slide render (no new rendering code).

- [ ] **R427**: A slide sent as a Banner to the Video output renders its contents fit to a bottom
  lower-third region (title-safe inset, readable default text), with the rest of the output rendered
  **transparent by default** so a software compositor shows live video behind it, plus a **configurable
  solid key-color fallback** (default saturated magenta, `<input type="color">`) for a tool that needs a
  chroma key instead of an alpha source.

## Future Requirements (deferred to a later milestone)

- Reminder deadline / auto-decline timers on confirmations.
- Volunteer blockout-date management.
- Customizable / drag-and-drop dashboard widget layout.

## Out of Scope (explicit exclusions)

- **Decline + auto-reopen-slot + replacement self-swap** — a real, well-precedented feature, but heavier
  than the owner's two-state "I've got it" ask (research FEATURES.md). → backlog.

- **Generic BI / analytics dashboard widgets** (attendance trends, engagement charts) — the anti-pattern the
  old "coverage %" metric represented; the dashboard is a "needs your attention" feed, not a BI surface.

- **Banner backing-bar / drop-shadow contrast-treatment differentiator** — deferred; basic banner legibility
  (title-safe inset + text sizing) stays in R427. → backlog.

- **"Fill + Key" dual-output hardware video path** — only relevant if the church later adds real
  hardware-keyer equipment; not applicable to the current software-compositor path.

- **Blackbird / any hardware compositing integration** — confirmed irrelevant by the owner (2026-09-07); no
  hardware dependency or feasibility spike in this milestone.

- **Realtime Database for presence** — the app is deliberately Firestore-only through 13 shipped milestones.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| R406 | Phase 132 | Pending |
| R407 | Phase 132 | Pending |
| R408 | Phase 132 | Pending |
| R409 | Phase 132 | Pending |
| R410 | Phase 133 | Pending |
| R411 | Phase 133 | Pending |
| R412 | Phase 133 | Pending |
| R413 | Phase 133 | Pending |
| R414 | Phase 135 | Pending |
| R415 | Phase 135 | Pending |
| R416 | Phase 135 | Pending |
| R417 | Phase 135 | Pending |
| R418 | Phase 135 | Pending |
| R419 | Phase 135 | Pending |
| R420 | Phase 131 | Pending |
| R421 | Phase 131 | Complete |
| R422 | Phase 134 | Pending |
| R423 | Phase 134 | Pending |
| R424 | Phase 136 | Pending |
| R425 | Phase 137 | Pending |
| R426 | Phase 136 | Pending |
| R427 | Phase 137 | Pending |
