# Design references

## `slides-tab.dc.html`

Verbatim export of `Slides Tab.dc.html` from the Claude Design project
**"Worship Planner Slideshow Design"** (`e8e6c287-3e88-402f-88e1-7ad6d5101fa2`),
pulled 2026-07-25. Source of truth for the Phase 24 Slides-tab rework.

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
