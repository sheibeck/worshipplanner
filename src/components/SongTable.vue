<template>
  <div class="rounded-lg border border-gray-800 overflow-hidden flex flex-col">
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
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-800 bg-gray-900/50">
          <!-- Checkbox column -->
          <th scope="col" class="px-3 py-3 w-8">
            <input
              type="checkbox"
              class="rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
              :checked="selectedIds.size > 0 && selectedIds.size === sortedSongs.length"
              :indeterminate="selectedIds.size > 0 && selectedIds.size < sortedSongs.length"
              @change.stop="toggleSelectAll"
              @click.stop
            />
          </th>
          <!-- Title -->
          <th
            scope="col"
            class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 select-none"
            @click="toggleSort('title')"
          >
            <span class="flex items-center gap-1">
              Title
              <SortArrow :active="sortField === 'title'" :dir="sortDir" />
            </span>
          </th>
          <!-- Category (VW-gated: hidden entirely when VW methodology is off, D-16; not sortable — click a badge to filter) -->
          <th
            v-if="authStore.vwModeEnabled && songStore.columnVisibility.category"
            scope="col"
            class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
          >
            <span class="flex items-center gap-1">
              Category
              <VwExplainer />
            </span>
          </th>
          <!-- Key -->
          <th
            v-if="songStore.columnVisibility.key"
            scope="col"
            class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 select-none"
            @click="toggleSort('key')"
          >
            <span class="flex items-center gap-1">
              Key
              <SortArrow :active="sortField === 'key'" :dir="sortDir" />
            </span>
          </th>
          <!-- CCLI (not sortable per checkpoint feedback) -->
          <th
            v-if="songStore.columnVisibility.ccli"
            scope="col"
            class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
          >
            CCLI
          </th>
          <!-- Last Used -->
          <th
            v-if="songStore.columnVisibility.lastUsed"
            scope="col"
            class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 select-none"
            @click="toggleSort('lastUsed')"
          >
            <span class="flex items-center gap-1">
              Last Used
              <SortArrow :active="sortField === 'lastUsed'" :dir="sortDir" />
            </span>
          </th>
          <!-- Tags (user tags only — team pills folded upstream into tags, D-01/D-12) -->
          <th v-if="songStore.columnVisibility.tags" scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
            Tags
          </th>
          <!-- Themes (own column now — no longer folded into Tags; rendered after Tags per checkpoint feedback; not sortable — click a pill to filter) -->
          <th
            v-if="songStore.columnVisibility.themes"
            scope="col"
            class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
          >
            Themes
          </th>
          <!-- Column-visibility cog + trailing chevron slot (opens edit drawer per-row) -->
          <th scope="col" class="px-4 py-3 w-10 text-right relative">
            <button
              type="button"
              class="text-gray-500 hover:text-gray-300"
              title="Column settings"
              aria-label="Column settings"
              @click.stop="cogOpen = !cogOpen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <template v-if="cogOpen">
              <div class="fixed inset-0 z-30" @click="cogOpen = false"></div>
              <div class="absolute z-40 right-0 mt-1 w-48 rounded-md bg-gray-900 border border-gray-800 shadow-xl p-2 text-left normal-case tracking-normal font-normal">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-xs font-medium text-gray-300">Columns</span>
                  <button type="button" class="text-xs text-gray-500 hover:text-gray-300" @click.stop="songStore.resetColumns()">Reset</button>
                </div>
                <label
                  v-for="col in toggleableColumns"
                  :key="col.key"
                  class="flex items-center gap-2 py-1 px-1 text-xs text-gray-300 hover:bg-gray-800 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    class="rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                    :checked="songStore.columnVisibility[col.key]"
                    @change.stop="songStore.toggleColumn(col.key)"
                  />
                  {{ col.label }}
                </label>
              </div>
            </template>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-800">
        <tr
          v-for="song in visibleSongs"
          :key="song.id"
          class="cursor-pointer hover:bg-gray-800/50 transition-colors"
          :class="selectedIds.has(song.id) ? 'bg-indigo-900/10' : ''"
          @click="$emit('select', song)"
        >
          <!-- Checkbox -->
          <td class="px-3 py-3" @click.stop>
            <input
              type="checkbox"
              class="rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
              :checked="selectedIds.has(song.id)"
              @change.stop="toggleSelect(song.id)"
              @click.stop
            />
          </td>

          <!-- Title -->
          <td class="px-4 py-3">
            <div class="font-medium text-gray-100">{{ song.title }}</div>
            <div v-if="song.author" class="text-xs text-gray-500 mt-0.5">{{ song.author }}</div>
          </td>

          <!-- Category (VW type badge; VW-gated, D-16). Clicking a badge filters by that type. -->
          <td v-if="authStore.vwModeEnabled && songStore.columnVisibility.category" class="px-4 py-3" @click.stop>
            <SongBadge :types="song.vwTypes ?? []" clickable @select="filterByPill('type', $event)" />
          </td>

          <!-- Key (primary / play key) -->
          <td v-if="songStore.columnVisibility.key" class="px-4 py-3 text-gray-300">
            {{ getPrimaryKey(song) || '&mdash;' }}
          </td>

          <!-- CCLI -->
          <td v-if="songStore.columnVisibility.ccli" class="px-4 py-3 text-gray-300">
            <a
              v-if="song.ccliNumber"
              :href="`https://songselect.ccli.com/songs/${song.ccliNumber}`"
              target="_blank"
              rel="noopener"
              class="text-indigo-400 hover:text-indigo-300 hover:underline"
              @click.stop
            >{{ song.ccliNumber }}</a>
            <span v-else>&mdash;</span>
          </td>

          <!-- Last Used -->
          <td v-if="songStore.columnVisibility.lastUsed" class="px-4 py-3 text-gray-400">
            {{ formatDate(song.lastUsedAt) }}
          </td>

          <!-- Tags: display-only user-tag pills; click a pill to filter. Add/remove
               lives exclusively on the edit screen (SongSlideOver), D-01/D-12. -->
          <td v-if="songStore.columnVisibility.tags" class="px-4 py-3">
            <div class="flex flex-wrap gap-1 items-center">
              <span
                v-for="t in (song.tags ?? [])"
                :key="'us-' + t"
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-pink-900/50 text-pink-300 border-pink-800 cursor-pointer hover:bg-pink-800/60"
                title="Filter by this tag"
                @click.stop="filterByPill('tag', t)"
              >
                {{ t }}
              </span>
              <span v-if="!(song.tags ?? []).length" class="text-gray-600">&mdash;</span>
            </div>
          </td>

          <!-- Themes: display-only pills; click a pill to filter. Add/remove lives
               exclusively on the edit screen (SongSlideOver). Rendered after Tags. -->
          <td v-if="songStore.columnVisibility.themes" class="px-4 py-3">
            <div class="flex flex-wrap gap-1 items-center">
              <span
                v-for="t in (song.themes ?? [])"
                :key="'th-' + t"
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-teal-900/50 text-teal-300 border-teal-800 cursor-pointer hover:bg-teal-800/60"
                title="Filter by this theme"
                @click.stop="filterByPill('theme', t)"
              >
                {{ t }}
              </span>
              <span v-if="!(song.themes ?? []).length" class="text-gray-600">&mdash;</span>
            </div>
          </td>

          <!-- Trailing chevron (opens edit drawer) -->
          <td class="px-4 py-3 text-right">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </td>
        </tr>
      </tbody>
    </table>
    </div>
    <div ref="sentinelRef" class="h-1" />
    <div v-if="!loading && songs.length > 0" class="px-4 py-2 text-xs text-gray-500 text-center border-t border-gray-800">
      Showing {{ visibleSongs.length }} of {{ sortedSongs.length }} songs
      <span v-if="hasMore"> &mdash; scroll for more</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { Song } from '@/types/song'
