# Feature Research

**Domain:** Church worship-planning / presentation software — settings, sharing, and content-fidelity features for a shipped app (v1.5 milestone)
**Researched:** 2026-08-06
**Confidence:** MEDIUM (mix of official-primary sources — Crossway/Tyndale license pages, Planning Center help docs — and secondary/community sources; see per-section notes and Sources)

## Scope note

This research covers only the eight NEW v1.5 questions. It deliberately does not re-research
anything already shipped (song catalog, VW methodology, slide groups, PPTX import mechanics, existing
share-link plumbing, existing AI features themselves). Findings are framed against comparable products:
ProPresenter, EasyWorship, Planning Center Services, Proclaim (Faithlife), OpenLP, plus general SaaS/UI
patterns where no church-specific precedent exists (item 1's interaction design, item 2's AI-toggle UX).

---

## 1. Congregational Reading Divider UX (PRIORITY — deep research)

### The problem shape

A user has a body of scripture text (already fetched from ESV/NLT) and needs to partition it into an
**ordered sequence of labeled segments**, where each segment is one of three roles: **Leader**,
**Congregation**, and **All**. Today an LLM proposes this partition in one shot. The owner wants the
partition to be a **first-class manual editing action**, with AI retained as an optional starting
point the user can override — not a black box the user either accepts or rejects wholesale.

This is structurally a **text segmentation + per-segment labeling** problem, not a scripture-specific
one. The closest existing UI precedents are not other church software (none of ProPresenter, EasyWorship,
or Proclaim has a dedicated responsive-reading *editor* discoverable in public docs — see below) but
**subtitle/caption editors** and **span-annotation tools**, both of which solve exactly this shape:
take contiguous text/time, cut it into ordered pieces, and assign each piece a label from a small
closed set.

### What comparable church products actually do (confidence: LOW-MEDIUM — thin public documentation)

- **ProPresenter**: has a robust Bible/Scripture module (125+ translations, 36 languages, side-by-side
  multilingual display) but public documentation surfaced **no dedicated responsive-reading /
  leader-congregation split feature**. Practitioners build responsive readings manually as ordinary
  text slides, one slide per part, typed by hand. This is a **gap in the market**, not a solved
  problem — WorshipPlanner would be differentiating, not catching up, if it builds a good editor here.
- **EasyWorship**: Scripture module reflows verses across slides automatically (configurable: fill
  slide vs. one verse per slide), but again no leader/congregation role assignment found in docs.
- **Proclaim (Faithlife/Logos)**: Order-of-Service and template features are strong, but no
  responsive-reading-specific editor surfaced in feature docs.
- **Planning Center Services**: no responsive-reading editor; it is a scheduling/service-order tool,
  not a slide content editor.
- **Conclusion**: There is no "gold standard" church-software UI to imitate directly for item 1. The
  right reference class is **general text-segmentation editors** (below), adapted to the
  Leader/Congregation/All vocabulary and to slide-per-segment output.

### Interaction patterns surveyed, with trade-offs

