# Quick Task 260805-bvo: Scripture reference styling + collapse Edit lyrics into Edit details - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning

<domain>
## Task Boundary

Two unrelated defects reported together from the running app:

1. **Scripture reference renders as a blue label.** On the Present screen a
   scripture slide shows its reference in `text-indigo-400 uppercase
   tracking-wider`, so the passage reads as a label rather than slide content.
2. **Non-song slides carry two menu items.** The 3-dot menu on a Prayer item
   offers both "Edit details" and "Edit lyrics". It should offer only "Edit
   details", and that drawer should edit both the label and the text.
</domain>

<decisions>
## Implementation Decisions

### D1 — Which blue element (owner-selected)

`PresentationViewer.vue:105-110`, the `presentation-label` element inside the
`slideKind === 'scripture'` branch. Confirmed as the reference line, not the
Leader/Congregation speaker tags (`:121`) and not the slide card's `SCRIPTURE`
eyebrow (`SlideCard.vue:28`). The verse body at `:136` is already
`text-gray-100` and is NOT the problem.

The reference must read as slide content in the same white treatment the other
kinds use. Drop `text-indigo-400`, `uppercase`, and `tracking-wider`; adopt
`text-gray-100`. Retain the `text-2xl font-semibold leading-[1.3] mb-8` sizing
so a slide carrying BOTH a reference and verse text keeps a visual hierarchy —
this mirrors the copyright branch (`:84-92`), where the title is `text-6xl
text-gray-100` and the secondary author line is `text-2xl text-gray-300`.

### D2 — Hymn carve-out is dropped (owner-selected, overrides 33-UI-SPEC §3 row 3a)

Owner verbatim: *"This only non-editable thing should be Song. Everything else
can be editable. Hymns are a special thing for now only. In the future we'll
get rid of that item and just make them regular songs again, but not yet."*

So: **every** `text` slide gets an editable body in details mode, including a
HYMN group's auto-derived pristine text slide (`sourceRef.body === undefined`).
The `hasBody || planItemKind === 'PRAYER' || planItemKind === 'MESSAGE'`
discriminator in `slideActionMenuItems` becomes dead and goes away along with
the `edit-lyrics` key.

This is a deliberate, owner-authorised reversal of the anti-shadow-copy rule
recorded in `slideDisplay.ts:276-286`. A hymn slide edited here can diverge
from its Service Order Hymn fields; the owner accepts that as temporary.

`lyric` and `copyright` entries (always inside a SONG group, R054/P-03) remain
read-only — that carve-out is NOT dropped.

### D3 — Scripture menu untouched (owner-selected)

Scripture keeps `edit-details` + `edit-in-scripture` ("Edit scripture text").
That second item opens the congregational editor modal, a purpose-built editor
that is not the drawer. Folding it in is explicitly out of scope.

### Claude's Discretion

- Whether `mode: 'details' | 'lyrics'` stays as a prop or is removed outright.
  `lyrics` mode becomes unreachable from the 3-dot menu once `edit-lyrics` is
  gone; removing the prop is cleaner but touches more call sites and tests.
  Prefer whichever leaves fewer dead branches, and state which was chosen.
- The exact replacement for the `drawer-slide-text-caption` copy at
  `EditSlideDrawer.vue:217` ("Edit this slide's text via Edit lyrics"), which
  becomes false once the textarea is editable in place. Deleting the caption
  entirely is acceptable.
</decisions>

<specifics>
## Specific Ideas

Live-source anchors, all verified 2026-08-05 (do not re-derive; DO re-verify
line numbers before editing, they drift):

| What | Where |
|---|---|
| Blue scripture reference | `src/components/PresentationViewer.vue:105-110` |
| Second `presentation-label` (TextSlide title) | `src/components/PresentationViewer.vue:146` — **out of scope**, see below |
| Menu item table | `src/components/slides/slideDisplay.ts:303-342` |
| `MenuItemKey` union + labels | `src/components/slides/slideDisplay.ts:18-19, 232-243` |
| Menu-action dispatch | `src/components/slides/SlidesTab.vue:467-471` |
| Drawer mode prop | `src/components/slides/EditSlideDrawer.vue:494-521, 621` |
| Drawer text branch (`sourceKind === 'text'`) | `src/components/slides/EditSlideDrawer.vue:189-219` |
| Slide Label input (already details-mode) | `src/components/slides/EditSlideDrawer.vue:111-120` |

**Out of scope, flagged deliberately:** `PresentationViewer.vue:146` is a
SECOND `presentation-label`, carrying a TextSlide's title. The owner reported
scripture only. After D1 the two will be styled differently — scripture white,
text-slide title still blue. That inconsistency is knowingly left in place
rather than silently widened; surface it, do not fix it.
</specifics>

<canonical_refs>
## Canonical References

- `33-UI-SPEC.md` § Phase-Specific Component Contracts §3 (menu table, row 3a's
  Hymn refinement) and §4 (details-vs-lyrics mode split) — **both partially
  superseded by D2**. Record the supersession where the spec is cited in code
  comments; do not leave the comments asserting a rule the code no longer
  follows.
- `R063` (per-kind menu contract), `R054`/`P-03` (song slides read-only),
  `R047` (scripture defaults to reference-only, empty `text` — which is why the
  blue reference is sometimes the ENTIRE visible slide content).
</canonical_refs>
