# Feature Research

**Domain:** Church worship service planning web application
**Researched:** 2026-03-03
**Confidence:** MEDIUM — Competitor features verified via official sources (HIGH); smart-suggestion gap confirmed by absence across all reviewed tools (MEDIUM); Vertical Worship methodology specifics from project context only (LOW — no independent source available)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Song library management | Every worship planning tool has one; without it there's nothing to plan with | MEDIUM | Must support add/edit/delete, search, filter by key/tempo/tag, CCLI number storage |
| Multiple arrangements per song | Planning Center, WorshipTools, WorshipPlanning all support this; one song often has multiple keys, tempos, or instrumentation setups | LOW | Each arrangement needs its own key, BPM, notes |
| CSV import for song library | All major tools support bulk import; manually entering 100+ songs is a non-starter | MEDIUM | Planning Center export format is the standard; must handle their multi-arrangement column schema |
| Service order builder | Core function of every worship planning tool; step-by-step flow with songs, readings, prayer, message | MEDIUM | Must support the fixed WorshipPlanner service order structure |
| Song usage history / last-used tracking | Planning Center, WorshipTools, ChurchSuite all offer last-used sorting; users expect to see when a song was last scheduled | LOW | Store last-used date per song; display in song list |
| Printable order of service | Standard expectation — teams print for Wednesday rehearsal and Sunday service | LOW | Browser print or PDF generation with formatted layout |
| Shareable service plan | All major tools offer shareable/public plan view; team needs access on phones during rehearsal | LOW | Read-only link or email; must be mobile-friendly |
| User authentication | Any multi-user tool requires auth; Google OAuth is now standard in church tooling | LOW | Google OAuth + email/password; Firebase Auth handles both |
| Basic team/collaborator access | Teams of 2-5 people share planning duties; any tool without this is single-user only | LOW | Invite by email; shared access to all plans |
| Mobile-friendly view | Volunteers and planners pull up plans on phones during rehearsal and Sunday morning | MEDIUM | Responsive design minimum; read-only mobile view is acceptable for v1 |
| Week-by-week plan calendar | Users need to see upcoming services at a glance; all planning tools offer this | LOW | Calendar or list view of services by date |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Vertical Worship methodology encoding | No competitor encodes a specific worship methodology into the planning flow; this app treats the 1→2→3 arc as a first-class constraint, not a tag | HIGH | Songs must be categorized as type 1, 2, or 3; service order slots enforce category rules; the app understands "this slot requires a type 2 song" |
| Smart song suggestions with rotation awareness | No reviewed tool (Planning Center, WorshipTools, WorshipPlanning.com, ChurchSuite, Worship Planner) offers suggestions that combine: category type + recent usage + team compatibility in a single recommendation. This is the core planning brain | HIGH | Algorithm: filter by slot category → exclude recently used (last 2 weeks) → filter by team configuration → rank by longest gap since last use; override always permitted |
| Team configuration filtering | No standard tool filters song availability based on which ensembles (choir, orchestra) are scheduled for a given service; Planning Center has arrangement tagging but no automated cross-service filtering | MEDIUM | Per-service team config (choir present? orchestra present?) constrains the available song pool automatically |
| Service plan progression display (1-2-2-3 vs 1-2-3-3) | No competitor tracks the arc pattern across a full service; this app makes the 4-song progression a visible, enforced choice | LOW | Two progression modes selectable per service; slots labeled with type numbers |
| Rotation enforcement (not just visibility) | Worship Planner shows "due/not yet" status; Planning Center only sorts by last used. This app actively gates suggestions — recently-used songs deprioritized, not just visible | MEDIUM | Song availability score based on recency; songs used last week or this week appear last in suggestions |
| Seasonal/quarterly service overview | Planning Center offers multi-week calendar views, but no tool specifically supports the "Master Worship Schedule prepared 3x/year" workflow that many churches use | MEDIUM | Quarter view with planned songs visible across weeks; spot repetition patterns at a glance |
| Recurring task checklist with church-specific categories | Planning Center has task management, but it's generic. This app can pre-populate with the specific categories (Administrative, Communication, Rehearsal, Service time, Technical, Physical setup) this team uses | MEDIUM | Recurring task templates per service type; assignees + due-date offsets from service date |
| Scripture selection guidance | No standard tool helps select scripture passages; this app can surface the rules (6-10 verses, lean into Psalms, don't duplicate pastor's passage) as workflow nudges | LOW | Input field for scripture with guidance text; track which passage the pastor is using to prevent duplication |
| Export for Planning Center data entry | This app plans; PC executes. Export a structured summary (song list, keys, volunteers, notes) that can be manually entered into Planning Center | LOW | Text or CSV export formatted to match Planning Center's fields |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Planning Center API sync | Users want automatic data flow so they don't enter things twice | PC API requires OAuth app registration, rate limits, complex auth flow, and schema changes break integrations. For a 2-3 planner tool this is massive complexity for marginal gain. PROJECT.md explicitly calls this out of scope | CSV export → manual entry into PC. Design the export format to make manual transfer fast (under 5 minutes) |
| Real-time collaborative editing | Multiple planners editing the same service simultaneously seems useful | Operational transforms or CRDT-based merging is non-trivial; Firebase's real-time capability makes this tempting but conflicts in a service order are destructive (two songs swapped mid-edit). PROJECT.md calls this out of scope | Optimistic writes with a clear "last edit wins" model; 2-3 planners take turns — this is already their workflow |
| ProPresenter integration | Teams use ProPresenter for slides; automatic slide generation seems like a time-saver | ProPresenter's API and file formats require native app access and OS-level integration; a web app cannot drive it. WorshipTools manages to do this only via their own Presenter app, a full ecosystem play | Export service plan with song titles and lyrics references; ProPresenter operator enters manually |
| CCLI automatic reporting | CCLI compliance is legally important; automation removes manual effort | CCLI reporting integration requires licensing agreement with CCLI and API credentials. WorshipTools does this only via their deep CCLI relationship. For this tool, the complexity exceeds value for 2-3 planners | Display CCLI numbers per song in the service plan so manual reporting is easy |
| Mobile native app (iOS/Android) | Mobile access during rehearsal and Sunday is real | Native app doubles development and maintenance cost; responsive web works on all devices and gets around app store friction. Planning Center offers a native app, but that's a full engineering team | Progressive Web App with offline capability for service plan view |
| Musician scheduling | Worship leaders want everything in one place | Musician scheduling is Planning Center's core feature and well-solved there; duplicating it adds complexity without displacing PC (teams will keep using PC for this regardless). PROJECT.md calls this out of scope | Surface which musicians are scheduled (read-only import from CSV) without building the scheduling engine |
| Full song search across CCLI/SongSelect | Songs from the internet seem useful to pull in | CCLI SongSelect API requires licensing; scraping is prohibited. Most tools integrate this via formal partnership, which takes months | CSV import covers the stable; new songs added manually. Keep stable to a curated set (50-150 songs) which this team already has |
| Sermon series/thematic planning | Some worship leaders want to align songs to sermon themes | Thematic planning is highly subjective and hard to automate; it adds a content curation layer that's orthogonal to the scheduling problem. Every church has different theology and preference | Use song tags for seasonal/thematic labels; planners curate themes manually |

