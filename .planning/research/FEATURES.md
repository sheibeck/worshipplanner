# Feature Research

**Domain:** Live worship-presentation / projection "run mode" software (ProPresenter, EasyWorship,
Faithlife Proclaim, OpenLP, FreeShow, MediaShout) — informing WorshipPlanner v2.4 "Run the Service"
**Researched:** 2026-08-28
**Confidence:** MEDIUM (cross-checked across ≥2 independent web sources per claim — official vendor
support docs for ProPresenter/EasyWorship/Proclaim/OpenLP/FreeShow, plus church-AV trade press; no
official docs were fetched via an authoritative code-doc provider (Context7/Ref unavailable in this
environment; Brave key not configured), so treat exact keystrokes as a strong convention to imitate,
not a verbatim spec — verify against our own UAT once built, per LOW→MEDIUM websearch classification.)

## How the reference tools actually work when RUNNING a service

This section answers the six sub-questions directly before the categorized tables, since the
downstream consumer (requirements) needs the shape of the convention, not just a feature list.

**1. Operator/control screen layout.** Every tool researched (ProPresenter, EasyWorship, Proclaim,
OpenLP, "Church Presenter") uses the same three-pane shape: a **Schedule/Playlist/Order-of-Service
list down one side** (items in service order), a **large current-slide preview** in the center, and
either an inline **next-slide indicator** or a dedicated next-item highlight in the list itself.
Clicking an item in the list jumps the live output to that item's first slide — described verbatim by
Church Presenter's own docs ("click each item in order and it will go live") and Proclaim's Order of
Service view ("lays out the entire flow so your operator just follows along"). The **currently-live
item is visually distinguished** in the list (highlight/bold/color), separate from the operator's
selection cursor in tools with a Preview/Live split (ProPresenter, EasyWorship) — but Proclaim's
volunteer-first design collapses that split, which is the better model for a **non-technical single
operator**: what's selected IS what's live, no separate "send to live" step to forget.

**2. Confidence/stage monitor conventions.** Every major tool treats the stage/confidence output as a
**separate, deliberately impoverished view**: Proclaim names it literally "Confidence Monitor — a
high-contrast, text-only view" sent to the stage; ProPresenter's Stage Display shows current-slide
text/preview + next-slide text/preview + timers/clock + stage messages, but is edited in its own Look
layout independent of the audience Look. Trade-press guidance (Church Production Magazine, Igniter
Media) confirms the reasoning: backgrounds are suppressed because (a) a busy image behind small stage
text hurts legibility at a glance from a musician's peripheral vision, and (b) stage screens angled
toward the platform are frequently visible to lateral-seated congregation members, so anything on them
should assume it might leak into their view — plain text on black is the safe default, never full
production graphics. **What to show:** current slide text + next slide text (this is the universal
core — every tool researched has it). **What NOT to show:** background images/video, operator chrome
(arrows, counters), any organizational-only metadata. A clock/timer is common but explicitly a
*differentiator*, not required for v2.4 scope.

