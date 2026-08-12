---
phase: quick-5
plan: 5
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/song.ts
  - src/utils/pcSongImport.ts
  - src/stores/songs.ts
  - src/utils/suggestions.ts
  - src/utils/__tests__/pcSongImport.test.ts
  - src/stores/__tests__/songs.test.ts
  - src/components/SongBadge.vue
  - src/components/__tests__/SongBadge.test.ts
  - src/components/SongSlideOver.vue
  - src/components/SongSlotPicker.vue
  - src/components/SongTable.vue
  - src/views/ServiceEditorView.vue
  - src/views/SongsView.vue
  - src/views/DashboardView.vue
autonomous: true
requirements: []

must_haves:
  truths:
    - "A song can be assigned Type 1, Type 2, and/or Type 3 simultaneously"
    - "The song edit panel (SongSlideOver) lets users toggle multiple types independently"
    - "In the service edit screen, a song slot shows the selected song's actual type badges after a song is picked"
    - "Untyped songs continue to show the dash badge"
    - "PC song import maps all matching category tags to the song (not just the first)"
    - "The song library filter still works — filtering by Type 1 shows songs that include Type 1 in their types array"
  artifacts:
    - path: src/types/song.ts
      provides: "VWType[] field on Song (vwTypes), removing vwType"
    - path: src/components/SongBadge.vue
      provides: "Multi-badge rendering from types: VWType[] prop"
    - path: src/views/ServiceEditorView.vue
      provides: "Song slot shows selected song vwTypes when song is picked"
  key_links:
    - from: src/stores/songs.ts
      to: src/types/song.ts
      via: "Firestore read normalization: vwType (legacy) → vwTypes array"
    - from: src/views/ServiceEditorView.vue
      to: src/stores/songs.ts
      via: "songStore.songs lookup by slot.songId to get vwTypes for display"
---

<objective>
Support multiple VW types per song (Type 1, 2, and 3 can each be independently assigned to the same song), and update the service edit screen to display the selected song's actual type badges in each song slot instead of the slot's hardcoded required type.

Purpose: Songs in the Vertical Worship library often span categories (e.g., a song can be both Type 1 and Type 2). Currently only one type is stored. The service slot "Type" badge shows the slot's required type rather than the song's actual classification.

