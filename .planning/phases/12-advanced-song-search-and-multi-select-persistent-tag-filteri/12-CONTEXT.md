# Phase 12: Advanced song search and multi-select persistent tag filtering - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a metadata-aware song search and a persistent multi-select tag filter that behave consistently across BOTH the service-plan song picker (`SongSlotPicker.vue`) and the Songs panel (`SongsView`/`SongTable`/`SongFilters`), so any song is findable by name or any known metadata and tag filtering is fast and remembered. Plus a delete-confirmation guard on the "Remove element" X in the service editor.

Four scoped items (from ROADMAP.md):
1. Robust search in one box — bare natural terms match across metadata + explicit field-scoped filters, combinable. Builds on Phase 11's `songMatchesQuery`.
2. Tag filter UI redesign — replace the two "Show only tag"/"Hide tag" dropdowns with a single checkbox list; a "Hide" toggle inverts semantics; "Clear" resets.
3. Persistence — remember the tag show/hide filter settings across sessions.
4. Delete-confirmation on the "Remove element" X.

This clarifies HOW to implement the four items. No new capabilities.

</domain>

<decisions>
## Implementation Decisions

### Search behavior (item 1)
- **D-01:** Extend the search engine (`songMatchesQuery` in `src/utils/songSearch.ts`) to a **multi-term AND** model: split the query on whitespace and every resulting term must match the song for it to be included. This replaces today's single-whole-string substring match. Enables combinable criteria like `tag:Orchestra key:E`.
- **D-02:** Support **field-scoped filters** with the syntax `prefix:value`, **space-tolerant** — both `key:E` and `key: E` parse identically (roadmap writes `tag: Orchestra` with a space). The parser trims whitespace after the colon.
- **D-03:** Supported prefixes (disambiguating the three tag types): `type:` → VW category (1/2/3), `key:` → arrangement key, `tag:` → user-defined `Song.tags`, `theme:` → PC-imported `themes`, `team:` → `teamTags`. A term with no recognized prefix is a **bare term** matched across all searchable fields (current `songMatchesQuery` field set).
- **D-04:** **Value matching:** `type:`/`tag:`/`theme:`/`team:` match as **case-insensitive substring** (e.g. `tag:orch` finds "Orchestra"); `key:` stays **exact** (case-insensitive) so `key:E` matches E but not Em/Eb.
- **D-05:** **Natural two-word phrase recognition:** pre-parse bare `type N` → treat as `type:N`, and `key X` → treat as `key:X`, BEFORE whitespace AND-splitting. This makes the roadmap examples ("Type 1" → category, "Key A" → arrangement key) work without users learning colon syntax. Only these two phrase patterns are special-cased; a lone bare number/letter is NOT inferred as type/key (avoids false matches).
- **D-06:** Field-scoped search **coexists** with the existing VW-type and Key dropdowns in `SongFilters.vue` — dropdowns stay as quick affordances; the search box adds power-user syntax on top. (The two user-tag dropdowns ARE replaced — see D-07.)
- **D-07:** The search engine/parser is **shared** by both surfaces (picker + Songs panel) via `src/utils/songSearch.ts` so behavior is identical in both.

### Tag filter UI (item 2)
- **D-08:** Replace the two "Show only tag" / "Hide tag" dropdowns (`filterTagInclude`/`filterTagExclude`) with a **single combined tag control** sourcing the de-duplicated union of `teamTags ∪ themes ∪ tags`, with a Hide toggle and Clear action. The three `Song` fields (`teamTags`, `themes`, `tags`) stay separate in the data model — no merge — only the UI/filter surface is unified. (Amended per 12-UAT test 3 Option A, 2026-07-02: the original "user tags only" scope was widened to the teamTags ∪ themes ∪ tags union in plans 12-06/12-07; the standalone teamTags "All tags" select is absorbed into this control.)
- **D-09:** Default (show-only) mode: checked tags combine with **OR** — a song shows if it carries ANY checked tag. Checking more tags broadens results.
- **D-10:** A top-level **"Hide" toggle** inverts semantics globally: when ON, the same checked tags become an exclusion set (a song is hidden if it carries ANY checked tag). Simple "show these" vs "hide these" mental model.
- **D-11:** A **"Clear"** action unchecks all tags and resets the Hide toggle to OFF (returns the tag filter to neutral). Clear is scoped to the tag filter only — it does NOT touch the search box or the VW-type/Key dropdowns.

