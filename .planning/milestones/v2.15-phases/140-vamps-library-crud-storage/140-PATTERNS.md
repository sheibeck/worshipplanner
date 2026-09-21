# Phase 140: Vamps Library — CRUD & Storage - Pattern Map

**Mapped:** 2026-09-09
**Files analyzed:** 10 new/modified
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/types/vamp.ts` | model | CRUD | `src/types/song.ts` | exact (narrowed) |
| `src/stores/vamps.ts` | store | CRUD | `src/stores/songs.ts` | exact (narrowed) |
| `src/stores/orgScopedStores.ts` (modify) | store | event-driven (teardown) | itself | exact |
| `src/utils/vampFiles.ts` | utility | file-I/O | `src/utils/songFiles.ts` | exact |
| `src/composables/useVampFileUpload.ts` | hook/composable | streaming (resumable upload) | `src/composables/useSongFileUpload.ts` | exact (narrowed to single-file) |
| `src/components/VampTable.vue` | component | request-response (render+search) | `src/components/SongTable.vue` | role-match |
| `src/components/VampSlideOver.vue` | component | CRUD (form) | `src/components/SongSlideOver.vue` | exact (narrowed, no tabs) |
| `src/views/SongsView.vue` (modify) | component/view | request-response | itself (add tab bar) | exact |
| `storage.rules` (modify) | config | request-response (authz) | `song-files/` block (lines 99-120) | exact |
| `firestore.rules` (no change — verify only) | config | request-response (authz) | generic catch-all (lines ~508-515) | exact (no new block needed) |
| `src/constants/keys.ts` (modify — add `VAMP_KEYS`) | config | — | `MAJOR_KEYS` in same file | exact |
| test files (`vamps.test.ts`, `vampFiles.test.ts`, storage.rules vamp-files cases, rules.test.ts vamps case) | test | CRUD/request-response | `src/stores/__tests__/songs.test.ts`, `src/storage.rules.test.ts:406-505`, `src/rules.test.ts:82-88` | exact |

## Pattern Assignments

### `src/types/vamp.ts` (model)

**Analog:** `src/types/song.ts` (full file read)

Mirror `SongAttachment` collapsed into a single optional field, and `Song` collapsed to one key/no arrangements. Concrete shape to write (adapted from `src/types/song.ts:23-45,47-68`):

```typescript
import type { Timestamp } from 'firebase/firestore'

export interface VampAttachment {
  storagePath: string
  downloadUrl: string
  fileName: string
  mimeType: string
  sizeBytes: number
  createdAt: Timestamp
  createdBy: string
}

export interface Vamp {
  id: string
  name: string
  key: string
  tempo?: string
  attachment?: VampAttachment | null
  hidden: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type UpsertVampInput = Omit<Vamp, 'id' | 'createdAt' | 'updatedAt'>
```

Note: `Song.attachments` uses `id`/`kind`/`name` fields (`song.ts:29-45`); a `VampAttachment` has no `id` (single slot, no array) and no `kind` (always audio) — this is a deliberate narrowing, not an oversight.

---

### `src/stores/vamps.ts` (store, CRUD)

**Analog:** `src/stores/songs.ts` (subscribe/unsubscribe lines 242-289, addSong/updateSong 291-306, delete/hardDelete 383-433)

**Subscribe/unsubscribe pattern** (`songs.ts:242-289`, drop the legacy-field normalization — vamps have no legacy shape):
```typescript
function subscribe(orgIdValue: string) {
  if (unsubscribeFn) unsubscribeFn()
  orgId.value = orgIdValue
  const q = query(collection(db, 'organizations', orgIdValue, 'vamps'), orderBy('name'))
  unsubscribeFn = onSnapshot(q, (snap) => {
    vamps.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Vamp)
    isLoading.value = false
  })
}

