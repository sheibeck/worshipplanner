<template>
  <div>
    <!-- Empty state: no services at all -->
    <div
      v-if="services.length === 0"
      class="rounded-lg border border-dashed border-gray-700 py-10 text-center"
    >
      <p class="text-sm text-gray-400">
        No services planned yet. Create services to see your scripture rotation patterns.
      </p>
    </div>

    <!-- Empty state: services exist but no scripture entries -->
    <div
      v-else-if="rotationEntries.length === 0"
      class="rounded-lg border border-dashed border-gray-700 py-10 text-center"
    >
      <p class="text-sm text-gray-400">
        No scripture passages found in these services. Add scripture slots or a sermon passage to see rotation patterns.
      </p>
    </div>

    <template v-else>
      <!-- Window subtitle -->
      <p class="text-xs text-gray-500 mb-3">
        Showing {{ sortedDates.length }} week{{ sortedDates.length !== 1 ? 's' : '' }} of scripture rotation
      </p>

      <!-- Filter input (shown when more than 20 entries) -->
      <div v-if="rotationEntries.length > 20" class="mb-4">
        <input
          v-model="passageFilter"
          type="text"
          placeholder="Filter by passage..."
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
                Passage
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

          <!-- Passage rows -->
          <tbody class="bg-gray-900">
            <tr
              v-for="entry in filteredEntries"
              :key="entry.key"
              class="border-b border-gray-800 last:border-b-0 hover:bg-gray-800/30 transition-colors"
            >
              <!-- Passage key -->
              <td class="px-3 py-2 text-xs font-medium text-gray-100 sticky left-0 bg-gray-900 z-10 border-r border-gray-800">
                {{ entry.key }}
              </td>

              <!-- Date cells -->
              <td
                v-for="date in sortedDates"
                :key="date"
                class="px-3 py-2 text-center border-l border-gray-800"
                :class="getCellClass(entry.key, date)"
              >
                <span
                  v-if="entry.dates.includes(date)"
                  class="inline-block w-2.5 h-2.5 rounded-full"
                  :class="isConsecutiveRepeat(entry.key, date) ? 'bg-amber-400' : 'bg-sky-300'"
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
          Scripture used
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
import type { Service, ScriptureSlot, ScriptureRef } from '@/types/service'

const props = defineProps<{
  services: Service[]
}>()

const passageFilter = ref('')

// Format a ScriptureRef or ScriptureSlot into a human-readable passage key
function formatPassageKey(
  book: string,
  chapter: number,
  verseStart: number | null | undefined,
  verseEnd: number | null | undefined,
): string {
  if (verseStart != null && verseEnd != null) {
    return `${book} ${chapter}:${verseStart}-${verseEnd}`
  }
  if (verseStart != null) {
    return `${book} ${chapter}:${verseStart}`
  }
  return `${book} ${chapter}`
}

interface ScriptureRotationEntry {
  key: string
  dates: string[]
}

// Compute rotation entries: each unique passage key -> list of service dates
const rotationEntries = computed((): ScriptureRotationEntry[] => {
  // Map: passageKey -> Set<serviceDate>
  const map = new Map<string, Set<string>>()

  for (const service of props.services) {
    const keysForService = new Set<string>()

    // Scripture slots
    for (const slot of service.slots) {
      if (slot.kind !== 'SCRIPTURE') continue
      const s = slot as ScriptureSlot
      if (s.book == null || s.chapter == null) continue
      const key = formatPassageKey(s.book, s.chapter, s.verseStart, s.verseEnd)
      keysForService.add(key)
    }

    // Sermon passage
    if (service.sermonPassage != null) {
      const sp: ScriptureRef = service.sermonPassage
      const key = formatPassageKey(sp.book, sp.chapter, sp.verseStart ?? null, sp.verseEnd ?? null)
      keysForService.add(key)
    }

    // Add date to each unique passage key for this service
    for (const key of keysForService) {
      if (!map.has(key)) {
        map.set(key, new Set())
      }
      map.get(key)!.add(service.date)
    }
  }

  // Convert to array, sort alphabetically by key
  return Array.from(map.entries())
    .map(([key, dates]) => ({ key, dates: Array.from(dates).sort() }))
    .sort((a, b) => a.key.localeCompare(b.key))
})

// All unique dates across all services, sorted ascending
const sortedDates = computed(() => {
  const dateSet = new Set<string>()
  for (const service of props.services) {
    dateSet.add(service.date)
  }
  return Array.from(dateSet).sort()
})

// Filter entries by passage key
const filteredEntries = computed(() => {
  if (!passageFilter.value.trim()) return rotationEntries.value
  const q = passageFilter.value.toLowerCase()
  return rotationEntries.value.filter((e) => e.key.toLowerCase().includes(q))
})

// Format a date column header: "Mar 8"
function formatColumnDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number) as [number, number, number]
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Build a lookup: passageKey -> Set<date> for O(1) cell lookups
const passageDateMap = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const entry of rotationEntries.value) {
    map.set(entry.key, new Set(entry.dates))
  }
  return map
})

// For consecutive repeat detection: build a map passageKey -> sorted dates array
const passageSortedDates = computed(() => {
  const map = new Map<string, string[]>()
  for (const entry of rotationEntries.value) {
    map.set(entry.key, [...entry.dates].sort())
  }
  return map
})

// Check if a given date is a consecutive repeat for a passage
// A date is a "consecutive repeat" if the previous date column in sortedDates
// also has this passage
function isConsecutiveRepeat(passageKey: string, date: string): boolean {
  const datesWithPassage = passageSortedDates.value.get(passageKey)
  if (!datesWithPassage || !datesWithPassage.includes(date)) return false

  const allDates = sortedDates.value
  const idx = allDates.indexOf(date)
  if (idx <= 0) return false

  const prevDate = allDates[idx - 1]
  return prevDate !== undefined && datesWithPassage.includes(prevDate)
}

// Get cell background class
function getCellClass(passageKey: string, date: string): string {
  const datesForPassage = passageDateMap.value.get(passageKey)
  if (!datesForPassage?.has(date)) return ''

  if (isConsecutiveRepeat(passageKey, date)) {
    return 'bg-amber-900/30'
  }
  return 'bg-sky-900/40'
}
</script>
