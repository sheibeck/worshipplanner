---
phase: 260812-khb-rename-the-empty-library-import-from-csv
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [KHB-01, KHB-02, KHB-03]
files_modified:
  - src/components/SongTable.vue
  - src/components/__tests__/SongTable.test.ts
  - src/views/SongsView.vue
  - src/views/__tests__/SongsView.test.ts
  - src/stores/songs.ts
  - src/stores/__tests__/songs.test.ts
user_setup: []

must_haves:
  truths:
    - "When the song library is empty AND Planning Center is enabled, the empty state shows an 'Import Songs' button (not 'Import from CSV') that opens the SAME PcImportModal the top-of-page 'Import Songs' button opens (KHB-01)."
    - "Both import buttons — the top-of-page one and the empty-state one — are hidden when authStore.settings.pcEnabled is false (KHB-02)."
    - "An already-hidden song can be permanently removed from the Hidden Songs list via a Delete button that requires an in-app confirmation before deleting the Firestore document (KHB-03)."
    - "Permanent delete removes the song document and its lyrics subcollection; no firestore.rules change or deploy is required (delete is already permitted by the existing songs 'allow write' rule)."
  artifacts:
    - src/components/SongTable.vue
    - src/views/SongsView.vue
    - src/stores/songs.ts
  key_links:
    - "SongTable empty-state button --emit('import')--> SongsView @import handler --> importModalOpen=true --> PcImportModal (same flow as top button)"
    - "Hidden Songs Delete button --> inline confirm --> songStore.hardDeleteSong(id) --> deleteDoc(song) + batch-delete lyrics subcollection"
---

<objective>
Three related changes to the Songs library page (owner request), decomposed into three sub-features tracked as pseudo-requirements:

- **KHB-01** — Empty-state import button: rename "Import from CSV" to "Import Songs" and wire it to the SAME import flow as the top-of-page "Import Songs" button (open `PcImportModal`).
- **KHB-02** — Gate BOTH import buttons on the Planning Center integration setting (`authStore.settings.pcEnabled`): render only when PC is enabled.
- **KHB-03** — Permanent song delete: a song must already be hidden (soft-deleted), then the Hidden Songs list exposes a Delete button that, after an in-app confirmation, truly removes the song document (and its `lyrics` subcollection) from Firestore.

Purpose: Make the empty-state import affordance consistent and non-confusing, keep import controls out of the UI for orgs that don't use Planning Center, and give owners a way to fully purge a song rather than only hiding it.

Output: Updated `SongTable.vue`, `SongsView.vue`, and `songs.ts` store plus their tests.

## Investigation findings (verified against real source — do NOT re-derive)

