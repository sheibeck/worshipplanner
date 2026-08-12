# Quick Task 260811-vsr: Service-editor UI pass — consolidate inputs, stacked layout, No-Section indicator - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning

<domain>
## Task Boundary

A UI pass over the service-editing screen (`ServiceEditorView.vue`) with three parts:
1. **Consolidate redundant inputs** — items that show two overlapping text boxes (the Phase 43 body
   `<textarea>` AND the Phase 54 `notes` field) collapse to ONE field. Applies to MISC, Message,
   Announcements, and Prayer.
2. **Consistency + mobile pass** — every item type currently lays out differently (Scripture: label
   left + picker right; Song: label above picker). Unify into one clean, consistent, **stacked**
   layout that reads well and works on a phone.
3. **"No Section" indicator** — items not yet placed in a section render with no header after
   Post-Service, so they look like they belong to Post-Service. Give the ungrouped bucket a clear,
   distinct label.

Scope is the service-editor screen and the downstream consumers of the consolidated field (PC export,
print). Plain-text only (no rich text).

</domain>

<decisions>
## Implementation Decisions

> **UPDATE 2026-08-11 — a Claude Design mockup now drives this task.** The owner imported a design
> project ("Worship Planner Slideshow Design", file `Slides Tab.dc.html`, Turn 4a desktop + 4b
> mobile) as the authoritative visual target: *"update the UX like this for the service plan… don't
> change any functionality."* The distilled visual contract lives in **`260811-vsr-DESIGN-SPEC.md`
> (read it — it is the primary spec for layout).** It is a superset of decisions 2 and 3 below and
> maps onto the app's existing dark **indigo** theme (NOT the mockup's raw hex). Two decisions the
> owner locked on top of the mockup:
> - **Per-row ⋯ menu owns BOTH section-change and delete** — the inline section `<select>` AND the
>   inline ✕ remove button are removed; both move into a per-row 3-dot menu (Move to section →,
>   Delete). Owner: *"Move it into the 3 dot menu, and put the delete in there, too so we don't have
>   the x."* Keeps a reliable non-drag section-change path (v1.6 drag fixes 51–55 aren't owner-verified).
> - **Plain kinds get ONE input each** — the mockup drew two boxes (content + notes) for
>   Prayer/Misc/Announcements; owner: *"We don't need two inputs there, just one input each."* That
>   one field is the notes-canonical field (decision 1). Selector kinds (Song/Scripture) keep
>   selector + one notes field.

### 1. Consolidated field = `notes` (owner decision), migrate consumers with a legacy fallback
- For MISC / Message / Announcements / Prayer, show **ONE** text field: the **`notes`** field. Remove
  the body `<textarea>` from the UI for these kinds.
- **Owner's explicit choice:** "Use the notes field instead of the textarea, but we then migrate that
  to planning center." So `notes` becomes the canonical free-text for these plain items, and the
  consumers that read `body` today must be migrated to read `notes`.
- **CRITICAL — `body` is load-bearing today; migrate read-side, do NOT destroy data:**
  - `ServicePrintLayout.vue:64-81` renders `slot.body`.
  - Planning Center export sends `slot.body` as the item description (quick task `260809-vvq`; the
    `otherSlots` bucket for PRAYER/MESSAGE/ANNOUNCEMENTS/MISC).
  - Phase 52 R116 pre-fills MISC `body` in the default-service template; the template editor's Misc
    body input writes `body`.
  - The slide materializer references `body` (`slideGroupMaterializer.ts:313`).
- **Migration approach (non-destructive, no data migration):** read **`notes ?? body`** (prefer
  `notes`, fall back to legacy `body`) at every consumer — PC export, print, and any slide use — so
  existing services with `body` still show/export correctly while new edits write `notes`. In the
  editor, the single field for these kinds binds to a value that reads `notes ?? body` and **writes
  `notes`** (so a legacy `body`-only item shows its content and, on next save, persists to `notes`).
  Keep the `body` field on the types for backward-compatibility (do not remove it).
