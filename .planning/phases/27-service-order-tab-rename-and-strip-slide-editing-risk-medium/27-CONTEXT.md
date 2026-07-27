# Phase 27: Service Order Tab — Rename and Strip Slide Editing - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning
**Milestone:** v1.3 — Slides Tab Rework
**Mode:** Smart discuss (autonomous) — 3 decisions, all resolving conflicts found by codebase inspection

<domain>
## Phase Boundary

Rename the first tab from **Music** to **Service Order** and remove the slide-editing surfaces that
accumulated on it during Phases 18–23, so slide editing lives on the Slides tab (Phases 25–26) and the
first tab returns to being the order of service.

This is primarily a **REMOVAL** phase. `src/views/ServiceEditorView.vue` has grown from 2370 lines at
`origin/master` @ `9f3700f` to 2847 (+497/−20 against that baseline). Much of that growth is Phase
24–26 work that must STAY.

### Starting state (verified in the codebase, not assumed)

Slide-editing surfaces currently mounted on the Music tab:

| Surface | Line (approx) | Fate |
|---|---|---|
| `PptxImportModal` (section-scoped import) | 257 | **remove from this tab** (component itself survives — `SlideGrid` imports it) |
| `ScriptureSlideEditor` | 739 | **STAYS** — see D-01 |
| `ImportedSlideEditor` | 919 | remove |
| `SlotMediaAttachment` | 937 | remove |
| Section-assignment `<select>` | 950 | **STAYS** — see D-04 |
| `Import PowerPoint / Images (Announcements)` button | 1004 | remove |
| `Import PowerPoint (Sermon)` button | 1005 | remove |
| `SlideshowPreview` | 1011 | remove |

Import-graph facts (verified — `grep` on real `import` statements, not comment mentions):
- `ScriptureSlideEditor`, `ImportedSlideEditor`, `SlotMediaAttachment`, `SlideshowPreview` are imported
  **only** by `ServiceEditorView.vue`. Removing their usages orphans them.
- `ImportedSlideEditor.vue` itself imports `ScriptureSlideEditor` — check that edge before deleting.
- `PptxImportModal` is **also** imported by `src/components/slides/SlideGrid.vue` (Phase 25's D-15
  reuse), so the component file must NOT be deleted.

</domain>

<decisions>
## Implementation Decisions

### D-01 — Scripture editing STAYS on the Service Order tab *(locked; resolves a Phase 26↔27 conflict)*

**The conflict, found by inspection:** Phase 26's "Edit in scripture" link
(`handleNavigateToScriptureEditor`, `ServiceEditorView.vue:1374`) sets `activeTab = 'music'`, calls
`expandScriptureEditor(index)`, and scrolls to `[data-scripture-panel-index]`. It navigates **back to
the Music tab**. A literal reading of Phase 27 would strip `ScriptureSlideEditor` and break a link
Phase 26 shipped three plans earlier.

The ROADMAP claimed Phase 27 "runs after 25-26 so the functionality has a new home before it leaves the
old one" — but scripture editing never got that new home; Phase 26 pointed back at the old one instead.

**Decision:** choosing the passage and reading mode is **service-order content, not slide editing** —
it defines WHAT is read, exactly as picking a song defines what is sung. `ScriptureSlideEditor` stays
mounted on the Service Order tab, Phase 26's link keeps working unchanged, and Phase 27 strips only the
genuine slide surfaces.

**Consequence:** the phase goal's "remove EVERY slide-editing surface" is narrowed by this decision.
Do not treat that ROADMAP phrasing as authority over D-01.

### D-02 — Delete whatever ends up genuinely unused *(locked)*

Apply **D-19** (greenfield — delete, don't deprecate) literally. After the strip, any of
`ImportedSlideEditor`, `SlotMediaAttachment`, `SlideshowPreview` with no remaining importer is
**deleted**, along with its test file. Do not leave unmounted dead components on disk.

**Verify before each deletion** — the import graph shifts as you go:
- `PptxImportModal.vue` **must survive** (`SlideGrid.vue` imports it).
- `ScriptureSlideEditor.vue` **must survive** (D-01 keeps it mounted).
- `ImportedSlideEditor.vue` imports `ScriptureSlideEditor` — deleting the former does not endanger the latter.
- `SlotMediaAttachment.vue` is referenced in *comments* by several `src/components/slides/` files but
  imported by none of them. Comment mentions are not usage; update the stale comments when you delete it.
- Re-run the import check immediately before deleting, not from this document's snapshot.

### D-03 — Rename the label AND the internal `activeTab` value *(locked)*

`activeTab` becomes `'service-order' | 'roles' | 'slides'` (from `'music' | 'roles' | 'slides'`).
Touches every call site including Phase 26's `handleNavigateToScriptureEditor` (which sets
`activeTab.value = 'music'`) and the Phase 25 tab button. More call sites than a label-only rename, but
leaves no stale vocabulary behind.