import type { Timestamp } from 'firebase/firestore'
import SongBadge from '@/components/SongBadge.vue'
import VwExplainer from '@/components/VwExplainer.vue'
import { getPrimaryKey } from '@/utils/songSearch'
import { useSongStore } from '@/stores/songs'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  songs: Song[]
  loading: boolean
}>()

const emit = defineEmits<{
  select: [song: Song]
  add: []
  'update:selectedIds': [ids: Set<string>]
}>()

const songStore = useSongStore()
const authStore = useAuthStore()

// ── Column-visibility cog ──────────────────────────────────────────────────────

const cogOpen = ref(false)
// Title is intentionally excluded — always visible, not a user preference.
const toggleableColumns = [
  { key: 'category', label: 'Category' },
  { key: 'key', label: 'Key' },
  { key: 'ccli', label: 'CCLI' },
  { key: 'lastUsed', label: 'Last Used' },
  { key: 'tags', label: 'Tags' },
  { key: 'themes', label: 'Themes' },
] as const

// ── Sort ───────────────────────────────────────────────────────────────────────

// Category, CCLI, Tags, and Themes are intentionally NOT sortable (checkpoint
// feedback): Category/Tags/Themes are filter-by-click instead (see filterByPill),
// and CCLI has no sort affordance.
type SortField = 'title' | 'key' | 'lastUsed'
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

function sortKey(song: Song): string | number {
  switch (sortField.value) {
    case 'key':      return getPrimaryKey(song).toLowerCase()
    case 'lastUsed': return song.lastUsedAt?.toMillis() ?? 0
    default:         return song.title.toLowerCase()
  }
}

