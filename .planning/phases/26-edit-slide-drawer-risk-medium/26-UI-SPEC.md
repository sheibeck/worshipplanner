---
phase: 26
slug: edit-slide-drawer-risk-medium
status: draft
shadcn_initialized: false
preset: none
created: 2026-07-26
---

# Phase 26 — UI Design Contract

> Visual and interaction contract for the **Edit Slide drawer** (R033) and the **reconciliation
> confirm modal** (R029's cross-phase debt, D-05..D-08). Sourced from
> `docs/design/slides-tab.dc.html` Turn 1 **State 2** (`Edit Slide open`), corrected against
> Phase 26's 16 locked decisions (D-01..D-16) — see `## Mockup Corrections` below.
>
> **This spec INHERITS Phase 25's approved design system wholesale** (spacing scale, type scale,
> color roles, both DEVELOPER-APPROVED EXCEPTION blocks, the icon-accessible-name convention, and
> the Tailwind v4 static-class-map rule). It does not re-derive a design system for the drawer that
> opens over Phase 25's grid — see `.planning/phases/25-.../25-UI-SPEC.md`. Sections below are
> scoped to what Phase 26 ADDS: the drawer, the reconciliation modal, and their interaction rules.

---

## Design System

Identical to Phase 25 — restated, not re-derived:

| Property | Value |
|----------|-------|
| Tool | none — no `components.json`, no shadcn. Same Vue 3 + Tailwind v4, hand-authored-utility codebase. |
| Preset | not applicable |
| Component library | none — plain Tailwind + hand-rolled Vue SFCs |
| Icon library | none as an npm package — hand-inlined SVG, Heroicons *outline* style (24×24 viewBox, `stroke="currentColor"`, `stroke-width="2"`, rounded caps). The drawer's close (✕) icon reuses `SongSlideOver.vue`'s exact `<svg>` markup verbatim — do not draw a new one. |
| Font | System UI stack (Tailwind default `font-sans`) — no webfont. The mockup's Inter import is Design-Canvas-only; do not port it. |
| CSS framework | Tailwind v4 (`@import "tailwindcss"`, no `tailwind.config.js`) |
| Modal/drawer pattern | `SongSlideOver.vue` is the established slide-over — the Edit Slide drawer reuses its exact `Teleport to="body"`, `Transition` (translate-x-full ↔ translate-x-0, 250ms out / 200ms in), and panel-shell classes (`fixed inset-y-0 right-0 z-50 w-full max-w-[480px] bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col`). **D-01.** |

**Known Tailwind v4 gotcha (restated from Phase 25 — applies here too):** dynamic class strings are silently purged in production. Any kind→treatment mapping this phase introduces (e.g. per-`SourceRef.kind` field visibility, if expressed as class maps rather than `v-if` branches) must use a static, fully-spelled-out object, never string interpolation.

---

## Mockup Corrections

The mockup (`slides-tab.dc.html` Turn 1 State 2) predates Phase 26's locked decisions and Phase 25's
already-shipped cuts. Where they disagree, **the decisions win** — restated as an explicit diff:

