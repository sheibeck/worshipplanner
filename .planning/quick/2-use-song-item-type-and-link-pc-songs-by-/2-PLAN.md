---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/planningCenterApi.ts
  - src/utils/__tests__/planningCenterApi.test.ts
autonomous: true
requirements: [QUICK-2]

must_haves:
  truths:
    - "SONG slots are exported to PC with item_type 'song' (not 'song_arrangement')"
    - "After creating a song item, the system searches PC for a matching song by CCLI number"
    - "If a matching PC song is found, its arrangement is linked to the created item"
    - "HYMN slots still use item_type 'song_arrangement' (unchanged)"
    - "If no CCLI match is found, the song item is still created successfully (no arrangement linked)"
  artifacts:
    - path: "src/utils/planningCenterApi.ts"
      provides: "searchSongByCcli, fetchSongArrangements, assignArrangementToItem functions + updated addSlotAsItem"
      exports: ["searchSongByCcli", "fetchSongArrangements", "assignArrangementToItem"]
    - path: "src/utils/__tests__/planningCenterApi.test.ts"
      provides: "Tests for new API functions and updated addSlotAsItem behavior"
  key_links:
    - from: "addSlotAsItem (SONG branch)"
      to: "searchSongByCcli"
      via: "looks up song CCLI from songs array, then searches PC"
      pattern: "searchSongByCcli.*ccliNumber"
    - from: "addSlotAsItem (SONG branch)"
      to: "assignArrangementToItem"
      via: "links found arrangement to created item"
      pattern: "assignArrangementToItem"
---

<objective>
Change song item export to use item_type "song" instead of "song_arrangement", then search Planning Center
for matching songs by CCLI number and link the PC song arrangement to the created item. Only applies to
SONG slots (not HYMN slots which remain as "song_arrangement").

Purpose: Proper song linking in Planning Center means the worship team sees the correct song metadata,
chord charts, and arrangement details rather than just a plain text title.

Output: Updated planningCenterApi.ts with new search/link functions, updated addSlotAsItem, and tests.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/utils/planningCenterApi.ts
@src/utils/__tests__/planningCenterApi.test.ts
@src/types/song.ts
@src/types/service.ts

<interfaces>
<!-- From src/types/song.ts -->
```typescript
export interface Song {
  id: string
  title: string
  ccliNumber: string   // <-- used to search PC
  author: string
  themes: string[]
  // ...other fields
}
```

<!-- From src/types/service.ts -->
```typescript
export interface SongSlot {
  kind: 'SONG'
  position: number
  requiredVwType: VWType
  songId: string | null    // <-- used to find Song in songs array
  songTitle: string | null
  songKey: string | null
}
```

<!-- From src/utils/planningCenterApi.ts - current createItem signature -->
```typescript
export async function createItem(
  appId: string, secret: string,
  serviceTypeId: string, planId: string,
  params: {
    title: string
    itemType: 'song_arrangement' | 'regular' | 'header'
    description?: string
    sequence?: number
    length?: number
  },
): Promise<string>
```

<!-- addSlotAsItem already receives songs array but doesn't use it -->
```typescript
export async function addSlotAsItem(
  appId: string, secret: string,
  serviceTypeId: string, planId: string,
  slot: ServiceSlot,
  sequence: number,
  songs: Song[],           // <-- available but currently unused
  sermonPassage?: ScriptureRef | null,
  length?: number,
): Promise<string>
```

