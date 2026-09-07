# Project Research Summary

**Project:** WorshipPlanner v2.14 — Services UX Alignment, Dashboard & Live-Stream Video Output
**Domain:** Subsequent-milestone integration into a shipped Vue 3 + Firebase (Firestore/Auth/Functions/Storage) worship-planning SaaS
**Researched:** 2026-09-07
**Confidence:** HIGH (architecture and pitfalls grounded directly in this repo's source; stack near-zero-new-dependency; features cross-checked against multiple competitor sources)

> **Owner corrections applied (post-research, override any contradicting research text):** Blackbird is
> **not part of this feature at all** — there is no external hardware compositing dependency, and no
> "Blackbird/alpha feasibility spike" phase. Compositing happens in the video room's **software**
> (OBS/vMix-style Browser Source), which can consume a genuinely transparent (alpha) source. The owner
> chose **"build both, transparent default"**: the Video output renders **transparent by default** for
> the Banner's non-content region, plus a **configurable solid key-color fallback** (e.g. magenta) for
> tools that need chroma-key instead of alpha. This makes Video output a **low-hardware-risk, purely
> app-side feature** — every place below that references "Blackbird verification," a "feasibility spike,"
> or a "hardware-in-the-loop UAT gate" for the Video output has been removed or reframed accordingly.

## Executive Summary

This milestone adds four largely independent features to a mature, cost-hardened, multi-tenant app:
a redesigned dashboard (readiness signal + unconfirmed-volunteers widget, replacing a metrics-style
"coverage" stat that never had a real denominator), a two-state volunteer confirmation model
("I've got it"), a third live-stream "Video" output role with per-item Banner/Full-screen rendering,
and three smaller integration features (Stage Layout auto-populate from roster, auto-generated share
links, editor presence). All four map cleanly onto existing architecture: the app is Firestore-only
(no Realtime Database anywhere in the codebase), already has a generalized N-assignment output-role
system (v2.4/v2.9), an idempotent share-link minting function, and a stage-layout marker/geometry
library — so nearly every feature is additive to an existing pattern rather than new infrastructure.

The recommended approach is: reuse rather than invent. Presence rides the same Firestore
heartbeat + `onSnapshot` + client-side staleness pattern (no RTDB) already implied by this app's
Firestore-only posture, scoped as a true nested subcollection under `services/{serviceId}` mirroring
the existing `lockSnapshots` precedent. The Video output is a third value threaded through the existing
`MonitorRole` enum, and per-item Banner/Full-screen is a slot-level field riding the existing
`useAutoSave` deep-watch — no new save path. Auto-share-link is one new call site (`ensureShareLink`
from `markAsPlanned`) reusing already-idempotent code. Stage Layout auto-populate is a pure function
over already-computed roster data, gated strictly to a one-time seed of an empty canvas.

The key risks are not build risk — they are **regression-of-existing-safety-property** risks: (1) a
presence collection with an unscoped read rule would be a smaller replay of the proven, Critical,
live v2.8 SEC-S-01 cross-tenant share-token leak; (2) auto-generating share links without gating on
Planned/lock state would silently remove the one manual "I'm ready to show this" signal the app
currently has, exposing Draft plans; (3) confirmation state and Stage Layout markers must survive
concurrent roster edits without going stale or clobbering manual work — both are variations on "looks
done against the happy path, breaks against this app's actual edit lifecycle" (draft → lock → unlock →
relock). None of these require new research to resolve; they require the phase plans to explicitly
test the non-happy-path.

## Key Findings

### Recommended Stack

Both new-tech features (Video output, presence) are architecture/pattern additions, not new
dependencies. See `.planning/research/STACK.md` for full detail.

**Core technologies:**
- CSS `background: transparent` on the Video output's non-banner region — honored by embedded-renderer capture paths (OBS/vMix Browser Source) since those render off-screen via CEF with a real alpha channel; the owner has confirmed the actual downstream path is exactly this kind of software compositor, not raw HDMI/SDI capture, so this is the **primary** mechanism, not a fallback.
- Configurable solid key-color fill (`<input type="color">`, no library), default a saturated magenta — the fallback for any downstream tool that still needs chroma-key instead of consuming true alpha.
- Firestore `serverTimestamp()` heartbeat doc + `onSnapshot` (already pinned, `firebase@^12.0.0`) — real-time presence, reusing the exact primitive every other live feature in this app already uses.
- Firestore TTL policy (GA, server-side config) — cost/hygiene backstop for abandoned presence docs; never the primary staleness signal (client-side "older than ~60s" check is instant, TTL is "typically within 24 hours").
- No new npm packages for either feature; both slot into existing composable/store conventions (`useOutputWindow`, a new `usePresence`-style composable mirroring `runChannel`).

