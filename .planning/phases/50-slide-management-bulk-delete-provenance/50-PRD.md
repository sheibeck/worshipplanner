# Phase 50 PRD — Slide Management: Bulk Delete, Manual/Auto Provenance & Render Fidelity

## Problem

Three defects/gaps surfaced while getting PPTX rendering working in production (2026-08-10),
plus a deploy-freshness annoyance:

1. **No bulk delete.** After importing a PPTX into a group, removing those slides means deleting
   them one card at a time.
2. **Regeneration risk.** Manually-added slides (imported PPTX, hand-added text/blank, added media)
   sit in a group alongside auto-generated ones. A service change rebuilds the group; the owner
   wants a guarantee that manual work is never destroyed by a rebuild — including a scripture slot
   toggling to/from a congregational reading.
3. **Multi-image render fidelity.** The interim fix (`ec217aa`) resolves hand-added imported slides
   only when the deck's parsed-slide count equals its rendered-page count (1:1). A multi-image deck
   (`mapAstToSlides` emits one entry per image, so more parsed slides than pages) still hangs on the
   "Rendering" spinner.
4. **Deploy cache.** After a production deploy, browsers keep a cached `index.html` and run the old
   bundle until a manual cache-clear (this cost real debugging time on 2026-08-10).

## Requirements

- **R106** — Per-group "Remove imported slides" bulk action.
- **R107** — Regeneration preserves all manually-added entries; only auto-generated (derived)
  entries re-derive.
- **R108** — Render-stable page identity so hand-added imported slides resolve for multi-image decks.
- **R109** — `index.html` served no-cache/revalidate so deploys are immediately visible.

## Locked decisions (owner, 2026-08-10)

1. **Bulk delete = per-group "Remove imported slides" action** — NOT a general multi-select/checkbox
   mode. One control on a group that removes exactly its `imported`-kind entries, leaving
   auto-generated and other manually-added entries intact. (Rejected: multi-select mode, and a
   combined both — keep it to the targeted action.)
2. **Regeneration ALWAYS preserves manual adds** — every user-added entry (imported PPTX slides,
   hand-added text/blank slides, added media) is preserved in place across any rebuild; only the
   auto-generated (derived) entries re-derive. No "re-sync the deck on re-import" behavior — manual
   adds are simply preserved. (Rejected: preserve-but-re-sync-on-reimport.)

## Acceptance criteria

1. **R106:** A per-group "Remove imported slides" control removes exactly the group's entries whose
   `sourceRef.kind === 'imported'` in a single operation; auto-generated and other manually-added
   entries are untouched; the control is only offered when the group actually has imported entries;
   it is editor-gated and respects the draft-lock like every other group mutation.
2. **R107:** Rebuilding a group (song/scripture/imported/etc.) preserves every non-derived entry in
   its stored order, including imported entries added into a non-imported group. A scripture slot
   toggling to/from congregational reading preserves manually-added entries in that group; only the
   derived scripture/section/reference entries change. Proven by tests over
   `slideGroupMaterializer.ts`'s rebuild paths.
3. **R108:** A hand-added imported entry resolves to the correct rendered page for a multi-image
   deck (parsed-slide count ≠ rendered-page count), via a render-stable page reference carried on
   the entry's `sourceRef` (not positional inference). The interim 1:1 positional resolver
   (`importedEntryContent`, ec217aa) is superseded/subsumed and single-image decks still resolve.
4. **R109:** `firebase.json` serves `index.html` with a no-cache/revalidate header so a normal load
   after a deploy fetches the current document and hashed bundle. Hashed assets keep their
   long/immutable cache.
5. `npm run type-check` clean; app suite at the documented 2-file baseline; new/updated tests for
   R106–R108.

## Design guidance (verify against real code before finalizing)

- **R106** — the removal is a `replaceGroupSlides(orgId, slotId, slidesWithoutImported)` on the
  slide-groups store (`src/stores/slideGroups.ts`), filtering out `sourceRef.kind === 'imported'`.
  UI control on the group panel in `src/components/slides/SlideGrid.vue` (mirror the existing group
  media/affordance patterns; editor + draft-lock gated).
- **R107** — leans on the EXISTING derived-vs-user-added split in `slideGroupMaterializer.ts`
  (`carryStoredDerivedEntries` carries derived entries; `survivingEntries` preserves user-added
  ones; `rebuildScriptureGroup`/`rebuildSongGroup`/`rebuildUnstableIdGroup`). The work is to
  VERIFY (and, where needed, guarantee) that imported entries added into a non-imported group are
  classified as user-added survivors and are preserved by every rebuild path AND by the
  scripture↔congregational transition. Do NOT weaken the existing detach/carry/signature
  invariants (see Phase 49 CONTEXT + `CLAUDE.md` on this subsystem).
- **R108** — carry a render-stable page reference on the imported entry's `sourceRef` (e.g. the
  source page number) at add-time, so `importedEntryContent` ready-mode maps directly instead of
  inferring position. Check whether `ImportedDeck.slides` already carry a source page/slide index
  (`pptxParser.ts::mapAstToSlides`) that the add-path can record. The interim positional resolver
  in `importedEntryReconciler` becomes the fallback for legacy entries that lack the new reference,
  or is removed if a one-time migration re-keys them — planner's call, but existing
  single-image entries must keep working.
- **R109** — add a `headers` entry under `hosting` in `firebase.json` for `index.html` (and, if a
  service worker exists, its script) with `Cache-Control: no-cache` (or `max-age=0, must-revalidate`).
  Leave hashed `assets/*` on their default immutable cache. Verify no service worker is caching the
  shell.

## Key files

- `src/stores/slideGroups.ts` — `replaceGroupSlides`, group mutations (R106).
- `src/components/slides/SlideGrid.vue`, `SlidesTab.vue`, `SlideCard.vue` — group UI (R106).
- `src/utils/slideGroupMaterializer.ts` — `deriveGroupEntries`, `carryStoredDerivedEntries`,
  `survivingEntries`, `rebuildScriptureGroup`/`rebuildSongGroup`/`rebuildUnstableIdGroup`,
  `sourceSignature` (R107).
- `src/utils/importedRenderReconciler.ts` — `importedEntryContent`, `importedEntryIdentities`,
  `renderedPageNumberFromIdentity` (R108, supersede the ec217aa positional stopgap).
- `src/utils/slideshowAssembler.ts` — `resolveEntryContent` imported case threads the page ref (R108).
- `src/types/slideGroup.ts` — `SourceRef` imported variant (add the page reference, R108).
- `src/utils/pptxParser.ts` (functions + client copies) — source page/slide index on parsed slides (R108).
- `firebase.json` — hosting headers (R109).
- `CLAUDE.md` — type-check + test gates; documented 2-file baseline.

## Out of scope

- General multi-select/checkbox delete UI (explicitly rejected in favor of the per-group action).
- Re-syncing a deck's added slides on re-import (explicitly rejected; manual adds are preserved).
- Any change to the server-side render pipeline (it works — Phase 42/37).
