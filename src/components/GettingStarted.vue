<template>
  <div v-if="!allDone && !dismissed" class="bg-gray-900 border border-gray-800 rounded-xl shadow-xl overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-800 flex items-start justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-gray-100">Getting Started</h2>
        <p class="text-xs text-gray-500 mt-0.5">Get set up in a few quick steps</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss Getting Started"
        data-testid="getting-started-dismiss"
        class="-m-1.5 p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors shrink-0"
        @click="onDismiss"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <ul class="divide-y divide-gray-800">
      <li
        v-for="(step, index) in steps"
        :key="index"
        class="flex items-start gap-4 px-6 py-4"
      >
        <!-- Checkbox / checkmark -->
        <div class="shrink-0 mt-0.5">
          <div
            v-if="step.done"
            class="w-5 h-5 rounded-full bg-green-900/50 flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div
            v-else
            class="w-5 h-5 rounded-full border-2 border-gray-700"
          ></div>
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <p
              class="text-sm font-medium"
              :class="step.done ? 'text-gray-600 line-through' : 'text-gray-200'"
            >
              {{ step.title }}
            </p>
            <!-- Arrow link for actionable steps -->
            <router-link
              v-if="step.to && !step.done"
              :to="step.to"
              class="shrink-0 text-indigo-400 hover:text-indigo-300 transition-colors"
              aria-label="Go to step"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </router-link>
          </div>
          <p
            class="text-xs mt-0.5"
            :class="step.done ? 'text-gray-700' : 'text-gray-500'"
          >
            {{ step.description }}
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted, watch } from 'vue'
import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useSongStore } from '@/stores/songs'
import { useServiceStore } from '@/stores/services'
import { ignorePermissionDenied } from '@/utils/firestoreListener'

const authStore = useAuthStore()
const songStore = useSongStore()
const serviceStore = useServiceStore()

const memberCount = ref(0)
let unsub: Unsubscribe | null = null

// R103 — dismiss control, persisted per-device. Flat, unscoped key (matches
// CollapsibleSection.vue's precedent) since this is UI-state chrome, not church
// data. Read synchronously at setup() — no onMounted, no watcher — so an
// already-dismissed panel never flashes before hiding.
const DISMISS_KEY = 'wp:gettingStartedDismissed'

// IN-01 (48-REVIEW): localStorage can throw (private-browsing modes that fully
// disable Web Storage, enterprise policies, some extensions) — unguarded, that
// throws during setup() with no error boundary above it, which can crash this
// panel (mounted on every Dashboard visit) rather than degrading gracefully.
// Mirrors src/stores/songs.ts's established try/catch pattern for the same
// localStorage risk.
function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) !== null
  } catch {
    return false // degrade to "not dismissed" rather than crashing setup()
  }
}

const dismissed = ref(readDismissed())

function onDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, 'true')
  } catch { /* ignore: private mode / quota — degrade to in-memory only for this session */ }
  dismissed.value = true
}

// 104-REVIEW CR-01: the sidebar's in-place church switcher changes
// authStore.orgId without a route change/remount (this panel stays mounted
// across a switch on the Dashboard), so the member-count listener must react
// to the org id itself rather than only reading it once in onMounted —
// otherwise it keeps counting the previous church's members after a switch.
// `immediate: true` replaces the old onMounted-only subscribe.
watch(
  () => authStore.orgId,
  (orgId) => {
    unsub?.()
    unsub = null
    memberCount.value = 0
    if (!orgId) return
    unsub = onSnapshot(
      collection(db, 'organizations', orgId, 'members'),
      (snap) => {
        memberCount.value = snap.size
      },
      ignorePermissionDenied('GettingStarted memberCount'),
    )
  },
  { immediate: true },
)

onUnmounted(() => {
  unsub?.()
})

const steps = computed(() => [
  {
    title: 'Sign in to your account',
    description: 'You\'re signed in and ready to go.',
    done: true,
    to: null,
  },
  {
    title: 'Import your song library',
    description: 'Import songs from Planning Center CSV or add them manually.',
    done: songStore.songs.length > 0,
    to: '/songs',
  },
  {
    title: 'Plan your first service',
    description: 'Create a service plan with the Vertical Worship methodology.',
    done: serviceStore.services.length > 0,
    to: '/services',
  },
  {
    title: 'Share with your team',
    description: 'Invite team members to collaborate.',
    done: memberCount.value > 1,
    to: '/admins',
  },
])

const allDone = computed(() => steps.value.every((s) => s.done))

defineExpose({ allDone })
</script>
