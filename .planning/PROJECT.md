# WorshipPlanner

## What This Is

A worship service planning app for church worship teams that builds weekly service orders using the Vertical Worship methodology. It manages a song stable with CSV import, suggests songs based on VW category and rotation, provides AI-powered song and scripture discovery, and delivers printable/shareable service plans with team RBAC. Built with Vue 3 and Firebase, it complements Planning Center — you plan here, then execute there.

## Core Value

Smart weekly service planning that follows the Vertical Worship methodology (1→2→3 song progression) while rotating through the full song stable and respecting team configurations.

## Current Milestone: v2.0 Multi-Church Onboarding & Owner Console Tabs

**Goal:** Turn the owner console into a tabbed shell and add platform-level multi-tenancy management —
onboard new churches and assign their first admin from one place — while closing the multi-org Storage
auth-claim gap that onboarding a second-org admin would otherwise trip.

**Target features:**
- **Tabbed owner console** — restructure the single scrolling `OwnerConsoleView` into a **Configuration**
  tab (existing super-admins roster + the four v1.9 platform-config cards + the deploy-time note) and a new
  **Organizations** tab. Layout only — no behavior change to the existing config surfaces.
- **Organizations tab — list + onboard** — view all orgs (churches) on the platform; onboard a new one that
  creates the **org record + default `OrgSettings`**, **seeds the default service template** so the church
  can create services immediately, and **assigns its first admin by email**.
- **Assign admins to a church** — a church admin *is* the existing **editor** role (reuse the current
  editor/viewer RBAC + membership custom claim — no new role/claim). Assigning = adding an org member at
  editor tier by email via the server-verified membership path (never a direct privileged client write).
- **Multi-org Storage auth claim (backlog 999.5, now required)** — widen the org-membership custom claim to
  carry **all** of a user's orgs+roles and update `storage.rules`' `isOrgMemberByClaim` to check the
  requested `orgId` against that set, so a newly-onboarded admin who belongs to a second org keeps Storage
  access. Hard prerequisite for onboarding.

**Key context (owner, 2026-08-21):** v2.0 major increment · **stacks on v1.9** (code-complete; its deploy +
UAT + milestone-complete remain parked with the owner — v1.9 phases archive as-is). A church admin reuses the
existing editor role. All auth-claim / `firestore.rules` / `storage.rules` / new org-provisioning-callable
changes are **hand-over** deploys per the standing grant — built + tested + UNDEPLOYED with exact
`firebase deploy` commands handed over.

Requirements defined in `.planning/REQUIREMENTS.md`; roadmap in `.planning/ROADMAP.md`.

<details>
<summary>Code-complete milestone — v1.9 Owner Admin Console (Phases 68–71, code-complete 2026-08-20; deploy + UAT parked with owner)</summary>

Delivered a private super-admin owner console: a super-admin custom-auth-claim access gate + roster grant/
revoke (server-verified `setSuperAdminClaim`), a Firestore-backed live platform-config doc the Cloud
Functions read at runtime (four `*_CLEANUP_ENABLED` switches, retention windows, delete blast-radius cap,
AI-proxy + messaging/fan-out knobs), a no-reply sender field, and dry-run blast-radius safety before any
deletion toggle — with the song-linked-background protection preserved. **Code-complete + auto-verified
(Phases 68–71, R174–R192); human UAT + all deploys handed to the owner and not yet run.** v2.0 builds the
tabbed shell + org onboarding on top of this console (the church-provisioning / multi-admin work v1.9
deliberately deferred). Requirements: `.planning/REQUIREMENTS.md` (R174–R192).

</details>

<details>
<summary>Shipped milestone — v1.8 Cost & Billing Hardening (Phases 65–67, deployed 2026-08-20)</summary>

Full record below and in [milestones/v1.8-ROADMAP.md](milestones/v1.8-ROADMAP.md). The most recent
milestone, **v1.8 Cost & Billing Hardening** (Phases 65–67, R161–R168 + R170–R173), shipped 2026-08-20
with its safe config **deployed to production** the same day. Its cost/cleanup levers are the env vars this
v1.9 admin console lifts into a Firestore-backed, owner-controllable surface (see
`.planning/seeds/SEED-001-admin-settings-interface.md`).

</details>