**(a) Click-between-verses to insert a divider** (subtitle-editor analog: "hover a border, click
insert")
- How it works: the passage renders as continuous verse-numbered text; hovering the gap between any
  two verses (or between sentences, since responsive readings don't have to break on verse boundaries)
  reveals a thin "+" affordance; clicking it inserts a divider at that exact point, creating two
  segments.
- Trade-off: precise and low-friction once a first divider exists, but the *first* divider requires
  the user to find and hover a specific inter-verse gap, which is a fiddly target on a touch screen —
  relevant here since the milestone also demands mobile usability.
- Verdict: **good primary mechanism**, pair with (c) for touch.

**(b) Drag handles**
- How it works: divider positions are draggable handles on a vertical track running alongside the
  text; dragging redistributes the boundary between two segments (this only makes sense if boundaries
  are constrained to a discrete set of valid break points — verse boundaries or sentence boundaries —
  otherwise dragging is ambiguous inside a wrapped paragraph of text).
- Trade-off: drag handles are the wrong metaphor here because responsive-reading breaks are inherently
  **discrete** (you break at a verse or sentence, never mid-word), so a continuous drag gesture implies
  more precision than the data model supports, and reordering by drag is a separate, riskier gesture
  than most users expect for text (accidental drags on scroll are a known mobile failure mode).
- Verdict: **not recommended** as primary; a scripture passage is not a continuous timeline like audio,
  so the affordance subtitle editors use drag-handles for (adjusting cue timing) doesn't map here at
  all. Reordering segments (if ever needed) is better served by up/down move buttons than drag.

**(c) Per-verse dropdown assignment**
- How it works: each verse (or clause) gets an inline `Leader / Congregation / All` selector next to
  it; adjacent verses with the same label visually merge into one segment/slide; changing a dropdown
  either creates a new boundary (if it now differs from its neighbor) or removes one (if it now matches).
- Trade-off: this is the most **touch-friendly and unambiguous** pattern — no precise click targets,
  no drag gesture, and it doubles as the labeling step and the dividing step in one action (a divider
  is just "my label differs from the verse above me"). Its weakness is verbosity: a 20-verse passage
  means 20 visible dropdowns even though the final result might be only 4 segments, which is more
  visual noise than the segmented view in (a).
- Verdict: **strong candidate**, especially as the mobile-friendly fallback, and it composes naturally
  with AI pre-fill (AI sets every dropdown; user only touches the ones it got wrong).

**(d) Alternating auto-assignment with manual override**
- How it works: a one-click "alternate Leader/Congregation" action stamps every verse alternately, then
  the user hand-corrects specific verses (to mark a refrain as "All", or to give the leader two verses
  in a row). This is not really a distinct *editing* pattern — it's a **seeding strategy** that produces
  the same underlying per-segment label data as (c), just via a bulk-fill shortcut instead of one AI
  call.
- Trade-off: valuable as a **non-AI fallback** — when the AI toggle (item 2) is off, this gives users
  who don't want to hand-label 20 verses from scratch a fast starting point that's still fully
  deterministic and local (no network call), which matters for the "AI off means no AI interaction at
  all" requirement. Cheap to build once (c) exists, since it's just a bulk-write to the same label field.
- Verdict: **build this as a companion action to (c)**, not a replacement for AI *or* for manual
  control — it's the third option alongside "let AI propose" and "start blank."

**(e) Select-text-then-label** (annotation-tool analog: Prodigy/Label Studio "select span, press
label key")
- How it works: user selects an arbitrary text range (can cross verse boundaries, can be a partial
  verse) and applies a label to the selection; unlabeled remainder is implicitly a fourth "unassigned"
  state.
- Trade-off: maximum flexibility (arbitrary boundaries, not locked to verse lines) but the highest
  implementation complexity — needs a text-range selection model, handling of overlapping/adjacent
  selections, and a way to show unassigned gaps. It also invites boundaries that don't correspond to
  anything a human reads aloud sensibly (mid-sentence breaks), which responsive readings never actually
  want (see printed convention below: breaks are always at verse or clause boundaries, never mid-clause).
- Verdict: **overkill for this domain.** Real responsive readings break at verse or sentence boundaries,
  never mid-word/mid-clause, so the extra freedom this pattern buys is freedom the feature doesn't need,
  paid for in implementation and interaction complexity. Reject in favor of (a)/(c), which both
  naturally snap to verse boundaries.

### Recommended approach

Combine **(a) as the primary desktop-friendly divider gesture** — click a gap between verses to
insert/remove a boundary directly in the flowing text, keeping the passage readable as continuous
prose rather than a fragmented list — with **(c)'s per-segment label control** — once boundaries
exist, each resulting segment gets a `Leader / Congregation / All` selector (chip/segmented-control,
not a dropdown menu, since there are only 3 values and a tap-target-sized 3-way toggle beats opening
a dropdown on mobile). Seed the whole thing three ways, all producing the exact same editable label
data structure so none of them are dead ends:
1. **AI split** (existing feature, retained, gated by the AI toggle — item 2),
2. **Alternate Leader/Congregation** one-click seed (pattern d, no network call),
3. **Blank** (every verse defaults to unassigned/Leader, user builds it by hand).

This mirrors the subtitle-editor pattern closely enough to be a known-good interaction shape (this
exact "click-to-split, then label the resulting chunk" flow is standard in Smartcat/Kapwing/Subtitle
Edit — see `<tool_strategy>` digest) while dropping subtitle-editor concepts that don't apply here
(no timeline, no drag-to-retime, since text has no duration).

### Printed/bulletin conventions to honor (confidence: MEDIUM — Wikipedia + worship-resources.org
consistent, LOW on typography specifics — thin sourcing on the exact bold-vs-italic split)

- **Labels used**: `Leader:` (or `Reader:`), `People:` (or `Congregation:`), `All:` for unison —
  these three role names are the standard vocabulary across denominations; WorshipPlanner's
  `Leader / Congregation / All` already matches this convention.
- **Typographic distinction in print**: the dominant modern convention is **leader's part in regular
  (roman) type, congregation's part in bold**. Some traditions (Book of Common Prayer / Episcopal use)
  instead **italicize** the congregation's (typically shorter) response, keeping the same size as the
  leader's part. Older hymnals were inconsistent — some used no type distinction at all and relied on
  explicit `Leader:`/`People:` labels (rubrics) instead. **Implication for the slide UI:** always show
  the role label as text (never rely on styling alone to convey who speaks), and optionally add a bold
  or otherwise visually distinct treatment for Congregation/All segments as a secondary cue —
  label-first, styling-second, matching the historical inconsistency of styling-only approaches.
- **Where breaks fall**: responsive readings are built from **logical thought units**, not
  mechanically verse-by-verse — a leader's portion is often 1-3 verses and a congregational response is
  frequently a recurring **refrain** (Psalm 136 is the canonical example: every other line is the same
  congregational refrain). **Implication:** the divider UI must support assigning the *same* label to
  non-adjacent, non-contiguous verses cheaply (e.g., re-picking "Congregation" for verse 14 after it
  was "Leader" for verse 13 and "Congregation" for verse 12) — this is naturally supported by pattern
  (c)'s per-segment selector but would be awkward under a pure "drag one moving divider" model, which
  is a second reason to reject pattern (b).

### How this is presented on slides (from milestone decisions in PROJECT.md, restated for context)

Per the already-settled v1.5 decision: **the first slide shows the scripture reference** (e.g. "Psalm
136:1-9"), and **subsequent slides show only the speaker label** (Leader / Congregation / All) plus
that segment's text — no repeated reference on every slide. This matches printed-bulletin practice,
where the passage citation appears once at the top of the reading and role labels carry the rest of
the flow. The editor's segment list should therefore double as a **live preview of the resulting
slide sequence** — each labeled segment is 1:1 with a slide — so the user is essentially arranging
slides, not abstractly labeling text.

### Complexity: MEDIUM

Data model is small (ordered list of `{ text, role }` segments derived from an already-fetched
passage). The complexity is entirely interaction design and edge cases: verse boundaries that don't
align with sentence boundaries, refrains needing repeated non-adjacent labels, mobile tap targets,
and keeping AI-seed / alternate-seed / blank-seed all funnel into the same editable structure. This
is explicitly the reason the owner called for a dedicated UI research phase — recommend the roadmap
give this its own phase rather than folding it into general slide work.

### Dependency

Depends on: existing scripture-fetch pipeline (ESV/NLT text retrieval, item 8), existing AI split
feature (retained as one seed path, gated by item 2's toggle), existing slide-group/slide model (each
segment becomes a slide). Not dependent on item 4 (font settings) but should visually respect it once
built.

---

## 2. Feature Toggles for AI

### How comparable products expose "AI off" (confidence: LOW-MEDIUM — general SaaS pattern research;
no church-presentation-specific precedent found — ProPresenter's AI features, where they exist, were
not documented with a visible off-switch pattern in public docs)

There is no church-software-specific precedent to follow here (search did not surface a documented
"AI toggle" in ProPresenter, EasyWorship, or Proclaim). This is general SaaS settings-UX territory,
and the pattern is well established there:

- **Visible-but-disabled with explanation is the expected default**, not hidden entirely. Users who
  are AI-cautious (a real subset of church admins, often for cost, doctrinal, or data-sovereignty
  reasons) want to *see* that AI exists and *confirm* it's off, not wonder whether the app quietly
  still calls out. Fully hiding the toggle (and the features it gates) removes that reassurance and
  makes "is AI really off" unverifiable from the UI.
- **The expected off-state UX for the gated features themselves is "hidden or replaced," not
  "greyed out."** This distinguishes a *global org-level* toggle (which is what v1.5 scopes — one
  switch in Settings) from a *per-feature* toggle. When AI is off, the AI Suggest button/panel on the
  song picker, the scripture-discovery search, and the congregational-reading AI-split entry point
  should **not render at all** (or fall back cleanly to the manual/deterministic equivalent, as item 1
  does), rather than appearing as a disabled ghost control — a greyed-out AI button that's always
  there is a worse experience than either "it works" or "it doesn't exist," because it invites repeated
  discovery-and-disappointment clicks.
- **Data/privacy messaging users expect near the toggle**: a one-line explanation of *what* leaves the
  app when AI is on (e.g., "song titles, scripture references, and sermon topic are sent to Anthropic's
  Claude API to generate suggestions") and *that nothing is sent when this is off*. This matches the
  existing architectural decision already logged in PROJECT.md — "AI gated at the `claudeApi.ts` choke
  point" — which is exactly the right implementation shape to make this promise mechanically true
  (one code path, one place the toggle needs to short-circuit) rather than merely a UI illusion.
- **Confirmation, not silent toggling, for turning AI off** is optional-but-common when the setting has
  workflow consequences — but for WorshipPlanner this is a single Settings checkbox with no destructive
  side effect (nothing is deleted, previously-AI-generated content stays as ordinary editable content),
  so a simple immediate toggle (no confirm dialog) is appropriate; reserve confirmation dialogs for
  destructive actions elsewhere in the app, not this one.

### Table stakes vs differentiator

This is **table stakes** for any org-configurable SaaS product in 2026, not a differentiator — the
differentiator is doing it cleanly at one choke point (already an existing architectural decision) so
"off" is provably off.

### Complexity: LOW

One boolean on the org settings doc, one guard in `claudeApi.ts`, and per-surface conditional
rendering (hide, don't grey) at each of the three existing AI call sites (song suggestions, scripture
discovery, congregational split) plus the org-level Planning Center toggle following the identical
pattern.

### Dependency

Depends on the existing per-org settings screen (already shipped, has `vwModeEnabled` as precedent)
and the existing `claudeApi.ts` module (already the single AI choke point per the milestone decision
log). No new architecture needed — this is additive to a pattern that already exists twice
(`vwModeEnabled` for VW mode).

---

## 3. Default Service Templates / Order of Service

### How comparable tools handle this (confidence: MEDIUM — Planning Center help docs are official/
primary; Proclaim info is secondary/marketing-page sourced)

- **Planning Center Services** is the strongest precedent here since WorshipPlanner already
  complements it. PC's **Plan Templates** feature: a template is a saved list of plan items (same
  item types as a live plan — Item / Header / Song / Media) that can be inserted into a new plan in
  one action. Templates store **item types and titles**, and **time allotted for each element**
  (duration), but *not* a specific time-of-day — that's populated from the service type's schedule
  when the template is applied. PC supports **multiple named templates** per organization (not a
  single default), consistent with churches running different templates for, e.g., a traditional
  service vs. a contemporary service vs. a special/Christmas service.
- **Proclaim** similarly offers "ready-to-use templates... for lyrics, announcements, sermon outlines,
  and more, or create your own to fit your church's needs," reinforcing that **multiple, user-defined
  templates** (not one hardcoded default) is the norm among tools serving multiple-service-type
  churches, though a single church usually treats one template as "the" default for new blank plans.

### Granularity recommendation for WorshipPlanner

Given the milestone decision already locked in PROJECT.md ("The org template replaces `buildSlots()`
as the source of a new blank service's structure" — singular, not plural, and VW song-typing layers on
top when enabled), the scoped v1.5 feature is **item types with default titles**, matching PC's model:
a template is an ordered list of service-item slots (type + default title, e.g. a `SONG` slot titled
"Opening Song" or an `ITEM` slot titled "Announcements"), not merely a list of bare types. Duration
per item (PC's mm:ss field) is a reasonable stretch addition but is **not called for** in the v1.5
scope as written — flag as a P2/differentiator, not required for the core "default template" ask.

**Multiple named templates vs. single default**: PROJECT.md's decision explicitly frames this as
**one org template** ("A church can define the default template for a new blank service" — singular).
This is a **narrower, simpler scope than Planning Center's model** (which supports many named
templates for different service types). That's an intentional, reasonable v1.5 cut given
WorshipPlanner serves one church's single weekly service pattern (unlike PC, which many churches use
across multiple distinct service types/campuses) — but flag this as the point most likely to need
revisiting if the org ever runs two structurally different regular services (e.g. traditional +
contemporary).

