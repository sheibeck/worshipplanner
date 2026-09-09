# Project Research Summary

**Project:** WorshipPlanner
**Domain:** Subsequent-milestone feature additions to a shipped Vue 3 + Firebase worship-service planner
**Researched:** 2026-09-09
**Confidence:** HIGH

## Executive Summary

v2.15 bolts four features onto an already-mature app: a Vamps mp3-key library that plays live as slide
audio, rehearsal/report times on services (with org-level defaults), always-linked service-update emails,
and a fix for the deep-link/church-picker bug. All four researchers converged on the same conclusion: this
milestone is almost entirely *reuse* — no new npm dependencies, no new render surfaces, no new storage
mechanisms. Vamps mirror the v2.11 Song/file-upload pattern 1:1 and reuse the shipped per-slide
`audioUrl`/`audioLoop`/`AudioPlayer` pipeline; rehearsal/report times extend the app's existing plain-string
date convention with a parallel `HH:mm` time string (never a `Timestamp`); the email fix is a one-line
template change; the church-picker fix is a `localStorage` fallback layered onto the existing
`sessionStorage` mechanism.

The recommended approach is aggressive reuse with additive-only schema changes: `GroupSlideEntry.audioUrl`
gets a vamp's URL denormalized into it (with a display-only `vampId` for UI labeling), `Service` gains
optional `rehearsals[]`/`reportTime` fields, `OrgSettings` gains matching defaults, and a new
`orgs/{orgId}/vamp-files/` Storage prefix mirrors `song-files/` exactly (retention-exempt by construction,
since the cleanup sweeps use an allowlist regex that already excludes anything outside `media/`).

The headline risk is not the data model — it's live vamp audio in the multi-monitor Run outputs. Two
distinct problems compound there: (1) the existing "tap to play" autoplay-recovery UI is deliberately
stripped on non-interactive output windows, so a browser-autoplay-blocked vamp fails silently with zero
on-screen indication; and (2) all three output windows (Audience/Confidence/Video) independently call
`.play()` on the same URL, risking a triple-play echo on real speakers. Both require new UX (an "arm audio"
gesture + failure-propagation channel, and an explicit which-output(s)-are-audible decision) and must be
verified on real hardware, not unit tests. A secondary but consequential risk is that rehearsal/report times
must be threaded through two independent, hand-maintained projection builders (`buildServiceSnapshot`,
`buildRehearseAccess`) or volunteer-facing surfaces silently show nothing.

## Key Findings

### Recommended Stack

Zero new dependencies. Every capability needed is already in the app's toolkit: `HTMLMediaElement.play()`
(existing `AudioPlayer.vue`), the existing same-origin `postMessage` gesture-delegation channel
(`useOutputWindow.ts`, built for Fullscreen, extensible to an audio-unlock message), `localStorage` for
cross-tab org persistence, and `<input type="time">` + plain `HH:mm` strings for rehearsal/report times
(matching the codebase's existing `Intl`-only, no-date-library convention seen in
`todayInTimeZone`/`parsedDate`). `<input type="datetime-local">` and any date/time library (dayjs, luxon,
date-fns) were explicitly evaluated and rejected as unnecessary forks of an established plain-string idiom.

Core technologies (unchanged): Vue 3.5, Vite 7, Pinia 3, TypeScript 5.9, Firebase JS SDK 12 — sufficient
as-is for all four features.

### Expected Features

Must have (table stakes):
- Vamp = key + audio file, browsable/searchable list, modeled 1:1 on Song
- Vamp assigned to a slide auto-plays and loops until slide change/manual clear (already have the mechanism)
- Rehearsal = its own dated+timed event, distinct from the service date; multiple per service
- A single day-of report/call time, separate from service start
- Org-level defaults that pre-fill new services' rehearsal/report fields
- Rehearsal/report times shown everywhere the service date already shows (dashboard, My Schedule, volunteer
  view, share/plan views, both public projections)
- Every service-update/reminder email includes a working plan link
- Deep link/new-tab opens the intended page for a multi-church user

Should have (differentiators): vamp reuses the exact same per-slide audio pipeline as ordinary slide
audio (no separate "pad player" concept — this matches how ProPresenter actually implements pads under the
hood); countdown/"next up" framing on rehearsal/report times (reuse of the v2.12 My Schedule countdown
pattern); key-only vamp filter/search.

Defer (v2+): crossfade between vamps (needs a materially harder dual-audio-source architecture);
rehearsal location/venue field (an open decision carried over from v2.12, do not silently assume); calendar/
ICS export; multi-key vamp entries and BPM/tempo metadata are explicit anti-features — they conflict with the
owner's 1:1-with-Song model or model a property a vamp (a sustained bed, not a metered loop) doesn't have.
Auto-notify-on-every-edit is also an anti-feature — Planning Center deliberately avoids it to prevent
notification fatigue; the milestone's actual scope is narrower (guarantee the existing send always carries
the link).

