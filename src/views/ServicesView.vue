<template>
  <AppShell>
    <div class="px-6 py-8">

      <!-- Tab bar -->
      <div class="flex items-center gap-1 mb-6 border-b border-gray-800 pb-0">
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
          :class="activeTab === 'services'
            ? 'text-indigo-300 border-indigo-500 bg-gray-900'
            : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
          @click="activeTab = 'services'"
        >
          Services
        </button>
        <button
          v-if="authStore.isEditor"
          type="button"
          class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
          :class="activeTab === 'rotation'
            ? 'text-indigo-300 border-indigo-500 bg-gray-900'
            : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
          @click="activeTab = 'rotation'"
        >
          Song Rotation
        </button>
        <button
          v-if="authStore.isEditor"
          type="button"
          class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
          :class="activeTab === 'scripture-rotation'
            ? 'text-indigo-300 border-indigo-500 bg-gray-900'
            : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
          @click="activeTab = 'scripture-rotation'"
        >
          Scripture Rotation
        </button>
        <div class="flex-1" />
        <!-- Default service template cog: editor only (R113 — relocated from Settings) -->
        <button
          v-if="authStore.isEditor"
          type="button"
          class="inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700 hover:text-white transition-colors mb-1 mr-2"
          aria-label="Edit default service template"
          data-testid="open-template-editor"
          @click="templateEditorOpen = true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Service Template
        </button>
        <!-- New Service button: editor only -->
        <button
          v-if="authStore.isEditor"
          type="button"
          class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors mb-1"
          @click="dialogOpen = true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Service
        </button>
      </div>

      <!-- Services Tab -->
      <template v-if="activeTab === 'services'">

        <!-- Loading -->
        <div v-if="serviceStore.isLoading" class="text-sm text-gray-400 py-8 text-center">
          Loading services...
        </div>

        <template v-else>
          <!-- Upcoming section -->
          <section class="mb-8">
            <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
              Upcoming
            </h2>

            <div v-if="upcomingServices.length === 0" class="rounded-lg border border-dashed border-gray-700 py-10 text-center">
              <p class="text-sm text-gray-400 mb-3">No upcoming services. Create your first service to get started.</p>
              <button
                v-if="authStore.isEditor"
                type="button"
                class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
                @click="dialogOpen = true"
              >
                New Service
              </button>
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <ServiceCard
                v-for="service in upcomingServices"
                :key="service.id"
                :service="service"
              />
            </div>
          </section>

          <!-- Past services section -->
          <section v-if="pastServices.length > 0">
            <button
              type="button"
              class="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors mb-3"
              @click="showPast = !showPast"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-3.5 w-3.5 transition-transform"
                :class="showPast ? 'rotate-90' : ''"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Past Services
            </button>

            <template v-if="showPast">
              <!-- Month/Year picker -->
              <div class="flex items-center gap-2 mb-3">
                <select
                  :value="activeMonth"
                  class="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-md px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500"
                  @change="onMonthChange"
                >
                  <option
                    v-for="entry in monthsForActiveYear"
                    :key="entry.month"
                    :value="entry.month"
                  >
                    {{ entry.monthName }}
                  </option>
                </select>
                <select
                  :value="activeYear"
                  class="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-md px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500"
                  @change="onYearChange"
                >
                  <option
                    v-for="year in availableYears"
                    :key="year"
                    :value="year"
                  >
                    {{ year }}
                  </option>
                </select>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <ServiceCard
                  v-for="service in displayedPastServices"
                  :key="service.id"
                  :service="service"
                />
              </div>
            </template>
          </section>
        </template>
      </template>

      <!-- Rotation Tab -->
      <template v-else-if="activeTab === 'rotation'">
        <RotationTable :services="rotationServices" />
      </template>

      <!-- Scripture Rotation Tab -->
      <template v-else-if="activeTab === 'scripture-rotation'">
        <ScriptureRotationTable :services="rotationServices" />
      </template>
    </div>

    <!-- New Service Dialog: editor only -->
    <NewServiceDialog
      v-if="authStore.isEditor"
      :open="dialogOpen"
      :taken-dates="takenServiceDates"
      @close="dialogOpen = false"
      @create="onCreateService"
    />

    <!-- Default service template editor (R113 — relocated from Settings).
         Teleports to <body>, so mounting here inside AppShell is fine. -->
    <ServiceTemplateEditor :is-open="templateEditorOpen" @close="templateEditorOpen = false" />
  </AppShell>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useServiceStore } from '@/stores/services'
import { useTeamsStore } from '@/stores/teams'
import AppShell from '@/components/AppShell.vue'
import ServiceCard from '@/components/ServiceCard.vue'
import NewServiceDialog from '@/components/NewServiceDialog.vue'
import RotationTable from '@/components/RotationTable.vue'
import ScriptureRotationTable from '@/components/ScriptureRotationTable.vue'
import ServiceTemplateEditor from '@/components/settings/ServiceTemplateEditor.vue'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const router = useRouter()
const authStore = useAuthStore()
const serviceStore = useServiceStore()
const teamsStore = useTeamsStore()

const activeTab = ref<'services' | 'rotation' | 'scripture-rotation'>('services')
const dialogOpen = ref(false)
const showPast = ref(false)
// R113: default service template editor (relocated from SettingsView)
const templateEditorOpen = ref(false)

// User-selected month (0-11) and year — null means "use smart default"
const selectedMonth = ref<number | null>(null)
const selectedYear = ref<number | null>(null)

// Compute today's ISO date string for comparison
const todayStr = computed(() => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
})

