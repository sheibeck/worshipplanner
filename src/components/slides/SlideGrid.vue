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
      </div>

      <div
        v-if="reconciliationNotice"
        class="mx-6 mt-3 rounded-md border border-amber-800 bg-amber-900/20 px-3 py-2 text-[12px] text-amber-300"
        data-testid="slide-grid-reconciliation-notice"
      >{{ reconciliationNotice }}</div>

      <div class="flex-1 overflow-y-auto px-6 py-4">
        <div
          v-if="cards.length > 0"
          class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4"
          data-testid="slide-grid-cards"
        >
          <SlideCard
            v-for="card in cards"
            :key="card.assembledSlide.slide.id"
            :assembled-slide="card.assembledSlide"
            :number="card.number"
            :selected="card.assembledSlide.slide.id === selectedSlideId"
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
 * Presentational, prop-driven slide grid (Phase 25 Task 2). Renders the
 * SELECTED plan item's slides as cards, in play order, and the three-line
 * header the mockup and 25-CONTEXT.md § Specific Ideas describe verbatim.
 *
 * Reads no store and calls no composable — every input arrives as a prop
 * from `SlidesTab.vue`. Filters `assembledSlideshow` by the selected plan
 * item's ARRAY index (`slotArrayIndex`), never by `groupId` — `groupId` is
 * only set on the group-resolved emission path and is absent for the entire
 * window before a group's Firestore snapshot lands (25-RESEARCH.md
 * Pitfall 2), even though the fallback-path slides being shown are already
 * real and correct.
 *
 * Ships no Grid/List toggle (D-09), no apply/reject/confirm affordance for a
 * pending reconciliation (Phase 26 owns that dialog, R033) and no drop tile
 * (25-06). The `group` and `isEditor` props are threaded through unused for
 * 25-05/25-06's group-header actions and group-music control.
 */
import { computed } from 'vue'
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { SlideGroup } from '@/types/slideGroup'
import { slotLabel } from '@/utils/slotTypes'
import SlideCard from './SlideCard.vue'
import { slotDisplayTitle, type PendingReconciliation } from './slideDisplay'

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
  /** The group document for the selected plan item, if materialized. Threaded through for 25-05/25-06. */
  group: SlideGroup | null
  pendingReconciliations: PendingReconciliation[]
  /** Threaded through for 25-05/25-06's write controls; this plan ships none. */
  isEditor: boolean
}>()

const emit = defineEmits<{
  select: [slideId: string]
}>()

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
</script>