**Explicitly avoid:** Firebase Realtime Database (a second database/security model for one small feature — this app is deliberately Firestore-only through 13 shipped milestones), Electron/Tauri or any native shell for "true" window transparency, an NDI/WebRTC bridge, and any canvas/WebGL chroma-key **removal** library (this app is the sender producing a clean signal, not a receiver decoding one).

### Expected Features

See `.planning/research/FEATURES.md` for full detail, including competitor analysis (Planning Center, Breeze, Pushpay, WorshipTools, Connecteam, InitLive, Better Impact).

**Must have (table stakes):**
- Upcoming services list on the dashboard — near-zero new data modeling, matches every competitor.
- Readiness signal per service (songs/media, roles filled, slides built, Draft vs Planned) — all source data already exists; the work is defining and testing the rollup rule, and it **must reuse** the same readiness computation already surfaced to volunteers in My Schedule (v2.12) rather than inventing a second, parallel definition.
- Confirmed/Unconfirmed state on volunteer assignments + a per-assignment "I've got it" action — two states only, not the fuller accept/decline/blockout/replacement model competitors have.
- Planner-visible confirmation status on the roster, feeding the dashboard's unconfirmed-volunteers widget.
- Video output role (3rd output type) with per-item Banner/Full-screen choice and transparent-default banner render.
- Stage Layout auto-populate from roster assignments (one-time seed of an empty canvas).
- Auto-generated service share link (gated to the Planned/lock transition, mirroring the existing My Schedule Draft-exclusion gate).

**Should have (competitive differentiators):**
- Reminder nudges targeting only unconfirmed assignments — reuses existing v1.7 volunteer-messaging send infrastructure, mostly a targeting/query change.
- A visible contrast treatment (drop shadow or semi-transparent backing bar) behind banner text — broadcast/church-lyric convention research consistently flags plain text with no backing as a legibility risk.
- Editor presence roll-up on the dashboard itself, if the per-service indicator is built anyway.