### D-04 — The section-assignment control STAYS *(Claude's discretion, stated)*

Phase 20 added a per-slot section `<select>` (Pre-Service / Worship / Message / Sending). Sections
drive slideshow assembly, but assigning an item to a section is **service structure**, not slide
editing — the same reasoning as D-01. It stays on the Service Order tab.

Stated rather than asked, so the planner does not have to invent it. Overridable.

### Claude's Discretion

How far to mechanically align the remaining tab with `9f3700f` (a literal revert is NOT wanted — Phases
24–26 changed this file legitimately), whether the strip lands as one plan or several, and the ordering
of removal vs rename.

</decisions>

<hard_constraints>
## What must NOT be removed

`ServiceEditorView.vue` is +497 lines over the `9f3700f` baseline, and most of that is Phase 24–26 work
that must survive. **This phase is a targeted strip, NOT a revert to `9f3700f`.** Specifically preserve:

- **Phase 24 D-01's lazy `ServiceSlot.id` backfill** — services are real production data; this is the
  one legacy path on the KEEP side of D-19's boundary (see `.planning/STATE.md`).
- **The Slides tab itself** — its button, its `v-show` panel, and `SlidesTab` mounting (Phase 25).
- **The group delete cascade + its warning** (Phase 24 R029/D-03, plan 24-06).
- **`expandScriptureEditor` and `handleNavigateToScriptureEditor`** (Phase 26 plan 26-03) — D-01 keeps
  the target they navigate to.
- **The group-bed audio write path** (`onSlotBedAudioChange`, `displaySlotAudioUrl`) — Phase 25/26 own
  the control surface, but the slot-level entry point in this view is still live. Check before removing.
- **Autosave** — the `localService` deep watch, 800ms debounce, saving guard, and idle/saved merge rule.

## Standing milestone decisions

- **D-18:** no bed video; the group bed is audio-only.
- **D-19:** no legacy compatibility in the slide area — delete rather than deprecate. Exception: the
  `ServiceSlot.id` backfill above. Full boundary table in `.planning/STATE.md`.
</hard_constraints>

<canonical_refs>
## Canonical References

- `origin/master` @ `9f3700f` — the production behaviour reference for the first tab. **Reference, not
  a revert target.** Compare with `git diff 9f3700f..HEAD -- src/views/ServiceEditorView.vue`.
- `docs/design/README.md` — records the mockup-vs-instruction delta: the mockup's tab bar says `Music`;
  the instruction (D009) renames it to **Service Order**, and the instruction wins.
- `.planning/milestones/v1.2-REQUIREMENTS.md` — R034. (There is no `.planning/REQUIREMENTS.md`.)
- `.planning/STATE.md` — the ★ v1.3 STANDING DECISIONS section and the greenfield/production boundary.
- `.planning/phases/26-edit-slide-drawer-risk-medium/26-03-SUMMARY.md` — the scripture relay D-01 protects.

</canonical_refs>

<code_context>
## Existing Code Insights

- The tab bar lives at `ServiceEditorView.vue:~400-420`; `activeTab` is declared around line 1182 and
  was widened to three members by Phase 25.
- Phase 25 added `data-scripture-panel-index` to the scripture panel for Phase 26's scroll-into-view.
  D-01 keeps that working; do not remove the attribute.
- `SlotMediaAttachment` was retargeted at the group bed in 24-06 and its video half was removed in
  25-02 under D-18 — so what remains on this tab is an audio-only control that `SlideGroupMusicControl`
  (25-06) has largely superseded.
- Removing template blocks from this file has repeatedly broken `ServiceEditorView.test.ts` at MOUNT,
  not at assertion — the suite needs Pinia mocks for `scriptureSlides`, `importedSlides` AND
  `slideGroups`, plus `enableAutoUnmount(afterEach)` for the 800ms autosave timers.

</code_context>

<specifics>
## Specific Ideas

- The tab label is exactly **"Service Order"** (two words, title case), per D009 and Phase 25's already-shipped
  rail note "order locked ⇄ Service Order" — which anticipated this rename and must now match.
- Deleting a component file means deleting its `__tests__` counterpart too; a test file for a deleted
  component is dead weight that will confuse the next reader.

</specifics>

<deferred>
## Deferred Ideas

- **Mechanically re-aligning the rest of the tab with `9f3700f`** beyond the slide-editing strip —
  out of scope; Phases 24–26 changed this file legitimately.
- Everything still deferred from Phases 24–26: `UNANCHORED`/orphaned slides, `Tag`/`Details`, a
  reconciliation diff view, per-service slide text overrides, keyboard slide reordering, formatted
  slide rendering, the `List` view toggle.

</deferred>