### Architecture Approach

Each feature lands on a clean, additive extension point. Vamps get a new sibling entity (`Vamp` type,
`vamps.ts` store, `VampsView`/`VampSlideOver`/`VampTable` components) that mirrors `songs.ts` almost
verbatim, a new Storage prefix (`orgs/{orgId}/vamp-files/`) with its own `storage.rules` block copied from
`song-files/`, and a denormalize-at-assignment write into the existing `GroupSlideEntry.audioUrl` field (a
`vampId` reference is kept for UI display only, never read by the presentation pipeline — this keeps the
touched surface to zero changes in `slideshowAssembler.ts`, `useSlideshowAssembly.ts`, or any output view).
Rehearsal/report times are additive fields on `Service` and `OrgSettings`, flowing through
`createService`'s existing pre-fill call site and both public projection builders. The email fix is an
isolated one-line change to `ReLockNotifyPrompt.vue`'s auto-generated body. The church-picker fix is
contained entirely inside three private helper functions in `src/stores/auth.ts`.

Major components:
1. Vamps CRUD + Storage (`vamps.ts`, `useVampFileUpload.ts`, `vamp-files/` prefix + rules) — new but low-risk, closely mirrors shipped v2.11 infrastructure.
2. Vamp-to-slide assignment + live playback — the genuinely novel, highest-risk work: a UI picker plus autoplay-arming/failure-propagation/audio-ownership decisions in the Run output surfaces.
3. Rehearsal/report-time data model + display threading — additive schema + a shared sort utility + mandatory updates to both `buildServiceSnapshot` and `buildRehearseAccess`, plus every enumerated display surface.
4. Email link wiring + church-picker fix — two small, independent, low-risk defect fixes that can ship any time, in parallel with anything else.

### Critical Pitfalls

1. Silent autoplay failure in non-interactive Run outputs — the existing tap-to-retry UI is gated
   `interactive`-only and stripped on output windows; a blocked vamp fails with zero indication. Fix: arm
   audio via a real gesture on the Run/control screen (extend the existing `wp-fullscreen-delegate`
   postMessage pattern with a `wp-audio-unlock` message), and propagate `autoplay-blocked` failures back to
   the control screen as a visible warning. Must be UAT'd on a fresh browser profile with real hardware, not
   mocked `play()` unit tests.
2. Triple-play echo across Audience/Confidence/Video outputs — all three windows independently call
   `.play()` on the same URL and typically share one machine's audio output. Fix: an explicit product
   decision on which output(s) carry vamp audio (likely Audience only), implemented via a `suppressAudio`
   prop mirroring the existing `suppressBackground` mechanism on Confidence/Video.
3. Rehearsal/report times never reach `ServiceSnapshot`/`rehearseAccess` — both are hand-maintained
   allowlist projections, not live joins; adding fields to `Service` alone silently leaves volunteer-facing
   surfaces (My Schedule, share pages) showing nothing, with no compile or runtime error to catch it.
4. Timezone/format mistakes on the new time fields — never construct a `Date`/`Timestamp` from
   date+time; keep both as plain strings (`YYYY-MM-DD` + `HH:mm`), matching `Service.date`'s existing
   convention, to avoid silent reinterpretation through the viewing device's local zone.
5. Org-default retroactive drift — rehearsal/report defaults must be copied onto a service at creation
   time, never read live from `OrgSettings`, or editing the org default silently changes already-locked,
   already-shared services.

## Implications for Roadmap

Based on research, suggested phase structure (continuing from phase 138 per PROJECT.md):

### Phase 1: Church-picker deep-link fix
Rationale: Fully independent of everything else, small and isolated, ship first to get a clean win and
de-risk nothing else in the milestone.
Delivers: `localStorage` fallback (uid-scoped, mirroring existing `sessionStorage` shape) in
`src/stores/auth.ts`'s three private helpers; sign-out clears both storages; stale-membership
re-validation preserved.
Addresses: deep-link/new-tab church-picker table-stakes feature.
Avoids: Pitfall 10 (localStorage swap silently dropping sign-out cleanup, stale-membership guard, or
introducing unwanted cross-tab live sync) — treat as three explicit acceptance criteria, not an assumed
drop-in swap.

