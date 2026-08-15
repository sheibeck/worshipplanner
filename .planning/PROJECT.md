# WorshipPlanner

## What This Is

A worship service planning app for church worship teams that builds weekly service orders using the Vertical Worship methodology. It manages a song stable with CSV import, suggests songs based on VW category and rotation, provides AI-powered song and scripture discovery, and delivers printable/shareable service plans with team RBAC. Built with Vue 3 and Firebase, it complements Planning Center — you plan here, then execute there.

## Core Value

Smart weekly service planning that follows the Vertical Worship methodology (1→2→3 song progression) while rotating through the full song stable and respecting team configurations.

## Current Milestone: v1.8 Messaging UX & Fixes

**Goal:** Refine the shipped v1.7 messaging feature from owner UAT — a dedicated Messages tab, a
delivery history that stays visible when the service locks, roster-matching team labels, a working
add-individual, a live email preview, corrected merge tokens, a sending spinner, and message types that
actually seed distinct content. Continues phase numbering (Phases 63–64) and the `R###` scheme
(R149–R156). **v1.7 remains open** — its send path is UNDEPLOYED and its owner deploy/verify steps are
tracked in `.planning/PENDING-VERIFICATION.md`; v1.8 stacks on top rather than waiting on that.

**Target changes (from live testing of v1.7 messaging):**
- **Messages tab** — move the per-service Messaging defaults + "Sent on this service" history out of the
  Service Order tab into a dedicated tab; the ✉ composer stays an action-bar modal.
- **History always visible** — fix the Phase 60 defect where the history vanishes once the service locks
  (it was gated on `canEditService`).
- **Composer fixes** — Send-To labels mirror Volunteer Roles (Band/Vocals/Tech/Other, dropping
  Worship/Hosts); "+ Add someone" actually adds an individual; live real-time email preview; remove the
  `{{song_list}}` token and add a per-recipient `{{name}}` token; a sending spinner; and message types
  (One-off / Reminder / Share service link) that seed distinct subject/body/recipient defaults.

See `.planning/REQUIREMENTS.md` (v1.8 section, R149–R156) and `.planning/ROADMAP.md` (Phases 63–64).

<details>
<summary>Previous milestone — v1.7 Volunteer Messaging & Notifications (code-complete + verified GREEN 2026-08-15; owner deploy/verify pending)</summary>

**Goal:** Let planners email the volunteers scheduled on a service — targeted messages to teams or
individuals, automatic notifications when a service is locked/re-locked (with a scoped change diff),
and a scheduled "here's the link" reminder — all governed by a global on/off switch in Settings.

**Target features:**
- **Messages composer** — a ✉ Messages button on the service opens a composer whose recipients are
  **teams first** (Worship, Tech, Vocals, Hosts, "Everyone on this service"), with individuals added
  below; message types One-off / Reminder / Share service link; subject + body with insertable tokens
  (service date, service link, their roles, song list); attach-service-order-link, send-me-a-copy, and
  schedule-for-later options; a live "Reaches N people" recipient count.
- **Lock notification** — when a service is locked, optionally email everyone assigned (their roles,
  the song list, and a link to the service order).
- **Re-lock change notice** — after editing a locked service and re-locking, prompt to notify with a
  **scoped diff** of what changed (typed SONG / ORDER / ROLE / NOTES / SLIDES entries, each checkable
  and tagged with affected teams), sending only to affected teams or to everyone; Lock quietly is
  always available.
- **Scheduled share-link reminder** — auto-send the shared service link to everyone assigned N days
  before the service (default 7), skipped while the service is still a draft.
- **One-off reminders** — ad-hoc reminder emails to chosen teams/individuals.
- **Delivery history & status** — a per-service "Sent on this service" log with sent counts and
  **hard-bounce** surfacing (sent + bounces tracking; open-tracking is out of scope for v1.7).
- **Email infrastructure** — a provider (chosen by research, owner-approved) wired through a backend
  send path; provider API key lives in `.env.local` and the send function deploys are **owner-gated**.
- **Settings kill-switch** — turn messaging off entirely from the main Settings screen; per-service
  automatic-email defaults inherit from Settings.

