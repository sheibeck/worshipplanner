# Requirements: WorshipPlanner — v2.16 Dated Rehearsals & WorshipBuilder

**Defined:** 2026-10-27
**Core Value:** Smart weekly service planning that follows the Vertical Worship methodology while rotating
through the full song stable and respecting team configurations.
**Milestone goal:** Act on the owner's v2.15 field feedback on rehearsal times, and move the app to its new
name and domain (`worshipbuilder.web.app`) without breaking existing links or any church computer's Sunday
setup.

> **Numbering:** continues the project's global `R###` scheme from v2.15 (which ended at R440).
>
> **Scope decisions (owner, 2026-10-27):**
> - Promotes backlog **999.6** (dated rehearsals + Times tab) and **999.2** (WorshipBuilder rename + single
>   hosting target `worshipbuilder.web.app`). SEED-001 marked harvested (delivered by v1.9).
> - **Old domain = redirect + carry settings:** `worship-planner-bc515.web.app` sends every request to the
>   same page on the new domain and hands that browser's saved per-browser setup across.
> - **Every rehearsal has a date.** The org-level default *times* concept stays; the org-default **report
>   time is unchanged**. How a new rehearsal gets its date (picked on add vs. defaulted from the service
>   date) is a discuss-phase decision.
> - No milestone-level research pass (per-phase research still runs). Run via `/gsd-autonomous` with human
>   UAT batched to milestone end. Prod deploys are per-deploy owner-confirmed.
>
> **Known facts going in (verified 2026-10-27):** `worshipbuilder.web.app` is already a Firebase Auth
> authorized domain and the browser API key has no HTTP-referrer restriction; `worshipbuilder.firebaseapp.com`
> is **not** yet authorized; `storage-cors.json` lists only the old origins; `SERVICE_SHARE_BASE_URL`
> (`functions/src/params.ts`) defaults to the old domain; Run monitor config (`wp:runMonitorConfig:v2`),
> video key color, selected church and list prefs live in **per-origin** `localStorage`, and Auth sessions
> are per-origin (IndexedDB).

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase (see Traceability).

### Rehearsal Times — Every Rehearsal Is Dated (revises R430 / R432)

- [x] **R441**: A rehearsal on a service **always has a date**. Adding a rehearsal produces a dated row (the
  planner picks the date as part of adding it, or it defaults from the service date — decided in discuss),
  and an existing rehearsal's date cannot be cleared back to blank. The editor can no longer create an
  undated rehearsal row.

- [x] **R442**: The org-default rehearsal time(s) still apply, **without creating undated rows**: a new
  service no longer receives date-less placeholder rehearsals; instead the org default(s) supply the
  rehearsal time when rehearsals are added (or are applied as dated rows relative to the service date —
  decided in discuss). The org-default **report time** keeps its current behavior (copied onto a new
  service). Changing an org default still never mutates an existing service.

- [x] **R443**: Services created under v2.15 that already carry **undated** rehearsal rows lose no data: the
  planner sees each such row flagged as needing a date and can date or remove it, and an undated row stays
  hidden from every read-only and public surface until it is dated. No migration guesses dates.

### Service Editor — Times Tab

- [x] **R444**: The rehearsal and report-time controls move off the top of the service editor into a
  dedicated **Times** tab placed **after Messages** (Service Order · Slides · Roles · Stage Layout ·
  Messages · Times). The tab follows the existing tab-strip patterns: same tab styling and keyboard
  navigation, the horizontally scrolling mobile strip, the same role/lock gating the Times block has today
  (editable in Draft by editors, read-only when locked or for non-editors), and the same autosave and save
  status. Nothing for times remains above the tab strip.

- [x] **R445**: Everywhere rehearsals and report time display today (dashboard, Services cards, My Schedule,
  the volunteer service view, the public plan/share page, and both public projections
  `buildServiceSnapshot` / `buildRehearseAccess`) keeps working unchanged for dated rehearsals — the R433
  behavior is regression-guarded, not reworked.

### Rename — WorshipBuilder

- [x] **R446**: Every user-facing occurrence of the app name in the web app reads **WorshipBuilder** — the
  browser tab title, the app shell/sidebar header, the login and church-picker screens, the volunteer
  sign-in / request / link-complete pages, and the "Shared from" / "Generated from" footers on the share,
  quarter-share, service-print and roster-print views. Internal identifiers (Firebase project id, storage
  keys, code symbols) are unchanged.

- [x] **R447**: Every outbound email that names the app — member invite, admin invite, onboarding, and the
  volunteer sign-in (magic-link) email — says **WorshipBuilder** in its subject and body.

### Domain Cutover — worshipbuilder.web.app

- [x] **R448**: The `worshipbuilder` Hosting site is the **single** deploy target for the app: a hosting
  deploy publishes the app — with its `/api/**` → `api` function rewrite, SPA fallback and cache headers —
  to `https://worshipbuilder.web.app`, and the build/deploy docs reference it.

- [x] **R449**: Every link the app generates points at `https://worshipbuilder.web.app` — share/plan links,
  volunteer magic-link continue URLs, and the sign-in links in invite/admin emails (the
  `SERVICE_SHARE_BASE_URL` default and any client-side link builders) — and no hard-coded old-domain URL
  remains in app or function code.