<details>
<summary>Shipped milestone — v1.8 Cost & Billing Hardening (Phases 65–67, deployed 2026-08-20)</summary>

**Delivered:** capped and made observable every runaway cost surface on the live Blaze-plan app.
**Phase 65** — the metered Claude `api` proxy gained a per-uid rate limit (429, fail-open), server-side
model allow-list (400) + `max_tokens` clamp, an `aiUsage` token-usage ledger, and a `maxInstances` cap,
all gated to the anthropic upstream. **Phase 66** — proved+hardened the media/orphan-render sweeps and
added two new retention sweeps (`cleanupOrphanBackgrounds` with 3-tier reference detection + two
fail-safes, `cleanupPptxSources`), all dry-run by default; retention windows later made env-tunable with
media bumped to 30 days. **Phase 67** — gated the unused daily cross-org `sendScheduledReminders` scan
off, added a Resend recipient cap + per-org daily quota, a project-wide `setGlobalOptions` instance
ceiling, and Cloud Run render-service caps (`--max-instances=3`). **Deployed:** the AI proxy caps,
reminder-cron gate, send caps, and all instance ceilings are LIVE; the four cleanup crons are live in
**dry-run** (delete nothing until the owner sets each `*_CLEANUP_ENABLED=true`).

**Standing owner follow-ups (outlived the milestone):** activate the storage-deletion flags after
reviewing dry-run logs; deploy the Phase 65 `firestore.rules` deny (`firebase deploy --only
firestore:rules`); gating the reminder cron also pauses composer "schedule-for-later" until
`SCHEDULED_MESSAGING_CRON_ENABLED=true`. Full record: [milestones/v1.8-ROADMAP.md](milestones/v1.8-ROADMAP.md) ·
[milestones/v1.8-REQUIREMENTS.md](milestones/v1.8-REQUIREMENTS.md) · [milestones/v1.8-MILESTONE-AUDIT.md](milestones/v1.8-MILESTONE-AUDIT.md).

</details>

<details>
<summary>Shipped milestone — v1.7 Volunteer Messaging (Phases 58–64, deployed 2026-08-17, archived 2026-08-18)</summary>

**Delivered:** the complete volunteer-messaging system — a Settings kill-switch and org timezone, one
shared server-side recipient resolver, a ✉ composer (teams-first recipients, merge tokens, live
"Reaches N", schedule-for-later), per-service delivery history, an HMAC-verified bounce webhook,
automatic lock and N-days-before scheduled-reminder emails, and a re-lock scoped change diff — all
governed by a global Settings kill-switch and one queue-then-trigger send primitive holding the Resend
key server-side. Plus the messaging-UX refinements (dedicated Messages tab, always-visible history,
live preview, corrected `{{name}}` token) and the post-UAT hotfix batch (R157–R160: hide-when-off,
add-someone fix, From/Reply-To rework, unique org names).

**Scope note:** internally tracked as two milestones (v1.7 Phases 58–62, v1.8 Phases 63–64) that
stacked without archiving between them; shipped together in one production deploy and combined into a
single v1.7 milestone at close (owner decision 2026-08-18). Full record:
[milestones/v1.7-ROADMAP.md](milestones/v1.7-ROADMAP.md) ·
[milestones/v1.7-REQUIREMENTS.md](milestones/v1.7-REQUIREMENTS.md). See MILESTONES.md for the full
accomplishment list.

**Standing follow-ups:** email is still test-mode `onboarding@resend.dev` until the verified-domain
harden (backlog 999.6); `messageWebhook` bounce tracking is live with the real Resend secret.

</details>

## Current State

**Shipped:** v1.0 MVP (Phases 1–4, 6–7) · v1.1 (Phases 8–17) · v1.2 Worship Service Slide Management
(Phases 18–23) · v1.3 Slides Tab Rework (Phases 24–28) · v1.4 Service and Slides (Phases 29–38,
shipped 2026-08-05) · v1.5 Settings, Sharing, and Fidelity (Phases 39–50, shipped 2026-08-10) · v1.6
Editing Reliability & Song Slides (Phases 51–57, shipped 2026-08-12) · **v1.7 Volunteer Messaging
(Phases 58–64, shipped & deployed to production 2026-08-17, archived 2026-08-18)** — all archived.

