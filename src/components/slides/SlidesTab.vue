<template>
  <div class="flex h-full min-h-0 flex-col" data-testid="slides-tab">
    <div class="flex flex-1 min-h-0 flex-col sm:flex-row">
      <SlidePlanRail
        :slots="slots"
        :assembled-slideshow="assembledSlideshow"
        :groups-by-slot-id="groupsBySlotId"
        :selected-slot-id="selectedSlotId"
        :groups-loading="groupsLoading"
        :service-locked="serviceLocked"
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
          :service-locked="serviceLocked"
          :org-id="orgId"
          :service-id="serviceId"
          :ensure-group-materialized="ensureGroupMaterialized"
          @select="onSelectSlide"
          @menu-action="onMenuAction"
          @edit-congregational="onEditCongregational"
          @edit-in-song="onEditInSongBadge"
          @loop-change="(index, loop) => emit('loop-change', index, loop)"
        />
      </div>
    </div>
    <!-- Phase 26-05: the Edit Slide drawer — a SIBLING of the grid, not
         nested inside it (26-RESEARCH.md's component diagram). Follows
         `selectedSlideId` (D-03): it never closes on a selection change,
         only on its own `close` emit. -->
    <EditSlideDrawer
      ref="editSlideDrawerRef"
      :open="drawerOpen"
      :pending-action="pendingDrawerAction"
      :entry="selectedEntry"
      :group="selectedGroup"
      :plan-item="selectedSlot"
      :assembled-slide="selectedAssembledSlide"
      :group-assembled-slides="selectedGroupAssembledSlides"
      :position="selectedSlidePosition"
      :total="selectedSlideTotal"
      :org-id="orgId"
      :service-id="serviceId"
      :is-editor="isEditor"
      :service-locked="serviceLocked"
      @close="onDrawerClose"
      @duplicate="selectSlideById"
      @pending-action-consumed="onPendingActionConsumed"
      @edit-scripture-text="onDrawerEditScriptureText"
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
  * See ADR-0118 (docs/adr/0118-present-d-05-selectedslideid-the-individual-slide-an.md)
 * cleared by a selection CHANGE to a still-valid slide, so once open the
 * drawer keeps following the selection instead of closing and reopening
 * (D-03) — this part of the original design is unchanged.
 */
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'
import { buildSongEditLink, type SongEditTab } from '@/utils/songEditLink'
import SlidePlanRail from './SlidePlanRail.vue'
import SlideGrid from './SlideGrid.vue'
import EditSlideDrawer from './EditSlideDrawer.vue'
import type { EnsureGroupMaterializedResult, MenuItemKey } from './slideDisplay'

const props = withDefaults(defineProps<{
  slots: ServiceSlot[]
  serviceId: string
  orgId: string
  assembledSlideshow: AssembledSlide[]
  groupsBySlotId: Map<string, SlideGroup>
  isEditor: boolean
  /**
   * ★ R036 — the lifecycle lock, threaded DISTINCT from `isEditor` rather than
   * folded into it upstream. Passing `canEditService` as `is-editor` would lock
   * everything in one line, but it would also make it impossible for
   * `EditSlideDrawer` to tell "you are a viewer" from "the service is locked" —
   * and 31-UI-SPEC § 6 requires different read-only copy for each. Every
   * downstream gate composes the two (`isEditor && !serviceLocked`); the drawer
   * additionally branches on `serviceLocked` alone for its notice.
   *
   * Defaulted `false` so existing fixtures that mount this component without the
   * prop keep behaving exactly as they did.
   */
  serviceLocked?: boolean
  groupsLoading: boolean
  /** True while the Slides tab is the visible one in `ServiceEditorView`. */
  active: boolean
  /** On-demand group materializer (25-05 Task 1), threaded down to the grid unused by this component itself. */
  ensureGroupMaterialized: (slotId: string) => Promise<EnsureGroupMaterializedResult | undefined>
}>(), { serviceLocked: false })

const emit = defineEmits<{
  /** D-15's "Edit in scripture" request, carrying the plan item's raw array index. */
  (e: 'navigate-to-scripture-editor', slotArrayIndex: number): void
  /** D-05 (Phase 27-05): request to start presenting. `ServiceEditorView` owns
   *  the `presenting` flag and the `PresentationViewer` mount; this component
   *  only asks for it, exactly as SlideshowPreview's own `present` emit did.
   *  R061: the payload is the flat index into `assembledSlideshow` that
   *  `PresentationViewer` should open on. */
  (e: 'present', startIndex: number): void
  /** Per-item LOOP change (MISC/ANNOUNCEMENTS only) relayed up from SlideGrid;
   *  ServiceEditorView persists it onto `slot.loop`. */
  (e: 'loop-change', index: number, loop: NonNullable<ServiceSlot['loop']>): void
}>()

const router = useRouter()

const selectedSlotId = ref<string | null>(null)
const selectedSlideId = ref<string | null>(null)

/** See ADR-0119 (docs/adr/0119-the-drawer-has-one-body-so-there-is-no-mode-to-set-duplicate.md) */
const editSlideDrawerRef = ref<InstanceType<typeof EditSlideDrawer> | null>(null)

// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/SlidesTab.vue, "canPresent")
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

// See ADR-0120 (docs/adr/0120-clear-a-dangling-slide-selection-rather-than-chasing-the-id.md)
watch(selectedGroupSlideIds, (ids) => {
  if (selectedSlideId.value !== null && !ids.has(selectedSlideId.value)) {
    selectedSlideId.value = null
  }
})

function onSelectSlot(slotId: string): void {
  selectedSlotId.value = slotId
}

const drawerOpen = ref(false)

// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/SlidesTab.vue, "pendingDrawerAction")
const pendingDrawerAction = ref<{ key: 'duplicate' | 'delete'; nonce: number } | null>(null)
let pendingActionNonce = 0

/** Clears the pending request once the drawer has handled it (33-07's `pending-action-consumed` emit). */
function onPendingActionConsumed(): void {
  pendingDrawerAction.value = null
}

// R051: selection only. Selecting a card must never also open the drawer —
// that coupling is what blocked dragging a slide without triggering edit.
// Selection itself stays fully load-bearing: it still drives the plan
// rail's active accent (via the card's `selected` prop), it is still what
// resolves the drawer's `entry`/`assembledSlide` props below, and the
// dangling-selection watcher above still depends on it.
function onSelectSlide(slideId: string): void {
  selectedSlideId.value = slideId
}

function onDrawerClose(): void {
  drawerOpen.value = false
}

/** See ADR-0119 (docs/adr/0119-the-drawer-has-one-body-so-there-is-no-mode-to-set-duplicate.md) */
function onDrawerEditScriptureText(): void {
  if (!confirmLeavingOpenDrawer()) return
  drawerOpen.value = false
  requestEditInScripture()
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

/** See ADR-0105 (docs/adr/0105-open-it-follows-the-selection-it-never-closes-itself-on-a.md) */
const selectedEntry = computed<GroupSlideEntry | null>(() => {
  if (!selectedGroup.value || selectedSlideId.value === null) return null
  return selectedGroup.value.slides.find((e) => e.id === selectedSlideId.value) ?? null
})

/**
 * The selected group's assembled slides, in the SAME order/filter the grid
 * itself applies (`SlideGrid.vue`'s own `cards` computed) — so the drawer's
 * position/total can never disagree with the grid's own card numbering. Also
 * threaded into the drawer's `groupAssembledSlides` prop (Phase 33 UI-audit
 * fix) so its own remove-caption can tell a song-sourced inherited
 * background apart from nothing resolving beneath a slide's own override.
 */
const selectedGroupAssembledSlides = computed<AssembledSlide[]>(() => {
  if (selectedSlotArrayIndex.value < 0) return []
  return props.assembledSlideshow.filter((assembled) => assembled.slotIndex === selectedSlotArrayIndex.value)
})

const selectedAssembledSlide = computed<AssembledSlide | null>(() => {
  if (selectedSlideId.value === null) return null
  return selectedGroupAssembledSlides.value.find((a) => a.slide.id === selectedSlideId.value) ?? null
})

// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/SlidesTab.vue, "presentStartIndex")
const presentStartIndex = computed<number>(() => {
  if (selectedSlideId.value !== null) {
    const bySlide = props.assembledSlideshow.findIndex((a) => a.slide.id === selectedSlideId.value)
    if (bySlide >= 0) return bySlide
  }
  if (selectedSlotArrayIndex.value >= 0) {
    const byGroup = props.assembledSlideshow.findIndex((a) => a.slotIndex === selectedSlotArrayIndex.value)
    if (byGroup >= 0) return byGroup
  }
  return 0
})

/** Present CTA click handler (R061) — carries the computed start index on the emit. */
function onPresentClick(): void {
  emit('present', presentStartIndex.value)
}

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

/** See ADR-0119 (docs/adr/0119-the-drawer-has-one-body-so-there-is-no-mode-to-set-duplicate.md) */
function confirmLeavingOpenDrawer(): boolean {
  if (!drawerOpen.value) return true
  return editSlideDrawerRef.value?.confirmDiscard() ?? true
}

// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/SlidesTab.vue, "onEditCongregational")
function onEditCongregational(): void {
  if (!confirmLeavingOpenDrawer()) return
  drawerOpen.value = false
  requestEditInScripture()
}

/** See ADR-0119 (docs/adr/0119-the-drawer-has-one-body-so-there-is-no-mode-to-set-duplicate.md) */
function onEditInSongBadge(songId: string): void {
  if (!confirmLeavingOpenDrawer()) return
  void router.push(buildSongEditLink(songId, 'lyrics'))
}

function onMenuAction(slideId: string, key: MenuItemKey): void {
  if ((key === 'edit-in-song' || key === 'edit-in-scripture') && !confirmLeavingOpenDrawer()) return
  selectedSlideId.value = slideId
  switch (key) {
    case 'edit-details':
      drawerOpen.value = true
      break
    case 'edit-in-song': {
      // T-33-24: built from the SELECTED entry's own stored song id, never
      // from anything carried on the menu event itself — a crafted event
      // cannot redirect this to an arbitrary song. Unchanged in behaviour
      // from the link button this replaces (`EditSlideDrawer.vue`'s former
      // `onEditInSong`): lyrics tab for a lyric-section slide, details tab
      // for a copyright slide.
      const ref = selectedEntry.value?.sourceRef
      if (!ref || (ref.kind !== 'lyric' && ref.kind !== 'copyright')) return
      const tab: SongEditTab = ref.kind === 'lyric' ? 'lyrics' : 'details'
      void router.push(buildSongEditLink(ref.songId, tab))
      break
    }
    case 'edit-in-scripture':
      // 34-07: the editor now opens as a modal over this tab rather than by
      // navigating away, so the drawer is closed first — leaving it open
      // behind the modal would leave two editing surfaces stacked on the
      // same entry (the same reason `onDrawerEditScriptureText` closes it).
      drawerOpen.value = false
      requestEditInScripture()
      break
    case 'duplicate':
      pendingDrawerAction.value = { key: 'duplicate', nonce: ++pendingActionNonce }
      drawerOpen.value = true
      break
    case 'delete':
      pendingDrawerAction.value = { key: 'delete', nonce: ++pendingActionNonce }
      drawerOpen.value = true
      break
  }
}

defineExpose({
  selectedSlotId,
  selectedSlideId,
  requestEditInScripture,
  selectSlideById,
  canPresent,
  onPresentClick,
})
</script>
