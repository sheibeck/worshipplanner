# Feature Research

**Domain:** Church worship-service planning SaaS — v2.14 additions (dashboard, volunteer confirmation, live-stream Video output)
**Researched:** 2026-09-07
**Confidence:** MEDIUM (cross-checked across multiple independent sources for each of the three feature areas; no single-source claims are presented as settled)

This research covers only the three NEW v2.14 feature areas per the milestone scope. It does not
re-research the shipped weekly-service builder, song stable, slide management, multi-monitor
presentation, stage layout, volunteer messaging, or "My Schedule"/share-page surfaces — those are
existing, already-built features this research treats as given (and as data sources for the dashboard).

---

## 1. Dashboard / Home Screen

### What competitors and adjacent tools actually put on a landing dashboard

**Planning Center Home** (the category leader) does not lead with metrics or coverage percentages.
Its dashboard is explicitly a **"needs your attention" task feed** — a chronological list of things
that require action (new scheduling requests, unread messages, plans awaiting your input) rather than
a KPI wall. Planning Center Services' plan-level view shows songs, scheduled volunteers, and notes
so the team can see "are we ready" at a glance. Its mobile app similarly foregrounds "respond to serve
requests" as the primary action.
*(Confidence: MEDIUM — planningcenter.com/home, help.planningcenter.com — official source, but the
pass could not access the live authenticated UI, only marketing/help copy.)*

**ProPresenter** does not appear to have a published, named "readiness dashboard" concept at all — no
public documentation surfaced a Prepare-stage readiness view. This is worth noting explicitly as a
**gap** the owner should not assume exists to copy from; ProPresenter's PCO integration syncs
order-of-service into playlists and links content per cue, but that is an authoring convenience, not a
dashboard widget. *(Confidence: LOW — absence-of-evidence, not evidence-of-absence.)*

**Adjacent church-scheduling tools** (Pushpay, Breeze, WorshipTools, MxU) converge on the same handful
of home-screen elements: **upcoming events/services**, **volunteer response status** (who has
accepted/declined), **gap alerts** (open slots needing a volunteer), and a **notification digest**.
MxU explicitly brands one of its home elements a "live service dashboard." *(Confidence: MEDIUM —
consistent across 4 independent vendor sources.)*

**General SaaS dashboard practice (2026)** reinforces constraints, not just content: keep to
**5–9 core widgets** (progressive disclosure — don't try to show everything at once), put
**high-priority/action-needed items above the fold**, respect **F-pattern scanning** (top bar → left
column first), and **explicitly design empty/error states** for a widget with no data yet (e.g., a
brand-new org with zero services) rather than leaving it blank. *(Confidence: MEDIUM — consistent
across multiple 2026 UX-practice sources.)*

**Synthesis for this app:** the pattern that recurs everywhere is **"what needs my attention before
Sunday"**, not a metrics/BI dashboard. That directly validates the owner's stated direction (readiness
signal + unconfirmed volunteers) over the old "Volunteer coverage" metric, which had no defined
denominator and matched nothing seen in any competitor.

### Candidate widget list

Complexity ratings account for what already exists: song/media/roles/slides/lock-state data is
**already modeled** in this app (service documents, roster assignments, slide items); the only
genuinely new data model this milestone is volunteer confirmation state (see Section 2).

#### Table Stakes (build these — directly requested by the owner, and match every competitor's home screen)