| # | Mockup shows | Contract requires instead | Why |
|---|---|---|---|
| 1 | `UNANCHORED` block still visible in the rail behind the drawer | **Omit** — already cut in Phase 25 (D-01) | Carried forward, do not reintroduce |
| 2 | Header `Generate missing slides` / `⇪ Import` buttons behind the drawer | **Omit both** — already cut in Phase 25 (D-02/D-03) | Carried forward |
| 3 | `Grid` / `List` toggle in the grid header behind the drawer | **Omit** — already cut in Phase 25 (D-09) | Carried forward |
| 4 | Rail note `order locked ⇄ Music` | `order locked ⇄ Service Order` | Phase 25 D-04, still the tab name in-app until Phase 27 |
| 5 | Tab bar reads `Music \| Roles \| Slides` | Unchanged this phase — tab rename is Phase 27 (D009). Only the rail note (row 4) anticipates it. | Do not rename early |
| 6 | Drawer header has `Cancel` / `Save` buttons | **Omit both.** D-02: fields autosave (800ms debounce for text fields; immediate for radio/checkbox toggles) — there is nothing to explicitly Save or Cancel. Replace with a small inline autosave-status indicator (`Saving…` → `Saved` flash), reusing the exact convention already shipped for the Roles tab (quick-task 260714-e7o). | D-02 |
| 7 | A full-page opaque scrim (`rgba(8,9,15,.5)`) covers the whole scene, including the rail and grid, while the drawer is open | **No scrim at all.** The rail and grid stay fully interactive underneath. | **D-03 requires this.** The drawer follows the selection — clicking a *different* slide card while the drawer is open must switch the drawer's contents in place, not be blocked by a backdrop. A scrim (SongSlideOver's own default) would force close-then-reopen and contradicts "do NOT close the drawer on every selection change." This is a deliberate, load-bearing deviation from `SongSlideOver.vue`'s own backdrop-click-to-dismiss convention — do not "fix" it to match. |
| 8 | Slide Text helper caption: `editing here only affects this slide` | **Remove that clause.** It implies a per-service text override, which D-13 explicitly forbids (no override path exists). Replace per-kind, see `## Slide Text — per-kind treatment` below. | D-13 |
| 9 | No `Duplicate` control anywhere in the drawer | **Add one** (D-04) — mockup only shows it in the *Turn 2* song-lyrics mockup, not here. Placement specified below. | D-04 |
| 10 | `Remove` (per-slide audio) and `Delete Slide` render as plain, permanently-red text with no confirmation | `Remove` (audio) stays a plain reversible action (hover-only red, no dialog) — matches `SlotMediaAttachment.vue`. `Delete Slide` opens an inline confirm block naming what's lost, matching `SongSlideOver.vue`'s own "Delete Song" inline-confirm pattern. Copy in `## Copywriting Contract`. | D-03 precedent (24), consistency with the established SongSlideOver delete pattern |
| 11 | No reconciliation dialog exists anywhere in the mockup (Phase 25 ships only the passive banner) | **New modal**, launched from Phase 25's existing amber banner in `SlideGrid.vue` (currently plain text with no click affordance — must gain one). Full spec below. | D-05..D-08, R029 |

---

## Layout Reference — the drawer over Phase 25's shell