**Defer (backlog):**
- Decline + auto-reopen-slot + replacement self-swap (real, well-precedented feature, but heavier than the owner's ask).
- Volunteer blockout-date management.
- Confirmation deadline/auto-decline timers.
- Customizable/drag-and-drop dashboard widgets.
- Generic BI/analytics dashboard widgets (attendance trends, engagement charts) — the anti-pattern the "coverage %" metric already represented.
- A "Fill + Key" dual-output video path (only relevant if the church later adds real hardware-keyer equipment; not applicable to the current software-compositor path).

### Architecture Approach

Every recommendation in `.planning/research/ARCHITECTURE.md` was verified directly against this repo's source (not inferred from domain generalities). The core pattern across all four features: **extend existing generalized systems**, don't build parallel ones.

**Major components:**
1. **`MonitorRole` widened to include `'video'`** (`src/utils/monitorConfig.ts`, `MonitorSetupView.vue`, a new `VideoOutputView.vue` sibling of `AudienceOutputView`/`ConfidenceOutputView`, a new static route) — Video is a third value threaded through the same N-assignment role system v2.9 already generalized, not a parallel subsystem.
2. **Per-item `videoOutput: { mode: 'banner' | 'fullscreen' }`** on `MediaAttachableSlot` (`src/types/service.ts`), riding the existing `useAutoSave` deep-watch exactly like the precedent `loop` field — no new save call, no new store, no new rules surface.
3. **`useServicePresence.ts` composable** (not a Pinia store) — a true nested Firestore subcollection `services/{serviceId}/presence/{uid}`, heartbeat every ~20-30s (paused while tab hidden), client-side soft-TTL staleness filter (~45-60s), `watch(serviceId, ...)` teardown on navigate (required because Vue Router reuses the mounted `ServiceEditorView` instance across param changes — `onUnmounted` does not fire), plus an optional `cleanupStalePresence` cron sibling to the existing `*_CLEANUP_ENABLED` retention-cron family.
4. **`autoPopulateMarkers()`** pure function in `src/utils/stageLayout.ts` over the already-computed `stageServingAssignments`, triggered once when the Stage Layout tab first becomes active for a service with zero elements — never re-run once populated.
5. **One new call site**: `ensureShareLink(service, orgId)` called from `markAsPlanned()`, mirroring the existing fail-closed, try/catch-wrapped `rehearseAccess` side-write pattern already in that function — `maybeRefreshShareLink` (auto-refresh-only-if-exists) is explicitly NOT the function to change.

### Critical Pitfalls

Full detail, warning signs, and a "Looks Done But Isn't" checklist in `.planning/research/PITFALLS.md`. Top items, with the Blackbird-hardware framing removed per owner correction:

1. **Presence security rule scoping** — a presence collection with an unscoped `allow read: if isSignedIn()` would be a smaller structural replay of the proven, Critical, live v2.8 SEC-S-01 cross-tenant share-token leak (that fix required splitting `get` from `list`). Gate get/list on `isOrgMember(orgId)` from day one; add an explicit cross-org rules test.
2. **Presence staleness and cost** — a naive "write on mount, delete on unmount" pattern leaks stale "still viewing" state on any ungraceful disconnect (closed lid, crashed tab — Firestore has no `onDisconnect()`), and a too-frequent heartbeat reintroduces exactly the uncapped-recurring-write pattern v1.8's cost hardening was built to catch. Use a coarse heartbeat (~25-30s) + client-side staleness filter (~60s) as the correctness mechanism, TTL only as an eventual cleanup backstop.
3. **Auto-share-link Draft exposure** — auto-generating on every save (rather than gating to the Planned/lock transition) would create a guessable-URL share page for an unfinished plan, silently removing the one manual "I'm ready" gate this app currently has. Gate on `markAsPlanned`, reuse `ensureShareLink`'s existing idempotency to avoid duplicate tokens.
4. **Stage Layout clobber/duplicate on re-run** — auto-populate must be a one-time seed of an empty canvas, never a recurring sync; re-running against a canvas with manual edits (the common case, since roster changes right up until lock) must never regenerate/wipe/duplicate markers.
5. **Volunteer confirmation vs. concurrent roster edits** — confirmation state must be keyed on stable assignment identity and explicitly invalidated ("needs reconfirmation," not a stale checkmark) when the underlying assignment is reassigned; read via live `onSnapshot`, not one-time fetch, matching the v2.13 live-volunteer-doc precedent.
6. **"Planning Center" verbiage removal scope** — this app has a real, functioning PC export integration; a blind find-and-replace on "Planning Center" strings risks garbling substantive integration copy along with the one incidental banner string in scope. Inventory and classify every occurrence before editing.

## Implications for Roadmap

Based on combined research, the four feature areas cluster into three risk/complexity tiers with almost no cross-feature code dependency (only one hard ordering constraint: confirmation model before the "unconfirmed volunteers" dashboard widget). Suggested phase structure:

### Phase 1: Trivial wins — Auto share-link + Stage Layout auto-populate
**Rationale:** Both are single-call-site or pure-function additions with zero new schema and all dependencies already shipped (Phase 107 stage layout, existing `ensureShareLink`). Lowest risk, most self-contained; good for de-risking the milestone early and building momentum.
**Delivers:** Share link auto-created on Planned transition (idempotent, gated to lock state); Stage Layout seeds itself once from roster assignments on first empty-canvas visit.
**Addresses:** FEATURES.md table stakes — auto-share-link, Stage Layout auto-populate.
**Avoids:** Pitfall 4 (Draft exposure / duplicate tokens) and Pitfall 5 (clobber/duplicate on re-run) — both require the non-clobber/idempotency guard to be a first-class acceptance criterion, not an afterthought.

### Phase 2: Volunteer Confirmation
**Rationale:** Must land before or alongside the dashboard's "unconfirmed volunteers" widget — the one hard cross-feature ordering constraint research surfaced. No dependency on presence or Video output.
**Delivers:** Two-state (Unconfirmed default / Confirmed) model on assignments, "I've got it" action in the existing My Schedule / volunteer service surface, planner-visible status chip on the roster.
**Addresses:** FEATURES.md Section 2 table stakes; explicitly scoped to two states, deferring Decline/replacement/blockout.
**Avoids:** Pitfall 7 (confirmation racing reassignment/unlock-relock) — plan must test confirm-then-reassign and unlock/relock sequences as acceptance criteria, not just the happy path.

### Phase 3: Dashboard
**Rationale:** Depends on Phase 2 (confirmation model) for the unconfirmed-volunteers widget; the readiness signal has no new data dependency and could ship earlier if sequencing needs it, but is grouped here since both widgets share the same "needs your attention" framing and layout work.
**Delivers:** Upcoming services list, readiness signal per service (reusing the existing v2.12 readiness computation, not a new definition), unconfirmed volunteers widget, empty/first-run state.
**Addresses:** FEATURES.md Section 1 table stakes; explicitly excludes generic BI/analytics widgets and the old undefined "coverage %" metric.
**Avoids:** UX pitfall of the readiness signal disagreeing with My Schedule's existing readiness indicator — reuse, don't reinvent, the rollup rule.

### Phase 4: Editor Presence
**Rationale:** Fully self-contained (no dependency on any other v2.14 feature); needs its own Firestore rules + composable review pass separate from visual polish, so it benefits from being its own phase rather than bundled into the dashboard or service editor work.
**Delivers:** `services/{serviceId}/presence/{uid}` subcollection, `useServicePresence.ts` composable (heartbeat, staleness filter, teardown-on-navigate), header UI in `ServiceEditorView.vue`, optional `cleanupStalePresence` cron.
**Uses:** Firestore heartbeat + `onSnapshot` pattern from STACK.md; the `lockSnapshots` nested-subcollection rule precedent from ARCHITECTURE.md.
**Implements:** ARCHITECTURE.md Section 2 (composable, not a store; denormalized `displayName`; `watch(serviceId)` teardown).
**Avoids:** Pitfall 2 (stale presence / uncapped writes) and Pitfall 3 (cross-org read leak, structurally identical to v2.8 SEC-S-01) — both must be first-class requirements of this phase's rules design and verification, with an explicit forced-disconnect test and a cross-org rules test.

### Phase 5: Video Output — Fullscreen slice
**Rationale:** Sequence the Video output internally before combining: type-widening and a Fullscreen-only render are low-risk (reusing `AudienceOutputView`'s exact pattern) and independently demoable/UAT-able, without needing the Banner transparency work at all.
**Delivers:** `MonitorRole` widened to `'video'`, `MonitorSetupView.vue` 3-way UI, `VideoOutputView.vue` in Fullscreen mode (reused `AudienceOutputView` render, no new rendering code), new static route.
**Uses:** ARCHITECTURE.md Section 1 integration plan verbatim (this is the best-verified part of the whole research set — every file/change cited against real source).
**Research flag:** Standard pattern, skip research-phase — this is a close structural copy of v2.9's existing N-assignment role generalization.

### Phase 6: Video Output — Banner render (transparent-default + solid key-color fallback)
**Rationale:** The only piece of genuinely new rendering code across the whole milestone; sequence last within Video output so it doesn't block shipping the Fullscreen slice. Per the owner's correction, this has **no hardware dependency and no feasibility-spike phase** — it is pure app-side CSS/DOM work.
**Delivers:** Per-item `videoOutput: { mode: 'banner' | 'fullscreen' }` schema field + `SlidesTab` authoring UI; a new bottom-strip `useContainScale` region rendering the slide via the existing `SlideCanvas` pipeline; the region's background defaults to CSS `background: transparent`, with a configurable solid key-color fallback (default saturated magenta, `<input type="color">`) for any downstream tool needing chroma-key instead of alpha.
**Addresses:** FEATURES.md Section 3 table stakes (banner region title-safe inset, 1-2 line text sizing) and the contrast-treatment differentiator (drop shadow / backing bar).
**Research flag:** Needs a product decision at `discuss-phase`/spec time — what does the Video output show for an item with no `videoOutput` flag set (transparent/key-color fill showing nothing, vs. black)? This is a product decision, not a technical unknown, and should be resolved before the render is built.

### Phase Ordering Rationale

- Trivial/self-contained features (share-link, stage-layout) ship first to de-risk the milestone early with minimal review surface.
- Confirmation precedes the dashboard because it is the one hard data dependency research found across all three original feature areas.
- Presence is isolated into its own phase specifically because its security-rule design needs a dedicated review pass (v2.8 SEC-S-01 precedent) rather than being folded into a larger phase where that review could get rushed.
- Video output is split into two phases (Fullscreen, then Banner) so the higher-risk, genuinely-new rendering work (Banner transparency) doesn't block the lower-risk, high-value Fullscreen slice from shipping and being demoable independently.

### Research Flags

Phases likely needing deeper research/product decisions during planning:
- **Phase 3 (Dashboard):** the exact readiness rollup rule (e.g., "3 of 4 checks green" vs. binary) is a product decision to pin down at `discuss-phase`, not a research gap — flag for `discuss-phase`.
- **Phase 6 (Video Banner render):** the "no `videoOutput` flag set" default behavior (transparent-fill-showing-nothing vs. black) needs a product decision before the render is built.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Auto share-link, Stage Layout auto-populate):** both are close structural copies of existing, already-tested functions/primitives in this repo.
- **Phase 4 (Editor Presence):** the heartbeat/staleness/rules pattern is well-precedented (both in this repo's existing rule idioms and in general Firestore-presence practice), even though it's new code.
- **Phase 5 (Video Fullscreen slice):** a direct structural copy of v2.9's role-generalization pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH (architecture/platform-limits) / MEDIUM (presence heartbeat-interval convention) | No new dependencies; the transparent-vs-chroma-key split is corroborated by OBS/CEF technical sources. No single documented standard for presence heartbeat interval — treated as a reasonable default, not a verified constant. |
| Features | MEDIUM | Cross-checked across 4+ independent competitor sources (Planning Center, Breeze, Pushpay, WorshipTools, Connecteam, InitLive, Better Impact) for confirmation and dashboard conventions; ProPresenter has no published "readiness dashboard" concept to confirm against (absence-of-evidence, flagged explicitly). |
| Architecture | HIGH | Every recommendation verified directly against this repo's real source files in-session (`useOutputWindow.ts`, `useRunControl.ts`, `monitorConfig.ts`, `services.ts`, `stageLayout.ts`, `firestore.rules`, `service.ts`), not inferred from general patterns. |
| Pitfalls | HIGH (project-specific findings) / MEDIUM (externally-researched browser-alpha and Firebase-presence general patterns) | Project-specific pitfalls (v2.8 SEC-S-01 precedent, Draft/Planned gate, stage-layout data model) are grounded in this repo's actual history and code. |

**Overall confidence:** HIGH — this is a well-understood integration into a mature, well-documented codebase, not greenfield research. The Blackbird/hardware-verification framing in the original Pitfalls and Architecture research is **superseded** by the owner's 2026-09-07 correction (software-compositor path, transparent-default + key-color fallback, no hardware dependency, no feasibility-spike phase).

### Gaps to Address

- **Readiness rollup rule definition** (Phase 3) — all source data exists, but the exact "what counts as ready" logic is undefined; resolve at `discuss-phase` for the Dashboard phase, reusing the existing v2.12 My Schedule readiness computation as the base rather than inventing a second definition.
- **Video output default behavior for un-flagged items** (Phase 6) — transparent/key-color fill (nothing shown) vs. black; resolve at spec/discuss-phase before the Banner render is built.
- **Presence heartbeat interval and staleness window** — no single canonical number exists industry-wide; the research's ~25-30s heartbeat / ~60s staleness recommendation is a reasonable default to adopt as-is rather than something requiring further research.
- **Confirmation reminder-nudge scope** (P2 differentiator) — deferred pending real usage data on how often assignments go unconfirmed; not a blocker for v2.14 launch.

## Sources

### Primary (HIGH confidence)
- In-repo verification: `src/composables/useOutputWindow.ts`, `useRunControl.ts`, `src/utils/monitorConfig.ts`, `src/views/AudienceOutputView.vue`/`ConfidenceOutputView.vue`, `src/router/index.ts`, `src/types/service.ts`/`slide.ts`, `src/utils/stageLayout.ts`, `src/components/stage/StageLayoutEditor.vue`, `src/views/ServiceEditorView.vue`, `src/stores/services.ts`, `firestore.rules`, `functions/src/index.ts`, `.planning/PROJECT.md`, `CLAUDE.md`.
- Firebase docs — "Manage data retention with TTL policies | Firestore" (official docs, GA confirmation).

### Secondary (MEDIUM confidence)
- Planning Center Help/Blog (dashboard "needs attention" pattern, confirm/decline/blockout state model, auto-reschedule).
- Breeze, Pushpay, WorshipTools, Connecteam, InitLive, Better Impact (volunteer confirmation state model convergence).
- Adobe, Restream, eks.tv, Switcher Studio, StreamYard, Church Motion Graphics (lower-third/banner placement, typography, title-safe conventions).
- OBS Forums, "Production-ready green screen in the browser" (Jim Fisher) — CEF-based Browser Source alpha handling, corroborating the owner's software-compositor framing.
- General SaaS dashboard UX practice (UX Collective, Eleken, FlowmazeUX, 2026 sources).

### Tertiary (LOW confidence)
- ProPresenter documentation — absence of a published "readiness dashboard" concept (absence-of-evidence, not evidence-of-absence).
- General Firestore-presence community write-ups (heartbeat + staleness + TTL pattern) — no single canonical source, treated as convention not standard.

---
*Research completed: 2026-09-07*
*Ready for roadmap: yes*