**Open:** no active milestone — next is scoped via `/gsd-new-milestone`. v1.7 delivered the full
volunteer-messaging system (kill-switch + timezone, shared recipient resolver, ✉ composer, delivery
history + HMAC bounce webhook, lock & scheduled-reminder auto-notifications, re-lock scoped diff,
dedicated Messages tab, composer refinements, R157–R160 hotfixes). Closed on owner acceptance with the
`/gsd-verify-work 58..64` human-UAT items accepted as deferred (preserved in `PENDING-VERIFICATION.md`),
per the v1.4/v1.5/v1.6 precedent. Standing follow-up: email remains test-mode `onboarding@resend.dev`
until the verified-domain harden (backlog 999.6).

### v1.4 shipped on owner acceptance, with two things left genuinely unfinished

Phases 29–31 were verified normally. **Phases 32–38 were accepted, not verified** — their
`*-VERIFICATION.md` files carry `status_source: owner-attributed`, `/gsd-audit-milestone` was never
run, and the unrun checks are preserved in `.planning/PENDING-VERIFICATION.md` under a CLOSED UNRUN
header. The owner's call, made explicitly: *"Any issues I find from here on out will go in the next set
of changes I'm going to post."*

Two items are not merely unverified but **incomplete**, and are carried into Active below:

1. **PPTX server-side rendering — backend DEPLOYED 2026-08-06, no UI consumes it** (Phase 37,
   R062 still `[~]`). The Cloud Run service is live at `pptx-render` in `us-central1`, verified
   private (unauthenticated requests get 403), and `PPTX_RENDER_SERVICE_URL` is wired into the
   deployed functions. What remains is the half that was always out of scope: **nothing in `src/`
   reads the rendered PNGs**, so a PPTX import produces images in Storage that the app never
   displays. R062's "looks like the original PowerPoint" is not satisfied until that display work
   is built — and no phase owns it.
2. **`firestore.rules` is not deployed** (backlog 999.3). Phase 31's draft lock is a three-layer
   control whose third layer ships separately from the bundle and is currently not live.

v1.2 gave the app slide management (lyrics, scripture, PPTX import, media, presentation preview). v1.3
then reworked it around a **persisted slide-group model**: a dedicated **Slides** tab where all slide
editing lives, a plan rail that mirrors the service order rather than duplicating it, an Edit Slide
drawer, and a song lyrics editor rebuilt as one list that IS the slide order. The first tab was renamed
**Service Order** and stripped of slide editing.

**Verification note:** `workflow.verifier` was `false` through v1.2 and v1.3, so neither produced
automated `VERIFICATION.md` output. v1.2 closed on owner acceptance with its checkpoints waived; v1.3
was verified by the owner directly. The setting was **enabled on 2026-07-28**, so v1.4 onward gets real
per-phase verification.

**Dropped 2026-07-28:** Collaboration / Tasks & Events (planned as Phase 5, never started) —
`TASK-01..03`, `EVNT-01..04`. Still in backlog: **999.1**, extract a shared song-browse component.

## Previous Milestone: v1.6 Editing Reliability & Song Slides (SHIPPED 2026-08-12)

**Delivered (Phases 51–57, 19 plans):** drag-and-drop editing reliability in both the template and
live service plans; the service template relocated to the Services page; hand-split song slides
(+ Pre-Chorus, position numbering); a per-item notes field; per-item Miscellaneous labels and a
Scripture ESV/NLT override; preview/export polish (no auto-version, export spinner, Roboto font); and
the template editor brought to UX parity with the redesigned Service Order screen. Deployed to
production 2026-08-12; a same-day firestore.rules delete-fix + owner UI follow-up batch confirmed in prod.

**Goal (as set):** Fix the drag-and-drop corruption that plagues both the default template and real service
plans, move the service template to where it's actually used, and make song-slide editing intuitive
for non-technical users — plus item-editing and preview polish.

**Target features:**

- **Service Order editing reliability (bugs, first phase)** — dragging an item into a section spawns a
  phantom duplicate stuck at "No Section" that can't be deleted (in BOTH the default-template editor
  and the live service plan); moving an item back to "No Section" via the dropdown throws a save error;
  and items with an empty body sort to the bottom on the Services listing and share link instead of
  their real order (typing text "fixes" it). Same reordering machinery flagged fragile in v1.4.
