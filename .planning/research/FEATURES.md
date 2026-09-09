# Feature Research

**Domain:** Worship service planning / church presentation software — v2.15 additions (Vamps library, rehearsal & report times, service-update email links, deep-link fix)
**Researched:** 2026-09-09
**Confidence:** MEDIUM (cross-checked pad/vamp conventions across independent sources; Planning Center rehearsal/call-time model corroborated across multiple PC-ecosystem sources but no single authoritative doc page was fetchable — see Sources); deep-link fix is a defect, not researched as a feature.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist once a "Vamps" library and "rehearsal times" are announced as capabilities. Missing these = the feature feels half-built.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Vamp = key + audio file, browsable/searchable list | Every real-world pad product (PraiseCharts Pad Tracks, MultiTracks Playback, ProPresenter's own audio Library) treats a pad as "one file per key," organized in a flat browsable list/library — never a folder-per-song structure. This milestone's "one key, one mp3, modeled 1:1 like a Song" decision matches the domain norm exactly. | LOW | Reuse the Song list pattern (table/cards) + v2.11 file-upload pipeline. No new storage surface needed. |
| Assign a vamp to a slide, it plays automatically when that slide is shown | ProPresenter's actual trigger model (confirmed via Worship Tutorials walkthrough) is exactly this: drop audio on a slide, it auto-plays on advance-to-slide and keeps playing across further slide advances until explicitly cleared or replaced. This is the mental model every projectionist/ops volunteer coming from ProPresenter/EasyWorship/Proclaim already has. | LOW (already have the mechanism) | **This app already ships the identical mechanism** — per-slide `audioUrl`/`audioLoop`/`AudioPlayer` (v2.9/v2.11). Vamp assignment is "set this slide's existing audio field to a Vamp's file" — no new render/playback surface, per the owner's explicit decision. |
| Loop until slide changes / manually cleared | A vamp exists to fill indefinite time (prayer, altar call, transition) — nobody knows in advance how long it plays, so it must loop, not play-once-and-stop. | LOW | Already covered by the existing `audioLoop` flag on the per-slide audio mechanism — no new capability, just point it at a vamp file. |
| Key label visible at a glance in the list | Since the vamp's entire reason for existing is "the right key for this transition," the key must be sortable/filterable/visible without opening the record — mirrors how a Song's Key is already a first-class column. | LOW | Reuse the Song list's Key column/type-ahead pattern (shipped v2.3, R257–R258). |
| Rehearsal = its own dated (and timed) event, distinct from the service date | Confirmed for Planning Center Services (the dominant tool this app "complements"): rehearsal/call times are added as separate "Times" on a plan with their own name, start time, end time, and **date**, which can differ from the service date. Users coming from PC will expect the same — a rehearsal on Thursday and a service on Sunday are two different date+time entries, not one field. | LOW–MEDIUM | Matches the milestone's own model choice ("multiple dated rehearsals … each its own date + time"). |
| A single day-of "report/call time" separate from the service start time | Universal AV/band convention: the report time is *before* the service start (arrive early to set up, warm up, do a sound check) — it is never assumed equal to the service start time and must be entered/shown independently. | LOW | Matches the milestone's model choice exactly (one day-of report time per service). |
| Org-level defaults that pre-fill new services | PC's "Create in future plans" pattern (propagate a time template to future plan instances of a service type) is the direct analog — orgs don't want to re-type "Thursday 7pm rehearsal, Sunday 8am report" every single week. | LOW–MEDIUM | Matches the milestone's org-settings-defaults decision; reuse `OrgSettings`/`DEFAULT_ORG_SETTINGS` pattern already in `src/stores/auth.ts`. |
| Rehearsal/report times shown everywhere the service date already shows | If a volunteer sees "Sun Sept 14" on My Schedule/dashboard but has to open the service to discover there's also a Thursday rehearsal, the feature is invisible and gets missed — this is the single most common volunteer complaint about scheduling tools ("I didn't know rehearsal was a thing"). | MEDIUM | Explicitly scoped in the milestone: dashboard, My Schedule, volunteer service view, share/plan views, `ServiceSnapshot`/`rehearseAccess` projections. |
| Every service-update/reminder email includes a working link to the live plan | Table stakes for any collaborative-planning email in 2026 — a plain-text "your service changed" email with no link forces a volunteer to hunt for the plan themselves. The milestone's own framing (wire the existing `{{service_link}}` token into every update/reminder send) is the correct, minimal version of this. | LOW (already exists, just needs wiring/verification) | Reuse `resolveServiceLink`/`ensureShareLink`/`{{service_link}}` token (`functions/src/messageTokens.ts`) — this is a wiring + regression-test task, not new infrastructure. |
| Deep link / new-tab opens the intended page for a multi-church user | Baseline expectation of any multi-tenant SPA: a bookmarked or shared link should never bounce a legitimate, already-authenticated user to a chooser screen they didn't ask for. | LOW–MEDIUM | Root cause is `sessionStorage`-only org persistence (`SELECTED_ORG_STORAGE_KEY`); fix belongs in `src/router/index.ts` org-selection guard + storage layer, not a new UX pattern. |

### Differentiators (Competitive Advantage)

Features that go beyond bare table stakes and align with this app's core value (smart, low-friction planning that complements Planning Center).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Vamp reuses the exact same per-slide audio pipeline as ordinary slide audio (no separate "vamp player" concept) | Most tools (ProPresenter, EasyWorship) treat pads as a slightly separate audio-cue mechanism from regular media; unifying "vamp" and "slide audio" into one mental model is simpler for a small-church volunteer to learn and reduces the app's own surface area. This is the owner's explicit architectural bet and matches how ProPresenter *actually* implements pads under the hood (they're just audio files dropped on a slide — there's no dedicated "pad" object type even in ProPresenter). | LOW (it's a simplification, not new build) | Confirms the owner's decision is not just cheaper but also matches the real-world implementation pattern of the tool it's modeled after. |
| Per-team-scoped rehearsal visibility (a rehearsal only shown to the roles that need it) | PC supports unassigning positions from a time so only relevant volunteers see it (e.g., band rehearses Thursday, tech doesn't). Not explicitly requested this milestone, but cheap to consider if the rehearsal model supports per-role scoping later. | MEDIUM (adds a scoping dimension) | **Not in current milestone scope** (multiple dated rehearsals + one report time, no role-scoping mentioned) — flag as a natural v2 extension, not required now. |
| Countdown / "next up" framing on rehearsal + report times (matches My Schedule's existing countdown+call-time pattern from v2.12) | v2.12's My Schedule already shows "a countdown + call time" per service card — extending that same countdown treatment to the new rehearsal/report time fields is low-cost and immediately familiar to volunteers who already use My Schedule. | LOW | Direct reuse of an existing UI pattern (`My Schedule` card), not a new concept — recommend for the roadmap. |
| A key-only vamp filter/search across the whole vamp stable (mirrors Song filtering) | Once a church has 24 vamps (12 major keys × 2 styles, matching the PraiseCharts convention), being able to filter "show me vamps in D" during live-service prep saves real time. | LOW | Small UI affordance on top of the Song-list-pattern reuse already planned. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems — flagged because they are exactly what a naive "let's build vamps/pads" or "let's build rehearsal scheduling" spec tends to reach for.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Auto-crossfade between two different vamps when transitioning slides | ProPresenter/Ableton rigs do this (an automatic ~1.5–2s crossfade, or manual pad-A→pad-B fade), and it's the single most-cited "pro" pad behavior in the research. | The milestone explicitly reuses the existing single-`audioUrl`-per-slide mechanism with no new render surface. A true crossfade needs two simultaneously-playing `<audio>` elements with independent gain envelopes — a materially different (and harder) audio architecture than "swap the file the existing player points to." Also, autoplay-policy testing (already flagged as a verification risk in the milestone) gets significantly harder with two concurrent audio sources. | Ship the simple swap-on-slide-change behavior (as scoped). If a hard cut between vamps sounds abrupt in practice, that is a *future* differentiator to evaluate once the flag surface exists — not a v2.15 requirement. |
| Multi-key vamp entries (one vamp record holding files for several keys, like PraiseCharts' "12-keys-in-one-product" packaging) | Feels efficient — "why make 12 separate records for 12 keys of the same pad style?" | Directly conflicts with the owner's explicit model decision ("a vamp is one key per entry… mirroring a Song 1:1"). It also breaks the reuse of the Song 1:1 storage/CRUD pattern (one file per record) that makes this cheap to build. | Create one vamp record per key (as decided); if bulk-creating a full 12-key set becomes tedious, a future "duplicate this vamp in another key" convenience action is the right lever, not a multi-key data model. |
| BPM / tempo metadata on a vamp | ProPresenter songs *do* carry tempo metadata, and BPM shows up as a natural-seeming field to add "since songs have it." | A vamp, by definition and by every real product researched (PraiseCharts pads are one sustained chord, not a tempo-locked loop), has **no tempo** — it's an ambient/sustained bed, not a metered loop that needs beat-matching. Adding a BPM field models a property the artifact doesn't have and invites building tempo-sync features nobody asked for. | Vamp metadata = name + key + the mp3 file only (mirroring the Song 1:1 model, dropping only the lyrics-specific fields). No BPM/tempo/duration fields unless a future use case demands them. |
| Auto-notify volunteers on *every* edit to a plan they're scheduled on | Feels like "more communication is always better," and it's the most obvious reading of "service-update emails." | Planning Center — the dominant tool in this space — deliberately decided **against** this exact behavior to avoid notification fatigue (confirmed via research); a plan gets edited many times as it's built, and re-emailing on each save trains volunteers to ignore the emails. | The milestone's actual scope is narrower and correct: ensure the *existing* update/reminder send flow (which already has its own trigger logic, e.g. explicit "send update" or scheduling actions) always includes the plan link — not adding new auto-send triggers on every mutation. |
| A full calendar/ICS integration for rehearsal times this milestone | "Add it to my calendar" is an easy ask once times exist, and PC's ecosystem has mature calendar sync. | Out of scope for this milestone's stated goal (surfacing times *in the app's own views*: dashboard, My Schedule, volunteer service view, share views). Calendar export/sync is a materially separate integration surface (ICS generation, timezone handling, calendar-provider auth) with its own testing burden. | Ship in-app display first (as scoped); flag calendar export as a backlog candidate once the data model (multiple dated rehearsals + report time) exists to export from. |
| Location/venue field on each rehearsal | Real-world rehearsals often do have a distinct location (a different room, an off-site practice space) and PC-adjacent tooling supports this. | Not mentioned anywhere in the milestone's scoped model ("each its own date + time" — no location field called out), and adding it now expands the per-service data model and every display surface (dashboard/My Schedule/volunteer view/share view) that must be touched. | PROJECT.md already flags "the owner's open decision = venue/call-time card fields" from v2.12 — treat rehearsal location as the same open decision, to be resolved explicitly in requirements rather than assumed. |

## Feature Dependencies

```
Vamp CRUD + mp3 upload (reuses v2.11 useSongFileUpload / song-files/ storage pattern)
    └──requires──> v2.11 file-upload infra (useSongFileUpload, storage.rules editor gate, retention exemption)
                       └──already shipped, no new phase needed for the underlying pipeline

Vamp → slide assignment (plays as slide audio)
    └──requires──> Vamp CRUD (a vamp must exist before it can be assigned)
    └──requires──> existing per-slide audioUrl/audioLoop/AudioPlayer mechanism (v2.9/v2.11, already shipped)
    └──enhances──> live "Run the Service" presentation (v2.4/v2.9 multi-monitor outputs) — vamp audio plays through the same non-interactive Run surface, so it inherits the autoplay-policy risk already flagged

Org rehearsal/report-time DEFAULTS (OrgSettings)
    └──enhances──> per-service rehearsal/report-time model (pre-fills new services)
    └──does NOT require──> per-service model to exist first (defaults can be built/stored independently, but are inert until the per-service fields exist to consume them)

Per-service rehearsal/report-time model (multiple dated rehearsals + one day-of report time)
    └──requires──> extending the Service document schema (currently date-only string, no time fields)
    └──requires──> ServiceSnapshot / rehearseAccess projections updated (or times never reach the public/volunteer views)
                       └──requires──> display surfaces updated: dashboard, My Schedule, volunteer service view, share/plan views

Service-update emails link to the plan
    └──requires──> {{service_link}} merge token (already exists) + resolveServiceLink/ensureShareLink (already exists)
    └──requires──> auto-generated share link (shipped v2.14 — "a service's share link exists/derives automatically")
    └──conflicts with──> adding new auto-send-on-every-edit triggers (anti-feature above; keep to existing send flow)

Deep-link / new-tab church-picker fix
    └──independent──> no dependency on Vamps or rehearsal-time work; can ship in parallel/any order
    └──requires──> touching src/stores/auth.ts (SELECTED_ORG_STORAGE_KEY) and the router org-selection guard (src/router/index.ts:270-352)
```

### Dependency Notes

- **Vamp→slide assignment requires Vamp CRUD, which requires the v2.11 file-upload pipeline:** all three are cheap because two of the three legs are already-shipped infrastructure. The only genuinely new work is the Vamp entity itself (a thinner Song) and the assignment UI affordance on a slide's existing audio field.
- **Per-service rehearsal/report-time model requires updating every downstream projection that currently carries only `date`:** this is the highest-complexity item in the milestone precisely because "everywhere the date already shows" touches four+ distinct surfaces (dashboard, My Schedule, volunteer view, share/plan views) plus two public projections (`ServiceSnapshot`, `rehearseAccess`). Org defaults should land first or alongside the per-service model (not strictly required first, but sequencing them together avoids building the per-service UI twice — once without defaults, once with).
- **Service-update-email link-wiring conflicts with "notify on every edit":** the anti-feature table above flags this explicitly — the milestone's actual ask is to guarantee an existing send always carries the link, not to add new send triggers. Treat "add a new notify-on-save trigger" as an explicit non-goal unless the owner asks for it separately.
- **Deep-link fix is fully independent** of the other three feature areas and has no ordering constraint — safe to sequence first (quick, isolated, unblocks nothing but is a pure regression fix) or last.

## MVP Definition

### Launch With (v1 — this milestone, per PROJECT.md scope)

- [ ] **Vamps page/nav entry** with CRUD (name + key + mp3), modeled 1:1 on Song — essential because it's the only way a vamp can exist to be assigned.
- [ ] **Vamp→slide assignment reusing existing per-slide audio mechanism** — essential; this *is* the feature ("plays live as that slide's audio"), and the milestone explicitly forbids building a new render surface.
- [ ] **Autoplay-policy verification in non-interactive Run outputs** — essential; a vamp that silently fails to play live (browser autoplay block) is worse than no feature at all, since it's discovered mid-service.
- [ ] **Org-level rehearsal/report-time defaults** — essential per the milestone's explicit scope (a) and needed to avoid re-entry fatigue.
- [ ] **Per-service multiple dated rehearsals + one report time** — essential per scope (b); this is the actual data-model change everything else displays.
- [ ] **Display of times on dashboard, My Schedule, volunteer service view, share/plan views, `ServiceSnapshot`/`rehearseAccess`** — essential per scope (c); a time field nobody can see anywhere is not shipped.
- [ ] **Service-update/reminder emails always include `{{service_link}}`** — essential per scope; low cost since the token and resolver already exist.
- [ ] **Deep-link/new-tab org persistence fix** — essential defect fix; independent of the rest.

### Add After Validation (v1.x)

- [ ] **Duplicate-vamp-into-another-key convenience action** — trigger: once churches start manually creating a full 12-key set and the repetition becomes a real complaint.
- [ ] **Per-role/per-team rehearsal visibility scoping** (à la PC's per-team time dropdown) — trigger: a church requests "the tech team shouldn't see the band's Thursday rehearsal" or vice versa.
- [ ] **Countdown treatment on rehearsal/report times in My Schedule** — trigger: natural follow-on once the base time fields ship and reuse the existing countdown UI pattern cheaply.
- [ ] **Key-filter on the Vamps list** — trigger: once a church's vamp stable grows past ~10-15 entries and browsing by key becomes valuable.

### Future Consideration (v2+)

- [ ] **Crossfade between two vamps on slide transition** — defer until the simple swap-on-slide-change behavior is validated in a real service and proven insufficient; requires a materially harder dual-audio-source architecture.
- [ ] **Rehearsal location/venue field** — defer to the same open decision already flagged from v2.12 ("venue/call-time card fields"); resolve explicitly in requirements rather than silently expanding scope now.
- [ ] **Calendar (ICS) export/sync for rehearsal times** — defer until the in-app time model and display surfaces are proven; a separate integration surface with its own timezone/testing burden.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Vamp CRUD (Song-1:1 model) | HIGH | LOW | P1 |
| Vamp→slide assignment (reuse audio pipeline) | HIGH | LOW | P1 |
| Autoplay-policy verification in Run outputs | HIGH | LOW–MEDIUM | P1 |
| Org rehearsal/report-time defaults | MEDIUM | LOW–MEDIUM | P1 |
| Per-service multiple dated rehearsals + report time | HIGH | MEDIUM–HIGH | P1 |
| Display times across dashboard/My Schedule/volunteer/share views | HIGH | MEDIUM–HIGH | P1 |
| Service-update email link wiring | HIGH | LOW | P1 |
| Deep-link/new-tab church-picker fix | MEDIUM (affects only multi-church users) | LOW–MEDIUM | P1 |
| Vamp key filter/search | LOW–MEDIUM | LOW | P2 |
| Countdown on rehearsal/report times | MEDIUM | LOW | P2 |
| Duplicate-vamp-in-another-key action | LOW–MEDIUM | LOW | P3 |
| Per-team rehearsal visibility scoping | LOW–MEDIUM | MEDIUM | P3 |
| Crossfade between vamps | LOW (unvalidated need) | HIGH | P3 |
| Rehearsal location/venue field | MEDIUM (open decision) | LOW–MEDIUM | P2/P3 (pending owner decision) |
| Calendar/ICS export | LOW (unvalidated need) | HIGH | P3 |

**Priority key:**
- P1: Must have for this milestone launch (matches PROJECT.md's stated v2.15 scope)
- P2: Should have, natural near-term follow-on
- P3: Nice to have, future consideration / needs explicit owner decision first

## Competitor Feature Analysis

| Feature | ProPresenter (+ MultiTracks Playback) | Planning Center Services | Our Approach |
|---------|----------------------------------------|---------------------------|--------------|
| Pad/vamp triggering | Drop an audio file on a slide; auto-plays on slide-advance, persists until cleared/replaced, ~1.5–2s auto-crossfade between audio transitions | N/A (not a presentation tool) | Same trigger model (assign vamp to slide's existing `audioUrl`), but **no crossfade** this milestone — a hard swap, by explicit owner decision |
| Pad library organization | General media Library (sortable by Title/Category/Last Used); no confirmed dedicated "pad-by-key" browser | N/A | A dedicated **Vamps** page, one-key-per-entry, modeled like Songs — arguably clearer than ProPresenter's generic library for this specific use case |
| Pad metadata | Key + Tempo/BPM on **songs**; pads themselves are just audio files (no confirmed dedicated pad metadata schema) | N/A | Vamp = name + key + mp3 only — deliberately **no BPM** field (see anti-features) since a vamp is a sustained bed, not a metered loop |
| Rehearsal/call-time scheduling | N/A (not this tool's job — PC's job) | Separate dated "Rehearsal"/"Other" Times per plan, per-team scoping, "create in future plans" default propagation | Multiple dated rehearsals + one day-of report time per service, with **org-level defaults** (broader "propagate forward" idea, same underlying need) |
| Update notifications | N/A | Scheduling emails on initial assignment; explicitly does **not** re-notify on every later edit | Ensure the *existing* update/reminder sends always carry the plan link — do not add new per-edit notify triggers (matches PC's restraint) |

## Sources

- [How to trigger Pads (or any audio file) in ProPresenter - Worship Tutorials](https://worshiptutorials.com/blog/how-to-trigger-pads-or-any-audio-file-in-propresenter/) — MEDIUM-adjacent single-source, corroborated by general ProPresenter documentation references
- [Pad Tracks | PraiseCharts](https://www.praisecharts.com/products/pad-tracks) — cross-checked against Sweetwater/Loop Community (below); MEDIUM confidence
- [How to Use Pads for Smooth Transitions - Loop Community Blog](https://loopcommunity.com/blog/2019/08/how-to-use-pads-for-smooth-transitions/)
- [How to Use Ambient Pads to Improve Your Transitions - Sweetwater InSync](https://www.sweetwater.com/insync/use-ambient-pads-improve-transitions/)
- [Using Ableton Live to Prepare and Plan for Leading Worship - Sweetwater InSync](https://www.sweetwater.com/insync/using-ableton-live-to-prepare-and-plan-for-leading-worship/)
- [Add and assign times – Services (Planning Center)](https://pcoservices.zendesk.com/hc/en-us/articles/204461070-Add-and-assign-times) — LOW confidence (fetch blocked by 403; relied on search-snippet summary only, not the full page)
- [Linking Split Teams with Other Times - Planning Center blog](https://www.planningcenter.com/blog/linking-split-teams-with-other-times-html)
- [Send scheduling emails – Planning Center Help](https://help.planningcenter.com/en/142892-send-scheduling-emails.html)
- [Announcing the Planning Center app](https://www.planningcenter.com/blog/2026/04/planning-center-app)
- [Playback User Guide | MultiTracks.com Help Center](https://helpcenter.multitracks.com/en/articles/4944485-playback-user-guide)
- [The Library | ProPresenter 6](https://learn.renewedvision.com/propresenter6/introduction-to-propresenter/the-library)
- General church-presentation-software landscape (Proclaim, Tithe.ly, WorshipTools, MediaShout) — [The Lead Pastor: Best Worship Presentation Software 2026](https://theleadpastor.com/tools/best-worship-presentation-software/), [WorshipTools Notification Settings docs](https://www.worshiptools.com/en-us/docs/74-notif-settings) — LOW confidence, general context only
- Internal: `.planning/PROJECT.md` (v2.15 milestone scope, existing feature inventory, model decisions already made by the owner)

---
*Feature research for: Worship service planning / church presentation software (v2.15 additions)*
*Researched: 2026-09-09*