### Phase 2: Service-update email link wiring
Rationale: Also fully independent, trivial diff, can ship in parallel with anything.
Delivers: `{{service_link}}` appended to `ReLockNotifyPrompt.vue`'s auto-generated body; an
ensure-link-exists precondition before send (not a bare substitution).
Addresses: "every service-update email links to the plan" table-stakes feature.
Avoids: Pitfall 9 (empty-string link substitution for legacy/auto-generation-failure services).

### Phase 3: Rehearsal/report-time data model + org defaults
Rationale: Everything else in this feature area displays what this phase defines — types and defaults
should land before any UI is built on top of them.
Delivers: `Service.rehearsals[]`/`reportTime` and `OrgSettings.rehearsalDefaults`/`reportTimeDefault`
(both additive, `HH:mm` plain strings, no `Timestamp`); a shared `sortRehearsals` utility; `createService`
pre-fill from org defaults (copy, not live-read).
Uses: `<input type="time">`, plain-string storage per STACK.md.
Implements: Pattern 3 (additive-only, no-migration schema growth) from ARCHITECTURE.md.
Avoids: Pitfalls 5, 6, 7 (timezone mishandling, array-ordering drift, org-default retroactive mutation)
— all three must be decided and tested at this phase, before the editor UI phase builds on top.

### Phase 4: Rehearsal/report-time editor UI + display threading
Rationale: Depends on Phase 3's shapes existing; the highest-complexity item in the milestone because it
touches 4+ display surfaces plus both public projections.
Delivers: "Times" panel in `ServiceEditorView.vue`; Settings "Rehearsal & Report Defaults" section;
`buildServiceSnapshot`/`buildRehearseAccess` updated together; display added to dashboard, `ServiceCard`,
`ScheduleServiceCard` (closing its own already-documented gap), `ShareView`, `VolunteerServiceView`.
Addresses: "times shown everywhere the date already shows" table-stakes feature.
Avoids: Pitfall 8 (projections not threaded) — require touching all three call sites in one phase, with
a test mirroring `services.sharePii.test.ts` asserting the new fields appear in both projections.

### Phase 5: Vamps CRUD + Storage
Rationale: Vamp assignment (Phase 6) depends on vamps existing; the Storage/rules layer must exist
before any real upload can succeed even in the emulator.
Delivers: `src/types/vamp.ts`, `src/utils/vampFiles.ts`, `src/stores/vamps.ts`,
`src/composables/useVampFileUpload.ts`, `VampsView.vue`/`VampSlideOver.vue`/`VampTable.vue`, sidebar nav +
route, `storage.rules` `vamp-files/` block mirroring `song-files/`.
Uses: v2.11 file-upload pipeline pattern (STACK.md, ARCHITECTURE.md Pattern 1).
Avoids: Pitfall 4 (storage.rules `firestore.exists()`-in-emulator blind spot) — annotate expected-local-
failure allow-cases from day one; verify the real upload in a deployed environment before ship, don't trust
a green local rules-test run.

### Phase 6: Vamp-to-slide assignment + live playback (headline-risk phase)
Rationale: The one phase with a genuine, unverified UX/hardware risk; must not be treated as "just wire
the picker" — the autoplay/echo problems are the actual substance of this phase.
Delivers: `GroupSlideEntry.vampId` field + "Choose a Vamp" picker in `EditSlideDrawer.vue`, writing the
vamp's `audioUrl` into the existing field (denormalized, per Pattern 2); an "arm audio" gesture on the
Run/control screen extending the existing fullscreen-delegation postMessage channel; failure-propagation
back to the control screen; an explicit owner decision on which output(s) (Audience/Confidence/Video) carry
vamp audio, implemented via a `suppressAudio` prop mirroring `suppressBackground`.
Addresses: the Vamps live-playback feature (the actual point of the Vamps entity).
Avoids: Pitfalls 1, 2, 3 (silent autoplay failure, triple-play echo, stale denormalized URL on
edit/delete) — all three must be explicit acceptance criteria and verified on real multi-monitor hardware
with real speakers, not unit-test mocks.

### Phase Ordering Rationale

- Phases 1-2 are pure defect fixes with zero cross-dependency on the rest of the milestone — sequencing
  them first (or in parallel) delivers value immediately and de-risks nothing else, which is exactly why
  they're cheap to front-load.
- Phases 3-4 (rehearsal/report times) must be split data-model-first, UI-second, because the data-model
  decisions (plain strings, shared sort, copy-not-live-read defaults) are exactly the ones the pitfalls
  research flags as needing to be locked down before any consumer builds on top of them.
- Phases 5-6 (Vamps) have an internal ordering constraint architecture research calls out explicitly: rules
  before store, store before UI, UI before slide-assignment. Phase 6 is deliberately isolated as its own
  phase (not folded into Phase 5) because it carries the milestone's one real, hardware-dependent risk and
  deserves its own explicit UAT gate rather than being verified incidentally as part of CRUD work.

