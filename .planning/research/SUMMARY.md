# Project Research Summary

**Project:** WorshipPlanner — v2.7 (Presentation Polish & Multi-Org Usability)
**Domain:** Feature-integration research for a mature Vue 3 + Firebase worship-service planning app
**Researched:** 2026-08-31
**Confidence:** HIGH

## Scope Note (owner narrowed scope after research was commissioned)

Research was originally commissioned for eight feature areas. The owner has since **deferred two
of them to a future milestone**: (a) song rehearsal attachments (PDF/MP3/YouTube) and (b) Rehearse
mode on the public shared link. This SUMMARY, and the roadmap it feeds, cover **only the six
in-scope v2.7 features** below. The deferred cluster is summarized separately at the end so its
findings — especially the security/cost risk — aren't lost before the future milestone picks it up.

## Executive Summary

v2.7 is a **pure integration milestone** against a mature codebase — every in-scope feature reuses
an existing mechanism rather than introducing new architecture, and the stack research concluded
**zero new npm dependencies are required**. The six features are: an inline black slide in the
lyric editor, scoping "Go to black" to the Audience output only, a system-wide dismissible
message/banner store, a per-item loop timer in Run mode, a user-menu church switcher for
multi-org members, and a freeform visual stage-layout canvas per service. All six trace directly
to existing, already-proven patterns in this codebase: the pooled-section slide model, the
single-writer runChannel/useRunControl broadcast discipline, the existing (if too-narrow)
toasts.ts Pinia store, the already-hardened selectOrg()/resetOrgScopedStores() multi-org
reset path, and Pointer Events for freeform drag (a genuinely new interaction pattern for this
app, but a native-API one, not a new library).

The recommended approach is dependency-honoring, not feature-parallel: build the **cross-cutting
UI primitives first** (the dismissible-message store, the church switcher) since they are fully
decoupled from everything else and de-risk the rest of the milestone quickly, then the **isolated
Run-flow fixes** (audience-only blackout, black slide, loop), and **stage layout last**, since it
is architecturally independent but the single largest, riskiest, most novel build (a new freeform
canvas interaction pattern with its own data model and Firestore rules block).

The dominant risk pattern across all four research files is **this app's own repeated history of
drag-and-drop corrupting state** (v1.4 phantom duplicates, v1.6 drag-into-section bugs) — the
stage-layout canvas is new freeform x/y drag code with no existing precedent to reuse, so it needs
its own careful design (Pointer Events, percentage coordinates, debounced persistence, real
touch-device testing) rather than treating it as "just another drag feature." The secondary risk
is a **notification-system collision**: toasts.ts is deliberately narrow (failure-only, 6s
auto-dismiss) and must be generalized or replaced — not left running in parallel with a new store
— or the milestone risks producing two incompatible notification mechanisms.

## Key Findings

### Recommended Stack

