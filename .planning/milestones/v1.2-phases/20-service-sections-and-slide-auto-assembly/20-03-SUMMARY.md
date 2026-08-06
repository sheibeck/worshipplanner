---
phase: 20-service-sections-and-slide-auto-assembly
plan: 03
subsystem: service-planning
tags: [typescript, vue, vitest, tdd, composable, reactivity, slide-assembly]

requires:
  - phase: 20-service-sections-and-slide-auto-assembly (plan 02)
    provides: "assembleSlideshow(service, inputs): AssembledSlide[] pure engine + AssemblyInputs interface"
provides:
  - "useSlideshowAssembly(service, orgId, options?): { assembledSlideshow, assembledSections, isLoading } reactive composable"
  - "Multi-song lyrics-gathering pattern: per-distinct-songId getDocs loader (injectable) bridging the single-song songLyrics store into the multi-song assembly engine"
  - "Section-grouped view (assembledSections) with a trailing 'Ungrouped' group for legacy section-less slides"
affects: [20-04-section-ui]

tech-stack:
  added: []
  patterns:
    - "Reactive Map via Vue's reactive(new Map()) for songLyricsById — mutated in place via .set() as async fetches resolve, tracked correctly by the downstream computed's .get() calls (per-key reactivity, not whole-map)"
    - "Local composable-level subscribedOrgId guard ref (not a store-exposed orgId field) prevents scriptureStore.subscribeReadings() double-subscription — scriptureSlides store has no orgId field to check unlike songs store, so the guard lives in the composable instead"
    - "Injectable lyricsLoader (options.lyricsLoader) defaulting to a real Firestore getDocs query — keeps the composable unit-testable without mocking firebase/firestore in tests that only exercise reactivity/grouping"

key-files:
  created:
    - src/composables/useSlideshowAssembly.ts
    - src/composables/__tests__/useSlideshowAssembly.test.ts
  modified: []

key-decisions:
  - "assembledSections places the legacy (section === undefined) group TRAILING after all four named SERVICE_SECTIONS groups, not leading — legacy/unclassified content reads more naturally appended at the end than interrupting the canonical section order"
  - "Empty section groups are omitted from assembledSections (only sections with >=1 slide produce a group) — avoids rendering empty section headers in the future preview UI (20-04) for services that don't populate every section"
  - "songLyricsById only grows (never prunes) as songs are removed from the service and re-added — matches the T-20-03-DoS mitigation ('only fetch songIds NOT already in the map') and is harmless since assembleSlideshow only reads the map for songIds present in the current service"
  - "Test mocking mirrors the existing ScriptureSlideEditor.test.ts / CongregationalEditor.test.ts pattern (vi.mock('@/stores/scriptureSlides', ...) returning a reactive stub) rather than real Pinia + mocked firebase/firestore — since the composable's own tests never exercise the default getDocs lyrics loader (a fake lyricsLoader is always injected), no firebase/firestore mocking was needed at all"

patterns-established:
  - "Composable-owned subscription guard: when a Pinia store (scriptureSlides) doesn't expose an orgId field to check before re-subscribing, the consuming composable tracks its own subscribedOrgId ref rather than adding an orgId field to the store solely for this purpose"

requirements-completed: [R006]

coverage:
  - id: D1
    description: "assembledSlideshow reactively reorders when service.slots are reordered (swap two slots' positions), with no manual re-sync call — the R006 reactive contract at the composable layer"
    requirement: "R006"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts#reorders assembledSlideshow when service slots are reordered (R006)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Adding a slot adds corresponding slides; removing a slot removes them — assembledSlideshow.value.length tracks slot count changes"
    requirement: "R006"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts#adds and removes slides when slots are added/removed"
        status: pass
    human_judgment: false
  - id: D3
    description: "songLyricsById gathers current lyrics for EVERY distinct songId referenced by a SONG slot (not limited to one song); a songId already present in the map is not re-fetched on subsequent re-renders"
    requirement: "R006"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts#gathers current lyrics for EVERY distinct song in the service, not just one"
        status: pass
    human_judgment: false
  - id: D4
    description: "scriptureReadingsById is derived from the scriptureSlides store's readings; the composable subscribes once per orgId and does not re-subscribe on subsequent re-renders with the same orgId (T-20-03-DoS guard)"
    requirement: "R006"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts#derives scriptureReadingsById from the scriptureSlides store and subscribes once per org"
        status: pass
    human_judgment: false
  - id: D5
    description: "assembledSections groups assembledSlideshow by section in SERVICE_SECTIONS order using SERVICE_SECTION_LABELS, with a trailing group for legacy (undefined-section) slides"
    requirement: "R006"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts#assembledSections groups slides by section in SERVICE_SECTIONS order, plus an undefined-section group"
        status: pass
    human_judgment: false

