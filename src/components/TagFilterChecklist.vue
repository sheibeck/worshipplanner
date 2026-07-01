<template>
  <div>
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

<script setup lang="ts">
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

function toggleTag(tag: string) {
  const next = new Set(props.checkedTags)
  next.has(tag) ? next.delete(tag) : next.add(tag)
  emit('update:checkedTags', next)
}
</script>