function unsubscribeAll() {
  unsubscribeFn?.()
  unsubscribeFn = null
  orgId.value = null
  vamps.value = []
  isLoading.value = true
}
```

**addSong/updateSong pattern** (`songs.ts:291-306`) — copy verbatim, `songs`→`vamps`:
```typescript
async function addVamp(data: UpsertVampInput) {
  if (!orgId.value) return
  await addDoc(collection(db, 'organizations', orgId.value, 'vamps'), {
    ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

async function updateVamp(id: string, data: Partial<UpsertVampInput>) {
  if (!orgId.value) return
  await updateDoc(doc(db, 'organizations', orgId.value, 'vamps', id), {
    ...data, updatedAt: serverTimestamp(),
  })
}
```

**Attachment write — DO NOT copy `addSongAttachment`'s `arrayUnion`/transaction machinery** (`songs.ts:314-321`, `360-381`). A vamp's single attachment slot is a plain `updateVamp(id, { attachment })` — no concurrency problem to solve here (per RESEARCH.md Pattern 2 / Anti-Patterns).

**Delete — per RESEARCH.md Assumption A3, recommend single-step hard delete** (simpler than `deleteSong`'s soft-delete `hidden:true` + separate `hardDeleteSong`, `songs.ts:383-433`), matching the design's single "Delete vamp" button with no restore affordance. If planner prefers mirroring the two-step Song precedent instead, `hardDeleteSong`'s Storage-cleanup-then-Firestore-delete order (`songs.ts:400-421`) is the template:
```typescript
async function deleteVamp(id: string) {
  if (!orgId.value) return
  const vamp = vamps.value.find((v) => v.id === id)
  if (vamp?.attachment?.storagePath) {
    try {
      await deleteObject(storageRef(storage, vamp.attachment.storagePath))
    } catch (err) {
      console.error(`deleteVamp: failed to delete attachment ${vamp.attachment.storagePath}:`, err)
    }
  }
  await deleteDoc(doc(db, 'organizations', orgId.value, 'vamps', id))
}
```

**Drop entirely from the mirror** (per RESEARCH.md Pattern 2): `filteredSongs`'s tag/VW-type filter machinery, `columnVisibility`, `allUserTags`, `aiCandidateSongs`, `upsertSongs`/`importSongs`. Keep only a simple `search` computed filtering by name-or-key substring match.

---

### `src/stores/orgScopedStores.ts` (MODIFY)

**Analog:** itself — add one line, same shape as every other entry.

Current full file (`src/stores/orgScopedStores.ts:23-39`):
```typescript
export function resetOrgScopedStores(): void {
  useServiceStore().unsubscribeAll()
  useSongStore().unsubscribeAll()
  useRosterStore().unsubscribeAll()
  useTeamsStore().unsubscribeAll()
  useQuartersStore().unsubscribeAll()
  useSlideGroups().unsubscribeGroups()
  useScriptureSlides().unsubscribeReadings()
  useImportedSlides().unsubscribeDecks()
  usePptxRenders().unsubscribeAll()
  useServiceMessagesStore().unsubscribeServiceMessages()
  useSongLyricsStore().unsubscribeLyrics()
  useMembersStore().unsubscribeAll()
}
```
Add `import { useVampStore } from './vamps'` at top and `useVampStore().unsubscribeAll()` inside the function, in the same commit that creates `vamps.ts` (Pitfall 1 in RESEARCH.md — easy to miss, causes cross-org data leak on sidebar church-switch).

---

### `src/utils/vampFiles.ts` (utility, file-I/O)

**Analog:** `src/utils/songFiles.ts` (full file, 22 lines)

```typescript
import { sanitizeFileName } from '@/utils/songFiles'  // reuse directly, do not duplicate

export const VAMP_FILE_MAX_BYTES = 52428800
export const VAMP_FILE_ALLOWED_MIME = ['audio/mpeg'] as const

// orgs/{orgId}/vamp-files/{vampId}/{uploadId}/{sanitizedName} — per-upload
// segment (uploadId) makes MP3 replace safe under storage.rules' immutable
// `update: if false` (see storage.rules pattern below; mirrors song-files/'s
// per-attachment-id uniqueness). Sibling of song-files/, outside media/, so
// structurally exempt from every retention sweep (MEDIA_PATH_GUARD).
export function vampFileStoragePath(orgId: string, vampId: string, uploadId: string, name: string): string {
  return `orgs/${orgId}/vamp-files/${vampId}/${uploadId}/${sanitizeFileName(name)}`
}
```
NOTE the literal CONTEXT.md path (`vamp-files/{vampId}/{name}`, no upload segment) will break MP3 replacement under the immutable-upload rule — RESEARCH.md Pitfall 2/Assumption A2 recommends the extra `{uploadId}` segment above; flag to planner if not already decided.

---

### `src/composables/useVampFileUpload.ts` (composable, streaming)

**Analog:** `src/composables/useSongFileUpload.ts` (full file, 227 lines)

**kindForFile narrows away** (`useSongFileUpload.ts:60-64`) — a vamp is always audio, no kind discrimination needed.

**Validation pattern to copy, narrowed to MP3-only** (`useSongFileUpload.ts:74-89`):
```typescript
function validateVampFile(file: File): string | null {
  const lowerName = file.name.toLowerCase()
  const hasAllowedExt = lowerName.endsWith('.mp3')
  const hasAllowedMime = (VAMP_FILE_ALLOWED_MIME as readonly string[]).includes(file.type)
  if (!hasAllowedMime || !hasAllowedExt) {
    return `'${file.name}' can't be uploaded — MP3 only, up to 50 MB.`
  }
  if (file.size >= VAMP_FILE_MAX_BYTES) {
    return `'${file.name}' is too large — max 50 MB.`
  }
  return null
}
```

**Upload task pattern** (`useSongFileUpload.ts:172-221`) — copy the `uploadBytesResumable` + `task.on('state_changed', progress, error, complete)` shape verbatim; on complete, call `getDownloadURL` then persist via a plain `vampStore.updateVamp(vampId, { attachment })` (NOT `addSongAttachment`'s arrayUnion — single-slot semantics per store pattern above). Drop the duplicate-name-guard block (`useSongFileUpload.ts:117-144`) — a vamp attachment replace is intentional, not a duplicate to reject; the new upload simply replaces the existing `attachment` field.

Generate `uploadId = crypto.randomUUID()` per upload (mirrors `attachmentId` at `useSongFileUpload.ts:162`) and pass to `vampFileStoragePath(orgId, vampId, uploadId, file.name)`.

---

### `src/components/VampTable.vue` (component, request-response)

**Analog:** `src/components/SongTable.vue` (role-match: flat searchable table)

Read `SongTable.vue`'s row-render + search-filter structure directly when planning; columns narrow to Vamp/Key/Tempo/Audio per 140-DESIGN-NOTES.md ("8 vamps · 6 with audio" sub-head, "No MP3 attached" amber warning state when `attachment` is null). Row click opens `VampSlideOver.vue` — same interaction as `SongTable.vue`→`SongSlideOver.vue`.

---

### `src/components/VampSlideOver.vue` (component, CRUD form)

**Analog:** `src/components/SongSlideOver.vue` (full file referenced; key excerpts below)

**No tab bar needed** — `SongSlideOver.vue:100-138`'s in-drawer tab bar (`details`/`lyrics`/`files`, `border-b-2 -mb-px` active-class toggle) does not apply; a vamp has one flat form (per RESEARCH.md Pattern 2 "no tabs — single form"). Do NOT port `isCreateMode`-conditional tab visibility.

**Key input — do not reuse `MAJOR_KEYS` (14 entries) or the free-typed datalist pattern.** `SongSlideOver.vue:262-277`:
```html
<label class="block text-xs font-medium text-gray-400 mb-1">Key</label>
<input v-model="primaryArrangementKey" list="ss-key-options" ... />
<datalist id="ss-key-options">
  <option v-for="k in MAJOR_KEYS" :key="k" :value="k" />
</datalist>
```
The design wants a **closed 12-chip picker**, not free-typed. Add a new `VAMP_KEYS` constant to `src/constants/keys.ts` (alongside `MAJOR_KEYS`, same file, same const-array style at `keys.ts:7-9`):
```typescript
export const VAMP_KEYS = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
] as const
```
Render as clickable chips (`v-for="k in VAMP_KEYS"`, selected chip = accent styling), not an `<input list>`.

**Delete-vamp button** — mirror `SongSlideOver.vue:299-331`'s Delete-Song inline-confirm pattern for the "subtle destructive button at bottom" the design calls for.

**MP3 attach/play/remove row** — mirror `SongFilesTab.vue`'s meta-line/play/remove pattern (not `SongSlideOver.vue` itself, which delegates to `SongFilesTab.vue` for its files tab):
- `metaLine(a)` helper — reuse the "kind · size · date" string format (`SongFilesTab.vue:122,242`), per RESEARCH.md Pitfall 5 explicitly OMIT the "length"/duration field for this phase (not in R435/R436 text, only design notes — flag as follow-up, don't build new `<audio>` metadata plumbing).
- Inline play toggle with an `<audio>` element gated by `playingId === a.id` (`SongFilesTab.vue:248-253,284-291`), including the `audioErrored` fallback-to-download state (`SongFilesTab.vue:293-301`).
- Remove inline-confirm card, one open at a time via a `confirmingId` ref (`SongFilesTab.vue:306-337`, comment at line 394-397 explicitly says this reuses the Delete-Song pattern) — reuse this exact card shape for "remove MP3" (distinct from "Delete vamp" which removes the whole doc).
- Dashed drop-zone for the empty state — `SongFilesTab.vue`'s upload-input area (`accept=".pdf,audio/mpeg"` at line 36 — narrow to `accept="audio/mpeg,.mp3"` only for Vamps).

---

### `src/views/SongsView.vue` (MODIFY — add tab bar)

**Analog:** itself — extend the existing org-switch watch and add a sibling tab.

**Watch pattern to duplicate for vamps** (`SongsView.vue:353-361`):
```typescript
watch(
  () => authStore.orgId,
  (orgId) => {
    vampStore.unsubscribeAll()
    if (orgId) vampStore.subscribe(orgId)
  },
  { immediate: true },
)
```
Add this alongside (not replacing) the existing `songStore` watch at the same location.

**Tab bar markup** — reuse `SongSlideOver.vue:100-138`'s Tailwind classes (`border-b-2 -mb-px`, active/inactive toggle) for a **page-level** `Songs | Vamps` tab bar (structurally simpler — no `isCreateMode` gating). Page title stays "Songs"; each tab shows a count badge (`vampStore.vamps.length` for Vamps).

---

### `storage.rules` (MODIFY)

**Analog:** the `song-files/` block, `storage.rules:99-120` (verbatim source read this session):
```
match /orgs/{orgId}/song-files/{allPaths=**} {
  allow read: if isOrgMember(orgId);

  allow create: if isOrgEditor(orgId)
                   && request.resource.size < 52428800
                   && request.resource.contentType in ['application/pdf', 'audio/mpeg'];

  allow update: if false;

  allow delete: if isOrgEditor(orgId);
}
```

**New block to add** (tightened to `audio/mpeg` only, per RESEARCH.md Code Examples):
```
match /orgs/{orgId}/vamp-files/{allPaths=**} {
  allow read: if isOrgMember(orgId);

  allow create: if isOrgEditor(orgId)
                   && request.resource.size < 52428800
                   && request.resource.contentType == 'audio/mpeg';

  allow update: if false;   // immutable — every upload (incl. replace) uses a fresh path segment

  allow delete: if isOrgEditor(orgId);
}
```

**MANDATORY catch-all exclusion update** — `storage.rules:122-138`'s catch-all currently excludes only `song-files/`:
```
allow read: if isOrgMember(orgId)
               && !resource.name.matches('^orgs/[^/]+/song-files/.*');
...
allow write: if isOrgMember(orgId)
                && request.resource.size < 26214400
                && !request.resource.name.matches('^orgs/[^/]+/song-files/.*');
```
Change both regexes to `'^orgs/[^/]+/(song-files|vamp-files)/.*'`. Without this, the generic <25MB member-write catch-all independently permits a non-audio or oversized write to `vamp-files/` regardless of the dedicated block's deny (same reasoning documented in the existing comment at `storage.rules:122-128`).

**Membership is claim-only, not `firestore.exists()`** (verified this session, `storage.rules:13-79` uses `isOrgMemberByClaim`/`isOrgEditorByClaim`) — do NOT annotate any vamp-files allow-case as "expected local failure"; every case should pass in the emulator (RESEARCH.md Pitfall 3).

---

### `firestore.rules` (NO CHANGE — verify only)

**Analog:** the generic catch-all, `firestore.rules:~508-515`:
```
match /{collection}/{docId} {
  allow read: if isOrgEditor(orgId);
  allow write: if isOrgEditor(orgId) && collection != 'services' && collection != 'slideGroups'
                  && collection != 'pptxRenders' && collection != 'rehearseAccess';
}
```
`organizations/{orgId}/vamps/{vampId}` already falls under this catch-all — `vamps` has no subcollection (unlike `songs/{id}/lyrics/{id}`, the reason `songs` needs its own explicit block, `firestore.rules:481-492`). Write a rules **test** proving this (mirror `src/rules.test.ts:82-88`'s "songs" nested-collection case, retargeted at `vamps`) — do not add a rules **change**.

---

## Shared Patterns

### Org-scoped subscribe/unsubscribe + church-switch teardown
**Source:** `src/stores/songs.ts:242-289`, `src/stores/orgScopedStores.ts:23-39`, `src/views/SongsView.vue:353-361`
**Apply to:** `src/stores/vamps.ts`, `src/stores/orgScopedStores.ts`, `src/views/SongsView.vue`
Every org-scoped store subscribes via `onSnapshot` keyed by `orgId`, tears down via `unsubscribeAll()`, and MUST be registered in `resetOrgScopedStores()` for the sidebar-switcher teardown path (ADR-0066) in addition to the view's own local `watch(authStore.orgId, {immediate:true})`.

### Editor-gated writes
**Source:** `storage.rules:13-79` (`isOrgEditorByClaim`/`isOrgMemberByClaim`), `firestore.rules` catch-all
**Apply to:** `storage.rules` vamp-files block, `VampSlideOver.vue`/`VampTable.vue` UI-only `isEditor` gating (never trust client-side alone)
Storage rules are claim-only (no `firestore.exists()`) as of Deploy 2 (2026-08-12) — do not reintroduce a cross-service exists() check; a standing regression test (`storage.rules.test.ts` "claim-only membership (Deploy 2, R075 guard)") guards this.

### Resumable upload with per-file progress row
**Source:** `src/composables/useSongFileUpload.ts:91-226`
**Apply to:** `src/composables/useVampFileUpload.ts`
Reactive `UploadRow[]` addressed by stable `id`, `task.on('state_changed', progress, error, complete)`, `getDownloadURL()` then persist, auto-clear the row on success (no lingering 100% bar).

### Inline remove-confirm card (one open at a time)
**Source:** `src/components/SongFilesTab.vue:306-337,394-397`
**Apply to:** `VampSlideOver.vue`'s MP3 remove action and Delete-vamp button (mirrors `SongSlideOver.vue:299-331`)
A single `confirmingId` ref gates which row's confirm card is visible; Cancel/Confirm buttons with `data-testid`-style hooks.

## No Analog Found

None — every file in this phase has a direct, currently-shipped structural twin (per RESEARCH.md Summary: "every piece of this phase already has a shipped, tested twin somewhere in this codebase").

## Metadata

**Analog search scope:** `src/types/`, `src/stores/`, `src/utils/`, `src/composables/`, `src/components/`, `src/views/`, `src/constants/`, `storage.rules`, `firestore.rules`
**Files scanned/read this pass:** `song.ts`, `songs.ts` (subscribe/CRUD/delete sections), `songFiles.ts`, `useSongFileUpload.ts` (full), `SongSlideOver.vue` (grepped structure), `SongFilesTab.vue` (grepped meta/remove/play), `SongTable.vue` (role-match, not deep-read — flat table shape sufficiently covered by 140-DESIGN-NOTES.md), `keys.ts`, `orgScopedStores.ts`, `storage.rules` lines 90-140, `SongsView.vue` lines 345-364
**Pattern extraction date:** 2026-09-09
