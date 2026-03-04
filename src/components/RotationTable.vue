<template>
  <div>
    <!-- Empty state -->
    <div
      v-if="services.length === 0"
      class="rounded-lg border border-dashed border-gray-700 py-10 text-center"
    >
      <p class="text-sm text-gray-400">
        No services planned yet. Create services to see your song rotation patterns.
      </p>
    </div>

    <template v-else>
      <!-- Window subtitle -->
      <p class="text-xs text-gray-500 mb-3">
        Showing {{ sortedDates.length }} week{{ sortedDates.length !== 1 ? 's' : '' }} of song rotation
      </p>

      <!-- Filter input (shown when more than 30 songs) -->
      <div v-if="rotationEntries.length > 30" class="mb-4">
        <input
          v-model="songFilter"
          type="text"
          placeholder="Filter by song title..."
          class="w-full max-w-xs rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
      </div>

      <!-- Table wrapper with horizontal scroll if many columns -->
      <div
        class="rounded-lg border border-gray-800 overflow-hidden"
        :class="sortedDates.length > 12 ? 'overflow-x-auto' : ''"
      >
        <table class="w-full text-sm border-collapse">
          <!-- Column headers: dates -->
          <thead>
            <tr class="bg-gray-700">
              <th class="text-left px-3 py-2 text-xs font-semibold text-gray-300 border-b border-gray-800 min-w-[160px] sticky left-0 bg-gray-700 z-10">
                Song
              </th>
              <th
                v-for="date in sortedDates"
                :key="date"
                class="px-3 py-2 text-xs font-semibold text-gray-400 border-b border-gray-800 border-l border-l-gray-800 text-center min-w-[80px] whitespace-nowrap"
              >
                {{ formatColumnDate(date) }}
              </th>
            </tr>
          </thead>

          <!-- Song rows -->
          <tbody class="bg-gray-900">
            <tr
              v-for="entry in filteredEntries"
              :key="entry.songId"
              class="border-b border-gray-800 last:border-b-0 hover:bg-gray-800/30 transition-colors"
            >
              <!-- Song title -->
              <td class="px-3 py-2 text-xs font-medium text-gray-100 sticky left-0 bg-gray-900 z-10 border-r border-gray-800">
                {{ entry.songTitle }}
              </td>

              <!-- Date cells -->
              <td
                v-for="date in sortedDates"
                :key="date"
                class="px-3 py-2 text-center border-l border-gray-800"
                :class="getCellClass(entry.songId, date)"
              >
                <span
                  v-if="entry.dates.includes(date)"
                  class="inline-block w-2.5 h-2.5 rounded-full"
                  :class="isConsecutiveRepeat(entry.songId, date) ? 'bg-amber-400' : 'bg-sky-300'"
                ></span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Legend -->
      <div class="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <div class="flex items-center gap-1.5">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-sky-300"></span>
          Song used
        </div>
        <div class="flex items-center gap-1.5">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-400"></span>
          Repeated in consecutive weeks
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Service } from '@/types/service'
import { computeRotationTable } from '@/utils/rotationTable'

const props = defineProps<{
  services: Service[]
}>()

const songFilter = ref('')

// Compute rotation entries from services
const rotationEntries = computed(() => computeRotationTable(props.services))

// All unique dates across all services, sorted ascending
const sortedDates = computed(() => {
  const dateSet = new Set<string>()
  for (const service of props.services) {
    dateSet.add(service.date)
  }
  return Array.from(dateSet).sort()
})

// Filter entries by song title (only active when > 30 songs)
const filteredEntries = computed(() => {
  if (!songFilter.value.trim()) return rotationEntries.value
  const q = songFilter.value.toLowerCase()
  return rotationEntries.value.filter((e) => e.songTitle.toLowerCase().includes(q))
})

// Format a date column header: "Mar 8"
function formatColumnDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Build a lookup: songId -> Set<date> for O(1) cell lookups
const songDateMap = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const entry of rotationEntries.value) {
    map.set(entry.songId, new Set(entry.dates))
  }
  return map
})

// For consecutive repeat detection: build a map songId -> sorted dates array
const songSortedDates = computed(() => {
  const map = new Map<string, string[]>()
  for (const entry of rotationEntries.value) {
    map.set(entry.songId, [...entry.dates].sort())
  }
  return map
})

// Check if a given date is a consecutive repeat for a song
// A date is a "consecutive repeat" if the previous date column in sortedDates
// also has this song
function isConsecutiveRepeat(songId: string, date: string): boolean {
  const datesWithSong = songSortedDates.value.get(songId)
  if (!datesWithSong || !datesWithSong.includes(date)) return false

  const allDates = sortedDates.value
  const idx = allDates.indexOf(date)
  if (idx <= 0) return false

  const prevDate = allDates[idx - 1]
  return datesWithSong.includes(prevDate)
}

// Get cell background class
function getCellClass(songId: string, date: string): string {
  const datesForSong = songDateMap.value.get(songId)
  if (!datesForSong?.has(date)) return ''

  if (isConsecutiveRepeat(songId, date)) {
    return 'bg-amber-900/30'
  }
  return 'bg-indigo-900/50'
}
</script>
