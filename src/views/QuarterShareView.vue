<template>
  <div class="min-h-screen bg-white text-gray-900 font-sans">
    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center min-h-screen">
      <p class="text-gray-500 text-sm">Loading...</p>
    </div>

    <!-- Not found state -->
    <div v-else-if="notFound" class="flex items-center justify-center min-h-screen px-4">
      <div class="text-center">
        <p class="text-gray-700 text-base mb-2">This shared schedule is no longer available or the link is invalid.</p>
        <p class="text-gray-400 text-sm">Please ask your worship leader to share the schedule again.</p>
      </div>
    </div>

    <!-- Quarter content -->
    <div v-else-if="quarterSnapshot" class="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <!-- Header with view + filter controls -->
      <div class="flex flex-col gap-4 mb-6 pb-4 border-b border-gray-200 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">{{ quarterSnapshot.label }}</h1>
          <p class="text-sm text-gray-600 mt-1">Volunteer Schedule</p>
        </div>

        <!-- Toolbar: view toggle + name filter -->
        <div class="flex flex-wrap items-center gap-3">
        <div
          class="inline-flex rounded-md border border-gray-200 overflow-hidden text-sm"
          role="group"
          aria-label="Schedule view"
        >
          <button
            type="button"
            class="px-3 py-1.5"
            :class="viewMode === 'matrix' ? 'bg-gray-900 text-white font-semibold' : 'bg-white text-gray-600'"
            @click="viewMode = 'matrix'"
          >
            Matrix
          </button>
          <button
            type="button"
            class="px-3 py-1.5 border-l border-gray-200"
            :class="viewMode === 'list' ? 'bg-gray-900 text-white font-semibold' : 'bg-white text-gray-600'"
            @click="viewMode = 'list'"
          >
            List
          </button>
        </div>

        <div class="relative">
          <input
            v-model="nameQuery"
            type="text"
            placeholder="Filter by name…"
            class="w-48 border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400"
            @focus="nameMenuOpen = true"
            @blur="onNameBlur"
          />
          <div
            v-if="nameMenuOpen"
            class="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-auto"
          >
            <div
              v-for="candidate in filteredCandidateNames"
              :key="candidate"
              data-role="name-candidate"
              class="px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 cursor-pointer"
              @mousedown.prevent="selectName(candidate)"
            >
              {{ candidate }}
            </div>
            <div v-if="filteredCandidateNames.length === 0" class="px-3 py-2 text-sm text-gray-400">
              No matching names
            </div>
          </div>
        </div>

        <button
          v-if="nameFilter"
          type="button"
          class="text-sm text-gray-600 underline"
          @click="clearNameFilter"
        >
          Show everyone
        </button>
        </div>
      </div>

      <!-- Matrix view -->
      <QuarterShareMatrix
        v-if="viewMode === 'matrix'"
        :roles="sortedRoles"
        :dates="filteredDates"
        :people-for="peopleFor"
        :total-date-count="quarterSnapshot.serviceDates.length"
        :active-name-filter="nameFilter"
      />

      <!-- List view -->
      <div v-else>
        <div
          v-for="date in filteredDates"
          :key="date"
          class="py-2.5 border-b border-gray-100"
        >
          <p class="text-base font-medium text-gray-900 mb-1">{{ formatDateLabel(date) }}</p>
          <div v-for="role in sortedRoles" :key="role.id" class="py-0.5">
            <p class="text-xs text-gray-500 uppercase tracking-wider">{{ role.name }}</p>
            <p v-if="peopleFor(date, role.id).length > 0" class="text-sm text-gray-800">
              {{ peopleFor(date, role.id).join(', ') }}
            </p>
            <p v-else class="text-gray-400 italic text-sm">[not assigned]</p>
          </div>
        </div>
        <p v-if="quarterSnapshot.serviceDates.length === 0" class="text-gray-400 italic text-sm py-3">
          No service dates
        </p>
      </div>

      <!-- Footer -->
      <div class="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
        Shared from WorshipPlanner
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import QuarterShareMatrix from '@/components/QuarterShareMatrix.vue'
import { useIsMobile } from '@/components/useIsMobile'

