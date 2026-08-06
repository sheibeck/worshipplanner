# Phase 24: Slide Group Model and Migration - Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 9 (new/modified) + 3 test files
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/types/slideGroup.ts` (NEW) | model | CRUD | `src/types/importedDeck.ts` + `src/types/slide.ts` | role-match |
| `src/stores/slideGroups.ts` (NEW) | store | CRUD | `src/stores/importedSlides.ts` (stripUndefined) / `src/stores/scriptureSlides.ts` (shape) | exact |
| `src/utils/slideGroupMaterializer.ts` (NEW) | utility | transform | `src/utils/slideshowAssembler.ts` | exact (pure-function convention) |
| `src/composables/useSlideGroupAssembly.ts` (NEW/extends) | hook | request-response | `src/composables/useSlideshowAssembly.ts` | exact |
| `src/utils/slideshowAssembler.ts` (MODIFIED) | utility | transform | itself (refactor in place) | exact |
| `src/types/service.ts` (MODIFIED) | model | CRUD | itself (`ServiceSlot`/`createSlot()`) | exact |
| `src/utils/slotTypes.ts` (MODIFIED — id backfill) | utility | transform | itself (`createSlot`, `reindexSlots`) | exact |
| `src/views/ServiceEditorView.vue` (MODIFIED) | controller (view) | request-response | itself (autosave watcher, slot-delete path) | exact |
| `src/components/SlotMediaAttachment.vue` (MODIFIED/removed usage) | component | event-driven | itself (current write path) | exact |
| `src/stores/__tests__/slideGroups.test.ts` (NEW) | test | CRUD | `src/stores/__tests__/scriptureSlides.test.ts` | exact |
| `src/utils/__tests__/slideGroupMaterializer.test.ts` (NEW) | test | transform | `src/utils/__tests__/slideshowAssembler.test.ts` | exact |
| `src/composables/__tests__/useSlideGroupAssembly.test.ts` (NEW/extends) | test | request-response | existing `useSlideshowAssembly` test conventions (mock stores) | role-match |

## Pattern Assignments

### `src/types/slideGroup.ts` (NEW — model)

**Analogs:** `src/types/importedDeck.ts` (Timestamp import + doc shape), `src/types/slide.ts` (discriminated union + doc-comment style)

**Doc shape convention** (`src/types/importedDeck.ts` lines 1-19):
```typescript
import type { Timestamp } from 'firebase/firestore'
import type { ServiceSection } from './service'
import type { TextSlide, ImageSlide } from './slide'

