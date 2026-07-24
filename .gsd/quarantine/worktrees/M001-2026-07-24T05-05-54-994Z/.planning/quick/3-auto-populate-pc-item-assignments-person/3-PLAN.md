---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/planningCenterApi.ts
  - src/utils/__tests__/planningCenterApi.test.ts
autonomous: true
requirements:
  - QUICK-3
must_haves:
  truths:
    - "When a SONG slot is exported and the song was found in PC via CCLI, the new item's length matches the last scheduled item's length"
    - "When a SONG slot is exported, item notes from the last scheduled item are copied to the new item (Person, Vocals, Livestream Sound, Sanctuary Sound)"
    - "Failures fetching the last scheduled item or copying notes never abort the export"
    - "When the song has no prior schedule history in PC, item creation proceeds normally with no notes"
  artifacts:
    - path: "src/utils/planningCenterApi.ts"
      provides: "fetchLastScheduledItem() helper, createItemNote() helper, updated addSlotAsItem()"
      exports: ["fetchLastScheduledItem", "createItemNote", "addSlotAsItem"]
    - path: "src/utils/__tests__/planningCenterApi.test.ts"
      provides: "Tests for new helpers and updated addSlotAsItem behavior"
  key_links:
    - from: "addSlotAsItem (SONG branch)"
      to: "fetchLastScheduledItem"
      via: "called after pcSongId is obtained, before createItem"
      pattern: "fetchLastScheduledItem.*pcSongId"
    - from: "addSlotAsItem (SONG branch)"
      to: "createItemNote"
      via: "called in loop after createItem returns new itemId"
      pattern: "createItemNote.*newItemId"
---

<objective>
Auto-populate PC item metadata when exporting SONG slots by copying length and item notes from the song's last scheduled item.

Purpose: The PC API does not auto-populate metadata (length, Person/Vocals/Sound notes) the way the PC UI does. After the CCLI lookup finds a PC song, we can fetch that song's last_scheduled_item to carry forward this metadata to the newly created item.

Output: Two new exported functions (fetchLastScheduledItem, createItemNote) and an updated addSlotAsItem that calls them when a CCLI match is found.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Key decisions in effect:
- CCLI-based linking is best-effort — errors MUST never cause export failure (catch and swallow)
- item_note_category_id values are org-specific — copy them from the last item's notes, never hardcode
- Only attempt note copying when pcSongId was successfully resolved (CCLI match found)
</context>

<interfaces>
<!-- Existing signatures the executor builds against. Extracted from src/utils/planningCenterApi.ts -->

```typescript
// PC_BASE_URL — already defined, use for new fetch calls
export const PC_BASE_URL: string  // '/api/planningcenter/services/v2' in dev

// basicAuthHeader — private helper, available inside file
function basicAuthHeader(appId: string, secret: string): string

// createItem — existing, already accepts length
export async function createItem(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
  params: {
    title: string
    itemType: 'song' | 'song_arrangement' | 'regular' | 'header'
    description?: string
    sequence?: number
    length?: number
    songId?: string
    arrangementId?: string
  },
): Promise<string>  // returns new item ID

// addSlotAsItem SONG branch (lines 571-607) — receives pcSongId after CCLI lookup
// New logic inserts AFTER pcSongId / arrangementId are resolved, BEFORE createItem call
export async function addSlotAsItem(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
  slot: ServiceSlot,
  sequence: number,
  songs: Song[],
  sermonPassage?: ScriptureRef | null,
  length?: number,
): Promise<string>
```

PC API shapes (from domain context):