// Upcoming: date >= today, sorted ascending
const upcomingServices = computed(() =>
  serviceStore.services
    .filter((s) => s.date >= todayStr.value)
    .sort((a, b) => a.date.localeCompare(b.date)),
)

// Past: date < today, sorted descending (most recent first)
const pastServices = computed(() =>
  serviceStore.services
    .filter((s) => s.date < todayStr.value)
    .sort((a, b) => b.date.localeCompare(a.date)),
)

// R038 / D-14: dates that already have a plan, fed to NewServiceDialog so its default
// date skips them. This view already subscribes to the service list, so no new I/O.
const takenServiceDates = computed(() => serviceStore.services.map((s) => s.date))

// Rotation window: services within 4 weeks past and 4 weeks ahead of today
const rotationServices = computed(() => {
  const today = new Date()
  const windowStart = new Date(today)
  windowStart.setDate(today.getDate() - 28)
  const windowEnd = new Date(today)
  windowEnd.setDate(today.getDate() + 28)
  const fmt = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const start = fmt(windowStart)
  const end = fmt(windowEnd)
  return serviceStore.services.filter((s) => s.date >= start && s.date <= end)
})

// Unique month/year pairs from pastServices, sorted descending (most recent first)
const availableMonths = computed<{ month: number; year: number; monthName: string }[]>(() => {
  const seen = new Set<string>()
  const result: { month: number; year: number; monthName: string }[] = []
  for (const s of pastServices.value) {
    const d = new Date(s.date + 'T00:00:00')
    const month = d.getMonth()
    const year = d.getFullYear()
    const key = `${year}-${month}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push({ month, year, monthName: MONTH_NAMES[month] ?? '' })
    }
  }
  // Already sorted descending because pastServices is sorted descending
  return result
})

// Unique years from pastServices, sorted descending
const availableYears = computed<number[]>(() => {
  const years = new Set<number>()
  for (const entry of availableMonths.value) {
    years.add(entry.year)
  }
  return Array.from(years).sort((a, b) => b - a)
})

// Smart default: current month if it has past services, otherwise most recent month
const smartDefault = computed<{ month: number; year: number } | null>(() => {
  if (availableMonths.value.length === 0) return null
  const now = new Date()
  const curMonth = now.getMonth()
  const curYear = now.getFullYear()
  const hasCurrentMonth = availableMonths.value.some(
    (e) => e.month === curMonth && e.year === curYear,
  )
  if (hasCurrentMonth) return { month: curMonth, year: curYear }
  return { month: availableMonths.value[0]!.month, year: availableMonths.value[0]!.year }
})

// Active year: user selection or smart default
const activeYear = computed<number | null>(() => {
  if (selectedYear.value !== null) return selectedYear.value
  return smartDefault.value?.year ?? null
})

// Months available for the active year
const monthsForActiveYear = computed<{ month: number; year: number; monthName: string }[]>(() => {
  if (activeYear.value === null) return []
  return availableMonths.value.filter((e) => e.year === activeYear.value)
})

// Active month: user selection (if valid for active year) or smart default month for active year
const activeMonth = computed<number | null>(() => {
  if (activeYear.value === null) return null
  if (selectedMonth.value !== null) {
    // Validate the selected month exists in the active year
    const valid = monthsForActiveYear.value.some((e) => e.month === selectedMonth.value)
    if (valid) return selectedMonth.value
  }
  // Fall back: use smart default month if it matches this year, else first available month in year
  if (
    smartDefault.value !== null &&
    smartDefault.value.year === activeYear.value
  ) {
    return smartDefault.value.month
  }
  return monthsForActiveYear.value[0]?.month ?? null
})

// Services displayed in the past section — ALL services from active month/year
const displayedPastServices = computed(() => {
  if (activeMonth.value === null || activeYear.value === null) return []
  return pastServices.value.filter((s) => {
    const d = new Date(s.date + 'T00:00:00')
    return d.getMonth() === activeMonth.value && d.getFullYear() === activeYear.value
  })
})

function onMonthChange(event: Event) {
  selectedMonth.value = Number((event.target as HTMLSelectElement).value)
}

function onYearChange(event: Event) {
  const newYear = Number((event.target as HTMLSelectElement).value)
  selectedYear.value = newYear
  // Reset month selection — activeMonth computed will pick the best default for the new year
  selectedMonth.value = null
}

// Subscribe to Firestore services collection for the given (live) orgId
function initStore(orgId: string) {
  serviceStore.subscribe(orgId)
  // Phase 79 (R229/R241): this view mounts NewServiceDialog, whose team
  // checkbox row now reads the shared teams store — subscribe (and,
  // idempotently, seed) it here so that row is populated. Editor-guarded
  // because seeding writes to Firestore and reads require isOrgEditor.
  if (authStore.isEditor && !teamsStore.orgId) {
    teamsStore.subscribe(orgId)
    const stopTeamsSeedWatch = watch(
      () => teamsStore.teams,
      () => {
        teamsStore.seedDefaultTeamsIfEmpty()
        stopTeamsSeedWatch()
      },
    )
  }
}

// See ADR-0066 (docs/adr/0066-260901-lua-the-sidebar-s-in-place-church-switcher-appsidebar.md)
watch(
  () => authStore.orgId,
  (orgId) => {
    serviceStore.unsubscribeAll()
    if (orgId) initStore(orgId)
  },
  { immediate: true },
)

onUnmounted(() => {
  serviceStore.unsubscribeAll()
})

async function onCreateService(data: { date: string; name: string; teams: string[] }) {
  dialogOpen.value = false
  const id = await serviceStore.createService(data)
  await router.push(`/services/${id}`)
}
</script>