<!-- PC_BASE_URL and basicAuthHeader are internal to planningCenterApi.ts -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add PC song search/link API functions and update createItem type union</name>
  <files>src/utils/planningCenterApi.ts, src/utils/__tests__/planningCenterApi.test.ts</files>
  <behavior>
    - searchSongByCcli('app-id', 'secret', '1234567') calls GET /songs?where[ccli_number]=1234567 and returns { id, title } or null
    - searchSongByCcli returns null when PC returns empty data array
    - searchSongByCcli returns null (does not throw) on network/API errors
    - fetchSongArrangements('app-id', 'secret', 'song-id') calls GET /songs/{songId}/arrangements and returns array of { id, name }
    - fetchSongArrangements returns empty array on error (does not throw)
    - assignArrangementToItem('app-id', 'secret', 'svc-type', 'plan-id', 'item-id', 'arrangement-id') calls POST /service_types/{id}/plans/{planId}/items/{itemId}/arrangements with arrangement relationship data
    - assignArrangementToItem does not throw on failure (logs silently)
    - createItem and updateItem accept 'song' in their itemType union (in addition to existing values)
  </behavior>
  <action>
    1. In `planningCenterApi.ts`, expand the `itemType` union in `createItem` params from `'song_arrangement' | 'regular' | 'header'` to `'song' | 'song_arrangement' | 'regular' | 'header'`. Do the same for `updateItem`.

    2. Add three new exported async functions:

    **searchSongByCcli(appId, secret, ccliNumber)**:
    - GET `${PC_BASE_URL}/songs?where[ccli_number]=${ccliNumber}`
    - Returns `{ id: string; title: string } | null`
    - If data array is empty, return null
    - Wrap in try/catch, return null on any error (non-critical lookup)

    **fetchSongArrangements(appId, secret, pcSongId)**:
    - GET `${PC_BASE_URL}/songs/${pcSongId}/arrangements?per_page=25`
    - Returns `Array<{ id: string; name: string }>`
    - Wrap in try/catch, return empty array on error

    **assignArrangementToItem(appId, secret, serviceTypeId, planId, itemId, arrangementId)**:
    - POST `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/items/${itemId}/item_notes` — actually this should use the arrangement assignment endpoint. The correct approach for PC Services API: after creating an item with item_type "song", you assign the arrangement by making a request to update the item's arrangement. The endpoint is:
      `PUT ${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/items/${itemId}` with a `relationships.arrangement` block containing `{ data: { type: 'Arrangement', id: arrangementId } }`.
    - Wrap in try/catch, silently return on error (arrangement linking is best-effort)

    3. Write tests first (RED), then implement (GREEN). Tests should mock fetch as done in existing test patterns.
  </action>
  <verify>
    <automated>npx vitest run src/utils/__tests__/planningCenterApi.test.ts</automated>
  </verify>
  <done>Three new API functions exported and tested. createItem/updateItem accept 'song' type. All existing tests still pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Update addSlotAsItem to use item_type "song", search by CCLI, and link arrangement</name>
  <files>src/utils/planningCenterApi.ts, src/utils/__tests__/planningCenterApi.test.ts</files>
  <behavior>
    - SONG slot with songId creates item with item_type "song" (not "song_arrangement")
    - After creating the song item, if the song has a ccliNumber, searchSongByCcli is called
    - If PC song found, fetchSongArrangements is called to get arrangements
    - If arrangements exist, assignArrangementToItem is called with the first arrangement's id
    - If song has no ccliNumber or ccliNumber is empty, no PC song search occurs (item still created)
    - If searchSongByCcli returns null, item is still created successfully (no arrangement linked)
    - If fetchSongArrangements returns empty array, no assignment call is made
    - HYMN slot still uses item_type "song_arrangement" (unchanged)
    - All other slot types (SCRIPTURE, PRAYER, MESSAGE) unchanged
    - Errors in search/link do NOT cause addSlotAsItem to throw (the item is already created)
  </behavior>
  <action>
    1. In the SONG branch of `addSlotAsItem`, change `itemType` from `'song_arrangement'` to `'song'`.

    2. After calling `createItem` for SONG slots, add the CCLI lookup and arrangement linking:
       - Find the Song object in the `songs` array by matching `slot.songId`
       - If found and `song.ccliNumber` is truthy (non-empty string):
         a. Call `searchSongByCcli(appId, secret, song.ccliNumber)`
         b. If result is not null, call `fetchSongArrangements(appId, secret, result.id)`
         c. If arrangements array is non-empty, call `assignArrangementToItem(appId, secret, serviceTypeId, planId, itemId, arrangements[0].id)`
       - Wrap this entire post-create flow in a try/catch so it never causes addSlotAsItem to fail

    3. HYMN branch: leave as `'song_arrangement'` (no changes).

    4. Write/update tests:
       - Update existing "maps SONG slot to song_arrangement" test: now expects item_type "song"
       - Add test: SONG slot with matching song in songs array triggers searchSongByCcli with the ccliNumber
       - Add test: When PC song found, fetchSongArrangements called, and assignArrangementToItem called with first arrangement
       - Add test: When ccliNumber is empty/missing, no search call made, item still created
       - Add test: When searchSongByCcli returns null, item still returned (no throw)
       - Add test: HYMN slot still uses item_type "song_arrangement"
       - Verify existing HYMN test still passes unchanged

    Note: Since searchSongByCcli/fetchSongArrangements/assignArrangementToItem all use the module-level fetch mock, the tests should set up sequential mockResolvedValueOnce calls: first for createItem, then for searchSongByCcli, then for fetchSongArrangements, then for assignArrangementToItem.
  </action>
  <verify>
    <automated>npx vitest run src/utils/__tests__/planningCenterApi.test.ts</automated>
  </verify>
  <done>
    - SONG slots export with item_type "song" and attempt CCLI-based arrangement linking
    - HYMN slots unchanged (still "song_arrangement")
    - All tests pass including new CCLI search/link scenarios
    - Errors in search/link are non-fatal
  </done>
</task>

</tasks>

<verification>
1. `npx vitest run src/utils/__tests__/planningCenterApi.test.ts` — all tests pass
2. `npx vue-tsc --noEmit` — no type errors
3. Manual verification: SONG slot tests confirm item_type is "song", HYMN tests confirm item_type is still "song_arrangement"
</verification>

<success_criteria>
- SONG items created with item_type "song" in Planning Center
- After creating a SONG item, PC is searched by CCLI number from the song's ccliNumber field
- If a matching PC song is found, its first arrangement is linked to the item
- HYMN items unchanged (still "song_arrangement")
- All errors in the search/link flow are non-fatal (best-effort linking)
- All existing and new tests pass
- No TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/2-use-song-item-type-and-link-pc-songs-by-/2-SUMMARY.md`
</output>
</task>
