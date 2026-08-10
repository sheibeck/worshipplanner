# Phase 50: Slide Management — Bulk Delete, Manual/Auto Provenance & Render Fidelity - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Source:** PRD Express Path (.planning/phases/50-slide-management-bulk-delete-provenance/50-PRD.md)

<domain>
## Phase Boundary

Four v1.5 follow-ups to slide management, all discovered while getting PPTX rendering working in
production on 2026-08-10:

- **R106** per-group "Remove imported slides" bulk action.
- **R107** regeneration always preserves manually-added entries (only auto-generated re-derive).
- **R108** render-stable page identity so hand-added imported slides resolve for multi-image decks
  (supersedes the interim ec217aa 1:1 positional resolver).
- **R109** `index.html` served no-cache so deploys are visible without a manual cache-clear.

No change to the server-side render pipeline (Phase 37/42 — it works). No general multi-select
delete UI. No deck re-sync on re-import.
</domain>

<decisions>
## Implementation Decisions

### Bulk delete (R106 — LOCKED, owner 2026-08-10)
- A per-group **"Remove imported slides"** action, NOT a multi-select/checkbox mode. Removes exactly
  the group's `sourceRef.kind === 'imported'` entries in one operation via
  `slideGroups` store `replaceGroupSlides(orgId, slotId, remaining)`; auto-generated and other
  manually-added entries untouched. Offered only when the group has imported entries. Editor-gated,
  draft-lock respected, mirroring the existing group affordances ("+ Add background/music for this
  group") in `SlideGrid.vue`.

### Regeneration provenance (R107 — LOCKED, owner 2026-08-10)
- Regeneration ALWAYS preserves manual adds. Every user-added entry (imported PPTX, hand-added
  text/blank, added media) survives any rebuild in its stored position; only auto-generated
  (derived) entries re-derive. No deck re-sync on re-import.
- Leans on the EXISTING derived-vs-user-added split in `slideGroupMaterializer.ts`
  (`carryStoredDerivedEntries` carries derived; `survivingEntries` preserves user-added). The work
  is to VERIFY/GUARANTEE imported entries added into a NON-imported group are classified as
  user-added survivors and preserved by every rebuild path AND by the scripture↔congregational
  transition. Do NOT weaken the detach/carry/signature invariants (Phase 49 CONTEXT + CLAUDE.md).

### Render identity (R108 — LOCKED intent, approach is Claude's Discretion)
- Carry a render-stable page reference on the imported entry's `sourceRef` at add-time so
  `importedEntryContent` ready-mode maps directly instead of inferring position. Must work for a
  multi-image deck (parsed-slide count ≠ rendered-page count). Existing single-image entries and
  the ec217aa positional fallback path must keep working (legacy entries lacking the new reference
  fall back to positional, or are re-keyed by a one-time migration — planner's call).

### Deploy cache (R109 — LOCKED)
- `firebase.json` hosting `headers` entry serving `index.html` no-cache/revalidate; hashed
  `assets/*` keep their immutable cache. Confirm no service worker caches the shell.

### UI (skip-ui rationale)
- The only new UI is one per-group control; it mirrors the existing group affordances, so no
  UI-SPEC is generated (`--skip-ui`). Follow the existing SlideGrid group-panel styling.

### Claude's Discretion
- Exact placement/label of the "Remove imported slides" control (with/without a confirm).
- The render-stable page-reference field name/shape and the legacy-entry migration vs fallback.
- Test organization.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bulk delete (R106)
- `src/stores/slideGroups.ts` — `replaceGroupSlides` + group mutations.
- `src/components/slides/SlideGrid.vue` — group panel + existing "+ Add background/music for this
  group" affordances to mirror; `SlidesTab.vue`, `SlideCard.vue`.

### Provenance / regeneration (R107) — read, do NOT weaken
- `src/utils/slideGroupMaterializer.ts` — `deriveGroupEntries`, `carryStoredDerivedEntries`,
  `survivingEntries`, `rebuildScriptureGroup`/`rebuildSongGroup`/`rebuildUnstableIdGroup`,
  `sourceSignature`, `derivedIdentityKey`.
- `src/utils/__tests__/congregationalDetachment.test.ts` — the scripture↔congregational behavior.

### Render identity (R108)
- `src/utils/importedRenderReconciler.ts` — `importedEntryContent` (the ec217aa positional stopgap),
  `importedEntryIdentities`, `renderedPageNumberFromIdentity`.
- `src/utils/slideshowAssembler.ts` — `resolveEntryContent` imported case.
- `src/types/slideGroup.ts` — `SourceRef` imported variant (add the page reference).
- `src/utils/pptxParser.ts` (+ `functions/src/pptxParser.ts`) — whether parsed slides carry a
  source page/slide index the add-path can record.

### Deploy cache (R109)
- `firebase.json` — hosting `headers`.

### Project rules
- `CLAUDE.md` — `npm run type-check` gate; app suite via `npx vitest run`; documented 2-file
  baseline (`storage.rules.test.ts`, `RosterView.test.ts`).
</canonical_refs>

<specifics>
## Specific Ideas

- Prior art this phase builds on: `1f3271a` (render subscription for imported entries in
  non-imported groups) and `ec217aa` (interim 1:1 positional resolver) — both live in production.
- Acceptance criteria AC1–AC5 in the PRD.
</specifics>

<deferred>
## Deferred Ideas

- General multi-select/checkbox delete UI — explicitly rejected in favor of the per-group action.
- Deck re-sync on re-import — explicitly rejected; manual adds are simply preserved.

## Security note
No new security surface: client-side slide-group mutation (existing editor/draft-lock rules apply)
plus a hosting cache header. Threat model N/A.
</deferred>

---

*Phase: 50-slide-management-bulk-delete-provenance*
*Context gathered: 2026-08-10 via PRD Express Path*