### Table stakes vs differentiator

**Table stakes** for a tool that already generates a standard order (WorshipPlanner already has this
via `buildSlots()`/VW) — the gap being closed is *configurability*, not novelty. Every real
church-planning tool surveyed treats "our standard order of service" as a first-class configurable
concept.

### Complexity: MEDIUM

Requires: a settings slide-out UI to define/edit the ordered list of slot type+title pairs (per the
already-decided "Services slide-out" UI shape in PROJECT.md), a data model for the org-level template,
and rewiring new-blank-service creation to read from it with `buildSlots()` demoted to the fallback.
The VW-song-typing-layered-on-top behavior is the trickiest part: the template defines structure, VW
mode (if on) still needs to assign 1/2/3 types to whichever slots are SONG slots in the template,
which is a merge of two independently-configurable systems and needs explicit rules for what happens
when a template doesn't have exactly four song slots.

### Dependency

Depends on existing `buildSlots()`/service-slot model, existing `vwModeEnabled` toggle (interaction
between template and VW mode must be defined), existing add-item palette (item 5's Announcements/
Miscellaneous additions and Hymn removal should land *before or alongside* this, since the template
editor needs a finalized set of slot types to offer).

---

## 4. Global Slide Typography Settings

### How presentation tools expose font settings (confidence: MEDIUM — ProPresenter support docs are
official/primary)

