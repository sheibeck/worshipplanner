<template>
  <div class="w-[260px] shrink-0 border-r border-gray-800 overflow-y-auto overflow-x-hidden" data-testid="slide-plan-rail">
    <div class="p-3">
      <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">SERVICE PLAN</h2>
      <p class="mt-1 text-[10px] text-gray-500">order locked &#8644; Service Order</p>
    </div>

    <!-- Loading: skeleton rows while the group subscription is still cold and
         there is nothing real to show yet (D-07's empty state would be a
         false negative in this window). -->
    <div v-if="showSkeleton" class="px-3 pb-3 space-y-1.5" data-testid="rail-skeleton">
      <div
        v-for="n in 4"
        :key="n"
        class="h-16 rounded-lg bg-gray-900 border border-gray-800 animate-pulse"
      />
    </div>

    <!-- Empty: no plan items at all (D-07) — points the user at the Service
         Order tab; the Slides tab itself stays reachable. -->
    <div v-else-if="showEmptyState" class="px-4 pb-4" data-testid="rail-empty-state">
      <p class="text-sm font-medium text-gray-300">Nothing planned yet</p>
      <p class="mt-1 text-xs text-gray-500">
        Add songs, scripture, and other elements on the Service Order tab &mdash; they'll show up here automatically.
      </p>
    </div>

    <!-- Populated: one row per plan item, in plan (position) order. No drag
         handle, no cursor-grab, no draggable attribute, no drop handler
         anywhere in this branch (D-06) — the note above is the only
         explanation offered. -->
    <div v-else class="px-3 pb-3 space-y-1.5" data-testid="rail-rows">
      <button
        v-for="row in rows"
        :key="row.slot.id"
        type="button"
        class="w-full text-left rounded-lg border p-3 transition-colors"
        :class="row.selected
          ? 'border-indigo-500 bg-indigo-950/50'
          : 'border-gray-800 bg-gray-900 hover:bg-gray-800/60'"
        :data-testid="`rail-row-${row.slot.id}`"
        :data-selected="row.selected ? 'true' : 'false'"
        @click="emit('select', row.slot.id)"
      >
        <div class="flex items-center gap-1.5">
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border"
            :class="row.badgeClass"
            data-testid="rail-row-badge"
          >
            {{ row.slot.kind }}
          </span>
          <span class="text-[11px] text-gray-500" data-testid="rail-row-count">{{ row.count }}</span>
        </div>
        <p class="mt-1 text-sm text-gray-100 line-clamp-2 text-ellipsis">{{ row.title }}</p>
        <p v-if="row.bedLabel" class="mt-1 text-[11px] text-indigo-400" data-testid="rail-row-bed">
          &#9834; {{ row.bedLabel }}
        </p>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Presentational, prop-driven plan rail (Phase 25 Task 1). Mirrors the
 * service plan's order and explains — via the note above, never via a
 * disabled-looking drag handle — that it cannot be reordered here (D-06).
 *
 * Reads no store and calls no composable: every input arrives as a prop
 * from `SlidesTab.vue`, which itself receives assembled data from
 * `ServiceEditorView.vue`, the page's sole owner of `useSlideshowAssembly()`.
 */
import { computed } from 'vue'
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { SlideGroup } from '@/types/slideGroup'
import { KIND_BADGE_CLASSES, slotDisplayTitle, bedAudioLabel } from './slideDisplay'

const props = defineProps<{
  /**
   * The service's slots in their RAW array order (not pre-sorted). This
   * component sorts a working copy by `position` for display, but the
   * original array INDEX of each slot — not its position — is what
   * `AssembledSlide.slotIndex` matches, and what 25-04's grid filters the
   * assembled slideshow by. Pre-sorting before this component receives the
   * array would sever that index correspondence.
   */
  slots: ServiceSlot[]
  assembledSlideshow: AssembledSlide[]
  groupsBySlotId: Map<string, SlideGroup>
  selectedSlotId: string | null
  groupsLoading: boolean
}>()

const emit = defineEmits<{
  select: [slotId: string]
}>()

interface RailRow {
  slot: ServiceSlot
  arrayIndex: number
  count: number
  title: string
  badgeClass: string
  bedLabel: string | null
  selected: boolean
}

const rows = computed<RailRow[]>(() => {
  return props.slots
    .map((slot, arrayIndex) => ({ slot, arrayIndex }))
    .sort((a, b) => a.slot.position - b.slot.position)
    .map(({ slot, arrayIndex }) => {
      // Count derived from the assembled slideshow filtered by this row's
      // ARRAY index, NOT `group.slides.length` — a slot whose group has not
      // materialized yet still produces real fallback-path slides, and the
      // group document would read zero while the grid shows a full group.
      const count = props.assembledSlideshow.filter((s) => s.slotIndex === arrayIndex).length
      const group = props.groupsBySlotId.get(slot.id)
      return {
        slot,
        arrayIndex,
        count,
        title: slotDisplayTitle(slot),
        badgeClass: KIND_BADGE_CLASSES[slot.kind],
        bedLabel: group?.bedAudioUrl ? bedAudioLabel(group.bedAudioUrl) : null,
        selected: slot.id === props.selectedSlotId,
      }
    })
})

const showSkeleton = computed(() => props.groupsLoading && props.slots.length === 0)
const showEmptyState = computed(() => !showSkeleton.value && rows.value.length === 0)
</script>
