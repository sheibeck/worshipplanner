# S03: Service Sections and Slide Auto-Assembly — Research

**Date:** 2026-07-24

## Summary

S03 introduces formalized service sections (Pre-Service, Worship, Message, Sending) and a slideshow auto-assembly engine that collects slides from songs (S01) and scripture readings (S02) based on the service order. This is deep research — the current service model is a flat `slots[]` array with no section grouping, and there is no slide assembly infrastructure at all. The slice must add a section layer to the data model without breaking existing services, build a pure-function assembly engine, and wire it into the ServiceEditorView UI.

The core risk is the data model migration: existing services in Firestore have a flat `ServiceSlot[]` with position-based ordering and `buildSlots()` templates that implicitly encode section semantics via comments ("Call to Worship" at position 0, "Sending Song" at position 8). The new section model must be additive — an optional `section` field on each slot — so existing services continue to render correctly without migration. The assembly engine itself is a pure function that reads slot data + linked slides and produces an ordered slide array, which is straightforward once the data model is right.

## Recommendation

**Approach: Additive section field on slots + pure-function assembly engine + new UI section grouping.**

Add an optional `section?: ServiceSection` field to each `ServiceSlot` variant where `ServiceSection = 'pre-service' | 'worship' | 'message' | 'sending'`. Existing services with no `section` field render as they do today (flat list). New services created via `buildSlots()` get default section assignments. The assembly engine is a pure function `assembleSlideshow(service, songLyrics, scriptureReadings) => AssembledSlide[]` that walks slots in order, resolves linked content (song lyrics via `performanceOrder` + lyric sections, scripture via `scriptureReadingId`), and returns a flat ordered array of slides with section metadata.

This approach avoids Firestore data migration, keeps the assembly logic testable as a pure function, and lets the UI progressively adopt section grouping without breaking the existing flat-list editing flow.

## Implementation Landscape

### Key Files