**Key context:** Recipients derive from the roles assigned on the service (roster emails from the
existing Volunteer Role Scheduling / Roles tab) — unassigned roles have no email. Sending mail is a
backend concern requiring a provider secret in `.env.local` (owner-added) and a Cloud Function deploy
(owner-gated), consistent with the standing no-deploys / no-`.env.local`-writes rules. Design imported
from the Claude Design project "Worship Planner Slideshow Design" (canvas *Turn 5 — Messaging
volunteers*, panels 5a composer / 5b lock + automatic mail + history).

</details>

## Current State

**Shipped:** v1.0 MVP (Phases 1–4, 6–7) · v1.1 (Phases 8–17) · v1.2 Worship Service Slide Management
(Phases 18–23) · v1.3 Slides Tab Rework (Phases 24–28) · v1.4 Service and Slides (Phases 29–38,
shipped 2026-08-05) · **v1.5 Settings, Sharing, and Fidelity (Phases 39–50, shipped & deployed to
production 2026-08-10)** — all archived.

**Open:** v1.7 Volunteer Messaging & Notifications is being scoped (`/gsd-new-milestone`). v1.5
delivered per-church settings & feature toggles, custom-auth-claim org membership, sharing correctness,
PPTX rendered-image display, service item types, default service template, ESV/NLT Bible selection,
global slide typography, congregational reading UX, multi-image/mobile polish, and slide
bulk-delete/provenance/render-fidelity. Phase 50 was genuinely verified (incl. live R109/R108 in
production); Phases 39, 43–49 were owner-accepted at milestone close on the basis of the production
deploy + real-world use.

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

<!-- v1.7 Volunteer Messaging & Notifications — scoped 2026-08-13. REQUIREMENTS.md carries the
     REQ-ID-level detail; this section is the narrative summary. -->

**v1.7 — new this milestone**

- [ ] A ✉ Messages button on a service opens a composer whose recipients are teams first
      (Worship/Tech/Vocals/Hosts/Everyone), with individuals added below
- [ ] Compose a One-off message, a Reminder, or a Share-service-link message with subject, body, and
      insertable tokens (service date, link, their roles, song list)
- [ ] Composer shows a live "Reaches N people" count and options to attach the service-order link,
      send me a copy, and schedule for later
- [ ] Locking a service can automatically email everyone assigned (roles, song list, service link)
- [ ] Re-locking an edited service prompts to notify with a scoped, checkable change diff and sends
      only to affected teams or to everyone; Lock quietly is always available
- [ ] The shared service link auto-sends to everyone assigned N days before the service (default 7),
      skipped while still a draft
- [ ] A per-service delivery history logs sent messages and surfaces hard bounces
- [ ] Messaging can be turned off entirely from the main Settings screen; per-service automatic-email
      defaults inherit from Settings
- [ ] Email sends through an owner-approved provider via a backend send path (provider key in
      `.env.local`, deploy owner-gated)

**Carried forward / backlog (not v1.7 scope unless promoted)**

- [ ] Confirm the production draft lock by hand and deploy `firestore.rules` (backlog 999.3 — the
      deploy is the owner's step)
- [ ] Clearing a song should clear its slides, even when the song is reprised (backlog 999.2)
- [ ] Extract a shared song-browse component used by both the Songs page and the service-plan picker
      (backlog 999.1)

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
| Messaging recipients derive from assigned service roles | Volunteers are already staffed onto a service via the Roles tab with roster emails; teams (Worship/Tech/…) are role groupings, so the composer reuses that data rather than a second contact list — unassigned roles simply have no email | — Pending (v1.7) |
| v1.7 tracks sent + hard bounces, not opens | Bounce surfacing (via a provider webhook) is what actually prevents silently-lost mail; open-tracking adds pixels/webhook complexity and privacy questions for little planning value — deferred | — Pending (v1.7) |
| Email provider chosen by research, owner-approved | Provider selection is a cost + deliverability + Firebase-fit decision with a real recurring bill and a secret the owner must add to `.env.local`; the research pass surfaces options and the owner picks | — Pending (v1.7) |
| Send path is a backend Cloud Function, deploy owner-gated | Provider API keys cannot ship to the client; mail sends through Firebase Functions holding the secret, and per the standing grant every such deploy is handed to the owner, not run autonomously | — Pending (v1.7) |

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
*Last updated: 2026-08-13 — v1.7 (Volunteer Messaging & Notifications) scoped via `/gsd-new-milestone`. Next: research → requirements → roadmap.*
