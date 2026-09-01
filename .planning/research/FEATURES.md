# Feature Research

**Domain:** Rehearsal tooling (song attachments + volunteer practice), visual stage plots, and
live-presentation polish (blackout scoping, item looping, dismissible notifications) for a
church worship-service planning app — informing WorshipPlanner v2.7. Comparable products:
ProPresenter, EasyWorship, Faithlife Proclaim, Planning Center Services (+ MultiTracks/PraiseCharts
integrations), WorshipTools, Stageplot Pro.
**Researched:** 2026-08-31
**Confidence:** MEDIUM (cross-checked ≥2 independent web sources per claim — official Planning
Center / Renewed Vision (ProPresenter) support docs, WorshipTools product pages, ProSoundWeb/
Sonicbids stage-plot trade guidance, and general SaaS-UX pattern sources (LogRocket, SaaSUI,
WorkOS). No authoritative code-doc provider or premium search API was configured in this
environment (Context7/Exa/Brave/Tavily/Firecrawl unavailable) — treat exact keystrokes/UI copy as
strong convention to imitate, not a verbatim spec; verify against our own UAT once built.)

## How the reference tools actually work (per v2.7 feature area)

### 1. Rehearsal media on songs (chord charts, practice tracks, YouTube links)

**Planning Center Services** is the closest analog to what v2.7 scopes, and it converges on one
important structural decision: **attachments are scoped to Song → Arrangement → Key**, not just
the song. "When you add a song to a plan in one key, only the files from that key, arrangement and
song will be available... so your users always have the correct files." Files can be uploaded from
disk, linked to an internet URL, or linked to Apple Music/Spotify. Two ecosystem integrations —
**MultiTracks RehearsalPack** and **PraiseCharts** — auto-sync purchased practice-audio and chart
files in as song attachments once a song is linked to an external account.

**ProPresenter** treats a chord-chart PDF as a per-document/per-slide attachment (browse to a PDF,
optionally map different pages to different slides) rather than a reusable song-library object —
it is presentation-authoring-time tooling, not a rehearsal-library feature, and is a weaker analog
for WorshipPlanner's "reusable across services" requirement.

**Implication for WorshipPlanner:** PROJECT.md already decided attachments live on the **Song**
(the stable), reusable across services — this matches Planning Center's core principle (attach
once, reuse everywhere a song is used) while being *simpler* than PC's arrangement/key-scoped
model. Given WorshipPlanner does not yet have a multi-arrangement/multi-key song data model, attaching
at the **Song** level (not per-arrangement) is the right scope for v2.7 — it avoids inventing a
new dimension of the data model just to hang attachments off, and matches how a small church
actually rehearses (one lead sheet, one reference track per song, not per key).

### 2. A shared "Rehearse" experience via the public shared link

Planning Center's mobile media player is the clearest table-stakes reference for **what volunteers
do with practice audio**: watch/listen to a video or full song, listen to an isolated part, or
**loop a specific section**. WorshipTools Rehearse (a dedicated, free rehearsal-focused product)
converges on the same short list: **up/down pitch mixes, on-demand looping, click/cue tracks**.
Both products separate "listen/rehearse" from "read chords" as two panes of the same screen (Now
Playing view shows song + key prominently; a chart/lyrics view sits alongside).

**Transpose is real and expected in the ecosystem — but it is non-trivial engineering.** Planning
Center's transpose is *not* a client-side real-time pitch-shift; it applies server-side per
selected key and re-renders/updates the chord chart + audio file to match. That is a meaningfully
larger build (audio processing pipeline) than "play an MP3." **This is the single biggest
scope-creep risk in this feature area** — teams will ask for "can it transpose the practice
track," and the honest table-stakes answer for a v1 rehearsal view is: **no** — display the song's
existing **Key** field (already in the data model per v2.3's editable Key) as text, and let the
attached PDF/MP3 already be in whatever key the team recorded it in. True audio transposition is a
differentiator/future-milestone feature, not v1.

**What a volunteer actually needs on a phone, ranked:**
- Table stakes: play the MP3 inline (native HTML5 `<audio>` control is sufficient — no custom
  player needed for v1), embed/link the YouTube video, view/download the PDF chord chart, see the
  song's Key as plain text, see it per-song within the service (grouped, matching the service order).
- Differentiator (real value, moderate cost): playback-speed control (native `<audio
  playbackRate>` is nearly free — a slider from e.g. 0.75x–1.25x is a small, high-value add since
  browsers already support it) and simple loop-a-section (if built as a min/max time scrub on the
  native player, still moderate; if built as robust in/out markers with persistence, larger).
- Scope creep to explicitly defer: real pitch-shifting/transpose engines, multi-track stem
  mixing (up/down mixes), click/cue-track generation, offline/download-for-airplane-mode caching,
  per-user practice-progress tracking. None of these are needed to satisfy "the team can rehearse
  from a link" — they are the professional-tier features WorshipTools/PC differentiate on after
  years of investment, not a v1 bar.

**No-login constraint is a real, deliberate simplification.** PROJECT.md already decided volunteer
rehearse access is the public shared link only, no volunteer accounts this milestone — this
avoids the practice-progress-tracking / per-user-state feature entirely, which is good scope
discipline; none of the comparable tools' account-gated features (sync across devices, saved loop
points per user) are achievable or expected without login, so don't half-build them.