- **Default service template** — relocate the template editor out of main Settings onto the Services
  page behind a cog/settings button; rename "Default to 1,2,3" to "Suggested Template", decouple it
  from Vertical Worship, and start EVERY new service from it (no blank template); Miscellaneous items
  in the template gain the input box for pre-filling recurring content.
- **Song lyric editing** — split any song item into multiple slides with manual line assignment (an
  8-line chorus → 2 slides), where Duplicate copies the whole multi-slide unit; add Pre-Chorus as an
  item type; number sections by position (3rd verse = "Verse 3", a split section keeps its number);
  rename a new song's "Replace Lyrics" button to "Save".
- **Service item enhancements** — a notes field beside each item's selector (who leads / who sings
  what), side-by-side on desktop and stacked on mobile, consistent across item types; Miscellaneous
  items default to no slides.
- **Preview & export polish** — the slideshow preview stops auto-appending the Bible version
  (ESV/NLT); a spinner on the Planning Center export; add **Roboto** to the curated self-hosted slide
  fonts (Inter already ships from v1.5).

**Decisions carried into scoping (2026-08-11):**

| Question | Direction |
|---|---|
| Drag-and-drop priority | Sequenced FIRST — the most disruptive defect; it blocks trust in every other editing surface. Owner instruction. |
| Blank template | Eliminated — the Suggested Template becomes the universal starting point for a new service, decoupled from Vertical Worship. |
| Split-slide duplication | A split section is one logical unit: Duplicate copies all its slides together, and its numbering stays position-based. |

## Earlier Milestone: v1.5 Settings, Sharing, and Fidelity (SHIPPED 2026-08-10)

> Archived. Full record: [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md) ·
> [milestones/v1.5-REQUIREMENTS.md](milestones/v1.5-REQUIREMENTS.md). Delivered per-church settings &
> feature toggles, custom-auth-claim org membership, sharing correctness, PPTX rendered-image display,
> service item types (Announcements/Miscellaneous), the default service template, ESV/NLT Bible
> selection, global slide typography, congregational reading UX, multi-image/mobile polish, and slide
> bulk-delete/provenance/render-fidelity. See MILESTONES.md for the full accomplishment list.

## Requirements

### Validated

