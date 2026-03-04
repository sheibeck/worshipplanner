<template>
  <div class="min-h-screen bg-white text-gray-900 font-sans">
    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center min-h-screen">
      <p class="text-gray-500 text-sm">Loading...</p>
    </div>

    <!-- Not found state -->
    <div v-else-if="notFound" class="flex items-center justify-center min-h-screen px-4">
      <div class="text-center">
        <p class="text-gray-700 text-base mb-2">This shared plan is no longer available or the link is invalid.</p>
        <p class="text-gray-400 text-sm">Please ask your worship leader to share the plan again.</p>
      </div>
    </div>

    <!-- Service content -->
    <div v-else-if="serviceSnapshot" class="max-w-2xl mx-auto px-4 py-8 sm:px-6">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-xl font-bold text-gray-900">{{ formattedDate }}</h1>
        <p v-if="serviceSnapshot.name" class="text-base text-gray-700 mt-0.5">{{ serviceSnapshot.name }}</p>
        <p class="text-sm text-gray-600 mt-1">{{ teamsDisplay }}</p>
      </div>

      <div class="border-b border-gray-200 mb-4"></div>

      <!-- Slot list -->
      <div>
        <div
          v-for="(slot, index) in serviceSnapshot.slots"
          :key="slot.position + '-' + slot.kind + '-' + index"
          class="py-2.5 border-b border-gray-100"
        >
          <!-- SONG slot -->
          <template v-if="slot.kind === 'SONG'">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{{ slotLabel(slot, index) }}</p>
            <template v-if="slot.songId">
              <p class="text-base font-medium text-gray-900">{{ slot.songTitle }}</p>
              <p class="text-sm text-gray-500">Key: {{ slot.songKey }} | BPM: {{ slot.bpm || '--' }}</p>
            </template>
            <p v-else class="text-gray-400 italic text-sm">[not assigned]</p>
          </template>

          <!-- SCRIPTURE slot -->
          <template v-else-if="slot.kind === 'SCRIPTURE'">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Scripture Reading</p>
            <template v-if="slot.book && slot.chapter && slot.verseStart && slot.verseEnd">
              <p class="text-base text-gray-900">{{ slot.book }} {{ slot.chapter }}:{{ slot.verseStart }}-{{ slot.verseEnd }}</p>
            </template>
            <p v-else class="text-gray-400 italic text-sm">[not assigned]</p>
          </template>

          <!-- PRAYER slot -->
          <template v-else-if="slot.kind === 'PRAYER'">
            <p class="text-xs text-gray-500 uppercase tracking-wider">Prayer</p>
          </template>

          <!-- MESSAGE slot -->
          <template v-else-if="slot.kind === 'MESSAGE'">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Message</p>
            <p v-if="serviceSnapshot.sermonPassage" class="text-base text-gray-900">
              {{ formatScriptureRef(serviceSnapshot.sermonPassage) }}
            </p>
          </template>

          <!-- HYMN slot -->
          <template v-else-if="slot.kind === 'HYMN'">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Hymn</p>
            <template v-if="slot.hymnName">
              <p class="text-base font-medium text-gray-900">{{ slot.hymnName }}<template v-if="slot.hymnNumber"> #{{ slot.hymnNumber }}</template></p>
              <p v-if="slot.verses" class="text-sm text-gray-500">vv. {{ slot.verses }}</p>
            </template>
            <p v-else class="text-gray-400 italic text-sm">[not assigned]</p>
          </template>
        </div>
      </div>

      <!-- Notes section -->
      <div v-if="serviceSnapshot.notes" class="mt-6 rounded-lg bg-gray-50 p-4">
        <h2 class="text-sm font-semibold text-gray-700 mb-2">Notes</h2>
        <p class="whitespace-pre-wrap text-sm text-gray-700">{{ serviceSnapshot.notes }}</p>
      </div>

      <!-- Footer -->
      <div class="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
        Shared from WorshipPlanner
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { slotLabel } from '@/utils/slotTypes'
import { formatScriptureRef } from '@/utils/planningCenterExport'
import type { ScriptureRef } from '@/types/service'

// Static VW type label lookup (Tailwind v4 purge safety)
const vwTypeLabels: Record<number, string> = {
  1: 'Call to Worship',
  2: 'Intimate',
  3: 'Ascription',
}
// Used in template indirectly via slot data — keep for future use
void vwTypeLabels

// ── State ───────────────────────────────────────────────────────────────────

const isLoading = ref(true)
const notFound = ref(false)
const serviceSnapshot = ref<any>(null)

// ── Computed ────────────────────────────────────────────────────────────────

const formattedDate = computed(() => {
  if (!serviceSnapshot.value?.date) return ''
  const [year, month, day] = serviceSnapshot.value.date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
})

const teamsDisplay = computed(() => {
  if (!serviceSnapshot.value?.teams) return 'Standard Band'
  return serviceSnapshot.value.teams.join(' / ') || 'Standard Band'
})

// ── Mount ───────────────────────────────────────────────────────────────────

onMounted(async () => {
  const route = useRoute()
  const token = route.params.token as string
  try {
    const snap = await getDoc(doc(db, 'shareTokens', token))
    if (!snap.exists()) {
      notFound.value = true
    } else {
      serviceSnapshot.value = snap.data().serviceSnapshot
    }
  } catch {
    notFound.value = true
  } finally {
    isLoading.value = false
  }
})
</script>