ProPresenter's **Theme Editor** (the closest analog to a global style setting, since themes cascade
to all slides using them) exposes, per the official docs:
- **Font family** and **font size** — the baseline pair.
- **Line height / line spacing**, letter/character spacing, and **all-caps** toggle.
- **Advanced text effects**: **stroke** (outline) and **shadow**, plus "text linking" (auto-scaling
  text to fit its box).
- Shape-tab styling (fill/stroke/shadow/feathering) for background elements, separate from text.
- Public docs did not confirm an explicit **safe-area margin guide** as a *typography* setting
  (safe-area/title-safe guides are more commonly a canvas/editor overlay feature than a persisted
  style property) — treat this as an editor-UX nicety rather than a stored setting.

### Is family + weight + size sufficient?

**No — matching ProPresenter's baseline, family + weight + size is necessary but not sufficient for
legibility on a real projector.** The milestone's own decision log already anticipated needing weight
as a first-class axis (the "Inter Light=300 / Regular=400 as Helvetica Neue stand-in" reasoning), which
is correct and matches how professional presentation tools model fonts (weight is not a size, it's a
distinct selectable axis). Beyond the three already-scoped axes, the two **projection-legibility
essentials** that comparable tools treat as also-global (not per-slide) are:

- **Text outline/stroke** and/or **drop shadow** — these are not decorative in this domain, they are
  the primary technique for keeping text legible against a **background image**, which WorshipPlanner
  already supports per-group/per-slide/per-song (v1.4). White text with no outline over a bright
  background photo is the single most common church-projection legibility failure; virtually every
  presentation tool (ProPresenter, EasyWorship, Proclaim, OpenLP) treats outline/shadow as a standard
  text-style control specifically because of this. **Recommend including at minimum a boolean-or-tiered
  outline/shadow control in the global typography setting**, even though it's not explicitly named in
  the v1.5 feature list — flag as a likely-missing requirement for the roadmapper to confirm with the
  owner, since it directly interacts with the already-shipped background-image feature.
- **Alignment** (horizontal, and to a lesser extent vertical) is typically also global-theme-level in
  these tools, since a church's "house style" usually includes a consistent text position (e.g.,
  centered) as much as a consistent font.
- **Line height** matters specifically for multi-line lyric/scripture slides (cramped line spacing is
  a common legibility complaint) — worth including given WorshipPlanner already reflows multi-verse
  scripture across slides.
- **Safe-area margins**: lower priority — a real requirement for broadcast/streaming contexts
  (ensuring text isn't cut off by a TV's overscan or a stream's letterbox) but WorshipPlanner's stated
  target is in-room projection, where this matters less. Treat as **P3/defer** unless the owner flags
  streaming/recording as an active use case.

### Table stakes vs differentiator

Family/weight/size is **table stakes** (already decided). Outline/shadow is **arguably table stakes
in practice** (near-universal in comparable tools, and directly relevant to an already-shipped
feature — background images) even though the milestone scope doesn't name it; recommend surfacing this
gap explicitly rather than silently absorbing it into "size." Alignment and line-height are
**reasonable differentiated inclusions** (most comparable tools have them, but they're not
functionally blocking the way outline/shadow is). Safe-area margins are a **defer/anti-feature** for
this milestone given the in-room-projection-only scope.

### Complexity: LOW-MEDIUM

The font-family part is already scoped as complex (curated self-hosted woff2 catalog, decided against
runtime Google Fonts specifically for offline projector reliability — see PROJECT.md decision log).
Adding weight+size is straightforward once the curated list defines which weights exist per family.
Adding outline/shadow/alignment/line-height as further global settings is low-incremental complexity
once the settings slide-out and the "apply globally to all slide rendering" plumbing exists for the
first three axes — it's the same plumbing, more fields.

### Dependency

Depends on the curated self-hosted font list (a UI-research-phase deliverable per PROJECT.md), the
existing Slides slide-out settings surface, and touches every slide-rendering code path (grid,
presenter, print) since font settings must apply uniformly across all render contexts.

---

## 5. Announcements and Miscellaneous Service Items

### What comparable tools put in these slots (confidence: LOW-MEDIUM — Planning Center's four-item-type
model is documented in official help docs; content specifics extrapolated)

Planning Center Services' **Item** type is the direct precedent: a generic, title+description
container used for exactly this class of content — the docs' own examples include "Pre-Service
Prayer," "**Announcements**," and "Benediction." There is no separate "Miscellaneous" item type in PC
either — it's absorbed into the same generic Item type. This validates the milestone's already-decided
design: **Announcements and Miscellaneous as plain input boxes** (not structured forms with fields
like "presenter," "duration," or "linked slide") mirrors exactly how the closest comparable product
handles this class of content — free-text, no special structure, because the content varies too much
church-to-church to usefully constrain (a "miscellaneous" item by definition resists a schema).