```typescript
// GET /songs/{pcSongId}/last_scheduled_item?include=item_notes
// Response shape:
{
  data: {
    id: string
    attributes: {
      length: number | null   // seconds
      // ... other attrs we don't need
    }
  } | null,
  included: Array<{
    type: 'ItemNote'
    id: string
    attributes: {
      content: string
    }
    relationships: {
      item_note_category: {
        data: { type: 'ItemNoteCategory'; id: string }
      }
    }
  }>
}

// POST /service_types/{stId}/plans/{planId}/items/{itemId}/item_notes
// Request body:
{
  data: {
    type: 'ItemNote'
    attributes: {
      item_note_category_id: string
      content: string
    }
  }
}
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add fetchLastScheduledItem and createItemNote helpers</name>
  <files>src/utils/planningCenterApi.ts, src/utils/__tests__/planningCenterApi.test.ts</files>
  <behavior>
    fetchLastScheduledItem:
    - Calls GET /songs/{pcSongId}/last_scheduled_item?include=item_notes
    - Returns { length: number | null, notes: Array<{ categoryId: string, content: string }> } on success
    - Returns null when response is not ok OR when data is null (song never scheduled)
    - Returns null (does not throw) on any network/fetch error
    - Extracts length from data.attributes.length (null if absent)
    - Extracts notes by mapping included[] where type === 'ItemNote' to { categoryId, content }

    createItemNote:
    - Calls POST /service_types/{stId}/plans/{planId}/items/{itemId}/item_notes
    - Sends { data: { type: 'ItemNote', attributes: { item_note_category_id, content } } }
    - Resolves void on success (2xx)
    - Throws on non-ok response (consistent with createItem pattern)
  </behavior>
  <action>
    Write failing tests first for both helpers in src/utils/__tests__/planningCenterApi.test.ts, following the existing describe block pattern (vi.stubGlobal fetch in beforeEach).

    Then add the two exported functions immediately after fetchSongArrangements (around line 533) in src/utils/planningCenterApi.ts:

    ```typescript
    /**
     * Fetch the last scheduled item for a PC song, including its item_notes.
     * Used to carry forward length and note content when creating a new item.
     * Returns null when the song has no prior schedule history or on any error.
     */
    export async function fetchLastScheduledItem(
      appId: string,
      secret: string,
      pcSongId: string,
    ): Promise<{ length: number | null; notes: Array<{ categoryId: string; content: string }> } | null> {
      try {
        const response = await fetch(
          `${PC_BASE_URL}/songs/${pcSongId}/last_scheduled_item?include=item_notes`,
          {
            headers: {
              Authorization: basicAuthHeader(appId, secret),
              Accept: 'application/json',
            },
          },
        )

        if (!response.ok) return null

        const json = (await response.json()) as {
          data: { attributes: { length?: number | null } } | null
          included?: Array<{
            type: string
            attributes: { content: string }
            relationships: { item_note_category: { data: { id: string } } }
          }>
        }

        if (!json.data) return null

        const length = json.data.attributes.length ?? null
        const notes = (json.included ?? [])
          .filter((inc) => inc.type === 'ItemNote')
          .map((inc) => ({
            categoryId: inc.relationships.item_note_category.data.id,
            content: inc.attributes.content,
          }))

        return { length, notes }
      } catch {
        return null
      }
    }

    /**
     * Create an item note on a Planning Center plan item.
     * POST /service_types/{stId}/plans/{planId}/items/{itemId}/item_notes
     */
    export async function createItemNote(
      appId: string,
      secret: string,
      serviceTypeId: string,
      planId: string,
      itemId: string,
      categoryId: string,
      content: string,
    ): Promise<void> {
      const response = await fetch(
        `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/items/${itemId}/item_notes`,
        {
          method: 'POST',
          headers: {
            Authorization: basicAuthHeader(appId, secret),
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: {
              type: 'ItemNote',
              attributes: {
                item_note_category_id: categoryId,
                content,
              },
            },
          }),
        },
      )

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Failed to create item note: ${response.status} ${text}`)
      }
    }
    ```

    Add exports to the import list in the test file.
  </action>
  <verify>
    <automated>npx vitest run src/utils/__tests__/planningCenterApi.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>
    fetchLastScheduledItem returns { length, notes } on success, null when song never scheduled, null on error.
    createItemNote sends correct POST body, throws on non-ok.
    All new tests pass, existing tests still pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire metadata copy into addSlotAsItem SONG branch</name>
  <files>src/utils/planningCenterApi.ts, src/utils/__tests__/planningCenterApi.test.ts</files>
  <behavior>
    addSlotAsItem SONG branch when pcSongId is resolved:
    - Calls fetchLastScheduledItem(appId, secret, pcSongId) inside the existing try/catch block
    - Uses lastItem.length as the length param to createItem (overrides the slot's passed-in length when present)
    - After createItem returns the new itemId, calls createItemNote for each note in lastItem.notes
    - Note-copying errors are swallowed individually (try/catch per note or around the loop) — never propagate
    - When fetchLastScheduledItem returns null (no history), createItem runs with the original length param and no notes are copied
    - When pcSongId is undefined (no CCLI match), behavior is unchanged (no new API calls)
  </behavior>
  <action>
    Add new tests to the existing 'addSlotAsItem' describe block covering:
    1. When CCLI match found and last item has length + notes: createItem receives the last item's length, createItemNote is called once per note with correct categoryId + content, total fetch call count is correct (search + arrangements + lastItem + createItem + N note POSTs)
    2. When fetchLastScheduledItem returns null (song never scheduled): createItem is still called normally with original length, no item note POSTs
    3. When one createItemNote call fails (rejects): does not throw, export still succeeds (returns item ID)

    Then update the SONG branch in addSlotAsItem. The existing try/catch at lines 583-597 should be extended:

    ```typescript
    try {
      const song = songs.find((s) => s.id === slot.songId)
      if (song && song.ccliNumber) {
        const pcSong = await searchSongByCcli(appId, secret, song.ccliNumber)
        if (pcSong) {
          pcSongId = pcSong.id
          const arrangements = await fetchSongArrangements(appId, secret, pcSong.id)
          if (arrangements.length > 0) {
            arrangementId = arrangements[0].id
          }
          // Fetch last scheduled item to carry forward length and notes
          const lastItem = await fetchLastScheduledItem(appId, secret, pcSong.id)
          if (lastItem) {
            if (lastItem.length !== null) {
              length = lastItem.length
            }
            lastItemNotes = lastItem.notes
          }
        }
      }
    } catch {
      // Non-fatal: fall through and create item without song link
    }
    ```

    Declare `let lastItemNotes: Array<{ categoryId: string; content: string }> = []` before the try block (alongside the existing `let pcSongId` and `let arrangementId` declarations).

    Change the `createItem` call to use the (possibly updated) `length` variable instead of the parameter directly. Since `length` is already the parameter name, and we're reassigning it, either rename the parameter to `slotLength` and use a local `let length = slotLength`, or use a separate local variable. Use a local `let effectiveLength = length` before the try block, then set `effectiveLength = lastItem.length` when available, and pass `effectiveLength` to createItem.

    After createItem returns the new itemId, add note-copying loop:

    ```typescript
    const newItemId = await createItem(...)
    // Copy item notes from last scheduled item (best-effort)
    for (const note of lastItemNotes) {
      try {
        await createItemNote(appId, secret, serviceTypeId, planId, newItemId, note.categoryId, note.content)
      } catch {
        // Non-fatal: skip this note
      }
    }
    return newItemId
    ```

    IMPORTANT: createItem currently returns directly via `return createItem(...)`. Change the SONG branch to `const newItemId = await createItem(...)`, then the loop, then `return newItemId`.
  </action>
  <verify>
    <automated>npx vitest run src/utils/__tests__/planningCenterApi.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>
    When CCLI match found and last item has metadata: length is forwarded to createItem, notes are POSTed to the new item.
    When no last item: export proceeds normally with no note POSTs.
    When note POST fails: export still returns item ID without throwing.
    All existing addSlotAsItem tests still pass (fetch call counts updated where needed).
    npx vitest run src/utils/__tests__/planningCenterApi.test.ts exits 0.
  </done>
</task>

</tasks>

<verification>
Run full test suite to confirm no regressions:
npx vitest run 2>&1 | tail -30

Verify the two new functions are exported and typechecks pass:
npx tsc --noEmit 2>&1 | head -20
</verification>

<success_criteria>
- fetchLastScheduledItem and createItemNote are exported from planningCenterApi.ts
- addSlotAsItem SONG branch calls fetchLastScheduledItem when pcSongId is resolved and carries forward length + notes
- All new behaviors are covered by tests; all existing tests continue to pass
- No export failures possible from note-copy errors (swallowed individually)
- npx vitest run exits 0
</success_criteria>

<output>
After completion, create `.planning/quick/3-auto-populate-pc-item-assignments-person/3-SUMMARY.md`
</output>
