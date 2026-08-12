# Phase 52: Default Service Template - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (owner away — grey areas auto-decided at Claude's discretion, grounded in a live read of the template editor, Settings mount, and `createService`)

<domain>
## Phase Boundary

The default service template lives where it is used — on the Services page behind a cog — is the
universal starting point for every new service, and can pre-fill recurring Miscellaneous content.
Requirements R113 (relocate editor to the Services page cog, off main Settings), R114 (rename the seed
button to "Suggested Template", decouple from Vertical Worship), R115 (every new service starts from the
Suggested Template — no blank path), R116 (Miscellaneous items in the template expose a body input).

Builds on Phase 51's now-stable per-section drag machinery in `ServiceTemplateEditor.vue`.

</domain>

<decisions>
## Implementation Decisions

### R113 — Relocate the template editor to the Services page
- Move the `<ServiceTemplateEditor :is-open @close>` mount and its trigger from `SettingsView.vue`'s
  "Services" card (SettingsView.vue:462-482) to `ServicesView.vue`, opened by a **cog/settings icon**
  in the Services page header/action area. Remove the "Services" card from `SettingsView.vue` entirely
  (heading, description, summary line, button, mount, import).
- The cog is editor-gated the same way the current button is (`authStore.isEditor`); a viewer either
  does not see it or sees it disabled, matching the existing convention.
- The editor component itself (`ServiceTemplateEditor.vue`) is unchanged in structure — only its mount
  point moves. It already teleports/slides out, so it works from either host.

### R114 — "Suggested Template", decoupled from Vertical Worship
- Rename the existing seed control (currently "Reset to 1-2-3 default" / labelled around
  `onResetClick`/`applyReset`, ServiceTemplateEditor.vue:425-446) to **"Suggested Template"**.
- Remove any `v-if`/visibility tie to `vwModeEnabled` on that button — it shows whether or not VW mode
  is on. Its label and availability carry no dependence on the 1-2-3 progression.
- The seed CONTENT stays `buildSlots('1-2-2-3')`-derived (the same preset), but it is now framed as
  "the suggested starting template," not a VW artifact. Keep the confirm-on-non-empty-draft guard.

### R115 — Every new service starts from the Suggested Template (supersedes v1.5)
- **This supersedes v1.5 Phase 44 Success Criterion #2 ("no template → EMPTY service").** Owner
  decision, PROJECT.md Key Decisions "Blank service template eliminated." There is no blank-template
  starting path.
- **Mechanism: fallback at the `createService` call site, NOT a data migration.** `createService`
  (services.ts:233-244) currently calls `buildSlotsFromTemplate(defaultServiceTemplate, vwModeEnabled)`
  which returns `[]` for an unset template. Change the CALL SITE so that when
  `defaultServiceTemplate` is empty/unset, it seeds from the **Suggested Template** preset (the same
  `buildSlots`-derived entry list R114's button uses) instead of `[]`. A church that never customizes
  still gets the Suggested Template.
  - **Keep `buildSlotsFromTemplate` pure** — do not reinstate the old `buildSlots()` fallback *inside*
    it (its docstring explicitly forbids that). The suggested-template fallback is a decision the
    caller makes; express it as an explicit "resolve the effective template" step before calling
    `buildSlotsFromTemplate`, or by passing the suggested entries in.
  - **VW types still applied at creation** (criterion 3): when `vwModeEnabled` is true, the template's
    SONG slots receive their VW types via the existing `progressionVwTypeSequence` ordinal walk in
    `buildSlotsFromTemplate`. This already works for a customized template; it must also work for the
    suggested-template fallback.
  - Update the now-stale comments in `createService` (lines 235-239) and `buildSlotsFromTemplate`'s
    docstring that describe the empty-by-default behavior — they are being deliberately reversed.

### R116 — Miscellaneous body input inside the template
- Extend `ServiceTemplateEntry` (`src/types/organization.ts`) with an optional `body?: string`.
- The template editor exposes the **same body `<textarea>`** the live editor (`ServiceEditorView.vue`)
  uses for a Miscellaneous item, shown for MISC template entries (and any other body-bearing kind the
  live editor treats the same way — confirm the exact set in research; MISC is the named case).
- Thread `body` through `buildSlotsFromTemplate` → `createSlot` so a template MISC entry with pre-filled
  body produces a service MISC slot carrying that body. The `NonAssignableSlot.body?: string` field
  already exists from Phase 43; `createSlot` must accept/set it for the relevant kinds (today it does
  not set `body`). Prefer a minimal, exhaustiveness-safe change consistent with Phase 43's pattern.

### Claude's Discretion
- Exact cog icon/placement on the Services page, the precise mechanism for expressing the
  suggested-template fallback (resolve-effective-template helper vs. inline), and how `body` is
  threaded (createSlot param vs. post-create assignment) are at Claude's discretion, subject to: keeping
  `buildSlotsFromTemplate` pure, exhaustiveness (`npm run type-check` = vue-tsc --build must stay
  clean), and no data migration.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/slotTypes.ts` — `buildSlots('1-2-2-3')` (the suggested preset content), `buildSlotsFromTemplate` (template → slots with VW typing), `progressionVwTypeSequence`, `createSlot`, `reindexSlots`.
- `src/components/settings/ServiceTemplateEditor.vue` — the slide-out editor (Phase 44), now with Phase 51's stable per-section drag. `applyReset()` at line 438 is the seed to rename; `onSave` mirror-writes `defaultServiceTemplate` via a dot-path leaf key.
- `src/views/SettingsView.vue` — the "Services" card (462-482) + mount (482) + import (492) to REMOVE.
- `src/views/ServicesView.vue` — the Services listing page (new host for the cog + editor mount); also where `ServiceCard` renders (Phase 51 R112).
- `src/stores/services.ts` — `createService` (233-244) is the R115 call site.
- `src/types/organization.ts` — `ServiceTemplateEntry` (`{ id, kind, section? }`) to extend with `body?`.
- `src/types/service.ts` — `NonAssignableSlot.body?: string` (Phase 43) already exists.

### Established Patterns
- Settings writes use quoted Firestore dot-path leaf keys (never whole-map), then reassign the store — `ServiceTemplateEditor.onSave` and `SettingsView.onToggleVwMode` both follow it.
- `createSlot`'s `switch (kind)` is exhaustive with no `default` — any new field threading must keep `vue-tsc --build` green (CLAUDE.md).
- The live editor's Miscellaneous body input is the UI to mirror for R116.

### Integration Points
- Services page header/action bar — new cog trigger (R113).
- `createService` — suggested-template fallback (R115).
- `buildSlotsFromTemplate` / `createSlot` — `body` threading (R116).

</code_context>

<specifics>
## Specific Ideas

- Owner: "Services Template should go into the Services page, not the main settings page. Add a cog or
  settings button on the services page that leads to the default service."
- Owner: "keep that [Default to 1,2,3] button and just rename it to 'Suggested Template'. We don't have
  to associate that template with 1,2,3 Vertical Worship at all. In fact, we should just default
  everyone to this as the starting template and not have a blank template at all!"
- Owner: "When we add a miscellaneous item to our template, include the input box so we can default to
  some things that always happen. Like canned music, more announcement slides, etc."

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (The item notes-field beside selectors is Phase 54; the
Misc-items-default-to-no-slides behavior is also Phase 54.)

</deferred>