### Persistence (item 3)
- **D-12:** Persist **only** the tag-filter state — which tags are checked and the Hide toggle on/off. The search text and VW-type/Key dropdowns reset fresh each time (not persisted).
- **D-13:** Persist to **localStorage** so it survives reloads and browser restarts ("across sessions"). Key the entry per user (and/or org) to prevent state bleeding between accounts on a shared browser.
- **D-14:** The persisted tag filter is a **single shared state** used by BOTH the picker and the Songs panel. (User accepted the tradeoff: a tag filter set while planning also applies to the catalog-management view and vice versa.)

### Delete-confirmation (item 4)
- **D-15:** The "Remove element" X (`removeSlot()` in `ServiceEditorView.vue`, line ~763/1341) must prompt a confirmation for **ALL element removals — including empty/blank rows** (unpopulated song slots and blank Prayer/Message/Scripture/Hymn elements). This extends Phase 11 D-14, which only gated POPULATED slots and let empty slots delete silently. Removing an entire element/row is a structural change worth guarding regardless of content.
- **D-16:** **Reuse the existing D-14 Teleport modal** (backdrop `z-40`, dialog `z-50`, Cancel + red confirm button). The remove-element modal uses a **generic heading** ("Remove this element from the plan?") with an **element-type-aware body** that names the element via `elementLabel(kind)` (e.g. "This will remove this song / this scripture from the service plan. This cannot be undone."). The clear-song path keeps its own generic heading/body. Do not build a second confirmation pattern. Note: `onClearSong()` (clearing a song from a slot while keeping the slot) already has its own D-14 gate and is a distinct action from removing the whole element. (Accepted per 12-UAT test 8, 2026-07-02: the shipped wording — generic heading + type-aware body — is the intended behavior. An earlier note claiming *fully* generic wording was inaccurate and is superseded by this description of what actually shipped.)

### Claude's Discretion
- Exact parser implementation for splitting terms and recognizing prefixes (regex vs tokenizer), as long as D-01–D-05 semantics hold.
- Visual layout of the tag checkbox list (scrollable panel, popover vs inline) and its sort order — follow existing dark-mode palette (gray-950/900/800) and `SongFilters.vue` conventions.
- Exact localStorage key naming/versioning and how per-user scoping is derived (auth uid / org id).
- Search result ordering (Phase 11 D-10 already removed VW-type ranking bias; keep whatever ordering the surfaces currently use).
- Whether the shared tag-filter state is exposed via the existing Pinia `songs` store or a small dedicated composable — pick the lower-friction integration.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior Phase Decisions
- `.planning/phases/11-song-catalog-service-planner-improvements/11-CONTEXT.md` — Phase 11 search + tag foundation this phase extends. Key: D-05 (fields `songMatchesQuery` covers), D-06 (three distinct tag types: team tags / themes / user tags), D-01 (dedicated `Song.tags` field), D-14 (populated-slot delete confirmation modal + z-index pattern this phase extends).
- `.planning/PROJECT.md` — Vertical Worship 1-2-3 methodology, dark-mode canonical theme (gray-950/900/800), Firebase/Firestore + Pinia + Tailwind v4 stack.

### Search engine
- `src/utils/songSearch.ts` — `songMatchesQuery()`: current single-substring match across title, CCLI, author, themes, teamTags, VW type+label, user tags, notes, key. Extend to multi-term AND + field-scoped prefixes + phrase recognition (D-01–D-07).

