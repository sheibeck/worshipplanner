# Phase 47: Congregational Reading Divider UX - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grey-area answers proposed and accepted at Claude's
discretion under the v1.5 standing autonomy grant (STATE.md, 2026-08-06). The interaction pattern
is **owner-locked by R095 and FEATURES.md** and is NOT re-opened: click-between-verses divider +
per-segment label chips; drag-handles (pattern b) and free-range text selection (pattern e) were
both evaluated and **rejected** in FEATURES.md § 1.

<domain>
## Phase Boundary

A user can **hand-divide** a fetched scripture passage into an ordered sequence of
**Leader / Congregation / All** segments — placing the dividers themselves — with three
**equally-available** starting points: the AI-proposed split, a one-click alternating
assignment, and starting blank. All three seed the **same** editable `CongregationalSection[]`
structure so none is a dead end. The first slide of a congregational reading shows the scripture
reference; every later slide shows only the speaker label.

This is a **rework of the existing `CongregationalEditor.vue`** (built across Phases 34/38/45),
not a greenfield component. What exists today: Fetch Passage (ESV/NLT by `bibleVersion`), an
auto-alternating split on fetch, an opt-in "Split with AI" (gated by `aiEnabled`), a per-segment
speaker **toggle** (LEADER ↔ CONGREGATION only), a preview panel, and `translationSource`
stamping (R092). What is **missing** and this phase adds:
1. **Hand-division** — the user cannot currently place/remove dividers; segments are fixed by
   `splitPassage`. R095 requires click-between-verses insert/remove.
2. The **`ALL`** role — today only LEADER/CONGREGATION exist.
3. The three seeds presented as **equal choices** (today fetch auto-alternates; AI is a separate
   button; there is no "blank").

Requirements: **R095** (hand-divide, place dividers themselves), **R096** (three equal seeds →
same `{text, role}[]`, AI disappears when AI off), **R097** (first slide = reference, later
slides = speaker label only).

**Depends on:** Phase 39 (the `aiEnabled` toggle gates the AI seed — enforced at
`claudeApi.ts` module entry), Phase 45 (`translationSource` the divider text is drawn from /
stamped with). Both are code-complete (deferred-verify).
</domain>

<decisions>
## Implementation Decisions

### Divider Editing Model (R095)
- **Boundaries snap to legal break points**, never arbitrary text ranges. Reuse Phase 34's
  `computeBoundaries` / `splitPassage` (verse/clause boundaries) as the set of places a divider
  may fall — this is exactly why R095 and FEATURES.md reject free-range selection (pattern e).
- **Primary gesture (pattern a):** clicking the gap between two adjacent verses reveals a thin
  `+` affordance that inserts a boundary (splits one segment into two at that point); clicking an
  existing boundary removes it (merges the two neighbors). Both snapped to `computeBoundaries`.
- **Single editable structure:** keep `CongregationalSection[]` — `{ speaker, text, verseRange,
  translationSource }` — as THE structure all three seeds write to. Extend `speaker` to
  `'LEADER' | 'CONGREGATION' | 'ALL'`. This is the `{ text, role }[]` R096 names.
- **Per-segment labeling (pattern c):** each segment carries a 3-way **segmented-control chip**
  (Leader / Congregation / All), not a dropdown (only 3 values; a tap-sized 3-way toggle beats a
  dropdown on mobile — FEATURES.md § Recommended). The chip both labels and, combined with the
  gap `+`, divides. Non-adjacent segments sharing a label (a recurring refrain — Psalm 136) is
  inherently supported: any segment may take any of the 3 roles.
- **Rejected (locked):** drag-handles (pattern b) and free-range/select-text-then-label
  (pattern e). If segment reordering is ever needed, up/down move — never drag (FEATURES.md § b).
- **Touch:** the gap `+` is a generously-sized tap target and the 3-way chip is the touch-first
  labeling control, so the editor is usable on a phone (Phase 48 owns broader mobile polish, but
  this editor must not be desktop-only).

### The Three Seeds (R096)
- After **Fetch Passage**, present three **equally-available** seed actions:
  1. **Split with AI** — the existing `splitCongregationalReading` call, shown **only when
     `authStore.settings.aiEnabled`** (already gated; R096 "disappears entirely when AI is off").
  2. **Alternate Leader/Congregation** — the existing `buildAlternatingSections` logic, now a
     one-click deterministic seed (no network) rather than an automatic on-fetch action.
  3. **Start blank** — every verse its own segment, all defaulting to **Leader**; the user
     hand-divides and labels from there (FEATURES.md line 128).
- **Behavior change (disclosed):** fetch no longer auto-commits the alternating split. Fetch
  renders the passage; the user picks a seed. "Alternate" reproduces today's on-fetch behavior on
  demand. This is what makes the three "equally-available starting points" (R096) true rather than
  alternating being privileged.
- All three write the identical `CongregationalSection[]`; after any seed the user can freely
  re-divide (gap `+`) and re-label (chips) — no seed is a dead end.
