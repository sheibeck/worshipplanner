<template>
  <!-- Trigger area — visible when no song assigned (or always for "Change" mode) -->
  <div ref="triggerRef">
    <button
      v-if="!currentSongId"
      type="button"
      @click="openDropdown"
      class="w-full flex items-center gap-2 rounded-md border border-dashed border-gray-700 px-3 py-2 text-sm text-gray-500 hover:border-gray-500 hover:text-gray-400 transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      Click to select a song
    </button>
    <button
      v-else
      type="button"
      @click="openDropdown"
      class="mt-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
    >
      Change song
    </button>
  </div>

  <!-- Teleported dropdown -->
  <Teleport to="body">
    <template v-if="isOpen">
      <!-- Transparent backdrop to close on outside click -->
      <div
        class="fixed inset-0 z-30"
        @click="closeDropdown"
      ></div>

      <!-- Dropdown panel -->
      <div
        class="fixed z-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-80 overflow-y-auto"
        :style="dropdownStyle"
      >
        <!-- Search bar -->
        <div class="sticky top-0 bg-gray-800 border-b border-gray-700 p-2">
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            placeholder="Search songs..."
            class="w-full rounded-md bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <!-- Non-search content (AI Picks + Rotation suggestions) -->
        <div v-if="!searchQuery">

          <!-- AI Picks section -->
          <div v-if="hasSermonContext !== false">
            <!-- Loading shimmer -->
            <div v-if="aiLoading" class="px-3 py-2">
              <p class="px-0 pt-1 pb-1 text-xs font-semibold text-indigo-400 uppercase tracking-wider">AI Picks</p>
              <div class="space-y-1.5">
                <div class="h-8 bg-gray-700/60 rounded animate-pulse"></div>
                <div class="h-8 bg-gray-700/60 rounded animate-pulse w-5/6"></div>
                <div class="h-8 bg-gray-700/60 rounded animate-pulse w-4/6"></div>
              </div>
            </div>

            <!-- Error state -->
            <div v-else-if="aiError" class="px-3 py-2">
              <p class="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">AI Picks</p>
              <p class="text-xs text-gray-500">
                Suggestions unavailable.
                <button @click="emit('requestAiSuggestions')" class="text-indigo-400 hover:text-indigo-300 ml-1">Retry</button>
              </p>
            </div>

            <!-- AI Results -->
            <div v-else-if="resolvedAiSuggestions.length > 0">
              <p class="px-3 pt-2 pb-1 text-xs font-semibold text-indigo-400 uppercase tracking-wider">AI Picks</p>
              <button
                v-for="item in resolvedAiSuggestions"
                :key="item.song.id"
                type="button"
                @click="onSelect(item.song)"
                class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-900 transition-colors"
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-gray-100 truncate">{{ item.song.title }}</span>
                  </div>
                  <p class="text-xs text-indigo-400/80 mt-0.5">{{ item.reason }}</p>
                </div>
                <SongBadge :types="item.song.vwTypes ?? []" />
              </button>
            </div>

            <!-- No sermon context placeholder -->
            <div v-else-if="!hasSermonContext" class="px-3 py-2">
              <p class="text-xs text-gray-500 italic">Add a sermon topic or passage for AI suggestions</p>
            </div>

            <!-- Divider between AI and rotation sections -->
            <div v-if="resolvedAiSuggestions.length > 0 || aiLoading || aiError" class="border-t border-gray-700 my-1"></div>
          </div>

          <!-- By Rotation section -->
          <div v-if="suggestions.length > 0">
            <p class="px-3 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">By Rotation</p>
            <button
              v-for="result in suggestions"
              :key="result.song.id"
              type="button"
              @click="onSelect(result.song)"
              :class="[
                'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-900 transition-colors',
                isNonOrchestraSong(result.song) ? 'opacity-50' : '',
              ]"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm text-gray-100 truncate">{{ result.song.title }}</span>
                  <span v-if="result.isRecent" class="text-xs text-amber-400 shrink-0">Recent</span>
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-xs text-gray-400">{{ preferredKey(result.song) }}</span>
                  <span class="text-gray-700">·</span>
                  <span class="text-xs text-gray-500">
                    {{ result.weeksAgo !== null ? `Last used ${result.weeksAgo}w ago` : 'Never used' }}
                  </span>
                </div>
              </div>
              <SongBadge :types="result.song.vwTypes ?? []" />
            </button>
          </div>

          <!-- Empty state: no songs in library -->
          <div v-else class="px-4 py-6 text-center">
            <p class="text-sm text-gray-400 mb-2">No songs in your library.</p>
            <p class="text-xs text-gray-500">
              Add songs to your library first.
              <router-link to="/songs" class="text-indigo-400 hover:text-indigo-300" @click.stop>Go to Songs</router-link>
            </p>
          </div>
        </div>

        <!-- Search results -->
        <div v-else>
          <p class="px-3 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Search Results</p>
          <div v-if="searchResults.length > 0">
            <button
              v-for="song in searchResults"
              :key="song.id"
              type="button"
              @click="onSelect(song)"
              :class="[
                'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-900 transition-colors',
                isNonOrchestraSong(song) ? 'opacity-50' : '',
              ]"
            >
              <div class="flex-1 min-w-0">
                <span class="text-sm text-gray-100 truncate block">{{ song.title }}</span>
                <span class="text-xs text-gray-400">{{ preferredKey(song) }}</span>
              </div>
              <SongBadge :types="song.vwTypes ?? []" />
            </button>
          </div>
          <div v-else class="px-4 py-4 text-center">
            <p class="text-sm text-gray-400">No songs found matching "{{ searchQuery }}"</p>
          </div>
        </div>
      </div>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { rankSongsForSlot } from '@/utils/suggestions'
