# WorshipPlanner

## What This Is

A worship service planning app for church worship teams that builds weekly service orders using the Vertical Worship methodology. It manages a song stable with CSV import, suggests songs based on VW category and rotation, provides AI-powered song and scripture discovery, and delivers printable/shareable service plans with team RBAC. Built with Vue 3 and Firebase, it complements Planning Center — you plan here, then execute there.

## Core Value

Smart weekly service planning that follows the Vertical Worship methodology (1→2→3 song progression) while rotating through the full song stable and respecting team configurations.

## Current State

**Shipped:** v1.0 MVP (Phases 1–4, 6–7) · v1.1 (Phases 8–17) · v1.2 Worship Service Slide Management
(Phases 18–23) · v1.3 Slides Tab Rework (Phases 24–28) · **v1.4 Service and Slides (Phases 29–38,
shipped 2026-08-05)** — all archived.

**Open:** **v1.5 Settings, Sharing, and Fidelity** — scoped 2026-08-06, phases 39+.

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

## Current Milestone: v1.5 Settings, Sharing, and Fidelity

**Goal:** Make the app configurable per church — settings that turn features on and off and set the
house style — while fixing the sharing and fidelity defects that make a service plan not match what
was actually planned.

**Target features:**

- **Carryover from v1.4** — build the client-side display of rendered PPTX images (R062's missing
  half: nothing in `src/` reads `pptxRenders` or the `rendered/*.png` objects today), and move org
  membership onto a **custom auth claim** so `storage.rules` becomes testable in the emulator rather
  than merely working in production.
- **Sharing correctness** — one permanent share link per service that never rotates, with the shared
  snapshot auto-refreshing on every service change so role overrides publish without re-sharing.
- **Settings — new configurability** — an AI integration toggle gating every AI surface; a Planning
  Center integration toggle; ESV-or-NLT Bible version selection; a Services slide-out defining the
  default template for a new blank service; a Slides slide-out setting global font family, weight
  and size.
- **Service items** — add Announcements and Miscellaneous (both plain input boxes), reduce Message
  to an input box with no URL link, and remove Hymn from the add-item palette.
- **Congregational reading** — a real divider UX for Leader / Congregation / All settled by a UI
  research phase, with the AI-assisted split retained but gated by the AI toggle; the first slide
  shows the scripture reference and later slides show only speaker labels.
- **Slides & media** — deterministic ordering for multi-image import (JPEG already imports fine; the
  *order* is browser-supplied and effectively nondeterministic).
- **Mobile & layout** — a mobile-friendly Slides tab; stacked buttons on the service edit screen as
  the Schedule screen already does; Print and Share moved from the page bottom into the contextual
  top action bar; Undo demoted to a link beside the last-saved text; a dismissible Getting Started
  panel on the dashboard.

**Resolved during scoping (2026-08-06) — three items were investigated rather than assumed:**

| Question asked | What the code / cloud actually showed |
|---|---|
| Does `pptx-render-sa` exist, or is Cloud Run on a default identity? | **It exists and is in use.** `pptx-render` runs as `pptx-render-sa@worship-planner-bc515.iam.gserviceaccount.com`, exactly the least-privilege identity DEPLOY.md specifies. **No divergence — dropped from scope, not a phase.** |
| Are JPEGs supported on image drop, and how are multiple images ordered? | **JPEG already works** — `dropRouting.ts:51` classifies on `file.type.startsWith('image/')`, so JPEG/PNG/WebP/GIF all route to the image bucket. **Ordering is the real gap:** `classifyFiles` preserves the browser's `DataTransfer` order, which for a multi-file OS drag is selection/filesystem order, not name order. |
| Why does sharing mint a new link, and why are role overrides stale? | **One root cause, not two.** `services.ts:353` `createShareToken()` mints a fresh random 36-char token on *every* call and freezes a `serviceSnapshot` — including resolved `roleAssignments` — into it at that moment. A stable memorable URL (`serviceShares/{slug}__service-{date}`) already exists and is overwritten in place; it just carries the same frozen snapshot. |

**Milestone decisions** (settled during scoping, 2026-08-06):