No new dependencies. The dismissible-message store is a small in-house Pinia extension of the
existing toasts.ts/ToastHost.vue pattern. The loop timer is a plain setInterval/composable
routed through the existing runChannel/postIndex choke point. The church switcher is pure
reuse of already-shipped auth.ts primitives (selectOrg, resetOrgScopedStores). The stage
layout canvas uses **native Pointer Events + percentage-based {zone, xPct, yPct} coordinates**,
explicitly rejecting vue-konva/interactjs/vuedraggable as overkill for placing a bounded set
of free-text-labeled markers into two zones — none of the app's existing SortableJS-based drag
code fits this (that's list-reorder, not freeform placement).

**Core technologies (all pre-existing):**
- Pinia — dismissible-message store, mirrors every other cross-cutting store in the app
- Native Pointer Events API — unifies mouse/touch/pen for the stage-layout drag surface, no polyfill needed for this app's supported-browser bar
- Native setInterval in a composable — per-item loop timer
- Existing runChannel.ts/useRunControl.ts single-writer broadcast — the loop and blackout-scoping changes are pure app-state changes over the existing wire protocol, no new transport

### Expected Features

**Must have (table stakes for v2.7 — all P1 per FEATURES.md):**
- Inline black slide insertable in a song's slide sequence, as a new authored slide kind (not a live control)
- "Go to black" scoped to the Audience output only — confidence monitor stays visible (bug fix, restores the independent-output-toggle model every reference tool — e.g. ProPresenter — already uses)
- Per-item loop checkbox with a default 10s interval + dropdown/custom value, looping that item's own slides
- System-wide dismissible messages: state-driven banners that auto-clear when their trigger condition resolves, plus always-available manual dismiss
- Church switcher in the user menu for multi-org members, showing each org + the user's role, full state reset on switch
- Freeform stage-layout canvas per service with on-stage/off-stage zones and free-text-labeled draggable markers (including one-off markers, e.g. a guest-speaker mic)

**Should have / defer within v2.7 scope (P2, add after validation):**
- Auto-generated stage-plot input list derived from placed markers
- Seed a new service's stage layout from the org's last-used layout (copy-on-create)
- Fine-grained per-slide custom loop timing (vs. one interval per item)

**Anti-features (explicitly do not build):**
- A constrained instrument/equipment icon library for the stage plot — fights the free-text, one-off-marker requirement directly; use free-text labels instead
- A global notification history/log of dismissed messages — no demonstrated need beyond the narrow "don't get stuck" fix
- A dedicated live instant-blackout/logo-cut master control — still deferred (carried over from v2.4 research); v2.7 only fixes output-scoping of the existing "Go to black"

### Architecture Approach

This is integration research, not greenfield design — every feature slots into an existing code
path. The dismissible-message store generalizes toasts.ts in place (widen push/dismiss,
add a keyed setSticky/clearSticky API for condition-driven banners) rather than building a
parallel system. The church switcher exposes the already-shipped selectOrg() +
resetOrgScopedStores() machinery from the user menu (AppSidebar.vue) instead of reimplementing
org-switch logic. The audience-only blackout fix is the smallest possible diff: stop
ConfidenceOutputView.vue from consuming the shared blackout flag, rather than widening the
RunState wire protocol. The black slide is a new LyricSection.kind/Slide.contentKind variant
resolved at slideshowAssembler.ts's three existing content-resolution sites — it reuses 100% of
the pool/order/drag machinery already in SongLyricEditor.vue, with zero changes needed in
Run/Audience/Confidence composables (they already iterate assembledSlideshow generically). The
loop timer lives entirely inside useRunControl.ts (the documented single writer), arming on
watch(currentSlotIndex) and resetting via the existing postIndex() choke point so manual
navigation never fights it. The stage layout is a new top-level org-scoped Firestore collection
(stageLayouts/{serviceId}, mirroring serviceShareLinks), a new rules block modeled on the
existing slideGroups draft-locked pattern, and a genuinely new StageLayoutEditor.vue freeform
canvas — the one component in this milestone with no direct code-reuse precedent.

**Major components:**
1. src/stores/notifications.ts (generalized toasts.ts) + NotificationHost.vue — cross-cutting, ships first
2. AppSidebar.vue church-switcher menu entry — reuses auth.ts's selectOrg/resetOrgScopedStores
3. ConfidenceOutputView.vue blackout-consumption removal — smallest diff, isolated
4. SongLyricEditor.vue + slideshowAssembler.ts + slideDisplay.ts/SlideCanvas.vue — new blackout slide kind
5. useRunControl.ts loop composable — timer armed/disarmed through the existing postIndex choke point
6. StageLayoutEditor.vue + src/stores/stageLayouts.ts + new stageLayouts/{serviceId} Firestore collection/rules — the one net-new subsystem

### Critical Pitfalls (in-scope features only)

1. **Stage-layout canvas repeats this app's own drag-and-drop corruption history** (v1.4 phantom duplicates, v1.6 drag-into-section bugs) — avoid by using Pointer Events (not native HTML5 DnD, which is mouse-only by spec), storing position as percentage/normalized coordinates (never raw pixels), debouncing persistence to drag-end, and testing on a real touch device before calling the phase done.
2. **Loop timer leaks or fights manual navigation / desyncs output windows** — avoid by routing every loop-triggered advance through the exact same runChannel broadcast path (never local-only state), scoping the timer's lifetime to the service-item via watch(currentSlotIndex), and explicitly deciding/testing whether "Go to black" pauses the loop.
3. **Black slide corrupts the pooled-section slide model or positional numbering** — avoid by giving it its own contentKind (not 'lyric' with empty content), explicitly excluding it from deriveSectionKind/positional numbering, and never letting it be pool-referenced/shared across occurrences. Get this data-model decision settled before any editor UI is built — retrofitting later means migrating already-saved black slides.
4. **A generic dismissible-message system is retrofitted onto the deliberately narrow toasts.ts, or built as a second, parallel system** — avoid by explicitly generalizing/replacing toasts.ts in this phase and migrating the known stuck-banner cases (RunControlView's monitor-reassign banner, MonitorSetupView's save-outcome warning) onto it as the proof case, not just building the mechanism in isolation.
5. **Church switcher bypasses the already-hardened multi-org reset path** — avoid by calling the existing selectOrg() (never a new parallel implementation), and registering the stage-layout store (the one new org-scoped store this milestone adds) in resetOrgScopedStores()'s call list as part of that feature's own phase — this is the single item most likely to be silently forgotten.

## Deferred (Future Milestone): Rehearsal Attachments & Public Rehearse Mode

Out of scope for v2.7, but the highest-risk area researched — carry this warning forward:

- **Public Storage exposure risk (Critical Pitfall #1 in PITFALLS.md):** naively widening
  storage.rules to let an anonymous Rehearse visitor read a song attachment risks making the
  **entire org's Storage bucket world-readable** if the fix is a blanket allow read: if true
  on an existing broad match. Requires a dedicated, narrowly-scoped Storage path
  (e.g. orgs/{orgId}/rehearsalAttachments/...) with its own rule, never a widened existing match.
- **The firestore.exists() cross-service blind spot repeats:** this codebase already shipped a
  deny-everyone Storage rule once because firestore.exists() is inert in the Storage emulator
  (documented incident, CLAUDE.md 2026-08-06). The "is this attachment actually shared" check for
  an anonymous visitor must not repeat that pattern — denormalize onto Storage custom metadata, or
  route through a server-side Cloud Function/signed URL, never a storage.rules-side Firestore read.
- **Egress/cost blast radius:** v1.8 was an entire milestone dedicated to capping Blaze-plan costs;
  public, unauthenticated, per-play Storage egress on MP3s/PDFs is a structurally new and larger
  cost surface than anything capped so far, with no existing retention sweep covering it.
- Recommended future-milestone approach (from STACK/ARCHITECTURE research, not re-litigated here):
  Storage download-token URL as a bearer capability denormalized into the frozen public share
  snapshot (same pattern roleAssignments/bpm already use), a dedicated size-capped Storage path,
  and steering users toward YouTube links (zero Storage cost) over uploaded audio/PDF wherever
  possible.

## Implications for Roadmap

Dependency-honoring build order for the **six in-scope v2.7 features**, per ARCHITECTURE.md's
"Suggested Build Order" (renumbered here to match in-scope numbering) and cross-checked against
FEATURES.md's dependency graph and PITFALLS.md's phase mapping:

### Phase 1: Dismissible message store (foundation)
**Rationale:** Fully decoupled from every other v2.7 feature — no data-model or rules dependency.
Fixes a real, currently-annoying bug (the stuck "monitors not configured" banner) fast, and later
Run-flow phases (blackout relabel, any Run-side follow-up) should land against the new/generalized
store, not the old ad-hoc ref-gated banner.
**Delivers:** Generalized notifications.ts (extends toasts.ts) with a keyed setSticky/clearSticky
API for condition-driven banners, plus a dismiss() manual-dismiss path on every message. Migrates
RunControlView.vue's monitor-reassign banner and MonitorSetupView.vue's save-outcome warning
onto it as proof cases.
**Addresses:** System-wide dismissible messages (table stakes, P1)
**Avoids:** Notification system collision (two parallel mechanisms coexisting)

### Phase 2: User-menu church switcher
**Rationale:** Fully independent of everything else in this milestone; zero data-model or rules
dependency; safe to parallelize with Phase 1 if capacity allows, but sequenced second here since
it shares no risk surface with Phase 1 and both are good "quick win" candidates early in the
milestone.
**Delivers:** ChurchSwitcherMenu.vue (or AppSidebar.vue addition) reusing authStore.selectOrg()
for regular multi-org members, distinct from the existing super-admin enterOrgAsSuperAdmin path;
shows each org + the user's role; full state reset via resetOrgScopedStores().
**Addresses:** Church switcher (table stakes, P1)
**Avoids:** Bypassing the already-hardened multi-org reset path (must call selectOrg(), not reimplement)

### Phase 3: "Go to black" scoped to Audience output only
**Rationale:** Small, isolated, no dependency on anything else in the milestone. A quick, low-risk
win to bank while the team is already inside RunControlView.vue/useRunControl.ts from Phase 1's
monitor-banner migration — good sequencing locality, not a hard dependency.
**Delivers:** ConfidenceOutputView.vue stops consuming the shared blackout flag for its overlay
(the minimal-diff fix, no RunState wire-protocol change); RunHeader.vue's blackout control
relabeled ("Blackout audience") for operator clarity.
**Addresses:** "Go to black" scoped to Audience only (table stakes / bug fix, P1)
**Avoids:** N/A directly, but sets correct precedent for output-scoping before Phase 5 (loop) touches the same Run-flow code

### Phase 4: Inline black slide in the lyric editor
**Rationale:** Self-contained within the song-lyrics/slideshow-assembler subsystem; no dependency
on attachments or stage layout (both deferred anyway). Sequenced before the loop phase so looping
can be validated against a slideshow that can already contain a black interlude slide — the two
features are the most likely to interact during a rehearsal-length item.
**Delivers:** New LyricSection.kind: 'blackout' / Slide.contentKind: 'blackout' variant,
resolved at all three slideshowAssembler.ts content-resolution sites; editor UI chip in
SongLyricEditor.vue's ADD_SECTION_KINDS; a new render branch in SlideCanvas.vue; explicit
exclusion from positional numbering and pool-referencing.
**Addresses:** Inline black slide (table stakes, P1)
**Avoids:** Black slide corrupting the pooled-section model or positional numbering; get this settled as a data-model decision before UI, not after

### Phase 5: Per-item loop timer
**Rationale:** Builds inside useRunControl.ts, benefits from Phase 1 already being in place for
any loop-state messaging, and from Phase 4 existing so looping a song with an inline black
interlude is exercised as part of verification.
**Delivers:** ServiceSlot.loop?: { enabled, intervalSeconds } field; timer armed via
watch(currentSlotIndex), routed through the existing postIndex() choke point so manual nav
resets rather than fights it; explicit decision on whether "Go to black" pauses the loop.
**Addresses:** Per-item loop checkbox with interval control (table stakes, P1)
**Avoids:** Loop timer leaking, racing manual nav, or desyncing output windows; verification must explicitly test manual-nav-during-loop, item-change-during-loop, black-during-loop, and route-away-during-loop, checked in an OUTPUT window, not just control

### Phase 6: Visual stage layout per service
**Rationale:** Architecturally independent of every other v2.7 feature (its only dependency is
deciding the per-service marker data shape, which is new modeling regardless of sequencing).
Sequenced **last** deliberately: it is the single largest, most novel build in the milestone (new
Firestore collection + rules block + a genuinely new freeform-canvas interaction pattern with no
existing drag precedent to reuse), and this app has a documented history of drag-and-drop
corrupting state — give it the most implementation runway and the most mature notification/state
patterns (Phases 1-5) already proven before tackling it.
**Delivers:** New stageLayouts/{serviceId} top-level Firestore collection (mirrors
serviceShareLinks), rules block modeled on slideGroups' draft-locked pattern,
StageLayoutEditor.vue (Pointer Events, percentage {zone, xPct, yPct} coordinates, debounced
persistence), src/stores/stageLayouts.ts registered in resetOrgScopedStores(), free-text-labeled
markers supporting one-off additions (e.g. guest-speaker mic).
**Addresses:** Freeform stage-layout canvas with on/off-stage zones + free-text markers, including one-off markers (table stakes, P1)
**Avoids:** Repeating this app's own drag-and-drop corruption history; reinforces the checklist item to register the new store in resetOrgScopedStores()

### Phase Ordering Rationale

- **Cross-cutting infrastructure first (Phases 1-2):** the dismissible-message store and church
  switcher have zero dependency on any other v2.7 feature and de-risk the milestone early with
  fast, low-risk wins.
- **Isolated Run-flow fixes next (Phases 3-5):** audience-only blackout, black slide, and loop all
  touch the same RunControlView.vue/useRunControl.ts/slideshow-assembler subsystem — grouping
  them together (blackout scoping then black slide then loop, since loop benefits from a testable
  black-slide interlude existing first) means fewer context-switches and lets the loop phase's
  verification exercise the black-slide phase's output.
- **Stage layout last (Phase 6):** the only genuinely novel subsystem in this milestone (new
  collection, new rules block, new drag interaction pattern) — sequencing it last means it inherits
  the most mature, already-proven-in-this-milestone patterns (notification store, org-store-reset
  discipline) rather than being built in isolation early, and gives it the most implementation
  runway given this app's drag-and-drop track record.
- **No feature in this six-item scope has a hard blocking dependency on another** — every phase
  above could technically be reordered or parallelized by workstream capacity except that Phase 4
  (black slide) should precede Phase 5 (loop) for verification-quality reasons, not a hard
  technical dependency.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 6 (stage layout):** the freeform canvas drag interaction is the one sub-feature flagged
  by ARCHITECTURE.md as "likely to need its own phase-level design pass (drag math, palette of
  element kinds, zone boundaries) rather than a straight port of an existing pattern" — this app
  has no existing freeform-drag precedent to reuse, unlike every other phase.

Phases with standard patterns (skip research-phase):
- **Phase 1 (notification store):** direct extension of an existing, already-understood Pinia store.
- **Phase 2 (church switcher):** pure UI exposure of already-shipped, already-tested auth.ts primitives.
- **Phase 3 (audience-only blackout):** minimal template-level diff, no new architecture.
- **Phase 4 (black slide):** reuses 100% of the existing pool/order/drag machinery in SongLyricEditor.vue; the only design work is the contentKind decision, already resolved by ARCHITECTURE.md.
- **Phase 5 (loop timer):** a documented, well-understood composable pattern (useRunControl.ts's existing choke-point discipline) with a clear implementation sketch already in ARCHITECTURE.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every recommendation grounded in direct reads of package.json and existing composables; zero new dependencies needed, so version-drift risk is minimal |
| Features | MEDIUM | Cross-checked against 2+ independent sources per claim (Planning Center, ProPresenter, WorshipTools, stage-plot trade press, SaaS-UX pattern sources), but no authoritative code-doc provider was available this pass — treat exact UI conventions as strong precedent, verify against real UAT once built |
| Architecture | HIGH | Every integration point cited against real files read in this pass (runChannel.ts, useRunControl.ts, ShareView.vue, storage.rules, firestore.rules, songLyrics.ts, songSectionOrder.ts, auth.ts, orgScopedStores.ts, toasts.ts, etc.) — pure internal-integration analysis, not inference |
| Pitfalls | HIGH for codebase-grounded findings (stage-layout drag history, notification collision, church-switcher reset path, black-slide model corruption, loop desync — all read directly from source and this project's own documented incident history); LOW for a handful of general web-search-sourced supporting claims (native HTML5 DnD touch behavior, aria-live conventions) used only as secondary context |

**Overall confidence:** HIGH

### Gaps to Address

- **Stage-layout freeform-drag interaction design** is the one area where no existing in-app
  pattern can be ported wholesale — flag for --research-phase or a dedicated design pass during
  Phase 6 planning (drag math, marker palette, zone-boundary UX), not a gap in the research itself
  so much as a genuinely new build.
- **Whether "Go to black" should pause the per-item loop** (Phase 5/3 interaction) is explicitly
  named in PITFALLS.md as a decision that must be made deliberately and tested, not left as an
  accident of implementation order — resolve during Phase 5 planning.
- **FEATURES.md's confidence is MEDIUM** (no premium search API was available for that research
  pass) — the comparable-product conventions (Planning Center, ProPresenter, WorshipTools) are
  useful directional confirmation for the in-scope features (blackout output-scoping, per-item
  loop defaults, dismissible-notification conventions) but should be treated as strong precedent to
  imitate, not a verbatim spec.

## Sources

### Primary (HIGH confidence)
- Direct codebase reads: .planning/PROJECT.md, CLAUDE.md, src/utils/runChannel.ts,
  src/composables/useRunControl.ts, src/composables/useOutputWindow.ts,
  src/views/RunControlView.vue, src/views/AudienceOutputView.vue,
  src/views/ConfidenceOutputView.vue, storage.rules, firestore.rules, src/types/song.ts,
  src/types/service.ts, src/types/slide.ts, src/types/songLyrics.ts,
  src/utils/songSectionOrder.ts, src/utils/slideshowAssembler.ts,
  src/components/slides/slideDisplay.ts, src/views/ShareView.vue, src/stores/services.ts,
  src/stores/toasts.ts, src/stores/auth.ts, src/stores/orgScopedStores.ts,
  src/components/SongLyricEditor.vue, src/composables/useMediaUpload.ts,
  src/router/index.ts, src/components/AppSidebar.vue, package.json

### Secondary (MEDIUM confidence)
- Planning Center Services / ProPresenter (Renewed Vision) official docs and support articles —
  loop/auto-advance, output-toggle, and chord-chart conventions
- WorshipTools, Stageplot Pro, ProSoundWeb, Sonicbids, Church AVL — stage-plot minimum-viable-feature convergence
- LogRocket, SaaSUI, Carbon Design System — toast/banner UX convention
- Slack/Notion-referenced SaaS multi-tenant/workspace-switcher pattern sources

### Tertiary (LOW confidence)
- Single-source web findings on Firebase Storage download-token permanence, native HTML5 DnD
  touch-event behavior, and aria-live toast conventions — used only as supporting context, not
  load-bearing for any in-scope v2.7 decision

---
*Research completed: 2026-08-31*
*Ready for roadmap: yes*