// Read-only public shape written by quarters.ts::finalizeAndShare (Plan 06/10).
// Person names are pre-resolved into the calendar — no roster/auth access needed here.
interface QuarterSnapshotRole {
  id: string
  name: string
  group: string
}

interface QuarterSnapshot {
  label: string
  serviceDates: string[]
  roles: QuarterSnapshotRole[]
  calendar: Record<string, Record<string, string[]>>
}

// ── State ───────────────────────────────────────────────────────────────────

const route = useRoute()
const router = useRouter()
const { isDesktop } = useIsMobile()

const isLoading = ref(true)
const notFound = ref(false)
const quarterSnapshot = ref<QuarterSnapshot | null>(null)

type ViewMode = 'matrix' | 'list'

const initialView = (route.query.view as ViewMode | undefined) ?? (isDesktop.value ? 'matrix' : 'list')
const viewMode = ref<ViewMode>(initialView)

// Name filter (D-15/D-16) — nameFilter is the exact, selected snapshot name (or null);
// nameQuery is the raw typeahead input text; hydrated from route.query.name on mount.
const nameFilter = ref<string | null>((route.query.name as string | undefined) ?? null)
const nameQuery = ref(nameFilter.value ?? '')
const nameMenuOpen = ref(false)

// ── Computed ────────────────────────────────────────────────────────────────

// Roles grouped Band/Tech/Other, mirroring QuarterGrid/RosterPrintLayout ordering.
const GROUP_ORDER = ['band', 'tech', 'other']

const sortedRoles = computed<QuarterSnapshotRole[]>(() => {
  if (!quarterSnapshot.value) return []
  return [...quarterSnapshot.value.roles].sort(
    (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group),
  )
})

function peopleFor(date: string, roleId: string): string[] {
  return quarterSnapshot.value?.calendar[date]?.[roleId] ?? []
}

// Deduped person names collected from the snapshot's own calendar — never rosterStore (D-24).
const candidateNames = computed<string[]>(() => {
  if (!quarterSnapshot.value) return []
  const names = new Set<string>()
  for (const dateEntry of Object.values(quarterSnapshot.value.calendar)) {
    for (const people of Object.values(dateEntry)) {
      for (const name of people) names.add(name)
    }
  }
  return [...names].sort()
})

const filteredCandidateNames = computed<string[]>(() => {
  const q = nameQuery.value.trim().toLowerCase()
  return candidateNames.value.filter((name) => q === '' || name.toLowerCase().includes(q))
})

// Dates where the selected name serves in at least one role; unfiltered when no name is set.
const filteredDates = computed<string[]>(() => {
  if (!quarterSnapshot.value) return []
  if (!nameFilter.value) return quarterSnapshot.value.serviceDates
  return quarterSnapshot.value.serviceDates.filter((date) =>
    sortedRoles.value.some((role) => peopleFor(date, role.id).includes(nameFilter.value!)),
  )
})

function selectName(name: string) {
  nameFilter.value = name
  nameQuery.value = name
  nameMenuOpen.value = false
}

function clearNameFilter() {
  nameFilter.value = null
  nameQuery.value = ''
}

function onNameBlur() {
  window.setTimeout(() => {
    nameMenuOpen.value = false
  }, 150)
}

function formatDateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year!, month! - 1, day!).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── URL persistence (D-16) ─────────────────────────────────────────────────
// Mirrors SongsView.vue's router.replace({query}) convention — spreads existing
// route.query and never pushes a history entry for view/filter changes.
watch([viewMode, nameFilter], ([view, name]) => {
  router.replace({ query: { ...route.query, view, name: name || undefined } })
})

// ── Mount ───────────────────────────────────────────────────────────────────

onMounted(async () => {
  const token = route.params.token as string | undefined
  try {
    const snap = token
      ? await getDoc(doc(db, 'shareTokens', token))
      : await getDoc(
          doc(
            db,
            'quarterShares',
            `${route.params.slug as string}__q${route.params.num as string}-${route.params.year as string}`,
          ),
        )
    if (!snap.exists()) {
      notFound.value = true
    } else {
      quarterSnapshot.value = snap.data().quarterSnapshot
    }
  } catch {
    notFound.value = true
  } finally {
    isLoading.value = false
  }
})
</script>