---

## Feature Dependencies

```
Song Library (songs with category, arrangements, tags)
    └──requires──> CSV Import (populate initial stable from PC export)
    └──enables──>  Song Suggestions (can't suggest without a library)
    └──enables──>  Song Usage Tracking (must have songs to track)

Service Order Builder
    └──requires──> Song Library
    └──requires──> Vertical Worship Category System (type 1/2/3 per slot)
    └──enables──>  Print / Share (nothing to print without a plan)
    └──enables──>  Export for Planning Center

Smart Song Suggestions
    └──requires──> Song Library
    └──requires──> Song Usage Tracking (to know what's been used recently)
    └──requires──> Team Configuration (to filter by ensemble availability)
    └──requires──> Vertical Worship Category System (to match slot to category)

Team Configuration (per-service)
    └──requires──> Song tagging with team compatibility (choir/orchestra flags)
    └──enables──>  Smart Song Suggestions (filters available pool)

User Authentication
    └──requires──> (none)
    └──enables──>  Collaborator Invites (multi-user access)
    └──enables──>  All features (auth gates the app)

Song Usage Tracking
    └──requires──> Service Order Builder (usage is recorded when a song is placed in a plan)
    └──enables──>  Smart Song Suggestions (rotation awareness)
    └──enables──>  Seasonal Overview (see songs across weeks)

Recurring Task Checklist
    └──requires──> User Authentication (tasks have assignees)
    └──enhances──> Service Order Builder (tasks tied to service dates)

Seasonal/Quarterly Overview
    └──requires──> Service Order Builder (multiple plans must exist)
    └──enhances──> Song Usage Tracking (visualize rotation patterns)
```

