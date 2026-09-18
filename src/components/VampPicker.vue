<template>
  <div :class="[fill ? 'flex-1 min-h-0 flex flex-col' : 'mt-2', 'rounded-md bg-gray-800 border border-gray-700 p-2']" data-testid="vamp-picker-panel">
    <input
      v-model="search"
      type="text"
      placeholder="Search vamp name or key…"
      data-testid="vamp-picker-search"
      class="w-full rounded-md bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 mb-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
    />

    <!-- WR-02: the panel's own close affordance — until now the only way out
         was picking a vamp or the entry changing underneath it. -->
    <button
      type="button"
      data-testid="vamp-picker-cancel"
      class="mb-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      @click="emit('cancel')"
    >
      Cancel
    </button>

    <!-- Loading -->
    <p v-if="loading" class="text-xs text-gray-500 px-2 py-3 text-center" data-testid="vamp-picker-loading">
      Loading vamps...
    </p>

    <!-- Org has zero vamps -->
    <p
      v-else-if="vamps.length === 0"
      class="text-xs text-gray-500 px-2 py-3 text-center"
      data-testid="vamp-picker-empty"
    >
      No vamps yet — add one from the Vamps tab.
    </p>

    <!-- Search matched nothing -->
    <p
      v-else-if="filtered.length === 0"
      class="text-xs text-gray-500 px-2 py-3 text-center"
      data-testid="vamp-picker-no-match"
    >
      No vamps match your search.
    </p>

    <!-- Rows -->
    <ul v-else :class="[fill ? 'flex-1 min-h-0' : 'max-h-56', 'overflow-y-auto space-y-1']" data-testid="vamp-picker-list">
      <li v-for="vamp in filtered" :key="vamp.id">
        <button
          v-if="vamp.attachment?.downloadUrl"
          type="button"
          data-testid="vamp-picker-row"
          :data-vamp-id="vamp.id"
          class="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors"
          :class="
            vamp.id === selectedVampId
              ? 'bg-indigo-950/40 border border-indigo-700'
              : 'hover:bg-gray-700/60 border border-transparent'
          "
          @click="emit('select', vamp)"
        >
          <svg
            v-if="vamp.id === selectedVampId"
            class="h-4 w-4 text-indigo-400 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <span class="min-w-0 flex-1 truncate text-[13px] text-gray-200">{{ vamp.name }}</span>
          <span
            class="font-mono text-xs px-2 py-0.5 rounded-full bg-gray-900 border border-gray-700 text-gray-300 shrink-0"
            >{{ vamp.key }}</span
          >
          <span class="font-mono text-xs text-gray-500 shrink-0">{{ vamp.tempo || '—' }}</span>
        </button>
        <div
          v-else
          aria-disabled="true"
          data-testid="vamp-picker-row-disabled"
          :data-vamp-id="vamp.id"
          class="w-full flex items-center gap-2 rounded-md px-2 py-1.5 opacity-50 cursor-not-allowed"
        >
          <span class="min-w-0 flex-1 truncate text-[13px] text-gray-400">{{ vamp.name }}</span>
          <span
            class="font-mono text-xs px-2 py-0.5 rounded-full bg-gray-900 border border-gray-700 text-gray-500 shrink-0"
            >{{ vamp.key }}</span
          >
          <span class="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 shrink-0">
            <svg
              class="h-3.5 w-3.5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            No MP3
          </span>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Vamp } from '@/types/vamp'

/** R437 — pure props-driven picker, no store import (the drawer owns the
 * useVampStore() read/write). Local search mirrors useVampStore().filteredVamps'
 * name/key filter shape, never binds the store's global searchQuery. */

const props = defineProps<{
  vamps: Vamp[]
  loading?: boolean
  selectedVampId?: string | null
  /** 260918-pms — fill the host (slide-over body) instead of rendering as a capped inline card. */
  fill?: boolean
}>()

const emit = defineEmits<{ select: [vamp: Vamp]; cancel: [] }>()

const search = ref('')

const filtered = computed(() => {
  const sorted = [...props.vamps].sort((a, b) => a.name.localeCompare(b.name))
  const q = search.value.trim().toLowerCase()
  if (!q) return sorted
  return sorted.filter((v) => v.name.toLowerCase().includes(q) || v.key.toLowerCase().includes(q))
})
</script>
