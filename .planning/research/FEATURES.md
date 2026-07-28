# Feature Research: Service Lifecycle, Save Feedback, Post-Service, Responsive Readings, CCLI Display, Backgrounds, Contextual Action Bars

**Domain:** Worship service planning / presentation software (v1.4 "Service and Slides" — additions to an already-shipped app)
**Researched:** 2026-07-28
**Confidence:** MEDIUM (websearch-only sourcing throughout; cross-checked findings upgraded to MEDIUM per `classify-confidence --verified`; no HIGH-tier/curated-doc provider was available this run — treat as directionally solid, not primary-source-verified. CCLI section specifically flags where I could not reach CCLI's own site content.)

This research is scoped tightly to the seven questions in the v1.4 milestone brief, compared against **ProPresenter, EasyWorship, Proclaim (Faithlife), Planning Center Services, FreeShow, Quelea, OpenLP**, plus general SaaS patterns (Google Docs, Notion, Linear, Figma) and Adobe Spectrum/toolbar conventions. Already-built WorshipPlanner features (song stable, 9-slot service order, slide groups, PPTX import, etc.) are treated as prior art and not re-researched.

---

## 1. Locked / read-only service states

**Finding:** None of the dedicated worship-planning products surfaced a documented "hard lock" mechanic comparable to what v1.4 specifies (state machine: Draft → planned/exported → locked, with explicit Reopen). This is a genuine gap in the competitive set, not a solved problem to copy.

- **Planning Center Services** (the closest analog, and the tool this app explicitly complements) uses **role-based permissions**, not date- or status-based locking. Roles are Scheduled viewer / Viewer / Scheduler / Editor / Administrator, applied per-folder or per-plan; there is no evidence in PC's own help docs of an automatic "plan is finalized, now read-only" state tied to the service date passing or the plan being sent/exported. Editing capability is purely a function of who you are, not what state the plan is in. Source: [Permissions in Services — Planning Center Help](https://help.planningcenter.com/en/136863-permissions-in-services.html) (MEDIUM confidence, could not confirm a locking mechanic exists at all, which is itself informative — WorshipPlanner's status-based lock is *not* table stakes copied from PC, it's a deliberate improvement over PC's model).
- **ProPresenter / EasyWorship / Proclaim** are presentation tools, not planning-workflow tools with a draft/final concept — they don't have a "lock the plan" state at all; the file is just open or not. No useful analog here.
- **General SaaS convention** for "this is final, stop casually editing it" is overwhelmingly a **soft state + explicit unlock affordance**, not a hard technical lock that blocks all writes at the database layer: e.g., a CMS "Published" post that can still be edited (with a "this is live" banner), a Linear "Done" issue that can still be reopened, a Google Doc that can be set read-only via sharing permissions but any editor can flip it back. The pattern is: (a) visually distinct locked state (banner/badge), (b) a single, low-friction, named action to leave that state ("Reopen for editing" / "Unpublish" / "Reopen issue"), (c) usually **no separate approval gate** — whoever has edit permission on the object can reopen it, there isn't a second "unlock" permission tier in comparably-sized tools.
- **"Already sent downstream" warning:** this is the one place a real convention exists and matches the milestone's intent — CMS/e-commerce tools commonly interrupt the unlock/reopen action with a confirmation dialog when the object has already propagated somewhere (e.g., "This invoice has already been sent to the customer — editing it won't update their copy"). The warning is contextual and only appears when the downstream condition is true; it does not block the action, it just makes the consequence explicit before the click completes.
- **Audit trail:** no comparable worship tool documents a "who reopened this" audit log as a feature. Given the team size (2–3 planners) stated in PROJECT.md, a full audit trail is disproportionate — a lightweight "last reopened by X at HH:MM" surfaced in the UI (not a separate audit screen) matches the scale of similarly-sized tools and the milestone's own "Reopen for editing" language.

**Verdict for requirements:** Table stakes = state-scoped editability (Draft editable, everything else locked) + a single explicit reopen action available to editors, with a conditional warning when export already happened. Anti-feature = a formal audit-log screen, an approval workflow for reopening, or a hard DB-level write-lock that can't be reversed by the same role that created the plan — none of these have precedent in any tool in this comparison set and they would over-engineer a 2–3 person team's workflow.

## 2. Save feedback

**Finding:** Strong, consistent convention across best-in-class web apps — this is one of the most standardized patterns in the whole research set.