export interface ImportedDeck {
  id: string
  sourceFileName: string
  section: ServiceSection
  slides: (TextSlide | ImageSlide)[]
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**Discriminated union convention** (`src/types/slide.ts` lines 8-9, 88):
```typescript
export type SlideContentKind = 'lyric' | 'scripture' | 'imported' | 'text' | 'image' | 'video'
// ...
export type Slide = LyricSlide | CopyrightSlide | ScriptureSlide | TextSlide | ImageSlide
```

**`DistributiveOmit` convention** (`src/utils/slideshowAssembler.ts` lines 28-30 — reuse this exact utility type rather than redefining it, or hoist it to a shared location if `slideGroup.ts` needs it too):
```typescript
type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never
```

**Recommended shape** (from RESEARCH.md Pattern 4 — already vetted against D-02/D-04/D-05/R030):
```typescript
export interface SlideGroup {
  id: string              // == the anchoring ServiceSlot.id
  serviceId: string
  slotId: string
  bedAudioUrl?: string
  bedVideoUrl?: string
  slides: GroupSlideEntry[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface GroupSlideEntry {
  id: string
  order: number
  sourceRef: SourceRef
  label?: string
  notes?: string
  audioUrl?: string
  audioScope?: 'slide' | 'group'
  audioLoop?: boolean
}

export type SourceRef =
  | { kind: 'lyric'; songId: string; sectionId: string }
  | { kind: 'scripture'; scriptureReadingId: string; innerSlideId: string }
  | { kind: 'imported'; importId: string; innerSlideId: string }
  | { kind: 'text' }
```

---

### `src/stores/slideGroups.ts` (NEW — store, CRUD)

**Analog:** `src/stores/importedSlides.ts` (full file, verbatim structural template) + `src/stores/scriptureSlides.ts` (subscribe/unsubscribe shape)

**Imports pattern** (`src/stores/importedSlides.ts` lines 1-17):
```typescript
import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { stripUndefined } from '@/utils/stripUndefined'
import type { ImportedDeck } from '@/types/importedDeck'
```
Add `deleteDoc` and `setDoc` to this import list for `deleteGroup`/`materializeGroupIfMissing`.

**Subscribe/unsubscribe lifecycle** (`src/stores/importedSlides.ts` lines 30-53) — copy verbatim, renaming `decks`→`groups`, `importedSlides`→`slideGroups`:
```typescript
function subscribeDecks(orgId: string) {
  if (unsubscribeFn) { unsubscribeFn() }
  isLoading.value = true
  const q = query(
    collection(db, 'organizations', orgId, 'importedSlides'),
    orderBy('updatedAt', 'desc'),
  )
  unsubscribeFn = onSnapshot(q, (snap) => {
    decks.value = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>
      return { id: d.id, ...data } as ImportedDeck
    })
    isLoading.value = false
  })
}

function unsubscribeDecks() {
  unsubscribeFn?.()
  unsubscribeFn = null
  decks.value = []
  isLoading.value = true
}
```

**`stripUndefined()` write pattern** (`src/stores/importedSlides.ts` lines 55-69) — apply to any `addDoc`/`setDoc` of a `SlideGroup` (which has several optional fields: `label`, `notes`, `audioUrl`, `bedAudioUrl`, `bedVideoUrl`):
```typescript
async function createDeck(orgId: string, data: Omit<ImportedDeck, 'id' | 'createdAt' | 'updatedAt'>) {
  const docRef = await addDoc(
    collection(db, 'organizations', orgId, 'importedSlides'),
    {
      ...stripUndefined(data),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  )
  return docRef.id
}
```

**Deterministic-doc-id materialize pattern** (Phase 17 precedent, `src/stores/services.ts` lines 226-256, `serviceShares/{slug}__service-{date}` — the exact soft-fail-on-secondary-write convention doesn't apply here since there is no secondary write, but the deterministic-id-plus-getDoc-guard shape does; RESEARCH.md's own restatement of it, verified against the real file, is the authoritative excerpt to copy):
```typescript
// Deterministic id = the slot's own stable id, mirroring
// serviceShares/{slug}__service-{date} (src/stores/services.ts::createShareToken,
// lines 244-250) — turns a two-tabs race into a harmless overwrite, never a duplicate doc.
async function materializeGroupIfMissing(orgId: string, slotId: string, initialData: SlideGroupInput) {
  const ref = doc(db, 'organizations', orgId, 'slideGroups', slotId)
  const existing = await getDoc(ref)
  if (existing.exists()) return existing.data() as SlideGroup
  await setDoc(ref, {
    ...stripUndefined(initialData),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return null // caller re-reads via the live onSnapshot subscription
}

async function deleteGroup(orgId: string, slotId: string) {
  await deleteDoc(doc(db, 'organizations', orgId, 'slideGroups', slotId))
}
```

**Scoped dot-path write precedent** (`src/stores/services.ts` lines 149-159, for LATER phases' per-slide edits — note here so the store's shape anticipates it, not required by Phase 24 itself):
```typescript
async function setRoleOverride(serviceId: string, roleId: string, personIds: string[]): Promise<void> {
  if (!orgId.value) return
  await updateDoc(doc(db, 'organizations', orgId.value, 'services', serviceId), {
    [`roleAssignmentOverrides.${roleId}`]: personIds,
    updatedAt: serverTimestamp(),
  })
}
```

---

### `src/utils/slideGroupMaterializer.ts` (NEW — pure utility, transform)

**Analog:** `src/utils/slideshowAssembler.ts` — pure-function style, no store/Firestore imports, exported named functions, `DistributiveOmit` convention.

**Purity contract to preserve** (`src/utils/slideshowAssembler.ts` lines 1-12 doc comment — copy this documentation convention onto the new file, adapted):
```typescript
/**
 * ... is a PURE function: it takes [inputs] and returns [output]. It performs
 * no Firestore reads and touches no Pinia store or Vue reactivity — callers
 * (the reactive composable) are responsible for loading data and re-invoking
 * this function when inputs change.
 */
```

**Id-generation discipline to violate on purpose (do NOT copy this part)** — `slideshowAssembler.ts` line 84 regenerates slide ids from `slotIndex`/`localSeq` (`id: \`${slotIndex}:${localSeq}\``). The materializer must instead assign `GroupSlideEntry.id = crypto.randomUUID()` ONCE at creation and never regenerate it (WR-02 contract — see Anti-Patterns in RESEARCH.md Pattern 5).

**Reconciliation function shape** — three small kind-specific functions (song/scripture/imported), NOT one generic diff, per RESEARCH.md Pattern 3. Song reconciliation diffs by `sectionId` (content-stable); scripture/imported reconciliation compares length + a cheap content-hash/text-concatenation proxy and returns a `needsConfirm: boolean` flag rather than auto-replacing, exactly the split documented in RESEARCH.md's Pattern 3 body (do not re-derive that split independently — apply it verbatim).

---

### `src/composables/useSlideGroupAssembly.ts` (NEW/extends `useSlideshowAssembly.ts`)

**Analog:** `src/composables/useSlideshowAssembly.ts` (full file, verbatim structural template)

**Subscription guard** (lines 82-94) — copy verbatim, retargeting `scriptureStore`/`importedStore` calls to the new `slideGroups` store's `subscribeGroups`/`unsubscribeGroups`:
```typescript
const subscribedOrgId = ref<string | null>(null)
const stopOrgWatch = watch(
  resolvedOrgId,
  (id) => {
    if (id && subscribedOrgId.value !== id) {
      scriptureStore.subscribeReadings(id)
      importedStore.subscribeDecks(id)
      subscribedOrgId.value = id
    }
  },
  { immediate: true },
)
```

**Returned shape** (lines 56-60, 162-201) — same public contract, additive:
```typescript
export interface UseSlideshowAssemblyReturn {
  assembledSlideshow: ComputedRef<AssembledSlide[]>
  assembledSections: ComputedRef<AssembledSection[]>
  isLoading: Ref<boolean>
}
```

**Cleanup convention** (lines 193-198):
```typescript
function cleanup() {
  stopOrgWatch()
  stopLyricsWatch()
}
onUnmounted(cleanup)
```

**Critical test requirement (Pitfall 2 / R028):** a reorder of `service.slots` must NEVER call any `slideGroups` store write — the composable only reads `groupsBySlotId.get(slot.id)` (keyed by the now-stable `slot.id`, never by array index/`slotIndex`). Assert this in the new composable test with a mock-call-count check.

---

### `src/utils/slideshowAssembler.ts` (MODIFIED — refactor, not rewrite)

**Full current implementation to refactor in place** (verbatim, lines 1-179 — do not rewrite from scratch):
```typescript
/**
 * Slideshow auto-assembly engine (R005).
 * ...
 */
import type { Service, ServiceSlot } from '@/types/service'
import type { AssembledSlide, Slide, LyricSlide, CopyrightSlide, TextSlide } from '@/types/slide'
import type { SongLyrics } from '@/types/songLyrics'
import type { ScriptureReading } from '@/types/scriptureReading'
import type { ImportedDeck } from '@/types/importedDeck'
import { slotLabel } from './slotTypes'

export interface AssemblyInputs {
  songLyricsById: Map<string, SongLyrics>
  performanceOrderById: Map<string, string[]>
  scriptureReadingsById: Map<string, ScriptureReading>
  importedDecksById: Map<string, ImportedDeck>
}

type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never
type SlideContent = DistributiveOmit<Slide, 'id' | 'position'>

function resolveSongOrder(songId: string, lyrics: SongLyrics, inputs: AssemblyInputs): string[] { /* ... */ }
function buildCopyrightSlideContent(lyrics: SongLyrics): Omit<CopyrightSlide, 'id' | 'position'> { /* ... */ }

export function assembleSlideshow(service: Service, inputs: AssemblyInputs): AssembledSlide[] {
  const indexed = service.slots.map((slot, index) => ({ slot, index }))
  const sorted = [...indexed].sort((a, b) => a.slot.position - b.slot.position)
  const assembled: AssembledSlide[] = []
  let globalPosition = 0
  const slotsWithMediaAttached = new Set<number>()

  const emit = (slot, slotIndex, content, sourceId, localSeq) => {
    const slide = { ...content, id: `${slotIndex}:${localSeq}`, position: globalPosition } as Slide
    if (!slotsWithMediaAttached.has(slotIndex)) {
      slotsWithMediaAttached.add(slotIndex)
      if (slot.audioUrl) slide.audioUrl = slot.audioUrl
      if (slot.videoUrl) slide.videoUrl = slot.videoUrl
    }
    assembled.push({ slide, slotIndex, slotKind: slot.kind, section: slot.section, sourceId })
    globalPosition += 1
  }

  for (const { slot, index } of sorted) {
    switch (slot.kind) {
      case 'SONG': { /* copyright + lyric emits via resolveSongOrder */ break }
      case 'SCRIPTURE': { /* reading.slides.forEach emit */ break }
      case 'IMPORTED': { /* deck.slides.forEach emit */ break }
      case 'PRAYER': case 'MESSAGE': { /* TextSlide emit */ break }
      case 'HYMN': { /* TextSlide emit */ break }
    }
  }
  return assembled
}
```

**Required refactor per RESEARCH.md Pattern 5:** add a new `groupsBySlotId: Map<string, SlideGroup>` field to `AssemblyInputs`; inside the loop, replace the current from-scratch derivation with a lookup of `groupsBySlotId.get(slot.id)`, walk that group's `slides: GroupSlideEntry[]` in `order`, and for each entry resolve live text via `sourceRef` (using the SAME `songLyricsById`/`scriptureReadingsById`/`importedDecksById` maps already present) plus effective audio via the D-04 precedence rule (per-slide `audioUrl` wins; bed resumes on the next slide with none). Emit `id: entry.id` (the stored `GroupSlideEntry.id`, NEVER `${slotIndex}:${localSeq}`) — this is the one non-negotiable change per WR-02 (Anti-Patterns, RESEARCH.md). Keep the function's purity (no Firestore/Pinia imports) and its `AssembledSlide[]` output shape unchanged so `PresentationViewer.vue` (Phase 23) keeps working with zero changes.

**Existing test file to extend, not replace:** `src/utils/__tests__/slideshowAssembler.test.ts` — see its `makeService`/`makeSongLyrics`/`makeScriptureSlide`/`makeScriptureReading` builder-function convention (lines 1-80+) and reuse those builders, adding a `makeSlideGroup`/`makeGroupSlideEntry` builder alongside them in the same style.

---

### `src/types/service.ts` (MODIFIED — additive `id` field)

**Full current `ServiceSlot` union and `MediaAttachableSlot`** (verbatim, lines 33-89):
```typescript
export interface MediaAttachableSlot {
  audioUrl?: string
  videoUrl?: string
}

export interface SongSlot extends MediaAttachableSlot {
  kind: 'SONG'
  position: number
  requiredVwType: VWType
  songId: string | null
  songTitle: string | null
  songKey: string | null
  section?: ServiceSection
}

export interface ScriptureSlot extends MediaAttachableSlot {
  kind: 'SCRIPTURE'
  position: number
  book: string | null
  chapter: number | null
  verseStart: number | null
  verseEnd: number | null
  scriptureReadingId?: string | null
  readingMode?: 'normal' | 'congregational'
  section?: ServiceSection
}

export interface NonAssignableSlot extends MediaAttachableSlot {
  kind: 'PRAYER' | 'MESSAGE'
  position: number
  linkUrl?: string
  linkLabel?: string
  section?: ServiceSection
}

export interface HymnSlot extends MediaAttachableSlot {
  kind: 'HYMN'
  position: number
  hymnName: string
  hymnNumber: string
  verses: string
  section?: ServiceSection
}

export interface ImportedSlot extends MediaAttachableSlot {
  kind: 'IMPORTED'
  position: number
  importId: string | null
  section?: ServiceSection
}

export type ServiceSlot = SongSlot | ScriptureSlot | NonAssignableSlot | HymnSlot | ImportedSlot
```

**Additive change:** add `id: string` to `MediaAttachableSlot` (or, if preferred, a separate `interface HasSlotId { id: string }` that each variant extends alongside `MediaAttachableSlot`) — D-01 requires EVERY variant to carry it, and `MediaAttachableSlot` is already the mixin every variant already extends, so adding it there is the least invasive change and matches the existing mixin-of-shared-fields convention exactly.

**`createSlot()` byte-shape discipline to preserve** (`src/utils/slotTypes.ts` lines 46-80, especially the comment at line 47-48):
```typescript
export function createSlot(kind: SlotKind, vwType?: VWType, section?: ServiceSection): ServiceSlot {
  // Omit the `section` key entirely when not provided — preserves the legacy
  // (section === undefined, key absent) shape for backward compatibility.
  const sectionFields = section ? { section } : {}
  switch (kind) {
    case 'SONG':
      return {
        kind: 'SONG',
        position: 0,
        requiredVwType: vwType ?? 2,
        songId: null,
        songTitle: null,
        songKey: null,
        ...sectionFields,
      } as SongSlot
    // ...
  }
}
```
`createSlot()` must be changed to always WRITE `id: crypto.randomUUID()` (never omit it — unlike `section`, every new slot gets a real id immediately, there is no "legacy absent id" state to preserve for brand-new slots; the omit-discipline applies only to `section`, not to `id`).

**`reindexSlots()` — already safe, no change needed** (`src/utils/slotTypes.ts` lines 86-88):
```typescript
export function reindexSlots(slots: ServiceSlot[]): ServiceSlot[] {
  return slots.map((slot, index) => ({ ...slot, position: index }))
}
```
The spread (`{...slot, position: index}`) already preserves `id` through every reorder/save — this is exactly why Pattern 2's backfill-on-load approach works with zero explicit write-back.

---

### `src/views/ServiceEditorView.vue` (MODIFIED — id backfill + delete cascade)

**`autosaveInitialized` guard** (lines 1587-1600):
```typescript
watch(
  localService,
  () => {
    if (!localService.value || !originalService.value) return
    if (!authStore.isEditor) return
    if (!autosaveInitialized) {
      autosaveInitialized = true
      return
    }
    if (!isDirty.value) return
    autosaveStatus.value = 'pending'
    // ... debounced save follows
  },
)
```

**Initial-load watcher — id backfill insertion point** (lines 1539-1572, especially 1545-1550):
```typescript
watch(
  () => serviceStore.services,
  (services) => {
    const found = services.find((s) => s.id === serviceId.value)
    if (!found) return

    if (!localService.value) {
      // Initial load: populate from store
      localService.value = JSON.parse(JSON.stringify(found))
      originalService.value = JSON.parse(JSON.stringify(found))
      autosaveInitialized = false
      previousService.value = null
      autosaveStatus.value = 'idle'
    } else if (autosaveStatus.value === 'idle' || autosaveStatus.value === 'saved') {
      const remoteJson = JSON.stringify(found)
      const localJson = JSON.stringify(localService.value)
      if (remoteJson !== localJson) {
        localService.value = JSON.parse(remoteJson)
        originalService.value = JSON.parse(remoteJson)
        autosaveInitialized = false
      }
    }
  },
  { immediate: true, deep: true },
)
```
**Required change (RESEARCH.md Pattern 2):** wrap `found` through a `backfillSlotIds(found)` call BEFORE both `JSON.parse(JSON.stringify(...))` assignments (both the initial-load branch AND the remote-merge branch), so `localService.value` and `originalService.value` always receive IDENTICAL backfilled ids — critical, or `isDirty` computes `true` forever.

**Slot-delete path — where the R029 confirm lands** (lines 1778-1823):
```typescript
function performRemoveSlot(index: number) {
  if (!localService.value) return
  localService.value.slots.splice(index, 1)
  localService.value.slots = reindexSlots(localService.value.slots)
}

function removeSlot(index: number) {
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot) return
  // D-15: confirm ALL element removals, including empty/blank rows
  pendingDeleteIndex.value = index
  pendingDeleteIsClear.value = false
  showSlotDeleteConfirm.value = true
}

function confirmSlotDelete() {
  if (pendingDeleteIndex.value == null) return
  if (pendingDeleteIsClear.value) {
    const slot = localService.value?.slots[pendingDeleteIndex.value]
    if (slot?.kind === 'SONG') {
      const updated: SongSlot = { ...slot as SongSlot, songId: null, songTitle: null, songKey: null }
      localService.value!.slots[pendingDeleteIndex.value] = updated
    }
  } else {
    performRemoveSlot(pendingDeleteIndex.value)
  }
  showSlotDeleteConfirm.value = false
  pendingDeleteIndex.value = null
  pendingDeleteIsClear.value = false
}
```

**Existing confirm-modal markup to reuse the shape of** (lines 230-254 — the D-14 slot-delete-confirm dialog; R029's warning copy needs a richer body than `deleteConfirmBody` currently computes, but the dialog shell/buttons/Teleport structure is the pattern to copy):
```html
<Teleport to="body">
  <div v-if="showSlotDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
      <h2 class="text-base font-semibold text-gray-100 mb-2">{{ deleteConfirmHeading }}</h2>
      <p class="text-sm text-gray-400 mb-6">{{ deleteConfirmBody }}</p>
      <div class="flex justify-end gap-3">
        <button @click="showSlotDeleteConfirm = false; pendingDeleteIndex = null; pendingDeleteIsClear = false">Cancel</button>
        <button @click="confirmSlotDelete" class="... bg-red-700 ...">Remove</button>
      </div>
    </div>
  </div>
</Teleport>
```
**Required change (R029/Pitfall 3):** `confirmSlotDelete`'s non-clear branch must, BEFORE the splice, resolve `slots[pendingDeleteIndex.value].id`, call the `slideGroups` store's `deleteGroup(orgId, slotId)`, and `deleteConfirmBody`'s computed must be extended to name slide count + attached media/notes (pulled from the live group, via the same `slideGroups` store subscription this view/composable already holds) — mirroring the CONTEXT.md copy example: *"Deleting 'This Is Our God' also deletes its 6 slides, including 1 attached audio file."*

---

### `src/components/SlotMediaAttachment.vue` (MODIFIED — retarget write path; Phase 27 fully removes)

**Current write path** (full file, lines 62-122 — verbatim):
```typescript
const props = defineProps<{
  audioUrl?: string
  videoUrl?: string
  orgId: string
}>()

const emit = defineEmits<{
  'update:audioUrl': [url: string | undefined]
  'update:videoUrl': [url: string | undefined]
}>()

const { progress, error, isUploading, uploadMedia, reset } = useMediaUpload()

async function onFileSelected(event: Event, kind: 'audio' | 'video'): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  reset()
  try {
    const url = await uploadMedia(file, props.orgId)
    if (kind === 'audio') emit('update:audioUrl', url)
    else emit('update:videoUrl', url)
  } catch { /* swallow — error already surfaced via composable's reactive error */ }
}

function removeAudio(): void { emit('update:audioUrl', undefined) }
function removeVideo(): void { emit('update:videoUrl', undefined) }
```

**Current parent wiring to change** (`src/views/ServiceEditorView.vue` lines 916-923, and handlers at 1373-1385):
```html
<SlotMediaAttachment
  v-if="authStore.isEditor && !isExportedLocked"
  :orgId="authStore.orgId!"
  :audioUrl="slot.audioUrl"
  :videoUrl="slot.videoUrl"
  @update:audioUrl="(url) => onSlotAudioUrlChange(index, url)"
  @update:videoUrl="(url) => onSlotVideoUrlChange(index, url)"
/>
```
```typescript
function onSlotAudioUrlChange(index: number, url: string | undefined) {
  const slot = localService.value!.slots[index]
  slot.audioUrl = url   // rides the parent's existing deep-watch autosave
}
function onSlotVideoUrlChange(index: number, url: string | undefined) {
  const slot = localService.value!.slots[index]
  slot.videoUrl = url
}
```
**Required change (D-05/Pitfall 1 — this phase's carve-out UI-removal task, per RESEARCH.md Open Question 2):** retarget `onSlotAudioUrlChange`/`onSlotVideoUrlChange` to call the `slideGroups` store's write action against `bedAudioUrl`/`bedVideoUrl` for that slot's group (via `slotId`), instead of mutating `slot.audioUrl`/`slot.videoUrl` on `localService`. The component itself (`SlotMediaAttachment.vue`) does not need internal changes — it stays a dumb emit-only control; only its two parent-side handler functions change what they write to. Do not delete the component's mounting in this phase (Phase 27 formally retires the Service Order tab's slide-editing surfaces) — only its write target changes.

---

## Shared Patterns

### Deterministic Firestore doc id (idempotent lazy materialization)
**Source:** `src/stores/services.ts::createShareToken`, lines 244-250 (`serviceShares/{slug}__service-{date}`)
**Apply to:** `slideGroups` store's materialize action — doc id = `slotId`, guarded by `getDoc` before `setDoc`.
```typescript
await setDoc(doc(db, 'serviceShares', `${slug}__service-${service.date}`), { /* ... */ })
```

### `stripUndefined()` before every write with optional fields
**Source:** `src/utils/stripUndefined.ts`, used in `src/stores/importedSlides.ts` lines 62-63, 79-81
**Apply to:** every `addDoc`/`setDoc`/`updateDoc` call in `src/stores/slideGroups.ts` — `SlideGroup`/`GroupSlideEntry` carry several optional fields (`label`, `notes`, `audioUrl`, `bedAudioUrl`, `bedVideoUrl`, `audioScope`, `audioLoop`).

### Scoped dot-path write to avoid whole-document clobber
**Source:** `src/stores/services.ts::setRoleOverride`/`clearRoleOverride`, lines 149-169
**Apply to:** any future (Phase 25/26) per-slide edit on a `SlideGroup` doc — not required for Phase 24's CRUD actions themselves, but the store's write helpers should be structured so later phases can add scoped dot-path writers without restructuring the store.

### `createSlot()` / `reindexSlots()` byte-shape discipline
**Source:** `src/utils/slotTypes.ts` lines 46-88
**Apply to:** the `id` field addition — `id` is always written (not conditionally omitted like `section`); `reindexSlots`'s spread already preserves `id` for free through every reorder.

### Autosave `autosaveInitialized` first-fire skip
**Source:** `src/views/ServiceEditorView.vue` lines 1539-1600
**Apply to:** `ServiceSlot.id` backfill — fold the backfill into the existing `JSON.parse(JSON.stringify(found))` assignment (both `localService` and `originalService`); do NOT add a new explicit write-back call.

## No Analog Found

None — every new/modified file in this phase has a direct or near-direct structural analog already in the codebase (a deliberate consequence of RESEARCH.md's "mirror existing conventions, do not invent new ones" recommendation).

## Metadata

**Analog search scope:** `src/types/`, `src/stores/`, `src/utils/`, `src/composables/`, `src/views/ServiceEditorView.vue`, `src/components/SlotMediaAttachment.vue`, `src/stores/__tests__/`, `src/utils/__tests__/`
**Files scanned:** `src/types/slide.ts`, `src/types/importedDeck.ts`, `src/types/service.ts`, `src/stores/scriptureSlides.ts`, `src/stores/importedSlides.ts`, `src/stores/services.ts` (lines 140-260), `src/utils/slideshowAssembler.ts`, `src/composables/useSlideshowAssembly.ts`, `src/utils/slotTypes.ts`, `src/views/ServiceEditorView.vue` (targeted ranges: 225-270, 895-935, 1130-1155, 1225-1240, 1530-1630, 1740-1823, 1806-1823, 2640-2670), `src/components/SlotMediaAttachment.vue`, `src/stores/__tests__/scriptureSlides.test.ts`, `src/utils/__tests__/slideshowAssembler.test.ts`
**Pattern extraction date:** 2026-07-25