### Dependency Notes

- **Smart Song Suggestions requires Song Usage Tracking:** Rotation awareness is the core differentiator; without usage history, suggestions are just unordered lists
- **Team Configuration enables Smart Suggestions:** The choir/orchestra filter is what makes the pool context-sensitive; this filter must run before category filtering
- **CSV Import enables Song Library:** The practical path to populating the stable is Planning Center export; manual entry of 100+ songs is the alternative and a poor user experience
- **Vertical Worship Category System is foundational:** Type 1/2/3 classification is referenced by service order slots, suggestion algorithm, and seasonal overview — it must be implemented before any of those features

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept and replace the current spreadsheet/email workflow.

- [ ] **CSV import from Planning Center export** — Without this, onboarding requires manual data entry of the entire song stable; no team will do this
- [ ] **Song library management (add/edit/search/filter)** — Must be able to manage the stable after initial import; categorize by Vertical Worship type (1/2/3), tag for team compatibility
- [ ] **Service order builder with Vertical Worship methodology** — The core feature; fixed order structure with type-constrained slots (1-2-2-3 or 1-2-3-3 progression)
- [ ] **Smart song suggestions (category + rotation)** — The planning brain; suggestions filtered by type, recency of use, team configuration
- [ ] **Song usage history tracking** — Required for suggestions to be rotation-aware; recorded automatically when songs are placed in plans
- [ ] **Team configuration per service** — Which teams (choir, orchestra) are scheduled constrains the available song pool
- [ ] **Print formatted order of service** — Teams print for Wednesday and Sunday; non-negotiable for the existing workflow
- [ ] **Google OAuth authentication** — Single sign-on with Google is the team's existing tooling preference; email/password as fallback
- [ ] **Shareable plan link (read-only)** — Team members need to pull up the plan on their phones during rehearsal

### Add After Validation (v1.x)

Features to add once core is working and the planning workflow is validated.