**Message** being reduced to a plain input box with no URL link (per the milestone decision) is a
simplification in the same direction — removing structure that turned out to be unused ceremony
(a link field on a Message item), consistent with the same underlying pattern PC uses for anything
that isn't a Song or Media reference.

### Table stakes vs differentiator

**Table stakes.** Every comparable tool has a "generic freeform item" concept for exactly this
content class; the only design question was ever how much structure to add on top, and "none" is both
the simplest and the pattern-matched choice.

### Complexity: LOW

Two new plain-text service-item types plus simplifying an existing one (Message) and removing one from
the palette (Hymn, already scoped separately). This is UI/data-model work on an existing, well-
understood service-item system — no new architecture.

### Dependency

None beyond the existing service-item/slot architecture. Should land in the same phase as item 3
(default template) since the template editor needs the final palette of item types to reference.

---

## 6. Stable Share Links

### Conventions in comparable products (confidence: LOW — Planning Center's public docs describe the
concept but not the underlying URL-stability mechanics in enough detail to fully confirm)

- Planning Center Services' model separates two concerns that WorshipPlanner's own root-cause analysis
  (already in PROJECT.md) also separates: **an access toggle** ("Enable Public View" — turns
  visibility on/off without necessarily changing the URL) and **a stable/relative link concept**
  ("Permalinks," which resolve to "this week's plan" or "last week's plan" dynamically rather than
  being frozen to one snapshot). This validates the milestone's chosen shape: **persist the token on
  the service doc, mint once, never rotate**, with the underlying content auto-refreshing — the token
  is the stable identifier, the *content it resolves to* is what's allowed to change, which is exactly
  how PC's model separates "the URL never changes" from "the content it shows must be dynamic."
- **Revocation** in the PC model is achieved via the visibility toggle, not by rotating the URL — i.e.,
  "never changes" and "revocable" **do coexist** by making revocation a boolean gate in front of a
  stable identifier, rather than by invalidating the identifier itself. This is a directly reusable
  pattern: WorshipPlanner's persisted share token should be paired with (or already has, via existing
  RBAC/sharing infrastructure) an independent "shared: true/false" flag, so an editor can revoke a
  link's *live* access without breaking the URL a worship team already bookmarked or texted around —
  re-enabling later restores the same link rather than requiring a new one to be redistributed.
- Public docs did not surface a documented case of PC supporting **manual, user-initiated rotation**
  of a permalink (as opposed to the automatic content-refresh WorshipPlanner is already committed to)
  — this is consistent with "stable links don't rotate" being the norm, not an edge case tools
  special-case for.

### Table stakes vs differentiator

**Table stakes** (a link that changes every time you re-share is a known, already-diagnosed defect in
this codebase, not a novel feature) with the auto-refreshing-snapshot behavior as the differentiator —
most comparable tools' "permalink" concept already implies always-current content by resolving
dynamically rather than snapshotting, so WorshipPlanner catching up to "always current" is closing a
gap against the category norm, not exceeding it.

### Complexity: LOW-MEDIUM

Per the milestone's own root-cause note, this is a **single root cause, already isolated**:
`createShareToken()` currently mints fresh on every call and freezes a snapshot at that moment. The
fix is architecturally simple (persist token, don't regenerate; recompute snapshot on every service
write instead of only on share) but requires care around the existing PII guard (D-04/D-24 — names
only, no emails in the frozen snapshot) since "auto-refresh on every service change" means the
snapshot-recompute path needs to preserve that same redaction on every write, not just at share time.

### Dependency

Depends entirely on existing sharing infrastructure (`services.ts`, `createShareToken()`,
`serviceShares/{slug}`) — this is a bug-fix-shaped feature on code that already exists, not new
architecture.

---

## 7. Multi-Image Import Ordering

### Confirmed: natural sort is the expected answer (confidence: MEDIUM — well-established, widely
documented CS/UX concept, not domain-specific)

**Plain lexicographic (alphabetical) sort is wrong for numbered filenames** because it compares
strings character-by-character: `"slide10"` sorts *before* `"slide2"` because `'1' < '2'` as the first
differing character, even though 10 > 2 numerically. This is a well-documented, well-known failure
mode (Coding Horror's "Sorting for Humans" post and multiple tooling issue threads — e.g. a PowerShell
GitHub issue explicitly reproduces `slide1.xml, slide10.xml, slide11.xml, slide2.xml, slide3.xml` under
default sort) — not a subtle or contested point.

