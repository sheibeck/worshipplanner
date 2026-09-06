<template>
  <AppShell>
    <div class="px-4 sm:px-6 py-8 max-w-[1060px] mx-auto">
      <!-- Loading (§10) -->
      <div v-if="mySchedule.isLoading" class="flex flex-col items-center gap-3 py-16 text-center">
        <svg class="h-6 w-6 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        <p class="text-sm text-gray-400">Loading your schedule&hellip;</p>
      </div>

      <!-- Error (Copywriting Contract) -->
      <div v-else-if="mySchedule.error" class="text-center py-16 space-y-3">
        <p class="text-sm text-red-400">Couldn't load your schedule. Check your connection and try again.</p>
        <button type="button" data-testid="retry-load" class="text-sm text-indigo-400 hover:text-indigo-300" @click="retry">
          Retry
        </button>
      </div>

      <!-- Empty state (§8) -->
      <div
        v-else-if="mySchedule.docs.length === 0"
        data-testid="empty-state"
        class="rounded-lg border border-dashed border-gray-700 py-12 px-6 text-center max-w-md mx-auto mt-12"
      >
        <p class="text-sm font-medium text-gray-200 mb-2">You don't have any upcoming services.</p>
        <p class="text-sm text-gray-400">
          When a worship leader assigns you to a service, it'll show up here.
        </p>
      </div>

      <!-- Populated -->
      <template v-else>
        <div class="mb-8">
          <h1 class="text-2xl font-semibold text-white">{{ greeting }}</h1>
          <p v-if="summaryLine" class="text-sm text-gray-400 mt-1">{{ summaryLine }}</p>

          <!-- Church filter (R403/R404/R405, Phase 130) — a pure client-side
               filter over mySchedule.docs. Zero DOM footprint for 0/1-church
               volunteers (v-if, not v-show). Never touches authStore/selectOrg. -->
          <select
            v-if="mySchedule.churches.length > 1"
            :value="mySchedule.selectedChurch ?? ''"
            @change="onChurchChange(($event.target as HTMLSelectElement).value)"
            data-testid="church-filter"
            class="mt-3 rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All churches</option>
            <option v-for="c in sortedChurches" :key="c.orgId" :value="c.orgId">
              {{ c.orgName || 'Unnamed church' }}
            </option>
          </select>
        </div>

        <!-- Filtered-empty (Copywriting Contract): distinct from the whole-
             schedule empty state above, which stays keyed on docs.length. -->
        <div
          v-if="filteredEmpty"
          data-testid="filtered-empty"
          class="rounded-lg border border-dashed border-gray-700 py-12 px-6 text-center max-w-md mx-auto mt-4"
        >
          <p class="text-sm text-gray-400">No upcoming services for {{ selectedChurchLabel }}.</p>
        </div>

        <section v-else-if="groups.thisWeek.length" class="mb-6">
          <div class="flex items-center gap-3 mb-3">
            <span class="text-[11px] font-semibold uppercase tracking-widest text-gray-500 shrink-0">This week</span>
            <span class="flex-1 border-t border-gray-800"></span>
          </div>
          <div class="space-y-3">
            <ScheduleServiceCard
              v-for="doc in groups.thisWeek"
              :key="doc.serviceId"
              :service-id="doc.serviceId"
              :title="doc.title"
              :service-date="doc.serviceDate"
              :songs="doc.songs"
              :roles="rolesFor(doc)"
              :is-next-up="doc.serviceId === groups.nextUpId"
              :is-past="false"
            />
          </div>
        </section>

        <section v-if="groups.laterThisMonth.length" class="mb-6">
          <div class="flex items-center gap-3 mb-3">
            <span class="text-[11px] font-semibold uppercase tracking-widest text-gray-500 shrink-0">Later this month</span>
            <span class="flex-1 border-t border-gray-800"></span>
          </div>
          <div class="space-y-3">
            <ScheduleServiceCard
              v-for="doc in groups.laterThisMonth"
              :key="doc.serviceId"
              :service-id="doc.serviceId"
              :title="doc.title"
              :service-date="doc.serviceDate"
              :songs="doc.songs"
              :roles="rolesFor(doc)"
              :is-next-up="doc.serviceId === groups.nextUpId"
              :is-past="false"
            />
          </div>
        </section>

        <section v-if="groups.past.length">
          <button
            type="button"
            data-testid="toggle-past"
            class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors mb-3"
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
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Past services
          </button>

          <div v-if="showPast" class="space-y-3">
            <ScheduleServiceCard
              v-for="doc in groups.past"
              :key="doc.serviceId"
              :service-id="doc.serviceId"
              :title="doc.title"
              :service-date="doc.serviceDate"
              :songs="doc.songs"
              :roles="rolesFor(doc)"
              :is-next-up="false"
              :is-past="true"
            />
          </div>
        </section>
      </template>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useMyScheduleStore, type MyScheduleDoc } from '@/stores/mySchedule'