| Widget | Why Expected | Complexity | Notes |
|--------|--------------|------------|-------|
| **Upcoming services list** | Every competitor dashboard leads with "what's coming up"; matches PC Home, Breeze, WorshipTools | LOW | Query already-existing `services` collection, sort by date, filter to non-past. Likely already partially exists in some form on the current dashboard. |
| **Readiness signal per upcoming service** | Owner-confirmed direction; matches the "needs attention" pattern universal across competitors | MEDIUM | Composite of existing data: songs have media attached (song attachments from v2.11), roles filled (roster assignments), slides built (slide count > 0 per song/item), Draft vs Planned/locked state. Needs a defined rollup rule (e.g., "3 of 4 checks green" vs a binary all-or-nothing) — this is a **product decision to make at requirements time**, not a research gap. |
| **Unconfirmed volunteers** | Owner-confirmed direction; directly matches the accepted/declined/pending pattern used by every volunteer-scheduling competitor (Section 2) | MEDIUM–HIGH | **Depends on the new confirmation feature (Section 2) existing first** — there is no "unconfirmed" state to surface until assignments carry a confirmation status. This is the clearest cross-feature dependency in the milestone: the confirmation data model should land before or alongside this widget, not after. |
| **Draft vs Planned/locked state indicator** | Already a first-class concept in this app (services lock when Planned); competitors uniformly flag "still being worked on" vs "final" | LOW | Already modeled — just needs to be exposed as part of the readiness rollup or its own chip on each service card. |
| **Empty/first-run state** | 2026 SaaS dashboard practice flags this as a commonly-skipped requirement; a new org or a quiet week with zero upcoming services is a real state | LOW | E.g., "No upcoming services — build one" CTA instead of a blank widget. |

#### Differentiators (valuable, not required for launch — worth scoping if budget allows)