### Tag filter UI + filter state
- `src/components/SongFilters.vue` — current 5-dropdown filter row (VW type, Key, team tag, "Show only tag", "Hide tag"). Replace the two user-tag dropdowns with the single checkbox list (D-08–D-11).
- `src/stores/songs.ts` — filter state (`searchQuery`, `filterVwType`, `filterKey`, `filterTag`, `filterTagInclude`, `filterTagExclude`) and `filteredSongs` computed. Rework the user-tag include/exclude state into the new checklist model + persistence (D-08–D-14).
- `src/views/SongsView.vue` — Songs panel host wiring `SongFilters` ↔ store.

### Service planner picker
- `src/components/SongSlotPicker.vue` — planner picker with its own local `searchQuery` (line ~242); no tag filter today. Must adopt the shared search engine + shared persistent tag filter (D-07, D-14).

### Delete-confirmation
- `src/views/ServiceEditorView.vue` — `removeSlot()` (~1341) already gates populated slots via D-14 modal; `isSlotPopulated()` (~1314); `onClearSong()` (~1388); the "Remove element" X button (~763, `title="Remove element"`); `confirmSlotDelete()` (~1356); modal state (`showSlotDeleteConfirm`, `pendingDeleteIndex`, `pendingDeleteIsClear`). Extend confirmation to empty slots (D-15–D-16).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `songMatchesQuery()` (`songSearch.ts`) — the single search function both surfaces call; the natural extension point for the new engine so picker + panel stay identical.
- `filteredSongs` computed (`songs.ts`) — already composes search + all filters and excludes hidden songs; the new tag-checklist logic slots in here.
- D-14 delete-confirmation modal in `ServiceEditorView.vue` (`showSlotDeleteConfirm` + `confirmSlotDelete()`) — reuse verbatim for empty-slot confirmation; only the gating condition in `removeSlot()` changes.
- `TeamTagPill.vue` / pill rendering (from Phase 11) — for showing tags in the checklist / results if needed.

### Established Patterns
- Search: case-insensitive substring across fields in `songSearch.ts` (to become multi-term AND + prefix-aware).
- Filter state: Pinia refs in `songs.ts` with a `filteredSongs` computed; components use `v-model`-style `update:` emits (`SongFilters.vue`).
- No `localStorage` usage exists anywhere in `src/` yet — persistence (D-13) is a new, self-contained pattern to introduce.
- Modals: Teleport + Transition, backdrop z-40 / dialog z-50, Cancel + red confirm (D-14).

### Integration Points
- New search parser lives in `songSearch.ts`; consumed by `songs.ts` `filteredSongs` (Songs panel) and by `SongSlotPicker.vue`'s local search computed.
- New shared tag-filter state (checked tags + Hide flag) + localStorage read/write, exposed so BOTH `SongFilters.vue`/`SongsView` and `SongSlotPicker.vue` bind to the same source (D-14).
- Delete-confirm change is isolated to `removeSlot()`'s gating condition in `ServiceEditorView.vue`.

</code_context>

<specifics>
## Specific Ideas

- Roadmap example queries that must work: `Type 1`/`Type 2` (→ VW category), `Adoration` (→ theme), `Key A` (→ arrangement key), and explicit `tag: Orchestra`, `key: E`, `type: 1`.
- `tag:` explicitly means user tags; `team:` means team tags; `theme:` means PC themes — the three tag types stay conceptually distinct (carried from Phase 11 D-06).
- User deliberately chose a SINGLE shared tag filter across picker + Songs panel despite the cross-context coupling — treat that as intentional, not a bug.
- The "Remove element" X guard is intentionally broader than D-14: every element removal is confirmed, even empty rows.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Areas offered but not explored, left to Claude's discretion within the decisions above: search result ordering, tag-list sort order, empty-state copy, mobile layout of the checklist.)

</deferred>

---

*Phase: 12-advanced-song-search-and-multi-select-persistent-tag-filteri*
*Context gathered: 2026-07-01*