import { groupMySchedule, countdownLabel } from '@/utils/myScheduleGrouping'
import AppShell from '@/components/AppShell.vue'
import ScheduleServiceCard from '@/components/ScheduleServiceCard.vue'

const authStore = useAuthStore()
const mySchedule = useMyScheduleStore()

const showPast = ref(false)

onMounted(() => {
  mySchedule.loadMySchedule()
})

const signedInEmail = computed(() => authStore.user?.email ?? '')
const myEmailLower = computed(() => signedInEmail.value.toLowerCase())

const groups = computed(() => groupMySchedule(mySchedule.filteredDocs))

function rolesFor(doc: MyScheduleDoc): string[] {
  return doc.rolesByEmailLower[myEmailLower.value] ?? []
}

// Church filter (R403/R404/R405, Phase 130) — alphabetical by displayed
// label, fallback-labeled entries sort as the literal "Unnamed church"
// string (130-UI-SPEC.md Component Spec 1).
const sortedChurches = computed(() => {
  return [...mySchedule.churches].sort((a, b) =>
    (a.orgName || 'Unnamed church').localeCompare(b.orgName || 'Unnamed church'),
  )
})

function onChurchChange(value: string): void {
  // Empty-string option value ("All churches") clears the filter — mirrors
  // SongFilters.vue's onVwTypeChange empty-string-to-null idiom. This is a
  // pure client-side filter: it only ever assigns mySchedule.selectedChurch,
  // never authStore.selectOrg or any org-context reset (T-130-04).
  mySchedule.selectedChurch = value === '' ? null : value
}

const selectedChurchLabel = computed(() => {
  if (!mySchedule.selectedChurch) return ''
  const match = mySchedule.churches.find((c) => c.orgId === mySchedule.selectedChurch)
  return match?.orgName || 'Unnamed church'
})

// Distinct from the whole-schedule empty state (docs.length === 0, §8) —
// this is "nothing at THIS church" while other churches still have
// services (Copywriting Contract).
const filteredEmpty = computed(
  () => mySchedule.selectedChurch !== null && mySchedule.filteredDocs.length === 0 && mySchedule.docs.length > 0,
)

// First-name-only extraction for the greeting — deliberately NOT
// displayLabel's "Dana R." formula (VolunteerSignInView.vue Pitfall 5,
// 126-RESEARCH.md).
const firstName = computed(() => {
  const name = authStore.user?.displayName?.trim()
  if (!name) return null
  return name.split(/\s+/)[0] ?? null
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  return firstName.value ? `Good ${timeOfDay}, ${firstName.value}` : 'Welcome'
})

const totalUpcoming = computed(() => groups.value.thisWeek.length + groups.value.laterThisMonth.length)

const nextUpDoc = computed(() => {
  const id = groups.value.nextUpId
  if (!id) return null
  return mySchedule.docs.find((d) => d.serviceId === id) ?? null
})

// WR-03 (126-REVIEW): a volunteer whose only assignments are past services
// used to see a bare greeting with nothing else visible (Past services stays
// collapsed by default) — indistinguishable from a broken page. Surfacing an
// explicit line here (rather than defaulting `showPast` to true) keeps the
// "collapsed by default" contract the existing toggle test asserts on intact.
const summaryLine = computed(() => {
  const n = totalUpcoming.value
  if (n > 0 && nextUpDoc.value) {
    const countdown = countdownLabel(nextUpDoc.value.serviceDate).toLowerCase()
    return `You're assigned to ${n} upcoming service${n === 1 ? '' : 's'} — next one is ${countdown}.`
  }
  if (n === 0 && groups.value.past.length > 0) {
    return 'No upcoming services — see your past services below.'
  }
  return ''
})

function retry(): void {
  mySchedule.loadMySchedule()
}
</script>