Output: `Song.vwTypes: VWType[]` (replaces `vwType: VWType | null`), multi-badge UI, dynamic type display in service editor.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Key architectural notes:
- Songs are read from Firestore as raw casts: `{ id: d.id, ...d.data() } as Song`. Existing Firestore docs have `vwType: 1|2|3|null`. The new field is `vwTypes: VWType[]`. The read path MUST normalize legacy docs.
- `SongSlot.requiredVwType: VWType` (on the service slot) remains unchanged — it is the slot's positional type constraint (1, 2, or 3) and is separate from the song's classification.
- `SongBadge` is currently used in 5 places: SongTable, SongSlotPicker (twice in search/recent results), and ServiceEditorView (once showing slot requiredVwType).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Migrate Song type to vwTypes array and update data/logic layer</name>
  <files>
    src/types/song.ts,
    src/utils/pcSongImport.ts,
    src/stores/songs.ts,
    src/utils/suggestions.ts,
    src/utils/__tests__/pcSongImport.test.ts,
    src/stores/__tests__/songs.test.ts
  </files>
  <behavior>
    - Song.vwTypes is VWType[] (not VWType | null). Empty array = uncategorized.
    - UpsertSongInput uses vwTypes: VWType[] (no vwType).
    - Firestore read normalization: if doc has legacy vwType (number, not array), convert to [vwType]. If vwType is null or missing and vwTypes is missing/undefined, default to [].
    - pcSongImport.mapPcSongToUpsert: collects ALL matching category tags (not just first), returns vwTypes: VWType[] (e.g. song with Category 1 and Category 2 tags gets vwTypes: [1, 2]).
    - songs store upsertSongs: update logic — include vwTypes in update when incoming vwTypes is non-empty (mirrors old "only set vwType when non-null" rule — preserve user-set types if incoming is empty).
    - songs store filteredSongs: filter `filterVwType === 'uncategorized'` matches `song.vwTypes.length === 0`. Filter by type N matches `song.vwTypes.includes(N)`.
    - suggestions.ts rankSongsForSlot: type bonus uses `song.vwTypes.includes(requiredVwType)`.
    - All tests updated: replace vwType scalar with vwTypes array in fixtures and assertions.
  </behavior>
  <action>
    1. Update src/types/song.ts:
       - Remove `vwType: VWType | null`
       - Add `vwTypes: VWType[]`
       - UpsertSongInput inherits the change automatically via Omit

    2. Update src/utils/pcSongImport.ts:
       - Replace the single-result loop with a collector:
         ```ts
         const vwTypes: VWType[] = []
         for (const tag of tags) {
           if (CATEGORY_1_RE.test(tag.name)) vwTypes.push(1)
           else if (CATEGORY_2_RE.test(tag.name)) vwTypes.push(2)
           else if (CATEGORY_3_RE.test(tag.name)) vwTypes.push(3)
         }
         ```
       - Return `vwTypes` in the mapped object (not `vwType`)

    3. Update src/stores/songs.ts:
       - In the onSnapshot handler, after `snap.docs.map(...)`, normalize each song:
         ```ts
         songs.value = snap.docs.map((d) => {
           const data = d.data() as Record<string, unknown>
           // Normalize legacy vwType scalar field
           if (!Array.isArray(data.vwTypes)) {
             data.vwTypes = data.vwType != null ? [data.vwType] : []
           }
           return { id: d.id, ...data } as Song
         })
         ```
       - Update filteredSongs computed:
         - uncategorized: `song.vwTypes.length === 0`
         - type filter: `song.vwTypes.includes(filterVwType.value as VWType)`
       - Update upsertSongs: rename `vwType`→`vwTypes` in destructure; include vwTypes in updateData when `incomingVwTypes.length > 0` (preserve user-set types if incoming is empty)

    4. Update src/utils/suggestions.ts:
       - Change `song.vwType === requiredVwType` to `song.vwTypes.includes(requiredVwType)`

    5. Update tests:
       - src/utils/__tests__/pcSongImport.test.ts:
         - Replace `vwType: 1` assertions with `vwTypes: [1]` etc.
         - Add test: song with Category 1 AND Category 2 tags → `vwTypes: [1, 2]`
         - "no category tag" → `vwTypes: []` (not null)
         - The `makeSong` helper in songs.test.ts: change `vwType: 1 | 2 | 3 | null` to `vwTypes: VWType[]` defaulting to `[]`
       - src/stores/__tests__/songs.test.ts:
         - Update makeSong fixture shape
         - Update filter tests: "uncategorized" filter matches vwTypes: []
         - Update upsertSongs tests: vwTypes array in/out
         - Fix the "only sets vwType when incoming vwType is non-null" test: rename to vwTypes, assert vwTypes preserved when empty incoming

    Run: `npx vitest run src/utils/__tests__/pcSongImport.test.ts src/stores/__tests__/songs.test.ts`
  </action>
  <verify>
    <automated>npx vitest run src/utils/__tests__/pcSongImport.test.ts src/stores/__tests__/songs.test.ts</automated>
  </verify>
  <done>All pcSongImport and songs store tests pass. Song type is VWType[], pcSongImport collects all matching categories, Firestore reads normalize legacy docs, filter and upsert logic updated.</done>
</task>

