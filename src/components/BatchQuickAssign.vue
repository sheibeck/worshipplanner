<template>
  <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800">
      <div>
        <h2 class="text-sm font-semibold text-gray-100">Quick Assign VW Categories</h2>
        <p class="text-xs text-gray-500 mt-0.5">
          {{ currentIndex + 1 }} of {{ songs.length }} uncategorized song{{ songs.length !== 1 ? 's' : '' }}
        </p>
      </div>
      <button
        type="button"
        class="px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
        @click="$emit('done')"
      >
        Done
      </button>
    </div>

    <!-- Progress bar -->
    <div class="h-1 bg-gray-800">
      <div
        class="h-1 bg-indigo-600 transition-all duration-300"
        :style="{ width: `${progressPercent}%` }"
      ></div>
    </div>

    <!-- All done state -->
    <div v-if="songs.length === 0" class="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div class="w-12 h-12 rounded-full bg-green-900/40 flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p class="text-sm font-medium text-gray-200 mb-1">All songs categorized!</p>
      <p class="text-xs text-gray-500 mb-4">No more uncategorized songs in your library.</p>
      <button
        type="button"
        class="px-4 py-2 rounded-md bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        @click="$emit('done')"
      >
        Back to Library
      </button>
    </div>

    <!-- Current song card -->
    <div v-else class="px-6 py-6">
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-gray-100">{{ currentSong.title }}</h3>
        <p v-if="currentSong.author" class="text-sm text-gray-400 mt-0.5">{{ currentSong.author }}</p>
        <div v-if="currentSong.arrangements.length > 0" class="mt-2 flex flex-wrap gap-2">
          <span
            v-for="arr in currentSong.arrangements"
            :key="arr.id"
            class="text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded px-2 py-0.5"
          >
            {{ arr.key ? `${arr.name} · ${arr.key}` : arr.name }}
          </span>
        </div>
      </div>

      <!-- VW type buttons -->
      <div class="grid grid-cols-3 gap-3 mb-4">
        <button
          type="button"
          class="flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-xl border-2 border-blue-700 bg-blue-900/20 text-blue-300 hover:bg-blue-900/40 hover:border-blue-500 transition-colors"
          :disabled="isAssigning"
          @click="assign(1)"
        >
          <span class="text-2xl font-bold">1</span>
          <span class="text-xs font-medium text-center leading-tight">Call to<br>Worship</span>
        </button>
        <button
          type="button"
          class="flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-xl border-2 border-purple-700 bg-purple-900/20 text-purple-300 hover:bg-purple-900/40 hover:border-purple-500 transition-colors"
          :disabled="isAssigning"
          @click="assign(2)"
        >
          <span class="text-2xl font-bold">2</span>
          <span class="text-xs font-medium text-center leading-tight">Intimate</span>
        </button>
        <button
          type="button"
          class="flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-xl border-2 border-amber-700 bg-amber-900/20 text-amber-300 hover:bg-amber-900/40 hover:border-amber-500 transition-colors"
          :disabled="isAssigning"
          @click="assign(3)"
        >
          <span class="text-2xl font-bold">3</span>
          <span class="text-xs font-medium text-center leading-tight">Ascription</span>
        </button>
      </div>

      <!-- Skip button -->
      <div class="flex justify-center">
        <button
          type="button"
          class="text-sm text-gray-500 hover:text-gray-300 transition-colors px-4 py-2 rounded-md hover:bg-gray-800"
          :disabled="isAssigning"
          @click="skip"
        >
          Skip for now
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSongStore } from '@/stores/songs'
import type { Song, VWType } from '@/types/song'

const props = defineProps<{
  songs: Song[]
}>()

defineEmits<{
  done: []
}>()

const songStore = useSongStore()

const currentIndex = ref(0)
const isAssigning = ref(false)

const currentSong = computed(() => props.songs[currentIndex.value])

const progressPercent = computed(() => {
  if (props.songs.length === 0) return 100
  return Math.round((currentIndex.value / props.songs.length) * 100)
})

async function assign(type: VWType) {
  if (!currentSong.value) return
  isAssigning.value = true
  try {
    await songStore.updateSong(currentSong.value.id, { vwType: type })
    // Advance — Firestore onSnapshot will remove this song from the uncategorized list,
    // so we don't need to manually increment; but we guard the index.
    if (currentIndex.value >= props.songs.length - 1) {
      currentIndex.value = Math.max(0, props.songs.length - 2)
    }
  } finally {
    isAssigning.value = false
  }
}

function skip() {
  if (currentIndex.value < props.songs.length - 1) {
    currentIndex.value++
  } else {
    currentIndex.value = 0
  }
}
</script>