**Natural sort** fixes this by treating contiguous digit runs as a single numeric token for comparison
purposes rather than as individual characters, so `slide2` sorts before `slide10`. This is the
industry-standard answer and matches what users intuitively expect from a file manager (Windows
Explorer, macOS Finder, and most modern file browsers already natural-sort by default, which is
precisely why users are surprised when an importer *doesn't*).

**Subtlety to implement carefully** (this is the part worth flagging explicitly for the phase plan):
- Natural sort must handle **mixed prefixes correctly**: `IMG_2.jpg`, `IMG_10.jpg`, `photo_1.jpg` —
  the numeric-run comparison should only kick in when comparing the numeric portion *within* an
  otherwise-identical or compatible string context; a naive implementation that just extracts "the
  first number in the string" and sorts on that alone can misorder files with different non-numeric
  prefixes.
- **Zero-padding does not need to be assumed** — natural sort compares numeric *value*, so `slide02` and
  `slide2` should be treated as equal in numeric weight (this matters because some cameras/export tools
  zero-pad and some don't, and a mixed batch is plausible).
- **Multiple numeric runs in one filename** (e.g. `2026-08-06_slide2.jpg`) should be compared
  left-to-right, run by run, exactly the way version-string comparison works — this is the standard
  natural-sort algorithm shape (split into alternating text/number tokens, compare token-by-token,
  numeric tokens by value, text tokens lexicographically).
- **No filesystem timestamp fallback needed** — natural sort by filename is the correct, sufficient
  answer; don't over-engineer with EXIF/mtime ordering, since the milestone's own diagnosis already
  confirmed the actual defect is "browser `DataTransfer` order is used as-is," not "there's no good
  signal to sort by."

### Table stakes vs differentiator

**Table stakes.** This is baseline expected behavior for any tool that imports numbered files, already
diagnosed as a defect (not a missing nice-to-have) in the milestone scoping.

### Complexity: LOW

A well-known, small, pure-function problem (natural sort comparator) applied at one point in the
existing `classifyFiles`/`dropRouting.ts` pipeline (already identified in PROJECT.md scoping). Off-the-
shelf natural-sort comparator logic is short and doesn't require a library dependency, though using a
small tested one (rather than hand-rolling regex splitting) reduces risk of the mixed-prefix subtlety
above being mishandled.

### Dependency

Depends on existing `dropRouting.ts`/`classifyFiles` multi-image-import pipeline (already confirmed
working for file-type classification in the milestone's own investigation — only ordering is the gap).

---

## 8. Bible Translation Selection

### How tools handle multiple translations (confidence: MEDIUM — general pattern, well-established)

Every comparable tool surveyed (ProPresenter with 125+ translations, EasyWorship with 90+, Proclaim via
Logos' Bible platform) treats **translation as a selectable setting**, either globally or per-search,
sourced from licensed translation APIs/databases rather than reimplementing text. WorshipPlanner's
scoped approach — a Settings-level ESV-or-NLT choice, both already proxied through Cloud Functions per
existing `ESV_API_KEY`/incoming `NLT_API_KEY` pattern — matches this norm exactly: translation choice
as an org-level setting, not a per-search ad hoc picker, which is appropriate for a single-church tool
where the congregation reads from one consistent translation each week (unlike a general Bible app
serving many users with different denominational preferences).

### Licensing/attribution requirements — stated factually (confidence: MEDIUM-HIGH for the two direct-
source fetches — Crossway's own permissions page, and Tyndale's copyright notice as mirrored by
thebible.org/studylight.org; these are consistent with each other and internally consistent with the
well-known "Bible license" pattern most publishers use)

**ESV (Crossway)**, per crossway.org/permissions:
- Quotable **without a formal license or written permission** up to **500 verses**, provided the
  verses quoted do **not exceed one-half of any one book of the Bible** (the more restrictive of the
  two caps governs).
- For **non-saleable media** — and church bulletins, orders of service, projected/presentation slides,
  and posters/transparencies are explicitly named as examples of non-saleable media in Crossway's own
  guidance — **a complete copyright notice is not required**. The only requirement is that the
  **initials "(ESV)"** appear at the end of the quotation.
- A full notice text is available if the church prefers to display it, but it is optional in this
  context: *"Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®),
  © 2001 by Crossway, a publishing ministry of Good News Publishers."*

**NLT (Tyndale House)**, per the standard Tyndale copyright notice (mirrored consistently across
thebible.org and studylight.org's NLT notices pages):
- Quotable **without written permission** up to **500 verses**, provided the quotation does not exceed
  **25% of the work** in which it's quoted and does not constitute **a complete book of the Bible**.
- For the same class of **non-saleable media** (bulletins, orders of service, screen projections
  explicitly named), **a complete copyright notice is not required** — only the initials **"(NLT)"**
  need appear at the end of each quotation.
- Structurally near-identical to the ESV terms: both publishers use the "500 verses / percentage-of-
  work cap / initials-only for non-saleable media" formula, which is itself the standard shape most
  major modern-translation publishers (Zondervan/NIV, Lockman/NASB, etc.) use, though this research did
  not independently verify those other publishers' exact figures since only ESV and NLT are in scope.

**Practical implication for the feature**: WorshipPlanner should **auto-append the translation
initials — "(ESV)" or "(NLT)" — to every scripture slide/reference it renders**, sourced from whichever
translation is selected in Settings. This satisfies both publishers' non-saleable-media attribution
requirement with a single, simple, always-on rule, and needs no user-facing "did you remember
attribution" step — it should be baked into the scripture-rendering pipeline itself (both the existing
scripture slide feature and the new congregational-reading feature, item 1, since both display quoted
translation text). No verse-count enforcement is needed at WorshipPlanner's scale (a single service's
scripture selection is always far under the 500-verse/half-book/25% thresholds), so this is purely an
attribution-string requirement, not a content-limiting one.

**Distinct from CCLI**: worth flagging explicitly since the two are easy to conflate — **CCLI licensing
governs song lyrics** (music copyright), not scripture. CCLI's display requirement (song title +
composer + copyright holder + the *church's own* CCLI license number, shown at least once during the
song's performance) is a separate compliance domain WorshipPlanner already isn't handling as scripture
attribution, and shouldn't be — scripture translation attribution is governed by the Bible publisher's
own permissions terms (above), not by CCLI at all.

### Table stakes vs differentiator

**Table stakes** for both the translation-selection UI (matches every comparable tool) and the
attribution string (a compliance floor, not a nice-to-have — omitting it is a real, if low-risk,
copyright exposure the same way the shipped app already treats CCLI-detection-on-paste as a
must-have for song lyrics).

### Complexity: LOW

Settings toggle (ESV/NLT) plus a one-line attribution-string append in the scripture-rendering path;
the harder work (NLT API proxy via Cloud Function) is already scoped as straightforward per PROJECT.md
("Key is already in hand... joins ESV_API_KEY... proxies through the same Cloud Function pattern").

### Dependency

Depends on the existing ESV Cloud Function proxy pattern (to be mirrored for NLT) and touches both the
existing scripture-slide rendering path and the new congregational-reading feature (item 1) — both
need the attribution suffix, so the attribution-string logic should be built once, shared by both.

---

## Feature Dependencies

```
[3: Default service template]
    └──requires──> [5: Announcements/Misc item types finalized]
                       (template editor needs the final item-type palette to offer)

[1: Congregational reading divider]
    └──enhances-from──> [2: AI toggle] (AI-seed path is gated by, not required by, the divider)
    └──requires──> [8: Bible translation selection] (divider operates on already-fetched ESV/NLT text)
    └──enhances──> existing slide-group model (each labeled segment = one slide)

[8: Bible translation selection]
    └──shares-logic-with──> [1: Congregational reading divider]
                       (attribution-string append needed in both scripture render paths)

[4: Global slide typography]
    └──independent-of──> all others, but should land before or alongside [1]
                       (congregational-reading slide preview should reflect real typography)

[6: Stable share links]
    └──independent──> bug-fix-shaped, no dependency on new v1.5 features

[7: Multi-image import ordering]
    └──independent──> bug-fix-shaped, no dependency on new v1.5 features

[2: AI toggle]
    └──gates──> existing AI song suggestions, existing AI scripture discovery,
                the AI-seed path in [1]
```

### Dependency Notes

- **[3] requires [5]:** The default-template editor lets an org define which item types appear in a
  blank service, in what order, with what default titles — it needs the finalized item-type set
  (Announcements, Miscellaneous, simplified Message, Hymn removed) to exist first, or the template
  editor's own UI churns mid-milestone.
- **[1] requires [8]:** The divider operates on scripture text; that text has to come from a selected
  translation (ESV or NLT) before it can be divided, and both text and attribution need to already
  reflect whichever translation is active in Settings.
- **[1] shares logic with [8]:** the "(ESV)"/"(NLT)" attribution suffix is a single piece of shared
  logic both the plain scripture-slide path and the new congregational-reading path need — build it
  once in the scripture-rendering layer, not twice.
- **[2] gates but does not block [1]:** the divider must work fully with AI off (manual + alternating-
  seed paths), so [1] is not blocked waiting on [2], but [1]'s AI-seed entry point must respect [2]'s
  toggle from day one, not as a follow-up patch.
- **[6] and [7] are the two fully independent, low-risk items** — both are diagnosed, root-caused
  bug-fix-shaped work on existing systems with no new-feature dependencies, and are good candidates
  for an early phase to build roadmap momentum before tackling [1]'s UI-research-heavy work.

---

## MVP Definition

Since this is a milestone within a shipped product (not a 0-to-1 MVP), "Launch With" below means
**what must ship in v1.5** per the already-locked requirements list in PROJECT.md, not a hypothetical
smaller cut.

### Launch With (v1.5)

- [ ] AI toggle gating all three existing AI surfaces — table stakes, low complexity, unblocks the
  "off means off" promise the milestone is built around
- [ ] Planning Center integration toggle — same shape as AI toggle, low complexity
- [ ] ESV/NLT selection with correct attribution suffix — table stakes, compliance floor
- [ ] Stable share links (persist token, auto-refresh snapshot) — diagnosed defect, must fix
- [ ] Announcements/Miscellaneous item types, simplified Message, Hymn removed from palette — table
  stakes, low complexity, blocks the template feature
- [ ] Default service template (single org template, item type + default title granularity) —
  table stakes given WorshipPlanner already generates a standard order; the gap is configurability
- [ ] Congregational reading manual divider — the priority feature; owner-mandated UI research phase
- [ ] Global slide typography (family + weight + size, curated fonts) — table stakes for a
  presentation tool exposing house style; **recommend the roadmapper confirm with the owner whether
  outline/shadow belongs in this milestone's scope**, since it's a near-universal companion setting in
  every comparable tool and directly interacts with the already-shipped background-image feature
- [ ] Multi-image natural-sort ordering — diagnosed defect, must fix, low complexity

### Add After Validation (post-v1.5)

- [ ] Text outline/shadow/alignment/line-height as additional global typography axes, if not folded
  into this milestone — trigger: legibility complaints against background-image slides once family/
  weight/size ships alone
- [ ] Per-item duration in the service template (Planning Center has this; v1.5 scope doesn't call for
  it) — trigger: owner wants rehearsal timing estimates from the template

### Future Consideration (v2+)

- [ ] Multiple named service templates (vs. the single org template v1.5 scopes) — defer until/unless
  the org runs more than one structurally distinct regular service pattern
- [ ] Safe-area margin guides for typography — defer unless streaming/recording (not just in-room
  projection) becomes an active use case
- [ ] Select-text-then-label free-range divider mode for congregational readings (pattern (e) above) —
  defer; verse/sentence-snapped dividers cover the real-world responsive-reading shape observed in
  hymnal/bulletin conventions

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| AI toggle | HIGH | LOW | P1 |
| Planning Center toggle | MEDIUM | LOW | P1 |
| ESV/NLT selection + attribution | HIGH | LOW | P1 |
| Stable share links | HIGH | LOW-MEDIUM | P1 |
| Announcements/Misc items, Message/Hymn changes | MEDIUM | LOW | P1 |
| Default service template | HIGH | MEDIUM | P1 |
| Congregational reading manual divider | HIGH | MEDIUM | P1 |
| Global slide typography (family/weight/size) | HIGH | LOW-MEDIUM | P1 |
| Global slide typography (outline/shadow/alignment) | MEDIUM-HIGH | LOW-MEDIUM | P2 |
| Multi-image natural-sort ordering | MEDIUM | LOW | P1 |
| Per-item template durations | LOW-MEDIUM | LOW | P3 |
| Multiple named templates | LOW | MEDIUM | P3 |
| Safe-area margin guides | LOW | LOW | P3 |

**Priority key:**
- P1: In the locked v1.5 requirement list
- P2: Adjacent gap worth flagging to the owner during roadmap/requirements definition
- P3: Explicitly deferred, future consideration

## Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Free-range select-text-then-label divider (pattern e) | "Maximum flexibility" appeal, common in generic annotation tools | Real responsive readings never break mid-sentence; the extra freedom buys interaction complexity (range-selection model, overlap handling) with no matching real-world need | Verse/sentence-snapped divider (pattern a) + per-segment label control (pattern c) |
| Drag-handle dividers (pattern b) | Feels "modern," matches timeline-editor intuitions from video/audio tools | Text has no continuous dimension to drag along; breaks are discrete (verse/sentence), so drag implies false precision and risks accidental-drag mobile failures | Click-to-insert/remove divider at discrete points |
| Greyed-out AI controls when the toggle is off | Seems like clear "this exists but is off" signaling | Repeated discovery-and-disappointment clicks; worse UX than either working or not existing | Hide the AI entry point entirely when the org toggle is off; keep the manual equivalent (e.g., item 1's manual divider) fully functional |
| Runtime Google Fonts API for typography | Bigger font catalog, "just works" for font selection | A projector without internet at service time can't fetch a remote font — already rejected in milestone scoping for exactly this reason | Curated self-hosted woff2 catalog (already decided) |
| Verse-count/attribution enforcement UI (blocking a user from quoting "too much") | Seems like responsible compliance tooling | WorshipPlanner's actual usage (single-service scripture selections) never approaches the 500-verse/25%/half-book thresholds either license defines — building enforcement solves a problem that doesn't occur in practice | Auto-append the "(ESV)"/"(NLT)" attribution suffix unconditionally; no gating needed |
| Multiple named service templates in v1.5 | Matches Planning Center's fuller model | The milestone's own scoping already decided on one org template; multiple templates adds real UI (template picker, template management) for a need not yet demonstrated | Single org template now; revisit if the church ever runs two structurally distinct regular services |

## Sources

**Official/primary (higher confidence):**
- [ESV Permissions — Crossway](https://www.crossway.org/permissions/) — direct license text for verse-count limits and non-saleable-media attribution
- [NLT Bible Notices — thebible.org](https://thebible.org/gt/notices/nlt.html) and [NLT Copyright Statement — StudyLight.org](https://www.studylight.org/site-resources/copyright-statements/eng/nlt.html) — Tyndale's standard NLT copyright/permission notice
- [Set up plan templates — Planning Center](https://help.planningcenter.com/en/139469-set-up-plan-templates.html) and [Manage service type settings](https://help.planningcenter.com/en/142848-manage-service-type-settings.html)
- [Set up the service order — Planning Center](https://help.planningcenter.com/en/139467-set-up-the-service-order.html) — Item/Header/Song/Media item-type model
- [Share your plan — Planning Center](https://help.planningcenter.com/en/139461-share-your-plan.html) — public-view toggle and permalink concept
- [Guide to Using Themes in ProPresenter](https://support.renewedvision.com/hc/en-us/articles/34551484745875-Guide-to-Using-Themes-in-ProPresenter) and [Themes in ProPresenter](https://support.renewedvision.com/hc/en-us/articles/11910559859603-Themes-in-ProPresenter) — global theme font/style controls (family, size, line spacing, stroke, shadow)
- [Natural sort order — Wikipedia](https://en.wikipedia.org/wiki/Natural_sort_order); [Sorting for Humans: Natural Sort Order — Coding Horror](https://blog.codinghorror.com/sorting-for-humans-natural-sort-order/); [PowerShell natural-sort issue #12931](https://github.com/PowerShell/PowerShell/issues/12931) — confirms the slide2/slide10 lexicographic-vs-natural failure mode

**Secondary/community (lower confidence, used for pattern corroboration, flagged inline above):**
- [Responsive reading — Wikipedia](https://en.wikipedia.org/wiki/Responsive_reading)
- [Spoken Worship: Congregational Readings (part 1) — Worship Resources International](https://worship-resources.org/2015/07/31/spoken-worship-congregational-readings-part-1/) — Leader/People/All labeling and refrain-based structuring
- [The Power of Responsive Readings](https://pointtolife.wordpress.com/2023/02/06/the-power-of-responsive-readings/) and [A Worship Stylesheet](https://acollectionofprayers.com/2020/01/29/a-worship-stylesheet/) — bold-vs-italic typographic convention for leader/congregation parts in print
- [Smartcat Subtitle Editor guide](https://help.smartcat.com/subtitle-editor-complete-guide/), [Kapwing speaker labels](https://www.kapwing.com/help/using-speaker-label-on-subtitles/), [Subtitle Edit split-cue forum thread](https://forum.videohelp.com/threads/404276-Split-a-line-into-two-using-Subtitle-Edit) — the split-and-label interaction pattern used as the primary analog for item 1
- [Prodigy span-categorization docs](https://prodi.gy/docs/span-categorization), [Label Studio labeling guide](https://labelstud.io/guide/labeling.html) — select-then-label pattern, evaluated and rejected for this use case
- [ProPresenter: The Complete Guide for Worship Teams — Ruah Creative House](https://www.ruahcreativehouse.org/blog/propresenter-guide/) and [Comparing the Best Bible Presentation Software in 2024 — Renewed Vision](https://www.renewedvision.com/blog/comparing-the-best-bible-presentation-software-in-2024) — translation-count context, no responsive-reading-editor precedent found
- [How to Properly Display Copyright Notices (for CCLI License Holders) — Musicademy](https://www.musicademy.com/blog/how-to-properly-display-copyright-notices-for-ccli-license-holders/) — CCLI song-copyright display distinct from scripture-translation attribution
- [Proclaim Features — Logos](https://proclaim.logos.com/features) — template and order-of-service framing, no dedicated responsive-reading editor found
- General SaaS AI-toggle UX pattern research (multiple sources, no single authoritative citation — synthesized from common self-service-privacy-toggle patterns surfaced across vendor docs)

---
*Feature research for: church worship-planning / presentation software (v1.5 milestone scope)*
*Researched: 2026-08-06*