<task type="auto">
  <name>Task 2: Update UI components for multi-type display</name>
  <files>
    src/components/SongBadge.vue,
    src/components/__tests__/SongBadge.test.ts,
    src/components/SongSlideOver.vue,
    src/components/SongSlotPicker.vue,
    src/components/SongTable.vue,
    src/views/ServiceEditorView.vue,
    src/views/SongsView.vue,
    src/views/DashboardView.vue
  </files>
  <action>
    1. Update src/components/SongBadge.vue:
       - Change prop from `type: VWType | null` to `types: VWType[]`
       - Render one badge span per type in the array (v-for). If array is empty, render the dash span.
       - Wrap in a `<span class="inline-flex items-center gap-1">` container when rendering multiple badges
       - Keep identical per-badge badgeClasses styling

    2. Update src/components/__tests__/SongBadge.test.ts:
       - Update all test props from `{ type: 1 }` to `{ types: [1] }`
       - Add test: `types: [1, 2]` renders two badge spans
       - Update null test: use `types: []` (empty array) for uncategorized

    3. Update src/components/SongSlideOver.vue:
       - FormState: change `vwType: VWType | null` to `vwTypes: VWType[]`
       - emptyForm(): `vwTypes: []`
       - songToForm(): `vwTypes: song.vwTypes ?? []`
       - `vwTypeClasses(type)`: use `form.value.vwTypes.includes(type)` for selected check
       - `toggleVwType(type)`: toggle presence in array (add if absent, remove if present)
       - Save path (line ~376): `vwTypes: form.value.vwTypes`
       - Template: update the VW type buttons loop — the selected-class condition now uses includes()

    4. Update src/components/SongSlotPicker.vue:
       - Sort comparator: `song.vwTypes.includes(props.requiredVwType)` instead of `song.vwType === props.requiredVwType`
       - Badge usage: change `:type="item.song.vwType"` to `:types="item.song.vwTypes ?? []"` (3 occurrences)

    5. Update src/components/SongTable.vue:
       - Badge usage: `:type="song.vwType"` → `:types="song.vwTypes ?? []"`

    6. Update src/views/ServiceEditorView.vue:
       - The song slot header area (line ~454) currently shows `<SongBadge :type="slot.requiredVwType" />`.
         This must now show the SELECTED SONG's types when a song is assigned, or nothing when no song is assigned.
       - Add a computed helper `songById` (or inline lookup): `(id: string) => songStore.songs.find(s => s.id === id)`
       - In the template, replace the static SongBadge with:
         ```html
         <SongBadge
           v-if="slot.songId"
           :types="songStore.songs.find(s => s.id === slot.songId)?.vwTypes ?? []"
         />
         ```
         When no song is assigned (`!slot.songId`), omit the badge entirely (do not show the slot's requiredVwType).
       - Remove the old import of `VWType` if it is no longer needed in the script (check other usages first — it is still used for `addSlot(kind, vwType?)` and `requiredVwType` references; keep if still used)

    7. Update src/views/SongsView.vue:
       - uncategorized count/filter: `s.vwType === null` → `s.vwTypes.length === 0`

    8. Update src/views/DashboardView.vue:
       - uncategorized count: `s.vwType === null` → `s.vwTypes.length === 0`

    Run full test suite after all UI changes: `npx vitest run`
  </action>
  <verify>
    <automated>npx vitest run</automated>
  </verify>
  <done>All tests pass. SongBadge accepts types array. SongSlideOver allows multi-select. Song slot in service editor shows selected song's type badges (or nothing if no song). SongSlotPicker and SongTable use updated prop. Uncategorized checks use .length === 0.</done>
</task>

</tasks>

<verification>
Full test run passes: `npx vitest run`

Manual verification:
- Open a song in the song library → edit panel → toggle multiple VW types simultaneously (all three can be active)
- Open the service editor → pick a song for a slot → the type badge area shows the song's actual type(s), not the slot's required type
- A song with no types assigned shows no badge in the service editor slot
- PC import: if a song has "Category 1" and "Category 3" tags in Planning Center, both types appear after import
- Song library filter by Type 1 still shows songs that include Type 1 (songs with [1, 2] appear when filtering by 1)
- "Uncategorized" filter shows songs with empty vwTypes array
</verification>

<success_criteria>
- Song.vwTypes: VWType[] everywhere (no remaining vwType references in non-legacy-normalization code)
- All existing tests pass with updated fixtures
- New test: multi-category PC song maps to vwTypes: [1, 3] (or whichever combination)
- Service editor song slot shows song's vwTypes badges after song is selected, nothing before
- SongSlideOver multi-toggle works without breaking save
</success_criteria>

<output>
After completion, create `.planning/quick/5-support-multiple-types-per-song-and-show/5-SUMMARY.md`
</output>