- AI-off path is fully functional: Alternate + Blank + hand-editing require no AI at all.

### The ALL Role & Slide Rendering (R097)
- **Add `'ALL'`** to `CongregationalSection.speaker` (`src/types/slide.ts`). Additive and safe:
  existing data has only LEADER/CONGREGATION; ALL is new, so no migration is needed.
- **Presenter (`PresentationViewer.vue`):** the speaker-label render is currently a binary ternary
  (`LEADER ? 'Leader:' : 'Congregation:'`, line ~199) with two colours (sky/amber, per the
  2026-08-05 out-of-band colour restoration). Extend to three: `Leader:` / `Congregation:` /
  `All:`, each with a distinct colour (ALL gets a third hue — Claude's discretion, e.g. emerald),
  **label always shown as text** (FEATURES.md: label-first, styling-second — never rely on colour
  alone). The grid card render (`slideDisplay.ts`) gets the same 3-way label.
- **R097:** the slideshow assembler already builds one slide per section with the reference
  resolved live (`slideshowAssembler.ts` § `congregationalSectionsFromSlot`). Confirm/implement:
  the **first** section slide of a reading shows the scripture reference; **every later** section
  slide shows only the speaker label. Phase 38 laid most of this — this phase verifies it holds
  for hand-divided readings and the new ALL role.
- **No print work** — congregational slides render on the slide surfaces; the printed Order of
  Service is out of scope (consistent with Phase 46's print exclusion).

### Claude's Discretion
- Exact ALL colour/hue, the `+` gap affordance visuals and hit-area, the segmented-control chip
  styling, whether to keep the current modal shell or restructure it, and all copy — at Claude's
  discretion within the decisions above. The UI-SPEC (next step) will lock the visual contract.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/CongregationalEditor.vue` (319 lines) — the component being reworked. Controlled
  prop/emit (persists nothing itself; parent `ServiceEditorView` owns the `ScriptureSlot` write,
  R064/34-06). Already has fetch (ESV/NLT), AI split (gated by `aiEnabled`), speaker toggle,
  preview, and `translationSource` capture-once-at-fetch (R092, `lastFetchedVersion`). Mounted as a
  Teleported modal keyed on the slot id (WR-04).
- `src/utils/scriptureBoundaries.ts` — `computeBoundaries` / `hasSplittableBoundaries` (Phase 34):
  the legal break-point set the hand-divider snaps to.
- `src/utils/scriptureSplitter.ts` — `splitPassage` (verse-based segments): the basis for the
  Alternate and Blank seeds.
- `src/utils/claudeApi.ts` — `splitCongregationalReading`, gated at module entry by
  `authStore.settings.aiEnabled` (R088). The AI seed.
- `src/types/slide.ts` — `CongregationalSection` (line 94) — extend `speaker` union to add `'ALL'`.
- `src/utils/slideshowAssembler.ts` — builds one slide per section, resolves the reference live
  (R097 substrate); `congregationalSectionsFromSlot` / `congregationalSectionFromRef`.
- `src/components/PresentationViewer.vue` — congregational render (`isCongregational`, speaker line
  ~line 199, `speakerColorClass`); currently binary — extend to 3 roles.

### Established Patterns
- Controlled component: emit `update:sections` / `update:reference`, never persist directly.
- `translationSource` is captured ONCE at fetch (`lastFetchedVersion`) and stamped onto every
  produced section — do NOT restamp on a later setting change or a subsequent seed (R092).
- Speaker colour on projected slides: two distinct colours + always-visible text label
  (2026-08-05 out-of-band change) — ALL extends this to three.

### Integration Points
- `CongregationalSection` type (+ `'ALL'`), `CongregationalEditor.vue` (rework),
  `PresentationViewer.vue` + `slideDisplay.ts` (3-way label/colour), and the AI/Alternate/Blank
  seed routes. The assembler/materializer should stay role-agnostic (pass `speaker` through).
</code_context>

<specifics>
## Specific Ideas

- **Psalm 136 is the canonical test case** — a recurring congregational refrain in non-adjacent
  segments; the divider UI must make assigning the same label to non-adjacent verses cheap
  (naturally handled by per-segment chips). Psalm 24 is the call-and-response case.
- FEATURES.md bulletin conventions: role names `Leader / Congregation / All` are the standard
  vocabulary; label-first (never styling-alone) on the projected slide.
- The AI-off path must be a first-class experience (Alternate + Blank + hand-edit), not a
  degraded one — R096's "disappears entirely" is about the AI *button*, not the feature.
</specifics>

<deferred>
## Deferred Ideas

- Segment reordering (drag or move-buttons) — not required by R095-R097 (dividers define order by
  position); build only if a concrete need surfaces. Drag is explicitly rejected regardless.
- Mid-clause / arbitrary-range dividers — rejected by R095 + FEATURES.md (pattern e overkill).
- Printed-bulletin typography for responsive readings — print surface is out of scope.
- Broader mobile layout polish — Phase 48 (this editor just must be touch-usable).
</deferred>
