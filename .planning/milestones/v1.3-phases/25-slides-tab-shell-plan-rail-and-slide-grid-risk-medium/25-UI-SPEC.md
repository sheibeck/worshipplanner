---
phase: 25
slug: slides-tab-shell-plan-rail-and-slide-grid-risk-medium
status: draft
shadcn_initialized: false
preset: none
created: 2026-07-26
---

# Phase 25 — UI Design Contract

> Visual and interaction contract for the Slides tab shell: the plan rail (mirrors service order,
> not draggable) and the slide grid (cards, drag-reorder within group, drop target). Scoped to
> R031/R032. Sourced from `docs/design/slides-tab.dc.html` Turn 1 State 1, corrected against
> Phase 25's 16 locked decisions (D-01..D-16) where the mockup predates them — see
> `## Mockup Corrections` below for the itemized diff.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — no `components.json`, no shadcn. This is an established Vue 3 + Tailwind v4 codebase (74 prior plans, 218 commits) built entirely on hand-authored Tailwind utility classes; shadcn is React-oriented and has no presence here. Introducing it for one phase would fracture, not improve, consistency. |
| Preset | not applicable |
| Component library | none (no Radix/Base UI/Headless UI) — plain Tailwind + hand-rolled Vue SFCs |
| Icon library | none as an npm package — hand-inlined SVG following the Heroicons *outline* style already used throughout `ServiceEditorView.vue` (24×24 viewBox, `stroke="currentColor"`, `stroke-width="2"`, rounded caps). New icons this phase (drag-grip, ✕ remove, ▶ play, ＋ add, ⇪ import) must match this exact style — do not introduce a filled/solid icon set or an icon font. |
| Font | System UI stack (Tailwind default `font-sans`) — no webfont is loaded by the app (`index.html` has no font `<link>`, `main.css` sets only background/color). The mockup's Inter Google-Fonts import is a Design-Canvas-only artifact — **do not port it.** |
| CSS framework | Tailwind v4 (`@import "tailwindcss"` in `src/assets/main.css`, `@tailwindcss/vite` plugin) — **no `tailwind.config.js`.** |
| Drag library | SortableJS (`sortablejs` + `@types/sortablejs`, already a dependency) — reuse the exact pattern established in `ServiceEditorView.vue`'s slot list (`Sortable.create(el, { handle: '.drag-handle', draggable: '.slide-card', ... })`), not a new drag library. |

**Known Tailwind v4 gotcha (hit twice already in this codebase — `SongBadge.vue`, `TeamTagPill.vue`):** dynamic class strings (e.g. `` `bg-${kind}-900` ``) are silently purged in production builds. Every kind→color mapping in this spec (rail kind badge, card kind badge) **must** use a static, fully-spelled-out class-map object keyed by the discriminant, exactly like `SongBadge.vue`'s `badgeClasses`. Never interpolate a color name into a class string.

---

## Mockup Corrections

The mockup (`docs/design/slides-tab.dc.html` Turn 1 State 1) predates Phase 24's and Phase 25's
locked decisions. Everywhere they disagree, **the decisions win.** This UI-SPEC already reflects
the corrected version below — restated here as an explicit diff so nothing gets silently reverted
during implementation:

| # | Mockup shows | Contract requires instead | Why |
|---|---|---|---|
| 1 | An `UNANCHORED` block below the rail list (`Pre-service loop · 6 slides`, `Orphaned: "Offering" (2) — reassign`) | **Omit entirely.** No orphan model exists. | D-01, Phase 24 D-03 |
| 2 | Header buttons `Generate missing slides` and `⇪ Import` | **Omit both.** The header keeps only its existing `▶ Present` / `Save` (unchanged from today). | D-02, D-03 |
| 3 | Rail note `order locked ⇄ Music` | `order locked ⇄ Service Order` | D-04, anticipates D009's tab rename (Phase 27) |
| 4 | A `Grid` / `List` toggle in the grid header | **Omit.** Grid only, no toggle control of any kind (not even a disabled one). | D-09 |
| 5 | Tab bar reads `Music \| Roles \| Slides` | Still reads `Music \| Roles \| Slides` **in this phase** — the tab itself is renamed to "Service Order" in Phase 27, not here. Do not rename it early. | 25-CONTEXT D-04 note |
| 6 | Drop tile copy: `Drop PPTX, images, video` / `appends to this group` | `Drop PPTX, images, video, or audio` / `PPTX/image/video appends a slide · audio sets this group's music` | D-14 — audio attaches as the bed, not a slide; copy must say so |
| 7 | No visible affordance for "no music yet" on a group | Add one (mockup only shows the *populated* bed bar) — see `## Copywriting Contract` | Gap the mockup didn't cover; resolved below |