| Question | Decision |
|---|---|
| Share link stability | **Persist the token on the service doc** — minted once, never rotated. Refresh the snapshot automatically whenever the service changes, so overrides publish without re-sharing. Keeps the D-04/D-24 PII guard (names only, no emails) intact — a live read would have needed roster access. |
| Removing the Hymn item | **Palette-only removal.** `createSlot('HYMN')` leaves the add-item palette; `slotLabel`, the assembler and all rendering stay. Existing production HYMN slots keep working. No migration — HYMN carries free-text `hymnName`/`hymnNumber`/`verses` that SONG (which requires a catalog `songId`) cannot represent losslessly. |
| Slide fonts | **Curated, self-hosted woff2 list — not the runtime Google Fonts API.** Chosen after the runtime-catalog option was first selected and then reversed: a projector without internet at service time cannot fetch a remote font. The model is **family + weight + size**, because "Helvetica Neue Light" is a weight and a family-only picker cannot reach it. **Inter** is the Helvetica Neue stand-in (Light = 300, Regular = 400). Final list settled by the UI research phase against projection legibility. |
| Default service template vs. Vertical Worship | **The org template replaces `buildSlots()`** as the source of a new blank service's structure. When VW mode is on, the song slots in that template still receive required VW types from the chosen progression; with VW off they are untyped. `buildSlots()` becomes the fallback default template rather than the authority. |
| PPTX rendered display | **The rendered PNG *is* the slide** — drawn in the grid and in the presenter. Parsed text stays in the document for search, labels and accessibility but is never drawn. The alternative (PNG as background with text overlaid) would draw the deck's own text twice. Owner's framing: *"import the powerpoint so that the slides look like they natively looked in the powerpoint presentation."* |
| NLT Bible version | Key is already in hand. `NLT_API_KEY` joins `ESV_API_KEY` in `.env.local` and proxies through the same Cloud Function pattern. |
| Milestone structure | **One v1.5, phased by theme** rather than split across v1.5/v1.6. |

