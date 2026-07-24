<template>
  <div class="flex flex-col sm:flex-row gap-4">
    <!-- Left panel: Available Sections -->
    <div class="flex-1 space-y-2">
      <h3 class="text-sm font-medium text-gray-300">Available Sections</h3>
      <div v-if="sections.length === 0" class="text-xs text-gray-500 italic">
        No sections parsed yet
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          data-role="add-section"
          :data-section-id="section.id"
          class="inline-flex items-center rounded-md bg-indigo-600/20 border border-indigo-500/30 px-3 py-1.5 text-sm font-medium text-indigo-300 hover:bg-indigo-600/30 hover:border-indigo-500/50 transition-colors cursor-pointer"
          @click="addSection(section.id)"
        >
          {{ section.label }}
        </button>
      </div>
    </div>

    <!-- Right panel: Performance Order -->
    <div class="flex-1 space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-gray-300">Performance Order</h3>
        <button
          v-if="localOrder.length > 0"
          type="button"
          data-role="reset-order"
          class="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          @click="resetToDefault"
        >
          Reset to Default
        </button>
      </div>

      <div v-if="localOrder.length === 0" class="text-xs text-gray-500 italic">
        Click sections to build the order
      </div>

      <div ref="orderListRef" class="space-y-1">
        <div
          v-for="(sectionId, index) in localOrder"
          :key="`${sectionId}-${index}`"
          class="flex items-center gap-2 rounded-md bg-gray-800 border border-gray-700 px-3 py-2 group"
          data-role="order-item"
        >
          <!-- Drag handle -->
          <span class="drag-handle cursor-grab text-gray-500 hover:text-gray-300 transition-colors" aria-label="Drag to reorder">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 8h16M4 16h16" />
            </svg>
          </span>

          <!-- Section label -->
          <span class="flex-1 text-sm text-gray-100">
            {{ labelFor(sectionId) }}
          </span>

          <!-- Remove button -->
          <button
            type="button"
            data-role="remove-section"
            class="text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            aria-label="Remove section"
            @click="removeSection(index)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Sortable from 'sortablejs'
import type { LyricSection } from '@/types/songLyrics'

const props = defineProps<{
  sections: LyricSection[]
  performanceOrder: string[]
}>()

const emit = defineEmits(['update:performanceOrder'])

// Local copy of the performance order for reactivity
const localOrder = ref<string[]>([...props.performanceOrder])

// Sync from parent when prop changes externally
watch(
  () => props.performanceOrder,
  (newOrder) => {
    localOrder.value = [...newOrder]
  },
)

// ── Sortable ──────────────────────────────────────────────────────────────────

const orderListRef = ref<HTMLElement | null>(null)
let sortableInstance: Sortable | null = null

function initSortable() {
  if (orderListRef.value && !sortableInstance) {
    sortableInstance = Sortable.create(orderListRef.value, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'opacity-30',
      onEnd(evt) {
        if (evt.oldIndex == null || evt.newIndex == null) return
        if (evt.oldIndex === evt.newIndex) return

        // Revert SortableJS DOM move so Vue's reactive render is the single
        // source of truth (prevents snap-back bug) — mirrors ServiceEditorView
        const parent = evt.item.parentNode
        if (parent) {
          const ref = parent.children[evt.oldIndex]
          parent.insertBefore(
            evt.item,
            evt.oldIndex < evt.newIndex ? ref?.nextSibling ?? null : ref ?? null,
          )
        }

        const order = [...localOrder.value]
        const moved = order.splice(evt.oldIndex, 1)[0]
        if (moved === undefined) return
        order.splice(evt.newIndex, 0, moved)
        localOrder.value = order
        emit('update:performanceOrder', [...localOrder.value])
      },
    })
  }
}

function destroySortable() {
  if (sortableInstance) {
    sortableInstance.destroy()
    sortableInstance = null
  }
}

onMounted(() => {
  nextTick(() => initSortable())
})

onBeforeUnmount(() => {
  destroySortable()
})

// Re-init sortable when the list container becomes available
watch(orderListRef, (el) => {
  if (el && !sortableInstance) {
    initSortable()
  }
})

// ── Actions ───────────────────────────────────────────────────────────────────

function addSection(sectionId: string) {
  localOrder.value = [...localOrder.value, sectionId]
  emit('update:performanceOrder', [...localOrder.value])
}

function removeSection(index: number) {
  const order = [...localOrder.value]
  order.splice(index, 1)
  localOrder.value = order
  emit('update:performanceOrder', [...localOrder.value])
}

function resetToDefault() {
  const defaultOrder = props.sections.map((s) => s.id)
  localOrder.value = [...defaultOrder]
  emit('update:performanceOrder', [...localOrder.value])
}

function labelFor(sectionId: string): string {
  const section = props.sections.find((s) => s.id === sectionId)
  return section ? section.label : sectionId
}
</script>