- ✓ Fan-out, cron & instance guardrails — gated the unused daily `sendScheduledReminders` cross-org scan OFF by default (`SCHEDULED_MESSAGING_CRON_ENABLED`), Resend send-loop caps (per-message recipient reject + per-org daily quota, fail-open), project-wide `setGlobalOptions({maxInstances})` (api keeps its tighter cap), and Cloud Run render-service `--max-instances=3`/`--concurrency=1` (R170–R173) — v1.8 Phase 67 (code-complete + verified 2026-08-20; **UNDEPLOYED, all bounded/reversible → autonomous deploy**). Note: gating the cron also pauses composer "schedule-for-later" dispatch until the flag is enabled (disclosed, reversible).
- ✓ Storage retention — proved+hardened the media & orphan-render sweeps (delete-branch tests, per-run delete cap + bytes logging) and added two new sweeps: `cleanupOrphanBackgrounds` (orphan+age, 3-tier reference detection with `referencesComplete` + floor-guard fail-safes → dry-run) and `cleanupPptxSources` (prune consumed+aged source `.pptx`/`images/`, keep `rendered/`); all four DRY-RUN by default (R165–R168) — v1.8 Phase 66 (code-complete + verified 2026-08-20; **UNDEPLOYED, dry-run** — orchestrator deploys the four dry-run cron functions, owner sets each `*_CLEANUP_ENABLED=true` to activate real deletion).
- ✓ AI proxy cost controls — per-uid rate limit (429, fail-open), server-side model allow-list (400) + max_tokens clamp, `aiUsage` ledger via Admin SDK, `maxInstances` cap on the `api` proxy; all gated to the anthropic upstream only (R161–R164) — v1.8 Phase 65 (code-complete + verified 2026-08-20; **UNDEPLOYED** — orchestrator deploys `functions:api`, owner deploys the `firestore.rules` deny).
- ✓ Volunteer messaging — Settings kill-switch + org timezone, shared recipient resolver, ✉ composer, delivery history + HMAC bounce webhook, lock & scheduled-reminder auto-notifications, re-lock scoped diff, dedicated Messages tab, composer refinements + From/Reply-To rework + unique org names (R130–R160) — v1.7 (deployed 2026-08-17; archived: `milestones/v1.7-REQUIREMENTS.md`). Owner-accepted at close; human-UAT deferred in `PENDING-VERIFICATION.md`.
- ✓ Editing reliability, service-template relocation, song-slide splitting, per-item notes + Miscellaneous labels + Scripture version override, preview/export polish, template-editor UX parity (R110–R129) — v1.6 (archived: `milestones/v1.6-REQUIREMENTS.md`)
- ✓ Import song stable from CSV (Planning Center export) with arrangements, keys, BPM, tags, CCLI numbers — v1.0
- ✓ Manage song stable in-app (add, edit, categorize, tag team compatibility) — v1.0
- ✓ Categorize songs by Vertical Worship type: 1 (Call to Worship), 2 (Intimate), 3 (Ascription) — v1.0
- ✓ Create weekly service plans following the standard order (Song, Scripture, Song, Prayer, Scripture, Song, Song, Message, Sending Song) — v1.0
- ✓ Smart song suggestions based on category slot, recent usage tracking, and team configuration — v1.0
- ✓ Support song progressions: 1-2-2-3 or 1-2-3-3 for the four worship songs — v1.0
- ✓ Track song usage history to avoid repeating songs more than two weeks in a row — v1.0
- ✓ Select scripture passages with ESV preview, avoid pastor's teaching passage — v1.0
- ✓ Specify which teams are participating per service (Choir, Orchestra, Special Service, etc.) — v1.0
- ✓ Filter available songs based on which teams are scheduled — v1.0
- ✓ Tag songs with team compatibility (imported from CSV arrangement data + manual refinement) — v1.0
- ✓ User authentication via Google OAuth or email/password — v1.0
- ✓ Invite team members to collaborate on planning with editor/viewer roles — v1.0
- ✓ Print formatted order of service for rehearsal and Sunday — v1.0
- ✓ Share service plans via read-only shareable link (mobile-friendly) — v1.0
- ✓ Export service plan data for entry into Planning Center — v1.0
- ✓ Week-by-week service planning view — v1.0
- ✓ Seasonal/quarterly overview with song and scripture rotation tables — v1.0
- ✓ AI-powered song suggestions using sermon context (topic + passage) — v1.0
- ✓ Natural language scripture discovery with inline preview — v1.0
- ✓ RBAC: editor/viewer roles enforced across Firestore, router, and UI — v1.0
- ✓ In-app quarterly availability editor: per-person right-drawer for Sundays-only blackout calendar (Nth-Sunday chips + range block), frequency tier (regular/fill-in/out), must-serve-with bidirectional pairing, and quarter note — writing directly into PersonQuarterData; CSV import retained as secondary — v1.0 (Validated in Phase 14)
- ✓ Selective Planning Center roster import: scope by worship team + individually-scheduled positions with per-position Role mapping (choir/orchestra excluded), importing name, email, and roles — v1.0 (Validated in Phase 14)
- ✓ Per-(person, role) serve frequency (independent cadence per role a person holds) plus role-category co-occurrence rules — TECH exclusive; BAND/VOCALS/OTHER combine, capped at one BAND instrument per person per service — with the per-quarter tier (regular/fill-in/out) reconciled per-role consistently across scheduler, availability drawer, manual grid quick-assign, and admin roster status/filter — v1.0 (Validated in Phase 15)

- ✓ A service is editable only while in Draft; leaving Draft locks Service Order, Slides and Roles, with an explicit Reopen-for-editing path back — v1.4 (Phase 31)
- ✓ Autosave on the Service Order is reliable, and every save in the app is visible without scrolling — v1.4 (Phase 32)
- ✓ Post-Service section exists in both the service plan and the slides — v1.4 (Phase 29)
- ✓ Service items reorder correctly by drag-and-drop, with the five sections permanently ordered — v1.4 (Phase 29)
- ✓ Slide groups always mirror the service order — no review step, no manual re-sync — v1.4 (Phase 30)
- ✓ Slides can be reordered, added, and edited without accidental edit-mode or lost changes — v1.4 (Phases 30, 33)
- ✓ Background images can be set per group, per slide, and per song — v1.4 (Phase 33; rendering at presentation added as R070)
- ✓ Presented slides show copyright where required and never show organizational labels — v1.4 (Phase 35)
- ✓ Scripture slides can be generated as congregational readings with LLM-assisted splitting — v1.4 (Phase 34), and each section is now its own editable slide — v1.4 (Phase 38)
- ✓ Lyric paste warns when copyright information is missing, and happens inline — v1.4 (Phase 35)
- ✓ Every tabbed screen shows only the actions relevant to the open tab — v1.4 (Phase 36)