duration: 33min
completed: 2026-07-24
status: complete
---

# Phase 20 Plan 03: Reactive Slideshow Assembly Composable Summary

**`useSlideshowAssembly(service, orgId, options?)` wraps the pure `assembleSlideshow` engine in Vue reactivity, gathering current lyrics for every distinct song via an injectable getDocs loader, deriving performanceOrder/scripture-readings from the songs and scriptureSlides stores, and exposing a section-grouped preview view — 6 tests proving the R006 reorder/add/remove contract at the reactive layer.**

## Performance

- **Duration:** ~33 min
- **Started:** 2026-07-24T22:22:00Z
- **Completed:** 2026-07-24T22:55:29Z
- **Tasks:** 1
- **Files modified:** 2 (both created)

## Accomplishments
- `src/composables/useSlideshowAssembly.ts` created: `useSlideshowAssembly(service, orgId, options?)` returning `{ assembledSlideshow, assembledSections, isLoading }`. Calls `assembleSlideshow` from `src/utils/slideshowAssembler.ts` — reimplements no assembly logic itself.
- `scriptureReadingsById` is a `computed` Map built from `useScriptureSlides().readings`, keyed by reading id. The composable calls `store.subscribeReadings(orgId)` once per distinct orgId via a local `subscribedOrgId` guard ref (the store itself has no `orgId` field to check, unlike `useSongStore`).
- `performanceOrderById` is a `computed` Map built from `useSongStore().songs`, `songId -> song.performanceOrder ?? []`.
- `songLyricsById` is a `reactive(new Map())`, populated by watching the distinct set of `songId`s across `service.value.slots` (SONG slots only, non-null `songId`). On change, fetches only the songIds NOT already in the map (T-20-03-DoS mitigation) via an injectable `lyricsLoader` (default: a real one-shot `getDocs` query against `organizations/{orgId}/songs/{songId}/lyrics` ordered `createdAt desc`, `limit(1)`, mirroring the `performanceOrder` field-defaulting behavior of the `songLyrics` store's `subscribeLyrics`). A song with no lyrics doc simply never enters the map — the pure engine already skips absent entries.
- `isLoading` is `true` while any lyrics fetch triggered by the current songId set is in flight.
- `assembledSections` groups the flat `assembledSlideshow` array into `AssembledSection[]`: one group per `SERVICE_SECTIONS` entry (in order) that has at least one slide, using `SERVICE_SECTION_LABELS` for the label, plus a trailing `{ section: undefined, label: 'Ungrouped', slides }` group for legacy section-less slides — omitted entirely if there are no legacy slides.
- Cleanup: `onUnmounted` stops both `watch()` handles created by this composable (org-subscribe watcher, lyrics-loading watcher).

## Task Commits

Each task was committed atomically (TDD RED/GREEN):

1. **Task 1: RED — failing reactivity + grouping tests** - `f181b72` (test)
1. **Task 1: GREEN — implement useSlideshowAssembly composable** - `f0e5bcf` (feat)

**Plan metadata:** committed separately (see final commit below)

## Files Created/Modified
- `src/composables/useSlideshowAssembly.ts` (new) - `useSlideshowAssembly()` composable, `LyricsLoader` type, `defaultLyricsLoader()` (real Firestore query), `UseSlideshowAssemblyOptions`/`UseSlideshowAssemblyReturn` interfaces
- `src/composables/__tests__/useSlideshowAssembly.test.ts` (new) - 6 tests: reorder (R006), add/remove, multi-song lyrics gathering + no-refetch, scripture-readings derivation + single-subscribe guard, section grouping with legacy "Ungrouped" group, null-service empty-array edge case. Mocks `@/stores/scriptureSlides` and `@/stores/songs` as reactive stubs (mirrors the existing `ScriptureSlideEditor.test.ts` pattern) — no Pinia or `firebase/firestore` mocking needed since a fake `lyricsLoader` is always injected.

## Decisions Made
- **Trailing legacy group:** `assembledSections` places the undefined-section group AFTER all four named sections rather than leading, since legacy/unclassified content reads more naturally as an appendix than as an interruption of the canonical Pre-Service → Worship → Message → Sending order.
- **Sparse groups:** a named section with zero slides produces no group entry at all (not an empty-array placeholder) — keeps `assembledSections` directly renderable by 20-04's preview UI without a client-side filter step.
- **Composable-owned subscription guard:** because `useScriptureSlides` (unlike `useSongStore`) exposes no `orgId` field, the "don't double-subscribe" guard lives in the composable as a local `subscribedOrgId` ref rather than being added to the store. This keeps the store's public surface unchanged and matches the plan's read-first guidance ("mirroring the guard pattern used elsewhere") in spirit while adapting to the actual store shape found by reading `src/stores/scriptureSlides.ts` directly (per the plan's explicit instruction not to assume a store shape).
- **songLyricsById never prunes:** removing a song from the service and re-adding it later does not trigger a re-fetch — the map only grows. This is intentional (matches the DoS mitigation's "only fetch missing songIds" framing) and harmless, since `assembleSlideshow` only reads `songLyricsById.get(songId)` for `songId`s present in the *current* service; stale unused entries are simply never read.

## Deviations from Plan

None — plan executed exactly as written. One clarifying note:

### Note: scriptureSlides store has no `orgId` field to check

**What happened:** The plan's `<action>` text says to guard the scripture-readings subscription "mirroring the guard pattern used elsewhere: `if (!store.orgId)`". Reading `src/stores/scriptureSlides.ts` directly (as the plan's `<read_first>` instructs) showed this store tracks no `orgId` ref at all (unlike `useSongStore`, which does). A local `subscribedOrgId` ref inside the composable was used instead to achieve the same "subscribe once per org, no double-subscribe" behavior.

**Why:** The plan explicitly instructs reading the actual store code rather than assuming a shape ("Read the actual store code... don't assume a store shape"). This is exactly that case — the guard pattern description referenced a field that doesn't exist on this particular store, so an equivalent composable-local guard was substituted.

**Impact:** None on behavior or test coverage — the "subscribes once per org, doesn't double-subscribe on re-render with the same orgId" contract is directly tested and passes.

## Issues Encountered
None new. The full project suite (`npx vitest run`, 2908 tests) was re-run end-to-end: 2791 passed (including all 6 new `useSlideshowAssembly.test.ts` tests), 114 skipped, and the same 3 pre-existing failures confined to stale `.gsd/quarantine/worktrees/**/RosterView.test.ts` copies already logged as out-of-scope GSD housekeeping debris in 20-02's summary — unrelated to `src/` and unaffected by this plan.

`npm run type-check` continues to exit non-zero solely due to the pre-existing `ccliParser.ts`/`scriptureSplitter.ts` errors logged in `deferred-items.md` (verified via a filtered diff: zero errors mentioning `useSlideshowAssembly` before the final fix, one transient error in the test file's `mockClear()` typing was introduced and immediately fixed by removing an over-narrow `LyricsLoader` type annotation on the test's `vi.fn()` — not a pre-existing/deferred issue, resolved within this plan).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `useSlideshowAssembly(service, orgId, options?)` is exported from `src/composables/useSlideshowAssembly.ts` and returns `{ assembledSlideshow, assembledSections, isLoading }` — Plan 20-04 (section UI / `SlideshowPreview.vue`) can mount this composable directly against `ServiceEditorView`'s reactive `localService` ref and `authStore.orgId`, with no further reactivity work needed.
- `assembledSections` is already in the exact `AssembledSection[]` shape (`section`, `label`, `slides`) that a section-grouped preview panel needs — including the `SERVICE_SECTION_LABELS`-derived labels and the "Ungrouped" legacy group — so 20-04 can `v-for` over it directly.
- Blocker/concern carried forward (unchanged from 20-01/20-02): the pre-existing `ccliParser.ts`/`scriptureSplitter.ts` type-check failures mean `npm run type-check` cannot be used as a hard whole-project pass/fail gate — 20-04 should keep using file-scoped diffing, as this plan and 20-02 did.

---
*Phase: 20-service-sections-and-slide-auto-assembly*
*Completed: 2026-07-24*

## Self-Check: PASSED

- FOUND: src/composables/useSlideshowAssembly.ts
- FOUND: src/composables/__tests__/useSlideshowAssembly.test.ts
- FOUND: .planning/phases/20-service-sections-and-slide-auto-assembly/20-03-SUMMARY.md
- FOUND commit: f181b72
- FOUND commit: f0e5bcf