```
┌ (Phase 25 shell, unchanged, fully interactive — no scrim) ──────────────┐
│  ...rail...           ...grid...                    ┌ Edit Slide  ✕ ┐ │
│                                                       │ Saving… / Saved│ │
│                                                       ├───────────────┤ │
│                                                       │ [SONG] title  │ │
│                                                       │  · slide 3/6  │ │
│                                                       │ ┌───────────┐ │ │
│                                                       │ │  preview  │ │ │
│                                                       │ └───────────┘ │ │
│                                                       │ Slide Label   │ │
│                                                       │ [___________] │ │
│                                                       │ Slide Text    │ │
│                                                       │ (read-only /  │ │
│                                                       │  editable per │ │
│                                                       │  kind)        │ │
│                                                       │ Slide Audio   │ │
│                                                       │ (omitted for  │ │
│                                                       │  video)       │ │
│                                                       │ Notes         │ │
│                                                       │ Duplicate     │ │
│                                                       │ Delete Slide  │ │
│                                                       └───────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

- Drawer: fixed-position, right-edge overlay — `fixed inset-y-0 right-0 z-50 w-full max-w-[480px]`, `bg-gray-900 border-l border-gray-800 shadow-2xl`. Nothing underneath reflows (R033/D-01) — no `margin-right`/grid-column changes to the shell when the drawer opens.
- No scrim (Mockup Correction #7).
- Body: `flex-1 overflow-y-auto px-5 py-5 space-y-5` — same overflow convention as `SongSlideOver.vue`'s tab content. Long notes/text never push the header or footer actions out of view.
- Entry/exit: `Transition` — enter `translate-x-full → translate-x-0` over 250ms ease-out; leave `translate-x-0 → translate-x-full` over 200ms ease-in. Verbatim `SongSlideOver.vue` timings.
- Focus management: on open, focus moves into the panel (the `Slide Label` input, or the panel container if no field is meaningfully "first" for the slide's kind). `Escape` closes the drawer (same action as ✕ — there is no scrim to Escape out of, but the shortcut is still expected). On close, focus returns to the slide card that was selected.
- Follows the selection (D-03): switching `selectedSlideId` (clicking a different card, including across a slot switch) re-renders the drawer's contents in place — it does not unmount/remount, and it must never auto-close on a selection change. The only explicit close actions are ✕ and `Escape`.

---

## Spacing Scale

Inherited verbatim from Phase 25 — same tokens, same exceptions, same developer approval. Do not
re-derive:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-text gaps (`gap-1`) |
| sm | 8px | Compact inline spacing (`gap-2`) |
| card | 12px | Field block internal padding, drawer section gaps as an app-wide exception (`p-3`) |
| md | 16px | Drawer horizontal padding (`px-5` ≈ 20px is the actual SongSlideOver value, kept for 1:1 reuse — see note below), section gap (`space-y-5` = 20px) |
| lg | 24px | Not used inside the drawer this phase |

**Declared, deliberate exception — reuse over idealization.** `SongSlideOver.vue`'s own padding is
`px-5 py-4` (20px/16px) and its body uses `space-y-5` (20px), not a clean 16px/24px pair from the
idealized scale. Phase 26 reuses those exact values for the Edit Slide drawer BECAUSE it is
literally the same component pattern (D-01) — introducing a different padding rhythm here would
make the drawer visually inconsistent with the panel pattern it is copying. This is the same
"established-reuse beats idealized-scale" reasoning Phase 25 used for its own 12px/6px exceptions
below, which this phase also inherits unchanged:

### ✅ DEVELOPER-APPROVED EXCEPTION (Spacing — 6px `gap-1.5`, inherited from Phase 25)

> **Approved by:** project owner (sheibeck), 2026-07-26, during the Phase 25 autonomous run.
> **Scope:** the 6px (`gap-1.5`) value, and the 12px (`p-3`) value alongside it.
> Verified usage: `gap-1.5` appears 36 times across 16 `.vue` files app-wide; `p-3` 16 times.
> This is the app's established tight-pair spacing, not new debt. **Do not "fix" this during
> execution** — this applies to the drawer's own tightly-packed rows (e.g. the kind-badge + "slide
> N of M" context line, the audio-file row's filename + duration + Remove) exactly as it did to
> Phase 25's rail/card rows.

---

## Typography

Inherited verbatim from Phase 25's type scale — same roles, same declared exceptions, same
developer approval:

| Role | Size | Weight | Line Height | Where (this phase) |
|------|------|--------|-------------|-----|
| Meta / badge | 11px | 500 (medium) | 1.3 | Drawer kind-eyebrow badge (`SONG`/`SCRIPTURE`/etc.), audio-file duration |
| Body | 13px | 400 (regular) | 1.5 | Field values (Slide Label, read-only Slide Text, Notes), preview text |
| Label / section heading | 14px | 500 (medium) | 1.3 | Drawer title "Edit Slide", field section labels ("Slide Label", "Slide Audio", etc. rendered at 11.5px per the mockup's own field-label size — see note) |
| Section eyebrow | 12px | 600 (semibold), uppercase, `tracking-wider` | 1.3 | Not used inside the drawer this phase (no eyebrow header row) |

**Field-label size note:** the mockup renders field labels ("Slide Label", "Slide Audio", "Notes")
at 11.5px, one step below Phase 25's declared 11px "Meta/badge" role. Rather than introduce a SIXTH
size, this phase rounds field labels to the existing **11px Meta/badge role** (color `text-gray-400`,
weight 400 regular — matching every existing `<label>` in `SongSlideOver.vue`, e.g. `block text-xs
font-medium text-gray-400 mb-1`, where Tailwind's `text-xs` **is** 12px... reconciled below).

**Grounding correction:** `SongSlideOver.vue`'s actual field labels use Tailwind's `text-xs`
(12px) + `font-medium`, not the mockup's 11.5px. Since this drawer is D-01's direct reuse of that
established component, **field labels in the Edit Slide drawer use `text-xs font-medium
text-gray-400`** (12px/500) — the real shipped convention — not the mockup's bespoke 11.5px. This
keeps the drawer visually identical to every other field label already in the app, rather than
importing a second, slightly-different label size from the Design Canvas illustration.

**Declared exception to the "2 weights max" default (inherited, restated):** this phase uses the
same **3** weights (400/500/600) Phase 25 established, for the same reason — matching the
already-shipped app vocabulary. **Declared exception to the "4 sizes max" default (inherited,
restated):** Phase 25's `text-[10px]` exception (5 sizes total) still applies to this phase's
kind-badge eyebrow reuse. **Do not "fix" either during execution** — see the
DEVELOPER-APPROVED EXCEPTIONS block below.

### ✅ DEVELOPER-APPROVED EXCEPTIONS (Typography — inherited from Phase 25)

> **Approved by:** project owner (sheibeck), 2026-07-26, during the Phase 25 autonomous run, on
> verified codebase evidence (`font-medium` 273 uses, `font-semibold` 133, `font-bold` 20,
> `font-normal` 19, `text-[10px]` 13, `text-[11px]` 6, across `src/`). Phase 26's drawer draws from
> the exact same shipped vocabulary (it is reusing `SongSlideOver.vue`'s own classes) — the
> exception carries forward unchanged and is **not re-litigated** here. If `gsd-ui-checker` blocks
> on weight/size count, the resolution is this recorded sign-off, not a redesign.

---

## Color

Inherited verbatim from Phase 25 — same roles, same reserved-for list, extended only with the
button-color grounding this phase's new controls need (drawn from `SongSlideOver.vue`'s actual
shipped classes, not the mockup's inline hex):

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `bg-gray-950` (unchanged, page background) | Untouched by this phase |
| Secondary (30%) | `bg-gray-900` (drawer panel), `bg-gray-800` (field inputs — matches `SongSlideOver.vue`'s `bg-gray-800 border-gray-700` input convention) | Drawer background, field surfaces |
| Accent (10%) | `indigo-400`/`indigo-500` tint | Reserved for exactly: (1) the selected audio-scope pill (`This slide only` / `All slides in this group` — active choice gets `bg-indigo-600 border-indigo-500 text-white`, per `SongSlideOver.vue`'s Save-button convention, not Phase 25's rail/card tint values, since this is a button not a badge), (2) the drawer's own kind-eyebrow badge (reuses Phase 25's `KIND_BADGE_CLASSES` map exactly, unchanged), (3) the reconciliation modal's `Apply source changes` primary button |
| Destructive | `text-gray-500 hover:text-red-400` (per-slide audio `Remove`, matches `SlotMediaAttachment.vue`'s "Remove audio" exactly — reversible, unconfirmed) / `text-red-400 hover:text-red-300` (the `Delete Slide` trigger text, matches `SongSlideOver.vue`'s "Delete Song" trigger) / `bg-red-700 hover:bg-red-600` (the inline delete-confirm's solid `Delete` button, matches `SongSlideOver.vue`'s own confirm-block button exactly) | Per-slide audio removal (reversible) vs. slide deletion (destructive, confirmed) — same visual grammar the app already uses to distinguish the two severities |

**Kind badge color map:** reuses Phase 25's `KIND_BADGE_CLASSES` (`src/components/slides/slideDisplay.ts`) unchanged — the drawer's eyebrow badge is the SAME static class map, keyed the same way. Do not introduce a second map.

Accent reserved for exactly the three uses above in this phase's NEW surfaces — never applied to
the inactive audio-scope pill, the `Dismiss` button, or `Cancel`/secondary buttons generally (those
stay `border-gray-700 text-gray-300` bordered-neutral, matching every existing secondary button).

---

## Slide Text — per-kind treatment

The single most load-bearing table in this spec (D-15). Keyed on `GroupSlideEntry.sourceRef.kind`
(`src/types/slideGroup.ts`) — **not** `Slide.contentKind** — because a PPTX-imported image and a
PPTX-imported text slide share `sourceRef.kind: 'imported'` even though their `contentKind` differs
(`'image'` vs `'text'`), and a user-added blank slide has `sourceRef.kind: 'text'` with the SAME
`contentKind: 'text'` as an imported one. The drawer's affordance depends on the *source*, not the
content shape.

