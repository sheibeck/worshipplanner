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
      </div>

      <div
        v-if="reconciliationNotice"
        class="mx-6 mt-3 rounded-md border border-amber-800 bg-amber-900/20 px-3 py-2 text-[12px] text-amber-300"
        data-testid="slide-grid-reconciliation-notice"
      >{{ reconciliationNotice }}</div>

      <div class="flex-1 overflow-y-auto px-6 py-4">
        <div
          v-if="cards.length > 0"
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
        </div>
        <div v-else class="px-1 py-8" data-testid="slide-grid-empty-state">
          <p class="text-sm font-medium text-gray-300">No slides in this group yet</p>
          <p class="mt-1 text-xs text-gray-500">Add a slide, or drop a file below.</p>
        </div>
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
 * Ships no Grid/List toggle (D-09), no apply/reject/confirm affordance for a
 * pending reconciliation (Phase 26 owns that dialog, R033) and no drop tile
 * (25-06).
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import Sortable from 'sortablejs'
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'
import { useSlideGroups } from '@/stores/slideGroups'
import { slotLabel } from '@/utils/slotTypes'
import SlideCard from './SlideCard.vue'
import { slotDisplayTitle, type PendingReconciliation, type EnsureGroupMaterializedResult } from './slideDisplay'

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
  pendingReconciliations: PendingReconciliation[]
  /** Gates every write control this component renders (add-slide button, drag grip/Sortable instance). */
  isEditor: boolean
  /** Org id — needed to call the `slideGroups` store's write actions directly. */
  orgId: string
  /** On-demand group materializer (25-05 Task 1) — resolved before every append so a plan item with no group yet can still receive a slide (R032). */
  ensureGroupMaterialized: (slotId: string) => Promise<EnsureGroupMaterializedResult | undefined>
}>()

const emit = defineEmits<{
  select: [slideId: string]
}>()

const slideGroupsStore = useSlideGroups()

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

const pendingForSelected = computed<PendingReconciliation | null>(() => {
  if (!props.selectedSlot) return null
  return props.pendingReconciliations.find((p) => p.slotId === props.selectedSlot!.id) ?? null
})

/**
 * Passive, non-blocking notice text — no apply/reject/confirm affordance of
 * any kind (Phase 26 owns the confirm dialog, R033). Uses the reconciler's
 * own loss count when available, falling back to the number of proposed
 * entries.
 */
const reconciliationNotice = computed<string | null>(() => {
  const entry = pendingForSelected.value
  if (!entry) return null
  const count = entry.loss?.customizedEntries ?? entry.proposed.length
  const noun = count === 1 ? 'slide' : 'slides'
  return `${count} ${noun} may need review before this group updates.`
})

// --- Task 2: ＋ Add slide, appended at the end of the selected group (D-16) ---
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
    const nextOrder = entries.length > 0 ? Math.max(...entries.map((e) => e.order)) + 1 : 0
    const newEntry: GroupSlideEntry = {
      id: crypto.randomUUID(),
      order: nextOrder,
      // A `text` ref with no authored content resolves from the owning slot
      // (nothing at all on a SONG/SCRIPTURE/IMPORTED plan item) — 25-01's
      // widened `text` SourceRef exists so a hand-added blank slide can carry
      // its own words instead. Body stays empty (Phase 26's drawer is where
      // it's actually written); the short default title is what keeps the
      // new card from looking blank in the grid.
      sourceRef: { kind: 'text', title: 'New slide', body: '' },
    }
    await slideGroupsStore.replaceGroupSlides(props.orgId, slotId, [...entries, newEntry], sourceSignature)
  } catch (err) {
    console.error('Failed to add slide:', err)
  }
}

// --- Task 3: drag-reorder within the selected group (D-11) ---
//
// Reuses the exact SortableJS pattern already established in
// `ServiceEditorView.vue`'s slot list: `handle`/`draggable` scoping, the
// DOM-revert-before-Vue-re-render trick (prevents the snap-back flash), and
// splice-and-reindex. The instance exists only while there is a stored group
// to write to AND the caller can write — a group with no stored document has
// no `slides` array to reorder, and would reject at the store.
const cardsContainerRef = ref<HTMLElement | null>(null)
let sortableInstance: Sortable | null = null

const canReorder = computed(() => props.isEditor && props.group !== null)

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
        // Scope both drag eligibility AND the old/new index arithmetic to
        // `.slide-card` — this is what keeps 25-07's drop tile (a sibling in
        // the same grid container) from shifting every index by one.
        draggable: '.slide-card',
        animation: 150,
        ghostClass: 'opacity-30',
        async onEnd(evt) {
          if (evt.oldIndex == null || evt.newIndex == null) return
          if (evt.oldIndex === evt.newIndex) return
          // Revert SortableJS's DOM move so Vue's reactive render is the
          // single source of truth — prevents the snap-back flash. Not
          // incidental code; do not remove.
          const parent = evt.item.parentNode
          if (parent) {
            const ref = parent.children[evt.oldIndex]
            parent.insertBefore(evt.item, evt.oldIndex < evt.newIndex ? (ref?.nextSibling ?? null) : (ref ?? null))
          }

          // Read the current group and slot id from PROPS at call time —
          // never from values captured when the instance was created — since
          // the same container instance serves whichever group is selected.
          const currentGroup = props.group
          const currentSlot = props.selectedSlot
          if (!currentGroup || !currentSlot) return

          const sorted = [...currentGroup.slides].sort((a, b) => a.order - b.order)
          const moved = sorted.splice(evt.oldIndex, 1)[0]
          if (!moved) return
          sorted.splice(evt.newIndex, 0, moved)
          const reordered = sorted.map((entry, i) => ({ ...entry, order: i }))

          try {
            await slideGroupsStore.replaceGroupSlides(
              props.orgId,
              currentSlot.id,
              reordered,
              currentGroup.sourceSignature,
            )
          } catch (err) {
            console.error('Failed to reorder slides:', err)
          }
        },
      })
    } else if ((!el || !allowed) && sortableInstance) {
      destroySortable()
    }
  },
  { flush: 'post' },
)

onUnmounted(destroySortable)
</script>
