# Phase 33: Backgrounds & Slide Editing - Pattern Map

**Mapped:** 2026-08-02
**Files analyzed:** 17 (7 new, 10 modified)
**Analogs found:** 17 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/slides/SlideActionMenu.vue` | component (menu) | event-driven | `src/views/ServiceEditorView.vue:1084-1117` (visual shell only — no ARIA analog exists) | partial (visual shell only) |
| `src/components/slides/BackgroundControl.vue` | component | CRUD (emit-only, upload) | `src/components/slides/SlideGroupMusicControl.vue` | exact |
| `src/composables/useBackgroundUpload.ts` | utility/composable | file-I/O | `src/composables/useMediaUpload.ts` | exact (diverges on MIME + path) |
| `src/composables/__tests__/useBackgroundUpload.test.ts` | test | file-I/O | `src/composables/__tests__/useMediaUpload.test.ts` | exact |
| `src/components/slides/__tests__/SlideActionMenu.test.ts` | test | event-driven | `src/components/slides/__tests__/SlideGroupMusicControl.test.ts` (mounting/mocking idiom); no ARIA-menu test analog exists | role-match |
| `src/components/slides/__tests__/BackgroundControl.test.ts` | test | CRUD | `src/components/slides/__tests__/SlideGroupMusicControl.test.ts` | exact |
| `src/utils/slideshowAssembler.ts` (modified) | utility (resolver) | transform | itself — extend `resolveEntryMedia`/`ResolvedGroupMedia`, `emitFromGroup` call site | exact (self-analog) |
| `src/types/slideGroup.ts` (modified) | model | CRUD | itself | exact |
| `src/types/songLyrics.ts` (modified) | model | CRUD | itself | exact |
| `src/types/slide.ts` (modified) | model | CRUD | itself (`AssembledSlide`/`SlideBase`, mirroring `audioUrl`/`audioFromBed`) | exact |
| `src/stores/slideGroups.ts` (modified, delete ~:213-215) | store | CRUD | itself | exact |
| `src/components/slides/SlideCard.vue` (modified) | component | request-response (click/select) | itself — extend existing audio-chip pattern for background chip; root `<button>`→`<div role="button">` per UI-SPEC §1 | exact (self-analog) |
| `src/components/slides/SlideGrid.vue` (modified) | component | CRUD/event-driven | itself — extend `SlideGroupMusicControl` mount pattern (`:73-82`) for `BackgroundControl`, add `openMenuEntryId` state for `SlideActionMenu` | exact |
| `src/components/slides/SlidesTab.vue` (modified `:255-258`) | component (controller-ish) | request-response | itself — `onSelectSlide`/`selectSlideById` | exact |
| `src/components/slides/EditSlideDrawer.vue` (modified — `mode` prop split) | component | request-response | itself — Phase 26 scrimless-panel shell, `data-testid="drawer-*"` sections | exact |
| `src/components/slides/slideDisplay.ts` (modified — add `slideActionMenuItems`) | utility | transform | itself — existing pure per-kind helpers (`KIND_BADGE_CLASSES`, `bedAudioLabel`, `deleteSlideConfirmBody`) | exact |
| `src/components/SongLyricEditor.vue` (modified — mount song `BackgroundControl`) | component | CRUD | itself — header region `:1-27`, write path `updateCurrentLyrics` at `:362` | exact |
| Test files: `EditSlideDrawer.test.ts`, `SlidesTab.test.ts`, `slideDisplay.test.ts`, `slideshowAssembler.test.ts`, `SongLyricEditor.test.ts` | test | various | themselves (existing files being edited) | exact |

## Pattern Assignments

### `src/components/slides/SlideActionMenu.vue` (component, event-driven)

**Analog for visual shell:** `src/views/ServiceEditorView.vue:1084-1117` (the "Add Element" dropdown — the ONLY prior click-toggle/backdrop/panel pattern anywhere in `src/`, confirmed by a whole-repo grep for `role="menu"`/`aria-haspopup`/`role="listbox"` returning **zero matches**).

**Visual shell to copy verbatim** (`src/views/ServiceEditorView.vue:1087-1117`):
```html
<div v-if="canEditService" class="mt-2 relative">
  <button type="button" @click="showAddMenu = !showAddMenu"
    class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-300 bg-gray-900 hover:bg-gray-800 transition-colors border border-gray-700 border-dashed">
    <!-- icon -->
    Add Element
  </button>
  <div v-if="showAddMenu" class="fixed inset-0 z-10" @click="showAddMenu = false"></div>
  <div v-if="showAddMenu" class="absolute left-0 bottom-full mb-1 w-44 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden">
    <button type="button" @click="addSlot('SONG', 2)" class="px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors">Song</button>
    <!-- more items -->
  </div>
