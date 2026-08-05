<template>
  <div class="flex h-full min-h-0 flex-col" data-testid="slides-tab">
    <div class="flex flex-1 min-h-0">
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
 * Phase 33-09 (R051/R052): the trigger moved from an in-drawer link to the
 * 3-dot menu's `edit-in-scripture` key — `onMenuAction` calls this exact
 * function directly, so the drawer never reaches page state and this
 * component's own relay plumbing is unchanged.
 *
 * Edit Slide drawer seam (Phase 26-05, R033): `selectedEntry` resolves
 * `selectedSlideId` against the selected group's stored slides by a DIRECT id
 * lookup — for a materialized group, `AssembledSlide.slide.id` equals
 * `GroupSlideEntry.id` verbatim (26-RESEARCH.md Pattern 1), so no mapping
 * layer exists or is needed. A selection with no matching entry (the
 * pre-materialization fallback-id window, Pitfall 1) resolves to `null` and
 * the drawer renders nothing — not a loading state.
 *
 * Phase 33-09 (R051): selecting a card no longer opens the drawer — that
 * coupling is exactly what R051 exists to break, so a slide can be dragged
 * without triggering edit. `drawerOpen` is now set true only by
 * `onMenuAction`'s two edit keys and by the post-duplicate follow-selection
 * handler (`selectSlideById`), and false only by the drawer's own `close`
 * emit or by the selection itself disappearing (below). It is still NEVER
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
}>()

const router = useRouter()

const selectedSlotId = ref<string | null>(null)
const selectedSlideId = ref<string | null>(null)

/**
 * WR-04: a ref to the mounted drawer so `onMenuAction`'s navigation keys
 * ("edit-in-song"/"edit-in-scripture") can gate on the drawer's OWN unsaved
 * edit guard before routing away — the one path this component owns that the
 * drawer itself cannot self-guard, since 33-09 relocated the navigation here.
 */
const editSlideDrawerRef = ref<InstanceType<typeof EditSlideDrawer> | null>(null)

/**
 * Whether there is anything assembled to present — the same condition
 * SlideshowPreview's own `canPresent` (aliased to `hasAnySlides`, Phase
 * 23-04) used, restated directly against `assembledSlideshow` rather than
 * reintroducing the `AssembledSection[]` grouping that only existed to
 * render the removed preview list.
 *
 * Phase 36-03 (design 1a): the `▶ Present` button this gates now renders in
 * `ServiceEditorView`'s page header, immediately left of Save, instead of
 * inside this tab. This component still owns the condition and the `present`
 * emit below — only the rendered button moved. Exposed (with
 * `onPresentClick`) so the header can read/drive both from a `slidesTabRef`.
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

// Phase 33-09 (R051): no longer set true on every selection — that was the
// coupling this plan exists to break. Set true only by `onMenuAction`'s two
// edit keys and by the post-duplicate follow-selection handler
// (`selectSlideById`) below, and cleared only by the drawer's own `close`
// emit or by the selection itself disappearing (below) — never by a
// selection CHANGE to a still-valid slide, so once open the drawer still
// follows the selection instead of closing and reopening (D-03).
const drawerOpen = ref(false)

/**
 * Phase 33-09 — a menu-dispatched Duplicate/Delete request, relayed
 * verbatim into the drawer's own `pendingAction` prop (33-07's seam). Keyed
 * on a monotonically incrementing nonce (never the `key` alone) so the same
 * key dispatched twice in a row still fires the drawer's watcher the second
 * time. ★ P-01: this component never calls a delete/duplicate store action
 * itself — it only ever sets this pending request, which the drawer turns
 * into its OWN existing write paths (the inline delete confirm, the
 * duplicate write).
 */
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

/**
 * 34-07 (owner UAT F1) — the drawer's Slide Text scripture-route control.
 * Runs the SAME unsaved-drawer guard the menu path runs (WR-04), then closes
 * the drawer and calls the SAME `requestEditInScripture` relay the menu's
 * `edit-in-scripture` key calls, so both routes converge on one relay and
 * therefore one mounted editor. The drawer is closed because the editor now
 * opens as a modal over this tab rather than by navigating away — leaving
 * the drawer open behind it would leave two editing surfaces stacked on the
 * same entry.
 */
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

/**
 * R061 — the (group, slide) → flat-deck-index mapping `present` hands to
 * `PresentationViewer`. Ladder: a selected SLIDE resolves to its own flat
 * index; failing that (not found, or only a group selected), the selected
 * GROUP's first slide; failing that (no group selected, or the group is
 * gone too), 0. Each rung falls through to the next on a miss — this is what
 * makes a stale selection degrade quietly instead of throwing or landing on
 * an unrelated slide. Resolved via `findIndex` only: `selectedSlideId` is an
 * assembled slide's string `id`, never a position (35-RESEARCH.md Anti-Patterns).
 */
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

/**
 * Phase 33-09 (R051/R052) — the single dispatcher for every one of the six
 * 3-dot menu keys (`SlideGrid`'s `menu-action` emit, 33-08). A menu action
 * always implies its own card is the one being acted on, so this selects
 * the entry FIRST — mirroring `onSelectSlide`'s own selection line — before
 * dispatching on the key, since both the drawer's entry resolution and the
 * song-navigation lookup below depend on the selection already being
 * current (even when the acted-on card was not already selected).
 *
 * Only the two edit keys and Duplicate/Delete ever touch `drawerOpen` — the
 * two navigation keys are pure routes/relays and never open it. D2
 * (260805-bvo): the drawer has one body now, so there is no mode to set —
 * Duplicate and Delete simply open it, because that is where their EXISTING
 * write paths live (the duplicate write, the inline delete confirm) — this
 * dispatcher itself never calls a delete or duplicate store action; it only
 * ever sets a pending request for the drawer to act on (P-01).
 *
 * WR-04: "edit-in-song"/"edit-in-scripture" are checked against the OPEN
 * drawer's own unsaved-edit guard BEFORE `selectedSlideId` is reassigned
 * below — the drawer's own `watch(() => props.entry)` starts flushing/
 * resetting for the new entry the moment the selection changes, so asking
 * afterward would already be asking about the wrong entry. A cancelled
 * confirm leaves the selection and drawer state untouched, so an in-flight
 * edit on the entry being left is never silently abandoned.
 */
function confirmLeavingOpenDrawer(): boolean {
  if (!drawerOpen.value) return true
  return editSlideDrawerRef.value?.confirmDiscard() ?? true
}

function onMenuAction(slideId: string, key: MenuItemKey): void {
  if ((key === 'edit-in-song' || key === 'edit-in-scripture') && !confirmLeavingOpenDrawer()) return
  selectedSlideId.value = slideId
  switch (key) {
    case 'edit-details':
    // D2 (260805-bvo): 'edit-lyrics' still exists as a MenuItemKey until
    // Task 3 removes it from slideDisplay.ts; it opens the identical
    // single-body drawer in the meantime, which is harmless.
    case 'edit-lyrics':
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