| Widget | Value Proposition | Complexity | Notes |
|--------|--------------------|------------|-------|
| **"Needs your attention" unified feed** (PC Home's core pattern) | Single feed merging readiness gaps + unconfirmed volunteers + editor-presence conflicts into one prioritized list, rather than separate cards a planner has to cross-reference | MEDIUM | This is the more ambitious version of the two table-stakes widgets above, combined into one PC-Home-style action feed instead of two static cards. Reasonable to defer to a later milestone if the two-widget version ships first. |
| **Song rotation / "hasn't been played in N weeks" nudge** | This app already tracks `lastUsedAt` per song (from the v2.3 scheduling-accuracy work) — surfacing rotation staleness on the dashboard is a natural extension unique to this app's Vertical Worship methodology, not something a generic scheduler would have | LOW–MEDIUM | Pure differentiator: no competitor researched does anything like this because none of them model a song-rotation methodology the way this app does. |
| **Quick-jump to "Run the Service"** for the next service that's Planned and imminent | Reduces clicks on the highest-frequency action (a projectionist opening Run mode) | LOW | Cheap, high-leverage; matches SaaS practice of surfacing the single next action prominently. |
| **Editor presence roll-up** ("2 people currently viewing Sunday's service") | New in this milestone (editor presence indicator); surfacing it on the dashboard, not just inside the service editor, extends its value | LOW (if presence infra is built for the in-editor indicator anyway) | Only worth it if the per-service presence indicator (separate v2.14 feature) is built first — otherwise this is new work with no reuse. |

#### Anti-Features (commonly seen elsewhere or superficially appealing — do not build)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|----------------|------------------|-------------|
| **Generic BI/analytics widgets** (attendance trends, engagement charts, usage graphs, "MRR"-style line charts) | This is exactly what generic SaaS dashboard templates default to, and what the old "Volunteer coverage" metric was reaching for | This app is a planning tool for a small team preparing a weekly service, not a metrics product; a chart with no clear decision behind it is exactly the "coverage" mistake the owner is trying to escape | Replace every "chart" impulse with a "what does someone need to *do* right now" item |
| **Volunteer coverage %/scorecard** (the exact thing being removed) | Superficially looks like a useful summary stat | Never had a defined denominator (coverage of *what* — roles? services? has proven confusing); a percentage hides *which* service/role is the actual problem | The readiness signal per-service (above) replaces it with something actionable and localized to a specific service |
| **Customizable/drag-and-drop dashboard widgets** | Common SaaS "let users configure their own view" pattern | High implementation cost for a small worship-planning team of a handful of roles; nobody researched among direct competitors offers this, and it multiplies UI-state/testing surface for a feature with a very small user base per org | Ship a well-chosen fixed set (the table-stakes list above); revisit only if real usage data shows a role-based need (e.g., admin vs. projectionist wanting different views) |
| **Cross-org / platform-wide dashboard aggregation** | Tempting to build once and reuse for both the owner console and per-org dashboards | Confuses two different audiences (super-admin platform health vs. a single church's weekly planning); the owner console already exists as a separate surface for platform-level concerns | Keep the per-org dashboard scoped strictly to that org's own upcoming services/readiness/volunteers |

---

## 2. Worship-Team Responsibility Confirmation

### Standard state model (confirmed across Planning Center Services, Connecteam, InitLive, Better Impact)

Every volunteer-scheduling tool researched converges on the same small state machine, distinct from
simple assignment:

```
Assigned (default on scheduling)
   │
   ├──> Confirmed / Accepted   (volunteer explicitly acknowledges)
   │
   └──> Declined                (volunteer explicitly opts out, often with a reason)

Unconfirmed = Assigned but neither Confirmed nor Declined yet (the "needs attention" bucket)
```

Key behaviors observed consistently:

- **Confirmation is a distinct step from assignment**, not implied by being scheduled. Better Impact's
  docs are explicit: "Confirmation, when enabled, is an additional step where volunteers acknowledge
  that they are scheduled, distinct from simply signing up or being assigned to a shift."
  *(Confidence: MEDIUM.)*
- **Two-action UI**: the volunteer sees an Accept and a Decline (or "More… > Decline") action per
  assignment. Planning Center specifically routes Accept as a single tap that auto-notifies the
  scheduler, while Decline requires navigating to add a reason — an intentional friction difference
  that keeps the common case (accepting) fast. *(Confidence: MEDIUM — help.planningcenter.com,
  cross-checked against Connecteam's near-identical accept/reject pattern.)*
- **Planner-visible status uses simple, scannable indicators** — color-coded dots (green = confirmed,
  red = declined, often gray/amber = unconfirmed) on the schedule/roster view, not a separate report the
  planner has to go dig for. *(Confidence: MEDIUM — Connecteam.)*
- **Admin override exists**: a planner/admin can manually set or change a volunteer's confirmation
  state on their behalf (e.g., a phone-call confirmation gets recorded by the admin). *(Confidence:
  MEDIUM — Better Impact.)*
- **Reminders escalate toward the unconfirmed, not everyone**: multiple tools (Breeze: up to 3
  reminders over 21 days; ChurchCMS: immediate + day-before) send reminder notifications specifically
  targeting still-unconfirmed assignments, and stop once the person responds. *(Confidence: MEDIUM.)*
- **Filterable by state**: schedulers can filter/view "who has confirmed all", "who has declined any",
  "who has pending", "who has no confirmation request sent yet" as first-class list filters, not just a
  per-person label. *(Confidence: MEDIUM — Better Impact.)*
- **Blockout-date interaction (Planning Center specific)**: setting a blockout date that overlaps an
  already-accepted assignment **automatically flips it to declined** with a conflict warning, rather
  than leaving a stale "confirmed" status that's actually wrong. This is a good, small correctness rule
  worth carrying into the design if this app ever adds volunteer-side unavailability — flag as a future
  edge case, not necessarily v2.14 scope. *(Confidence: MEDIUM — help.planningcenter.com.)*
- **Replacement/self-swap on decline** is common in mature tools (PC's volunteer-replacement, auto-
  reschedule of declined requests) but is a **noticeably heavier feature** than what this milestone
  scoped — the owner's ask is "I've got it" acknowledgment + planner visibility, not open-shift
  self-swap. Treat replacement/swap as an anti-feature for v2.14 (see below).

### Recommended state model for this app

Given the owner's framing ("volunteer taps 'I've got it' per assignment... planners see who has
confirmed"), the simplest model that matches both the owner's ask and standard practice is a
**two-state-plus-default** model, deliberately smaller than Planning Center's full accept/decline/
blockout/replacement system:

| State | Meaning | Set by |
|-------|---------|--------|
| **Unconfirmed** (default) | Assigned to a roster role on a service, has not yet acted | System, on assignment |
| **Confirmed** | Volunteer tapped "I've got it" | Volunteer (via My Schedule / volunteer service view), or planner override |

A **Declined** state is the natural next increment (matches every competitor) but is **not** what the
owner described this milestone — the ask is specifically "confirm I'm responsible," not "let volunteers
decline and trigger a reschedule flow." Recommend scoping v2.14 to **Confirmed/Unconfirmed only**, and
flagging Decline + replacement/reschedule as a clean, well-precedented follow-up rather than folding it
in now (it drags in notification-to-scheduler, reopening a slot, and a swap UI — real scope, not a small
add).

### Table Stakes / Differentiators / Anti-Features for confirmation

| Category | Feature | Notes |
|----------|---------|-------|
| Table stakes | Per-assignment "I've got it" action in the volunteer surface (My Schedule / volunteer service view) | Reuses the v2.12/2.13 volunteer surface per owner's key-context note — no new auth/access surface needed |
| Table stakes | Planner-visible confirmed/unconfirmed status on the roster, per assignment | Simple chip/dot per the Connecteam pattern; feeds the dashboard's "unconfirmed volunteers" widget |
| Table stakes | Confirmation persists per-service, per-assignment (not per-volunteer globally) | A volunteer confirms *this Sunday's* bass slot, not "confirmed forever" |
| Differentiator | Reminder nudges targeting only unconfirmed assignments as the service date approaches | Reuses the existing v1.7 volunteer-messaging send infrastructure (queue-then-trigger, Resend) — this is mostly a targeting/query change on top of infra that already exists, not new send infrastructure |
| Anti-feature | Decline + auto-reopen-slot + replacement self-swap | Real, well-precedented feature (PC does it) but explicitly heavier than the owner's ask; scope creep risk for this milestone — defer to backlog |
| Anti-feature | Blockout-date management (volunteer-side "I'm unavailable these dates") | Same reasoning — a distinct, larger feature (recurring unavailability, conflict detection against future services) that the owner has not asked for |
| Anti-feature | Confirmation deadlines/auto-decline timers | Some tools auto-decline if no response by X — adds a cron/scheduled-state-transition surface for a behavior the owner didn't request; simple "still shows as unconfirmed until acted on" is sufficient |

### Dependencies

- **Confirmation state model must exist before "unconfirmed volunteers" can appear on the dashboard**
  (Section 1) — there's no unconfirmed bucket without it. This is the single clearest ordering
  constraint across the whole milestone: sequence the confirmation data model (schema + volunteer-side
  action) at or before the dashboard widget that reads it.
- **Reuses the v2.12/2.13 volunteer surface** (My Schedule / volunteer service view) and RBAC/roster
  data already in place — no new authentication surface.
- **Can reuse v1.7 volunteer-messaging infra** for reminder nudges if that differentiator is scoped in.

---

## 3. Live-Stream "Video" Output — Banner / Full-Screen Conventions

### How churches actually composite slide text over live video today

The dominant real-world pattern (ProPresenter + a hardware switcher, which is the same shape as this
app's Blackbird-based setup per PROJECT.md context) is:

1. **The presentation software outputs the graphic with an alpha channel** — in ProPresenter's case, as
   a transparent NDI feed (Preferences → Network → "Send NDI Output"), separate from its normal
   projector/confidence outputs. *(Confidence: MEDIUM — cross-checked across Renewed Vision's own blog,
   WorshipMetrics KB, and independent Technically Church tutorials.)*
2. **A hardware/software video switcher keys that alpha feed over the live camera feed.** Two
   compositing techniques are used in practice:
   - **Alpha/luma key** (fill+key signal pair, or a pre-multiplied-alpha single feed) — the
     professional-grade method, described consistently as cleaner and preferred for graphics because it
     has no color-spill/edge artifacts.
   - **Chroma key** (graphic rendered against a solid color, e.g. green, then keyed out) — simpler,
     needs only one output signal, but the community-reported quality is "not as crisp" as alpha keying.
   *(Confidence: MEDIUM — Blackmagic's own forum + multiple independent AV-integrator write-ups agree
   on this tradeoff.)*
3. **The switcher (ATEM-class hardware in the churches researched) does the actual compositing** — the
   presentation software's job ends at producing a correctly-shaped, correctly-transparent (or
   correctly-chroma-colored) picture; it does not itself see or composite the camera feed.

This directly validates the owner's 2026-09-07 scope decision: **build the app-side transparent-banner
render this milestone; treat the Blackbird keying/compositing step as an external integration verified
separately.** The research confirms that split is exactly how the ecosystem divides the work in
practice — presentation software and switcher are always two separate systems with a well-defined
transparent-alpha (or chroma) handoff between them, never one program doing both.

### Banner region conventions (from broadcast lower-third practice + church-specific lyric/scripture practice)

- **Placement and sizing**: lower-thirds sit in the **title-safe area**, conventionally the **bottom
  10–15% of the frame**, inset roughly **10% from all edges** so text survives overscan on broadcast
  displays and cropping on various streaming/social platforms. Bottom-left is the traditional default
  position (keeps clear of a typically center/right-of-center subject), though a full-width bottom
  banner (spanning the frame) is also common for lyrics/scripture specifically, as opposed to the
  name-and-title style lower-third used for speaker IDs. *(Confidence: MEDIUM — consistent across
  Adobe, Restream, and multiple broadcast-design references.)*
- **Typography**: sans-serif, high-contrast (white text with a drop shadow, or a semi-transparent bar
  behind the text) is close to universal; church-specific sources converge on **~45–50pt at 1080p** for
  lyric/scripture lower-thirds (larger than a typical name/title lower third, since it's read at a
  distance on a stream rather than up close). **Max ~2 lines per slide** — more than that reads as
  cluttered on a lower-third-sized region. *(Confidence: MEDIUM — Switcherstudio, StreamYard, Church
  Motion Graphics converge independently on this.)*
- **Animation**: subtle, short (1–2 second) fade or slide-in transitions only; anything flashier is
  explicitly called out as distracting from the live content the banner sits over.
- **Two dominant visual styles** for church lyric lower-thirds specifically: (a) plain text with no
  border/background at all, relying purely on drop-shadow contrast, or (b) a simple rectangular bar/
  parallel-bar graphic behind the text. Both are common; there is no single "correct" answer, but the
  research is clear that **some contrast treatment is expected** — plain text directly over unpredictable
  live video content (skin tones, bright stage lighting) without a shadow or backing bar is called out
  as a readability risk.

### Full-screen mode conventions

Full-screen slide-over-video is the simpler of the two modes conceptually (it matches the existing
Audience-output full-screen behavior this app already has), but two things are worth carrying into
requirements from the broadcast research even though they weren't explicit findings:
- Full-screen slide content for a stream should still respect **stream-safe margins** (many streaming
  platforms crop/reflow for different aspect ratios/players) — the same title-safe-area logic applies
  even when the slide fills the whole frame, not just in banner mode.
- Full-screen mode fully occludes the live camera (no transparency needed) — this is the simpler render
  path and should not need the alpha-transparency work that Banner mode requires.

### Table Stakes / Differentiators / Anti-Features for the Video output

| Category | Feature | Notes |
|----------|---------|-------|
| Table stakes | Third output role "Video," selectable per-monitor alongside existing Audience/Confidence | Reuses the v2.9 multi-monitor role-assignment infrastructure (any role to any monitor) |
| Table stakes | Per-item choice: Banner vs Full-screen (Full-screen only when not Video output? — per owner's scope, Banner is valid **only** when output = Video) | Matches the ProPresenter-observed pattern of a distinct output mode for stream compositing |
| Table stakes | Banner mode renders slide text fit to a bottom title-safe region, rest of frame **alpha-transparent** | This is the actual new rendering work — everything else (text auto-fit, typography) can likely reuse the existing slide-render pipeline; the transparency requirement is the delta |
| Table stakes | Banner region respects title-safe inset (~10% edges, bottom ~10-15% band) and 1-2 line-appropriate text sizing | Grounded directly in the broadcast convention research above — don't invent a different proportion without reason |
| Differentiator | A visible contrast treatment (drop shadow or semi-transparent backing bar) behind banner text, matching the "some contrast treatment expected" finding | Cheap to add, meaningfully improves real-world legibility over unpredictable live camera backgrounds; should be considered close to table-stakes given how consistently the research flags plain-text-with-no-background as a readability risk |
| Anti-feature | The app performing chroma-key/hardware compositing itself | Explicitly out of scope per owner's 2026-09-07 decision, and confirmed by research as **never** the presentation software's job in any real-world setup researched — that's always the switcher's (Blackbird's) job |
| Anti-feature | Building a dedicated "stream preview" compositing simulator (showing banner-over-fake-video in-app) | Tempting for QA but real verification only means something against the actual Blackbird path; a fake composite preview risks giving false confidence about a rendering pipeline (browser page transparency capture) that still needs verification against real hardware |
| Anti-feature | Multiple simultaneous banner regions / multi-line-item banners | No convention found for stacking more than one lower-third-style element at once in the church-livestream sources researched; keep to one banner slide at a time, matching the single order-of-service-item-at-a-time model the rest of the app already uses |

### Dependencies

- **Depends on the existing multi-monitor output-role infrastructure (v2.4/v2.9)** — "Video" is a third
  value in an existing enum/assignment system, not a new subsystem.
- **Depends on the existing slide-render pipeline** for text/typography — Banner mode is a new *region
  and background-transparency* variant of that pipeline, not a rewrite.
- **Does NOT depend on** and is explicitly decoupled from the Blackbird hardware path — the research
  confirms real-world church AV setups always have this exact two-system split, which is why the
  owner's scope cut (app-side only, hardware verified separately) is sound rather than a corner cut.
- **Open technical question flagged for phase-level research, not this pass**: whether a browser
  window/canvas can actually render and be captured with a true alpha channel (vs. an opaque background
  that merely *looks* transparent) for downstream NDI/capture-card ingestion — this is a browser/
  capture-pipeline feasibility question, not a domain-convention question, and belongs in phase-level
  technical research rather than this ecosystem pass.

---

## Feature Dependencies (cross-cutting, all three areas)

```
[Volunteer Confirmation state model]
    └──requires──> [existing My Schedule / volunteer service view] (v2.12/2.13, already built)

[Dashboard: "Unconfirmed volunteers" widget]
    └──requires──> [Volunteer Confirmation state model]   ← must land first or alongside

[Dashboard: "Readiness signal" widget]
    └──requires──> [existing song/media/roles/slides/lock-state data]  (already built, v2.11 + earlier)

[Video output: Banner mode]
    └──requires──> [existing multi-monitor output-role infra] (v2.4/v2.9)
    └──requires──> [existing slide-render pipeline]
    └──requires──> [new: alpha-transparent background render] ← the actual new work

[Video output: Banner mode] ──conflicts-with-scope-of──> [Blackbird hardware keying]
    (explicitly decoupled by owner decision — Blackbird is external/out of scope this milestone)

[Dashboard: reminder-nudge differentiator] ──enhances──> [Volunteer Confirmation]
    └──reuses──> [existing v1.7 volunteer-messaging send infrastructure]
```

### Dependency Notes

- **"Unconfirmed volunteers" dashboard widget requires the Confirmation state model**: there is no
  "unconfirmed" bucket to display without the new Confirmed/Unconfirmed field existing on assignments.
  Sequence this explicitly in the roadmap — it is the one hard ordering constraint research surfaced.
- **The readiness signal widget requires no new data model** — every input (songs, media attachments,
  role fills, slide counts, Draft/Planned lock state) already exists in the app; this widget is a
  read-only rollup/query, which is why its complexity is rated MEDIUM rather than HIGH — the work is in
  defining and testing the rollup rule, not building new data plumbing.
- **Video-output Banner mode conflicts in scope, not in design, with Blackbird compositing** — they are
  not incompatible, they are simply two different systems with a clean handoff (this app renders
  transparent, Blackbird composites), and the owner has correctly scoped only the first half this
  milestone.

## MVP Definition

### Launch With (v2.14)

- [ ] **Upcoming services list** on dashboard — table stakes, near-zero new data modeling
- [ ] **Readiness signal per service** (songs/media, roles filled, slides built, Draft vs Planned) —
      owner-confirmed, all source data already exists
- [ ] **Confirmed/Unconfirmed state on volunteer assignments** + "I've got it" action in the volunteer
      surface — the owner's core ask; keep to two states, not the fuller accept/decline/replace model
- [ ] **Planner-visible confirmation status on the roster** — pairs with the above; no confirmation
      feature is complete without the planner seeing it
- [ ] **Unconfirmed volunteers dashboard widget** — sequence after/with the confirmation state model
- [ ] **Video output role (3rd output type)** with per-item Banner/Full-screen choice and
      alpha-transparent banner render — app-side only, per owner's explicit scope cut

### Add After Validation (v2.14.x or immediately-next milestone)

- [ ] **Reminder nudges targeting unconfirmed assignments** — trigger: once basic confirmation ships
      and there's real data on how many assignments go unconfirmed until the last minute
- [ ] **Contrast treatment (shadow/backing bar) on Banner text** — trigger: real hardware/stream test
      reveals plain text isn't legible over actual stage lighting/camera footage (research suggests this
      is likely, but it needs the real integration test the owner already flagged as separate)
- [ ] **"Needs your attention" unified dashboard feed** replacing the two separate widgets — trigger:
      once both readiness and unconfirmed-volunteers widgets exist and real usage shows planners want one
      merged list instead of two cards

### Future Consideration (backlog)

- [ ] **Decline + auto-reopen-slot + replacement self-swap** — defer; real scope on its own, not
      requested this milestone
- [ ] **Volunteer blockout-date management** — defer; a distinct larger feature
- [ ] **Confirmation deadline/auto-decline timers** — defer; adds scheduled-transition complexity for a
      behavior not requested
- [ ] **Customizable/drag-and-drop dashboard** — defer; no competitor at this app's scale offers it and
      it multiplies test surface for a very small per-org user base
- [ ] **Blackbird hardware compositing verification** — explicitly the owner's next research target,
      tracked separately from this app-side milestone

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Upcoming services list | HIGH | LOW | P1 |
| Readiness signal per service | HIGH | MEDIUM | P1 |
| Confirmed/Unconfirmed state + "I've got it" action | HIGH | MEDIUM | P1 |
| Planner-visible confirmation status | HIGH | LOW | P1 |
| Unconfirmed volunteers dashboard widget | HIGH | MEDIUM (depends on above) | P1 |
| Video output role + Banner/Full-screen choice + transparent render | HIGH (owner-prioritized) | MEDIUM–HIGH | P1 |
| Reminder nudges for unconfirmed | MEDIUM | LOW (reuses existing send infra) | P2 |
| Banner contrast treatment (shadow/bar) | MEDIUM | LOW | P2 |
| Unified "needs attention" feed | MEDIUM | MEDIUM | P3 |
| Song rotation staleness nudge on dashboard | LOW–MEDIUM (differentiator, low ask urgency) | LOW | P3 |
| Decline/replacement/blockout | LOW (not requested) | HIGH | P3 / backlog |

**Priority key:**
- P1: Must have for v2.14 launch
- P2: Should have, add when possible (this milestone or immediately after)
- P3: Nice to have, future consideration / backlog

## Competitor Feature Analysis

| Feature | Planning Center | Church-scheduling peers (Breeze/Pushpay/WorshipTools) | Our Approach |
|---------|------------------|--------------------------------------------------------|--------------|
| Dashboard focus | Task/"needs attention" feed, not metrics | Upcoming events + volunteer status + gap alerts | Match the "needs attention" framing: upcoming services + readiness + unconfirmed volunteers, explicitly not a metrics wall |
| Volunteer response | Full accept/decline/blockout/replacement/auto-reschedule | Accept/decline + automated reminder cadence | Scope down to Confirmed/Unconfirmed only for v2.14; defer decline/replacement to backlog as a clean follow-on |
| Live-stream slide compositing | N/A (not ProPresenter's category) | N/A | Follow the ProPresenter/ATEM-observed pattern: app renders alpha-transparent banner, switcher (Blackbird) composites — matches owner's scope cut exactly |

## Sources

- [Planning Center Home: A personal ministry dashboard](https://www.planningcenter.com/home)
- [Planning Center Services: Worship Planning Software](https://www.planningcenter.com/services)
- [Introduction for team members — Planning Center Help](https://help.planningcenter.com/en/138437-introduction-for-team-members.html)
- [View your scheduled plans — Planning Center Help](https://help.planningcenter.com/en/140937-view-your-scheduled-plans.html)
- [Manage your schedule — Planning Center Help](https://help.planningcenter.com/en/142874-manage-your-schedule.html)
- [Respond to scheduling emails — Planning Center Help](https://help.planningcenter.com/en/142893-respond-to-scheduling-emails.html)
- [Manage blockout dates — Planning Center Help](https://help.planningcenter.com/en/142872-manage-blockout-dates.html)
- [Auto-reschedule declined volunteer requests in Services — Planning Center Blog](https://www.planningcenter.com/blog/2024/09/auto-reschedule-declined-volunteer-requests-in-services)
- [Church Volunteer Management Software & Scheduling App — Pushpay](https://pushpay.com/solutions/church-scheduling-software)
- [Church Management Software — Breeze](https://www.breezechms.com/)
- [Volunteer Management Reminders — Breeze Help Center](https://support.breezechms.com/hc/en-us/articles/360034343693-Volunteer-Management-Reminders)
- [Planning by WorshipTools](https://www.worshiptools.com/en-us/planning)
- [6 steps to design thoughtful dashboards for B2B SaaS products — UX Collective](https://uxdesign.cc/design-thoughtful-dashboards-for-b2b-saas-ff484385960d)
- [SaaS Dashboard Design: Examples, Patterns & Practical Tips — Eleken](https://www.eleken.co/blog-posts/saas-dashboard-design)
- [SaaS Dashboard Design Best Practices: 2026 UX Frameworks — FlowmazeUX](https://flowmazeux.com/saas-dashboard-design-best-practices/)
- [Reject and Confirm Shifts — Connecteam Help Center](https://help.connecteam.com/en/articles/10511320-reject-and-confirm-shifts)
- [Shift Confirmation — InitLive Knowledge Base](https://knowledge.initlive.com/en/schedule-request-notification-settings)
- [Comprehensive Guide to Scheduling — Better Impact Help Center](https://support.betterimpact.com/en/articles/13192494-comprehensive-guide-to-scheduling)
- [What Is a Lower Third? — Restream Learn](https://restream.io/learn/what-is/lower-third/)
- [Lower third graphics — Adobe](https://www.adobe.com/creativecloud/video/discover/lower-third-graphics.html)
- [Yes, Title Safe Still Matters – Especially for Online Video](https://eks.tv/title-safe-still-matters/)
- [4 Ways To Use ProPresenter While Live Streaming — Renewed Vision Blog](https://www.renewedvision.com/blog/4-creative-ways-to-use-propresenter-when-live-streaming)
- [How To Use ProPresenter in OBS + Lower Thirds — Renewed Vision Blog](https://renewedvision.com/blog/how-to-use-propresenter-in-obs-lower-thirds)
- [ProPresenter NDI Output: Sending Graphics to OBS or vMix — WorshipMetrics KB](https://worshipmetrics.com/kb/software/propresenter/propresenter-ndi-output-obs-vmix/)
- [Complete Guide for Setting Up Lower Thirds in ProPresenter 7 with Blackmagic ATEM Switchers Using Alpha Key — Technically Church](https://technicallychurch.com/2025/07/complete-guide-for-setting-up-lower-thirds-in-propresenter-7-with-blackmagic-atem-switchers-using-alpha-key/)
- [Creating Lower Thirds in ProPresenter 7 Using Chroma Key with a Blackmagic ATEM Switcher — Technically Church](https://technicallychurch.com/2025/07/creating-lower-thirds-in-propresenter-7-using-chroma-key-with-a-blackmagic-atem-switcher/)
- [Blackmagic Forum — Keying alpha channel in ATEM Production Switcher 4K](https://forum.blackmagicdesign.com/viewtopic.php?t=52757)
- [How to Show Worship Lyrics in Your Church's Live Streams — Switcher Studio](https://www.switcherstudio.com/blog/how-to-show-worship-lyrics-in-your-churchs-livestreams)
- [How to Show Worship Lyrics in your Church Live Streams — StreamYard](https://streamyard.com/blog/how-to-show-worship-lyrics-in-your-church-live-streams)
- [A Guide to Lower Thirds: Enhancing the Worship Experience — Church Motion Graphics](https://www.churchmotiongraphics.com/blog/a-guide-to-lower-thirds-enhancing-the-worship-experience-with-seamless-on-screen-text/)

---
*Feature research for: Church worship-service planning SaaS — v2.14 (dashboard, volunteer confirmation, live-stream Video output)*
*Researched: 2026-09-07*