---

## Layout Reference (State 1 / default — the only state this phase builds)

```
┌ Tab bar: Music | Roles | Slides ─────────────────────────────────────────┐
├─────────────┬──────────────────────────────────────────────────────────┤
│ SERVICE PLAN │ Song — This Is Our God   [group 3 of 9 · follows plan]  │
│ order locked │ Plays 1 → 6, left to right then down      ＋ Add slide  │
│ ⇄ Service    │                                    ⇪ Import into group  │
│ Order        ├──────────────────────────────────────────────────────────┤
│              │ ♪ Music for this group: pad_Cmaj_soft.mp3  ▶ ✕          │
│ [SONG] 5     │ ┌──────┐┌──────┐┌──────┐                               │
│ Crucified…   │ │ 1     ││ 2     ││ 3 sel ││   (3-col grid, drag-reorder)│
│              │ └──────┘└──────┘└──────┘                               │
│ [SCRIPTURE]2 │ ┌──────┐┌──────┐┌──────┐                               │
│ Psalms 78…   │ │ 4     ││ 5     ││ 6     │                               │
│              │ └──────┘└──────┘└──────┘                               │
│ [SONG] 6 ●   │ ┌──────────┐                                            │
│ This Is Our  │ │ ＋ drop   │  ← always last, full-width span optional  │
│ God ♪ pad…   │ └──────────┘                                            │
│ …more rows   │                                                          │
└─────────────┴──────────────────────────────────────────────────────────┘
```

- Rail: fixed width **260px**, `border-right`, not scrollable-horizontally, vertical scroll only.
- Grid: flexible width, 3-column CSS grid at desktop widths, reflows narrower (see Spacing/Grid rules).
- Selected rail row = accent-tinted background + border (see Color). First group auto-selected on open (D-05).

---

## Spacing Scale