**Why the storage.rules item is scoped as "make it testable," not "make it work":** production was
fixed on 2026-08-05 by an IAM grant, and uploads work. But
[firebase-js-sdk#6803](https://github.com/firebase/firebase-js-sdk/issues/6803) means
`firestore.exists()` is permanently inert in the Storage emulator, so the rule can never be verified
locally. That is the precise blind spot that let a deny-everyone rule reach production. Moving
membership onto a custom claim makes the check work in both environments. See CLAUDE.md.

## Previous Milestone: v1.4 Service and Slides (SHIPPED 2026-08-05)

> Archived. Full record: [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md) ·
> [milestones/v1.4-REQUIREMENTS.md](milestones/v1.4-REQUIREMENTS.md). Retained below for context until
> v1.5 is scoped.

**Goal:** Make the Service Order and Slides tabs trustworthy — ordering that holds, saves you can see,
slides that always mirror the plan — and finish them against the Claude Design wireframes.

**Target features:**

- **Service lifecycle** — a service is editable only in Draft; Service Order, Slides and Roles all lock
  at `planned`/`exported`, with an explicit "Reopen for editing" that reverts to draft (warning when the
  service was already exported to Planning Center). New-service date defaults to the nearest Sunday that
  does not already have a plan.
- **Save reliability** — repair Service Order autosave (changing a song never fired it) and give the
  whole app one persistent inline "Saving… / Saved HH:MM" indicator anchored to the content being
  edited, with a toast reserved for save *failures*.
- **Order structure** — add a fifth **Post-Service** section; fix service-item drag-and-drop so the five
  sections (Pre-Service → Worship → Message → Sending → Post-Service) are fixed, always visible, and
  never reorderable, and so a drop lands the dragged item without a refresh to correct the view.
- **Slides mirror the plan** — slide-group order and membership are hard-locked to the service order.
  Swapping a song silently rewrites its slides; changing a scripture passage updates its slide. The
  reconcile/confirm review flow is removed entirely.
- **Slides interaction** — fix drag-reorder reverting and new slides landing second-to-last; replace
  click-to-edit with a 3-dot menu opening separate "Edit details" / "Edit lyrics" drawers; make the drop
  zone the import affordance; move Add slide / Add music into a contextual action bar; make song groups
  read-only here; start Present at the highlighted group and slide.
- **Backgrounds** — background image for a whole slide group, for a single slide, and for a song (set
  from the Song Lyrics editor). Per-slide audio loses its "all slides in this group" scope.
- **Presentation correctness** — organizational labels never render when presenting; copyright is
  visible on the first and last slide of every song group.
- **Smarter content** — slide-editing options vary by service-item type, with LLM-assisted congregational
  reading splits (leader/congregation) for scripture. PowerPoint import renders slides server-side to
  images for true visual fidelity, retaining parsed text as a layer.
- **Lyric editor** — copyright detection and warning on CCLI paste; paste-lyrics inline instead of in a
  modal.
- **UI rework** — Service Order tab rebuilt against design "Turn 3"; contextual action bars applied
  across every tabbed screen; Roles tab moved to last.

**Design source:** Claude Design project `Worship Planner Slideshow Design`
(`e8e6c287-3e88-402f-88e1-7ad6d5101fa2`) — `Slides Tab.dc.html` plus `support.js` and 11 reference
images. Read via the `DesignSync` tool (`/design-login` if unauthorized). The Present-button spec is in
*"1a Plan rail · slide grid · Edit Slide drawer — two states"*; the Service Order rework is *"Turn 3"*;
the lyric-editor copyright and inline-paste treatments are also specified there.

**Milestone decisions** (settled during scoping, 2026-07-28):

| Question | Decision |
|---|---|
| Draft lock escape hatch | Editors can **Reopen for editing** (revert to draft); warn when already exported |
| PowerPoint fidelity | **Render server-side to images**; keep parsed text as a searchable/label layer |
| Slide reconciliation | **Delete it** — service order is the single source of truth, slides always auto-mirror |
| Save feedback | **Persistent inline status**, toast on failure only |
| Contextual buttons | **Audit every tabbed screen**, one shared action-bar pattern |

**Reproduction case for the drag-and-drop defect:** service `ZTXcpNRcJTalEQp42fTx` — sections rendered
out of order (Sending mid-list, Message last, Worship twice) after repeated reordering, correct again
only after a page refresh.

## Requirements

### Validated

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

<!-- v1.5 Settings, Sharing, and Fidelity — scoped 2026-08-06. REQUIREMENTS.md carries the
     REQ-ID-level detail; this section is the narrative summary. -->

**v1.5 — new this milestone**

- [ ] Every church can turn AI features off, and turning them off removes all AI interaction
- [ ] Every church can turn Planning Center integration off once they have fully ported off it
- [ ] Scripture can be pulled from ESV or NLT, chosen in Settings
- [ ] A church can define the default template for a new blank service
- [ ] A church can set one font family, weight and size for every slide
- [ ] A service's share link never changes, and always shows the current plan and role overrides
- [ ] Announcements and Miscellaneous exist as service items; Message is a plain input box
- [ ] Congregational readings can be divided into Leader / Congregation / All by hand, and the
      first slide carries the scripture reference
- [ ] Importing several images at once produces a predictable slide order
- [ ] The Slides tab and the service edit screen are usable on a phone

**Carried forward from v1.4**

- [ ] **PowerPoint imports look like the original PowerPoint** — carried forward from v1.4, now
      **half done**. The backend was deployed 2026-08-06: Cloud Run `pptx-render` (us-central1,
      private — 403 unauthenticated), `PPTX_RENDER_SERVICE_URL` wired into functions, all five
      functions redeployed. R062 stays `[~]` because the remaining half is the one that makes the
      requirement true for a user: **build the client-side display.** Nothing in `src/` reads
      `pptxRenders` or the `rendered/*.png` objects, so imports currently render images into Storage
      that the app never shows. This is the piece that has never had a home in the roadmap.
      <br>**Infrastructure is confirmed working** — the owner exercised a real import against
      production on 2026-08-06 and approved it, which resolves both prior unknowns (the `run.invoker`
      binding and `STORAGE_BUCKET`) since each fails closed and loudly. The only thing standing
      between here and R062 being genuinely true is the display work.
- [ ] **Confirm the production draft lock by hand** (backlog Phase 999.3, deploy half done) — the
      rules layer was deployed 2026-08-05, so Phase 31's lock now runs on all three layers. What is
      still unverified is its *behaviour* in production: set a service to Planned, open devtools,
      attempt a direct Firestore write, expect permission denied. Currently inferred from the
      emulator suite, never observed live.
- [ ] Clearing a song should clear its slides, even when the song is reprised (backlog Phase 999.2)
- [ ] Extract a shared song-browse component used by both the Songs page and the service-plan picker
      (backlog Phase 999.1)

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
*Last updated: 2026-08-06 after scoping milestone v1.5 (Settings, Sharing, and Fidelity)*
