<template>
  <div class="relative">
    <!-- Fixed-height trigger — never grows with tag count -->
    <button
      type="button"
      @click="open = !open"
      class="flex items-center gap-1.5 rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    >
      <span>Tags<span v-if="checkedTags.size > 0"> ({{ checkedTags.size }})</span></span>
      <span v-if="hide" class="text-xs font-semibold text-indigo-300">(hiding)</span>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <template v-if="open">
      <!-- Transparent backdrop to close on outside click -->
      <div class="fixed inset-0 z-30" @click="open = false"></div>

      <!-- Popover panel — aligned under the trigger; the Songs-panel trigger sits far right so it opts into right-0 to avoid running off-screen -->
      <div
        class="absolute z-40 mt-1 w-56 rounded-md bg-gray-800 border border-gray-700 shadow-xl p-2"
        :class="align === 'right' ? 'right-0' : 'left-0'"
      >
        <!-- Header row: Hide toggle + Clear action -->
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <div class="flex items-center gap-1.5">
            <label class="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                :checked="hide"
                @change="$emit('update:hide', ($event.target as HTMLInputElement).checked)"
                title="Invert: hide checked tags instead of showing only them"
                class="rounded border-gray-700 bg-gray-800 text-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span class="text-xs text-gray-400" title="Invert: hide checked tags instead of showing only them">Hide tags</span>
            </label>
            <span v-if="hide" class="text-xs font-semibold text-indigo-300">(hiding)</span>
          </div>
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
          <label
            v-for="tag in filteredTags"
            :key="tag"
            class="flex items-center gap-2 py-1 px-2 rounded border text-xs cursor-pointer"
            :class="checkedTags.has(tag) ? 'border-pink-800 bg-pink-900/50 text-pink-300' : 'border-gray-700 bg-gray-800 text-gray-300'"
          >
            <input
              type="checkbox"
              :checked="checkedTags.has(tag)"
              @change="toggleTag(tag)"
              class="rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span>{{ tag }}</span>
          </label>
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
    checkedTags: Set<string>
    hide: boolean
    /** Which edge to anchor the popover to. 'right' for right-aligned triggers (Songs panel). */
    align?: 'left' | 'right'
  }>(),
  { align: 'left' },
)

const emit = defineEmits<{
  'update:checkedTags': [value: Set<string>]
  'update:hide': [value: boolean]
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

function toggleTag(tag: string) {
  const next = new Set(props.checkedTags)
  next.has(tag) ? next.delete(tag) : next.add(tag)
  emit('update:checkedTags', next)
}
</script>