</div>
```
Copy: `relative` wrapper, `z-10` fixed-inset click-away backdrop, `z-20` absolute panel, `px-3 py-2 text-sm` item padding, `hover:bg-gray-700` item hover.

**★ No ARIA analog exists in this codebase.** The `role="menu"`/`role="menuitem"`/`aria-haspopup`/`aria-expanded` contract, the `@click.stop` on the trigger (borrowed instead from `SlideCard.vue:47`'s drag-grip idiom, the codebase's only existing "stop this click from bubbling to the card select handler" precedent), and the Escape-closes-returns-focus behavior are **original — write them fresh per 33-UI-SPEC.md §2**, which already carries the full verified markup (reproduce that markup, not a re-derivation).

**Full target markup:** see `33-UI-SPEC.md` § Phase-Specific Component Contracts §2 — authoritative, already source-cited.

---

### `src/components/slides/BackgroundControl.vue` (component, CRUD/emit-only)

**Analog:** `src/components/slides/SlideGroupMusicControl.vue` — verbatim structural sibling. Two call sites (group level via `SlideGrid.vue`, song level via `SongLyricEditor.vue`), per 33-UI-SPEC §6/§7.

**Full analog** (`src/components/slides/SlideGroupMusicControl.vue`, full file, 156 lines):
- **Emit-only contract, no Firestore write inside the component** (`:108-111`):
  ```typescript
  const emit = defineEmits<{
    attach: [url: string]
    remove: []
  }>()
  ```
- **Composable wiring** (`:92-93, 113`):
  ```typescript
  import { useMediaUpload } from '@/composables/useMediaUpload'
  const { progress, error, isUploading, uploadMedia, reset } = useMediaUpload()
  ```
  → swap for `useBackgroundUpload` in the new component.
- **Upload handler, "failed upload never clears an existing attachment" contract** (`:136-151`):
  ```typescript
  async function onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    reset()
    try {
      const url = await uploadMedia(file, props.orgId)
      emit('attach', url)
    } catch {
      // uploadMedia already set the composable's reactive `error` — surfaced
      // via media-upload-error above. Deliberately do NOT emit `attach` here.
    }
  }
  function onRemove(): void {
    emit('remove')
  }
  ```
- **Empty-state add affordance** (`:50-64`):
  ```html
  <template v-else-if="isEditor">
    <label class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800" data-testid="group-music-add">
      &#65291; Add music for this group
      <input type="file" accept="audio/*" class="hidden" data-testid="group-music-input" @change="onFileSelected" />
    </label>
  </template>
  ```
  → for `BackgroundControl`, `accept="image/*"`, caption text swapped per UI-SPEC's Copywriting Contract table (distinct per group/song call site).
- **Progress/error footer** (`:66-71`):
  ```html
  <p v-if="isUploading" data-testid="media-upload-progress" class="mt-1 text-indigo-400">Uploading... {{ Math.round(progress) }}%</p>
  <p v-if="error" data-testid="media-upload-error" class="mt-1 text-red-400">{{ error }}</p>
  ```
- **Wrapper shell** (`:2`): `class="rounded-md border border-gray-800 bg-gray-900 px-3 py-2"`.
- **isEditor gating** on add/remove controls throughout — copy directly.
- **NOT copied:** the `AudioPlayer`/preview toggle block (`:3-48`) — backgrounds render a static `<img>` thumbnail instead (see 33-UI-SPEC §5's State 3 thumbnail markup for the equivalent `<img>` treatment).

---

### `src/composables/useBackgroundUpload.ts` (composable, file-I/O)

**Analog:** `src/composables/useMediaUpload.ts` (full file, 119 lines) — copy structure verbatim, diverge on exactly two points per CONTEXT.md's discretion + UI-SPEC's stated caps.

**Full analog to copy** (imports, `:1-3`):
```typescript
import { ref, type Ref } from 'vue'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '@/firebase'
```

**Constant to redefine** (`:12`, was `MEDIA_MAX_BYTES = 52428800` / 50MB):
```typescript
export const BACKGROUND_MAX_BYTES = 10485760 // 10MB, per UI-SPEC's stated cap
```

**MIME validation to DIVERGE from** (`:62-73`, this is the exact point that must change):
```typescript
function validate(file: File): string | null {
  const isAudio = file.type.startsWith('audio/')
  const isVideo = file.type.startsWith('video/')
  if (!isAudio && !isVideo) {
    return `Unsupported file type "${file.type || 'unknown'}" — only audio or video files can be attached.`
  }
  if (file.size > MEDIA_MAX_BYTES) {
    const capMb = Math.floor(MEDIA_MAX_BYTES / (1024 * 1024))
    return `File is too large (max ${capMb}MB).`
  }
  return null
}
```
New version must check `file.type.startsWith('image/')` and use the copy from UI-SPEC's Copywriting Contract: `Unsupported file type "{type}" — only images can be set as a background.` and `File is too large (max 10MB).` (both mirror `useMediaUpload.ts`'s exact phrasing pattern, per UI-SPEC).

**Storage path construction to DIVERGE from** (`:84-85`, the second exact divergence point):
```typescript
const mediaId = crypto.randomUUID()
const path = `orgs/${orgId}/media/${mediaId}/${sanitizeFileName(file.name)}`
```
New version: `orgs/${orgId}/backgrounds/${backgroundId}/${sanitizeFileName(file.name)}` — verified structurally exempt from `cleanupExpiredMedia` (its `MEDIA_PATH_GUARD` regex `/^orgs\/[^/]+\/media\//` only matches `media/`) and needs no `storage.rules` change (falls into the generic `orgs/{orgId}/{allPaths=**}` block, 25MB cap, already > the 10MB client cap). See RESEARCH.md Research Question 1.

