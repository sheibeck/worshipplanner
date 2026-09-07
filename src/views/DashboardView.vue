<template>
  <AppShell>
    <div class="px-6 py-8">
      <!-- Page header -->
      <div class="mb-6 pb-4 border-b border-gray-800">
        <h1 class="text-xl font-semibold text-gray-100">Dashboard</h1>
        <p class="text-sm text-gray-400 mt-1">
          Welcome{{ displayName ? `, ${displayName}` : '' }}
        </p>
      </div>

      <!-- Getting started checklist: editor only, hides when complete -->
      <GettingStarted v-if="authStore.isEditor" class="mb-6" />

      <!-- Needs-your-attention feed, full width; Song library below -->
      <div class="space-y-6">

      <!-- R419: all-caught-up empty/first-run state, replaces the feed -->
      <div v-if="upcomingServices.length === 0" class="rounded-lg border border-dashed border-gray-700 p-6 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <h2 class="text-base font-semibold text-gray-100 mt-3">You're all caught up</h2>
        <p class="text-sm text-gray-400 mt-1">No upcoming services need your attention right now.</p>
        <router-link to="/services" class="inline-block mt-4 text-sm text-indigo-400 hover:text-indigo-300">
          Schedule a service
        </router-link>
      </div>

      <!-- Needs-attention feed (R415) -->
      <section v-else>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-500">Next service</h2>
          <span class="text-xs text-gray-600">
            {{ upcomingServices.length }} upcoming
          </span>
        </div>

        <router-link
          v-if="nextService"
          :to="`/services/${nextService.id}`"
          class="block rounded-lg border border-gray-800 bg-gray-900 p-5 hover:bg-gray-800/50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-base font-semibold text-gray-100 truncate">{{ nextService.name }}</p>
              <p class="text-sm text-gray-400 mt-0.5">{{ formatServiceDate(nextService.date) }}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div class="mt-4 flex items-center gap-2 flex-wrap">
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
              :class="readinessDisplay(nextService).pillClass"
            >
              {{ readinessDisplay(nextService).label }}
            </span>
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
              :class="hasScripture(nextService)
                ? 'bg-green-900/40 border-green-700/50 text-green-300'
                : 'bg-gray-800 border-gray-700 text-gray-400'"
            >
              {{ hasScripture(nextService) ? 'Scripture set' : 'No scripture' }}
            </span>
          </div>
        </router-link>

        <!-- Following services -->
        <div
          v-if="upcomingAfterNext.length > 0"
          class="mt-3 divide-y divide-gray-800 border border-gray-800 rounded-lg overflow-hidden"
        >
          <router-link
            v-for="s in upcomingAfterNext"
            :key="s.id"
            :to="`/services/${s.id}`"
            class="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-gray-800/40 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
          >
            <div class="min-w-0">
              <span class="text-sm text-gray-200">{{ s.name }}</span>
              <span class="text-xs text-gray-500 ml-2">{{ formatServiceDate(s.date) }}</span>
            </div>
            <span class="flex items-center gap-1.5 shrink-0">
              <span class="h-2 w-2 rounded-full" :class="readinessDisplay(s).dotClass"></span>
              <span class="text-xs" :class="readinessDisplay(s).textClass">{{ readinessDisplay(s).label }}</span>
            </span>
          </router-link>
        </div>
      </section>

      <!-- Song library health (editor only) — full width -->
      <section v-if="authStore.isEditor">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Song library</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <router-link
            v-for="tile in songTiles"
            :key="tile.label"
            :to="tile.to"
            class="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 hover:bg-gray-800/50 transition-colors"
          >
            <p class="text-2xl font-bold" :class="tile.warn && tile.value > 0 ? 'text-amber-400' : 'text-gray-100'">
              {{ tile.value }}
            </p>
            <p class="text-xs text-gray-500">{{ tile.label }}</p>
          </router-link>
        </div>
      </section>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSongStore } from '@/stores/songs'
import { useServiceStore } from '@/stores/services'
import { useRosterStore } from '@/stores/roster'
import type { Service } from '@/types/service'
import AppShell from '@/components/AppShell.vue'
import GettingStarted from '@/components/GettingStarted.vue'
import { dashboardReadinessOf, serviceReadinessSongs, type DashboardReadinessState } from '@/utils/dashboardReadiness'

const authStore = useAuthStore()
const songStore = useSongStore()
const serviceStore = useServiceStore()
const rosterStore = useRosterStore()

const displayName = computed(() => {
  return authStore.user?.displayName || authStore.user?.email?.split('@')[0] || ''
})

const todayStr = computed(() => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
})

// ── Services (next + upcoming) ────────────────────────────────────────────────
const upcomingServices = computed(() =>
  serviceStore.services
    .filter((s) => s.date >= todayStr.value)
    .sort((a, b) => a.date.localeCompare(b.date)),
)

const nextService = computed(() => upcomingServices.value[0] ?? null)
const upcomingAfterNext = computed(() => upcomingServices.value.slice(1, 6))

