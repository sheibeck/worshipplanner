<template>
  <div class="rounded-lg border border-gray-800 overflow-hidden">
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="flex items-center gap-3 text-gray-400">
        <svg
          class="h-5 w-5 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span class="text-sm">Loading songs...</span>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="songs.length === 0" class="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div class="mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-12 w-12 text-gray-600 mx-auto mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
        <h3 class="text-base font-medium text-gray-300 mb-2">Your song library is empty</h3>
        <p class="text-sm text-gray-500 max-w-sm">
          Import your songs from a Planning Center CSV export or add them one at a time.
        </p>
      </div>
      <div class="flex flex-col sm:flex-row items-center gap-3">
        <router-link
          to="/songs?import=true"
          class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import from CSV
        </router-link>
        <button
          @click="$emit('add')"
          class="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Add song manually
        </button>
      </div>
    </div>

    <!-- Table -->
    <table v-else class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-800 bg-gray-900/50">
          <th
            scope="col"
            class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 select-none"
            @click="toggleSort('title')"
          >
            <span class="flex items-center gap-1">
              Title
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-3.5 w-3.5"
                :class="sortField === 'title' ? 'text-indigo-400' : 'text-gray-600'"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  v-if="sortField === 'title' && sortDir === 'asc'"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M5 15l7-7 7 7"
                />
                <path
                  v-else-if="sortField === 'title' && sortDir === 'desc'"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M19 9l-7 7-7-7"
                />
                <path
                  v-else
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
            </span>
          </th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
            Category
          </th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
            Key
          </th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
            BPM
          </th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
            Last Used
          </th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
            Team Tags
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-800">
        <tr
          v-for="song in sortedSongs"
          :key="song.id"
          class="cursor-pointer hover:bg-gray-800/50 transition-colors"
          @click="$emit('select', song)"
        >
          <!-- Title -->
          <td class="px-4 py-3">
            <div class="font-medium text-gray-100">{{ song.title }}</div>
            <div v-if="song.author" class="text-xs text-gray-500 mt-0.5">{{ song.author }}</div>
          </td>

          <!-- Category (VW type badge) -->
          <td class="px-4 py-3">
            <SongBadge :type="song.vwType" />
          </td>

          <!-- Key (from first arrangement) -->
          <td class="px-4 py-3 text-gray-300">
            {{ song.arrangements[0]?.key || '&mdash;' }}
          </td>

          <!-- BPM (from first arrangement) -->
          <td class="px-4 py-3 text-gray-300">
            {{ song.arrangements[0]?.bpm ?? '&mdash;' }}
          </td>

          <!-- Last Used -->
          <td class="px-4 py-3 text-gray-400">
            {{ formatDate(song.lastUsedAt) }}
          </td>

          <!-- Team Tags -->
          <td class="px-4 py-3">
            <div class="flex flex-wrap gap-1">
              <TeamTagPill
                v-for="tag in song.teamTags"
                :key="tag"
                :tag="tag"
              />
              <span v-if="song.teamTags.length === 0" class="text-gray-600">&mdash;</span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Song } from '@/types/song'
import type { Timestamp } from 'firebase/firestore'
import SongBadge from '@/components/SongBadge.vue'
import TeamTagPill from '@/components/TeamTagPill.vue'

const props = defineProps<{
  songs: Song[]
  loading: boolean
}>()

defineEmits<{
  select: [song: Song]
  add: []
}>()

type SortField = 'title'
type SortDir = 'asc' | 'desc'

const sortField = ref<SortField>('title')
const sortDir = ref<SortDir>('asc')

function toggleSort(field: SortField) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDir.value = 'asc'
  }
}

const sortedSongs = computed(() => {
  return [...props.songs].sort((a, b) => {
    const aVal = a[sortField.value].toLowerCase()
    const bVal = b[sortField.value].toLowerCase()
    const cmp = aVal.localeCompare(bVal)
    return sortDir.value === 'asc' ? cmp : -cmp
  })
})

function formatDate(ts: Timestamp | null): string {
  if (!ts) return '\u2014'
  try {
    const date = ts.toDate ? ts.toDate() : new Date((ts as unknown as { seconds: number }).seconds * 1000)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '\u2014'
  }
}
</script>
