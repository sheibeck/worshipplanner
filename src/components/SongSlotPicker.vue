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
        class="fixed z-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-[600px] overflow-y-auto"
        :style="dropdownStyle"
      >
        <!-- Search + tag filter bar -->
        <div class="sticky top-0 z-10 bg-gray-800 border-b border-gray-700 p-2 space-y-1.5">
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            placeholder="Search songs..."
            class="w-full rounded-md bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <!-- Tag filters (D-03 picker side) -->
          <div class="flex items-center gap-2">
            <select
              v-model="includeTag"
              class="flex-1 rounded bg-gray-900 border border-gray-700 text-gray-300 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Show all tags</option>
              <option v-for="tag in availableTags" :key="tag" :value="tag">Only: {{ tag }}</option>
            </select>
            <select
              v-model="excludeTag"
              class="flex-1 rounded bg-gray-900 border border-gray-700 text-gray-300 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Hide no tags</option>
              <option v-for="tag in availableTags" :key="tag" :value="tag">Hide: {{ tag }}</option>
            </select>
          </div>
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
          <div v-if="visibleSuggestions.length > 0">
            <p class="px-3 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">By Rotation</p>
            <button
              v-for="result in visibleSuggestions"
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
                <div class="flex flex-wrap gap-1 mt-1">
                  <TeamTagPill v-for="t in result.song.teamTags" :key="'tm-'+t" :tag="t" variant="team" />
                  <TeamTagPill v-for="t in result.song.themes" :key="'th-'+t" :tag="t" variant="theme" />
                  <TeamTagPill v-for="t in result.song.tags" :key="'us-'+t" :tag="t" variant="user" />
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
          <div v-if="visibleSearchResults.length > 0">
            <button
              v-for="song in visibleSearchResults"
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
                <div class="flex flex-wrap gap-1 mt-1">
                  <TeamTagPill v-for="t in song.teamTags" :key="'tm-'+t" :tag="t" variant="team" />
                  <TeamTagPill v-for="t in song.themes" :key="'th-'+t" :tag="t" variant="theme" />
                  <TeamTagPill v-for="t in song.tags" :key="'us-'+t" :tag="t" variant="user" />
                </div>
              </div>
              <SongBadge :types="song.vwTypes ?? []" />
            </button>
          </div>
          <div v-else class="px-4 py-4 text-center">
            <p class="text-sm text-gray-400">No songs found matching "{{ searchQuery }}"</p>
          </div>
        </div>

        <!-- Sentinel for IntersectionObserver load-more (D-12) -->
        <div ref="sentinelRef" class="h-1" />
        <!-- Showing X of Y footer -->
        <div
          v-if="totalVisible > 0"
          class="px-4 py-2 text-xs text-gray-500 text-center border-t border-gray-800"
        >
          Showing {{ currentlyShowing }} of {{ totalVisible }}
          <span v-if="hasMore"> — scroll for more</span>
        </div>
      </div>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { rankSongsForSlot } from '@/utils/suggestions'
import { songMatchesQuery, getPrimaryKey } from '@/utils/songSearch'
import type { Song, VWType } from '@/types/song'
import type { SuggestionResult } from '@/utils/suggestions'
import type { AiSongSuggestion } from '@/utils/claudeApi'
import SongBadge from '@/components/SongBadge.vue'
import TeamTagPill from '@/components/TeamTagPill.vue'

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

// ── Tag filter (D-03 picker side) ─────────────────────────────────────────────

const includeTag = ref('')
const excludeTag = ref('')

/** Distinct user tags across all songs — populates the filter selects */
const availableTags = computed<string[]>(() => {
  const tagSet = new Set<string>()
  for (const song of props.songs) {
    for (const tag of (song.tags ?? [])) tagSet.add(tag)
  }
  return Array.from(tagSet).sort()
})