### Active

<!-- Milestone v2.0 Multi-Church Onboarding & Owner Console Tabs. Requirements defined in
     .planning/REQUIREMENTS.md (R193+), grouped: tabbed owner console, organizations list + onboard,
     church-admin assignment (reuse editor role), multi-org Storage auth claim (999.5). Traceability
     filled by the roadmap. -->

**v2.0 Multi-Church Onboarding & Owner Console Tabs (R193+)** — restructure `OwnerConsoleView` into a
Configuration tab (super-admins roster + the four v1.9 platform-config cards) and a new Organizations tab
that lists all churches and onboards a new one (org record + default `OrgSettings` + seeded default service
template + first admin assigned by email at editor tier via the server-verified membership path), and widen
the org-membership custom claim to carry all of a user's orgs+roles so `storage.rules` keeps Storage access
working for a newly-onboarded second-org admin (999.5). Full list in `.planning/REQUIREMENTS.md`.

*(Backlog 999.5 pulled into scope as a hard prerequisite for onboarding, 2026-08-21.)*

**v1.9 standing follow-ups (owner-run; carried until v1.9 lifecycle completes)**

- [ ] Run v1.9's `/gsd-verify-work 68..71` human UAT and the owner-gated v1.9 deploys (super-admin bootstrap
      script, `firestore.rules`/`storage.rules`, functions), then audit → complete → cleanup for v1.9

**Carried forward / backlog (promote with `/gsd-review-backlog` when ready)**

