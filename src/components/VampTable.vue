<template>
  <div class="rounded-lg border border-gray-800 overflow-hidden flex flex-col">
    <!-- Search + sub-head. Narrowed mirror of SongTable's shell — no VW/tags/
         columnVisibility apparatus, a vamp has none of that. -->
    <div class="px-4 py-3 border-b border-gray-800 bg-gray-900/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <input
        v-model="vampStore.searchQuery"
        type="text"
        placeholder="Search vamp name or key…"
        data-testid="vamp-search-input"
        class="w-full sm:max-w-xs rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
      />
      <span class="text-xs text-gray-500 shrink-0" data-testid="vamp-subhead">{{ subHeadText }}</span>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="flex items-center gap-3 text-gray-400">
        <svg class="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span class="text-sm">Loading vamps...</span>
      </div>
    </div>

    <!-- Empty library (no vamps at all) -->
    <div v-else-if="props.vamps.length === 0" class="flex flex-col items-center justify-center py-20 px-6 text-center">
      <h3 class="text-base font-medium text-gray-300 mb-2">Your vamp library is empty</h3>
      <p class="text-sm text-gray-500 max-w-sm mb-6">
        Add a vamp — a name, a key, and one MP3 — to play live during a service.
      </p>
      <button
        type="button"
        @click="$emit('add')"
        class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Vamp
      </button>
    </div>

    <!-- Search matched nothing -->
    <div v-else-if="vampStore.filteredVamps.length === 0" class="flex flex-col items-center justify-center py-16 px-6 text-center">
      <p class="text-sm text-gray-500">No vamps match your search.</p>
    </div>

    <!-- Table -->
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-800 bg-gray-900/50">
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Vamp</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Key</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tempo</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Audio</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-800">
          <tr
            v-for="vamp in vampStore.filteredVamps"
            :key="vamp.id"
            class="cursor-pointer hover:bg-gray-800/50 transition-colors"
            @click="$emit('select', vamp)"
          >
            <td class="px-4 py-3 font-medium text-gray-100">{{ vamp.name }}</td>
            <td class="px-4 py-3">
              <span class="font-mono text-xs px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300">{{ vamp.key }}</span>
            </td>
            <td class="px-4 py-3 font-mono text-gray-300">{{ vamp.tempo || '—' }}</td>
            <td class="px-4 py-3">
              <span v-if="vamp.attachment" class="inline-flex items-center gap-1.5 text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                </svg>
                <span class="truncate max-w-[200px]">{{ vamp.attachment.fileName }}</span>
              </span>
              <span v-else class="inline-flex items-center gap-1.5 text-amber-400" data-testid="vamp-no-audio">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                No MP3 attached
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Vamp } from '@/types/vamp'
import { useVampStore } from '@/stores/vamps'

/** R436 — flat one-vamp-per-row table. Narrowed mirror of SongTable.vue: no
 * VW/tags/CCLI/columnVisibility apparatus, no bulk-select. Rows render from
 * useVampStore().filteredVamps (the store owns the name-OR-key filter) —
 * `props.vamps` drives the empty-library state and the sub-head counts. */

const props = defineProps<{
  vamps: Vamp[]
  loading: boolean
}>()

defineEmits<{
  select: [vamp: Vamp]
  add: []
}>()

const vampStore = useVampStore()

const withAudioCount = computed(() => props.vamps.filter((v) => v.attachment).length)

const subHeadText = computed(() => {
  const n = props.vamps.length
  return `${n} vamp${n === 1 ? '' : 's'} · ${withAudioCount.value} with audio`
})
</script>
