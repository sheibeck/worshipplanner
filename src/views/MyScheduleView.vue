<template>
  <div class="min-h-screen bg-gray-950">
    <!-- Top bar (126-UI-SPEC.md §1) -->
    <header class="h-14 px-4 sm:px-6 border-b border-gray-800 bg-gray-900 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.98 0 13.788M12 12h.008v.008H12V12z" />
        </svg>
        <span class="text-sm font-semibold text-gray-100 tracking-tight">Worship Planner</span>
      </div>

      <div class="relative">
        <button
          type="button"
          data-testid="user-chip"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          class="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-gray-800 transition-colors"
          @click="menuOpen = !menuOpen"
        >
          <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-medium text-white shrink-0">
            {{ initials }}
          </div>
          <div class="hidden sm:block text-left min-w-0">
            <p class="text-sm font-medium text-gray-100 truncate">{{ displayLabel }}</p>
            <p class="text-xs text-gray-500 truncate">{{ authStore.user?.email }}</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        <div
          v-if="menuOpen"
          role="menu"
          data-testid="user-menu"
          class="absolute right-0 mt-2 w-56 rounded-md border border-gray-800 bg-gray-900 shadow-lg py-1 z-10"
        >
          <button
            role="menuitem"
            type="button"
            data-testid="check-different-email-menu"
            class="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
            @click="goToDifferentEmail"
          >
            Check a different email
          </button>
          <button
            role="menuitem"
            type="button"
            :disabled="isSigningOut"
            class="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50"
            @click="handleSignOut"
          >
            {{ isSigningOut ? 'Signing out...' : 'Sign out' }}
          </button>
        </div>
      </div>
    </header>

    <div class="max-w-[1060px] mx-auto px-4 sm:px-6 py-8">
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
        <p class="text-sm font-medium text-gray-200 mb-2">No services on your schedule yet</p>
        <p class="text-sm text-gray-400">
          This list is built from the roster — services show up here when a leader assigns
          {{ signedInEmail }} to a role. Ask your worship leader, or check a different email.
        </p>
        <button
          type="button"
          data-testid="check-different-email-empty"
          class="text-sm text-indigo-400 hover:text-indigo-300 mt-4"
          @click="goToDifferentEmail"
        >
          Check a different email
        </button>
      </div>

      <!-- Populated -->
      <template v-else>
        <div class="mt-8 mb-8">
          <h1 class="text-2xl font-semibold text-white">{{ greeting }}</h1>
          <p v-if="summaryLine" class="text-sm text-gray-400 mt-1">{{ summaryLine }}</p>
        </div>

        <section v-if="groups.thisWeek.length" class="mb-6">
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

        <div class="rounded-lg border border-gray-800 bg-gray-900/60 p-4 mt-8 flex items-start gap-2 text-xs text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 mt-0.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <p>
            This list is built from the roster — services show up here when a leader assigns
            {{ signedInEmail }} to a role. Missing something? Ask your worship leader, or
            <button type="button" data-testid="check-different-email-footer" class="text-indigo-400 hover:text-indigo-300 underline" @click="goToDifferentEmail">check a different email</button>.
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useVolunteerAuthStore } from '@/stores/volunteerAuth'
import { useMyScheduleStore, type MyScheduleDoc } from '@/stores/mySchedule'
import { groupMySchedule, countdownLabel } from '@/utils/myScheduleGrouping'
import ScheduleServiceCard from '@/components/ScheduleServiceCard.vue'

const router = useRouter()
const authStore = useAuthStore()
const volunteerAuth = useVolunteerAuthStore()
const mySchedule = useMyScheduleStore()

const menuOpen = ref(false)
const isSigningOut = ref(false)
const showPast = ref(false)

onMounted(() => {
  mySchedule.loadMySchedule()
})

const signedInEmail = computed(() => authStore.user?.email ?? '')
const myEmailLower = computed(() => signedInEmail.value.toLowerCase())

const groups = computed(() => groupMySchedule(mySchedule.docs))

function rolesFor(doc: MyScheduleDoc): string[] {
  return doc.rolesByEmailLower[myEmailLower.value] ?? []
}

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

// User-chip label — reuses VolunteerSignInView.vue's exact "Dana R." formula
// verbatim (this IS the right amount of detail for the top-bar chip).
const displayLabel = computed(() => {
  const name = authStore.user?.displayName?.trim()
  if (name) {
    const parts = name.split(/\s+/)
    if (parts.length > 1) {
      return `${parts[0]} ${parts[parts.length - 1]![0]}.`
    }
    return parts[0]!
  }
  return signedInEmail.value.split('@')[0] || 'Volunteer'
})

const initials = computed(() => displayLabel.value.slice(0, 2).toUpperCase())

const totalUpcoming = computed(() => groups.value.thisWeek.length + groups.value.laterThisMonth.length)

const nextUpDoc = computed(() => {
  const id = groups.value.nextUpId
  if (!id) return null
  return mySchedule.docs.find((d) => d.serviceId === id) ?? null
})

const summaryLine = computed(() => {
  const n = totalUpcoming.value
  if (n === 0 || !nextUpDoc.value) return ''
  const countdown = countdownLabel(nextUpDoc.value.serviceDate).toLowerCase()
  return `You're assigned to ${n} upcoming service${n === 1 ? '' : 's'} — next one is ${countdown}.`
})

function goToDifferentEmail(): void {
  menuOpen.value = false
  router.push({ name: 'volunteer-home' })
}

async function handleSignOut(): Promise<void> {
  isSigningOut.value = true
  try {
    await volunteerAuth.signOut()
  } finally {
    isSigningOut.value = false
    menuOpen.value = false
  }
}

function retry(): void {
  mySchedule.loadMySchedule()
}
</script>
