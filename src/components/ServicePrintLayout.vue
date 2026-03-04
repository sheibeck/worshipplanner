<template>
  <div class="hidden print:block bg-white text-gray-900 font-sans text-sm p-8">
    <!-- Header -->
    <div class="border-b border-gray-300 pb-3 mb-4">
      <h1 class="text-lg font-bold text-gray-900">{{ formattedDate }}</h1>
      <p v-if="props.service.name" class="text-sm font-semibold text-gray-800">
        {{ props.service.name }}
      </p>
      <p class="text-xs text-gray-600">
        Teams: {{ props.service.teams.length > 0 ? props.service.teams.join(' / ') : 'Standard Band' }}
      </p>
    </div>

    <!-- Slot rows -->
    <div>
      <div
        v-for="(slot, index) in props.service.slots"
        :key="slot.position + '-' + slot.kind + '-' + index"
        data-slot-row
        class="py-1.5 border-b border-gray-100 break-inside-avoid"
      >
        <!-- SONG slot -->
        <template v-if="slot.kind === 'SONG'">
          <span class="font-semibold text-gray-700">{{ slotLabel(slot, index) }}</span>
          <template v-if="slot.songId">
            <span class="text-gray-500"> -- </span>
            <span class="text-gray-900">{{ slot.songTitle }}</span>
            <span class="text-gray-500">  |  </span>
            <span class="text-gray-600">Key: {{ slot.songKey }}</span>
            <span class="text-gray-500">  |  </span>
            <span class="text-gray-600">BPM: {{ getBpmForSlot(slot) ?? '--' }}</span>
          </template>
          <template v-else>
            <span class="text-gray-500"> -- </span>
            <span class="text-gray-400 italic">[not assigned]</span>
          </template>
        </template>

        <!-- SCRIPTURE slot -->
        <template v-else-if="slot.kind === 'SCRIPTURE'">
          <span class="font-semibold text-gray-700">Scripture Reading</span>
          <template v-if="slot.book">
            <span class="text-gray-500"> -- </span>
            <span class="text-gray-900">{{ slot.book }} {{ slot.chapter }}:{{ slot.verseStart }}-{{ slot.verseEnd }}</span>
          </template>
          <template v-else>
            <span class="text-gray-500"> -- </span>
            <span class="text-gray-400 italic">[not assigned]</span>
          </template>
        </template>

        <!-- PRAYER slot -->
        <template v-else-if="slot.kind === 'PRAYER'">
          <span class="font-semibold text-gray-700">Prayer</span>
        </template>

        <!-- MESSAGE slot -->
        <template v-else-if="slot.kind === 'MESSAGE'">
          <span class="font-semibold text-gray-700">Message</span>
          <template v-if="props.service.sermonPassage">
            <span class="text-gray-500"> -- </span>
            <span class="text-gray-900">{{ formatScriptureRef(props.service.sermonPassage) }}</span>
          </template>
        </template>

        <!-- HYMN slot -->
        <template v-else-if="slot.kind === 'HYMN'">
          <span class="font-semibold text-gray-700">Hymn</span>
          <template v-if="(slot as HymnSlot).hymnName">
            <span class="text-gray-500"> -- </span>
            <span class="text-gray-900">{{ (slot as HymnSlot).hymnName }}</span>
            <template v-if="(slot as HymnSlot).hymnNumber">
              <span class="text-gray-500"> #{{ (slot as HymnSlot).hymnNumber }}</span>
            </template>
            <template v-if="(slot as HymnSlot).verses">
              <span class="text-gray-600">  |  vv. {{ (slot as HymnSlot).verses }}</span>
            </template>
          </template>
          <template v-else>
            <span class="text-gray-500"> -- </span>
            <span class="text-gray-400 italic">[not assigned]</span>
          </template>
        </template>
      </div>
    </div>

    <!-- Notes section -->
    <div v-if="props.service.notes" class="mt-4 text-xs text-gray-600">
      <p class="font-semibold mb-1">Notes</p>
      <p class="whitespace-pre-wrap">{{ props.service.notes }}</p>
    </div>

    <!-- Footer -->
    <p class="text-xs text-gray-400 mt-6 pt-2 border-t border-gray-200">
      Generated from WorshipPlanner
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Service, SongSlot, HymnSlot, ScriptureRef } from '@/types/service'
import type { Song } from '@/types/song'
import { slotLabel } from '@/utils/slotTypes'
import { formatScriptureRef } from '@/utils/planningCenterExport'

const props = defineProps<{
  service: Service
  songs: Song[]
}>()

/**
 * Look up BPM for a song slot:
 * 1. Find song by songId in props.songs
 * 2. Find arrangement matching songKey
 * 3. Fall back to first arrangement's BPM
 * 4. Return null if not found
 */
function getBpmForSlot(slot: SongSlot): number | null {
  if (!slot.songId) return null
  const song = props.songs.find((s) => s.id === slot.songId)
  if (!song) return null
  const matchingArr = song.arrangements.find((a) => a.key === slot.songKey)
  return matchingArr?.bpm ?? song.arrangements[0]?.bpm ?? null
}

// ── Computed ──────────────────────────────────────────────────────────────────

const formattedDate = computed(() => {
  const parts = props.service.date.split('-').map(Number)
  const year = parts[0] ?? 0
  const month = parts[1] ?? 1
  const day = parts[2] ?? 1
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
})
</script>
