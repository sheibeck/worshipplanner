<template>
  <div class="flex h-full min-w-0 flex-1 flex-col" data-testid="slide-grid">
    <template v-if="selectedSlot">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-800 px-6 py-3">
        <h2 class="text-sm font-medium text-gray-100" data-testid="slide-grid-title">{{ groupTitle }}</h2>
        <span
          class="inline-flex items-center rounded border border-indigo-800 bg-indigo-950/50 px-2 py-0.5 text-[11px] text-indigo-300"
          data-testid="slide-grid-position"
        >group {{ position }} of {{ totalPlanItems }} &middot; follows plan</span>
        <span
          v-if="cards.length > 0"
          class="text-[10.5px] text-gray-500"
          data-testid="slide-grid-reading-order"
        >Plays 1 &rarr; {{ cards.length }}, left to right then down</span>

        <button
          v-if="isEditor"
          type="button"
          class="ml-auto inline-flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700"
          data-testid="slide-grid-add-slide"
          @click="onAddSlide"
        >＋ Add slide</button>
        <button
          v-if="isEditor"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700"
          data-testid="slide-grid-import"
          @click="openImportModal"
        >⇪ Import into this group</button>
      </div>

      <!-- The grid's OWN import-modal instance (25-07 Task 3, D-15/D-16) —
           NOT the instance/handler in `ServiceEditorView.vue`, which creates
           a brand-new IMPORTED plan item. This instance's `confirmed`
           handler instead appends the deck's slides to the SELECTED group
           and never touches the plan/rail. -->
      <PptxImportModal
        ref="importModalRef"
        :open="showImportModal"
        :org-id="orgId"
        :section="importSection"
        @confirmed="onImportConfirmed"
        @cancel="showImportModal = false"
      />

      <!-- Group music bar (25-06, R032) — between the grid header and the
           card grid, per the UI-SPEC's layout reference. Emit-only control;
           this component intercepts both events and writes the selected
           group's bed via the slideGroups store's scoped write (the sole
           surviving attach/remove surface for group-bed audio; the Service
           Order tab's equivalent control was removed in Phase 27-04). -->
      <div class="px-6 pt-3">
        <SlideGroupMusicControl
          :audio-url="group?.bedAudioUrl"
          :slide-count="cards.length"
          :org-id="orgId"
          :is-editor="isEditor"
          @attach="onAttachGroupMusic"
          @remove="onRemoveGroupMusic"
        />
      </div>

      <div
        v-if="rejectionNotice"
        class="mx-6 mt-3 rounded-md border border-red-800 bg-red-900/20 px-3 py-2 text-[12px] text-red-300"
        data-testid="slide-grid-rejection-notice"
      >{{ rejectionNotice }}</div>

      <div
        v-if="mediaUploadError"
        class="mx-6 mt-3 text-[12px] text-red-400"
        data-testid="slide-grid-media-error"
      >{{ mediaUploadError }}</div>
      <div
        v-else-if="mediaUploadInProgress"
        class="mx-6 mt-3 text-[12px] text-indigo-400"
        data-testid="slide-grid-media-progress"
      >Uploading... {{ Math.round(mediaUploadProgress) }}%</div>
      <!-- UI-SPEC §5: minimal, transient reorder-failure text — same shape
           as `mediaUploadError` above. No toast, no badge, no aria-live;
           the persistent status indicator is Phase 32's (R040/R041). -->
      <div
        v-if="reorderError"
        class="mx-6 mt-3 text-[12px] text-red-400"
        data-testid="slide-grid-reorder-error"
      >{{ reorderError }}</div>

      <!-- Grid-wide dragover highlight (D-13) — applied to the WHOLE content
           area, not only the drop tile, so the target isn't a pixel hunt.
           Guarded against the constant child-element dragleave events that
           fire while moving across cards inside the container via a depth
           counter, and gated on the drag actually carrying files. -->
      <div
        class="flex-1 overflow-y-auto px-6 py-4 transition-colors"
        :class="isDragOver ? 'rounded-md border-2 border-indigo-500/50 bg-indigo-950/10' : 'border-2 border-transparent'"
        data-testid="slide-grid-drop-area"
        @dragenter="onGridDragEnter"
        @dragover="onGridDragOver"
        @dragleave="onGridDragLeave"
        @drop="onGridDrop"
      >
        <div
          v-if="cards.length > 0"
          :key="gridRenderNonce"
          ref="cardsContainerRef"
          class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4"
          data-testid="slide-grid-cards"
        >
          <SlideCard
            v-for="card in cards"
            :key="card.assembledSlide.slide.id"
            :assembled-slide="card.assembledSlide"
            :number="card.number"
            :selected="card.assembledSlide.slide.id === selectedSlideId"
            :reorderable="canReorder"
            @select="emit('select', $event)"
          />
          <!-- Always the LAST grid item (D-13) — deliberately NOT given the
               `.slide-card` class SortableJS is scoped to. -->
          <SlideDropTarget v-if="isEditor" @drop="onFilesDropped" />
        </div>
        <template v-else>
          <div class="px-1 py-8" data-testid="slide-grid-empty-state">
            <p class="text-sm font-medium text-gray-300">No slides in this group yet</p>
            <p class="mt-1 text-xs text-gray-500">Add a slide, or drop a file below.</p>
          </div>
          <SlideDropTarget v-if="isEditor" @drop="onFilesDropped" />
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Presentational-plus-write-controls slide grid (Phase 25 Tasks 2/3). Renders
 * the SELECTED plan item's slides as cards, in play order, and the three-line
 * header the mockup and 25-CONTEXT.md § Specific Ideas describe verbatim.
 *
 * Every input still arrives as a prop from `SlidesTab.vue` and this component
 * still calls no `useSlideshowAssembly` composable directly — but per 25-05 it
 * DOES import the `slideGroups` Pinia store directly to issue the two writes
 * this plan adds (append-a-slide, drag-reorder), exactly as every other
 * slide-group mutation in the codebase does (never the `localService`
 * deep-watch autosave).
 *
 * Filters `assembledSlideshow` by the selected plan item's ARRAY index
 * (`slotArrayIndex`), never by `groupId` — `groupId` is only set on the
 * group-resolved emission path and is absent for the entire window before a
 * group's Firestore snapshot lands (25-RESEARCH.md Pitfall 2), even though
 * the fallback-path slides being shown are already real and correct.
 *
 * Ships no Grid/List toggle (D-09). The reconciliation confirm/review surface
 * (26-06) was removed entirely in Phase 30 (R048) — every group write is now
 * unconditional; only `replaceGroupSlides` (the concurrent-write transaction
 * merge) remains.
 *
 * 25-07 adds the drop tile (always the grid's last item, D-13), a whole-grid
 * dragover highlight, and the four accepted-kind persistence paths (PPTX and
 * image import append via the reused `PptxImportModal.vue`, video appends its
 * own slide, audio sets the group's bed) — see `dropRouting.ts` for the pure
 * classification/resolution the drop path routes every file through.
 */
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import Sortable from 'sortablejs'
import type { ServiceSlot, ServiceSection } from '@/types/service'
import { SERVICE_SECTIONS } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'
import { useSlideGroups } from '@/stores/slideGroups'
import { useImportedSlides } from '@/stores/importedSlides'
import { useMediaUpload } from '@/composables/useMediaUpload'
import { slotLabel } from '@/utils/slotTypes'
import SlideCard from './SlideCard.vue'
import SlideGroupMusicControl from './SlideGroupMusicControl.vue'
import SlideDropTarget from './SlideDropTarget.vue'
import PptxImportModal from '@/components/PptxImportModal.vue'
import { resolveDrop, UNSUPPORTED_FILE_MESSAGE } from './dropRouting'
import { slotDisplayTitle, type EnsureGroupMaterializedResult } from './slideDisplay'

const props = defineProps<{
  /** The currently-selected plan item, or null when no plan item is selected. */
  selectedSlot: ServiceSlot | null
  /** The selected slot's ARRAY index within the service's raw `slots` — what `AssembledSlide.slotIndex` matches. */
  slotArrayIndex: number
  /** The selected slot's one-based position among the plan items, in plan order. */
  position: number
  /** Total number of plan items, for the header's "group N of M" line. */
  totalPlanItems: number
  assembledSlideshow: AssembledSlide[]
  selectedSlideId: string | null
  /** The group document for the selected plan item, if materialized. */
  group: SlideGroup | null
  /** Gates every write control this component renders (add-slide button, drag grip/Sortable instance, group-music add/remove). */
  isEditor: boolean
  /** Org id — needed to call the `slideGroups` store's write actions directly. */
  orgId: string
  /** Service id — required by `setGroupBedMedia`'s skeleton-create payload when the group has not materialized yet. */
  serviceId: string
  /** On-demand group materializer (25-05 Task 1) — resolved before every append so a plan item with no group yet can still receive a slide (R032). */
  ensureGroupMaterialized: (slotId: string) => Promise<EnsureGroupMaterializedResult | undefined>
}>()

const emit = defineEmits<{
  select: [slideId: string]
}>()

const slideGroupsStore = useSlideGroups()
const importedSlidesStore = useImportedSlides()

// One shared upload composable for both drop-triggered media paths (video
// append, audio bed) — a single drop is handled sequentially (videos then
// audio, never concurrently), so a single instance's reactive
// progress/error/isUploading is unambiguous at any moment. Reused verbatim,
// per the UI-SPEC's "do not author new copy" instruction.
const { progress: mediaUploadProgress, error: mediaUploadError, isUploading: mediaUploadInProgress, uploadMedia, reset: resetMediaUpload } = useMediaUpload()

/**
 * The group title line, collapsed to just the kind label (e.g. "Prayer")
 * when the plan item has no title of its own beyond its kind, or
 * "{Kind} — {title}" (e.g. "Song — This Is Our God") otherwise.
 */
const groupTitle = computed(() => {
  if (!props.selectedSlot) return ''
  const kindLabel = slotLabel(props.selectedSlot)
  const display = slotDisplayTitle(props.selectedSlot)
  return display === kindLabel ? kindLabel : `${kindLabel} — ${display}`
})

interface CardEntry {
  assembledSlide: AssembledSlide
  number: number
}

/**
 * The selected group's slides, in play order, numbered from one WITHIN this
 * group — independent of the slide's position in the whole service.
 */
const cards = computed<CardEntry[]>(() => {
  return props.assembledSlideshow
    .filter((assembled) => assembled.slotIndex === props.slotArrayIndex)
    .map((assembledSlide, i) => ({ assembledSlide, number: i + 1 }))
})

// --- 25-06 Task 2: group music bar attach/remove — the bed write path ---
//
// No on-demand materialization step is needed here, unlike every
// slide-appending path above: `setGroupBedMedia` already creates a skeleton
// group document when none exists, and it does so with a merging write
// (`{ merge: true }`) specifically so a concurrently-landing
// `ensureGroupMaterialized`/`materializeGroupIfMissing` call cannot be
// clobbered (WR-01). Adding a redundant materialization call here would only
// reintroduce that race, not prevent it.
async function onAttachGroupMusic(url: string): Promise<void> {
  if (!props.selectedSlot) return
  try {
    await slideGroupsStore.setGroupBedMedia(props.orgId, props.selectedSlot.id, {
      serviceId: props.serviceId,
      bedAudioUrl: url,
    })
  } catch (err) {
    console.error('Failed to attach group music:', err)
  }
}

// The explicit `clearAudio` flag is used rather than an undefined url —
// `stripUndefined()` would otherwise erase that intent before it reached
// Firestore, and `deleteField()` is the only way to actually remove the
// field (mirrors `ServiceEditorView.vue`'s existing `onSlotBedAudioChange`).
async function onRemoveGroupMusic(): Promise<void> {
  if (!props.selectedSlot) return
  try {
    await slideGroupsStore.setGroupBedMedia(props.orgId, props.selectedSlot.id, {
      serviceId: props.serviceId,
      clearAudio: true,
    })
  } catch (err) {
    console.error('Failed to remove group music:', err)
  }
}

// --- R050: the one append contract every write path below routes through ---
//
// Sorts a copy of `entries` by `order`, concatenates `additions` (in the
// order given), then renumbers every element to its array index — so array
// order and `order` are the same statement afterward. This is the exact
// normalization the reorder handler's `onEnd` already performs; this helper
// makes it the component's one contract instead of a behaviour only the
// reorder path had. Closes the divergence where `entries`' array order and
// `order`-field values disagree (e.g. after a prior reorder or
// reconciliation) — the mechanism behind "a new slide lands second-to-last"
// for a group with no copyright entries (see 29-04-SUMMARY.md for the
// investigation of the second, unrelated candidate mechanism).
function appendToGroup(entries: GroupSlideEntry[], additions: GroupSlideEntry[]): GroupSlideEntry[] {
  const sorted = [...entries].sort((a, b) => a.order - b.order)
  return [...sorted, ...additions].map((entry, i) => ({ ...entry, order: i }))
}

// --- Task 2: ＋ Add slide, appended at the true end of the selected group (D-16) ---
//
// Always resolves the group through `ensureGroupMaterialized` first — even
// when `props.group` already reflects a stored document — rather than
// reading `props.group.slides` directly. That prop lags a Firestore
// snapshot round trip behind a just-issued write, so reading it here instead
// of the freshly-returned entries would risk appending to (and persisting) a
// stale list on rapid repeated clicks.
async function onAddSlide(): Promise<void> {
  if (!props.selectedSlot) return
  const slotId = props.selectedSlot.id
  try {
    const resolved = await props.ensureGroupMaterialized(slotId)
    if (!resolved) return
    const { entries, sourceSignature } = resolved
    const newEntry: GroupSlideEntry = {
      id: crypto.randomUUID(),
      order: 0, // overwritten by appendToGroup's renumber below
      // A `text` ref with no authored content resolves from the owning slot
      // (nothing at all on a SONG/SCRIPTURE/IMPORTED plan item) — 25-01's
      // widened `text` SourceRef exists so a hand-added blank slide can carry
      // its own words instead. Body stays empty (Phase 26's drawer is where
      // it's actually written); the short default title is what keeps the
      // new card from looking blank in the grid.
      sourceRef: { kind: 'text', title: 'New slide', body: '' },
    }
    // CR-02: `entries` (unsorted, as returned) is the snapshot this append
    // was computed FROM — passed through as `baseSlides` so a concurrent
    // write (a double-click's other call, or a drag-reorder landing first)
    // is detected and merged rather than silently overwritten. See
    // `replaceGroupSlides`'s doc comment. Re-sorting THIS argument would
    // defeat the merge — only the payload passed as `slides` goes through
    // `appendToGroup`.
    const nextSlides = appendToGroup(entries, [newEntry])
    await slideGroupsStore.replaceGroupSlides(props.orgId, slotId, nextSlides, sourceSignature, entries)
  } catch (err) {
    console.error('Failed to add slide:', err)
  }
}

// --- 25-07: drop target + import action — four persistence paths (R032) ---
//
// The grid's OWN modal instance (mounted above), never `ServiceEditorView`'s.
// Its `section` prop is satisfied by the selected plan item's own section,
// falling back to the first `SERVICE_SECTIONS` entry — the section only sets
// the created deck's own `section` field and has NO bearing on which group
// the entries land in (Pattern 4).
const showImportModal = ref(false)
const importModalRef = ref<InstanceType<typeof PptxImportModal> | null>(null)
const importSection = computed<ServiceSection>(
  () => props.selectedSlot?.section ?? SERVICE_SECTIONS[0] ?? 'pre-service',
)

function openImportModal(): void {
  showImportModal.value = true
}

// PPTX/image drop — opens the modal (which resets to idle on open) then
// hands it the already-dropped file(s) via the 25-07 Task 1 entry point.
// Awaiting `nextTick()` between the two ensures the modal's own
// reset-on-open watcher has already run before the entry point sets its
// upload-in-progress state, so the reset can never clobber an import that
// just started.
async function importDeckFile(file: File): Promise<void> {
  showImportModal.value = true
  await nextTick()
  importModalRef.value?.importPptxFile(file)
}

async function importImageFilesDropped(files: File[]): Promise<void> {
  showImportModal.value = true
  await nextTick()
  importModalRef.value?.importImageFiles(files)
}

// Confirming an import appends one group entry per inner slide in the
// created deck, in deck order, at the end of the selected group — never a
// new plan item, never the slot factory/reindexer (Pattern 4, D-16).
async function onImportConfirmed(payload: { importId: string; section: ServiceSection }): Promise<void> {
  showImportModal.value = false
  if (!props.selectedSlot) return
  const slotId = props.selectedSlot.id
  try {
    const deck = await importedSlidesStore.getDeck(props.orgId, payload.importId)
    if (!deck) return
    const resolved = await props.ensureGroupMaterialized(slotId)
    if (!resolved) return
    const { entries, sourceSignature } = resolved
    const newEntries: GroupSlideEntry[] = deck.slides.map((innerSlide) => ({
      id: crypto.randomUUID(),
      order: 0, // overwritten by appendToGroup's renumber below
      sourceRef: { kind: 'imported', importId: payload.importId, innerSlideId: innerSlide.id },
    }))
    // CR-02: see `onAddSlide` — `entries` (unsorted) is this append's base snapshot.
    const nextSlides = appendToGroup(entries, newEntries)
    await slideGroupsStore.replaceGroupSlides(props.orgId, slotId, nextSlides, sourceSignature, entries)
  } catch (err) {
    console.error('Failed to append imported deck to group:', err)
  }
}

// Video drop (D-17's payoff) — appends one entry PER video, in drop order,
// carrying the video's own uploaded source and file name. NOT the group bed
// — 25-RESEARCH.md's stale recommendation must not be followed here. A
// failed upload appends nothing and leaves the group untouched: entries are
// only persisted once, in a single `replaceGroupSlides` call after every
// upload in this drop has resolved.
async function appendVideoEntries(files: File[]): Promise<void> {
  if (!props.selectedSlot || files.length === 0) return
  const slotId = props.selectedSlot.id
  try {
    const resolved = await props.ensureGroupMaterialized(slotId)
    if (!resolved) return
    // CR-02: `baseEntries` is the snapshot this whole drop's appends were
    // computed FROM (captured once, before the loop below builds up its own
    // list of new entries) — passed through to `replaceGroupSlides` as
    // `baseSlides` so a concurrent write is detected and merged rather than
    // silently overwritten.
    const baseEntries = resolved.entries
    const sourceSignature = resolved.sourceSignature
    resetMediaUpload()
    const newEntries: GroupSlideEntry[] = []
    for (const file of files) {
      const url = await uploadMedia(file, props.orgId)
      newEntries.push({
        id: crypto.randomUUID(),
        order: 0, // overwritten by appendToGroup's renumber below
        sourceRef: { kind: 'video', videoSrc: url, originalFileName: file.name },
      })
    }
    const nextSlides = appendToGroup(baseEntries, newEntries)
    await slideGroupsStore.replaceGroupSlides(props.orgId, slotId, nextSlides, sourceSignature, baseEntries)
  } catch (err) {
    console.error('Failed to append dropped video:', err)
  }
}

// Audio drop — sets the selected group's music bed (D-14/D-18) and appends
// NOTHING. Reuses 25-06's bed write path directly; no materialization step
// is needed here for the same reason `onAttachGroupMusic` needs none —
// `setGroupBedMedia`'s own merging skeleton-create already covers a plan
// item with no group document yet.
async function attachDroppedAudio(file: File): Promise<void> {
  if (!props.selectedSlot) return
  try {
    resetMediaUpload()
    const url = await uploadMedia(file, props.orgId)
    await slideGroupsStore.setGroupBedMedia(props.orgId, props.selectedSlot.id, {
      serviceId: props.serviceId,
      bedAudioUrl: url,
    })
  } catch (err) {
    console.error('Failed to attach dropped audio:', err)
  }
}

// Inline rejection notice — the phase's one backstop-status UI
// consideration. Cleared after a short interval; also cleared on unmount so
// no timer leaks past this component's lifetime (mirrors the autosave-timer
// gotcha already documented elsewhere in this codebase).
const rejectionNotice = ref<string | null>(null)
let rejectionTimeout: ReturnType<typeof setTimeout> | null = null

function showRejectionNotice(): void {
  rejectionNotice.value = UNSUPPORTED_FILE_MESSAGE
  if (rejectionTimeout) clearTimeout(rejectionTimeout)
  rejectionTimeout = setTimeout(() => {
    rejectionNotice.value = null
  }, 4000)
}

// The single dispatch point BOTH drop entry points (the tile's own `drop`
// emit and the whole-grid container's native `drop` event, below) route
// through — so they cannot diverge (25-07 Task 2 key link).
async function onFilesDropped(files: File[]): Promise<void> {
  const resolved = resolveDrop(files)

  if (resolved.skipped.length > 0) {
    showRejectionNotice()
  }

  if (resolved.deck) {
    await importDeckFile(resolved.deck)
  } else if (resolved.images.length > 0) {
    await importImageFilesDropped(resolved.images)
  }

  if (resolved.videos.length > 0) {
    await appendVideoEntries(resolved.videos)
  }

  if (resolved.audio) {
    await attachDroppedAudio(resolved.audio)
  }
}

// --- Whole-grid dragover highlight (D-13) ---
//
// A depth counter, not a boolean, guards against the constant child-element
// dragleave events that fire while the pointer moves across cards inside the
// container — a naive leave handler flickers the highlight off and on.
// Gated on the drag actually carrying files: `dataTransfer.types` (not
// `.files`, which is empty until drop fires) is the only file-presence
// signal available during dragenter/dragover.
const isDragOver = ref(false)
let dragDepth = 0

function dragCarriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function onGridDragEnter(event: DragEvent): void {
  if (!dragCarriesFiles(event)) return
  event.preventDefault()
  dragDepth += 1
  isDragOver.value = true
}

function onGridDragOver(event: DragEvent): void {
  if (!dragCarriesFiles(event)) return
  // Must preventDefault on dragover too — a drop event only fires on an
  // element whose dragover handler prevented default.
  event.preventDefault()
}

function onGridDragLeave(event: DragEvent): void {
  if (!dragCarriesFiles(event)) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) isDragOver.value = false
}

function onGridDrop(event: DragEvent): void {
  event.preventDefault()
  dragDepth = 0
  isDragOver.value = false
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.length > 0) void onFilesDropped(files)
}

// --- Task 3: drag-reorder within the selected group (D-11) ---
//
// Reuses the exact SortableJS pattern already established in
// `ServiceEditorView.vue`'s slot list: `handle`/`draggable` scoping and
// splice-and-reindex. Renders from state alone (Phase 29 removed the D-16
// single-step DOM revert) — `SlideCard` is keyed on a stable entry id, so
// the card list re-renders correctly from props once a write lands. The
// instance exists only while there is a stored group to write to AND the
// caller can write — a group with no stored document has no `slides` array
// to reorder, and would reject at the store.
const cardsContainerRef = ref<HTMLElement | null>(null)
let sortableInstance: Sortable | null = null

const canReorder = computed(() => props.isEditor && props.group !== null)

// T-29-13 / UI-SPEC §5: a rejected reorder write is no longer silent. The
// DOM revert this component used to lean on is gone (CONTEXT.md's explicit
// D-16 removal) — the card list re-renders from `props.assembledSlideshow`,
// so a rejection changes no prop and nothing re-renders on its own.
// `gridRenderNonce` forces a rebuild of the keyed card list from props on
// rejection, which is what puts the dragged card back where the data says
// it belongs.
const reorderError = ref<string | null>(null)
const gridRenderNonce = ref(0)

function destroySortable(): void {
  sortableInstance?.destroy()
  sortableInstance = null
}

watch(
  [cardsContainerRef, canReorder],
  ([el, allowed]) => {
    if (el && allowed && !sortableInstance) {
      sortableInstance = Sortable.create(el, {
        handle: '.drag-handle',
        draggable: '.slide-card',
        animation: 150,
        ghostClass: 'opacity-30',
        async onEnd(evt) {
          // Draggable-scoped indices only (T-29-11) — `oldIndex`/`newIndex`
          // count every element child of the container, including 25-07's
          // drop tile (a non-`.slide-card` sibling, always last today). Only
          // `oldDraggableIndex`/`newDraggableIndex` respect the `draggable:
          // '.slide-card'` selector. The tile happens to sit last, which
          // makes the un-prefixed pair latent rather than live here — fixed
          // anyway for symmetry with `ServiceEditorView.vue` and to guard the
          // one divergence case (dragging past the tile's own DOM position).
          if (evt.oldDraggableIndex == null || evt.newDraggableIndex == null) return
          if (evt.oldDraggableIndex === evt.newDraggableIndex) return

          // Read the current group and slot id from PROPS at call time —
          // never from values captured when the instance was created — since
          // the same container instance serves whichever group is selected.
          const currentGroup = props.group
          const currentSlot = props.selectedSlot
          if (!currentGroup || !currentSlot) return

          reorderError.value = null

          const sorted = [...currentGroup.slides].sort((a, b) => a.order - b.order)
          const moved = sorted.splice(evt.oldDraggableIndex, 1)[0]
          if (!moved) return
          sorted.splice(evt.newDraggableIndex, 0, moved)
          const reordered = sorted.map((entry, i) => ({ ...entry, order: i }))

          try {
            // CR-02: `currentGroup.slides` (read from props above, same as
            // `sorted`/`reordered` were derived from) is this write's base
            // snapshot — passed through so a concurrent append that lands
            // between this read and this write is detected and merged rather
            // than silently overwritten by the reorder's full-array replace.
            await slideGroupsStore.replaceGroupSlides(
              props.orgId,
              currentSlot.id,
              reordered,
              currentGroup.sourceSignature,
              currentGroup.slides,
            )
          } catch (err) {
            // T-29-13: surface the failure inline and force the card list to
            // rebuild from props (via `gridRenderNonce`) — the DOM revert this
            // used to lean on is gone, and `props.assembledSlideshow` changes
            // no prop on a rejected write, so nothing re-renders on its own.
            // `destroySortable()` releases the instance bound to the
            // container element the `:key` bump is about to discard; the
            // watcher below creates a fresh instance on the replacement
            // container once it lands, so a rejected reorder can never leave
            // real drag-and-drop silently unresponsive for the rest of the
            // session.
            reorderError.value = "Couldn't save this change — reverted. Try again."
            destroySortable()
            gridRenderNonce.value += 1
            console.error('[SlideGrid] reorder save failed:', err)
          }
        },
      })
    } else if ((!el || !allowed) && sortableInstance) {
      destroySortable()
    }
  },
  { flush: 'post' },
)

onUnmounted(() => {
  destroySortable()
  if (rejectionTimeout) clearTimeout(rejectionTimeout)
})
</script>