- [ ] Activate storage deletion after reviewing dry-run logs, and deploy the Phase 65 `firestore.rules`
      deny — v1.8 standing owner follow-ups (may be superseded once v1.9's live cleanup toggles ship)

- [ ] Harden the messaging From address to a Resend-verified domain so real volunteers receive mail —
      email is still test-mode `onboarding@resend.dev` (backlog 999.6)
- [ ] Confirm the production draft lock by hand and re-run the devtools bypass check (backlog 999.3 —
      `firestore.rules` is deployed; the hand-check is outstanding)
- [ ] Clearing a song should clear its slides, even when the song is reprised (backlog 999.2)
- [ ] Extract a shared song-browse component used by both the Songs page and the service-plan picker
      (backlog 999.1)
- [ ] Export non-song/non-scripture slots in ALL Planning Center export modes (backlog 999.4)

### Out of Scope

- Migrating existing HYMN service slots to SONG — v1.5 removes Hymn from the palette only. HYMN carries free-text `hymnName`/`hymnNumber`/`verses`; SONG requires a catalog `songId`, so conversion is lossy and any hymn absent from the catalog would become an empty slot
- Runtime Google Fonts API for slide fonts — considered and rejected in v1.5 scoping: a projector without internet at service time could not fetch the font. Curated self-hosted woff2 instead
- Per-slide font overrides — font family/weight/size is set once for all slides, by owner instruction
- Planning Center API integration — complement only, no sync (complexity too high; CSV import + manual transfer sufficient)
- ProPresenter integration — plans are created here, ProPresenter is managed separately
- Real-time collaborative editing — planners take turns, not simultaneous editing
- Mobile native app — web-first, responsive design serves mobile needs; PWA possible for v2
- CCLI reporting automation — track numbers but don't file reports
- Click track/multitracks management — handled outside this app
- Musician scheduling — NOW IN SCOPE as of Phase 13 (Volunteer Role Scheduling); volunteers are staffed in-app from a roster + quarterly CSV. See ROADMAP §Phase 13.
- Offline mode — real-time Firestore is core architecture
- Tasks & Events (TASK-01..03, EVNT-01..04) — dropped 2026-07-28; planned as Phase 5, never started, owner: "we don't need those"
- Editing imported PowerPoint slide *content* in-app — v1.4 renders PPTX server-side to images for fidelity; correcting a deck means re-importing it
- Slide editing inside the Slides tab for song groups — songs are edited only from the Song Lyrics screen, so a service can't diverge from the canonical song

## Context

Shipped v1.0 with 12,747 LOC (TypeScript + Vue).
Tech stack: Vue 3, Firebase (Firestore + Auth), Tailwind CSS v4, Vite, Pinia, Anthropic Claude API.
14 quick-task UX improvements shipped after core phases (autosave, hymn slots, infinite scroll, settings, rotation visibility).
Dark mode is the canonical app theme (gray-950 body, gray-900 cards/sidebar).

**Vertical Worship Methodology:**
The worship service follows a deliberate emotional and spiritual arc:
- **1 Songs** — Call to worship. General, energetic, inviting. "Us and God" moment.
- **2 Songs** — Intimate. Speaking directly to God. "Me and God" moment.
- **3 Songs** — Ascription. Mighty declarations about God.

Four worship songs at the start follow either 1-2-2-3 or 1-2-3-3 progression, plus a sending song after the message.

**Standard Service Order:**
1. Worship Song (1)
2. Scripture Reading
3. Worship Song (2)
4. Prayer Moment
5. Scripture Reading
6. Worship Song (2 or 3)
7. Worship Song (3)
8. Message
9. Sending Song

**Scripture Selection Rules:**
- 6-10 verses (not too long, not too short)
- Don't duplicate the pastor's teaching passage
- Lean into the Psalms when in doubt

**Song Rotation:** Avoid using the same song more than ~2 weeks in a row. Rotate through the entire stable.

**Team Configurations:** Services may include Choir, Orchestra, or be Special Services. This constrains which songs are available since not all songs have parts for every team.

**Existing Workflow:**
- Plan 2 weeks prior to service
- Email participants 11-12 days before
- Print orders of service for rehearsal (Wednesday) and Sunday
- Weekly pastor meeting
- Rehearsal Wednesday evening + Sunday morning
- Master Worship Schedule prepared 3x/year

**Task Categories:**
Administrative, Communication, Rehearsal, Service time, Training, Physical setup, Technical (Soundboard, Equipment, Programming)

## Constraints

- **Frontend**: Vue 3 — team preference, non-negotiable
- **Backend**: Firebase (Firestore + Authentication) — chosen for Google auth integration and speed of development
- **Auth**: Google OAuth + email/password — must support both methods
- **Relationship to Planning Center**: Complement only — no API integration, data flows via CSV import and manual transfer
- **Team size**: 2-3 active planners, potential expansion to musicians/techs viewing plans

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vue 3 frontend | Team preference and familiarity | ✓ Good — 12.7k LOC, fast development |
| Firebase backend | Google auth native support, fast development, real-time capable | ✓ Good — Firestore onSnapshot powers real-time UI |
| Complement Planning Center (not replace) | PC is entrenched, too complex to replicate — focus on the planning brain | ✓ Good — CSV import + text export covers the bridge |
| CSV import for songs (not API) | Simpler, Planning Center export already available | ✓ Good — PapaParse handles PC CSV format well |
| Vertical Worship methodology as core model | This is how the team plans — the app should encode this knowledge | ✓ Good — VW type system is the app's differentiator |
| Smart suggest + manual override | Best of both — speed of suggestions, freedom to customize | ✓ Good — rotation-based + AI suggestions combined |
| Dark mode as canonical theme | Team preference for dark UI | ✓ Good — gray-950/900/800 palette consistent throughout |
| Denormalize song snapshots into service slots | Avoid N+1 reads at render time | ✓ Good — fast service loading |
| signInWithPopup over signInWithRedirect | Redirect broken in modern browsers (Chrome M115+, Firefox 109+, Safari 16.1+) | ✓ Good — reliable cross-browser |
| onSnapshot in Pinia stores (not VueFire) | VueFire composables don't work inside Pinia stores | ✓ Good — real-time sync with clean store API |
| Anthropic Claude for AI features | Cost-efficient haiku model, graceful degradation if unavailable | ✓ Good — AI is additive, never blocking |
| Editor/viewer RBAC with invite-based onboarding | Simple role model matching team structure | ✓ Good — viewers get read-only services, editors get full access |
| Teleport to body for dropdowns/slide-overs | Escape AppShell overflow-y-auto stacking context | ✓ Good — consistent z-index behavior |
| Autosave with debounce + one-step undo | Better UX than explicit save buttons | ⚠️ Revisit — v1.4: song changes never fired autosave and saves were invisible above the fold |
| Service order is the single source of truth for slide order | Two orderings that can disagree is the root of the mirroring bugs; a review step just asks the user to referee a conflict the app created | — Pending (v1.4) |
| Song groups read-only in the Slides tab | Songs are canonical (D002); editing them per-service reintroduces the wrong-slides-at-rehearsal problem | — Pending (v1.4) |
| PPTX rendered server-side to images | Only way to get true fidelity — backgrounds, fonts, charts, effects. Trades in-app editing of imported decks, which was never a real workflow | — Pending (v1.4) |
| Draft-only editing with explicit reopen | A planned/exported service has been communicated to people; silent edits desync rehearsal and Planning Center | — Pending (v1.4) |
| Persistent inline save status over per-save toasts | A 500ms debounce makes success toasts constant noise; failures are the signal worth interrupting for | — Pending (v1.4) |
| Share token persisted on the service, snapshot auto-refreshed | One root cause behind both "the link changed" and "my role overrides aren't showing" — the token was re-minted per share and the snapshot frozen at share time | — Pending (v1.5) |
| Org membership on a custom auth claim | `firestore.exists()` is permanently inert in the Storage emulator (firebase-js-sdk#6803), so a cross-service rule can never be verified locally — the blind spot that shipped a deny-everyone rule | — Pending (v1.5) |
| Curated self-hosted fonts over the Google Fonts API | A projector without internet at service time cannot fetch a remote font; slides must render identically offline | — Pending (v1.5) |
| Org service template replaces `buildSlots()` | Churches outside this one do not run a 1-2-2-3 Vertical Worship order; the template is the structure, VW remains the song-typing layer on top | — Pending (v1.5) |
| AI gated at the `claudeApi.ts` choke point | All three AI surfaces (song suggestions, scripture discovery, congregational split) already route through one module — the toggle has exactly one place to live, and it doubles as the future paywall seam | — Pending (v1.5) |
| Blank service template eliminated | Every new service now starts from the org's Suggested Template; a blank starting point was a dead default nobody wanted | — Pending (v1.6) |
| A split song section is one logical unit | The slides that make up a split section duplicate together and keep one position-based number, so a non-technical user never sees the split leak into numbering or duplication | — Pending (v1.6) |
| Messaging recipients derive from assigned service roles | Volunteers are already staffed onto a service via the Roles tab with roster emails; teams (Band/Vocals/Tech/Other) are role groupings, so the composer reuses that data rather than a second contact list — unassigned roles simply have no email | ✓ Good — one shared resolver (client + Functions port) shipped v1.7 |
| v1.7 tracks sent + hard bounces, not opens | Bounce surfacing (via a provider webhook) is what actually prevents silently-lost mail; open-tracking adds pixels/webhook complexity and privacy questions for little planning value — deferred | ✓ Good — HMAC-verified bounce webhook live in production v1.7 |
| Email provider chosen by research, owner-approved | Provider selection is a cost + deliverability + Firebase-fit decision with a real recurring bill and a secret the owner must add to `.env.local`; the research pass surfaces options and the owner picks | ✓ Good — Resend chosen; deployed v1.7 (email still test-mode until domain verified, backlog 999.6) |
| Send path is a backend Cloud Function, deploy owner-gated | Provider API keys cannot ship to the client; mail sends through Firebase Functions holding the secret, and per the standing grant every such deploy is handed to the owner, not run autonomously | ✓ Good — key confined to `sendQueuedMessage`; owner deployed 2026-08-17 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-21 — started milestone v2.0 Multi-Church Onboarding & Owner Console Tabs (tabbed owner console + Organizations onboarding: org record + settings + seeded default template + first admin by email; widen org-membership claim for multi-org Storage, backlog 999.5 pulled in). Decisions: v2.0 major, stacks on v1.9 (code-complete, lifecycle parked with owner), church admin = existing editor role, milestone research skipped, run autonomous w/ verification deferred. Next: defining requirements → roadmap.*
