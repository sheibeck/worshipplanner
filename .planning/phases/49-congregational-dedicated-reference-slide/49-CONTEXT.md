# Phase 49: Congregational Reading — Dedicated Reference Slide - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Source:** PRD Express Path (.planning/phases/49-congregational-dedicated-reference-slide/49-PRD.md)

<domain>
## Phase Boundary

Change how a congregational scripture reading assembles into slides. Today N sections →
N slides, with the scripture reference shown as an eyebrow on the first section slide
(Phase 47 / R097). This phase makes the reading assemble to **N+1 slides**: a dedicated
scripture-reference slide first (byte-identical to a plain scripture reference slide),
then one text slide per section. Section slides show only scripture text + speaker label
— the reference eyebrow is removed.

This is a slide-assembly + slide-display change only. No editor/authoring UI changes, no
change to how sections are parsed/stored/detached, and no change to the group
rebuild/carry/signature reconciliation machinery.
</domain>

<decisions>
## Implementation Decisions

### Slide model (R105 — LOCKED)
- A congregational reading with N sections assembles to N+1 `AssembledSlide`s: index 0 is
  the reference slide (`readingMode: 'normal'`, empty `text`/`verseRange`, no `section`),
  indices 1..N are the section slides in order.
- A plain (non-congregational) scripture slot is UNCHANGED: exactly one reference slide.
- The reference slide's content is byte-identical to the plain scripture reference slide.

### Approach (LOCKED — owner decision 2026-08-09)
- **Approach B: assembly-time synthetic leading reference slide.** Emit the reference
  slide in `slideshowAssembler.ts` in BOTH the fallback path and the stored-group path.
  Do NOT add a reference `GroupSlideEntry` to the materializer.
- Rationale: `slideGroupMaterializer.ts::derivedIdentityKey` returns the constant
  `'scripture'` for every scripture entry, and `carryStoredDerivedEntries` matches fresh
  vs. stored scripture entries positionally by that key. A stored reference entry
  (shifting sections from order 0..N-1 to 1..N) would misalign the positional carry on the
  next rebuild and scramble per-section entry ids/attached audio. `sourceSignature` is also
  derived from the slot's reference+sections, not from `deriveGroupEntries` output, so a
  reference entry would not change the DETACHED-gating signature anyway. Approach A
  (stored entry) is therefore REJECTED.

### Section slides text-only (LOCKED)
- Suppress the reference eyebrow on congregational section slides. Update the display gate
  (`slideDisplay.ts::showReference`, `PresentationViewer.vue`'s `isFirstSection` v-if) so a
  section slide never renders the reference; only the dedicated reference slide does.
- `ScriptureSlide.isFirstSection` becomes vestigial for the eyebrow — planner decides
  keep-as-dead-field vs. remove (prefer minimal churn / keep the type field if removing it
  ripples widely).

### Dual-path parity (LOCKED)
- The fallback path and the stored-group path MUST emit the identical slide list for the
  same reading. The existing dual-path parity tests in
  `slideshowAssembler.test.ts` must be extended to the N+1 shape and pass.

### Synthetic slide id + media (Claude's Discretion, constrained)
- The synthetic reference slide needs a deterministic, collision-free id on both paths
  (fallback ids are `${slot.id}:${localSeq}`; stored ids are `entry.id`). Choose an id
  scheme for the reference slide that cannot collide with any section slide id.
- Decide how the entry-less reference slide resolves group/song background + bed media so it
  is consistent with the section slides, WITHOUT violating the Phase 23 WR-02 invariant
  ("stored `GroupSlideEntry.id` IS the slide id, media keyed on it"). Document the choice.

### Migration (LOCKED)
- Congregational readings were never deployed (Phase 47 deploy-gated) — no production data
  to migrate. Approach B touches none of the reconciliation machinery, so existing stored
  readings gain the reference slide purely at assembly time with zero rebuild/carry risk.

### Claude's Discretion
- Exact code structure of the shared reference-slide-content helper.
- Whether to remove `isFirstSection` entirely or leave it as an unused field.
- Test organization for the extended parity/R097 assertions.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Slide assembly (both paths — the core of this phase)
- `src/utils/slideshowAssembler.ts` — `resolveEntryContent` scripture case (~L177-228),
  `emitFromGroup` + stored-group loop (~L386-443), SCRIPTURE fallback congregational branch
  (~L477-527). This is where the synthetic reference slide is emitted on both paths.

### Group reconciliation (DO NOT MODIFY — read to confirm approach B avoids it)
- `src/utils/slideGroupMaterializer.ts` — `deriveGroupEntries` scripture case (~L103-123),
  `sourceSignature` (~L175-217), `derivedIdentityKey` (~L354-366),
  `carryStoredDerivedEntries` (~L485+), `rebuildScriptureGroup` (~L870+). The constant
  `'scripture'` identity key + positional carry is exactly why approach A is rejected.

### Display (eyebrow suppression)
- `src/components/slides/slideDisplay.ts` — `showReference` gate (~L210-220).
- `src/components/PresentationViewer.vue` — `isFirstSection` computed (~L658-668) and the
  reference v-if (~L168).
- `src/types/slide.ts` — `ScriptureSlide.isFirstSection` (~L145).

### Domain helpers
- `src/utils/scripture.ts` — `scriptureRefFromSlot`, `formatScriptureReference`,
  `congregationalSectionsFromSlot`, `congregationalSectionFromRef`.

### Tests to extend
- `src/utils/__tests__/slideshowAssembler.test.ts` (dual-path parity + R097),
  `src/components/__tests__/PresentationViewer.test.ts`,
  `src/components/slides/__tests__/slideDisplay.test.ts`.

### Project rules
- `CLAUDE.md` — type-check via `npm run type-check`; app suite via `npx vitest run`;
  documented 2-file baseline (`storage.rules.test.ts`, `RosterView.test.ts`).
</canonical_refs>

<specifics>
## Specific Ideas

- Owner framing (2026-08-09): "A scripture slide always has a slide of the scripture
  reference. If we make it congregational, we keep that first slide as is and only add
  additional slides that have the scripture text."
- Acceptance criteria are enumerated in the PRD (§ Acceptance criteria, AC1–AC8).
</specifics>

<deferred>
## Deferred Ideas

None — the PRD covers phase scope. No editor/UI-control changes; no reconciliation-layer
changes; no authoring/parse/detach changes.

## Security note
No security surface: this is pure client-side slide assembly + display logic with no auth,
data-access, network, or input-trust changes. Threat model is N/A for this phase.
</deferred>

---

*Phase: 49-congregational-dedicated-reference-slide*
*Context gathered: 2026-08-09 via PRD Express Path*
