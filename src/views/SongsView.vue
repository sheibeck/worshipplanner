<template>
  <AppShell>
    <div class="px-6 py-8">
      <!-- Batch Quick Assign mode -->
      <div v-if="batchMode" class="mb-6">
        <BatchQuickAssign
          :songs="uncategorizedSongs"
          @done="batchMode = false"
        />
      </div>

      <!-- Normal view -->
      <template v-else>
        <!-- Page header -->
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-xl font-semibold text-gray-100">Songs</h1>
            <p class="text-sm text-gray-400 mt-1">
              {{ songStore.isLoading ? 'Loading...' : `${songStore.songs.length} song${songStore.songs.length !== 1 ? 's' : ''}` }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <!-- Batch Assign — visible only when uncategorized songs exist -->
            <button
              v-if="uncategorizedSongs.length > 0"
              @click="batchMode = true"
              class="inline-flex items-center gap-2 rounded-md border border-amber-700 bg-amber-900/20 px-3 py-2 text-sm font-medium text-amber-300 hover:bg-amber-900/40 hover:text-amber-200 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Batch Assign ({{ uncategorizedSongs.length }})
            </button>
            <button
              @click="importModalOpen = true"
              class="inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import Songs
            </button>
            <button
              @click="onAddSong"
              class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Song
            </button>
          </div>
        </div>

        <!-- Filters -->
        <div class="mb-4">
          <SongFilters
            v-model:searchQuery="songStore.searchQuery"
            v-model:filterVwType="songStore.filterVwType"
            v-model:filterKey="songStore.filterKey"
            v-model:filterTag="songStore.filterTag"
            :availableKeys="availableKeys"
            :availableTags="availableTags"
          />
        </div>

        <!-- Song table -->
        <SongTable
          :songs="songStore.filteredSongs"
          :loading="songStore.isLoading"
          @select="onSelectSong"
          @add="onAddSong"
        />
      </template>
    </div>

    <!-- Slide-over panel (outside layout content, Teleported to body) -->
    <SongSlideOver
      :open="slideOverOpen"
      :song="selectedSong"
      @close="slideOverOpen = false"
      @saved="slideOverOpen = false"
      @deleted="slideOverOpen = false"
    />

    <!-- CSV import modal -->
    <CsvImportModal
      :open="importModalOpen"
      @close="importModalOpen = false"
      @imported="onImported"
    />
  </AppShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSongStore } from '@/stores/songs'
import type { Song } from '@/types/song'
import AppShell from '@/components/AppShell.vue'
import SongFilters from '@/components/SongFilters.vue'
import SongTable from '@/components/SongTable.vue'
import SongSlideOver from '@/components/SongSlideOver.vue'
import BatchQuickAssign from '@/components/BatchQuickAssign.vue'
import CsvImportModal from '@/components/CsvImportModal.vue'

const authStore = useAuthStore()
const songStore = useSongStore()
const route = useRoute()
const router = useRouter()

// Slide-over state
const selectedSong = ref<Song | null>(null)
const slideOverOpen = ref(false)

// Import modal state
const importModalOpen = ref(false)

// Batch quick-assign mode
const batchMode = ref(false)

// Uncategorized songs (for batch assign)
const uncategorizedSongs = computed(() =>
  songStore.songs.filter((s) => s.vwType === null),
)

// Derived filter options from current songs
const availableKeys = computed(() => {
  const keys = new Set<string>()
  songStore.songs.forEach((song) => {
    song.arrangements.forEach((arr) => {
      if (arr.key) keys.add(arr.key)
    })
  })
  return Array.from(keys).sort()
})

const availableTags = computed(() => {
  const tags = new Set<string>()
  songStore.songs.forEach((song) => {
    song.teamTags.forEach((tag) => tags.add(tag))
  })
  return Array.from(tags).sort()
})

// Subscribe to Firestore songs collection once orgId is resolved
function initStore() {
  const orgId = authStore.orgId
  if (!orgId) return
  songStore.subscribe(orgId)
}

onMounted(async () => {
  initStore()

  // Check for ?import=true query param — auto-open import modal
  if (route.query.import === 'true') {
    importModalOpen.value = true
    // Clear query param without navigation
    router.replace({ query: { ...route.query, import: undefined } })
  }
})

onUnmounted(() => {
  songStore.unsubscribeAll()
})

function onSelectSong(song: Song) {
  selectedSong.value = song
  slideOverOpen.value = true
}

function onAddSong() {
  selectedSong.value = null
  slideOverOpen.value = true
}

function onImported(count: number) {
  importModalOpen.value = false
  console.log(`[SongsView] imported ${count} songs`)
}
</script>