| `sourceRef.kind` | Slide Text field | Affordance |
|---|---|---|
| `lyric` | Read-only block, shows the section's lines | `Edit in song` → routes to `/songs`, opens that song's `SongSlideOver`, **Lyrics tab** (D-14: real navigation, not a deep link into current internals) |
| `copyright` | Read-only block, shows title/authors/CCLI#/license# | `Edit in song` → routes to `/songs`, opens that song's `SongSlideOver`, **Details tab** (copyright fields live there, not Lyrics — this is a deliberate refinement of D-14: the link target depends on WHICH tab actually owns the field being shown) |
| `scripture` | Read-only block, shows the passage text | `Edit in scripture` → switches the CURRENT service editor to its first tab (named "Music" until Phase 27 renames it) and scrolls/focuses that slot's inline `ScriptureSlideEditor` — a same-page tab switch, not a route change |
| `imported` | Read-only block (PPTX-derived text) or the `<img>` preview alone (no separate text block for an image entry) | **None** — "there is no canonical text to edit" (D-15) |
| `video` | **Section omitted entirely** — no Slide Text block renders | **None** — also see Slide Audio below (D-12 omits that section too) |
| `text` | **Editable** `<textarea>`, live (800ms-debounced autosave via `replaceGroupSlides`) | **None** — per D-15, "the drawer IS its home." This is the one exception to D-13's read-only rule. |