import type { Song, VWType } from '@/types/song'
import type { SuggestionResult } from '@/utils/suggestions'
import type { AiSongSuggestion } from '@/utils/claudeApi'
import SongBadge from '@/components/SongBadge.vue'

const props = defineProps<{
  requiredVwType: VWType
  serviceTeams: string[]
  currentSongId: string | null
  songs: Song[]
  // AI optional props
  aiSuggestions?: AiSongSuggestion[]
  aiLoading?: boolean
  aiError?: boolean
  hasSermonContext?: boolean
}>()

const emit = defineEmits<{
  select: [song: { id: string; title: string; key: string }]
  clear: []
  requestAiSuggestions: []
}>()

// ── State ──────────────────────────────────────────────────────────────────────

const isOpen = ref(false)
const searchQuery = ref('')
const triggerRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

// ── Computed ───────────────────────────────────────────────────────────────────

const suggestions = computed<SuggestionResult[]>(() => {
  const results = rankSongsForSlot(props.songs, props.requiredVwType, props.serviceTeams)
  return results.slice(0, 5)
})

const searchResults = computed<Song[]>(() => {
  if (!searchQuery.value) return []
  const q = searchQuery.value.toLowerCase()
  return props.songs
    .filter((s) => s.title.toLowerCase().includes(q))
    .sort((a, b) => {
      // Orchestra-first when service is orchestra (D-08)
      if (isOrchestraService.value) {
        const aOrch = a.teamTags.includes('Orchestra') ? 1 : 0
        const bOrch = b.teamTags.includes('Orchestra') ? 1 : 0
        if (bOrch !== aOrch) return bOrch - aOrch
      }
      // VW type match secondary sort
      const aMatch = (a.vwTypes ?? []).includes(props.requiredVwType) ? 1 : 0
      const bMatch = (b.vwTypes ?? []).includes(props.requiredVwType) ? 1 : 0
      return bMatch - aMatch
    })
})

const resolvedAiSuggestions = computed<{ song: Song; reason: string }[]>(() => {
  if (!props.aiSuggestions) return []
  return props.aiSuggestions
    .map((ai) => {
      const song = props.songs.find((s) => s.id === ai.songId)
      return song ? { song, reason: ai.reason } : null
    })
    .filter((item): item is { song: Song; reason: string } => item !== null)
})

const isOrchestraService = computed(() => props.serviceTeams.includes('Orchestra'))

function isNonOrchestraSong(song: Song): boolean {
  return isOrchestraService.value && !song.teamTags.includes('Orchestra')
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function preferredKey(song: Song): string {
  const first = song.arrangements[0]
  return first?.key ? first.key : '—'
}

// ── Dropdown open/close ────────────────────────────────────────────────────────

function openDropdown() {
  if (!triggerRef.value) return

  const rect = triggerRef.value.getBoundingClientRect()
  const maxH = 320 // matches max-h-80 (20rem)
  const gap = 4
  const spaceBelow = window.innerHeight - rect.bottom - gap
  const spaceAbove = rect.top - gap
  const fitsBelow = spaceBelow >= maxH

  const w = `${Math.max(rect.width, 280)}px`

  if (fitsBelow) {
    dropdownStyle.value = { top: `${rect.bottom + gap}px`, left: `${rect.left}px`, width: w }
  } else if (spaceAbove > spaceBelow) {
    // Flip above, cap height to available space
    const h = Math.min(maxH, spaceAbove)
    dropdownStyle.value = {
      bottom: `${window.innerHeight - rect.top + gap}px`,
      left: `${rect.left}px`,
      width: w,
      maxHeight: `${h}px`,
    }
  } else {
    // Not enough room above either — show below but cap height
    dropdownStyle.value = {
      top: `${rect.bottom + gap}px`,
      left: `${rect.left}px`,
      width: w,
      maxHeight: `${spaceBelow}px`,
    }
  }

  isOpen.value = true
  searchQuery.value = ''

  // Request AI suggestions on open if context exists but suggestions not yet fetched
  if (props.hasSermonContext && !props.aiSuggestions && !props.aiLoading) {
    emit('requestAiSuggestions')
  }

  // Focus search input after DOM update
  nextTick(() => {
    searchInputRef.value?.focus()
  })
}

function closeDropdown() {
  isOpen.value = false
  searchQuery.value = ''
}

// ── Selection ──────────────────────────────────────────────────────────────────

function onSelect(song: Song) {
  const key = song.arrangements[0]?.key ?? ''
  emit('select', { id: song.id, title: song.title, key })
  closeDropdown()
}
</script>
