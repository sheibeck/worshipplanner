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

      <!-- Popover panel — anchored to the trigger's right edge so it expands leftward and never runs off-screen -->
      <div class="absolute right-0 z-40 mt-1 w-56 rounded-md bg-gray-800 border border-gray-700 shadow-xl p-2">
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

        <!-- Scrollable checklist -->
        <div v-if="availableUserTags.length > 0" class="max-h-48 overflow-y-auto space-y-0.5">
          <label
            v-for="tag in availableUserTags"
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

        <!-- Empty state -->
        <div v-else class="px-4 py-6 text-center">
          <p class="text-sm text-gray-400">No tags yet</p>
          <p class="text-xs text-gray-500">Add tags to songs in the Songs panel to filter by them here.</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  availableUserTags: string[]
  checkedTags: Set<string>
  hide: boolean
}>()

const emit = defineEmits<{
  'update:checkedTags': [value: Set<string>]
  'update:hide': [value: boolean]
  clear: []
}>()

const open = ref(false)

function toggleTag(tag: string) {
  const next = new Set(props.checkedTags)
  next.has(tag) ? next.delete(tag) : next.add(tag)
  emit('update:checkedTags', next)
}
</script>