// Click-to-filter (checkpoint feedback): clicking a Category badge, Tag, or Theme
// pill APPENDS a field-scoped term to the shared search bar, reusing the existing
// songMatchesQuery multi-term AND behavior (no parallel filter path) so successive
// clicks keep narrowing the list. Free text the user already typed is preserved;
// re-clicking the same pill is a no-op (de-duped). searchQuery is bound to
// SongFilters' input via SongsView's v-model.
function filterByPill(field: 'type' | 'tag' | 'theme', value: string | number) {
  const term = `${field}:${value}`
  const current = songStore.searchQuery.trim()
  if (!current) {
    songStore.searchQuery = term
    return
  }
  // De-dupe: skip if the exact term is already present as a whole field-scoped
  // span. A whitespace-token check breaks for multi-word values (e.g.
  // "tag:Christmas Eve"), since splitting on whitespace would fragment the term
  // itself into separate tokens that never match.
  const alreadyPresent =
    current === term ||
    current.startsWith(term + ' ') ||
    current.includes(' ' + term + ' ') ||
    current.endsWith(' ' + term)
  if (alreadyPresent) return
  songStore.searchQuery = `${current} ${term}`
}

const sortedSongs = computed(() => {
  return [...props.songs].sort((a, b) => {
    const aVal = sortKey(a)
    const bVal = sortKey(b)
    let cmp: number
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      cmp = aVal - bVal
    } else {
      cmp = String(aVal).localeCompare(String(bVal))
    }
    return sortDir.value === 'asc' ? cmp : -cmp
  })
})

// ── Selection (bulk multi-select) ─────────────────────────────────────────────

const selectedIds = ref<Set<string>>(new Set())

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedIds.value = next
  emit('update:selectedIds', next)
}

function toggleSelectAll() {
  if (selectedIds.value.size === sortedSongs.value.length) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(sortedSongs.value.map((s) => s.id))
  }
  emit('update:selectedIds', selectedIds.value)
}

function clearSelection() {
  selectedIds.value = new Set()
  emit('update:selectedIds', selectedIds.value)
}

defineExpose({ selectedIds, clearSelection })

// Note: Tags/Themes on this listing are display-only + click-to-filter
// (filterByPill above). All add/edit/remove of tags and themes happens on the
// edit screen (SongSlideOver.vue) — including the removedThemes tracking
// (D-14) recorded there on save, which lets a removed theme survive PC
// re-import without resurfacing.

// ── Progressive rendering ──────────────────────────────────────────────────────

const BATCH_SIZE = 50
const visibleCount = ref(BATCH_SIZE)

const visibleSongs = computed(() => sortedSongs.value.slice(0, visibleCount.value))

const hasMore = computed(() => visibleCount.value < sortedSongs.value.length)

function loadMore() {
  visibleCount.value = Math.min(visibleCount.value + BATCH_SIZE, sortedSongs.value.length)
}

// Reset visible count when sort changes (new sort = fresh ordering)
watch(sortField, () => {
  visibleCount.value = BATCH_SIZE
})
watch(sortDir, () => {
  visibleCount.value = BATCH_SIZE
})
// Reset visible count when the (filtered) song list changes so the slice
// always starts from the top of the new list — fixes "only a–g show" bug.
watch(() => props.songs, () => {
  visibleCount.value = BATCH_SIZE
})

// IntersectionObserver sentinel for scroll-based load-more
const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && hasMore.value) {
        loadMore()
      }
    },
    { rootMargin: '200px' }
  )
  if (sentinelRef.value) {
    observer.observe(sentinelRef.value)
  }
})

onUnmounted(() => {
  observer?.disconnect()
})

function formatDate(ts: Timestamp | null): string {
  if (!ts) return '—'
  try {
    const date = ts.toDate ? ts.toDate() : new Date((ts as unknown as { seconds: number }).seconds * 1000)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}
</script>

<!-- SortArrow sub-component (inline via defineComponent) -->
<script lang="ts">
import { defineComponent, h } from 'vue'

export const SortArrow = defineComponent({
  props: {
    active: { type: Boolean, default: false },
    dir: { type: String as () => 'asc' | 'desc', default: 'asc' },
  },
  setup(props) {
    return () => {
      const color = props.active ? 'text-indigo-400' : 'text-gray-600'
      let path: string
      if (props.active && props.dir === 'asc') {
        path = 'M5 15l7-7 7 7'
      } else if (props.active && props.dir === 'desc') {
        path = 'M19 9l-7 7-7-7'
      } else {
        path = 'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4'
      }
      return h(
        'svg',
        {
          xmlns: 'http://www.w3.org/2000/svg',
          class: `h-3.5 w-3.5 ${color}`,
          fill: 'none',
          viewBox: '0 0 24 24',
          stroke: 'currentColor',
          'stroke-width': '2',
        },
        [
          h('path', {
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            d: path,
          }),
        ],
      )
    }
  },
})
</script>
