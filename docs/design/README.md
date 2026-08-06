# Design references

## `slides-tab.dc.html`

Verbatim export of `Slides Tab.dc.html` from the Claude Design project
**"Worship Planner Slideshow Design"** (`e8e6c287-3e88-402f-88e1-7ad6d5101fa2`).

**RE-PULLED 2026-08-03 via the `DesignSync` tool** (`get_project` → `list_files` →
`get_file`). It had grown 49 KB → 93 KB since the 2026-07-25 pull, gaining a whole
new turn. **This is how to re-pull it** — no manual export needed:

```
DesignSync get_file  projectId=e8e6c287-3e88-402f-88e1-7ad6d5101fa2  path="Slides Tab.dc.html"
```

The project reports `type: PROJECT_TYPE_PROJECT` (not a design *system*), so it is
readable but not pushable via DesignSync — pull only.

**The single remote file is cumulative across design turns and is overwritten in
place — re-pull before planning any phase against it.** As of the 2026-08-03 export
it holds **three** turns, newest first:

| Turn | Screen | Options | Added |
|------|--------|---------|-------|
| **Turn 3** | **Service Order tab** | `3a` only — "Inline editing inside section bands" | **new since 2026-07-25** |
| **Turn 2** | Song lyrics editor (`Edit Song` → Lyrics tab) | `2a` and `2b` — **a choice, not both** | |
| **Turn 1** | Slides tab | `1a`, drawn in **two states** (drawer closed / `State 2 — Edit Slide open`) | |

**Turn 3 — Service Order tab** (`3a`). Everything stays inline — song pickers, passage
search, link fields, ✕ to clear. Added on top: the five section bands, per-section
＋ Add item, the add-to-service palette, and a slide count on every row. It also carries
the **`Paste lyrics`** affordance and the **`No copyright information found`** warning —
i.e. the wireframe for **R065 and R066 (Phase 35)**.

### ⚠ What is STILL not in the mockup (verified 2026-08-03, after the re-pull)

Checked by direct search of the refreshed file. These remain **original design work**,
not wireframe transcription:

| Needed by | Still absent |
|---|---|
| **Phase 36 (R068)** | **any contextual action bar** — zero matches for `action bar` / `contextual`. Turn 3 covers the Service Order *rebuild*, not the action-bar pattern. |
| Phase 33 (R051, R052) | any 3-dot / kebab menu; "Edit details" / "Edit lyrics" |
| Phase 33 (R055–R057) | background images as a feature |

Phase 33 shipped its affordances as original design work on exactly this basis, and its
UI-SPEC records which decisions were its own.

**Turn 1 — Slides tab.** Plan rail · slide grid · Edit Slide drawer. The rail mirrors
plan order and is *not* draggable — reordering happens on the Service Order tab. The
drawer "floats over the page; nothing underneath reflows."

**Turn 2 — Song lyrics editor.** Reworks the Phase 18 `SongLyricEditor.vue` +
`PerformanceOrderBuilder.vue` pair. Both options "kill the nested scrollbar and the
duplicate Available-Sections / Performance-Order lists: one scroll surface, one list
that IS the order."
- `2a` — one list of section cards, drag to reorder; the section list *is* the slide
  order; cards collapse to a one-line summary; repeats render as linked `CHORUS` rows.
- `2b` — "Switch to Sections to reorder" (a mode toggle rather than one always-drag list).

`2a` vs `2b` is an **open decision** to settle at that phase's discuss step.

It is a **Design Canvas mockup**, not runnable app code. It loads a generic
`support.js` runtime (~72 KB, `// GENERATED from dc-runtime/src/*.ts`) that
implements `<x-dc>`, `<helmet>`, `<sc-for>`, `<sc-if>`, `{{ }}` attribute
interpolation, `style-hover=`, and `class Component extends DCLogic`. That
runtime contains **no** project-specific design tokens and was deliberately
NOT vendored — do not port it. All of this mockup's design tokens live inline
in the HTML above.

Runtime semantics worth knowing when reading the mockup:

- `sc-if value="…"` is a true conditional mount — falsy unmounts, it does not CSS-hide.
- `style-hover="…"` compiles to a real scoped CSS `:hover` rule (declarations forced
  `!important`), not a JS mouseenter/leave toggle.
- `sc-for hint-placeholder-count="N"` only renders N placeholders while the list is
  still streaming; with a resolved array it renders normally.
- `DCLogic.setState` is React class `setState` semantics (shallow merge + re-render).

The `renderVals()` block at the bottom of the mockup is **sample data**
(`plan[]`, `slides[]`), not a schema. Treat the visual/interaction contract as
authoritative and the data shapes as illustrative only.

### Known deltas between the mockup and the agreed Phase 24 scope

The mockup predates two of the user's instructions. Where they disagree, **the
instructions win**:

1. The mockup's tab bar reads `Music | Roles | Slides`. The first tab is to be
   renamed **"Service Order"**.
2. The mockup's rail note says "order locked ⇄ Music" — same rename applies.

The mockup is also the reference for a **removal**: all slide-editing surfaces added
to the Music tab during Phases 18–23 come back out, so that tab returns to its
production behaviour (`origin/master` @ `9f3700f`) and slide editing lives only in
the new Slides tab.