### Research Flags

Phases likely needing deeper research/discussion during planning:
- Phase 6 (Vamp-to-slide assignment + live playback): needs an explicit owner decision on which output(s)
  carry audio (especially whether Video/OBS output should be audible at all) before implementation — this is
  a product decision the research surfaced but did not resolve.
- Phase 3 (rehearsal/report-time data model): needs an explicit decision on how the org rehearsal-time
  default represents/pre-fills a per-service date (a fixed "N days before service" offset vs. the planner
  manually dating each occurrence) — PITFALLS/ARCHITECTURE both flag this as unresolved.

Phases with standard, well-documented patterns (skip research-phase):
- Phase 1 (church-picker fix): minimal diff, exact code-level recommendation already produced by research.
- Phase 2 (email link wiring): root cause and fix are already fully diagnosed.
- Phase 5 (Vamps CRUD + Storage): a structural mirror of the already-shipped v2.11 Song pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified against official vendor docs (Chrome autoplay policy, MDN, Firebase SDK docs) and cross-checked directly against this codebase's own existing code |
| Features | MEDIUM | Vamp/pad conventions and PC rehearsal/call-time model corroborated across multiple independent sources, but no single authoritative doc page was fetchable for PC's exact rehearsal-time UI (relied on search-snippet summaries in places) |
| Architecture | HIGH | Every claim grounded in direct reads of the real source files (types, stores, router, storage rules, cleanup sweeps) on this pass |
| Pitfalls | HIGH | Every pitfall cites specific file/line evidence from the actual v2.14 source, not generic advice |

Overall confidence: HIGH

### Gaps to Address

- Video output audio: whether the Video/OBS-feeding output should carry vamp audio at all is an open
  product decision — default to muted there until the owner decides otherwise, per PITFALLS/ARCHITECTURE.
- Rehearsal venue/location field: flagged as an open decision carried over from v2.12 ("venue/call-time
  card fields") — resolve explicitly in requirements rather than silently expanding or silently dropping
  scope.
- Vamp delete-in-use behavior: hard-block vs. advisory-warn when a vamp is assigned to an upcoming
  service's slide — architecture research recommends advisory-only (matching the codebase's general
  preference for warnings over hard locks) but this should be confirmed as a requirement, not assumed.
- Org rehearsal-default to per-service date mapping: the org default can only be time-of-day (it can't
  know a future service's date); how it becomes a dated rehearsal on a new service ("N days before" vs.
  manual dating) needs an explicit decision at requirements/planning time.
- Timezone display policy: assume report/rehearsal times display as the literal time entered, never
  zone-shifted per viewer (single physical venue) — confirm this assumption explicitly as a product decision
  rather than leaving it implicit.

## Sources

### Primary (HIGH confidence)
- Chrome for Developers — "Autoplay policy in Chrome" (official vendor doc on per-origin autoplay gating)
- Chromium.org — "Autoplay" / "Autoplay Policy Design Rationale"
- MDN — "Autoplay guide for media and Web Audio APIs"
- Firebase JS SDK docs — `auth.persistence.md` (default `browserLocalPersistence` behavior)
- Direct reads of this codebase: `src/stores/auth.ts`, `src/router/index.ts`, `src/components/AudioPlayer.vue`,
  `src/composables/useOutputWindow.ts`, `src/components/slides/SlideCanvas.vue`,
  `src/components/output/FullscreenSlideOutput.vue`, `src/views/ConfidenceOutputView.vue`,
  `src/types/service.ts`, `src/types/organization.ts`, `src/types/slideGroup.ts`,
  `src/utils/serviceProjection.ts`, `src/utils/rehearseAccess.ts`, `src/composables/useSongFileUpload.ts`,
  `src/utils/songFiles.ts`, `storage.rules`, `functions/src/index.ts`, `functions/src/messageTokens.ts`,
  `functions/src/cleanupSweeps.ts`, `src/components/ReLockNotifyPrompt.vue`, `.planning/PROJECT.md`

### Secondary (MEDIUM confidence)
- Worship Tutorials — "How to trigger Pads (or any audio file) in ProPresenter"
- PraiseCharts, Loop Community, Sweetwater InSync — pad/vamp convention corroboration
- Planning Center Services help/blog articles on rehearsal Times and scheduling emails

### Tertiary (LOW confidence)
- caniuse.com `navigator.getAutoplayPolicy` support surface (aggregator, directional only)
- General church-presentation-software landscape overviews (context only)

---
Research completed: 2026-09-09
Ready for roadmap: yes
