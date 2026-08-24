<template>
  <div :class="rootClass">
    <!-- Search input -->
    <div :class="layout === 'inline' ? 'flex-1' : undefined">
      <div class="relative">
        <div
          v-if="layout === 'inline'"
          class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          ref="searchInputRef"
          type="text"
          :value="searchQuery"
          @input="onSearchInput"
          :placeholder="searchPlaceholder ?? defaultPlaceholder"
          :title="searchTitle"
          aria-label="Search songs"
          :class="inputClass"
        />
        <button
          v-if="layout === 'inline' && searchQuery"
          type="button"
          class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-200"
          title="Clear search"
          aria-label="Clear search"
          @click="onClearSearch"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Consumer-supplied filter controls (e.g. Songs page VW-type/key selects) -->
    <div v-if="layout === 'inline'" class="flex flex-wrap gap-2">
      <slot name="filters" />
    </div>
    <slot v-else name="filters" />

    <!-- Shared tag include/exclude checklist -->
    <TagFilterChecklist
      :availableUserTags="availableUserTags"
      :includeTags="includeTags"
      :excludeTags="excludeTags"
      :align="align"
      @update:includeTags="$emit('update:includeTags', $event)"
      @update:excludeTags="$emit('update:excludeTags', $event)"
      @clear="$emit('clearTagFilter')"
    />
  </div>

  <!-- Consumer-owned row/list markup — receives the shared tag-filtered pool -->
  <slot :filteredSongs="filteredSongs" :searchQuery="searchQuery" />
</template>

<script setup lang="ts">
import { computed, onMounted, nextTick, ref } from 'vue'
import TagFilterChecklist from '@/components/TagFilterChecklist.vue'
import { filterSongsByTags } from '@/utils/songSearch'
import type { Song } from '@/types/song'

const props = withDefaults(
  defineProps<{
    songs: Song[]
    availableUserTags: string[]
    searchQuery: string
    includeTags: Set<string>
    excludeTags: Set<string>
    /** Which edge to anchor the TagFilterChecklist popover to. */
    align?: 'left' | 'right'
    /** 'inline' lays search + #filters slot + tag checklist out horizontally
     * (Songs page filter bar); 'stacked' stacks search above the tag
     * checklist (the picker's sticky bar). */
    layout?: 'inline' | 'stacked'
    searchPlaceholder?: string
    /** Title/tooltip shown on the search field (e.g. field-prefix hint). */
    searchTitle?: string
    autofocus?: boolean
  }>(),
  { align: 'left', layout: 'inline' },
)

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:includeTags': [value: Set<string>]
  'update:excludeTags': [value: Set<string>]
  clearTagFilter: []
}>()

const searchInputRef = ref<HTMLInputElement | null>(null)

const defaultPlaceholder = computed(() =>
  props.layout === 'inline' ? 'Search title, CCLI, theme, tag, category...' : 'Search songs...',
)

const rootClass = computed(() =>
  props.layout === 'stacked'
    ? 'sticky top-0 z-10 bg-gray-800 border-b border-gray-700 p-2 space-y-1.5'
    : 'flex flex-col sm:flex-row gap-3 mb-4',
)

const inputClass = computed(() =>
  props.layout === 'inline'
    ? 'w-full rounded-md bg-gray-800 border border-gray-700 pl-9 pr-9 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'
    : 'w-full rounded-md bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500',
)

// The shared filtered-song computed (R240) — delegates tag include/exclude
// entirely to filterSongsByTags. Text search stays owned by each consumer's
// downstream code (SongBrowser only owns the search INPUT + re-emits its
// value) so existing search semantics are preserved exactly.
const filteredSongs = computed<Song[]>(() =>
  filterSongsByTags(props.songs, props.includeTags, props.excludeTags),
)

function onSearchInput(event: Event) {
  emit('update:searchQuery', (event.target as HTMLInputElement).value)
}

function onClearSearch() {
  emit('update:searchQuery', '')
}

function focusSearch() {
  searchInputRef.value?.focus()
}

onMounted(() => {
  if (props.autofocus) {
    nextTick(() => focusSearch())
  }
})

defineExpose({ focusSearch })
</script>