### 3. Visual stage plot / stage layout

Every reference source (ProSoundWeb, Sonicbids, Stageplot Pro, Church AVL) converges on the same
minimum useful set for a stage plot, independent of the tool used to build it:
- **A bird's-eye/top-down view of the stage** with labeled positions for each musician/instrument.
- **Mic and DI placement** per position (what's plugged in, roughly where).
- **Monitor positions and what's in each monitor mix** (wedge vs. in-ear, which mix number).
- **An input/channel list** — the flat list a sound tech actually works from at FOH, ideally
  derived from the same placed items rather than maintained separately ("auto-generated input
  list" is called out explicitly by Stageplot Pro as valuable).
- Secondary/nice-to-have in the trade sources: stage dimensions, riser/carpet placement, band
  contact info — genuinely useful for touring bands playing unfamiliar venues, **not** useful for a
  single church's own fixed stage that the tech team already knows physically.

**Implication for WorshipPlanner:** a small church's own sanctuary stage is a *known, fixed*
physical space — the tool doesn't need real-world dimensions, venue-agnostic templates, or a
23-piece riser icon library (the professional builders like Stageplot Pro ship 300+ equipment
icons for touring acts). What's actually needed is exactly PROJECT.md's freeform canvas with
on-stage/off-stage zones: **placed, labeled markers** (a name + instrument/role + optional
monitor/DI note), reusable across services (most churches' stage plot barely changes week to
week — the delta is usually just "add a mic for this week's guest speaker"), not a from-scratch
build every service. The **one-off speaker mic** requirement in PROJECT.md is exactly the
"anything can be placed, labeled freely" case a rigid instrument-icon-picker would fight against —
favor free-text labels over a constrained icon taxonomy for v1.

**Anti-pattern to avoid:** a full drag-and-drop *equipment library* (amp models, mic brand/model
pickers, cable-run diagrams) — this is what makes tools like Stageplot Pro valuable for touring
professional acts working unfamiliar FOH engineers, but it is disproportionate build cost for a
single-church, single-venue, known-tech-team context. A generic labeled-marker-on-a-canvas model
covers the real need (who's where, what mic/monitor they need) without the icon-library investment.

### 4. Inline black slide, item looping, "Go to black" scoping, dismissible messages

**Blackout is a distinct control tier from other clear/toggle actions in every reference tool.**
ProPresenter's own shortcut layout makes the tiering explicit: Cmd/Ctrl+2 toggles the Stage Display
*output* on/off; Cmd/Ctrl+0 toggles Stage-Display-only mode; separately, F1–F5 are a five-way
**Clear** tier (Clear All / Text / Background / Props / Audio) that acts on the **current program
output**, not the stage display. This confirms the underlying model WorshipPlanner's v2.7 fix
assumes: **audience output and confidence/stage output are independently controllable outputs**,
and an action like blackout should be explicitly scoped to *one* of them, not applied globally by
default — today's bug (Go to black also blacks the confidence monitor) is exactly the failure mode
these tools' separate-output-toggle model is designed to prevent. **An inline "black slide" placed
directly in a song's slide sequence (for an instrumental/interlude section)** is a different,
complementary mechanism from a live blackout *control* — it's authored content (a real, ordered
slide that happens to render as black) rather than a runtime override, so it behaves correctly with
navigation (Next/Previous still step through it normally) in a way a global blackout toggle does
not. This is the right mental model for the v2.7 feature: a black slide is just another
`AssembledSlide`, not new runtime state.

**Looping/auto-advance is explicitly a *pre-service/non-live* pattern in every tool researched**,
never a live-worship-portion feature — reinforcing the v2.4 research finding already on file
(auto-advance was correctly rejected for live song/slide navigation). ProPresenter's mechanism:
per-slide "Go To Next" timers plus a loop cue on the last slide, saved as a reusable Library
Playlist so it auto-loops regardless of entry point. **This validates PROJECT.md's scoping**: a
per-item loop checkbox with a default interval (10s) + dropdown/custom value is the right minimum
— it mirrors the "same time for all slides, loop last→first" ProPresenter default rather than
per-slide custom timing (which is a differentiator/professional-tier feature, not needed for a
pre-service loop or a between-songs interlude loop).

**Dismissible notifications are a solved, well-documented UX pattern, not a domain-specific one.**
The general SaaS-UX convention (LogRocket, SaaSUI, Carbon Design System) draws a clean line:
- **Toasts** = transient, auto-dismissing (~3s short messages, 5–10s if they carry an action),
  should still include a manual close button, pause the auto-dismiss timer on hover/touch.
- **Banners** = persistent status messages that stay until the underlying condition resolves *or*
  the user dismisses them, color-coded by severity, show only one at a time.
- **Critical rule, directly relevant to the "monitors not configured" bug**: nothing critical
  should live *only* in an auto-dismissing toast, because the user may look away and miss it
  forever — but the inverse failure (WorshipPlanner's actual bug) is a **banner that never
  auto-clears even after its triggering condition is resolved**, which is exactly what the SaaS
  convention says a banner should do: track the condition and auto-resolve, plus always offer
  manual dismiss as a backstop. The fix pattern is: banners are *state-driven* (bound to a
  reactive condition that clears them automatically) with a manual-dismiss escape hatch layered on
  top, not a one-shot "show once" flag.

### 5. Switching between churches (multi-org)

This is a generic, well-established SaaS pattern, not something worship-software vendors innovate
on — Slack and Notion are the reference implementations cited across every SaaS-UX source
consulted. The convergent pattern:
- The org/workspace switcher lives **in the header/user menu, always visible**, exactly where
  PROJECT.md already scopes it.
- Switching should **fully reset scoped UI state** — Notion's model explicitly "clears the sidebar
  and repopulates it with only that workspace's pages" — so no stale data from the previous org
  should linger visually after a switch.
- **Show the user's role per org** in the switcher list itself (e.g. "Editor" / "Viewer" /
  "Admin") so a multi-org user isn't surprised by reduced permissions after switching — cheap to
  add given WorshipPlanner already carries the `orgs:{orgId:role}` claim map.
- A workspace/org switch is normally treated as a **hard navigation boundary** (comparable to a
  route change), which maps cleanly onto WorshipPlanner's existing custom-claim + active-org
  session model from v2.0/v2.1 — no new architecture needed, this is a UI-surface exercise of
  infra that already exists (super-admin "enter any church" already proves the underlying
  mechanism works).

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Attach PDF chord chart to a song | Every rehearsal-focused competitor (Planning Center, ProPresenter, WorshipTools Charts) treats a chord chart as a baseline artifact per song. | LOW–MEDIUM | Firebase Storage upload, same pattern as existing PPTX/media storage; store a Storage path + display name on the Song doc. |
| Attach an MP3 practice track to a song | Planning Center's core "learn your part" workflow; WorshipTools Rehearse's entire product is built around this. | LOW–MEDIUM | Firebase Storage upload; native HTML5 `<audio>` for playback needs no custom player build. |
| Attach a YouTube link to a song | Common informal practice already (leaders send YouTube links via text/email); every modern worship tool supports linking external video. | LOW | Store a URL string + basic validation; embed via standard `<iframe>`/oEmbed, no download/storage cost. |
| Attachments reusable across services (live on the Song, not per-service) | Planning Center's file-scoping principle ("your users always have the correct files" wherever the song is used) — re-uploading the same chart every time a song repeats is the failure mode to avoid. | LOW (given decision already made) | Already decided in PROJECT.md — attachments belong on the Song stable, not the service. |
| Per-song list on the Rehearse view, playable inline (MP3), viewable (PDF), linked (YouTube) | Direct match to Planning Center mobile media player / WorshipTools Rehearse's baseline screen — the whole point of the feature. | MEDIUM | Grouped by service order (reuse existing slot/section grouping logic per the v2.4 research already on file). |
| Song Key displayed as plain text on the Rehearse view | Planning Center's Now Playing view surfaces key prominently; volunteers need to know what key they're rehearsing in even without audio transposition. | LOW | Song already has an editable Key field (v2.3, R249) — pure display, zero new data. |
| Native audio playback controls (play/pause/seek/volume) | Baseline expectation of any "play an MP3" feature; the standard HTML5 `<audio>` element already satisfies this with zero custom UI work. | LOW | Use the native element; do not build a custom player for v1. |
| Rehearse view reachable from the existing public share link, no login | PROJECT.md's explicit decision this milestone; matches the existing read-only share-link precedent already shipped and trusted by users. | LOW–MEDIUM | Builds directly on the existing share-link/share-snapshot infrastructure — a new route/section on data already being served read-only. |
| Stage plot: labeled positions on a bird's-eye canvas | Universal minimum across every stage-plot source (ProSoundWeb, Sonicbids, Church AVL, Stageplot Pro) — the core artifact IS "who/what goes where." | MEDIUM | Freeform canvas per PROJECT.md's decision; simple draggable labeled markers, not a rigid grid. |
| On-stage vs. off-stage (side) zone distinction | Named explicitly in PROJECT.md; matches the real physical need of separating platform performers from side-stage/wing personnel (extra musicians, guest speaker mic). | LOW–MEDIUM | Two visually distinct drop zones on the same canvas; simplest correct model. |
| Ability to add an extra/one-off mic (e.g. for a guest speaker) not tied to a fixed roster position | Explicitly named in PROJECT.md as the motivating edge case; stage-plot sources confirm ad hoc additions are normal, not exceptional. | LOW | Free-text-labeled marker, not constrained to a preset instrument/role list — critical design choice, see Anti-Features. |
| Stage layout reusable/editable per service (not rebuilt from scratch every week) | A church's stage barely changes week to week; every stage-plot workflow assumes start-from-last-week, adjust the delta. | LOW–MEDIUM | Consider seeding a new service's stage layout from the org's last-used layout (mirrors the existing default-service-template precedent from v1.6) — flag for phase discussion, not committing here. |
| Inline black slide insertable within a song's slide sequence | Table stakes once instrumental/interlude sections are acknowledged as real (every band plays these); the existing lyric-editor slide model already supports arbitrary slide types per song. | LOW–MEDIUM | New slide "kind" (black) inserted like any other slide in the existing split-slide editor (v1.6 precedent) — reuses existing navigation, no new runtime state. |
| "Go to black" scoped to Audience output only | Confirmed by every reference tool's independent-output-toggle model (ProPresenter's Cmd+2 stage-display toggle vs. F1 program-clear are separate controls); this is a bug fix restoring the expected separation, not new territory. | LOW–MEDIUM | Existing `PresentationViewer.vue`/confidence-monitor fork (per v2.4 research) needs the blackout state scoped to one output's render branch, not a shared flag. |
| Per-item loop checkbox with a default interval + custom value | Directly matches ProPresenter's "same time for all slides + loop last→first" default pattern — the exact scope PROJECT.md already sets (10s default, dropdown + custom). | MEDIUM | Timer-driven auto-advance through an item's own slides only, looping back to the item's first slide — scoped per-item, not global. |
| System-wide dismissible messages; conditional banners auto-clear when their trigger resolves | Directly fixes the named bug (stuck "monitors not configured" warning) using the standard SaaS convention: banners are state-driven, auto-resolving, plus always manually dismissible as backstop. | LOW–MEDIUM | A shared banner/toast primitive bound to reactive state, replacing any one-shot "shown" flags; likely a small shared composable/store used app-wide. |
| Church switcher in the user menu, always visible | Slack/Notion convention, and PROJECT.md's explicit placement decision; low build cost given the claim infra already exists (v2.0/v2.1). | LOW–MEDIUM | Exercises existing `orgs:{orgId:role}` claims + the proven "enter any church" active-org mechanism (v2.1), now exposed to regular multi-org members, not just super-admin. |
| Church switch shows the user's role in each org | Cheap, expected transparency per SaaS-UX sources; prevents "why can't I edit this" surprise after switching. | LOW | The role is already in the claim map — pure display. |
| Church switch fully resets scoped app state (no stale prior-org data visible) | Notion's explicit convention; also a correctness requirement given WorshipPlanner's per-org data model (songs/services/roster are all org-scoped). | LOW–MEDIUM | Likely already mostly correct given Firestore listeners are org-scoped, but must be verified — re-subscribing all org-scoped stores on switch. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Playback-speed control on the practice MP3 (e.g. 0.75x–1.25x slider) | Genuinely useful for learning a fast part, and the browser's native `audio.playbackRate` makes this nearly free — an easy differentiator over a bare `<audio>` tag with no added engineering risk. | LOW | Small UI addition on top of the native player; no server/processing cost, unlike transposition. |
| Simple loop-a-section on the practice MP3 (drag in/out markers on the scrubber) | Matches WorshipTools/PC's "loop a specific section" value, the single most-cited "wish I had that" feature in the researched rehearsal tools. | MEDIUM | Achievable client-side (bound the native player's `currentTime`/`timeupdate` to jump back at the out-marker) without any audio-processing backend — meaningfully more valuable than playback speed, but a step up in build/test effort. |
| Auto-generated input list from the stage plot's placed markers | Stageplot Pro calls this out as a real time-saver for the sound tech — derive the FOH channel list from what's placed on the canvas instead of maintaining it separately. | MEDIUM | Only worth building once the core placed-marker canvas exists and proves useful; a straightforward table derivation from marker data, not new state. |
| Seed a new service's stage layout from the org's last-used layout | Saves the tech team from rebuilding the same plot every week; matches the "start from last week, adjust the delta" real workflow. | LOW–MEDIUM | Mirrors the existing default-service-template precedent (v1.6); a copy-on-create rather than new modeling. |
| Custom per-song loop interval remembered per song (not just per-item on the day) | Some interludes are naturally longer/shorter; letting a song "remember" its usual loop timing reduces weekly re-configuration. | LOW | Small optional field; only pursue after the baseline per-item loop ships and proves the concept. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Real-time audio transposition/pitch-shifting of the practice MP3 | Planning Center has it, and "can it play in a different key" is a predictable ask once a Key field is visible next to a playable track. | Planning Center's own implementation is server-side batch re-rendering, not a lightweight client feature — building this means an audio-processing pipeline (a new Cloud Function class, quality/latency concerns) for a "nice to have" that a team can work around by choosing the right recording or rehearsing in the recorded key. Massive scope/cost jump for a first version. | Display the song's Key as plain text (already in the data model); let the attached track already be in whatever key the team recorded. Revisit only if real demand emerges after v2.7 ships. |
| A constrained instrument/equipment icon library for the stage plot (drum kit icon, specific amp models, mic brand pickers) | Professional stage-plot builders (Stageplot Pro, 300+ icons) look more "complete" and it's tempting to match that polish. | A single church's stage and gear roster is small and known to its own tech team — a rigid icon taxonomy adds real build cost (icon library, categorization, search/filter) for a benefit (visual realism) the target user doesn't need, and actively fights the "one-off speaker mic" requirement, which needs free-text labeling, not a preset picker. | Free-text-labeled draggable markers (name + role/instrument + optional monitor/DI note) on the freeform canvas — covers every real case including one-offs, with far less build cost. |
| Multi-track stem mixing / up-down mix generation for rehearsal audio | WorshipTools Rehearse and MultiTracks RehearsalPack both offer isolated-part audio, which is genuinely valuable for learning a part. | Requires either multi-track source files (a data-model change: multiple audio files per song, per instrument) or server-side audio processing — large scope addition orthogonal to "attach an MP3 and play it," and PROJECT.md scopes attachments as a single reference track, not a mixing console. | Ship the single reference-track attachment model; if a team wants isolated parts, they attach multiple distinctly-labeled MP3s to the same song (e.g. "Full Mix," "Vocals Only") using the existing multi-attachment capability rather than building a mixer. |
| Volunteer login/self-service rehearsal portal (saved progress, favorites, personal loop points) | The natural next step once a Rehearse view exists — "why can't I save my place." | PROJECT.md explicitly decided against volunteer accounts this milestone (share-link-only access); adding any per-user persisted state (favorites, saved loops) requires an account system that does not exist yet — a materially larger feature than a shared rehearsal view. | Ship the no-login shared Rehearse view as scoped; treat a volunteer account/portal as a distinct, larger future milestone if demand is proven. |
| A live blackout/logo-cut master control button, built now "since we're touching output-scoping anyway" | Adjacent to the "Go to black" scoping fix, and the v2.4 research already flagged this as a real, deferred want. | Still explicitly out of scope for v2.7 too — the milestone's blackout work is a *scoping fix* to an existing control, not a request to add new blackout affordances; scope creep here delays the actual named fixes. | Fix "Go to black" to affect Audience only, as scoped; continue to defer a dedicated instant-blackout master control to a future milestone unless a phase explicitly adds it. |
| Global, always-on-top notification center / persistent history log of every dismissed message | Feels like a natural companion to "make messages dismissible" — "what if I want to see what I dismissed." | No evidence any comparable tool in this domain needs it, and it's a materially different feature (a notification inbox/history model) than "don't let a warning get stuck on screen," which is the actual, narrow bug being fixed. | Ship state-driven, auto-clearing, manually-dismissible banners/toasts per the SaaS convention; do not build a history/log surface unless separately requested. |
| Fine-grained per-slide custom loop timing (à la ProPresenter's per-slide "Go To Next" timer overrides) | ProPresenter power users configure exactly this for polished announcement loops. | PROJECT.md scopes a simple per-**item** loop (one interval for the whole item, default 10s + dropdown/custom) — per-slide custom timing is the professional-tier variant of the same feature and adds real UI/data-model complexity (a duration field per slide instead of one per item) for a level of polish a small church's pre-service loop doesn't need. | Ship the per-item single-interval loop as scoped; revisit per-slide timing only if real usage shows the single-interval model is insufficient. |

## Feature Dependencies

```
[Song stable data model (existing)]
    └──enables──> [Rehearsal attachments on Song: PDF/MP3/YouTube link]
                      └──requires──> [Firebase Storage upload pattern] (existing — reused from
                                      PPTX/media storage, v1.4/v1.5 precedent)
                      └──enables──> [Rehearse view: per-song list of attachments]
                                        └──requires──> [Public shared-link infra] (existing — v1.5
                                        share-token/snapshot mechanism)
                                        └──requires──> [Service order / section grouping] (existing
                                        — same slotIndex/section grouping the v2.4 Run-mode research
                                        already established as reusable)
                                        └──enhanced-by──> [Playback speed] (differentiator, LOW cost)
                                        └──enhanced-by──> [Loop-a-section] (differentiator, MEDIUM cost)
                                        └──conflicts-with (defer)──> [Real-time transpose] (server-side
                                        audio pipeline — do not combine with the v1 Rehearse-view build)

[Freeform canvas primitive (new)]
    └──enables──> [Stage layout: on-stage/off-stage labeled markers]
                      └──requires──> [Per-service data model for placed markers] (new — likely a
                      subcollection or field on the Service doc, analogous to slide-group ordering)
                      └──enables──> [One-off speaker mic as a free-text marker] (no dependency on a
                      fixed roster/role list — this is WHY free-text beats a constrained icon picker)
                      └──enhanced-by──> [Auto-generated input list] (differentiator, derives from
                      placed-marker data, no new state)
                      └──enhanced-by──> [Seed from last-used layout] (differentiator, copy-on-create
                      mirroring the v1.6 default-service-template precedent)

[Song lyric/slide editor (existing, v1.6 split-slide precedent)]
    └──enables──> [Inline black slide as a new slide "kind"] (reuses existing slide-insertion UI,
                  no new runtime state — it is authored content, not a live control)

[PresentationViewer.vue + confidence-monitor rendering fork (existing, v2.4)]
    └──requires-fix──> ["Go to black" scoped to Audience output only] (the blackout flag must live
                  on the Audience render branch, not shared state affecting both outputs)
    └──enables (new)──> [Per-item loop: timer-driven auto-advance within one item's own slides,
                  looping first↔last] (independent of the black-slide/blackout-scoping work — can
                  ship in a separate phase)

[Shared banner/toast primitive (new, app-wide)]
    └──requires──> [State-driven condition binding] (banners auto-clear when their trigger
                  resolves — e.g. the "monitors not configured" warning binds to monitor-config
                  state, not a one-shot "shown" flag)
    └──independent-of──> [every other v2.7 feature] (a cross-cutting UI primitive, not gated by or
                  gating any other feature — good candidate for an early, isolated phase)

[Multi-org custom-claim infra (existing, v2.0/v2.1: orgs:{orgId:role} + active-org switch mechanism)]
    └──enables──> [Church switcher exposed in the user menu to regular multi-org members]
                      └──requires──> [Full re-subscription of org-scoped Firestore listeners/stores
                      on switch] (correctness requirement — likely already close to correct, but
                      must be verified, not assumed)
                      └──enhanced-by──> [Per-org role display in the switcher] (near-free, data
                      already in the claim map)
```

### Dependency Notes

- **Rehearsal attachments must land before the Rehearse view can exist** — the Rehearse view is a
  presentation layer over Song attachment data; sequence attachments-on-Song first, Rehearse-view
  second within the milestone's phase ordering.
- **The Rehearse view's grouping-by-service-order can reuse, not reinvent, the slotIndex/section
  grouping logic already established for Run-mode (v2.4 research on file)** — this is low-risk
  reuse, not new design work.
- **Stage layout is architecturally independent of every rehearsal/presentation feature** — it can
  be sequenced in parallel with or separately from the rehearsal-attachment work; its only real
  dependency is deciding the per-service marker data shape, which is new modeling regardless of
  what else ships first.
- **Free-text labeling on stage-plot markers is a design decision that directly enables the
  one-off-speaker-mic requirement** — do not let a "nice to have" instrument icon picker creep in
  during planning, since it structurally conflicts with the ad hoc/one-off case PROJECT.md names as
  the motivating example.
- **The inline black slide and the "Go to black" output-scoping fix are related in spirit
  (both about black-screen behavior) but structurally independent** — one is authored slide
  content, the other is a runtime output-targeting bug fix. They can be separate phases without
  either blocking the other.
- **The per-item loop feature depends only on the existing slide-navigation/rendering machinery**,
  not on the blackout-scoping fix — sequencing flexibility exists between these two Run-flow
  polish items.
- **The dismissible-messages primitive is the most decoupled feature in this milestone** — it is a
  generic, app-wide UI concern with no dependency on song/service/stage data models, making it a
  good candidate to sequence early (fixes a real, currently-annoying bug fast) or to build
  alongside anything else without contention.
- **The church switcher's only real remaining risk is state-reset correctness**, not new
  architecture — the claim/active-org mechanism already works (proven by super-admin's existing
  "enter any church"); the work is primarily UI exposure plus verifying every org-scoped store
  re-subscribes cleanly on switch.

## MVP Definition

### Launch With (v2.7)

- [ ] Attach PDF chord chart, MP3 practice track, and YouTube link to a Song (reusable across
  services) — the foundational rehearsal-attachment capability every downstream Rehearse-view
  feature depends on
- [ ] Rehearse mode on the public shared service link: per-song list (grouped by service order),
  inline MP3 playback (native `<audio>`), PDF view/download, YouTube embed/link, and the song's Key
  shown as plain text — no login required
- [ ] Freeform stage-layout canvas per service with on-stage/off-stage zones and free-text-labeled
  draggable markers, including the ability to add a one-off mic for a guest speaker
- [ ] Inline black slide insertable within a song's slide sequence for instrumental/interlude
  sections, as a new authored slide kind
- [ ] "Go to black" scoped to the Audience output only — confidence monitor stays visible (bug fix)
- [ ] Per-item loop checkbox with a default 10s interval, an interval dropdown, and a custom-value
  option, auto-advancing and looping that item's own slides
- [ ] System-wide dismissible messages: a shared banner/toast primitive where conditional warnings
  (e.g. "monitors not configured") auto-clear when their trigger condition resolves, and every
  message carries a manual dismiss control
- [ ] Church switcher in the user menu for multi-org members, showing each org + the user's role,
  with a full state reset on switch

### Add After Validation (v2.7.x / near-future)

- [ ] Playback-speed control on the practice MP3 (native `playbackRate`, low cost, add once the
  base Rehearse view is validated with real volunteers)
- [ ] Simple loop-a-section on the practice MP3 (in/out markers on the native player)
- [ ] Auto-generated input list derived from the stage plot's placed markers
- [ ] Seed a new service's stage layout from the org's last-used layout (copy-on-create)

### Future Consideration (v3+)

- [ ] Real-time or server-side audio transposition of practice tracks — large scope, defer until
  proven demand outweighs the "display Key as text" workaround
- [ ] Constrained instrument/equipment icon library for stage plots — no demonstrated need beyond
  free-text markers at single-church scale
- [ ] Multi-track stem mixing / isolated-part audio generation — defer to the "attach multiple
  labeled MP3s" workaround unless real demand for a mixer emerges
- [ ] Volunteer login/self-service rehearsal portal with saved progress/favorites — a materially
  larger feature (accounts) explicitly deferred by PROJECT.md this milestone
- [ ] A dedicated live instant-blackout/logo-cut master control — still deferred (carried over from
  v2.4 research); v2.7 only fixes output-scoping of the existing "Go to black," it does not add a
  new blackout affordance
- [ ] Global notification history/log of dismissed messages — no demonstrated need beyond the
  narrow "don't get stuck" bug fix
- [ ] Fine-grained per-slide custom loop timing (vs. one interval per item) — revisit only if the
  single-interval model proves insufficient in real use

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Rehearsal attachments on Song (PDF/MP3/YouTube) | HIGH | LOW–MEDIUM | P1 |
| Rehearse mode on shared link (per-song list, playback, PDF, Key display) | HIGH | MEDIUM | P1 |
| Freeform stage-layout canvas with on/off-stage zones + free-text markers | HIGH | MEDIUM | P1 |
| One-off speaker mic marker support | MEDIUM–HIGH (small but real recurring need) | LOW (free with free-text markers) | P1 |
| Inline black slide in the lyric editor | MEDIUM–HIGH | LOW–MEDIUM | P1 |
| "Go to black" scoped to Audience only | MEDIUM (bug fix / correctness) | LOW–MEDIUM | P1 |
| Per-item loop with interval control | MEDIUM–HIGH | MEDIUM | P1 |
| System-wide dismissible messages | MEDIUM (bug fix / correctness) | LOW–MEDIUM | P1 |
| Church switcher in the user menu | MEDIUM (multi-org usability) | LOW–MEDIUM | P1 |
| Playback-speed control on practice MP3 | MEDIUM | LOW | P2 |
| Loop-a-section on practice MP3 | MEDIUM–HIGH | MEDIUM | P2 |
| Auto-generated stage-plot input list | LOW–MEDIUM | MEDIUM | P2 |
| Seed stage layout from last-used | LOW–MEDIUM | LOW–MEDIUM | P2 |
| Real-time/server-side audio transposition | MEDIUM (real want, high cost) | HIGH | P3 / do not build now |
| Instrument/equipment icon library | LOW (cosmetic at single-church scale) | MEDIUM–HIGH | Anti-feature — do not build |
| Multi-track stem mixing | LOW–MEDIUM | HIGH | P3 / future |
| Volunteer login/self-service portal | MEDIUM (future value) | HIGH | P3 / future milestone |
| Live instant-blackout master control | MEDIUM (real want, deferred twice now) | LOW–MEDIUM (once scoped) | P3 (explicitly deferred again) |
| Notification history/log | LOW | MEDIUM | Anti-feature — do not build |
| Per-slide custom loop timing | LOW (professional-tier polish) | MEDIUM–HIGH | P3 / future |

**Priority key:**
- P1: Must have for v2.7 launch
- P2: Should have, near-future addition once the corresponding P1 feature is validated with real users
- P3: Explicitly deferred or future consideration — do not build without new demand/scope decision

## Competitor Feature Analysis

| Feature | Planning Center Services | ProPresenter | WorshipTools | Stageplot Pro | Our Approach (v2.7) |
|---------|---------------------------|--------------|---------------|----------------|----------------------|
| Rehearsal attachment scope | Song → Arrangement → Key (multi-dimensional) | Per-document/slide, authoring-time | Per-song, rehearsal-focused | N/A | Per-Song only (simpler than PC — matches our single-key song model, no arrangement dimension) |
| Practice track playback | Full mobile media player: isolated parts, loop section, CarPlay/Android Auto | Timeline-synced audio, not a rehearsal player | Up/down mixes, on-demand loop, click/cue tracks | N/A | Native HTML5 `<audio>`, table-stakes only for v1; loop-a-section and playback-speed as P2 |
| Audio transposition | Server-side batch re-render per key | Not applicable | Not detailed in this research pass | N/A | Not built — display Key as text instead; defer real transposition to v3+ |
| Stage/input planning | Not a core PC Services feature | N/A (presentation tool, not audio-planning) | N/A | Full stage-plot builder: 300+ icons, auto input list, venue-agnostic templates | Freeform canvas, free-text markers, on/off-stage zones — deliberately narrower than Stageplot Pro's touring-band feature set |
| Blackout/output scoping | N/A | Independent output toggles (Cmd+2 stage display vs. F1–F5 program clear) — confirms our scoping-fix direction | N/A | N/A | Fix "Go to black" to target Audience output only, matching the independent-output-toggle convention |
| Looping/auto-advance | N/A | "Go To Next" timers + loop cue, saved as reusable Library Playlist, pre-service/announcement use only | N/A | N/A | Per-item loop checkbox, single interval (default 10s) + custom — matches ProPresenter's "same time for all + loop last→first" default tier, not its full per-slide custom-timing tier |
| Dismissible notifications | Not researched (not a differentiator for PC) | Not researched | Not researched | N/A | Standard SaaS toast/banner convention (LogRocket/SaaSUI/Carbon): state-driven auto-clearing banners + always-dismissible toasts |
| Multi-org/workspace switching | N/A (PC's org model differs) | N/A | N/A | N/A | Slack/Notion convention: header/user-menu switcher, per-org role shown, full state reset on switch — exercises existing v2.0/v2.1 claim infra |

## Sources

- Renewed Vision (ProPresenter official) — Chord Charts (ProPresenter 6):
  https://learn.renewedvision.com/propresenter6/the-features-of-propresenter/chord-charts
- Renewed Vision — "How to use MultiTracks.com Search & Chords in ProPresenter 7":
  https://www.renewedvision.com/blog/how-to-use-multitracks-com-search-chords-in-propresenter-7
- Planning Center — Blog: "Product Update: Lyrics, Chords and a Little More":
  https://www.planningcenter.com/blog/2011/01/lyrics-chords-and-a-little-more
- Planning Center Help Center — Songs page overview:
  https://help.planningcenter.com/en/139427-songs-page-overview.html
- Planning Center Help Center — Use the Lyrics & Chords editor:
  https://help.planningcenter.com/en/139440-use-the-lyrics---chords-editor.html
- Planning Center Help Center — MultiTracks integrations:
  https://help.planningcenter.com/en/139447-multitracks-integrations.html
- Planning Center — RehearsalPack integration page: https://www.planningcenter.com/integrations/rehearsalpack
- Planning Center — PraiseCharts integration page: https://www.planningcenter.com/integrations/praisecharts
- Planning Center — Blog: "Introducing the 'Now Playing' view in the mobile media player":
  https://www.planningcenter.com/blog/2023/06/introducing-the-now-playing-view-in-the-mobile-media-player
- Planning Center Help Center — Transpose audio files: https://help.planningcenter.com/en/139442-transpose-audio-files.html
- WorshipLeader Magazine — "Top 10 Worship Rehearsal Tools for 2025":
  https://worshipleader.com/production/worship-team-rehearsal-tools-2025/
- WorshipTools — product site (Rehearse, Charts): https://www.worshiptools.com/en-us and
  https://www.worshiptools.com/en-us/charts
- ProSoundWeb — "Simple Yet Vital: Best Practices In Developing Input Lists And Stage Plots":
  https://www.prosoundweb.com/simple-yet-vital-best-practices-in-developing-input-lists-and-stage-plots/2/
- ProSoundWeb — "Church Sound: The Optimized Stage—Input Sheets":
  https://www.prosoundweb.com/church-sound-the-optimized-stage-input-sheets/
- ProSoundWeb — "Stage Layout Can Make A Big Difference In The Sonic Presentation Of Worship":
  https://www.prosoundweb.com/stage-layout-can-make-a-big-difference-in-the-worship-sonic-picture/
- Sonicbids Blog — "How to Create a Stage Plot and Input List That Sound Techs Will Love":
  https://blog.sonicbids.com/how-to-create-a-stage-plot-and-input-list-that-sound-techs-will-love
- Stageplot Pro — templates & builder: https://stageplotpro.app/templates and https://stageplotpro.app/
- Church AVL (WordPress) — "Stage Plot and Input List":
  https://churchavl.wordpress.com/audio/education/the-fundamentals-of-audio/procedure-tips-and-tricks/stage-plot-and-input-list/
- Renewed Vision Support — "Useful keyboard shortcuts for ProPresenter 6":
  https://support.renewedvision.com/hc/en-us/articles/360011515054-Useful-keyboard-shortcuts-for-ProPresenter-6
- Renewed Vision Support — "Keyboard Shortcuts in ProPresenter":
  https://support.renewedvision.com/hc/en-us/articles/360042123293-Keyboard-Shortcuts-in-ProPresenter
- oper.io — "ProPresenter: Automatically Advancing Slide Loops":
  https://oper.io/?p=Church+IT%2FProPresenter%3AAutomatically_Advancing_Slide_Loops
- Renewed Vision Support — "How do I create a looping presentation?":
  https://support.renewedvision.com/hc/en-us/articles/360011694134-How-do-I-create-a-looping-presentation-
- LogRocket Blog — "What is a toast notification? Best practices for UX":
  https://blog.logrocket.com/ux-design/toast-notifications/
- SaaSUI Blog — "SaaS Notification UX: Real Examples & Patterns":
  https://www.saasui.design/blog/saas-notification-toast-ux-patterns
- Carbon Design System — Notification pattern: https://carbondesignsystem.com/patterns/notification-pattern/
- Zenn.dev — "[SaaS Design] Multi-Tenant Architecture Patterns for SaaS Development":
  https://zenn.dev/shineos/articles/saas-multi-tenant-architecture-2025?locale=en
- Orbix Studio — "Multi-Tenant Dashboard Design: A Guide for Enterprise SaaS":
  https://www.orbix.studio/blogs/multi-tenant-dashboard-design
- Covio Agency — "Improving UX for Multi-Tenant SaaS Platforms: Top Strategies":
  https://covio.agency/improving-ux-for-multi-tenant-saas-platforms/
- WorshipPlanner codebase (read directly, not inferred): `.planning/PROJECT.md` (v2.7 milestone
  scope, feature decisions, existing Song/service data model, existing multi-org claim
  infrastructure from v2.0/v2.1, existing Rehearsal-adjacent precedents: v1.4/v1.5 Storage upload
  pattern, v1.5 share-link/snapshot mechanism, v1.6 split-slide editor and default-service-template
  copy-on-create pattern, v2.3 editable song Key field, v2.4 Run-mode slotIndex/section grouping and
  confidence-monitor rendering fork)

---
*Feature research for: rehearsal media & shared rehearse view, visual stage plots, and
presentation/multi-org polish — WorshipPlanner v2.7*
*Researched: 2026-08-31*