- `src/types/service.ts` — Add `ServiceSection` type and optional `section` field to all slot variants. Currently defines `ServiceSlot = SongSlot | ScriptureSlot | NonAssignableSlot | HymnSlot` with `position: number` ordering. No section concept exists.
- `src/utils/slotTypes.ts` — Update `buildSlots()` to assign default section values to slots (positions 0-1 → worship, position 7 → message, position 8 → sending). Update `createSlot()` to accept optional section. `reindexSlots()` needs no changes (it only touches `position`).
- `src/types/slide.ts` — Currently `Slide = LyricSlide | CopyrightSlide | ScriptureSlide`. Add an `AssembledSlide` wrapper type that pairs a `Slide` with section and source metadata (which service slot produced it). May also need a `TextSlide` variant for section title slides or non-content slots.
- `src/utils/slideshowAssembler.ts` — **New file.** Pure function that takes a `Service`, a `Map<songId, SongLyrics>`, and a `Map<readingId, ScriptureReading>` and returns `AssembledSlide[]`. Walks `service.slots` in position order, for each slot resolves the linked content into slides.
- `src/stores/services.ts` — Service store needs no structural changes. `createService()` calls `buildSlots()` which will now include section defaults. `updateService()` already accepts arbitrary partial updates.
- `src/stores/songLyrics.ts` — Consumer only. Assembly engine reads `currentLyrics` (sections + performanceOrder) to generate lyric slide sequences per song slot.
- `src/stores/scriptureSlides.ts` — Consumer only. Assembly engine reads scripture readings by `scriptureReadingId` from `ScriptureSlot` to get `ScriptureSlide[]`.
- `src/composables/useSlideshowAssembly.ts` — **New file.** Vue composable that watches service slots + linked content stores and reactively produces `assembledSlideshow: ComputedRef<AssembledSlide[]>`. Re-assembles when slots are reordered, added, or removed.
- `src/views/ServiceEditorView.vue` — Wire in section grouping UI. Currently renders a flat `v-for` over `localService.slots`. Needs section headers/dividers and the assembled slideshow preview panel. This is the largest UI change — ~2468 lines currently.
- `src/components/SlideshowPreview.vue` — **New file.** Renders the assembled slideshow as a scrollable slide list with section dividers. Not the full-screen presentation (that's S06) — just an inline preview showing what the assembled slideshow looks like.

### Build Order

**First proof: Assembly engine as pure function with tests** (`slideshowAssembler.ts` + tests). This is the highest-risk piece — if the assembly logic is wrong, everything else fails. It depends only on the type definitions, so it can be built and tested in isolation. Proves the core value proposition: slots → slides.

**Second: Type changes** (`service.ts` section type, `slide.ts` assembled slide type). These are mechanical and unblock both the assembly engine and the UI work.

**Third: `buildSlots()` updates** to assign default sections. Low risk, enables new services to have sections out of the box.

**Fourth: `useSlideshowAssembly` composable** wrapping the pure function with reactive Vue watchers. Depends on the assembly engine and stores.

**Fifth: ServiceEditorView section UI** — section headers/dividers in the slot list, visual grouping. This is the largest change but lowest technical risk (UI pattern follows existing drag-and-drop slot list).

**Sixth: Slideshow preview component** — renders the assembled output inline. Depends on the composable.

### Patterns to Follow

- **SortableJS DOM-revert pattern** (MEM008): Slots use SortableJS with revert-DOM-then-update-reactive-array. Section grouping must preserve this — sections are visual grouping, not separate sortable containers. Slots should remain in one flat SortableJS list with section headers injected as non-draggable dividers.
- **useAutoSave composable** (S01 pattern): The assembled slideshow is read-only derived state — it does not need auto-save. But any new editable state (section assignments) should use the existing 800ms debounce auto-save via `updateService()`.
- **Create-on-first-fetch** (S02 pattern): Not applicable here — assembly is derived, not persisted separately.
- **Existing slot management**: `addSlot()`, `removeSlot()`, drag-and-drop reorder in ServiceEditorView. Section assignment should be a simple dropdown/select on each slot or a drag-target for sections.

### Data Model Constraints

**Backward compatibility is critical.** Existing services in Firestore have `slots[]` with no `section` field. The code must handle:
1. `slot.section === undefined` — treat as "ungrouped" or infer from position
2. New services get section defaults from updated `buildSlots()`
3. Users can manually change slot sections via UI
4. Reordering slots within/across sections must update both `position` and `section`

**No Firestore migration needed.** The `section` field is optional. Firestore rules (`firestore.rules:51`) allow arbitrary fields on service documents. Existing services continue to work — they just won't have section grouping until the user edits them or the UI infers sections from the slot template positions.

### Assembly Engine Design

```
assembleSlideshow(service, songLyricsMap, scriptureReadingsMap): AssembledSlide[]
```

For each slot in `service.slots` (ordered by position):
- **SONG slot** with `songId`: Look up `songLyricsMap.get(songId)`. Use `performanceOrder` to build slide sequence: copyright slide → ordered lyric section slides → copyright slide. Each lyric section becomes one `LyricSlide`.
- **SCRIPTURE slot** with `scriptureReadingId`: Look up `scriptureReadingsMap.get(readingId)`. Use the reading's `slides[]` directly (already `ScriptureSlide[]`).
- **PRAYER/MESSAGE/HYMN slots**: Generate a simple `TextSlide` with the slot label as content (placeholder for S04/future content).
- **Empty slots** (song/scripture not yet assigned): Skip or generate a placeholder slide.

Each output `AssembledSlide` wraps the inner `Slide` with: `{ slide, slotIndex, slotKind, section, sourceId }`.

**Reorder reactivity**: When slots are reordered (via SortableJS + `reindexSlots()`), the composable re-runs assembly. Since it's a pure function of `service.slots` + content maps, Vue's reactivity handles this automatically via `computed()`.

### Natural Seams (Independent Work Units)

1. **Types + assembly engine** — pure TypeScript, no Vue dependencies, fully testable in isolation
2. **buildSlots() section defaults** — small change to slotTypes.ts, independent of assembly
3. **useSlideshowAssembly composable** — Vue wrapper, depends on (1)
4. **ServiceEditorView section UI** — depends on type changes but not on assembly engine
5. **SlideshowPreview component** — depends on (3), independent of (4)

Seams 1-2 and 4 can run in parallel. Seam 3 requires 1. Seam 5 requires 3.

### Verification

- **Unit tests for assembly engine**: Given a service with known slots and content maps, assert correct slide order, section assignment, and content resolution. Test reorder (swap two slots, verify slide order follows). Test empty slots (no songId → skip). Test mixed content (songs + scripture + prayer in one service).
- **Unit tests for buildSlots section defaults**: Assert each position gets the expected section value.
- **Component tests for section UI**: Assert section headers render when slots have section values. Assert section headers don't render for legacy services (no section field).
- **Component tests for slideshow preview**: Assert it renders assembled slides with section dividers.
- **Integration test**: Create a service with songs and scripture, verify assembled slideshow contains correct slide count and order.
- Run: `npx vitest run` — all existing 944+ tests must continue passing.

### Dependency Slice Summaries

**S01 provides** (from S01-SUMMARY):
- Unified Slide type with `contentKind` discriminator (`src/types/slide.ts`)
- Song lyric slide sequences stored per-song in catalog subcollection (`src/stores/songLyrics.ts`)
- `performanceOrder` on Song doc defining lyric slide sequence
- `useAutoSave` composable with 800ms debounce
- 100 tests passing

**Forward intelligence from S01**: performanceOrder is stored on the Song doc (not lyrics subcollection) so it persists across lyric version changes. The assembly engine must read performanceOrder from the Song, not from SongLyrics. SortableJS DOM-revert pattern must be preserved in any slot list UI changes.

**S02 provides** (from S02-SUMMARY):
- ScriptureSlide in the Slide union with `contentKind: 'scripture'`
- `useScriptureSlides` Pinia store for scripture reading CRUD
- `ScriptureSlot.readingMode` and `scriptureReadingId` fields for service-to-slide binding
- 71 tests passing

**Forward intelligence from S02**: `scriptureReadingId` on ScriptureSlot is the key link for assembly — the engine looks up the ScriptureReading by this ID to get pre-split slides. readingMode determines whether to use normal or congregational slide variants. Create-on-first-fetch means a ScriptureSlot might not have a `scriptureReadingId` yet (user hasn't fetched ESV text) — assembly must handle this as "empty scripture slot."

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Existing services break when section field is added | High | Make section optional, handle undefined in all code paths, test with legacy service fixtures |
| SortableJS drag-and-drop breaks with section grouping | Medium | Keep slots in one flat sortable list, sections are visual dividers only — not separate containers |
| Assembly engine performance with large services | Low | Services have ~9 slots max from buildSlots template; assembly is O(n) in slots |
| performanceOrder missing on Song doc | Medium | Fallback to section order from SongLyrics if performanceOrder is undefined |
| scriptureReadingId not yet set on ScriptureSlot | Low | Assembly skips or generates placeholder — handled by design |

### Skill Gaps

No unfamiliar technology. All work uses existing patterns (Vue 3 composables, Pinia stores, SortableJS, Vitest). No skills to install.

### Active Requirements

- **R005** (primary-user-loop) — Service-driven slide auto-assembly from service order. **This is the core deliverable.** The assembly engine maps slots → slides.
- **R006** (primary-user-loop) — Auto-reorder slides when service elements change order. **Handled by reactive assembly** — reindexSlots() fires → composable re-computes → slideshow updates.
- **R007** (core-capability) — Formalized service sections. **Additive data model change** — section field on slots with defaults in buildSlots().
- **R018** (quality-attribute) — Polished, intuitive editor UX. Section headers and slideshow preview must follow existing dark-first Tailwind patterns.
