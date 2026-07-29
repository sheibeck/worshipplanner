<template>
  <div class="flex h-full min-h-0 flex-col" data-testid="slides-tab">
    <!-- Present entry point (D-05, Phase 27-05): the only trigger for
         Phase 23's PresentationViewer since SlideshowPreview was removed
         from the Service Order tab. Mirrors the mockup's page-header
         treatment (docs/design/slides-tab.dc.html) — a bordered, low-emphasis
         "▶ Present" button — but lives on this tab since presenting now
         belongs alongside the slide content it presents. Disabled/enabled
         state follows the same canPresent/hasAnySlides condition
         SlideshowPreview's own present control used (Phase 23-04): whether
         there is anything assembled to present at all. -->
    <div class="flex items-center justify-end gap-2 border-b border-gray-800 px-3 py-2 flex-none">
      <button
        type="button"
        data-testid="present-slideshow-cta"
        :disabled="!canPresent"
        :title="canPresent ? undefined : 'Add songs or scripture to build a slideshow to present.'"
        class="inline-flex items-center gap-1.5 rounded-md border border-indigo-400/60 px-3 py-1.5 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        @click="emit('present')"
      >
        <span aria-hidden="true">&#9654;</span> Present
      </button>
    </div>
    <div class="flex flex-1 min-h-0">
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
          :is-editor="isEditor"
          :org-id="orgId"
          :service-id="serviceId"
          :ensure-group-materialized="ensureGroupMaterialized"
          @select="onSelectSlide"
        />
      </div>
    </div>
    <!-- Phase 26-05: the Edit Slide drawer — a SIBLING of the grid, not
         nested inside it (26-RESEARCH.md's component diagram). Follows
         `selectedSlideId` (D-03): it never closes on a selection change,
         only on its own `close` emit. -->
    <EditSlideDrawer
      :open="drawerOpen"
      :entry="selectedEntry"
      :group="selectedGroup"
      :plan-item="selectedSlot"
      :assembled-slide="selectedAssembledSlide"
      :position="selectedSlidePosition"
      :total="selectedSlideTotal"
      :org-id="orgId"
      :service-id="serviceId"
      :is-editor="isEditor"
      @close="onDrawerClose"
      @edit-in-scripture="requestEditInScripture"
      @duplicate="selectSlideById"
    />
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
 *
 * "Edit in scripture" relay (Phase 26-03, D-15): `ServiceEditorView`'s tab
 * state and its per-plan-item scripture-editor expansion set are local state
 * it alone owns — nothing under this component may reach them directly
 * (26-RESEARCH.md Pitfall 5). `requestEditInScripture` emits
 * `navigate-to-scripture-editor` carrying the selected plan item's raw array
 * index, the one upward channel a page-level action can travel through.
 * Phase 26-07 wires the drawer's own "Edit in scripture" affordance to this
 * exact function via its `edit-in-scripture` emit — the drawer never reaches
 * page state directly, it only asks this component to make the same request
 * it already exposes.
 *
 * Edit Slide drawer seam (Phase 26-05, R033): `selectedEntry` resolves
 * `selectedSlideId` against the selected group's stored slides by a DIRECT id
 * lookup — for a materialized group, `AssembledSlide.slide.id` equals
 * `GroupSlideEntry.id` verbatim (26-RESEARCH.md Pattern 1), so no mapping
 * layer exists or is needed. A selection with no matching entry (the
 * pre-materialization fallback-id window, Pitfall 1) resolves to `null` and
 * the drawer renders nothing — not a loading state. `drawerOpen` is set true
 * on every slide selection (including re-selecting the same slide after a
 * close) and false only by the drawer's own `close` emit; it is NEVER cleared
 * by a selection change, so the drawer follows the selection instead of
 * closing and reopening (D-03).
 */
import { ref, computed, watch } from 'vue'
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'
import SlidePlanRail from './SlidePlanRail.vue'
import SlideGrid from './SlideGrid.vue'
import EditSlideDrawer from './EditSlideDrawer.vue'
import type { EnsureGroupMaterializedResult } from './slideDisplay'

const props = defineProps<{
  slots: ServiceSlot[]
  serviceId: string
  orgId: string
  assembledSlideshow: AssembledSlide[]
  groupsBySlotId: Map<string, SlideGroup>
  isEditor: boolean
  groupsLoading: boolean
  /** True while the Slides tab is the visible one in `ServiceEditorView`. */
  active: boolean
  /** On-demand group materializer (25-05 Task 1), threaded down to the grid unused by this component itself. */
  ensureGroupMaterialized: (slotId: string) => Promise<EnsureGroupMaterializedResult | undefined>
}>()

const emit = defineEmits<{
  /** D-15's "Edit in scripture" request, carrying the plan item's raw array index. */
  (e: 'navigate-to-scripture-editor', slotArrayIndex: number): void
  /** D-05 (Phase 27-05): request to start presenting. `ServiceEditorView` owns
   *  the `presenting` flag and the `PresentationViewer` mount; this component
   *  only asks for it, exactly as SlideshowPreview's own `present` emit did. */
  (e: 'present'): void
}>()

const selectedSlotId = ref<string | null>(null)
const selectedSlideId = ref<string | null>(null)

/**
 * Whether there is anything assembled to present — the same condition
 * SlideshowPreview's own `canPresent` (aliased to `hasAnySlides`, Phase
 * 23-04) used, restated directly against `assembledSlideshow` rather than
 * reintroducing the `AssembledSection[]` grouping that only existed to
 * render the removed preview list.
 */
const canPresent = computed(() => props.assembledSlideshow.length > 0)

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

// Whenever the slide selection itself disappears (slot change above, or the
// dangling-selection watch below), the drawer has nothing left to show —
// close it. This is the ONLY place besides the drawer's own `close` emit
// that sets `drawerOpen` false; a selection CHANGE to a still-valid slide
// never touches it (D-03).
watch(selectedSlideId, (id) => {
  if (id === null) drawerOpen.value = false
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

// True whenever a slide has been selected and the drawer hasn't been
// explicitly closed since. Set on every selection (including re-selecting
// the same slide after a close) and cleared only by the drawer's own `close`
// emit or by the selection itself disappearing (below) — never by a
// selection CHANGE, so the drawer follows the selection instead of closing
// and reopening (D-03).
const drawerOpen = ref(false)

function onSelectSlide(slideId: string): void {
  selectedSlideId.value = slideId
  drawerOpen.value = true
}

function onDrawerClose(): void {
  drawerOpen.value = false
}

/** Moves the selection onto an entry just created by id — bound directly to the drawer's `duplicate` emit (26-09 Task 2), which only fires once the copy's write has actually succeeded. */
function selectSlideById(slideId: string): void {
  selectedSlideId.value = slideId
  drawerOpen.value = true
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

/**
 * The selected slide resolved to its stored entry (Phase 26-05 seam) — a
 * DIRECT id lookup against `selectedGroup.slides`, with no mapping step. For
 * a materialized group `AssembledSlide.slide.id` equals `GroupSlideEntry.id`
 * verbatim (26-RESEARCH.md Pattern 1, verified against
 * `slideshowAssembler.ts`'s `emitFromGroup`). Resolves to `null` — treated by
 * the drawer as "nothing selected," never a loading state — for the
 * pre-materialization fallback-id window where a selected slide's synthetic
 * id has no `GroupSlideEntry` counterpart yet (Pitfall 1); do not "fix" that
 * window with a spinner.
 */
const selectedEntry = computed<GroupSlideEntry | null>(() => {
  if (!selectedGroup.value || selectedSlideId.value === null) return null
  return selectedGroup.value.slides.find((e) => e.id === selectedSlideId.value) ?? null
})

/**
 * The selected group's assembled slides, in the SAME order/filter the grid
 * itself applies (`SlideGrid.vue`'s own `cards` computed) — so the drawer's
 * position/total can never disagree with the grid's own card numbering.
 */
const selectedGroupAssembledSlides = computed<AssembledSlide[]>(() => {
  if (selectedSlotArrayIndex.value < 0) return []
  return props.assembledSlideshow.filter((assembled) => assembled.slotIndex === selectedSlotArrayIndex.value)
})

const selectedAssembledSlide = computed<AssembledSlide | null>(() => {
  if (selectedSlideId.value === null) return null
  return selectedGroupAssembledSlides.value.find((a) => a.slide.id === selectedSlideId.value) ?? null
})

const selectedSlidePosition = computed(() => {
  const index = selectedGroupAssembledSlides.value.findIndex((a) => a.slide.id === selectedSlideId.value)
  return index < 0 ? 0 : index + 1
})

const selectedSlideTotal = computed(() => selectedGroupAssembledSlides.value.length)

/**
 * Relays a request to reveal the selected plan item's scripture editor up to
 * `ServiceEditorView` (D-15). Emits nothing when no plan item is selected.
 * Uses the raw ARRAY index (`selectedSlotArrayIndex`), not the plan
 * position that sits next to it — the two can diverge (see
 * `selectedSlotPosition` above), and the page's expansion state and the
 * assembled slides are both keyed on the array index.
 */
function requestEditInScripture(): void {
  if (selectedSlotArrayIndex.value < 0) return
  emit('navigate-to-scripture-editor', selectedSlotArrayIndex.value)
}

defineExpose({ selectedSlotId, selectedSlideId, requestEditInScripture, selectSlideById })
</script>