function serviceSongStats(service: Service): { filled: number; total: number } {
  const songSlots = service.slots.filter((s) => s.kind === 'SONG')
  const filled = songSlots.filter((s) => s.kind === 'SONG' && s.songId).length
  return { filled, total: songSlots.length }
}

function hasScripture(service: Service): boolean {
  const scriptureFilled = service.slots.some((s) => s.kind === 'SCRIPTURE' && s.book)
  return scriptureFilled || service.sermonPassage != null
}

// ── Readiness signal (R416) — combines song-assignment stats + the v2.12
// media readiness (readinessOf, via dashboardReadinessOf) + lock state into
// one worst-of display per service. Colors/copy per 135-UI-SPEC.md Widget 1.
const READINESS_COLOR_CLASSES: Record<
  DashboardReadinessState,
  { dot: string; text: string; pill: string }
> = {
  'songs-needed': {
    dot: 'bg-amber-500',
    text: 'text-amber-400',
    pill: 'bg-amber-900/40 border-amber-700/50 text-amber-300',
  },
  'media-missing': {
    dot: 'bg-amber-500',
    text: 'text-amber-400',
    pill: 'bg-amber-900/40 border-amber-700/50 text-amber-300',
  },
  draft: {
    dot: 'bg-gray-500',
    text: 'text-gray-400',
    pill: 'bg-gray-800 border-gray-700 text-gray-400',
  },
  ready: {
    dot: 'bg-green-500',
    text: 'text-green-400',
    pill: 'bg-green-900/40 border-green-700/50 text-green-300',
  },
}

const songsById = computed(() => new Map(songStore.songs.map((s) => [s.id, s])))

function readinessDisplay(service: Service) {
  const readinessSongs = serviceReadinessSongs(service, songsById.value)
  const readiness = dashboardReadinessOf(serviceSongStats(service), readinessSongs, service.status)

  let label: string
  if (readiness.state === 'songs-needed') {
    label = `${readiness.songsNeeded} song${readiness.songsNeeded === 1 ? '' : 's'} still needed`
  } else if (readiness.state === 'media-missing') {
    label =
      readiness.missingMediaCount < readinessSongs.length
        ? `${readiness.missingMediaCount} song${readiness.missingMediaCount === 1 ? '' : 's'} missing media`
        : 'Songs missing media'
  } else if (readiness.state === 'draft') {
    label = 'Draft'
  } else {
    label = 'Ready'
  }

  const colors = READINESS_COLOR_CLASSES[readiness.state]
  return { ...readiness, label, dotClass: colors.dot, textClass: colors.text, pillClass: colors.pill }
}

function formatServiceDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// ── Song library health ───────────────────────────────────────────────────────
const activeSongs = computed(() => songStore.visibleSongs)

const uncategorizedCount = computed(
  () => activeSongs.value.filter((s) => s.vwTypes.length === 0).length,
)

// Coerce with String() before trimming — imported data can carry a numeric
// ccliNumber / arrangement key, which would blow up a bare .trim() call.
const missingKeyCount = computed(
  () =>
    activeSongs.value.filter(
      (s) =>
        s.arrangements.length === 0 ||
        s.arrangements.every((a) => String(a.key ?? '').trim() === ''),
    ).length,
)

const missingCcliCount = computed(
  () => activeSongs.value.filter((s) => String(s.ccliNumber ?? '').trim() === '').length,
)

// Stale = last scheduled more than ~6 months ago. Never-used songs (lastUsedAt null)
// are excluded — a brand-new song shouldn't read as stale.
const staleCount = computed(() => {
  const cutoffMs = Date.now() - 1000 * 60 * 60 * 24 * 182
  return activeSongs.value.filter(
    (s) =>
      s.lastUsedAt &&
      typeof s.lastUsedAt.toMillis === 'function' &&
      s.lastUsedAt.toMillis() < cutoffMs,
  ).length
})

const songTiles = computed(() => [
  { label: 'Songs', value: activeSongs.value.length, to: '/songs', warn: false },
  // Uncategorized counts songs with no VW category — hide it entirely when VW
  // mode is off, matching how Category is gated elsewhere in this phase
  // (SongTable.vue / SongFilters.vue on authStore.vwModeEnabled).
  ...(authStore.vwModeEnabled
    ? [{ label: 'Uncategorized', value: uncategorizedCount.value, to: '/songs', warn: true }]
    : []),
  { label: 'Missing key', value: missingKeyCount.value, to: '/songs', warn: true },
  { label: 'Missing CCLI', value: missingCcliCount.value, to: '/songs', warn: true },
  { label: 'Stale (6+ mo)', value: staleCount.value, to: '/songs', warn: true },
])

// See ADR-0066 (docs/adr/0066-260901-lua-the-sidebar-s-in-place-church-switcher-appsidebar.md)
watch(
  () => authStore.orgId,
  (orgId) => {
    songStore.unsubscribeAll()
    serviceStore.unsubscribeAll()
    rosterStore.unsubscribeAll()
    if (orgId) {
      songStore.subscribe(orgId)
      serviceStore.subscribe(orgId)
      rosterStore.subscribe(orgId)
    }
  },
  { immediate: true },
)
</script>
