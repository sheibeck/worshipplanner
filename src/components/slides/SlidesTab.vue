<template>
  <div class="flex h-full min-h-0" data-testid="slides-tab">
    <SlidePlanRail
      :slots="slots"
      :assembled-slideshow="assembledSlideshow"
      :groups-by-slot-id="groupsBySlotId"
      :selected-slot-id="selectedSlotId"
      :groups-loading="groupsLoading"
      @select="onSelectSlot"
    />
    <!-- The grid for `selectedSlotId`, keyed on `selectedSlideId` for
         card-selection accent and eventually the seam Phase 26's Edit Slide
         drawer opens against (D-12). -->
    <div class="min-w-0 flex-1 overflow-y-auto" data-testid="slides-tab-content">
      <SlideGrid
        :selected-slot="selectedSlot"
        :slot-array-index="selectedSlotArrayIndex"
        :position="selectedSlotPosition"
        :total-plan-items="orderedSlots.length"
        :assembled-slideshow="assembledSlideshow"
        :selected-slide-id="selectedSlideId"
        :group="selectedGroup"
        :pending-reconciliations="pendingReconciliations"
        :is-editor="isEditor"
        :org-id="orgId"
        :ensure-group-materialized="ensureGroupMaterialized"
        @select="onSelectSlide"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Panel mounted inside `ServiceEditorView`'s new Slides tab (Phase 25 Task 2).
 * Every input arrives as a prop — this component reads no store and calls
 * no composable. `ServiceEditorView` is the SOLE owner of the page's
 * assembly composable; a second invocation anywhere under
 * `src/components/slides/` would run a second set of materialize/reconcile
 * watchers against the same Firestore documents (T-25-03-02).
 *
 * Selection contract (the D-12 seam Phase 26 opens its Edit Slide drawer
 * against):
 *  - `selectedSlotId` — the plan item (`ServiceSlot.id`) whose group 25-04's
 *    grid renders. Auto-selected to the first item in plan order whenever
 *    this tab is active and the current selection is unset or no longer
 *    present (D-05).
 *  - `selectedSlideId` — the individual slide (an assembled slide's own id,
 *    which equals the stored `GroupSlideEntry.id` once the group has
 *    materialized) the future drawer opens against. Always cleared when the
 *    selected slot changes (a slide selection belongs to its own group), and
 *    cleared again if it stops resolving against the selected slot's own
 *    assembled slides — 25-RESEARCH.md Pitfall 4 documents that a slide's id
 *    changes shape the moment its group materializes (a slot-derived
 *    fallback id gives way to the stored entry id). Fixing the id-minting
 *    scheme itself is Phase 23's WR-02 contract, not this component's job.
 */
import { ref, computed, watch } from 'vue'
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { SlideGroup } from '@/types/slideGroup'
import SlidePlanRail from './SlidePlanRail.vue'
import SlideGrid from './SlideGrid.vue'
import type { PendingReconciliation, EnsureGroupMaterializedResult } from './slideDisplay'

const props = defineProps<{
  slots: ServiceSlot[]
  serviceId: string
  orgId: string
  assembledSlideshow: AssembledSlide[]
  groupsBySlotId: Map<string, SlideGroup>
  pendingReconciliations: PendingReconciliation[]
  isEditor: boolean
  groupsLoading: boolean
  /** True while the Slides tab is the visible one in `ServiceEditorView`. */
  active: boolean
  /** On-demand group materializer (25-05 Task 1), threaded down to the grid unused by this component itself. */
  ensureGroupMaterialized: (slotId: string) => Promise<EnsureGroupMaterializedResult | undefined>
}>()

const selectedSlotId = ref<string | null>(null)
const selectedSlideId = ref<string | null>(null)

/** Plan (position) order — must match the rail's own ordering exactly. */
const orderedSlots = computed(() => [...props.slots].sort((a, b) => a.position - b.position))

// D-05: auto-select the first plan item in plan order whenever the tab is
// active and the current selection is unset or no longer present among the
// slots. `immediate: true` resolves both "tab opens with items already
// present" and "items arrive after the tab is already active" through the
// same path — and also recovers the selection when the currently-selected
// plan item is removed from the service while the tab stays active.
watch(
  [() => props.active, orderedSlots],
  ([active, ordered]) => {
    if (!active) return
    const stillValid =
      selectedSlotId.value !== null && ordered.some((s) => s.id === selectedSlotId.value)
    if (!stillValid) {
      selectedSlotId.value = ordered[0]?.id ?? null
    }
  },
  { immediate: true },
)

// A slide selection belongs to its slot's group — switching slots always
// clears it, never carries it forward.
watch(selectedSlotId, () => {
  selectedSlideId.value = null
})

// The array index of the selected slot within the RAW (unsorted) `slots`
// prop — this is what `AssembledSlide.slotIndex` matches (see
// SlidePlanRail's own count logic for why position and array index can
// diverge).
const selectedSlotArrayIndex = computed(() => props.slots.findIndex((s) => s.id === selectedSlotId.value))

const selectedGroupSlideIds = computed(() => {
  if (selectedSlotArrayIndex.value < 0) return new Set<string>()
  const ids = new Set<string>()
  for (const assembled of props.assembledSlideshow) {
    if (assembled.slotIndex === selectedSlotArrayIndex.value) ids.add(assembled.slide.id)
  }
  return ids
})

// Clear a dangling slide selection rather than chasing the id-minting
// scheme itself (Pitfall 4).
watch(selectedGroupSlideIds, (ids) => {
  if (selectedSlideId.value !== null && !ids.has(selectedSlideId.value)) {
    selectedSlideId.value = null
  }
})

function onSelectSlot(slotId: string): void {
  selectedSlotId.value = slotId
}

function onSelectSlide(slideId: string): void {
  selectedSlideId.value = slideId
}

/** The full selected plan item, or null when nothing is selected (e.g. an empty service). */
const selectedSlot = computed<ServiceSlot | null>(
  () => orderedSlots.value.find((s) => s.id === selectedSlotId.value) ?? null,
)

/**
 * The selected plan item's one-based position among the plan items, in
 * plan order — computed independently from `selectedSlotArrayIndex` (the
 * raw array index). They coincide for a well-formed service and diverge for
 * one whose stored `position` values have drifted from array order;
 * conflating the two would show the grid's header the wrong position while
 * still filtering the correct slides, or vice versa.
 */
const selectedSlotPosition = computed(() => {
  const index = orderedSlots.value.findIndex((s) => s.id === selectedSlotId.value)
  return index < 0 ? 0 : index + 1
})

const selectedGroup = computed<SlideGroup | null>(() => {
  if (selectedSlotId.value === null) return null
  return props.groupsBySlotId.get(selectedSlotId.value) ?? null
})

defineExpose({ selectedSlotId, selectedSlideId })
</script>