Declared values — grounded in what `ServiceEditorView.vue` / `ServicesView.vue` already use throughout (Tailwind's default 4px-step scale), not the idealized pure-8pt set:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-text gaps inside a badge/chip (`gap-1`) |
| sm | 8px | Compact spacing between inline elements (`gap-2`), rail row internal gaps |
| card | 12px | Card/row padding — the established exception (`p-3`, used on every existing `slot-item` row; slide cards and rail rows both use this) |
| md | 16px | Grid gutter (`gap-4`), section padding (`px-4`/`py-4`) |
| lg | 24px | Grid outer padding (`px-6`), gap between grid header and content |
| xl | 32px | Not used this phase (reserved for page-level breaks, unchanged from existing page) |

Exceptions (both pre-existing app-wide conventions, kept for consistency rather than idealized):
- **12px** (`p-3`/`gap-3`) is the dominant card/row padding across the whole app (`slot-item`, `SongSlideOver` sections) — used here for rail rows and slide cards, not the idealized 16px.
- **6px** (`gap-1.5`) appears on tightly-packed icon+label pairs (e.g. `SlotMediaAttachment.vue`'s file-input rows) — permitted for the rail row's kind-badge+count line and the card footer's label+audio-chip line.
- No 44px touch-target exception is needed — this is a desktop-first editor surface (existing buttons are 32–40px tall throughout the app; match that, not a mobile minimum).

### ✅ DEVELOPER-APPROVED EXCEPTION (Spacing — 6px `gap-1.5`)

> **Approved by:** project owner (sheibeck), 2026-07-26, during the Phase 25 autonomous run.
> **Scope:** the **6px** (`gap-1.5`) value recorded immediately above. The 12px value is a multiple
> of 4 and was only a FLAG, not a block; it is covered by the same approval.
>
> `gsd-ui-checker` BLOCKED 6px because it is not a multiple of 4. Verified usage: **`gap-1.5`
> appears 36 times across 16 `.vue` files**, and `p-3` (12px) 16 times. This is the app's
> established tight-pair spacing, not new design debt introduced by this phase. Removing it here
> would make the Slides tab inconsistent with every other surface. **Do not "fix" this during
> execution.**

---

## Typography

Grounded in the existing type scale actually shipping in `ServiceEditorView.vue`/`ServicesView.vue` — **not** the mockup's smaller Design-Canvas sizes (11.5px/10px), which were tuned for the standalone mockup canvas, not this app's real type ramp.

| Role | Size | Weight | Line Height | Where |
|------|------|--------|-------------|-------|
| Meta / badge | 11px | 500 (medium) | 1.3 | Rail kind badge, card kind badge, slide-number chip, audio chip |
| Body | 13px | 400 (regular) | 1.5 | Slide card body text, group-bed filename, rail row title |
| Label / section heading | 14px | 500 (medium) | 1.3 | Tab labels (existing, unchanged), grid header title, group-action buttons |
| Section eyebrow | 12px | 600 (semibold), uppercase, `tracking-wider` | 1.3 | `SERVICE PLAN` rail header — reuses the EXACT existing eyebrow convention (`text-xs font-semibold text-gray-400 uppercase tracking-wider`) seen on the current "Teams" label, not the mockup's smaller 10px letter-spaced variant |

**Declared exception to the "2 weights max" default:** this phase uses **3** weights (400/500/600), matching the weight vocabulary already in continuous use across the whole app (regular body text, medium for buttons/active-tab, semibold for section eyebrows/page headings). Forcing a 2-weight scale here would fight, not match, the established system — see `<existing_design_system>` grounding rule.

**Declared exception to the "4 sizes max" default:** the slide-card content-kind label uses `text-[10px]`, making **5** sizes (10/11/12/13/14px). `text-[10px]` already has 13 uses across the shipped app and `text-[11px]` has 6.

### ✅ DEVELOPER-APPROVED EXCEPTIONS (Typography)

> **Approved by:** project owner (sheibeck), 2026-07-26, during the Phase 25 autonomous run.
> **Scope:** the 3-weight and 5-size overages recorded immediately above.
>
> `gsd-ui-checker` BLOCKED these against its generic ≤2-weight / ≤4-size defaults. The exception was
> granted on **verified** codebase-grounding evidence, not researcher assertion:
>
> | Convention | Measured usage in `src/` |
> |---|---|
> | `font-medium` | 273 |
> | `font-semibold` | 133 |
> | `font-bold` | 20 |
> | `font-normal` | 19 |
> | `text-[10px]` | 13 |
> | `text-[11px]` | 6 |
>
> Four font weights are already shipping app-wide; this spec's three is already a *reduction*.
> Complying with the generic limits would make the new Slides tab the visually inconsistent surface
> in an app with 74 completed plans of established convention. The checker names recorded developer
> sign-off as a valid resolution for exactly this situation. **Do not "fix" these during execution.**

---

## Color

Grounded in colors already in production use elsewhere in the app (`SongBadge.vue`, `TeamTagPill.vue`, `ServiceEditorView.vue`) rather than the mockup's bespoke purple-tinted palette.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `bg-gray-950` (`#030712`, already the global app background) | Page background — unchanged, not touched by this phase |
| Secondary (30%) | `bg-gray-900` (rail rows, cards, group-bed bar) / `border-gray-800` | Card and row surfaces, rail panel, borders |
| Accent (10%) | `indigo-400`/`indigo-500`/`border-indigo-500`/`bg-indigo-950` tint | Reserved for: (1) the selected rail row's border + background tint, (2) the selected slide card's border, (3) the active `Slides` tab's text + underline (existing convention, unchanged), (4) the `♪` music-note glyph and its label text on both rail rows and the group-bed bar |
| Destructive | `text-red-400` (hover-only, non-solid) for the group-bed `✕ remove` control, matching `SlotMediaAttachment.vue`'s existing `text-gray-500 hover:text-red-400` "Remove audio" pattern — **not** a solid red button; this phase introduces no NEW confirmed-delete action (slide/group delete belong to Phases 24/26) | Group-bed removal only |

Accent reserved for exactly the four uses above — **never** applied to default (unselected) rail rows, default (unselected) cards, secondary buttons (`＋ Add slide`, `⇪ Import into this group` stay neutral bordered buttons — `border-gray-700 text-gray-300`, matching the mockup's own transparent/bordered treatment and every existing secondary button in `ServiceEditorView.vue`).

**Kind badge color map** (rail kind badge + card kind badge) — static class map, per the Tailwind v4 purge gotcha above, reusing existing hue families rather than inventing new ones:

| `SlotKind` / card kind | Classes |
|---|---|
| `SONG` / `HYMN` | `bg-indigo-950/50 text-indigo-300 border-indigo-800` (mirrors the accent family) |
| `SCRIPTURE` | `bg-teal-900/50 text-teal-300 border-teal-800` (reuses `TeamTagPill`'s `theme` variant exactly) |
| `PRAYER` | `bg-gray-800 text-gray-400 border-gray-700` (reuses `TeamTagPill`'s `team` neutral variant) |
| `MESSAGE` | `bg-pink-900/50 text-pink-300 border-pink-800` (reuses `TeamTagPill`'s `user` variant) |
| `IMPORTED` | `bg-amber-900/50 text-amber-300 border-amber-800` (reuses `SongBadge`'s Type-3 amber) |

Slide-card content-kind label (`TITLE`/`VERSE 1`/`CHORUS`/`IMAGE`/`VIDEO`, top-left over the preview) is **plain text, no chip background** — `text-indigo-300 text-[10px] uppercase tracking-wide`, matching the mockup's minimal treatment exactly (this one element is kept faithful to the mockup since it sits over a preview surface, where a background chip would visually compete).

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (per group) | `＋ Add slide` — adds a blank/text slide, appended at the end of the selected group (D-16) |
| Secondary action (per group) | `⇪ Import into this group` — opens `PptxImportModal.vue` (D-15), appends at the end (D-16) |
| Drop tile heading | `Drop PPTX, images, video, or audio` |
| Drop tile subtext | `PPTX, image, and video appends a slide · audio sets this group's music` (D-14 — the one behavioral difference from the mockup's copy) |

> ⚠ **Prerequisite for the "video appends a slide" half of this copy — see 25-CONTEXT.md D-17.**
> At the time this spec was written the codebase had **no `VideoSlide` type**: `SlideContentKind`
> lists `'video'`, but the `Slide` union has no video variant and video existed only as
> `SlideGroup.bedVideoUrl`. The owner decided (2026-07-26) to add a real `VideoSlide` rather than
> degrade video to a bed, so this copy stands as written — but the type work is a hard prerequisite
> and must land in an earlier wave than the drop target. Do not ship this copy against a model that
> cannot honor it.
| Rail empty state heading (D-07) | `Nothing planned yet` |
| Rail empty state body | `Add songs, scripture, and other elements on the Service Order tab — they'll show up here automatically.` |
| Grid empty state heading (D-08, zero-slide group) | `No slides in this group yet` |
| Grid empty state body | `Add a slide, or drop a file below.` |
| Group music — no bed yet | `＋ Add music for this group` (a bordered button in the same slot the populated bed bar occupies — see Mockup Correction #7) |
| Group music — populated | `{filename}` · `plays across all N slides` (mirrors mockup verbatim: `pad_Cmaj_soft.mp3` / `plays across all 6 slides`) |
| Drop rejected (unsupported file type) | `Unsupported file — drop a PPTX, image, video, or audio file.` (inline, appears briefly near the drop tile) |
| Media upload in progress / failure | Reuses `useMediaUpload`'s existing reactive `progress`/`error` text verbatim (`Uploading… {N}%` / composable's own error string) — **do not** author new copy for this, per `SlotMediaAttachment.vue`'s established pattern |
| Destructive confirmation | None introduced this phase. Group-bed `✕ remove` is a plain, unconfirmed reversible action (matches `SlotMediaAttachment.vue`'s existing "Remove audio" — no dialog). Slide delete (Phase 26) and group delete (Phase 24, already shipped in `ServiceEditorView.vue`) are out of this phase's scope. |

---

## Grid & Interaction Rules

### Visual hierarchy — primary focal point

Resolves `gsd-ui-checker` Dimension 2 FLAG (2026-07-26).

**The selected group's slide grid is the visual anchor of this screen** — specifically the grid
header (group title + `group N of M · follows plan`) and the grid of cards beneath it. The plan rail
is deliberately secondary: it is a navigation column, narrower (260px fixed), lower-contrast, and
its only accent use is the selected-row treatment.

Reading order on first paint: grid header title → slide cards (left-to-right, top-to-bottom, which
the `Plays 1 → 6, left to right then down` hint states explicitly) → group actions → rail. The
selected rail row and the selected card share the accent so the eye can connect "what's selected in
the rail" with "what's shown in the grid" — that pairing is the one hierarchy relationship this
screen must make obvious.

### Accessible names for icon-only controls

Resolves `gsd-ui-checker` Dimension 2 FLAG (2026-07-26). Every icon-only control carries an
`aria-label`; hover styling alone is not an accessible name.

| Control | Icon | `aria-label` |
|---|---|---|
| Group-bed play/preview | `▶` | `Preview group music` |
| Group-bed remove | `✕` | `Remove group music` |
| Slide card drag handle | `⣿` | `Reorder slide` (add `aria-describedby` pointing at the slide label so screen readers get *which* slide) |
| Slide audio chip (when it carries no visible filename) | `♪` | `Slide has audio attached` |

The drag handle must additionally remain keyboard-reachable — if SortableJS cannot provide keyboard
reordering, the handle stays focusable and the phase ships without keyboard reorder rather than
shipping a focus trap. Flag that limitation rather than silently omitting it.

---

- **Card grid:** CSS Grid, `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`, `gap: 16px` (the `md` token) — this reflows naturally (3 columns at the mockup's ~1460px width, 2 at tablet, 1 at narrow/mobile) without hand-authored breakpoints.
- **Card preview height:** fixed `140px` (rounds the mockup's 138px), `overflow: hidden` — long slide body text truncates via `line-clamp` rather than scrolling or shrinking the font. This is consistent with D-10's deferred-fidelity stance (text body only, no real slide rendering yet).
- **Drop tile:** always renders as the LAST grid item regardless of slide count (D-13), including in the zero-slide empty state (D-08) — never conditionally hidden.
- **Whole-grid dragover highlight:** on `dragenter`/`dragover` with files, apply a highlight treatment to the grid container itself (e.g. `border-indigo-500/50 bg-indigo-950/10`), not just the drop tile — so the target isn't a pixel hunt (D-13).
- **Slide card drag-reorder (D-11):** each card gets a small drag-grip icon (`⣿`-style, `text-gray-600 hover:text-gray-400`, `cursor-grab`) in its footer row, to the LEFT of the label text — **not** whole-card dragging. This matches the established slot-list pattern exactly (`handle: '.drag-handle'`, `draggable: '.slide-card'`) and avoids any click-vs-drag ambiguity with card selection (D-12): clicking the preview area (not the handle) selects the card.
- **Card selection (D-12):** clicking a card (anywhere except the drag handle) sets a `selectedSlideId`-shaped piece of state and applies the accent border treatment above. This state is the seam Phase 26's drawer opens against — no drawer renders yet; clicking must not be a dead click (at minimum, the accent selection state itself must visibly respond).
- **Rail row (D-06):** no drag handle, no `cursor-grab`, no draggable-looking hover affordance of any kind. The only interaction is click-to-select. `style-hover` background tint (subtle, `hover:bg-gray-800/60`) is fine — a hover *color change* is not a drag affordance and doesn't imply draggability.
- **Rail row title overflow:** `line-clamp-2` with `text-ellipsis` — long song/scripture titles (e.g. long sermon series titles) wrap to 2 lines then truncate, never pushing the row's fixed 260px width.
- **Zero-slide group (D-08):** rail row still shows count `0` (not hidden, not a dash) — grid renders the empty-state copy above PLUS the drop target, exactly as a populated group would, just with zero cards before it.

---

## UI Considerations

Applicable state considerations resolved: 12 covered, 1 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Plan rail (list-collection) | ✅ covered | D-07 empty state — see Copywriting Contract row "Rail empty state" |
| loading | Plan rail (list-collection) | ✅ covered | Skeleton rows render while `useSlideGroups().isLoading` / the service is still resolving — matches the mockup's `hint-placeholder-count="8"` streaming pattern conceptually (concrete count is an implementation detail, not user-visible copy) |
| error | Plan rail / slide grid subscription (list-collection) | ✅ covered | No dedicated error UI — matches the app-wide convention already established by `slideGroups.ts`/`importedSlides.ts` (`onSnapshot` failures are not surfaced with bespoke UI anywhere else in the codebase); introducing one here would be inconsistent, not more complete |
| populated | Plan rail (list-collection) | ✅ covered | Default state, fully specified above (kind badge · count · title · optional bed line) |
| partial | Plan rail (list-collection) | ✅ covered | `♪ group music` line renders only when a bed exists (mirrors mockup's `sc-if`) — groups without a bed simply omit the line, no placeholder |
| overflow | Plan rail row title (static-content) | ✅ covered | `line-clamp-2` + ellipsis, see Grid & Interaction Rules |
| zero-one-many | Plan rail (list-collection) | ✅ covered | Zero → D-07 empty state; one/many → same row template, no singular/plural copy variance needed (rail rows show titles, not counts of groups) |
| empty | Slide grid (list-collection) | ✅ covered | D-08 — empty-state copy + drop target, both always rendered together |
| loading | Slide grid (list-collection) | ✅ covered | Skeleton cards render while the group's slides are still resolving (assembler/materialization in flight), same conceptual pattern as the rail |
| partial | Slide grid (list-collection) | ✅ covered | Mixed content kinds within one group (lyric verses + a mid-song image + a transition video) render side by side with their own kind badges — this is the mockup's own sample data, already the intended shape |
| overflow | Slide card body text (list-collection) | ✅ covered | Fixed 140px preview height, `line-clamp` truncation — acceptable given D-10's deferred true-rendering fidelity |
| zero-one-many | Slide grid (list-collection) | ✅ covered | Drop tile always renders last regardless of count (0, 1, or many cards before it) — D-13/D-08 |
| error | Drop target — unsupported file type (media) | 🧪 backstop | Rejected-file copy specified in Copywriting Contract, but no existing pattern in this codebase to point to for verification of the exact reject-and-recover UX (first drop-target-with-type-filtering in the app) — flagged for an explicit test at verify time rather than assumed |

<!-- Status vocabulary (locked by probe-core projectTruths):
     ✅ covered   → a plain truth string lifted into must_haves.truths
     🧪 backstop  → a flat scalar { statement, verification: backstop }; at verify time, no explicit
                    evidence → insufficient_spec → human_needed (never a silent pass, #1154)
     ⚠ unresolved → an explicit planner assumption (surfaced, never silently dropped)
     Rows are REPLACED (not appended) on a probe re-run — idempotent. -->

---

## Registry Safety

Not applicable — no shadcn, no component registry of any kind used in this project.

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable |
| third-party | none | not applicable |

---

## Checker Sign-Off

Reviewed by `gsd-ui-checker` 2026-07-26 (agent run), resolved same day.

- [x] Dimension 1 Copywriting: **PASS**
- [x] Dimension 2 Visuals: **PASS** — was FLAG (no declared focal point; icon-only controls lacked
      accessible names). Both fixed: see "Visual hierarchy — primary focal point" and "Accessible
      names for icon-only controls" in *Grid & Interaction Rules*.
- [x] Dimension 3 Color: **PASS**
- [x] Dimension 4 Typography: **PASS (developer-approved exception)** — was BLOCK on 5 sizes /
      3 weights. Resolved by recorded owner sign-off on verified codebase grounding; see the
      *DEVELOPER-APPROVED EXCEPTIONS (Typography)* block.
- [x] Dimension 5 Spacing: **PASS (developer-approved exception)** — was BLOCK on 6px `gap-1.5`.
      Resolved by recorded owner sign-off on verified codebase grounding (36 uses across 16 files);
      see the *DEVELOPER-APPROVED EXCEPTION (Spacing)* block.
- [x] Dimension 6 Registry Safety: **PASS**

**Compliance check against 25-CONTEXT.md D-01..D-16:** all 16 satisfied, no drift back toward the
mockup's cut affordances. Verified by the checker line by line.

**Approval:** APPROVED — 2026-07-26, project owner (sheibeck), during the Phase 25 autonomous run.

> **Note for the planner and executors:** the two exceptions above are deliberate and owner-approved.
> Do not "correct" the 3 font weights, the `text-[10px]` size, or the 6px `gap-1.5` during
> implementation — matching the existing app is the intent.