- [x] **R450**: Every origin allowlist includes the new domain **before** cutover — Storage bucket CORS
  (`storage-cors.json`, re-applied to the bucket), Firebase Auth authorized domains (add
  `worshipbuilder.firebaseapp.com`), and any other origin-scoped configuration research finds — so uploads,
  downloads, Google sign-in, password sign-in and magic links all work on the new domain.

- [x] **R451**: The old addresses (`worship-planner-bc515.web.app` and `worship-planner-bc515.firebaseapp.com`)
  send every request to the **same path, query string and hash** on `worshipbuilder.web.app`, so existing
  share links, magic links in already-sent emails, bookmarks and home-screen shortcuts keep working.

- [ ] ~~**R452**: On a browser's first visit through an old address, that browser's saved per-browser setup is
  carried to the new domain — Run monitor assignments and nicknames, video key color, last-selected church,
  and list/column/section preferences (the app's own `wp`-prefixed `localStorage` keys). The hand-off is
  **allowlisted and shape-validated**, never overwrites a value already set on the new domain, and never
  transfers authentication state; a crafted link cannot plant arbitrary keys.~~
  **Descoped 2026-10-27 (owner decision):** the owner is the only user at this stage, so the old addresses
  get a plain redirect to the same page and nothing is carried. Run monitor setup, video key color, the
  selected church and list prefs are re-set once on the new domain (runbook Step 7). No settings hand-off
  code ships; reopen as a new requirement only if other churches need it before the old site retires.

- [ ] **R453**: A cutover runbook gives the owner the exact ordered steps and checks: the pre-cutover
  allowlist steps, deploy order (new site live before the old site starts redirecting), "don't cut over
  during a service" timing, the one-time sign-in everyone does on the new domain, re-granting the
  multi-screen (window placement) permission on each Run computer, optional console renames (Firebase
  project public-facing name, OAuth consent screen app name), rollback, and a post-cutover smoke checklist.
  Production deploys are owner-confirmed per deploy.

## v2 Requirements

Deferred to a future release. Tracked but not in this roadmap.

### Custom Domain & Email

- **Custom domain + verified email sender** — buy a domain, map it to the `worshipbuilder` Hosting site,
  and verify it in Resend so volunteer email reaches real inboxes (a `*.web.app` address can never be
  verified). Owner has no domain yet (2026-10-27).

- **Google sign-in shows the new name** — switch the Auth `authDomain` to the new domain (needs the OAuth
  client's redirect URI updated) so the Google account chooser stops naming `worship-planner-bc515.firebaseapp.com`.

### Rehearsals — Extras (carried from v2.15)

- **Rehearsal location / venue** per rehearsal.
- **Recurring default rehearsal day** (e.g. "the Thursday before") as an org default — only if discuss does
  not already take it for R441/R442.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Renaming the Firebase project id, GCP project, Storage bucket or function names | Immutable or zero user value; the project id is invisible once hosting moves |
| Deploying the app to both sites (dual-site) | Owner wants a single deploy target; the old site only redirects |
| Migrating sign-in sessions across domains | Auth state must never travel through a URL hand-off; everyone signs in once |
| Renaming `wp`-prefixed storage keys, the repo or the npm package | Internal identifiers — renaming breaks the settings carry-over for no user benefit |
| Per-org storage quota + egress monitoring | SEED-003's remaining guardrails — still parked |
| Re-verifying the owner-waived v2.14/v2.15 UAT lists | Separate standing follow-up, not part of this milestone |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| R441 | Phase 143 | Complete |
| R442 | Phase 143 | Complete |
| R443 | Phase 143 | Complete |
| R444 | Phase 143 | Complete |
| R445 | Phase 143 | Complete |
| R446 | Phase 144 | Complete |
| R447 | Phase 144 | Complete |
| R448 | Phase 145 | Complete |
| R449 | Phase 145 | Complete |
| R450 | Phase 145 | Complete |
| R451 | Phase 145 | Complete |
| R452 | Phase 145 | Descoped (owner, 2026-10-27) |
| R453 | Phase 145 | Pending |

**Coverage:**

- v1 requirements: 13 total (R441–R453)
- Mapped to phases: 13 (100%)
- Unmapped: 0
- Descoped: 1 (R452, owner decision 2026-10-27; 12 active)

**Phase map:**

- Phase 143 — Dated Rehearsals & Times Tab (R441, R442, R443, R444, R445) — promoted from backlog 999.6
- Phase 144 — WorshipBuilder Rename (R446, R447) — promoted from backlog 999.2 (rename half)
- Phase 145 — Domain Cutover to worshipbuilder.web.app (R448, R449, R450, R451, R453; R452 descoped 2026-10-27) — promoted from backlog 999.2 (domain half); depends on 144; production steps owner-gated per deploy

v2 "Custom Domain & Email" requirements are tracked as backlog **999.14** in ROADMAP.md.

---
*Requirements defined: 2026-10-27*
*Last updated: 2026-10-27 after Phase 145 planning — R452 descoped by the owner (plain redirect, no settings carry); 13/13 mapped, 12 active*