**3. Keyboard navigation standards.** Converging pattern across ProPresenter, EasyWorship, OpenLP:
**Right Arrow / Space = next slide**, **Left Arrow = previous slide** (ProPresenter also accepts
Backspace-equivalent-adjacent patterns; EasyWorship's Left/Right is exact). A **second axis** —
**Up/Down Arrow = previous/next item** (EasyWorship: "Down Arrow selects Next Schedule Item"; OpenLP:
comparable service-item stepping) — is the consistent way tools separate "move within the current
song/reading" from "jump to the next thing in the order of service." **Escape** is the universal
convention for leaving a fullscreen/live view in presentation software generally (and is already
implemented in `PresentationViewer.vue`). **Page Up/Page Down** appear as a secondary next/prev
binding in some tools (EasyWorship binds Page Down to "Go Live") and are worth supporting as aliases
since they're the PowerPoint-era muscle memory a lot of volunteers already have. **B for black** is
not literally what any tool binds (ProPresenter uses Cmd/Ctrl+1 to toggle output; EasyWorship uses
Ctrl+B specifically, which does spell out "B"), so "B" as a mnemonic is real but the modifier differs
per tool — worth reserving even though blackout itself is deferred this milestone (see §4).

**4. Blackout / clear / logo (context for what we're deferring).** The three-way distinction that
recurs across tools (most explicit in EasyWorship, present conceptually in ProPresenter's F1–F4 tier)
is: **Clear** = blank the *content* but the underlying scene/background may remain (or in
ProPresenter's finer-grained model, F1 clears everything, F2 clears just the slide layer, F3 clears
just the background layer); **Black** = a hard, unconditional full-black cut on the output, independent
of what content is loaded — the "physically pull the plug on distraction" control; **Logo** = show a
static branded/neutral graphic instead of either. WorshipPlanner v2.4 explicitly **defers** the instant
blackout/logo-cut button. Knowing the convention now means the run-mode UI should reserve a visual and
keyboard affordance (a slot in the button row, a spare key like `B`) rather than needing a
disruptive retrofit later — but no blackout logic needs building this milestone.

**5. Audience output.** Universal and non-negotiable across every tool: the audience-facing output is
**full slide with background, zero operator chrome** — no arrows, no slide counters, no
organizational/internal labels. This already matches WorshipPlanner's existing `PresentationViewer.vue`
audience rendering (background layer + slide content, no persistent visible chrome — the existing
`presentation-chrome` bar already auto-hides after 3s of inactivity and is *itself* meant only for a
single-monitor verification-preview use case, not the true audience output). **Transitions/fades:**
present in ProPresenter (dissolve, cut, and more) and configurable per-document, but the research
surfaced no evidence they're expected as baseline — they're a polish/production-value layer on top of
a working cut-based system, and multiple tools (EasyWorship, OpenLP, "Church Presenter") ship with
simple cuts as the default experience volunteers actually use. **Verdict: fades are a differentiator,
not table stakes, for v2.4** — a hard cut between slides is exactly what real churches run day to day,
and it's what `PresentationViewer.vue` already does.

**6. Non-technical usability / one-click start.** Proclaim is explicit about this being a competitive
axis ("Quick Screens... no training required," "<30 min" first-run setup); MediaShout markets itself
similarly ("intuitive interface built with media volunteers in mind"). The common friction points
named in trade press and this research: (a) **timing** — advancing a slide at the *wrong moment*
relative to what's being sung/said is a training problem, not a UI problem, and no amount of software
design fixes it, but a **calm, low-chrome, high-contrast current-slide view** reduces the chance of
losing your place; (b) **losing track of "where am I"** — solved by the current-item highlight in the
order-of-service list, which is why every tool has one; (c) **fear of a technical setup step** (multi-
monitor assignment, output routing) blocking the *actual* task of running slides — this is exactly why
v2.4 separates monitor configuration into its own persistent, remembered-per-device setup screen so
"Run" becomes a single click on a normal Sunday once configured once.

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Order-of-service list with current-item highlight | Universal across every tool researched (ProPresenter Schedule, EasyWorship Schedule, Proclaim Order of Service, OpenLP Service Manager); a non-technical operator's primary orientation cue — "where am I in the service." | LOW–MEDIUM | Derive directly from the existing flat `AssembledSlide[]` by grouping on `slotIndex` (already present per slide, per `slide.ts`) — no new data model needed, just a client-side grouping/derivation. |
| Large current-slide preview | The dominant visual element in every tool's operator screen; the operator needs to read exactly what the audience is seeing, at a glance, without squinting at a thumbnail. | LOW | `PresentationViewer.vue`'s existing slide-canvas rendering is already this component's shape — the run/control screen reuses the same per-kind rendering, just windowed smaller instead of true fullscreen. |
| Click an order-of-service item to jump to its first slide | Named explicitly by Church Presenter ("click each item in order and it will go live") and structurally implied by every tool's Schedule/Playlist click-to-select behavior. Table stakes because a live service frequently runs out of the planned order (a repeated verse, a skipped announcement). | LOW–MEDIUM | Needs a lookup from order-of-service item (grouped by `slotIndex`) → the first `AssembledSlide` index carrying that `slotIndex`. `PresentationViewer.vue` already accepts an `initialIndex` prop (R061) for exactly this "open on a specific slide" need — the run screen's own navigation state can reuse the same jump mechanic. |
| Next-slide preview (small, alongside or below current) | Present in every tool as either an inline "next slide" panel on the operator screen and/or on the confidence monitor; operators rely on it to anticipate the upcoming cue. | LOW | Trivial derivation: `slides[currentIndex + 1]`, already effectively computed by the existing `atLast`/`currentIndex` logic in `PresentationViewer.vue`. |
| Standard keyboard navigation (Right/Space = next, Left = previous, Escape = exit) | The de-facto convention across ProPresenter, EasyWorship, OpenLP; matches muscle memory from PowerPoint/Keynote presenter mode too. | LOW | Already implemented in `PresentationViewer.vue`'s `handleKeydown` (ArrowRight/Space→next, ArrowLeft/Backspace→prev, Escape→exit) — the run-mode control screen should bind the SAME keys, not invent new ones, and this existing implementation is the reference to extend, not replace. |
| Next/Previous ORDER-OF-SERVICE-ITEM keys (Down/Up Arrow), distinct from next/prev slide | EasyWorship binds Down/Up Arrow to "Next/Previous Schedule Item" specifically so operators can skip an entire song or reading without hand-cranking through every slide; OpenLP has the equivalent split (arrow keys move within an item, other keys jump items). | LOW–MEDIUM | New binding for our run mode — Right/Space/Left already own within-item navigation, so Down/Up (or a dedicated "next item"/"prev item" affordance) is free to bind to the `slotIndex`-jump behavior above, reusing the same lookup as click-to-jump. |
| Audience output: fullscreen slide + background, zero operator chrome | Universal, non-negotiable convention — every tool strips arrows/counters/labels from what the congregation sees. | LOW (mostly done) | `PresentationViewer.vue`'s slide-canvas + background layer is already this; the run-mode work is routing this exact rendering to a second (Window-Management-API-placed or popped-out) window rather than the current single in-app modal, and suppressing the `presentation-chrome`/exit-button bar entirely on that output (today it auto-hides but is never fully absent). |
| Confidence monitor: current + next slide, background suppressed to black, no chrome | Universal convention (Proclaim's literal "Confidence Monitor," ProPresenter's Stage Display, industry trade-press consensus on why: legibility at a glance + avoiding lateral-seating leak of stage-facing screens into the congregation's view). Already explicitly scoped as a v2.4 target feature in PROJECT.md. | MEDIUM | New rendering mode of the SAME slide data: reuse `AssembledSlide.slide` text-extraction logic already in `PresentationViewer.vue` (the per-`slideKind` template branches), but render against a forced-black background (ignore `currentBackgroundUrl`) and add a simple "next slide" secondary text block below/beside it. No change to the underlying slide data model required. |
| A locked service is a precondition to Run | Already an existing app invariant (services lock to become non-draft); prevents running a service that's still being edited mid-service — every reference tool implicitly assumes the running deck isn't being restructured live. | LOW (already exists) | Purely a gating check on `service.status`/lock state before exposing the "Run" entry point — no new data model. |
| Standalone, persistent monitor-role assignment (remembered per device) | Proclaim/MediaShout differentiate on "under 30 minutes to first run" — the pattern that makes THAT possible is doing the multi-monitor setup ONCE, not every Sunday. Not literally present as a feature in any single tool researched (they mostly assume a fixed AV rig, not a volunteer's personal laptop), but it is the direct translation of the "one-click start" usability finding (§6) into our browser-based, BYO-device context. | MEDIUM–HIGH | This is WorshipPlanner's own adaptation of the pattern (no direct analog to copy), already scoped as a v2.4 target — depends on the Window Management API screen-enumeration + a persisted per-device mapping, which is genuinely new work, not a slide-model dependency. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Single-selection model (no separate Preview/Live panes) | ProPresenter and EasyWorship both have a Preview-vs-Live split (select in preview, then push to live) — powerful for a trained operator but an extra concept and an extra step for a volunteer who's already anxious. Proclaim collapses this ("no training required"). Our locked, non-technical run screen should follow Proclaim's simpler model: whatever is selected/current IS what's live, always. | LOW (avoids building the harder thing) | This is a design decision to NOT build the Preview/Live split, not a feature to add — noting it here so requirements don't accidentally scope in the more complex two-pane pattern by copying ProPresenter's operator screen too literally. |
| Calm, minimal operator chrome (large type, few controls, no jargon) | None of the reference tools optimize purely for a first-time, one-Sunday-a-month volunteer — they're built for a semi-technical regular operator. WorshipPlanner's explicit target user ("non-technical projectionist") is a narrower, more forgiving-by-design bar than any competitor's default UI. | LOW–MEDIUM | Aligns with PROJECT.md's stated goal ("calm, non-technical UX") — mostly a UI/UX execution differentiator on top of table-stakes functionality, not a new capability. |
| Slide/section label in the confidence monitor's current text (e.g. "Verse 2") | ProPresenter's stage display can show notes/labels alongside lyric text; most tools leave this optional/configurable. For a WorshipPlanner service already carrying `SERVICE_SECTION_LABELS` and slide `section` metadata, surfacing "which section" costs nothing extra to compute and helps a musician confirm they're where they think they are. | LOW | Direct reuse of `AssembledSlide.section` + `SERVICE_SECTION_LABELS`, the same fields `PresentationViewer.vue`'s existing `progressLabel` already reads — no new field needed. |
| Countdown/elapsed timer on the confidence monitor | Common in ProPresenter/Proclaim stage displays (count up during a sermon, count down to a hard stop). Valuable but explicitly NOT part of the audience-output/slide-data model — pure client-side clock logic. | LOW–MEDIUM | No dependency on the slide model at all; purely additive if scoped in later. Not called out in PROJECT.md's v2.4 target list — flag as a candidate stretch feature, not required. |
| Slide transitions/fades on the audience output | ProPresenter supports dissolve/cut/etc., configurable per document — genuine production polish. Not table stakes (§5 above: EasyWorship/OpenLP/Church Presenter's baseline experience is hard cuts, and `PresentationViewer.vue` already cuts). | MEDIUM | If ever pursued, it's a CSS-transition layer on the existing slide-canvas swap in `PresentationViewer.vue` — no slide-model change, but real complexity around syncing media (video/audio) start/stop with a non-instant visual transition (today's `goToIndex` pause/reset/play sequencing assumes an instant swap). Out of v2.4 scope; do not build speculatively. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| A full Preview/Live two-pane operator model (copy ProPresenter/EasyWorship exactly) | Feels like the "professional" way to do it since the market leaders both work this way. | Adds a whole extra concept (staged-but-not-live selection, a "push to live" action) that a once-a-month volunteer has to learn correctly under time pressure — exactly the complexity Proclaim differentiates AWAY from, and exactly the complexity PROJECT.md's "non-technical projectionist" framing argues against. | Single-selection model (see Differentiators above): clicking an item or slide makes it live immediately, matching Proclaim's simpler mental model. |
| Rich stage-display customization (drag-and-drop layout editor, arbitrary objects/timers/messages per Look) | ProPresenter's Stage Display editor is powerful and heavily marketed; feels like "we should have that too." | This milestone's confidence monitor need is narrow and already fully specified by PROJECT.md (current + next slide, black background, no chrome) — a general layout editor is a different, much larger product surface (custom widgets, per-service Look presets) with no demonstrated need from a single-church, two-monitor context. | Ship the fixed current+next/black-background confidence view as scoped. If richer stage-display customization is ever wanted, it's a future milestone evaluated against real demand, not built speculatively alongside basic Run functionality. |
| Building the instant blackout/logo-cut button now, "since we're already in here" | The convention research (§4) surfaces it clearly, and it's a small, self-contained control — tempting to just add it while building the run/control screen. | PROJECT.md explicitly defers it out of v2.4 scope; scope creep here delays shipping the core run-mode value (getting off the in-app single-window preview and onto two real monitors) for a feature that wasn't asked for this milestone. | Reserve the UI slot and a keyboard key (see §4) so the retrofit is additive later, but do not implement blackout logic in v2.4. |
| Fade/dissolve transitions on the audience output | ProPresenter supports them and it "looks more professional." | Real complexity given the existing imperative media lifecycle (`goToIndex`'s pause-reset-play sequencing assumes an instant, synchronous slide swap) — a transition means two slides briefly coexist on screen, which the video/audio pause-before-index-write invariant (T-23-08, documented in `PresentationViewer.vue`) was deliberately built to avoid. Multiple reference tools ship with cuts as their default working experience anyway (§5), so this is not solving an unmet expectation. | Ship hard cuts (already the existing behavior) for v2.4; treat fades as a possible, carefully-scoped future differentiator, not a default to chase now. |
| Auto-advance / timed slide progression | Common ask from churches wanting "hands-free" playback for pre-service loops or announcements. | Out of scope for a LIVE, human-paced worship service — the entire point of a manual operator (vs. a video loop) is that singing/speaking pace varies moment to moment; auto-advance would fight the operator rather than help them, and none of the reference tools use it for the live worship portion of a service (only for pre-service slideshows, a different feature entirely). | Manual, click/keyboard-driven advance only — matches every reference tool's live-service behavior and the existing `PresentationViewer.vue` navigation model. |
| Remote/mobile "Proclaim Remote"-style companion app for the run screen in v2.4 | Proclaim and ProPresenter both offer a phone/tablet remote so a worship leader can advance their own slides. | A second client surface (auth, real-time sync to a second device, a different responsive layout) is a materially larger scope than "one operator, two monitors, one Chrome/Edge window" — PROJECT.md scopes v2.4 to a single browser window driving two outputs, not a multi-device remote-control system. | Single-operator, single-browser-window run screen for v2.4. A remote-control companion is a plausible FUTURE milestone if a specific church workflow demands it, not a default to build now. |

## Feature Dependencies

```
[AssembledSlide[] flat deck model (existing)]
    └──already provides──> [slotIndex, section, groupId per slide] (satisfied — src/types/slide.ts)
                               └──enables──> [Order-of-service list grouped by slotIndex]
                                                 └──enables──> [Current-item highlight]
                                                 └──enables──> [Click-item-to-jump] (reuses PresentationViewer's
                                                                existing `initialIndex` jump mechanic, R061)
                                                 └──enables──> [Next/Prev-ITEM keyboard nav]
                                                                (Down/Up Arrow — distinct from existing
                                                                Next/Prev-SLIDE Right/Space/Left)

[PresentationViewer.vue's existing per-slideKind rendering + goToIndex/keyboard nav]
    └──reused-by──> [Run/control-screen current-slide preview] (same rendering, smaller viewport)
    └──reused-by──> [Audience output] (same rendering, routed to a second real display instead of an
                    in-app modal — the delta is WINDOW PLACEMENT, not slide rendering)
    └──reused-by, with modification──> [Confidence monitor output]
                                          └──requires──> [background suppression override]
                                                          (ignore currentBackgroundUrl, forced black — new,
                                                          small branch on the existing rendering, not a new
                                                          slide-data field)
                                          └──requires──> [next-slide text derivation] (slides[currentIndex+1],
                                                          trivial given the existing flat array + currentIndex)

[Locked-service gate (existing app invariant)]
    └──blocks (prerequisite for)──> [Run button becomes available]

[Window Management API + per-device monitor-role persistence]
    └──independent of──> [slide model / rendering work above] (pure browser-API + storage concern)
    └──enables──> [One-click "Run" on a returning device] (the core non-technical-usability finding, §6)

[Instant blackout/logo-cut button — DEFERRED]
    └──requires (when eventually built)──> [a dedicated output-state layer above the current slide
                    render] (does not exist yet; reserve UI/key space now per §4, build later)

[Slide transitions/fades — NOT SCOPED]
    └──conflicts with──> [existing goToIndex pause-reset-play instant-swap invariant, T-23-08]
                    (would require restructuring the media-lifecycle sequencing; do not combine with
                    core Run-mode delivery in the same phase if ever pursued)
```

### Dependency Notes

- **Order-of-service grouping requires nothing new from the slide model.** `AssembledSlide.slotIndex`
  already exists precisely to answer "which order-of-service item does this slide belong to" — the
  run-mode list, current-item highlight, and click-to-jump can all be built as pure client-side
  derivations over the existing flat array, with zero Firestore schema changes.
- **Click-item-to-jump reuses, not reinvents, the R061 `initialIndex` mechanic.** `PresentationViewer.vue`
  already supports opening on an arbitrary slide index (built for the Slides-tab "Present from here"
  flow) — the run screen's jump behavior is the same capability exposed through a different UI trigger
  (clicking a list item vs. clicking a slide card), not new navigation logic.
- **Confidence monitor is a rendering-mode fork of the audience renderer, not a second slide model.**
  Both outputs read the identical `AssembledSlide[]`/`currentIndex` state; the confidence monitor's
  only structural difference is (a) forcing the background to black regardless of
  `currentBackgroundUrl`, and (b) additionally rendering `slides[currentIndex + 1]`'s text. Keeping
  this as a rendering fork (not a parallel data path) is what keeps the two outputs guaranteed to
  agree on "what slide are we on" — exactly the kind of single-source-of-truth discipline this
  codebase has been burned by violating before (see `CLAUDE.md`'s note on the two-orderings mirroring
  bugs).
- **Multi-monitor delivery is orthogonal to all slide-rendering work.** The Window Management API /
  per-device persistence work can proceed on its own phase timeline; it doesn't gate or get gated by
  the order-of-service/current-item/confidence-monitor feature work above, which is useful for
  phase-sequencing flexibility.
- **Blackout/logo-cut and transitions are both explicitly OUT of v2.4** — listed in the dependency
  graph only so a later milestone knows what NOT to bolt onto core Run delivery without the
  groundwork (an output-state layer for blackout; a media-lifecycle restructure for transitions).

## MVP Definition

### Launch With (v2.4)

- [ ] Run/control screen: order-of-service list (grouped by `slotIndex`) with the current item clearly
  highlighted — this is the universal orientation cue every reference tool has, and the milestone's
  named core ask
- [ ] Large current-slide preview on the run/control screen, reusing `PresentationViewer.vue`'s
  existing per-kind slide rendering
- [ ] Click an order-of-service item to jump to its first slide, reusing the existing `initialIndex`
  jump mechanic
- [ ] Standard keyboard navigation: Right Arrow/Space = next slide, Left Arrow = previous slide
  (already implemented — extend, don't replace), Escape = exit run mode (already implemented), plus
  NEW Down/Up Arrow = next/previous order-of-service item
- [ ] Audience output: fullscreen slide + background, zero operator chrome, routed to a real second
  display (not the in-app modal) — reuses existing slide rendering, new is the window/display routing
- [ ] Confidence monitor output: current + next slide, background suppressed to black, no chrome — new
  rendering fork of the same slide data, plus a trivial next-slide-text lookup
- [ ] Locked-service gate on the Run entry point (already an existing app invariant — just wire the
  new entry point behind it)
- [ ] Standalone, persistent per-device monitor-role assignment (Audience vs Confidence), so returning
  to Run a service is effectively one click once configured — the concrete translation of the
  "one-click start" usability finding into WorshipPlanner's browser-based context

### Add After Validation (v2.4.x / near-future)

- [ ] Slide/section label surfaced on the confidence monitor (e.g. "Verse 2") — trivial given existing
  `section`/`SERVICE_SECTION_LABELS` data, but not named in PROJECT.md's target list; add once the core
  confidence-monitor view is validated with a real projectionist
- [ ] Countdown/elapsed timer on the confidence monitor — no slide-model dependency, purely additive

### Future Consideration (v3+)

- [ ] Instant blackout / logo-cut button — explicitly deferred this milestone (PROJECT.md); reserve UI
  and key space now, build the output-state layer later
- [ ] Non-Chromium monitor auto-detection — explicitly deferred this milestone (PROJECT.md)
- [ ] Slide transitions/fades on the audience output — not table stakes (§5), and conflicts with the
  existing instant-swap media-lifecycle invariant; only revisit with a dedicated phase if real demand
  emerges
- [ ] Rich, customizable stage-display layouts (à la ProPresenter's Stage Display editor) — no
  demonstrated need beyond the fixed current+next/black view this milestone scopes
- [ ] Remote/mobile companion control app (à la Proclaim Remote) — a materially larger scope than the
  single-browser-window, two-monitor model v2.4 targets

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Order-of-service list + current-item highlight | HIGH | LOW–MEDIUM | P1 |
| Large current-slide preview (run screen) | HIGH | LOW | P1 |
| Click-item-to-jump | HIGH | LOW–MEDIUM | P1 |
| Standard keyboard nav (Right/Space/Left/Esc, extended with Up/Down for items) | HIGH | LOW–MEDIUM | P1 |
| Audience output (fullscreen, chrome-free, real 2nd display) | HIGH | MEDIUM (rendering reuse; NEW display routing) | P1 |
| Confidence monitor (current+next, black bg, no chrome) | HIGH | MEDIUM | P1 |
| Locked-service Run gate | MEDIUM (safety/correctness) | LOW (already exists) | P1 |
| Persistent per-device monitor-role assignment | HIGH (this IS the "one-click" usability payoff) | MEDIUM–HIGH | P1 |
| Section/label on confidence monitor | LOW–MEDIUM | LOW | P2 |
| Countdown/elapsed timer on confidence monitor | LOW–MEDIUM | LOW–MEDIUM | P2 |
| Instant blackout/logo-cut button | MEDIUM (real want, per convention research) | LOW–MEDIUM (once scoped) | P3 (explicitly deferred) |
| Slide transitions/fades | LOW (not expected per research) | MEDIUM–HIGH (media-lifecycle conflict) | P3 (do not build speculatively) |
| Full Preview/Live two-pane operator model | LOW (adds complexity for our target user) | HIGH | Anti-feature — do not build |
| Remote/mobile companion app | LOW (out of stated scope) | HIGH | P3 / future milestone |

**Priority key:**
- P1: Must have for v2.4 launch
- P2: Should have, near-future addition once core Run mode is validated with a real projectionist
- P3: Explicitly deferred or future consideration — do not build without new demand/scope decision

## Competitor Feature Analysis

| Feature | ProPresenter | EasyWorship | Proclaim | OpenLP / FreeShow | Our Approach (v2.4) |
|---------|--------------|-------------|----------|--------------------|----------------------|
| Operator screen model | Schedule list + separate Preview/Live panes | Schedule list + separate Preview/Live panes | Order of Service, single-selection ("just follow along") | Service Manager + Live Controller, arrow-key driven | Follow Proclaim's simpler single-selection model — no Preview/Live split, matching our non-technical-operator target |
| Confidence/stage output | Fully customizable Stage Display (text, timers, messages, objects) | Alternate Output (foreground/background/duplicate/blank per item) | "Confidence Monitor" — fixed high-contrast, text-only current+next | FreeShow Stage View — current+next, timer, notes, editable boxes | Fixed current+next, black background, no chrome — matches the FreeShow/Proclaim narrower model, not ProPresenter's fully custom layout editor |
| Keyboard nav | Space/Right=next, Left=prev, F1–F4=clear tiers, Cmd/Ctrl+1=output toggle | Right/Left=slide, Up/Down=schedule item, Ctrl+B=black, Ctrl+L=logo | Not independently documented in this research pass (Order-of-Service click-driven) | OpenLP: arrow keys within item, Left/Right jumps service item | Right/Space=next slide, Left=prev slide (existing), NEW Down/Up=next/prev order-of-service item, Escape=exit (existing) — a direct blend of the ProPresenter/EasyWorship/OpenLP conventions |
| Blackout/clear/logo | F1 (clear all) / F2 (clear slide) / F3 (clear background) / F4 (clear props) | Ctrl+B (black) / Ctrl+C (clear text) / Ctrl+L (logo) — clearest 3-way split | Not detailed in this research pass | Not detailed in this research pass | Deferred entirely in v2.4; reserve UI/key slot per the EasyWorship 3-way convention for a future build |
| Audience output | Fullscreen, chrome-free, transitions available | Fullscreen, chrome-free | Fullscreen, chrome-free | Fullscreen, chrome-free | Fullscreen, chrome-free (existing `PresentationViewer.vue` rendering), hard cuts only, routed to a real second display via Window Management API |
| Multi-monitor / first-run setup | Manual display assignment, semi-technical | Manual display assignment | Documented "Configure My Display Outputs" flow, <30 min claimed | Manual per-tool configuration | Persistent, per-device remembered monitor-role assignment via a dedicated setup screen — our own adaptation, no direct single-tool analog, aimed specifically at repeat-Sunday one-click start on a volunteer's own device |

## Sources

- Renewed Vision (ProPresenter official support) — Stage Display / Stage Screen articles:
  https://support.renewedvision.com/hc/en-us/articles/360011515154-Using-the-Stage-Display-to-its-full-potential
  and https://support.renewedvision.com/hc/en-us/articles/360041407794-Using-a-Stage-Screen-to-its-Full-Potential
- Renewed Vision — ProPresenter 6 keyboard shortcuts:
  https://support.renewedvision.com/hc/en-us/articles/360011515054-Useful-keyboard-shortcuts-for-ProPresenter-6
- Renewed Vision — ProPresenter transitions:
  https://support.renewedvision.com/hc/en-us/articles/360041342354-Using-Transitions-In-ProPresenter
- EasyWorship official help — Show Control / Schedule keyboard shortcuts:
  https://help.easyworship.com/HelpfulShortcutKeys.html
- Faithlife Proclaim — official features and Confidence Monitor support article:
  https://faithlife.com/products/proclaim/features and
  https://support.proclaim.logos.com/hc/en-us/articles/19864188689037-Confidence-Monitor
- OpenLP official manual — Service and Live Controller shortcut behavior: https://manual.openlp.org/service.html
- FreeShow official docs — Stage view: https://freeshow.app/docs/stage
- Church Presenter — setup/workflow blog (operator screen, keyboard shortcuts, volunteer onboarding
  advice): https://www.churchpresenter.org/blog/how-to-set-up-worship-presentation-software/
- Church Production Magazine — confidence monitor setup/best-practices:
  https://www.churchproduction.com/magazine/confidence-monitor-basics-advice-for-first-time-set-up-or-a-/
- Igniter Media — "What Is A Confidence Monitor?": https://www.blog.ignitermedia.com/post/what-is-a-confidence-monitor
- MediaShout / The Lead Pastor — church presentation software comparisons, volunteer ease-of-use framing:
  https://mediashout.com/ and https://theleadpastor.com/tools/church-presentation-software/
- WorshipPlanner codebase (read directly, not inferred): `src/components/PresentationViewer.vue`
  (existing keyboard nav, rendering-per-kind, media lifecycle, `initialIndex`/R061 jump mechanic),
  `src/types/slide.ts` (`AssembledSlide` — `slotIndex`, `section`, `groupId`), `src/types/slideGroup.ts`
  (`SlideGroup`/`GroupSlideEntry` model), `.planning/PROJECT.md` (v2.4 milestone scope and deferred items)

---
*Feature research for: live worship-presentation "Run the Service" mode — WorshipPlanner v2.4*
*Researched: 2026-08-28*
