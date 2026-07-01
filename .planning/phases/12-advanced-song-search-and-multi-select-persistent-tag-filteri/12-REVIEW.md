---
phase: 12-advanced-song-search-and-multi-select-persistent-tag-filteri
reviewed: 2026-07-01T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/utils/songSearch.ts
  - src/stores/songs.ts
  - src/views/ServiceEditorView.vue
  - src/components/TagFilterChecklist.vue
  - src/components/SongFilters.vue
  - src/views/SongsView.vue
  - src/components/SongSlotPicker.vue
  - src/utils/__tests__/songSearch.test.ts
  - src/stores/__tests__/songs.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-07-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the Phase 12 diff (base `ecbad1e`): the multi-term/field-scoped search engine (`songSearch.ts`), the shared multi-select persistent tag-filter model (`songs.ts` store + `TagFilterChecklist.vue`), its wiring into `SongFilters.vue`/`SongsView.vue` and `SongSlotPicker.vue`, and the widened delete-confirmation gate in `ServiceEditorView.vue`. The implementation closely follows the phase's documented decisions (D-01 through D-18) and threat model (T-12-03/04/05), and test coverage is thorough for the documented scenarios.

Two real issues were found. The more significant one is a logic gap in `hydrateTagFilter()`: when a new org/user subscribes and has no previously-saved tag filter, the in-memory `tagFilterChecked`/`tagFilterHide` state is not reset, so a previous user's tag-filter selection on the same tab can silently leak into the new session — this partially undermines the explicit "state never bleeds across accounts on a shared browser" guarantee stated in the store's own comments (though the localStorage *key* namespacing itself, which was the stated T-12-03 threat-model mitigation, is implemented correctly). The other issue is a search-tokenizer limitation where multi-word field-scoped values (e.g. `tag: christmas eve`) silently fail to match because the tokenizer splits on whitespace after collapsing only the first word after the colon. Two minor Info-level items (dead code, cross-page shared-state side effect) are also noted.

## Warnings

### WR-01: Tag filter does not reset to defaults when switching to an org/user with no saved filter

**File:** `src/stores/songs.ts:96-106`
**Issue:** `hydrateTagFilter()` returns early without resetting `tagFilterChecked`/`tagFilterHide` when no stored value exists for the current user/org key:

```ts
function hydrateTagFilter() {
  const key = tagFilterStorageKey()
  if (!key) return
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return   // <-- leaves current in-memory state untouched
    ...
```

Because `useSongStore()` is a singleton Pinia store, `tagFilterChecked`/`tagFilterHide` persist in memory across `subscribe()` calls. If User A sets a non-default tag filter, then logs out and User B logs in within the same tab/session (no full page reload), `subscribe()` → `hydrateTagFilter()` runs again for User B's org/uid. If User B has never saved a tag filter (`raw` is `null`), the function returns early and User A's in-memory selection remains active and visibly applied to User B's song list — despite the code comment directly above `tagFilterStorageKey()` stating this design exists "so state never bleeds across accounts on a shared browser (T-12-03)". The localStorage key namespacing itself is correct (no cross-account *read* of another account's key), but the in-memory carry-over defeats the stated goal in this scenario. Not covered by the existing test suite (`songs.test.ts` only tests hydration when a stored key exists, or first-ever load with clean state).
**Fix:**
```ts
function hydrateTagFilter() {
  const key = tagFilterStorageKey()
  if (!key) {
    tagFilterChecked.value = new Set()
    tagFilterHide.value = false
    return
  }
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      tagFilterChecked.value = new Set()
      tagFilterHide.value = false
      return
    }
    const parsed = JSON.parse(raw) as { checked?: string[]; hide?: boolean }
    tagFilterChecked.value = new Set(Array.isArray(parsed.checked) ? parsed.checked : [])
    tagFilterHide.value = parsed.hide === true
  } catch {
    tagFilterChecked.value = new Set()
    tagFilterHide.value = false
  }
}
```

### WR-02: Multi-word field-scoped filter values silently fail to match (`tag: christmas eve`)

**File:** `src/utils/songSearch.ts:83-92`
**Issue:** The space-collapse step only removes whitespace immediately after the prefix colon, then the whole string is tokenized on whitespace. A field value containing multiple words (e.g. a user tag literally named "Christmas Eve") cannot be matched as a single field-scoped phrase:

```ts
const spaceCollapsed = phraseNormalized.replace(/\b(type|key|tag|theme|team):\s+/gi, '$1:')
const tokens = spaceCollapsed.trim().split(/\s+/).filter((t) => t.length > 0)
```

`tag: christmas eve` becomes tokens `["tag:christmas", "eve"]`. Because `songMatchesQuery` requires every token to match (AND), the song must independently satisfy a *bare* substring match for "eve" (checked against title/CCLI/author/themes/teamTags/vwTypes/tags/notes/arrangement key) in addition to `tag:christmas`. A song tagged exactly "Christmas Eve" with no other field containing "eve" will not be found by this query, which is a surprising and silent failure mode for a filter feature whose whole purpose is precise tag matching. Not covered by `songSearch.test.ts` (only single-word field values are tested).
**Fix:** Either document this as a known single-word-value limitation in the search placeholder/tooltip, or extend the tokenizer to consume all words up to the next recognized `prefix:` token or end-of-string when a field prefix is present, e.g.:
```ts
// After phrase pre-parse, greedily capture everything after "prefix:" up to
// the next recognized prefix keyword (or end of string) as that field's value.
const FIELD_TOKEN_RE = /\b(type|key|tag|theme|team):\s*([^]*?)(?=\s+\b(?:type|key|tag|theme|team):|$)/gi
```
(Requires reworking `matchesToken`'s per-token dispatch to operate on these captured spans instead of naive whitespace splitting — a larger change; at minimum, this limitation should be surfaced to the user.)

## Info

### IN-01: `isSlotPopulated` is now dead code

**File:** `src/views/ServiceEditorView.vue:1333-1350`
**Issue:** The D-15 change to `removeSlot()` (line ~1360) now unconditionally shows the confirmation dialog for all element removals, regardless of whether the slot is populated. The `isSlotPopulated()` helper function that previously gated this decision is no longer called anywhere in the file:
```ts
function isSlotPopulated(slot: ServiceSlot): boolean {
  if (slot.kind === 'SONG') { ... }
  ...
}
```
**Fix:** Remove the unused function, or if it's kept intentionally for a future feature, add a `// TODO` note explaining why it's retained. As-is it's a 17-line dead code block.

### IN-02: Tag filter state is shared (and mutated) across the Songs panel and the Service Editor's song picker

**File:** `src/components/SongSlotPicker.vue:50-57`, `src/stores/songs.ts:34-35`
**Issue:** `SongSlotPicker.vue` binds its tag-filter checklist directly to the same `songStore.tagFilterChecked`/`songStore.tagFilterHide` state used by the standalone Songs panel (`SongFilters.vue`). This is documented as intentional (D-14: "shared checklist bound to songStore") and is core to this phase's goal of a persistent, shared filter — not a defect. Flagging only as a note: because the state is shared and persisted, a user who narrows the tag filter while picking a song inside a service plan will find that same narrowed filter still applied the next time they open the standalone Songs panel (and vice versa), which could be surprising if not documented anywhere user-facing (e.g. in a tooltip or help text).
**Fix:** No code change required. Consider a subtle UI affordance (e.g. "Filter also applied on Songs page") if user feedback indicates this cross-page persistence is confusing in practice.

---

_Reviewed: 2026-07-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
