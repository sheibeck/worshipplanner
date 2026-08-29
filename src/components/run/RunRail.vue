<script setup lang="ts">
/**
 * RunRail — the order-of-service rail (R276, R262/R263), extracted as PURE
 * presentation from RunControlView.vue (:388-463 markup + the Phase 95
 * captureActiveRow/watch(index) auto-scroll at useRunControl.ts:184-193).
 *
 * The parent (97-09) owns all state and navigation: it supplies `rows`
 * (RailRow[] from useRunControl), the current `activeIndex` (a slotIndex, or
 * null pre-live), and — for the active item only — its `expandedSlides`. Every
 * interaction is emitted as intent (@jump / @jump-slide); the parent maps those
 * to jumpToSlot / postIndex. No store, channel, or side-effects here.
 *
 * The rail testids (rail-item, rail-item-empty, run-rail-empty) and the
 * has-slides-vs-empty branching are reproduced EXACTLY so the wired-view control
 * suite (RunControlView.test.ts rail tests) stays green.
 */
import { ref, computed, watch, nextTick } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { RailRow } from '@/composables/useRunControl'

/** A slide row shown under the active item when the parent supplies its list. */
export interface RailExpandedSlide {
  arrayIndex: number
  label: string
  isCurrent: boolean
}

const props = defineProps<{
  rows: RailRow[]
  activeIndex: number | null
  expandedSlides?: RailExpandedSlide[]
}>()

const emit = defineEmits<{
  jump: [slotIndex: number]
  'jump-slide': [arrayIndex: number]
}>()

/** Mirror of the parent's firstIndexBySlot.size === 0 empty condition. */
const hasAnySlides = computed(() => props.rows.some((r) => r.hasSlides))

function countLabel(count: number): string {
  return count === 1 ? '1 slide' : `${count} slides`
}

// ── Self-owned active-row auto-scroll (moved from Phase 95 parent) ────────────
const activeRowEl = ref<HTMLElement | null>(null)
function captureActiveRow(
  el: Element | ComponentPublicInstance | null,
  isActive: boolean,
) {
  if (isActive) activeRowEl.value = (el as HTMLElement | null) ?? null
}
watch(
  () => props.activeIndex,
  async () => {
    await nextTick()
    activeRowEl.value?.scrollIntoView({ block: 'nearest' })
  },
)
</script>

<template>
  <aside
    class="w-80 flex-none h-full overflow-y-auto bg-[#141624] border-r border-white/10"
  >
    <h2
      class="sticky top-0 z-10 bg-[#141624] text-base font-semibold text-gray-100 px-4 py-3 border-b border-white/10"
    >
      Order of Service
    </h2>

    <!-- Empty state: a locked service with zero assembled slides anywhere. -->
    <div
      v-if="!hasAnySlides"
      class="px-4 py-8 text-center text-gray-400"
      data-testid="run-rail-empty"
    >
      <p class="text-sm font-semibold text-gray-300 mb-1">Nothing to present yet</p>
      <p class="text-xs text-gray-500">
        This service doesn't have any slides. Add songs or scripture in the service editor, then Run
        again.
      </p>
    </div>

    <ul v-else class="p-2 space-y-1">
      <li v-for="row in rows" :key="row.index">
        <!-- Default (has slides) OR active "you are here" row -->
        <template v-if="row.hasSlides">
          <button
            type="button"
            data-testid="rail-item"
            :data-active="String(row.index === activeIndex)"
            :ref="(el) => captureActiveRow(el, row.index === activeIndex)"
            class="w-full text-left px-3 py-2.5 min-h-11 rounded-md flex items-start gap-3 border-l-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :class="
              row.index === activeIndex
                ? 'bg-indigo-600/15 border-indigo-500'
                : 'border-transparent text-gray-300 hover:bg-white/5 cursor-pointer'
            "
            @click="emit('jump', row.index)"
          >
            <span
              v-if="row.index === activeIndex"
              class="mt-1 h-2 w-2 flex-none rounded-full bg-indigo-400"
              aria-hidden="true"
            ></span>
            <span class="min-w-0 flex-1">
              <span v-if="row.section" class="block text-xs uppercase tracking-wide text-gray-500">{{ row.section }}</span>
              <span
                class="block text-sm truncate"
                :class="row.index === activeIndex ? 'text-gray-100 font-semibold' : 'text-gray-300'"
              >
                {{ row.title }}
              </span>
            </span>
            <span class="flex-none text-xs text-gray-500">{{ countLabel(row.count) }}</span>
          </button>

          <!-- Active item expands to its slide list (supplied by the parent). -->
          <ul
            v-if="row.index === activeIndex && expandedSlides && expandedSlides.length"
            class="mt-1 ml-4 space-y-0.5 border-l border-white/10 pl-2"
          >
            <li v-for="slide in expandedSlides" :key="slide.arrayIndex">
              <button
                type="button"
                data-testid="run-rail-slide"
                :data-current="String(slide.isCurrent)"
                class="w-full text-left px-2 py-1.5 min-h-9 rounded flex items-center gap-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                :class="
                  slide.isCurrent
                    ? 'bg-indigo-500/20 text-indigo-100 font-medium'
                    : 'text-gray-400 hover:bg-white/5 cursor-pointer'
                "
                @click="emit('jump-slide', slide.arrayIndex)"
              >
                <span
                  v-if="slide.isCurrent"
                  class="h-1.5 w-1.5 flex-none rounded-full bg-indigo-400"
                  aria-hidden="true"
                ></span>
                <span class="min-w-0 flex-1 truncate">{{ slide.label }}</span>
              </button>
            </li>
          </ul>
        </template>

        <!-- No assembled slides: non-interactive, dimmer, click is a no-op -->
        <div
          v-else
          data-testid="rail-item-empty"
          aria-disabled="true"
          class="w-full text-left px-3 py-2.5 min-h-11 rounded-md flex items-start gap-3 border-l-2 border-transparent text-gray-600 cursor-default"
        >
          <span class="min-w-0 flex-1">
            <span v-if="row.section" class="block text-xs uppercase tracking-wide text-gray-600">{{ row.section }}</span>
            <span class="block text-sm truncate">{{ row.title }}</span>
            <span class="block text-xs text-gray-600">No slides</span>
          </span>
        </div>
      </li>
    </ul>
  </aside>
</template>