/** Props.songs filtered by include/exclude tag controls (D-03). Used as base for ranking and search. */
const tagFilteredSongs = computed<Song[]>(() =>
  props.songs.filter(
    (s) =>
      (!includeTag.value || (s.tags?.includes(includeTag.value) ?? false)) &&
      (!excludeTag.value || !(s.tags?.includes(excludeTag.value) ?? false)),
  ),
)

// ── Computed — full ranked/search lists ───────────────────────────────────────

const suggestions = computed<SuggestionResult[]>(() =>
  rankSongsForSlot(tagFilteredSongs.value, props.requiredVwType, props.serviceTeams),
)

const searchResults = computed<Song[]>(() => {
  if (!searchQuery.value) return []
  const q = searchQuery.value
  return tagFilteredSongs.value
    .filter((s) => songMatchesQuery(s, q))
    .sort((a, b) => {
      // Orchestra-first when service is orchestra (D-07)
      if (isOrchestraService.value) {
        const aOrch = a.teamTags.includes('Orchestra') ? 1 : 0
        const bOrch = b.teamTags.includes('Orchestra') ? 1 : 0
        if (bOrch !== aOrch) return bOrch - aOrch
      }
      // VW type secondary sort removed (D-10): slot type no longer influences search ordering
      return 0
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

// ── IntersectionObserver load-more batching (D-12) ────────────────────────────

const BATCH_SIZE = 50
const visibleCount = ref(BATCH_SIZE)

/** Slice of rotation suggestions visible so far */
const visibleSuggestions = computed<SuggestionResult[]>(() =>
  suggestions.value.slice(0, visibleCount.value),
)

/** Slice of search results visible so far */
const visibleSearchResults = computed<Song[]>(() =>
  searchResults.value.slice(0, visibleCount.value),
)

/** Total items in the active list (rotation or search) */
const totalVisible = computed<number>(() =>
  searchQuery.value ? searchResults.value.length : suggestions.value.length,
)

/** How many are currently rendered */
const currentlyShowing = computed<number>(() =>
  searchQuery.value ? visibleSearchResults.value.length : visibleSuggestions.value.length,
)

const hasMore = computed<boolean>(() => visibleCount.value < totalVisible.value)

function loadMore() {
  visibleCount.value = Math.min(visibleCount.value + BATCH_SIZE, totalVisible.value)
}

// Reset visibleCount when active source changes
watch(searchQuery, () => { visibleCount.value = BATCH_SIZE })
watch(includeTag, () => { visibleCount.value = BATCH_SIZE })
watch(excludeTag, () => { visibleCount.value = BATCH_SIZE })
watch(() => props.songs, () => { visibleCount.value = BATCH_SIZE })

// Sentinel element at bottom of scroll container triggers loadMore
const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && hasMore.value) {
        loadMore()
      }
    },
    { rootMargin: '200px' },
  )
  if (sentinelRef.value) {
    observer.observe(sentinelRef.value)
  }
})

onUnmounted(() => {
  observer?.disconnect()
})

// ── Helpers ────────────────────────────────────────────────────────────────────

const isOrchestraService = computed(() => props.serviceTeams.includes('Orchestra'))

function isNonOrchestraSong(song: Song): boolean {
  return isOrchestraService.value && !song.teamTags.includes('Orchestra')
}

function preferredKey(song: Song): string {
  return getPrimaryKey(song) || '—'
}

// ── Dropdown open/close ────────────────────────────────────────────────────────

function openDropdown() {
  if (!triggerRef.value) return

  const rect = triggerRef.value.getBoundingClientRect()
  const maxH = 600 // matches max-h-[600px]
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
  visibleCount.value = BATCH_SIZE

  // Request AI suggestions on open if context exists but suggestions not yet fetched
  if (props.hasSermonContext && !props.aiSuggestions && !props.aiLoading) {
    emit('requestAiSuggestions')
  }

  // Focus search input after DOM update
  nextTick(() => {
    searchInputRef.value?.focus()
    // Re-observe sentinel after DOM update (teleported, so it's only in DOM when isOpen)
    if (sentinelRef.value && observer) {
      observer.observe(sentinelRef.value)
    }
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