- **Top "Import Songs" button** — `src/views/SongsView.vue:42-51`. It is ALREADY gated on `v-if="authStore.settings.pcEnabled"` and does `@click="importModalOpen = true"`, opening `<PcImportModal>` (`SongsView.vue:163-167`). KHB-02 for THIS button is already satisfied — do not re-add the gate; only add a test asserting it disappears when `pcEnabled` is false.
- **Empty-state button** — `src/components/SongTable.vue:45-54`. Today it is a `<router-link to="/songs?import=true">` whose visible label is "Import from CSV" (line 53). It is NOT gated on `pcEnabled`. It navigates to `/songs?import=true`, but the user is already on `/songs` and there is no watcher on `route.query.import` (only a one-shot check in `SongsView.vue`'s `onMounted`, lines 337-348) — so on the empty state it may not reopen the modal at all. Converting it to a button that emits `import` both unifies the behavior and removes that latent no-op.
- **SongTable already has** `useAuthStore` imported (`SongTable.vue:298`, `authStore` at 312) and a `defineEmits` block (line 305) currently emitting `add`/`select`/`update:selectedIds`.
- **Hidden Songs panel** — `src/views/SongsView.vue:122-148`. Lists `hiddenSongs` (`songs.filter(s => s.hidden === true)`, line 206) with only a Restore button today (lines 140-145). `onRestoreSong` calls `songStore.restoreSong` (line 208-210).
- **Soft delete today** — `songStore.deleteSong(id)` sets `hidden:true` via `updateDoc` (`songs.ts:305-311`). There is NO hard-delete action.
- **Firestore rule** — `firestore.rules:189-199`: `match /songs/{songId} { allow read, write: if isOrgEditor(orgId); match /lyrics/{lyricsId} { allow read, write: if isOrgEditor(orgId); } }`. `write` covers `delete` for BOTH the song doc and its `lyrics` subcollection. **No rules change and no `firebase deploy` are required for the hard delete.** (Firestore does not cascade subcollection deletes, so the store action deletes the `lyrics` docs explicitly.)
- **Confirmation pattern to mirror** — `src/components/SongSlideOver.vue:236-270`: an inline `showDeleteConfirm` toggle that swaps the button for an "Are you sure…?" panel with Cancel/Delete. Do NOT use `window.confirm`/`alert`.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

# Source under change (already read during planning — re-read the exact hunks before editing):
@src/components/SongTable.vue
@src/views/SongsView.vue
@src/stores/songs.ts
@src/components/SongSlideOver.vue

# Test conventions to match:
@src/views/__tests__/SongsView.test.ts
@src/stores/__tests__/songs.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rename empty-state import to "Import Songs", unify flow, PC-gate it (KHB-01, KHB-02)</name>
  <files>src/components/SongTable.vue, src/views/SongsView.vue, src/components/__tests__/SongTable.test.ts, src/views/__tests__/SongsView.test.ts</files>
  <action>
    In src/components/SongTable.vue empty-state block (currently lines 45-54): replace the `<router-link to="/songs?import=true">` labeled "Import from CSV" with a `<button type="button">` labeled "Import Songs" that keeps the same indigo styling and icon and does `@click="$emit('import')"`. Gate it with `v-if="authStore.settings.pcEnabled"` so it renders only when Planning Center is enabled. Keep the "Add song manually" button unconditionally (it is the only empty-state action when PC is off). Add `import: []` to the existing `defineEmits` block (line 305). Adjust the empty-state help paragraph (lines 41-43) so it does not advertise Planning Center/CSV import when `authStore.settings.pcEnabled` is false — when PC is off it should read as guidance to add songs manually (per KHB-02; keep the existing wording when PC is on).

    In src/views/SongsView.vue on the `<SongTable>` element (lines 112-119), add `@import="importModalOpen = true"` — the SAME state the top "Import Songs" button (line 44) sets, so both controls open the one `<PcImportModal>` (lines 163-167). Do NOT change the top button: it is already `v-if="authStore.settings.pcEnabled"` per KHB-02 — leave that gate in place. Remove the now-unused `?import=true` navigation coupling only from the empty-state control (leave the onMounted `route.query.import === 'true'` deep-link handler at lines 337-348 intact — external links may still use it).

    Tests: In src/components/__tests__/SongTable.test.ts add cases: (a) with `songs: []` and mocked `authStore.settings.pcEnabled = true`, the empty state renders a button whose text includes "Import Songs" and does NOT render the text "Import from CSV"; clicking it emits `import`. (b) with `pcEnabled = false`, that button is absent while "Add song manually" is still present. Match the auth-store getter-mock shape already used in the repo (see SongsView.test.ts lines 26-45). In src/views/__tests__/SongsView.test.ts, reuse the existing `findImportSongsButton` helper (lines 110-112): assert the top "Import Songs" button is present when `mockPcEnabled = true` and absent when `mockPcEnabled = false`.
  </action>
  <verify>
    <automated>npx vitest run src/components/__tests__/SongTable.test.ts src/views/__tests__/SongsView.test.ts</automated>
  </verify>
  <done>Empty-state shows "Import Songs" (never "Import from CSV"); clicking it opens the same PcImportModal as the top button; both import buttons are hidden when pcEnabled is false; "Add song manually" remains; component tests pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add hardDeleteSong store action with hidden-only guard + lyrics cleanup (KHB-03)</name>
  <files>src/stores/songs.ts, src/stores/__tests__/songs.test.ts</files>
  <behavior>
    - hardDeleteSong('s1') when s1 exists and is hidden === true: reads the song's `lyrics` subcollection and deletes every lyrics doc plus the song doc (single writeBatch commit, or deleteDoc for the song if no lyrics). Firestore `delete` on both paths is already permitted by the existing songs rule — no rules change.
    - hardDeleteSong('s2') when s2 is NOT hidden (hidden !== true): performs NO delete (no-op) — enforces the owner rule "you must delete it first" as defense-in-depth even though the UI only surfaces Delete on already-hidden songs.
    - hardDeleteSong('x') when orgId is null: no-op (mirrors the existing store guards on deleteSong/restoreSong).
  </behavior>
  <action>
    In src/stores/songs.ts add a `hardDeleteSong(id: string)` action. Extend the `firebase/firestore` import (lines 3-14) with `deleteDoc` and `getDocs` (the file already imports `collection`, `doc`, `writeBatch`, `serverTimestamp`). Implementation: return early if `orgId.value` is falsy. Look up the song in `songs.value` by id; if not found or `song.hidden !== true`, return without deleting (the hidden-only guard). Otherwise: read `getDocs(collection(db, 'organizations', orgId.value, 'songs', id, 'lyrics'))`, create a `writeBatch`, `batch.delete` each lyrics doc ref, `batch.delete` the song doc ref (`doc(db, 'organizations', orgId.value, 'songs', id)`), then `await batch.commit()`. Export `hardDeleteSong` from the store's returned object (add alongside `deleteSong`/`restoreSong`, lines 439-441). Add a brief comment noting the delete is permitted by the existing `allow write` songs rule (firestore.rules:190) so no rules deploy is needed, and that Firestore does not cascade subcollection deletes (hence the explicit lyrics cleanup).

    Tests: In src/stores/__tests__/songs.test.ts add `getDocs` to the `firebase/firestore` mock (the mock already has `deleteDoc` at line 29 and `writeBatch` at line 30) — return a snapshot whose `docs` array is configurable per test (default: a couple of fake lyrics docs each with a `ref`). Extend the shared `mockBatch` to record `delete` ops (push `{ type: 'delete', ref }` to `mockBatchOps`). Assert: (1) hardDeleteSong on a hidden song commits a batch that deletes the song doc and each lyrics doc; (2) hardDeleteSong on a non-hidden song performs no delete/commit; (3) with orgId unset, no-op. Seed `songs.value` via the existing snapshotCallback harness so the store sees the target song and its hidden flag.
  </action>
  <verify>
    <automated>npx vitest run src/stores/__tests__/songs.test.ts</automated>
  </verify>
  <done>songStore.hardDeleteSong permanently deletes a hidden song's document and its lyrics subcollection, is a no-op for non-hidden songs and when orgId is unset, is exported, and its unit tests pass. No firestore.rules edit made.</done>
</task>

<task type="auto">
  <name>Task 3: Hidden Songs list — Delete button with in-app confirmation (KHB-03)</name>
  <files>src/views/SongsView.vue, src/views/__tests__/SongsView.test.ts</files>
  <action>
    In src/views/SongsView.vue Hidden Songs panel (lines 122-148), add a "Delete" button beside the existing "Restore" button for each hidden song, styled red like SongSlideOver's destructive action (border-red-700 / text-red-300). Because the panel lists multiple songs, track the pending confirmation by song id, not a single boolean: add `const deleteConfirmId = ref<string | null>(null)` and `const deletingId = ref<string | null>(null)`. When `deleteConfirmId === song.id`, replace that row's action buttons with an inline confirm panel that MIRRORS the SongSlideOver.vue:247-269 pattern (red-tinted box, no window.confirm): text "Permanently delete \"{{ song.title }}\"? This cannot be undone." plus a Cancel button (`@click="deleteConfirmId = null"`) and a Delete button (`:disabled="deletingId === song.id"`, label toggles to "Deleting…"). The Delete button calls a new `onHardDeleteSong(song)` async handler that sets `deletingId = song.id`, `await songStore.hardDeleteSong(song.id)`, then clears `deletingId`/`deleteConfirmId` in a `finally`. Wire `songStore.hardDeleteSong` (add it to whatever the component reads from the store — the store instance is already `songStore`). Clicking Delete on a row sets `deleteConfirmId = song.id` first (confirmation required before any delete).

    Tests: In src/views/__tests__/SongsView.test.ts add `hardDeleteSong: mockHardDeleteSong` (a `vi.fn(() => Promise.resolve())`) to the songs-store mock (lines 60-78) and reset it in `beforeEach`. Because `mountSongsView` stubs `SongTable`, drive the Hidden Songs panel directly: seed `mockSongs` with one hidden song (`hidden: true`), mount, open the panel (set `showHidden` — click the "Hidden (n)" toggle or set the component state), then: (1) clicking that row's "Delete" shows the confirm text and does NOT yet call hardDeleteSong; (2) clicking Cancel hides the confirm and still no call; (3) clicking Delete in the confirm calls `mockHardDeleteSong` with the song id.
  </action>
  <verify>
    <automated>npx vitest run src/views/__tests__/SongsView.test.ts</automated>
  </verify>
  <done>Each hidden song row has a Delete button that first shows an in-app confirmation (no window.confirm); confirming calls songStore.hardDeleteSong(id); Cancel aborts with no delete; SongsView tests pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → Firestore (songs collection) | An org editor issues a permanent `delete` on a song document and its `lyrics` subcollection. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-khb-01 | Elevation of Privilege | firestore.rules songs delete | high | accept | Existing rule `allow read, write: if isOrgEditor(orgId)` (firestore.rules:190) already scopes delete to org editors of that org; hard delete introduces no new authority and no rule change. No cross-org exposure. |
| T-khb-02 | Repudiation / accidental destruction | Hidden Songs Delete UI | medium | mitigate | Destructive action requires an explicit in-app confirmation step (no one-click delete, no window.confirm), and the store guards to hidden-only songs — the song must first be soft-deleted, giving two deliberate steps before permanent loss. |
| T-khb-03 | Tampering (orphaned data) | songs/{id}/lyrics subcollection | low | mitigate | hardDeleteSong explicitly batch-deletes the `lyrics` subcollection alongside the song doc, since Firestore does not cascade subcollection deletes. |
| T-khb-SC | Tampering | npm/pip/cargo installs | n/a | accept | No new packages are installed by this task — no supply-chain surface. |
</threat_model>

<verification>
- `npm run type-check` is clean (uses `vue-tsc --build`, which also typechecks the test files — per CLAUDE.md the `-p tsconfig.app.json` form is NOT sufficient).
- `npx vitest run` (bare app suite) passes. Known-failing baseline is `src/storage.rules.test.ts` and `src/views/__tests__/RosterView.test.ts` (stale assertion) — those two are pre-existing and out of scope; nothing else may regress.
- No change was made to `firestore.rules`; therefore no `npm run test:rules` run and no `firebase deploy` owner step is required for this task.
</verification>

<success_criteria>
- Empty-state control reads "Import Songs" (never "Import from CSV") and opens the same PcImportModal as the top-of-page button.
- Both import buttons are hidden when `authStore.settings.pcEnabled` is false; visible when true.
- A hidden song can be permanently deleted from the Hidden Songs list only after an in-app confirmation; the song document and its lyrics subcollection are removed from Firestore.
- `npm run type-check` clean and `npx vitest run` green (excluding the two documented baseline failures).
</success_criteria>

<output>
Create `.planning/quick/260812-khb-rename-the-empty-library-import-from-csv/260812-khb-SUMMARY.md` when done.
</output>
