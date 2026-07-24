<template>
  <div class="relative">
    <!-- Fixed-height trigger — never grows with tag count -->
    <button
      type="button"
      @click="open = !open"
      class="flex items-center gap-1.5 rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    >
      <span>Tags</span>
      <span v-if="includeTags.size > 0" class="text-xs font-semibold text-indigo-300">{{ includeTags.size }} shown</span>
      <span v-if="includeTags.size > 0 && excludeTags.size > 0" class="text-xs text-gray-500">·</span>
      <span v-if="excludeTags.size > 0" class="text-xs font-semibold text-red-300">{{ excludeTags.size }} hidden</span>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <template v-if="open">
      <!-- Transparent backdrop to close on outside click -->
      <div class="fixed inset-0 z-30" @click="open = false"></div>

      <!-- Popover panel — aligned under the trigger; the Songs-panel trigger sits far right so it opts into right-0 to avoid running off-screen -->
      <div
        class="absolute z-40 mt-1 w-64 rounded-md bg-gray-800 border border-gray-700 shadow-xl p-2"
        :class="align === 'right' ? 'right-0' : 'left-0'"
      >
        <!-- Header row: Clear action -->
        <div class="flex items-center justify-end gap-2 mb-1.5">
          <button
            type="button"
            title="Clear tag filter"
            class="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            @click="$emit('clear')"
          >Clear tags</button>
        </div>

        <!-- Local tag search — ephemeral, filters the list only (no persisted state) -->
        <input
          v-if="availableUserTags.length > 0"
          v-model="tagQuery"
          type="text"
          placeholder="Filter tags…"
          class="w-full mb-1.5 rounded bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />

        <!-- Scrollable checklist -->
        <div v-if="filteredTags.length > 0" class="max-h-48 overflow-y-auto space-y-0.5">
          <div
            v-for="tag in filteredTags"
            :key="tag"
            class="flex items-center justify-between gap-2 py-1 px-2 rounded border text-xs"
            :class="rowClass(tag)"
          >
            <span class="truncate">{{ tag }}</span>
            <span class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                title="Show only songs with this tag"
                @click="toggleInclude(tag)"
                class="px-1.5 py-0.5 rounded text-[11px] font-medium border transition-colors"
                :class="includeTags.has(tag)
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-gray-200'"
              >Show</button>
              <button
                type="button"
                title="Hide songs with this tag"
                @click="toggleExclude(tag)"
                class="px-1.5 py-0.5 rounded text-[11px] font-medium border transition-colors"
                :class="excludeTags.has(tag)
                  ? 'border-red-600 bg-red-700 text-white'
                  : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-gray-200'"
              >Hide</button>
            </span>
          </div>
        </div>

        <!-- No tags match the filter text -->
        <div v-else-if="availableUserTags.length > 0" class="px-4 py-4 text-center">
          <p class="text-xs text-gray-500">No tags match “{{ tagQuery }}”</p>
        </div>

        <!-- Empty state — no tags exist at all -->
        <div v-else class="px-4 py-6 text-center">
          <p class="text-sm text-gray-400">No tags yet</p>
          <p class="text-xs text-gray-500">Add tags to songs in the Songs panel to filter by them here.</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    availableUserTags: string[]
    includeTags: Set<string>
    excludeTags: Set<string>
    /** Which edge to anchor the popover to. 'right' for right-aligned triggers (Songs panel). */
    align?: 'left' | 'right'
  }>(),
  { align: 'left' },
)

const emit = defineEmits<{
  'update:includeTags': [value: Set<string>]
  'update:excludeTags': [value: Set<string>]
  clear: []
}>()

const open = ref(false)

// Ephemeral local filter for the tag list — intentionally not persisted anywhere.
const tagQuery = ref('')
// Reset the ephemeral filter each time the popover closes so it doesn't persist across reopens.
watch(open, (isOpen) => {
  if (!isOpen) tagQuery.value = ''
})
const filteredTags = computed(() => {
  const q = tagQuery.value.trim().toLowerCase()
  if (!q) return props.availableUserTags
  return props.availableUserTags.filter((t) => t.toLowerCase().includes(q))
})

function rowClass(tag: string): string {
  if (props.includeTags.has(tag)) return 'border-indigo-800 bg-indigo-900/40 text-indigo-200'
  if (props.excludeTags.has(tag)) return 'border-red-900 bg-red-950/40 text-red-300'
  return 'border-gray-700 bg-gray-800 text-gray-300'
}

// Toggling Show on adds to include and removes from exclude (mutual exclusivity);
// toggling Show off just removes it from include.
function toggleInclude(tag: string) {
  const nextInclude = new Set(props.includeTags)
  if (nextInclude.has(tag)) {
    nextInclude.delete(tag)
  } else {
    nextInclude.add(tag)
    if (props.excludeTags.has(tag)) {
      const nextExclude = new Set(props.excludeTags)
      nextExclude.delete(tag)
      emit('update:excludeTags', nextExclude)
    }
  }
  emit('update:includeTags', nextInclude)
}

// Toggling Hide on adds to exclude and removes from include (mutual exclusivity);
// toggling Hide off just removes it from exclude.
function toggleExclude(tag: string) {
  const nextExclude = new Set(props.excludeTags)
  if (nextExclude.has(tag)) {
    nextExclude.delete(tag)
  } else {
    nextExclude.add(tag)
    if (props.includeTags.has(tag)) {
      const nextInclude = new Set(props.includeTags)
      nextInclude.delete(tag)
      emit('update:includeTags', nextInclude)
    }
  }
  emit('update:excludeTags', nextExclude)
}
</script>