- **Persistent inline status, not a toast, for success.** Google Docs shows "Saving..." → "All changes saved in Drive" in the title/header area, always visible, never a toast. Notion and Linear follow the same shape: a small status string anchored near the content being edited (title bar / top of the editing surface), cycling between a transient "Saving…" state and a settled "Saved" state, frequently with a timestamp. Source: [Autosave design pattern — ui-patterns.com](https://ui-patterns.com/patterns/autosave), [Saving — Primer (GitHub's design system)](https://primer.style/product/ui-patterns/saving/) (MEDIUM confidence, cross-checked across two independent pattern-library sources).
- **Placement:** anchored to the content being edited, not to a global app chrome location disconnected from context — this directly validates the milestone's own decision ("persistent inline status indicator anchored to the content being edited"). A floating global toast for every successful autosave is explicitly called out as an anti-pattern by these sources because at typical debounce intervals (300–800ms) it becomes constant visual noise.
- **Failure is the one case that should interrupt.** The consistent convention: reserve toast/banner interruption for the failure case specifically, because that's the one state the user cannot infer from the absence of a "Saved" label and *must* be told about (silent data loss is the worst outcome). This matches the milestone decision exactly ("toast reserved for save failures").
- **Design nuance not to skip:** sources warn against ambiguity between "this field's autosave status" and "this field's validation status" — don't reuse the same visual language (e.g., a green checkmark) for both, or users will misread a validation pass as a save confirmation or vice versa. Also: don't mix autosave-implicit UI and explicit-Save-button UI on the same screen/tab — pick one model per surface.
- **Timestamp granularity:** "Saved HH:MM" (as specified in the milestone) matches Google Docs' pattern of showing a relative-then-absolute save time; this is well-trodden and not a design risk.

**Verdict for requirements:** Table stakes = persistent inline "Saving… / Saved HH:MM" near the edited content, toast-only-on-failure. This is not a novel pattern to validate — it's the industry default. Low complexity, no dependency on other v1.4 features beyond fixing the underlying autosave trigger bug (song-change not firing autosave) which is a prerequisite, not a UI question.

## 3. Post-service / exit content

**Finding:** Yes, this is a well-established formal concept in dedicated worship presentation software, but it is a **presentation-time (live) feature**, not historically a **plan/data-model** feature — which matters for scoping how much the new "Post-Service" *section* in the service order/slides model needs to do.

- **ProPresenter** has a mature "Announcement Loop" feature: a sequence of slides/graphics/videos strung together with **per-slide auto-advance timers** ("Go to Next Timer," configurable duration per slide) that cycles automatically and loops back to the start — used for pre-service and can equally be used post-service while people exit. Countdown timers are a related but separate primitive (a Timer object + a Theme that formats it + a Message that displays it on audience screens), commonly chained right before service start. Sources: [Announcement Loops in ProPresenter 7 — Renewed Vision](https://www.renewedvision.com/tutorials/announcement-loops-in-propresenter-7), [Setting up Timers in ProPresenter 7](https://support.renewedvision.com/hc/en-us/articles/360050782494-Setting-up-Timers-in-ProPresenter-7).
- **EasyWorship** supports the same shape via its "message alert" feature: an announcement video loop pre-service that switches to a countdown clock N minutes before start (commonly 5). Source: [Adding a countdown clock to announcements — EasyWorship support](https://support.easyworship.com/support/discussions/topics/24000019095).
- **FreeShow** documents the equivalent for stage displays (lyrics + timers + countdowns synced for the team), with a noted limitation that video-based countdowns can't be conditionally hidden based on playback state. Source: [FreeShow Setup Part 3: Stage Display and Timer Setup](https://www.garrybjr.com/blog/freeshow-setup-pt3).
- **What's universal across all of them:** auto-advance per slide (a duration, not a manual click), looping back to slide 1 after the last slide, and this behavior living entirely in the *presentation/live* layer, not the plan-authoring layer. None of these tools model "pre-service loop" or "post-service loop" as a first-class planning artifact with its own settings screen in the *plan* — it's assembled as an ordinary slide group/playlist and the auto-advance/loop behavior is a presentation-mode property of that group, not of the service plan record.

**Implication for scope:** the milestone's "Post-Service section" requirement, per PROJECT.md, is explicitly just **structural** — a fifth fixed section in the service order and slide plan rail (Pre-Service → Worship → Message → Sending → Post-Service), not a live-countdown/auto-loop engine. That's the right scope: WorshipPlanner has no live presentation *playback* surface for timers today (Present mode shows a slide at a time), and building auto-advance-with-loop timers would be new infrastructure with no anchor in the current feature set or explicit ask. Treat "auto-advance/loop while exiting" as an **anti-feature for v1.4** — it's a real, well-established convention in dedicated presentation tools (so it's not made up), but it's out of proportion to what the milestone actually asks for (a section existing, slides assignable to it, copyright/labels behaving correctly there) and duplicates functionality ProPresenter/EasyWorship/FreeShow already own at the live-presentation layer, which is explicitly Out of Scope per PROJECT.md ("ProPresenter integration — plans are created here, ProPresenter is managed separately"). Recommend: Post-Service section behaves exactly like the other four sections (ordinary slide group membership, ordinary Present-mode single-slide advance) — no new timer/loop primitive.

## 4. Congregational / responsive reading

**Finding:** This is a real, named, well-established liturgical and software feature with consistent typographic convention — the concrete pattern needed for a split-generation prompt is derivable, though sourcing on exact break-granularity is mixed and I flag the parts that are convention vs certainty.

- **What it's called and how it's used:** "Responsive reading" — a leader reads a portion, the congregation reads the alternating portion, back and forth through the passage. Source: [Responsive reading — Wikipedia](https://en.wikipedia.org/wiki/Responsive_reading), [Responsive Readings in Worship — theexoduschurch.org] (MEDIUM confidence; general/encyclopedic, cross-checked across two sources).
- **Software support:** MediaShout has a first-class feature called **"Liturgies"** — described as "a new kind of Cue that creates what many churches call a responsive reading, where the leader and congregation read scripture together out loud," with both pre-built liturgies and custom-authoring support. This is the clearest evidence a comparable presentation tool treats this as a distinct content type, not just manually-bolded lyric slides. Source: [7 Tips for Using Software to Display Worship Lyrics Clearly — MediaShout](https://mediashout.com/software-to-display-worship-lyrics-7-tips/).
- **Typographic convention:** the congregation's spoken portion is shown in **bold** text (sometimes with underline as an alternative/additional marker) directly in the displayed passage — "Churches display the Words of Scripture on their screen and underline the congregational portion" — while the leader's portion and any unison portion use plain weight. This is consistent enough across sources to treat as a hard convention: **bold = congregation, plain/unstyled = leader, and unison lines get a third, usually distinct treatment (often italics or a full-bold-for-everyone marker) so a leader glancing at the slide never has to guess who speaks next.**
- **How a passage is conventionally split — the part that most directly informs the LLM-prompt requirement:** Sources describe splitting at **verse or half-verse boundaries that follow the natural grammatical/thought unit of the text**, not by a fixed line-count or arbitrary sentence chop. The clearest documented example: Psalm 136, where "the first half of each verse states something about God and His works, and the second half repeats the phrase 'His love endures forever'" — the reader takes the first half, the congregation the recurring refrain, split exactly at the existing verse's internal clause boundary. Another documented example splits by full verse ranges — Psalm 103:8–14 with verses 11–12 underlined as the congregational portion — meaning **the split unit is sometimes a clause within a verse, sometimes a full verse or verse-range**, and the correct choice depends on where the passage naturally has a call/response or declarative/refrain structure, not a mechanical rule. Sources: [Have You Thought about Writing Responsive Readings? — Adventures with God](https://adventureswithgod.blog/2018/06/10/have-you-thought-about-writing-responsive-readings/), [Responsive Bible Readings for Missions — snuhome.org], MediaShout tips page above.
- **What makes a split "good" vs "bad" to a worship leader (synthesized from the above, MEDIUM confidence — this is inference from convention, not a single authoritative source):** good splits (a) never break a sentence or clause mid-thought across the leader/congregation boundary, (b) follow structure the text already has when the passage has one (refrains, parallelism, antiphonal Psalms), (c) keep each speaking turn short enough to read aloud comfortably in one breath/slide, (d) alternate roughly evenly rather than giving the leader nine lines and the congregation one. Bad splits mechanically chop by character/line count without regard to grammar, split a single sentence's subject from its verb across turns, or force the congregation to read a fragment that doesn't parse as a complete thought on its own.

**Concrete guidance for the LLM-prompt requirement (REQ: "LLM-assisted congregational reading splits"):** the prompt should instruct the model to (1) identify natural call/response, refrain, or parallel structure in the passage first and split along it if present (e.g., recurring closing phrases, alternating declarative/response verse halves); (2) otherwise default to splitting by whole verse or verse-range, never mid-sentence; (3) mark each resulting segment with a role (`leader` / `congregation` / `unison`) rather than emitting free text with embedded bold markup, so the app controls the bold/plain typography deterministically rather than trusting model-generated formatting; (4) keep unison explicitly available as a third role since many responsive readings end in a shared closing line/doxology.

## 5. Copyright / CCLI display — SOURCED, READ CAREFULLY

**This directly contradicts the milestone's stated hard requirement, and the requirements team needs to see that gap explicitly before locking REQ acceptance criteria.**

- **What I found, cross-checked across two independent secondary sources plus a CCLI FAQ page fetch attempt:**
  - CCLI's Church Copyright License requires copyright/attribution information to be included on **each printed or projected song copy**, but for a **multi-slide song projection, the information only needs to appear once per song** — not on every slide.
  - Convention on *where* that single appearance goes is **"at the beginning or end,"** with more specific guidance from one source that it is **"typically placed on the last lyric slide, at the bottom of the screen."**
  - Required content: song title, writer credit(s), copyright notice with year and copyright holder, "Used By Permission," and **the church's own CCLI license number** (explicitly *not* the song's internal CCLI song ID — a common point of confusion the sources flag). Example format given: `"Hallelujah" words and music by John Doe © 2018 Good Music Co. Used by Permission. CCLI License #12345`.
  - Recommended styling: small font, neutral/muted color, sometimes shown only briefly, specifically so it doesn't distract from worship — but it must still be present and legible, not hidden.
  - For medleys, ownership info must accompany **each** song within the medley (relevant to WorshipPlanner's per-song-group slide model — each song group needs its own copyright appearance, which the milestone's per-group requirement already gets right).
  - Sources: [How to Properly Display Copyright Notices (for CCLI License Holders) — Musicademy](https://www.musicademy.com/blog/how-to-properly-display-copyright-notices-for-ccli-license-holders/), [The Right Way To Display CCLI License Information On Worship Lyric Slides — Church Motion Graphics](https://www.churchmotiongraphics.com/blog/the-right-way-to-display-ccli-license-information-on-worship-lyric-slides/), [In Layman's Terms: Displaying song copyright information — Great Plains UMC](https://www.greatplainsumc.org/blogdetail/in-laymans-terms-displaying-song-copyright-information-12807560). Confidence: **MEDIUM** (two independent secondary sources agree closely; I was unable to load CCLI's own site content directly — `ccli.com/us/en/5-questions` and `ccli.com/us/en/copyright-licensing` both returned only general marketing copy with no slide-placement specifics when fetched, and a third page returned HTTP 403). **This is not a HIGH-confidence primary-source citation** — I recommend the requirements team (or a phase-specific researcher before Phase build) attempt to pull CCLI's actual license agreement PDF/terms text directly, since that is the binding document, not these interpretive blog posts.
  - Distinct and worth flagging: **CVLI (the companion video license) requires NO copyright display at all** — don't conflate the two licenses if WorshipPlanner ever touches media/video attribution.

- **The gap:** the real-world/legally-required convention is **"once per song, typically on the last slide"** — not "first AND last slide of every song group" as PROJECT.md states as a hard v1.4 requirement. Nothing in the sourced material describes a first-slide requirement as standard practice, and no comparable software (ProPresenter, EasyWorship, MediaShout) was found to default to showing it twice.
- **This doesn't mean the milestone requirement is wrong** — showing it on both the first and last slide is a **defensible, stricter-than-minimum choice**: it protects against the two realistic failure modes in live worship (presenter starts the song mid-deck because of a last-second reorder, or the last slide gets skipped/cut short because the song ends early) either of which would silently drop the notice below the "at least once" legal floor if it only lived on one slide. That's a legitimate engineering-for-reality rationale, but it should be **stated as WorshipPlanner's own compliance-margin decision**, not attributed to CCLI's rule — the acceptance criterion is correct to keep, but the *justification* documented against it (e.g. in REQUIREMENTS.md or a phase SPEC) should say "exceeds the legal minimum of 'once per song' for operational safety margin," not "CCLI requires first and last slide."

**Verdict for requirements:** Table stakes = copyright notice appears at least once per song group with correct content (title/writer/copyright holder+year/church CCLI number, not song ID). WorshipPlanner's stricter first-and-last placement is a legitimate differentiator/safety margin, correctly scoped as already-decided in PROJECT.md — just fix the citation language before it ships as "CCLI requires this."

## 6. Slide backgrounds

**Finding:** Group-level default with per-slide override is the standard, well-precedented model — this matches the milestone's "group, individual slide, and song" three-tier ask closely.

- **ProPresenter's model** (the closest reference implementation, since it's the dominant product in this space): backgrounds and foregrounds are distinct **layers** that behave independently, and background/foreground can be set at the **presentation level** (i.e., applies as a default across the whole slide set/group) with **individual slides able to turn their own background off or override it separately** — the documented example is explicitly about disabling a slide-level background to fall back to (or clear) the presentation-level one, confirming an inheritance-with-override model rather than every slide requiring its own independent setting. Sources: [What's the difference between Backgrounds and Foregrounds — Renewed Vision support](https://support.renewedvision.com/hc/en-us/articles/360011694154-What-s-the-difference-between-Backgrounds-and-Foregrounds-and-how-do-I-tell-which-one-a-media-file-is-set-to-), [Groups and Arrangements — ProPresenter 6 docs](https://learn.renewedvision.com/propresenter6/working-with-slides/groups-and-arrangements). Confidence: MEDIUM (support docs, not exhaustively detailed on the exact inheritance precedence rules).
- **Text legibility over image backgrounds:** the sourced convention is to keep background media/text layers separated so text remains legible — practically this is achieved via a scrim/overlay (darkening or blurring the image behind text) or by keeping background imagery low-contrast/low-detail in the text-safe zone. This is universal practice across presentation tools generally (Keynote, PowerPoint, Google Slides all have "backdrop" or overlay affordances for the same reason) — no tool in this set ships text directly on top of arbitrary high-contrast imagery without a legibility affordance.
- **Per-song backgrounds:** this is a normal concept and matches how WorshipPlanner already treats songs as canonical entities (per PROJECT.md's "song groups are read-only in Slides, editable only from Song Lyrics editor" decision) — setting the default background *from the song's canonical record* (Song Lyrics editor) is architecturally consistent with that existing decision rather than a new pattern; it's the same "canonical source, mirrored into service" model already chosen for lyrics/order.

**Recommended inheritance/override semantics for the requirements doc (synthesizing the above with WorshipPlanner's existing data model):**
1. **Song-level background** (set in Song Lyrics editor) = the song's own default, travels with the song wherever it's used.
2. **Group-level background** (set in Slides tab, for scripture/other non-song groups, or as an override for a song group in a specific service) = overrides the song default for that occurrence.
3. **Individual slide background** = overrides the group default for that one slide only.
Precedence: slide > group > song > (app default/none). This is a standard three-tier CSS-like cascade, low-to-medium complexity to implement given the data model already separates song/group/slide entities, and it directly depends on the already-decided "song is canonical" architecture (Key Decision in PROJECT.md) — background-setting UI in the Song Lyrics editor is a new surface but the storage/override logic is a natural extension, not new infrastructure.

## 7. Contextual action bars

**Finding:** Standard, well-documented UI pattern — "contextual toolbar" / "contextual action bar" — with a specific, named failure mode the milestone brief is explicitly guarding against.

- **The pattern:** a toolbar whose contents change based on the active context (which tab/view is open, what's selected) rather than a single static global toolbar trying to hold every action for every screen. Adobe Spectrum's "Action Bar" and the general "contextual toolbar" pattern (seen across Office ribbon "contextual tabs," e.g. a Table tab that only appears when a table is selected) are the reference implementations. Sources: [Action bar — Spectrum, Adobe's design system](https://spectrum.adobe.com/page/action-bar/), [Toolbar UI Design — Mobbin](https://mobbin.com/glossary/toolbar). Confidence: MEDIUM (design-system documentation, general UX pattern libraries — not product-specific to worship software, but this question is generic UI pattern, not domain-specific, so that's appropriate sourcing).
- **What belongs in a global bar vs. a tab-scoped bar:** convention is to keep the global bar limited to app-level/cross-cutting actions (navigation, account, save-state indicator, print/share if truly global) and put anything specific to "what can I do with the content of *this* tab right now" in a bar that's visually anchored to that tab's content area. Sources describe limiting contextual actions to roughly five or fewer visible at once, with overflow into a menu for anything beyond that, to avoid the bar itself becoming cluttered.
- **The specific failure mode this guards against (and the one the milestone explicitly calls out — moving Add Slide/Add Music into a contextual bar, auditing every tabbed screen):** actions "vanishing where users expect them" happens when (a) an action that used to live in a predictable global location gets scoped to a tab without a consistent placement convention across tabs, so users have to relearn where to look on each screen, or (b) a contextual action is hidden behind a selection state (e.g., only appears once something is selected) with no affordance hinting it exists before that selection happens. The documented mitigation is **consistency of placement across all tab-scoped bars** (same screen position, same visual treatment, every tab) plus **always-visible primary actions** for that tab (e.g., "Add Slide" should be a persistently visible button on the Slides tab, not one that only appears after selecting something) — reserving the "only appears on selection" treatment strictly for bulk/multi-select actions (delete, tag, export selected), which is the documented convention for when a selection-gated toolbar is appropriate.

**Verdict for requirements:** Table stakes = one consistent contextual-action-bar placement pattern applied to every tabbed screen (Service Order, Slides, Roles, Song Lyrics), with each tab's primary actions (Add Slide, Add Music, etc.) always visible on that tab rather than selection-gated. Selection-gated bulk actions (if any) are a legitimate secondary pattern layered on top, not a replacement for the primary bar. Low-to-medium complexity — this is a design-system/component-consistency effort across already-existing screens, not new functionality; it depends on the Slides tab rework and Service Order rework already underway in this milestone providing a shared bar component to standardize on.

---

## Feature Landscape Summary

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Draft-only editing with state-scoped lock on Service Order/Slides/Roles | Prevents desync between what's planned and what's already been communicated/exported (no direct competitor precedent, but this is the standard SaaS "final state" convention) | MEDIUM | Depends on new service-status field; no existing analog in Planning Center to copy from — WorshipPlanner is improving on PC's permission-only model |
| Explicit "Reopen for editing" affordance, editor-accessible, with export-aware warning | Matches general SaaS unlock convention (single low-friction action, not an approval workflow) | LOW–MEDIUM | Warning is conditional on "already exported" state, which already exists in the data model per PROJECT.md |
| Persistent inline "Saving… / Saved HH:MM" status anchored to edited content | Universal convention (Google Docs, Notion, Linear, Primer/GitHub design system) | LOW | Fix underlying autosave trigger bug first (song-change not firing autosave) — that's the real blocker, not the UI |
| Toast reserved for save failures only | Matches convention exactly; avoids toast fatigue at typical debounce intervals | LOW | — |
| Copyright/CCLI notice present at least once per song group with correct content (title/writer/copyright holder+year/church license #, not song ID) | Legal requirement under CCLI Church Copyright License | LOW–MEDIUM | See §5 — the "once per song" floor is the actual legal rule; WorshipPlanner's first+last placement exceeds it deliberately |
| Group-level background with per-slide override | Standard in ProPresenter; matches existing WorshipPlanner slide-group model | MEDIUM | Depends on existing slide-group/slide data model (already built in v1.2/v1.3) |
| Consistent contextual action bar per tab, primary actions always visible (not selection-gated) | Prevents the "actions vanish" failure mode named in the milestone brief | MEDIUM | Depends on Slides tab rework and Service Order rework (both already in this milestone's scope) providing a shared bar component |
| Post-Service as a structural fifth section (ordinary slide-group membership, no new timer engine) | Matches how dedicated tools (ProPresenter/EasyWorship/FreeShow) scope loop/countdown features to the live-presentation layer, not the plan layer | LOW | WorshipPlanner has no live-timer presentation surface today — don't build one to satisfy this |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Song-level background set once from the canonical Song Lyrics editor, inherited by every service occurrence | No competitor product surfaced treats "song" as a canonical entity with its own default background inherited across services — this follows directly from WorshipPlanner's existing "song is canonical, slides mirror it" architecture (already a Key Decision in PROJECT.md) | MEDIUM | Depends on song-groups-are-read-only-in-Slides decision already made |
| LLM-assisted responsive-reading split with role-tagged segments (leader/congregation/unison) rather than free-text with manual bold markup | MediaShout is the only competitor with anything comparable ("Liturgies"), and that's manual authoring, not LLM-assisted splitting — this is a genuine gap WorshipPlanner can fill, consistent with its existing AI-discovery differentiator | MEDIUM–HIGH | Prompt design should split on clause/verse/refrain structure first, fall back to whole-verse boundaries, never mid-sentence — see §4 for concrete prompt guidance |
| Compliance-margin CCLI placement (first AND last slide) stated explicitly as exceeding the legal "once per song" floor | Protects against real live-service failure modes (late start mid-deck, early-ended song) that a single-placement rule doesn't cover | LOW | Just needs correct internal documentation of *why* (operational safety, not legal mandate) — see §5 |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Full audit-log screen for who reopened/edited locked plans | Feels like "good governance" | No precedent in any comparably-scaled tool in this set; disproportionate for a 2–3 person planning team (per PROJECT.md team size constraint); adds a whole new data model and UI surface for a low-value edge case | A single "last reopened by X at HH:MM" line surfaced inline where the reopen action lives — covers the actual need (who touched this, when) without a dedicated audit UI |
| Live auto-advance/looping timer engine for pre/post-service content | ProPresenter/EasyWorship/FreeShow all have this, so it "seems missing" | It's a live-presentation-layer feature; WorshipPlanner has no live playback surface today (Present mode is single-slide, manual-advance), and building one duplicates functionality explicitly Out of Scope per PROJECT.md ("ProPresenter integration — plans are created here, ProPresenter is managed separately") | Post-Service is a structural section only; if the church wants a looping exit reel, that's ProPresenter/EasyWorship's job, consistent with the existing "complement, don't replace" architecture |
| Selection-gated primary tab actions (e.g., "Add Slide" only appears after selecting a slide) | Looks cleaner / less cluttered when empty | This is the exact "actions vanish where users expect them" failure mode the milestone brief calls out — users won't discover the action exists | Keep primary per-tab actions always visible in the contextual bar; reserve selection-gating strictly for bulk/multi-select operations |
| Approval workflow / second-role gate on reopening a locked plan | Feels safer for "important" finalized plans | No precedent in Planning Center or any tool surveyed at this team scale; adds friction and a second role concept not otherwise in WorshipPlanner's editor/viewer RBAC | Single-role reopen (any editor) + conditional export-aware warning dialog, matching the milestone's own stated decision |

## Feature Dependencies

```
Draft-only editable state (lock Service Order/Slides/Roles)
    └──requires──> Service status field (draft/planned/exported) [already exists per PROJECT.md]
                       └──requires──> Reopen-for-editing action, export-aware warning

Persistent inline save status
    └──requires──> Fixed autosave trigger bug (song-change not firing autosave) [prerequisite, not UI work]

Group/slide/song background cascade
    └──requires──> Existing slide-group + slide + song data model [already built, v1.2/v1.3]
    └──enhances──> Song-level background set in Song Lyrics editor [depends on "song is canonical" decision, already made]

LLM-assisted responsive reading split
    └──requires──> Scripture slide generation (already built)
    └──enhances──> Existing AI discovery feature (Claude integration, already built)

CCLI copyright first+last slide
    └──requires──> Slide-group model (already built)
    └──conflicts with──> "compile all copyrights and show once" pattern some smaller tools use — WorshipPlanner correctly keeps per-song-group placement

Contextual action bar consistency
    └──requires──> Slides tab rework (in this milestone) + Service Order tab rework (in this milestone) sharing one bar component

Post-Service section
    └──requires──> Fixed five-section service order structure (this milestone's drag-and-drop fix)
    └──conflicts with──> Building a live timer/loop engine (out of proportion to the actual ask, see anti-features)
```

### Dependency Notes

- **Persistent save status requires fixing the autosave trigger bug first:** the UI pattern itself is trivial (LOW complexity, well-precedented), but it's worthless if autosave doesn't actually fire on every field — sequence the bug fix before or alongside the indicator work, not after.
- **Song-level background enhances the group/slide cascade, but depends on the "song is canonical" architecture decision already logged in PROJECT.md** — this is not new architectural risk, it's applying an existing pattern to a new attribute (background instead of lyrics/order).
- **LLM-assisted responsive reading enhances but does not require the existing AI integration** — Claude is already wired in for song/scripture discovery; this is a new prompt/output shape on the same integration, not a new AI dependency.
- **Contextual action bar work conflicts with, i.e. should not be done independently of, the two tab reworks already scheduled this milestone** — building a bar component before Service Order/Slides finalize their layouts risks rework; sequence the shared-component design after or alongside those, not before.
- **Post-Service section conflicts with any temptation to build live-loop/timer functionality** — resist scope creep here even though it's a "real" feature in competitor products; it belongs to ProPresenter/EasyWorship per the existing "complement, don't replace" boundary.

## MVP Definition

Given this is a subsequent milestone on a shipped app (not greenfield MVP), "launch with" below means the v1.4 milestone scope as stated in PROJECT.md — not a hypothetical smaller cut.

### Launch With (v1.4)

- [ ] Draft-only editability + Reopen-for-editing with export-aware warning — core trust fix, explicitly named in milestone goal
- [ ] Fixed autosave bug + persistent inline save status (toast-on-failure-only) — core trust fix, explicitly named in milestone goal
- [ ] Post-Service as structural fifth section, ordinary slide-group behavior — completes the fixed five-section order
- [ ] Slide-group order/membership hard-locked to service order (no reconcile step) — removes the root cause of drift bugs
- [ ] Copyright on first AND last slide of every song group, org labels never shown when presenting — compliance-margin correctness
- [ ] Background image at group/slide/song tiers with correct cascade — matches milestone's explicit three-tier ask
- [ ] LLM-assisted congregational reading split (leader/congregation/unison, role-tagged) — matches milestone's explicit ask
- [ ] One consistent contextual action bar pattern audited across every tabbed screen — matches milestone's explicit ask

### Add After Validation (v1.x, not this milestone)

- [ ] Live auto-advance/loop timer for pre/post-service exit content — only if the team explicitly asks for it after seeing the Post-Service section ship as structural-only, and only if it doesn't duplicate ProPresenter/EasyWorship functionality already in use downstream
- [ ] Richer save-status detail (e.g., per-field save state rather than whole-screen) — only if the whole-screen indicator proves insufficient in practice

### Future Consideration (v2+)

- [ ] Full audit trail of plan status changes — defer until team size or compliance need grows beyond 2–3 planners
- [ ] Bulk/multi-select contextual actions layered on top of the per-tab bar — defer until the single-item action bar ships and a real bulk-edit need surfaces

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Draft-lock + reopen | HIGH | MEDIUM | P1 |
| Save reliability + inline status | HIGH | LOW | P1 |
| Slide/order mirroring (no reconcile) | HIGH | MEDIUM | P1 |
| Post-Service section (structural only) | MEDIUM | LOW | P1 |
| CCLI first+last slide, no org labels | HIGH (compliance) | LOW | P1 |
| Background cascade (group/slide/song) | MEDIUM | MEDIUM | P1 |
| LLM responsive-reading split | MEDIUM | MEDIUM–HIGH | P1 |
| Contextual action bar audit | MEDIUM | MEDIUM | P1 |
| Live loop/timer engine | LOW (out of scope) | HIGH | P3 (deferred/anti-feature) |
| Audit-log screen for reopen actions | LOW | MEDIUM | P3 (deferred) |

## Competitor Feature Analysis

| Feature | ProPresenter | Planning Center Services | MediaShout | WorshipPlanner v1.4 Approach |
|---------|--------------|---------------------------|------------|-------------------------------|
| Plan locking | N/A (no plan/draft concept, just files) | Role-based permissions only, no status-based lock found | N/A | Status-scoped lock (Draft editable, else locked) + explicit reopen — improves on PC's permission-only model |
| Save feedback | N/A (desktop app, not autosave-driven) | N/A (not researched, not the relevant comparator) | N/A | Persistent inline status, toast-on-failure — matches Google Docs/Notion/Linear convention |
| Pre/post-service content | Announcement Loop with per-slide auto-advance timer, live-layer feature | N/A | N/A | Structural section only, no live-loop engine (correctly scoped narrower than ProPresenter's live feature) |
| Responsive reading | No dedicated feature found | N/A | "Liturgies" — dedicated cue type, manually authored | LLM-assisted split with role tags — ahead of both |
| Copyright display | Manual, user sets it up per deck, no enforced placement rule found | N/A | Manual | Enforced first+last slide per song group — exceeds typical manual-only tooling |
| Background inheritance | Presentation-level default with slide-level override (layers) | N/A | N/A | Three-tier: song > group > slide, extends ProPresenter's two-tier model with a canonical-song tier |
| Contextual toolbars | Standard editor UI, not documented in depth | N/A | N/A | Consistent per-tab bar, always-visible primary actions — follows Adobe Spectrum/general design-system convention |

## Sources

- [Permissions in Services — Planning Center Help](https://help.planningcenter.com/en/136863-permissions-in-services.html) — MEDIUM
- [Autosave design pattern — ui-patterns.com](https://ui-patterns.com/patterns/autosave) — MEDIUM
- [Saving — Primer, GitHub's design system](https://primer.style/product/ui-patterns/saving/) — MEDIUM
- [Announcement Loops in ProPresenter 7 — Renewed Vision](https://www.renewedvision.com/tutorials/announcement-loops-in-propresenter-7) — MEDIUM
- [Setting up Timers in ProPresenter 7 — Renewed Vision](https://support.renewedvision.com/hc/en-us/articles/360050782494-Setting-up-Timers-in-ProPresenter-7) — MEDIUM
- [Adding a countdown clock to announcements — EasyWorship support](https://support.easyworship.com/support/discussions/topics/24000019095) — MEDIUM
- [FreeShow Setup Part 3: Stage Display and Timer Setup — garrybjr.com](https://www.garrybjr.com/blog/freeshow-setup-pt3) — MEDIUM
- [Responsive reading — Wikipedia](https://en.wikipedia.org/wiki/Responsive_reading) — MEDIUM
- [7 Tips for Using Software to Display Worship Lyrics Clearly — MediaShout](https://mediashout.com/software-to-display-worship-lyrics-7-tips/) — MEDIUM
- [Have You Thought about Writing Responsive Readings? — Adventures with God](https://adventureswithgod.blog/2018/06/10/have-you-thought-about-writing-responsive-readings/) — MEDIUM
- [How to Properly Display Copyright Notices (for CCLI License Holders) — Musicademy](https://www.musicademy.com/blog/how-to-properly-display-copyright-notices-for-ccli-license-holders/) — MEDIUM
- [The Right Way To Display CCLI License Information On Worship Lyric Slides — Church Motion Graphics](https://www.churchmotiongraphics.com/blog/the-right-way-to-display-ccli-license-information-on-worship-lyric-slides/) — MEDIUM
- [In Layman's Terms: Displaying song copyright information — Great Plains UMC](https://www.greatplainsumc.org/blogdetail/in-laymans-terms-displaying-song-copyright-information-12807560) — LOW (single-source claim not independently cross-checked)
- [CCLI — The 5 Questions We Hear The Most (US)](https://ccli.com/us/en/5-questions) — attempted, page returned only general marketing copy, no slide-placement specifics retrievable — **flagged as unresolved primary source, recommend follow-up before finalizing REQ acceptance criteria**
- [What's the difference between Backgrounds and Foregrounds — Renewed Vision support](https://support.renewedvision.com/hc/en-us/articles/360011694154-What-s-the-difference-between-Backgrounds-and-Foregrounds-and-how-do-I-tell-which-one-a-media-file-is-set-to-) — MEDIUM
- [Groups and Arrangements — ProPresenter 6 docs](https://learn.renewedvision.com/propresenter6/working-with-slides/groups-and-arrangements) — MEDIUM
- [Action bar — Spectrum, Adobe's design system](https://spectrum.adobe.com/page/action-bar/) — MEDIUM
- [Toolbar UI Design — Mobbin](https://mobbin.com/glossary/toolbar) — MEDIUM

---
*Feature research for: WorshipPlanner v1.4 "Service and Slides"*
*Researched: 2026-07-28*