**Everything else copied verbatim, unchanged:** `sanitizeFileName` (`:37-39`, no max-length cap — UI-SPEC's E3 `long-text` item explicitly says do not add one), the `progress`/`error`/`isUploading` reactive shape, the `uploadBytesResumable` `state_changed` listener block (`:94-115`), the `reset()` function, the `UseMediaUploadReturn`-shaped interface (rename to `UseBackgroundUploadReturn`).

---

### `src/utils/slideshowAssembler.ts` (modified — extend `resolveEntryMedia`)

**This is a self-analog — extend the existing function, do not write a parallel resolver.**

**Current exact signature and body** (`:195-231`, verified):
```typescript
/** D-04 two-level audio precedence for one group entry. Video has no bed layer (D-18) — a video slide's own source resolves through `resolveEntryContent`, not here. */
interface ResolvedGroupMedia {
  audioUrl?: string
  audioLoop?: boolean
  audioFromBed: boolean
}

function resolveEntryMedia(group: SlideGroup, entry: GroupSlideEntry): ResolvedGroupMedia {
  if (entry.sourceRef.kind === 'video') {
    return { audioFromBed: false }
  }

  // Effective audio: the entry's OWN audio wins; otherwise fall back to the
  // group's bed. `audioFromBed` is true only in the fallback case.
  const audioFromBed = !entry.audioUrl && !!group.bedAudioUrl
  const resolvedAudioUrl = entry.audioUrl ?? group.bedAudioUrl

  const media: ResolvedGroupMedia = { audioFromBed }
  if (resolvedAudioUrl) media.audioUrl = resolvedAudioUrl
  if (!audioFromBed && entry.audioUrl && entry.audioLoop) media.audioLoop = true
  return media
}
```

**★ Pitfall 1 (RESEARCH.md):** do NOT compute background inside the `if (entry.sourceRef.kind === 'video') return { audioFromBed: false }` early-return branch — background must resolve normally for video (CONTEXT.md's deliberate divergence, UI-SPEC §9). Compute background before/independently of that branch.

**★ Pitfall 3 (RESEARCH.md):** the current signature has no `song` parameter, and `resolveEntryMedia` is called for every group kind including non-SONG kinds that have no associated song document at all. Must thread `song: SongLyrics | undefined`, using optional chaining (`song?.backgroundImageUrl`).

**Exact call site to change** (`:279`, inside `emitFromGroup`):
```typescript
// BEFORE:
const media = resolveEntryMedia(group, entry)
// AFTER:
const song = entry.sourceRef.kind === 'lyric' || entry.sourceRef.kind === 'copyright'
  ? inputs.songLyricsById.get(entry.sourceRef.songId)
  : undefined
const media = resolveEntryMedia(group, entry, song)
```

**New fields to add**, mirroring the existing `audioUrl`/`audioFromBed` shape but as a **tri-state single field**, not two booleans (UI-SPEC's explicit correction of CONTEXT.md's own sketch):
```typescript
interface ResolvedGroupMedia {
  audioUrl?: string
  audioLoop?: boolean
  audioFromBed: boolean
  backgroundImageUrl?: string
  backgroundSource?: 'slide' | 'group' | 'song'
}
```

---

### `src/types/slideGroup.ts` / `src/types/songLyrics.ts` / `src/types/slide.ts` (modified — add `backgroundImageUrl`)

**Self-analog** — `GroupSlideEntry`/`SlideGroup` already carry `audioUrl`/`bedAudioUrl` as the sibling optional-string field; add `backgroundImageUrl?: string` alongside each, and delete `audioScope` from `GroupSlideEntry` (`:70`) in the same edit. `SongLyrics` gains `backgroundImageUrl?: string` greenfield (no migration, per D-19). `AssembledSlide`/`SlideBase` gain `backgroundImageUrl?: string` + `backgroundSource?: 'slide' | 'group' | 'song'`, mirroring how `audioUrl`/`audioFromBed` are already exposed on the assembled shape.

---

### `src/stores/slideGroups.ts` (modified — delete `:213-215` branch)

**Exact deletion target** (comment + branch, `:206-217`):
```typescript
/**
 * ...
 * Open Question 1 (RESEARCH.md) resolved: a `GroupSlideEntry` whose
 * `audioScope` is `'group'` is persisted by the Phase 26 UI as a write to
 * the PARENT group's `bedAudioUrl` (via `setGroupBedMedia`) with the
 * entry's own `audioUrl` cleared. The stored `audioScope` value exists only
 * so the drawer can round-trip the toggle's visual state — the assembler
 * never interprets it.
 * ...
 */
```
RESEARCH.md Research Question 3 confirms this is the ONLY read path in the entire codebase (besides the drawer's own write routes and `resetLocalFields` initializer, all deleted together per R058). No other file references `audioScope` after this deletion — safe to remove outright, no migration.

---

### `src/components/slides/SlideCard.vue` (modified — root element + provenance chip)

**★ Structural fix required first** (UI-SPEC §1, load-bearing HTML-validity finding): current root (`:2-9`) is `<button type="button" ... @click="emit('select', ...)">` — must become `<div role="button" tabindex="0" @click="..." @keydown.enter="..." @keydown.space="...">` so `SlideActionMenu`'s trigger `<button>` can legally nest inside it (interactive-in-interactive is invalid HTML). All existing classes, `data-testid`, `data-selected` stay unchanged.

**Existing audio chip markup to extract and mirror for the background chip** (`:54-59`):
```html
<span
  v-if="hasAudio"
  class="ml-auto inline-flex items-center rounded bg-indigo-950/50 px-1.5 py-0.5 text-[11px] text-indigo-300"
  aria-label="Slide has audio attached"
  data-testid="slide-card-audio-chip"
>&#9834;</span>
```
The background chip (UI-SPEC §8) sits **beside, not instead of**, this chip — deliberately `ml-1.5` (not `ml-auto`, since the audio chip already claims the row's right edge) and one size step down (`text-[10px]` vs `text-[11px]`):
```html
<span
  v-if="backgroundSource"
  class="ml-1.5 inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium"
  :class="backgroundSource === 'slide' ? 'bg-indigo-950/50 text-indigo-300' : 'bg-gray-800 text-gray-400 border border-gray-700'"
  data-testid="slide-card-background-chip"
>{{ backgroundSource === 'slide' ? 'Background' : backgroundSource === 'group' ? 'From group' : 'From song' }}</span>
```
`hasAudio` is derived the same reactive way (`:107`, `computed(() => Boolean(props.assembledSlide.slide.audioUrl))`) — mirror this for `backgroundSource` (read directly off `props.assembledSlide.slide.backgroundSource`, never a locally-cached copy, per UI-SPEC E4's staleness backstop).

**Existing `@click.stop` idiom to borrow for the menu trigger** (`:47`, drag grip): `@click.stop` is the established "opt this element out of the card's own select handler" pattern in this exact file — reuse verbatim for `SlideActionMenu`'s trigger.

---

### `src/components/slides/SlidesTab.vue` (modified — `:255-258`)

**Exact current coupling to remove** (verified, `:255-258`):
```typescript
function onSelectSlide(slideId: string): void {
  selectedSlideId.value = slideId
  drawerOpen.value = true   // ← delete only this line
}
```
`selectSlideById` (`:265-268`, post-duplicate follow-selection) is a **separate** write site and must NOT be touched — it correctly keeps opening the drawer. Add a new `onMenuAction(entryId, key)` handler bound to `SlideActionMenu`'s `select` emit, opening the drawer with `mode` set only for `'edit-details'`/`'edit-lyrics'` keys.

---

### `src/components/slides/EditSlideDrawer.vue` (modified — `mode` prop split)

**Analog:** itself — the Phase 26 scrimless floating-panel shell already exists; do not rebuild it. Sections are already marked with distinct `data-testid="drawer-*"` values (`drawer-label-input`, `drawer-preview`, `drawer-slide-text-section`, `drawer-copyright-block`, `drawer-edit-in-song-link`) — per UI-SPEC §4's table, gate each existing block on the new `mode` prop rather than restructuring the component. New `drawer-background-section` (UI-SPEC §5, full markup already authored there) is inserted directly after Slide Audio, before Notes.

**Deletion targets for R058** (UI-SPEC §10, exact locations):
- `audio-scope-choice` div, `:229-245`
- `attachGroupAudio()`, `:689-699`
- the `scopeChoice === 'group'` branch in `onAudioFileSelected`, `:711-715`
- `resetLocalFields`'s `scopeChoice.value = entry?.audioScope ?? 'slide'` line, `:932`

New hint line to add in its place (shown only when nothing attached):
```html
<p class="mt-1 text-[11px] text-gray-500" data-testid="audio-scope-hint">For audio across the whole group, use the group's music control above the grid.</p>
```

---

### `src/components/slides/slideDisplay.ts` (modified — add `slideActionMenuItems`)

**Analog:** itself — the established pure-helper-per-kind convention (`KIND_BADGE_CLASSES`, `bedAudioLabel`, `deleteSlideConfirmBody`) already lives in this exact file. New function signature per UI-SPEC §3: `slideActionMenuItems(entry: GroupSlideEntry, planItemKind: SlotKind, canMutate: boolean, canMutateBackground: boolean): MenuItem[]`. Follow the same "pure function, testable without mounting" shape as the existing helpers.

---

### `src/components/SongLyricEditor.vue` (modified — mount song `BackgroundControl`)

**Existing header to NOT disturb** (`:1-27`, `data-testid="lyrics-header"`), including Phase 32's `SaveStatusIndicator` at `:11`:
```html
<div class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-800 px-4 py-3" data-testid="lyrics-header">
  <div class="flex items-center gap-2">
    <h3 class="text-sm font-semibold text-gray-100">Sections</h3>
    <span class="text-[11px] text-gray-500">this order is the slide order</span>
    <SaveStatusIndicator :surface-id="surfaceId ?? ''" />
  </div>
  <div v-if="currentLyrics" class="flex items-center gap-2">
    <!-- Paste lyrics / History buttons -->
  </div>
</div>
```
The new `BackgroundControl` mounts as its OWN sibling `<div>` between this header (closes `:27`) and the `v-if="songLyricsStore.isLoading"` branch (`:30`) — not nested inside either (UI-SPEC §7 markup, already authored). Write path: `songLyricsStore.updateCurrentLyrics(orgId, songId, id, ...)` at `:362` — reuse this existing action, only add a new field to the payload; no new store action needed.

---

## Shared Patterns

### Emit-only media component contract (no Firestore write inside the component)
**Source:** `src/components/slides/SlideGroupMusicControl.vue:76-90` (doc comment), `:108-155` (implementation)
**Apply to:** `BackgroundControl.vue` at both call sites (`SlideGrid.vue` for group, `SongLyricEditor.vue` for song) — the caller intercepts `attach`/`remove` and performs the scoped store write.

### Upload composable shape (validate → uploadBytesResumable → getDownloadURL, "failed upload never clears an existing attachment")
**Source:** `src/composables/useMediaUpload.ts` (full file)
**Apply to:** `useBackgroundUpload.ts` — copy verbatim except MIME check (`image/*`) and Storage path prefix (`backgrounds/` not `media/`) and size cap (10MB not 50MB).

### Pure per-kind helper convention
**Source:** `src/components/slides/slideDisplay.ts` (existing `KIND_BADGE_CLASSES`, `bedAudioLabel`, `deleteSlideConfirmBody`)
**Apply to:** the new `slideActionMenuItems` function — synchronous, no store/composable reads, testable without mounting.

### Chip-derived-from-already-resolved-props reactivity (no manual refresh)
**Source:** `src/components/slides/SlideCard.vue:107` (`hasAudio` computed off `props.assembledSlide.slide.audioUrl`)
**Apply to:** the new `backgroundSource`-driven chip — read directly off the already-reactive `AssembledSlide`, never a locally cached copy, so it recomputes for free whenever `assembledSlideshow` changes (per UI-SPEC E4's staleness backstop).

### Test file mocking/mounting conventions
**Source:** `src/components/slides/__tests__/SlideGroupMusicControl.test.ts` (composable mocking via `vi.mock('@/composables/useMediaUpload', ...)` with reactive `ref`s the mock returns, `makeFile`/`selectFile` helpers for file-input simulation) — reuse this exact shape for `BackgroundControl.test.ts` and `useBackgroundUpload.test.ts`, swapping the composable name.
**Also apply:** `setActivePinia(createPinia())` + `enableAutoUnmount(afterEach)` — confirmed already in use in `src/components/slides/__tests__/EditSlideDrawer.test.ts` and `SlideGrid.test.ts` (this IS an established precedent within the slides folder, not merely a Phase 32 claim) — use this pattern for any new/modified test in this folder that mounts a component reading a Pinia store (`SlideActionMenu.test.ts` if it reads `useSlideGroups`/`useSongLyrics` indirectly via props only does not need it; `BackgroundControl.test.ts` likely does not need it either since it's emit-only/prop-driven like `SlideGroupMusicControl.test.ts`, which does NOT install real Pinia).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `SlideActionMenu.vue`'s ARIA layer (`role="menu"`, `role="menuitem"`, `aria-haspopup`, `aria-expanded`, Escape-closes-returns-focus) | component (accessibility contract) | event-driven | Confirmed by whole-repo grep: zero matches for `role="menu"`/`aria-haspopup`/`role="listbox"` anywhere in `src/`. This is the codebase's first real ARIA menu. Use 33-UI-SPEC.md §2's full markup and § Accessibility Note as the authoritative source instead of a codebase analog. |

## Metadata

**Analog search scope:** `src/components/slides/`, `src/composables/`, `src/utils/slideshowAssembler.ts`, `src/stores/slideGroups.ts`, `src/types/`, `src/components/SongLyricEditor.vue`, `src/views/ServiceEditorView.vue`
**Files scanned:** ~20 (full or targeted reads)
**Pattern extraction date:** 2026-08-02