- The template editor's Misc body input (Phase 52 R116) should likewise write **`notes`** so a
  pre-filled template value flows into the new field consistently (read-fallback covers existing
  templates). The planner should confirm the exact template-editor seam.
- For items WITH a selector (Song, Scripture, Hymn, Imported), the `notes` field keeps its Phase-54
  meaning (leader / who-sings-what) and sits in the same consolidated layout.

### 2. Layout = STACKED, consistent across all item kinds (owner decision)
- **Owner:** "having items side by side is what looks ugly. We might want to stack everything." So
  **walk back Phase 54's side-by-side** — stack the fields vertically within each item.
- Every item type uses the SAME shape: a small kind label (e.g. "Song", "Scripture", "Prayer") on top,
  then the selector/content field, then the `notes` field, **stacked vertically** (full-width, not
  side-by-side). Consistent label placement for ALL kinds (fixes Scripture-left vs Song-above).
- Naturally mobile-friendly (stacked is single-column). Keep the row chrome (drag handle, section
  dropdown, remove control) as-is; the change is within the item's content area.
- Clean, uncluttered, intuitive. The owner will visually verify feel — aim for tidy vertical rhythm and
  clear labels, consistent spacing across kinds.

### 3. "No Section" indicator = labeled muted/dashed band (owner choice)
- The ungrouped / legacy `groupBySection` bucket (items whose `section` is absent/unrecognized —
  `slotTypes.ts` routes these to the trailing bucket, rendered today with no header) gets a **header
  band like the real section headers**, but styled **muted / dashed** to signal "not placed yet".
- So its items read as a distinct group, clearly separate from Post-Service (the last real section) —
  fixing the current confusion where un-sectioned items look like part of Post-Service.
- Label it clearly (e.g. "No Section" / "Not in a section yet"). Only render the band when the bucket
  is non-empty.

### Claude's Discretion
- Exact label text/wording, precise spacing/typography of the stacked layout and the No-Section band,
  and the exact migration seam (computed binding vs. helper) are at Claude's discretion, subject to the
  locked decisions above: notes-is-canonical + `notes ?? body` read-fallback (no destructive data
  migration, `body` field retained), stacked layout, muted/dashed No-Section band.

</decisions>

<specifics>
## Specific Ideas

- Owner: "we don't need a <textarea> AND a notes field for miscellaneous. That can just be the notes
  field and get rid of the <textarea>. Same thing for Message, and Announcements. Prayer has 3 input
  fields now, get rid of the original two and just keep the notes field."
- Owner: "Scripture Reading label is on the left with the picker on its right, but Song label is above
  the song picker, etc. This is just ugly and not intuitive. We really want this screen to look nice
  and be mobile friendly."
- Owner (Q1): "Use the notes field instead of the textarea, but we then migrate that to planning
  center."
- Owner (Q2): "Right now having items side by side is what looks ugly. We might want to stack
  everything. That might be better than side by side."
- Owner (Q3): labeled muted/dashed "No Section" band chosen.

</specifics>

<canonical_refs>
## Canonical References

- Phase 54 (R122 notes field, R123) — the phase that introduced the notes field beside each selector;
  this task reworks its side-by-side layout into a stacked one and consolidates plain items onto notes.
- Phase 52 R116 — the template editor's Misc body pre-fill (align to write `notes`).
- Quick task `260809-vvq` — PC export sends `slot.body` for PRAYER/MESSAGE/ANNOUNCEMENTS/MISC via the
  `otherSlots` bucket (migrate to `notes ?? body`).
- `QuarterView.vue` — the project's responsive stacking recipe (stacked is now the default direction).
- Gates (CLAUDE.md): `npm run type-check` (= vue-tsc --build); app suite `npx vitest run --dir src
  --exclude '**/rules.test.ts'`; 2-file known-failing baseline (`storage.rules.test.ts`,
  `RosterView.test.ts`).

</canonical_refs>