- [ ] **Collaborator invites** — Start with a single planner; expand to 2-3 once the workflow is validated
- [ ] **Seasonal/quarterly overview** — Add once multiple weeks of data exist to visualize
- [ ] **Recurring task checklist** — Add once the service order workflow is solid; tasks are a secondary concern
- [ ] **Scripture selection guidance** — Low complexity; add once the song selection experience is validated
- [ ] **Export for Planning Center entry** — Useful but manual transfer is workable for v1; polish the data format after learning what planners actually need from the export
- [ ] **Email sharing** — Supplement the shareable link once team invites are in place

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Musician/team read-only view** — Expand beyond 2-3 planners to let musicians see their assignments; requires careful permissions model
- [ ] **Historical analytics** — Song frequency charts, category balance over time; useful for music directors but not for planning
- [ ] **Multiple service types** — Some churches run traditional + contemporary simultaneously; current scope is one service type per church
- [ ] **Progressive Web App offline support** — Service plan must be viewable without internet on Sunday morning; browser caching is the v1 solution

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| CSV import (Planning Center format) | HIGH | MEDIUM | P1 |
| Song library management + type categorization | HIGH | MEDIUM | P1 |
| Service order builder (Vertical Worship structure) | HIGH | MEDIUM | P1 |
| Smart song suggestions (type + rotation + team) | HIGH | HIGH | P1 |
| Song usage history tracking | HIGH | LOW | P1 |
| Team configuration per service | HIGH | MEDIUM | P1 |
| Print order of service | HIGH | LOW | P1 |
| Google OAuth auth | HIGH | LOW | P1 |
| Shareable plan link (read-only) | MEDIUM | LOW | P1 |
| Collaborator invites | MEDIUM | LOW | P2 |
| Seasonal/quarterly overview | MEDIUM | MEDIUM | P2 |
| Recurring task checklist | MEDIUM | MEDIUM | P2 |
| Scripture selection guidance | LOW | LOW | P2 |
| Export for Planning Center entry | MEDIUM | LOW | P2 |
| Email sharing | LOW | LOW | P3 |
| Historical analytics | LOW | HIGH | P3 |
| Offline / PWA support | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Planning Center Services | WorshipTools Planning | WorshipPlanning.com | WorshipPlanner.com | Our Approach |
|---------|--------------------------|----------------------|---------------------|-------------------|--------------|
| Song library | Yes — tags, arrangements, multi-key | Yes — tags, last-used sort, SongSelect import | Yes — 20+ fields, CSV import, Spotify links | Yes — usage tracking, rotation status | CSV import from PC export; store type 1/2/3 per song |
| Song type categorization | No — only custom tags | No — only custom tags | No — only custom tags | No — only custom tags | First-class: type 1/2/3 as category field, not a tag |
| Smart song suggestions | No | No | No | Rotation "due/not yet" only, no category/team filtering | Suggestion algorithm combining category + recency + team config |
| Song rotation tracking | Sort by last-used only | Sort by last-used only | Usage history report | Customizable rotation intervals per song | Track usage, expose recency in suggestions, hard rotation floor of 2-week minimum |
| Team compatibility filtering | Arrangement tags exist but no per-service filter | No | No | No | Per-service team config automatically filters song pool |
| Service order builder | Drag-and-drop, any order | Drag-and-drop, any order | Drag-and-drop, any order | Unknown | Fixed Vertical Worship structure; slot types enforced |
| Print service plan | Yes | Yes | Yes | Yes | Yes — formatted for rehearsal and Sunday |
| Shareable plan link | Yes (public plan view) | Yes (shareable) | Yes (cloud access) | Unknown | Yes — read-only link |
| Recurring tasks | Yes — generic task management | No | No | No | Yes — pre-categorized for worship team workflow |
| Mobile access | Native iOS/Android app | Native iOS/Android app | Mobile web app | Unknown | Responsive web; mobile-optimized service view |
| Auth | Username/password | Username/password | Username/password | Unknown | Google OAuth + email/password |
| CCLI reporting | Yes — integrated | Yes — auto-reports | Yes — compliance tracking | No | Display CCLI number; manual reporting |
| Multi-week overview | Yes — calendar view | No | Unknown | No | Seasonal/quarterly overview in v1.x |
| Export to PC | No (it is PC) | No | CSV export | No | Structured export formatted for PC manual entry |

---

## Sources

- [Planning Center Services official features](https://www.planningcenter.com/services) — MEDIUM confidence (official marketing page)
- [Planning Center for Worship Leaders](https://www.planningcenter.com/use-cases/worship-planning) — MEDIUM confidence (official use-case page)
- [Planning Center New Songs Page blog post, 2019](https://www.planningcenter.com/blog/2019/06/the-new-songs-page) — MEDIUM confidence (official blog, confirms no smart suggestions as of that update; verified still absent via 2025 search)
- [WorshipTools Planning features](https://www.worshiptools.com/en-us/planning) — MEDIUM confidence (official product page)
- [WorshipTools Songs in Planning documentation](https://www.worshiptools.com/en-us/docs/83-pl-songs) — HIGH confidence (official docs; confirms sort-by-last-used, no smart suggestions)
- [WorshipPlanning.com features](https://worshipplanning.com/) — MEDIUM confidence (official product page)
- [Worship Planner song rotation feature](https://worshipplanner.com/features) — LOW confidence (page returned JS bundle; description from search result snippet only)
- [ChurchSuite new filters announcement, August 2025](https://churchsuite.com/blog/2025-08-13-new-filters-to-help-you-find-what-matters-most/) — MEDIUM confidence (confirms industry trend toward last-used filtering)
- [The Church Collective: Worship Planning Song Types](https://thechurchcollective.com/worship-planning/worship-planning-song-types/) — MEDIUM confidence (confirms three-category song typology is an established framework; maps loosely to Vertical Worship 1/2/3)
- [Crucis: Four Song Categories in Worship](https://crucis.ac.edu.au/four-song-categories-worship/) — MEDIUM confidence (academic framework confirming category-based song typing is standard worship theology)
- Project context: Vertical Worship 1/2/3 methodology from `PROJECT.md` — HIGH confidence for this project's requirements (team-defined, not sourced externally)

---

*Feature research for: Church worship service planning (WorshipPlanner)*
*Researched: 2026-03-03*