Helper caption under the read-only block (replaces the mockup's cut "editing here only affects this
slide" clause — Mockup Correction #8):

- `lyric` / `copyright`: `From the song's Lyrics tab — editing there updates every service using this song.`
- `scripture`: `Pulled from the passage reference — editing the reference updates this slide.`
- `imported`: `From the imported file — re-import to change it.`

D-16 unsaved-edit guard applies to BOTH `Edit in song` and `Edit in scripture` links (both cause the
drawer's current editing context to go away): reuse `useUnsavedGuard` exactly as `SongSlideOver.vue`
does — `confirmDiscard()` gates the click, using the same copy (`You have unsaved changes. Discard
them?`), scoped to whichever debounced field(s) (`text` kind's body, or Label/Notes on any kind)
have a write still pending in the 800ms debounce window. Do not invent new confirm copy for this.

---

## Slide Audio — scope, loop, and the video exception

- **D-12 — omitted entirely for a `video`-kind slide.** No Slide Audio section renders at all for a
  slide whose `contentKind === 'video'`. The video carries its own audio and (per 25-REVIEW-FIX
  WR-01) suppresses the group bed for its own duration — offering a second audio attachment there
  would create the exact conflict the model was built to prevent. This is a hard `v-if`, not a
  disabled-looking section.
- **For every other kind**, the section always renders, in one of three states:

  1. **Nothing attached** (`entry.audioUrl` unset AND scope resolves to no group bed covering it):
     show the `Play this audio for` scope pill pair (default selection: `This slide only`) plus an
     attach affordance below it, reusing `SlotMediaAttachment.vue`'s own empty-state upload button
     verbatim (same copy, same drop/upload pattern) — do not invent a second upload UI.
  2. **This slide's own audio** (scope = `This slide only`, `entry.audioUrl` set): file row shows
     filename + duration (11px meta) + `Remove` (hover-red, unconfirmed — removes only this entry's
     `audioUrl`). The `▣ Loop until the next slide` checkbox is enabled and meaningful here (D-11).
  3. **Group bed audio** (scope = `All slides in this group`): file row shows the GROUP'S bed
     filename (same data `SlideGroupMusicControl.vue` already reads) with the caption `Shared with
     every other slide in this group`. `Remove` here removes the GROUP BED (`setGroupBedMedia`) —
     same unconfirmed-but-clearly-scoped severity as `SlideGroupMusicControl`'s own `✕ remove`, not
     a bigger confirmation, for consistency with that existing control. The `▣ Loop until the next
     slide` checkbox is **disabled and unchecked** in this state with an inline note: `Group music
     doesn't loop — it plays continuously across the group.` (D-11: a bed never loops.)

- **Writing a NEW file:** if the scope pill is `This slide only` when a file is attached, write goes
  to `entry.audioUrl` via `replaceGroupSlides`. If the scope pill is `All slides in this group`,
  write goes to the GROUP BED via `setGroupBedMedia` (D-09) — `entry.audioUrl` stays unset, and
  `entry.audioScope` is stamped `'group'` for UI round-trip display only (per the already-shipped
  24-02 convention: "stored audioScope is UI-round-trip-only, the assembler never interprets it").
  Switching the pill AFTER a file is attached re-routes the write on next change; it does not
  silently move an already-attached file between the two homes.

---

## Duplicate and Delete Slide

- **Placement:** a footer action row at the bottom of the drawer body, above a `border-t
  border-gray-800 pt-4` divider — same placement convention as `SongSlideOver.vue`'s "Delete Song"
  block. `Duplicate` (bordered-neutral secondary button, `border-gray-700 text-gray-300`) sits to
  the LEFT of `Delete Slide` (text-only trigger, `text-red-400 hover:text-red-300`).
- **Duplicate (D-04):** inserts a copy of the current entry immediately after it in the group's
  `slides` order (via `replaceGroupSlides`); every later entry's `order` shifts by one. The drawer's
  selection follows the NEW duplicate (not the original) — matches the expected "duplicate, then
  edit the copy" intent.
- **Delete Slide:** clicking it reveals an inline confirm block (same shell as `SongSlideOver.vue`'s
  own delete-confirm — `rounded-lg bg-red-900/20 border border-red-800 p-4`, `Cancel` / solid-red
  `Delete` button pair), NOT a separate modal. Copy follows the Phase 24 D-03 precedent, scoped to
  THIS slide only (not the whole group):

  | This slide has… | Confirm body copy |
  |---|---|
  | attached audio AND notes | `Deleting this slide also removes its attached audio and operator notes. This cannot be undone.` |
  | attached audio only | `Deleting this slide also removes its attached audio. This cannot be undone.` |
  | notes only | `Deleting this slide also removes its operator notes. This cannot be undone.` |
  | neither | `Delete this slide? This cannot be undone.` |

  After a successful delete, the drawer closes on its own — `SlidesTab.vue`'s existing
  `selectedGroupSlideIds` watch already nulls `selectedSlideId` the moment it stops resolving
  against the selected slot's assembled slides (25-03, Pitfall 4). No new close-handling is needed.

---

## Preview

`aspect-ratio: 16/9` box, `rounded-md bg-gray-950 border border-gray-800`, matching the mockup's
proportions but the app's own surface colors (not the mockup's bespoke hex). Rendering per
`contentKind` (preview fidelity is Claude's Discretion — kept deliberately simple, matching Phase
25 D-10's stance that true slide rendering is still deferred):

| `contentKind` | Preview content |
|---|---|
| `lyric` / `text` | Centered text, 13px/1.5, matching the mockup's centered-lyric treatment |
| scripture-carrying (`contentKind: 'scripture'`) | Centered text, same treatment |
| `image` | `<img>`, `object-fit: contain`, same box |
| `video` | Same box, `bg-gray-950`, a centered static `▶` glyph (matching the mockup's slide-6 example) — NOT an autoplaying/interactive player. True playback belongs to `PresentationViewer`, not this drawer. |

Context line above the preview (verbatim from the mockup): `{kind badge} {source title} · slide {n}
of {total}` — e.g. `SONG  This Is Our God · slide 3 of 6`.

---

## Reconciliation Confirm Modal (D-05..D-08, R029's closed debt)

A **separate, centered dialog** — NOT part of the Edit Slide drawer (D-05: reconciliation is a
GROUP-level decision). Launched by making Phase 25's existing passive banner
(`SlideGrid.vue`'s `reconciliationNotice`, currently plain unclickable text) into a clickable
trigger — wrap it in a button or append an inline "Review" affordance; clicking it opens this modal
for that group's `PendingReconciliation` entry.

### Shell

- `Teleport to="body"`, centered overlay: `fixed inset-0 z-50 flex items-center justify-center`,
  scrim `bg-black/50` (this dialog DOES get a scrim — unlike the Edit Slide drawer, this is a
  decision-forcing confirm, not a live-editing surface that needs to stay non-blocking).
- **Not** dismissible by clicking the scrim — the user must pick `Apply source changes` or
  `Dismiss` explicitly. `Escape` maps to `Dismiss` (safe default, matches the app's existing
  Escape-as-cancel convention, e.g. `PresentationViewer`'s Escape-to-exit).
- Panel: `bg-gray-900 border border-gray-800 rounded-lg shadow-2xl max-w-md w-full p-5`.

### No diff view (D-06 — explicit user override, accepted trade-off)

The dialog shows NO source-vs-group diff. To partially offset that, the copy below is as concrete
as it can be without one: exact counts and kinds of what's at risk, never a generic "your changes
may be lost."

### Copy — generic case (scripture reference changed / deck reimported / song sections changed)

| Element | Copy |
|---|---|
| Heading | `Update this group's slides?` |
| Body | `"{slotDisplayTitle}"'s source content has changed since these slides were generated. Applying the update will replace {N} slide{s} you added, including {mediaClause}. This cannot be undone.` |
| Primary action | `Apply source changes` (solid `bg-indigo-600 hover:bg-indigo-500 text-white`) |
| Secondary action | `Dismiss` (bordered neutral `border-gray-700 text-gray-300`) |

`{mediaClause}` built exactly like `ServiceEditorView.vue`'s existing `deleteConfirmBody` computed
(D-03 precedent): join whichever of `{withAudio} with attached audio`, `{withNotes} with operator
notes` are non-zero (from `PendingReconciliation.loss`), e.g. `3 slides you added, including 1 with
attached audio` (the exact phrasing this Context specifies). If `loss` carries no media at all,
drop the `including…` clause: `replace 2 slides you added. This cannot be undone.`

### Copy — song-identity-swap variant (D-08, closes 24-REVIEW CR-01)

| Element | Copy |
|---|---|
| Heading | `Replace "{oldSongTitle}" with "{newSongTitle}"?` |
| Body | `This group's slides currently come from "{oldSongTitle}". Applying the update will switch them to "{newSongTitle}" and replace {N} slide{s} you added, including {mediaClause}. This cannot be undone.` |
| Actions | Same `Apply source changes` / `Dismiss` pair |

> ⚠ **Data-dependency flag for the planner.** `PendingReconciliation` (`slideDisplay.ts`) currently
> carries only `slotId`, `proposed`, and `loss` counts — it has **no field for the old/new song
> title** the D-08 copy above needs. This is a real gap, not a UI-only concern: threading the
> old/new song names through requires either widening `PendingReconciliation` or having the
> reconciler (`slideGroupMaterializer.ts`'s CR-01 fix path) attach them alongside `needsConfirm`.
> Flagging here rather than silently assuming a shape the code doesn't have yet.

### Durable dismissal (D-07)

`Dismiss` is durable — it must record that this signature was seen and declined so the banner and
modal do not re-prompt for the *same unchanged* `sourceSignature` on every load (a re-prompting
dismissal would be worse than Phase 25's plain passive banner). Exact persistence mechanism (a
`dismissedSignature` field on `SlideGroup`, vs. a separate stamp) is Claude's Discretion per
Phase 26 CONTEXT — but whatever shape is chosen, the comparison must be against the CURRENT
`sourceSignature`, so a *further* source change after a dismissal still re-prompts.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Drawer title | `Edit Slide` (verbatim, mockup) |
| Drawer close | icon-only ✕, `aria-label="Close"` (matches `SongSlideOver.vue` exactly) |
| Autosave status (replaces Save/Cancel, Mockup Correction #6) | `Saving…` → `Saved` (brief flash), reusing the exact Roles-tab convention (quick-task 260714-e7o) |
| Field labels | `Slide Label`, `Slide Text`, `Slide Audio`, `Notes` (verbatim, mockup) |
| Notes sub-label | `Notes (operator only)` — verbatim, mockup |
| Audio scope labels | `Play this audio for` / `This slide only` / `All slides in this group` (verbatim, mockup) |
| Loop label | `▣ Loop until the next slide` (verbatim, mockup) |
| Loop-disabled note (new, group-bed state) | `Group music doesn't loop — it plays continuously across the group.` |
| Audio remove | `Remove` (verbatim, mockup — reversible, unconfirmed) |
| Duplicate | `Duplicate` (verbatim, mockup vocabulary from Turn 2; new placement here per D-04) |
| Delete trigger | `Delete Slide` (verbatim, mockup) |
| Delete confirm body | Four variants, see `## Duplicate and Delete Slide` table above |
| Delete confirm actions | `Cancel` / `Delete` (matches `SongSlideOver.vue`'s own delete-confirm block exactly) |
| Edit-in-song link | `Edit in song` (verbatim, D-14/D-15) |
| Edit-in-scripture link | `Edit in scripture` (verbatim, D-15) |
| Unsaved-edit guard (D-16) | `You have unsaved changes. Discard them?` — reuses `useUnsavedGuard`'s existing copy verbatim, no new string |
| Reconciliation modal | See `## Reconciliation Confirm Modal` above — both copy variants |
| Media-unavailable (expired/deleted audio file, R015) | `Unavailable` badge on the file row + reuse whatever degraded-state text `AudioPlayer`'s chromeless mode already renders (Phase 23 convention) — do not author new copy for this |

---

## UI Considerations

Applicable state considerations resolved: 5 covered, 2 backstop, 1 unresolved (flagged, not silently dropped).

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Edit Slide drawer (detail-panel) | ✅ covered | "No slide selected" is not a placeholder empty state — the drawer simply does not mount (D-03: it follows `selectedSlideId`, which Phase 25's seam already guarantees is `null` when nothing valid is selected) |
| empty | Slide Audio section, no file attached | ✅ covered | Scope pill + `SlotMediaAttachment.vue`'s existing empty-state upload affordance, reused verbatim — see `## Slide Audio` |
| partial | Slide Text field, per `sourceRef.kind` | ✅ covered | Full per-kind matrix in `## Slide Text — per-kind treatment` |
| zero-one-many | Reconciliation modal counts (`N slides`) | ✅ covered | Singular/plural handled in the `{N} slide{s}` template; zero-loss case drops the `including…` clause entirely |
| destructive | Delete Slide / per-slide audio Remove | ✅ covered | Two distinct severities (reversible vs. destructive-confirmed) — see `## Duplicate and Delete Slide` and `## Slide Audio` |
| error | A slide's audio file has expired/been deleted (R015's 2-week retention) | 🧪 backstop | Reuses `AudioPlayer`'s existing chromeless degraded-state handling (Phase 23) rather than inventing new UI, but no existing pattern combines that with a drawer's own "Unavailable" file-row badge — flagged for explicit verification rather than assumed to just work |
| error | Reconciliation modal opened for a group whose `PendingReconciliation` entry has disappeared mid-session (source resolved itself, e.g. another tab dismissed it first) | 🧪 backstop | Modal should simply not be openable / auto-closes if its `pendingForSelected` entry vanishes — no existing multi-tab-race pattern in this codebase to point to, flag for verify |
| data-model | D-08 song-identity-swap copy's old/new song names | ⚠ unresolved | `PendingReconciliation` has no field for this today — see the explicit ⚠ flag in `## Reconciliation Confirm Modal`; planner must decide the shape, this spec only fixes the copy contract that shape must satisfy |

<!-- Status vocabulary (locked by probe-core projectTruths):
     ✅ covered   → a plain truth string lifted into must_haves.truths
     🧪 backstop  → a flat scalar { statement, verification: backstop }; at verify time, no explicit
                    evidence → insufficient_spec → human_needed (never a silent pass, #1154)
     ⚠ unresolved → an explicit planner assumption (surfaced, never silently dropped)
     Rows are REPLACED (not appended) on a probe re-run — idempotent. -->

---

## Accessible names for icon-only controls

Resolves the same `gsd-ui-checker` Dimension 2 requirement Phase 25 already satisfied — restated
for this phase's new icon-only controls (text-labeled buttons like `Duplicate`/`Delete Slide`/
`Remove`/`Apply source changes`/`Dismiss` already carry their own accessible name via visible text
and need no `aria-label`):

| Control | Icon | `aria-label` |
|---|---|---|
| Drawer close | ✕ | `Close` (matches `SongSlideOver.vue` verbatim) |
| Video preview glyph | ▶ (static, non-interactive) | none needed — not a control, purely decorative; if it must be focusable for any reason, `aria-hidden="true"` instead |

---

## Registry Safety

Not applicable — no shadcn, no component registry of any kind used in this project (inherited from Phase 25).

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable |
| third-party | none | not applicable |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS *(expect a re-flag against the ≤2-weight/≤4-size defaults —
      resolution is the inherited Phase 25 developer sign-off restated above, not a redesign)*
- [ ] Dimension 5 Spacing: PASS *(expect a re-flag against the 6px `gap-1.5` default — same inherited
      resolution)*
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

> **Note for the checker, planner, and executors:** the Typography and Spacing exceptions in this
> spec are NOT new requests — they are Phase 25's ALREADY-APPROVED exceptions, restated here because
> this drawer is visually part of the same surface (D-01 reuses `SongSlideOver.vue`, which itself
> predates and matches Phase 25's app-wide grounding evidence). If blocked again, point back to the
> 2026-07-26 owner sign-off recorded in `25-UI-SPEC.md` rather than re-litigating or diluting the
> drawer's typography/spacing to a generic default that would make it inconsistent with the grid it
> opens over.
